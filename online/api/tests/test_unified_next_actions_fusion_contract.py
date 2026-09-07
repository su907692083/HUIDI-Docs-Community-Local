from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FUSION = ROOT / "web" / "unified-next-actions-fusion.js"
BUSINESS_CONTEXT = ROOT / "web" / "business-context.js"


class UnifiedNextActionsFusionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fusion = FUSION.read_text(encoding="utf-8")
        cls.context = BUSINESS_CONTEXT.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(FUSION)], check=True)
        subprocess.run(["node", "--check", str(BUSINESS_CONTEXT)], check=True)

    def test_retires_visible_local_bridge_without_deleting_compatibility(self) -> None:
        self.assertIn("[data-huidi-local-workbench]", self.fusion)
        self.assertIn(".bridge-card", self.fusion)
        self.assertIn("[data-hdw-local]", self.fusion)
        self.assertIn("[data-hdw-sync-local]", self.fusion)
        self.assertIn("display:none!important", self.fusion)
        self.assertNotIn("127.0.0.1", self.fusion)
        self.assertNotIn("localhost", self.fusion)

    def test_next_actions_reuse_existing_owners_only(self) -> None:
        self.assertIn("HUIDIWorkspacePages", self.fusion)
        self.assertIn("HUIDIBusinessCenter", self.fusion)
        self.assertIn("HUIDIDocumentWorkbench", self.fusion)
        self.assertIn("HUIDIProductBrain", self.fusion)
        self.assertNotIn("fetch(", self.fusion)
        self.assertNotIn("/api/", self.fusion)
        self.assertNotIn("localStorage", self.fusion)
        self.assertNotIn("indexedDB", self.fusion)
        self.assertNotIn("MutationObserver", self.fusion)
        self.assertNotIn("window.open", self.fusion)
        self.assertNotIn("location.href", self.fusion)

    def test_duplicate_inbox_is_collapsed_to_existing_runtime_owner(self) -> None:
        self.assertIn("hideDuplicateInbox", self.fusion)
        self.assertIn("客户回复", self.fusion)
        self.assertIn("收件箱", self.fusion)
        self.assertIn("link.hidden=true", self.fusion)

    def test_low_frequency_navigation_has_compact_shortcuts(self) -> None:
        self.assertIn("navGroups", self.fusion)
        self.assertIn("document.createElement('details')", self.fusion)
        self.assertIn("document.createElement('button')", self.fusion)
        self.assertIn("huf-nav-proxy", self.fusion)
        self.assertIn("huf-compact", self.fusion)
        self.assertIn("grid-template-columns:repeat(2", self.fusion)
        for label in ["背调 / 联系人快捷选择", "邮件工具快捷选择", "贸易工具快捷选择", "管理快捷选择"]:
            self.assertIn(label, self.fusion)

    def test_canonical_navigation_is_not_moved_into_closed_dropdowns(self) -> None:
        self.assertIn("button._hufTarget=link", self.fusion)
        self.assertIn("link.click()", self.fusion)
        self.assertNotIn("list.appendChild(link)", self.fusion)
        self.assertNotIn("cloneNode", self.fusion)
        self.assertNotIn("history.pushState", self.fusion)
        self.assertNotIn("history.replaceState", self.fusion)
        self.assertNotIn("data-huidi-route=", self.fusion)

    def test_runtime_repair_restores_links_from_failed_legacy_dropdown_shape(self) -> None:
        self.assertIn("repairMovedAnchors", self.fusion)
        self.assertIn("details.insertAdjacentElement('beforebegin',link)", self.fusion)
        self.assertIn("details.remove()", self.fusion)

    def test_business_context_loads_safe_fusion_once_with_new_cache_key(self) -> None:
        self.assertIn("data-huidi-unified-next", self.context)
        self.assertIn("/assets/unified-next-actions-fusion.js?v=HUIDI-UNIFIED-NEXT-3", self.context)
        self.assertIn("window.HUIDIUnifiedNextActionsFusion", self.context)


if __name__ == "__main__":
    unittest.main()
