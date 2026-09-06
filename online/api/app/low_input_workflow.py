from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .business_center import OnlineDeal, deal_dict, upsert_from_lead
from .mail_sync import MailboxMessage
from .main import Lead, LeadActivity, add_activity, get_db, safe_json
from .online_app import app
from .product_memory import ProductBrainRecord, _row_payload


class PrepareInquiryRequest(BaseModel):
    confirm: bool = False
    product_brain_id: str = Field(default="", max_length=160)
    include_reply: bool = True


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _tokens(value: str) -> list[str]:
    text = _clean(value).lower()
    if not text:
        return []
    parts = re.split(r"[^a-z0-9\u4e00-\u9fff]+", text)
    return [x for x in parts if len(x) >= 2]


def _product_payload(row: ProductBrainRecord) -> dict[str, Any]:
    payload = _row_payload(row)
    payload["brain_id"] = _clean(payload.get("brain_id") or payload.get("id") or row.brain_id)
    return payload


def _product_summary(payload: dict[str, Any]) -> str:
    rows: list[str] = []
    name = _clean(payload.get("name"))
    sku = _clean(payload.get("sku"))
    spec = _clean(payload.get("spec") or payload.get("specification"))
    moq = _clean(payload.get("moq"))
    lead_time = _clean(payload.get("lead_time") or payload.get("delivery_time"))
    certifications = payload.get("certifications") or []
    differentiators = payload.get("differentiators") or payload.get("selling_points") or []
    if isinstance(certifications, str):
        certifications = [x.strip() for x in re.split(r"[;；\n]", certifications) if x.strip()]
    if isinstance(differentiators, str):
        differentiators = [x.strip() for x in re.split(r"[;；\n]", differentiators) if x.strip()]
    if name:
        rows.append(f"Product: {name}{f' ({sku})' if sku else ''}")
    if spec:
        rows.append(f"Specification: {spec}")
    if moq:
        rows.append(f"MOQ: {moq}")
    if lead_time:
        rows.append(f"Lead time: {lead_time}")
    if certifications:
        rows.append("Certifications: " + ", ".join(_clean(x) for x in certifications[:6] if _clean(x)))
    if differentiators:
        rows.append("Selling points: " + "; ".join(_clean(x) for x in differentiators[:6] if _clean(x)))
    return "\n".join(rows).strip()[:2400]


def _product_score(payload: dict[str, Any], lead: Lead) -> int:
    keyword = _clean(lead.market_keyword).lower()
    if not keyword:
        return 0
    name = _clean(payload.get("name")).lower()
    sku = _clean(payload.get("sku")).lower()
    category = _clean(payload.get("category")).lower()
    series = _clean(payload.get("series")).lower()
    targets = payload.get("target_keywords") or payload.get("keywords") or []
    if isinstance(targets, str):
        targets = re.split(r"[;；,，\n]", targets)
    haystack = " ".join([name, sku, category, series, *[_clean(x).lower() for x in targets]])
    score = 0
    if keyword and keyword in haystack:
        score += 12
    if name and (name in keyword or keyword in name):
        score += 10
    for token in _tokens(keyword):
        if token in haystack:
            score += 3
    return score


def _latest_selected_product_id(db: Session, lead_id: int) -> str:
    row = db.scalar(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .where(LeadActivity.event_type == "product_context_selected")
        .order_by(LeadActivity.id.desc())
    )
    if not row:
        return ""
    return _clean(safe_json(row.payload_json, {}).get("product_brain_id"))


def _product_candidates(db: Session, lead: Lead) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    rows = db.scalars(select(ProductBrainRecord).order_by(ProductBrainRecord.updated_at.desc()).limit(300)).all()
    selected_id = _latest_selected_product_id(db, lead.id)
    ranked: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        payload = _product_payload(row)
        score = _product_score(payload, lead)
        if selected_id and row.brain_id == selected_id:
            score += 1000
        ranked.append((score, payload))
    ranked.sort(key=lambda x: x[0], reverse=True)
    choices: list[dict[str, Any]] = []
    for score, payload in ranked[:5]:
        if score <= 0 and len(rows) > 1:
            continue
        choices.append(
            {
                "brain_id": _clean(payload.get("brain_id") or payload.get("id")),
                "name": _clean(payload.get("name")),
                "sku": _clean(payload.get("sku")),
                "spec": _clean(payload.get("spec") or payload.get("specification")),
                "moq": _clean(payload.get("moq")),
                "lead_time": _clean(payload.get("lead_time") or payload.get("delivery_time")),
                "price": payload.get("price", ""),
                "price_range": _clean(payload.get("price_range")),
                "currency": _clean(payload.get("currency") or "USD"),
                "unit": _clean(payload.get("unit") or "PCS"),
                "summary": _product_summary(payload),
                "match_score": score if score < 1000 else score - 1000,
                "selected": bool(selected_id and _clean(payload.get("brain_id") or payload.get("id")) == selected_id),
            }
        )
    if not choices and len(rows) == 1:
        payload = _product_payload(rows[0])
        choices.append(
            {
                "brain_id": rows[0].brain_id,
                "name": _clean(payload.get("name")),
                "sku": _clean(payload.get("sku")),
                "spec": _clean(payload.get("spec") or payload.get("specification")),
                "moq": _clean(payload.get("moq")),
                "lead_time": _clean(payload.get("lead_time") or payload.get("delivery_time")),
                "price": payload.get("price", ""),
                "price_range": _clean(payload.get("price_range")),
                "currency": _clean(payload.get("currency") or "USD"),
                "unit": _clean(payload.get("unit") or "PCS"),
                "summary": _product_summary(payload),
                "match_score": 1,
                "selected": False,
            }
        )
    preferred = next((x for x in choices if x.get("selected")), None)
    if not preferred and choices and int(choices[0].get("match_score") or 0) >= 3:
        preferred = choices[0]
    return preferred, choices


def _latest_reply(db: Session, lead_id: int) -> MailboxMessage | None:
    return db.scalar(
        select(MailboxMessage)
        .where(MailboxMessage.lead_id == lead_id)
        .where(MailboxMessage.direction == "incoming")
        .order_by(MailboxMessage.received_at.desc(), MailboxMessage.id.desc())
    )


def _sentence_hits(text: str, patterns: list[str], limit: int = 2) -> list[str]:
    rows = re.split(r"(?<=[.!?。！？;；])\s*|\r?\n+", text)
    hits: list[str] = []
    for row in rows:
        clean = _clean(row)
        if not clean:
            continue
        low = clean.lower()
        if any(re.search(pattern, low, re.I) for pattern in patterns):
            hits.append(clean[:260])
        if len(hits) >= limit:
            break
    return hits


def extract_reply_facts(subject: str, snippet: str) -> dict[str, Any]:
    """Extract only explicit customer wording; never infer missing commercial facts."""
    text = _clean("\n".join(x for x in [_clean(subject), _clean(snippet)] if x))[:5000]
    if not text:
        return {"facts": [], "excerpt": "", "missing": ["数量", "规格", "贸易条款", "交付要求"]}
    facts: list[dict[str, str]] = []

    quantities: list[str] = []
    for value, unit in re.findall(
        r"(?<![A-Za-z0-9])([0-9][0-9,]*(?:\.[0-9]+)?)\s*(pcs?|pieces?|units?|sets?|cartons?|ctns?|kg|kgs|tons?|tonnes?|mt|containers?|20gp|40hq|件|套|箱|公斤|千克|吨)(?![A-Za-z])",
        text,
        re.I,
    ):
        item = f"{value} {unit}"
        if item.lower() not in {x.lower() for x in quantities}:
            quantities.append(item)
    if quantities:
        facts.append({"key": "quantity", "label": "数量", "value": " / ".join(quantities[:3]), "source": "客户原话"})

    terms = []
    for term in re.findall(r"\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b", text, re.I):
        t = term.upper()
        if t not in terms:
            terms.append(t)
    if terms:
        facts.append({"key": "incoterm", "label": "贸易条款", "value": " / ".join(terms[:2]), "source": "客户原话"})

    price_match = re.search(
        r"(?:target|expected|desired)\s+price\s*(?:is|:|=)?\s*([^\n,.;]{1,40})|(?:目标价|目标价格|期望价格)\s*[：:=]?\s*([^\n，。；]{1,40})",
        text,
        re.I,
    )
    if price_match:
        value = _clean(price_match.group(1) or price_match.group(2))
        if value:
            facts.append({"key": "target_price", "label": "目标价", "value": value, "source": "客户原话"})

    spec_hits = _sentence_hits(
        text,
        [r"\bspec(?:ification)?s?\b", r"\bsize\b", r"\bdimension", r"\bmaterial\b", r"\bgrade\b", r"规格", r"尺寸", r"材质", r"型号"],
        2,
    )
    if spec_hits:
        facts.append({"key": "specification", "label": "规格原话", "value": " / ".join(spec_hits), "source": "客户原话"})

    delivery_hits = _sentence_hits(
        text,
        [r"\bdelivery\b", r"\blead\s*time\b", r"\bship(?:ping)?\s+to\b", r"\bdestination\b", r"\bport\b", r"交期", r"交货", r"目的港", r"送到"],
        2,
    )
    if delivery_hits:
        facts.append({"key": "delivery", "label": "交付要求", "value": " / ".join(delivery_hits), "source": "客户原话"})

    if re.search(r"\bsamples?\b|样品|寄样", text, re.I):
        sample_hits = _sentence_hits(text, [r"\bsamples?\b", r"样品", r"寄样"], 1)
        facts.append({"key": "sample", "label": "样品", "value": sample_hits[0] if sample_hits else "客户提到样品", "source": "客户原话"})

    present = {x["key"] for x in facts}
    missing = []
    for key, label in [("quantity", "数量"), ("specification", "规格"), ("incoterm", "贸易条款"), ("delivery", "交付要求")]:
        if key not in present:
            missing.append(label)
    excerpt = _clean(snippet or subject)[:700]
    return {"facts": facts, "excerpt": excerpt, "missing": missing}


def _context(db: Session, lead: Lead) -> dict[str, Any]:
    preferred, candidates = _product_candidates(db, lead)
    reply = _latest_reply(db, lead.id)
    reply_info = extract_reply_facts(reply.subject, reply.snippet) if reply else {"facts": [], "excerpt": "", "missing": []}
    existing_deal = db.scalar(select(OnlineDeal).where(OnlineDeal.source_lead_id == lead.id))
    follow = (datetime.now(timezone.utc) + timedelta(days=4)).astimezone().replace(tzinfo=None).isoformat(timespec="minutes")
    return {
        "lead_id": lead.id,
        "lead_status": lead.status,
        "product": preferred,
        "product_candidates": candidates,
        "draft_product_summary": preferred.get("summary", "") if preferred else "",
        "latest_reply": {
            "id": reply.id,
            "subject": reply.subject,
            "received_at": reply.received_at.isoformat() if reply.received_at else None,
            **reply_info,
        }
        if reply
        else None,
        "existing_deal": deal_dict(existing_deal, db) if existing_deal else None,
        "quick_followup": {
            "due_at": follow,
            "note": "如客户未回复，按当前行业开发策略继续跟进",
        },
        "note": "产品资料和客户回复只做自动带入与待确认；不会自动改正式价格、合同或装箱事实。",
    }


@app.get("/api/leads/{lead_id}/low-input")
def low_input_context(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条客户线索")
    return _context(db, lead)


@app.post("/api/leads/{lead_id}/low-input/prepare-inquiry")
def prepare_inquiry(lead_id: int, req: PrepareInquiryRequest, db: Session = Depends(get_db)):
    if not req.confirm:
        raise HTTPException(400, "请先确认客户回复和产品对应关系")
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "没有找到这条客户线索")

    preferred, candidates = _product_candidates(db, lead)
    product = preferred
    requested_id = _clean(req.product_brain_id)
    if requested_id:
        row = db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == requested_id))
        if not row:
            raise HTTPException(400, "选择的产品资料已经不存在，请重新选择")
        payload = _product_payload(row)
        product = {
            "brain_id": row.brain_id,
            "name": _clean(payload.get("name")),
            "sku": _clean(payload.get("sku")),
            "spec": _clean(payload.get("spec") or payload.get("specification")),
            "moq": _clean(payload.get("moq")),
            "lead_time": _clean(payload.get("lead_time") or payload.get("delivery_time")),
            "price": payload.get("price", ""),
            "price_range": _clean(payload.get("price_range")),
            "currency": _clean(payload.get("currency") or "USD"),
            "unit": _clean(payload.get("unit") or "PCS"),
            "summary": _product_summary(payload),
        }
        add_activity(
            db,
            lead.id,
            "product_context_selected",
            "已关联产品资料",
            product.get("name") or product.get("sku") or row.brain_id,
            {"product_brain_id": row.brain_id, "product_name": product.get("name", "")},
        )
        db.commit()

    reply = _latest_reply(db, lead.id) if req.include_reply else None
    reply_info = extract_reply_facts(reply.subject, reply.snippet) if reply else {"facts": [], "excerpt": "", "missing": []}

    customer, deal = upsert_from_lead(db, lead)
    requirement_lines: list[str] = []
    if reply:
        requirement_lines.append("客户回复已确认：")
        for item in reply_info.get("facts", []):
            requirement_lines.append(f"- {item['label']}：{item['value']}")
        if reply_info.get("excerpt"):
            requirement_lines.append("客户原话参考：" + _clean(reply_info["excerpt"]))
    if product:
        requirement_lines.append("关联产品：" + _clean(product.get("name") or product.get("sku")))
        if _clean(product.get("spec")):
            requirement_lines.append("产品规格：" + _clean(product.get("spec")))
        if _clean(product.get("moq")):
            requirement_lines.append("参考 MOQ：" + _clean(product.get("moq")))
        if _clean(product.get("lead_time")):
            requirement_lines.append("参考交期：" + _clean(product.get("lead_time")))

    if requirement_lines:
        deal.requirements = "\n".join(requirement_lines)[:10000]
    if product and _clean(product.get("name")):
        deal.product_keyword = _clean(product.get("name"))
    if reply:
        deal.stage = "qualified"
        deal.probability = max(int(deal.probability or 0), 35)
        deal.next_action = "核对价格并制作报价单" if product else "确认对应产品并准备报价"
    else:
        deal.next_action = deal.next_action or "确认客户需求并准备报价"
    deal.updated_at = datetime.now(timezone.utc)
    add_activity(
        db,
        lead.id,
        "low_input_inquiry_prepared",
        "已用现有资料准备询盘",
        deal.next_action,
        {
            "deal_id": deal.id,
            "product_brain_id": _clean(product.get("brain_id")) if product else "",
            "reply_message_id": reply.provider_message_id if reply else "",
            "reply_fact_keys": [x.get("key") for x in reply_info.get("facts", [])],
        },
    )
    db.commit()
    db.refresh(deal)
    return {
        "ok": True,
        "customer_id": customer.id,
        "deal": deal_dict(deal, db),
        "product": product,
        "reply": reply_info if reply else None,
        "remaining_confirmation": reply_info.get("missing", []) if reply else [],
        "note": "未自动写入正式价格或金额；报价前仍需确认价格和未明确的客户要求。",
    }
