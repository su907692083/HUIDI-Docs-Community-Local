import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class CustomerIntelligenceContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_backend_merges_real_news_industry_and_customer_context_without_demo_risk_facts(self):
        backend = self.text("app/customer_intelligence.py")
        self.assertIn("https://news.google.com/rss/search", backend)
        self.assertIn("https://gnews.io/api/v4/search", backend)
        self.assertIn("https://google.serper.dev/news", backend)
        self.assertIn("HUIDI_INTEL_RSS_SOURCES", backend)
        self.assertIn("Google News RSS", backend)
        self.assertIn("HUIDI 不使用演示冲突等级作为事实", backend)
        self.assertIn("政策、冲突、制裁等内容必须打开来源核对", backend)

    def test_customer_and_deal_routes_return_to_existing_business_objects(self):
        backend = self.text("app/customer_intelligence.py")
        daily = self.text("app/daily_app.py")
        for route in [
            '/api/intel/daily',
            '/api/intel/customer/{lead_id}',
            '/api/intel/deal/{deal_id}',
            '/api/intel/customer/{lead_id}/use',
        ]:
            self.assertIn(route, backend)
        self.assertIn("from . import customer_intelligence", daily)
        self.assertIn("record_intelligence", backend)
        self.assertIn("customer_context_selected", backend)

    def test_ui_places_intelligence_in_today_customer_and_inquiry_instead_of_new_module_wall(self):
        index = self.text("web/index.html")
        ui = self.text("web/customer-intelligence.js")
        self.assertIn("data-huidi-intelligence", index)
        self.assertIn("/assets/customer-intelligence.js", index)
        self.assertIn("今天值得知道", ui)
        self.assertIn("客户动态与聊天参考", ui)
        self.assertIn("市场与政策动态", ui)
        self.assertIn("复制英文开场", ui)
        self.assertIn("记入本次沟通", ui)
        self.assertIn("政治、冲突、制裁等敏感内容默认只提醒", ui)
        self.assertIn("HUIDIDailyWorkbench?.refresh?.()", ui)

    def test_new_browser_owner_and_routes_are_gated_by_ci(self):
        workflow = (REPO / ".github" / "workflows" / "online-v01-check.yml").read_text(encoding="utf-8")
        self.assertIn("web/customer-intelligence.js", workflow)
        self.assertIn("'/api/intel/customer/{lead_id}'", workflow)
        self.assertIn("'/api/intel/deal/{deal_id}'", workflow)
        self.assertIn("GNEWS_API_KEY", workflow)


if __name__ == "__main__":
    unittest.main()
