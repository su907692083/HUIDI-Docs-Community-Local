from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"
PUBLIC = REPO / "public"


class CommunityOnlineFunctionalClosureContractTests(unittest.TestCase):
    def setUp(self):
        self.surface = (APP / "community_surface.py").read_text(encoding="utf-8")
        self.script = (PUBLIC / "huidi-community-online-functional-closure-v1.js").read_text(encoding="utf-8")
        self.css = (PUBLIC / "huidi-community-online-functional-closure-v1.css").read_text(encoding="utf-8")

    def test_uses_existing_real_capability_owners(self):
        for marker in (
            "/api/services/status",
            "/api/acquisition/status",
            "/api/mail/connect/",
            "/api/mail/sync-all",
            "/api/tools/map-leads",
            "/api/tools/map-leads/import",
            "HUIDICommunityOnlineFullV2",
        ):
            self.assertIn(marker, self.script)
        self.assertNotIn("repositories.", self.script)
        self.assertNotIn("localStorage", self.script)
        self.assertNotIn("MutationObserver", self.script)
        self.assertNotIn("setInterval", self.script)
        self.assertNotIn("alert(", self.script)
        self.assertNotIn("confirm(", self.script)
        self.assertNotIn("127.0.0.1", self.script)

    def test_visible_capability_positioning_covers_customer_mail_market_and_admin(self):
        for marker in (
            "客户开发引擎",
            "邮件发送引擎",
            "外贸数据与判断引擎",
            "工作区能力总览",
            "企业搜索",
            "联系人搜索",
            "地图线索",
            "邮件触达",
            "贸易记录",
            "HS / 关税",
            "船期 / 物流",
        ):
            self.assertIn(marker, self.script)

    def test_map_is_real_result_workspace_not_placeholder(self):
        for marker in (
            "row?.lat",
            "row?.lng",
            "openstreetmap.org/export/embed.html",
            "hfc-map-workbench",
            "data-hfc-map-select",
            "data-hfc-map-add",
            "加入潜客",
        ):
            self.assertIn(marker, self.script)
        self.assertIn("frame-src https://www.openstreetmap.org;", self.surface)
        self.assertNotIn("google.com/maps", self.script)

    def test_sidebar_and_sequence_density_closure(self):
        self.assertIn(".huidi-online-more:not([open])>.huidi-online-more-body", self.css)
        self.assertIn(".workspace-r2-backup{display:none!important}", self.css)
        self.assertIn(".sq-page-surface #sqTemplates", self.css)
        self.assertIn("position:sticky", self.css)
        for invalid in ("undefined", "null", "nan"):
            self.assertIn(invalid, self.script)

    def test_surface_loads_functional_assets_last(self):
        self.assertIn('FUSION_ASSET_VERSION = "HUIDI-COMMUNITY-ONLINE-FUSION-13"', self.surface)
        self.assertLess(
            self.surface.index("huidi-community-online-shell-closure-v1.css"),
            self.surface.index("huidi-community-online-functional-closure-v1.css"),
        )
        self.assertLess(
            self.surface.index("huidi-community-online-shell-closure-v1.js"),
            self.surface.index("huidi-community-online-functional-closure-v1.js"),
        )

    def test_functional_javascript_parses_when_node_is_available(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        path = PUBLIC / "huidi-community-online-functional-closure-v1.js"
        result = subprocess.run(
            [node, "--check", str(path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout)


if __name__ == "__main__":
    unittest.main()
