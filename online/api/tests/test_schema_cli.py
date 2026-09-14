import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.schema_cli import database_status, upgrade_database  # noqa: E402
from app.schema_migrations import LATEST_SCHEMA_REVISION  # noqa: E402


class SchemaCliTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template

    def test_status_detects_pending_revision_before_explicit_upgrade(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'cli-{organization_id}.db'}"
            )
            before = database_status(897001)
            self.assertTrue(before["connected"])
            self.assertFalse(before["up_to_date"])
            self.assertIn(LATEST_SCHEMA_REVISION, before["pending"])

            upgraded = upgrade_database(897001)
            self.assertTrue(upgraded["connected"])
            self.assertTrue(upgraded["up_to_date"])
            self.assertEqual(upgraded["current_revision"], LATEST_SCHEMA_REVISION)

            after = database_status(897001)
            self.assertTrue(after["up_to_date"])
            self.assertEqual(after["pending"], [])

    def test_repeated_upgrade_is_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'cli-{organization_id}.db'}"
            )
            first = upgrade_database(897002)
            second = upgrade_database(897002)
            self.assertTrue(first["up_to_date"])
            self.assertTrue(second["up_to_date"])
            self.assertEqual(second["newly_applied"], [])


if __name__ == "__main__":
    unittest.main()
