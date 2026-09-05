import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class TodayIntelligenceContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_today_intelligence_reuses_saved_customer_results_without_network_fanout(self):
        backend = self.text("app/today_intelligence.py")
        self.assertIn('/api/intel/today-actions', backend)
        self.assertIn('mode": "cached_only', backend)
        self.assertIn('network_requests": 0', backend)
        self.assertIn('OnlineIntelligenceRecord.kind == "market_news"', backend)
        self.assertIn('_decorate_cached', backend)
        for forbidden in ['httpx.', 'news.google.com', 'gnews.io', 'google.serper.dev']:
            self.assertNotIn(forbidden, backend)

    def test_today_only_surfaces_active_customer_or_inquiry_context(self):
        backend = self.text("app/today_intelligence.py")
        self.assertIn("ACTIVE_LEAD_STATES", backend)
        self.assertIn("ACTIVE_DEAL_STATES", backend)
        self.assertIn("chat_allowed", backend)
        self.assertIn("watch_categories", backend)
        self.assertIn("fresh", backend)
        self.assertIn("aging", backend)
        self.assertIn("company_name", backend)
        self.assertIn("deal_title", backend)

    def test_today_ui_returns_to_existing_customer_and_intelligence_owners(self):
        index = self.text("web/index.html")
        ui = self.text("web/today-intelligence.js")
        self.assertIn('/assets/today-intelligence.js', index)
        self.assertIn('/api/intel/today-actions?limit=4', ui)
        self.assertIn('HUIDILeadWorkbench?.open?.', ui)
        self.assertIn('HUIDICustomerIntelligence?.openCustomer?.', ui)
        self.assertIn('HUIDICustomerIntelligence?.openDeal?.', ui)
        self.assertIn('不会批量请求外部新闻', ui)
        self.assertIn('不会为了填满首页生成假内容', ui)

    def test_today_owner_is_registered_and_ci_gated(self):
        daily = self.text("app/daily_app.py")
        workflow = (REPO / ".github" / "workflows" / "online-v01-check.yml").read_text(encoding="utf-8")
        self.assertIn("from . import today_intelligence", daily)
        self.assertIn("'/api/intel/today-actions'", workflow)
        self.assertIn("web/today-intelligence.js", workflow)


if __name__ == "__main__":
    unittest.main()
