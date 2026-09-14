from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class DetailContinuityContractTests(unittest.TestCase):
    def test_root_loads_continuity_after_mature_owners(self):
        index = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn('/assets/detail-continuity.js', index)
        self.assertGreater(index.index('/assets/detail-continuity.js'), index.index('/assets/business-center-ui.js'))
        self.assertGreater(index.index('/assets/detail-continuity.js'), index.index('/assets/workflow-usability-closure.js'))

    def test_continuity_reuses_existing_owners_only(self):
        source = (WEB / "detail-continuity.js").read_text(encoding="utf-8")
        for token in [
            "上一产品",
            "下一产品",
            "客户背调",
            "开发记录",
            "data-hdc-lead-prev",
            "data-hdc-lead-next",
            "data-hdc-business-prev",
            "data-hdc-business-next",
            "HUIDIBusinessCenter.open",
            "#saveLead",
            "data-save-deal",
            "data-save-customer",
            "requestSubmit",
            "Ctrl / ⌘ + S",
        ]:
            self.assertIn(token, source)
        self.assertIn("hdc-product-section", source)
        self.assertIn("按需展开", source)
        self.assertIn("仅核对时展开", source)

        for forbidden in [
            "fetch(",
            "XMLHttpRequest",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "observe(document.body",
            "window.open(",
            "location.href=",
            "/api/",
        ]:
            self.assertNotIn(forbidden, source)

        subprocess.run(["node", "--check", str(WEB / "detail-continuity.js")], check=True)

    def test_navigation_stays_on_current_visible_lists(self):
        source = (WEB / "detail-continuity.js").read_text(encoding="utf-8")
        self.assertIn("#tbody [data-open]", source)
        self.assertIn("#huidiBusinessMain [data-deal]", source)
        self.assertIn("#huidiBusinessMain [data-customer-id]", source)
        self.assertIn("currentBusinessPage", source)
        self.assertIn("business.page", source)
        self.assertNotIn("window.location", source)


if __name__ == "__main__":
    unittest.main()
