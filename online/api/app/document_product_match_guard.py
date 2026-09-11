from __future__ import annotations

import json
from types import ModuleType
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .product_memory import ProductBrainRecord


def _norm(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def _payload(row: ProductBrainRecord | None) -> dict[str, Any]:
    if not row:
        return {}
    try:
        decoded = json.loads(row.payload_json or "{}")
    except Exception:
        decoded = {}
    return decoded if isinstance(decoded, dict) else {}


def _identifier_values(row: ProductBrainRecord, payload: dict[str, Any]) -> set[str]:
    values = {
        _norm(row.brain_id),
        _norm(row.local_product_id),
        _norm(row.sku),
        _norm(payload.get("id")),
        _norm(payload.get("brain_id")),
        _norm(payload.get("local_product_id")),
        _norm(payload.get("sku")),
        _norm(payload.get("model")),
        _norm(payload.get("item_no")),
    }
    return {value for value in values if value}


def _name_values(row: ProductBrainRecord, payload: dict[str, Any]) -> set[str]:
    values = {
        _norm(row.name),
        _norm(payload.get("name")),
        _norm(payload.get("product_name")),
        _norm(payload.get("title")),
    }
    return {value for value in values if value}


def safe_match_product(
    db: Session,
    keyword: str,
) -> tuple[ProductBrainRecord | None, dict[str, Any]]:
    """Resolve a document product only when the identity is unambiguous.

    Existing explicit Deal→Product links remain authoritative and bypass this
    fallback entirely. This matcher is only used when a Deal has no explicit
    linked product and the document context must interpret free-text inquiry
    product data.

    Resolution order:
    1. unique exact stable identifier / SKU;
    2. unique exact product name;
    3. one and only one fuzzy name/SKU candidate;
    4. otherwise return no product and let the Deal's free-text keyword pass
       through unchanged rather than guessing a specification or variant.
    """

    needle = _norm(keyword)
    if not needle:
        return None, {}

    rows = db.scalars(
        select(ProductBrainRecord)
        .order_by(ProductBrainRecord.updated_at.desc(), ProductBrainRecord.id.desc())
        .limit(500)
    ).all()
    candidates: list[tuple[ProductBrainRecord, dict[str, Any], set[str], set[str]]] = []
    for row in rows:
        payload = _payload(row)
        candidates.append((row, payload, _identifier_values(row, payload), _name_values(row, payload)))

    identifier_exact = [item for item in candidates if needle in item[2]]
    if len(identifier_exact) == 1:
        row, payload, _, _ = identifier_exact[0]
        return row, payload
    if len(identifier_exact) > 1:
        return None, {}

    name_exact = [item for item in candidates if needle in item[3]]
    if len(name_exact) == 1:
        row, payload, _, _ = name_exact[0]
        return row, payload
    if len(name_exact) > 1:
        return None, {}

    fuzzy: list[tuple[ProductBrainRecord, dict[str, Any], set[str], set[str]]] = []
    for item in candidates:
        _, _, identifiers, names = item
        searchable = identifiers | names
        if any(needle in value or value in needle for value in searchable):
            fuzzy.append(item)
    if len(fuzzy) == 1:
        row, payload, _, _ = fuzzy[0]
        return row, payload
    return None, {}


def install_safe_document_product_match(document_context_module: ModuleType) -> None:
    """Replace only the document-context free-text fallback matcher."""

    current: Callable[..., Any] | None = getattr(document_context_module, "_match_product", None)
    if current is None or getattr(current, "_huidi_safe_product_match", False):
        return

    def guarded(db: Session, keyword: str):
        return safe_match_product(db, keyword)

    setattr(guarded, "_huidi_safe_product_match", True)
    setattr(guarded, "_huidi_safe_product_match_original", current)
    document_context_module._match_product = guarded
