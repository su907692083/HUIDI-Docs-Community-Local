from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
APP = ROOT / "app"


class DocumentWorkbenchContractTests(unittest.TestCase):
    def test_daily_app_keeps_local_bundle_projection_as_compatibility_api_only(self):
        from app.daily_app import app

        paths = {route.path for route in app.routes}
        self.assertIn("/api/business/deals/{deal_id}/local-bundle", paths)

    def test_projection_reuses_existing_business_owners(self):
        source = (APP / "document_workbench.py").read_text(encoding="utf-8")
        self.assertIn("OnlineCustomer", source)
        self.assertIn("OnlineDeal", source)
        self.assertIn("OnlineDocumentRef", source)
        self.assertIn('BRIDGE_SCHEMA = "huidi.business.bundle/v1"', source)
        self.assertNotIn("__tablename__", source)
        self.assertNotIn("mapped_column", source)
        self.assertNotIn("deal.amount", source)

    def test_one_hop_document_workbench_is_loaded_and_visible_without_local_entry(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("data-huidi-doc-workbench", html)
        self.assertIn("单据工作台", html)
        self.assertIn('/assets/document-workbench-closure.js', html)
        self.assertNotIn("data-huidi-local-workbench", html)
        self.assertNotIn("离线单据工作台", html)
        self.assertNotIn("syncLocal", html)
        self.assertNotIn("localBase", html)

    def test_low_input_native_document_workbench_contract(self):
        source = (WEB / "document-workbench-closure.js").read_text(encoding="utf-8")
        self.assertIn("data-hdw-doc", source)
        self.assertIn("/native-document", source)
        self.assertIn("/api/business/deals?", source)
        self.assertIn("少填模式", source)
        self.assertIn("#hbProbability", source)
        self.assertIn("#hbAmount", source)
        self.assertIn("#dRole", source)
        self.assertIn("#dStatus", source)
        self.assertIn("mount?.('documents','单据工作台'", source)
        self.assertIn("当前正式价格仍由你确认", source)
        self.assertEqual(source.count("new MutationObserver"), 1)
        self.assertIn("ob.observe(main", source)
        self.assertNotIn("observe(document.body", source)
        self.assertNotIn("observe(document.documentElement", source)

    def test_normal_document_workbench_has_no_local_bridge_or_extra_window(self):
        source = (WEB / "document-workbench-closure.js").read_text(encoding="utf-8")
        for forbidden in [
            "/local-bundle",
            "online-bridge.html#bundle=",
            "window.open(",
            "127.0.0.1:8765",
            "data-hdw-local",
            "data-hdw-sync-local",
            "直接打开离线版",
            "带当前业务到离线版",
        ]:
            self.assertNotIn(forbidden, source)

    def test_browser_script_parses(self):
        subprocess.run(
            ["node", "--check", str(WEB / "document-workbench-closure.js")],
            check=True,
            cwd=ROOT,
        )


if __name__ == "__main__":
    unittest.main()
