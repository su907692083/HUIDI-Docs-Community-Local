from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from typing import Any

import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .intelligence_records import record_intelligence
from .lead_engine import clean_domain
from .main import Lead, add_activity, get_db
from .online_app import app
from .service_connections import public_service_status, resolve_service_connection


SERPER_API_KEY = os.getenv("SERPER_API_KEY", "").strip()


class MapSearchRequest(BaseModel):
    keyword: str = Field(min_length=2, max_length=200)
    location: str = Field(default="", max_length=200)
    buyer_type: str = Field(default="importer distributor wholesaler", max_length=200)
    limit: int = Field(default=20, ge=1, le=40)


class MapLeadImportRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    website: str = Field(default="", max_length=1000)
    address: str = Field(default="", max_length=1000)
    country: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=120)
    category: str = Field(default="", max_length=255)
    product_keyword: str = Field(default="", max_length=200)
    buyer_type: str = Field(default="", max_length=200)
    source_url: str = Field(default="", max_length=1000)


class NewsRequest(BaseModel):
    keyword: str = Field(min_length=2, max_length=200)
    country: str = Field(default="", max_length=120)
    limit: int = Field(default=12, ge=1, le=30)
    lead_id: int | None = None
    deal_id: int | None = None


class FXRequest(BaseModel):
    base: str = Field(default="USD", min_length=3, max_length=3)
    quote: str = Field(default="CNY", min_length=3, max_length=3)
    amount: float = Field(default=1, gt=0, le=1000000000)
    lead_id: int | None = None
    deal_id: int | None = None


class CompanyCheckRequest(BaseModel):
    company: str = Field(min_length=2, max_length=255)
    domain: str = Field(default="", max_length=255)
    country: str = Field(default="", max_length=120)
    lead_id: int | None = None
    deal_id: int | None = None


class TradeDataRequest(BaseModel):
    company: str = Field(default="", max_length=255)
    product: str = Field(default="", max_length=255)
    hs_code: str = Field(default="", max_length=40)
    country: str = Field(default="", max_length=120)
    lead_id: int | None = None
    deal_id: int | None = None


class TariffRequest(BaseModel):
    hs_code: str = Field(min_length=4, max_length=40)
    origin: str = Field(default="", max_length=120)
    destination: str = Field(default="", max_length=120)
    product: str = Field(default="", max_length=255)
    lead_id: int | None = None
    deal_id: int | None = None


class ShippingRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=255)
    destination: str = Field(min_length=2, max_length=255)
    departure_date: str = Field(default="", max_length=40)
    container: str = Field(default="40HQ", max_length=40)
    lead_id: int | None = None
    deal_id: int | None = None


def _configured(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _provider_status(db: Session) -> dict[str, Any]:
    company = public_service_status(db, "company")
    trade = public_service_status(db, "trade")
    tariff_status = public_service_status(db, "tariff")
    shipping_status = public_service_status(db, "shipping")
    return {
        "mail": {
            "gmail": _configured("GMAIL_CLIENT_ID") and _configured("GMAIL_CLIENT_SECRET"),
            "outlook": _configured("OUTLOOK_CLIENT_ID") and _configured("OUTLOOK_CLIENT_SECRET"),
            "company_mail": True,
        },
        "lead_search": bool(SERPER_API_KEY),
        "map_search": bool(SERPER_API_KEY),
        "trade_news": bool(SERPER_API_KEY),
        "company_check": company["connected"],
        "trade_data": trade["connected"],
        "tariff": tariff_status["connected"],
        "fx": True,
        "shipping": shipping_status["connected"],
        "company_sources": {
            "company_check": company["source"],
            "trade_data": trade["source"],
            "tariff": tariff_status["source"],
            "shipping": shipping_status["source"],
        },
    }


@app.get("/api/services/status")
def service_status(db: Session = Depends(get_db)):
    return {"ok": True, "services": _provider_status(db)}


def _serper(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not SERPER_API_KEY:
        raise HTTPException(503, "还没有连接在线搜索服务")
    with httpx.Client(timeout=30) as client:
        r = client.post(
            f"https://google.serper.dev/{path}",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json=payload,
        )
        if r.status_code >= 400:
            raise HTTPException(502, "在线数据暂时没有返回，请稍后再试")
        return r.json()


def _record_and_note(
    db: Session,
    kind: str,
    title: str,
    query: dict[str, Any],
    result: Any,
    lead_id: int | None,
    deal_id: int | None,
    activity_title: str,
) -> int | None:
    if not lead_id and not deal_id:
        return None
    row = record_intelligence(db, kind, title, query, result, lead_id=lead_id, deal_id=deal_id)
    if lead_id:
        lead = db.get(Lead, lead_id)
        if lead:
            add_activity(
                db,
                lead.id,
                f"{kind}_checked",
                activity_title,
                title,
                {"intelligence_record_id": row.id, "deal_id": deal_id},
            )
    db.commit()
    return row.id


@app.post("/api/tools/map-leads")
def map_leads(req: MapSearchRequest):
    q = " ".join(x for x in [req.keyword, req.buyer_type, req.location] if x).strip()
    data = _serper("places", {"q": q, "num": req.limit})
    rows = []
    for x in data.get("places", [])[: req.limit]:
        gps = x.get("gpsCoordinates") or {}
        rows.append(
            {
                "name": x.get("title") or x.get("name") or "",
                "address": x.get("address") or "",
                "category": x.get("category") or x.get("type") or "",
                "phone": x.get("phoneNumber") or x.get("phone") or "",
                "website": x.get("website") or "",
                "rating": x.get("rating"),
                "reviews": x.get("ratingCount") or x.get("reviews"),
                "lat": gps.get("latitude") or x.get("latitude"),
                "lng": gps.get("longitude") or x.get("longitude"),
                "source_url": x.get("cid") or x.get("link") or "",
            }
        )
    return {"ok": True, "query": q, "items": rows}


@app.post("/api/tools/map-leads/import")
def import_map_lead(req: MapLeadImportRequest, db: Session = Depends(get_db)):
    domain = clean_domain(req.website)
    existing = db.scalar(select(Lead).where(Lead.domain == domain)) if domain else None
    if existing:
        return {"ok": True, "created": False, "lead_id": existing.id}
    evidence = [
        {
            "title": req.name,
            "url": req.website or req.source_url,
            "snippet": " · ".join(x for x in [req.category, req.address, req.phone] if x),
            "source": "map_search",
        }
    ]
    lead = Lead(
        company_name=req.name.strip(),
        domain=domain,
        website=req.website.strip(),
        country=req.country.strip(),
        market_keyword=req.product_keyword.strip(),
        buyer_type=req.buyer_type.strip(),
        score=50,
        reason="地图发现 · 待继续核对采购匹配度",
        evidence_json=json.dumps(evidence, ensure_ascii=False),
        status="new",
    )
    db.add(lead)
    db.flush()
    add_activity(db, lead.id, "map_lead_imported", "从地图加入线索", req.address, {"source_url": req.source_url})
    db.commit()
    db.refresh(lead)
    return {"ok": True, "created": True, "lead_id": lead.id}


@app.post("/api/tools/trade-news")
def trade_news(req: NewsRequest, db: Session = Depends(get_db)):
    q = " ".join(x for x in [req.keyword, req.country, "trade market sourcing"] if x)
    data = _serper("news", {"q": q, "num": req.limit})
    items = []
    for x in data.get("news", [])[: req.limit]:
        items.append(
            {
                "title": x.get("title") or "",
                "link": x.get("link") or "",
                "snippet": x.get("snippet") or "",
                "source": x.get("source") or "",
                "date": x.get("date") or "",
            }
        )
    record_id = _record_and_note(
        db,
        "market_news",
        q,
        {"keyword": req.keyword, "country": req.country},
        items,
        req.lead_id,
        req.deal_id,
        "已补充市场情报",
    )
    return {"ok": True, "query": q, "items": items, "record_id": record_id}


@app.post("/api/tools/fx")
def fx(req: FXRequest, db: Session = Depends(get_db)):
    base = req.base.upper()
    quote = req.quote.upper()
    if base == quote:
        result = {"ok": True, "base": base, "quote": quote, "rate": 1, "amount": req.amount, "converted": req.amount, "date": date.today().isoformat()}
    else:
        with httpx.Client(timeout=20) as client:
            r = client.get("https://api.frankfurter.app/latest", params={"from": base, "to": quote})
            if r.status_code >= 400:
                raise HTTPException(502, "汇率暂时无法读取，请稍后再试")
            data = r.json()
        rate = float((data.get("rates") or {}).get(quote) or 0)
        if rate <= 0:
            raise HTTPException(502, "暂时没有找到这组货币的汇率")
        result = {
            "ok": True,
            "base": base,
            "quote": quote,
            "rate": rate,
            "amount": req.amount,
            "converted": round(req.amount * rate, 6),
            "date": data.get("date") or date.today().isoformat(),
        }
    record_id = _record_and_note(
        db,
        "fx",
        f"{base} → {quote}",
        {"base": base, "quote": quote, "amount": req.amount},
        result,
        req.lead_id,
        req.deal_id,
        "已记录本次汇率",
    )
    return {**result, "record_id": record_id}


def _external_provider(db: Session, service_key: str, payload: dict[str, Any], missing_message: str) -> Any:
    service = resolve_service_connection(db, service_key)
    url = str(service.get("endpoint_url") or "").strip()
    if not service.get("connected") or not url:
        raise HTTPException(503, missing_message)
    token = str(service.get("token") or "").strip()
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with httpx.Client(timeout=35) as client:
        r = client.post(url, headers=headers, json=payload)
        if r.status_code >= 400:
            raise HTTPException(502, "数据服务暂时没有返回，请稍后再试")
        try:
            return r.json()
        except Exception:
            return {"text": r.text[:12000]}


@app.post("/api/tools/company-check")
def company_check(req: CompanyCheckRequest, db: Session = Depends(get_db)):
    query = req.model_dump(exclude={"lead_id", "deal_id"}, exclude_none=True)
    data = _external_provider(db, "company", query, "还没有连接企业核验数据服务")
    record_id = _record_and_note(db, "company", req.company, query, data, req.lead_id, req.deal_id, "已补充企业核验资料")
    return {"ok": True, "result": data, "record_id": record_id}


@app.post("/api/tools/trade-data")
def trade_data(req: TradeDataRequest, db: Session = Depends(get_db)):
    query = req.model_dump(exclude={"lead_id", "deal_id"}, exclude_none=True)
    data = _external_provider(db, "trade", query, "还没有连接贸易数据服务")
    record_id = _record_and_note(
        db,
        "trade",
        req.company or req.product or req.hs_code,
        query,
        data,
        req.lead_id,
        req.deal_id,
        "已补充贸易记录",
    )
    return {"ok": True, "result": data, "record_id": record_id}


@app.post("/api/tools/tariff")
def tariff(req: TariffRequest, db: Session = Depends(get_db)):
    query = req.model_dump(exclude={"lead_id", "deal_id"})
    data = _external_provider(db, "tariff", query, "还没有连接关税数据服务")
    record_id = _record_and_note(
        db,
        "tariff",
        f"{req.hs_code} · {req.origin} → {req.destination}",
        query,
        data,
        req.lead_id,
        req.deal_id,
        "已补充关税资料",
    )
    return {"ok": True, "result": data, "record_id": record_id}


@app.post("/api/tools/shipping")
def shipping(req: ShippingRequest, db: Session = Depends(get_db)):
    payload = req.model_dump(exclude={"lead_id", "deal_id"})
    if not payload["departure_date"]:
        payload["departure_date"] = date.today().isoformat()
    data = _external_provider(db, "shipping", payload, "还没有连接船期或物流数据服务")
    checked_at = datetime.now(timezone.utc).isoformat()
    result = {"result": data, "checked_at": checked_at}
    record_id = _record_and_note(
        db,
        "shipping",
        f"{req.origin} → {req.destination}",
        payload,
        result,
        req.lead_id,
        req.deal_id,
        "已补充船期 / 物流资料",
    )
    return {"ok": True, **result, "record_id": record_id}
