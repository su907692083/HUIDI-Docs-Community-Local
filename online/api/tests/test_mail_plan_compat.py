import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.mail_sync import MailQueueItem  # noqa: E402
from app.main import Lead, SessionLocal, add_activity  # noqa: E402
from app.online_app import (  # noqa: E402
    DispatchPlanRequest,
    MailDispatchPlan,
    MailboxAccount,
    create_dispatch_plan,
)
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class LegacyMailPlanCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template

    def test_legacy_mail_plan_creates_real_queue_without_new_legacy_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = f"sqlite:///{Path(tmp) / 'mail-plan-{organization_id}.db'}"
            token = set_current_organization(894001)
            try:
                db = SessionLocal()
                try:
                    mailbox = MailboxAccount(display_name="Sales", email="sales@us.example", provider="smtp", auth_mode="password", connection_state="connected", enabled=1)
                    db.add(mailbox)
                    lead = Lead(
                        company_name="Buyer Legacy",
                        domain="legacy.example",
                        website="",
                        country="DE",
                        market_keyword="hardware",
                        buyer_type="importer",
                        score=72,
                        reason="compat test",
                        evidence_json="[]",
                        status="contacted",
                        contact_email="buyer@legacy.example",
                        draft_subject="Quotation",
                        draft_body="Please see our quotation.",
                    )
                    db.add(lead)
                    db.flush()
                    add_activity(db, lead.id, "draft_approved", "开发信已确认", lead.draft_subject, {})
                    db.commit()

                    out = create_dispatch_plan(lead.id, DispatchPlanRequest(mailbox_id=mailbox.id), db)
                    self.assertTrue(out["legacy_compat"])
                    self.assertEqual(out["state"], "queued")
                    self.assertEqual(db.query(MailDispatchPlan).count(), 0)
                    rows = db.query(MailQueueItem).all()
                    self.assertEqual(len(rows), 1)
                    self.assertEqual(rows[0].lead_id, lead.id)
                    self.assertEqual(rows[0].mailbox_id, mailbox.id)
                finally:
                    db.close()
            finally:
                reset_current_organization(token)


if __name__ == "__main__":
    unittest.main()
