from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .main import Lead, add_activity, app, get_db, lead_to_dict


LOCAL_STATUS_SCHEMA = "huidi.local.business.status/v1"


class LocalBusinessEventRequest(BaseModel):
    schema: str = LOCAL_STATUS_SCHEMA
    source: str = "HUIDI Community Local"
    event: str = Field(default="deal.updated", max_length=80)
    title: str = Field(default="本地业务进度更新", max_length=255)
    detail: str = Field(default="", max_length=1200)
    customer_id: str = Field(default="", max_length=120)
    customer_name: str = Field(default="", max_length=255)
    deal_id: str = Field(default="", max_length=120)
    deal_title: str = Field(default="", max_length=255)
    stage: str = Field(default="", max_length=80)
    next_action: str = Field(default="", max_length=500)
    next_action_at: str = Field(default="", max_length=80)
    document_type: str = Field(default="", max_length=80)
    document_id: str = Field(default="", max_length=120)
    occurred_at: str = Field(default="", max_length=80)
    meta: dict[str, Any] = Field(default_factory=dict)


@app.get("/api/local-sync/health")
def local_sync_health():
    return {
        "ok": True,
        "schema": LOCAL_STATUS_SCHEMA,
        "mode": "explicit_confirmation",
        "automatic_background_upload": False,
    }


@app.post("/api/leads/{lead_id}/local-event")
def receive_local_business_event(
    lead_id: int,
    req: LocalBusinessEventRequest,
    db: Session = Depends(get_db),
):
    if req.schema != LOCAL_STATUS_SCHEMA:
        raise HTTPException(400, "不支持的 Local 状态同步版本")
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "线索不存在")

    payload = {
        "source": req.source,
        "event": req.event,
        "customer_id": req.customer_id,
        "customer_name": req.customer_name,
        "deal_id": req.deal_id,
        "deal_title": req.deal_title,
        "stage": req.stage,
        "next_action": req.next_action,
        "next_action_at": req.next_action_at,
        "document_type": req.document_type,
        "document_id": req.document_id,
        "occurred_at": req.occurred_at,
        "meta": req.meta,
    }
    detail = req.detail.strip() or " · ".join(
        x
        for x in [
            req.customer_name,
            req.deal_title,
            req.stage,
            req.next_action,
        ]
        if x
    )
    add_activity(
        db,
        lead.id,
        "local_business_event",
        req.title.strip() or "本地业务进度更新",
        detail[:1200],
        payload,
    )
    # A lead that has entered Community Local remains `converted`. Local business
    # stages belong to the Deal timeline and must not be misused as lead ranking/status.
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return {
        "ok": True,
        "schema": LOCAL_STATUS_SCHEMA,
        "lead": lead_to_dict(lead, db),
        "accepted_event": req.event,
    }
