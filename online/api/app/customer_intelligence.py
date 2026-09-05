from __future__ import annotations

import asyncio
import hashlib
import html
import ipaddress
import json
import os
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
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
CHAT_MAX_DAYS = max(3, min(60, int(os.getenv("HUIDI_INTEL_CHAT_MAX_DAYS", "21") or "21")))
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
    item_id: str = Field(default="", max_length=80)
    title: str = Field(min_length=2, max_length=500)
    link: str = Field(default="", max_length=2000)
    source: str = Field(default="", max_length=255)
    category: str = Field(default="general", max_length=40)
    suggestion_zh: str = Field(default="", max_length=1200)
    suggestion_en: str = Field(default="", max_length=1200)
    source_checked: bool = False


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
        source_type = _clean(item.get("source_type") or item.get("type") or "industry", 40).lower()
        if lane not in CATEGORY_NAMES:
            lane = "industry"
        if source_type not in {"official", "association", "industry", "media"}:
            source_type = "industry"
        if url and _safe_public_url(url):
            rows.append({"name": name, "url": url, "category": lane, "source_type": source_type})
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


def _parse_published_at(value: Any) -> datetime | None:
    text = _clean(value, 120)
    if not text:
        return None
    lowered = text.lower()
    now = datetime.now(timezone.utc)
    if lowered == "yesterday":
        return now - timedelta(days=1)
    relative = re.search(r"(\d+)\s*(minute|hour|day|week)s?\s+ago", lowered)
    if relative:
        amount = int(relative.group(1))
        unit = relative.group(2)
        delta = {
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
        }[unit]
        return now - delta
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        parsed = parsedate_to_datetime(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        pass
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def _freshness(date_value: Any, category: str) -> dict[str, Any]:
    published = _parse_published_at(date_value)
    if not published:
        return {"status": "unknown", "label": "时间待核对", "age_days": None, "chat_allowed": False}
    age_days = max(0, int((datetime.now(timezone.utc) - published).total_seconds() // 86400))
    limit = {
        "weather": 3,
        "geopolitics": 7,
        "shipping": min(CHAT_MAX_DAYS, 21),
        "policy": min(max(CHAT_MAX_DAYS, 30), 45),
        "company": min(max(CHAT_MAX_DAYS, 30), 45),
    }.get(category, CHAT_MAX_DAYS)
    if age_days <= limit:
        status, label = "fresh", "近期"
    elif age_days <= limit * 2:
        status, label = "aging", "较早"
    else:
        status, label = "stale", "过期参考"
    return {
        "status": status,
        "label": label,
        "age_days": age_days,
        "chat_allowed": status == "fresh" and category != "geopolitics",
    }


def _source_profile(item: dict[str, Any]) -> dict[str, str]:
    source_type = _clean(item.get("source_type"), 40).lower()
    feed = _clean(item.get("feed"), 60).lower()
    if source_type == "official":
        return {"type": "official", "label": "官方来源", "level": "direct"}
    if source_type == "association":
        return {"type": "association", "label": "行业协会", "level": "direct"}
    if source_type == "industry":
        return {"type": "industry", "label": "行业来源", "level": "configured"}
    if feed in {"google_news_rss", "gnews", "serper_news"}:
        return {"type": "media", "label": "媒体聚合", "level": "reference"}
    return {"type": "media", "label": "公开来源", "level": "reference"}


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


def _chat_advice(category: str, country: str, product: str, freshness: dict[str, Any]) -> dict[str, str]:
    place = country or "your market"
    if category == "geopolitics":
        return {
            "level": "谨慎",
            "zh": "涉及政治、冲突或制裁，不建议主动拿来寒暄。只有确认确实影响客户所在地时，才适合先关心对方是否安全，再谈业务。",
            "en": "",
        }
    if not freshness.get("chat_allowed"):
        return {
            "level": "仅参考",
            "zh": "这条信息发布时间较早或暂时无法确认，不建议直接拿来和客户开场；可以先打开原文核对最新情况。",
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
    freshness = item.get("freshness") or {}
    if freshness.get("status") == "fresh":
        score += 8
    elif freshness.get("status") == "stale":
        score -= 18
    elif freshness.get("status") == "unknown":
        score -= 6
    source = item.get("source_profile") or {}
    if source.get("type") == "official":
        score += 8
        reasons.append("来自官方来源")
    elif source.get("type") == "association":
        score += 5
        reasons.append("来自行业协会")
    return max(0, min(100, score)), "；".join(dict.fromkeys(reasons)) or "作为当前市场背景参考"


def _decorate(item: dict[str, Any], *, country: str, product: str, company: str, preferred: str = "") -> dict[str, Any] | None:
    title = _clean(item.get("title"), 500)
    link = _clean(item.get("link") or item.get("url"), 2000)
    if not title:
        return None
    if link and not _safe_public_url(link):
        link = ""
    summary = _clean(item.get("summary") or item.get("description") or item.get("snippet"), 1200)
    source = _clean(item.get("source") or item.get("publisher") or "公开新闻", 255)
    date = _clean(item.get("date") or item.get("publishedAt") or item.get("published_at"), 120)
    category = _classify(f"{title} {summary}", preferred or _clean(item.get("category"), 40).lower())
    freshness = _freshness(date, category)
    source_profile = _source_profile(item)
    base = {
        "title": title,
        "link": link,
        "source": source,
        "date": date,
        "summary": summary,
        "category": category,
        "category_name": CATEGORY_NAMES.get(category, "当地动态"),
        "feed": _clean(item.get("feed"), 60),
        "source_type": _clean(item.get("source_type"), 40),
        "source_profile": source_profile,
        "freshness": freshness,
    }
    score, reason = _score_item(base, country=country, product=product, company=company)
    chat = _chat_advice(category, country, product, freshness)
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
                    "source_type": "media",
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
                    "source_type": "media",
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
                "source_type": "media",
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
                        "source_type": source["source_type"],
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
                    "source_type": source["source_type"],
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
    sources = _configured_rss_sources()
    async with httpx.AsyncClient(timeout=18, follow_redirects=True, headers={"User-Agent": "HUIDI-Online/0.1"}) as client:
        for preferred, query in queries:
            tasks.append(_google_news(client, query, preferred))
            if preferred in {"company", "industry", "policy"}:
                tasks.append(_gnews(client, query, preferred))
            if preferred in {"company", "policy"}:
                tasks.append(_serper_news(client, query, preferred))
        for source in sources:
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
    freshness_rank = {"fresh": 3, "unknown": 2, "aging": 1, "stale": 0}
    items.sort(
        key=lambda x: (
            int(x.get("relevance") or 0),
            freshness_rank.get((x.get("freshness") or {}).get("status"), 0),
        ),
        reverse=True,
    )
    return {
        "items": items[: max(1, min(40, limit))],
        "sources": {
            "google_news": True,
            "gnews": bool(GNEWS_API_KEY),
            "serper_news": bool(SERPER_API_KEY),
            "configured_rss": len(sources),
            "official_or_association": sum(1 for x in sources if x.get("source_type") in {"official", "association"}),
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


def _verified_customer_item(db: Session, lead: Lead, req: ContextUseRequest) -> dict[str, Any]:
    row = _latest_record(db, lead_id=lead.id)
    if not row:
        raise HTTPException(409, "请先更新一次客户动态，再选择沟通参考")
    payload = _decorate_cached(
        safe_json(row.result_json, {}),
        country=lead.country.strip(),
        product=lead.market_keyword.strip(),
        company=lead.company_name.strip(),
    )
    wanted_id = _clean(req.item_id, 80)
    wanted_title = _clean(req.title, 500).lower()
    wanted_link = _clean(req.link, 2000)
    for item in payload.get("items") or []:
        if wanted_id and item.get("id") == wanted_id:
            return item
        if _clean(item.get("title"), 500).lower() == wanted_title and (
            not wanted_link or _clean(item.get("link"), 2000) == wanted_link
        ):
            return item
    raise HTTPException(409, "这条动态已经变化，请刷新客户动态后重新选择")


def _insert_opening(body: str, opening: str) -> str:
    body = str(body or "").strip()
    opening = str(opening or "").strip()
    if not body or not opening or opening.lower() in body.lower():
        return body
    lines = body.splitlines()
    if lines and re.match(r"^(dear|hi|hello)\b", lines[0].strip(), re.I):
        rest = "\n".join(lines[1:]).lstrip()
        return f"{lines[0].strip()}\n\n{opening}\n\n{rest}".strip()
    return f"{opening}\n\n{body}".strip()


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
            "lead_id": lead_id,
            "deal_id": deal_id,
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
        "lead_id": lead_id,
        "deal_id": deal_id,
        "checked_at": checked_at,
        "context": {"country": country, "product": product, "company": company},
        **payload,
    }


@app.get("/api/intel/status")
def intelligence_status():
    sources = _configured_rss_sources()
    return {
        "ok": True,
        "sources": {
            "全球新闻": "可用（Google News RSS）",
            "GNews": "已连接" if GNEWS_API_KEY else "可选，未连接",
            "现有在线搜索": "已连接" if SERPER_API_KEY else "可选，未连接",
            "行业 / 协会来源": len(sources),
            "官方 / 协会来源": sum(1 for x in sources if x.get("source_type") in {"official", "association"}),
        },
        "cache_hours": CACHE_HOURS,
        "chat_max_days": CHAT_MAX_DAYS,
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
        "lead_id": None,
        "deal_id": None,
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
    item = _verified_customer_item(db, lead, req)
    add_activity(
        db,
        lead.id,
        "customer_context_selected",
        "已选为本次沟通参考",
        item["title"],
        {
            "item_id": item["id"],
            "link": item.get("link", ""),
            "source": item.get("source", ""),
            "source_type": (item.get("source_profile") or {}).get("type", ""),
            "category": item.get("category", "general"),
            "freshness": item.get("freshness") or {},
            "suggestion_zh": (item.get("chat") or {}).get("zh", ""),
            "suggestion_en": (item.get("chat") or {}).get("en", ""),
            "source_checked": bool(req.source_checked),
        },
    )
    db.commit()
    return {"ok": True, "lead_id": lead.id, "item": item, "message": "已记入客户开发记录。发送前仍由你确认。"}


@app.post("/api/intel/customer/{lead_id}/apply-to-draft")
def apply_customer_context_to_draft(lead_id: int, req: ContextUseRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    if not lead.draft_body.strip():
        raise HTTPException(400, "请先生成开发信草稿，再把合适的客户动态带进去")
    item = _verified_customer_item(db, lead, req)
    freshness = item.get("freshness") or {}
    chat = item.get("chat") or {}
    opening = _clean(chat.get("en"), 1200)
    if not freshness.get("chat_allowed") or not opening:
        raise HTTPException(400, "这条动态不适合直接带入客户沟通，请只作为背景参考")
    if item.get("needs_source_check") and not req.source_checked:
        raise HTTPException(400, "这类政策或敏感信息请先打开原文核对日期和内容，再带入开发信")
    old_body = lead.draft_body
    new_body = _insert_opening(old_body, opening)
    if new_body != old_body:
        lead.draft_body = new_body
        lead.updated_at = datetime.now(timezone.utc)
        add_activity(
            db,
            lead.id,
            "draft_context_applied",
            "客户动态已带入开发信",
            item["title"],
            {
                "item_id": item["id"],
                "link": item.get("link", ""),
                "source": item.get("source", ""),
                "category": item.get("category", "general"),
                "opening": opening,
                "source_checked": bool(req.source_checked),
            },
        )
        add_activity(
            db,
            lead.id,
            "draft_rejected",
            "草稿内容已更新，需要重新确认",
            "已带入客户动态开场，请发送前重新确认整封邮件。",
            {"reason": "customer_context_applied"},
        )
        db.commit()
        db.refresh(lead)
    return {
        "ok": True,
        "lead_id": lead.id,
        "applied": new_body != old_body,
        "draft_subject": lead.draft_subject,
        "draft_body": lead.draft_body,
        "item": item,
        "message": "已带入开发信草稿，并取消旧的确认状态；请重新检查后再确认发送。",
    }
