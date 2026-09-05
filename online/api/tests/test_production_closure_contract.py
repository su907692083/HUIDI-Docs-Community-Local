import subprocess
import unittest
from pathlib import Path

from app.daily_app import app
from app import acquisition_provider_fusion

ROOT = Path(__file__).resolve().parents[1]


class ProductionClosureContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_acquisition_fusion_is_actually_loaded(self):
        daily = self.text("app/daily_app.py")
        guard = self.text("app/provider_guard.py")
        fusion = self.text("app/acquisition_provider_fusion.py")
        self.assertIn("from . import acquisition_provider_fusion", daily)
        self.assertIn("TAVILY_API_KEY", guard)
        self.assertIn("HUNTER_API_KEY", guard)
        self.assertIn("_company_search_with_failover", fusion)
        self.assertIn("serper_search", fusion)
        self.assertIn("_handle_hunter_contact", fusion)
        status = acquisition_provider_fusion.acquisition_provider_status()
        self.assertIn("live_company_search", status)
        self.assertIn("live_contact_search", status)

    def test_production_routes_are_registered(self):
        paths = {route.path for route in app.routes}
        self.assertIn("/api/acquisition/status", paths)
        self.assertIn("/api/growth/funnel", paths)
        self.assertIn("/api/mail/messages", paths)
        self.assertIn("/api/mail/queue", paths)
        self.assertIn("/api/mail/threads", paths)

    def test_funnel_uses_real_delivery_reply_and_business_tables(self):
        source = self.text("app/growth_funnel.py")
        for token in ["MailDeliveryLog", "MailboxMessage", "OnlineDeal", "OnlineDocumentRef", 'MailDeliveryLog.state == "sent"', 'MailboxMessage.direction == "incoming"']:
            self.assertIn(token, source)
        self.assertNotIn("demo", source.lower())

    def test_history_has_opt_in_server_pagination_without_breaking_old_routes(self):
        source = self.text("app/history_pagination.py")
        self.assertIn('request.query_params.get("paged")', source)
        self.assertIn('path == "/api/mail/messages"', source)
        self.assertIn('path == "/api/mail/queue"', source)
        self.assertIn('path == "/api/mail/threads"', source)
        self.assertIn("row_number().over", source)

    def test_new_browser_owners_are_loaded_and_parse(self):
        index = self.text("web/index.html")
        files = [
            "web/acquisition-status-ui.js",
            "web/growth-funnel-ui.js",
            "web/mail-list-pagination-ui.js",
            "web/mail-thread-ui.js",
        ]
        for file in files:
            name = Path(file).name
            self.assertIn(f'/assets/{name}', index)
            result = subprocess.run(["node", "--check", str(ROOT / file)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_no_second_customer_or_mail_shell_was_added(self):
        fusion = self.text("app/acquisition_provider_fusion.py")
        self.assertIn("Lead", fusion)
        self.assertNotIn("class LegacyLead", fusion)
        self.assertNotIn("class LegacyMailbox", fusion)
        funnel_ui = self.text("web/growth-funnel-ui.js")
        self.assertIn("#dailyWorkbench", funnel_ui)


if __name__ == "__main__":
    unittest.main()
