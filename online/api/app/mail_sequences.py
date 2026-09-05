from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .mail_delivery import SmtpSendRequest, send_lead_email
from .main import Base, Lead, SessionLocal, add_activity, engine, get_db
from .online_app import MailboxAccount, _active_suppression, _email, app


class MailSequenceTemplate(Base):
    __tablename__ = "mail_sequence_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    steps_json: Mapped[str] = mapped_column(Text, default="[]")
    approved: Mapped[int] = mapped_column(Integer, default=0, index=True)
    enabled: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailSequenceEnrollment(Base):
    __tablename__ = "mail_sequence_enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("mail_sequence_templates.id"), index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), index=True)
    state: Mapped[str] = mapped_column(String(40), default="active", index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    next_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    stop_reason: Mapped[str] = mapped_column(Text, default="")
    last_error: Mapped[str] = mapped_column(Text, default="")
    last_delivery_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class SequenceStepInput(BaseModel):
    delay_hours: int = Field(default=0, ge=0, le=24 * 90)
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=20000)


class SequenceTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    steps: list[SequenceStepInput] = Field(min_length=1, max_length=8)
    confirm: bool = False
    enabled: bool = True


class SequenceEnrollRequest(BaseModel):
    template_id: int
    mailbox_id: int
    confirm: bool = False
    start_at: datetime | None = None


class SequenceStateRequest(BaseModel):
    state: str = Field(pattern="^(active|paused|stopped)$")


def _utc_now_db() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _steps(row: MailSequenceTemplate) -> list[dict[str, Any]]:
    try:
        out = json.loads(row.steps_json or "[]")
        return out if isinstance(out, list) else []
    except Exception:
        return []


def _template_dict(row: MailSequenceTemplate) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "steps": _steps(row),
        "approved": bool(row.approved),
        "enabled": bool(row.enabled),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _enrollment_dict(row: MailSequenceEnrollment, db: Session) -> dict[str, Any]:
    template = db.get(MailSequenceTemplate, row.template_id)
    lead = db.get(Lead, row.lead_id)
    mailbox = db.get(MailboxAccount, row.mailbox_id)
    return {
        "id": row.id,
        "template_id": row.template_id,
        "template_name": template.name if template else "",
        "lead_id": row.lead_id,
        "company_name": lead.company_name if lead else "",
        "mailbox_id": row.mailbox_id,
        "mailbox_email": mailbox.email if mailbox else "",
        "state": row.state,
        "current_step": row.current_step,
        "total_steps": len(_steps(template)) if template else 0,
        "next_at": row.next_at.isoformat() if row.next_at else None,
        "attempts": row.attempts,
        "stop_reason": row.stop_reason,
        "last_error": row.last_error,
        "last_delivery_id": row.last_delivery_id,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _render(text: str, lead: Lead) -> str:
    values = {
        "{{company}}": lead.company_name or "",
        "{{contact}}": lead.contact_name or "Team",
        "{{product}}": lead.market_keyword or "our products",
        "{{country}}": lead.country or "",
    }
    out = str(text or "")
    for key, value in values.items():
        out = out.replace(key, value)
    return out.strip()


def _stop_if_needed(db: Session, row: MailSequenceEnrollment, lead: Lead) -> str:
    if lead.status in {"replied", "converted", "archived"}:
        return "客户已经回复、进入正式业务或已归档"
    suppression = _active_suppression(db, _email(lead.contact_email))
    if suppression:
        return "客户已经停止接收后续开发邮件"
    return ""


def _finish_stop(db: Session, row: MailSequenceEnrollment, lead: Lead, reason: str) -> None:
    row.state = "stopped"
    row.stop_reason = reason
    row.updated_at = datetime.now(timezone.utc)
    add_activity(db, lead.id, "sequence_stopped", "自动跟进已停止", reason, {"sequence_id": row.id})
    db.commit()


@app.get("/api/mail/sequences")
def list_sequences(db: Session = Depends(get_db)):
    rows = db.scalars(select(MailSequenceTemplate).order_by(MailSequenceTemplate.id.desc())).all()
    return [_template_dict(x) for x in rows]


@app.post("/api/mail/sequences")
def create_sequence(req: SequenceTemplateRequest, db: Session = Depends(get_db)):
    row = MailSequenceTemplate(
        name=req.name.strip(),
        description=req.description.strip(),
        steps_json=json.dumps([x.model_dump() for x in req.steps], ensure_ascii=False),
        approved=1 if req.confirm else 0,
        enabled=1 if req.enabled else 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _template_dict(row)


@app.put("/api/mail/sequences/{template_id}")
def update_sequence(template_id: int, req: SequenceTemplateRequest, db: Session = Depends(get_db)):
    row = db.get(MailSequenceTemplate, template_id)
    if not row:
        raise HTTPException(404, "没有找到这套跟进计划")
    row.name = req.name.strip()
    row.description = req.description.strip()
    row.steps_json = json.dumps([x.model_dump() for x in req.steps], ensure_ascii=False)
    row.approved = 1 if req.confirm else 0
    row.enabled = 1 if req.enabled else 0
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _template_dict(row)


@app.post("/api/mail/sequences/default")
def create_default_sequence(db: Session = Depends(get_db)):
    existing = db.scalar(select(MailSequenceTemplate).where(MailSequenceTemplate.name == "常用三次跟进"))
    if existing:
        return _template_dict(existing)
    steps = [
        {
            "delay_hours": 0,
            "subject": "Quick question about {{product}}",
            "body": "Dear {{contact}},\n\nI am reaching out regarding {{product}}. If this category is relevant to {{company}}, I can send a concise quotation, specifications and packing details for your review.\n\nBest regards",
        },
        {
            "delay_hours": 72,
            "subject": "Following up on {{product}}",
            "body": "Dear {{contact}},\n\nJust following up on my previous message about {{product}}. If you are currently sourcing this category, I can share the most relevant specifications and a short quotation instead of a long introduction.\n\nBest regards",
        },
        {
            "delay_hours": 120,
            "subject": "Should I close this for now?",
            "body": "Dear {{contact}},\n\nI do not want to keep filling your inbox. If {{product}} is not a current priority, I can close this follow-up for now. If it is relevant, simply reply with the specification or quantity you are considering and I will prepare the next step.\n\nBest regards",
        },
    ]
    row = MailSequenceTemplate(
        name="常用三次跟进",
        description="首次联系后，3 天和 5 天各跟进一次。客户一旦回复会自动停止。",
        steps_json=json.dumps(steps, ensure_ascii=False),
        approved=0,
        enabled=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _template_dict(row)


@app.get("/api/mail/sequence-enrollments")
def list_enrollments(state: str = "", db: Session = Depends(get_db)):
    stmt = select(MailSequenceEnrollment)
    if state.strip():
        stmt = stmt.where(MailSequenceEnrollment.state == state.strip())
    rows = db.scalars(stmt.order_by(MailSequenceEnrollment.id.desc()).limit(500)).all()
    return [_enrollment_dict(x, db) for x in rows]


@app.post("/api/leads/{lead_id}/sequence")
def enroll_sequence(lead_id: int, req: SequenceEnrollRequest, db: Session = Depends(get_db)):
    if not req.confirm:
        raise HTTPException(400, "开始自动跟进前，请先确认整套邮件内容和发送间隔")
    lead = db.get(Lead, lead_id)
    template = db.get(MailSequenceTemplate, req.template_id)
    mailbox = db.get(MailboxAccount, req.mailbox_id)
    if not lead:
        raise HTTPException(404, "没有找到这条客户线索")
    if not template or not template.enabled:
        raise HTTPException(404, "这套跟进计划当前不可用")
    if not template.approved:
        raise HTTPException(400, "请先确认这套跟进内容，再开始自动跟进")
    if not mailbox or not mailbox.enabled:
        raise HTTPException(400, "请选择可用的发送邮箱")
    if not _email(lead.contact_email):
        raise HTTPException(400, "这个客户还没有确认邮箱")
    reason = _stop_if_needed(db, MailSequenceEnrollment(), lead)
    if reason:
        raise HTTPException(400, reason)

    old = db.scalar(
        select(MailSequenceEnrollment)
        .where(MailSequenceEnrollment.lead_id == lead.id)
        .where(MailSequenceEnrollment.state.in_(["active", "paused"]))
        .order_by(MailSequenceEnrollment.id.desc())
    )
    if old:
        old.state = "stopped"
        old.stop_reason = "已改用新的跟进计划"
        old.updated_at = datetime.now(timezone.utc)

    steps = _steps(template)
    first_delay = int((steps[0] if steps else {}).get("delay_hours") or 0)
    start = req.start_at or datetime.now(timezone.utc)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    row = MailSequenceEnrollment(
        template_id=template.id,
        lead_id=lead.id,
        mailbox_id=mailbox.id,
        state="active",
        current_step=0,
        next_at=(start.astimezone(timezone.utc) + timedelta(hours=first_delay)).replace(tzinfo=None),
    )
    db.add(row)
    db.flush()
    add_activity(
        db,
        lead.id,
        "sequence_started",
        "已开始自动跟进",
        template.name,
        {"sequence_id": row.id, "steps": len(steps), "mailbox_id": mailbox.id},
    )
    db.commit()
    db.refresh(row)
    return _enrollment_dict(row, db)


@app.post("/api/mail/sequence-enrollments/{enrollment_id}/state")
def set_enrollment_state(enrollment_id: int, req: SequenceStateRequest, db: Session = Depends(get_db)):
    row = db.get(MailSequenceEnrollment, enrollment_id)
    if not row:
        raise HTTPException(404, "没有找到这条自动跟进")
    row.state = req.state
    row.updated_at = datetime.now(timezone.utc)
    if req.state == "active" and row.next_at and row.next_at < _utc_now_db():
        row.next_at = _utc_now_db()
    db.commit()
    db.refresh(row)
    return _enrollment_dict(row, db)


def run_sequences_once(limit: int = 20) -> dict[str, Any]:
    db = SessionLocal()
    sent = 0
    stopped = 0
    paused = 0
    try:
        now = _utc_now_db()
        rows = db.scalars(
            select(MailSequenceEnrollment)
            .where(MailSequenceEnrollment.state == "active")
            .where(MailSequenceEnrollment.next_at <= now)
            .order_by(MailSequenceEnrollment.next_at.asc())
            .limit(limit)
        ).all()
        for row in rows:
            lead = db.get(Lead, row.lead_id)
            template = db.get(MailSequenceTemplate, row.template_id)
            mailbox = db.get(MailboxAccount, row.mailbox_id)
            if not lead or not template or not mailbox or not template.enabled or not template.approved:
                if lead:
                    _finish_stop(db, row, lead, "跟进计划或发送邮箱已经不可用")
                else:
                    row.state = "stopped"
                    row.stop_reason = "客户资料已经不存在"
                    db.commit()
                stopped += 1
                continue

            reason = _stop_if_needed(db, row, lead)
            if reason:
                _finish_stop(db, row, lead, reason)
                stopped += 1
                continue

            steps = _steps(template)
            if row.current_step >= len(steps):
                row.state = "completed"
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                continue

            step = steps[row.current_step]
            lead.draft_subject = _render(str(step.get("subject") or ""), lead)
            lead.draft_body = _render(str(step.get("body") or ""), lead)
            lead.updated_at = datetime.now(timezone.utc)
            add_activity(
                db,
                lead.id,
                "draft_approved",
                "自动跟进内容已确认",
                lead.draft_subject,
                {"sequence_id": row.id, "step": row.current_step + 1, "preapproved_plan": True},
            )
            db.commit()

            try:
                out = send_lead_email(
                    lead.id,
                    SmtpSendRequest(mailbox_id=mailbox.id, confirm=True),
                    db,
                )
                delivery = out.get("delivery") or {}
                row.last_delivery_id = delivery.get("id")
                row.current_step += 1
                row.attempts = 0
                row.last_error = ""
                row.updated_at = datetime.now(timezone.utc)
                add_activity(
                    db,
                    lead.id,
                    "sequence_step_sent",
                    "自动跟进已发送",
                    f"第 {row.current_step} 次 · {lead.draft_subject}",
                    {"sequence_id": row.id, "step": row.current_step, "delivery_id": row.last_delivery_id},
                )
                if row.current_step >= len(steps):
                    row.state = "completed"
                    row.next_at = _utc_now_db()
                    add_activity(db, lead.id, "sequence_completed", "自动跟进已完成", template.name, {"sequence_id": row.id})
                else:
                    delay = int(steps[row.current_step].get("delay_hours") or 0)
                    row.next_at = (datetime.now(timezone.utc) + timedelta(hours=delay)).replace(tzinfo=None)
                db.commit()
                sent += 1
            except Exception as exc:
                row.attempts += 1
                row.last_error = str(exc)[:2000]
                row.updated_at = datetime.now(timezone.utc)
                if row.attempts >= 6:
                    row.state = "paused"
                    row.stop_reason = "连续多次没有发出，请人工检查邮箱或客户状态"
                    paused += 1
                    add_activity(db, lead.id, "sequence_paused", "自动跟进已暂停", row.last_error, {"sequence_id": row.id})
                else:
                    wait_minutes = min(180, 5 * (2 ** max(0, row.attempts - 1)))
                    row.next_at = (datetime.now(timezone.utc) + timedelta(minutes=wait_minutes)).replace(tzinfo=None)
                db.commit()
        return {"ok": True, "processed": len(rows), "sent": sent, "stopped": stopped, "paused": paused}
    finally:
        db.close()


@app.post("/api/mail/sequences/run")
def run_sequences_route(limit: int = Query(default=20, ge=1, le=100)):
    return run_sequences_once(limit)


_runtime_lock = threading.Lock()
_runtime_thread: threading.Thread | None = None
_runtime_stop = threading.Event()


def _runtime_loop() -> None:
    while not _runtime_stop.is_set():
        try:
            run_sequences_once(20)
        except Exception:
            pass
        _runtime_stop.wait(60)


def _ensure_runtime_thread() -> None:
    global _runtime_thread
    if os.getenv("HUIDI_DISABLE_BACKGROUND_JOBS", "").strip() == "1":
        return
    if os.getenv("CI", "").strip().lower() in {"1", "true", "yes"}:
        return
    with _runtime_lock:
        if _runtime_thread and _runtime_thread.is_alive():
            return
        _runtime_stop.clear()
        _runtime_thread = threading.Thread(target=_runtime_loop, name="huidi-mail-sequences", daemon=True)
        _runtime_thread.start()


_ensure_runtime_thread()
