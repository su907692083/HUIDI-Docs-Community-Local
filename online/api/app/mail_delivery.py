from __future__ import annotations

import base64
import hashlib
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .mail_provider import has_connected_token, send_connected_message
from .main import Base, Lead, add_activity, engine, get_db, lead_to_dict
from .online_app import (
    EMAIL_RX,
    MailDispatchPlan,
    MailboxAccount,
    _active_suppression,
    _draft_fingerprint,
    _draft_review_state,
    _email,
    app,
    mailbox_to_dict,
)

MAIL_DELIVERY_SCHEMA = "huidi.mail.delivery/v1"
SMTP_SECURITY = {"ssl", "starttls", "plain"}


class MailboxCredential(Base):
    __tablename__ = "mailbox_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), unique=True, index=True)
    host: Mapped[str] = mapped_column(String(255), default="")
    port: Mapped[int] = mapped_column(Integer, default=587)
    security: Mapped[str] = mapped_column(String(40), default="starttls")
    username: Mapped[str] = mapped_column(String(255), default="")
    secret_ciphertext: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailDeliveryLog(Base):
    __tablename__ = "mail_delivery_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), index=True)
    recipient: Mapped[str] = mapped_column(String(255), index=True)
    subject: Mapped[str] = mapped_column(Text, default="")
    state: Mapped[str] = mapped_column(String(40), default="sent", index=True)
    message_id: Mapped[str] = mapped_column(String(255), default="")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class SmtpCredentialRequest(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    security: str = Field(default="starttls", max_length=40)
    username: str = Field(default="", max_length=255)
    password: str = Field(min_length=1, max_length=4096)


class SmtpSendRequest(BaseModel):
    mailbox_id: int
    confirm: bool = False
    reply_to: str = Field(default="", max_length=255)


def _fernet() -> Fernet:
    raw = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if not raw:
        raise HTTPException(503, "请先设置服务器安全密钥，才能安全保存邮箱密码")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw.encode("utf-8")).digest())
    return Fernet(key)


def _encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def _decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise HTTPException(503, "邮箱密码无法读取，请确认服务器安全密钥没有变化") from exc


def credential_to_dict(row: MailboxCredential | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "mailbox_id": row.mailbox_id,
        "host": row.host,
        "port": row.port,
        "security": row.security,
        "username": row.username,
        "has_secret": bool(row.secret_ciphertext),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def delivery_to_dict(row: MailDeliveryLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "lead_id": row.lead_id,
        "mailbox_id": row.mailbox_id,
        "recipient": row.recipient,
        "subject": row.subject,
        "state": row.state,
        "message_id": row.message_id,
        "error": row.error,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _credential(db: Session, mailbox_id: int) -> MailboxCredential | None:
    return db.scalar(select(MailboxCredential).where(MailboxCredential.mailbox_id == mailbox_id))


def _smtp_client(cred: MailboxCredential, timeout: int = 25):
    security = cred.security.lower()
    if security == "ssl":
        client = smtplib.SMTP_SSL(cred.host, cred.port, timeout=timeout, context=ssl.create_default_context())
    else:
        client = smtplib.SMTP(cred.host, cred.port, timeout=timeout)
        client.ehlo()
        if security == "starttls":
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
    username = cred.username.strip()
    password = _decrypt_secret(cred.secret_ciphertext)
    if username:
        client.login(username, password)
    return client


def _sent_today(db: Session, mailbox_id: int) -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(
        db.scalar(
            select(func.count(MailDeliveryLog.id))
            .where(MailDeliveryLog.mailbox_id == mailbox_id)
            .where(MailDeliveryLog.state == "sent")
            .where(MailDeliveryLog.created_at >= start)
        )
        or 0
    )


def _last_sent(db: Session, mailbox_id: int) -> MailDeliveryLog | None:
    return db.scalar(
        select(MailDeliveryLog)
        .where(MailDeliveryLog.mailbox_id == mailbox_id)
        .where(MailDeliveryLog.state == "sent")
        .order_by(MailDeliveryLog.id.desc())
    )


def _connected_mode(db: Session, mailbox: MailboxAccount, cred: MailboxCredential | None) -> tuple[bool, str, str]:
    if mailbox.auth_mode == "oauth2" and mailbox.provider in {"gmail", "outlook"}:
        ok = has_connected_token(db, mailbox.id) and mailbox.connection_state == "connected"
        return ok, mailbox.provider, "已连接" if ok else "请重新连接邮箱"
    ok = bool(cred and cred.secret_ciphertext and mailbox.connection_state == "connected")
    return ok, "smtp", "已连接" if ok else "请先完成邮箱连接测试"


def delivery_readiness(db: Session, lead: Lead, mailbox: MailboxAccount) -> dict[str, Any]:
    recipient = _email(lead.contact_email)
    suppression = _active_suppression(db, recipient)
    review = _draft_review_state(db, lead.id)
    cred = _credential(db, mailbox.id)
    connected, mode, connection_detail = _connected_mode(db, mailbox, cred)
    sent_today = _sent_today(db, mailbox.id)
    last = _last_sent(db, mailbox.id)
    interval_ok = True
    wait_seconds = 0
    if last and last.created_at:
        created = last.created_at.replace(tzinfo=timezone.utc) if last.created_at.tzinfo is None else last.created_at
        elapsed = (datetime.now(timezone.utc) - created).total_seconds()
        wait_seconds = max(0, int(mailbox.min_interval_seconds - elapsed))
        interval_ok = wait_seconds <= 0

    checks = [
        {"key": "recipient", "label": "收件人邮箱", "ok": bool(recipient and EMAIL_RX.match(recipient)), "detail": recipient or "缺少邮箱"},
        {"key": "draft", "label": "邮件内容", "ok": bool(lead.draft_subject.strip() and lead.draft_body.strip()), "detail": lead.draft_subject.strip() or "还没有邮件内容"},
        {"key": "human_review", "label": "发送确认", "ok": review == "approved", "detail": "已确认" if review == "approved" else "待确认"},
        {"key": "suppression", "label": "联系状态", "ok": suppression is None, "detail": "可以联系" if suppression is None else f"已停止：{suppression.reason}"},
        {"key": "lifecycle", "label": "客户状态", "ok": lead.status not in {"replied", "converted", "archived"}, "detail": lead.status},
        {"key": "mailbox", "label": "发送邮箱", "ok": bool(mailbox.enabled), "detail": mailbox.email},
        {"key": "credential", "label": "邮箱连接", "ok": connected, "detail": connection_detail},
        {"key": "quota", "label": "今日发送量", "ok": sent_today < mailbox.daily_limit, "detail": f"已发送 {sent_today} / {mailbox.daily_limit}"},
        {"key": "interval", "label": "发送间隔", "ok": interval_ok, "detail": "可以发送" if interval_ok else f"请等待 {wait_seconds} 秒"},
    ]
    return {
        "schema": MAIL_DELIVERY_SCHEMA,
        "lead_id": lead.id,
        "mailbox": mailbox_to_dict(mailbox),
        "credential": credential_to_dict(cred) if mode == "smtp" else {"connected": connected},
        "checks": checks,
        "delivery_ready": all(x["ok"] for x in checks),
        "sent_today": sent_today,
        "daily_limit": mailbox.daily_limit,
        "wait_seconds": wait_seconds,
        "send_enabled": True,
        "delivery_mode": mode,
    }


@app.get("/api/mail/delivery-health")
def delivery_health():
    return {
        "ok": True,
        "schema": MAIL_DELIVERY_SCHEMA,
        "send_enabled": True,
        "providers": ["smtp", "gmail", "outlook"],
        "governance": ["human_review", "daily_quota", "min_interval", "suppression", "reply_stop", "audit_log"],
    }


@app.put("/api/mail/accounts/{mailbox_id}/smtp")
def save_smtp_credentials(mailbox_id: int, req: SmtpCredentialRequest, db: Session = Depends(get_db)):
    mailbox = db.get(MailboxAccount, mailbox_id)
    if not mailbox:
        raise HTTPException(404, "邮箱账户不存在")
    security = req.security.strip().lower()
    if security not in SMTP_SECURITY:
        raise HTTPException(400, "连接方式不支持")
    row = _credential(db, mailbox_id)
    if not row:
        row = MailboxCredential(mailbox_id=mailbox_id)
        db.add(row)
    row.host = req.host.strip()
    row.port = req.port
    row.security = security
    row.username = req.username.strip() or mailbox.email
    row.secret_ciphertext = _encrypt_secret(req.password)
    row.updated_at = datetime.now(timezone.utc)
    mailbox.auth_mode = "smtp"
    mailbox.provider = "smtp"
    mailbox.connection_state = "configured"
    mailbox.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {"ok": True, "mailbox": mailbox_to_dict(mailbox), "smtp": credential_to_dict(row)}


@app.get("/api/mail/accounts/{mailbox_id}/smtp")
def get_smtp_credentials(mailbox_id: int, db: Session = Depends(get_db)):
    mailbox = db.get(MailboxAccount, mailbox_id)
    if not mailbox:
        raise HTTPException(404, "邮箱账户不存在")
    return {"mailbox": mailbox_to_dict(mailbox), "smtp": credential_to_dict(_credential(db, mailbox_id))}


@app.post("/api/mail/accounts/{mailbox_id}/test")
def test_smtp_connection(mailbox_id: int, db: Session = Depends(get_db)):
    mailbox = db.get(MailboxAccount, mailbox_id)
    if not mailbox:
        raise HTTPException(404, "邮箱账户不存在")
    cred = _credential(db, mailbox_id)
    if not cred or not cred.secret_ciphertext:
        raise HTTPException(400, "请先保存邮箱连接信息")
    try:
        client = _smtp_client(cred)
        client.noop()
        client.quit()
        mailbox.connection_state = "connected"
        mailbox.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"ok": True, "mailbox": mailbox_to_dict(mailbox), "smtp": credential_to_dict(cred)}
    except Exception as exc:
        mailbox.connection_state = "error"
        mailbox.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(502, f"邮箱连接失败：{type(exc).__name__}: {exc}") from exc


@app.get("/api/leads/{lead_id}/delivery-readiness")
def lead_delivery_readiness(lead_id: int, mailbox_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    mailbox = db.get(MailboxAccount, mailbox_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    if not mailbox:
        raise HTTPException(404, "邮箱账户不存在")
    return delivery_readiness(db, lead, mailbox)


@app.post("/api/leads/{lead_id}/send")
def send_lead_email(lead_id: int, req: SmtpSendRequest, db: Session = Depends(get_db)):
    if not req.confirm:
        raise HTTPException(400, "发送前必须确认邮件内容")
    lead = db.get(Lead, lead_id)
    mailbox = db.get(MailboxAccount, req.mailbox_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    if not mailbox:
        raise HTTPException(404, "邮箱账户不存在")
    readiness = delivery_readiness(db, lead, mailbox)
    failed = [x for x in readiness["checks"] if not x["ok"]]
    if failed:
        raise HTTPException(400, "发送条件未满足：" + "、".join(x["label"] for x in failed))

    message_id = make_msgid(domain=(mailbox.email.split("@")[-1] if "@" in mailbox.email else None))
    msg = EmailMessage()
    msg["From"] = f"{mailbox.display_name} <{mailbox.email}>" if mailbox.display_name else mailbox.email
    msg["To"] = _email(lead.contact_email)
    msg["Subject"] = lead.draft_subject.strip()
    msg["Message-ID"] = message_id
    if req.reply_to and EMAIL_RX.match(_email(req.reply_to)):
        msg["Reply-To"] = _email(req.reply_to)
    msg.set_content(lead.draft_body)

    log = MailDeliveryLog(
        lead_id=lead.id,
        mailbox_id=mailbox.id,
        recipient=_email(lead.contact_email),
        subject=lead.draft_subject.strip(),
        state="sending",
        message_id=message_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        provider_message_id = ""
        if mailbox.auth_mode == "oauth2" and mailbox.provider in {"gmail", "outlook"}:
            provider_message_id = send_connected_message(db, mailbox, msg)
        else:
            cred = _credential(db, mailbox.id)
            if not cred:
                raise RuntimeError("邮箱连接信息不存在")
            client = _smtp_client(cred)
            client.send_message(msg)
            client.quit()
        log.state = "sent"
        mailbox.connection_state = "connected"
        if lead.status in {"new", "qualified"}:
            lead.status = "contacted"
        fingerprint = _draft_fingerprint(lead)
        plan = db.scalar(
            select(MailDispatchPlan)
            .where(MailDispatchPlan.lead_id == lead.id)
            .where(MailDispatchPlan.mailbox_id == mailbox.id)
            .where(MailDispatchPlan.draft_fingerprint == fingerprint)
            .order_by(MailDispatchPlan.id.desc())
        )
        if plan:
            plan.state = "sent"
            plan.updated_at = datetime.now(timezone.utc)
        add_activity(
            db,
            lead.id,
            "mail_sent",
            "开发邮件已发送",
            lead.draft_subject.strip(),
            {
                "mailbox_id": mailbox.id,
                "recipient": _email(lead.contact_email),
                "message_id": message_id,
                "provider_message_id": provider_message_id,
            },
        )
        db.commit()
        db.refresh(log)
        return {"ok": True, "delivery": delivery_to_dict(log), "lead": lead_to_dict(lead, db)}
    except Exception as exc:
        log.state = "failed"
        log.error = f"{type(exc).__name__}: {exc}"[:2000]
        mailbox.connection_state = "error"
        add_activity(
            db,
            lead.id,
            "mail_failed",
            "邮件发送失败",
            log.error,
            {"mailbox_id": mailbox.id, "recipient": _email(lead.contact_email)},
        )
        db.commit()
        raise HTTPException(502, "邮件发送失败：" + log.error) from exc


@app.get("/api/mail/deliveries")
def list_deliveries(lead_id: int | None = None, mailbox_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(MailDeliveryLog)
    if lead_id:
        stmt = stmt.where(MailDeliveryLog.lead_id == lead_id)
    if mailbox_id:
        stmt = stmt.where(MailDeliveryLog.mailbox_id == mailbox_id)
    rows = db.scalars(stmt.order_by(MailDeliveryLog.id.desc()).limit(500)).all()
    return [delivery_to_dict(x) for x in rows]
