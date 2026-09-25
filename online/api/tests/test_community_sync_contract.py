from __future__ import annotations

import re
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"


class CommunitySyncContractTests(unittest.TestCase):
    def setUp(self):
        self.source = (APP / "community_sync.py").read_text(encoding="utf-8")
        self.daily = (APP / "daily_app.py").read_text(encoding="utf-8")

    def test_sync_owner_is_loaded_by_daily_app(self):
        self.assertIn("from . import community_sync", self.daily)

    def test_reuses_existing_canonical_business_owners(self):
        for owner in ["OnlineCustomer", "OnlineDeal", "OnlineDocumentRef", "ProductBrainRecord"]:
            self.assertIn(owner, self.source)
        self.assertIn("OnlineCustomerAddress", self.source)
        self.assertIn("Depends(get_db)", self.source)

    def test_only_relation_and_archive_metadata_tables_are_added(self):
        table_names = re.findall(r'__tablename__\s*=\s*["\']([^"\']+)["\']', self.source)
        self.assertEqual(
            sorted(table_names),
            sorted(["community_deal_product_links", "community_archives"]),
        )
        forbidden = [
            "community_customers",
            "community_products",
            "community_deals",
            "community_documents",
            "online2_customers",
            "online2_deals",
        ]
        for name in forbidden:
            self.assertNotIn(name, self.source)

    def test_public_sync_routes_exist(self):
        for route in [
            "/api/community-sync/bootstrap",
            "/api/community-sync/state",
            "/api/community-sync/documents/{document_id}",
            "/api/community-sync/{entity_kind}/{entity_key}",
        ]:
            self.assertIn(route, self.source)

    def test_formal_document_types_match_published_local_chain(self):
        for doc_type in [
            "quotation",
            "proforma_invoice",
            "sales_contract",
            "commercial_invoice",
            "packing_list",
        ]:
            self.assertIn(f'"{doc_type}"', self.source)
        self.assertIn('"__community_record"', self.source)
        self.assertIn("OnlineDocumentRef", self.source)

    def test_product_price_is_reference_only_and_not_deal_amount_source(self):
        product_fn = re.search(
            r"def _save_product\(.*?\n(?=def _save_deal\()",
            self.source,
            flags=re.S,
        )
        self.assertIsNotNone(product_fn)
        block = product_fn.group(0)
        # Check executable assignment patterns instead of comments. A safety
        # comment is allowed to name the protected field it is documenting.
        self.assertNotRegex(block, r"(?:row|deal)\.amount\s*=")
        self.assertNotRegex(block, r"setattr\([^\n]*[\"']amount[\"']")
        self.assertIn("reference", block.lower())

    def test_deal_amount_requires_explicit_deal_payload(self):
        deal_fn = re.search(
            r"def _save_deal\(.*?\n(?=def _apply_archives\()",
            self.source,
            flags=re.S,
        )
        self.assertIsNotNone(deal_fn)
        block = deal_fn.group(0)
        self.assertIn('raw.get("estimated_amount")', block)
        self.assertIn('raw.get("amount")', block)
        self.assertNotIn("price_references", block)
        self.assertNotIn("ProductBrainRecord.payload_json", block)

    def test_bootstrap_is_current_tenant_projection_not_browser_global_store(self):
        self.assertIn("def build_bootstrap(db: Session)", self.source)
        self.assertNotIn("localStorage", self.source)
        self.assertNotIn("127.0.0.1", self.source)
        self.assertNotIn("demo", self.source.lower())


if __name__ == "__main__":
    unittest.main()
