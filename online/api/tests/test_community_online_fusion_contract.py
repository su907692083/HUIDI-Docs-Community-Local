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
        self.fusion = (PUBLIC / "huidi-community-online-fusion.js").read_text(encoding="utf-8")
        self.fusion_css = (PUBLIC / "huidi-community-online-fusion.css").read_text(encoding="utf-8")

    def test_deployed_workspace_injects_fusion_before_static_mount(self):
        route = '@app.get("/community/workspace.html", response_class=HTMLResponse)'
        mount = 'app.mount(\n        "/community"'
        self.assertIn(route, self.surface)
        self.assertIn("huidi-community-online-fusion.css", self.surface)
        self.assertIn("huidi-community-online-fusion.js", self.surface)
        self.assertIn('"mode": "community-online-fused-workspace"', self.surface)
        self.assertLess(self.surface.index(route), self.surface.index(mount))
        self.assertIn('request.url.path == "/"', self.surface)
        self.assertIn('RedirectResponse("/community/workspace.html"', self.surface)

    def test_fusion_is_capability_layer_not_second_business_shell(self):
        lower = self.fusion.lower()
        self.assertIn("window.HUIDI_COMMUNITY_ONLINE", self.fusion)
        self.assertIn("window.HUIDILocalCore", self.fusion)
        self.assertIn("repositories.customers", self.fusion)
        self.assertIn("repositories.deals", self.fusion)
        self.assertIn("HUIDICommunityCloudAdapter", self.fusion)
        self.assertNotIn("iframe", lower)
        self.assertNotIn("online-bridge.html", lower)
        self.assertNotIn("127.0.0.1", lower)
        self.assertNotIn("localhost", lower)
        self.assertNotIn("class communitycustomer", lower)
        self.assertNotIn("class communitydeal", lower)
        self.assertNotIn("__tablename__", lower)

    def test_network_capabilities_are_embedded_into_existing_workspace(self):
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
        for view in ("online-find", "online-intel", "online-admin"):
            self.assertIn(view, self.fusion)
        self.assertIn("#view-home", self.fusion)
        self.assertIn("#view-mail", self.fusion)

    def test_lead_adoption_reuses_community_customer_and_deal_owners(self):
        self.assertIn("core.repositories.customers.upsert", self.fusion)
        self.assertIn("core.repositories.deals.upsert", self.fusion)
        self.assertIn("source_lead_id", self.fusion)
        self.assertIn("status:'converted'", self.fusion)
        self.assertIn("syncState", self.fusion)
        self.assertIn("estimated_amount:0", self.fusion)
        self.assertNotIn("estimated_amount:lead", self.fusion)
        self.assertNotIn("deal.amount", self.fusion)
        self.assertNotIn("unit_price", self.fusion)

    def test_standalone_local_does_not_activate_online_fusion(self):
        self.assertIn("if(!online?.enabled", self.fusion)
        self.assertNotIn("huidi-community-online-fusion", (PUBLIC / "workspace.html").read_text(encoding="utf-8"))

    def test_fusion_assets_parse_and_exist(self):
        self.assertGreater(len(self.fusion_css), 1000)
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        result = subprocess.run(
            [node, "--check", str(PUBLIC / "huidi-community-online-fusion.js")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
