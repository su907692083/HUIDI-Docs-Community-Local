from __future__ import annotations

import json
import re
from typing import Any

from fastapi import Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal
from .intelligence_records import OnlineIntelligenceRecord, intelligence_dict
from .main import Lead, get_db
from .online_app import app
from .product_memory import ProductBrainRecord, _row_payload


SOURCE_LABELS = {
    "product": "产品资料",
    "lead": "潜在客户",
    "customer": "正式客户",
    "deal": "询盘",
    "intelligence": "联网情报",
}
SOURCE_WEIGHTS = {"customer": 4, "deal": 4, "product": 3, "lead": 2, "intelligence": 1}
_PRICE_WITH_CURRENCY = re.compile(
    r"(?i)(?:\b\d+(?:[.,]\d+)?\s*(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD)\b|(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD)\s*\d+(?:[.,]\d+)?|[$€£¥]\s*\d+(?:[.,]\d+)?)"
)
_PRICE_SEGMENT = re.compile(
    r"(?i)(?:unit\s*price|reference\s*price|price\s*range|quotation|quote\s*price|价格|单价|参考价|报价)[^·。;；\n]{0,90}"
)


def _clean(value: Any, limit: int = 2000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _strip_price_text(value: Any, limit: int = 520) -> str:
    text = _clean(value, max(limit * 2, 800))
    text = _PRICE_SEGMENT.sub("[价格已隔离]", text)
    text = _PRICE_WITH_CURRENCY.sub("[价格已隔离]", text)
    text = re.sub(r"(?:\[价格已隔离\]\s*[·,，;；]?\s*){2,}", "[价格已隔离] · ", text)
    return _clean(text, limit)


def _tokens(query: str) -> list[str]:
    rows = [x.lower() for x in re.split(r"[\s,，;；/|]+", _clean(query, 240)) if len(x.strip()) >= 2]
    return list(dict.fromkeys(rows))[:6]


def _snippet(parts: list[Any], limit: int = 460) -> str:
    return _strip_price_text(" · ".join(_clean(x, 180) for x in parts if _clean(x, 180)), limit)


def _product_snippet(row: ProductBrainRecord) -> str:
    payload = _row_payload(row)
    # Knowledge reuse follows the same formal-price guard as development/document
    # flows. Reference/product prices are intentionally excluded from AI context.
    safe = [
        payload.get("sku"), payload.get("category"), payload.get("series"), payload.get("spec"),
        f"MOQ {payload.get('moq')}" if payload.get("moq") else "",
        f"交期 {payload.get('lead_time')}" if payload.get("lead_time") else "",
        payload.get("package_type"), payload.get("hs_code"),
    ]
    for key in ("certifications", "differentiators", "allowed_claims"):
        value = payload.get(key)
        if isinstance(value, list):
            safe.extend(value[:4])
    return _snippet(safe)


def _score(item: dict[str, Any], query: str, tokens: list[str]) -> int:
    title = _clean(item.get("title"), 800).lower()
    snippet = _clean(item.get("snippet"), 1600).lower()
    q = query.lower()
    score = 0
    if q and q in title:
        score += 10
    elif q and q in snippet:
        score += 5
    for token in tokens:
        if token in title:
            score += 4
        elif token in snippet:
            score += 2
    score += SOURCE_WEIGHTS.get(str(item.get("source") or ""), 0)
    return score


def _match_reasons(item: dict[str, Any], query: str, tokens: list[str]) -> list[str]:
    """Explain deterministic lexical ranking without exposing hidden model logic."""
    title = _clean(item.get("title"), 800).lower()
    snippet = _clean(item.get("snippet"), 1600).lower()
    q = query.lower()
    reasons: list[str] = []
    if q and q in title:
        reasons.append("完整查询命中标题")
    elif q and q in snippet:
        reasons.append("完整查询命中内容")
    title_terms = [x for x in tokens if x in title]
    body_terms = [x for x in tokens if x not in title_terms and x in snippet]
    if title_terms:
        reasons.append("标题词：" + "、".join(title_terms[:3]))
    if body_terms:
        reasons.append("内容词：" + "、".join(body_terms[:3]))
    source = str(item.get("source") or "")
    if SOURCE_WEIGHTS.get(source, 0) >= 4:
        reasons.append("正式业务记录优先")
    elif source == "product":
        reasons.append("正式产品资料优先")
    return reasons[:3] or ["已有业务字段命中"]


def _result(source: str, record_id: Any, title: Any, snippet: Any, *, updated_at: Any = None, route: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "source": source,
        "source_label": SOURCE_LABELS[source],
        "record_id": str(record_id or ""),
        "citation": f"{SOURCE_LABELS[source]} #{record_id}",
        "title": _clean(title, 300),
        "snippet": _strip_price_text(snippet, 520),
        "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else _clean(updated_at, 80),
        "route": route or {},
    }


def _patterns(query: str, tokens: list[str]) -> list[str]:
    values = [_clean(query, 180), *tokens]
    return [f"%{x}%" for x in dict.fromkeys(x for x in values if x)][:7]


def _count_sources(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        key = str(item.get("source") or "")
        if key:
            counts[key] = counts.get(key, 0) + 1
    return counts


@app.get("/api/knowledge/search")
def search_business_knowledge(
    q: str = Query(min_length=2, max_length=240),
    limit: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Read-only retrieval over existing authoritative HUIDI business owners.

    This is the retrieval/citation layer used before any future AI answer. It has
    no knowledge table, embeddings, external network calls or write path. Formal
    and reference price fragments are deliberately excluded from reusable context,
    including price-like text embedded in notes or inquiry requirements.

    Retrieval diagnostics expose only deterministic field-weighted lexical ranking
    facts: matched terms, source coverage and bounded candidate counts. There is no
    hidden vector score or background provider request behind these explanations.
    """
    query = _clean(q, 240)
    tokens = _tokens(query)
    patterns = _patterns(query, tokens)
    per_source = min(max(limit, 5), 20)
    items: list[dict[str, Any]] = []

    product_conditions = []
    for pattern in patterns:
        product_conditions.extend([
            ProductBrainRecord.name.ilike(pattern), ProductBrainRecord.sku.ilike(pattern),
            ProductBrainRecord.local_product_id.ilike(pattern), ProductBrainRecord.payload_json.ilike(pattern),
        ])
    products = db.scalars(
        select(ProductBrainRecord).where(or_(*product_conditions))
        .order_by(ProductBrainRecord.updated_at.desc(), ProductBrainRecord.id.desc()).limit(per_source)
    ).all()
    for row in products:
        items.append(_result("product", row.brain_id, row.name or row.sku, _product_snippet(row), updated_at=row.updated_at, route={"kind": "product", "id": row.brain_id}))

    lead_conditions = []
    for pattern in patterns:
        lead_conditions.extend([
            Lead.company_name.ilike(pattern), Lead.domain.ilike(pattern), Lead.country.ilike(pattern),
            Lead.market_keyword.ilike(pattern), Lead.buyer_type.ilike(pattern), Lead.reason.ilike(pattern),
            Lead.contact_name.ilike(pattern), Lead.contact_email.ilike(pattern),
        ])
    leads = db.scalars(
        select(Lead).where(or_(*lead_conditions)).order_by(Lead.updated_at.desc(), Lead.id.desc()).limit(per_source)
    ).all()
    for row in leads:
        priority = "A" if row.score >= 78 else "B" if row.score >= 62 else "C" if row.score >= 46 else "D"
        items.append(_result(
            "lead", row.id, row.company_name,
            _snippet([row.country, row.market_keyword, row.buyer_type, f"{priority}级 {round(row.score)}分", row.reason, row.contact_name, row.contact_email]),
            updated_at=row.updated_at, route={"kind": "lead", "id": row.id},
        ))

    customer_conditions = []
    for pattern in patterns:
        customer_conditions.extend([
            OnlineCustomer.company_name.ilike(pattern), OnlineCustomer.contact_name.ilike(pattern),
            OnlineCustomer.email.ilike(pattern), OnlineCustomer.country.ilike(pattern),
            OnlineCustomer.website.ilike(pattern), OnlineCustomer.notes.ilike(pattern),
        ])
    customers = db.scalars(
        select(OnlineCustomer).where(or_(*customer_conditions))
        .order_by(OnlineCustomer.updated_at.desc(), OnlineCustomer.id.desc()).limit(per_source)
    ).all()
    for row in customers:
        items.append(_result(
            "customer", row.id, row.company_name,
            _snippet([row.contact_name, row.email, row.country, row.website, row.status, row.notes]),
            updated_at=row.updated_at,
            route={"kind": "customer", "id": row.id, "source_lead_id": row.source_lead_id},
        ))

    deal_conditions = []
    for pattern in patterns:
        deal_conditions.extend([
            OnlineDeal.title.ilike(pattern), OnlineDeal.product_keyword.ilike(pattern),
            OnlineDeal.requirements.ilike(pattern), OnlineDeal.next_action.ilike(pattern),
        ])
    deals = db.scalars(
        select(OnlineDeal).where(or_(*deal_conditions))
        .order_by(OnlineDeal.updated_at.desc(), OnlineDeal.id.desc()).limit(per_source)
    ).all()
    for row in deals:
        items.append(_result(
            "deal", row.id, row.title,
            _snippet([row.stage, row.product_keyword, row.requirements, row.next_action, row.next_action_at]),
            updated_at=row.updated_at,
            route={"kind": "deal", "id": row.id, "source_lead_id": row.source_lead_id},
        ))

    intelligence_conditions = []
    for pattern in patterns:
        intelligence_conditions.extend([
            OnlineIntelligenceRecord.title.ilike(pattern), OnlineIntelligenceRecord.kind.ilike(pattern),
            OnlineIntelligenceRecord.query_json.ilike(pattern),
        ])
    intelligence = db.scalars(
        select(OnlineIntelligenceRecord).where(or_(*intelligence_conditions))
        .order_by(OnlineIntelligenceRecord.checked_at.desc(), OnlineIntelligenceRecord.id.desc()).limit(per_source)
    ).all()
    for row in intelligence:
        data = intelligence_dict(row, db)
        normalized = data.get("normalized") or {}
        context = normalized.get("context") or {}
        safe_context = {k: v for k, v in context.items() if k not in {"amount"}}
        items.append(_result(
            "intelligence", row.id, row.title or row.kind,
            _snippet([row.kind, normalized.get("summary"), json.dumps(safe_context, ensure_ascii=False)]),
            updated_at=row.checked_at,
            route={"kind": "intelligence", "id": row.id, "lead_id": row.lead_id, "deal_id": row.deal_id},
        ))

    candidate_count = len(items)
    candidate_counts = _count_sources(items)
    for item in items:
        item["relevance"] = _score(item, query, tokens)
        item["match_reasons"] = _match_reasons(item, query, tokens)
    items.sort(key=lambda x: (int(x.get("relevance") or 0), x.get("updated_at") or ""), reverse=True)
    items = items[:limit]
    counts = _count_sources(items)
    missing_sources = [key for key in SOURCE_LABELS if not counts.get(key)]
    return {
        "ok": True,
        "mode": "authoritative_lexical",
        "network_requests": 0,
        "query": query,
        "items": items,
        "source_counts": counts,
        "diagnostics": {
            "strategy": "field_weighted_lexical_rerank_v1",
            "candidate_count": candidate_count,
            "returned_count": len(items),
            "query_terms": tokens,
            "candidate_source_counts": candidate_counts,
            "returned_source_counts": counts,
            "missing_sources": missing_sources,
            "source_labels": SOURCE_LABELS,
            "bounded_per_source": per_source,
            "explainable": True,
            "vector_search": False,
            "message": "结果只按当前工作区已有字段做确定性相关度排序；每条展示命中理由，未命中的 Owner 会明确列出。",
        },
        "guardrails": {
            "read_only": True,
            "citations_required": True,
            "formal_price_excluded": True,
            "external_network": False,
        },
        "message": "只检索当前工作区已有的权威业务记录；没有命中时返回空结果，不编造答案。",
    }
