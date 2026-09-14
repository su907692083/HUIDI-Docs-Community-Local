from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse


BUYER_WORDS = {
    "buyer",
    "importer",
    "distributor",
    "wholesaler",
    "dealer",
    "retailer",
    "procurement",
    "purchasing",
    "sourcing",
    "contractor",
    "project",
}

PURCHASE_SIGNAL_PHRASES = (
    "looking for",
    "buying",
    "buy ",
    "purchase",
    "procurement",
    "purchasing",
    "sourcing",
    "request for quotation",
    "rfq",
    "import",
    "distribut",
    "wholesale",
)

SUPPLY_SIDE_PHRASES = (
    "manufacturer",
    "factory",
    "we manufacture",
    "leading supplier",
    "exporter",
    "made in china",
)

DIRECTORY_HOSTS = (
    "alibaba.com",
    "made-in-china.com",
    "globalsources.com",
    "yellowpages",
    "yelp.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "wikipedia.org",
)


def clean_domain(url: str) -> str:
    try:
        value = url if "://" in url else "https://" + url
        host = urlparse(value).netloc.lower().split(":")[0].strip(".")
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _tokens(value: str, min_len: int = 3) -> list[str]:
    return [x for x in re.split(r"[^a-z0-9]+", (value or "").lower()) if len(x) >= min_len]


def _contains_any(text: str, values: tuple[str, ...] | set[str]) -> bool:
    return any(value in text for value in values)


def score_search_result(
    item: dict[str, Any],
    *,
    product_keyword: str,
    buyer_type: str,
    country: str,
) -> tuple[float, str, dict[str, float], str]:
    """Score one public search result without pretending the score is ground truth.

    The score is a prioritisation signal only. Every component is returned so the UI
    can explain why a company was ranked higher or lower.
    """

    title = str(item.get("title") or "")
    snippet = str(item.get("snippet") or "")
    link = str(item.get("link") or "")
    domain = clean_domain(link)
    text = f"{title} {snippet}".lower()

    product_tokens = _tokens(product_keyword)
    buyer_tokens = set(_tokens(buyer_type, 4)) | BUYER_WORDS

    product_matches = sum(1 for token in set(product_tokens) if token in text)
    product_score = min(25.0, product_matches * 6.0)
    if product_keyword and product_keyword.lower() in text:
        product_score = min(25.0, product_score + 8.0)

    buyer_score = 0.0
    buyer_hits = [token for token in buyer_tokens if token in text]
    if buyer_hits:
        buyer_score = min(22.0, 12.0 + 3.0 * len(set(buyer_hits)))

    market_score = 0.0
    if country and country.lower() in text:
        market_score = 10.0

    purchase_score = 0.0
    purchase_hits = [phrase for phrase in PURCHASE_SIGNAL_PHRASES if phrase in text]
    if purchase_hits:
        purchase_score = min(18.0, 8.0 + 3.0 * len(set(purchase_hits)))

    independent_site_score = 0.0
    if domain:
        independent_site_score = 10.0
        if any(host in domain for host in DIRECTORY_HOSTS):
            independent_site_score = 0.0

    contactability_score = 0.0
    if "@" in text:
        contactability_score += 3.0
    if any(token in text for token in ("contact", "whatsapp", "phone", "email")):
        contactability_score += 2.0
    contactability_score = min(5.0, contactability_score)

    business_context_score = 0.0
    if any(token in text for token in ("company", "group", "corp", "ltd", "llc", "inc", "trading")):
        business_context_score = 10.0

    penalty = 0.0
    if _contains_any(text, SUPPLY_SIDE_PHRASES) and not _contains_any(text, ("importer", "distributor", "dealer", "wholesaler")):
        penalty -= 12.0
    if domain and any(host in domain for host in DIRECTORY_HOSTS):
        penalty -= 18.0

    breakdown = {
        "product_match": round(product_score, 1),
        "buyer_fit": round(buyer_score, 1),
        "market_fit": round(market_score, 1),
        "purchase_signal": round(purchase_score, 1),
        "independent_site": round(independent_site_score, 1),
        "contactability": round(contactability_score, 1),
        "business_context": round(business_context_score, 1),
        "penalty": round(penalty, 1),
    }
    score = max(0.0, min(100.0, sum(breakdown.values())))

    reason_parts: list[str] = []
    if product_score >= 12:
        reason_parts.append("产品匹配")
    if buyer_score >= 12:
        reason_parts.append("买家角色信号")
    if purchase_score >= 8:
        reason_parts.append("采购/进口信号")
    if market_score:
        reason_parts.append("目标市场匹配")
    if independent_site_score:
        reason_parts.append("独立官网")
    if penalty < 0:
        reason_parts.append("存在供应端/目录站信号")

    if score >= 78:
        level = "A"
    elif score >= 62:
        level = "B"
    elif score >= 46:
        level = "C"
    else:
        level = "D"

    reason = " · ".join(reason_parts) if reason_parts else "公开搜索结果待进一步核实"
    return round(score, 1), reason, breakdown, level


def merge_evidence(existing_json: str, rows: list[dict[str, Any]], max_items: int = 30) -> str:
    try:
        existing = json.loads(existing_json or "[]")
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in [*existing, *rows]:
        url = str(row.get("url") or row.get("link") or "").strip()
        title = str(row.get("title") or "").strip()
        key = url or title
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(
            {
                "title": title,
                "url": url,
                "snippet": str(row.get("snippet") or "").strip(),
                "source": str(row.get("source") or "search"),
            }
        )
    return json.dumps(merged[-max_items:], ensure_ascii=False)
