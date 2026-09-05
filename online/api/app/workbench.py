from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .mail_delivery import MailDeliveryLog
from .mail_sync import MailQueueItem, MailboxMessage
from .main import Lead, LeadActivity, activity_to_dict, get_db, safe_json
from .online_app import MailDispatchPlan, MailboxAccount, app


def _activity_payload(row: LeadActivity) -> dict[str, Any]:
    return activity_to_dict(row)


def _workbench_timezone() -> ZoneInfo:
    name = os.getenv("HUIDI_TIMEZONE", "Asia/Shanghai").strip() or "Asia/Shanghai"
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")


def _day_bounds() -> tuple[datetime, datetime, str]:
    zone = _workbench_timezone()
    local_now = datetime.now(zone)
    start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc, str(zone)


def _parse_due(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=_workbench_timezone())
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return None


def _today_followups(db: Session, end_utc: datetime) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.event_type == "followup_scheduled")
        .order_by(LeadActivity.id.desc())
        .limit(300)
    ).all()
    latest_by_lead: dict[int, LeadActivity] = {}
    for row in rows:
        if row.lead_id not in latest_by_lead:
            latest_by_lead[row.lead_id] = row

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    items: list[dict[str, Any]] = []
    for lead_id, row in latest_by_lead.items():
        payload = safe_json(row.payload_json, {})
        due = _parse_due(str(payload.get("due_at") or ""))
        if not due or due > end_utc:
            continue
        lead = db.get(Lead, lead_id)
        if not lead or lead.status in {"converted", "archived"}:
            continue
        item = activity_to_dict(row)
        item["company_name"] = lead.company_name
        item["lead_status"] = lead.status
        item["due_state"] = "overdue" if due < now_utc else "today"
        item["due_at"] = due.isoformat()
        items.append(item)
    items.sort(key=lambda x: (0 if x["due_state"] == "overdue" else 1, x["due_at"]))
    return items[:20]


def _recent_replies(db: Session, start_utc: datetime, end_utc: datetime) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MailboxMessage)
        .where(MailboxMessage.direction == "incoming")
        .where(MailboxMessage.lead_id.is_not(None))
        .where(MailboxMessage.received_at >= start_utc)
        .where(MailboxMessage.received_at <= end_utc)
        .order_by(MailboxMessage.received_at.desc())
        .limit(20)
    ).all()
    items = []
    for row in rows:
        lead = db.get(Lead, row.lead_id) if row.lead_id else None
        payload = {
            "id": row.id,
            "lead_id": row.lead_id,
            "company_name": lead.company_name if lead else "",
            "sender": row.sender,
            "subject": row.subject,
            "snippet": row.snippet,
            "thread_id": row.thread_id,
            "received_at": row.received_at.isoformat() if row.received_at else None,
        }
        items.append(payload)
    return items


@app.get("/api/workbench/today")
def workbench_today(db: Session = Depends(get_db)):
    start_utc, end_utc, timezone_name = _day_bounds()
    leads_total = int(db.scalar(select(func.count(Lead.id))) or 0)
    statuses = {}
    for status in ["new", "qualified", "contacted", "replied", "converted"]:
        statuses[status] = int(db.scalar(select(func.count(Lead.id)).where(Lead.status == status)) or 0)

    followups = _today_followups(db, end_utc)
    replies = _recent_replies(db, start_utc, end_utc)

    sent_today = int(
        db.scalar(
            select(func.count(MailDeliveryLog.id))
            .where(MailDeliveryLog.state == "sent")
            .where(MailDeliveryLog.created_at >= start_utc)
            .where(MailDeliveryLog.created_at <= end_utc)
        )
        or 0
    )
    failed_today = int(
        db.scalar(
            select(func.count(MailDeliveryLog.id))
            .where(MailDeliveryLog.state == "failed")
            .where(MailDeliveryLog.created_at >= start_utc)
            .where(MailDeliveryLog.created_at <= end_utc)
        )
        or 0
    )
    mailbox_count = int(
        db.scalar(select(func.count(MailboxAccount.id)).where(MailboxAccount.enabled == 1)) or 0
    )
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
            select(func.count(MailDispatchPlan.id)).where(
                MailDispatchPlan.state.in_(["review_ready_only", "ready", "queued"])
            )
        )
        or 0
    )
    queued = int(
        db.scalar(
            select(func.count(MailQueueItem.id)).where(
                MailQueueItem.state.in_(["queued", "retrying", "sending"])
            )
        )
        or 0
    )
    recent = db.scalars(select(LeadActivity).order_by(LeadActivity.id.desc()).limit(16)).all()

    return {
        "ok": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "timezone": timezone_name,
        "leads": {"total": leads_total, **statuses},
        "mail": {
            "sent_today": sent_today,
            "failed_today": failed_today,
            "pending": pending_plans + queued,
            "mailboxes": mailbox_count,
            "connected_mailboxes": connected_mailboxes,
            "replies_today": len(replies),
        },
        "followups": followups,
        "replies": replies,
        "recent_activity": [_activity_payload(x) for x in recent],
    }
