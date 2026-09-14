import unittest
from uuid import uuid4

from sqlalchemy import select

from app.daily_app import app  # noqa: F401
from app.mail_sync import MailQueueItem
from app.main import Lead, LeadActivity, SessionLocal, add_activity
from app.online_app import (
    DispatchPlanRequest,
    MailDispatchPlan,
    MailSuppression,
    MailboxAccount,
    SuppressionRequest,
    create_dispatch_plan,
    mail_readiness_payload,
    upsert_suppression,
)


class MailGovernanceTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
        self.email = f"buyer-{token}@example.com"
        self.mailbox_email = f"sales-{token}@seller.example"
        self.lead = Lead(
            company_name=f"mail-governance-{token}",
            domain="example.com",
            website="https://example.com",
            country="DE",
            market_keyword="hinge",
            buyer_type="importer",
            score=82,
            reason="mail governance regression",
            contact_email=self.email,
            status="qualified",
            draft_subject="Hinge cooperation",
            draft_body="Dear buyer, this is a reviewed draft for testing.",
        )
        self.db.add(self.lead)
        self.db.flush()
        add_activity(self.db, self.lead.id, "draft_approved", "开发信已确认")
        self.mailbox = MailboxAccount(
            display_name="Test Sales",
            email=self.mailbox_email,
            provider="smtp",
            auth_mode="smtp",
            connection_state="not_connected",
            daily_limit=40,
            min_interval_seconds=120,
            timezone="UTC",
            enabled=1,
        )
        self.db.add(self.mailbox)
        self.db.commit()
        self.db.refresh(self.lead)
        self.db.refresh(self.mailbox)
        self.lead_id = self.lead.id
        self.mailbox_id = self.mailbox.id

    def tearDown(self):
        for row in self.db.scalars(select(MailQueueItem).where(MailQueueItem.lead_id == self.lead_id)).all():
            self.db.delete(row)
        for row in self.db.scalars(select(MailDispatchPlan).where(MailDispatchPlan.lead_id == self.lead_id)).all():
            self.db.delete(row)
        for row in self.db.scalars(select(LeadActivity).where(LeadActivity.lead_id == self.lead_id)).all():
            self.db.delete(row)
        suppression = self.db.scalar(select(MailSuppression).where(MailSuppression.email == self.email))
        if suppression:
            self.db.delete(suppression)
        mailbox = self.db.get(MailboxAccount, self.mailbox_id)
        if mailbox:
            self.db.delete(mailbox)
        lead = self.db.get(Lead, self.lead_id)
        if lead:
            self.db.delete(lead)
        self.db.commit()
        self.db.close()

    def test_review_ready_waits_for_mailbox_connection(self):
        readiness = mail_readiness_payload(self.db, self.lead, self.mailbox_id)
        self.assertTrue(readiness["review_ready"])
        self.assertFalse(readiness["delivery_ready"])
        self.assertTrue(readiness["send_enabled"])
        self.assertEqual(readiness["delivery_mode"], "connected_mailbox")

    def test_suppression_blocks_plan(self):
        upsert_suppression(
            SuppressionRequest(email=self.email, reason="unsubscribe", source="test", active=True),
            self.db,
        )
        readiness = mail_readiness_payload(self.db, self.lead, self.mailbox_id)
        self.assertFalse(readiness["review_ready"])
        suppression_check = next(x for x in readiness["checks"] if x["key"] == "suppression")
        self.assertFalse(suppression_check["ok"])

    def test_dispatch_plan_is_idempotent_for_same_draft(self):
        req = DispatchPlanRequest(mailbox_id=self.mailbox_id, review_note="human reviewed")
        first = create_dispatch_plan(self.lead_id, req, self.db)
        second = create_dispatch_plan(self.lead_id, req, self.db)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["state"], "queued")
        self.assertEqual(first["recipient"], self.email)
        self.assertTrue(first["legacy_compat"])
        self.assertEqual(self.db.query(MailQueueItem).filter(MailQueueItem.lead_id == self.lead_id).count(), 1)
        self.assertEqual(self.db.query(MailDispatchPlan).filter(MailDispatchPlan.lead_id == self.lead_id).count(), 0)

    def test_replied_or_converted_lead_stops_cold_outreach_plan(self):
        self.lead.status = "replied"
        self.db.commit()
        readiness = mail_readiness_payload(self.db, self.lead, self.mailbox_id)
        self.assertFalse(readiness["review_ready"])
        lifecycle = next(x for x in readiness["checks"] if x["key"] == "lifecycle")
        self.assertFalse(lifecycle["ok"])


if __name__ == "__main__":
    unittest.main()
