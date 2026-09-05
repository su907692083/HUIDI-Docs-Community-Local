from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from . import main as main_owner
from .mail_sequences import MailSequenceTemplate
from .main import Base, Lead, SessionLocal, add_activity, engine, get_db
from .online_app import app

DATA_DIR = Path(__file__).resolve().parent / "data"
CATALOG_GLOB = "industry_catalog_v3_*.json"
EXPECTED_RECORDS = 143
EXPECTED_SELECTABLE = 135
EXPECTED_OVERVIEW = 8

SCENARIOS: tuple[tuple[str, str], ...] = (
    ("first-contact", "首次联系"),
    ("product-match", "产品匹配"),
    ("new-launch", "新品 / 项目机会"),
    ("sample-trial", "样品 / 试单"),
    ("technical-compliance", "技术 / 合规确认"),
    ("follow-up-value", "价值型跟进"),
    ("event-exhibition", "展会 / 活动后联系"),
    ("reactivation", "重新激活"),
    ("supplier-replacement", "第二供应源 / 替代供应"),
    ("quotation-followup", "报价后跟进"),
)

MATCH_ALIASES: dict[str, str] = {
    "hinge": "fasteners-fixings", "fastener": "fasteners-fixings", "bolt": "fasteners-fixings", "screw": "fasteners-fixings",
    "valve": "pumps-valves-fluid", "pump": "pumps-valves-fluid", "bearing": "bearings-power-transmission", "gear": "bearings-power-transmission",
    "cnc": "machine-tools-cnc", "lathe": "machine-tools-cnc", "milling": "machine-tools-cnc", "casting": "castings-forgings", "forging": "castings-forgings",
    "sheet metal": "sheet-metal-fabrication", "enclosure": "sheet-metal-fabrication", "cabinet": "sheet-metal-fabrication",
    "bathroom": "sanitaryware-bathroom", "faucet": "sanitaryware-bathroom", "shower": "sanitaryware-bathroom", "sanitary": "sanitaryware-bathroom",
    "packaging": "packaging-printing", "label": "packaging-printing", "solar": "solar-components", "battery": "batteries-energy-storage",
    "fabric": "fabrics-textile-materials", "textile": "fabrics-textile-materials", "garment": "garments-fashion", "apparel": "garments-fashion",
    "medical": "medical-chemical", "laboratory": "laboratory-research-supplies", "automotive": "automotive-parts", "auto parts": "automotive-parts",
    "logistics": "logistics-freight-services", "freight": "logistics-freight-services", "saas": "digital-services-software", "software": "digital-services-software",
    "hotel": "hotel-hospitality", "pet food": "pet-food-treats-finished", "fertilizer": "fertilizers-soil-inputs",
}


class LeadIndustryPreference(Base):
    __tablename__ = "lead_industry_preferences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), unique=True, index=True)
    industry_id: Mapped[str] = mapped_column(String(120), index=True)
    source: Mapped[str] = mapped_column(String(24), default="auto")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class IndustryPreferenceRequest(BaseModel):
    industry_id: str = Field(default="", max_length=120)
    auto: bool = False


@lru_cache(maxsize=1)
def industry_catalog() -> tuple[dict[str, Any], ...]:
    rows: list[dict[str, Any]] = []
    for path in sorted(DATA_DIR.glob(CATALOG_GLOB)):
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            rows.extend(x for x in data if isinstance(x, dict))
    ids = [str(x.get("id") or "") for x in rows]
    if len(rows) != EXPECTED_RECORDS or len(set(ids)) != EXPECTED_RECORDS:
        raise RuntimeError(f"HUIDI industry catalog incomplete: records={len(rows)} unique={len(set(ids))}")
    selectable = sum(1 for x in rows if bool(x.get("selectable")))
    overview = len(rows) - selectable
    if selectable != EXPECTED_SELECTABLE or overview != EXPECTED_OVERVIEW:
        raise RuntimeError(f"HUIDI industry catalog contract changed: selectable={selectable} overview={overview}")
    return tuple(rows)


def industry_stats() -> dict[str, Any]:
    rows = industry_catalog()
    families = sorted({str(x.get("family") or "其他") for x in rows})
    return {
        "records": len(rows), "selectable": sum(1 for x in rows if x.get("selectable")),
        "overview": sum(1 for x in rows if not x.get("selectable")), "families": len(families),
        "scenarios": len(SCENARIOS), "legacy_source": "HUIDI V3.x Owner industry taxonomy",
    }


def industry_by_id(industry_id: str, *, executable: bool = False) -> dict[str, Any]:
    key = str(industry_id or "").strip().lower()
    for row in industry_catalog():
        if str(row.get("id") or "").lower() == key:
            if executable and not row.get("selectable"):
                raise HTTPException(400, "这是行业概览，请选择下面更具体的专业行业后再生成邮件或跟进计划")
            return dict(row)
    raise HTTPException(404, "没有找到这个行业")


def _norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", str(value or "").lower()).strip()


def match_industry(text: str) -> tuple[dict[str, Any], int, list[str]]:
    hay = _norm(text)
    for alias, industry_id in MATCH_ALIASES.items():
        if alias in hay:
            return industry_by_id(industry_id, executable=True), 92, [f"匹配关键词：{alias}"]
    best: tuple[int, dict[str, Any], list[str]] | None = None
    for row in industry_catalog():
        if not row.get("selectable"):
            continue
        score = 0
        reasons: list[str] = []
        for label, weight in ((row.get("name"), 42), (row.get("short"), 36), (str(row.get("id") or "").replace("-", " "), 30)):
            token = _norm(label)
            if token and token in hay:
                score += weight; reasons.append(f"匹配行业：{label}")
        for value in list(row.get("products") or [])[:5]:
            token = _norm(value)
            if token and (token in hay or hay in token):
                score += 26; reasons.append(f"匹配产品：{value}"); break
        for value in list(row.get("customers") or [])[:4]:
            token = _norm(value)
            if token and token in hay:
                score += 14; reasons.append(f"匹配客户类型：{value}"); break
        if score and (best is None or score > best[0]):
            best = (score, dict(row), reasons)
    if best and best[0] >= 24:
        return best[1], min(99, best[0]), best[2]
    return industry_by_id("general-b2b", executable=True), 35, ["暂未识别到足够具体的专业行业，可手动更换"]


def _saved_preference(db: Session, lead_id: int) -> LeadIndustryPreference | None:
    return db.scalar(select(LeadIndustryPreference).where(LeadIndustryPreference.lead_id == lead_id))


def resolve_lead_industry(db: Session, lead: Lead) -> dict[str, Any]:
    pref = _saved_preference(db, lead.id)
    if pref:
        profile = industry_by_id(pref.industry_id, executable=True)
        return {"profile": profile, "source": pref.source, "confidence": 100 if pref.source == "user" else 80, "reasons": ["已保存到当前客户"]}
    profile, confidence, reasons = match_industry(" ".join([lead.market_keyword or "", lead.buyer_type or "", lead.reason or ""]))
    return {"profile": profile, "source": "auto", "confidence": confidence, "reasons": reasons}


def _risk_note(profile: dict[str, Any]) -> str:
    risk = str(profile.get("risk") or "standard")
    checks = "、".join(list(profile.get("checks") or [])[:4])
    if risk == "regulated-high":
        return f"这是高合规行业。只能表达可核验事实；发送前优先确认：{checks}。不要自动声称认证、许可、注册或性能已满足。"
    if risk in {"regulated", "compliance"}:
        return f"涉及合规要求，发送前确认：{checks}。不要把未核验文件写成已具备。"
    if risk in {"technical", "project"}:
        return f"优先围绕规格、图纸、应用或项目条件沟通：{checks}。"
    return "保持简短、具体、可回复，不制造虚假紧迫感。"


def industry_prompt_context(profile: dict[str, Any]) -> str:
    return (
        f"行业策略：{profile['name']}。\n"
        f"常见客户：{'、'.join(profile.get('customers') or [])}。\n"
        f"常见采购/决策岗位：{'、'.join(profile.get('roles') or [])}。\n"
        f"常见产品/服务：{'、'.join(profile.get('products') or [])}。\n"
        f"联系前应核对：{'、'.join(profile.get('checks') or [])}。\n"
        f"可用切入角度：{'、'.join(profile.get('angles') or [])}。\n"
        f"行业约束：{_risk_note(profile)}"
    )


def _scenario_copy(profile: dict[str, Any], scenario: str, role: str) -> dict[str, str]:
    role = role or (profile.get("roles") or ["Buyer"])[0]
    product = "{{product}}"
    checks = list(profile.get("checks") or [])
    check = checks[0] if checks else "specification"
    risk = str(profile.get("risk") or "standard")
    compliance_line = ""
    if risk in {"regulated-high", "regulated", "compliance"}:
        compliance_line = " I can also share the relevant specification and available compliance or quality documents for your review, without assuming they match your market until you confirm the requirement."
    copies = {
        "first-contact": (f"Quick fit check for {product}", f"Dear {{{{contact}}}},\n\nI am reaching out regarding {product}. For {profile['name']}, buyers usually care about {check} before discussing price. If this category is relevant to {{{{company}}}}, I can send only the matching specification, packing and commercial details for a quick review.{compliance_line}\n\nWould it be useful if I send the most relevant option?\n\nBest regards"),
        "product-match": (f"A specification check for {product}", f"Dear {{{{contact}}}},\n\nRather than sending a broad catalogue, I would like to check whether our {product} matches your current requirement. The key point I would confirm first is {check}. If you share the specification or application, I can reply with the closest option and the gaps, if any.\n\nBest regards"),
        "new-launch": (f"Support for an upcoming {product} project?", f"Dear {{{{contact}}}},\n\nIf {{{{company}}}} is preparing a new product, project or sourcing round around {product}, we can support a focused comparison instead of a generic introduction. I can prepare the relevant specification, sample route and delivery assumptions around your target application.\n\nIs there an upcoming requirement worth checking?\n\nBest regards"),
        "sample-trial": (f"Small sample / trial for {product}", f"Dear {{{{contact}}}},\n\nIf you prefer to validate before discussing a larger order, we can start with a controlled sample or small trial for {product}. We can align the sample around {check} and keep the next step clear before any scale-up.\n\nWould a small validation batch be useful?\n\nBest regards"),
        "technical-compliance": (f"Technical check before quoting {product}", f"Dear {{{{contact}}}},\n\nBefore quoting {product}, I would rather confirm the technical and compliance points that actually matter for {{{{company}}}}. A good starting point is {check}. We will not assume a certificate, standard or performance claim applies until the requirement is confirmed.\n\nCould you share the target specification or market requirement?\n\nBest regards"),
        "follow-up-value": (f"One useful follow-up on {product}", f"Dear {{{{contact}}}},\n\nA short follow-up on {product}: instead of repeating my previous introduction, I can send a side-by-side option based on your application, {check}, expected quantity and delivery need. That should make it easier to decide whether there is a real fit.\n\nWould you like that comparison?\n\nBest regards"),
        "event-exhibition": (f"Following up on {product} after the event", f"Dear {{{{contact}}}},\n\nFollowing the recent event / exhibition, I wanted to reconnect about {product}. If the category is relevant to your current sourcing, I can send a concise specification and sample route tailored to {{{{company}}}} rather than a general brochure.\n\nShall I send the short version?\n\nBest regards"),
        "reactivation": (f"Reopening the {product} discussion", f"Dear {{{{contact}}}},\n\nWe spoke previously about {product}. I do not want to restart with a long sales message, so I only wanted to check whether the category is relevant again. If priorities have changed, I can update the proposal around {check}, quantity and timing.\n\nIs this worth reopening now?\n\nBest regards"),
        "supplier-replacement": (f"Second-source option for {product}", f"Dear {{{{contact}}}},\n\nIf {{{{company}}}} is reviewing a second source or replacement supplier for {product}, we can begin with a controlled comparison rather than asking you to switch immediately. We can compare {check}, sample results, packing and lead time first.\n\nWould a second-source comparison be useful?\n\nBest regards"),
        "quotation-followup": (f"Any point to adjust in the {product} quotation?", f"Dear {{{{contact}}}},\n\nI am following up on the quotation for {product}. If the current offer does not fit, the most useful next step is to identify which condition needs adjustment — specification, quantity, packing, delivery or another point.\n\nWhich part should I revise first?\n\nBest regards"),
    }
    subject, body = copies.get(scenario, copies["first-contact"])
    return {"subject": subject, "body": body, "role": role}


def industry_templates(profile: dict[str, Any], role: str = "") -> list[dict[str, Any]]:
    roles = [role] if role else list(profile.get("roles") or ["Buyer"])[:3]
    out: list[dict[str, Any]] = []
    for scenario, label in SCENARIOS:
        for current_role in roles:
            copy = _scenario_copy(profile, scenario, current_role)
            out.append({"scenario": scenario, "scenario_name": label, **copy})
    return out


def _fallback_first_contact(lead: Lead, profile: dict[str, Any], language: str = "English") -> tuple[str, str]:
    copy = _scenario_copy(profile, "first-contact", (profile.get("roles") or ["Buyer"])[0])
    subject = copy["subject"].replace("{{product}}", lead.market_keyword or profile.get("short") or "your sourcing category")
    body = copy["body"]
    values = {"{{company}}": lead.company_name or "your company", "{{contact}}": lead.contact_name or "Team", "{{product}}": lead.market_keyword or profile.get("short") or "this category", "{{country}}": lead.country or "your market"}
    for key, value in values.items():
        body = body.replace(key, str(value))
    if language == "中文":
        subject = f"关于{lead.market_keyword or profile.get('short') or '当前品类'}的快速匹配确认"
        body = f"您好{lead.contact_name or '团队'}，\n\n想和您快速确认一下 {lead.market_keyword or profile.get('short') or '当前品类'} 是否与贵司目前采购相关。这个行业通常需要先确认{(profile.get('checks') or ['规格'])[0]}，再谈价格会更有效。如果方便，我可以只整理与您需求匹配的规格、包装和商务条件，不发大而全的资料。\n\n如果相关，我先发最匹配的一版给您确认。"
    return subject, body


def _industry_for_lead_without_request_db(lead: Lead) -> dict[str, Any]:
    db = SessionLocal()
    try:
        return resolve_lead_industry(db, lead)["profile"]
    finally:
        db.close()


_original_llm_draft = main_owner.llm_draft


async def _industry_aware_llm_draft(lead: Lead, req: Any) -> tuple[str, str]:
    profile = _industry_for_lead_without_request_db(lead)
    if not main_owner.LLM_API_KEY:
        return _fallback_first_contact(lead, profile, str(getattr(req, "language", "English") or "English"))
    summary = str(getattr(req, "product_summary", "") or "").strip()
    enriched = (summary + "\n\n" + industry_prompt_context(profile)).strip()
    if hasattr(req, "model_copy"):
        req = req.model_copy(update={"product_summary": enriched})
    return await _original_llm_draft(lead, req)


# Preserve the existing /api/leads/{lead_id}/draft route as the single draft owner.
# Only its content strategy is enriched with the verified legacy industry playbook.
main_owner.llm_draft = _industry_aware_llm_draft


@app.get("/api/industries")
def list_industries(q: str = Query(default="", max_length=120), include_overview: bool = True):
    query = _norm(q)
    rows = []
    for row in industry_catalog():
        if not include_overview and not row.get("selectable"):
            continue
        if query:
            hay = _norm(" ".join([str(row.get("name") or ""), str(row.get("short") or ""), str(row.get("family") or ""), " ".join(row.get("products") or [])]))
            if query not in hay:
                continue
        rows.append(row)
    return {"ok": True, "stats": industry_stats(), "items": rows}


@app.get("/api/industries/{industry_id}")
def get_industry(industry_id: str):
    profile = industry_by_id(industry_id)
    return {"ok": True, "profile": profile, "scenarios": [{"id": x, "name": n} for x, n in SCENARIOS]}


@app.get("/api/industries/{industry_id}/templates")
def get_industry_templates(industry_id: str, role: str = Query(default="", max_length=120)):
    profile = industry_by_id(industry_id, executable=True)
    return {"ok": True, "profile": profile, "templates": industry_templates(profile, role=role), "dynamic": True}


@app.get("/api/leads/{lead_id}/industry")
def get_lead_industry(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    resolved = resolve_lead_industry(db, lead)
    return {"ok": True, "lead_id": lead.id, **resolved, "risk_note": _risk_note(resolved["profile"])}


@app.put("/api/leads/{lead_id}/industry")
def set_lead_industry(lead_id: int, req: IndustryPreferenceRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    if req.auto:
        old = _saved_preference(db, lead.id)
        if old:
            db.delete(old); db.commit()
        resolved = resolve_lead_industry(db, lead)
        add_activity(db, lead.id, "industry_strategy_auto", "行业策略改为自动识别", resolved["profile"]["name"], {"industry_id": resolved["profile"]["id"]})
        db.commit()
        return {"ok": True, "lead_id": lead.id, **resolved, "risk_note": _risk_note(resolved["profile"])}
    profile = industry_by_id(req.industry_id, executable=True)
    row = _saved_preference(db, lead.id)
    if not row:
        row = LeadIndustryPreference(lead_id=lead.id, industry_id=profile["id"], source="user")
        db.add(row)
    else:
        row.industry_id = profile["id"]; row.source = "user"; row.updated_at = datetime.now(timezone.utc)
    add_activity(db, lead.id, "industry_strategy_selected", "已选择行业策略", profile["name"], {"industry_id": profile["id"]})
    db.commit()
    return {"ok": True, "lead_id": lead.id, "profile": profile, "source": "user", "confidence": 100, "reasons": ["人工选择"], "risk_note": _risk_note(profile)}


def _sequence_steps(profile: dict[str, Any]) -> list[dict[str, Any]]:
    schedule = [(0, "first-contact"), (96, "follow-up-value"), (216, "sample-trial"), (384, "reactivation")]
    role = (profile.get("roles") or ["Buyer"])[0]
    return [{"delay_hours": delay, **{k: v for k, v in _scenario_copy(profile, scenario, role).items() if k in {"subject", "body"}}} for delay, scenario in schedule]


@app.post("/api/leads/{lead_id}/industry-sequence")
def create_industry_sequence(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    resolved = resolve_lead_industry(db, lead)
    profile = industry_by_id(resolved["profile"]["id"], executable=True)
    name = f"行业跟进 · {profile.get('short') or profile['name']}"
    row = db.scalar(select(MailSequenceTemplate).where(MailSequenceTemplate.name == name))
    steps = _sequence_steps(profile)
    description = f"{profile['name']}：首次联系 → 4天价值跟进 → 9天样品/试单 → 16天重新确认。客户回复、退订或进入询盘后沿用现有自动停止规则。"
    if not row:
        row = MailSequenceTemplate(name=name, description=description, steps_json=json.dumps(steps, ensure_ascii=False), approved=0, enabled=1)
        db.add(row)
    else:
        row.description = description; row.steps_json = json.dumps(steps, ensure_ascii=False); row.approved = 0; row.enabled = 1; row.updated_at = datetime.now(timezone.utc)
    add_activity(db, lead.id, "industry_sequence_prepared", "已准备行业跟进计划", name, {"industry_id": profile["id"], "requires_review": True})
    db.commit(); db.refresh(row)
    return {"ok": True, "lead_id": lead.id, "industry": profile, "template_id": row.id, "template_name": row.name, "approved": False, "message": "行业跟进计划已放入现有自动跟进中，请检查并确认整套内容后再启用。"}
