from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FUSION = ROOT / "web" / "contact-reuse-fusion.js"
INDEX = ROOT / "web" / "index.html"


class ContactReuseFusionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fusion = FUSION.read_text(encoding="utf-8")
        cls.index = INDEX.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(FUSION)], check=True)

    def test_reuses_existing_contact_projection_only(self) -> None:
        self.assertIn("/api/contacts", self.fusion)
        self.assertIn("#dContact", self.fusion)
        self.assertIn("#dRole", self.fusion)
        self.assertIn("#dEmail", self.fusion)
        self.assertNotIn("/api/customers", self.fusion)
        self.assertNotIn("/api/deals", self.fusion)
        self.assertNotIn("/api/contact", self.fusion.replace("/api/contacts", ""))

    def test_selection_is_form_fill_not_automatic_write_or_outreach(self) -> None:
        self.assertIn("仍需点击“保存资料”确认", self.fusion)
        self.assertIn("不会自动发邮件", self.fusion)
        self.assertNotIn("method:'POST'", self.fusion)
        self.assertNotIn("method:\"POST\"", self.fusion)
        self.assertNotIn("method:'PATCH'", self.fusion)
        self.assertNotIn("method:\"PATCH\"", self.fusion)
        self.assertNotIn("/send", self.fusion)
        self.assertNotIn("#saveLead", self.fusion)

    def test_no_new_global_observer_or_parallel_owner(self) -> None:
        self.assertNotIn("MutationObserver", self.fusion)
        self.assertNotIn("localStorage", self.fusion)
        self.assertNotIn("sessionStorage", self.fusion)
        self.assertNotIn("indexedDB", self.fusion)
        self.assertIn("window.HUIDIContactReuseFusion", self.fusion)

    def test_workbench_loads_fusion_once_after_navigation_owner(self) -> None:
        marker = '<script src="/assets/contact-reuse-fusion.js"></script>'
        self.assertEqual(self.index.count(marker), 1)
        self.assertLess(
            self.index.index('<script src="/assets/daily-navigation.js"></script>'),
            self.index.index(marker),
        )


if __name__ == "__main__":
    unittest.main()
