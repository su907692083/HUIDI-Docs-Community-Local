from __future__ import annotations

from typing import Any

from sqlalchemy import select

from . import development_workflow as workflow_owner
from . import main as main_owner
from .industry_playbooks import _risk_note, industry_prompt_context, resolve_lead_industry
from .product_memory import ProductBrainRecord

SCHEMA = "huidi.community.outreach-variables/v1"
_original_context = workflow_owner.development_context
_original_llm_draft = main_owner.llm_draft


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _product(db, lead_id: int) -> dict[str, Any]:
    brain_id = workflow_owner._latest_product_context_id(db, lead_id)
    if not brain_id:
        return {}
    row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == brain_id))
    return workflow_owner._selected_product_payload(row) if row else {}


def _assessment(db, lead_id: int) -> dict[str, Any]:
    row = db.scalar(
        select(main_owner.LeadAssessment)
        .where(main_owner.LeadAssessment.lead_id == lead_id)
        .order_by(main_owner.LeadAssessment.id.desc())
    )
    if not row:
        return {}
    report = main_owner.safe_json(row.report_json, {})
    return {
        "confidence": row.confidence,
        "readiness": row.readiness,
        "positives": [_clean(x) for x in list(report.get("positives") or [])[:5] if _clean(x)],
        "gaps": [_clean(x) for x in list(report.get("gaps") or [])[:5] if _clean(x)],
    }


def _evidence(lead: main_owner.Lead) -> list[dict[str, str]]:
    rows = main_owner.safe_json(lead.evidence_json, [])
    if not isinstance(rows, list):
        return []
    out: list[dict[str, str]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        row = {
            "source": _clean(item.get("source") or item.get("provider") or "public_source")[:80],
            "title": _clean(item.get("title") or item.get("name"))[:240],
            "url": _clean(item.get("url") or item.get("link"))[:1000],
            "snippet": _clean(item.get("snippet") or item.get("detail") or item.get("text"))[:360],
        }
        if any(row.values()):
            out.append(row)
        if len(out) >= 5:
            break
    return out


def _touch(base: dict[str, Any]) -> dict[str, Any]:
    activities = list(base.get("activities") or [])
    deliveries = list(base.get("deliveries") or [])
    latest = activities[0] if activities else {}
    return {
        "lead_status": _clean((base.get("lead") or {}).get("status")),
        "latest_event": _clean(latest.get("event_type")),
        "latest_event_title": _clean(latest.get("title")),
        "sent_before": any(_clean(x.get("state")) == "sent" for x in deliveries),
    }


def _value(rows: list[dict[str, str]], key: str, value: Any, source: str) -> None:
    text = _clean(value)
    if text:
        rows.append({"key": key, "label": key, "value": text[:1000], "source": source})


def build_outreach_variables(db, lead: main_owner.Lead, base: dict[str, Any] | None = None) -> dict[str, Any]:
    base = base or {}
    product = _product(db, lead.id)
    assessment = _assessment(db, lead.id)
    if base.get("industry"):
        industry = dict(base.get("industry") or {})
        profile = dict(industry.get("profile") or {})
    else:
        industry = resolve_lead_industry(db, lead)
        profile = dict(industry.get("profile") or {})

    values: list[dict[str, str]] = []
    for key, value, source in (
        ("company", lead.company_name, "Lead"),
        ("contact", lead.contact_name, "Lead"),
        ("role", lead.contact_role, "Lead"),
        ("country", lead.country, "Lead"),
        ("buyer_type", lead.buyer_type, "Lead"),
        ("market_keyword", lead.market_keyword, "Lead"),
        ("product", product.get("name"), "Product Brain"),
        ("sku", product.get("sku"), "Product Brain"),
        ("spec", product.get("spec"), "Product Brain"),
        ("moq", product.get("moq"), "Product Brain"),
        ("lead_time", product.get("lead_time"), "Product Brain"),
        ("industry", profile.get("name"), "Industry Playbook"),
    ):
        _value(values, key, value, source)

    return {
        "schema": SCHEMA,
        "values": values,
        "product": product,
        "industry": {
            "id": _clean(profile.get("id")),
            "name": _clean(profile.get("name")),
            "confidence": industry.get("confidence"),
            "source": _clean(industry.get("source")),
            "checks": [_clean(x) for x in list(profile.get("checks") or [])[:4] if _clean(x)],
            "angles": [_clean(x) for x in list(profile.get("angles") or [])[:4] if _clean(x)],
            "risk_note": _clean(industry.get("risk_note") or _risk_note(profile)),
        },
        "assessment": assessment,
        "evidence": _evidence(lead),
        "touch_state": _touch(base),
        "safety": {
            "formal_price_excluded": True,
            "unverified_claims_forbidden": True,
            "human_review_required": True,
            "automatic_send": False,
        },
    }


def _development_context(db, lead: main_owner.Lead) -> dict[str, Any]:
    out = _original_context(db, lead)
    out["outreach_variables"] = build_outreach_variables(db, lead, out)
    return out


def _grounded_generation_summary(db, lead: main_owner.Lead, req: main_owner.DraftRequest) -> str:
    data = build_outreach_variables(db, lead)
    product = data["product"]
    assessment = data["assessment"]
    lines: list[str] = []
    if _clean(req.product_summary):
        lines.append("User-confirmed product summary: " + _clean(req.product_summary))
    facts = [
        _clean(product.get("name")),
        ("SKU " + _clean(product.get("sku"))) if _clean(product.get("sku")) else "",
        _clean(product.get("spec")),
        ("MOQ " + _clean(product.get("moq"))) if _clean(product.get("moq")) else "",
        ("Lead time " + _clean(product.get("lead_time"))) if _clean(product.get("lead_time")) else "",
    ]
    facts = [x for x in facts if x]
    if facts:
        lines.append("Saved seller product facts: " + " | ".join(facts))
    if _clean(product.get("summary")):
        lines.append("Saved seller context, non-price only: " + _clean(product.get("summary"))[:1800])

    industry = data["industry"]
    if industry.get("name"):
        profile = resolve_lead_industry(db, lead).get("profile") or {}
        lines.append(industry_prompt_context(profile))

    if assessment:
        lines.append(
            "Internal due-diligence readiness is only for tone selection and must not be disclosed: "
            + (_clean(assessment.get("readiness")) or "unverified")
        )
        if assessment.get("positives"):
            lines.append("Internal evidence signals, not prospect claims: " + " | ".join(assessment["positives"][:3]))
        if assessment.get("gaps"):
            lines.append("Known verification gaps: " + " | ".join(assessment["gaps"][:3]))

    if data["evidence"]:
        lines.append("Public evidence for cautious personalization:")
        for row in data["evidence"][:3]:
            text = " | ".join(x for x in (row.get("title"), row.get("snippet"), row.get("url")) if _clean(x))
            if text:
                lines.append("- " + text[:700])

    lines.extend(
        [
            "Target buyer type: " + (_clean(lead.buyer_type) or "unknown"),
            "Acquisition keyword: " + (_clean(lead.market_keyword) or "unknown"),
            "Safety: evidence and playbooks are context only. Never state unverified prospect facts, never mention internal scores, never introduce product/reference price, and require human review before send.",
        ]
    )
    return "\n".join(lines)[:7000]


async def _llm_draft(lead: main_owner.Lead, req: main_owner.DraftRequest) -> tuple[str, str]:
    from .provider_settings import resolve_provider

    if not resolve_provider("llm")["configured"]:
        return await _original_llm_draft(lead, req)
    db = main_owner.SessionLocal()
    try:
        current = db.get(main_owner.Lead, lead.id) or lead
        context = _grounded_generation_summary(db, current, req)
    finally:
        db.close()
    return await _original_llm_draft(lead, req.model_copy(update={"product_summary": context}))


workflow_owner.development_context = _development_context
main_owner.llm_draft = _llm_draft
