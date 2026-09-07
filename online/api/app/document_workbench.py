from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef
from .main import Lead, LeadActivity, get_db, safe_json
from .online_app import app


DOC_ORDER = (
    "quotation",
    "proforma_invoice",
    "sales_contract",
    "commercial_invoice",
    "packing_list",
)
BRIDGE_SCHEMA = "huidi.business.bundle/v1"


def _priority(score: float) -> str:
    return "A" if score >= 78 else "B" if score >= 62 else "C" if score >= 46 else "D"


def _recommended_document(db: Session, deal_id: int) -> str:
    existing = set(
        db.scalars(
            select(OnlineDocumentRef.document_type).where(OnlineDocumentRef.deal_id == deal_id)
        ).all()
    )
    for document_type in DOC_ORDER:
        if document_type not in existing:
            return document_type
    return "packing_list"


def _activity_payload(row: LeadActivity) -> dict[str, Any]:
    payload = safe_json(row.payload_json, {})
    return {
        "event_type": row.event_type,
        "title": row.title,
        "detail": row.detail,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "payload": payload if isinstance(payload, dict) else {},
    }


@app.get("/api/business/deals/{deal_id}/local-bundle")
def deal_local_bundle(deal_id: int, db: Session = Depends(get_db)):
    """Project one existing Online deal into the existing Local bridge schema.

    This route owns no customer/deal/document data. It only projects the current
    canonical OnlineCustomer/OnlineDeal/Lead into the already-established
    huidi.business.bundle/v1 handoff so the Local workspace can continue without
    repeated entry.
    """

    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔询盘")
    customer = db.get(OnlineCustomer, deal.customer_id)
    if not customer:
        raise HTTPException(409, "这笔询盘缺少正式客户资料")
    if not deal.source_lead_id:
        raise HTTPException(409, "这笔询盘没有来源客户线索，暂时不能自动带入离线版；可以直接打开离线单据工作台继续。")

    lead = db.get(Lead, deal.source_lead_id)
    if not lead:
        raise HTTPException(409, "来源客户线索已经不存在，暂时不能自动带入离线版。")

    activity_rows = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead.id)
        .order_by(LeadActivity.id.desc())
        .limit(20)
    ).all()
    evidence = safe_json(lead.evidence_json, [])
    if not isinstance(evidence, list):
        evidence = []

    mail_draft = None
    if (lead.draft_subject or "").strip() or (lead.draft_body or "").strip():
        mail_draft = {
            "to": customer.email or lead.contact_email or "",
            "subject": lead.draft_subject or "",
            "body": lead.draft_body or "",
            "language": "",
            "approved": False,
        }

    return {
        "schema": BRIDGE_SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "HUIDI Docs Online",
        "source_lead_id": str(lead.id),
        "lead": {
            "priority": _priority(float(lead.score or 0)),
            "score": float(lead.score or 0),
            "reason": lead.reason or "",
            "country": lead.country or customer.country or "",
            "buyer_type": lead.buyer_type or "",
            "market_keyword": lead.market_keyword or deal.product_keyword or "",
            "website": lead.website or customer.website or "",
            "evidence": evidence[:8],
            "assessment": None,
        },
        "customer": {
            "company": customer.company_name,
            "contact": customer.contact_name or lead.contact_name or "",
            "email": customer.email or lead.contact_email or "",
            "phone": customer.phone or "",
            "country": customer.country or lead.country or "",
            "website": customer.website or lead.website or "",
            "currency": deal.currency or "USD",
            "preferred_language": "",
            "tags": "HUIDI Online 正式询盘",
            "notes": customer.notes or "",
        },
        "deal": {
            "title": deal.title,
            "stage": deal.stage,
            "currency": deal.currency or "USD",
            "product_keyword": deal.product_keyword or lead.market_keyword or "",
            "requirements": deal.requirements or "",
            "next_action": deal.next_action or "",
            "next_action_at": deal.next_action_at or "",
            "notes": f"Online Deal #{deal.id}",
        },
        "mail_draft": mail_draft,
        "activity": [_activity_payload(row) for row in activity_rows],
        "recommended_document": _recommended_document(db, deal.id),
    }
