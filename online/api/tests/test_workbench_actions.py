import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.business_center import OnlineCustomer, OnlineDeal  # noqa: E402
from app.company_settings import CompanySetting  # noqa: E402
from app.mail_sync import MailboxMessage  # noqa: E402
from app.main import Lead, SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402
from app.workbench import _day_bounds, _incoming_today, _needs_reply, _today_deal_tasks  # noqa: E402


class WorkbenchActionTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template

    def _open(self, tmp, org):
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = f"sqlite:///{Path(tmp) / 'workbench-{organization_id}.db'}"
        token = set_current_organization(org)
        return token, SessionLocal()

    def _lead(self, db, name="Buyer"):
        row = Lead(company_name=name, domain=f"{name.lower()}.example", website="", country="DE", market_keyword="hardware", buyer_type="importer", score=70, reason="test", evidence_json="[]", status="replied", contact_email=f"sales@{name.lower()}.example")
        db.add(row); db.flush(); return row

    def test_incoming_thread_disappears_after_later_reply(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._open(tmp, 893001)
            try:
                lead = self._lead(db, "BuyerA")
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                incoming = MailboxMessage(mailbox_id=1, provider_message_id="in-1", thread_id="thread-1", direction="incoming", folder="inbox", sender=lead.contact_email, recipients_json="[]", subject="Need quotation", snippet="Please quote", received_at=now, lead_id=lead.id)
                db.add(incoming); db.flush()
                self.assertEqual(len(_needs_reply(db, [incoming])), 1)
                db.add(MailboxMessage(mailbox_id=1, provider_message_id="out-1", thread_id="thread-1", direction="outgoing", folder="sent", sender="sales@us.example", recipients_json="[]", subject="Re: Need quotation", snippet="Sent quotation", received_at=now + timedelta(minutes=3), lead_id=lead.id))
                db.commit()
                self.assertEqual(_needs_reply(db, [incoming]), [])
            finally:
                db.close(); reset_current_organization(token)

    def test_deal_next_action_due_today_enters_today_tasks(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._open(tmp, 893002)
            try:
                db.add(CompanySetting(id=1, timezone_name="Asia/Tokyo", updated_by="Owner")); db.flush()
                customer = OnlineCustomer(company_name="Buyer B", country="JP"); db.add(customer); db.flush()
                zone_start, zone_end, zone = _day_bounds(db)
                local_due = datetime.now(zone).replace(hour=15, minute=0, second=0, microsecond=0)
                deal = OnlineDeal(customer_id=customer.id, title="Buyer B · hinges", stage="quoting", probability=40, currency="USD", amount=1000, product_keyword="hinges", requirements="Need quote", next_action="发送修订报价", next_action_at=local_due.strftime("%Y-%m-%dT%H:%M"))
                db.add(deal); db.commit()
                tasks = _today_deal_tasks(db, zone_end, zone)
                self.assertEqual(len(tasks), 1)
                self.assertEqual(tasks[0]["deal_id"], deal.id)
                self.assertEqual(tasks[0]["detail"], "发送修订报价")
            finally:
                db.close(); reset_current_organization(token)

    def test_company_timezone_changes_today_utc_bounds(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._open(tmp, 893003)
            try:
                db.add(CompanySetting(id=1, timezone_name="Asia/Tokyo", updated_by="Owner")); db.commit()
                start_tokyo, _, _ = _day_bounds(db)
                setting = db.get(CompanySetting, 1); setting.timezone_name = "America/New_York"; db.commit()
                start_ny, _, _ = _day_bounds(db)
                self.assertNotEqual(start_tokyo, start_ny)
            finally:
                db.close(); reset_current_organization(token)


if __name__ == "__main__":
    unittest.main()
