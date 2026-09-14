from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef
from .knowledge_context import _strip_price_text
from .mail_delivery import MailDeliveryLog
from .mail_sync import MailboxMessage
from .main import LeadActivity, get_db
from .online_app import app


SOURCE_NAMES = {
    "lead": "开发记录",
    "mail": "客户邮件",
    "delivery": "发送记录",
    "deal": "询盘 / 业务",
    "document": "正式单据",
    "customer": "客户资料",
}
DOCUMENT_NAMES = {
    "quotation": "报价单",
    "proforma_invoice": "PI",
    "sales_contract": "销售合同",
    "commercial_invoice": "CI",
    "packing_list": "装箱单",
}


def _iso(value: datetime | None) -> str:
    if not value:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _event(
    source: str,
    kind: str,
    title: str,
    summary: str,
    at: datetime | None,
    *,
    route: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "source": source,
        "source_name": SOURCE_NAMES[source],
        "kind": kind,
        "title": str(title or "").strip()[:255],
        "summary": _strip_price_text(summary, 520),
        "at": _iso(at),
        "route": route or {},
    }


def _resolve_customer(db: Session, key: str) -> OnlineCustomer | None:
    value = str(key or "").strip()[:160]
    if not value:
        return None
    try:
        row = db.get(OnlineCustomer, int(value))
    except (TypeError, ValueError):
        row = None
    if row:
        return row
    # Community can temporarily keep its stable local string ID even though the
    # cloud Customer owner uses an integer primary key. Resolve the mapping that
    # community_sync already persists; do not create another identity table.
    try:
        row_id = db.execute(
            text("SELECT id FROM online_customers WHERE local_customer_id=:key ORDER BY id ASC LIMIT 1"),
            {"key": value},
        ).scalar_one_or_none()
    except Exception:
        row_id = None
    return db.get(OnlineCustomer, int(row_id)) if row_id else None


def _resolve_deal(db: Session, key: str) -> OnlineDeal | None:
    value = str(key or "").strip()[:160]
    if not value:
        return None
    try:
        row = db.get(OnlineDeal, int(value))
    except (TypeError, ValueError):
        row = None
    if row:
        return row
    return db.scalar(
        select(OnlineDeal)
        .where(OnlineDeal.local_deal_id == value)
        .order_by(OnlineDeal.id.asc())
    )


def _timeline(
    db: Session,
    *,
    customer: OnlineCustomer | None,
    deals: list[OnlineDeal],
    lead_ids: set[int],
    limit: int,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    deal_ids = [x.id for x in deals]

    if customer:
        events.append(
            _event(
                "customer",
                "customer_updated",
                f"客户资料 · {customer.company_name}",
                " · ".join(x for x in [customer.contact_name, customer.country, customer.status] if str(x or "").strip()),
                customer.updated_at,
                route={"kind": "customer", "id": customer.id},
            )
        )

    for deal in deals:
        events.append(
            _event(
                "deal",
                "deal_updated",
                deal.title or "询盘 / 业务更新",
                " · ".join(
                    x
                    for x in [
                        deal.stage,
                        deal.product_keyword,
                        deal.next_action,
                        f"下一步 {deal.next_action_at}" if deal.next_action_at else "",
                    ]
                    if str(x or "").strip()
                ),
                deal.updated_at,
                route={"kind": "deal", "id": deal.id, "source_lead_id": deal.source_lead_id},
            )
        )

    if lead_ids:
        activities = db.scalars(
            select(LeadActivity)
            .where(LeadActivity.lead_id.in_(lead_ids))
            .order_by(LeadActivity.created_at.desc(), LeadActivity.id.desc())
            .limit(max(limit * 3, 60))
        ).all()
        for row in activities:
            events.append(
                _event(
                    "lead",
                    row.event_type or "lead_activity",
                    row.title or "开发记录",
                    row.detail or "",
                    row.created_at,
                    route={"kind": "lead", "id": row.lead_id},
                )
            )

        # Incoming messages represent the customer's real reply/history. Outbound
        # send state comes from MailDeliveryLog below, avoiding duplicate sent rows.
        messages = db.scalars(
            select(MailboxMessage)
            .where(MailboxMessage.lead_id.in_(lead_ids))
            .where(MailboxMessage.direction == "incoming")
            .order_by(MailboxMessage.received_at.desc(), MailboxMessage.id.desc())
            .limit(max(limit * 2, 40))
        ).all()
        for row in messages:
            events.append(
                _event(
                    "mail",
                    "incoming_mail",
                    f"收到客户邮件 · {row.subject or '无主题'}",
                    row.snippet or row.sender or "",
                    row.received_at,
                    route={"kind": "lead", "id": row.lead_id, "mailbox_id": row.mailbox_id},
                )
            )

        deliveries = db.scalars(
            select(MailDeliveryLog)
            .where(MailDeliveryLog.lead_id.in_(lead_ids))
            .order_by(MailDeliveryLog.created_at.desc(), MailDeliveryLog.id.desc())
            .limit(max(limit * 2, 40))
        ).all()
        for row in deliveries:
            title = "邮件已发送" if row.state == "sent" else "邮件发送异常" if row.state == "failed" else "邮件发送记录"
            events.append(
                _event(
                    "delivery",
                    f"mail_{row.state or 'delivery'}",
                    f"{title} · {row.subject or '无主题'}",
                    row.error if row.state == "failed" else row.recipient,
                    row.created_at,
                    route={"kind": "lead", "id": row.lead_id, "mailbox_id": row.mailbox_id},
                )
            )

    if deal_ids:
        documents = db.scalars(
            select(OnlineDocumentRef)
            .where(OnlineDocumentRef.deal_id.in_(deal_ids))
            .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
            .limit(max(limit * 2, 40))
        ).all()
        for row in documents:
            name = DOCUMENT_NAMES.get(row.document_type, row.document_type or "单据")
            events.append(
                _event(
                    "document",
                    "document_updated",
                    f"{name} · {row.title or '业务单据'}",
                    f"状态 {row.state or 'draft'}",
                    row.updated_at,
                    route={"kind": "deal", "id": row.deal_id, "document_type": row.document_type, "document_id": row.document_id},
                )
            )

    # Source tables already carry real timestamps. Sorting their ISO UTC values
    # gives one chronological projection without copying events into another CRM.
    events.sort(key=lambda item: item.get("at") or "", reverse=True)
    return events[:limit]


def _lead_ids(customer: OnlineCustomer | None, deals: list[OnlineDeal]) -> set[int]:
    values = {int(x.source_lead_id) for x in deals if x.source_lead_id}
    if customer and customer.source_lead_id:
        values.add(int(customer.source_lead_id))
    return values


@app.get("/api/business/customers/{customer_id}/activity")
def customer_activity(
    customer_id: str,
    limit: int = Query(default=40, ge=5, le=100),
    db: Session = Depends(get_db),
):
    customer = _resolve_customer(db, customer_id)
    if not customer:
        raise HTTPException(404, "客户不存在")
    deals = db.scalars(
        select(OnlineDeal)
        .where(OnlineDeal.customer_id == customer.id)
        .order_by(OnlineDeal.updated_at.desc(), OnlineDeal.id.desc())
        .limit(120)
    ).all()
    deal_rows = list(deals)
    items = _timeline(db, customer=customer, deals=deal_rows, lead_ids=_lead_ids(customer, deal_rows), limit=limit)
    return {
        "ok": True,
        "owner": "existing_business_projection",
        "entity": {"kind": "customer", "id": customer.id, "requested_id": customer_id, "name": customer.company_name},
        "items": items,
        "guardrails": {"read_only": True, "new_activity_storage": False, "formal_price_projection": False},
    }


@app.get("/api/business/deals/{deal_id}/activity")
def deal_activity(
    deal_id: str,
    limit: int = Query(default=40, ge=5, le=100),
    db: Session = Depends(get_db),
):
    deal = _resolve_deal(db, deal_id)
    if not deal:
        raise HTTPException(404, "询盘不存在")
    customer = db.get(OnlineCustomer, deal.customer_id)
    items = _timeline(db, customer=customer, deals=[deal], lead_ids=_lead_ids(customer, [deal]), limit=limit)
    return {
        "ok": True,
        "owner": "existing_business_projection",
        "entity": {"kind": "deal", "id": deal.id, "requested_id": deal_id, "name": deal.title},
        "items": items,
        "guardrails": {"read_only": True, "new_activity_storage": False, "formal_price_projection": False},
    }
