from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, or_, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .business_center import OnlineDeal, business_bundle
from .intelligence_records import OnlineIntelligenceRecord, intelligence_dict
from .main import Base, engine, get_db
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

ALLOWED_DOCS = set(DOC_NEEDS)
DEAL_FACT_SCHEMA = "huidi.deal.intelligence/v1"


class DealReferenceApproval(Base):
    __tablename__ = "deal_reference_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("online_deals.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(80), index=True)
    reference_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    approved_by: Mapped[str] = mapped_column(String(160), default="")
    approved_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )


Base.metadata.create_all(engine)


class DocumentHandoffRequest(BaseModel):
    document: str = Field(pattern="^(quotation|proforma_invoice|sales_contract|commercial_invoice|packing_list)$")
    confirm_reference: bool = False


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
        payload = intelligence_dict(row, db)
        normalized = payload.get("normalized") if isinstance(payload.get("normalized"), dict) else {}
        references.append(
            {
                "kind": kind,
                "name": KIND_NAMES[kind],
                "title": row.title,
                "checked_at": payload.get("checked_at"),
                "record_id": row.id,
                "count": counts.get(kind, 0),
                "summary": str(normalized.get("summary") or ""),
                "facts": normalized.get("facts") if isinstance(normalized.get("facts"), dict) else {},
                "context": normalized.get("context") if isinstance(normalized.get("context"), dict) else {},
                "has_business_facts": bool(normalized.get("has_business_facts")),
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
        "note": "联网资料只作为业务参考。只有你明确确认后才会带到单据参考区，也不会自动改写正式产品资料、价格、合同或装箱数据。",
    }


def build_deal_facts(db: Session, deal: OnlineDeal, document: str = "") -> dict[str, Any]:
    reference = build_deal_reference(db, deal, document)
    facts_by_kind = {
        str(item.get("kind")): item.get("facts") or {}
        for item in reference.get("references", [])
        if isinstance(item, dict) and item.get("kind")
    }
    company = facts_by_kind.get("company", {})
    tariff = facts_by_kind.get("tariff", {})
    fx = facts_by_kind.get("fx", {})
    shipping = facts_by_kind.get("shipping", {})
    trade = facts_by_kind.get("trade", {})
    return {
        "schema": DEAL_FACT_SCHEMA,
        "deal_id": deal.id,
        "document": document,
        "company": {
            key: company[key]
            for key in ("legal_name", "registration_number", "status", "country", "address", "website", "credit_or_risk")
            if key in company
        },
        "pricing_reference": {
            "hs_code": tariff.get("hs_code"),
            "origin": tariff.get("origin"),
            "destination": tariff.get("destination"),
            "import_duty_rate": tariff.get("import_duty_rate"),
            "vat_rate": tariff.get("vat_rate"),
            "other_tax_rate": tariff.get("other_tax_rate"),
            "fx_base": fx.get("base"),
            "fx_quote": fx.get("quote"),
            "fx_rate": fx.get("rate"),
            "fx_date": fx.get("date"),
        },
        "trade_reference": trade,
        "shipping_reference": shipping,
        "missing": reference.get("missing", []),
        "suggestions": reference.get("suggestions", []),
        "reference_ids": [
            int(item["record_id"])
            for item in reference.get("references", [])
            if item.get("record_id")
        ],
        "note": "这些字段来自已保存的联网结果，只用于核对和决策，不会自动写入报价金额、合同条款、产品资料或装箱数据。",
    }


def _approved_by(request: Request | None) -> str:
    if request is None:
        return "单人使用"
    member = getattr(request.state, "team_member", None)
    if isinstance(member, dict) and member:
        return str(member.get("display_name") or member.get("email") or "团队成员")[:160]
    return "单人使用"


def build_document_handoff(
    db: Session,
    deal: OnlineDeal,
    document: str,
    confirm_reference: bool,
    approved_by: str = "单人使用",
) -> dict[str, Any]:
    if document not in ALLOWED_DOCS:
        raise HTTPException(400, "不支持这个单据类型")
    bundle = business_bundle(deal.id, document, db)
    reference = build_deal_reference(db, deal, document)
    facts = build_deal_facts(db, deal, document)
    out: dict[str, Any] = {
        "bundle": bundle,
        "reference_available": bool(reference.get("has_reference")),
        "reference_included": False,
        "reference": reference,
        "facts": facts,
    }
    if not confirm_reference or not reference.get("has_reference"):
        return out

    ids = [int(item.get("record_id")) for item in reference.get("references", []) if item.get("record_id")]
    approval = DealReferenceApproval(
        deal_id=deal.id,
        document_type=document,
        reference_ids_json=json.dumps(ids, ensure_ascii=False),
        approved_by=approved_by[:160],
        approved_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    confirmed_reference = {
        **reference,
        "confirmation": {
            "id": approval.id,
            "approved_by": approval.approved_by,
            "approved_at": approval.approved_at.isoformat() if approval.approved_at else None,
            "document": document,
        },
    }
    out["bundle"] = {
        **bundle,
        "online_business_reference": confirmed_reference,
        "online_business_facts": facts,
        "reference_confirmation": confirmed_reference["confirmation"],
    }
    out["reference_included"] = True
    out["reference"] = confirmed_reference
    return out


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


@app.get("/api/business/deals/{deal_id}/facts")
def deal_facts(
    deal_id: int,
    document: str = Query(default="", max_length=60),
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    return build_deal_facts(db, deal, document.strip())


@app.post("/api/business/deals/{deal_id}/handoff")
def document_handoff(
    deal_id: int,
    req: DocumentHandoffRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    return build_document_handoff(
        db,
        deal,
        req.document,
        req.confirm_reference,
        _approved_by(request),
    )
