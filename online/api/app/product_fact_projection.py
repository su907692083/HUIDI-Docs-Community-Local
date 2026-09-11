from __future__ import annotations

import re
from typing import Any

from .product_memory import ProductBrainRecord, _row_payload


LIST_KEYS = ("certifications", "differentiators", "allowed_claims", "restricted_claims")


def _clean(value: Any, limit: int = 1000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _list(value: Any, limit: int = 8) -> list[str]:
    if isinstance(value, list):
        rows = value
    else:
        rows = re.split(r"[;；\n]+", str(value or ""))
    return list(dict.fromkeys(_clean(x, 320) for x in rows if _clean(x, 320)))[:limit]


def project_non_price_product_facts(source: ProductBrainRecord | dict[str, Any]) -> dict[str, Any]:
    """Project reusable technical/trade facts without reference/formal pricing.

    This is intentionally a projection, not an NPI/BOM owner. HUIDI keeps the
    existing Product Brain / Community Product as the authoritative product owner.
    """
    payload = _row_payload(source) if isinstance(source, ProductBrainRecord) else dict(source or {})
    identity = {
        "brain_id": _clean(payload.get("brain_id") or payload.get("id"), 160),
        "local_product_id": _clean(payload.get("local_product_id"), 160),
        "name": _clean(payload.get("name"), 255),
        "sku": _clean(payload.get("sku"), 160),
        "category": _clean(payload.get("category"), 160),
        "series": _clean(payload.get("series"), 160),
    }
    technical = {
        "spec": _clean(payload.get("spec") or payload.get("specification"), 1200),
        "material": _clean(payload.get("material") or payload.get("material_grade"), 320),
        "dimensions": _clean(payload.get("dimensions") or payload.get("size"), 320),
        "unit": _clean(payload.get("unit"), 40),
        "moq": _clean(payload.get("moq"), 160),
        "lead_time": _clean(payload.get("lead_time") or payload.get("delivery_time"), 160),
    }
    compliance = {
        "certifications": _list(payload.get("certifications")),
        "hs_code": _clean(payload.get("hs_code"), 80),
        "country_of_origin": _clean(payload.get("country_of_origin") or payload.get("origin"), 120),
    }
    packaging = {
        "package_type": _clean(payload.get("package_type"), 160),
        "carton_size": _clean(payload.get("carton_size"), 160),
        "qty_per_carton": _clean(payload.get("qty_per_carton"), 120),
        "cbm": _clean(payload.get("cbm"), 120),
        "gross_weight": _clean(payload.get("gross_weight"), 120),
        "net_weight": _clean(payload.get("net_weight"), 120),
    }
    positioning = {
        "differentiators": _list(payload.get("differentiators") or payload.get("selling_points")),
        "allowed_claims": _list(payload.get("allowed_claims")),
        "restricted_claims": _list(payload.get("restricted_claims")),
    }
    return {
        "schema": "huidi.product.non-price-facts/v1",
        "identity": identity,
        "technical": technical,
        "compliance": compliance,
        "packaging": packaging,
        "positioning": positioning,
        "guardrails": {
            "projection_only": True,
            "new_product_owner": False,
            "bom_owner": False,
            "reference_price_excluded": True,
            "formal_price_excluded": True,
        },
    }
