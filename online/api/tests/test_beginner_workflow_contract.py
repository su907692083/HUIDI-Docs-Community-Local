import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class BeginnerWorkflowContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_home_navigation_is_business_first_and_avoids_duplicate_product_entry(self):
        index = self.text("web/index.html")
        self.assertIn("今天的工作", index)
        self.assertIn("潜在客户", index)
        self.assertIn("形式发票 PI", index)
        self.assertIn("商业发票 CI", index)
        self.assertIn("数据来源", index)
        self.assertEqual(index.count("data-huidi-product>"), 1)
        self.assertIn('data-huidi-mail-folder="sent"', index)

    def test_beginner_flow_uses_existing_business_owners_instead_of_new_fake_state(self):
        flow = self.text("web/beginner-flow.js")
        self.assertIn("不用找入口，按当前事情往下做", flow)
        self.assertIn("/api/workbench/today", flow)
        self.assertIn("HUIDIDailyServices", flow)
        self.assertIn("HUIDIBusinessCenter", flow)
        self.assertIn("HUIDIProductBrain", flow)
        self.assertIn("先回复", flow)
        self.assertIn("先处理", flow)
        self.assertIn("做报价", flow)

    def test_common_technical_errors_are_rewritten_for_normal_users(self):
        plain = self.text("web/plain-language.js")
        self.assertIn("friendlyMessage", plain)
        self.assertIn("当前账号没有这个操作权限", plain)
        self.assertIn("业务数据暂时无法读取", plain)
        self.assertIn("window.alert=message=>nativeAlert(friendlyMessage(message))", plain)
        for internal_word in ["Queue", "Tenant", "Schema", "Database", "Endpoint"]:
            self.assertIn(f"['{internal_word}'", plain)

    def test_data_source_special_transport_settings_are_collapsed_and_plain(self):
        adapter = self.text("web/service-adapter-ui.js")
        settings = self.text("web/service-settings.js")
        self.assertIn("服务商特殊要求（一般不用改）", adapter)
        self.assertIn("标准授权（推荐）", adapter)
        self.assertIn("服务商指定名称", adapter)
        self.assertIn("数据来源", settings)
        self.assertIn("服务商提供的连接地址", settings)

    def test_sidebar_can_scroll_without_covering_last_entries(self):
        css = self.text("web/app.css")
        self.assertIn("overflow-y:auto", css)
        self.assertIn(".side-note{position:static", css)

    def test_new_browser_owner_is_in_ci_syntax_gate(self):
        workflow = (REPO / ".github" / "workflows" / "online-v01-check.yml").read_text(encoding="utf-8")
        self.assertIn("web/beginner-flow.js", workflow)


if __name__ == "__main__":
    unittest.main()
