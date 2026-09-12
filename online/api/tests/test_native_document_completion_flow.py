from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from app.native_document_batch import BATCH_MARKER, decorate_native_document_html


class NativeDocumentCompletionFlowTest(unittest.TestCase):
    def _decorate(self, table_class: str = "commercial") -> str:
        page = f"""<html><head><style></style></head><body>
        <div class='table-wrap'><table class='item-table {table_class}'><tbody>
          <tr data-item-row><td>1</td><td><input data-item-k='quantity' value='1200 pcs'></td><td><input data-item-k='unit_price' value='1.05'></td><td><input data-item-k='total' value=''></td><td><input data-item-k='lead_time' value='25 days'></td><td><textarea data-item-k='spec'>SUS304</textarea></td></tr>
          <tr data-item-row><td>2</td><td><input data-item-k='quantity' value=''></td><td><input data-item-k='unit_price' value=''></td><td><input data-item-k='total' value=''></td><td><input data-item-k='lead_time' value=''></td><td><textarea data-item-k='spec'>SUS316</textarea></td></tr>
        </tbody></table></div></body></html>"""
        return decorate_native_document_html(page)

    def test_completion_amount_review_and_keyboard_flow_are_presentation_only(self) -> None:
        decorated = self._decorate()
        self.assertIn(BATCH_MARKER, decorated)
        self.assertIn("data-hnd-progress", decorated)
        self.assertIn("data-hnd-next-missing", decorated)
        self.assertIn("完成度", decorated)
        self.assertIn("金额待确认", decorated)
        self.assertIn("金额需核对", decorated)
        self.assertIn("hnd-amount-mismatch", decorated)
        self.assertIn("参考计算", decorated)
        self.assertIn("系统不会自动写入", decorated)
        self.assertIn("event.key!=='Enter'", decorated)
        self.assertIn("input.tagName==='TEXTAREA'", decorated)
        self.assertIn("event.shiftKey?-1:1", decorated)
        self.assertNotIn("event.key==='Tab'", decorated)
        self.assertNotIn("totalInput.value=", decorated)
        self.assertNotIn("fetch(", decorated)
        self.assertNotIn("/api/", decorated)
        self.assertNotIn("localStorage", decorated)
        self.assertNotIn("MutationObserver", decorated)
        self.assertNotIn("location.href", decorated)

        scripts = re.findall(r"<script[^>]*>(.*?)</script>", decorated, re.S)
        self.assertTrue(scripts)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "native-completion-flow.js"
            target.write_text("\n".join(scripts), encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

    def test_commercial_and_packing_completion_fields_are_distinct(self) -> None:
        commercial = self._decorate("commercial")
        packing = self._decorate("packing")
        self.assertIn("['quantity','unit_price','lead_time']", commercial)
        self.assertIn("['quantity','packages','net_weight','gross_weight']", packing)
        self.assertIn("const packing=Boolean(document.querySelector('.item-table.packing'))", commercial)
        self.assertIn("下一缺项", packing)
        self.assertNotIn("requiredKeys=['quantity','unit_price','total'", commercial)


if __name__ == "__main__":
    unittest.main()
