from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine
from .online_app import MailboxAccount


class MailboxOAuthToken(Base):
    __tablename__ = "mailbox_oauth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailbox_accounts.id"), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    access_ciphertext: Mapped[str] = mapped_column(Text, default="")
    refresh_ciphertext: Mapped[str] = mapped_column(Text, default="")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scopes: Mapped[str] = mapped_column(Text, default="")
    external_account_id: Mapped[str] = mapped_column(String(255), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class MailboxOAuthState(Base):
    __tablename__ = "mailbox_oauth_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    state: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    mailbox_id: Mapped[int | None] = mapped_column(ForeignKey("mailbox_accounts.id"), nullable=True)
    redirect_uri: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


def _fernet() -> Fernet:
    raw = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if not raw:
        raise HTTPException(503, "请先设置服务器安全密钥，才能安全保存邮箱连接信息")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise HTTPException(503, "邮箱连接信息无法读取，请确认服务器安全密钥没有变化") from exc


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def provider_config(provider: str, redirect_uri: str) -> dict[str, Any]:
    provider = provider.strip().lower()
    if provider == "gmail":
        client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
        client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
        if not client_id or not client_secret:
            raise HTTPException(503, "Gmail 还没有完成连接配置")
        return {
            "provider": "gmail",
            "client_id": client_id,
            "client_secret": client_secret,
            "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "redirect_uri": os.getenv("GMAIL_REDIRECT_URI", "").strip() or redirect_uri,
            "scope": "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
        }
    if provider == "outlook":
        client_id = os.getenv("OUTLOOK_CLIENT_ID", "").strip()
        client_secret = os.getenv("OUTLOOK_CLIENT_SECRET", "").strip()
        tenant = os.getenv("OUTLOOK_TENANT", "common").strip() or "common"
        if not client_id or not client_secret:
            raise HTTPException(503, "Outlook 还没有完成连接配置")
        return {
            "provider": "outlook",
            "client_id": client_id,
            "client_secret": client_secret,
            "authorize_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
            "token_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            "redirect_uri": os.getenv("OUTLOOK_REDIRECT_URI", "").strip() or redirect_uri,
            "scope": "offline_access openid profile email User.Read Mail.Read Mail.Send",
        }
    raise HTTPException(400, "目前支持连接 Gmail 或 Outlook")


def begin_connection(db: Session, provider: str, redirect_uri: str, mailbox_id: int | None = None) -> dict[str, Any]:
    cfg = provider_config(provider, redirect_uri)
    state_value = secrets.token_urlsafe(32)
    row = MailboxOAuthState(
        state=state_value,
        provider=cfg["provider"],
        mailbox_id=mailbox_id,
        redirect_uri=cfg["redirect_uri"],
    )
    db.add(row)
    db.commit()
    params = {
        "client_id": cfg["client_id"],
        "response_type": "code",
        "redirect_uri": cfg["redirect_uri"],
        "scope": cfg["scope"],
        "state": state_value,
    }
    if cfg["provider"] == "gmail":
        params.update({"access_type": "offline", "prompt": "consent", "include_granted_scopes": "true"})
    else:
        params.update({"prompt": "select_account", "response_mode": "query"})
    return {"provider": cfg["provider"], "authorize_url": cfg["authorize_url"] + "?" + urlencode(params)}


def _save_token(
    db: Session,
    mailbox: MailboxAccount,
    provider: str,
    token_data: dict[str, Any],
    profile: dict[str, Any],
) -> MailboxOAuthToken:
    row = db.scalar(select(MailboxOAuthToken).where(MailboxOAuthToken.mailbox_id == mailbox.id))
    if not row:
        row = MailboxOAuthToken(mailbox_id=mailbox.id, provider=provider)
        db.add(row)
    row.provider = provider
    row.access_ciphertext = encrypt_secret(str(token_data.get("access_token") or ""))
    refresh_token = str(token_data.get("refresh_token") or "")
    if refresh_token:
        row.refresh_ciphertext = encrypt_secret(refresh_token)
    expires_in = int(token_data.get("expires_in") or 3600)
    row.expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(60, expires_in))
    row.scopes = str(token_data.get("scope") or "")
    row.external_account_id = str(profile.get("id") or profile.get("sub") or "")
    row.updated_at = datetime.now(timezone.utc)
    mailbox.provider = provider
    mailbox.auth_mode = "oauth2"
    mailbox.connection_state = "connected"
    mailbox.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def finish_connection(db: Session, state_value: str, code: str) -> dict[str, Any]:
    state = db.scalar(select(MailboxOAuthState).where(MailboxOAuthState.state == state_value))
    if not state:
        raise HTTPException(400, "连接请求已经失效，请重新连接邮箱")
    created = _utc(state.created_at) or datetime.now(timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(minutes=15):
        db.delete(state)
        db.commit()
        raise HTTPException(400, "连接时间过长，请重新连接邮箱")

    cfg = provider_config(state.provider, state.redirect_uri)
    with httpx.Client(timeout=30) as client:
        data = {
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "code": code,
            "redirect_uri": cfg["redirect_uri"],
            "grant_type": "authorization_code",
        }
        response = client.post(cfg["token_url"], data=data)
        if response.status_code >= 400:
            raise HTTPException(502, "邮箱连接失败，请检查授权信息后重试")
        token_data = response.json()
        access = str(token_data.get("access_token") or "")
        if not access:
            raise HTTPException(502, "没有拿到邮箱访问权限，请重新连接")
        headers = {"Authorization": f"Bearer {access}"}
        if state.provider == "gmail":
            p = client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers=headers)
            profile = p.json() if p.status_code < 400 else {}
            email = str(profile.get("email") or "").strip().lower()
            display_name = str(profile.get("name") or email)
        else:
            p = client.get("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", headers=headers)
            profile = p.json() if p.status_code < 400 else {}
            email = str(profile.get("mail") or profile.get("userPrincipalName") or "").strip().lower()
            display_name = str(profile.get("displayName") or email)

    if not email:
        raise HTTPException(502, "无法确认邮箱地址，请重新授权")
    mailbox = db.get(MailboxAccount, state.mailbox_id) if state.mailbox_id else None
    if not mailbox:
        mailbox = db.scalar(select(MailboxAccount).where(MailboxAccount.email == email))
    if not mailbox:
        mailbox = MailboxAccount(
            display_name=display_name or email,
            email=email,
            provider=state.provider,
            auth_mode="oauth2",
            connection_state="connected",
            daily_limit=40,
            min_interval_seconds=120,
            timezone="UTC",
            enabled=1,
        )
        db.add(mailbox)
        db.flush()
    else:
        mailbox.display_name = mailbox.display_name or display_name or email
        mailbox.email = email
    _save_token(db, mailbox, state.provider, token_data, profile)
    db.delete(state)
    db.commit()
    return {"ok": True, "mailbox_id": mailbox.id, "email": mailbox.email, "provider": mailbox.provider}


def token_row(db: Session, mailbox_id: int) -> MailboxOAuthToken | None:
    return db.scalar(select(MailboxOAuthToken).where(MailboxOAuthToken.mailbox_id == mailbox_id))


def has_connected_token(db: Session, mailbox_id: int) -> bool:
    row = token_row(db, mailbox_id)
    return bool(row and row.access_ciphertext)


def access_token(db: Session, mailbox: MailboxAccount) -> str:
    row = token_row(db, mailbox.id)
    if not row or not row.access_ciphertext:
        raise HTTPException(400, "这个邮箱还没有完成连接")
    expiry = _utc(row.expires_at)
    if expiry and expiry > datetime.now(timezone.utc) + timedelta(seconds=90):
        return decrypt_secret(row.access_ciphertext)
    refresh = decrypt_secret(row.refresh_ciphertext)
    if not refresh:
        raise HTTPException(401, "邮箱连接已经过期，请重新连接")
    cfg = provider_config(row.provider, "")
    with httpx.Client(timeout=30) as client:
        payload = {
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        }
        if row.provider == "outlook":
            payload["scope"] = cfg["scope"]
        response = client.post(cfg["token_url"], data=payload)
        if response.status_code >= 400:
            mailbox.connection_state = "error"
            db.commit()
            raise HTTPException(401, "邮箱连接已经失效，请重新连接")
        data = response.json()
    value = str(data.get("access_token") or "")
    if not value:
        raise HTTPException(401, "邮箱连接已经失效，请重新连接")
    row.access_ciphertext = encrypt_secret(value)
    if data.get("refresh_token"):
        row.refresh_ciphertext = encrypt_secret(str(data["refresh_token"]))
    row.expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(data.get("expires_in") or 3600))
    row.updated_at = datetime.now(timezone.utc)
    mailbox.connection_state = "connected"
    mailbox.updated_at = datetime.now(timezone.utc)
    db.commit()
    return value


def send_connected_message(db: Session, mailbox: MailboxAccount, message: EmailMessage) -> str:
    token = access_token(db, mailbox)
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(timeout=30) as client:
        if mailbox.provider == "gmail":
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
            response = client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={**headers, "Content-Type": "application/json"},
                json={"raw": raw},
            )
            if response.status_code >= 400:
                raise RuntimeError(f"Gmail send failed: {response.status_code}")
            return str(response.json().get("id") or message.get("Message-ID") or "")
        if mailbox.provider == "outlook":
            recipients = [x.strip() for x in str(message.get("To") or "").split(",") if x.strip()]
            payload = {
                "message": {
                    "subject": str(message.get("Subject") or ""),
                    "body": {"contentType": "Text", "content": message.get_content()},
                    "toRecipients": [{"emailAddress": {"address": x}} for x in recipients],
                },
                "saveToSentItems": True,
            }
            if message.get("Reply-To"):
                payload["message"]["replyTo"] = [{"emailAddress": {"address": str(message.get("Reply-To"))}}]
            response = client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                headers={**headers, "Content-Type": "application/json"},
                json=payload,
            )
            if response.status_code >= 400:
                raise RuntimeError(f"Outlook send failed: {response.status_code}")
            return str(message.get("Message-ID") or "")
    raise RuntimeError("Unsupported connected mailbox provider")
