from __future__ import annotations

import re
from typing import Any


NORMALIZED_SCHEMA = "huidi.intelligence.normalized/v1"


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _scalar(value: Any) -> Any:
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value if value else None
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value).strip()
    return text or None


def _flatten(value: Any, path: tuple[str, ...] = ()) -> list[tuple[str, str, Any]]:
    rows: list[tuple[str, str, Any]] = []
    if isinstance(value, dict):
        for raw_key, child in value.items():
            name = str(raw_key)
            child_path = (*path, name)
            scalar = _scalar(child)
            if scalar is not None:
                rows.append((_key(name), _key(".".join(child_path)), scalar))
            rows.extend(_flatten(child, child_path))
    elif isinstance(value, (list, tuple)):
        for child in value[:200]:
            rows.extend(_flatten(child, path))
    return rows


def _find(rows: list[tuple[str, str, Any]], *aliases: str) -> Any:
    wanted = {_key(x) for x in aliases if x}
    for leaf, full, value in rows:
        if leaf in wanted or any(full.endswith(alias) for alias in wanted):
            return value
    return None


def _collect(rows: list[tuple[str, str, Any]], *aliases: str, limit: int = 12) -> list[Any]:
    wanted = {_key(x) for x in aliases if x}
    out: list[Any] = []
    seen: set[str] = set()
    for leaf, full, value in rows:
        if leaf not in wanted and not any(full.endswith(alias) for alias in wanted):
            continue
        marker = str(value).strip().lower()
        if not marker or marker in seen:
            continue
        seen.add(marker)
        out.append(value)
        if len(out) >= limit:
            break
    return out


def _put(target: dict[str, Any], key: str, value: Any) -> None:
    value = _scalar(value)
    if value is not None:
        target[key] = value


def _context(query: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "company",
        "domain",
        "country",
        "product",
        "hs_code",
        "origin",
        "destination",
        "departure_date",
        "container",
        "base",
        "quote",
        "amount",
        "keyword",
    }
    return {k: v for k, v in query.items() if k in allowed and _scalar(v) is not None}


def _company(rows: list[tuple[str, str, Any]]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    _put(facts, "legal_name", _find(rows, "legal_name", "registered_name", "company_name", "business_name", "name"))
    _put(facts, "registration_number", _find(rows, "registration_number", "registration_no", "company_number", "business_number"))
    _put(facts, "status", _find(rows, "registration_status", "company_status", "business_status", "status"))
    _put(facts, "country", _find(rows, "country", "country_name", "jurisdiction"))
    _put(facts, "address", _find(rows, "registered_address", "company_address", "address"))
    _put(facts, "website", _find(rows, "website", "website_url", "url"))
    _put(facts, "established_date", _find(rows, "established_date", "incorporation_date", "founded_date", "date_of_incorporation"))
    _put(facts, "industry", _find(rows, "industry", "industry_name", "business_scope"))
    _put(facts, "employee_count", _find(rows, "employee_count", "employees", "staff_count"))
    _put(facts, "credit_or_risk", _find(rows, "risk_level", "credit_rating", "credit_score", "risk"))
    return facts


def _trade(rows: list[tuple[str, str, Any]]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    _put(facts, "shipment_count", _find(rows, "shipment_count", "shipments", "trade_count", "record_count", "total_shipments"))
    _put(facts, "last_shipment_date", _find(rows, "last_shipment_date", "latest_shipment_date", "last_trade_date", "trade_date"))
    _put(facts, "total_value", _find(rows, "total_value", "trade_value", "total_amount", "value"))
    _put(facts, "currency", _find(rows, "currency", "currency_code"))
    lists = {
        "hs_codes": _collect(rows, "hs_code", "hscode", "commodity_code"),
        "products": _collect(rows, "product", "product_name", "description", "commodity"),
        "origins": _collect(rows, "origin", "origin_country", "export_country"),
        "destinations": _collect(rows, "destination", "destination_country", "import_country"),
        "suppliers": _collect(rows, "supplier", "supplier_name", "exporter", "shipper"),
        "buyers": _collect(rows, "buyer", "buyer_name", "importer", "consignee"),
    }
    facts.update({k: v for k, v in lists.items() if v})
    return facts


def _tariff(rows: list[tuple[str, str, Any]]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    _put(facts, "hs_code", _find(rows, "hs_code", "hscode", "commodity_code", "tariff_code"))
    _put(facts, "origin", _find(rows, "origin", "origin_country", "export_country"))
    _put(facts, "destination", _find(rows, "destination", "destination_country", "import_country"))
    _put(facts, "import_duty_rate", _find(rows, "import_duty_rate", "duty_rate", "tariff_rate", "customs_duty"))
    _put(facts, "vat_rate", _find(rows, "vat_rate", "import_vat", "vat"))
    _put(facts, "other_tax_rate", _find(rows, "other_tax_rate", "sales_tax", "gst_rate", "gst"))
    _put(facts, "effective_date", _find(rows, "effective_date", "valid_from", "date"))
    _put(facts, "description", _find(rows, "description", "product_description", "commodity_description"))
    return facts


def _fx(rows: list[tuple[str, str, Any]]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    for name, aliases in {
        "base": ("base", "base_currency"),
        "quote": ("quote", "quote_currency"),
        "rate": ("rate", "exchange_rate"),
        "amount": ("amount", "base_amount"),
        "converted": ("converted", "converted_amount", "quote_amount"),
        "date": ("date", "rate_date"),
    }.items():
        _put(facts, name, _find(rows, *aliases))
    return facts


def _shipping(rows: list[tuple[str, str, Any]]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    mapping = {
        "origin": ("origin", "origin_port", "pol", "port_of_loading"),
        "destination": ("destination", "destination_port", "pod", "port_of_discharge"),
        "carrier": ("carrier", "carrier_name", "shipping_line"),
        "service": ("service", "service_name", "route"),
        "vessel": ("vessel", "vessel_name"),
        "voyage": ("voyage", "voyage_number"),
        "etd": ("etd", "departure_date", "estimated_departure"),
        "eta": ("eta", "arrival_date", "estimated_arrival"),
        "transit_days": ("transit_days", "transit_time", "duration_days"),
        "container": ("container", "container_type"),
        "quote_amount": ("quote_amount", "freight", "price", "amount"),
        "currency": ("currency", "currency_code"),
    }
    for name, aliases in mapping.items():
        _put(facts, name, _find(rows, *aliases))
    return facts


def _market_news(result: Any) -> dict[str, Any]:
    items = result if isinstance(result, list) else (result.get("items") if isinstance(result, dict) else None)
    if not isinstance(items, list):
        return {}
    headlines = []
    for item in items[:8]:
        if not isinstance(item, dict):
            continue
        title = _scalar(item.get("title"))
        if not title:
            continue
        row = {"title": title}
        for key in ("source", "date", "link"):
            value = _scalar(item.get(key))
            if value is not None:
                row[key] = value
        headlines.append(row)
    return {"headlines": headlines} if headlines else {}


def _summary(kind: str, facts: dict[str, Any]) -> str:
    if not facts:
        return "已保存原始结果，暂未识别出可稳定复用的业务字段。"
    preferred = {
        "company": ["legal_name", "status", "country"],
        "trade": ["shipment_count", "last_shipment_date", "total_value"],
        "tariff": ["hs_code", "import_duty_rate", "vat_rate"],
        "fx": ["base", "quote", "rate", "date"],
        "shipping": ["origin", "destination", "carrier", "etd", "eta"],
        "market_news": ["headlines"],
    }.get(kind, list(facts)[:4])
    parts = []
    for key in preferred:
        if key not in facts:
            continue
        value = facts[key]
        if isinstance(value, list):
            value = f"{len(value)} 项"
        parts.append(f"{key}={value}")
        if len(parts) >= 4:
            break
    return " · ".join(parts) or "已识别可复用业务字段。"


def normalize_intelligence(kind: str, query: dict[str, Any], result: Any) -> dict[str, Any]:
    clean_kind = str(kind or "").strip().lower()
    rows = _flatten(result)
    if clean_kind == "company":
        facts = _company(rows)
    elif clean_kind == "trade":
        facts = _trade(rows)
    elif clean_kind == "tariff":
        facts = _tariff(rows)
    elif clean_kind == "fx":
        facts = _fx(rows)
    elif clean_kind == "shipping":
        facts = _shipping(rows)
    elif clean_kind == "market_news":
        facts = _market_news(result)
    else:
        facts = {}
    return {
        "schema": NORMALIZED_SCHEMA,
        "kind": clean_kind,
        "context": _context(query if isinstance(query, dict) else {}),
        "facts": facts,
        "has_business_facts": bool(facts),
        "summary": _summary(clean_kind, facts),
    }
