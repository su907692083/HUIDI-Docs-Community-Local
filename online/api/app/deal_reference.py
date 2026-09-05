from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .business_center import OnlineDeal
from .intelligence_records import OnlineIntelligenceRecord, intelligence_dict
from .main import get_db
from .online_app import app


KIND_NAMES = {
    "company": "企业核验",
    "trade": "贸易记录",
    "market_news": "市场情报",
    "tariff": "HS / 关税",
    "fx": "汇率",
    "shipping": "船期 / 物流",
}

DOC_NEEDS = {
    "quotation": ["company", "tariff", "fx"],
    "proforma_invoice": ["company", "trade", "tariff"],
    "sales_contract": ["company", "trade", "tariff"],
    "commercial_invoice": ["tariff", "shipping"],
    "packing_list": ["shipping"],
}


def _reference_rows(db: Session, deal: OnlineDeal) -> list[OnlineIntelligenceRecord]:
    conditions = [OnlineIntelligenceRecord.deal_id == deal.id]
    if deal.source_lead_id:
        conditions.append(OnlineIntelligenceRecord.lead_id == deal.source_lead_id)
    return db.scalars(
        select(OnlineIntelligenceRecord)
        .where(or_(*conditions))
        .order_by(OnlineIntelligenceRecord.checked_at.desc(), OnlineIntelligenceRecord.id.desc())
        .limit(200)
    ).all()


def build_deal_reference(db: Session, deal: OnlineDeal, document: str = "") -> dict[str, Any]:
    rows = _reference_rows(db, deal)
    latest: dict[str, OnlineIntelligenceRecord] = {}
    counts: dict[str, int] = {}
    for row in rows:
        latest.setdefault(row.kind, row)
        counts[row.kind] = counts.get(row.kind, 0) + 1

    references = []
    for kind in KIND_NAMES:
        row = latest.get(kind)
        if not row:
            continue
        payload = intelligence_dict(row)
        references.append(
            {
                "kind": kind,
                "name": KIND_NAMES[kind],
                "title": row.title,
                "checked_at": payload.get("checked_at"),
                "record_id": row.id,
                "count": counts.get(kind, 0),
            }
        )

    needed = DOC_NEEDS.get(document, [])
    if not needed:
        needed = ["company", "trade"]
        if deal.stage in {"quoting", "negotiating", "confirmed"}:
            needed += ["tariff", "fx"]
        if deal.stage in {"production", "shipping"}:
            needed += ["shipping"]

    missing = []
    for kind in dict.fromkeys(needed):
        if kind not in latest:
            missing.append({"kind": kind, "name": KIND_NAMES.get(kind, kind)})

    suggestions = []
    if "company" not in latest:
        suggestions.append("客户企业核验还没有补充，重要报价或合同前建议先核对。")
    if "trade" not in latest and document in {"proforma_invoice", "sales_contract"}:
        suggestions.append("还没有贸易记录参考，签订 PI / 合同前可根据需要补充。")
    if "tariff" not in latest and (document == "quotation" or deal.stage in {"quoting", "negotiating", "confirmed"}):
        suggestions.append("报价阶段还没有最新关税参考，涉及到岸成本时建议补充。")
    if "shipping" not in latest and (document in {"commercial_invoice", "packing_list"} or deal.stage in {"production", "shipping"}):
        suggestions.append("出运阶段还没有船期 / 物流参考，准备 CI 或装箱单时建议补充。")

    return {
        "deal_id": deal.id,
        "source_lead_id": deal.source_lead_id,
        "document": document,
        "counts": counts,
        "references": references,
        "missing": missing,
        "suggestions": suggestions,
        "has_reference": bool(references),
        "note": "这里展示的是联网业务参考，不会自动改写正式产品资料、报价或合同。",
    }


@app.get("/api/business/deals/{deal_id}/reference")
def deal_reference(
    deal_id: int,
    document: str = Query(default="", max_length=60),
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    return build_deal_reference(db, deal, document.strip())
