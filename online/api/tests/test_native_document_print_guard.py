from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace

from app.native_document_print_guard import (
    PRINT_MARKER,
    decorate_native_document_print,
    install_native_document_print_guard,
)


ROOT = Path(__file__).resolve().parents[1]


class NativeDocumentPrintGuardTests(unittest.TestCase):
    def _page(self, *, packing: bool = False, multi: bool = False) -> str:
        title = "装箱单" if packing else "报价单"
        table_class = "item-table packing" if packing else "item-table commercial" if multi else ""
        table = (
            f"<div class='table-wrap'><table class='{table_class}'><thead><tr><th>产品</th></tr></thead>"
            "<tbody><tr data-item-row><td><input data-item-k='product' value='Long Product Name / SKU'></td></tr></tbody></table></div>"
            if packing or multi
            else "<table><thead><tr><th>产品</th></tr></thead><tbody><tr><td><input data-k='product' value='Product'></td></tr></tbody></table>"
        )
        return f"""<!doctype html><html><head><title>{title} · HUIDI Online</title></head><body>
<div class='top'><button id='print'>打印 / 另存 PDF</button></div>
<main class='paper'><h1>{title}</h1><div class='ctx'>内部业务链提示</div>{table}
<label>备注<textarea data-k='requirements'>A very long formal requirement that must wrap in PDF output.</textarea></label>
<div class='foot'><div class='sign'>Seller</div><div class='sign'>Buyer</div></div></main>
</body></html>"""

    def test_guard_keeps_editor_and_adds_one_print_only_contract(self) -> None:
        decorated = decorate_native_document_print(self._page())
        self.assertIn(PRINT_MARKER, decorated)
        self.assertIn("@media print", decorated)
        self.assertIn(".huidi-print-value{display:none}", decorated)
        self.assertIn("[data-k]:not([type='hidden'])", decorated)
        self.assertIn("thead{display:table-header-group!important}", decorated)
        self.assertIn("break-inside:avoid", decorated)
        self.assertIn("overflow-wrap:anywhere", decorated)
        self.assertIn(".top,.ctx,.note,.refprice,.item-ref", decorated)
        self.assertIn("button,select{display:none!important}", decorated)
        self.assertIn("print-color-adjust:exact", decorated)
        self.assertIn("size:A4 ${orientation}", decorated)
        self.assertIn("orientation=(wideTable||packing)?'landscape':'portrait'", decorated)
        self.assertIn("window.addEventListener('beforeprint',syncMirrors)", decorated)
        self.assertIn("window.addEventListener('afterprint',clearMirrors)", decorated)
        self.assertNotIn("fetch(", decorated)
        self.assertEqual(decorate_native_document_print(decorated), decorated)

    def test_multi_product_and_packing_use_fixed_print_columns(self) -> None:
        commercial = decorate_native_document_print(self._page(multi=True))
        packing = decorate_native_document_print(self._page(packing=True))
        self.assertIn(".item-table.commercial th:nth-child(8)", commercial)
        self.assertIn(".item-table.packing th:nth-child(11)", packing)
        self.assertIn("const wideTable=Boolean(document.querySelector('.item-table'))", commercial)
        self.assertIn("String(document.title||'').includes('装箱单')", packing)

    def test_installer_wraps_existing_renderer_once(self) -> None:
        module = SimpleNamespace(_document_html=lambda: self._page())
        install_native_document_print_guard(module)
        first = module._document_html
        install_native_document_print_guard(module)
        self.assertIs(first, module._document_html)
        self.assertIn(PRINT_MARKER, module._document_html())

    def test_document_workbench_installs_print_guard_after_header_guard(self) -> None:
        source = (ROOT / "app" / "document_workbench.py").read_text(encoding="utf-8")
        self.assertIn("install_native_document_header_guard(standalone_business)", source)
        self.assertIn("install_native_document_print_guard(standalone_business)", source)
        self.assertLess(
            source.index("install_native_document_header_guard(standalone_business)"),
            source.index("install_native_document_print_guard(standalone_business)"),
        )


if __name__ == "__main__":
    unittest.main()
