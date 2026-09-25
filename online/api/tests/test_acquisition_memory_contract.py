from __future__ import annotations

import py_compile
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MEMORY = ROOT / "app" / "acquisition_memory.py"
BRIDGE = ROOT / "app" / "acquisition_status_bridge.py"
FRONTEND = ROOT / "web" / "acquisition-memory-fusion.js"
PRODUCT_SERVER = ROOT / "web" / "product-brain-server.js"


class AcquisitionMemoryContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.memory = MEMORY.read_text(encoding="utf-8")
        cls.bridge = BRIDGE.read_text(encoding="utf-8")
        cls.frontend = FRONTEND.read_text(encoding="utf-8")
        cls.loader = PRODUCT_SERVER.read_text(encoding="utf-8")

    def test_syntax(self) -> None:
        py_compile.compile(str(MEMORY), doraise=True)
        subprocess.run(["node", "--check", str(FRONTEND)], check=True)
        subprocess.run(["node", "--check", str(PRODUCT_SERVER)], check=True)

    def test_read_only_tenant_scoped_projection(self) -> None:
        self.assertIn('SCHEMA = "huidi.acquisition.memory/v1"', self.memory)
        self.assertIn('@app.get("/api/acquisition/memory")', self.memory)
        self.assertIn("select(Lead)", self.memory)
        self.assertIn("SessionLocal", self.memory)
        self.assertNotIn("mapped_column", self.memory)
        self.assertNotIn("__tablename__", self.memory)
        self.assertNotIn('@app.post("/api/acquisition/memory', self.memory)

    def test_only_real_provider_leads_feed_memory(self) -> None:
        self.assertIn('source == "online_company_search"', self.memory)
        self.assertIn('provider in _REAL_PROVIDERS', self.memory)
        self.assertIn('_REAL_PROVIDERS = {"serper", "tavily"}', self.memory)
        lowered = self.memory.lower()
        for secret_ref in ("api_key", '["token"]', "password"):
            self.assertNotIn(secret_ref, lowered)

    def test_memory_exposes_recent_and_common_reuse(self) -> None:
        for key in ("last_successful", "recent_combinations", "common_keywords", "common_markets"):
            self.assertIn(f'"{key}"', self.memory)
        self.assertIn('"source": "persisted_real_acquisition_history"', self.memory)
        self.assertIn("/api/acquisition/memory", self.frontend)
        self.assertIn("确认后再搜索", self.frontend)
        self.assertNotIn("/api/leads/search", self.frontend)
        self.assertNotIn("/send", self.frontend)
        self.assertNotIn("MutationObserver", self.frontend)

    def test_existing_acquisition_plane_loads_projection_once(self) -> None:
        self.assertIn("from . import acquisition_memory", self.bridge)
        self.assertIn("data-huidi-acquisition-memory", self.loader)
        self.assertIn("/assets/acquisition-memory-fusion.js?v=HUIDI-ACQ-MEMORY-1", self.loader)
        self.assertIn("/assets/acquisition-batch-fusion.js?v=HUIDI-ACQ-BATCH-1", self.loader)


if __name__ == "__main__":
    unittest.main()
