from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .industry_playbooks import SCENARIOS, _scenario_copy, resolve_lead_industry
from .main import Lead, add_activity, get_db
from .online_app import app


class IndustryDraftScenarioRequest(BaseModel):
    scenario: str = Field(default="first-contact", max_length=60)
    role: str = Field(default="", max_length=120)


def _fill(text: str, lead: Lead, short_name: str) -> str:
    values = {
        "{{company}}": lead.company_name or "your company",
        "{{contact}}": lead.contact_name or "Team",
        "{{product}}": lead.market_keyword or short_name or "this category",
        "{{country}}": lead.country or "your market",
    }
    for key, value in values.items():
        text = text.replace(key, str(value))
    return text.strip()


@app.post("/api/leads/{lead_id}/industry-draft")
def apply_industry_draft_scenario(lead_id: int, req: IndustryDraftScenarioRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这个客户")
    allowed = {key for key, _ in SCENARIOS}
    if req.scenario not in allowed:
        raise HTTPException(400, "请选择可用的邮件场景")
    resolved = resolve_lead_industry(db, lead)
    profile = resolved["profile"]
    if not profile.get("selectable"):
        raise HTTPException(400, "请先选择一个具体专业行业")
    role = req.role.strip() or (profile.get("roles") or ["Buyer"])[0]
    copy = _scenario_copy(profile, req.scenario, role)
    lead.draft_subject = _fill(copy["subject"], lead, profile.get("short") or "")
    lead.draft_body = _fill(copy["body"], lead, profile.get("short") or "")
    lead.updated_at = datetime.now(timezone.utc)
    add_activity(
        db,
        lead.id,
        "draft_created",
        "已套用行业邮件场景",
        lead.draft_subject,
        {"industry_id": profile["id"], "scenario": req.scenario, "role": role, "source": "industry_playbook"},
    )
    add_activity(
        db,
        lead.id,
        "draft_rejected",
        "草稿内容已更新，需要重新确认",
        "已切换行业邮件场景，请发送前重新检查整封邮件。",
        {"reason": "industry_scenario_applied"},
    )
    db.commit(); db.refresh(lead)
    return {
        "ok": True,
        "lead_id": lead.id,
        "industry": profile,
        "scenario": req.scenario,
        "role": role,
        "draft_subject": lead.draft_subject,
        "draft_body": lead.draft_body,
        "message": "已更新当前开发信草稿，请重新确认后再发送。",
    }
