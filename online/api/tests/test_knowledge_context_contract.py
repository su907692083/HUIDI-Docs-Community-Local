from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class KnowledgeContextContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = (ROOT / "app" / "knowledge_context.py").read_text(encoding="utf-8")
        self.daily = (ROOT / "app" / "daily_app.py").read_text(encoding="utf-8")
        self.surface = (ROOT / "app" / "community_surface.py").read_text(encoding="utf-8")
        self.ui = (REPO / "public" / "huidi-knowledge-context-v1.js").read_text(encoding="utf-8")

    def test_retrieval_reuses_authoritative_owners_without_second_knowledge_store(self) -> None:
        self.assertIn('/api/knowledge/search', self.backend)
        for owner in ("ProductBrainRecord", "Lead", "OnlineCustomer", "OnlineDeal", "OnlineIntelligenceRecord"):
            self.assertIn(owner, self.backend)
        for forbidden in ("class Knowledge", "__tablename__", "create_all", "vector", "embedding", "httpx"):
            self.assertNotIn(forbidden, self.backend)
        self.assertIn('mode": "authoritative_lexical', self.backend)
        self.assertIn('network_requests": 0', self.backend)
        self.assertIn('citations_required', self.backend)
        self.assertIn('read_only', self.backend)

    def test_reusable_ai_context_excludes_product_and_formal_prices(self) -> None:
        self.assertIn("formal_price_excluded", self.backend)
        self.assertIn("Reference/product prices are intentionally excluded", self.backend)
        for forbidden in (
            'payload.get("price")', 'payload.get("price_range")', 'payload.get("reference_price")',
            'row.amount', 'row.currency',
        ):
            self.assertNotIn(forbidden, self.backend)

    def test_fused_workspace_loads_retrieval_next_to_existing_development_owner(self) -> None:
        self.assertIn('from . import knowledge_context', self.daily)
        self.assertIn('huidi-knowledge-context-v1.js', self.surface)
        self.assertLess(
            self.surface.index('huidi-community-online-development-routing-v1.js'),
            self.surface.index('huidi-knowledge-context-v1.js'),
        )
        self.assertIn('HUIDI 知识引用', self.ui)
        self.assertIn('/api/knowledge/search?', self.ui)
        self.assertIn('HUIDICommunityDevelopmentRouting?.openLead?.', self.ui)
        self.assertIn("HUIDICommunityOnlineFullV2?.openTab?.('online-find','smart'", self.ui)

    def test_ui_is_retrieval_only_not_a_shadow_ai_or_storage_owner(self) -> None:
        for marker in ("每条带来源引用", "0 外部网络请求", "没有命中就保持为空"):
            self.assertIn(marker, self.ui)
        for forbidden in ("localStorage", "indexedDB", "MutationObserver", "OpenAI", "completion", "chat/completions", "method:'POST'", 'method:"POST"'):
            self.assertNotIn(forbidden, self.ui)

    def test_knowledge_ui_javascript_parses(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        result = subprocess.run(
            [node, "--check", str(REPO / "public" / "huidi-knowledge-context-v1.js")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
