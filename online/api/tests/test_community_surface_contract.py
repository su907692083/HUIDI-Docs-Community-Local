from __future__ import annotations

import re
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"
PUBLIC = REPO / "public"


class CommunityMotherSurfaceContractTests(unittest.TestCase):
    def test_published_workspace_editor_are_the_online_mother_assets(self):
        workspace = (PUBLIC / "workspace.html").read_text(encoding="utf-8")
        self.assertTrue((PUBLIC / "document-start.html").is_file())
        self.assertTrue((PUBLIC / "editor.html").is_file())
        self.assertIn("询盘与订单", workspace)
        self.assertIn("客户中心", workspace)
        self.assertIn("商品资料库", workspace)
        self.assertIn("单据中心", workspace)
        self.assertIn("＋ 新建单据", workspace)
        for label in ["报价单", "PI", "销售合同", "CI / 装箱"]:
            self.assertIn(label, workspace)

    def test_surface_reuses_public_files_and_does_not_define_business_tables(self):
        source = (APP / "community_surface.py").read_text(encoding="utf-8")
        self.assertIn('app.mount(\n        "/community"', source)
        self.assertIn("HUIDI_COMMUNITY_PUBLIC_DIR", source)
        self.assertIn("HUIDI_COMMUNITY_SURFACE", source)
        self.assertIn('RedirectResponse("/community/workspace.html"', source)
        self.assertNotRegex(source, r"__tablename__|mapped_column|create_all")
        self.assertNotRegex(source, r"class\s+(OnlineCustomer|OnlineDeal|OnlineDocumentRef|ProductBrainRecord)")

    def test_surface_is_registered_after_auth(self):
        source = (APP / "daily_app.py").read_text(encoding="utf-8")
        auth = source.index("from . import auth_portal")
        surface = source.index("from . import community_surface")
        self.assertLess(auth, surface)

    def test_root_context_dockerfile_packages_exact_public_tree(self):
        dockerfile = (REPO / "Dockerfile.online").read_text(encoding="utf-8")
        self.assertIn("COPY online/api/app ./app", dockerfile)
        self.assertIn("COPY online/api/web ./web", dockerfile)
        self.assertIn("COPY public ./community-public", dockerfile)
        self.assertIn("HUIDI_COMMUNITY_PUBLIC_DIR=/app/community-public", dockerfile)
        self.assertNotIn("git clone", dockerfile.lower())

    def test_local_document_rule_packs_remain_the_formal_document_contract(self):
        expected = {
            "quotation.schema.json",
            "proforma-invoice.schema.json",
            "sales-contract.schema.json",
            "commercial-invoice.schema.json",
            "packing-list.schema.json",
            "document-transitions.json",
            "field-policy.json",
        }
        actual = {p.name for p in (PUBLIC / "rule-packs").glob("*.json")}
        self.assertTrue(expected.issubset(actual))


if __name__ == "__main__":
    unittest.main()
