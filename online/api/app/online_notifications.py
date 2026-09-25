from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .backup_automation import BackupAutomationState
from .business_center import OnlineDeal
from .mail_delivery import MailDeliveryLog
from .mail_sequences import MailSequenceEnrollment
from .mail_sync import MailQueueItem, MailboxMessage
from .main import Base, Lead, LeadActivity, engine, get_db, safe_json
from .online_app import app


class OnlineNotificationState(Base):
    __tablename__ = "online_notification_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    state: Mapped[str] = mapped_column(String(40), default="open", index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class NotificationStateRequest(BaseModel):
    event_key: str = Field(min_length=1, max_length=255)
    state: str = Field(pattern="^(open|read|done|ignored)$")


def _due(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        out = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if out.tzinfo is None:
            out = out.replace(tzinfo=timezone.utc)
        return out.astimezone(timezone.utc)
    except Exception:
        return None


def _state_map(db: Session) -> dict[str, str]:
    rows = db.scalars(select(OnlineNotificationState)).all()
    return {x.event_key: x.state for x in rows}


def _event(
    key: str,
    category: str,
    title: str,
    summary: str,
    priority: str,
    due_at: str = "",
    action_type: str = "",
    action_id: int | str | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "category": category,
        "title": title,
        "summary": summary,
        "priority": priority,
        "due_at": due_at,
        "action": {"type": action_type, "id": action_id} if action_type else None,
    }


def build_notifications(db: Session) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=7)).replace(tzinfo=None)
    events: list[dict[str, Any]] = []

    followups = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.event_type == "followup_scheduled")
        .order_by(LeadActivity.id.desc())
        .limit(400)
    ).all()
    latest: dict[int, LeadActivity] = {}
    for row in followups:
        latest.setdefault(row.lead_id, row)
    for lead_id, row in latest.items():
        lead = db.get(Lead, lead_id)
        if not lead or lead.status in {"converted", "archived"}:
            continue
        payload = safe_json(row.payload_json, {})
        due = _due(str(payload.get("due_at") or ""))
        if not due or due > now + timedelta(days=1):
            continue
        overdue = due < now
        events.append(
            _event(
                f"lead.followup:{lead_id}:{due.date().isoformat()}",
                "followup",
                ("跟进已逾期 · " if overdue else "今天要跟进 · ") + lead.company_name,
                row.detail or "继续跟进当前客户",
                "high" if overdue else "normal",
                due.isoformat(),
                "lead",
                lead_id,
            )
        )

    replies = db.scalars(
        select(MailboxMessage)
        .where(MailboxMessage.direction == "incoming")
        .where(MailboxMessage.lead_id.is_not(None))
        .where(MailboxMessage.received_at >= cutoff)
        .order_by(MailboxMessage.received_at.desc())
        .limit(100)
    ).all()
    for row in replies:
        lead = db.get(Lead, row.lead_id) if row.lead_id else None
        events.append(
            _event(
                f"mail.reply:{row.id}",
                "reply",
                f"客户回复 · {lead.company_name if lead else row.sender}",
                row.subject or row.snippet[:220] or "收到新回复",
                "high",
                row.received_at.isoformat() if row.received_at else "",
                "lead",
                row.lead_id,
            )
        )

    failures = db.scalars(
        select(MailDeliveryLog)
        .where(MailDeliveryLog.state == "failed")
        .where(MailDeliveryLog.created_at >= cutoff)
        .order_by(MailDeliveryLog.created_at.desc())
        .limit(80)
    ).all()
    for row in failures:
        lead = db.get(Lead, row.lead_id)
        events.append(
            _event(
                f"mail.failed:{row.id}",
                "mail",
                f"邮件没有发出 · {lead.company_name if lead else row.recipient}",
                row.error or row.subject,
                "high",
                row.created_at.isoformat() if row.created_at else "",
                "lead",
                row.lead_id,
            )
        )

    queue_failed = db.scalars(
        select(MailQueueItem)
        .where(MailQueueItem.state == "failed")
        .where(MailQueueItem.updated_at >= cutoff)
        .order_by(MailQueueItem.updated_at.desc())
        .limit(80)
    ).all()
    for row in queue_failed:
        lead = db.get(Lead, row.lead_id)
        events.append(
            _event(
                f"queue.failed:{row.id}",
                "mail",
                f"待发送需要处理 · {lead.company_name if lead else '客户邮件'}",
                row.last_error or "多次尝试后仍未发出",
                "high",
                row.updated_at.isoformat() if row.updated_at else "",
                "lead",
                row.lead_id,
            )
        )

    sequence_paused = db.scalars(
        select(MailSequenceEnrollment)
        .where(MailSequenceEnrollment.state == "paused")
        .order_by(MailSequenceEnrollment.updated_at.desc())
        .limit(80)
    ).all()
    for row in sequence_paused:
        lead = db.get(Lead, row.lead_id)
        events.append(
            _event(
                f"sequence.paused:{row.id}",
                "followup",
                f"自动跟进已暂停 · {lead.company_name if lead else '客户'}",
                row.stop_reason or row.last_error or "请检查发送邮箱或客户状态后再继续",
                "high",
                row.updated_at.isoformat() if row.updated_at else "",
                "lead",
                row.lead_id,
            )
        )

    deals = db.scalars(select(OnlineDeal).order_by(OnlineDeal.updated_at.desc()).limit(300)).all()
    for deal in deals:
        due = _due(deal.next_action_at)
        if not due or due > now + timedelta(days=1) or deal.stage in {"completed", "lost"}:
            continue
        events.append(
            _event(
                f"deal.next:{deal.id}:{due.date().isoformat()}",
                "deal",
                ("业务下一步已逾期 · " if due < now else "今天推进业务 · ") + deal.title,
                deal.next_action or "继续推进当前业务",
                "high" if due < now else "normal",
                due.isoformat(),
                "deal",
                deal.id,
            )
        )

    backup_state = db.get(BackupAutomationState, 1)
    if backup_state and backup_state.status == "failed" and backup_state.last_attempt_at:
        events.append(
            _event(
                f"backup.failed:{backup_state.last_attempt_at.isoformat()}",
                "system",
                "自动备份需要处理",
                backup_state.last_error or "最近一次自动备份没有完成，请打开“上线检查”查看并先手动备份。",
                "high",
                backup_state.last_attempt_at.isoformat(),
                "settings",
                "backup",
            )
        )

    states = _state_map(db)
    for item in events:
        item["state"] = states.get(item["key"], "open")
    priority_order = {"high": 0, "normal": 1, "low": 2}
    events.sort(key=lambda x: (0 if x["state"] == "open" else 1, priority_order.get(x["priority"], 9), x.get("due_at") or ""))
    return events


@app.get("/api/notifications")
def list_notifications(include_done: bool = False, db: Session = Depends(get_db)):
    rows = build_notifications(db)
    if not include_done:
        rows = [x for x in rows if x["state"] not in {"done", "ignored"}]
    return {
        "items": rows[:200],
        "open": sum(1 for x in rows if x["state"] == "open"),
        "high": sum(1 for x in rows if x["state"] == "open" and x["priority"] == "high"),
    }


@app.post("/api/notifications/state")
def set_notification_state(req: NotificationStateRequest, db: Session = Depends(get_db)):
    row = db.scalar(select(OnlineNotificationState).where(OnlineNotificationState.event_key == req.event_key))
    if not row:
        row = OnlineNotificationState(event_key=req.event_key)
        db.add(row)
    row.state = req.state
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "event_key": req.event_key, "state": req.state}
