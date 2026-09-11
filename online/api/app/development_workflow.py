from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .company_settings import setting_payload
from .industry_playbooks import _risk_note, resolve_lead_industry
from .low_input_workflow import _context, _product_payload, _product_summary
from .mail_delivery import MailDeliveryLog, delivery_to_dict
from .main import Lead, LeadActivity, activity_to_dict, add_activity, get_db, lead_to_dict
from .online_app import MailboxAccount, _draft_review_state, app, mailbox_to_dict
from .product_fact_projection import project_non_price_product_facts
from .product_memory import ProductBrainRecord


DEVELOPMENT_WORKFLOW_SCHEMA = "huidi.community.development-workflow/v1"


class ProductContextRequest(BaseModel):
    product_brain_id: str = Field(min_length=1, max_length=160)


class DraftContentRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=20000)


def _selected_product_payload(row: ProductBrainRecord) -> dict[str, Any]:
    payload = _product_payload(row)
    return {
        "brain_id": row.brain_id,
        "name": str(payload.get("name") or "").strip(),
        "sku": str(payload.get("sku") or "").strip(),
        "spec": str(payload.get("spec") or payload.get("specification") or "").strip(),
        "moq": str(payload.get("moq") or "").strip(),
        "lead_time": str(payload.get("lead_time") or payload.get("delivery_time") or "").strip(),
        "summary": _product_summary(payload),
        "non_price_facts": project_non_price_product_facts(payload),
    }


def _latest_product_context_id(db: Session, lead_id: int) -> str:
    row = db.scalar(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .where(LeadActivity.event_type == "product_context_selected")
        .order_by(LeadActivity.id.desc())
    )
    if not row:
        return ""
    try:
        import json

        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    return str(payload.get("product_brain_id") or "").strip()


def _development_product_facts(db: Session, lead_id: int, low_input: dict[str, Any]) -> dict[str, Any] | None:
    preferred = low_input.get("product") if isinstance(low_input, dict) else None
    brain_id = str((preferred or {}).get("brain_id") or _latest_product_context_id(db, lead_id) or "").strip()
    if not brain_id:
        return None
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == brain_id))
    return project_non_price_product_facts(row) if row else None


def development_context(db: Session, lead: Lead) -> dict[str, Any]:
    low_input = _context(db, lead)
    product_facts = _development_product_facts(db, lead.id, low_input)
    if product_facts:
        low_input = {**low_input, "product_non_price_facts": product_facts}
    resolved = resolve_lead_industry(db, lead)
    company = setting_payload(db)
    mailboxes = db.scalars(select(MailboxAccount).order_by(MailboxAccount.id.asc())).all()
    activities = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead.id)
        .order_by(LeadActivity.id.desc())
        .limit(40)
    ).all()
    deliveries = db.scalars(
        select(MailDeliveryLog)
        .where(MailDeliveryLog.lead_id == lead.id)
        .order_by(MailDeliveryLog.id.desc())
        .limit(20)
    ).all()
    return {
        "schema": DEVELOPMENT_WORKFLOW_SCHEMA,
        "lead": lead_to_dict(lead, db),
        "low_input": low_input,
        "industry": {
            **resolved,
            "risk_note": _risk_note(resolved["profile"]),
        },
        "sender_defaults": {
            "sender_company": company.get("company_name") or company.get("legal_name") or "",
            "sender_email": company.get("email") or "",
        },
        "mailboxes": [mailbox_to_dict(x) for x in mailboxes],
        "review_state": _draft_review_state(db, lead.id),
        "activities": [activity_to_dict(x) for x in activities],
        "deliveries": [delivery_to_dict(x) for x in deliveries],
        "note": "产品与行业资料只用于开发上下文和草稿辅助；规格/认证/HS/包装等非价格事实可复用，正式业务字段和价格仍由原 Community 业务流程确认。",
    }


@app.get("/api/leads/{lead_id}/development-context")
def get_development_context(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条潜在客户")
    return development_context(db, lead)


@app.put("/api/leads/{lead_id}/product-context")
def set_product_context(lead_id: int, req: ProductContextRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条潜在客户")
    product_id = req.product_brain_id.strip()
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == product_id))
    if not row:
        raise HTTPException(400, "选择的产品资料已经不存在，请重新选择")
    product = _selected_product_payload(row)
    if _latest_product_context_id(db, lead.id) != row.brain_id:
        add_activity(
            db,
            lead.id,
            "product_context_selected",
            "已关联产品资料",
            product.get("name") or product.get("sku") or row.brain_id,
            {"product_brain_id": row.brain_id, "product_name": product.get("name", "")},
        )
        lead.updated_at = datetime.now(timezone.utc)
        db.commit()
    return {
        "ok": True,
        "lead_id": lead.id,
        "product": product,
        "note": "开发信可复用规格、认证、HS、包装等非价格产品事实；不会把产品参考价格写入正式业务字段。",
    }


@app.put("/api/leads/{lead_id}/draft-content")
def save_draft_content(lead_id: int, req: DraftContentRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条潜在客户")
    subject = req.subject.strip()
    body = req.body.strip()
    if not subject or not body:
        raise HTTPException(400, "邮件主题和正文都不能为空")
    changed = subject != (lead.draft_subject or "").strip() or body != (lead.draft_body or "").strip()
    if changed:
        lead.draft_subject = subject
        lead.draft_body = body
        lead.updated_at = datetime.now(timezone.utc)
        add_activity(db, lead.id, "draft_edited", "已修改开发信", subject)
        add_activity(
            db,
            lead.id,
            "draft_rejected",
            "开发信已修改，需重新确认",
            "修改后的内容必须重新人工确认后才能发送。",
            {"subject": subject},
        )
        db.commit()
        db.refresh(lead)
    return {
        "ok": True,
        "changed": changed,
        "review_state": _draft_review_state(db, lead.id),
        "lead": lead_to_dict(lead, db),
    }
