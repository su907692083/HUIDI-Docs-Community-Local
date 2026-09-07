from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .business_center import OnlineDeal
from .community_sync import CommunityDealProductLink
from .main import get_db
from .online_app import app
from .product_memory import ProductBrainRecord


class DealProductSelectionRequest(BaseModel):
    product_ids: list[str] = Field(default_factory=list, max_length=100)


def _clean(value: Any, limit: int = 255) -> str:
    return str(value or "").strip()[:limit]


def _payload(row: ProductBrainRecord) -> dict[str, Any]:
    try:
        data = json.loads(row.payload_json or "{}")
    except Exception:
        data = {}
    return data if isinstance(data, dict) else {}


def _product_id(row: ProductBrainRecord) -> str:
    return _clean(row.local_product_id or row.brain_id, 160)


def _product_dict(row: ProductBrainRecord) -> dict[str, Any]:
    payload = _payload(row)
    return {
        "id": _product_id(row),
        "brain_id": row.brain_id,
        "name": row.name or _clean(payload.get("name"), 255),
        "sku": row.sku or _clean(payload.get("sku"), 160),
        "spec": _clean(payload.get("spec") or payload.get("specification"), 500),
        "unit": _clean(payload.get("unit"), 40),
    }


def _selected_rows(db: Session, deal_id: int) -> list[ProductBrainRecord]:
    links = db.scalars(
        select(CommunityDealProductLink)
        .where(CommunityDealProductLink.deal_id == deal_id)
        .order_by(CommunityDealProductLink.id.asc())
    ).all()
    if not links:
        return []
    by_brain = {
        row.brain_id: row
        for row in db.scalars(
            select(ProductBrainRecord).where(
                ProductBrainRecord.brain_id.in_([link.brain_id for link in links])
            )
        ).all()
    }
    return [by_brain[link.brain_id] for link in links if link.brain_id in by_brain]


def _selection_payload(
    db: Session,
    deal: OnlineDeal,
    *,
    q: str = "",
    limit: int = 60,
) -> dict[str, Any]:
    selected_rows = _selected_rows(db, deal.id)
    selected_brain_ids = {row.brain_id for row in selected_rows}

    stmt = select(ProductBrainRecord)
    term = _clean(q, 160)
    if term:
        like = f"%{term}%"
        stmt = stmt.where(
            or_(
                ProductBrainRecord.name.ilike(like),
                ProductBrainRecord.sku.ilike(like),
                ProductBrainRecord.brain_id.ilike(like),
                ProductBrainRecord.local_product_id.ilike(like),
            )
        )
    rows = db.scalars(
        stmt.order_by(ProductBrainRecord.updated_at.desc(), ProductBrainRecord.brain_id.asc()).limit(limit)
    ).all()

    items: list[ProductBrainRecord] = []
    seen: set[str] = set()
    for row in [*selected_rows, *rows]:
        if row.brain_id in seen:
            continue
        seen.add(row.brain_id)
        items.append(row)

    return {
        "deal_id": deal.id,
        "selected": [_product_id(row) for row in selected_rows],
        "items": [_product_dict(row) for row in items],
        "product_keyword": deal.product_keyword,
        "selected_count": len(selected_brain_ids),
        "note": "这里只维护现有 Deal 与 Product Brain 的关联；产品参考价不会写入询盘金额或正式单据价格。",
    }


def _resolve_requested_products(
    db: Session,
    product_ids: list[str],
) -> tuple[list[ProductBrainRecord], list[str]]:
    resolved: list[ProductBrainRecord] = []
    missing: list[str] = []
    seen_brain: set[str] = set()
    for raw in dict.fromkeys(_clean(value, 160) for value in product_ids if _clean(value, 160)):
        row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.local_product_id == raw))
        if not row:
            row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == raw))
        if not row:
            missing.append(raw)
            continue
        if row.brain_id in seen_brain:
            continue
        seen_brain.add(row.brain_id)
        resolved.append(row)
    return resolved, missing


@app.get("/api/business/deals/{deal_id}/products")
def get_deal_products(
    deal_id: int,
    q: str = "",
    limit: int = Query(default=60, ge=10, le=100),
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔询盘")
    return _selection_payload(db, deal, q=q, limit=limit)


@app.put("/api/business/deals/{deal_id}/products")
def set_deal_products(
    deal_id: int,
    req: DealProductSelectionRequest,
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔询盘")

    selected_rows, missing = _resolve_requested_products(db, req.product_ids)
    if missing:
        raise HTTPException(400, f"有产品已不存在，请刷新后重试：{', '.join(missing[:5])}")

    desired = {row.brain_id: row for row in selected_rows}
    existing_links = db.scalars(
        select(CommunityDealProductLink).where(CommunityDealProductLink.deal_id == deal.id)
    ).all()
    existing = {link.brain_id: link for link in existing_links}

    for brain_id, link in existing.items():
        if brain_id not in desired:
            db.delete(link)
    for row in selected_rows:
        if row.brain_id not in existing:
            db.add(
                CommunityDealProductLink(
                    deal_id=deal.id,
                    brain_id=row.brain_id,
                    created_at=datetime.now(timezone.utc),
                )
            )

    if selected_rows:
        deal.product_keyword = _clean(selected_rows[0].name or deal.product_keyword, 255)
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(deal)
    return {"ok": True, **_selection_payload(db, deal, limit=60)}
