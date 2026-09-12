from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / "web" / "acquisition-batch-fusion.js"
PRODUCT_SERVER = ROOT / "web" / "product-brain-server.js"


class AcquisitionBatchFusionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.batch = BATCH.read_text(encoding="utf-8")
        cls.loader = PRODUCT_SERVER.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(BATCH)], check=True)
        subprocess.run(["node", "--check", str(PRODUCT_SERVER)], check=True)

    def test_reuses_existing_product_and_lead_owners(self) -> None:
        self.assertIn("/api/product-brains", self.batch)
        self.assertIn("huidi_online_product_brains_v1", self.batch)
        self.assertIn("/api/leads/search", self.batch)
        self.assertIn("window.HUIDILeadWorkbench?.refresh?.()", self.batch)
        self.assertNotIn("/api/customers", self.batch)
        self.assertNotIn("/api/deals", self.batch)

    def test_multi_select_is_bounded_and_sequential(self) -> None:
        self.assertIn("MAX_COMBINATIONS=12", self.batch)
        self.assertIn("MAX_KEYWORDS=4", self.batch)
        self.assertIn("MAX_MARKETS=4", self.batch)
        self.assertIn("for(let i=0;i<combos.length;i++)", self.batch)
        self.assertIn("await api('/api/leads/search'", self.batch)
        self.assertNotIn("Promise.all", self.batch)

    def test_batch_search_does_not_send_outreach_or_use_observers(self) -> None:
        self.assertNotIn("/send", self.batch)
        self.assertNotIn("MutationObserver", self.batch)
        self.assertIn("不会生成模拟客户", self.batch)

    def test_product_brain_owner_loads_fusion_once(self) -> None:
        self.assertIn("data-huidi-acquisition-batch", self.loader)
        self.assertIn("/assets/acquisition-batch-fusion.js?v=HUIDI-ACQ-BATCH-1", self.loader)
        self.assertIn("window.HUIDIAcquisitionBatchFusion", self.loader)


if __name__ == "__main__":
    unittest.main()
