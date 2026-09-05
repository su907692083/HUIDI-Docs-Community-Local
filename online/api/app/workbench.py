from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .main import Lead, LeadActivity, get_db
from .mail_delivery import MailDeliveryLog, MailboxAccount
from .online_app import MailDispatchPlan, app


def _activity_payload(row: LeadActivity) -> dict[str, Any]:
    from .main import activity_to_dict
    return activity_to_dict(row)


@app.get("/api/workbench/today")
def workbench_today(db: Session = Depends(get_db)):
    leads_total = int(db.scalar(select(func.count(Lead.id))) or 0)
    statuses = {}
    for status in ["new", "qualified", "contacted", "replied", "converted"]:
        statuses[status] = int(db.scalar(select(func.count(Lead.id)).where(Lead.status == status)) or 0)

    followups = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.event_type == "followup_scheduled")
        .order_by(LeadActivity.id.desc())
        .limit(60)
    ).all()
    sent_today = int(
        db.scalar(
            select(func.count(MailDeliveryLog.id))
            .where(MailDeliveryLog.state == "sent")
            .where(MailDeliveryLog.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
        )
        or 0
    )
    failed_today = int(
        db.scalar(
            select(func.count(MailDeliveryLog.id))
            .where(MailDeliveryLog.state == "failed")
            .where(MailDeliveryLog.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
        )
        or 0
    )
    mailbox_count = int(db.scalar(select(func.count(MailboxAccount.id)).where(MailboxAccount.enabled == 1)) or 0)
    connected_mailboxes = int(
        db.scalar(
            select(func.count(MailboxAccount.id))
            .where(MailboxAccount.enabled == 1)
            .where(MailboxAccount.connection_state == "connected")
        )
        or 0
    )
    pending_plans = int(
        db.scalar(
            select(func.count(MailDispatchPlan.id)).where(MailDispatchPlan.state.in_(["review_ready_only", "ready", "queued"]))
        )
        or 0
    )
    recent = db.scalars(select(LeadActivity).order_by(LeadActivity.id.desc()).limit(12)).all()

    return {
        "ok": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "leads": {"total": leads_total, **statuses},
        "mail": {
            "sent_today": sent_today,
            "failed_today": failed_today,
            "pending": pending_plans,
            "mailboxes": mailbox_count,
            "connected_mailboxes": connected_mailboxes,
        },
        "followups": [_activity_payload(x) for x in followups[:12]],
        "recent_activity": [_activity_payload(x) for x in recent],
    }
