from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Float, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

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


class ConvertRequest(BaseModel):
    inquiry_title: str | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def clean_domain(url: str) -> str:
    try:
        value = url if "://" in url else "https://" + url
        host = urlparse(value).netloc.lower().split(":")[0]
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def score_result(item: dict[str, Any], req: LeadSearchRequest) -> tuple[float, str]:
    title = (item.get("title") or "").lower()
    snippet = (item.get("snippet") or "").lower()
    link = item.get("link") or ""
    text = f"{title} {snippet}"
    score = 45.0
    reasons: list[str] = []

    keyword_tokens = [x for x in re.split(r"\W+", req.product_keyword.lower()) if len(x) >= 3]
    matched = sum(1 for token in keyword_tokens if token in text)
    if matched:
        score += min(25, matched * 7)
        reasons.append("产品关键词匹配")

    buyer_tokens = [x for x in re.split(r"\W+", req.buyer_type.lower()) if len(x) >= 4]
    if any(token in text for token in buyer_tokens):
        score += 15
        reasons.append("买家类型匹配")

    if req.country and req.country.lower() in text:
        score += 8
        reasons.append("目标市场匹配")

    if link and clean_domain(link):
        score += 5
        reasons.append("存在独立网站")

    if any(word in text for word in ["manufacturer", "factory", "supplier"]):
        score -= 8
        reasons.append("可能偏供应端")

    return max(0, min(100, score)), " · ".join(reasons) or "搜索结果基础匹配"


async def serper_search(req: LeadSearchRequest) -> list[dict[str, Any]]:
    if not SERPER_API_KEY:
        raise HTTPException(503, "未配置 SERPER_API_KEY；当前只能使用演示线索。")

    query = " ".join(x for x in [req.product_keyword, req.buyer_type, req.country, "company"] if x)
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": min(req.limit * 2, 50)},
        )
        resp.raise_for_status()
        data = resp.json()
    return data.get("organic", [])


def demo_results(req: LeadSearchRequest) -> list[dict[str, Any]]:
    country = req.country or "Target Market"
    return [
        {
            "title": f"Demo Importer — {req.product_keyword}",
            "link": "https://example.com",
            "snippet": f"Demo only. {country} importer / distributor looking for {req.product_keyword} suppliers.",
        },
        {
            "title": f"Demo Distributor — {req.product_keyword}",
            "link": "https://example.org",
            "snippet": f"Demo only. Wholesale distribution company in {country}.",
        },
    ]


def lead_to_dict(x: Lead) -> dict[str, Any]:
    return {
        "id": x.id,
        "company_name": x.company_name,
        "domain": x.domain,
        "website": x.website,
        "country": x.country,
        "market_keyword": x.market_keyword,
        "buyer_type": x.buyer_type,
        "score": x.score,
        "reason": x.reason,
        "evidence": json.loads(x.evidence_json or "[]"),
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


app = FastAPI(title="HUIDI Docs Online", version="0.1.0")
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
        "version": "0.1.0",
        "search_provider": "serper" if SERPER_API_KEY else "demo",
        "llm": bool(LLM_API_KEY),
        "mail_send": False,
    }


@app.get("/api/leads")
def list_leads(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Lead).order_by(Lead.score.desc(), Lead.id.desc())
    if status:
        stmt = stmt.where(Lead.status == status)
    return [lead_to_dict(x) for x in db.scalars(stmt).all()]


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
        if existing:
            continue
        score, reason = score_result(item, req)
        lead = Lead(
            company_name=(item.get("title") or domain).split("|")[0].strip()[:255],
            domain=domain,
            website=link,
            country=req.country,
            market_keyword=req.product_keyword,
            buyer_type=req.buyer_type,
            score=score,
            reason=reason,
            evidence_json=json.dumps(
                [{"title": item.get("title"), "url": link, "snippet": item.get("snippet", "")}],
                ensure_ascii=False,
            ),
        )
        db.add(lead)
        created.append(lead)
        if len(created) >= req.limit:
            break

    db.commit()
    for lead in created:
        db.refresh(lead)
    return {"mode": "live" if SERPER_API_KEY else "demo", "items": [lead_to_dict(x) for x in created]}


@app.patch("/api/leads/{lead_id}")
def patch_lead(lead_id: int, patch: LeadPatch, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    allowed_status = {"new", "qualified", "contacted", "replied", "converted", "archived"}
    values = patch.model_dump(exclude_none=True)
    if "status" in values and values["status"] not in allowed_status:
        raise HTTPException(400, "无效线索状态")
    for key, value in values.items():
        setattr(lead, key, value)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead_to_dict(lead)


@app.post("/api/leads/{lead_id}/find-contact")
async def find_contact(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    if not SERPER_API_KEY:
        return {"mode": "demo", "message": "配置 SERPER_API_KEY 后可搜索公开采购联系人与业务邮箱。", "lead": lead_to_dict(lead)}

    query = f'site:{lead.domain} (procurement OR buyer OR sourcing OR purchasing OR contact OR sales) email'
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
        )
        resp.raise_for_status()
        results = resp.json().get("organic", [])

    email_rx = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
    candidates: list[str] = []
    evidence = json.loads(lead.evidence_json or "[]")
    for row in results:
        text = f"{row.get('title','')} {row.get('snippet','')}"
        candidates.extend(email_rx.findall(text))
        evidence.append({"title": row.get("title"), "url": row.get("link"), "snippet": row.get("snippet", "")})

    same_domain = []
    for email in dict.fromkeys(candidates):
        if email.lower().split("@")[-1] == lead.domain.lower():
            same_domain.append(email)
    if same_domain:
        lead.contact_email = same_domain[0]
    lead.evidence_json = json.dumps(evidence[-20:], ensure_ascii=False)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return {"mode": "live", "emails": same_domain, "lead": lead_to_dict(lead)}


async def llm_draft(lead: Lead, req: DraftRequest) -> tuple[str, str]:
    if not LLM_API_KEY:
        subject = f"Potential cooperation with {lead.company_name}"
        body = (
            f"Dear {lead.contact_name or 'Team'},\n\n"
            f"I am reaching out from {req.sender_company or 'our company'} regarding {req.product_summary or lead.market_keyword}. "
            f"I noticed {lead.company_name} while researching {lead.buyer_type or 'potential partners'} in {lead.country or 'your market'}.\n\n"
            "If this category is relevant to your current sourcing, I can send a concise quotation, specifications and packing details for review.\n\n"
            f"Best regards,\n{req.sender_name or 'Business Development'}\n{req.sender_company}\n{req.sender_email}\n{req.whatsapp}"
        )
        return subject, body

    prompt = f"""You are writing a concise B2B foreign-trade cold outreach email.
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
    db.commit()
    db.refresh(lead)
    return {"mode": "llm" if LLM_API_KEY else "fallback", "lead": lead_to_dict(lead)}


@app.post("/api/leads/{lead_id}/convert")
def convert_to_huidi(lead_id: int, req: ConvertRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")
    lead.status = "converted"
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "customer": {
            "name": lead.company_name,
            "country": lead.country,
            "website": lead.website,
            "email": lead.contact_email,
            "contact": lead.contact_name,
            "source": "HUIDI Online Lead Workbench",
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
    return {"service": "HUIDI Docs Online", "version": "0.1.0"}
