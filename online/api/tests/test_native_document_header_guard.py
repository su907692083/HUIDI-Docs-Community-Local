from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace

from app.native_document_header_guard import (
    HEADER_MARKER,
    decorate_native_document_header,
    install_native_document_header_guard,
)


ROOT = Path(__file__).resolve().parents[1]


class NativeDocumentHeaderGuardTests(unittest.TestCase):
    def _page(self) -> str:
        return """<!doctype html><html><head><style>.top{display:flex}</style></head><body>
<div class='top'><b>HUIDI Online · 报价单</b><span id='saveState'></span><button id='back'>返回工作台</button><button id='save'>保存草稿</button><button id='download'>下载 HTML</button><button class='primary' onclick='window.print()'>打印 / 另存 PDF</button></div>
<input data-k='buyer' value='Buyer'><table><tr data-item-row data-product-id='p1' data-brain-id='b1'><td><input data-item-k='product' value='Item'></td></tr></table>
<script>fetch('/api/business/documents/42/draft',{method:'PUT'});</script></body></html>"""

    def test_header_guard_uses_same_draft_owner_and_hardens_all_toolbar_actions(self) -> None:
        decorated = decorate_native_document_header(self._page())
        self.assertIn(HEADER_MARKER, decorated)
        self.assertIn("data-huidi-native-header", decorated)
        self.assertIn("id='print'", decorated)
        self.assertNotIn("onclick='window.print()'", decorated)
        self.assertIn("/api/business/documents/${encodeURIComponent(refId)}/draft", decorated)
        self.assertIn("huidi-native-document-return-v1", decorated)
        self.assertIn("searchParams.get('huidi_return')", decorated)
        self.assertIn("sessionStorage.getItem(returnKey)", decorated)
        self.assertIn("localStorage.setItem(`huidi-native-doc-${refId}`", decorated)
        self.assertIn("beforeunload", decorated)
        self.assertIn("stopImmediatePropagation", decorated)
        self.assertIn("window.print()", decorated)
        self.assertIn("window.top.location.href=destination", decorated)
        self.assertIn("['quotation','proforma_invoice','sales_contract','commercial_invoice','packing_list'].includes(page)", decorated)
        self.assertIn("flex-wrap:wrap", decorated)
        self.assertNotIn("window.open(", decorated)
        self.assertEqual(decorate_native_document_header(decorated), decorated)

    def test_installer_wraps_existing_renderer_once(self) -> None:
        module = SimpleNamespace(_document_html=lambda: self._page())
        install_native_document_header_guard(module)
        first = module._document_html
        install_native_document_header_guard(module)
        self.assertIs(first, module._document_html)
        self.assertIn(HEADER_MARKER, module._document_html())

    def test_document_workbench_installs_guard_after_native_layers(self) -> None:
        source = (ROOT / "app" / "document_workbench.py").read_text(encoding="utf-8")
        self.assertIn("install_native_document_header_guard", source)
        self.assertIn("standalone_business", source)
        self.assertNotIn("__tablename__", source)
        self.assertNotIn("mapped_column", source)


if __name__ == "__main__":
    unittest.main()
