from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app import document_context
from app.native_document_batch_confirm import (
    BATCH_REVIEW_FIELD,
    BATCH_REVIEW_SCHEMA,
    CONFIRM_MARKER,
    decorate_native_document_batch_confirm,
)


class NativeDocumentBatchConfirmContractTest(unittest.TestCase):
    def _page(self) -> str:
        return """<html><head><style></style></head><body>
        <div data-hnd-review></div>
        <details data-hnd-paste><textarea data-hnd-paste-text></textarea></details>
        <div class='table-wrap'><table class='item-table commercial'><tbody>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>1</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>SUS304</textarea></td><td><input data-item-k='quantity' value='100'></td><td><input data-item-k='unit_price' value='2'></td><td><input data-item-k='total' value='200'></td><td><input data-item-k='lead_time' value='20 days'></td></tr>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>2</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>SUS304</textarea></td><td><input data-item-k='quantity' value='50'></td><td><input data-item-k='unit_price' value='2'></td><td><input data-item-k='total' value='100'></td><td><input data-item-k='lead_time' value='35 days'></td></tr>
        </tbody></table></div>
        <script>(()=>{const fields=[...document.querySelectorAll('[data-k]')];const itemRows=[...document.querySelectorAll('[data-item-row]')];function itemData(){return itemRows.map(row=>row.dataset.productId)}function data(){return Object.fromEntries(fields.map(el=>[el.dataset.k,el.value]))}})();</script>
        </body></html>"""

    def test_metadata_uses_existing_draft_owner_but_never_inherits(self) -> None:
        self.assertIn(BATCH_REVIEW_FIELD, document_context.DRAFT_FIELDS)
        self.assertIn(BATCH_REVIEW_FIELD, document_context.LONG_FIELDS)
        self.assertNotIn(BATCH_REVIEW_FIELD, document_context.INHERITABLE_FIELDS)
        cleaned = document_context._clean_fields({BATCH_REVIEW_FIELD: '{"schema":"x"}'})
        self.assertEqual(cleaned[BATCH_REVIEW_FIELD], '{"schema":"x"}')

    def test_batch_layer_is_idempotent_and_keeps_same_product_identity(self) -> None:
        saved = '{"schema":"%s","groups":{}}' % BATCH_REVIEW_SCHEMA
        page = decorate_native_document_batch_confirm(self._page(), saved)
        self.assertIn(CONFIRM_MARKER, page)
        self.assertEqual(page.count(CONFIRM_MARKER), 1)
        self.assertEqual(decorate_native_document_batch_confirm(page, saved), page)
        self.assertIn("复制为批次行", page)
        self.assertIn("确认保留多行", page)
        self.assertIn("批次备注", page)
        self.assertIn("差异提示", page)
        self.assertIn("Excel 匹配", page)
        self.assertIn("SKU 精确匹配", page)
        self.assertIn("不做模糊猜测", page)
        self.assertIn("cloneNode(true)", page)
        self.assertIn("input.readOnly=true", page)
        self.assertNotIn("dataset.productId=", page)
        self.assertNotIn("dataset.brainId=", page)
        self.assertIn("['quantity','unit_price','total','lead_time']", page)
        self.assertIn("['quantity','packages','net_weight','gross_weight','carton_size','volume','marks']", page)

    def test_new_batch_rows_still_use_original_native_save_owner(self) -> None:
        page = decorate_native_document_batch_confirm(self._page(), "")
        self.assertIn("const itemRows=new Proxy", page)
        self.assertNotIn("const itemRows=[...document.querySelectorAll('[data-item-row]')];", page)
        source = (Path(__file__).parents[1] / "app" / "native_document_batch_confirm.py").read_text(encoding="utf-8")
        for forbidden in (
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "window.open",
            "location.href",
            "OnlineDocumentRef(",
            "deal.amount",
            "reference_price",
        ):
            self.assertNotIn(forbidden, source, forbidden)
        self.assertIn("点击顶部“保存草稿”后才持久化", source)

    def test_batch_differences_are_non_price_and_match_confidence_is_exact_only(self) -> None:
        source = (Path(__file__).parents[1] / "app" / "native_document_batch_confirm.py").read_text(encoding="utf-8")
        self.assertIn("differenceKeys=packing?", source)
        match = re.search(r"const differenceKeys=packing\?(.*?);", source)
        self.assertIsNotNone(match)
        diff_contract = match.group(1)
        self.assertNotIn("unit_price", diff_contract)
        self.assertNotIn("total", diff_contract)
        self.assertIn("skuMatches.length===1", source)
        self.assertIn("productMatches.length===1", source)
        self.assertIn("未匹配现有产品行", source)
        self.assertNotIn("levenshtein", source.lower())
        self.assertNotIn("fuzzy", source.lower())

    def test_generated_inline_script_is_valid_javascript(self) -> None:
        page = decorate_native_document_batch_confirm(self._page(), "")
        scripts = re.findall(r"<script[^>]*>(.*?)</script>", page, re.S)
        self.assertGreaterEqual(len(scripts), 2)
        confirm_script = next(script for script in scripts if "data-hnd-batch-confirm" in script)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "batch-confirm.js"
            target.write_text(confirm_script, encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

    def test_installs_after_read_only_review(self) -> None:
        daily = (Path(__file__).parents[1] / "app" / "daily_app.py").read_text(encoding="utf-8")
        review = daily.index("install_native_document_review(standalone_business)")
        confirm = daily.index("install_native_document_batch_confirm(standalone_business)")
        self.assertLess(review, confirm)
        self.assertEqual(daily.count("install_native_document_batch_confirm(standalone_business)"), 1)


if __name__ == "__main__":
    unittest.main()
