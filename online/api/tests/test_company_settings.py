import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.company_settings import CompanySetting, company_timezone_name  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class CompanySettingsTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        self.old_timezone = os.environ.get("HUIDI_TIMEZONE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template
        if self.old_timezone is None:
            os.environ.pop("HUIDI_TIMEZONE", None)
        else:
            os.environ["HUIDI_TIMEZONE"] = self.old_timezone

    def _template(self, tmp):
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'company-settings-{organization_id}.db'}"
        )

    def test_default_timezone_falls_back_to_server_setting(self):
        os.environ["HUIDI_TIMEZONE"] = "Asia/Tokyo"
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token = set_current_organization(891001)
            try:
                db = SessionLocal()
                try:
                    self.assertEqual(company_timezone_name(db), "Asia/Tokyo")
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_company_timezones_are_physically_isolated(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token_a = set_current_organization(891101)
            try:
                db_a = SessionLocal()
                try:
                    db_a.add(CompanySetting(id=1, timezone_name="Europe/London", updated_by="A"))
                    db_a.commit()
                    self.assertEqual(company_timezone_name(db_a), "Europe/London")
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(891102)
            try:
                db_b = SessionLocal()
                try:
                    self.assertEqual(db_b.query(CompanySetting).count(), 0)
                    self.assertNotEqual(company_timezone_name(db_b), "Europe/London")
                    db_b.add(CompanySetting(id=1, timezone_name="America/New_York", updated_by="B"))
                    db_b.commit()
                    self.assertEqual(company_timezone_name(db_b), "America/New_York")
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)

            token_a = set_current_organization(891101)
            try:
                db_a = SessionLocal()
                try:
                    self.assertEqual(company_timezone_name(db_a), "Europe/London")
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)


if __name__ == "__main__":
    unittest.main()
