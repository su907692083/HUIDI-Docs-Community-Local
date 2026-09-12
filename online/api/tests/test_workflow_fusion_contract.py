from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web" / "workflow-usability-closure.js"


class WorkflowFusionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = SOURCE.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(SOURCE)], check=True)

    def test_legacy_local_bridge_is_not_primary_ui(self) -> None:
        self.assertIn("data-huidi-local-workbench", self.text)
        self.assertIn("link.hidden=true", self.text)
        self.assertIn("huidi-legacy-bridge", self.text)
        self.assertIn("客户、询盘、产品和正式单据统一在当前工作台继续", self.text)

    def test_low_frequency_navigation_is_folded_not_duplicated(self) -> None:
        self.assertIn("['邮件跟进','查资料','管理']", self.text)
        self.assertIn("details.huidi-nav-fold", self.text)
        self.assertIn("compactLowFrequencyNav", self.text)

    def test_lead_batch_selection_uses_existing_lead_owner(self) -> None:
        for marker in (
            "data-huidi-lead-select",
            "data-huidi-lead-all",
            "data-huidi-batch-status",
            "data-huidi-batch-apply",
            "data-huidi-batch-export",
            "window.HUIDILeadWorkbench?.refresh?.()",
        ):
            self.assertIn(marker, self.text)
        self.assertIn("/api/leads/", self.text)
        self.assertIn("method:'PATCH'", self.text)
        self.assertIn("不会发送邮件，也不会改正式询盘", self.text)

    def test_batch_refresh_reuses_owner_without_observer(self) -> None:
        self.assertIn("hookLeadRefresh", self.text)
        self.assertIn("scheduleLeadDecorationBurst", self.text)
        self.assertIn("owner.refresh=async function", self.text)
        self.assertNotIn("MutationObserver", self.text)
        self.assertNotIn("observe(document.body", self.text)

    def test_batch_export_is_local_csv_only(self) -> None:
        self.assertIn("text/csv;charset=utf-8", self.text)
        self.assertIn("HUIDI-潜在客户-", self.text)
        self.assertNotIn("/send", self.text)


if __name__ == "__main__":
    unittest.main()
