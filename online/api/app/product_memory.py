from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app


class ProductBrainRecord(Base):
    __tablename__ = "product_brain_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brain_id: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    local_product_id: Mapped[str] = mapped_column(String(160), default="", index=True)
    name: Mapped[str] = mapped_column(String(255), default="", index=True)
    sku: Mapped[str] = mapped_column(String(160), default="", index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class ProductBrainPayload(BaseModel):
    brain_id: str = Field(default="", max_length=160)
    id: str = Field(default="", max_length=160)
    local_product_id: str = Field(default="", max_length=160)
    name: str = Field(default="", max_length=255)
    sku: str = Field(default="", max_length=160)
    updated_at: str = Field(default="", max_length=80)
    payload: dict[str, Any] | None = None


class ProductBrainImport(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list, max_length=500)


def _row_payload(row: ProductBrainRecord) -> dict[str, Any]:
    try:
        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    payload.setdefault("id", row.brain_id)
    payload.setdefault("brain_id", row.brain_id)
    payload.setdefault("local_product_id", row.local_product_id)
    payload.setdefault("name", row.name)
    payload.setdefault("sku", row.sku)
    payload["server_updated_at"] = row.updated_at.isoformat() if row.updated_at else None
    return payload


def _upsert(db: Session, raw: dict[str, Any]) -> ProductBrainRecord:
    brain_id = str(raw.get("brain_id") or raw.get("id") or "").strip()
    if not brain_id:
        raise HTTPException(400, "产品资料缺少唯一编号")
    payload = raw.get("payload") if isinstance(raw.get("payload"), dict) else raw
    name = str(payload.get("name") or raw.get("name") or "").strip()
    sku = str(payload.get("sku") or raw.get("sku") or "").strip()
    local_product_id = str(payload.get("local_product_id") or raw.get("local_product_id") or "").strip()
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == brain_id))
    if not row:
        row = ProductBrainRecord(brain_id=brain_id, created_at=datetime.now(timezone.utc))
        db.add(row)
    row.local_product_id = local_product_id
    row.name = name
    row.sku = sku
    row.payload_json = json.dumps(payload, ensure_ascii=False)
    row.updated_at = datetime.now(timezone.utc)
    return row


@app.get("/api/product-brains")
def list_product_brains(db: Session = Depends(get_db)):
    rows = db.scalars(select(ProductBrainRecord).order_by(ProductBrainRecord.updated_at.desc()).limit(500)).all()
    return [_row_payload(x) for x in rows]


@app.put("/api/product-brains/{brain_id}")
def save_product_brain(brain_id: str, req: ProductBrainPayload, db: Session = Depends(get_db)):
    raw = req.model_dump()
    raw["brain_id"] = brain_id
    row = _upsert(db, raw)
    db.commit()
    db.refresh(row)
    return _row_payload(row)


@app.post("/api/product-brains/import")
def import_product_brains(req: ProductBrainImport, db: Session = Depends(get_db)):
    saved = 0
    for item in req.items[:500]:
        try:
            _upsert(db, item)
            saved += 1
        except HTTPException:
            continue
    db.commit()
    return {"ok": True, "saved": saved}


@app.delete("/api/product-brains/{brain_id}")
def delete_product_brain(brain_id: str, db: Session = Depends(get_db)):
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == brain_id))
    if not row:
        raise HTTPException(404, "没有找到这条产品资料")
    db.delete(row)
    db.commit()
    return {"ok": True}
