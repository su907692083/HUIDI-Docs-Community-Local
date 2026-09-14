from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy import Integer, case, cast, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer
from .main import Lead, get_db
from .online_app import app


def _contact_candidates(include_formal: bool = False):
    """Build one read-only contact projection over the existing Lead/Customer owners."""
    lead_has_contact = or_(
        Lead.contact_email != "",
        Lead.contact_name != "",
        Lead.contact_role != "",
    )
    lead_rows = (
        select(
            literal("lead").label("source_kind"),
            Lead.id.label("source_id"),
            Lead.id.label("source_lead_id"),
            cast(literal(None), Integer).label("customer_id"),
            Lead.company_name.label("company_name"),
            Lead.contact_name.label("contact_name"),
            Lead.contact_role.label("contact_role"),
            Lead.contact_email.label("contact_email"),
            literal("").label("phone"),
            Lead.country.label("country"),
            Lead.status.label("status"),
            Lead.updated_at.label("updated_at"),
            literal(1).label("source_priority"),
        )
        .where(lead_has_contact)
    )

    # Formal customers remain the canonical customer owner after conversion.
    # When a customer originated from a Lead, reuse the Lead role as a read-only
    # presentation fact because OnlineCustomer intentionally does not duplicate it.
    lead_role = (
        select(Lead.contact_role)
        .where(Lead.id == OnlineCustomer.source_lead_id)
        .scalar_subquery()
    )
    customer_has_contact = or_(
        OnlineCustomer.email != "",
        OnlineCustomer.contact_name != "",
    )
    customer_rows = (
        select(
            literal("customer").label("source_kind"),
            OnlineCustomer.id.label("source_id"),
            OnlineCustomer.source_lead_id.label("source_lead_id"),
            OnlineCustomer.id.label("customer_id"),
            OnlineCustomer.company_name.label("company_name"),
            OnlineCustomer.contact_name.label("contact_name"),
            func.coalesce(lead_role, "").label("contact_role"),
            OnlineCustomer.email.label("contact_email"),
            OnlineCustomer.phone.label("phone"),
            OnlineCustomer.country.label("country"),
            OnlineCustomer.status.label("status"),
            OnlineCustomer.updated_at.label("updated_at"),
            literal(2).label("source_priority"),
        )
        .where(customer_has_contact)
    )
    if not include_formal:
        return lead_rows.subquery("contact_candidates")
    return union_all(lead_rows, customer_rows).subquery("contact_candidates")


def _ranked_contacts(include_formal: bool = False):
    candidates = _contact_candidates(include_formal)
    email_key = func.lower(func.trim(candidates.c.contact_email))
    company_key = func.lower(func.trim(candidates.c.company_name))
    name_key = func.lower(func.trim(candidates.c.contact_name))
    role_key = func.lower(func.trim(candidates.c.contact_role))
    dedupe_key = case(
        (email_key != "", literal("email:") + email_key),
        else_=(
            literal("name:")
            + company_key
            + literal("|")
            + name_key
            + literal("|")
            + role_key
        ),
    )
    return (
        select(
            candidates,
            func.row_number()
            .over(
                partition_by=dedupe_key,
                order_by=(
                    candidates.c.source_priority.desc(),
                    candidates.c.updated_at.desc(),
                    candidates.c.source_id.desc(),
                ),
            )
            .label("contact_rank"),
        )
        .subquery("ranked_contacts")
    )


def _contact_dict(row) -> dict:
    return {
        "id": int(row["source_id"]),
        "source_kind": str(row["source_kind"] or "lead"),
        "source_id": int(row["source_id"]),
        "source_lead_id": int(row["source_lead_id"]) if row["source_lead_id"] else None,
        "customer_id": int(row["customer_id"]) if row["customer_id"] else None,
        "company_name": str(row["company_name"] or ""),
        "contact_name": str(row["contact_name"] or ""),
        "contact_role": str(row["contact_role"] or ""),
        "contact_email": str(row["contact_email"] or ""),
        "phone": str(row["phone"] or ""),
        "country": str(row["country"] or ""),
        "status": str(row["status"] or ""),
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@app.get("/api/contacts")
def list_contacts(
    q: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=20, le=200),
    include_formal: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    ranked = _ranked_contacts(include_formal)
    stmt = select(ranked).where(ranked.c.contact_rank == 1)

    query = q.strip()
    if query:
        like = f"%{query}%"
        stmt = stmt.where(
            or_(
                ranked.c.company_name.ilike(like),
                ranked.c.contact_name.ilike(like),
                ranked.c.contact_role.ilike(like),
                ranked.c.contact_email.ilike(like),
                ranked.c.phone.ilike(like),
                ranked.c.country.ilike(like),
            )
        )

    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.execute(
        stmt.order_by(
            ranked.c.updated_at.desc(),
            ranked.c.source_priority.desc(),
            ranked.c.source_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings().all()

    return {
        "items": [_contact_dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
