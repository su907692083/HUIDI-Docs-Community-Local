import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-only-huidi-service-secret")

from app.daily_app import app  # noqa: F401,E402
from app.main import SessionLocal  # noqa: E402
from app.service_connections import (  # noqa: E402
    ServiceConnection,
    _encrypt,
    public_service_status,
    resolve_service_connection,
)
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class ServiceConnectionTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        self.old_company_url = os.environ.get("HUIDI_COMPANY_LOOKUP_URL")
        self.old_company_token = os.environ.get("HUIDI_COMPANY_LOOKUP_TOKEN")
        os.environ.pop("HUIDI_COMPANY_LOOKUP_URL", None)
        os.environ.pop("HUIDI_COMPANY_LOOKUP_TOKEN", None)

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template
        if self.old_company_url is None:
            os.environ.pop("HUIDI_COMPANY_LOOKUP_URL", None)
        else:
            os.environ["HUIDI_COMPANY_LOOKUP_URL"] = self.old_company_url
        if self.old_company_token is None:
            os.environ.pop("HUIDI_COMPANY_LOOKUP_TOKEN", None)
        else:
            os.environ["HUIDI_COMPANY_LOOKUP_TOKEN"] = self.old_company_token

    def test_company_token_is_encrypted_and_never_returned_publicly(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'service-org-{organization_id}.db'}"
            )
            token = set_current_organization(771001)
            try:
                db = SessionLocal()
                try:
                    encrypted = _encrypt("company-secret-token")
                    self.assertNotIn("company-secret-token", encrypted)
                    db.add(
                        ServiceConnection(
                            service_key="company",
                            endpoint_url="https://company-data.example/api",
                            encrypted_token=encrypted,
                            enabled=1,
                            updated_by="Owner",
                        )
                    )
                    db.commit()
                    resolved = resolve_service_connection(db, "company")
                    self.assertEqual(resolved["source"], "company")
                    self.assertEqual(resolved["token"], "company-secret-token")
                    public = public_service_status(db, "company")
                    self.assertTrue(public["connected"])
                    self.assertTrue(public["token_saved"])
                    self.assertNotIn("token", public)
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_company_service_settings_are_physically_isolated(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'service-org-{organization_id}.db'}"
            )
            org_a = 772001
            org_b = 772002
            token_a = set_current_organization(org_a)
            try:
                db_a = SessionLocal()
                try:
                    db_a.add(
                        ServiceConnection(
                            service_key="trade",
                            endpoint_url="https://trade-a.example/api",
                            encrypted_token=_encrypt("token-a"),
                            enabled=1,
                            updated_by="A Owner",
                        )
                    )
                    db_a.commit()
                    self.assertTrue(public_service_status(db_a, "trade")["connected"])
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(org_b)
            try:
                db_b = SessionLocal()
                try:
                    self.assertEqual(db_b.query(ServiceConnection).count(), 0)
                    self.assertFalse(public_service_status(db_b, "trade")["connected"])
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)

    def test_server_setting_is_fallback_when_company_has_no_override(self):
        os.environ["HUIDI_COMPANY_LOOKUP_URL"] = "https://platform-company.example/api"
        os.environ["HUIDI_COMPANY_LOOKUP_TOKEN"] = "platform-token"
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'service-org-{organization_id}.db'}"
            )
            token = set_current_organization(773001)
            try:
                db = SessionLocal()
                try:
                    resolved = resolve_service_connection(db, "company")
                    self.assertEqual(resolved["source"], "server")
                    self.assertTrue(resolved["connected"])
                    self.assertEqual(resolved["token"], "platform-token")
                    public = public_service_status(db, "company")
                    self.assertEqual(public["source"], "server")
                    self.assertEqual(public["endpoint_url"], "")
                finally:
                    db.close()
            finally:
                reset_current_organization(token)


if __name__ == "__main__":
    unittest.main()
