from __future__ import annotations

import hmac
import os

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from .mail_sync import MailEventRequest, receive_mail_event
from .main import SessionLocal
from .online_app import app
from .team_access import Organization
from .tenant_storage import (
    ControlSessionLocal,
    reset_current_organization,
    set_current_organization,
)


def _team_mode() -> bool:
    return os.getenv("HUIDI_TEAM_ACCESS", "").strip().lower() in {"1", "true", "yes", "on"}


def _authorized_organization(request: Request) -> tuple[int | None, str]:
    expected = os.getenv("HUIDI_MAIL_EVENT_KEY", "").strip()
    provided = request.headers.get("x-huidi-mail-event-key", "").strip()
    if not expected or not provided or not hmac.compare_digest(provided, expected):
        return None, "回传密钥不正确"
    raw = request.headers.get("x-huidi-organization-id", "").strip()
    try:
        organization_id = int(raw)
    except Exception:
        return None, "缺少正确的公司编号"
    if organization_id < 1:
        return None, "缺少正确的公司编号"
    control = ControlSessionLocal()
    try:
        organization = control.get(Organization, organization_id)
        if not organization or not organization.enabled:
            return None, "这家公司不存在或已停用"
    finally:
        control.close()
    return organization_id, ""


@app.middleware("http")
async def tenant_mail_event_router(request: Request, call_next):
    """Allow provider callbacks without a user cookie while preserving isolation.

    In team mode a bounce/unsubscribe provider must send both the normal
    X-HUIDI-Mail-Event-Key and X-HUIDI-Organization-ID. The middleware routes the
    event directly into that company's physically separate business database;
    the regular login middleware never sees this provider-only request.
    """
    if not _team_mode() or request.method != "POST" or request.url.path != "/api/mail/events":
        return await call_next(request)

    organization_id, error = _authorized_organization(request)
    if not organization_id:
        return JSONResponse({"detail": error}, status_code=403)

    try:
        payload = await request.json()
        event = MailEventRequest.model_validate(payload)
    except Exception:
        return JSONResponse({"detail": "邮件回传内容格式不正确"}, status_code=422)

    token = set_current_organization(organization_id)
    db = SessionLocal()
    try:
        try:
            result = receive_mail_event(
                event,
                x_huidi_mail_event_key=request.headers.get("x-huidi-mail-event-key", ""),
                db=db,
            )
            return JSONResponse(result)
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    finally:
        db.close()
        reset_current_organization(token)
