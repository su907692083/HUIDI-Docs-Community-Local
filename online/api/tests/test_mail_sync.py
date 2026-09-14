import os
import unittest
from uuid import uuid4

from sqlalchemy import select

os.environ.setdefault("HUIDI_SECRET_KEY", "test-secret-key-for-huidi-ci-only")

from app.daily_app import app  # noqa: F401,E402
from app.mail_sync import MailboxMessage, _record_message  # noqa: E402
from app.main import Lead, LeadActivity, SessionLocal  # noqa: E402
from app.online_app import MailSuppression, MailboxAccount  # noqa: E402


class MailSyncTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
        self.email = f"reply-{token}@buyer.example"
        self.mailbox = MailboxAccount(
            display_name="Connected Mail",
            email=f"sales-{token}@seller.example",
            provider="gmail",
            auth_mode="oauth2",
            connection_state="connected",
            daily_limit=40,
            min_interval_seconds=30,
            timezone="UTC",
            enabled=1,
        )
        self.db.add(self.mailbox)
        self.db.flush()
        self.lead = Lead(
            company_name=f"Buyer {token}",
            domain="buyer.example",
            website="https://buyer.example",
            country="DE",
            market_keyword="hinge",
            buyer_type="importer",
            score=80,
            reason="test",
            contact_email=self.email,
            status="contacted",
            draft_subject="Hello",
            draft_body="Hello buyer",
        )
        self.db.add(self.lead)
        self.db.commit()
        self.db.refresh(self.mailbox)
        self.db.refresh(self.lead)

    def tearDown(self):
        for row in self.db.scalars(select(MailboxMessage).where(MailboxMessage.mailbox_id == self.mailbox.id)).all():
            self.db.delete(row)
        for row in self.db.scalars(select(LeadActivity).where(LeadActivity.lead_id == self.lead.id)).all():
            self.db.delete(row)
        suppression = self.db.scalar(select(MailSuppression).where(MailSuppression.email == self.email))
        if suppression:
            self.db.delete(suppression)
        self.db.delete(self.lead)
        self.db.delete(self.mailbox)
        self.db.commit()
        self.db.close()

    def test_incoming_reply_updates_lead_and_stops_cold_outreach(self):
        row, created = _record_message(
            self.db,
            self.mailbox,
            {
                "provider_message_id": uuid4().hex,
                "thread_id": "thread-1",
                "internet_message_id": "<reply@example>",
                "direction": "incoming",
                "folder": "inbox",
                "sender": f"Buyer <{self.email}>",
                "recipients": [self.mailbox.email],
                "subject": "Re: Hello",
                "snippet": "Thanks, please send a quotation.",
            },
        )
        self.assertTrue(created)
        self.assertEqual(row.lead_id, self.lead.id)
        self.db.refresh(self.lead)
        self.assertEqual(self.lead.status, "replied")
        suppression = self.db.scalar(select(MailSuppression).where(MailSuppression.email == self.email))
        self.assertIsNotNone(suppression)
        self.assertEqual(suppression.reason, "reply_stop")
        activity = self.db.scalar(
            select(LeadActivity)
            .where(LeadActivity.lead_id == self.lead.id)
            .where(LeadActivity.event_type == "mail_reply_received")
        )
        self.assertIsNotNone(activity)


if __name__ == "__main__":
    unittest.main()
