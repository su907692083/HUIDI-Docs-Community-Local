from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import mail_sync
from .mail_sync import MailQueueItem, QueueRequest, _queue_dict
from .main import Lead, LeadActivity, add_activity, safe_json
from .online_app import _draft_fingerprint, _email


_original_queue_message = mail_sync.queue_message


def _compat_queue_message(lead_id: int, req: QueueRequest, db: Session):
    """Idempotent queue owner used by the retired /mail-plan compatibility path.

    The historical endpoint imports ``mail_sync.queue_message`` at call time.
    We keep its old duplicate-protection promise without creating any new
    MailDispatchPlan rows. The real Queue row remains the only pending-send owner.
    """
    lead = db.get(Lead, lead_id)
    if not lead:
        return _original_queue_message(lead_id, req, db)
    fingerprint = _draft_fingerprint(lead)
    rows = db.scalars(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .where(LeadActivity.event_type == "mail_plan_compat_queued")
        .order_by(LeadActivity.id.desc())
        .limit(30)
    ).all()
    for activity in rows:
        payload = safe_json(activity.payload_json, {})
        if str(payload.get("draft_fingerprint") or "") != fingerprint:
            continue
        if int(payload.get("mailbox_id") or 0) != int(req.mailbox_id):
            continue
        queue_id = int(payload.get("queue_id") or 0)
        row = db.get(MailQueueItem, queue_id) if queue_id else None
        if row:
            return {
                **_queue_dict(row),
                "recipient": _email(lead.contact_email),
                "subject": lead.draft_subject,
                "legacy_compat": True,
                "legacy_endpoint": "mail-plan",
            }

    queued = _original_queue_message(lead_id, req, db)
    add_activity(
        db,
        lead_id,
        "mail_plan_compat_queued",
        "旧版待发送入口已转入真实待发送",
        lead.draft_subject,
        {
            "draft_fingerprint": fingerprint,
            "mailbox_id": req.mailbox_id,
            "queue_id": queued.get("id"),
        },
    )
    db.commit()
    return {
        **queued,
        "recipient": _email(lead.contact_email),
        "subject": lead.draft_subject,
        "legacy_compat": True,
        "legacy_endpoint": "mail-plan",
    }


# Only calls that resolve the module global after import use this wrapper. The
# normal /api/leads/{lead_id}/queue FastAPI route keeps its original owner.
mail_sync.queue_message = _compat_queue_message
