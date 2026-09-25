from __future__ import annotations

import unittest
from pathlib import Path

from app.product_fact_projection import project_non_price_product_facts


ROOT = Path(__file__).resolve().parents[1]


class ProductFactProjectionContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.projection = (ROOT / "app" / "product_fact_projection.py").read_text(encoding="utf-8")
        self.development = (ROOT / "app" / "development_workflow.py").read_text(encoding="utf-8")
        self.deal_products = (ROOT / "app" / "deal_product_selection.py").read_text(encoding="utf-8")

    def test_projection_covers_high_value_npi_facts_without_becoming_bom_owner(self) -> None:
        facts = project_non_price_product_facts({
            "brain_id": "P-1",
            "name": "Stainless Hinge",
            "sku": "H-01",
            "spec": "100x75 mm SUS304",
            "material": "SUS304",
            "moq": "1000 PCS",
            "lead_time": "25 days",
            "certifications": ["RoHS"],
            "hs_code": "830210",
            "country_of_origin": "CN",
            "package_type": "inner box + carton",
            "carton_size": "42x30x25 cm",
            "qty_per_carton": "50 PCS",
            "cbm": "0.0315",
            "gross_weight": "18 kg",
            "differentiators": ["salt-spray tested"],
        })
        self.assertEqual(facts["identity"]["sku"], "H-01")
        self.assertEqual(facts["technical"]["material"], "SUS304")
        self.assertEqual(facts["compliance"]["hs_code"], "830210")
        self.assertEqual(facts["packaging"]["qty_per_carton"], "50 PCS")
        self.assertIn("RoHS", facts["compliance"]["certifications"])
        self.assertFalse(facts["guardrails"]["new_product_owner"])
        self.assertFalse(facts["guardrails"]["bom_owner"])

    def test_reference_and_embedded_prices_are_excluded(self) -> None:
        facts = project_non_price_product_facts({
            "name": "Tool Set",
            "price": 2.8,
            "price_range": "USD 2.8-3.2",
            "currency": "USD",
            "spec": "12 pcs; reference price USD 3.20",
            "allowed_claims": ["MOQ 1000", "quote price: $2.90 FOB"],
        })
        text = str(facts)
        self.assertNotIn("3.20", text)
        self.assertNotIn("2.90", text)
        self.assertNotIn("2.8-3.2", text)
        self.assertIn("价格已隔离", text)
        self.assertTrue(facts["guardrails"]["reference_price_excluded"])
        self.assertTrue(facts["guardrails"]["formal_price_excluded"])
        self.assertTrue(facts["guardrails"]["free_text_price_fragments_isolated"])

    def test_development_and_deal_selection_reuse_same_projection(self) -> None:
        self.assertIn("project_non_price_product_facts", self.development)
        self.assertIn('"non_price_facts"', self.development)
        self.assertIn('"product_non_price_facts"', self.development)
        self.assertIn("project_non_price_product_facts", self.deal_products)
        self.assertIn('"non_price_facts"', self.deal_products)
        self.assertIn("产品参考价不会写入询盘金额或正式单据价格", self.deal_products)

    def test_projection_has_no_persistence_or_formal_document_owner(self) -> None:
        for forbidden in (
            "__tablename__",
            "mapped_column(",
            "db.commit(",
            "db.add(",
            "OnlineDocumentRef",
            "OnlineDeal.amount",
        ):
            self.assertNotIn(forbidden, self.projection)


if __name__ == "__main__":
    unittest.main()
