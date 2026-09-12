from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class DocumentEntryConnectivityContractTests(unittest.TestCase):
    def test_connector_is_loaded_from_existing_business_context(self) -> None:
        context = (WEB / "business-context.js").read_text(encoding="utf-8")
        self.assertIn("document-entry-connectivity-v1.js?v=HUIDI-DOCUMENT-ENTRY-1", context)
        self.assertIn("loadDocumentEntryConnectivity", context)
        self.assertIn("HUIDIDocumentEntryConnectivity", context)
        self.assertIn("HUIDIDocumentEntryConnectivity?.setDeal?.(id,data)", context)
        self.assertIn("HUIDIDocumentEntryConnectivity?.setDeal?.(dealId,dealSnapshot)", context)

    def test_document_entry_reuses_existing_deal_product_and_document_owners(self) -> None:
        source = (WEB / "document-entry-connectivity-v1.js").read_text(encoding="utf-8")
        self.assertIn("/products?q=", source)
        self.assertIn("method:'PUT'", source)
        self.assertIn("product_ids", source)
        self.assertIn("/native-document", source)
        self.assertIn("/documents/online/${existing.id}", source)
        self.assertIn("latestExisting", source)
        self.assertIn("HUIDIBusinessLowInputFusion?.setDealId", source)
        self.assertIn("HUIDIBusinessDocumentReuseFusion?.setDealId", source)
        self.assertIn("const fusion=window.HUIDIBusinessLowInputFusion", source)
        self.assertIn("fusion.selectedProducts()", source)
        self.assertIn("#huidiBusinessLowInputProducts [data-hbli-product]", source)
        self.assertIn("if(!boxes.length)return true", source)
        self.assertIn("dealLoadPromise", source)
        self.assertIn("await dealLoadPromise", source)
        self.assertIn("preservedReturnTarget", source)
        self.assertIn("storedReturn", source)
        self.assertIn("isDocumentPage", source)
        self.assertIn("if(docNames[page])", source)
        self.assertIn("const prior=preservedReturnTarget||storedReturn()", source)
        self.assertIn("if(prior&&!isDocumentPage(prior))", source)
        self.assertIn("returnTarget", source)
        self.assertIn("if(workbenchRoot())", source)
        self.assertIn("url.searchParams.set('page','documents')", source)
        self.assertIn("function documentUrl(url,target)", source)
        self.assertIn("next.searchParams.set('huidi_return',target)", source)
        self.assertIn("documentUrl(url,preservedReturnTarget||target)", source)
        self.assertIn("restoreRequestedWorkbench", source)
        self.assertIn("searchParams.get('page')!=='documents'", source)
        self.assertIn("stopImmediatePropagation", source)
        self.assertIn("exactMatches", source)
        self.assertIn("matches.length===1", source)
        self.assertIn("产品参考价不会自动写入正式价格", source)
        self.assertNotIn("deal.amount =", source)
        self.assertNotIn("window.open(", source)
        self.assertNotIn("MutationObserver", source)
        self.assertNotIn("indexedDB", source)
        self.assertNotIn("localStorage", source)

    def test_authoritative_server_selection_replaces_only_provisional_auto_match(self) -> None:
        source = (WEB / "document-entry-connectivity-v1.js").read_text(encoding="utf-8")
        self.assertIn("const acceptServer=!dirty||autoMatched", source)
        self.assertIn("if(acceptServer){selected=new Set(serverSelected);dirty=false}", source)
        self.assertIn("matches.length===1", source)
        self.assertIn("dirty=true;autoMatched=true", source)
        # Explicit user edits must stop being provisional so refreshes cannot
        # silently overwrite unsaved human choices.
        self.assertGreaterEqual(source.count("dirty=true;autoMatched=false"), 2)

    def test_connector_parses(self) -> None:
        subprocess.run(
            ["node", "--check", str(WEB / "document-entry-connectivity-v1.js")],
            check=True,
            cwd=ROOT,
        )
        subprocess.run(
            ["node", "--check", str(WEB / "business-context.js")],
            check=True,
            cwd=ROOT,
        )


if __name__ == "__main__":
    unittest.main()
