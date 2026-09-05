import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.backup_restore import create_company_backup  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.online_app import MailboxAccount  # noqa: E402
from app.production_readiness import build_production_readiness  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class ProductionReadinessTests(unittest.TestCase):
    def setUp(self):
        self.saved = {key: os.environ.get(key) for key in [
            "HUIDI_TENANT_DATABASE_URL_TEMPLATE",
            "HUIDI_BACKUP_DIR",
            "HUIDI_SECRET_KEY",
            "APP_ENV",
            "HUIDI_TEAM_ACCESS",
            "SERPER_API_KEY",
            "HUIDI_MAIL_EVENT_KEY",
            "LLM_API_KEY",
        ]}

    def tearDown(self):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _configure(self, tmp: str) -> None:
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'ready-org-{organization_id}.db'}"
        )
        os.environ["HUIDI_BACKUP_DIR"] = str(Path(tmp) / "backups")
        os.environ["HUIDI_SECRET_KEY"] = "a-stable-production-safety-key-with-more-than-32-chars"
        os.environ["APP_ENV"] = "development"
        os.environ["HUIDI_TEAM_ACCESS"] = "0"
        os.environ["SERPER_API_KEY"] = ""
        os.environ["HUIDI_MAIL_EVENT_KEY"] = ""
        os.environ["LLM_API_KEY"] = ""

    def test_readiness_reports_real_backup_and_mail_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(882001)
            try:
                db = SessionLocal()
                try:
                    db.add(
                        MailboxAccount(
                            display_name="Sales",
                            email="sales@example.com",
                            provider="smtp",
                            auth_mode="password",
                            connection_state="connected",
                            enabled=1,
                        )
                    )
                    db.commit()
                finally:
                    db.close()
                create_company_backup("manual")
                out = build_production_readiness()
                by_name = {item["name"]: item for item in out["items"]}
                self.assertEqual(by_name["服务器安全密钥"]["state"], "ready")
                self.assertEqual(by_name["最近备份"]["state"], "ready")
                self.assertEqual(by_name["发送邮箱"]["state"], "ready")
                self.assertEqual(by_name["找客户 / 地图 / 市场动态"]["state"], "action")
                self.assertFalse(out["ready_for_daily_use"])
            finally:
                reset_current_organization(token)

    def test_production_multi_user_without_team_login_is_blocking_action(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            os.environ["APP_ENV"] = "production"
            os.environ["HUIDI_TEAM_ACCESS"] = "0"
            token = set_current_organization(882002)
            try:
                out = build_production_readiness()
                by_name = {item["name"]: item for item in out["items"]}
                self.assertEqual(by_name["团队登录"]["state"], "action")
            finally:
                reset_current_organization(token)


if __name__ == "__main__":
    unittest.main()
