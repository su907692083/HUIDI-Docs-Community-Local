from __future__ import annotations

from fastapi import Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .main import Lead, get_db, lead_to_dict
from .online_app import app


@app.get("/api/contacts")
def list_contacts(
    q: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=20, le=200),
    db: Session = Depends(get_db),
):
    has_contact = or_(Lead.contact_email != "", Lead.contact_name != "", Lead.contact_role != "")
    stmt = select(Lead).where(has_contact)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.company_name.ilike(like),
                Lead.contact_name.ilike(like),
                Lead.contact_role.ilike(like),
                Lead.contact_email.ilike(like),
                Lead.country.ilike(like),
            )
        )
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.scalars(
        stmt.order_by(Lead.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {
        "items": [lead_to_dict(x, db) for x in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
