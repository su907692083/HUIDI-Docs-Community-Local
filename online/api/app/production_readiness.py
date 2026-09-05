from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import func, select

from .backup_automation import backup_automation_status
from .backup_restore import _backup_dir
from .main import SessionLocal
from .notification_delivery import NotificationRoute
from .online_app import MailboxAccount, app
from .service_connections import SERVICE_DEFS, public_service_status
from .tenant_storage import current_organization_id, tenant_database_url


def _require_manager(request: Request) -> None:
    member = getattr(request.state, "team_member", None)
    if not isinstance(member, dict) or not member:
        return
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以查看上线检查")


def _item(group: str, name: str, state: str, message: str, action: str = "") -> dict[str, str]:
    return {
        "group": group,
        "name": name,
        "state": state,
        "message": message,
        "action": action,
    }


def _latest_backup(organization_id: int) -> dict[str, Any] | None:
    paths = sorted(
        _backup_dir().glob(f"org-{organization_id}-*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for path in paths:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if int(data.get("organization_id") or 0) == organization_id and data.get("verified"):
                return data
        except Exception:
            continue
    return None


def build_production_readiness() -> dict[str, Any]:
    organization_id = current_organization_id()
    items: list[dict[str, str]] = []
    production = os.getenv("APP_ENV", "development").strip().lower() == "production"

    secret = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if len(secret) >= 32:
        items.append(_item("安全与账号", "服务器安全密钥", "ready", "已配置，可保护邮箱和数据服务授权。"))
    else:
        items.append(
            _item(
                "安全与账号",
                "服务器安全密钥",
                "action",
                "还没有设置足够强的安全密钥。",
                "上线前设置一条长期不变的随机安全密钥。",
            )
        )

    team_enabled = os.getenv("HUIDI_TEAM_ACCESS", "").strip().lower() in {"1", "true", "yes", "on"}
    if team_enabled:
        items.append(_item("安全与账号", "团队登录", "ready", "团队登录和公司数据隔离已开启。"))
    elif production:
        items.append(
            _item(
                "安全与账号",
                "团队登录",
                "action",
                "正式多人使用时还没有开启团队登录。",
                "如果会有多名业务员使用，请在上线前开启团队登录。",
            )
        )
    else:
        items.append(_item("安全与账号", "团队登录", "optional", "当前是单人使用模式。"))

    try:
        db_url = tenant_database_url(organization_id)
        if db_url.startswith("sqlite:///"):
            message = "当前公司使用独立本地数据文件。"
            state = "optional" if production else "ready"
            action = "正式大规模多人使用时建议切换到服务器数据库。" if production else ""
            items.append(_item("数据保护", "业务数据库", state, message, action))
        else:
            items.append(_item("数据保护", "业务数据库", "ready", "当前公司使用独立服务器数据库。"))
    except Exception:
        items.append(
            _item("数据保护", "业务数据库", "action", "当前公司的数据库没有正确连接。", "先修复数据库连接。")
        )

    latest = _latest_backup(organization_id)
    if latest:
        created = str(latest.get("created_at") or "")
        try:
            when = datetime.fromisoformat(created.replace("Z", "+00:00"))
            age_hours = max(0.0, (datetime.now(timezone.utc) - when.astimezone(timezone.utc)).total_seconds() / 3600)
        except Exception:
            age_hours = 999999
        if age_hours <= 48:
            items.append(_item("数据保护", "最近备份", "ready", "最近 48 小时内有一份已校验备份。"))
        else:
            items.append(
                _item("数据保护", "最近备份", "action", "最近一份备份已经超过 48 小时。", "现在创建一份新备份。")
            )
    else:
        items.append(
            _item("数据保护", "最近备份", "action", "当前公司还没有已校验备份。", "上线前先创建第一份公司备份。")
        )

    auto = backup_automation_status()
    if not auto.get("enabled"):
        items.append(
            _item(
                "数据保护",
                "自动备份",
                "optional",
                "自动备份已关闭。",
                "建议开启自动备份，减少依赖人工操作。",
            )
        )
    elif auto.get("status") == "failed":
        items.append(
            _item(
                "数据保护",
                "自动备份",
                "action",
                "最近一次自动备份没有完成。",
                "打开数据备份检查原因，并先手动创建一份新备份。",
            )
        )
    elif auto.get("status") == "external_required":
        items.append(
            _item(
                "数据保护",
                "自动备份",
                "optional",
                "当前使用服务器数据库，需要由数据库服务负责自动备份。",
                "请在数据库服务中确认自动备份和恢复策略已经开启。",
            )
        )
    elif auto.get("last_success_at"):
        items.append(
            _item(
                "数据保护",
                "自动备份",
                "ready",
                f"自动备份已运行，当前按约 {auto.get('interval_hours', 24)} 小时检查一次。",
            )
        )
    else:
        items.append(
            _item(
                "数据保护",
                "自动备份",
                "optional",
                f"自动备份已开启，将按约 {auto.get('interval_hours', 24)} 小时保存一次。",
            )
        )

    db = SessionLocal()
    try:
        mailbox_total = int(db.scalar(select(func.count(MailboxAccount.id)).where(MailboxAccount.enabled == 1)) or 0)
        mailbox_connected = int(
            db.scalar(
                select(func.count(MailboxAccount.id))
                .where(MailboxAccount.enabled == 1)
                .where(MailboxAccount.connection_state == "connected")
            )
            or 0
        )
        if mailbox_connected > 0:
            items.append(
                _item("邮件", "发送邮箱", "ready", f"已有 {mailbox_connected} 个邮箱连接正常，可用于日常收发。")
            )
        elif mailbox_total > 0:
            items.append(
                _item("邮件", "发送邮箱", "action", "已经添加邮箱，但还没有连接成功。", "先完成邮箱连接检查。")
            )
        else:
            items.append(
                _item("邮件", "发送邮箱", "action", "还没有添加发送邮箱。", "至少连接一个常用邮箱。")
            )

        if os.getenv("HUIDI_MAIL_EVENT_KEY", "").strip():
            items.append(_item("邮件", "退信与退订回传", "ready", "外部邮件状态回传已经有保护。"))
        else:
            items.append(
                _item(
                    "邮件",
                    "退信与退订回传",
                    "optional",
                    "还没有设置外部邮件状态回传保护。",
                    "如果会接退信或退订回调，上线前补上这一项。",
                )
            )

        if os.getenv("SERPER_API_KEY", "").strip():
            items.append(_item("开发客户", "找客户 / 地图 / 市场动态", "ready", "在线搜索服务已连接。"))
        else:
            items.append(
                _item(
                    "开发客户",
                    "找客户 / 地图 / 市场动态",
                    "action",
                    "在线找客户服务还没有连接。",
                    "连接在线搜索服务后才能返回真实客户结果。",
                )
            )

        connected_services = 0
        for key in SERVICE_DEFS:
            status = public_service_status(db, key)
            if status.get("connected"):
                connected_services += 1
        if connected_services:
            items.append(
                _item(
                    "外贸数据",
                    "企业 / 贸易 / 关税 / 船期",
                    "ready",
                    f"已有 {connected_services} 类外贸数据服务可使用。",
                )
            )
        else:
            items.append(
                _item(
                    "外贸数据",
                    "企业 / 贸易 / 关税 / 船期",
                    "optional",
                    "这些增强数据服务目前都还没有连接。",
                    "按业务需要逐项连接，不影响基础客户开发和邮件工作。",
                )
            )

        reminder_count = int(
            db.scalar(select(func.count(NotificationRoute.id)).where(NotificationRoute.enabled == 1)) or 0
        )
        if reminder_count:
            items.append(_item("提醒", "外部提醒", "ready", f"已有 {reminder_count} 个团队提醒方式开启。"))
        else:
            items.append(
                _item(
                    "提醒",
                    "外部提醒",
                    "optional",
                    "目前只使用 HUIDI 站内提醒。",
                    "需要时再连接飞书、企业微信或钉钉。",
                )
            )
    finally:
        db.close()

    if os.getenv("LLM_API_KEY", "").strip():
        items.append(_item("AI 辅助", "开发信与内容", "ready", "AI 写信服务已连接。"))
    else:
        items.append(
            _item(
                "AI 辅助",
                "开发信与内容",
                "optional",
                "AI 写信服务还没有连接，将使用基础模板能力。",
                "需要更强写信能力时再连接。",
            )
        )

    actions = sum(1 for item in items if item["state"] == "action")
    ready = sum(1 for item in items if item["state"] == "ready")
    optional = sum(1 for item in items if item["state"] == "optional")
    return {
        "ok": True,
        "organization_id": organization_id,
        "ready_for_daily_use": actions == 0,
        "summary": {"ready": ready, "action": actions, "optional": optional, "total": len(items)},
        "items": items,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/production/readiness")
def production_readiness(request: Request):
    _require_manager(request)
    return build_production_readiness()
