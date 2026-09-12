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
        self.ai = (ROOT / "app" / "knowledge_ai.py").read_text(encoding="utf-8")
        self.daily = (ROOT / "app" / "daily_app.py").read_text(encoding="utf-8")
        self.surface = (ROOT / "app" / "community_surface.py").read_text(encoding="utf-8")
        self.ui = (REPO / "public" / "huidi-knowledge-context-v1.js").read_text(encoding="utf-8")

    def test_retrieval_reuses_authoritative_owners_without_second_knowledge_store(self) -> None:
        self.assertIn('/api/knowledge/search', self.backend)
        for owner in ("ProductBrainRecord", "Lead", "OnlineCustomer", "OnlineDeal", "OnlineIntelligenceRecord"):
            self.assertIn(owner, self.backend)
        # Comments/docstrings explicitly state that embeddings/vector storage are
        # absent. Reject actual implementation hooks rather than those safety
        # words themselves.
        for forbidden in (
            "class Knowledge", "__tablename__", "create_all", "httpx",
            "pgvector", "sentence_transformers", "OpenAIEmbeddings", "embedding_function=",
            "vector_store", "vectorstore", "faiss", "chromadb",
        ):
            self.assertNotIn(forbidden, self.backend)
        self.assertIn('mode": "authoritative_lexical', self.backend)
        self.assertIn('network_requests": 0', self.backend)
        self.assertIn('citations_required', self.backend)
        self.assertIn('read_only', self.backend)

    def test_reusable_ai_context_excludes_structured_and_free_text_prices(self) -> None:
        self.assertIn("formal_price_excluded", self.backend)
        self.assertIn("Reference/product prices are intentionally excluded", self.backend)
        self.assertIn("_strip_price_text", self.backend)
        self.assertIn("_PRICE_WITH_CURRENCY", self.backend)
        self.assertIn("_PRICE_SEGMENT", self.backend)
        self.assertIn("[价格已隔离]", self.backend)
        for forbidden in (
            'payload.get("price")', 'payload.get("price_range")', 'payload.get("reference_price")',
            'row.amount', 'row.currency',
        ):
            self.assertNotIn(forbidden, self.backend)

    def test_retrieval_diagnostics_are_deterministic_explainable_and_non_vector(self) -> None:
        for marker in (
            "SOURCE_WEIGHTS",
            "_match_reasons",
            "match_reasons",
            "field_weighted_lexical_rerank_v1",
            "candidate_count",
            "returned_source_counts",
            "missing_sources",
            '"vector_search": False',
            '"explainable": True',
        ):
            self.assertIn(marker, self.backend)
        for marker in (
            "data-hkc-diagnostics",
            "检索说明",
            "为什么命中",
            "相关度",
            "本次未命中",
            "非向量黑箱",
        ):
            self.assertIn(marker, self.ui)
        self.assertIn("renderDiagnostics(box,out)", self.ui)
        self.assertIn("x.match_reasons", self.ui)
        self.assertNotIn("Math.random", self.backend)
        self.assertNotIn("Math.random", self.ui)

    def test_fused_workspace_loads_retrieval_next_to_existing_development_owner(self) -> None:
        self.assertIn('from . import knowledge_context', self.daily)
        self.assertIn('from . import knowledge_ai', self.daily)
        self.assertIn('huidi-knowledge-context-v1.js', self.surface)
        self.assertLess(
            self.surface.index('huidi-community-online-development-routing-v1.js'),
            self.surface.index('huidi-knowledge-context-v1.js'),
        )
        self.assertIn('HUIDI 知识引用', self.ui)
        self.assertIn('/api/knowledge/search?', self.ui)
        self.assertIn('HUIDICommunityDevelopmentRouting?.openLead?.', self.ui)
        self.assertIn("HUIDICommunityOnlineFullV2?.openTab?.('online-find','smart'", self.ui)

    def test_grounded_ai_uses_existing_llm_provider_and_cannot_write_business_data(self) -> None:
        self.assertIn('/api/knowledge/suggest', self.ai)
        self.assertIn('search_business_knowledge', self.ai)
        self.assertIn('resolve_provider("llm", db)', self.ai)
        self.assertIn('/chat/completions', self.ai)
        self.assertIn('used_citations', self.ai)
        self.assertIn('human_review_required', self.ai)
        self.assertIn('writes_business_data', self.ai)
        self.assertIn('tool_execution', self.ai)
        self.assertIn('provider_unavailable', self.ai)
        self.assertIn('no_context', self.ai)
        self.assertIn('formal_price_excluded', self.ai)
        self.assertIn('没有 HUIDI 来源', self.ai.replace('没有足够的 HUIDI 来源', '没有 HUIDI 来源'))
        for forbidden in (
            'db.add(', 'db.commit(', 'db.delete(',
            '/api/business/', '/api/mail/', '/api/leads/{lead_id}/convert',
            'window.open(', 'subprocess', 'eval(', 'exec(',
        ):
            self.assertNotIn(forbidden, self.ai)

    def test_one_knowledge_panel_exposes_all_bounded_business_ai_modes(self) -> None:
        expected = {
            "outreach_strategy": "开发策略",
            "account_summary": "客户总结",
            "inquiry_next_step": "询盘下一步",
            "market_brief": "市场简报",
        }
        for key, label in expected.items():
            self.assertIn(f'"{key}"', self.ai)
            self.assertIn(f'{key}:{{label:\'{label}\'', self.ui)
            self.assertIn(f'<option value="{key}">{label}</option>', self.ui)
        self.assertIn('data-hkc-purpose', self.ui)
        self.assertIn('data-hkc-language', self.ui)
        self.assertIn('<option value="Chinese">中文</option>', self.ui)
        self.assertIn('<option value="English">English</option>', self.ui)
        self.assertIn('const {purpose,language}=modeInfo(box)', self.ui)
        self.assertIn('JSON.stringify({query:q,purpose,language,max_sources:6})', self.ui)
        self.assertNotIn("purpose:'outreach_strategy',language:'Chinese'", self.ui)
        self.assertIn("version:'1.3.0'", self.ui)

    def test_ai_ui_is_explicit_copy_only_not_auto_apply_or_send(self) -> None:
        for marker in (
            "基于引用给建议", "/api/knowledge/suggest", "复制建议",
            "AI 建议不自动写回业务", "没有写入客户、询盘、单据或邮件",
        ):
            self.assertIn(marker, self.ui)
        self.assertIn("method:'POST'", self.ui)
        for forbidden in (
            "localStorage", "indexedDB", "MutationObserver", "OpenAI", "chat/completions",
            "data-hdw-save", "data-hdw-approve", "data-hdw-send",
        ):
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
