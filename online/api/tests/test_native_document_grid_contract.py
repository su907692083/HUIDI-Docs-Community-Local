from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_grid import GRID_MARKER, decorate_native_document_grid


class NativeDocumentGridContractTest(unittest.TestCase):
    def test_grid_decorator_requires_existing_batch_table_and_is_idempotent(self) -> None:
        plain = "<html><head><style></style></head><body><div class='table-wrap'><table><tr data-item-row><td>1</td></tr></table></div></body></html>"
        self.assertEqual(decorate_native_document_grid(plain), plain)

        batched = """<html><head><style></style></head><body>
        <div data-hnd-batch><input type='checkbox' data-hnd-select-all></div>
        <div class='table-wrap'><table class='item-table'><tbody>
          <tr data-item-row class='hnd-incomplete'><td>1<input type='checkbox' data-hnd-row-select></td><td><input data-item-k='product' value='Long Product Name'></td><td><input data-item-k='sku' value='SKU-1'></td><td><textarea data-item-k='spec'>SUS304</textarea></td><td><input data-item-k='quantity' value=''></td><td><input data-item-k='unit_price' value=''></td><td><input data-item-k='total' class='hnd-amount-mismatch' value=''></td></tr>
        </tbody></table></div></body></html>"""
        decorated = decorate_native_document_grid(batched)
        self.assertIn(GRID_MARKER, decorated)
        self.assertEqual(decorated.count(GRID_MARKER), 1)
        self.assertEqual(decorate_native_document_grid(decorated), decorated)

    def test_grid_controls_search_filters_sticky_columns_and_no_business_owner(self) -> None:
        batched = """<html><head><style></style></head><body>
        <div data-hnd-batch><input type='checkbox' data-hnd-select-all></div>
        <div class='table-wrap'><table class='item-table'><tbody>
          <tr data-item-row class='hnd-incomplete'><td>1<input type='checkbox' data-hnd-row-select></td><td><input data-item-k='product' value='A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>Spec A</textarea></td><td><input data-item-k='total' class='hnd-amount-mismatch' value=''></td></tr>
          <tr data-item-row><td>2<input type='checkbox' data-hnd-row-select></td><td><input data-item-k='product' value='B'></td><td><input data-item-k='sku' value='SKU-B'></td><td><textarea data-item-k='spec'>Spec B</textarea></td><td><input data-item-k='total' value='10'></td></tr>
        </tbody></table></div></body></html>"""
        page = decorate_native_document_grid(batched)
        for marker in (
            "搜索产品 / SKU / 规格",
            "只看缺项",
            "只看金额异常",
            "只看已选",
            "显示 ${shown} / ${rows.length} 行",
            "row.classList.contains('hnd-incomplete')",
            "classList.contains('hnd-amount-mismatch')",
            "event.stopImmediatePropagation()",
            "check.checked=!row.hidden&&checked",
            ".item-table th:nth-child(1)",
            ".item-table th:nth-child(2)",
            ".item-table th:nth-child(3)",
            "position:sticky",
            "max-height:min(66vh,760px)",
        ):
            self.assertIn(marker, page, marker)

        for forbidden in (
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "location.href",
            "window.open",
            "data-item-k=\"unit_price\"].value",
            "data-item-k=\"total\"].value",
        ):
            self.assertNotIn(forbidden, page, forbidden)

        scripts = re.findall(r"<script[^>]*>(.*?)</script>", page, re.S)
        self.assertEqual(len(scripts), 1)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "native-grid.js"
            target.write_text(scripts[0], encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

    def test_filter_layer_never_writes_item_values(self) -> None:
        source = Path(__file__).parents[1] / "app" / "native_document_grid.py"
        text = source.read_text(encoding="utf-8")
        self.assertNotIn("target.value=", text)
        self.assertNotIn("field(row,'unit_price').value", text)
        self.assertNotIn("field(row,'total').value", text)
        self.assertIn("row.hidden=!show", text)
        self.assertIn("if(!show&&check?.checked){check.checked=false", text)


if __name__ == "__main__":
    unittest.main()
