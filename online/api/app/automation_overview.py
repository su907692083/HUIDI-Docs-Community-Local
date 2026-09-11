from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .main import get_db
from .notification_delivery import (
    CATEGORY_NAMES,
    CHANNELS,
    NotificationDelivery,
    NotificationRoute,
    _categories,
    _require_manager,
    route_dict,
)
from .online_notifications import build_notifications
from .online_app import app


STATE_NAMES = {
    "pending": "等待执行",
    "retrying": "等待重试",
    "sent": "已完成",
    "failed": "失败",
    "skipped": "已跳过",
}


def _rule_projection(row: NotificationRoute) -> dict[str, Any]:
    base = route_dict(row)
    categories = _categories(row.categories_json)
    return {
        **base,
        "trigger": {
            "type": "business_event",
            "categories": categories,
            "category_names": [CATEGORY_NAMES[x] for x in categories],
        },
        "conditions": {
            "open_state_only": True,
            "high_priority_only": bool(row.high_only),
            "quiet_hours": {
                "timezone": row.timezone_name,
                "start": row.quiet_start,
                "end": row.quiet_end,
            },
        },
        "action": {
            "type": "notification_only",
            "channel": row.channel,
            "channel_name": CHANNELS.get(row.channel, row.channel),
            "destination_saved": bool(row.encrypted_destination),
        },
        "approval": {
            "configuration_owner": "owner_or_admin",
            "per_event_required": False,
            "reason": "当前自动化只允许发送提醒，不执行客户/询盘/单据/邮件业务写操作。",
        },
    }


def _run_projection(row: NotificationDelivery, route: NotificationRoute | None) -> dict[str, Any]:
    return {
        "id": row.id,
        "rule_id": row.route_id,
        "rule_name": route.name if route else "已删除规则",
        "event_key": row.event_key,
        "state": row.state,
        "state_name": STATE_NAMES.get(row.state, row.state),
        "attempts": int(row.attempts or 0),
        "last_error": str(row.last_error or "")[:300],
        "next_attempt_at": row.next_attempt_at.isoformat() if row.next_attempt_at else None,
        "sent_at": row.sent_at.isoformat() if row.sent_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@app.get("/api/automation/overview")
def automation_overview(request: Request, db: Session = Depends(get_db)):
    """Project existing reminder routes/deliveries as safe business automation.

    No workflow table or arbitrary code runner is introduced. The only automatic
    action is an external notification through the existing delivery owner.
    """
    _require_manager(request)
    routes = db.scalars(select(NotificationRoute).order_by(NotificationRoute.id.asc())).all()
    route_map = {row.id: row for row in routes}
    deliveries = db.scalars(
        select(NotificationDelivery)
        .order_by(NotificationDelivery.updated_at.desc(), NotificationDelivery.id.desc())
        .limit(40)
    ).all()
    events = [x for x in build_notifications(db) if x.get("state") == "open"]
    event_counts = Counter(str(x.get("category") or "") for x in events)
    run_counts = Counter(str(x.state or "") for x in deliveries)
    return {
        "ok": True,
        "mode": "notification_projection",
        "rules": [_rule_projection(row) for row in routes],
        "runs": [_run_projection(row, route_map.get(row.route_id)) for row in deliveries],
        "summary": {
            "rules": len(routes),
            "enabled_rules": sum(1 for row in routes if row.enabled),
            "open_events": len(events),
            "event_counts": dict(event_counts),
            "run_counts": dict(run_counts),
        },
        "available_triggers": [
            {"category": key, "name": name, "open": int(event_counts.get(key, 0))}
            for key, name in CATEGORY_NAMES.items()
        ],
        "allowed_actions": ["notification_only"],
        "blocked_actions": [
            "send_business_mail",
            "convert_lead_or_create_deal",
            "mutate_customer_or_deal",
            "write_formal_document",
            "change_formal_price",
            "execute_arbitrary_code",
        ],
        "guardrails": {
            "reuses_notification_owner": True,
            "new_workflow_storage": False,
            "arbitrary_code": False,
            "auto_mail_send": False,
            "auto_business_mutation": False,
            "auto_lead_conversion": False,
            "auto_document_write": False,
            "auto_price_change": False,
            "configuration_requires_owner_or_admin": True,
        },
        "message": "当前业务自动化只负责把现有业务事件按条件发送提醒；高风险业务动作仍由人工在原 Owner 中确认执行。",
    }
