from __future__ import annotations

import json
from collections import Counter
from typing import Any

from sqlalchemy import select

from .main import Lead, SessionLocal
from .online_app import app


SCHEMA = "huidi.acquisition.memory/v1"
MAX_HISTORY = 300
MAX_RECENT = 8
MAX_COMMON = 10
_REAL_PROVIDERS = {"serper", "tavily"}


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _real_acquisition_evidence(lead: Lead) -> bool:
    try:
        evidence = json.loads(lead.evidence_json or "[]")
    except (TypeError, ValueError, json.JSONDecodeError):
        return False
    if not isinstance(evidence, list):
        return False
    for item in evidence:
        if not isinstance(item, dict):
            continue
        source = _clean(item.get("source")).lower()
        provider = _clean(item.get("provider")).lower()
        if source == "online_company_search" and provider in _REAL_PROVIDERS:
            return True
    return False


def _memory_payload(rows: list[Lead]) -> dict[str, Any]:
    combo_counts: Counter[tuple[str, str, str]] = Counter()
    keyword_counts: Counter[str] = Counter()
    market_counts: Counter[str] = Counter()
    keyword_labels: dict[str, str] = {}
    market_labels: dict[str, str] = {}
    combo_labels: dict[tuple[str, str, str], tuple[str, str, str]] = {}
    recent: list[dict[str, Any]] = []
    recent_seen: set[tuple[str, str, str]] = set()

    for lead in rows:
        if not _real_acquisition_evidence(lead):
            continue
        keyword = _clean(lead.market_keyword)
        if not keyword:
            continue
        country = _clean(lead.country)
        buyer_type = _clean(lead.buyer_type)
        key = (keyword.casefold(), country.casefold(), buyer_type.casefold())
        combo_counts[key] += 1
        combo_labels.setdefault(key, (keyword, country, buyer_type))

        keyword_key = keyword.casefold()
        keyword_counts[keyword_key] += 1
        keyword_labels.setdefault(keyword_key, keyword)
        if country:
            market_key = country.casefold()
            market_counts[market_key] += 1
            market_labels.setdefault(market_key, country)

        if key not in recent_seen and len(recent) < MAX_RECENT:
            recent_seen.add(key)
            recent.append(
                {
                    "product_keyword": keyword,
                    "country": country,
                    "buyer_type": buyer_type,
                    "hits": 0,
                    "lead_id": lead.id,
                    "last_seen": lead.created_at.isoformat() if lead.created_at else None,
                }
            )

    for row in recent:
        key = (
            _clean(row["product_keyword"]).casefold(),
            _clean(row["country"]).casefold(),
            _clean(row["buyer_type"]).casefold(),
        )
        row["hits"] = combo_counts.get(key, 0)

    common_keywords = [
        {"value": keyword_labels[key], "count": count}
        for key, count in keyword_counts.most_common(MAX_COMMON)
    ]
    common_markets = [
        {"value": market_labels[key], "count": count}
        for key, count in market_counts.most_common(MAX_COMMON)
    ]
    return {
        "ok": True,
        "schema": SCHEMA,
        "source": "persisted_real_acquisition_history",
        "history_lead_count": sum(combo_counts.values()),
        "last_successful": recent[0] if recent else None,
        "recent_combinations": recent,
        "common_keywords": common_keywords,
        "common_markets": common_markets,
    }


@app.get("/api/acquisition/memory")
def acquisition_memory():
    """Project tenant-scoped, real acquisition history into reusable search hints.

    This is deliberately read-only: no preference table, provider secret, second
    Lead owner, automatic search, or automatic outreach is introduced.
    """
    with SessionLocal() as db:
        rows = db.scalars(
            select(Lead)
            .order_by(Lead.created_at.desc(), Lead.id.desc())
            .limit(MAX_HISTORY)
        ).all()
        return _memory_payload(list(rows))
