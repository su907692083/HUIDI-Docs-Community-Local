from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_batch_risk import RISK_MARKER, decorate_native_document_batch_risk


class NativeDocumentBatchRiskContractTest(unittest.TestCase):
    def _page(self, packing: bool = False) -> str:
        kind = "packing" if packing else "commercial"
        if packing:
            top = "<input data-k='packages' value='30 cartons'><input data-k='net_weight' value='300 kg'><input data-k='gross_weight' value='330 kg'><input data-k='volume' value='3.6 CBM'>"
            extra1 = "<td><input data-item-k='packages' value='10 cartons'></td><td><input data-item-k='net_weight' value='100 kg'></td><td><input data-item-k='gross_weight' value='110 kg'></td><td><input data-item-k='carton_size' value='50x40x30 cm'></td><td><input data-item-k='volume' value='1.2 CBM'></td>"
            extra2 = "<td><input data-item-k='packages' value='20 cartons'></td><td><input data-item-k='net_weight' value='200 kg'></td><td><input data-item-k='gross_weight' value='220 kg'></td><td><input data-item-k='carton_size' value='60x40x30 cm'></td><td><input data-item-k='volume' value='2.4 CBM'></td>"
        else:
            top = ""
            extra1 = "<td><input data-item-k='lead_time' value='2026-09-20'></td>"
            extra2 = "<td><input data-item-k='lead_time' value='2026-09-15'></td>"
        return f"""<html><head><style></style></head><body>
        <details data-hnd-batch-reconcile><div data-hnd-batch-reconcile-groups></div></details>{top}
        <div class='table-wrap'><table class='item-table {kind}'><tbody>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>1</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><input data-item-k='quantity' value='300'></td>{extra1}</tr>
          <tr data-item-row data-product-id='p1' data-brain-id='b1'><td>2</td><td><input data-item-k='product' value='Product A'></td><td><input data-item-k='sku' value='SKU-A'></td><td><input data-item-k='quantity' value='700'></td>{extra2}</tr>
        </tbody></table></div></body></html>"""

    def test_requires_reconcile_owner_and_is_idempotent(self) -> None:
        plain = "<html><head><style></style></head><body><tr data-item-row></tr></body></html>"
        self.assertEqual(decorate_native_document_batch_risk(plain), plain)
        decorated = decorate_native_document_batch_risk(self._page())
        self.assertIn(RISK_MARKER, decorated)
        self.assertEqual(decorated.count(RISK_MARKER), 1)
        self.assertEqual(decorate_native_document_batch_risk(decorated), decorated)

    def test_delivery_risk_is_strict_read_only_and_never_guesses_dates(self) -> None:
        page = decorate_native_document_batch_risk(self._page())
        for marker in (
            "批次交期风险 / Packing 缺项核对",
            "safeDate",
            "Date.UTC",
            "日期格式未安全识别",
            "7 天内到期",
            "交期就是今天",
            "已早于今天",
            "交期顺序与当前批次行次序不一致",
            "日期风险只读，不改变单据状态",
        ):
            self.assertIn(marker, page, marker)
        source = (Path(__file__).parents[1] / "app" / "native_document_batch_risk.py").read_text(encoding="utf-8")
        self.assertNotIn("Date.parse", source)
        self.assertNotRegex(source, r"new Date\(\s*(?:raw|text|value)\s*\)")

    def test_packing_missing_fields_and_whole_totals_are_advisory(self) -> None:
        page = decorate_native_document_batch_risk(self._page(packing=True))
        for marker in (
            "关键装箱字段",
            "数量、箱数、净重、毛重、外箱尺寸、体积",
            "唛头/备注保持可选",
            "整票合计 vs 分批合计",
            "packingTotals",
            "箱/包装件数",
            "净重",
            "毛重",
            "体积",
            "相差",
            "只提示，不自动补值",
        ):
            self.assertIn(marker, page, marker)

    def test_risk_layer_has_no_persistence_or_business_mutation_path(self) -> None:
        source = (Path(__file__).parents[1] / "app" / "native_document_batch_risk.py").read_text(encoding="utf-8")
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
            "OnlineDocumentRef(",
            "DRAFT_FIELDS",
            "LONG_FIELDS",
            "INHERITABLE_FIELDS",
            "data-item-k=\"unit_price\"",
            "data-item-k=\"total\"",
        ):
            self.assertNotIn(forbidden, source, forbidden)
        self.assertNotRegex(source, r"field\([^\n]+\)\.value\s*=")
        self.assertNotRegex(source, r"\.value\s*=\s*")

    def test_risk_installs_after_reconcile_once(self) -> None:
        daily = (Path(__file__).parents[1] / "app" / "daily_app.py").read_text(encoding="utf-8")
        reconcile = daily.index("install_native_document_batch_reconcile(standalone_business)")
        risk = daily.index("install_native_document_batch_risk(standalone_business)")
        self.assertLess(reconcile, risk)
        self.assertEqual(daily.count("install_native_document_batch_risk(standalone_business)"), 1)

    def test_generated_javascript_is_valid(self) -> None:
        for page in (self._page(), self._page(packing=True)):
            decorated = decorate_native_document_batch_risk(page)
            scripts = re.findall(r"<script[^>]*>(.*?)</script>", decorated, re.S)
            self.assertEqual(len(scripts), 1)
            with tempfile.TemporaryDirectory() as tmp:
                target = Path(tmp) / "batch-risk.js"
                target.write_text(scripts[0], encoding="utf-8")
                subprocess.run(["node", "--check", str(target)], check=True)


if __name__ == "__main__":
    unittest.main()
