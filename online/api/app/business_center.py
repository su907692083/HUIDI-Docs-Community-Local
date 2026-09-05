from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func, or_, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, Lead, LeadActivity, add_activity, engine, get_db, safe_json
from .online_app import app


class OnlineCustomer(Base):
    __tablename__ = "online_customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), unique=True, nullable=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="", index=True)
    phone: Mapped[str] = mapped_column(String(120), default="")
    country: Mapped[str] = mapped_column(String(120), default="", index=True)
    website: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="active", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class OnlineDeal(Base):
    __tablename__ = "online_deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("online_customers.id"), index=True)
    source_lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), unique=True, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    stage: Mapped[str] = mapped_column(String(60), default="new_inquiry", index=True)
    probability: Mapped[int] = mapped_column(Integer, default=20)
    currency: Mapped[str] = mapped_column(String(12), default="USD")
    amount: Mapped[float] = mapped_column(Float, default=0)
    product_keyword: Mapped[str] = mapped_column(String(255), default="")
    requirements: Mapped[str] = mapped_column(Text, default="")
    next_action: Mapped[str] = mapped_column(Text, default="")
    next_action_at: Mapped[str] = mapped_column(String(80), default="")
    local_deal_id: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class OnlineDocumentRef(Base):
    __tablename__ = "online_document_refs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("online_deals.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(80), index=True)
    document_id: Mapped[str] = mapped_column(String(160), default="")
    state: Mapped[str] = mapped_column(String(40), default="draft")
    title: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class DealPatch(BaseModel):
    stage: str | None = Field(default=None, max_length=60)
    probability: int | None = Field(default=None, ge=0, le=100)
    currency: str | None = Field(default=None, max_length=12)
    amount: float | None = Field(default=None, ge=0)
    requirements: str | None = Field(default=None, max_length=10000)
    next_action: str | None = Field(default=None, max_length=2000)
    next_action_at: str | None = Field(default=None, max_length=80)


class DocumentRefRequest(BaseModel):
    document_type: str = Field(pattern="^(quotation|proforma_invoice|sales_contract|commercial_invoice|packing_list)$")
    document_id: str = Field(default="", max_length=160)
    state: str = Field(default="draft", max_length=40)
    title: str = Field(default="", max_length=255)


def customer_dict(row: OnlineCustomer) -> dict[str, Any]:
    return {
        "id": row.id,
        "source_lead_id": row.source_lead_id,
        "company_name": row.company_name,
        "contact_name": row.contact_name,
        "email": row.email,
        "phone": row.phone,
        "country": row.country,
        "website": row.website,
        "status": row.status,
        "notes": row.notes,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def deal_dict(row: OnlineDeal, db: Session) -> dict[str, Any]:
    customer = db.get(OnlineCustomer, row.customer_id)
    docs = db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.deal_id == row.id)
        .order_by(OnlineDocumentRef.id.desc())
    ).all()
    return {
        "id": row.id,
        "customer_id": row.customer_id,
        "customer": customer_dict(customer) if customer else None,
        "source_lead_id": row.source_lead_id,
        "title": row.title,
        "stage": row.stage,
        "probability": row.probability,
        "currency": row.currency,
        "amount": row.amount,
        "product_keyword": row.product_keyword,
        "requirements": row.requirements,
        "next_action": row.next_action,
        "next_action_at": row.next_action_at,
        "local_deal_id": row.local_deal_id,
        "documents": [
            {
                "id": x.id,
                "type": x.document_type,
                "document_id": x.document_id,
                "state": x.state,
                "title": x.title,
            }
            for x in docs
        ],
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _latest_followup(db: Session, lead_id: int) -> tuple[str, str]:
    row = db.scalar(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .where(LeadActivity.event_type == "followup_scheduled")
        .order_by(LeadActivity.id.desc())
    )
    if not row:
        return "", ""
    payload = safe_json(row.payload_json, {})
    return row.detail or row.title or "继续跟进", str(payload.get("due_at") or "")


def upsert_from_lead(db: Session, lead: Lead) -> tuple[OnlineCustomer, OnlineDeal]:
    customer = db.scalar(select(OnlineCustomer).where(OnlineCustomer.source_lead_id == lead.id))
    if not customer and lead.contact_email:
        customer = db.scalar(
            select(OnlineCustomer).where(func.lower(OnlineCustomer.email) == lead.contact_email.lower())
        )
    if not customer:
        customer = OnlineCustomer(source_lead_id=lead.id, company_name=lead.company_name)
        db.add(customer)
        db.flush()
    customer.source_lead_id = customer.source_lead_id or lead.id
    customer.company_name = lead.company_name or customer.company_name
    customer.contact_name = lead.contact_name or customer.contact_name
    customer.email = lead.contact_email or customer.email
    customer.country = lead.country or customer.country
    customer.website = lead.website or customer.website
    customer.updated_at = datetime.now(timezone.utc)

    deal = db.scalar(select(OnlineDeal).where(OnlineDeal.source_lead_id == lead.id))
    next_action, next_at = _latest_followup(db, lead.id)
    if not deal:
        deal = OnlineDeal(
            customer_id=customer.id,
            source_lead_id=lead.id,
            title=f"{lead.company_name} · {lead.market_keyword or '新询盘'}",
            stage="new_inquiry",
            probability=20,
            product_keyword=lead.market_keyword,
            requirements=lead.reason,
            next_action=next_action or ("确认客户需求并准备报价" if lead.status == "replied" else "确认客户需求"),
            next_action_at=next_at,
        )
        db.add(deal)
        db.flush()
    else:
        deal.customer_id = customer.id
        deal.product_keyword = lead.market_keyword or deal.product_keyword
        deal.requirements = deal.requirements or lead.reason
        if next_action:
            deal.next_action = next_action
            deal.next_action_at = next_at
        deal.updated_at = datetime.now(timezone.utc)

    if lead.status not in {"archived"}:
        lead.status = "converted"
        lead.updated_at = datetime.now(timezone.utc)
    add_activity(
        db,
        lead.id,
        "online_business_created",
        "已进入客户 / 询盘",
        deal.title,
        {"customer_id": customer.id, "deal_id": deal.id},
    )
    db.commit()
    db.refresh(customer)
    db.refresh(deal)
    return customer, deal


@app.post("/api/business/from-lead/{lead_id}")
def create_business_from_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条客户线索")
    customer, deal = upsert_from_lead(db, lead)
    return {"ok": True, "customer": customer_dict(customer), "deal": deal_dict(deal, db)}


@app.get("/api/business/customers")
def list_customers(
    q: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=20, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(OnlineCustomer)
    term = q.strip()
    if term:
        like = f"%{term}%"
        stmt = stmt.where(
            or_(
                OnlineCustomer.company_name.ilike(like),
                OnlineCustomer.contact_name.ilike(like),
                OnlineCustomer.email.ilike(like),
                OnlineCustomer.country.ilike(like),
            )
        )
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.scalars(
        stmt.order_by(OnlineCustomer.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [customer_dict(x) for x in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@app.get("/api/business/deals")
def list_deals(
    q: str = "",
    stage: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=20, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(OnlineDeal)
    if stage.strip():
        stmt = stmt.where(OnlineDeal.stage == stage.strip())
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(OnlineDeal.title.ilike(like), OnlineDeal.product_keyword.ilike(like)))
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.scalars(
        stmt.order_by(OnlineDeal.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {
        "items": [deal_dict(x, db) for x in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@app.get("/api/business/deals/{deal_id}")
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    row = db.get(OnlineDeal, deal_id)
    if not row:
        raise HTTPException(404, "没有找到这笔业务")
    return deal_dict(row, db)


@app.patch("/api/business/deals/{deal_id}")
def patch_deal(deal_id: int, req: DealPatch, db: Session = Depends(get_db)):
    row = db.get(OnlineDeal, deal_id)
    if not row:
        raise HTTPException(404, "没有找到这笔业务")
    values = req.model_dump(exclude_none=True)
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = datetime.now(timezone.utc)
    if row.source_lead_id:
        add_activity(
            db,
            row.source_lead_id,
            "deal_updated",
            "业务进度已更新",
            row.next_action or row.stage,
            {"deal_id": row.id, "stage": row.stage, "next_action_at": row.next_action_at},
        )
    db.commit()
    db.refresh(row)
    return deal_dict(row, db)


@app.post("/api/business/deals/{deal_id}/documents")
def add_document_ref(deal_id: int, req: DocumentRefRequest, db: Session = Depends(get_db)):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    row = OnlineDocumentRef(
        deal_id=deal.id,
        document_type=req.document_type,
        document_id=req.document_id,
        state=req.state,
        title=req.title,
    )
    db.add(row)
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id}


@app.get("/api/business/deals/{deal_id}/bundle")
def business_bundle(
    deal_id: int,
    document: str = "quotation",
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    customer = db.get(OnlineCustomer, deal.customer_id)
    lead = db.get(Lead, deal.source_lead_id) if deal.source_lead_id else None
    if not customer:
        raise HTTPException(404, "没有找到对应客户")
    allowed_docs = {
        "quotation",
        "proforma_invoice",
        "sales_contract",
        "commercial_invoice",
        "packing_list",
    }
    if document not in allowed_docs:
        document = "quotation"
    return {
        "schema": "huidi.business.bundle/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "HUIDI Online",
        "source_lead_id": str(deal.source_lead_id or ""),
        "lead": {
            "priority": ("A" if lead and lead.score >= 78 else "B" if lead and lead.score >= 62 else "C" if lead and lead.score >= 46 else "D") if lead else "",
            "score": lead.score if lead else 0,
            "reason": lead.reason if lead else deal.requirements,
            "market_keyword": lead.market_keyword if lead else deal.product_keyword,
            "evidence": safe_json(lead.evidence_json, []) if lead else [],
        },
        "customer": {
            "company": customer.company_name,
            "contact": customer.contact_name,
            "email": customer.email,
            "phone": customer.phone,
            "country": customer.country,
            "website": customer.website,
        },
        "deal": {
            "title": deal.title,
            "stage": deal.stage,
            "currency": deal.currency,
            "product_keyword": deal.product_keyword,
            "requirements": deal.requirements,
            "next_action": deal.next_action,
            "next_action_at": deal.next_action_at,
        },
        "mail_draft": {
            "to": lead.contact_email,
            "subject": lead.draft_subject,
            "body": lead.draft_body,
            "approved": True,
        } if lead and (lead.draft_subject or lead.draft_body) else None,
        "activity": [],
        "recommended_document": document,
    }
