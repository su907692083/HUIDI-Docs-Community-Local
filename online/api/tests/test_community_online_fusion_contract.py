from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"
PUBLIC = REPO / "public"


class CommunityOnlineFusionContractTests(unittest.TestCase):
    def setUp(self):
        self.surface = (APP / "community_surface.py").read_text(encoding="utf-8")
        self.daily = (APP / "daily_app.py").read_text(encoding="utf-8")
        self.development_backend = (APP / "development_workflow.py").read_text(encoding="utf-8")
        self.fusion = (PUBLIC / "huidi-community-online-fusion.js").read_text(encoding="utf-8")
        self.full_v2 = (PUBLIC / "huidi-community-online-full-v2.js").read_text(encoding="utf-8")
        self.intel_v2 = (PUBLIC / "huidi-community-online-intelligence-v2.js").read_text(encoding="utf-8")
        self.development = (PUBLIC / "huidi-community-online-development-workbench-v1.js").read_text(encoding="utf-8")
        self.full_v2_css = (PUBLIC / "huidi-community-online-full-v2.css").read_text(encoding="utf-8")
        self.development_css = (PUBLIC / "huidi-community-online-development-workbench-v1.css").read_text(encoding="utf-8")
        self.nav = (PUBLIC / "huidi-community-online-nav-v1.js").read_text(encoding="utf-8")
        self.fusion_css = (PUBLIC / "huidi-community-online-fusion.css").read_text(encoding="utf-8")

    def test_deployed_workspace_injects_full_fusion_before_static_mount(self):
        route = '@app.get("/community/workspace.html", response_class=HTMLResponse)'
        mount = 'app.mount(\n        "/community"'
        self.assertIn(route, self.surface)
        for asset in (
            "huidi-community-online-fusion.css",
            "huidi-community-online-fusion.js",
            "huidi-community-online-full-v2.css",
            "huidi-community-online-development-workbench-v1.css",
            "huidi-community-online-nav-v1.js",
            "huidi-community-online-full-v2.js",
            "huidi-community-online-intelligence-v2.js",
            "huidi-community-online-development-workbench-v1.js",
        ):
            self.assertIn(asset, self.surface)
        self.assertIn('"mode": "community-online-fused-workspace"', self.surface)
        self.assertLess(self.surface.index(route), self.surface.index(mount))
        self.assertLess(
            self.surface.index("huidi-community-online-nav-v1.js"),
            self.surface.index("huidi-community-online-full-v2.js"),
        )
        self.assertLess(
            self.surface.index("huidi-community-online-full-v2.js"),
            self.surface.index("huidi-community-online-intelligence-v2.js"),
        )
        self.assertLess(
            self.surface.index("huidi-community-online-intelligence-v2.js"),
            self.surface.index("huidi-community-online-development-workbench-v1.js"),
        )
        self.assertIn("https://cdn.jsdelivr.net", self.surface)
        self.assertIn('request.url.path == "/"', self.surface)
        self.assertIn('RedirectResponse("/community/workspace.html"', self.surface)

    def test_fusion_is_capability_layer_not_second_business_shell(self):
        combined = (
            self.fusion
            + "\n"
            + self.full_v2
            + "\n"
            + self.intel_v2
            + "\n"
            + self.development
            + "\n"
            + self.nav
        ).lower()
        self.assertIn("window.HUIDI_COMMUNITY_ONLINE", self.fusion)
        self.assertIn("window.HUIDILocalCore", self.fusion)
        self.assertIn("repositories.customers", self.fusion)
        self.assertIn("repositories.deals", self.fusion)
        self.assertIn("HUIDICommunityCloudAdapter", self.fusion)
        for forbidden in (
            "iframe",
            "online-bridge.html",
            "127.0.0.1",
            "localhost",
            "class communitycustomer",
            "class communitydeal",
            "__tablename__",
        ):
            self.assertNotIn(forbidden, combined)

    def test_full_online_capability_tree_is_present(self):
        for label in (
            "找客户",
            "潜在客户",
            "待跟进",
            "提醒",
            "地图找客户",
            "联系人",
            "客户背调",
            "智能开发",
            "邮件草稿",
            "收件箱",
            "已发送",
            "邮箱设置",
            "待发送",
            "自动跟进",
            "全球市场",
            "市场动态",
            "贸易记录",
            "HS / 关税",
            "汇率",
            "船期 / 物流",
            "团队与权限",
            "公司资料",
            "数据来源",
            "提醒方式",
            "操作记录",
            "检查与备份",
        ):
            self.assertIn(label, self.full_v2)
        self.assertIn("互动地图", self.intel_v2)
        self.assertIn("客户情报", self.intel_v2)
        self.assertIn("开发与发送", self.development)
        self.assertIn("客户开发", self.nav)
        self.assertIn("市场情报", self.nav)
        self.assertIn("团队与设置", self.nav)

    def test_existing_online_modules_are_reused_as_page_capabilities(self):
        for module in (
            "daily-navigation.js",
            "daily-services.js",
            "sequence-ui.js",
            "audit-ui.js",
        ):
            self.assertIn(module, self.full_v2)
        for expression in (
            "nav.mount(pane,view)",
            "services.mount(pane,view,detail)",
            "seq.mount(pane)",
            "audit.mount(pane)",
        ):
            self.assertIn(expression, self.full_v2)
        for module in (
            "customer-intelligence.js",
            "world-intelligence-map.js",
            "world-country-interaction.js",
        ):
            self.assertIn(module, self.intel_v2)
        self.assertIn("intel.mount(pane)", self.intel_v2)
        self.assertIn("map.open()", self.intel_v2)
        self.assertIn("country.enhance", self.intel_v2)
        self.assertNotIn("MutationObserver", self.full_v2)
        self.assertNotIn("MutationObserver", self.intel_v2)
        self.assertNotIn("MutationObserver", self.development)

    def test_network_capabilities_and_fused_projects_use_real_apis(self):
        for path in (
            "/api/workbench/today",
            "/api/leads?",
            "/api/leads/search",
            "/find-contact",
            "/api/intel/world",
            "/api/intel/world/country",
            "/api/mail/accounts",
            "/api/team/me",
            "/api/services/status",
            "/api/community-surface/status",
        ):
            self.assertIn(path, self.fusion)
        for path in (
            "/api/growth/funnel",
            "/api/product-brains",
            "/api/industries?include_overview=true",
            "/api/intelligence/summary/",
            "/api/team/members",
            "/api/company-settings",
            "/api/service-connections",
            "/api/notification-routes",
            "/api/production/readiness",
            "/api/backups",
        ):
            self.assertIn(path, self.full_v2)
        for view in ("online-find", "online-intel", "online-admin"):
            self.assertIn(view, self.full_v2)
        self.assertIn("mail", self.full_v2)

    def test_development_workbench_delegates_to_existing_draft_mail_and_followup_owners(self):
        for marker in (
            "/development-context",
            "/product-context",
            "/draft-content",
            "/draft-approval",
            "/delivery-readiness",
            "/send",
            "/followup",
            "/industry",
            "/industry-sequence",
        ):
            self.assertIn(marker, self.development)
        self.assertIn("/draft`", self.development)
        self.assertIn("confirm:true", self.development)
        self.assertIn("我已核对收件人和邮件内容", self.development)
        self.assertIn("发送条件还没有全部通过", self.development)
        self.assertNotIn("window.open", self.development)
        self.assertNotIn("window.confirm", self.development)
        self.assertNotIn("confirm(", self.development)
        self.assertIn("from . import development_workflow", self.daily)
        for marker in (
            "@app.get(\"/api/leads/{lead_id}/development-context\")",
            "@app.put(\"/api/leads/{lead_id}/product-context\")",
            "@app.put(\"/api/leads/{lead_id}/draft-content\")",
            "ProductBrainRecord",
            "MailboxAccount",
            "MailDeliveryLog",
            "draft_rejected",
            "开发信已修改，需重新确认",
        ):
            self.assertIn(marker, self.development_backend)
        self.assertNotIn("__tablename__", self.development_backend)
        self.assertNotIn("unit_price", self.development_backend)
        self.assertNotIn("deal.amount", self.development_backend)

    def test_formal_customer_deal_owner_and_price_guard_are_preserved(self):
        self.assertIn("core.repositories.customers.upsert", self.fusion)
        self.assertIn("core.repositories.deals.upsert", self.fusion)
        self.assertIn("source_lead_id", self.fusion)
        self.assertIn("status:'converted'", self.fusion)
        self.assertIn("syncState", self.fusion)
        self.assertIn("estimated_amount:0", self.fusion)
        self.assertNotIn("estimated_amount:lead", self.fusion)
        self.assertNotIn("deal.amount", self.fusion)
        self.assertNotIn("unit_price", self.fusion)
        self.assertIn("HUIDICommunityOnlineFusion", self.full_v2)
        self.assertIn("adoptLead", self.full_v2)
        self.assertNotIn("repositories.deals.upsert", self.full_v2)
        self.assertIn("Product Brain 价格只作参考", self.full_v2)
        self.assertIn("不会自动写正式报价", self.development)

    def test_standalone_local_does_not_activate_online_fusion(self):
        workspace = (PUBLIC / "workspace.html").read_text(encoding="utf-8")
        self.assertIn("if(!online?.enabled", self.fusion)
        self.assertIn("if(!online?.enabled", self.full_v2)
        self.assertIn("if(!online?.enabled", self.intel_v2)
        self.assertIn("if(!online?.enabled", self.development)
        self.assertNotIn("huidi-community-online-fusion", workspace)
        self.assertNotIn("huidi-community-online-full-v2", workspace)
        self.assertNotIn("huidi-community-online-intelligence-v2", workspace)
        self.assertNotIn("huidi-community-online-development-workbench-v1", workspace)
        self.assertNotIn("huidi-community-online-nav-v1", workspace)

    def test_fusion_assets_parse_and_exist(self):
        self.assertGreater(len(self.fusion_css), 1000)
        self.assertGreater(len(self.full_v2_css), 3000)
        self.assertGreater(len(self.development_css), 3000)
        self.assertGreater(len(self.full_v2), 10000)
        self.assertGreater(len(self.intel_v2), 2500)
        self.assertGreater(len(self.development), 10000)
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        for path in (
            PUBLIC / "huidi-community-online-fusion.js",
            PUBLIC / "huidi-community-online-nav-v1.js",
            PUBLIC / "huidi-community-online-full-v2.js",
            PUBLIC / "huidi-community-online-intelligence-v2.js",
            PUBLIC / "huidi-community-online-development-workbench-v1.js",
        ):
            result = subprocess.run(
                [node, "--check", str(path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, f"{path.name}: {result.stderr or result.stdout}")


if __name__ == "__main__":
    unittest.main()
