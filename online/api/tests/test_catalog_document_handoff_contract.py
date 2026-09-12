from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class CatalogDocumentHandoffContractTests(unittest.TestCase):
    def test_business_context_loads_catalog_document_handoff(self) -> None:
        source = (WEB / "business-context.js").read_text(encoding="utf-8")
        self.assertIn("catalog-document-handoff-v1.js?v=HUIDI-CATALOG-DOCUMENT-HANDOFF-1", source)
        self.assertIn("loadCatalogDocumentHandoff", source)
        self.assertIn("HUIDICatalogDocumentHandoff", source)

    def test_handoff_reuses_existing_deal_product_and_document_owners(self) -> None:
        source = (WEB / "catalog-document-handoff-v1.js").read_text(encoding="utf-8")
        self.assertIn("data-hoc-documents", source)
        self.assertIn("加入单据工作台", source)
        self.assertIn("HUIDIOnlineCatalog?.selectedProductIds", source)
        self.assertIn("/api/business/deals/${encodeURIComponent(id)}/products", source)
        self.assertIn("method:'PUT'", source)
        self.assertIn("product_ids:ids", source)
        self.assertIn("HUIDIDocumentEntryConnectivity?.setDeal?.(id)", source)
        self.assertIn("HUIDIWorkspaceFoundation?.documents", source)
        self.assertIn("正式单价、金额和执行数量仍需在单据中确认", source)
        self.assertIn("目录未选择产品，保留当前询盘已有产品关联", source)
        self.assertNotIn("/native-document", source)
        self.assertNotIn("deal.amount", source)
        self.assertNotIn("unit_price", source)
        self.assertNotIn("localStorage", source)
        self.assertNotIn("indexedDB", source)
        self.assertNotIn("MutationObserver", source)
        self.assertNotIn("setInterval", source)

    def test_assets_parse(self) -> None:
        subprocess.run(["node", "--check", str(WEB / "catalog-document-handoff-v1.js")], check=True, cwd=ROOT)
        subprocess.run(["node", "--check", str(WEB / "business-context.js")], check=True, cwd=ROOT)


if __name__ == "__main__":
    unittest.main()
