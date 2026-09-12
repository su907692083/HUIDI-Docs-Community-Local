from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_review import REVIEW_MARKER, decorate_native_document_review


class NativeDocumentReviewContractTest(unittest.TestCase):
    def _page(self) -> str:
        return """<html><head><style></style></head><body>
        <div data-hnd-batch></div>
        <div data-hnd-grid-tools><input data-hnd-grid-search><select data-hnd-grid-filter></select></div>
        <details data-hnd-paste><textarea data-hnd-paste-text></textarea></details>
        <div class='table-wrap'><table class='item-table'><tbody>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>1</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>SUS304</textarea></td><td><input data-item-k='quantity' value='100'></td><td><input data-item-k='unit_price' value='2'></td><td><input class='hnd-amount-mismatch' data-item-k='total' value='150'></td></tr>
          <tr data-item-row data-product-id='p2' data-brain-id='b2'><td>2</td><td><input data-item-k='product' value='Product B'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>SUS316</textarea></td><td><input data-item-k='quantity' value='50'></td><td><input data-item-k='unit_price' value='3'></td><td><input data-item-k='total' value='150'></td></tr>
        </tbody></table></div></body></html>"""

    def test_review_requires_existing_grid_and_paste_and_is_idempotent(self) -> None:
        plain = "<html><head><style></style></head><body><tr data-item-row></tr></body></html>"
        self.assertEqual(decorate_native_document_review(plain), plain)
        decorated = decorate_native_document_review(self._page())
        self.assertIn(REVIEW_MARKER, decorated)
        self.assertEqual(decorated.count(REVIEW_MARKER), 1)
        self.assertEqual(decorate_native_document_review(decorated), decorated)

    def test_review_is_read_only_and_exposes_bounded_anomaly_duplicate_flow(self) -> None:
        page = decorate_native_document_review(self._page())
        for marker in (
            "全部核对状态",
            "只看异常",
            "只看重复 SKU / 产品",
            "下一异常",
            "同 SKU",
            "可能是分批/拆分",
            "整表金额参考",
            "数量×单价",
            "粘贴源重复",
            "系统不自动合并",
            "hnd-amount-mismatch",
            "hnd-paste-cell-warning",
            "hnd-review-hidden",
            "scrollIntoView",
        ):
            self.assertIn(marker, page, marker)

        source = Path(__file__).parents[1] / "app" / "native_document_review.py"
        text = source.read_text(encoding="utf-8")
        for forbidden in (
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "window.open",
            "location.href",
            "createElement(",
            "appendChild(",
            "dispatchEvent(",
            "dataset.productId=",
            "dataset.brainId=",
        ):
            self.assertNotIn(forbidden, text, forbidden)
        self.assertIsNone(re.search(r"\.value\s*=", text))
        self.assertIsNone(re.search(r"\.hidden\s*=", text))

        scripts = re.findall(r"<script[^>]*>(.*?)</script>", page, re.S)
        self.assertEqual(len(scripts), 1)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "native-review.js"
            target.write_text(scripts[0], encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

    def test_review_installs_after_paste_without_replacing_existing_owners(self) -> None:
        daily = (Path(__file__).parents[1] / "app" / "daily_app.py").read_text(encoding="utf-8")
        paste = daily.index("install_native_document_paste(standalone_business)")
        review = daily.index("install_native_document_review(standalone_business)")
        self.assertLess(paste, review)
        self.assertEqual(daily.count("install_native_document_review(standalone_business)"), 1)
        self.assertNotIn("OnlineDocumentRef(", (Path(__file__).parents[1] / "app" / "native_document_review.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
