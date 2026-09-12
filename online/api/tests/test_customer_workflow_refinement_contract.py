from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]
ASSET = ROOT / "public" / "huidi-customer-workflow-refinement-v1.js"
SURFACE = ROOT / "online" / "api" / "app" / "community_surface.py"


class CustomerWorkflowRefinementContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.asset = ASSET.read_text(encoding="utf-8")
        cls.surface = SURFACE.read_text(encoding="utf-8")

    def test_refinement_is_loaded_after_existing_functional_owner(self):
        functional = 'huidi-community-online-functional-closure-v1.js'
        refinement = 'huidi-customer-workflow-refinement-v1.js'
        self.assertIn(refinement, self.surface)
        self.assertLess(self.surface.index(functional), self.surface.index(refinement))

    def test_refinement_does_not_create_a_second_data_owner(self):
        for forbidden in (
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "setInterval",
        ):
            self.assertNotIn(forbidden, self.asset)
        self.assertIn("HUIDICommunityOnlineFullV2", self.asset)
        self.assertIn("data-fv2-adopt", self.asset)
        self.assertIn("data-hs-sync", self.asset)
        self.assertIn("data-hcwr-go", self.asset)

    def test_lead_actions_are_reorganized_without_removing_owner_actions(self):
        self.assertIn("hcwr-row-actions", self.asset)
        self.assertIn("hcwr-more-menu", self.asset)
        self.assertIn("data-fv2-contact", self.asset)
        self.assertIn("data-fv2-assess", self.asset)
        self.assertIn("hdwRouteAction", self.asset)
        self.assertIn("建客户/询盘", self.asset)
        self.assertIn("继续开发", self.asset)
        self.assertIn("const evidence=buttons.find", self.asset)
        self.assertIn("keep=new Set([develop,adopt,evidence]", self.asset)
        self.assertIn("背调证据保持直接可用", self.asset)

    def test_critical_tabs_keep_accessible_height_even_when_linked_css_fails(self):
        self.assertIn("min-height:34px!important", self.asset)

    def test_customer_development_and_communication_surfaces_are_both_covered(self):
        for token in (
            "客户开发",
            "客户沟通",
            "潜客池",
            "开发工作台",
            "待跟进",
            "联系人",
            "企业背调",
            "收件箱",
            "已发送",
            "邮箱连接",
            "待发送队列",
            "自动跟进",
        ):
            self.assertIn(token, self.asset)


if __name__ == "__main__":
    unittest.main()
