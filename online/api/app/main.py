from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .lead_engine import clean_domain, merge_evidence, score_search_result

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR.parent / "web"
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./huidi-online.db")
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "").strip()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    domain: Mapped[str] = mapped_column(String(255), default="", index=True)
    website: Mapped[str] = mapped_column(Text, default="")
    country: Mapped[str] = mapped_column(String(120), default="")
    market_keyword: Mapped[str] = mapped_column(String(255), default="")
    buyer_type: Mapped[str] = mapped_column(String(120), default="")
    score: Mapped[float] = mapped_column(Float, default=0)
    reason: Mapped[str] = mapped_column(Text, default="")
    evidence_json: Mapped[str] = mapped_column(Text, default="[]")
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    contact_role: Mapped[str] = mapped_column(String(255), default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    linkedin_url: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="new", index=True)
    draft_subject: Mapped[str] = mapped_column(Text, default="")
    draft_body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class LeadAssessment(Base):
    __tablename__ = "lead_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    readiness: Mapped[str] = mapped_column(String(40), default="insufficient")
    basic_score: Mapped[float] = mapped_column(Float, default=0)
    company_score: Mapped[float] = mapped_column(Float, default=0)
    contact_score: Mapped[float] = mapped_column(Float, default=0)
    digital_score: Mapped[float] = mapped_column(Float, default=0)
    trade_score: Mapped[float] = mapped_column(Float, default=0)
    fit_score: Mapped[float] = mapped_column(Float, default=0)
    report_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class LeadSearchRequest(BaseModel):
    product_keyword: str = Field(min_length=2, max_length=200)
    country: str = Field(default="", max_length=120)
    buyer_type: str = Field(default="importer distributor wholesaler", max_length=200)
    limit: int = Field(default=10, ge=1, le=30)


class LeadPatch(BaseModel):
    company_name: str | None = None
    country: str | None = None
    buyer_type: str | None = None
    contact_name: str | None = None
    contact_role: str | None = None
    contact_email: str | None = None
    linkedin_url: str | None = None
    status: str | None = None


class DraftRequest(BaseModel):
    language: str = "English"
    product_summary: str = ""
    sender_name: str = ""
    sender_company: str = ""
    sender_title: str = "Business Development Manager"
    sender_email: str = ""
    whatsapp: str = ""


class ApprovalRequest(BaseModel):
    approved: bool = True
    note: str = ""


class FollowupRequest(BaseModel):
    due_at: str
    note: str = ""


class ConvertRequest(BaseModel):
    inquiry_title: str | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def safe_json(value: str, fallback: Any):
    try:
        return json.loads(value or "")
    except Exception:
        return fallback


def add_activity(db: Session, lead_id: int, event_type: str, title: str, detail: str = "", payload: dict[str, Any] | None = None):
    db.add(
        LeadActivity(
            lead_id=lead_id,
            event_type=event_type,
            title=title,
            detail=detail,
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
        )
    )


def lead_to_dict(x: Lead, db: Session | None = None) -> dict[str, Any]:
    result = {
        "id": x.id,
        "company_name": x.company_name,
        "domain": x.domain,
        "website": x.website,
        "country": x.country,
        "market_keyword": x.market_keyword,
        "buyer_type": x.buyer_type,
        "score": x.score,
        "priority": "A" if x.score >= 78 else "B" if x.score >= 62 else "C" if x.score >= 46 else "D",
        "reason": x.reason,
        "evidence": safe_json(x.evidence_json, []),
        "contact_name": x.contact_name,
        "contact_role": x.contact_role,
        "contact_email": x.contact_email,
        "linkedin_url": x.linkedin_url,
        "status": x.status,
        "draft_subject": x.draft_subject,
        "draft_body": x.draft_body,
        "created_at": x.created_at.isoformat() if x.created_at else None,
        "updated_at": x.updated_at.isoformat() if x.updated_at else None,
    }
    if db:
        assessment = db.scalar(
            select(LeadAssessment).where(LeadAssessment.lead_id == x.id).order_by(LeadAssessment.id.desc())
        )
        if assessment:
            result["assessment"] = assessment_to_dict(assessment)
    return result


def assessment_to_dict(x: LeadAssessment) -> dict[str, Any]:
    return {
        "id": x.id,
        "lead_id": x.lead_id,
        "confidence": x.confidence,
        "readiness": x.readiness,
        "dimensions": {
            "basic": x.basic_score,
            "company": x.company_score,
            "contact": x.contact_score,
            "digital": x.digital_score,
            "trade": x.trade_score,
            "fit": x.fit_score,
        },
        "report": safe_json(x.report_json, {}),
        "created_at": x.created_at.isoformat() if x.created_at else None,
    }


def activity_to_dict(x: LeadActivity) -> dict[str, Any]:
    return {
        "id": x.id,
        "lead_id": x.lead_id,
        "event_type": x.event_type,
        "title": x.title,
        "detail": x.detail,
        "payload": safe_json(x.payload_json, {}),
        "created_at": x.created_at.isoformat() if x.created_at else None,
    }


async def serper_query(query: str, num: int = 10) -> list[dict[str, Any]]:
    if not SERPER_API_KEY:
        return []
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": min(num, 50)},
        )
        resp.raise_for_status()
        return resp.json().get("organic", [])


async def serper_search(req: LeadSearchRequest) -> list[dict[str, Any]]:
    query = " ".join(x for x in [req.product_keyword, req.buyer_type, req.country, "company"] if x)
    return await serper_query(query, min(req.limit * 3, 50))


def demo_results(req: LeadSearchRequest) -> list[dict[str, Any]]:
    country = req.country or "Target Market"
    return [
        {
            "title": f"Demo Importer — {req.product_keyword}",
            "link": "https://example.com",
            "snippet": f"Demo only. {country} importer and distributor looking for {req.product_keyword} suppliers.",
        },
        {
            "title": f"Demo Distributor — {req.product_keyword}",
            "link": "https://example.org",
            "snippet": f"Demo only. Wholesale distribution company in {country} sourcing {req.product_keyword}.",
        },
    ]


def build_due_diligence(lead: Lead) -> dict[str, Any]:
    """Build a conservative evidence-based assessment from data HUIDI actually has.

    Missing official registry/customs data is marked unverified instead of being scored as bad.
    This is a sales qualification aid, not a credit report or legal due-diligence opinion.
    """

    evidence = safe_json(lead.evidence_json, [])
    same_domain_email = bool(lead.contact_email and lead.domain and lead.contact_email.lower().endswith("@" + lead.domain.lower()))

    basic = min(100.0, 25 + (25 if lead.domain else 0) + (20 if lead.country else 0) + (30 if lead.contact_email else 0))
    company = min(100.0, 35 + (35 if lead.domain else 0) + min(30, len(evidence) * 5))
    contact = min(100.0, (35 if lead.contact_email else 0) + (25 if same_domain_email else 0) + (20 if lead.contact_name else 0) + (20 if lead.contact_role else 0))
    digital = min(100.0, (45 if lead.website else 0) + min(40, len(evidence) * 8) + (15 if lead.linkedin_url else 0))
    fit = max(0.0, min(100.0, lead.score))

    # Trade history must never be fabricated from ordinary web search evidence.
    trade = 0.0
    trade_status = "unverified"

    known_weights = {"basic": 0.20, "company": 0.25, "contact": 0.15, "digital": 0.15, "fit": 0.25}
    confidence = round(
        basic * known_weights["basic"]
        + company * known_weights["company"]
        + contact * known_weights["contact"]
        + digital * known_weights["digital"]
        + fit * known_weights["fit"],
        1,
    )

    if confidence >= 78 and lead.contact_email:
        readiness = "ready_to_contact"
    elif confidence >= 55:
        readiness = "verify_then_contact"
    else:
        readiness = "insufficient"

    gaps: list[str] = []
    if not lead.domain:
        gaps.append("未确认独立官网")
    if not lead.contact_email:
        gaps.append("未确认业务邮箱")
    if lead.contact_email and not same_domain_email:
        gaps.append("联系人邮箱与公司域名未匹配")
    if not lead.contact_name:
        gaps.append("未确认联系人姓名")
    if not lead.contact_role:
        gaps.append("未确认联系人岗位")
    gaps.append("工商/官方注册信息尚未接入验证")
    gaps.append("海关/真实采购历史尚未接入验证")

    positives: list[str] = []
    if lead.domain:
        positives.append("已发现独立域名")
    if len(evidence) >= 2:
        positives.append(f"已保留 {len(evidence)} 条公开来源证据")
    if same_domain_email:
        positives.append("业务邮箱与公司域名一致")
    if lead.score >= 62:
        positives.append("买家匹配优先级较高")

    return {
        "confidence": confidence,
        "readiness": readiness,
        "dimensions": {
            "basic": round(basic, 1),
            "company": round(company, 1),
            "contact": round(contact, 1),
            "digital": round(digital, 1),
            "trade": trade,
            "fit": round(fit, 1),
        },
        "trade_status": trade_status,
        "positives": positives,
        "gaps": gaps,
        "disclaimer": "当前结果只基于已保存的公开网页/联系信息做销售资格判断，不等同于信用报告、法律尽调或官方工商/海关核验。",
    }


app = FastAPI(title="HUIDI Docs Online", version="0.1.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "HUIDI Docs Online",
        "version": "0.1.1",
        "search_provider": "serper" if SERPER_API_KEY else "demo",
        "llm": bool(LLM_API_KEY),
        "mail_send": False,
        "due_diligence": "evidence_based_v0.1",
    }


@app.get("/api/leads")
def list_leads(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Lead).order_by(Lead.score.desc(), Lead.id.desc())
    if status:
        stmt = stmt.where(Lead.status == status)
    return [lead_to_dict(x, db) for x in db.scalars(stmt).all()]


@app.post("/api/leads/search")
async def search_leads(req: LeadSearchRequest, db: Session = Depends(get_db)):
    raw = await serper_search(req) if SERPER_API_KEY else demo_results(req)
    created: list[Lead] = []
    seen_domains: set[str] = set()

    for item in raw:
        link = item.get("link") or ""
        domain = clean_domain(link)
        if not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)
        existing = db.scalar(select(Lead).where(Lead.domain == domain))
        score, reason, breakdown, level = score_search_result(
            item,
            product_keyword=req.product_keyword,
            buyer_type=req.buyer_type,
            country=req.country,
        )
        score_evidence = {
            "title": item.get("title"),
            "url": link,
            "snippet": item.get("snippet", ""),
            "source": "serper" if SERPER_API_KEY else "demo",
            "score_breakdown": breakdown,
            "priority": level,
        }
        if existing:
            if score > existing.score:
                existing.score = score
                existing.reason = reason
                existing.market_keyword = req.product_keyword
                existing.buyer_type = req.buyer_type
                existing.country = req.country or existing.country
                existing.evidence_json = merge_evidence(existing.evidence_json, [score_evidence])
                existing.updated_at = datetime.now(timezone.utc)
            continue

        lead = Lead(
            company_name=(item.get("title") or domain).split("|")[0].strip()[:255],
            domain=domain,
            website=link,
            country=req.country,
            market_keyword=req.product_keyword,
            buyer_type=req.buyer_type,
            score=score,
            reason=reason,
            evidence_json=merge_evidence("[]", [score_evidence]),
        )
        db.add(lead)
        db.flush()
        add_activity(db, lead.id, "discovered", "发现潜在客户", f"优先级 {level} · 匹配分 {score}", {"breakdown": breakdown})
        created.append(lead)
        if len(created) >= req.limit:
            break

    db.commit()
    for lead in created:
        db.refresh(lead)
    return {"mode": "live" if SERPER_API_KEY else "demo", "items": [lead_to_dict(x, db) for x in created]}


@app.patch("/api/leads/{lead_id}")
def patch_lead(lead_id: int, patch: LeadPatch, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    allowed_status = {"new", "qualified", "contacted", "replied", "converted", "archived"}
    values = patch.model_dump(exclude_none=True)
    if "status" in values and values["status"] not in allowed_status:
        raise HTTPException(400, "无效线索状态")
    old_status = lead.status
    for key, value in values.items():
        setattr(lead, key, value)
    lead.updated_at = datetime.now(timezone.utc)
    if "status" in values and values["status"] != old_status:
        add_activity(db, lead.id, "status_changed", "状态变更", f"{old_status} → {values['status']}")
    db.commit()
    db.refresh(lead)
    return lead_to_dict(lead, db)


@app.post("/api/leads/{lead_id}/find-contact")
async def find_contact(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    if not SERPER_API_KEY:
        return {"mode": "demo", "message": "配置 SERPER_API_KEY 后可搜索公开采购联系人与业务邮箱。", "lead": lead_to_dict(lead, db)}

    query = f'site:{lead.domain} (procurement OR buyer OR sourcing OR purchasing OR contact OR sales) email'
    results = await serper_query(query, 12)
    email_rx = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
    candidates: list[str] = []
    rows: list[dict[str, Any]] = []
    for row in results:
        text = f"{row.get('title','')} {row.get('snippet','')}"
        candidates.extend(email_rx.findall(text))
        rows.append({"title": row.get("title"), "url": row.get("link"), "snippet": row.get("snippet", ""), "source": "contact_search"})

    same_domain = []
    for email in dict.fromkeys(candidates):
        if email.lower().split("@")[-1] == lead.domain.lower():
            same_domain.append(email)
    if same_domain:
        lead.contact_email = same_domain[0]
    lead.evidence_json = merge_evidence(lead.evidence_json, rows)
    lead.updated_at = datetime.now(timezone.utc)
    add_activity(db, lead.id, "contact_search", "查找公开联系人", f"发现 {len(same_domain)} 个同域邮箱", {"emails": same_domain[:10]})
    db.commit()
    db.refresh(lead)
    return {"mode": "live", "emails": same_domain, "lead": lead_to_dict(lead, db)}


@app.post("/api/leads/{lead_id}/assess")
def assess_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    report = build_due_diligence(lead)
    dims = report["dimensions"]
    row = LeadAssessment(
        lead_id=lead.id,
        confidence=report["confidence"],
        readiness=report["readiness"],
        basic_score=dims["basic"],
        company_score=dims["company"],
        contact_score=dims["contact"],
        digital_score=dims["digital"],
        trade_score=dims["trade"],
        fit_score=dims["fit"],
        report_json=json.dumps(report, ensure_ascii=False),
    )
    db.add(row)
    add_activity(db, lead.id, "assessment", "完成客户背调初筛", f"置信度 {report['confidence']} · {report['readiness']}")
    db.commit()
    db.refresh(row)
    return assessment_to_dict(row)


@app.get("/api/leads/{lead_id}/activities")
def list_activities(lead_id: int, db: Session = Depends(get_db)):
    if not db.get(Lead, lead_id):
        raise HTTPException(404, "线索不存在")
    rows = db.scalars(
        select(LeadActivity).where(LeadActivity.lead_id == lead_id).order_by(LeadActivity.id.desc())
    ).all()
    return [activity_to_dict(x) for x in rows]


async def llm_draft(lead: Lead, req: DraftRequest) -> tuple[str, str]:
    if not LLM_API_KEY:
        subject = f"Potential cooperation with {lead.company_name}"
        body = (
            f"Dear {lead.contact_name or 'Team'},\n\n"
            f"I am reaching out from {req.sender_company or 'our company'} regarding {req.product_summary or lead.market_keyword}. "
            f"I found {lead.company_name} while researching {lead.buyer_type or 'potential partners'} in {lead.country or 'your market'}.\n\n"
            "If this category is relevant to your current sourcing, I can send a concise quotation, specifications and packing details for review.\n\n"
            f"Best regards,\n{req.sender_name or 'Business Development'}\n{req.sender_company}\n{req.sender_email}\n{req.whatsapp}"
        )
        return subject, body

    prompt = f"""You are writing a concise B2B foreign-trade outreach email.
Language: {req.language}
Target company: {lead.company_name}
Country: {lead.country}
Website: {lead.website}
Lead reason: {lead.reason}
Contact: {lead.contact_name or 'unknown'}
Role: {lead.contact_role or 'unknown'}
Seller product: {req.product_summary or lead.market_keyword}
Sender: {req.sender_name}, {req.sender_title}, {req.sender_company}
Email: {req.sender_email}
WhatsApp: {req.whatsapp}

Rules:
- Do not invent facts about the prospect.
- Mention only evidence actually provided above.
- 80-140 words.
- One clear CTA.
- No exaggerated claims, fake urgency or deceptive subject lines.
- Write a draft for human review; do not imply it has already been sent.
Return strict JSON: {{"subject":"...","body":"..."}}
"""
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    data = json.loads(content)
    return data.get("subject", "Cooperation inquiry"), data.get("body", "")


@app.post("/api/leads/{lead_id}/draft")
async def create_draft(lead_id: int, req: DraftRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    subject, body = await llm_draft(lead, req)
    lead.draft_subject = subject
    lead.draft_body = body
    lead.updated_at = datetime.now(timezone.utc)
    add_activity(db, lead.id, "draft_created", "生成开发信草稿", subject, {"language": req.language})
    db.commit()
    db.refresh(lead)
    return {"mode": "llm" if LLM_API_KEY else "fallback", "lead": lead_to_dict(lead, db)}


@app.post("/api/leads/{lead_id}/draft-approval")
def approve_draft(lead_id: int, req: ApprovalRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    if not lead.draft_body:
        raise HTTPException(400, "还没有开发信草稿")
    event_type = "draft_approved" if req.approved else "draft_rejected"
    title = "开发信已确认" if req.approved else "开发信需修改"
    add_activity(db, lead.id, event_type, title, req.note, {"subject": lead.draft_subject})
    db.commit()
    return {"ok": True, "approved": req.approved}


@app.post("/api/leads/{lead_id}/followup")
def schedule_followup(lead_id: int, req: FollowupRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    add_activity(db, lead.id, "followup_scheduled", "安排跟进", req.note, {"due_at": req.due_at})
    db.commit()
    return {"ok": True, "due_at": req.due_at}


@app.post("/api/leads/{lead_id}/convert")
def convert_to_huidi(lead_id: int, req: ConvertRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    lead.status = "converted"
    lead.updated_at = datetime.now(timezone.utc)
    assessment = db.scalar(
        select(LeadAssessment).where(LeadAssessment.lead_id == lead.id).order_by(LeadAssessment.id.desc())
    )
    add_activity(db, lead.id, "converted", "转为 HUIDI 客户 + 询盘")
    db.commit()
    return {
        "customer": {
            "name": lead.company_name,
            "country": lead.country,
            "website": lead.website,
            "email": lead.contact_email,
            "contact": lead.contact_name,
            "source": "HUIDI Online Lead Workbench",
            "qualification_score": lead.score,
            "qualification_priority": "A" if lead.score >= 78 else "B" if lead.score >= 62 else "C" if lead.score >= 46 else "D",
            "assessment": assessment_to_dict(assessment) if assessment else None,
        },
        "inquiry": {
            "title": req.inquiry_title or f"{lead.company_name} · {lead.market_keyword}",
            "stage": "inquiry",
            "summary": lead.reason,
            "source_lead_id": lead.id,
        },
        "next": "quotation",
    }


if WEB_DIR.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIR), name="assets")


@app.get("/")
def home():
    index = WEB_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"service": "HUIDI Docs Online", "version": "0.1.1"}
