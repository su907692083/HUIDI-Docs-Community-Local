from __future__ import annotations

from typing import Any

from fastapi import Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal
from .customer_intelligence import _decorate_cached
from .intelligence_records import OnlineIntelligenceRecord
from .main import Lead, get_db, safe_json
from .online_app import app


ACTIVE_LEAD_STATES = {"new", "qualified", "contacted", "replied", "converted"}
ACTIVE_DEAL_STATES = {"new_inquiry", "qualified", "quoting", "negotiating", "confirmed", "production", "shipping"}


def _context_for_record(db: Session, row: OnlineIntelligenceRecord) -> tuple[Lead | None, OnlineDeal | None, str, str, str]:
    deal = db.get(OnlineDeal, row.deal_id) if row.deal_id else None
    lead_id = row.lead_id or (deal.source_lead_id if deal else None)
    lead = db.get(Lead, lead_id) if lead_id else None
    customer = db.get(OnlineCustomer, deal.customer_id) if deal else None
    query = safe_json(row.query_json, {})
    country = str(query.get("country") or (customer.country if customer else "") or (lead.country if lead else "")).strip()
    product = str(query.get("product") or query.get("keyword") or (deal.product_keyword if deal else "") or (lead.market_keyword if lead else "")).strip()
    company = str(query.get("company") or (customer.company_name if customer else "") or (lead.company_name if lead else "") or (deal.title if deal else "")).strip()
    return lead, deal, country, product, company


def _safe_chat_item(items: list[dict[str, Any]]) -> dict[str, Any] | None:
    for item in items:
        freshness = item.get("freshness") or {}
        chat = item.get("chat") or {}
        if freshness.get("chat_allowed") and str(chat.get("en") or "").strip() and chat.get("level") != "谨慎":
            return item
    return None


def _watch_item(items: list[dict[str, Any]], safe_id: str = "") -> dict[str, Any] | None:
    watch_categories = {"policy", "shipping", "geopolitics", "weather"}
    for item in items:
        if item.get("id") == safe_id or item.get("category") not in watch_categories:
            continue
        freshness = item.get("freshness") or {}
        if freshness.get("status") not in {"fresh", "aging"}:
            continue
        if int(item.get("relevance") or 0) < 38:
            continue
        return item
    return None


def _action_row(kind: str, row: OnlineIntelligenceRecord, lead: Lead | None, deal: OnlineDeal | None, item: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": kind,
        "label": "可以自然聊" if kind == "chat" else "值得留意",
        "lead_id": lead.id if lead else row.lead_id,
        "deal_id": deal.id if deal else row.deal_id,
        "company_name": lead.company_name if lead else "",
        "deal_title": deal.title if deal else "",
        "record_id": row.id,
        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
        "item": item,
    }


@app.get("/api/intel/today-actions")
def today_intelligence_actions(
    limit: int = Query(default=4, ge=1, le=8),
    db: Session = Depends(get_db),
):
    """Return actionable cached intelligence without making any external request.

    Home should stay fast even with many customers. This endpoint only reuses the
    most recent intelligence already collected while a customer or inquiry was
    being worked on. Opening a customer/inquiry remains the place that can refresh
    external sources explicitly.
    """
    records = db.scalars(
        select(OnlineIntelligenceRecord)
        .where(OnlineIntelligenceRecord.kind == "market_news")
        .order_by(OnlineIntelligenceRecord.checked_at.desc(), OnlineIntelligenceRecord.id.desc())
        .limit(180)
    ).all()

    latest: list[tuple[OnlineIntelligenceRecord, Lead | None, OnlineDeal | None, str, str, str]] = []
    seen_owner: set[str] = set()
    for row in records:
        lead, deal, country, product, company = _context_for_record(db, row)
        if deal and deal.stage not in ACTIVE_DEAL_STATES:
            continue
        if lead and lead.status not in ACTIVE_LEAD_STATES:
            continue
        owner_key = f"deal:{deal.id}" if deal else f"lead:{lead.id if lead else row.lead_id}"
        if owner_key in seen_owner:
            continue
        seen_owner.add(owner_key)
        latest.append((row, lead, deal, country, product, company))
        if len(latest) >= 40:
            break

    actions: list[dict[str, Any]] = []
    used_items: set[str] = set()
    for row, lead, deal, country, product, company in latest:
        payload = _decorate_cached(
            safe_json(row.result_json, {}),
            country=country,
            product=product,
            company=company,
        )
        items = payload.get("items") or []
        safe = _safe_chat_item(items)
        if safe and safe.get("id") not in used_items:
            actions.append(_action_row("chat", row, lead, deal, safe))
            used_items.add(str(safe.get("id") or ""))
        watch = _watch_item(items, str(safe.get("id") or "") if safe else "")
        if watch and watch.get("id") not in used_items:
            actions.append(_action_row("watch", row, lead, deal, watch))
            used_items.add(str(watch.get("id") or ""))
        if len(actions) >= limit * 2:
            break

    actions.sort(
        key=lambda x: (
            1 if x["kind"] == "chat" else 0,
            int((x.get("item") or {}).get("relevance") or 0),
        ),
        reverse=True,
    )
    actions = actions[:limit]
    return {
        "ok": True,
        "mode": "cached_only",
        "network_requests": 0,
        "items": actions,
        "message": "这里只复用已经查过的客户 / 询盘动态，不会因为打开首页而批量请求外部新闻。",
    }
