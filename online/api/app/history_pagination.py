from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import String, case, cast, func, literal, or_, select

from .mail_sequences import MailSequenceEnrollment, _enrollment_dict
from .mail_sync import MailQueueItem, MailboxMessage, _message_dict, _queue_dict
from .main import Lead, SessionLocal
from .online_app import app


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    try:
        out = int(value or default)
    except Exception:
        out = default
    return max(minimum, min(maximum, out))


def _message_page(request: Request) -> JSONResponse:
    q = request.query_params
    page = _int(q.get("page"), 1, 1, 1_000_000)
    page_size = _int(q.get("page_size"), 50, 20, 200)
    folder = "sent" if q.get("folder") == "sent" else "inbox"
    mailbox_id = _int(q.get("mailbox_id"), 0, 0, 2_000_000_000) if q.get("mailbox_id") else 0
    lead_id = _int(q.get("lead_id"), 0, 0, 2_000_000_000) if q.get("lead_id") else 0
    term = str(q.get("q") or "").strip()
    db = SessionLocal()
    try:
        stmt = select(MailboxMessage).where(MailboxMessage.folder == folder)
        if mailbox_id:
            stmt = stmt.where(MailboxMessage.mailbox_id == mailbox_id)
        if lead_id:
            stmt = stmt.where(MailboxMessage.lead_id == lead_id)
        if term:
            like = f"%{term}%"
            stmt = stmt.where(or_(MailboxMessage.subject.ilike(like), MailboxMessage.sender.ilike(like), MailboxMessage.snippet.ilike(like)))
        total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        rows = db.scalars(stmt.order_by(MailboxMessage.received_at.desc(), MailboxMessage.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
        return JSONResponse({"items": [_message_dict(x) for x in rows], "total": total, "page": page, "page_size": page_size, "pages": pages})
    finally:
        db.close()


def _queue_page(request: Request) -> JSONResponse:
    q = request.query_params
    page = _int(q.get("page"), 1, 1, 1_000_000)
    page_size = _int(q.get("page_size"), 50, 20, 200)
    state = str(q.get("state") or "").strip()
    db = SessionLocal()
    try:
        stmt = select(MailQueueItem)
        if state:
            stmt = stmt.where(MailQueueItem.state == state)
        total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        rows = db.scalars(stmt.order_by(MailQueueItem.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
        return JSONResponse({"items": [_queue_dict(x) for x in rows], "total": total, "page": page, "page_size": page_size, "pages": pages})
    finally:
        db.close()


def _sequence_page(request: Request) -> JSONResponse:
    q = request.query_params
    page = _int(q.get("page"), 1, 1, 1_000_000)
    page_size = _int(q.get("page_size"), 50, 20, 200)
    state = str(q.get("state") or "").strip()
    db = SessionLocal()
    try:
        stmt = select(MailSequenceEnrollment)
        if state:
            stmt = stmt.where(MailSequenceEnrollment.state == state)
        total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        rows = db.scalars(stmt.order_by(MailSequenceEnrollment.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
        return JSONResponse({"items": [_enrollment_dict(x, db) for x in rows], "total": total, "page": page, "page_size": page_size, "pages": pages})
    finally:
        db.close()


def _thread_key_expr():
    return case(
        (func.length(func.trim(MailboxMessage.thread_id)) > 0, MailboxMessage.thread_id),
        (func.length(func.trim(MailboxMessage.internet_message_id)) > 0, MailboxMessage.internet_message_id),
        else_=literal("mail-") + cast(MailboxMessage.id, String),
    )


def _threads_page(request: Request) -> JSONResponse:
    q = request.query_params
    page = _int(q.get("page"), 1, 1, 1_000_000)
    page_size = _int(q.get("page_size"), 50, 20, 100)
    mailbox_id = _int(q.get("mailbox_id"), 0, 0, 2_000_000_000) if q.get("mailbox_id") else 0
    lead_id = _int(q.get("lead_id"), 0, 0, 2_000_000_000) if q.get("lead_id") else 0
    key = _thread_key_expr()
    base = select(
        MailboxMessage.id.label("id"), MailboxMessage.mailbox_id.label("mailbox_id"), MailboxMessage.lead_id.label("lead_id"),
        MailboxMessage.sender.label("sender"), MailboxMessage.subject.label("subject"), MailboxMessage.snippet.label("snippet"),
        MailboxMessage.received_at.label("received_at"), key.label("thread_id"),
        func.row_number().over(partition_by=key, order_by=(MailboxMessage.received_at.desc(), MailboxMessage.id.desc())).label("rn"),
        func.count(MailboxMessage.id).over(partition_by=key).label("message_count"),
        func.max(case((MailboxMessage.direction == "incoming", 1), else_=0)).over(partition_by=key).label("has_reply"),
    )
    if mailbox_id:
        base = base.where(MailboxMessage.mailbox_id == mailbox_id)
    if lead_id:
        base = base.where(MailboxMessage.lead_id == lead_id)
    ranked = base.subquery()
    db = SessionLocal()
    try:
        total = int(db.scalar(select(func.count()).select_from(ranked).where(ranked.c.rn == 1)) or 0)
        pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, pages)
        rows = db.execute(select(ranked).where(ranked.c.rn == 1).order_by(ranked.c.received_at.desc()).offset((page - 1) * page_size).limit(page_size)).mappings().all()
        lead_ids = {int(x["lead_id"]) for x in rows if x["lead_id"]}
        names = {x.id: x.company_name for x in db.scalars(select(Lead).where(Lead.id.in_(lead_ids))).all()} if lead_ids else {}
        items: list[dict[str, Any]] = []
        for row in rows:
            items.append({
                "thread_id": str(row["thread_id"]), "mailbox_id": row["mailbox_id"], "lead_id": row["lead_id"],
                "company_name": names.get(row["lead_id"], ""), "subject": row["subject"], "latest_sender": row["sender"],
                "latest_snippet": row["snippet"], "latest_at": row["received_at"].isoformat() if row["received_at"] else None,
                "messages": int(row["message_count"] or 0), "has_reply": bool(row["has_reply"]),
            })
        return JSONResponse({"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages})
    finally:
        db.close()


@app.middleware("http")
async def paged_business_history(request: Request, call_next):
    if request.method.upper() != "GET" or not _truthy(request.query_params.get("paged")):
        return await call_next(request)
    path = request.url.path
    if path == "/api/mail/messages":
        return _message_page(request)
    if path == "/api/mail/queue":
        return _queue_page(request)
    if path == "/api/mail/threads":
        return _threads_page(request)
    if path == "/api/mail/sequence-enrollments":
        return _sequence_page(request)
    return await call_next(request)
