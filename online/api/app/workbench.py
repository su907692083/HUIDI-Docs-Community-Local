from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .business_center import OnlineDeal
from .company_settings import company_timezone, company_timezone_name
from .mail_delivery import MailDeliveryLog
from .mail_sync import MailQueueItem, MailboxMessage
from .main import Lead, LeadActivity, activity_to_dict, get_db, safe_json
from .online_app import MailboxAccount, app


def _activity_payload(row: LeadActivity) -> dict[str, Any]:
    return activity_to_dict(row)


def _day_bounds(db: Session) -> tuple[datetime, datetime, ZoneInfo]:
    zone = company_timezone(db)
    local_now = datetime.now(zone)
    start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc, zone


def _parse_due(value: str, zone: ZoneInfo) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=zone)
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return None


def _today_followups(db: Session, end_utc: datetime, zone: ZoneInfo) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.event_type == "followup_scheduled")
        .order_by(LeadActivity.id.desc())
        .limit(400)
    ).all()
    latest_by_lead: dict[int, LeadActivity] = {}
    for row in rows:
        latest_by_lead.setdefault(row.lead_id, row)

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    items: list[dict[str, Any]] = []
    for lead_id, row in latest_by_lead.items():
        payload = safe_json(row.payload_json, {})
        due = _parse_due(str(payload.get("due_at") or ""), zone)
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
        item["task_type"] = "lead"
        items.append(item)
    items.sort(key=lambda x: (0 if x["due_state"] == "overdue" else 1, x["due_at"]))
    return items[:30]


def _today_deal_tasks(db: Session, end_utc: datetime, zone: ZoneInfo) -> list[dict[str, Any]]:
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    rows = db.scalars(
        select(OnlineDeal)
        .where(OnlineDeal.stage.notin_(["completed", "lost"]))
        .order_by(OnlineDeal.updated_at.desc())
        .limit(500)
    ).all()
    items: list[dict[str, Any]] = []
    for row in rows:
        due = _parse_due(row.next_action_at, zone)
        if not due or due > end_utc:
            continue
        items.append(
            {
                "deal_id": row.id,
                "title": row.title,
                "detail": row.next_action or "继续推进当前询盘",
                "due_at": due.isoformat(),
                "due_state": "overdue" if due < now_utc else "today",
                "stage": row.stage,
                "task_type": "deal",
            }
        )
    items.sort(key=lambda x: (0 if x["due_state"] == "overdue" else 1, x["due_at"]))
    return items[:30]


def _incoming_today(db: Session, start_utc: datetime, end_utc: datetime) -> list[MailboxMessage]:
    return db.scalars(
        select(MailboxMessage)
        .where(MailboxMessage.direction == "incoming")
        .where(MailboxMessage.lead_id.is_not(None))
        .where(MailboxMessage.received_at >= start_utc)
        .where(MailboxMessage.received_at <= end_utc)
        .order_by(MailboxMessage.received_at.desc())
        .limit(200)
    ).all()


def _needs_reply(db: Session, rows: list[MailboxMessage]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        key = row.thread_id or f"lead:{row.lead_id}:{row.id}"
        if key in seen:
            continue
        seen.add(key)
        later_outgoing = None
        if row.thread_id:
            later_outgoing = db.scalar(
                select(MailboxMessage.id)
                .where(MailboxMessage.thread_id == row.thread_id)
                .where(MailboxMessage.direction == "outgoing")
                .where(MailboxMessage.received_at > row.received_at)
                .limit(1)
            )
        elif row.lead_id:
            later_outgoing = db.scalar(
                select(MailboxMessage.id)
                .where(MailboxMessage.lead_id == row.lead_id)
                .where(MailboxMessage.direction == "outgoing")
                .where(MailboxMessage.received_at > row.received_at)
                .limit(1)
            )
        if later_outgoing:
            continue
        lead = db.get(Lead, row.lead_id) if row.lead_id else None
        items.append(
            {
                "id": row.id,
                "lead_id": row.lead_id,
                "company_name": lead.company_name if lead else "",
                "sender": row.sender,
                "subject": row.subject,
                "snippet": row.snippet,
                "thread_id": row.thread_id,
                "received_at": row.received_at.isoformat() if row.received_at else None,
                "needs_reply": True,
            }
        )
    return items[:30]


@app.get("/api/workbench/today")
def workbench_today(db: Session = Depends(get_db)):
    start_utc, end_utc, zone = _day_bounds(db)
    leads_total = int(db.scalar(select(func.count(Lead.id))) or 0)
    statuses = {}
    for status in ["new", "qualified", "contacted", "replied", "converted"]:
        statuses[status] = int(db.scalar(select(func.count(Lead.id)).where(Lead.status == status)) or 0)

    followups = _today_followups(db, end_utc, zone)
    deal_tasks = _today_deal_tasks(db, end_utc, zone)
    incoming = _incoming_today(db, start_utc, end_utc)
    replies = _needs_reply(db, incoming)

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
    mailbox_count = int(db.scalar(select(func.count(MailboxAccount.id)).where(MailboxAccount.enabled == 1)) or 0)
    connected_mailboxes = int(
        db.scalar(
            select(func.count(MailboxAccount.id))
            .where(MailboxAccount.enabled == 1)
            .where(MailboxAccount.connection_state == "connected")
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
        "timezone": company_timezone_name(db),
        "timezone_label": getattr(zone, "key", str(zone)),
        "leads": {"total": leads_total, **statuses},
        "mail": {
            "sent_today": sent_today,
            "failed_today": failed_today,
            "pending": queued,
            "mailboxes": mailbox_count,
            "connected_mailboxes": connected_mailboxes,
            "replies_received_today": len(incoming),
            "replies_today": len(replies),
            "needs_reply": len(replies),
        },
        "followups": followups,
        "deal_tasks": deal_tasks,
        "replies": replies,
        "recent_activity": [_activity_payload(x) for x in recent],
    }
