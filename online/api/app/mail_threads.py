from __future__ import annotations

import base64
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import quote
from uuid import uuid4

import httpx
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .mail_provider import access_token
from .mail_sync import MailboxMessage
from .main import Lead, add_activity, get_db
from .online_app import MailboxAccount, _email, app


class ThreadReplyRequest(BaseModel):
    body: str = Field(min_length=1, max_length=50000)


def _message_payload(row: MailboxMessage, db: Session) -> dict:
    lead = db.get(Lead, row.lead_id) if row.lead_id else None
    return {
        "id": row.id,
        "mailbox_id": row.mailbox_id,
        "provider_message_id": row.provider_message_id,
        "thread_id": row.thread_id,
        "direction": row.direction,
        "sender": row.sender,
        "subject": row.subject,
        "snippet": row.snippet,
        "received_at": row.received_at.isoformat() if row.received_at else None,
        "lead_id": row.lead_id,
        "company_name": lead.company_name if lead else "",
    }


def _thread_key(row: MailboxMessage) -> str:
    return row.thread_id.strip() or row.internet_message_id.strip() or f"mail-{row.id}"


@app.get("/api/mail/threads")
def list_threads(
    mailbox_id: int | None = None,
    lead_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    stmt = select(MailboxMessage)
    if mailbox_id:
        stmt = stmt.where(MailboxMessage.mailbox_id == mailbox_id)
    if lead_id:
        stmt = stmt.where(MailboxMessage.lead_id == lead_id)
    rows = db.scalars(stmt.order_by(MailboxMessage.received_at.desc()).limit(600)).all()
    grouped: dict[str, list[MailboxMessage]] = {}
    for row in rows:
        grouped.setdefault(_thread_key(row), []).append(row)

    result = []
    for key, messages in grouped.items():
        messages.sort(key=lambda x: x.received_at or datetime.min, reverse=True)
        latest = messages[0]
        lead = db.get(Lead, latest.lead_id) if latest.lead_id else None
        result.append(
            {
                "thread_id": key,
                "mailbox_id": latest.mailbox_id,
                "lead_id": latest.lead_id,
                "company_name": lead.company_name if lead else "",
                "subject": latest.subject,
                "latest_sender": latest.sender,
                "latest_snippet": latest.snippet,
                "latest_at": latest.received_at.isoformat() if latest.received_at else None,
                "messages": len(messages),
                "has_reply": any(x.direction == "incoming" for x in messages),
            }
        )
    result.sort(key=lambda x: x.get("latest_at") or "", reverse=True)
    return result[:limit]


@app.get("/api/mail/thread")
def get_thread(thread_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(MailboxMessage).order_by(MailboxMessage.received_at.asc())).all()
    matches = [row for row in rows if _thread_key(row) == thread_id]
    if not matches:
        raise HTTPException(404, "没有找到这组邮件往来")
    return {
        "thread_id": thread_id,
        "messages": [_message_payload(x, db) for x in matches],
    }


def _gmail_reply(db: Session, mailbox: MailboxAccount, source: MailboxMessage, body: str) -> tuple[str, str]:
    token = access_token(db, mailbox)
    subject = source.subject.strip() or "回复"
    if not subject.lower().startswith("re:"):
        subject = "Re: " + subject
    msg = EmailMessage()
    msg["From"] = mailbox.email
    msg["To"] = source.sender
    msg["Subject"] = subject
    if source.internet_message_id:
        msg["In-Reply-To"] = source.internet_message_id
        msg["References"] = source.internet_message_id
    msg.set_content(body)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii").rstrip("=")
    payload = {"raw": raw}
    if source.thread_id:
        payload["threadId"] = source.thread_id
    with httpx.Client(timeout=30) as client:
        response = client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(502, "邮件回复没有发送成功，请检查邮箱连接后重试")
    data = response.json()
    return str(data.get("id") or uuid4().hex), str(data.get("threadId") or source.thread_id)


def _outlook_reply(db: Session, mailbox: MailboxAccount, source: MailboxMessage, body: str) -> tuple[str, str]:
    token = access_token(db, mailbox)
    message_id = quote(source.provider_message_id, safe="")
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"https://graph.microsoft.com/v1.0/me/messages/{message_id}/reply",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"comment": body},
        )
    if response.status_code >= 400:
        raise HTTPException(502, "邮件回复没有发送成功，请检查邮箱连接后重试")
    return f"outlook-reply-{uuid4().hex}", source.thread_id


@app.post("/api/mail/messages/{message_id}/reply")
def reply_to_message(message_id: int, req: ThreadReplyRequest, db: Session = Depends(get_db)):
    source = db.get(MailboxMessage, message_id)
    if not source:
        raise HTTPException(404, "没有找到这封邮件")
    if source.direction != "incoming":
        raise HTTPException(400, "请选择客户发来的邮件进行回复")
    mailbox = db.get(MailboxAccount, source.mailbox_id)
    if not mailbox or mailbox.connection_state != "connected":
        raise HTTPException(400, "发送邮箱需要重新连接")
    if mailbox.provider not in {"gmail", "outlook"} or mailbox.auth_mode != "oauth2":
        raise HTTPException(400, "当前邮箱暂不支持在这里直接回复")

    body = req.body.strip()
    if mailbox.provider == "gmail":
        provider_id, thread_id = _gmail_reply(db, mailbox, source, body)
    else:
        provider_id, thread_id = _outlook_reply(db, mailbox, source, body)

    subject = source.subject.strip() or "回复"
    if not subject.lower().startswith("re:"):
        subject = "Re: " + subject
    sent = MailboxMessage(
        mailbox_id=mailbox.id,
        provider_message_id=provider_id,
        thread_id=thread_id,
        internet_message_id="",
        direction="outgoing",
        folder="sent",
        sender=_email(mailbox.email),
        recipients_json=f'["{_email(source.sender)}"]',
        subject=subject,
        snippet=body[:8000],
        received_at=datetime.now(timezone.utc).replace(tzinfo=None),
        lead_id=source.lead_id,
        has_unsubscribe=0,
    )
    db.add(sent)
    if source.lead_id:
        add_activity(
            db,
            source.lead_id,
            "mail_reply_sent",
            "已回复客户邮件",
            subject,
            {"mailbox_id": mailbox.id, "thread_id": thread_id, "message_id": provider_id},
        )
    db.commit()
    db.refresh(sent)
    return {"ok": True, "message": _message_payload(sent, db), "thread_id": thread_id}
