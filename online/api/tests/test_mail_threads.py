import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import select

os.environ.setdefault("HUIDI_SECRET_KEY", "test-secret-key-for-huidi-ci-only")
os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.mail_sync import MailboxMessage  # noqa: E402
from app.mail_threads import ThreadReplyRequest, reply_to_message  # noqa: E402
from app.main import Lead, LeadActivity, SessionLocal  # noqa: E402
from app.online_app import MailboxAccount  # noqa: E402


class MailThreadTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
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
        self.db.add(self.mailbox)
        self.db.flush()
        self.lead = Lead(
            company_name=f"Buyer {token}",
            domain="buyer.example",
            website="https://buyer.example",
            country="DE",
            market_keyword="hinge",
            buyer_type="importer",
            score=82,
            reason="test",
            contact_email=f"buyer-{token}@buyer.example",
            status="replied",
            draft_subject="Hello",
            draft_body="Hello buyer",
        )
        self.db.add(self.lead)
        self.db.flush()
        self.incoming = MailboxMessage(
            mailbox_id=self.mailbox.id,
            provider_message_id=f"gmail-{token}",
            thread_id=f"thread-{token}",
            internet_message_id=f"<incoming-{token}@buyer.example>",
            direction="incoming",
            folder="inbox",
            sender=self.lead.contact_email,
            recipients_json=f'["{self.mailbox.email}"]',
            subject="Re: Hello",
            snippet="Please send your quotation.",
            received_at=datetime.now(timezone.utc).replace(tzinfo=None),
            lead_id=self.lead.id,
        )
        self.db.add(self.incoming)
        self.db.commit()
        self.db.refresh(self.incoming)

    def tearDown(self):
        for row in self.db.scalars(select(MailboxMessage).where(MailboxMessage.mailbox_id == self.mailbox.id)).all():
            self.db.delete(row)
        for row in self.db.scalars(select(LeadActivity).where(LeadActivity.lead_id == self.lead.id)).all():
            self.db.delete(row)
        self.db.delete(self.lead)
        self.db.delete(self.mailbox)
        self.db.commit()
        self.db.close()

    def test_reply_is_kept_in_same_customer_thread(self):
        with patch("app.mail_threads._gmail_reply", return_value=("sent-message-1", self.incoming.thread_id)):
            out = reply_to_message(
                self.incoming.id,
                ThreadReplyRequest(body="Thank you. I will send the quotation today."),
                db=self.db,
            )
        self.assertTrue(out["ok"])
        sent = self.db.scalar(
            select(MailboxMessage)
            .where(MailboxMessage.provider_message_id == "sent-message-1")
        )
        self.assertIsNotNone(sent)
        self.assertEqual(sent.thread_id, self.incoming.thread_id)
        self.assertEqual(sent.lead_id, self.lead.id)
        self.assertEqual(sent.direction, "outgoing")
        activity = self.db.scalar(
            select(LeadActivity)
            .where(LeadActivity.lead_id == self.lead.id)
            .where(LeadActivity.event_type == "mail_reply_sent")
        )
        self.assertIsNotNone(activity)


if __name__ == "__main__":
    unittest.main()
