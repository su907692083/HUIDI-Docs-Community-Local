import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.main import DB_URL, Lead, SessionLocal  # noqa: E402
from app.tenant_storage import (  # noqa: E402
    reset_current_organization,
    set_current_organization,
    tenant_database_url,
)

# Contract marker: physically separate business databases.


class TenantStorageTests(unittest.TestCase):
    def test_default_organization_preserves_historical_database(self):
        self.assertEqual(tenant_database_url(1), DB_URL)

    def test_two_organizations_use_physically_separate_business_databases(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            template = f"sqlite:///{Path(tmp) / 'organization-{organization_id}.db'}"
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = template
            org_a = 880001
            org_b = 880002

            token_a = set_current_organization(org_a)
            try:
                db_a = SessionLocal()
                try:
                    db_a.add(
                        Lead(
                            company_name="Tenant A Only",
                            domain="tenant-a.example",
                            website="https://tenant-a.example",
                            country="A",
                            market_keyword="hardware",
                            buyer_type="importer",
                            score=80,
                            reason="tenant isolation test",
                            evidence_json="[]",
                            status="new",
                        )
                    )
                    db_a.commit()
                    names_a = [x.company_name for x in db_a.query(Lead).all()]
                    self.assertIn("Tenant A Only", names_a)
                    self.assertNotIn("Tenant B Only", names_a)
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(org_b)
            try:
                db_b = SessionLocal()
                try:
                    # A new tenant starts with the same schema, but no rows from A.
                    self.assertEqual(db_b.query(Lead).count(), 0)
                    db_b.add(
                        Lead(
                            company_name="Tenant B Only",
                            domain="tenant-b.example",
                            website="https://tenant-b.example",
                            country="B",
                            market_keyword="hardware",
                            buyer_type="distributor",
                            score=70,
                            reason="tenant isolation test",
                            evidence_json="[]",
                            status="new",
                        )
                    )
                    db_b.commit()
                    names_b = [x.company_name for x in db_b.query(Lead).all()]
                    self.assertIn("Tenant B Only", names_b)
                    self.assertNotIn("Tenant A Only", names_b)
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)

            token_a = set_current_organization(org_a)
            try:
                db_a = SessionLocal()
                try:
                    names_a_again = [x.company_name for x in db_a.query(Lead).all()]
                    self.assertIn("Tenant A Only", names_a_again)
                    self.assertNotIn("Tenant B Only", names_a_again)
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

        if old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = old_template


if __name__ == "__main__":
    unittest.main()
