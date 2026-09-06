import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from sqlalchemy import select

from app.daily_app import app  # noqa: F401,E402
from app.mail_sequences import (  # noqa: E402
    MailSequenceEnrollment,
    MailSequenceTemplate,
    run_sequences_once,
)
from app.main import Lead, LeadActivity, SessionLocal  # noqa: E402
from app.online_app import MailSuppression, MailboxAccount  # noqa: E402


class MailSequenceTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
        self.lead = Lead(
            company_name=f"sequence-{token}",
            domain=f"{token}.example.com",
            website=f"https://{token}.example.com",
            country="DE",
            market_keyword="stainless steel hinge",
            buyer_type="importer",
            score=80,
            reason="sequence regression",
            contact_name="Anna",
            contact_email=f"buyer-{token}@example.com",
            status="qualified",
        )
        self.mailbox = MailboxAccount(
            display_name="Sales",
            email=f"sales-{token}@seller.example",
            provider="gmail",
            auth_mode="oauth2",
            connection_state="connected",
            daily_limit=40,
            min_interval_seconds=30,
            timezone="UTC",
            enabled=1,
        )
        self.template = MailSequenceTemplate(
            name=f"test-{token}",
            description="test",
            steps_json='[{"delay_hours":0,"subject":"Hello {{company}}","body":"Dear {{contact}}, {{product}}"},{"delay_hours":24,"subject":"Follow up","body":"Second message"}]',
            approved=1,
            enabled=1,
        )
        self.db.add_all([self.lead, self.mailbox, self.template])
        self.db.commit()
        self.db.refresh(self.lead)
        self.db.refresh(self.mailbox)
        self.db.refresh(self.template)
        self.enrollment = MailSequenceEnrollment(
            template_id=self.template.id,
            lead_id=self.lead.id,
            mailbox_id=self.mailbox.id,
            state="active",
            current_step=0,
            next_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).replace(tzinfo=None),
        )
        self.db.add(self.enrollment)
        self.db.commit()
        self.db.refresh(self.enrollment)
        self.ids = (self.lead.id, self.mailbox.id, self.template.id, self.enrollment.id)

    def tearDown(self):
        lead_id, mailbox_id, template_id, enrollment_id = self.ids
        row = self.db.get(MailSequenceEnrollment, enrollment_id)
        if row:
            self.db.delete(row)
        for row in self.db.scalars(select(LeadActivity).where(LeadActivity.lead_id == lead_id)).all():
            self.db.delete(row)
        suppression = self.db.scalar(select(MailSuppression).where(MailSuppression.email == self.lead.contact_email.lower()))
        if suppression:
            self.db.delete(suppression)
        template = self.db.get(MailSequenceTemplate, template_id)
        if template:
            self.db.delete(template)
        mailbox = self.db.get(MailboxAccount, mailbox_id)
        if mailbox:
            self.db.delete(mailbox)
        lead = self.db.get(Lead, lead_id)
        if lead:
            self.db.delete(lead)
        self.db.commit()
        self.db.close()

    @patch("app.mail_sequences.send_lead_email")
    def test_due_step_sends_and_schedules_next(self, send_mock):
        send_mock.return_value = {"ok": True, "delivery": {"id": 901}}
        out = run_sequences_once(20)
        self.assertEqual(out["sent"], 1)
        self.db.expire_all()
        row = self.db.get(MailSequenceEnrollment, self.enrollment.id)
        lead = self.db.get(Lead, self.lead.id)
        self.assertEqual(row.current_step, 1)
        self.assertEqual(row.state, "active")
        self.assertEqual(row.last_delivery_id, 901)
        self.assertIn(self.lead.company_name, lead.draft_subject)
        self.assertIn("Anna", lead.draft_body)
        self.assertGreater(row.next_at, datetime.now(timezone.utc).replace(tzinfo=None))

    @patch("app.mail_sequences.send_lead_email")
    def test_reply_stops_remaining_steps(self, send_mock):
        self.lead.status = "replied"
        self.db.commit()
        out = run_sequences_once(20)
        self.assertEqual(out["stopped"], 1)
        send_mock.assert_not_called()
        self.db.expire_all()
        row = self.db.get(MailSequenceEnrollment, self.enrollment.id)
        self.assertEqual(row.state, "stopped")
        self.assertIn("回复", row.stop_reason)

    @patch("app.mail_sequences.send_lead_email")
    def test_unsubscribe_stops_remaining_steps(self, send_mock):
        self.db.add(MailSuppression(email=self.lead.contact_email.lower(), reason="unsubscribe", source="test", active=1))
        self.db.commit()
        out = run_sequences_once(20)
        self.assertEqual(out["stopped"], 1)
        send_mock.assert_not_called()
        self.db.expire_all()
        row = self.db.get(MailSequenceEnrollment, self.enrollment.id)
        self.assertEqual(row.state, "stopped")


if __name__ == "__main__":
    unittest.main()
