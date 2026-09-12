from __future__ import annotations

import base64
import hashlib
import os
from datetime import date, datetime, timezone
from typing import Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app
from .provider_settings import PROVIDERS, public_provider_status, save_provider, test_provider


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
    client_id: str | None = Field(default=None, max_length=1000)
    client_secret: str | None = Field(default=None, max_length=12000)
    tenant: str | None = Field(default=None, max_length=255)
    redirect_uri: str | None = Field(default=None, max_length=2000)
    model: str | None = Field(default=None, max_length=200)
    adapter_key: str | None = Field(default=None, max_length=60)
    credential_name: str | None = Field(default=None, max_length=120)


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
    definition = SERVICE_DEFS.get(service_key) or PROVIDERS.get(service_key)
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
    if service_key in PROVIDERS:
        return public_provider_status(db, service_key)
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


def _test_payload(service_key: str) -> dict[str, Any]:
    if service_key == "company":
        return {"company": "HUIDI Connection Test", "domain": "", "country": ""}
    if service_key == "trade":
        return {"company": "", "product": "stainless steel hardware", "hs_code": "", "country": ""}
    if service_key == "tariff":
        return {"hs_code": "830210", "origin": "CN", "destination": "US", "product": "metal hinge"}
    return {
        "origin": "Shanghai",
        "destination": "Los Angeles",
        "departure_date": date.today().isoformat(),
        "container": "40HQ",
    }


def test_resolved_service(db: Session, service_key: str) -> dict[str, Any]:
    if service_key in PROVIDERS:
        return test_provider(db, service_key)
    # Identical transport and credentials to actual company/trade/tariff/shipping calls.
    from .service_adapters import execute_service_request
    data = execute_service_request(db, service_key, _test_payload(service_key), test=True)
    if not isinstance(data, (dict, list)) or (isinstance(data, dict) and (data.get("text") or data.get("error") or data.get("errors"))):
        raise HTTPException(502, "服务未返回有效业务 JSON，不能判定为连接成功")
    return {"ok": True, "verified": True, "service_key": service_key,
            "name": SERVICE_DEFS[service_key]["name"], "source": public_service_status(db, service_key)["source"],
            "message": "本次接口检查通过；具体业务字段须符合 HUIDI 数据服务协议。"}


@app.get("/api/service-connections")
def list_service_connections(request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    return {
        "ok": True,
        "items": [public_provider_status(db, key, request) for key in PROVIDERS] + [
            {**public_service_status(db, key), "kind": "custom", "enabled": bool((_row.enabled if (_row := db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == key))) else True)),
             "verified": False} for key in SERVICE_DEFS],
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
    if service_key in PROVIDERS:
        save_provider(db, service_key, req.model_dump(exclude_unset=True), str(current.get("display_name") or "管理员"), public_provider_status(db, service_key, request).get("redirect_uri", ""))
        return {"ok": True, "service": public_provider_status(db, service_key, request), "message": "设置已加密保存，尚未验证连接"}
    # Save connection and its adapter in one existing tenant transaction.
    if req.adapter_key is not None:
        from .service_adapters import ADAPTERS, ServiceAdapterSetting, validate_credential_name
        if req.adapter_key not in ADAPTERS:
            raise HTTPException(400, "不支持这种接入方式")
        validate_credential_name(req.credential_name or "")
        setting = db.scalar(select(ServiceAdapterSetting).where(ServiceAdapterSetting.service_key == service_key))
        if setting is None:
            setting = ServiceAdapterSetting(service_key=service_key)
            db.add(setting)
        setting.adapter_key, setting.credential_name = req.adapter_key, (req.credential_name or "").strip()
    if req.enabled and not req.endpoint_url.strip():
        raise HTTPException(400, "请填写服务商提供的连接地址，或关闭这个来源")
    if req.endpoint_url.strip():
        from .service_adapters import _validate_endpoint
        _validate_endpoint(req.endpoint_url.strip())
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


@app.post("/api/service-connections/{service_key}/test")
def test_service_connection(service_key: str, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    _definition(service_key)
    return test_resolved_service(db, service_key)


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
