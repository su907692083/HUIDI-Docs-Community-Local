import os
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.schema_migrations import LATEST_SCHEMA_REVISION, apply_schema_migrations  # noqa: E402
from app.tenant_storage import (  # noqa: E402
    ensure_tenant_schema,
    reset_current_organization,
    set_current_organization,
    tenant_schema_status,
)


class SchemaMigrationTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template

    def test_each_company_database_records_the_current_revision(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'schema-{organization_id}.db'}"
            )
            for organization_id in (896001, 896002):
                token = set_current_organization(organization_id)
                try:
                    engine = ensure_tenant_schema(organization_id)
                    status = tenant_schema_status(organization_id)
                    self.assertTrue(status["up_to_date"])
                    self.assertEqual(status["current_revision"], LATEST_SCHEMA_REVISION)
                    inspector = inspect(engine)
                    tables = set(inspector.get_table_names())
                    self.assertIn("huidi_schema_migrations", tables)
                    self.assertIn("online_intelligence_projections", tables)
                    self.assertIn("intelligence_feed_sources", tables)
                    self.assertIn("lead_industry_preferences", tables)
                    self.assertIn("online_customer_addresses", tables)
                    self.assertIn("company_bank_accounts", tables)
                    document_columns = {x["name"] for x in inspector.get_columns("online_document_refs")}
                    self.assertIn("payload_json", document_columns)
                    setting_columns = {x["name"] for x in inspector.get_columns("company_settings")}
                    for name in {
                        "company_name",
                        "legal_name",
                        "country",
                        "address",
                        "website",
                        "phone",
                        "email",
                        "tax_id",
                    }:
                        self.assertIn(name, setting_columns)
                finally:
                    reset_current_organization(token)

    def test_migration_application_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'schema-{organization_id}.db'}"
            )
            token = set_current_organization(896003)
            try:
                engine = ensure_tenant_schema(896003)
                first = apply_schema_migrations(engine)
                second = apply_schema_migrations(engine)
                self.assertTrue(first["up_to_date"])
                self.assertTrue(second["up_to_date"])
                self.assertEqual(second["newly_applied"], [])
                self.assertEqual(second["pending"], [])
            finally:
                reset_current_organization(token)

    def test_legacy_document_and_company_tables_are_upgraded_in_place(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = create_engine(f"sqlite:///{Path(tmp) / 'legacy-document.db'}")
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE TABLE online_document_refs ("
                        "id INTEGER PRIMARY KEY, deal_id INTEGER NOT NULL, "
                        "document_type VARCHAR(80) NOT NULL, document_id VARCHAR(160) NOT NULL DEFAULT '', "
                        "state VARCHAR(40) NOT NULL DEFAULT 'draft', title VARCHAR(255) NOT NULL DEFAULT '', "
                        "created_at DATETIME, updated_at DATETIME)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE TABLE company_settings ("
                        "id INTEGER PRIMARY KEY, timezone_name VARCHAR(80) NOT NULL DEFAULT 'Asia/Shanghai', "
                        "updated_by VARCHAR(160) NOT NULL DEFAULT '', updated_at DATETIME)"
                    )
                )
            before = {x["name"] for x in inspect(engine).get_columns("online_document_refs")}
            self.assertNotIn("payload_json", before)
            first = apply_schema_migrations(engine)
            inspector = inspect(engine)
            after = {x["name"] for x in inspector.get_columns("online_document_refs")}
            self.assertIn("payload_json", after)
            self.assertIn("online_customer_addresses", inspector.get_table_names())
            self.assertIn("company_bank_accounts", inspector.get_table_names())
            settings = {x["name"] for x in inspector.get_columns("company_settings")}
            self.assertIn("legal_name", settings)
            self.assertIn("address", settings)
            self.assertIn("tax_id", settings)
            self.assertTrue(first["up_to_date"])
            second = apply_schema_migrations(engine)
            self.assertEqual(second["newly_applied"], [])


if __name__ == "__main__":
    unittest.main()
