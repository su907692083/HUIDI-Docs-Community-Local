from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
PUBLIC = REPO / "public"
WEB = REPO / "online" / "api" / "web"
DOCS = REPO / "docs"


class WorldMarketInteractiveParityContractTests(unittest.TestCase):
    def setUp(self):
        self.intel = (PUBLIC / "huidi-community-online-intelligence-v2.js").read_text(encoding="utf-8")
        self.command = (PUBLIC / "huidi-world-market-command-center-v1.js").read_text(encoding="utf-8")
        self.buyer_priority = (PUBLIC / "huidi-open-source-buyer-priority-v1.js").read_text(encoding="utf-8")
        self.face_loader = (WEB / "world-country-face-parity-v1.js").read_text(encoding="utf-8")
        self.face_core = (WEB / "world-country-face-parity-core-v1.js").read_text(encoding="utf-8")
        self.map = (WEB / "world-intelligence-map.js").read_text(encoding="utf-8")
        self.country = (WEB / "world-country-interaction.js").read_text(encoding="utf-8")
        self.gate = (DOCS / "OPEN-SOURCE-INTERACTIVE-PARITY-GATE.md").read_text(encoding="utf-8")

    def test_world_map_is_primary_market_entry(self):
        self.assertIn("全球互动地图", self.intel)
        self.assertIn("bar.prepend(world)", self.intel)
        self.assertIn("openPrimaryMap", self.intel)
        self.assertIn("state.task==='market'", self.intel)
        self.assertIn("applyTaskToMap", self.intel)
        self.assertIn("huidi-world-market-command-center-v1.js", self.intel)

    def test_country_surface_is_really_interactive_not_text_only(self):
        for marker in (
            "wi-country-market",
            "pointerenter",
            "pointermove",
            "keydown",
            "Enter",
            "aria-label",
            "select(m.id)",
        ):
            self.assertIn(marker, self.country)
        self.assertIn("Natural Earth", self.country.replace("natural-earth", "Natural Earth").replace("Natural Earth-vector", "Natural Earth"))
        self.assertIn("/api/intel/world", self.country)
        self.assertIn("/api/intel/world/country", self.map)
        self.assertIn("找这个市场的客户", self.map)
        self.assertIn("你的客户线索", self.map)
        self.assertIn("正在推进的询盘", self.map)

    def test_full_177_country_layer_is_pointer_active_without_fabricating_business(self):
        self.assertIn("pointer-events:visiblePainted", self.face_loader)
        self.assertNotIn("pointer-events:none!important", self.face_loader)
        self.assertIn("countryFaces:177", self.face_core)
        self.assertIn("p.addEventListener('pointerenter'", self.face_core)
        self.assertIn("window.HUIDIWorldCountryInteraction?.select?.(m.id)", self.face_core)
        self.assertIn("暂无你的业务记录", self.face_core)
        self.assertIn("不生成客户、询盘或热度数据", self.face_core)

    def test_country_context_routes_to_existing_foreign_trade_owners(self):
        for label in (
            "找当地买家",
            "客户情报",
            "贸易记录",
            "HS / 关税",
            "汇率",
            "船期 / 物流",
            "市场动态",
        ):
            self.assertIn(label, self.command)
        for tab in ("trade", "tariff", "fx", "shipping", "live", "customer-intel"):
            self.assertIn(tab, self.command)
        self.assertIn("HUIDICommunityOnlineFullV2", self.command)
        self.assertIn("online-find", self.command)
        for marker in (
            "#wiProductContext",
            "#hsIntelCountry",
            "#hsIntelKeyword",
            "#hsTradeCountry",
            "#hsTradeProduct",
            "#hsTariffDest",
            "#hsTariffProduct",
            "#hsShipDest",
        ):
            self.assertIn(marker, self.command)
        for stale in ("#hsTradeKeyword", "#hufCountry", "#hufKeyword"):
            self.assertNotIn(stale, self.command)
        self.assertNotIn("repositories.customers", self.command)
        self.assertNotIn("repositories.deals", self.command)
        self.assertNotIn("MutationObserver", self.command)
        self.assertNotIn("iframe", self.command.lower())

    def test_buyer_priority_parity_reuses_existing_lead_score_reason_read_only(self):
        self.assertIn("huidi-open-source-buyer-priority-v1.js", self.command)
        self.assertIn("/api/leads/${encodeURIComponent(id)}", self.buyer_priority)
        self.assertIn("lead?.priority", self.buyer_priority)
        self.assertIn("lead?.score", self.buyer_priority)
        self.assertIn("lead?.reason", self.buyer_priority)
        self.assertIn("匹配依据", self.buyer_priority)
        for forbidden in ("method:'POST'", 'method:"POST"', "method:'PUT'", 'method:"PUT"', "indexedDB", "localStorage", "MutationObserver"):
            self.assertNotIn(forbidden, self.buyer_priority)

    def test_open_source_parity_gate_does_not_claim_fake_completeness(self):
        for project in (
            "1099271/smart-lead-agent",
            "Tommy-old/b2b-buyer-discovery",
            "kakacells/Customer_background_check_version1.2",
            "uyoufu/UZonMail",
            "chnjames/tradehot-skill",
            "dongsheng123132/ai-tungke",
            "SuperGokou/caijiwaimao",
            "tshwangq/awesome-foreign-trade",
            "CreatiBI/cli",
            "howarliu1993/NPI-repo",
            "eicloud/eicloud.github.io",
        ):
            self.assertIn(project, self.gate)
        self.assertIn("A project is not `fully absorbed` when only layer 1 exists.", self.gate)
        self.assertIn("interactive map as a first-class navigation surface", self.gate)
        self.assertIn("Do not say \"all referenced open-source projects are fully absorbed\"", self.gate)

    def test_responsive_restore_reparents_surface_before_any_rebuild(self):
        recovery = self.intel.split(
            "async function recoverResponsiveMap()", 1
        )[1].split("function scheduleResponsiveMap", 1)[0]
        mount = "HUIDICustomerIntelligence?.mount?.(pane,{autoload:false})"
        rebuild = "await open('world-map',{force:true})"
        self.assertIn(mount, recovery)
        self.assertIn(rebuild, recovery)
        self.assertNotIn("await open('world-map')", recovery)
        self.assertLess(recovery.index(mount), recovery.index(rebuild))

    def test_new_browser_assets_parse(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        for path in (
            PUBLIC / "huidi-community-online-intelligence-v2.js",
            PUBLIC / "huidi-world-market-command-center-v1.js",
            PUBLIC / "huidi-open-source-buyer-priority-v1.js",
            WEB / "world-country-face-parity-v1.js",
        ):
            result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, f"{path.name}: {result.stderr or result.stdout}")


if __name__ == "__main__":
    unittest.main()
