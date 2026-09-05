import subprocess
import unittest
from pathlib import Path

from app.daily_app import app
from app.world_intelligence import WORLD_MARKETS, _market_for

ROOT = Path(__file__).resolve().parents[1]


class WorldIntelligenceContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_world_routes_are_registered(self):
        paths = {route.path for route in app.routes}
        self.assertIn("/api/intel/world", paths)
        self.assertIn("/api/intel/world/country", paths)

    def test_world_market_navigation_is_broad_and_neutral(self):
        self.assertGreaterEqual(len(WORLD_MARKETS), 40)
        regions = {row["region"] for row in WORLD_MARKETS}
        self.assertTrue({"北美", "拉美", "欧洲", "中东", "非洲", "亚太"}.issubset(regions))
        for row in WORLD_MARKETS:
            self.assertIn("lat", row)
            self.assertIn("lng", row)
            self.assertNotIn("severity", row)
            self.assertNotIn("risk_level", row)
            self.assertNotIn("conflict_level", row)
        self.assertEqual(_market_for("Germany")["id"], "DE")
        self.assertEqual(_market_for("德国")["id"], "DE")
        self.assertEqual(_market_for("UAE")["id"], "AE")

    def test_world_owner_reuses_real_business_and_intelligence_owners(self):
        source = self.text("app/world_intelligence.py")
        for marker in ["Lead", "OnlineCustomer", "OnlineDeal", "_collect", "lead_count", "customer_count", "deal_count"]:
            self.assertIn(marker, source)
        self.assertIn("不代表冲突等级或风险等级", source)
        self.assertNotIn("demo severity", source.lower())

    def test_world_browser_and_secondary_closure_are_loaded_and_parse(self):
        index = self.text("web/index.html")
        for file in ["web/world-intelligence-map.js", "web/secondary-page-closure.js"]:
            name = Path(file).name
            self.assertIn(f'/assets/{name}', index)
            result = subprocess.run(["node", "--check", str(ROOT / file)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_world_browser_has_live_news_real_clues_and_fallback(self):
        source = self.text("web/world-intelligence-map.js")
        for marker in [
            "/api/intel/world",
            "/api/intel/world/country",
            "openstreetmap.org",
            "renderFallback",
            "HUIDILeadWorkbench",
            "找这个市场的客户",
            "最新市场动态",
            "你的客户线索",
        ]:
            self.assertIn(marker, source)
        self.assertNotIn("conflict severity", source.lower())

    def test_secondary_pages_have_consistent_back_and_escape_behavior(self):
        source = self.text("web/secondary-page-closure.js")
        self.assertIn("返回询盘列表", source)
        self.assertIn("返回邮件列表", source)
        self.assertIn("Escape", source)
        self.assertIn("aria-modal", source)
        self.assertIn("huidi-modal-open", source)


if __name__ == "__main__":
    unittest.main()
