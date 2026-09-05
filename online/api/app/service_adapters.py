from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app
from .service_connections import SERVICE_DEFS, resolve_service_connection


ADAPTERS = {
    "post_bearer_json": {"name": "常见授权", "method": "POST", "credential": "bearer"},
    "post_key_header_json": {"name": "请求头密钥", "method": "POST", "credential": "header"},
    "get_key_query": {"name": "查询参数密钥", "method": "GET", "credential": "query"},
    "post_json": {"name": "无授权 JSON", "method": "POST", "credential": "none"},
}


class ServiceAdapterSetting(Base):
    __tablename__ = "service_adapter_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    service_key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    adapter_key: Mapped[str] = mapped_column(String(60), default="post_bearer_json")
    credential_name: Mapped[str] = mapped_column(String(120), default="")
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class AdapterPatch(BaseModel):
    adapter_key: str = Field(default="post_bearer_json", max_length=60)
    credential_name: str = Field(default="", max_length=120)


def _member(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    return member if isinstance(member, dict) else {}


def _require_manager(request: Request) -> dict[str, Any]:
    member = _member(request)
    if not member:
        return {"display_name": "单人使用", "role": "owner"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以修改数据服务接入方式")
    return member


def _adapter_setting(db: Session, service_key: str) -> dict[str, str]:
    if service_key not in SERVICE_DEFS:
        raise HTTPException(404, "没有找到这个数据服务")
    row = db.scalar(select(ServiceAdapterSetting).where(ServiceAdapterSetting.service_key == service_key))
    adapter_key = row.adapter_key if row and row.adapter_key in ADAPTERS else "post_bearer_json"
    credential_name = str(row.credential_name if row else "").strip()
    if not credential_name:
        credential_name = "X-API-Key" if ADAPTERS[adapter_key]["credential"] == "header" else "api_key"
    return {"service_key": service_key, "adapter_key": adapter_key, "adapter_name": ADAPTERS[adapter_key]["name"], "credential_name": credential_name}


def public_adapter_status(db: Session, service_key: str) -> dict[str, Any]:
    setting = _adapter_setting(db, service_key)
    return {**setting, "adapters": {key: value["name"] for key, value in ADAPTERS.items()}}


def execute_service_request(db: Session, service_key: str, payload: dict[str, Any], *, test: bool = False) -> Any:
    resolved = resolve_service_connection(db, service_key)
    endpoint = str(resolved.get("endpoint_url") or "").strip()
    if not resolved.get("connected") or not endpoint:
        raise HTTPException(503, f"{resolved.get('name') or '数据服务'}还没有连接")
    setting = _adapter_setting(db, service_key)
    adapter = ADAPTERS[setting["adapter_key"]]
    token = str(resolved.get("token") or "").strip()
    headers = {"Accept": "application/json"}
    params: dict[str, Any] = {}
    json_body: dict[str, Any] | None = payload
    if adapter["credential"] == "bearer" and token:
        headers["Authorization"] = f"Bearer {token}"
    elif adapter["credential"] == "header" and token:
        headers[setting["credential_name"]] = token
    elif adapter["credential"] == "query" and token:
        params[setting["credential_name"]] = token
    if test:
        headers["X-HUIDI-Connection-Test"] = "1"
    try:
        with httpx.Client(timeout=20 if test else 35) as client:
            if adapter["method"] == "GET":
                params.update({k: v for k, v in payload.items() if v not in {None, ""}})
                response = client.get(endpoint, headers=headers, params=params)
            else:
                headers["Content-Type"] = "application/json"
                response = client.post(endpoint, headers=headers, params=params, json=json_body)
    except httpx.RequestError as exc:
        raise HTTPException(502, "连接不到这个数据服务，请检查服务地址或网络") from exc
    if response.status_code in {401, 403}:
        raise HTTPException(502, "数据服务没有接受当前授权信息，请重新检查")
    if response.status_code == 404:
        raise HTTPException(502, "没有找到这个数据服务地址，请重新检查")
    if response.status_code >= 400:
        raise HTTPException(502, "数据服务已经响应，但没有成功返回数据")
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:12000]}


@app.get("/api/service-adapters")
def list_service_adapters(request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    return {"items": [public_adapter_status(db, key) for key in SERVICE_DEFS]}


@app.put("/api/service-adapters/{service_key}")
def save_service_adapter(service_key: str, req: AdapterPatch, request: Request, db: Session = Depends(get_db)):
    current = _require_manager(request)
    if service_key not in SERVICE_DEFS:
        raise HTTPException(404, "没有找到这个数据服务")
    if req.adapter_key not in ADAPTERS:
        raise HTTPException(400, "不支持这种接入方式")
    row = db.scalar(select(ServiceAdapterSetting).where(ServiceAdapterSetting.service_key == service_key))
    if not row:
        row = ServiceAdapterSetting(service_key=service_key)
        db.add(row)
    row.adapter_key = req.adapter_key
    row.credential_name = req.credential_name.strip()
    row.updated_by = str(current.get("display_name") or current.get("email") or "管理员")[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "adapter": public_adapter_status(db, service_key)}


@app.post("/api/service-adapters/{service_key}/test")
def test_service_adapter(service_key: str, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    samples = {
        "company": {"company": "HUIDI Connection Test", "domain": "", "country": ""},
        "trade": {"company": "", "product": "stainless steel hardware", "hs_code": "", "country": ""},
        "tariff": {"hs_code": "830210", "origin": "CN", "destination": "US", "product": "metal hinge"},
        "shipping": {"origin": "Shanghai", "destination": "Los Angeles", "departure_date": datetime.now(timezone.utc).date().isoformat(), "container": "40HQ"},
    }
    execute_service_request(db, service_key, samples.get(service_key, {}), test=True)
    setting = _adapter_setting(db, service_key)
    return {"ok": True, "message": f"{SERVICE_DEFS[service_key]['name']}连接正常 · {setting['adapter_name']}"}
