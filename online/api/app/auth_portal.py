from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from urllib.parse import quote, urlencode

import httpx
from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import WEB_DIR, engine
from .online_app import app
from .tenant_storage import ControlBase, ControlSessionLocal, ensure_tenant_schema, get_control_db
from . import team_access as team_access_module
from .team_access import (
    Organization,
    SESSION_COOKIE,
    SESSION_DAYS,
    TeamMember,
    TeamSession,
    _access_required,
    _email,
    _member_dict,
    _password_hash,
    _session_member,
    _slug,
    _token_hash,
    _verify_password,
)


EMAIL_RX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RX = re.compile(r"^\+[1-9]\d{6,14}$")
AUTH_TOKEN_MINUTES = 30
OTP_MINUTES = 10
OAUTH_STATE_MINUTES = 10
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


class AuthIdentity(ControlBase):
    __tablename__ = "auth_identities"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("team_members.id"), index=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    subject: Mapped[str] = mapped_column(String(320), index=True)
    label: Mapped[str] = mapped_column(String(255), default="")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuthToken(ControlBase):
    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("team_members.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(60), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuthOneTimeCode(ControlBase):
    __tablename__ = "auth_one_time_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    identifier: Mapped[str] = mapped_column(String(160), index=True)
    purpose: Mapped[str] = mapped_column(String(60), index=True)
    code_hash: Mapped[str] = mapped_column(String(64), index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class AuthOAuthState(ControlBase):
    __tablename__ = "auth_oauth_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(40), index=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    next_path: Mapped[str] = mapped_column(String(500), default="/")
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


ControlBase.metadata.create_all(engine)


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=4096)


class AuthRegisterRequest(BaseModel):
    account_type: str = Field(default="individual", pattern="^(individual|team)$")
    display_name: str = Field(default="", max_length=160)
    organization_name: str = Field(default="", max_length=200)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=4096)


class PasswordForgotRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)
    password: str = Field(min_length=8, max_length=4096)


class PhoneCodeRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=40)


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=40)
    code: str = Field(min_length=4, max_length=12)
    display_name: str = Field(default="", max_length=160)


class LinkProviderRequest(BaseModel):
    provider: str = Field(pattern="^(wechat|feishu)$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _production() -> bool:
    return os.getenv("APP_ENV", "development").strip().lower() == "production"


def _signup_enabled() -> bool:
    return os.getenv("HUIDI_SIGNUP_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}


def _public_base(request: Request | None = None) -> str:
    configured = os.getenv("HUIDI_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured
    if request is not None:
        return str(request.base_url).rstrip("/")
    return "http://127.0.0.1:8080"


def _safe_next(value: str) -> str:
    value = str(value or "/").strip()
    if not value.startswith("/") or value.startswith("//"):
        return "/"
    return value[:500]


def _phone(value: str) -> str:
    raw = re.sub(r"[\s()\-]", "", str(value or "").strip())
    if raw.startswith("00"):
        raw = "+" + raw[2:]
    if raw.isdigit() and len(raw) == 11 and raw.startswith("1"):
        raw = "+86" + raw
    if not PHONE_RX.fullmatch(raw):
        raise HTTPException(400, "手机号请使用国际格式，例如 +8613812345678")
    return raw


def _identity(db: Session, provider: str, subject: str) -> AuthIdentity | None:
    return db.scalar(
        select(AuthIdentity)
        .where(AuthIdentity.provider == provider)
        .where(AuthIdentity.subject == subject)
    )


def _unique_slug(db: Session, raw: str) -> str:
    base = _slug(raw or "workspace")
    slug = base
    suffix = 2
    while db.scalar(select(Organization).where(Organization.slug == slug)):
        slug = f"{base[:108]}-{suffix}"
        suffix += 1
    return slug


def _synthetic_email(provider: str, subject: str) -> str:
    digest = hashlib.sha256(f"{provider}:{subject}".encode("utf-8")).hexdigest()[:24]
    return f"{provider}-{digest}@auth.huidi.local"


def _create_workspace_member(
    db: Session,
    *,
    login_email: str,
    display_name: str,
    organization_name: str,
    password_hash: str = "",
) -> tuple[Organization, TeamMember]:
    if db.scalar(select(TeamMember).where(TeamMember.email == login_email)):
        raise HTTPException(409, "这个登录账号已经存在")
    org_name = (organization_name or "").strip() or f"{display_name or '我的'}工作台"
    organization = Organization(
        name=org_name[:200],
        slug=_unique_slug(db, org_name),
        enabled=1,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(organization)
    db.flush()
    # Public registrations intentionally never join the historical/platform
    # organization #1. Every new account receives its own tenant database.
    if int(organization.id or 0) <= 1:
        raise HTTPException(500, "新账号工作区分配失败")
    member = TeamMember(
        organization_id=organization.id,
        email=login_email,
        display_name=(display_name or login_email).strip()[:160],
        role="owner",
        password_hash=password_hash,
        enabled=1,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(member)
    db.flush()
    ensure_tenant_schema(organization.id)
    return organization, member


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=_production(),
        samesite="lax",
        path="/",
    )


def _issue_session(db: Session, member: TeamMember, response: Response) -> None:
    token = secrets.token_urlsafe(40)
    expires = _utcnow() + timedelta(days=SESSION_DAYS)
    db.add(TeamSession(member_id=member.id, token_hash=_token_hash(token), expires_at=expires))
    db.commit()
    _set_session_cookie(response, token)


def _auth_secret() -> bytes:
    value = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if len(value) < 16:
        value = "huidi-auth-development-only"
    return value.encode("utf-8")


def _otp_hash(identifier: str, purpose: str, code: str) -> str:
    payload = f"{purpose}:{identifier}:{code}".encode("utf-8")
    return hmac.new(_auth_secret(), payload, hashlib.sha256).hexdigest()


def _auth_mail_configured() -> bool:
    return bool(
        os.getenv("HUIDI_AUTH_SMTP_HOST", "").strip()
        and os.getenv("HUIDI_AUTH_EMAIL_FROM", "").strip()
    )


def _send_auth_email(to: str, subject: str, body: str) -> None:
    host = os.getenv("HUIDI_AUTH_SMTP_HOST", "").strip()
    sender = os.getenv("HUIDI_AUTH_EMAIL_FROM", "").strip()
    if not host or not sender:
        raise RuntimeError("认证邮件服务尚未配置")
    port = int(os.getenv("HUIDI_AUTH_SMTP_PORT", "587") or 587)
    username = os.getenv("HUIDI_AUTH_SMTP_USERNAME", "").strip()
    password = os.getenv("HUIDI_AUTH_SMTP_PASSWORD", "")
    security = os.getenv("HUIDI_AUTH_SMTP_SECURITY", "starttls").strip().lower()
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    context = ssl.create_default_context()
    if security == "ssl":
        with smtplib.SMTP_SSL(host, port, timeout=20, context=context) as smtp:
            if username:
                smtp.login(username, password)
            smtp.send_message(msg)
        return
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.ehlo()
        if security == "starttls":
            smtp.starttls(context=context)
            smtp.ehlo()
        if username:
            smtp.login(username, password)
        smtp.send_message(msg)


def _sms_mode() -> str:
    if os.getenv("HUIDI_SMS_WEBHOOK_URL", "").strip():
        return "webhook"
    if (
        os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        and os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        and os.getenv("TWILIO_FROM_NUMBER", "").strip()
    ):
        return "twilio"
    return ""


def _send_sms(phone: str, code: str) -> None:
    mode = _sms_mode()
    if mode == "webhook":
        url = os.getenv("HUIDI_SMS_WEBHOOK_URL", "").strip()
        token = os.getenv("HUIDI_SMS_WEBHOOK_TOKEN", "").strip()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        response = httpx.post(
            url,
            json={"phone": phone, "code": code, "purpose": "login", "product": "HUIDI Online"},
            headers=headers,
            timeout=20,
        )
        response.raise_for_status()
        return
    if mode == "twilio":
        sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        sender = os.getenv("TWILIO_FROM_NUMBER", "").strip()
        response = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            data={"To": phone, "From": sender, "Body": f"HUIDI 登录验证码：{code}，10 分钟内有效。"},
            auth=(sid, token),
            timeout=20,
        )
        response.raise_for_status()
        return
    raise RuntimeError("手机号验证码服务尚未配置")


def _provider_ready(provider: str) -> bool:
    if provider == "wechat":
        return bool(os.getenv("HUIDI_WECHAT_APP_ID", "").strip() and os.getenv("HUIDI_WECHAT_APP_SECRET", "").strip())
    if provider == "feishu":
        return bool(os.getenv("HUIDI_FEISHU_APP_ID", "").strip() and os.getenv("HUIDI_FEISHU_APP_SECRET", "").strip())
    return False


def _oauth_redirect_uri(provider: str, request: Request) -> str:
    explicit = os.getenv(f"HUIDI_{provider.upper()}_REDIRECT_URI", "").strip()
    return explicit or f"{_public_base(request)}/api/auth/oauth/{provider}/callback"


def _oauth_start_url(provider: str, state: str, request: Request) -> str:
    redirect_uri = _oauth_redirect_uri(provider, request)
    if provider == "wechat":
        app_id = os.getenv("HUIDI_WECHAT_APP_ID", "").strip()
        params = {
            "appid": app_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "snsapi_login",
            "state": state,
        }
        return "https://open.weixin.qq.com/connect/qrconnect?" + urlencode(params) + "#wechat_redirect"
    if provider == "feishu":
        app_id = os.getenv("HUIDI_FEISHU_APP_ID", "").strip()
        params = {"app_id": app_id, "redirect_uri": redirect_uri, "state": state}
        return "https://accounts.feishu.cn/open-apis/authen/v1/authorize?" + urlencode(params)
    raise HTTPException(404, "不支持的登录方式")


def _wechat_profile(code: str, request: Request) -> dict[str, str]:
    app_id = os.getenv("HUIDI_WECHAT_APP_ID", "").strip()
    secret = os.getenv("HUIDI_WECHAT_APP_SECRET", "").strip()
    token_response = httpx.get(
        "https://api.weixin.qq.com/sns/oauth2/access_token",
        params={"appid": app_id, "secret": secret, "code": code, "grant_type": "authorization_code"},
        timeout=20,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    if token_data.get("errcode"):
        raise RuntimeError(str(token_data.get("errmsg") or token_data.get("errcode")))
    access_token = str(token_data.get("access_token") or "")
    openid = str(token_data.get("openid") or "")
    if not access_token or not openid:
        raise RuntimeError("微信没有返回有效登录身份")
    user_data: dict[str, Any] = {}
    try:
        user_response = httpx.get(
            "https://api.weixin.qq.com/sns/userinfo",
            params={"access_token": access_token, "openid": openid, "lang": "zh_CN"},
            timeout=20,
        )
        if user_response.is_success:
            user_data = user_response.json()
    except Exception:
        user_data = {}
    unionid = str(user_data.get("unionid") or token_data.get("unionid") or "")
    subject = unionid or f"{app_id}:{openid}"
    return {
        "subject": subject,
        "display_name": str(user_data.get("nickname") or "微信用户")[:160],
        "label": "微信",
        "metadata": json.dumps({"openid": openid, "unionid": unionid}, ensure_ascii=False),
    }


def _feishu_profile(code: str, request: Request) -> dict[str, str]:
    app_id = os.getenv("HUIDI_FEISHU_APP_ID", "").strip()
    secret = os.getenv("HUIDI_FEISHU_APP_SECRET", "").strip()
    redirect_uri = _oauth_redirect_uri("feishu", request)
    token_response = httpx.post(
        "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": app_id,
            "client_secret": secret,
            "code": code,
            "redirect_uri": redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = str(token_data.get("access_token") or "")
    if not access_token:
        raise RuntimeError(str(token_data.get("error_description") or token_data.get("msg") or "飞书没有返回访问令牌"))
    user_response = httpx.get(
        "https://open.feishu.cn/open-apis/authen/v1/user_info",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    user_response.raise_for_status()
    user_data = user_response.json()
    if isinstance(user_data.get("data"), dict):
        user_data = user_data["data"]
    subject = str(user_data.get("union_id") or user_data.get("open_id") or user_data.get("user_id") or "")
    if not subject:
        raise RuntimeError("飞书没有返回有效登录身份")
    return {
        "subject": subject,
        "display_name": str(user_data.get("name") or user_data.get("en_name") or "飞书用户")[:160],
        "label": "飞书",
        "metadata": json.dumps(
            {
                "open_id": user_data.get("open_id"),
                "union_id": user_data.get("union_id"),
                "tenant_key": user_data.get("tenant_key"),
            },
            ensure_ascii=False,
        ),
    }


def _oauth_member(db: Session, provider: str, profile: dict[str, str]) -> TeamMember:
    found = _identity(db, provider, profile["subject"])
    if found:
        member = db.get(TeamMember, found.member_id)
        if not member or not member.enabled:
            raise HTTPException(403, "这个账号当前已停用")
        organization = db.get(Organization, member.organization_id)
        if not organization or not organization.enabled:
            raise HTTPException(403, "这个工作区当前已停用")
        found.updated_at = _utcnow()
        db.commit()
        return member

    # Never auto-merge an OAuth account into an existing team merely because the
    # provider returns the same email. Explicit linking must happen while logged in.
    login_email = _synthetic_email(provider, profile["subject"])
    _, member = _create_workspace_member(
        db,
        login_email=login_email,
        display_name=profile.get("display_name") or profile.get("label") or "HUIDI 用户",
        organization_name=f"{profile.get('display_name') or profile.get('label') or '我的'}工作台",
    )
    db.add(
        AuthIdentity(
            member_id=member.id,
            provider=provider,
            subject=profile["subject"],
            label=profile.get("label") or provider,
            verified_at=_utcnow(),
            metadata_json=profile.get("metadata") or "{}",
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
    )
    db.commit()
    db.refresh(member)
    return member


# team_access.py existed before the public auth portal. Extend its public-path
# policy at runtime so the existing authentication middleware remains the single
# business API gate instead of introducing a second competing tenant owner.
_legacy_public_path = team_access_module._is_public_path


def _auth_public_path(path: str) -> bool:
    if path == "/":
        return False
    if path in {"/login", "/register", "/forgot-password", "/reset-password"}:
        return True
    if path.startswith("/api/auth/"):
        return True
    if path.startswith("/docs") or path.startswith("/openapi"):
        return False
    return _legacy_public_path(path)


team_access_module._is_public_path = _auth_public_path


@app.middleware("http")
async def auth_entry_redirect(request: Request, call_next):
    if not _access_required():
        return await call_next(request)
    path = request.url.path
    if path == "/api/team/status":
        db = ControlSessionLocal()
        try:
            member = _session_member(db, request.cookies.get(SESSION_COOKIE, ""))
        finally:
            db.close()
        if not member:
            return JSONResponse(
                {
                    "enabled": True,
                    "ready": True,
                    "isolation": "physical_database_per_organization",
                    "roles": {"owner": "老板", "admin": "管理员", "sales": "业务员", "viewer": "只读成员"},
                }
            )
    if path == "/":
        db = ControlSessionLocal()
        try:
            member = _session_member(db, request.cookies.get(SESSION_COOKIE, ""))
        finally:
            db.close()
        if not member:
            return RedirectResponse("/login", status_code=303)
    return await call_next(request)


@app.get("/login")
@app.get("/register")
@app.get("/forgot-password")
@app.get("/reset-password")
def auth_page():
    page = WEB_DIR / "auth.html"
    if page.exists():
        return FileResponse(page)
    raise HTTPException(500, "登录页面缺失")


@app.get("/api/auth/status")
def auth_status():
    return {
        "enabled": _access_required(),
        "signup_enabled": _signup_enabled(),
        "isolation": "physical_database_per_organization",
        "providers": {
            "email": True,
            "phone": bool(_sms_mode()),
            "wechat": _provider_ready("wechat"),
            "feishu": _provider_ready("feishu"),
        },
        "password_reset_email": _auth_mail_configured(),
    }


@app.post("/api/auth/login")
def auth_login(req: AuthLoginRequest, response: Response, db: Session = Depends(get_control_db)):
    member = db.scalar(select(TeamMember).where(TeamMember.email == _email(req.email)))
    if not member or not member.enabled or not _verify_password(req.password, member.password_hash):
        raise HTTPException(401, "邮箱或密码不正确")
    organization = db.get(Organization, member.organization_id)
    if not organization or not organization.enabled:
        raise HTTPException(403, "这个工作区当前已停用")
    _issue_session(db, member, response)
    return {"ok": True, "member": _member_dict(member, db)}


@app.post("/api/auth/register")
def auth_register(req: AuthRegisterRequest, response: Response, db: Session = Depends(get_control_db)):
    if not _signup_enabled():
        raise HTTPException(403, "当前暂未开放自助注册")
    email = _email(req.email)
    if not EMAIL_RX.fullmatch(email):
        raise HTTPException(400, "邮箱格式不正确")
    if db.scalar(select(TeamMember).where(TeamMember.email == email)):
        raise HTTPException(409, "这个邮箱已经注册，可以直接登录或重置密码")
    display_name = req.display_name.strip() or email.split("@", 1)[0]
    org_name = req.organization_name.strip()
    if req.account_type == "individual" and not org_name:
        org_name = f"{display_name}的工作台"
    if req.account_type == "team" and not org_name:
        raise HTTPException(400, "团队账号请填写公司 / 团队名称")
    organization, member = _create_workspace_member(
        db,
        login_email=email,
        display_name=display_name,
        organization_name=org_name,
        password_hash=_password_hash(req.password),
    )
    db.add(
        AuthIdentity(
            member_id=member.id,
            provider="email",
            subject=email,
            label=email,
            verified_at=_utcnow(),
            metadata_json="{}",
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
    )
    db.commit()
    db.refresh(member)
    db.refresh(organization)
    _issue_session(db, member, response)
    return {
        "ok": True,
        "member": _member_dict(member, db),
        "organization": {"id": organization.id, "name": organization.name, "slug": organization.slug},
        "isolation": "physical_database_per_organization",
    }


@app.post("/api/auth/password/forgot")
def password_forgot(req: PasswordForgotRequest, request: Request, db: Session = Depends(get_control_db)):
    email = _email(req.email)
    member = db.scalar(select(TeamMember).where(TeamMember.email == email)) if EMAIL_RX.fullmatch(email) else None
    if member and not member.email.endswith("@auth.huidi.local"):
        raw = secrets.token_urlsafe(48)
        db.add(
            AuthToken(
                member_id=member.id,
                purpose="password_reset",
                token_hash=_token_hash(raw),
                expires_at=_utcnow() + timedelta(minutes=AUTH_TOKEN_MINUTES),
                created_at=_utcnow(),
            )
        )
        db.commit()
        if _auth_mail_configured():
            reset_url = f"{_public_base(request)}/reset-password?token={quote(raw)}"
            try:
                _send_auth_email(
                    email,
                    "重置 HUIDI Online 密码",
                    f"你正在重置 HUIDI Online 密码。\n\n请在 {AUTH_TOKEN_MINUTES} 分钟内打开：\n{reset_url}\n\n如果不是你本人操作，请忽略本邮件。",
                )
            except Exception:
                # Do not reveal whether a particular email exists or whether its
                # delivery failed. Operators can validate SMTP independently.
                pass
    return {
        "ok": True,
        "message": "如果该账号存在，重置说明会发送到对应邮箱。",
        "email_service_ready": _auth_mail_configured(),
    }


@app.post("/api/auth/password/reset")
def password_reset(req: PasswordResetRequest, db: Session = Depends(get_control_db)):
    now = _utcnow()
    row = db.scalar(
        select(AuthToken)
        .where(AuthToken.purpose == "password_reset")
        .where(AuthToken.token_hash == _token_hash(req.token))
        .where(AuthToken.consumed_at.is_(None))
        .where(AuthToken.expires_at > now)
        .order_by(AuthToken.id.desc())
    )
    if not row:
        raise HTTPException(400, "重置链接无效或已经过期")
    member = db.get(TeamMember, row.member_id)
    if not member or not member.enabled:
        raise HTTPException(400, "这个账号当前不可用")
    member.password_hash = _password_hash(req.password)
    member.updated_at = now
    row.consumed_at = now
    sessions = db.scalars(select(TeamSession).where(TeamSession.member_id == member.id)).all()
    for session in sessions:
        db.delete(session)
    db.commit()
    return {"ok": True, "message": "密码已重置，请重新登录。"}


@app.post("/api/auth/phone/code")
def phone_code(req: PhoneCodeRequest, db: Session = Depends(get_control_db)):
    if not _sms_mode():
        raise HTTPException(503, "手机号验证码服务尚未配置")
    phone = _phone(req.phone)
    now = _utcnow()
    recent = db.scalar(
        select(AuthOneTimeCode)
        .where(AuthOneTimeCode.identifier == phone)
        .where(AuthOneTimeCode.purpose == "phone_login")
        .order_by(AuthOneTimeCode.id.desc())
    )
    if recent and recent.created_at and (now - recent.created_at).total_seconds() < OTP_RESEND_SECONDS:
        raise HTTPException(429, "验证码发送太频繁，请稍后再试")
    code = f"{secrets.randbelow(1_000_000):06d}"
    row = AuthOneTimeCode(
        identifier=phone,
        purpose="phone_login",
        code_hash=_otp_hash(phone, "phone_login", code),
        attempts=0,
        expires_at=now + timedelta(minutes=OTP_MINUTES),
        created_at=now,
    )
    db.add(row)
    db.commit()
    try:
        _send_sms(phone, code)
    except Exception as exc:
        row.consumed_at = _utcnow()
        db.commit()
        raise HTTPException(502, f"验证码暂时无法发送：{str(exc)[:160]}") from exc
    return {"ok": True, "expires_in": OTP_MINUTES * 60, "resend_after": OTP_RESEND_SECONDS}


@app.post("/api/auth/phone/verify")
def phone_verify(req: PhoneVerifyRequest, response: Response, db: Session = Depends(get_control_db)):
    phone = _phone(req.phone)
    now = _utcnow()
    row = db.scalar(
        select(AuthOneTimeCode)
        .where(AuthOneTimeCode.identifier == phone)
        .where(AuthOneTimeCode.purpose == "phone_login")
        .where(AuthOneTimeCode.consumed_at.is_(None))
        .order_by(AuthOneTimeCode.id.desc())
    )
    if not row or row.expires_at <= now:
        raise HTTPException(400, "验证码无效或已经过期")
    if row.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(429, "验证码尝试次数过多，请重新获取")
    if not hmac.compare_digest(row.code_hash, _otp_hash(phone, "phone_login", req.code.strip())):
        row.attempts += 1
        db.commit()
        raise HTTPException(400, "验证码不正确")
    row.consumed_at = now
    found = _identity(db, "phone", phone)
    if found:
        member = db.get(TeamMember, found.member_id)
        if not member or not member.enabled:
            raise HTTPException(403, "这个账号当前已停用")
    else:
        display_name = req.display_name.strip() or f"手机用户 {phone[-4:]}"
        _, member = _create_workspace_member(
            db,
            login_email=_synthetic_email("phone", phone),
            display_name=display_name,
            organization_name=f"{display_name}的工作台",
        )
        db.add(
            AuthIdentity(
                member_id=member.id,
                provider="phone",
                subject=phone,
                label=phone,
                verified_at=now,
                metadata_json="{}",
                created_at=now,
                updated_at=now,
            )
        )
    db.commit()
    db.refresh(member)
    _issue_session(db, member, response)
    return {"ok": True, "member": _member_dict(member, db)}


@app.get("/api/auth/oauth/{provider}/start")
def oauth_start(provider: str, request: Request, next: str = "/", db: Session = Depends(get_control_db)):
    provider = provider.strip().lower()
    if provider not in {"wechat", "feishu"}:
        raise HTTPException(404, "不支持的登录方式")
    if not _provider_ready(provider):
        raise HTTPException(503, f"{provider} 登录尚未配置")
    raw_state = secrets.token_urlsafe(36)
    db.add(
        AuthOAuthState(
            provider=provider,
            state_hash=_token_hash(raw_state),
            next_path=_safe_next(next),
            expires_at=_utcnow() + timedelta(minutes=OAUTH_STATE_MINUTES),
            created_at=_utcnow(),
        )
    )
    db.commit()
    return {"ok": True, "provider": provider, "authorize_url": _oauth_start_url(provider, raw_state, request)}


@app.get("/api/auth/oauth/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: str = "",
    state: str = "",
    db: Session = Depends(get_control_db),
):
    provider = provider.strip().lower()
    if provider not in {"wechat", "feishu"}:
        return RedirectResponse("/login?error=oauth_provider", status_code=303)
    now = _utcnow()
    row = db.scalar(
        select(AuthOAuthState)
        .where(AuthOAuthState.provider == provider)
        .where(AuthOAuthState.state_hash == _token_hash(state))
        .where(AuthOAuthState.consumed_at.is_(None))
        .where(AuthOAuthState.expires_at > now)
        .order_by(AuthOAuthState.id.desc())
    )
    if not row or not code:
        return RedirectResponse("/login?error=" + quote("登录授权已失效，请重新扫码"), status_code=303)
    row.consumed_at = now
    db.commit()
    try:
        profile = _wechat_profile(code, request) if provider == "wechat" else _feishu_profile(code, request)
        member = _oauth_member(db, provider, profile)
        response = RedirectResponse(_safe_next(row.next_path), status_code=303)
        _issue_session(db, member, response)
        return response
    except Exception as exc:
        return RedirectResponse("/login?error=" + quote(str(exc)[:180]), status_code=303)
