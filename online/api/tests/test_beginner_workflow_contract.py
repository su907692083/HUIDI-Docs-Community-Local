import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class BeginnerWorkflowContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_home_navigation_is_business_first_and_avoids_duplicate_product_entry(self):
        index = self.text("web/index.html")
        product = self.text("web/product-brain.js")
        self.assertIn("今天的工作", index)
        self.assertIn("潜在客户", index)
        self.assertIn("形式发票 PI", index)
        self.assertIn("商业发票 CI", index)
        self.assertIn("数据来源", index)
        self.assertEqual(index.count("data-huidi-product>"), 1)
        self.assertIn('data-huidi-mail-folder="sent"', index)
        self.assertNotIn("installNav()", product)
        self.assertNotIn("产品大脑", product)
        self.assertNotIn("Buying Signals", product)
        self.assertNotIn("当前 Campaign", product)
        self.assertIn("产品资料", product)
        self.assertIn("当前开发重点", product)

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

    def test_customer_detail_workflow_is_plain_business_progress(self):
        growth = self.text("web/growth-workflow.js")
        for label in ["产品准备", "客户发现", "客户背调", "邮件准备", "联系客户", "业务推进"]:
            self.assertIn(label, growth)
        self.assertIn("近期采购迹象 · 公开资料", growth)
        self.assertIn("尚未处理", growth)
        for jargon in ["Buying Signals", "Strategy", "Hunter", "Profiler", "Writer", "Outreach", "Closer", "Product Brain", "Community Local"]:
            self.assertNotIn(jargon, growth)

    def test_common_technical_errors_are_rewritten_for_normal_users(self):
        plain = self.text("web/plain-language.js")
        self.assertIn("friendlyMessage", plain)
        self.assertIn("当前账号没有这个操作权限", plain)
        self.assertIn("业务数据暂时无法读取", plain)
        self.assertIn("window.alert=message=>nativeAlert(friendlyMessage(message))", plain)
        for internal_word in ["Queue", "Tenant", "Schema", "Database", "Endpoint"]:
            self.assertIn(f"['{internal_word}'", plain)

    def test_mail_setup_keeps_transport_details_out_of_beginner_copy(self):
        mail = self.text("web/mail-governance.js")
        self.assertIn("连接其他邮箱", mail)
        self.assertIn("服务器地址", mail)
        self.assertIn("自动安全连接（推荐）", mail)
        self.assertIn("邮箱密码 / 专用密码", mail)
        self.assertIn("邮件已发送成功", mail)
        self.assertNotIn("SMTP 已开放", mail)
        self.assertNotIn("HUIDI_SECRET_KEY", mail)
        self.assertNotIn(">OAuth2<", mail)
        self.assertNotIn("Message-ID", mail)

    def test_mail_conversation_returns_to_today_and_uses_friendly_errors(self):
        thread = self.text("web/mail-thread-ui.js")
        self.assertIn("同一客户的连续来往邮件", thread)
        self.assertIn("HUIDIBeginnerFlow?.refresh?.()", thread)
        self.assertIn("friendly(e)", thread)
        self.assertNotIn("alert(e.message||e)", thread)

    def test_inquiry_flow_uses_chinese_document_names_and_refreshes_next_action(self):
        business = self.text("web/business-center-ui.js")
        self.assertIn("把当前潜在客户转为询盘", business)
        self.assertIn("形式发票 PI", business)
        self.assertIn("商业发票 CI", business)
        self.assertIn("销售合同", business)
        self.assertIn("保存询盘进度", business)
        self.assertIn("HUIDIBeginnerFlow?.refresh?.()", business)

    def test_automatic_followup_returns_state_to_beginner_workflow(self):
        sequence = self.text("web/sequence-ui.js")
        self.assertIn("客户回复、退订或进入正式询盘后", sequence)
        self.assertIn("HUIDIBeginnerFlow?.refresh?.()", sequence)
        self.assertIn("邮件主题", sequence)
        self.assertIn("等待时间（小时）", sequence)

    def test_readiness_is_presented_as_usage_check_not_database_training(self):
        readiness = self.text("app/production_readiness.py")
        safety = self.text("web/admin-safety.js")
        self.assertIn("安全保护", readiness)
        self.assertIn("数据升级", readiness)
        self.assertIn("使用检查与数据备份", safety)
        self.assertIn("这里只告诉你结果和下一步", safety)
        self.assertNotIn("数据库结构版本", readiness)
        self.assertNotIn("PostgreSQL 服务器数据库", readiness)

    def test_operation_history_uses_business_names_without_internal_record_ids(self):
        audit = self.text("web/audit-ui.js")
        self.assertIn("['lead','潜在客户']", audit)
        self.assertIn("修改数据来源特殊要求", audit)
        self.assertIn("return map[x.resource_type]||''", audit)
        self.assertNotIn("客户线索", audit)

    def test_team_management_hides_platform_and_company_internal_ids(self):
        team = self.text("web/team-access.js")
        self.assertIn("公司账号", team)
        self.assertIn("不同公司的客户、邮件、产品和业务不会混在一起", team)
        self.assertNotIn("正式部署中开启团队登录", team)
        self.assertNotIn("平台工作区", team)
        self.assertNotIn("公司 #", team)

    def test_connected_data_history_never_prints_raw_json_to_users(self):
        history = self.text("web/intelligence-history.js")
        self.assertIn("compactNormalized", history)
        self.assertIn("贸易记录", history)
        self.assertIn("关税资料", history)
        self.assertIn("船期 / 物流", history)
        self.assertNotIn("JSON.stringify(r)", history)
        self.assertNotIn("compactResult", history)

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
