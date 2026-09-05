import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-only-huidi-auto-backup-secret")

from app.daily_app import app  # noqa: F401,E402
from app.backup_automation import (  # noqa: E402
    BackupAutomationState,
    run_automatic_backup_once,
)
from app.main import Lead, SessionLocal  # noqa: E402
from app.notification_delivery import _categories  # noqa: E402
from app.online_notifications import build_notifications  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class BackupAutomationTests(unittest.TestCase):
    def setUp(self):
        self.saved = {key: os.environ.get(key) for key in [
            "HUIDI_TENANT_DATABASE_URL_TEMPLATE",
            "HUIDI_BACKUP_DIR",
            "HUIDI_SECRET_KEY",
            "HUIDI_AUTO_BACKUP",
            "HUIDI_AUTO_BACKUP_HOURS",
        ]}

    def tearDown(self):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _configure(self, tmp: str) -> None:
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'auto-org-{organization_id}.db'}"
        )
        os.environ["HUIDI_BACKUP_DIR"] = str(Path(tmp) / "backups")
        os.environ["HUIDI_SECRET_KEY"] = "ci-only-huidi-auto-backup-secret"
        os.environ["HUIDI_AUTO_BACKUP"] = "1"
        os.environ["HUIDI_AUTO_BACKUP_HOURS"] = "24"

    def test_first_due_run_creates_backup_and_same_cycle_does_not_duplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(883001)
            try:
                db = SessionLocal()
                try:
                    db.add(
                        Lead(
                            company_name="Auto Backup Buyer",
                            domain="auto-backup.example",
                            website="https://auto-backup.example",
                            country="DE",
                            market_keyword="hardware",
                            buyer_type="importer",
                            score=70,
                            reason="auto backup test",
                            evidence_json="[]",
                            status="new",
                        )
                    )
                    db.commit()
                finally:
                    db.close()
                first = run_automatic_backup_once()
                second = run_automatic_backup_once()
                self.assertTrue(first["created"])
                self.assertEqual(first["state"], "ok")
                self.assertFalse(second["created"])
                self.assertEqual(second["state"], "current")
                self.assertEqual(second["backup_id"], first["backup_id"])
                self.assertEqual(len(list((Path(tmp) / "backups").glob("org-883001-*.db"))), 1)
            finally:
                reset_current_organization(token)

    def test_failed_automatic_backup_becomes_high_priority_action(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(883002)
            try:
                with patch("app.backup_automation.create_company_backup", side_effect=RuntimeError("disk full")):
                    result = run_automatic_backup_once(force=True)
                self.assertEqual(result["state"], "failed")
                db = SessionLocal()
                try:
                    state = db.get(BackupAutomationState, 1)
                    self.assertEqual(state.status, "failed")
                    events = build_notifications(db)
                    backup_events = [x for x in events if x["key"].startswith("backup.failed:")]
                    self.assertEqual(len(backup_events), 1)
                    self.assertEqual(backup_events[0]["priority"], "high")
                    self.assertEqual(backup_events[0]["category"], "system")
                    self.assertIn("disk full", backup_events[0]["summary"])
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_legacy_all_reminder_scope_includes_system_but_partial_scope_does_not(self):
        self.assertIn("system", _categories('["reply","followup","mail","deal"]'))
        self.assertNotIn("system", _categories('["reply","followup"]'))


if __name__ == "__main__":
    unittest.main()
