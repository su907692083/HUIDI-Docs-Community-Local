from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, Query, Request
from sqlalchemy import DateTime, Integer, String, Text, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, SessionLocal, engine, get_db
from .online_app import app
from .tenant_storage import current_organization_id


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_member_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    actor_name: Mapped[str] = mapped_column(String(160), default="")
    actor_email: Mapped[str] = mapped_column(String(255), default="", index=True)
    actor_role: Mapped[str] = mapped_column(String(40), default="")
    action: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(80), default="business", index=True)
    resource_type: Mapped[str] = mapped_column(String(80), default="")
    resource_id: Mapped[str] = mapped_column(String(160), default="", index=True)
    method: Mapped[str] = mapped_column(String(12), default="")
    path: Mapped[str] = mapped_column(Text, default="")
    status_code: Mapped[int] = mapped_column(Integer, default=200, index=True)
    success: Mapped[int] = mapped_column(Integer, default=1, index=True)
    source: Mapped[str] = mapped_column(String(40), default="user", index=True)
    client_host: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_EXCLUDED_PREFIXES = ("/api/audit",)
_EXCLUDED_PATHS = {"/api/team/login", "/api/team/logout"}


def _friendly_action(method: str, path: str) -> tuple[str, str]:
    if "/send" in path or "/reply" in path:
        return "mail", "发送邮件"
    if "/sequence" in path or "/sequences" in path:
        return "followup", "调整自动跟进"
    if path.startswith("/api/mail/accounts") or path.startswith("/api/mail/connect"):
        return "settings", "修改邮箱连接"
    if path.startswith("/api/mail/events") or path.startswith("/api/mail/webhooks"):
        return "mail", "回写邮件状态"
    if path.startswith("/api/mail/"):
        return "mail", "更新邮件与跟进"
    if path.startswith("/api/business/from-lead"):
        return "business", "转为客户 / 询盘"
    if path.startswith("/api/business/deals"):
        return "business", "更新询盘"
    if path.startswith("/api/business/customers"):
        return "customer", "更新客户资料"
    if path.startswith("/api/leads"):
        if "/followup" in path:
            return "followup", "安排客户跟进"
        return "lead", "更新客户线索"
    if path.startswith("/api/product-brains"):
        return "product", "保存产品资料" if method != "DELETE" else "删除产品资料"
    if path.startswith("/api/team/members"):
        return "team", "添加团队成员" if method == "POST" and path.rstrip("/") == "/api/team/members" else "调整团队成员"
    if path.startswith("/api/organizations"):
        return "team", "新建公司工作区" if method == "POST" and path.rstrip("/") == "/api/organizations" else "调整公司工作区"
    if path.startswith("/api/service-connections"):
        return "settings", "修改数据服务"
    if path.startswith("/api/tools/"):
        return "intelligence", "查询外贸资料"
    if path.startswith("/api/intelligence"):
        return "intelligence", "保存联网资料"
    if path.startswith("/api/local-sync") or "/local-event" in path:
        return "sync", "同步业务进度"
    if method == "DELETE":
        return "business", "删除业务资料"
    if method == "POST":
        return "business", "新增业务资料"
    return "business", "修改业务资料"


def _resource(path: str) -> tuple[str, str]:
    patterns = [
        (r"/api/leads/(\d+)", "lead"),
        (r"/api/business/customers/(\d+)", "customer"),
        (r"/api/business/deals/(\d+)", "deal"),
        (r"/api/team/members/(\d+)", "member"),
        (r"/api/organizations/(\d+)", "organization"),
        (r"/api/mail/accounts/(\d+)", "mailbox"),
        (r"/api/mail/sequences/(\d+)", "sequence"),
        (r"/api/product-brains/([^/?]+)", "product"),
        (r"/api/service-connections/([^/?]+)", "service"),
    ]
    for pattern, kind in patterns:
        match = re.search(pattern, path)
        if match:
            return kind, match.group(1)
    if path.startswith("/api/leads"):
        return "lead", ""
    if path.startswith("/api/business/customers"):
        return "customer", ""
    if path.startswith("/api/business/deals"):
        return "deal", ""
    if path.startswith("/api/mail"):
        return "mail", ""
    if path.startswith("/api/product-brains"):
        return "product", ""
    if path.startswith("/api/team"):
        return "team", ""
    if path.startswith("/api/organizations"):
        return "organization", ""
    if path.startswith("/api/service-connections"):
        return "service", ""
    return "business", ""


def _should_record(request: Request) -> bool:
    method = request.method.upper()
    path = request.url.path
    if method not in _MUTATING or not path.startswith("/api/"):
        return False
    if path in _EXCLUDED_PATHS:
        return False
    return not any(path.startswith(prefix) for prefix in _EXCLUDED_PREFIXES)


def _actor(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    if isinstance(member, dict) and member:
        return {
            "id": int(member.get("id") or 0) or None,
            "name": str(member.get("display_name") or member.get("email") or "团队成员"),
            "email": str(member.get("email") or ""),
            "role": str(member.get("role") or ""),
            "source": "user",
        }
    path = request.url.path
    if path.startswith("/api/mail/events") or path.startswith("/api/mail/webhooks"):
        return {"id": None, "name": "系统回传", "email": "", "role": "system", "source": "system"}
    return {"id": None, "name": "单人使用", "email": "", "role": "owner", "source": "single"}


def _write_event(request: Request, status_code: int) -> None:
    if not _should_record(request):
        return
    category, action = _friendly_action(request.method.upper(), request.url.path)
    resource_type, resource_id = _resource(request.url.path)
    actor = _actor(request)
    db = SessionLocal()
    try:
        db.add(
            AuditEvent(
                actor_member_id=actor["id"],
                actor_name=actor["name"],
                actor_email=actor["email"],
                actor_role=actor["role"],
                action=action,
                category=category,
                resource_type=resource_type,
                resource_id=resource_id,
                method=request.method.upper(),
                path=request.url.path,
                status_code=int(status_code),
                success=1 if 200 <= int(status_code) < 400 else 0,
                source=actor["source"],
                client_host=str(request.client.host if request.client else ""),
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        _write_event(request, 500)
        raise
    _write_event(request, response.status_code)
    return response


def _event_dict(row: AuditEvent) -> dict[str, Any]:
    return {
        "id": row.id,
        "actor_member_id": row.actor_member_id,
        "actor_name": row.actor_name,
        "actor_email": row.actor_email,
        "actor_role": row.actor_role,
        "action": row.action,
        "category": row.category,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "status_code": row.status_code,
        "success": bool(row.success),
        "source": row.source,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _member_scope(request: Request) -> tuple[int | None, str]:
    member = getattr(request.state, "team_member", None)
    if not isinstance(member, dict):
        return None, "owner"
    member_id = int(member.get("id") or 0) or None
    role = str(member.get("role") or "viewer")
    return member_id, role


@app.get("/api/audit/records")
def list_audit_records(
    request: Request,
    category: str = "",
    member_id: int | None = None,
    before_id: int | None = None,
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
):
    current_member_id, role = _member_scope(request)
    stmt = select(AuditEvent)
    if role not in {"owner", "admin"} and current_member_id:
        stmt = stmt.where(AuditEvent.actor_member_id == current_member_id)
    elif member_id:
        stmt = stmt.where(AuditEvent.actor_member_id == member_id)
    if category.strip():
        stmt = stmt.where(AuditEvent.category == category.strip())
    if before_id:
        stmt = stmt.where(AuditEvent.id < before_id)
    rows = db.scalars(stmt.order_by(AuditEvent.id.desc()).limit(limit)).all()
    return {
        "organization_id": current_organization_id(),
        "team_view": role in {"owner", "admin"},
        "items": [_event_dict(x) for x in rows],
        "next_before_id": rows[-1].id if len(rows) == limit else None,
    }


@app.get("/api/audit/summary")
def audit_summary(request: Request, db: Session = Depends(get_db)):
    current_member_id, role = _member_scope(request)
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).replace(tzinfo=None)
    conditions = [AuditEvent.created_at >= since]
    if role not in {"owner", "admin"} and current_member_id:
        conditions.append(AuditEvent.actor_member_id == current_member_id)
    total = int(db.scalar(select(func.count(AuditEvent.id)).where(*conditions)) or 0)
    failed = int(
        db.scalar(select(func.count(AuditEvent.id)).where(*conditions, AuditEvent.success == 0)) or 0
    )
    actors = db.execute(
        select(AuditEvent.actor_name, func.count(AuditEvent.id))
        .where(*conditions)
        .group_by(AuditEvent.actor_name)
        .order_by(func.count(AuditEvent.id).desc())
        .limit(8)
    ).all()
    return {
        "organization_id": current_organization_id(),
        "team_view": role in {"owner", "admin"},
        "last_24h": total,
        "failed": failed,
        "actors": [{"name": str(name or "系统"), "count": int(count or 0)} for name, count in actors],
    }
