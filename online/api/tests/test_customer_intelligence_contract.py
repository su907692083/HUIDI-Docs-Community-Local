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
            '/api/intel/customer/{lead_id}/apply-to-draft',
        ]:
            self.assertIn(route, backend)
        self.assertIn("from . import customer_intelligence", daily)
        self.assertIn("record_intelligence", backend)
        self.assertIn("customer_context_selected", backend)
        self.assertIn('"lead_id": lead_id', backend)
        self.assertIn('"deal_id": deal_id', backend)

    def test_news_freshness_and_source_type_gate_customer_chat(self):
        backend = self.text("app/customer_intelligence.py")
        self.assertIn("HUIDI_INTEL_CHAT_MAX_DAYS", backend)
        self.assertIn("_parse_published_at", backend)
        self.assertIn("chat_allowed", backend)
        self.assertIn("时间待核对", backend)
        self.assertIn("过期参考", backend)
        self.assertIn("official", backend)
        self.assertIn("association", backend)
        self.assertIn("官方来源", backend)
        self.assertIn("行业协会", backend)
        self.assertIn("媒体聚合", backend)

    def test_selected_news_can_enter_existing_draft_only_with_safety_gates(self):
        backend = self.text("app/customer_intelligence.py")
        self.assertIn("apply_customer_context_to_draft", backend)
        self.assertIn("_verified_customer_item", backend)
        self.assertIn("请先生成开发信草稿", backend)
        self.assertIn("这条动态不适合直接带入客户沟通", backend)
        self.assertIn("请先打开原文核对日期和内容", backend)
        self.assertIn("draft_context_applied", backend)
        self.assertIn("draft_rejected", backend)
        self.assertIn("草稿内容已更新，需要重新确认", backend)

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
        self.assertIn("带入开发信", ui)
        self.assertIn("适合沟通", ui)
        self.assertIn("政治、冲突、制裁等敏感内容默认只提醒", ui)
        self.assertIn("HUIDIDailyWorkbench?.refresh?.()", ui)
        self.assertIn("sourceCheck", ui)
        self.assertIn("out.lead_id", ui)

    def test_formal_customer_and_inquiry_can_reopen_the_real_lead_owner(self):
        app = self.text("web/app.js")
        business = self.text("web/business-center-ui.js")
        self.assertIn("window.HUIDILeadWorkbench", app)
        self.assertIn("window.openLead=openLead", app)
        self.assertIn("HUIDICustomerIntelligence?.loadCustomer", app)
        self.assertIn("openLead(id)", business)
        self.assertIn("data-open-lead", business)

    def test_new_browser_owner_and_routes_are_gated_by_ci(self):
        workflow = (REPO / ".github" / "workflows" / "online-v01-check.yml").read_text(encoding="utf-8")
        self.assertIn("web/customer-intelligence.js", workflow)
        self.assertIn("'/api/intel/customer/{lead_id}'", workflow)
        self.assertIn("'/api/intel/deal/{deal_id}'", workflow)
        self.assertIn("'/api/intel/customer/{lead_id}/apply-to-draft'", workflow)
        self.assertIn("GNEWS_API_KEY", workflow)


if __name__ == "__main__":
    unittest.main()
