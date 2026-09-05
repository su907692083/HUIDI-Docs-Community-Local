from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .business_center import OnlineDeal, OnlineDocumentRef
from .industry_playbooks import match_industry
from .mail_delivery import MailDeliveryLog
from .mail_sync import MailboxMessage
from .main import Lead, LeadActivity, get_db, safe_json
from .online_app import app


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
        {"key": "found", "name": "找到客户", "count": found, "rate": 100.0 if found else 0.0},
        {"key": "contactable", "name": "有联系人", "count": contactable, "rate": _rate(contactable, found)},
        {"key": "sent", "name": "实际发送", "count": sent, "rate": _rate(sent, contactable)},
        {"key": "replied", "name": "收到回复", "count": replied, "rate": _rate(replied, sent)},
        {"key": "inquiry", "name": "进入询盘", "count": inquiry, "rate": _rate(inquiry, replied)},
        {"key": "quoted", "name": "已经报价", "count": quoted, "rate": _rate(quoted, inquiry)},
        {"key": "won", "name": "已完成", "count": won, "rate": _rate(won, quoted)},
    ]
    return {
        "ok": True,
        "stages": stages,
        "summary": {
            "reply_rate": _rate(replied, sent),
            "inquiry_rate_from_sent": _rate(inquiry, sent),
            "quote_rate_from_inquiry": _rate(quoted, inquiry),
        },
        "top_countries": _top_countries(db),
        "top_industries": _top_industries(db),
        "scenario_performance": _scenario_metrics(db),
        "note": "统计只使用真实已保存客户、真实发送记录、真实收件回复和真实询盘/单据引用，不使用演示数据。",
    }
