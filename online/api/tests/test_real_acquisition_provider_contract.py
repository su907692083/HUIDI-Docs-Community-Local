from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FUSION = ROOT / "app" / "acquisition_provider_fusion.py"


class RealAcquisitionProviderContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = FUSION.read_text(encoding="utf-8")

    def test_all_lead_searches_are_intercepted_by_live_provider_fusion(self) -> None:
        self.assertIn('if method == "POST" and path == "/api/leads/search":', self.text)
        self.assertNotIn('path == "/api/leads/search" and (SERPER_CONFIGURED or TAVILY_API_KEY)', self.text)

    def test_missing_provider_returns_unavailable_without_demo_items(self) -> None:
        self.assertIn('"code": "live_acquisition_provider_required"', self.text)
        self.assertIn('"mode": "unavailable"', self.text)
        self.assertIn('"items": []', self.text)
        self.assertIn("不会生成或保存模拟客户", self.text)

    def test_fusion_never_persists_demo_sources(self) -> None:
        self.assertNotIn('offline-demo://', self.text)
        self.assertNotIn('"mode": "demo"', self.text)
        self.assertNotIn('source = "demo"', self.text)


if __name__ == "__main__":
    unittest.main()
