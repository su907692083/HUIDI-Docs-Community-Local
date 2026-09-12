from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_paste import PASTE_MARKER, decorate_native_document_paste


class NativeDocumentPasteContractTest(unittest.TestCase):
    def _grid_page(self) -> str:
        return """<html><head><style></style></head><body>
        <div data-hnd-batch><input type='checkbox' data-hnd-select-all></div>
        <div data-hnd-grid-tools></div>
        <div class='table-wrap'><table class='item-table'><tbody>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>1</td><td><input data-item-k='product' value='Long Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><textarea data-item-k='spec'>SUS304</textarea></td><td><input data-item-k='quantity' value=''></td><td><input data-item-k='unit_price' value=''></td><td><input data-item-k='total' value=''></td><td><input data-item-k='lead_time' value=''></td></tr>
          <tr data-item-row data-product-id='p2' data-brain-id='b2'><td>2</td><td><input data-item-k='product' value='Long Product B'></td><td><input data-item-k='sku' value='SKU-B'></td><td><textarea data-item-k='spec'>SUS316</textarea></td><td><input data-item-k='quantity' value=''></td><td><input data-item-k='unit_price' value=''></td><td><input data-item-k='total' value=''></td><td><input data-item-k='lead_time' value=''></td></tr>
        </tbody></table></div></body></html>"""

    def test_paste_requires_existing_grid_and_is_idempotent(self) -> None:
        plain = "<html><head><style></style></head><body><div class='table-wrap'><table><tr data-item-row><td>1</td></tr></table></div></body></html>"
        self.assertEqual(decorate_native_document_paste(plain), plain)
        decorated = decorate_native_document_paste(self._grid_page())
        self.assertIn(PASTE_MARKER, decorated)
        self.assertEqual(decorated.count(PASTE_MARKER), 1)
        self.assertEqual(decorate_native_document_paste(decorated), decorated)

    def test_excel_paste_is_explicit_identity_safe_and_uses_existing_draft_owner(self) -> None:
        page = decorate_native_document_paste(self._grid_page())
        for marker in (
            "批量粘贴 Excel / 旧表格",
            "填到目标空白",
            "覆盖目标字段",
            "SKU/产品始终只用于匹配现有产品行",
            "line.split('\\t')",
            "identityColumns",
            "rowMatch(source,targets,used)",
            "if(!writable.has(key))return",
            "if(!overwriteExisting&&String(op.input.value||'').trim())",
            "op.input.dispatchEvent(new Event('input',{bubbles:true}))",
            "尚未保存，请继续核对后使用原“保存草稿”",
            "const targets=visibleRows()",
            "当前筛选下没有可见产品行",
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
            "dataset.productId=",
            "dataset.brainId=",
            "createElement('tr')",
            "appendChild(row)",
        ):
            self.assertNotIn(forbidden, page, forbidden)

        source = Path(__file__).parents[1] / "app" / "native_document_paste.py"
        text = source.read_text(encoding="utf-8")
        writable_match = re.search(r"const writable=new Set\(\[(.*?)\]\);", text, re.S)
        self.assertIsNotNone(writable_match)
        writable_text = writable_match.group(1)
        self.assertNotIn("'product'", writable_text)
        self.assertNotIn("'sku'", writable_text)
        self.assertIn("'unit_price'", writable_text)
        self.assertIn("'total'", writable_text)

        scripts = re.findall(r"<script[^>]*>(.*?)</script>", page, re.S)
        self.assertEqual(len(scripts), 1)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "native-paste.js"
            target.write_text(scripts[0], encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

    def test_smart_headers_scan_preamble_and_common_foreign_trade_columns(self) -> None:
        page = decorate_native_document_paste(self._grid_page())
        for marker in (
            "headerCandidates=Math.min(matrix.length,5)",
            "function headerKey(value)",
            "unitprice",
            "netweight",
            "grossweight",
            "cartonsize",
            "packageqty",
            "表头第 ${info.headerIndex+1} 行",
            "QTY(PCS)",
            "Unit Price(USD)",
            "N.W.(KG)",
            "G.W.(KG)",
            "Carton Size(CM)",
        ):
            self.assertIn(marker, page, marker)

    def test_numeric_normalization_is_bounded_and_ambiguous_values_are_skipped(self) -> None:
        page = decorate_native_document_paste(self._grid_page())
        for marker in (
            "const numericKeys=new Set",
            "可能是逗号小数，存在歧义，已跳过",
            "的逗号格式无法安全识别，已跳过",
            "含非 KG 单位，未自动换算",
            "含未知单位，未自动换算",
            "hnd-paste-cell-warning",
            "跳过歧义 ${blocked} 项",
            "if(normalized.safe)ops.push",
            "表头检测到币种 ${code}",
            "请确认与当前正式单据币种一致",
        ):
            self.assertIn(marker, page, marker)

        self.assertIn("(?:pcs?|pieces?|sets?|units?|件|套)$", page)
        self.assertIn("(?:cartons?|ctns?|boxes?|packages?|箱|件)$", page)
        self.assertIn("(?:kg|kgs|公斤|千克)$", page)
        self.assertIn("(?:cbm|m3|m³|立方米)$", page)
        self.assertNotIn("* 2.204", page)
        self.assertNotIn("/ 2.204", page)
        self.assertNotIn("自动换算", page.replace("未自动换算", ""))

    def test_row_level_issue_panel_is_local_preview_only(self) -> None:
        page = decorate_native_document_paste(self._grid_page())
        for marker in (
            "data-hnd-paste-issues",
            "粘贴核对提示 ${plan.issues.length} 项",
            "未匹配当前可见产品，已跳过整行",
            "renderIssues(plan)",
            "escapeHtml(item.message)",
        ):
            self.assertIn(marker, page, marker)
        self.assertNotIn("form.submit", page)
        self.assertNotIn("requestSubmit", page)

    def test_single_product_or_ungridded_document_is_untouched(self) -> None:
        single = "<html><head><style></style></head><body><div data-hnd-grid-tools></div><table class='item-table'></table></body></html>"
        self.assertEqual(decorate_native_document_paste(single), single)


if __name__ == "__main__":
    unittest.main()
