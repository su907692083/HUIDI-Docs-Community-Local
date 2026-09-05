from __future__ import annotations

import ipaddress
import json
import os
import socket
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app


CATEGORY_NAMES = {
    "policy": "政策 / 关税",
    "industry": "行业 / 市场",
    "shipping": "物流 / 港口",
    "company": "客户公司",
    "weather": "当地影响",
    "geopolitics": "地区风险",
    "general": "当地动态",
}
SOURCE_TYPE_NAMES = {
    "official": "官方机构",
    "association": "行业协会",
    "industry": "行业媒体",
    "media": "新闻媒体",
}
MAX_FEED_BYTES = 2_000_000


class IntelligenceFeedSource(Base):
    __tablename__ = "intelligence_feed_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), default="")
    feed_url: Mapped[str] = mapped_column(Text, unique=True)
    category: Mapped[str] = mapped_column(String(40), default="industry", index=True)
    source_type: Mapped[str] = mapped_column(String(40), default="industry", index=True)
    enabled: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_by: Mapped[str] = mapped_column(String(160), default="")
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    last_status: Mapped[str] = mapped_column(String(40), default="")
    last_message: Mapped[str] = mapped_column(String(500), default="")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class IntelligenceSourceSave(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    feed_url: str = Field(min_length=10, max_length=2000)
    category: str = Field(default="industry", max_length=40)
    source_type: str = Field(default="industry", max_length=40)
    enabled: bool = True


def _clean(value: Any, limit: int = 2000) -> str:
    return " ".join(str(value or "").split()).strip()[:limit]


def _member(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    return member if isinstance(member, dict) else {}


def _require_manager(request: Request) -> dict[str, Any]:
    member = _member(request)
    if not member:
        return {"display_name": "单人使用", "role": "owner"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以修改新闻与行业来源")
    return member


def _actor_name(member: dict[str, Any]) -> str:
    return _clean(member.get("display_name") or member.get("email") or "管理员", 160)


def _safe_public_url(value: str, *, resolve_dns: bool = True) -> bool:
    try:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False
        host = parsed.hostname.lower().strip(".")
        if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
            return False
        try:
            literal = ipaddress.ip_address(host)
            if literal.is_private or literal.is_loopback or literal.is_link_local or literal.is_reserved or literal.is_multicast:
                return False
        except ValueError:
            if resolve_dns:
                try:
                    addresses = {item[4][0] for item in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
                except OSError:
                    return False
                if not addresses:
                    return False
                for address in addresses:
                    ip = ipaddress.ip_address(address)
                    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                        return False
        return True
    except Exception:
        return False


def _validate_payload(req: IntelligenceSourceSave) -> dict[str, Any]:
    name = _clean(req.name, 160)
    feed_url = _clean(req.feed_url, 2000)
    category = _clean(req.category, 40).lower()
    source_type = _clean(req.source_type, 40).lower()
    if category not in CATEGORY_NAMES:
        raise HTTPException(400, "请选择有效的内容分类")
    if source_type not in SOURCE_TYPE_NAMES:
        raise HTTPException(400, "请选择有效的来源类型")
    if not _safe_public_url(feed_url):
        raise HTTPException(400, "请填写可以从公网访问的 RSS / Atom 地址")
    return {
        "name": name,
        "feed_url": feed_url,
        "category": category,
        "source_type": source_type,
        "enabled": 1 if req.enabled else 0,
    }


def _platform_sources() -> list[dict[str, Any]]:
    raw = os.getenv("HUIDI_INTEL_RSS_SOURCES", "").strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except Exception:
        return []
    if isinstance(data, dict):
        data = [{"name": key, "url": value} for key, value in data.items()]
    if not isinstance(data, list):
        return []
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(data[:30], start=1):
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("name") or "平台行业来源", 160)
        url = _clean(item.get("url") or item.get("feed_url"), 2000)
        category = _clean(item.get("category") or item.get("lane") or "industry", 40).lower()
        source_type = _clean(item.get("source_type") or item.get("type") or "industry", 40).lower()
        if category not in CATEGORY_NAMES:
            category = "industry"
        if source_type not in SOURCE_TYPE_NAMES:
            source_type = "industry"
        if url and _safe_public_url(url, resolve_dns=False):
            rows.append(
                {
                    "id": f"platform:{index}",
                    "name": name,
                    "url": url,
                    "feed_url": url,
                    "category": category,
                    "source_type": source_type,
                    "enabled": True,
                    "origin": "platform",
                    "editable": False,
                    "last_status": "",
                    "last_message": "平台预设来源",
                    "last_checked_at": None,
                }
            )
    return rows


def _row_payload(row: IntelligenceFeedSource) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "url": row.feed_url,
        "feed_url": row.feed_url,
        "category": row.category,
        "category_name": CATEGORY_NAMES.get(row.category, "行业 / 市场"),
        "source_type": row.source_type,
        "source_type_name": SOURCE_TYPE_NAMES.get(row.source_type, "行业媒体"),
        "enabled": bool(row.enabled),
        "origin": "company",
        "editable": True,
        "last_status": row.last_status,
        "last_message": row.last_message,
        "last_checked_at": row.last_checked_at.isoformat() if row.last_checked_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def configured_intelligence_sources(db: Session | None = None, *, enabled_only: bool = True) -> list[dict[str, Any]]:
    rows = list(_platform_sources())
    if db is None:
        return rows
    stmt = select(IntelligenceFeedSource)
    if enabled_only:
        stmt = stmt.where(IntelligenceFeedSource.enabled == 1)
    company_rows = db.scalars(stmt.order_by(IntelligenceFeedSource.id.asc())).all()
    rows.extend(_row_payload(row) for row in company_rows)
    return rows


async def fetch_feed_entries(source: dict[str, Any], *, limit: int = 10) -> list[dict[str, Any]]:
    current_url = _clean(source.get("url") or source.get("feed_url"), 2000)
    if not _safe_public_url(current_url):
        raise ValueError("来源地址不是可访问的公网地址")
    timeout = httpx.Timeout(12.0, connect=8.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, headers={"User-Agent": "HUIDI-Online/0.1"}) as client:
        response = None
        for _ in range(4):
            response = await client.get(current_url)
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location", "").strip()
                if not location:
                    raise ValueError("来源返回了无效跳转")
                current_url = urljoin(current_url, location)
                if not _safe_public_url(current_url):
                    raise ValueError("来源跳转到了不允许访问的地址")
                continue
            break
        if response is None:
            raise ValueError("来源没有返回内容")
        response.raise_for_status()
        if len(response.content) > MAX_FEED_BYTES:
            raise ValueError("来源内容过大，请使用标准 RSS / Atom 地址")
        text = response.text

    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise ValueError("这个地址没有返回可识别的 RSS / Atom 内容") from exc

    category = _clean(source.get("category") or "industry", 40).lower()
    source_type = _clean(source.get("source_type") or "industry", 40).lower()
    source_name = _clean(source.get("name") or "行业来源", 160)
    rows: list[dict[str, Any]] = []
    rss_items = root.findall(".//item")
    if rss_items:
        for item in rss_items[: max(1, min(20, limit))]:
            rows.append(
                {
                    "title": item.findtext("title") or "",
                    "link": item.findtext("link") or "",
                    "date": item.findtext("pubDate") or item.findtext("date") or "",
                    "source": source_name,
                    "summary": item.findtext("description") or "",
                    "category": category,
                    "source_type": source_type,
                    "feed": "managed_rss",
                }
            )
        return rows

    ns = {"a": "http://www.w3.org/2005/Atom"}
    for entry in root.findall(".//a:entry", ns)[: max(1, min(20, limit))]:
        link_el = entry.find("a:link", ns)
        rows.append(
            {
                "title": entry.findtext("a:title", default="", namespaces=ns),
                "link": link_el.get("href", "") if link_el is not None else "",
                "date": entry.findtext("a:updated", default="", namespaces=ns) or entry.findtext("a:published", default="", namespaces=ns),
                "source": source_name,
                "summary": entry.findtext("a:summary", default="", namespaces=ns) or entry.findtext("a:content", default="", namespaces=ns),
                "category": category,
                "source_type": source_type,
                "feed": "managed_atom",
            }
        )
    if not rows:
        raise ValueError("没有在这个地址里找到新闻条目")
    return rows


@app.get("/api/intel/sources")
def list_intelligence_sources(db: Session = Depends(get_db)):
    platform = _platform_sources()
    company = db.scalars(select(IntelligenceFeedSource).order_by(IntelligenceFeedSource.id.asc())).all()
    return {
        "ok": True,
        "platform": platform,
        "company": [_row_payload(row) for row in company],
        "categories": CATEGORY_NAMES,
        "source_types": SOURCE_TYPE_NAMES,
        "note": "平台预设来源由部署方维护；当前公司可以自行添加官方机构、行业协会和行业媒体的 RSS / Atom 来源。",
    }


@app.post("/api/intel/sources")
def create_intelligence_source(req: IntelligenceSourceSave, request: Request, db: Session = Depends(get_db)):
    member = _require_manager(request)
    payload = _validate_payload(req)
    existing = db.scalar(select(IntelligenceFeedSource).where(IntelligenceFeedSource.feed_url == payload["feed_url"]))
    if existing:
        raise HTTPException(409, "这个来源已经添加过了")
    now = datetime.now(timezone.utc)
    actor = _actor_name(member)
    row = IntelligenceFeedSource(**payload, created_by=actor, updated_by=actor, created_at=now, updated_at=now)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "这个来源已经添加过了") from exc
    db.refresh(row)
    return {"ok": True, "item": _row_payload(row), "message": "已添加到当前公司的新闻与行业来源。"}


@app.put("/api/intel/sources/{source_id}")
def update_intelligence_source(source_id: int, req: IntelligenceSourceSave, request: Request, db: Session = Depends(get_db)):
    member = _require_manager(request)
    row = db.get(IntelligenceFeedSource, source_id)
    if not row:
        raise HTTPException(404, "没有找到这个来源")
    payload = _validate_payload(req)
    duplicate = db.scalar(
        select(IntelligenceFeedSource).where(
            IntelligenceFeedSource.feed_url == payload["feed_url"],
            IntelligenceFeedSource.id != source_id,
        )
    )
    if duplicate:
        raise HTTPException(409, "这个来源已经添加过了")
    for key, value in payload.items():
        setattr(row, key, value)
    row.updated_by = _actor_name(member)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "item": _row_payload(row), "message": "来源设置已保存。"}


@app.delete("/api/intel/sources/{source_id}")
def delete_intelligence_source(source_id: int, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = db.get(IntelligenceFeedSource, source_id)
    if not row:
        raise HTTPException(404, "没有找到这个来源")
    db.delete(row)
    db.commit()
    return {"ok": True, "message": "已从当前公司的来源中删除。"}


@app.post("/api/intel/sources/{source_id}/test")
async def test_intelligence_source(source_id: int, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = db.get(IntelligenceFeedSource, source_id)
    if not row:
        raise HTTPException(404, "没有找到这个来源")
    source = _row_payload(row)
    checked = datetime.now(timezone.utc)
    try:
        entries = await fetch_feed_entries(source, limit=5)
        titles = [_clean(item.get("title"), 180) for item in entries if _clean(item.get("title"), 180)][:3]
        row.last_status = "ok"
        row.last_message = f"连接正常，读取到 {len(entries)} 条内容"
        row.last_checked_at = checked
        row.updated_at = checked
        db.commit()
        return {"ok": True, "message": row.last_message, "sample_titles": titles}
    except Exception as exc:
        row.last_status = "failed"
        row.last_message = _clean(str(exc) or "暂时无法读取", 500)
        row.last_checked_at = checked
        row.updated_at = checked
        db.commit()
        raise HTTPException(400, f"检查没有通过：{row.last_message}") from exc
