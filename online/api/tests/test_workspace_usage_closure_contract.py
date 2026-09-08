from __future__ import annotations

import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class WorkspaceUsageClosureContractTests(unittest.TestCase):
    def test_shared_closure_is_a_versioned_root_asset(self) -> None:
        index = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn('/assets/workspace-usage-closure.css', index)
        self.assertIn('<aside class="side" data-huf-nav="1">', index)
        self.assertIn('class="nav huf-side-hidden" hidden aria-hidden="true"', index)

    def test_general_business_page_hides_contextless_lead_conversion(self) -> None:
        css = (WEB / "workspace-usage-closure.css").read_text(encoding="utf-8")
        self.assertIn('.hb-page-surface [data-hb-new]', css)
        self.assertIn('display:none!important', css)
        self.assertIn('.hpr-head', css)
        self.assertIn('.hpr-mount', css)

    def test_find_customer_surface_is_dense_and_scoped_to_active_find_nav(self) -> None:
        index = (WEB / "index.html").read_text(encoding="utf-8")
        css = (WEB / "workspace-usage-closure.css").read_text(encoding="utf-8")
        self.assertIn('data-huidi-nav="find"', index)
        self.assertIn(':has(.side [data-huidi-nav="find"].active)', css)
        for home_only in ['#dailyWorkbench', '#beginnerFlow', '#hufHome']:
            self.assertIn(home_only, css)
        self.assertIn('.side-note{display:none}', css)
        self.assertIn('height:calc(100vh - 188px)', css)
        self.assertIn('min-height:460px', css)

    def test_closure_is_presentation_only(self) -> None:
        css = (WEB / "workspace-usage-closure.css").read_text(encoding="utf-8")
        for forbidden in ['/api/', 'fetch(', 'localStorage', 'indexedDB', 'MutationObserver']:
            self.assertNotIn(forbidden, css)


if __name__ == "__main__":
    unittest.main()
