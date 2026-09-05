from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app


ROLES = {"owner", "admin", "sales", "viewer"}
SESSION_COOKIE = "huidi_team_session"
SESSION_DAYS = 14
PBKDF2_ROUNDS = 390_000


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160), default="")
    role: Mapped[str] = mapped_column(String(40), default="sales", index=True)
    password_hash: Mapped[str] = mapped_column(String(512), default="")
    enabled: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class TeamSession(Base):
    __tablename__ = "team_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("team_members.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=4096)


class MemberRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    display_name: str = Field(default="", max_length=160)
    role: str = Field(default="sales", max_length=40)
    password: str = Field(min_length=8, max_length=4096)


class MemberPatchRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=160)
    role: str | None = Field(default=None, max_length=40)
    password: str | None = Field(default=None, min_length=8, max_length=4096)
    enabled: bool | None = None


def _access_required() -> bool:
    return os.getenv("HUIDI_TEAM_ACCESS", "").strip().lower() in {"1", "true", "yes", "on"}


def _email(value: str) -> str:
    return str(value or "").strip().lower()


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds)
        ).hex()
        return hmac.compare_digest(digest, digest_hex)
    except Exception:
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _member_dict(row: TeamMember) -> dict[str, Any]:
    return {
        "id": row.id,
        "email": row.email,
        "display_name": row.display_name,
        "role": row.role,
        "enabled": bool(row.enabled),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _bootstrap_owner(db: Session) -> None:
    if int(db.scalar(select(func.count(TeamMember.id))) or 0) > 0:
        return
    email = _email(os.getenv("HUIDI_OWNER_EMAIL", ""))
    password = os.getenv("HUIDI_OWNER_PASSWORD", "")
    if not email or len(password) < 8:
        return
    row = TeamMember(
        email=email,
        display_name=os.getenv("HUIDI_OWNER_NAME", "Owner").strip() or "Owner",
        role="owner",
        password_hash=_password_hash(password),
        enabled=1,
    )
    db.add(row)
    db.commit()


def _session_member(db: Session, token: str) -> TeamMember | None:
    if not token:
        return None
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session = db.scalar(
        select(TeamSession)
        .where(TeamSession.token_hash == _token_hash(token))
        .where(TeamSession.expires_at > now)
        .order_by(TeamSession.id.desc())
    )
    if not session:
        return None
    member = db.get(TeamMember, session.member_id)
    return member if member and member.enabled else None


def _is_public_path(path: str) -> bool:
    if path in {"/", "/api/health", "/api/team/status", "/api/team/login"}:
        return True
    return path.startswith("/assets/") or path.startswith("/docs") or path.startswith("/openapi")


def _admin_only_path(path: str) -> bool:
    if path.startswith("/api/team/members"):
        return True
    if path.startswith("/api/mail/accounts") and any(
        x in path for x in ["/smtp", "/test"]
    ):
        return True
    return False


def _permission_error(member: TeamMember, request: Request) -> str | None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return None
    if member.role == "viewer":
        return "你的账号是只读权限，不能修改资料或发送邮件"
    if _admin_only_path(request.url.path) and member.role not in {"owner", "admin"}:
        return "这项设置只允许老板或管理员修改"
    return None


@app.middleware("http")
async def team_access_middleware(request: Request, call_next):
    if not _access_required() or _is_public_path(request.url.path):
        return await call_next(request)

    from .main import SessionLocal

    db = SessionLocal()
    try:
        _bootstrap_owner(db)
        member = _session_member(db, request.cookies.get(SESSION_COOKIE, ""))
        if not member:
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "请先登录 HUIDI"}, status_code=401)
        error = _permission_error(member, request)
        if error:
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": error}, status_code=403)
        request.state.team_member = _member_dict(member)
    finally:
        db.close()
    return await call_next(request)


@app.get("/api/team/status")
def team_status(db: Session = Depends(get_db)):
    _bootstrap_owner(db)
    count = int(db.scalar(select(func.count(TeamMember.id))) or 0)
    return {
        "enabled": _access_required(),
        "ready": count > 0,
        "members": count,
        "needs_owner_setup": _access_required() and count == 0,
        "roles": {
            "owner": "老板",
            "admin": "管理员",
            "sales": "业务员",
            "viewer": "只读成员",
        },
    }


@app.post("/api/team/login")
def team_login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    if not _access_required():
        raise HTTPException(400, "当前没有开启团队登录")
    _bootstrap_owner(db)
    member = db.scalar(select(TeamMember).where(TeamMember.email == _email(req.email)))
    if not member or not member.enabled or not _verify_password(req.password, member.password_hash):
        raise HTTPException(401, "邮箱或密码不正确")
    token = secrets.token_urlsafe(40)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    db.add(
        TeamSession(
            member_id=member.id,
            token_hash=_token_hash(token),
            expires_at=expires.replace(tzinfo=None),
        )
    )
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=os.getenv("APP_ENV", "development").strip().lower() == "production",
        samesite="strict",
        path="/",
    )
    return {"ok": True, "member": _member_dict(member)}


@app.post("/api/team/logout")
def team_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE, "")
    if token:
        rows = db.scalars(select(TeamSession).where(TeamSession.token_hash == _token_hash(token))).all()
        for row in rows:
            db.delete(row)
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/team/me")
def team_me(request: Request, db: Session = Depends(get_db)):
    if not _access_required():
        return {"enabled": False, "member": None}
    member = _session_member(db, request.cookies.get(SESSION_COOKIE, ""))
    if not member:
        raise HTTPException(401, "请先登录 HUIDI")
    return {"enabled": True, "member": _member_dict(member)}


def _require_admin(request: Request, db: Session) -> TeamMember:
    member = _session_member(db, request.cookies.get(SESSION_COOKIE, ""))
    if not member or member.role not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以管理成员")
    return member


@app.get("/api/team/members")
def list_members(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    rows = db.scalars(select(TeamMember).order_by(TeamMember.id.asc())).all()
    return [_member_dict(x) for x in rows]


@app.post("/api/team/members")
def create_member(req: MemberRequest, request: Request, db: Session = Depends(get_db)):
    current = _require_admin(request, db)
    role = req.role.strip().lower()
    if role not in ROLES:
        raise HTTPException(400, "成员角色不支持")
    if role == "owner" and current.role != "owner":
        raise HTTPException(403, "只有老板可以新增另一位老板")
    email = _email(req.email)
    if db.scalar(select(TeamMember).where(TeamMember.email == email)):
        raise HTTPException(409, "这个邮箱已经是团队成员")
    row = TeamMember(
        email=email,
        display_name=req.display_name.strip() or email,
        role=role,
        password_hash=_password_hash(req.password),
        enabled=1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _member_dict(row)


@app.patch("/api/team/members/{member_id}")
def patch_member(
    member_id: int,
    req: MemberPatchRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    current = _require_admin(request, db)
    row = db.get(TeamMember, member_id)
    if not row:
        raise HTTPException(404, "没有找到这个成员")
    values = req.model_dump(exclude_none=True)
    if "role" in values:
        role = str(values["role"]).strip().lower()
        if role not in ROLES:
            raise HTTPException(400, "成员角色不支持")
        if (row.role == "owner" or role == "owner") and current.role != "owner":
            raise HTTPException(403, "只有老板可以调整老板权限")
        row.role = role
    if "display_name" in values:
        row.display_name = str(values["display_name"]).strip()
    if "password" in values:
        row.password_hash = _password_hash(str(values["password"]))
    if "enabled" in values:
        if row.id == current.id and not values["enabled"]:
            raise HTTPException(400, "不能停用自己当前的账号")
        row.enabled = 1 if values["enabled"] else 0
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _member_dict(row)
