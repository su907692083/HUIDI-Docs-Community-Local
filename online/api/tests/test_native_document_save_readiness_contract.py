from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_save_readiness import READINESS_MARKER, decorate_native_document_save_readiness


class NativeDocumentSaveReadinessContractTest(unittest.TestCase):
    def _page(self) -> str:
        return """<html><head><style></style></head><body>
        <div class='top'><button id='save'>保存草稿</button></div>
        <div class='hnd-review' data-hnd-review>
          <select data-hnd-review-filter><option>全部核对状态</option></select>
          <button type='button' data-hnd-review-next disabled>下一异常</button>
          <span data-hnd-review-summary></span>
        </div>
        <details data-hnd-batch-reconcile><div class='hnd-batch-reconcile-card' data-state='warn'><button data-hnd-batch-target-confirm>确认变更</button></div></details>
        <details data-hnd-batch-risk><div class='hnd-batch-risk-card' data-level='bad'></div></details>
        <table class='item-table'><tbody><tr data-item-row><td><input class='hnd-amount-mismatch' data-item-k='total'></td><td><input class='hnd-paste-cell-warning' data-item-k='quantity'></td></tr></tbody></table>
        <script id='huidi-native-document-review-v1'></script>
        <script id='huidi-native-document-batch-risk-v1'></script>
        </body></html>"""

    def test_readiness_reuses_existing_review_bar_and_is_idempotent(self) -> None:
        decorated = decorate_native_document_save_readiness(self._page())
        self.assertIn(READINESS_MARKER, decorated)
        self.assertIn("data-hnd-save-readiness", decorated)
        self.assertIn("data-hnd-save-next", decorated)
        self.assertIn("下一待核对", decorated)
        self.assertNotIn("data-hnd-review-next", decorated)
        self.assertEqual(decorated.count(READINESS_MARKER), 1)
        self.assertEqual(decorate_native_document_save_readiness(decorated), decorated)

    def test_readiness_unifies_existing_review_sources_without_business_guessing(self) -> None:
        page = decorate_native_document_save_readiness(self._page())
        for marker in (
            ".hnd-amount-mismatch",
            ".hnd-paste-cell-warning",
            "[data-hnd-batch-target-confirm]",
            ".hnd-batch-reconcile-card[data-state='bad']",
            ".hnd-batch-reconcile-card[data-state='warn']",
            ".hnd-batch-risk-card[data-level='bad']",
            ".hnd-batch-risk-card[data-level='warn']",
            "仍可保存",
            "当前筛选隐藏了待核对行",
        ):
            self.assertIn(marker, page, marker)

    def test_readiness_never_blocks_or_owns_save_draft(self) -> None:
        source = (Path(__file__).parents[1] / "app" / "native_document_save_readiness.py").read_text(encoding="utf-8")
        self.assertIn("const save=document.querySelector('#save')", source)
        self.assertIn("save.classList.toggle('hnd-save-has-review'", source)
        self.assertIn("save.title=", source)
        for forbidden in (
            "save.disabled",
            "save.setAttribute('disabled'",
            "preventDefault(",
            "stopImmediatePropagation(",
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "dispatchEvent(",
            "OnlineDocumentRef(",
            "DRAFT_FIELDS",
            "LONG_FIELDS",
            "INHERITABLE_FIELDS",
            "createElement(",
            "cloneNode(",
            "insertRow(",
        ):
            self.assertNotIn(forbidden, source, forbidden)
        self.assertNotRegex(source, r"\.value\s*=")

    def test_next_review_item_only_navigates_and_highlights_existing_targets(self) -> None:
        source = (Path(__file__).parents[1] / "app" / "native_document_save_readiness.py").read_text(encoding="utf-8")
        for marker in (
            "scrollIntoView",
            "details.open=true",
            "control.focus",
            "hnd-save-review-focus",
            "isVisible",
            "row.hidden",
            "hnd-review-hidden",
        ):
            self.assertIn(marker, source, marker)

    def test_readiness_installs_after_risk_once(self) -> None:
        daily = (Path(__file__).parents[1] / "app" / "daily_app.py").read_text(encoding="utf-8")
        risk = daily.index("install_native_document_batch_risk(standalone_business)")
        readiness = daily.index("install_native_document_save_readiness(standalone_business)")
        self.assertLess(risk, readiness)
        self.assertEqual(daily.count("install_native_document_save_readiness(standalone_business)"), 1)

    def test_generated_javascript_is_valid(self) -> None:
        decorated = decorate_native_document_save_readiness(self._page())
        scripts = re.findall(r"<script[^>]*>(.*?)</script>", decorated, re.S)
        generated = [script for script in scripts if "data-hnd-save-readiness" in script]
        self.assertEqual(len(generated), 1)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "save-readiness.js"
            target.write_text(generated[0], encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)


if __name__ == "__main__":
    unittest.main()
