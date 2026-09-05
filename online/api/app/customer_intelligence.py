from __future__ import annotations

import asyncio
import hashlib
import html
import ipaddress
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

import httpx
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal
from .intelligence_records import OnlineIntelligenceRecord, record_intelligence
from .main import Lead, add_activity, get_db, safe_json
from .online_app import app


GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "").strip()
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "").strip()
CACHE_HOURS = max(1, min(24, int(os.getenv("HUIDI_INTEL_CACHE_HOURS", "6") or "6")))
MAX_SOURCE_ITEMS = 10

CATEGORY_NAMES = {
    "policy": "政策 / 关税",
    "industry": "行业 / 市场",
    "shipping": "物流 / 港口",
    "company": "客户公司",
    "weather": "当地影响",
    "geopolitics": "地区风险",
    "general": "当地动态",
}

POLICY_TERMS = (
    "tariff", "customs", "duty", "anti-dumping", "antidumping", "import ban", "export control",
    "regulation", "certification", "standard", "quota", "关税", "海关", "反倾销", "进口", "出口管制",
    "认证", "法规", "政策",
)
SHIPPING_TERMS = (
    "port", "shipping", "freight", "logistics", "container", "congestion", "canal", "vessel", "route",
    "港口", "航运", "海运", "物流", "运费", "集装箱", "航线", "罢工",
)
INDUSTRY_TERMS = (
    "market", "demand", "construction", "manufacturing", "retail", "investment", "acquisition", "merger",
    "factory", "plant", "sourcing", "procurement", "市场", "需求", "制造", "建筑", "并购", "投资", "采购",
)
GEOPOLITICAL_TERMS = (
    "war", "conflict", "attack", "missile", "military", "election", "sanction", "sanctions", "protest",
    "geopolitical", "战争", "冲突", "袭击", "军事", "选举", "制裁", "抗议", "地缘",
)
WEATHER_TERMS = (
    "flood", "storm", "hurricane", "typhoon", "earthquake", "wildfire", "heatwave", "blizzard",
    "洪水", "暴雨", "飓风", "台风", "地震", "山火", "热浪", "暴雪",
)


class ContextUseRequest(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    link: str = Field(default="", max_length=2000)
    source: str = Field(default="", max_length=255)
    category: str = Field(default="general", max_length=40)
    suggestion_zh: str = Field(default="", max_length=1200)
    suggestion_en: str = Field(default="", max_length=1200)


def _clean(value: Any, limit: int = 2000) -> str:
    return re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip()[:limit]


def _safe_public_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False
        host = parsed.hostname.lower().strip(".")
        if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


def _configured_rss_sources() -> list[dict[str, str]]:
    raw = os.getenv("HUIDI_INTEL_RSS_SOURCES", "").strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except Exception:
        return []
    rows: list[dict[str, str]] = []
    if isinstance(data, dict):
        data = [{"name": k, "url": v} for k, v in data.items()]
    if not isinstance(data, list):
        return []
    for item in data[:30]:
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("name") or "行业来源", 120)
        url = _clean(item.get("url"), 1500)
        lane = _clean(item.get("category") or item.get("lane") or "industry", 40).lower()
        if lane not in CATEGORY_NAMES:
            lane = "industry"
        if url and _safe_public_url(url):
            rows.append({"name": name, "url": url, "category": lane})
    return rows


def _classify(text: str, preferred: str = "") -> str:
    lowered = text.lower()
    if any(term in lowered for term in GEOPOLITICAL_TERMS):
        return "geopolitics"
    if any(term in lowered for term in WEATHER_TERMS):
        return "weather"
    if any(term in lowered for term in POLICY_TERMS):
        return "policy"
    if any(term in lowered for term in SHIPPING_TERMS):
        return "shipping"
    if preferred in CATEGORY_NAMES:
        return preferred
    if any(term in lowered for term in INDUSTRY_TERMS):
        return "industry"
    return "general"


def _topic_label(category: str) -> str:
    return {
        "policy": "trade rules and import requirements",
        "shipping": "shipping and logistics",
        "industry": "the local market",
        "company": "your industry",
        "weather": "the local situation",
        "geopolitics": "the local situation",
        "general": "the local market",
    }.get(category, "the local market")


def _chat_advice(category: str, country: str, product: str) -> dict[str, str]:
    place = country or "your market"
    if category == "geopolitics":
        return {
            "level": "谨慎",
            "zh": "涉及政治、冲突或制裁，不建议主动拿来寒暄。只有确认确实影响客户所在地时，才适合先关心对方是否安全，再谈业务。",
            "en": "",
        }
    if category == "weather":
        return {
            "level": "关心",
            "zh": "如果事件确实发生在客户所在地，可以先表达关心，不要借灾害强行转销售。",
            "en": f"I saw reports about some disruptions in {place}. Hope everything is okay on your side.",
        }
    if category in {"policy", "shipping"}:
        topic = _topic_label(category)
        return {
            "level": "商务",
            "zh": "适合自然询问是否影响客户近期业务，不要把媒体报道直接当成已经生效的官方结论。",
            "en": f"I noticed some recent updates around {topic} in {place}. Has this had any impact on your business recently?",
        }
    subject = product or "this category"
    return {
        "level": "自然",
        "zh": "可以作为轻量开场，再顺着客户的回复进入业务，不需要一上来就推销。",
        "en": f"I saw some recent news around {subject} in {place}. How has business been on your side lately?",
    }


def _score_item(item: dict[str, Any], *, country: str, product: str, company: str) -> tuple[int, str]:
    text = f"{item.get('title', '')} {item.get('summary', '')}".lower()
    score = 20
    reasons: list[str] = []
    if country and country.lower() in text:
        score += 24
        reasons.append("与客户所在市场相关")
    if company and company.lower() in text:
        score += 34
        reasons.append("直接提到客户公司")
    if product:
        product_lower = product.lower()
        if product_lower in text:
            score += 26
            reasons.append("与当前产品直接相关")
        else:
            tokens = [x for x in re.split(r"[\s,;/|]+", product_lower) if len(x) >= 3][:6]
            hits = sum(1 for token in tokens if token in text)
            if hits:
                score += min(18, hits * 6)
                reasons.append("与当前产品 / 行业有交集")
    if item.get("category") in {"policy", "shipping"}:
        score += 10
        reasons.append("可能影响交易或交付")
    if item.get("category") == "company":
        score += 12
    return min(100, score), "；".join(dict.fromkeys(reasons)) or "作为当前市场背景参考"


def _decorate(item: dict[str, Any], *, country: str, product: str, company: str, preferred: str = "") -> dict[str, Any] | None:
    title = _clean(item.get("title"), 500)
    link = _clean(item.get("link") or item.get("url"), 2000)
    if not title:
        return None
    summary = _clean(item.get("summary") or item.get("description") or item.get("snippet"), 1200)
    source = _clean(item.get("source") or item.get("publisher") or "公开新闻", 255)
    date = _clean(item.get("date") or item.get("publishedAt") or item.get("published_at"), 120)
    category = _classify(f"{title} {summary}", preferred or _clean(item.get("category"), 40).lower())
    base = {
        "title": title,
        "link": link,
        "source": source,
        "date": date,
        "summary": summary,
        "category": category,
        "category_name": CATEGORY_NAMES.get(category, "当地动态"),
    }
    score, reason = _score_item(base, country=country, product=product, company=company)
    chat = _chat_advice(category, country, product)
    marker = hashlib.sha1(f"{title}|{link}".encode("utf-8", errors="ignore")).hexdigest()[:16]
    base.update(
        {
            "id": marker,
            "relevance": score,
            "why": reason,
            "chat": chat,
            "needs_source_check": category in {"policy", "geopolitics"},
        }
    )
    return base


async def _google_news(client: httpx.AsyncClient, query: str, preferred: str) -> list[dict[str, Any]]:
    try:
        response = await client.get(
            "https://news.google.com/rss/search",
            params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
        )
        response.raise_for_status()
        root = ET.fromstring(response.text)
        rows: list[dict[str, Any]] = []
        for item in root.findall(".//item")[:MAX_SOURCE_ITEMS]:
            source_el = item.find("source")
            rows.append(
                {
                    "title": item.findtext("title") or "",
                    "link": item.findtext("link") or "",
                    "date": item.findtext("pubDate") or "",
                    "source": source_el.text if source_el is not None else "Google News",
                    "summary": item.findtext("description") or "",
                    "category": preferred,
                    "feed": "google_news_rss",
                }
            )
        return rows
    except Exception:
        return []


async def _gnews(client: httpx.AsyncClient, query: str, preferred: str) -> list[dict[str, Any]]:
    if not GNEWS_API_KEY:
        return []
    try:
        response = await client.get(
            "https://gnews.io/api/v4/search",
            params={"q": query, "lang": "en", "max": MAX_SOURCE_ITEMS, "apikey": GNEWS_API_KEY},
        )
        response.raise_for_status()
        data = response.json()
        rows = []
        for item in (data.get("articles") or [])[:MAX_SOURCE_ITEMS]:
            source = item.get("source") or {}
            rows.append(
                {
                    "title": item.get("title") or "",
                    "link": item.get("url") or "",
                    "date": item.get("publishedAt") or "",
                    "source": source.get("name") if isinstance(source, dict) else "GNews",
                    "summary": item.get("description") or item.get("content") or "",
                    "category": preferred,
                    "feed": "gnews",
                }
            )
        return rows
    except Exception:
        return []


async def _serper_news(client: httpx.AsyncClient, query: str, preferred: str) -> list[dict[str, Any]]:
    if not SERPER_API_KEY:
        return []
    try:
        response = await client.post(
            "https://google.serper.dev/news",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": MAX_SOURCE_ITEMS},
        )
        response.raise_for_status()
        data = response.json()
        return [
            {
                "title": item.get("title") or "",
                "link": item.get("link") or "",
                "date": item.get("date") or "",
                "source": item.get("source") or "Serper News",
                "summary": item.get("snippet") or "",
                "category": preferred,
                "feed": "serper_news",
            }
            for item in (data.get("news") or [])[:MAX_SOURCE_ITEMS]
        ]
    except Exception:
        return []


async def _custom_rss(client: httpx.AsyncClient, source: dict[str, str]) -> list[dict[str, Any]]:
    try:
        response = await client.get(source["url"])
        response.raise_for_status()
        root = ET.fromstring(response.text)
        rows: list[dict[str, Any]] = []
        rss_items = root.findall(".//item")
        if rss_items:
            for item in rss_items[:MAX_SOURCE_ITEMS]:
                rows.append(
                    {
                        "title": item.findtext("title") or "",
                        "link": item.findtext("link") or "",
                        "date": item.findtext("pubDate") or item.findtext("date") or "",
                        "source": source["name"],
                        "summary": item.findtext("description") or "",
                        "category": source["category"],
                        "feed": "configured_rss",
                    }
                )
            return rows
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall(".//a:entry", ns)[:MAX_SOURCE_ITEMS]:
            link_el = entry.find("a:link", ns)
            rows.append(
                {
                    "title": entry.findtext("a:title", default="", namespaces=ns),
                    "link": link_el.get("href", "") if link_el is not None else "",
                    "date": entry.findtext("a:updated", default="", namespaces=ns),
                    "source": source["name"],
                    "summary": entry.findtext("a:summary", default="", namespaces=ns),
                    "category": source["category"],
                    "feed": "configured_rss",
                }
            )
        return rows
    except Exception:
        return []


def _queries(*, country: str, product: str, company: str) -> list[tuple[str, str]]:
    place = country or "global"
    goods = product or "trade sourcing"
    rows = [
        ("industry", f"{place} {goods} market demand sourcing import"),
        ("policy", f"{place} {goods} tariff customs import regulation anti-dumping"),
        ("shipping", f"{place} shipping port freight logistics disruption"),
        ("geopolitics", f"{place} sanctions conflict protest strike business disruption"),
    ]
    if company:
        rows.insert(0, ("company", f'"{company}" {place} business news'))
    return rows


async def _collect(*, country: str, product: str, company: str, limit: int = 20) -> dict[str, Any]:
    queries = _queries(country=country, product=product, company=company)
    tasks: list[Any] = []
    async with httpx.AsyncClient(timeout=18, follow_redirects=True, headers={"User-Agent": "HUIDI-Online/0.1"}) as client:
        for preferred, query in queries:
            tasks.append(_google_news(client, query, preferred))
            if preferred in {"company", "industry", "policy"}:
                tasks.append(_gnews(client, query, preferred))
            if preferred in {"company", "policy"}:
                tasks.append(_serper_news(client, query, preferred))
        for source in _configured_rss_sources():
            tasks.append(_custom_rss(client, source))
        batches = await asyncio.gather(*tasks, return_exceptions=True)

    raw: list[dict[str, Any]] = []
    for batch in batches:
        if isinstance(batch, list):
            raw.extend(x for x in batch if isinstance(x, dict))

    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    for raw_item in raw:
        item = _decorate(raw_item, country=country, product=product, company=company)
        if not item:
            continue
        key = re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", item["title"].lower())[:180] or item["id"]
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
    items.sort(key=lambda x: (int(x.get("relevance") or 0), bool(x.get("date"))), reverse=True)
    return {
        "items": items[: max(1, min(40, limit))],
        "sources": {
            "google_news": True,
            "gnews": bool(GNEWS_API_KEY),
            "serper_news": bool(SERPER_API_KEY),
            "configured_rss": len(_configured_rss_sources()),
        },
        "note": "公开新闻用于市场背景和聊天参考；政策、冲突、制裁等内容必须打开来源核对，不自动写入正式报价、合同或产品事实。",
    }


def _record_is_fresh(row: OnlineIntelligenceRecord | None) -> bool:
    if not row or not row.checked_at:
        return False
    checked = row.checked_at
    if checked.tzinfo is None:
        checked = checked.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - checked <= timedelta(hours=CACHE_HOURS)


def _latest_record(db: Session, *, lead_id: int | None = None, deal_id: int | None = None) -> OnlineIntelligenceRecord | None:
    stmt = select(OnlineIntelligenceRecord).where(OnlineIntelligenceRecord.kind == "market_news")
    if lead_id is not None:
        stmt = stmt.where(OnlineIntelligenceRecord.lead_id == lead_id)
    if deal_id is not None:
        stmt = stmt.where(OnlineIntelligenceRecord.deal_id == deal_id)
    return db.scalar(stmt.order_by(OnlineIntelligenceRecord.checked_at.desc(), OnlineIntelligenceRecord.id.desc()))


def _decorate_cached(result: Any, *, country: str, product: str, company: str) -> dict[str, Any]:
    if not isinstance(result, dict):
        result = {"items": result if isinstance(result, list) else []}
    rows: list[dict[str, Any]] = []
    for item in result.get("items") or []:
        if not isinstance(item, dict):
            continue
        decorated = _decorate(item, country=country, product=product, company=company)
        if decorated:
            rows.append(decorated)
    rows.sort(key=lambda x: int(x.get("relevance") or 0), reverse=True)
    return {
        "items": rows,
        "sources": result.get("sources") or {},
        "note": result.get("note") or "公开新闻只作为市场背景参考。",
    }


async def _brief_for_context(
    db: Session,
    *,
    country: str,
    product: str,
    company: str,
    lead_id: int | None = None,
    deal_id: int | None = None,
    refresh: bool = False,
    limit: int = 20,
) -> dict[str, Any]:
    cached = _latest_record(db, lead_id=lead_id, deal_id=deal_id) if (lead_id is not None or deal_id is not None) else None
    if cached and not refresh and _record_is_fresh(cached):
        payload = _decorate_cached(safe_json(cached.result_json, {}), country=country, product=product, company=company)
        return {
            "ok": True,
            "cached": True,
            "record_id": cached.id,
            "checked_at": cached.checked_at.isoformat() if cached.checked_at else None,
            "context": {"country": country, "product": product, "company": company},
            **payload,
        }

    payload = await _collect(country=country, product=product, company=company, limit=limit)
    record_id = None
    checked_at = datetime.now(timezone.utc).isoformat()
    if lead_id is not None or deal_id is not None:
        row = record_intelligence(
            db,
            "market_news",
            " · ".join(x for x in [company, country, product, "客户动态"] if x)[:255] or "客户动态",
            {"company": company, "country": country, "product": product, "keyword": product},
            payload,
            lead_id=lead_id,
            deal_id=deal_id,
        )
        record_id = row.id
        checked_at = row.checked_at.isoformat() if row.checked_at else checked_at
        if lead_id:
            add_activity(
                db,
                lead_id,
                "customer_intelligence_refreshed",
                "已更新客户动态",
                f"找到 {len(payload['items'])} 条与当前客户 / 市场相关的公开动态",
                {"intelligence_record_id": row.id, "deal_id": deal_id},
            )
        db.commit()
    return {
        "ok": True,
        "cached": False,
        "record_id": record_id,
        "checked_at": checked_at,
        "context": {"country": country, "product": product, "company": company},
        **payload,
    }


@app.get("/api/intel/status")
def intelligence_status():
    return {
        "ok": True,
        "sources": {
            "全球新闻": "可用（Google News RSS）",
            "GNews": "已连接" if GNEWS_API_KEY else "可选，未连接",
            "现有在线搜索": "已连接" if SERPER_API_KEY else "可选，未连接",
            "行业 / 协会来源": len(_configured_rss_sources()),
        },
        "cache_hours": CACHE_HOURS,
        "policy_note": "政策与地缘事件以公开来源为线索，必须查看原文核对；HUIDI 不使用演示冲突等级作为事实。",
    }


@app.get("/api/intel/daily")
async def daily_intelligence(
    keyword: str = Query(default="", max_length=255),
    country: str = Query(default="", max_length=120),
    limit: int = Query(default=16, ge=1, le=40),
):
    return {
        "ok": True,
        "context": {"country": country.strip(), "product": keyword.strip(), "company": ""},
        **(await _collect(country=country.strip(), product=keyword.strip(), company="", limit=limit)),
    }


@app.get("/api/intel/customer/{lead_id}")
async def customer_intelligence(
    lead_id: int,
    refresh: bool = False,
    limit: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    return await _brief_for_context(
        db,
        country=lead.country.strip(),
        product=lead.market_keyword.strip(),
        company=lead.company_name.strip(),
        lead_id=lead.id,
        refresh=refresh,
        limit=limit,
    )


@app.get("/api/intel/deal/{deal_id}")
async def deal_intelligence(
    deal_id: int,
    refresh: bool = False,
    limit: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔询盘")
    customer = db.get(OnlineCustomer, deal.customer_id)
    return await _brief_for_context(
        db,
        country=(customer.country if customer else "").strip(),
        product=deal.product_keyword.strip(),
        company=(customer.company_name if customer else deal.title).strip(),
        lead_id=deal.source_lead_id,
        deal_id=deal.id,
        refresh=refresh,
        limit=limit,
    )


@app.post("/api/intel/customer/{lead_id}/use")
def use_customer_context(lead_id: int, req: ContextUseRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    add_activity(
        db,
        lead.id,
        "customer_context_selected",
        "已选为本次沟通参考",
        req.title,
        {
            "link": req.link,
            "source": req.source,
            "category": req.category,
            "suggestion_zh": req.suggestion_zh,
            "suggestion_en": req.suggestion_en,
        },
    )
    db.commit()
    return {"ok": True, "lead_id": lead.id, "message": "已记入客户开发记录。发送前仍由你确认。"}
