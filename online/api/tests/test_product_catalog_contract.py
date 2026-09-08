from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ProductCatalogLargeDataContractTests(unittest.TestCase):
    def test_product_brain_list_keeps_legacy_contract_and_adds_opt_in_paging(self):
        text = (ROOT / "app" / "product_memory.py").read_text(encoding="utf-8")
        self.assertIn('paged: bool = False', text)
        self.assertIn('page_size: int = 50', text)
        self.assertIn('if not paged:', text)
        self.assertIn('"items": [_row_payload(x) for x in rows]', text)
        self.assertIn('ProductBrainRecord.payload_json.ilike(pattern)', text)

    def test_catalog_uses_paged_owner_with_bounded_dom_and_server_search(self):
        text = (ROOT / "web" / "catalog-studio-online.js").read_text(encoding="utf-8")
        self.assertIn("const PAGE_SIZE=50", text)
        self.assertIn("paged:'1'", text)
        self.assertIn("page_size:String(PAGE_SIZE)", text)
        self.assertIn("data-hoc-prev", text)
        self.assertIn("data-hoc-next", text)
        self.assertIn("全选本页", text)
        self.assertIn("setTimeout(()=>loadProducts(1,next),260)", text)
        self.assertNotIn("fetch('/api/product-brains')", text)

    def test_real_browser_large_data_gate_exists(self):
        smoke = ROOT / "tests" / "product_catalog_large_data_browser_smoke.py"
        self.assertTrue(smoke.exists())
        text = smoke.read_text(encoding="utf-8")
        self.assertIn("range(1, 56)", text)
        self.assertIn("len(first_api[\"items\"]) == 50", text)
        self.assertIn("len(second_api[\"items\"]) == 5", text)
        self.assertIn('"/api/product-brains" not in final_urls', text)


if __name__ == "__main__":
    unittest.main()
