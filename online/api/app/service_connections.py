from __future__ import annotations

import base64
import hashlib
import os
from datetime import datetime, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app


SERVICE_DEFS: dict[str, dict[str, str]] = {
    "company": {"name": "企业核验", "url_env": "HUIDI_COMPANY_LOOKUP_URL", "token_env": "HUIDI_COMPANY_LOOKUP_TOKEN"},
    "trade": {"name": "贸易 / 海关数据", "url_env": "HUIDI_TRADE_DATA_URL", "token_env": "HUIDI_TRADE_DATA_TOKEN"},
    "tariff": {"name": "HS / 关税", "url_env": "HUIDI_TARIFF_LOOKUP_URL", "token_env": "HUIDI_TARIFF_LOOKUP_TOKEN"},
    "shipping": {"name": "船期 / 物流", "url_env": "HUIDI_SHIPPING_API_URL", "token_env": "HUIDI_SHIPPING_API_TOKEN"},
}


class ServiceConnection(Base):
    __tablename__ = "service_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    service_key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    endpoint_url: Mapped[str] = mapped_column(Text, default="")
    encrypted_token: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[int] = mapped_column(Integer, default=1, index=True)
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class ServiceConnectionPatch(BaseModel):
    endpoint_url: str = Field(default="", max_length=2000)
    token: str = Field(default="", max_length=12000)
    enabled: bool = True
    clear_token: bool = False


def _fernet() -> Fernet:
    secret = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if len(secret) < 16:
        raise HTTPException(503, "服务器安全密钥还没有配置，暂时不能保存数据服务授权")
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def _decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        raise HTTPException(503, "这个数据服务的授权信息无法读取，请管理员重新连接")


def _definition(service_key: str) -> dict[str, str]:
    definition = SERVICE_DEFS.get(service_key)
    if not definition:
        raise HTTPException(404, "没有找到这个数据服务")
    return definition


def _member(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    return member if isinstance(member, dict) else {}


def _require_manager(request: Request) -> dict[str, Any]:
    member = _member(request)
    if not member:
        return {"display_name": "单人使用", "role": "owner"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以修改数据服务")
    return member


def resolve_service_connection(db: Session, service_key: str) -> dict[str, Any]:
    definition = _definition(service_key)
    row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == service_key))
    if row:
        if not row.enabled:
            return {
                "service_key": service_key,
                "name": definition["name"],
                "connected": False,
                "source": "company",
                "endpoint_url": row.endpoint_url,
                "token": "",
                "token_saved": bool(row.encrypted_token),
            }
        token = _decrypt(row.encrypted_token) if row.encrypted_token else ""
        connected = bool(row.endpoint_url.strip())
        return {
            "service_key": service_key,
            "name": definition["name"],
            "connected": connected,
            "source": "company",
            "endpoint_url": row.endpoint_url.strip(),
            "token": token,
            "token_saved": bool(row.encrypted_token),
        }

    endpoint = os.getenv(definition["url_env"], "").strip()
    token = os.getenv(definition["token_env"], "").strip()
    return {
        "service_key": service_key,
        "name": definition["name"],
        "connected": bool(endpoint),
        "source": "server" if endpoint else "none",
        "endpoint_url": endpoint,
        "token": token,
        "token_saved": bool(token),
    }


def public_service_status(db: Session, service_key: str) -> dict[str, Any]:
    definition = _definition(service_key)
    row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == service_key))
    if row:
        return {
            "service_key": service_key,
            "name": definition["name"],
            "connected": bool(row.enabled and row.endpoint_url.strip()),
            "source": "company",
            "endpoint_url": row.endpoint_url.strip(),
            "token_saved": bool(row.encrypted_token),
        }
    endpoint = os.getenv(definition["url_env"], "").strip()
    token = os.getenv(definition["token_env"], "").strip()
    return {
        "service_key": service_key,
        "name": definition["name"],
        "connected": bool(endpoint),
        "source": "server" if endpoint else "none",
        "endpoint_url": "",
        "token_saved": bool(token),
    }


@app.get("/api/service-connections")
def list_service_connections(db: Session = Depends(get_db)):
    return {
        "ok": True,
        "items": [public_service_status(db, key) for key in SERVICE_DEFS],
    }


@app.put("/api/service-connections/{service_key}")
def save_service_connection(
    service_key: str,
    req: ServiceConnectionPatch,
    request: Request,
    db: Session = Depends(get_db),
):
    definition = _definition(service_key)
    current = _require_manager(request)
    row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == service_key))
    if not row:
        row = ServiceConnection(service_key=service_key, created_at=datetime.now(timezone.utc))
        db.add(row)
    row.endpoint_url = req.endpoint_url.strip()
    if req.clear_token:
        row.encrypted_token = ""
    elif req.token.strip():
        row.encrypted_token = _encrypt(req.token.strip())
    row.enabled = 1 if req.enabled else 0
    row.updated_by = str(current.get("display_name") or current.get("email") or "管理员")[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "service": public_service_status(db, service_key),
        "message": f"{definition['name']}设置已保存",
    }


@app.delete("/api/service-connections/{service_key}")
def reset_service_connection(service_key: str, request: Request, db: Session = Depends(get_db)):
    definition = _definition(service_key)
    _require_manager(request)
    row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == service_key))
    if row:
        db.delete(row)
        db.commit()
    return {
        "ok": True,
        "service": public_service_status(db, service_key),
        "message": f"{definition['name']}已恢复服务器默认设置",
    }
