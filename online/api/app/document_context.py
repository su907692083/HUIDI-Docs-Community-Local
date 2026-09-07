from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .business_center import (
    OnlineCustomer,
    OnlineDeal,
    OnlineDocumentRef,
    address_dict,
    customer_addresses,
    customer_dict,
    default_customer_address,
)
from .company_settings import setting_payload
from .main import Lead, get_db
from .online_app import app
from .product_memory import ProductBrainRecord


DOC_ORDER = [
    "quotation",
    "proforma_invoice",
    "sales_contract",
    "commercial_invoice",
    "packing_list",
]
ALLOWED_DOCUMENTS = set(DOC_ORDER)
COMMERCIAL_DOCUMENTS = [
    "quotation",
    "proforma_invoice",
    "sales_contract",
    "commercial_invoice",
]
DOCUMENT_CONTEXT_SCHEMA = "huidi.document.context/v1"
DRAFT_SCHEMA = "huidi.document.draft/v1"

# Fields saved on the existing OnlineDocumentRef row. Price fields are allowed
# because a user may explicitly enter and save them on the current document,
# but they are never included in automatic downstream inheritance.
DRAFT_FIELDS = {
    "seller",
    "seller_address",
    "seller_phone",
    "seller_email",
    "seller_tax_id",
    "buyer",
    "buyer_address_id",
    "buyer_address",
    "buyer_phone",
    "contact",
    "email",
    "country",
    "date",
    "product",
    "sku",
    "spec",
    "quantity",
    "unit_price",
    "total",
    "incoterm",
    "lead_time",
    "payment",
    "moq",
    "currency",
    "requirements",
    "terms",
    "bank_account_id",
    "bank_label",
    "bank_name",
    "bank_account_name",
    "bank_account_number",
    "bank_swift",
    "bank_address",
    "bank_currency",
    "packages",
    "net_weight",
    "gross_weight",
    "carton_size",
    "volume",
    "marks",
}
PRICE_FIELDS = {"unit_price", "total"}
INHERITABLE_FIELDS = DRAFT_FIELDS - PRICE_FIELDS - {"date"}
LONG_FIELDS = {"spec", "requirements", "terms", "seller_address", "buyer_address", "bank_address"}


class DocumentDraftRequest(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)


def _clean_fields(raw: dict[str, Any] | None) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in raw.items():
        name = str(key or "").strip()
        if name not in DRAFT_FIELDS:
            continue
        limit = 10000 if name in LONG_FIELDS else 2000
        out[name] = str(value or "")[:limit]
    return out


def load_document_fields(db: Session, ref_id: int) -> dict[str, str]:
    try:
        payload = db.execute(
            text("SELECT payload_json FROM online_document_refs WHERE id = :ref_id"),
            {"ref_id": int(ref_id)},
        ).scalar_one_or_none()
    except Exception:
        return {}
    if not payload:
        return {}
    try:
        decoded = json.loads(str(payload))
    except Exception:
        return {}
    return _clean_fields(decoded)


def save_document_fields(db: Session, ref: OnlineDocumentRef, fields: dict[str, Any]) -> dict[str, str]:
    cleaned = _clean_fields(fields)
    encoded = json.dumps(cleaned, ensure_ascii=False)
    now = datetime.now(timezone.utc)
    result = db.execute(
        text(
            "UPDATE online_document_refs "
            "SET payload_json = :payload_json, updated_at = :updated_at "
            "WHERE id = :ref_id"
        ),
        {"payload_json": encoded, "updated_at": now, "ref_id": int(ref.id)},
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(404, "没有找到这份单据")
    db.commit()
    return cleaned


def _product_payload(row: ProductBrainRecord | None) -> dict[str, Any]:
    if not row:
        return {}
    try:
        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    return payload if isinstance(payload, dict) else {}


def _first(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if value not in (None, "", [], {}):
            if isinstance(value, (list, tuple)):
                return ", ".join(str(x) for x in value if str(x).strip())
            if isinstance(value, dict):
                return "; ".join(f"{k}: {v}" for k, v in value.items() if str(v).strip())
            return str(value)
    return ""


def _quantity_candidate(requirements: str) -> str:
    text_value = str(requirements or "")
    patterns = [
        r"(?i)(?:qty|quantity|数量)\s*[:：]?\s*([\d,.]+\s*(?:pcs|pieces|sets|set|units|unit|件|套)?)",
        r"(?i)([\d,.]+\s*(?:pcs|pieces|sets|set|units|unit|件|套))",
    ]
    for pattern in patterns:
        hit = re.search(pattern, text_value)
        if hit:
            return hit.group(1).strip()
    return ""


def _incoterm_candidate(requirements: str) -> str:
    hit = re.search(
        r"(?i)\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b(?:\s+([A-Za-z][A-Za-z .-]{1,40}))?",
        str(requirements or ""),
    )
    if not hit:
        return ""
    return " ".join(part for part in hit.groups() if part).strip()


def _reuse_candidates(
    product_payload: dict[str, Any],
    requirements: str,
    inherited: dict[str, str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    def add(
        candidate_id: str,
        field: str,
        label: str,
        value: str,
        source: str,
        source_label: str,
        applies_to: list[str],
        *,
        default_selected: bool = False,
        confirmation_required: bool = False,
        seedable: bool = True,
        note: str = "",
    ) -> None:
        cleaned = str(value or "").strip()
        if not cleaned:
            return
        if field and field in inherited and str(inherited.get(field) or "").strip():
            return
        rows.append(
            {
                "id": candidate_id,
                "field": field,
                "label": label,
                "value": cleaned,
                "source": source,
                "source_label": source_label,
                "applies_to": applies_to,
                "default_selected": bool(default_selected and seedable),
                "confirmation_required": bool(confirmation_required),
                "seedable": bool(seedable and field in DRAFT_FIELDS and field not in PRICE_FIELDS),
                "note": note,
            }
        )

    add(
        "product-spec",
        "spec",
        "规格 / 描述",
        _first(product_payload, "specification", "spec", "specs", "material", "description"),
        "product_brain",
        "产品资料",
        DOC_ORDER,
        default_selected=True,
        note="稳定产品资料可直接复用，进入单据后仍可修改。",
    )
    add(
        "product-moq",
        "moq",
        "MOQ",
        _first(product_payload, "moq", "minimum_order_quantity"),
        "product_brain",
        "产品资料",
        DOC_ORDER,
        default_selected=True,
        note="复用产品资料中的 MOQ，不代表当前订单数量。",
    )
    add(
        "product-lead-time",
        "lead_time",
        "交期参考",
        _first(product_payload, "lead_time", "delivery_time", "delivery"),
        "product_brain",
        "产品资料",
        COMMERCIAL_DOCUMENTS,
        confirmation_required=True,
        note="交期会随订单变化，勾选代表本次业务确认采用。",
    )
    add(
        "inquiry-quantity",
        "quantity",
        "数量",
        _quantity_candidate(requirements),
        "inquiry",
        "询盘内容",
        COMMERCIAL_DOCUMENTS,
        confirmation_required=True,
        note="数量来自当前询盘内容，勾选后才提前写入单据草稿快照。",
    )
    add(
        "inquiry-incoterm",
        "incoterm",
        "贸易条款",
        _incoterm_candidate(requirements),
        "inquiry",
        "询盘内容",
        COMMERCIAL_DOCUMENTS,
        confirmation_required=True,
        note="贸易条款需按本次成交条件确认，不能由系统替你决定。",
    )
    carton_size = _first(
        product_payload,
        "carton_size",
        "carton_dimension",
        "carton_dimensions",
        "package_size",
        "packing_size",
    )
    add(
        "product-carton-size",
        "carton_size",
        "外箱 / 包装尺寸",
        carton_size,
        "product_brain",
        "产品包装资料",
        ["packing_list"],
        confirmation_required=True,
        note="仅在产品资料明确保存箱规时提供；装箱单仍需按本批次实际包装确认。",
    )
    add(
        "product-marks",
        "marks",
        "唛头",
        _first(product_payload, "shipping_marks", "marks", "marking", "mark"),
        "product_brain",
        "产品包装资料",
        ["packing_list"],
        confirmation_required=True,
        note="唛头经常按订单变化，勾选代表本批次确认采用。",
    )
    packing_reference = _first(product_payload, "packing", "packaging", "package")
    if packing_reference and packing_reference != carton_size:
        add(
            "product-packing-reference",
            "",
            "包装资料参考",
            packing_reference,
            "product_brain",
            "产品包装资料",
            ["packing_list"],
            confirmation_required=True,
            seedable=False,
            note="通用包装描述只展示供核对，不直接写成装箱单箱规、重量或件数。",
        )
    return rows


def _match_product(db: Session, keyword: str) -> tuple[ProductBrainRecord | None, dict[str, Any]]:
    term = str(keyword or "").strip()
    if not term:
        return None, {}
    rows = db.scalars(select(ProductBrainRecord).order_by(ProductBrainRecord.updated_at.desc()).limit(500)).all()
    lower = term.lower()
    for row in rows:
        if lower in str(row.name or "").lower() or lower in str(row.sku or "").lower():
            return row, _product_payload(row)
    return None, {}


def _doc_summary(db: Session, ref: OnlineDocumentRef) -> dict[str, Any]:
    fields = load_document_fields(db, ref.id)
    return {
        "id": ref.id,
        "document_type": ref.document_type,
        "document_id": ref.document_id,
        "state": ref.state,
        "title": ref.title,
        "has_saved_draft": bool(fields),
        "updated_at": ref.updated_at.isoformat() if ref.updated_at else None,
    }


def _deal_documents(db: Session, deal_id: int) -> list[OnlineDocumentRef]:
    return db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.deal_id == deal_id)
        .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
    ).all()


def _upstream_context(
    db: Session,
    deal: OnlineDeal,
    document: str,
    current_ref_id: int = 0,
) -> tuple[dict[str, str], dict[str, Any] | None, list[dict[str, Any]]]:
    try:
        target_index = DOC_ORDER.index(document)
    except ValueError:
        target_index = 0
    docs = _deal_documents(db, deal.id)
    latest_by_type: dict[str, OnlineDocumentRef] = {}
    for ref in docs:
        if current_ref_id and ref.id == current_ref_id:
            continue
        latest_by_type.setdefault(ref.document_type, ref)

    inherited: dict[str, str] = {}
    source: dict[str, Any] | None = None
    price_references: list[dict[str, Any]] = []
    for source_type in reversed(DOC_ORDER[:target_index]):
        ref = latest_by_type.get(source_type)
        if not ref:
            continue
        fields = load_document_fields(db, ref.id)
        if not fields:
            continue
        inherited = {
            key: value
            for key, value in fields.items()
            if key in INHERITABLE_FIELDS and str(value).strip()
        }
        source = _doc_summary(db, ref)
        price_values = {key: fields.get(key, "") for key in PRICE_FIELDS if fields.get(key, "").strip()}
        if price_values:
            price_references.append(
                {
                    "source": "upstream_document",
                    "document": source_type,
                    "document_id": ref.document_id,
                    **price_values,
                    "note": "上游单据已保存价格仅供核对，不自动写入当前正式价格。",
                }
            )
        break
    return inherited, source, price_references


def _customer_history(db: Session, deal: OnlineDeal) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(OnlineDeal)
        .where(OnlineDeal.customer_id == deal.customer_id)
        .where(OnlineDeal.id != deal.id)
        .order_by(OnlineDeal.updated_at.desc(), OnlineDeal.id.desc())
        .limit(12)
    ).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        docs = _deal_documents(db, row.id)
        out.append(
            {
                "id": row.id,
                "title": row.title,
                "stage": row.stage,
                "product_keyword": row.product_keyword,
                "requirements": row.requirements,
                "currency": row.currency,
                "amount_reference": row.amount if row.amount else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                "documents": [_doc_summary(db, ref) for ref in docs[:10]],
                "note": "历史业务金额只作返单/议价参考，不自动写入当前单据。",
            }
        )
    return out


def _master_fields(db: Session, customer: OnlineCustomer) -> tuple[dict[str, str], dict[str, Any]]:
    addresses = customer_addresses(db, customer.id)
    default_address = default_customer_address(db, customer.id)
    settings = setting_payload(db)
    default_bank = settings.get("default_bank_account") if isinstance(settings.get("default_bank_account"), dict) else None
    fields: dict[str, str] = {}
    seller_name = str(settings.get("legal_name") or settings.get("company_name") or "").strip()
    if seller_name:
        fields["seller"] = seller_name
    for source_key, field_key in [
        ("address", "seller_address"),
        ("phone", "seller_phone"),
        ("email", "seller_email"),
        ("tax_id", "seller_tax_id"),
    ]:
        value = str(settings.get(source_key) or "").strip()
        if value:
            fields[field_key] = value
    if default_address:
        fields["buyer_address_id"] = str(default_address.id)
        fields["buyer_address"] = str(address_dict(default_address).get("formatted") or "")
        if default_address.phone:
            fields["buyer_phone"] = default_address.phone
    elif customer.phone:
        fields["buyer_phone"] = customer.phone
    if default_bank:
        bank_map = {
            "id": "bank_account_id",
            "label": "bank_label",
            "bank_name": "bank_name",
            "account_name": "bank_account_name",
            "account_number": "bank_account_number",
            "swift_code": "bank_swift",
            "bank_address": "bank_address",
            "currency": "bank_currency",
        }
        for source_key, field_key in bank_map.items():
            value = str(default_bank.get(source_key) or "").strip()
            if value:
                fields[field_key] = value
    return fields, {
        "customer_addresses": [address_dict(x) for x in addresses],
        "default_customer_address": address_dict(default_address) if default_address else None,
        "seller_profile": {
            key: settings.get(key) or ""
            for key in ("company_name", "legal_name", "country", "address", "website", "phone", "email", "tax_id")
        },
        "bank_accounts": settings.get("bank_accounts") or [],
        "default_bank_account": default_bank,
    }


def build_document_context(
    db: Session,
    deal: OnlineDeal,
    document: str,
    current_ref_id: int = 0,
) -> dict[str, Any]:
    if document not in ALLOWED_DOCUMENTS:
        raise HTTPException(400, "不支持这个单据类型")
    customer = db.get(OnlineCustomer, deal.customer_id)
    if not customer:
        raise HTTPException(404, "没有找到对应客户")
    lead = db.get(Lead, deal.source_lead_id) if deal.source_lead_id else None
    product, product_payload = _match_product(db, deal.product_keyword)
    docs = _deal_documents(db, deal.id)
    inherited, inherited_from, price_references = _upstream_context(
        db, deal, document, current_ref_id=current_ref_id
    )
    master_fields, master_data = _master_fields(db, customer)
    product_reference_price = _first(product_payload, "reference_price", "price", "unit_price")
    if product_reference_price:
        price_references.insert(
            0,
            {
                "source": "product_brain",
                "value": product_reference_price,
                "note": "产品资料参考价只供核对，不自动写入正式单价。",
            },
        )

    history = _customer_history(db, deal)
    for item in history:
        if item.get("amount_reference"):
            price_references.append(
                {
                    "source": "customer_history",
                    "deal_id": item["id"],
                    "currency": item.get("currency"),
                    "amount": item.get("amount_reference"),
                    "note": "历史成交/业务金额只供返单参考，不自动写入当前单据。",
                }
            )

    connected_reference: dict[str, Any]
    try:
        from .deal_reference import build_deal_reference

        connected_reference = build_deal_reference(db, deal, document)
    except Exception:
        connected_reference = {
            "has_reference": False,
            "references": [],
            "missing": [],
            "suggestions": [],
            "note": "联网参考暂不可用，不影响当前单据。",
        }

    addresses = master_data["customer_addresses"]
    banks = master_data["bank_accounts"]
    inquiry_text = deal.requirements or (lead.reason if lead else "")
    reuse_candidates = _reuse_candidates(product_payload, inquiry_text, inherited)
    return {
        "schema": DOCUMENT_CONTEXT_SCHEMA,
        "deal_id": deal.id,
        "document": document,
        "customer": customer_dict(customer),
        "inquiry": {
            "source_lead_id": deal.source_lead_id,
            "title": deal.title,
            "stage": deal.stage,
            "currency": deal.currency,
            "formal_amount": deal.amount,
            "product_keyword": deal.product_keyword,
            "requirements": deal.requirements,
            "lead_reason": lead.reason if lead else "",
            "market_keyword": lead.market_keyword if lead else deal.product_keyword,
            "quantity_candidate": _quantity_candidate(inquiry_text),
            "incoterm_candidate": _incoterm_candidate(inquiry_text),
        },
        "product": {
            "brain_id": product.brain_id if product else "",
            "name": product.name if product else deal.product_keyword,
            "sku": product.sku if product else "",
            "specification": _first(product_payload, "specification", "spec", "specs", "material", "description"),
            "moq": _first(product_payload, "moq", "minimum_order_quantity"),
            "lead_time": _first(product_payload, "lead_time", "delivery_time", "delivery"),
            "packing": _first(product_payload, "packing", "packaging", "package"),
            "reference_price": product_reference_price,
            "reference_price_note": "仅供核对，不自动写入正式单价。" if product_reference_price else "",
        },
        "reuse_candidates": reuse_candidates,
        "reuse_policy": {
            "default_selected": [item["id"] for item in reuse_candidates if item.get("default_selected")],
            "requires_confirmation": [item["id"] for item in reuse_candidates if item.get("confirmation_required")],
            "never_auto_fields": sorted(PRICE_FIELDS),
            "note": "产品稳定主数据可默认复用；数量、贸易条款、交期、箱规和唛头等订单相关事实需要本次业务确认。价格永远不在这组复用候选里。",
        },
        "current_documents": [_doc_summary(db, ref) for ref in docs],
        "inherited_fields": inherited,
        "inherited_from": inherited_from,
        "master_fields": master_fields,
        "master_data": master_data,
        "price_references": price_references,
        "customer_history": history,
        "connected_reference": connected_reference,
        "availability": {
            "customer_address_history": {
                "available": bool(addresses),
                "count": len(addresses),
                "reason": "读取正式客户地址历史。" if addresses else "客户还没有保存地址，可在正式客户详情中补充。",
            },
            "seller_bank_accounts": {
                "available": bool(banks),
                "count": len(banks),
                "reason": "读取公司设置中的收款账户。" if banks else "公司还没有保存收款账户，可在公司设置中补充。",
            },
        },
        "note": "同一 Deal 的客户、询盘、产品、客户地址、公司资料和已保存单据可联动复用；价格、历史金额和联网资料都只作参考，不会自动改写正式单价或 deal.amount。",
    }


@app.get("/api/business/deals/{deal_id}/document-context")
def document_context(
    deal_id: int,
    document: str = Query(default="quotation", max_length=80),
    current_ref_id: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔业务")
    return build_document_context(db, deal, document.strip(), current_ref_id=current_ref_id)


@app.get("/api/business/documents/{ref_id}/draft")
def get_document_draft(ref_id: int, db: Session = Depends(get_db)):
    ref = db.get(OnlineDocumentRef, ref_id)
    if not ref:
        raise HTTPException(404, "没有找到这份单据")
    return {
        "schema": DRAFT_SCHEMA,
        "ref_id": ref.id,
        "deal_id": ref.deal_id,
        "document_type": ref.document_type,
        "fields": load_document_fields(db, ref.id),
    }


@app.put("/api/business/documents/{ref_id}/draft")
def put_document_draft(ref_id: int, req: DocumentDraftRequest, db: Session = Depends(get_db)):
    ref = db.get(OnlineDocumentRef, ref_id)
    if not ref:
        raise HTTPException(404, "没有找到这份单据")
    deal = db.get(OnlineDeal, ref.deal_id)
    before_amount = deal.amount if deal else None
    fields = save_document_fields(db, ref, req.fields)
    if deal is not None and deal.amount != before_amount:
        raise RuntimeError("保存单据草稿不得修改 deal.amount")
    return {
        "ok": True,
        "schema": DRAFT_SCHEMA,
        "ref_id": ref.id,
        "deal_id": ref.deal_id,
        "document_type": ref.document_type,
        "fields": fields,
        "note": "草稿已保存到当前 OnlineDocumentRef；价格不会自动写回询盘金额或产品参考价。",
    }


@app.patch("/api/business/documents/{ref_id}/draft")
def patch_document_draft(ref_id: int, req: DocumentDraftRequest, db: Session = Depends(get_db)):
    ref = db.get(OnlineDocumentRef, ref_id)
    if not ref:
        raise HTTPException(404, "没有找到这份单据")
    incoming = _clean_fields(req.fields)
    forbidden = sorted(PRICE_FIELDS.intersection(incoming))
    if forbidden:
        raise HTTPException(400, "复用预填不得写入正式单价或总金额")
    deal = db.get(OnlineDeal, ref.deal_id)
    before_amount = deal.amount if deal else None
    existing = load_document_fields(db, ref.id)
    merged = {**existing, **incoming}
    fields = save_document_fields(db, ref, merged)
    if deal is not None and deal.amount != before_amount:
        raise RuntimeError("复用预填不得修改 deal.amount")
    return {
        "ok": True,
        "schema": DRAFT_SCHEMA,
        "ref_id": ref.id,
        "deal_id": ref.deal_id,
        "document_type": ref.document_type,
        "fields": fields,
        "patched_fields": sorted(incoming),
        "note": "只合并本次确认的非价格复用字段；已有草稿和人工正式价格保持不变。",
    }
