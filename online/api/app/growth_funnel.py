from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef
from .industry_playbooks import match_industry
from .mail_delivery import MailDeliveryLog
from .mail_sync import MailboxMessage
from .main import Lead, LeadActivity, get_db, safe_json
from .online_app import app


ACTIVE_DEAL_STAGES = {"new_inquiry", "qualified", "quoting", "negotiating", "confirmed", "production", "shipping"}


def _distinct_count(db: Session, column, *conditions) -> int:
    stmt = select(func.count(func.distinct(column)))
    if conditions:
        stmt = stmt.where(*conditions)
    return int(db.scalar(stmt) or 0)


def _rate(value: int, base: int) -> float:
    return round((value / base * 100.0), 1) if base else 0.0


def _top_countries(db: Session, limit: int = 8) -> list[dict[str, Any]]:
    rows = db.execute(
        select(Lead.country, func.count(Lead.id))
        .where(Lead.country != "")
        .group_by(Lead.country)
        .order_by(func.count(Lead.id).desc())
        .limit(limit)
    ).all()
    return [{"name": str(name or "未填写"), "count": int(count or 0)} for name, count in rows]


def _customer_countries(db: Session, limit: int = 8) -> list[dict[str, Any]]:
    rows = db.execute(
        select(OnlineCustomer.country, func.count(OnlineCustomer.id))
        .where(OnlineCustomer.country != "")
        .group_by(OnlineCustomer.country)
        .order_by(func.count(OnlineCustomer.id).desc())
        .limit(limit)
    ).all()
    return [{"name": str(name or "未填写"), "count": int(count or 0), "route": "business"} for name, count in rows]


def _top_industries(db: Session, limit: int = 8) -> list[dict[str, Any]]:
    # Aggregate by product keyword first so large lead tables do not require
    # loading every customer into Python merely to resolve the cached taxonomy.
    rows = db.execute(
        select(Lead.market_keyword, func.count(Lead.id))
        .where(Lead.market_keyword != "")
        .group_by(Lead.market_keyword)
        .order_by(func.count(Lead.id).desc())
        .limit(240)
    ).all()
    counts: Counter[str] = Counter()
    names: dict[str, str] = {}
    for keyword, count in rows:
        try:
            profile, _, _ = match_industry(str(keyword or ""))
        except Exception:
            continue
        industry_id = str(profile.get("id") or "")
        if not industry_id:
            continue
        counts[industry_id] += int(count or 0)
        names[industry_id] = str(profile.get("short") or profile.get("name") or industry_id)
    return [
        {"id": industry_id, "name": names.get(industry_id, industry_id), "count": count}
        for industry_id, count in counts.most_common(limit)
    ]


def _scenario_metrics(db: Session, limit: int = 8) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.event_type == "draft_created")
        .order_by(LeadActivity.id.desc())
        .limit(5000)
    ).all()
    latest: dict[int, str] = {}
    for row in rows:
        if row.lead_id in latest:
            continue
        payload = safe_json(row.payload_json, {})
        if payload.get("source") != "industry_playbook":
            continue
        scenario = str(payload.get("scenario") or "").strip()
        if scenario:
            latest[row.lead_id] = scenario
    if not latest:
        return []
    sent_ids = set(
        db.scalars(
            select(MailDeliveryLog.lead_id)
            .where(MailDeliveryLog.state == "sent")
            .where(MailDeliveryLog.lead_id.in_(list(latest)))
            .distinct()
        ).all()
    )
    replied_ids = set(
        db.scalars(
            select(MailboxMessage.lead_id)
            .where(MailboxMessage.direction == "incoming")
            .where(MailboxMessage.lead_id.in_(list(latest)))
            .distinct()
        ).all()
    )
    buckets: dict[str, dict[str, int]] = {}
    for lead_id, scenario in latest.items():
        bucket = buckets.setdefault(scenario, {"customers": 0, "sent": 0, "replied": 0})
        bucket["customers"] += 1
        bucket["sent"] += 1 if lead_id in sent_ids else 0
        bucket["replied"] += 1 if lead_id in replied_ids else 0
    ranked = sorted(buckets.items(), key=lambda x: (x[1]["replied"], x[1]["sent"], x[1]["customers"]), reverse=True)
    return [
        {"scenario": name, **values, "reply_rate": _rate(values["replied"], values["sent"])}
        for name, values in ranked[:limit]
    ]


def _lead_priorities(db: Session) -> list[dict[str, Any]]:
    priority = case(
        (Lead.score >= 78, "A"),
        (Lead.score >= 62, "B"),
        (Lead.score >= 46, "C"),
        else_="D",
    ).label("priority")
    rows = db.execute(
        select(priority, func.count(Lead.id)).group_by(priority).order_by(priority.asc())
    ).all()
    return [{"name": str(name), "count": int(count or 0), "route": "leads"} for name, count in rows]


def _deal_stages(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(OnlineDeal.stage, func.count(OnlineDeal.id))
        .group_by(OnlineDeal.stage)
        .order_by(func.count(OnlineDeal.id).desc())
    ).all()
    return [{"name": str(name or "未设置"), "count": int(count or 0), "route": "business"} for name, count in rows]


def _document_types(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(OnlineDocumentRef.document_type, func.count(OnlineDocumentRef.id))
        .group_by(OnlineDocumentRef.document_type)
        .order_by(func.count(OnlineDocumentRef.id).desc())
    ).all()
    return [{"name": str(name or "未设置"), "count": int(count or 0), "route": "documents"} for name, count in rows]


def _pipeline_by_currency(db: Session) -> list[dict[str, Any]]:
    # Never add unlike currencies together. Each currency is its own analytical
    # bucket and remains informational; this path never writes Deal/formal prices.
    rows = db.execute(
        select(OnlineDeal.currency, func.count(OnlineDeal.id), func.sum(OnlineDeal.amount))
        .where(OnlineDeal.stage.in_(ACTIVE_DEAL_STAGES))
        .group_by(OnlineDeal.currency)
        .order_by(func.sum(OnlineDeal.amount).desc())
        .limit(8)
    ).all()
    return [
        {
            "currency": str(currency or "未设置"),
            "deals": int(count or 0),
            "amount": round(float(amount or 0), 2),
            "route": "business",
        }
        for currency, count, amount in rows
    ]


@app.get("/api/growth/funnel")
def growth_funnel(db: Session = Depends(get_db)):
    found = _distinct_count(db, Lead.id)
    contactable = _distinct_count(db, Lead.id, Lead.contact_email != "")
    sent = _distinct_count(db, MailDeliveryLog.lead_id, MailDeliveryLog.state == "sent")
    replied = _distinct_count(
        db, MailboxMessage.lead_id,
        MailboxMessage.direction == "incoming", MailboxMessage.lead_id.is_not(None),
    )
    inquiry = _distinct_count(db, OnlineDeal.source_lead_id, OnlineDeal.source_lead_id.is_not(None))
    quoted = int(
        db.scalar(
            select(func.count(func.distinct(OnlineDeal.source_lead_id)))
            .join(OnlineDocumentRef, OnlineDocumentRef.deal_id == OnlineDeal.id)
            .where(OnlineDeal.source_lead_id.is_not(None))
            .where(OnlineDocumentRef.document_type == "quotation")
        ) or 0
    )
    won = _distinct_count(
        db, OnlineDeal.source_lead_id,
        OnlineDeal.source_lead_id.is_not(None), OnlineDeal.stage == "completed",
    )
    stages = [
        {"key": "found", "name": "找到客户", "count": found, "rate": 100.0 if found else 0.0, "route": "leads"},
        {"key": "contactable", "name": "有联系人", "count": contactable, "rate": _rate(contactable, found), "route": "leads"},
        {"key": "sent", "name": "实际发送", "count": sent, "rate": _rate(sent, contactable), "route": "communication"},
        {"key": "replied", "name": "收到回复", "count": replied, "rate": _rate(replied, sent), "route": "communication"},
        {"key": "inquiry", "name": "进入询盘", "count": inquiry, "rate": _rate(inquiry, replied), "route": "business"},
        {"key": "quoted", "name": "已经报价", "count": quoted, "rate": _rate(quoted, inquiry), "route": "documents"},
        {"key": "won", "name": "已完成", "count": won, "rate": _rate(won, quoted), "route": "business"},
    ]
    return {
        "ok": True,
        "mode": "authoritative_operational_analytics",
        "stages": stages,
        "summary": {
            "reply_rate": _rate(replied, sent),
            "inquiry_rate_from_sent": _rate(inquiry, sent),
            "quote_rate_from_inquiry": _rate(quoted, inquiry),
        },
        "top_countries": _top_countries(db),
        "top_industries": _top_industries(db),
        "scenario_performance": _scenario_metrics(db),
        "analysis": {
            "lead_priorities": _lead_priorities(db),
            "customer_countries": _customer_countries(db),
            "deal_stages": _deal_stages(db),
            "document_types": _document_types(db),
            "pipeline_by_currency": _pipeline_by_currency(db),
        },
        "drilldown_targets": {
            "leads": "existing Lead / Potential Customer owner",
            "communication": "existing Mail / Communication owner",
            "business": "existing Customer / Deal owner",
            "documents": "existing Document Workbench owner",
        },
        "guardrails": {
            "read_only": True,
            "new_analytics_storage": False,
            "raw_sql_console": False,
            "mixed_currency_totals": False,
            "formal_price_write": False,
        },
        "note": "统计只使用真实已保存客户、真实发送记录、真实收件回复和真实询盘/单据引用；分析仅回跳现有 Owner，不创建 BI 数据副本。",
    }
