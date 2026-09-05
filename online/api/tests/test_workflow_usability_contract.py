import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WorkflowUsabilityContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_usability_owner_is_loaded_and_parses(self):
        index = self.text("web/index.html")
        name = "workflow-usability-closure.js"
        self.assertIn(f"/assets/{name}", index)
        result = subprocess.run(
            ["node", "--check", str(ROOT / "web" / name)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_secondary_owner_keeps_one_back_path_and_focus_inside_dialog(self):
        source = self.text("web/secondary-page-closure.js")
        self.assertIn("nativeBack=main.querySelector('[data-back-deals]')", source)
        self.assertIn("back?.remove();return", source)
        self.assertIn("trapTab", source)
        self.assertIn("focusables", source)
        self.assertIn("openerByOverlay", source)
        self.assertIn("#huidiNavBack", source)

    def test_customer_drawer_has_fast_section_navigation(self):
        source = self.text("web/workflow-usability-closure.js")
        for marker in [
            "huidiDrawerRail",
            "资料",
            "背调",
            "开发信",
            "发送",
            "跟进",
            "记录",
            "单据",
            "scrollIntoView",
        ]:
            self.assertIn(marker, source)

    def test_high_frequency_navigation_keeps_context(self):
        source = self.text("web/workflow-usability-closure.js")
        for marker in [
            "leadScrollY",
            "businessScroll",
            "mailScroll",
            "huidi-return-flash",
            "Ctrl / ⌘ + K",
            "#keyword,#country,#buyerType",
            "huidi-busy-once",
        ]:
            self.assertIn(marker, source)

    def test_contacts_no_longer_depend_on_half_second_tab_click(self):
        source = self.text("web/daily-navigation.js")
        self.assertIn("window.HUIDILeadWorkbench?.open", source)
        self.assertNotIn("setTimeout(()=>document.querySelector(`[data-open=", source.replace("120)", ""))
        self.assertNotIn("550", source)


if __name__ == "__main__":
    unittest.main()
