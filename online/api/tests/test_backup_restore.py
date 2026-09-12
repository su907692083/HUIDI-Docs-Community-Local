import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-only-huidi-backup-secret-key")

from app.daily_app import app  # noqa: F401,E402
from app.backup_restore import (  # noqa: E402
    CONTROL_TABLES,
    _backup_paths,
    create_company_backup,
    restore_company_backup,
    verify_company_backup,
)
from app.main import Lead, SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class BackupRestoreTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        self.old_backup_dir = os.environ.get("HUIDI_BACKUP_DIR")
        self.old_key = os.environ.get("HUIDI_SECRET_KEY")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template
        if self.old_backup_dir is None:
            os.environ.pop("HUIDI_BACKUP_DIR", None)
        else:
            os.environ["HUIDI_BACKUP_DIR"] = self.old_backup_dir
        if self.old_key is None:
            os.environ.pop("HUIDI_SECRET_KEY", None)
        else:
            os.environ["HUIDI_SECRET_KEY"] = self.old_key

    def _configure(self, tmp: str) -> None:
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'backup-org-{organization_id}.db'}"
        )
        os.environ["HUIDI_BACKUP_DIR"] = str(Path(tmp) / "backups")
        os.environ["HUIDI_SECRET_KEY"] = "ci-only-huidi-backup-secret-key"

    @staticmethod
    def _lead(name: str, domain: str) -> Lead:
        return Lead(
            company_name=name,
            domain=domain,
            website=f"https://{domain}",
            country="DE",
            market_keyword="hardware",
            buyer_type="importer",
            score=70,
            reason="backup restore test",
            evidence_json="[]",
            status="new",
        )

    def test_backup_restores_business_rows_and_keeps_a_safety_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(881001)
            try:
                db = SessionLocal()
                try:
                    db.add(self._lead("Before Backup", "before-backup.example"))
                    db.commit()
                finally:
                    db.close()

                backup = create_company_backup("manual")
                verify_company_backup(backup["id"])

                db = SessionLocal()
                try:
                    db.add(self._lead("After Backup", "after-backup.example"))
                    db.commit()
                    self.assertEqual(db.query(Lead).count(), 2)
                finally:
                    db.close()

                restored = restore_company_backup(backup["id"])
                self.assertEqual(restored["restored"]["id"], backup["id"])
                self.assertEqual(restored["safety_backup"]["reason"], "before_restore")

                db = SessionLocal()
                try:
                    names = [row.company_name for row in db.query(Lead).order_by(Lead.id).all()]
                    self.assertEqual(names, ["Before Backup"])
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_backup_never_contains_control_plane_tables(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(881002)
            try:
                db = SessionLocal()
                try:
                    db.add(self._lead("Business Only", "business-only.example"))
                    db.commit()
                finally:
                    db.close()
                backup = create_company_backup("manual")
                db_path, _ = _backup_paths(881002, backup["id"])
                conn = sqlite3.connect(str(db_path))
                try:
                    tables = {
                        str(row[0])
                        for row in conn.execute(
                            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                        ).fetchall()
                    }
                finally:
                    conn.close()
                self.assertTrue("leads" in tables)
                self.assertTrue(CONTROL_TABLES.isdisjoint(tables))
            finally:
                reset_current_organization(token)

    def test_backup_is_bound_to_the_current_company(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token_a = set_current_organization(881003)
            try:
                db = SessionLocal()
                try:
                    db.add(self._lead("Company A", "company-a-backup.example"))
                    db.commit()
                finally:
                    db.close()
                backup = create_company_backup("manual")
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(881004)
            try:
                with self.assertRaises(Exception):
                    verify_company_backup(backup["id"])
                db = SessionLocal()
                try:
                    self.assertEqual(db.query(Lead).count(), 0)
                finally:
                    db.close()
            finally:
                reset_current_organization(token_b)

    def test_restore_stops_when_server_safety_key_changed(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(881005)
            try:
                db = SessionLocal()
                try:
                    db.add(self._lead("Key Check", "key-check.example"))
                    db.commit()
                finally:
                    db.close()
                backup = create_company_backup("manual")
                os.environ["HUIDI_SECRET_KEY"] = "a-different-production-safety-key"
                with self.assertRaises(Exception):
                    restore_company_backup(backup["id"])
            finally:
                reset_current_organization(token)


if __name__ == "__main__":
    unittest.main()
