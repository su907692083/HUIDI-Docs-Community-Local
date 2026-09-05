from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from typing import Any

import httpx
from fastapi import Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .mail_delivery import SmtpSendRequest, send_lead_email
from .mail_provider import access_token, begin_connection, finish_connection, has_connected_token
from .main import Base, Lead, SessionLocal, add_activity, engine, get_db
from .online_app import MailSuppression, MailboxAccount, _email, app


class MailboxMessage(Base):
    __tablename__ = "mailbox_messages"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), index=True)
    provider_message_id: Mapped[str] = mapped_column(String(512), index=True)
    thread_id: Mapped[str] = mapped_column(String(512), default="", index=True)
    internet_message_id: Mapped[str] = mapped_column(String(512), default="", index=True)
    direction: Mapped[str] = mapped_column(String(20), default="incoming", index=True)
    folder: Mapped[str] = mapped_column(String(40), default="inbox", index=True)
    sender: Mapped[str] = mapped_column(String(512), default="", index=True)
    recipients_json: Mapped[str] = mapped_column(Text, default="[]")
    subject: Mapped[str] = mapped_column(Text, default="")
    snippet: Mapped[str] = mapped_column(Text, default="")
    received_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    has_unsubscribe: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailQueueItem(Base):
    __tablename__ = "mail_queue_items"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), index=True)
    state: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    delivery_log_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class QueueRequest(BaseModel):
    mailbox_id: int
    confirm: bool = False
    send_at: datetime | None = None
    max_attempts: int = Field(default=3, ge=1, le=8)


class MailEventRequest(BaseModel):
    event: str = Field(pattern="^(bounce|unsubscribe|complaint)$")
    email: str = Field(min_length=5, max_length=255)
    reason: str = Field(default="", max_length=1000)
    provider_message_id: str = Field(default="", max_length=512)


def _utc_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def _db_time(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    return _utc_dt(value).replace(tzinfo=None)


def _sender_email(value: str) -> str:
    return _email(parseaddr(str(value or ""))[1] or value)


def _message_dict(row: MailboxMessage) -> dict[str, Any]:
    try:
        recipients = json.loads(row.recipients_json or "[]")
    except Exception:
        recipients = []
    return {
        "id": row.id,
        "mailbox_id": row.mailbox_id,
        "provider_message_id": row.provider_message_id,
        "thread_id": row.thread_id,
        "internet_message_id": row.internet_message_id,
        "direction": row.direction,
        "folder": row.folder,
        "sender": row.sender,
        "recipients": recipients,
        "subject": row.subject,
        "snippet": row.snippet,
        "received_at": row.received_at.isoformat() if row.received_at else None,
        "lead_id": row.lead_id,
        "has_unsubscribe": bool(row.has_unsubscribe),
    }


def _queue_dict(row: MailQueueItem) -> dict[str, Any]:
    return {
        "id": row.id,
        "lead_id": row.lead_id,
        "mailbox_id": row.mailbox_id,
        "state": row.state,
        "attempts": row.attempts,
        "max_attempts": row.max_attempts,
        "scheduled_at": row.scheduled_at.isoformat() if row.scheduled_at else None,
        "next_attempt_at": row.next_attempt_at.isoformat() if row.next_attempt_at else None,
        "last_error": row.last_error,
        "delivery_log_id": row.delivery_log_id,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _upsert_suppression(db: Session, email: str, reason: str, source: str) -> None:
    email = _email(email)
    if not email:
        return
    row = db.scalar(select(MailSuppression).where(MailSuppression.email == email))
    if not row:
        row = MailSuppression(email=email)
        db.add(row)
    row.reason = reason
    row.source = source
    row.active = 1


def _bounce_target(subject: str, snippet: str, sender: str) -> str:
    text = f"{subject} {snippet}".lower()
    sender_l = sender.lower()
    is_bounce = any(x in sender_l for x in ["mailer-daemon", "postmaster"]) or any(
        x in text
        for x in [
            "undeliverable",
            "delivery status notification",
            "delivery failed",
            "mail delivery failed",
            "退信",
            "无法送达",
        ]
    )
    if not is_bounce:
        return ""
    matches = re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", f"{subject} {snippet}", re.I)
    return _email(matches[0]) if matches else ""


def _record_message(db: Session, mailbox: MailboxAccount, item: dict[str, Any]) -> tuple[MailboxMessage, bool]:
    provider_id = str(item.get("provider_message_id") or "").strip()
    if not provider_id:
        raise ValueError("message id required")
    existing = db.scalar(
        select(MailboxMessage)
        .where(MailboxMessage.mailbox_id == mailbox.id)
        .where(MailboxMessage.provider_message_id == provider_id)
    )
    if existing:
        return existing, False

    sender = _sender_email(str(item.get("sender") or ""))
    direction = str(item.get("direction") or "incoming")
    lead = None
    if direction == "incoming" and sender:
        lead = db.scalar(select(Lead).where(func.lower(Lead.contact_email) == sender))

    row = MailboxMessage(
        mailbox_id=mailbox.id,
        provider_message_id=provider_id,
        thread_id=str(item.get("thread_id") or ""),
        internet_message_id=str(item.get("internet_message_id") or ""),
        direction=direction,
        folder=str(item.get("folder") or ("inbox" if direction == "incoming" else "sent")),
        sender=sender or str(item.get("sender") or ""),
        recipients_json=json.dumps(item.get("recipients") or [], ensure_ascii=False),
        subject=str(item.get("subject") or "")[:4000],
        snippet=str(item.get("snippet") or "")[:8000],
        received_at=_db_time(_utc_dt(item.get("received_at"))),
        lead_id=lead.id if lead else None,
        has_unsubscribe=1 if item.get("has_unsubscribe") else 0,
    )
    db.add(row)
    db.flush()

    if direction == "incoming":
        bounce_email = _bounce_target(row.subject, row.snippet, row.sender)
        if bounce_email:
            _upsert_suppression(db, bounce_email, "bounce", "mailbox")
        if lead:
            if lead.status not in {"converted", "archived"}:
                lead.status = "replied"
            lead.updated_at = datetime.now(timezone.utc)
            _upsert_suppression(db, sender, "reply_stop", "mailbox")
            add_activity(
                db,
                lead.id,
                "mail_reply_received",
                "客户回复了邮件",
                row.subject or row.snippet[:300],
                {
                    "mailbox_id": mailbox.id,
                    "message_id": provider_id,
                    "thread_id": row.thread_id,
                    "sender": sender,
                },
            )
    db.commit()
    db.refresh(row)
    return row, True


def _gmail_messages(db: Session, mailbox: MailboxAccount, folder: str, limit: int) -> list[dict[str, Any]]:
    token = access_token(db, mailbox)
    headers = {"Authorization": f"Bearer {token}"}
    label = "INBOX" if folder == "inbox" else "SENT"
    with httpx.Client(timeout=30) as client:
        listing = client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers=headers,
            params={"labelIds": label, "maxResults": min(limit, 100)},
        )
        if listing.status_code >= 400:
            raise HTTPException(502, "收取 Gmail 邮件失败，请重新连接后再试")
        result: list[dict[str, Any]] = []
        for ref in listing.json().get("messages", []):
            mid = str(ref.get("id") or "")
            if not mid:
                continue
            response = client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}",
                headers=headers,
                params={
                    "format": "metadata",
                    "metadataHeaders": ["From", "To", "Subject", "Message-ID", "List-Unsubscribe"],
                },
            )
            if response.status_code >= 400:
                continue
            data = response.json()
            header_rows = (data.get("payload") or {}).get("headers", [])
            hs = {str(x.get("name") or "").lower(): str(x.get("value") or "") for x in header_rows}
            received = datetime.now(timezone.utc)
            if data.get("internalDate"):
                received = datetime.fromtimestamp(int(data["internalDate"]) / 1000, tz=timezone.utc)
            result.append(
                {
                    "provider_message_id": mid,
                    "thread_id": str(data.get("threadId") or ""),
                    "internet_message_id": hs.get("message-id", ""),
                    "direction": "incoming" if folder == "inbox" else "outgoing",
                    "folder": folder,
                    "sender": hs.get("from", ""),
                    "recipients": [x.strip() for x in hs.get("to", "").split(",") if x.strip()],
                    "subject": hs.get("subject", ""),
                    "snippet": str(data.get("snippet") or ""),
                    "received_at": received,
                    "has_unsubscribe": bool(hs.get("list-unsubscribe")),
                }
            )
        return result


def _outlook_messages(db: Session, mailbox: MailboxAccount, folder: str, limit: int) -> list[dict[str, Any]]:
    token = access_token(db, mailbox)
    headers = {"Authorization": f"Bearer {token}"}
    mail_folder = "inbox" if folder == "inbox" else "sentitems"
    params = {
        "$top": min(limit, 100),
        "$orderby": "receivedDateTime desc",
        "$select": "id,conversationId,internetMessageId,from,toRecipients,subject,bodyPreview,receivedDateTime,internetMessageHeaders",
    }
    with httpx.Client(timeout=30) as client:
        response = client.get(
            f"https://graph.microsoft.com/v1.0/me/mailFolders/{mail_folder}/messages",
            headers=headers,
            params=params,
        )
        if response.status_code >= 400:
            raise HTTPException(502, "收取 Outlook 邮件失败，请重新连接后再试")
        result: list[dict[str, Any]] = []
        for data in response.json().get("value", []):
            sender = ((data.get("from") or {}).get("emailAddress") or {}).get("address") or ""
            recipients = [
                ((x.get("emailAddress") or {}).get("address") or "")
                for x in data.get("toRecipients", [])
            ]
            headers_map = {
                str(x.get("name") or "").lower(): str(x.get("value") or "")
                for x in data.get("internetMessageHeaders", [])
            }
            result.append(
                {
                    "provider_message_id": str(data.get("id") or ""),
                    "thread_id": str(data.get("conversationId") or ""),
                    "internet_message_id": str(data.get("internetMessageId") or ""),
                    "direction": "incoming" if folder == "inbox" else "outgoing",
                    "folder": folder,
                    "sender": sender,
                    "recipients": [x for x in recipients if x],
                    "subject": str(data.get("subject") or ""),
                    "snippet": str(data.get("bodyPreview") or ""),
                    "received_at": _utc_dt(data.get("receivedDateTime")),
                    "has_unsubscribe": bool(headers_map.get("list-unsubscribe")),
                }
            )
        return result


def sync_mailbox(db: Session, mailbox: MailboxAccount, limit: int = 50) -> dict[str, Any]:
    if mailbox.provider not in {"gmail", "outlook"} or mailbox.auth_mode != "oauth2":
        raise HTTPException(400, "这个邮箱不需要自动收取")
    if not has_connected_token(db, mailbox.id):
        raise HTTPException(400, "这个邮箱还没有完成连接")
    added = 0
    for folder in ["inbox", "sent"]:
        rows = (
            _gmail_messages(db, mailbox, folder, limit)
            if mailbox.provider == "gmail"
            else _outlook_messages(db, mailbox, folder, limit)
        )
        for item in rows:
            _, created = _record_message(db, mailbox, item)
            if created:
                added += 1
    mailbox.connection_state = "connected"
    mailbox.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "mailbox_id": mailbox.id, "added": added}


@app.get("/api/mail/connect/{provider}/start")
def mail_connect_start(
    provider: str,
    request: Request,
    mailbox_id: int | None = None,
    db: Session = Depends(get_db),
):
    callback = str(request.url_for("mail_connect_callback", provider=provider))
    return begin_connection(db, provider, callback, mailbox_id)


@app.get(
    "/api/mail/connect/{provider}/callback",
    name="mail_connect_callback",
    response_class=HTMLResponse,
)
def mail_connect_callback(
    provider: str,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    if error:
        return HTMLResponse(
            "<meta charset='utf-8'><h2>邮箱没有连接成功</h2><p>请关闭此页后重新连接。</p>",
            status_code=400,
        )
    out = finish_connection(db, state, code)
    safe_email = str(out.get("email") or "").replace("<", "&lt;").replace(">", "&gt;")
    return HTMLResponse(
        "<meta charset='utf-8'><title>邮箱已连接</title>"
        "<body style='font-family:system-ui;padding:40px;background:#f6f8fb'>"
        "<div style='max-width:520px;margin:auto;background:white;padding:28px;border-radius:16px'>"
        f"<h2>邮箱已连接</h2><p>{safe_email}</p>"
        "<p>现在可以回到 HUIDI 查看收件、回复和发送记录。</p></div>"
        "<script>try{window.opener&&window.opener.postMessage({type:'huidi-mail-connected'},'*')}catch(e){};setTimeout(()=>window.close(),1200)</script>"
        "</body>"
    )


@app.post("/api/mail/accounts/{mailbox_id}/sync")
def sync_mailbox_route(
    mailbox_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    mailbox = db.get(MailboxAccount, mailbox_id)
    if not mailbox:
        raise HTTPException(404, "邮箱不存在")
    return sync_mailbox(db, mailbox, limit)


@app.post("/api/mail/sync-all")
def sync_all_mailboxes(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(MailboxAccount)
        .where(MailboxAccount.enabled == 1)
        .where(MailboxAccount.provider.in_(["gmail", "outlook"]))
    ).all()
    results = []
    for mailbox in rows:
        try:
            results.append(sync_mailbox(db, mailbox, 50))
        except Exception as exc:
            mailbox.connection_state = "error"
            db.commit()
            results.append({"ok": False, "mailbox_id": mailbox.id, "error": str(exc)[:300]})
    return {"ok": True, "results": results}


@app.get("/api/mail/messages")
def list_messages(
    folder: str = Query(default="inbox", pattern="^(inbox|sent)$"),
    mailbox_id: int | None = None,
    lead_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    stmt = select(MailboxMessage).where(MailboxMessage.folder == folder)
    if mailbox_id:
        stmt = stmt.where(MailboxMessage.mailbox_id == mailbox_id)
    if lead_id:
        stmt = stmt.where(MailboxMessage.lead_id == lead_id)
    rows = db.scalars(stmt.order_by(MailboxMessage.received_at.desc()).limit(limit)).all()
    return [_message_dict(x) for x in rows]


@app.post("/api/leads/{lead_id}/queue")
def queue_message(lead_id: int, req: QueueRequest, db: Session = Depends(get_db)):
    if not req.confirm:
        raise HTTPException(400, "加入待发送前请先确认邮件内容")
    lead = db.get(Lead, lead_id)
    mailbox = db.get(MailboxAccount, req.mailbox_id)
    if not lead or not mailbox:
        raise HTTPException(404, "没有找到线索或发送邮箱")
    when = _db_time(req.send_at or datetime.now(timezone.utc))
    row = MailQueueItem(
        lead_id=lead.id,
        mailbox_id=mailbox.id,
        state="queued",
        attempts=0,
        max_attempts=req.max_attempts,
        scheduled_at=when,
        next_attempt_at=when,
    )
    db.add(row)
    add_activity(
        db,
        lead.id,
        "mail_queued",
        "邮件已加入待发送",
        lead.draft_subject,
        {"mailbox_id": mailbox.id, "send_at": when.isoformat()},
    )
    db.commit()
    db.refresh(row)
    return _queue_dict(row)


@app.get("/api/mail/queue")
def list_queue(state: str = "", db: Session = Depends(get_db)):
    stmt = select(MailQueueItem)
    if state:
        stmt = stmt.where(MailQueueItem.state == state)
    rows = db.scalars(stmt.order_by(MailQueueItem.id.desc()).limit(300)).all()
    return [_queue_dict(x) for x in rows]


def run_queue_once(limit: int = 20) -> dict[str, Any]:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        rows = db.scalars(
            select(MailQueueItem)
            .where(MailQueueItem.state.in_(["queued", "retrying"]))
            .where(MailQueueItem.next_attempt_at <= now)
            .order_by(MailQueueItem.next_attempt_at.asc())
            .limit(limit)
        ).all()
        sent = 0
        failed = 0
        for row in rows:
            row.state = "sending"
            row.attempts += 1
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            try:
                out = send_lead_email(
                    row.lead_id,
                    SmtpSendRequest(mailbox_id=row.mailbox_id, confirm=True),
                    db=db,
                )
                row.state = "sent"
                row.delivery_log_id = int((out.get("delivery") or {}).get("id") or 0) or None
                row.last_error = ""
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
                sent += 1
            except Exception as exc:
                row.last_error = str(exc)[:2000]
                if row.attempts >= row.max_attempts:
                    row.state = "failed"
                    failed += 1
                else:
                    row.state = "retrying"
                    delay = timedelta(minutes=min(60, 2 ** row.attempts))
                    row.next_attempt_at = (datetime.now(timezone.utc) + delay).replace(tzinfo=None)
                row.updated_at = datetime.now(timezone.utc)
                db.commit()
        return {"ok": True, "processed": len(rows), "sent": sent, "failed": failed}
    finally:
        db.close()


@app.post("/api/mail/queue/run")
def run_queue_route(limit: int = Query(default=20, ge=1, le=100)):
    return run_queue_once(limit)


@app.post("/api/mail/events")
def receive_mail_event(
    req: MailEventRequest,
    x_huidi_mail_event_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    expected = os.getenv("HUIDI_MAIL_EVENT_KEY", "").strip()
    if not expected or x_huidi_mail_event_key != expected:
        raise HTTPException(403, "这个回传入口还没有授权")
    reason = req.reason.strip() or req.event
    _upsert_suppression(db, req.email, req.event, "mail_event")
    lead = db.scalar(select(Lead).where(func.lower(Lead.contact_email) == _email(req.email)))
    if lead:
        add_activity(
            db,
            lead.id,
            f"mail_{req.event}",
            "邮件状态有变化",
            reason,
            {"provider_message_id": req.provider_message_id},
        )
    db.commit()
    return {"ok": True}


def _sync_all_background() -> None:
    db = SessionLocal()
    try:
        rows = db.scalars(
            select(MailboxAccount)
            .where(MailboxAccount.enabled == 1)
            .where(MailboxAccount.provider.in_(["gmail", "outlook"]))
        ).all()
        for mailbox in rows:
            try:
                sync_mailbox(db, mailbox, 50)
            except Exception:
                mailbox.connection_state = "error"
                db.commit()
    finally:
        db.close()


_runtime_stop = threading.Event()
_runtime_thread: threading.Thread | None = None
_runtime_lock = threading.Lock()


def _runtime_loop() -> None:
    cycles = 0
    while not _runtime_stop.is_set():
        try:
            run_queue_once(20)
            if cycles % 6 == 0:
                _sync_all_background()
        except Exception:
            pass
        cycles += 1
        _runtime_stop.wait(30)


def _ensure_runtime_thread() -> None:
    global _runtime_thread
    if os.getenv("HUIDI_DISABLE_BACKGROUND_JOBS", "").strip() == "1":
        return
    if os.getenv("CI", "").strip().lower() in {"1", "true", "yes"}:
        return
    with _runtime_lock:
        if _runtime_thread and _runtime_thread.is_alive():
            return
        _runtime_thread = threading.Thread(
            target=_runtime_loop,
            name="huidi-mail-worker",
            daemon=True,
        )
        _runtime_thread.start()


_ensure_runtime_thread()
