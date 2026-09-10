from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
ROUTING = REPO_ROOT / "public" / "huidi-community-online-development-routing-v1.js"
PARITY = REPO_ROOT / "public" / "huidi-open-source-parity-v1.js"
BUSINESS_UI = API_ROOT / "web" / "business-center-ui.js"
BUSINESS_BACKEND = API_ROOT / "app" / "business_center.py"


class DueDiligenceNavigationContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.routing = ROUTING.read_text(encoding="utf-8")
        cls.parity = PARITY.read_text(encoding="utf-8")
        cls.business_ui = BUSINESS_UI.read_text(encoding="utf-8")
        cls.business_backend = BUSINESS_BACKEND.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(ROUTING)], check=True)
        subprocess.run(["node", "--check", str(PARITY)], check=True)
        subprocess.run(["node", "--check", str(BUSINESS_UI)], check=True)

    def test_lead_pool_exposes_evidence_separately_from_reassessment(self) -> None:
        self.assertIn("背调证据", self.routing)
        self.assertIn("重新评估", self.routing)
        self.assertIn('data-hdw-route-action="evidence"', self.routing)
        self.assertIn("HUIDIOpenSourceParity?.openEvidence", self.routing)
        self.assertIn("action==='evidence'", self.routing)
        self.assertIn("i<20", self.routing)

    def test_existing_six_dimension_evidence_owner_remains_authoritative(self) -> None:
        for label in (
            "销售资格证据完整度",
            "不是信用分",
            "基础身份",
            "公司线索",
            "人员关联",
            "数字资产",
            "贸易记录",
            "业务匹配",
            "不等同于信用报告",
        ):
            self.assertIn(label, self.parity)
        self.assertIn("官方工商/注册状态待核验", self.parity)
        self.assertIn("真实采购/海关记录待核验", self.parity)

    def test_formal_customer_and_deal_keep_exact_source_lead_identity(self) -> None:
        self.assertIn('source_lead_id: Mapped[int | None]', self.business_backend)
        self.assertGreaterEqual(self.business_backend.count('"source_lead_id": row.source_lead_id'), 2)
        self.assertIn('OnlineCustomer(source_lead_id=lead.id', self.business_backend)
        self.assertIn('source_lead_id=lead.id', self.business_backend)

    def test_formal_customer_and_inquiry_reuse_same_evidence_owner(self) -> None:
        self.assertIn('data-source-evidence>背调证据</button>', self.business_ui)
        self.assertIn('data-open-evidence>背调证据</button>', self.business_ui)
        self.assertIn("openEvidence(x.source_lead_id)", self.business_ui)
        self.assertIn("HUIDICommunityDevelopmentRouting?.openEvidence", self.business_ui)
        self.assertIn("HUIDIOpenSourceParity?.openEvidence", self.business_ui)
        self.assertIn("data-source-lead>查看开发记录</button>", self.business_ui)
        self.assertIn("data-open-lead>查看开发记录</button>", self.business_ui)

    def test_formal_evidence_bridge_never_guesses_source_identity(self) -> None:
        bridge = self.business_ui.split("function openEvidence", 1)[1].split("async function openCustomer", 1)[0]
        self.assertNotIn("/api/", bridge)
        self.assertNotIn("company_name", bridge)
        self.assertNotIn("contact_email", bridge)
        self.assertNotIn("website", bridge)
        self.assertNotIn("domain", bridge)
        self.assertNotIn("unit_price", bridge)
        self.assertNotIn("total_price", bridge)
        self.assertNotIn("native-document", bridge)
        self.assertNotIn("MutationObserver", self.business_ui)

    def test_navigation_layer_does_not_create_a_second_due_diligence_owner(self) -> None:
        self.assertNotIn("/api/leads/", self.routing.split("async function openEvidence", 1)[1].split("function enhancePool", 1)[0])
        self.assertNotIn("/assess", self.routing)
        self.assertNotIn("find-contact", self.routing)
        self.assertNotIn("/send", self.routing)
        self.assertNotIn("sequence-enrollments", self.routing)
        self.assertNotIn("native-document", self.routing)
        self.assertNotIn("unit_price", self.routing)
        self.assertNotIn("total_price", self.routing)

    def test_no_new_observer_plane_is_added(self) -> None:
        # The pre-existing routing layer has exactly three scoped observers:
        # pool, followups, and development. Evidence must reuse the pool one.
        self.assertEqual(self.routing.count("MutationObserver"), 3)
        self.assertIn("new MutationObserver(()=>enhancePool(pool))", self.routing)
        self.assertEqual(self.routing.count("data-hdw-route-action=\"evidence\""), 1)

    def test_pool_enhancement_is_idempotent_under_its_scoped_observer(self) -> None:
        # The pool observer watches childList/subtree. Reassigning textContent on
        # every callback would create another childList mutation and self-trigger
        # indefinitely, starving the UI event loop. Only mutate when needed.
        self.assertIn("if(assess.textContent!==label)assess.textContent=label", self.routing)
        self.assertIn("if(assess.title!==title)assess.title=title", self.routing)
        self.assertNotIn("if(assess){assess.textContent='重新评估'", self.routing)


if __name__ == "__main__":
    unittest.main()
