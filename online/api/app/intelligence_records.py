from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Query
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, Lead, engine, get_db
from .online_app import app


class OnlineIntelligenceRecord(Base):
    __tablename__ = "online_intelligence_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(60), index=True)
    lead_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    deal_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    query_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


def _safe(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value or "")
    except Exception:
        return fallback


def record_intelligence(
    db: Session,
    kind: str,
    title: str,
    query: dict[str, Any],
    result: Any,
    lead_id: int | None = None,
    deal_id: int | None = None,
) -> OnlineIntelligenceRecord:
    row = OnlineIntelligenceRecord(
        kind=kind[:60],
        lead_id=lead_id,
        deal_id=deal_id,
        title=title[:255],
        query_json=json.dumps(query, ensure_ascii=False, default=str)[:30000],
        result_json=json.dumps(result, ensure_ascii=False, default=str)[:120000],
        checked_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.flush()
    return row


def intelligence_dict(row: OnlineIntelligenceRecord) -> dict[str, Any]:
    return {
        "id": row.id,
        "kind": row.kind,
        "lead_id": row.lead_id,
        "deal_id": row.deal_id,
        "title": row.title,
        "query": _safe(row.query_json, {}),
        "result": _safe(row.result_json, {}),
        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
    }


@app.get("/api/intelligence")
def list_intelligence(
    lead_id: int | None = None,
    deal_id: int | None = None,
    kind: str = "",
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(OnlineIntelligenceRecord)
    if lead_id is not None:
        stmt = stmt.where(OnlineIntelligenceRecord.lead_id == lead_id)
    if deal_id is not None:
        stmt = stmt.where(OnlineIntelligenceRecord.deal_id == deal_id)
    if kind.strip():
        stmt = stmt.where(OnlineIntelligenceRecord.kind == kind.strip())
    rows = db.scalars(stmt.order_by(OnlineIntelligenceRecord.checked_at.desc()).limit(limit)).all()
    return [intelligence_dict(x) for x in rows]


@app.get("/api/intelligence/summary/{lead_id}")
def intelligence_summary(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        return {"lead_id": lead_id, "items": [], "counts": {}}
    rows = db.scalars(
        select(OnlineIntelligenceRecord)
        .where(OnlineIntelligenceRecord.lead_id == lead_id)
        .order_by(OnlineIntelligenceRecord.checked_at.desc())
        .limit(100)
    ).all()
    latest: dict[str, OnlineIntelligenceRecord] = {}
    counts: dict[str, int] = {}
    for row in rows:
        latest.setdefault(row.kind, row)
        counts[row.kind] = counts.get(row.kind, 0) + 1
    return {
        "lead_id": lead_id,
        "company_name": lead.company_name,
        "counts": counts,
        "items": [intelligence_dict(x) for x in latest.values()],
    }
