from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"
PUBLIC = REPO / "public"


class CommunityOnlineShellClosureContractTests(unittest.TestCase):
    def setUp(self):
        self.surface = (APP / "community_surface.py").read_text(encoding="utf-8")
        self.workspace = (PUBLIC / "workspace.html").read_text(encoding="utf-8")
        self.nav = (PUBLIC / "huidi-community-online-nav-v1.js").read_text(encoding="utf-8")
        self.shell = (PUBLIC / "huidi-community-online-shell-closure-v1.js").read_text(encoding="utf-8")
        self.shell_css = (PUBLIC / "huidi-community-online-shell-closure-v1.css").read_text(encoding="utf-8")

    def test_deployed_surface_loads_shell_before_functional_closure(self):
        self.assertIn('FUSION_ASSET_VERSION = "HUIDI-COMMUNITY-ONLINE-FUSION-13"', self.surface)
        self.assertIn("huidi-community-online-shell-closure-v1.css", self.surface)
        self.assertIn("huidi-community-online-shell-closure-v1.js", self.surface)
        self.assertIn("huidi-community-online-functional-closure-v1.css", self.surface)
        self.assertIn("huidi-community-online-functional-closure-v1.js", self.surface)
        self.assertLess(
            self.surface.index("huidi-community-online-development-routing-v1.js"),
            self.surface.index("huidi-community-online-shell-closure-v1.js"),
        )
        self.assertLess(
            self.surface.index("huidi-community-online-shell-closure-v1.js"),
            self.surface.index("huidi-community-online-functional-closure-v1.js"),
        )
        self.assertNotIn("huidi-community-online-shell-closure-v1", self.workspace)

    def test_navigation_is_consolidated_into_five_visible_work_domains(self):
        for title in ("今天", "客户", "产品与单据", "市场与工具", "设置"):
            self.assertIn(title, self.nav)
        for view in (
            "home",
            "mail",
            "online-find",
            "customers",
            "deals",
            "products",
            "catalog",
            "documents",
            "online-intel",
            "online-admin",
        ):
            self.assertIn(view, self.nav)
        self.assertIn("更多工具", self.nav)
        self.assertIn("normalizeCounts", self.nav)
        for invalid in ("undefined", "null", "nan"):
            self.assertIn(invalid, self.nav)
        self.assertNotIn("status-dot online", self.nav)
        self.assertNotIn("huidi-fusion-nav", self.nav)

    def test_shell_compacts_primary_tabs_without_removing_capabilities(self):
        for marker in (
            "'online-find':new Set(['base','pool','followups','develop'])",
            "'online-admin':new Set(['base','team','company','sources'])",
            "huidi-tab-more",
            "huidi-source-header",
            "数据源",
            "状态",
            "用途",
            "操作",
        ):
            self.assertIn(marker, self.shell)
        for capability in (
            "map_search",
            "company_check",
            "trade_data",
            "tariff",
            "fx",
            "shipping",
        ):
            self.assertIn(capability, self.shell)
        self.assertNotIn("MutationObserver", self.shell)
        self.assertNotIn("fetch(", self.shell)
        self.assertNotIn("repositories.", self.shell)
        self.assertNotIn("iframe", self.shell.lower())
        self.assertNotIn("127.0.0.1", self.shell)
        self.assertNotIn("online-bridge", self.shell)

    def test_shell_css_owns_density_and_duplicate_cloud_cleanup_only(self):
        for marker in (
            "huidi-online-domain-nav",
            "sidebar-foot",
            "huidi-online-more",
            "huidi-tab-more",
            "huidi-source-header",
            "huidi-source-row",
            "content:none",
            "status-dot.fusion-cloud",
        ):
            self.assertIn(marker, self.shell_css)
        self.assertIn("grid-template-columns:minmax(170px,1.25fr)", self.shell_css)
        self.assertNotIn("url(", self.shell_css)

    def test_shell_javascript_parses_when_node_is_available(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        for path in (
            PUBLIC / "huidi-community-online-nav-v1.js",
            PUBLIC / "huidi-community-online-shell-closure-v1.js",
        ):
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
