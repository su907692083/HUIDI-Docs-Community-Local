from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, Lead, LeadActivity, add_activity, app, engine, get_db, lead_to_dict


LOCAL_STATUS_SCHEMA = "huidi.local.business.status/v1"
MAIL_GOVERNANCE_SCHEMA = "huidi.mail.governance/v1"
MAIL_PROVIDERS = {"gmail", "outlook", "smtp", "other"}
EMAIL_RX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class MailboxAccount(Base):
    __tablename__ = "mailbox_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(160), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), default="other")
    auth_mode: Mapped[str] = mapped_column(String(40), default="oauth2")
    connection_state: Mapped[str] = mapped_column(String(40), default="not_connected")
    daily_limit: Mapped[int] = mapped_column(Integer, default=40)
    min_interval_seconds: Mapped[int] = mapped_column(Integer, default=120)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    enabled: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailSuppression(Base):
    __tablename__ = "mail_suppressions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    reason: Mapped[str] = mapped_column(String(255), default="manual")
    source: Mapped[str] = mapped_column(String(80), default="manual")
    active: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailDispatchPlan(Base):
    __tablename__ = "mail_dispatch_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), index=True)
    recipient: Mapped[str] = mapped_column(String(255), default="")
    subject: Mapped[str] = mapped_column(Text, default="")
    draft_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    state: Mapped[str] = mapped_column(String(60), default="review_ready_only", index=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class LocalBusinessEventRequest(BaseModel):
    schema: str = LOCAL_STATUS_SCHEMA
    source: str = "HUIDI Community Local"
    event: str = Field(default="deal.updated", max_length=80)
    title: str = Field(default="本地业务进度更新", max_length=255)
    detail: str = Field(default="", max_length=1200)
    customer_id: str = Field(default="", max_length=120)
    customer_name: str = Field(default="", max_length=255)
    deal_id: str = Field(default="", max_length=120)
    deal_title: str = Field(default="", max_length=255)
    stage: str = Field(default="", max_length=80)
    next_action: str = Field(default="", max_length=500)
    next_action_at: str = Field(default="", max_length=80)
    document_type: str = Field(default="", max_length=80)
    document_id: str = Field(default="", max_length=120)
    occurred_at: str = Field(default="", max_length=80)
    meta: dict[str, Any] = Field(default_factory=dict)


class MailboxCreateRequest(BaseModel):
    display_name: str = Field(default="", max_length=160)
    email: str = Field(min_length=5, max_length=255)
    provider: str = Field(default="other", max_length=40)
    auth_mode: str = Field(default="oauth2", max_length=40)
    daily_limit: int = Field(default=40, ge=1, le=500)
    min_interval_seconds: int = Field(default=120, ge=30, le=86400)
    timezone: str = Field(default="UTC", max_length=80)


class MailboxPatchRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=160)
    provider: str | None = Field(default=None, max_length=40)
    auth_mode: str | None = Field(default=None, max_length=40)
    daily_limit: int | None = Field(default=None, ge=1, le=500)
    min_interval_seconds: int | None = Field(default=None, ge=30, le=86400)
    timezone: str | None = Field(default=None, max_length=80)
    enabled: bool | None = None


class SuppressionRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    reason: str = Field(default="manual", max_length=255)
    source: str = Field(default="manual", max_length=80)
    active: bool = True


class DispatchPlanRequest(BaseModel):
    mailbox_id: int
    review_note: str = Field(default="", max_length=1200)


def _email(value: str) -> str:
    return str(value or "").strip().lower()


def mailbox_to_dict(row: MailboxAccount) -> dict[str, Any]:
    return {
        "id": row.id,
        "display_name": row.display_name,
        "email": row.email,
        "provider": row.provider,
        "auth_mode": row.auth_mode,
        "connection_state": row.connection_state,
        "daily_limit": row.daily_limit,
        "min_interval_seconds": row.min_interval_seconds,
        "timezone": row.timezone,
        "enabled": bool(row.enabled),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def suppression_to_dict(row: MailSuppression) -> dict[str, Any]:
    return {
        "id": row.id,
        "email": row.email,
        "reason": row.reason,
        "source": row.source,
        "active": bool(row.active),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def dispatch_to_dict(row: MailDispatchPlan) -> dict[str, Any]:
    return {
        "id": row.id,
        "lead_id": row.lead_id,
        "mailbox_id": row.mailbox_id,
        "recipient": row.recipient,
        "subject": row.subject,
        "draft_fingerprint": row.draft_fingerprint,
        "state": row.state,
        "review_note": row.review_note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _draft_review_state(db: Session, lead_id: int) -> str:
    row = db.scalar(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .where(LeadActivity.event_type.in_(["draft_approved", "draft_rejected"]))
        .order_by(LeadActivity.id.desc())
    )
    if not row:
        return "unreviewed"
    return "approved" if row.event_type == "draft_approved" else "rejected"


def _active_suppression(db: Session, email: str) -> MailSuppression | None:
    if not email:
        return None
    return db.scalar(
        select(MailSuppression)
        .where(MailSuppression.email == _email(email))
        .where(MailSuppression.active == 1)
    )


def _draft_fingerprint(lead: Lead) -> str:
    raw = f"{lead.contact_email}\n{lead.draft_subject}\n{lead.draft_body}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def mail_readiness_payload(db: Session, lead: Lead, mailbox_id: int | None = None) -> dict[str, Any]:
    mailbox = db.get(MailboxAccount, mailbox_id) if mailbox_id else None
    recipient = _email(lead.contact_email)
    review = _draft_review_state(db, lead.id)
    suppression = _active_suppression(db, recipient)
    lifecycle_ok = lead.status not in {"replied", "converted", "archived"}
    checks = [
        {
            "key": "recipient",
            "label": "收件人邮箱",
            "ok": bool(recipient and EMAIL_RX.match(recipient)),
            "detail": recipient or "尚未确认业务邮箱",
        },
        {
            "key": "draft",
            "label": "开发信草稿",
            "ok": bool(lead.draft_subject.strip() and lead.draft_body.strip()),
            "detail": lead.draft_subject.strip() or "还没有草稿",
        },
        {
            "key": "human_review",
            "label": "人工确认",
            "ok": review == "approved",
            "detail": {"approved": "已确认", "rejected": "需要修改", "unreviewed": "待确认"}[review],
        },
        {
            "key": "suppression",
            "label": "退订 / 黑名单",
            "ok": suppression is None,
            "detail": "未命中抑制名单" if suppression is None else f"已阻止：{suppression.reason}",
        },
        {
            "key": "lifecycle",
            "label": "客户当前状态",
            "ok": lifecycle_ok,
            "detail": "可继续开发" if lifecycle_ok else f"当前为 {lead.status}，停止冷开发发送",
        },
        {
            "key": "mailbox",
            "label": "发送邮箱",
            "ok": bool(mailbox and mailbox.enabled),
            "detail": mailbox.email if mailbox and mailbox.enabled else "请选择已启用邮箱",
        },
    ]
    review_ready = all(x["ok"] for x in checks)
    connection_ready = bool(mailbox and mailbox.enabled and mailbox.connection_state == "connected")
    return {
        "schema": MAIL_GOVERNANCE_SCHEMA,
        "lead_id": lead.id,
        "mailbox": mailbox_to_dict(mailbox) if mailbox else None,
        "checks": checks,
        "review_ready": review_ready,
        "delivery_ready": review_ready and connection_ready,
        "send_enabled": False,
        "delivery_mode": "review_only",
        "reason": (
            "已满足人工审核条件；当前开发版仍未开放真实发送。"
            if review_ready
            else "请先处理未通过的检查项。"
        ),
    }


@app.get("/api/local-sync/health")
def local_sync_health():
    return {
        "ok": True,
        "schema": LOCAL_STATUS_SCHEMA,
        "mode": "explicit_confirmation",
        "automatic_background_upload": False,
    }


@app.post("/api/leads/{lead_id}/local-event")
def receive_local_business_event(
    lead_id: int,
    req: LocalBusinessEventRequest,
    db: Session = Depends(get_db),
):
    if req.schema != LOCAL_STATUS_SCHEMA:
        raise HTTPException(400, "不支持的 Local 状态同步版本")
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")

    payload = {
        "source": req.source,
        "event": req.event,
        "customer_id": req.customer_id,
        "customer_name": req.customer_name,
        "deal_id": req.deal_id,
        "deal_title": req.deal_title,
        "stage": req.stage,
        "next_action": req.next_action,
        "next_action_at": req.next_action_at,
        "document_type": req.document_type,
        "document_id": req.document_id,
        "occurred_at": req.occurred_at,
        "meta": req.meta,
    }
    detail = req.detail.strip() or " · ".join(
        x
        for x in [
            req.customer_name,
            req.deal_title,
            req.stage,
            req.next_action,
        ]
        if x
    )
    add_activity(
        db,
        lead.id,
        "local_business_event",
        req.title.strip() or "本地业务进度更新",
        detail[:1200],
        payload,
    )
    # A lead that has entered Community Local remains `converted`. Local business
    # stages belong to the Deal timeline and must not be misused as lead ranking/status.
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return {
        "ok": True,
        "schema": LOCAL_STATUS_SCHEMA,
        "lead": lead_to_dict(lead, db),
        "accepted_event": req.event,
    }


@app.get("/api/mail/health")
def mail_health():
    return {
        "ok": True,
        "schema": MAIL_GOVERNANCE_SCHEMA,
        "send_enabled": False,
        "delivery_mode": "review_only",
        "secrets_stored_by_this_module": False,
        "required_before_delivery": [
            "OAuth / SMTP secret encryption",
            "provider connection verification",
            "daily quota accounting",
            "send interval enforcement",
            "bounce handling",
            "unsubscribe handling",
            "reply-stop",
            "audit log",
        ],
    }


@app.get("/api/mail/accounts")
def list_mailboxes(db: Session = Depends(get_db)):
    rows = db.scalars(select(MailboxAccount).order_by(MailboxAccount.id.asc())).all()
    return [mailbox_to_dict(x) for x in rows]


@app.post("/api/mail/accounts")
def create_mailbox(req: MailboxCreateRequest, db: Session = Depends(get_db)):
    email = _email(req.email)
    if not EMAIL_RX.match(email):
        raise HTTPException(400, "邮箱格式无效")
    provider = req.provider.strip().lower()
    if provider not in MAIL_PROVIDERS:
        raise HTTPException(400, "不支持的邮箱类型")
    existing = db.scalar(select(MailboxAccount).where(MailboxAccount.email == email))
    if existing:
        raise HTTPException(409, "该邮箱已存在")
    row = MailboxAccount(
        display_name=req.display_name.strip() or email,
        email=email,
        provider=provider,
        auth_mode=req.auth_mode.strip().lower() or "oauth2",
        connection_state="not_connected",
        daily_limit=req.daily_limit,
        min_interval_seconds=req.min_interval_seconds,
        timezone=req.timezone.strip() or "UTC",
        enabled=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return mailbox_to_dict(row)


@app.patch("/api/mail/accounts/{mailbox_id}")
def patch_mailbox(mailbox_id: int, req: MailboxPatchRequest, db: Session = Depends(get_db)):
    row = db.get(MailboxAccount, mailbox_id)
    if not row:
        raise HTTPException(404, "邮箱账户不存在")
    values = req.model_dump(exclude_none=True)
    if "provider" in values:
        provider = str(values["provider"]).strip().lower()
        if provider not in MAIL_PROVIDERS:
            raise HTTPException(400, "不支持的邮箱类型")
        values["provider"] = provider
    if "enabled" in values:
        values["enabled"] = 1 if values["enabled"] else 0
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return mailbox_to_dict(row)


@app.get("/api/mail/suppressions")
def list_suppressions(db: Session = Depends(get_db)):
    rows = db.scalars(select(MailSuppression).order_by(MailSuppression.id.desc())).all()
    return [suppression_to_dict(x) for x in rows]


@app.post("/api/mail/suppressions")
def upsert_suppression(req: SuppressionRequest, db: Session = Depends(get_db)):
    email = _email(req.email)
    if not EMAIL_RX.match(email):
        raise HTTPException(400, "邮箱格式无效")
    row = db.scalar(select(MailSuppression).where(MailSuppression.email == email))
    if not row:
        row = MailSuppression(email=email)
        db.add(row)
    row.reason = req.reason.strip() or "manual"
    row.source = req.source.strip() or "manual"
    row.active = 1 if req.active else 0
    db.commit()
    db.refresh(row)
    return suppression_to_dict(row)


@app.get("/api/leads/{lead_id}/mail-readiness")
def lead_mail_readiness(lead_id: int, mailbox_id: int | None = None, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    return mail_readiness_payload(db, lead, mailbox_id)


@app.get("/api/mail/plans")
def list_dispatch_plans(lead_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(MailDispatchPlan)
    if lead_id:
        stmt = stmt.where(MailDispatchPlan.lead_id == lead_id)
    rows = db.scalars(stmt.order_by(MailDispatchPlan.id.desc())).all()
    return [dispatch_to_dict(x) for x in rows]


@app.post("/api/leads/{lead_id}/mail-plan")
def create_dispatch_plan(lead_id: int, req: DispatchPlanRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    readiness = mail_readiness_payload(db, lead, req.mailbox_id)
    if not readiness["review_ready"]:
        failed = [x["label"] for x in readiness["checks"] if not x["ok"]]
        raise HTTPException(400, "发送准备未完成：" + "、".join(failed))

    fingerprint = _draft_fingerprint(lead)
    existing = db.scalar(
        select(MailDispatchPlan)
        .where(MailDispatchPlan.lead_id == lead.id)
        .where(MailDispatchPlan.mailbox_id == req.mailbox_id)
        .where(MailDispatchPlan.draft_fingerprint == fingerprint)
        .where(MailDispatchPlan.state == "review_ready_only")
        .order_by(MailDispatchPlan.id.desc())
    )
    if existing:
        return dispatch_to_dict(existing)

    row = MailDispatchPlan(
        lead_id=lead.id,
        mailbox_id=req.mailbox_id,
        recipient=_email(lead.contact_email),
        subject=lead.draft_subject,
        draft_fingerprint=fingerprint,
        state="review_ready_only",
        review_note=req.review_note.strip(),
    )
    db.add(row)
    add_activity(
        db,
        lead.id,
        "mail_plan_created",
        "邮件已加入人工待发送计划",
        lead.draft_subject,
        {
            "mailbox_id": req.mailbox_id,
            "recipient": _email(lead.contact_email),
            "delivery_enabled": False,
            "state": "review_ready_only",
        },
    )
    db.commit()
    db.refresh(row)
    return dispatch_to_dict(row)
