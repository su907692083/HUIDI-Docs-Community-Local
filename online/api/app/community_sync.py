from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from .business_center import OnlineCustomer, OnlineCustomerAddress, OnlineDeal, OnlineDocumentRef, address_dict, default_customer_address
from .main import Base, engine, get_db
from .online_app import app
from .product_memory import ProductBrainRecord


FORMAL_DOCUMENT_TYPES = {
    "quotation",
    "proforma_invoice",
    "sales_contract",
    "commercial_invoice",
    "packing_list",
}


class CommunityDealProductLink(Base):
    """Many-to-many relation under the existing Deal and Product Brain owners.

    This is relation metadata only. It deliberately does not introduce another
    customer, product, deal or document table.
    """

    __tablename__ = "community_deal_product_links"
    __table_args__ = (UniqueConstraint("deal_id", "brain_id", name="uq_community_deal_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("online_deals.id"), index=True)
    brain_id: Mapped[str] = mapped_column(String(160), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class CommunityArchive(Base):
    """Soft-delete markers for the Local mother surface.

    Community Local already has a recycle-bin interaction. Online keeps that
    reversible behavior without destroying canonical business rows.
    """

    __tablename__ = "community_archives"
    __table_args__ = (UniqueConstraint("entity_kind", "entity_key", name="uq_community_archive_entity"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_kind: Mapped[str] = mapped_column(String(40), index=True)
    entity_key: Mapped[str] = mapped_column(String(180), index=True)
    archived_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class CommunityStateRequest(BaseModel):
    customers: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    products: list[dict[str, Any]] = Field(default_factory=list, max_length=4000)
    deals: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    archived: dict[str, list[str]] = Field(default_factory=dict)


class CommunityDocumentRequest(BaseModel):
    record: dict[str, Any]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean(value: Any, limit: int = 2000) -> str:
    return str(value or "").strip()[:limit]


def _int_id(value: Any) -> int:
    try:
        return int(str(value or "").strip())
    except Exception:
        return 0


def _json(value: Any, fallback: Any) -> Any:
    if isinstance(value, type(fallback)):
        return value
    try:
        decoded = json.loads(str(value or ""))
    except Exception:
        return fallback
    return decoded if isinstance(decoded, type(fallback)) else fallback


def _archive_key(kind: str, key: Any) -> str:
    return f"{kind}:{_clean(key, 160)}"


def _archive(db: Session, kind: str, key: Any) -> None:
    entity_key = _clean(key, 160)
    if not entity_key:
        return
    row = db.scalar(
        select(CommunityArchive)
        .where(CommunityArchive.entity_kind == kind)
        .where(CommunityArchive.entity_key == entity_key)
    )
    if not row:
        db.add(CommunityArchive(entity_kind=kind, entity_key=entity_key, archived_at=_now()))


def _unarchive(db: Session, kind: str, *keys: Any) -> None:
    clean_keys = {_clean(key, 160) for key in keys if _clean(key, 160)}
    if not clean_keys:
        return
    rows = db.scalars(
        select(CommunityArchive)
        .where(CommunityArchive.entity_kind == kind)
        .where(CommunityArchive.entity_key.in_(clean_keys))
    ).all()
    for row in rows:
        db.delete(row)


def _archived_sets(db: Session) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {"customer": set(), "product": set(), "deal": set(), "document": set()}
    for row in db.scalars(select(CommunityArchive)).all():
        out.setdefault(row.entity_kind, set()).add(row.entity_key)
    return out


def _customer_local(row: OnlineCustomer, db: Session) -> dict[str, Any]:
    address = default_customer_address(db, row.id)
    return {
        "id": str(row.id),
        "company": row.company_name,
        "name": row.company_name,
        "contact": row.contact_name,
        "email": row.email,
        "phone": row.phone,
        "country": row.country,
        "website": row.website,
        "address": address_dict(address).get("formatted", "") if address else "",
        "source": "HUIDI Online",
        "notes": row.notes,
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def _product_payload(row: ProductBrainRecord) -> dict[str, Any]:
    payload = _json(row.payload_json, {})
    out = dict(payload)
    out["id"] = row.local_product_id or row.brain_id
    out["brain_id"] = row.brain_id
    out["local_product_id"] = row.local_product_id or row.brain_id
    out["name"] = row.name or _clean(payload.get("name"), 255)
    out["sku"] = row.sku or _clean(payload.get("sku"), 160)
    out["updated_at"] = row.updated_at.isoformat() if row.updated_at else out.get("updated_at", "")
    out.setdefault("source", "HUIDI Online")
    return out


def _deal_product_ids(db: Session, deal_id: int, product_ids: dict[str, str]) -> list[str]:
    links = db.scalars(
        select(CommunityDealProductLink)
        .where(CommunityDealProductLink.deal_id == deal_id)
        .order_by(CommunityDealProductLink.id.asc())
    ).all()
    return [product_ids.get(row.brain_id, row.brain_id) for row in links]


def _deal_local(row: OnlineDeal, db: Session, product_ids: dict[str, str]) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "customer_id": str(row.customer_id),
        "title": row.title,
        "stage": row.stage,
        "probability": row.probability,
        "currency": row.currency,
        "estimated_amount": row.amount,
        "amount": row.amount,
        "product_ids": _deal_product_ids(db, row.id, product_ids),
        "product_keyword": row.product_keyword,
        "requirements": row.requirements,
        "next_action": row.next_action,
        "next_action_at": row.next_action_at,
        "source": "HUIDI Online",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def _document_payload(db: Session, ref: OnlineDocumentRef) -> dict[str, Any]:
    try:
        raw = db.execute(
            text("SELECT payload_json FROM online_document_refs WHERE id=:id"),
            {"id": int(ref.id)},
        ).scalar_one_or_none()
    except Exception:
        raw = "{}"
    return _json(raw, {})


def _community_document_record(db: Session, ref: OnlineDocumentRef) -> dict[str, Any] | None:
    payload = _document_payload(db, ref)
    record = payload.get("__community_record") if isinstance(payload, dict) else None
    return record if isinstance(record, dict) else None


def _document_index(record: dict[str, Any], ref: OnlineDocumentRef) -> dict[str, Any]:
    summary = record.get("summary") if isinstance(record.get("summary"), dict) else {}
    payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
    return {
        "id": _clean(record.get("id") or ref.document_id or f"online-{ref.id}", 180),
        "title": _clean(record.get("title") or ref.title, 255),
        "document_type": _clean(summary.get("document_type") or record.get("document_type") or ref.document_type, 80),
        "document_no": _clean(summary.get("document_no") or record.get("document_no") or ref.document_id, 160),
        "customer_name": _clean(summary.get("customer_name") or record.get("customer_name"), 255),
        "deal_id": str(summary.get("deal_id") or record.get("deal_id") or payload.get("dealId") or ref.deal_id),
        "customer_id": str(summary.get("customer_id") or record.get("customer_id") or payload.get("customerId") or ""),
        "product_ids": summary.get("product_ids") or record.get("product_ids") or payload.get("productIds") or [],
        "document_status": _clean(summary.get("document_status") or ref.state or "draft", 40),
        "total_amount": summary.get("total_amount") or record.get("total_amount") or "",
        "currency": _clean(summary.get("currency") or record.get("currency"), 20),
        "updated_at": _clean(record.get("updated_at") or (ref.updated_at.isoformat() if ref.updated_at else ""), 80),
        "created_at": _clean(record.get("created_at") or (ref.created_at.isoformat() if ref.created_at else ""), 80),
        "storage": "huidi-online",
    }


def build_bootstrap(db: Session) -> dict[str, Any]:
    archived = _archived_sets(db)
    customers = [
        _customer_local(row, db)
        for row in db.scalars(select(OnlineCustomer).order_by(OnlineCustomer.updated_at.desc()).limit(2000)).all()
        if str(row.id) not in archived.get("customer", set())
    ]
    product_rows = db.scalars(select(ProductBrainRecord).order_by(ProductBrainRecord.updated_at.desc()).limit(4000)).all()
    products = [
        _product_payload(row)
        for row in product_rows
        if row.brain_id not in archived.get("product", set())
        and (row.local_product_id or row.brain_id) not in archived.get("product", set())
    ]
    product_id_map = {row.brain_id: (row.local_product_id or row.brain_id) for row in product_rows}
    deals = [
        _deal_local(row, db, product_id_map)
        for row in db.scalars(select(OnlineDeal).order_by(OnlineDeal.updated_at.desc()).limit(2000)).all()
        if str(row.id) not in archived.get("deal", set())
    ]
    docs: list[dict[str, Any]] = []
    for ref in db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.document_type.in_(FORMAL_DOCUMENT_TYPES))
        .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
        .limit(1000)
    ).all():
        record = _community_document_record(db, ref)
        if not record:
            continue
        record_id = _clean(record.get("id") or ref.document_id, 180)
        if record_id in archived.get("document", set()):
            continue
        docs.append(_document_index(record, ref))
    return {
        "schema": "huidi.community.online/v1",
        "customers": customers,
        "products": products,
        "deals": deals,
        "documents": docs,
        "cloud_scopes": {
            "customers": "canonical-online-customers",
            "products": "existing-product-brain-owner",
            "deals": "canonical-online-deals",
            "documents": "existing-online-document-refs",
            "deal_product_links": "relation-only",
        },
        "note": "Community Local 是业务界面母体；联网层只负责当前登录工作区的持久化和联网能力。",
    }


def _save_customer(db: Session, raw: dict[str, Any], id_map: dict[str, int]) -> OnlineCustomer:
    client_id = _clean(raw.get("id"), 160)
    row = db.get(OnlineCustomer, _int_id(client_id)) if _int_id(client_id) else None
    if not row:
        email = _clean(raw.get("email"), 255)
        if email:
            row = db.scalar(select(OnlineCustomer).where(func.lower(OnlineCustomer.email) == email.lower()))
    if not row:
        row = OnlineCustomer(company_name=_clean(raw.get("company") or raw.get("name") or "未命名客户", 255))
        db.add(row)
        db.flush()
    row.company_name = _clean(raw.get("company") or raw.get("name") or row.company_name, 255) or row.company_name
    row.contact_name = _clean(raw.get("contact") or raw.get("contact_name"), 255)
    row.email = _clean(raw.get("email"), 255)
    row.phone = _clean(raw.get("phone"), 120)
    row.country = _clean(raw.get("country"), 120)
    row.website = _clean(raw.get("website"), 2000)
    row.notes = _clean(raw.get("notes"), 10000)
    row.status = "active"
    row.updated_at = _now()
    db.flush()
    if client_id:
        id_map[client_id] = row.id
    _unarchive(db, "customer", client_id, row.id)

    address_text = _clean(raw.get("address") or raw.get("ship_to"), 2000)
    if address_text:
        address = default_customer_address(db, row.id, ("shipping", "billing", "office", "other"))
        if not address:
            address = OnlineCustomerAddress(
                customer_id=row.id,
                address_type="shipping",
                label="常用地址",
                is_default=1,
                created_at=_now(),
            )
            db.add(address)
        address.address_line1 = address_text
        address.contact_name = row.contact_name
        address.phone = row.phone
        address.country = row.country
        address.updated_at = _now()
    return row


def _save_product(db: Session, raw: dict[str, Any]) -> ProductBrainRecord:
    local_id = _clean(raw.get("local_product_id") or raw.get("id") or raw.get("brain_id"), 160)
    if not local_id:
        raise HTTPException(400, "商品资料缺少唯一编号")
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.local_product_id == local_id))
    if not row:
        row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == local_id))
    if not row:
        row = ProductBrainRecord(brain_id=local_id, local_product_id=local_id, created_at=_now())
        db.add(row)
    row.local_product_id = local_id
    row.name = _clean(raw.get("name"), 255)
    row.sku = _clean(raw.get("sku"), 160)
    payload = dict(raw)
    payload["id"] = local_id
    payload["local_product_id"] = local_id
    # Product price remains product/reference data only. This sync path never
    # writes OnlineDeal.amount or any current formal document unit price.
    row.payload_json = json.dumps(payload, ensure_ascii=False)
    row.updated_at = _now()
    db.flush()
    _unarchive(db, "product", local_id, row.brain_id)
    return row


def _save_deal(
    db: Session,
    raw: dict[str, Any],
    customer_ids: dict[str, int],
    product_lookup: dict[str, ProductBrainRecord],
) -> OnlineDeal:
    client_id = _clean(raw.get("id"), 160)
    row = db.get(OnlineDeal, _int_id(client_id)) if _int_id(client_id) else None
    if not row and client_id:
        row = db.scalar(select(OnlineDeal).where(OnlineDeal.local_deal_id == client_id))
    customer_key = _clean(raw.get("customer_id"), 160)
    customer_id = customer_ids.get(customer_key) or _int_id(customer_key)
    customer = db.get(OnlineCustomer, customer_id) if customer_id else None
    if not customer:
        raise HTTPException(400, "询盘缺少有效客户，请先保存客户")
    if not row:
        row = OnlineDeal(
            customer_id=customer.id,
            title=_clean(raw.get("title") or f"{customer.company_name} · 新询盘", 255),
            local_deal_id=client_id,
            created_at=_now(),
        )
        db.add(row)
        db.flush()
    row.customer_id = customer.id
    row.title = _clean(raw.get("title") or row.title, 255) or row.title
    row.stage = _clean(raw.get("stage") or row.stage or "new_inquiry", 60)
    try:
        row.probability = max(0, min(100, int(raw.get("probability") if raw.get("probability") not in (None, "") else row.probability or 20)))
    except Exception:
        pass
    row.currency = _clean(raw.get("currency") or row.currency or "USD", 12)
    explicit_amount = raw.get("estimated_amount") if raw.get("estimated_amount") not in (None, "") else raw.get("amount")
    if explicit_amount not in (None, ""):
        try:
            row.amount = max(0.0, float(explicit_amount))
        except Exception:
            pass
    row.requirements = _clean(raw.get("requirements"), 10000)
    row.next_action = _clean(raw.get("next_action"), 2000)
    row.next_action_at = _clean(raw.get("next_action_at"), 80)
    row.updated_at = _now()
    if client_id and not row.local_deal_id:
        row.local_deal_id = client_id
    db.flush()
    _unarchive(db, "deal", client_id, row.id)

    selected = [_clean(x, 160) for x in (raw.get("product_ids") or []) if _clean(x, 160)]
    for link in db.scalars(select(CommunityDealProductLink).where(CommunityDealProductLink.deal_id == row.id)).all():
        db.delete(link)
    selected_rows: list[ProductBrainRecord] = []
    for product_id in dict.fromkeys(selected):
        product = product_lookup.get(product_id)
        if not product:
            product = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.local_product_id == product_id))
        if not product:
            product = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == product_id))
        if not product:
            continue
        selected_rows.append(product)
        db.add(CommunityDealProductLink(deal_id=row.id, brain_id=product.brain_id, created_at=_now()))
    explicit_keyword = _clean(raw.get("product_keyword"), 255)
    if explicit_keyword:
        row.product_keyword = explicit_keyword
    elif selected_rows:
        row.product_keyword = _clean(selected_rows[0].name, 255)
    return row


def _apply_archives(db: Session, archived: dict[str, list[str]]) -> None:
    for kind in ("customer", "product", "deal", "document"):
        values = archived.get(kind) or archived.get(f"{kind}s") or []
        for value in values[:2000]:
            _archive(db, kind, value)


@app.get("/api/community-sync/bootstrap")
def community_bootstrap(db: Session = Depends(get_db)):
    return build_bootstrap(db)


@app.put("/api/community-sync/state")
def save_community_state(req: CommunityStateRequest, db: Session = Depends(get_db)):
    _apply_archives(db, req.archived)
    customer_ids: dict[str, int] = {}
    for raw in req.customers[:2000]:
        _save_customer(db, raw, customer_ids)
    product_lookup: dict[str, ProductBrainRecord] = {}
    for raw in req.products[:4000]:
        row = _save_product(db, raw)
        local_id = row.local_product_id or row.brain_id
        product_lookup[local_id] = row
        product_lookup[row.brain_id] = row
    for raw in req.deals[:2000]:
        _save_deal(db, raw, customer_ids, product_lookup)
    db.commit()
    return {"ok": True, **build_bootstrap(db)}


@app.get("/api/community-sync/documents/{document_id}")
def get_community_document(document_id: str, db: Session = Depends(get_db)):
    document_id = _clean(document_id, 180)
    refs = db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.document_type.in_(FORMAL_DOCUMENT_TYPES))
        .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
    ).all()
    for ref in refs:
        record = _community_document_record(db, ref)
        if not record:
            continue
        if _clean(record.get("id") or ref.document_id, 180) == document_id:
            return {"ok": True, "record": record, "ref_id": ref.id}
    raise HTTPException(404, "没有找到这份联网单据")


@app.put("/api/community-sync/documents/{document_id}")
def save_community_document(
    document_id: str,
    req: CommunityDocumentRequest,
    db: Session = Depends(get_db),
):
    record = dict(req.record or {})
    record_id = _clean(record.get("id") or document_id, 180)
    summary = record.get("summary") if isinstance(record.get("summary"), dict) else {}
    payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
    document_type = _clean(summary.get("document_type") or record.get("document_type") or payload.get("type"), 80)
    if document_type not in FORMAL_DOCUMENT_TYPES:
        raise HTTPException(400, "不支持这个单据类型")
    deal_id = _int_id(summary.get("deal_id") or record.get("deal_id") or payload.get("dealId"))
    deal = db.get(OnlineDeal, deal_id) if deal_id else None
    if not deal:
        raise HTTPException(400, "联网保存单据前，请先关联一笔询盘 / 订单")

    refs = db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.deal_id == deal.id)
        .where(OnlineDocumentRef.document_type == document_type)
        .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
    ).all()
    ref = None
    for candidate in refs:
        existing = _community_document_record(db, candidate)
        if existing and _clean(existing.get("id") or candidate.document_id, 180) == record_id:
            ref = candidate
            break
    if not ref:
        ref = OnlineDocumentRef(
            deal_id=deal.id,
            document_type=document_type,
            document_id=record_id,
            state=_clean(summary.get("document_status") or "draft", 40),
            title=_clean(record.get("title") or f"{deal.title} · {document_type}", 255),
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(ref)
        db.flush()
    existing_payload = _document_payload(db, ref)
    existing_payload["__community_record"] = record
    db.execute(
        text(
            "UPDATE online_document_refs SET payload_json=:payload, document_id=:document_id, "
            "state=:state, title=:title, updated_at=:updated_at WHERE id=:id"
        ),
        {
            "payload": json.dumps(existing_payload, ensure_ascii=False),
            "document_id": record_id,
            "state": _clean(summary.get("document_status") or ref.state or "draft", 40),
            "title": _clean(record.get("title") or ref.title, 255),
            "updated_at": _now(),
            "id": int(ref.id),
        },
    )
    _unarchive(db, "document", record_id)
    db.commit()
    return {"ok": True, "id": record_id, "ref_id": ref.id, "deal_id": deal.id}


@app.delete("/api/community-sync/{entity_kind}/{entity_key}")
def archive_community_entity(entity_kind: str, entity_key: str, db: Session = Depends(get_db)):
    if entity_kind not in {"customer", "product", "deal", "document"}:
        raise HTTPException(404, "不支持这个归档类型")
    _archive(db, entity_kind, entity_key)
    db.commit()
    return {"ok": True, "archived": True, "kind": entity_kind, "key": entity_key}
