import os
import unittest
from unittest.mock import patch
from uuid import uuid4

os.environ.setdefault("HUIDI_SECRET_KEY", "test-secret-key-for-huidi-ci-only")

from app.daily_app import app  # noqa: F401,E402
from app.main import Lead, LeadActivity, SessionLocal  # noqa: E402
from app.mail_delivery import (  # noqa: E402
    MailDeliveryLog,
    SmtpCredentialRequest,
    SmtpSendRequest,
    lead_delivery_readiness,
    save_smtp_credentials,
    send_lead_email,
    test_smtp_connection,
)
from app.online_app import MailboxAccount  # noqa: E402


class FakeSMTP:
    def __init__(self):
        self.messages = []

    def noop(self):
        return 250, b"OK"

    def send_message(self, msg):
        self.messages.append(msg)
        return {}

    def quit(self):
        return 221, b"Bye"


class MailDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
        self.mailbox = MailboxAccount(
            display_name="HUIDI Sales",
            email=f"sender-{token}@example.com",
            provider="smtp",
            auth_mode="smtp",
            connection_state="not_connected",
            daily_limit=40,
            min_interval_seconds=30,
            timezone="UTC",
            enabled=1,
        )
        self.db.add(self.mailbox)
        self.db.flush()
        self.lead = Lead(
            company_name=f"Buyer {token}",
            domain=f"buyer-{token}.example.org",
            website="https://example.org",
            country="DE",
            market_keyword="hinge",
            buyer_type="importer",
            score=88,
            reason="test",
            contact_email=f"buyer-{token}@example.org",
            status="qualified",
            draft_subject="HUIDI SMTP test",
            draft_body="Hello, this is a governed SMTP test draft.",
        )
        self.db.add(self.lead)
        self.db.flush()
        self.db.add(
            LeadActivity(
                lead_id=self.lead.id,
                event_type="draft_approved",
                title="开发信已确认",
                detail="CI approval",
            )
        )
        self.db.commit()

    def tearDown(self):
        for row in self.db.query(MailDeliveryLog).filter(MailDeliveryLog.lead_id == self.lead.id).all():
            self.db.delete(row)
        for row in self.db.query(LeadActivity).filter(LeadActivity.lead_id == self.lead.id).all():
            self.db.delete(row)
        self.db.delete(self.lead)
        self.db.delete(self.mailbox)
        self.db.commit()
        self.db.close()

    def test_smtp_config_test_and_send(self):
        saved = save_smtp_credentials(
            self.mailbox.id,
            SmtpCredentialRequest(
                host="smtp.example.com",
                port=587,
                security="starttls",
                username=self.mailbox.email,
                password="app-password-test-only",
            ),
            db=self.db,
        )
        self.assertTrue(saved["smtp"]["has_secret"])

        fake = FakeSMTP()
        with patch("app.mail_delivery._smtp_client", return_value=fake):
            result = test_smtp_connection(self.mailbox.id, db=self.db)
            self.assertTrue(result["ok"])

            ready = lead_delivery_readiness(self.lead.id, self.mailbox.id, db=self.db)
            self.assertTrue(ready["delivery_ready"])
            self.assertTrue(ready["send_enabled"])

            sent = send_lead_email(
                self.lead.id,
                SmtpSendRequest(mailbox_id=self.mailbox.id, confirm=True),
                db=self.db,
            )
            self.assertTrue(sent["ok"])
            self.assertEqual(sent["delivery"]["state"], "sent")
            self.assertEqual(sent["lead"]["status"], "contacted")
            self.assertEqual(len(fake.messages), 1)

        logs = self.db.query(MailDeliveryLog).filter(MailDeliveryLog.lead_id == self.lead.id).all()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].state, "sent")


if __name__ == "__main__":
    unittest.main()
