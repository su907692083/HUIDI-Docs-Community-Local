from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app import document_context
from app.native_document_batch_reconcile import (
    BATCH_RECONCILE_FIELD,
    RECONCILE_MARKER,
    decorate_native_document_batch_reconcile,
)


class NativeDocumentBatchReconcileContractTest(unittest.TestCase):
    def _page(self, packing: bool = False) -> str:
        kind = "packing" if packing else "commercial"
        extra1 = "<td><input data-item-k='packages' value='10 cartons'></td><td><input data-item-k='net_weight' value='100 kg'></td><td><input data-item-k='gross_weight' value='110 kg'></td><td><input data-item-k='volume' value='1.2 CBM'></td>" if packing else "<td><input data-item-k='lead_time' value='2026-09-20'></td>"
        extra2 = "<td><input data-item-k='packages' value='20 cartons'></td><td><input data-item-k='net_weight' value='200 kg'></td><td><input data-item-k='gross_weight' value='220 kg'></td><td><input data-item-k='volume' value='2.4 CBM'></td>" if packing else "<td><input data-item-k='lead_time' value='2026-10-15'></td>"
        return f"""<html><head><style></style></head><body>
        <details data-hnd-batch-confirm><select data-hnd-batch-source><option value='0'>SKU-A</option></select><button data-hnd-batch-split>复制为批次行</button></details>
        <div class='table-wrap'><table class='item-table {kind}'><tbody>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>1</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><input data-item-k='quantity' value='300'></td>{extra1}</tr>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>2</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><input data-item-k='quantity' value='700'></td>{extra2}</tr>
        </tbody></table></div></body></html>"""

    def test_reconcile_requires_manual_batch_owner_and_is_idempotent(self) -> None:
        plain = "<html><head><style></style></head><body><tr data-item-row></tr></body></html>"
        self.assertEqual(decorate_native_document_batch_reconcile(plain), plain)
        decorated = decorate_native_document_batch_reconcile(self._page(), '{"schema":"huidi.document.batch-reconcile/v1","targets":{}}')
        self.assertIn(RECONCILE_MARKER, decorated)
        self.assertEqual(decorated.count(RECONCILE_MARKER), 1)
        self.assertEqual(decorate_native_document_batch_reconcile(decorated), decorated)

    def test_reconcile_metadata_uses_same_draft_owner_but_never_inherits(self) -> None:
        self.assertIn(BATCH_RECONCILE_FIELD, document_context.DRAFT_FIELDS)
        self.assertIn(BATCH_RECONCILE_FIELD, document_context.LONG_FIELDS)
        self.assertNotIn(BATCH_RECONCILE_FIELD, document_context.INHERITABLE_FIELDS)
        self.assertNotIn(BATCH_RECONCILE_FIELD, document_context.ITEM_FIELDS)

    def test_quantity_timeline_and_packing_reconciliation_are_advisory_only(self) -> None:
        commercial = decorate_native_document_batch_reconcile(self._page())
        packing = decorate_native_document_batch_reconcile(self._page(packing=True))
        for marker in (
            "批次总量 / 交期 / 装箱核对",
            "拆批前总量基准",
            "总量基准",
            "数量核对",
            "各批数量合计",
            "交期未填",
            "不自动分配数量、箱数、重量、CBM 或交期",
            "pre_split",
            "safeNumber",
            "stopImmediatePropagation",
            "尚未保存的新批次不能继续复制",
        ):
            self.assertIn(marker, commercial, marker)
        for marker in (
            "分批装箱汇总",
            "包装件数",
            "净重",
            "毛重",
            "体积",
            "毛重小于净重",
        ):
            self.assertIn(marker, packing, marker)

        source = Path(__file__).parents[1] / "app" / "native_document_batch_reconcile.py"
        text = source.read_text(encoding="utf-8")
        for forbidden in (
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "cloneNode(",
            "createElement(",
            "insertRow(",
            "dispatchEvent(",
            "dataset.productId=",
            "dataset.brainId=",
            "OnlineDocumentRef(",
        ):
            self.assertNotIn(forbidden, text, forbidden)
        self.assertNotRegex(text, r"field\([^\n]+\)\.value\s*=")
        self.assertNotIn("data-item-k=\"unit_price\"", text)
        self.assertNotIn("data-item-k=\"total\"", text)

    def test_target_edit_refreshes_on_change_not_per_keystroke(self) -> None:
        source = (Path(__file__).parents[1] / "app" / "native_document_batch_reconcile.py").read_text(encoding="utf-8")
        self.assertIn("groupsBox.addEventListener('change'", source)
        self.assertNotIn("groupsBox.addEventListener('input'", source)
        self.assertIn("?'拆批前自动记录':", source)
        self.assertIn("'未记录'", source)

    def test_reconcile_installs_after_manual_batch_confirmation(self) -> None:
        daily = (Path(__file__).parents[1] / "app" / "daily_app.py").read_text(encoding="utf-8")
        confirm = daily.index("install_native_document_batch_confirm(standalone_business)")
        reconcile = daily.index("install_native_document_batch_reconcile(standalone_business)")
        self.assertLess(confirm, reconcile)
        self.assertEqual(daily.count("install_native_document_batch_reconcile(standalone_business)"), 1)

    def test_generated_javascript_is_valid(self) -> None:
        for page in (self._page(), self._page(packing=True)):
            decorated = decorate_native_document_batch_reconcile(page)
            scripts = re.findall(r"<script[^>]*>(.*?)</script>", decorated, re.S)
            self.assertEqual(len(scripts), 1)
            with tempfile.TemporaryDirectory() as tmp:
                target = Path(tmp) / "batch-reconcile.js"
                target.write_text(scripts[0], encoding="utf-8")
                subprocess.run(["node", "--check", str(target)], check=True)


if __name__ == "__main__":
    unittest.main()
