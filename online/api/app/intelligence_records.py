from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .intelligence_normalizer import NORMALIZED_SCHEMA, normalize_intelligence
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


class OnlineIntelligenceProjection(Base):
    __tablename__ = "online_intelligence_projections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("online_intelligence_records.id"), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(60), index=True)
    schema_version: Mapped[str] = mapped_column(String(80), default=NORMALIZED_SCHEMA)
    normalized_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


def _safe(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value or "")
    except Exception:
        return fallback


def _projection_dict(row: OnlineIntelligenceProjection) -> dict[str, Any]:
    return _safe(row.normalized_json, {})


def ensure_projection(db: Session, row: OnlineIntelligenceRecord, *, refresh: bool = False) -> OnlineIntelligenceProjection:
    projection = db.scalar(
        select(OnlineIntelligenceProjection).where(OnlineIntelligenceProjection.record_id == row.id)
    )
    query = _safe(row.query_json, {})
    result = _safe(row.result_json, {})
    normalized = normalize_intelligence(row.kind, query, result)
    if not projection:
        projection = OnlineIntelligenceProjection(
            record_id=row.id,
            kind=row.kind,
            schema_version=NORMALIZED_SCHEMA,
            normalized_json=json.dumps(normalized, ensure_ascii=False, default=str)[:60000],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(projection)
        db.flush()
    elif refresh or projection.schema_version != NORMALIZED_SCHEMA:
        projection.kind = row.kind
        projection.schema_version = NORMALIZED_SCHEMA
        projection.normalized_json = json.dumps(normalized, ensure_ascii=False, default=str)[:60000]
        projection.updated_at = datetime.now(timezone.utc)
        db.flush()
    return projection


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
    ensure_projection(db, row)
    return row


def intelligence_dict(row: OnlineIntelligenceRecord, db: Session | None = None) -> dict[str, Any]:
    query = _safe(row.query_json, {})
    result = _safe(row.result_json, {})
    normalized = normalize_intelligence(row.kind, query, result)
    if db is not None:
        projection = db.scalar(
            select(OnlineIntelligenceProjection).where(OnlineIntelligenceProjection.record_id == row.id)
        )
        if projection:
            normalized = _projection_dict(projection)
    return {
        "id": row.id,
        "kind": row.kind,
        "lead_id": row.lead_id,
        "deal_id": row.deal_id,
        "title": row.title,
        "query": query,
        "result": result,
        "normalized": normalized,
        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
    }


def _require_manager(request: Request) -> None:
    member = getattr(request.state, "team_member", None)
    if not isinstance(member, dict) or not member:
        return
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以整理历史联网资料")


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
    return [intelligence_dict(x, db) for x in rows]


@app.get("/api/intelligence/{record_id}/normalized")
def normalized_intelligence(record_id: int, db: Session = Depends(get_db)):
    row = db.get(OnlineIntelligenceRecord, record_id)
    if not row:
        raise HTTPException(404, "没有找到这条联网资料")
    projection = ensure_projection(db, row)
    db.commit()
    return {
        "record_id": row.id,
        "kind": row.kind,
        "normalized": _projection_dict(projection),
        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
    }


@app.post("/api/intelligence/normalize/backfill")
def backfill_normalized_intelligence(
    request: Request,
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    _require_manager(request)
    rows = db.scalars(
        select(OnlineIntelligenceRecord).order_by(OnlineIntelligenceRecord.id.asc()).limit(limit)
    ).all()
    refreshed = 0
    for row in rows:
        ensure_projection(db, row, refresh=True)
        refreshed += 1
    db.commit()
    return {"ok": True, "schema": NORMALIZED_SCHEMA, "processed": refreshed}


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
        "items": [intelligence_dict(x, db) for x in latest.values()],
    }
