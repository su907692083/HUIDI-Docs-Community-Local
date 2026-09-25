import os
import random
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.daily_app import app
from app.main import Lead, LeadActivity, SessionLocal
from app.online_app import MailSuppression
from app.team_access import Organization
from app.tenant_storage import (
    ControlSessionLocal,
    reset_current_organization,
    set_current_organization,
)


class TenantWebhookTests(unittest.TestCase):
    def setUp(self):
        self.old_team = os.environ.get("HUIDI_TEAM_ACCESS")
        self.old_key = os.environ.get("HUIDI_MAIL_EVENT_KEY")
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        self.temp = tempfile.TemporaryDirectory()
        os.environ["HUIDI_TEAM_ACCESS"] = "1"
        os.environ["HUIDI_MAIL_EVENT_KEY"] = "tenant-webhook-test-key"
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(self.temp.name) / 'org-{organization_id}.db'}"
        )
        self.organization_id = random.randint(910000, 990000000)
        control = ControlSessionLocal()
        try:
            while control.get(Organization, self.organization_id):
                self.organization_id += 1
            control.add(
                Organization(
                    id=self.organization_id,
                    name="Webhook Tenant",
                    slug=f"webhook-{self.organization_id}",
                    enabled=1,
                )
            )
            control.commit()
        finally:
            control.close()

        token = set_current_organization(self.organization_id)
        try:
            db = SessionLocal()
            try:
                db.add(
                    Lead(
                        company_name="Webhook Buyer",
                        domain="webhook-buyer.example",
                        website="https://webhook-buyer.example",
                        country="US",
                        market_keyword="hardware",
                        buyer_type="importer",
                        score=75,
                        reason="webhook test",
                        evidence_json="[]",
                        contact_email="buyer@webhook-buyer.example",
                        status="contacted",
                    )
                )
                db.commit()
            finally:
                db.close()
        finally:
            reset_current_organization(token)

    def tearDown(self):
        control = ControlSessionLocal()
        try:
            row = control.get(Organization, self.organization_id)
            if row:
                control.delete(row)
                control.commit()
        finally:
            control.close()
        if self.old_team is None:
            os.environ.pop("HUIDI_TEAM_ACCESS", None)
        else:
            os.environ["HUIDI_TEAM_ACCESS"] = self.old_team
        if self.old_key is None:
            os.environ.pop("HUIDI_MAIL_EVENT_KEY", None)
        else:
            os.environ["HUIDI_MAIL_EVENT_KEY"] = self.old_key
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template
        self.temp.cleanup()

    def test_provider_callback_routes_to_selected_company_without_user_cookie(self):
        client = TestClient(app)
        response = client.post(
            "/api/mail/events",
            headers={
                "X-HUIDI-Mail-Event-Key": "tenant-webhook-test-key",
                "X-HUIDI-Organization-ID": str(self.organization_id),
            },
            json={
                "event": "unsubscribe",
                "email": "buyer@webhook-buyer.example",
                "reason": "provider unsubscribe",
                "provider_message_id": "provider-msg-1",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

        token = set_current_organization(self.organization_id)
        try:
            db = SessionLocal()
            try:
                suppression = db.scalar(
                    select(MailSuppression).where(
                        MailSuppression.email == "buyer@webhook-buyer.example"
                    )
                )
                self.assertIsNotNone(suppression)
                self.assertEqual(suppression.reason, "unsubscribe")
                activity = db.scalar(
                    select(LeadActivity)
                    .where(LeadActivity.event_type == "mail_unsubscribe")
                    .order_by(LeadActivity.id.desc())
                )
                self.assertIsNotNone(activity)
            finally:
                db.close()
        finally:
            reset_current_organization(token)

    def test_provider_callback_requires_company_header(self):
        client = TestClient(app)
        response = client.post(
            "/api/mail/events",
            headers={"X-HUIDI-Mail-Event-Key": "tenant-webhook-test-key"},
            json={
                "event": "bounce",
                "email": "buyer@webhook-buyer.example",
                "reason": "bounce",
            },
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
