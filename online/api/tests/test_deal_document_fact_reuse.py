from __future__ import annotations

import subprocess
import unittest
import uuid
from pathlib import Path

from fastapi import HTTPException

from app.daily_app import app  # noqa: F401
from app.business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef
from app.document_context import (
    DocumentDraftRequest,
    build_document_context,
    load_document_fields,
    patch_document_draft,
    save_document_fields,
)
from app.main import SessionLocal
from app.product_memory import ProductBrainRecord


ROOT = Path(__file__).resolve().parents[1]
REUSE_JS = ROOT / "web" / "business-document-reuse-fusion.js"
CONTEXT_JS = ROOT / "web" / "business-context.js"


class DealDocumentFactReuseTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        self.customer = OnlineCustomer(
            company_name=f"Fact Reuse Buyer {suffix}",
            contact_name="Buyer",
            email=f"fact-{suffix}@example.com",
            country="DE",
        )
        self.db.add(self.customer)
        self.db.flush()
        self.product = ProductBrainRecord(
            brain_id=f"brain-fact-{suffix}",
            local_product_id=f"local-fact-{suffix}",
            name=f"Reusable Hinge {suffix}",
            sku=f"RH-{suffix}",
            payload_json=(
                '{"specification":"SUS304 / 2.0 mm","moq":"1000 pcs",'
                '"lead_time":"30 days","carton_size":"42 x 30 x 18 cm",'
                '"shipping_marks":"HUIDI / DE","packing":"1 pc/polybag, 20 pcs/carton",'
                '"reference_price":"1.25"}'
            ),
        )
        self.db.add(self.product)
        self.db.flush()
        self.deal = OnlineDeal(
            customer_id=self.customer.id,
            title=f"Fact Reuse Deal {suffix}",
            currency="USD",
            amount=4321.0,
            product_keyword=self.product.name,
            requirements="QTY: 5000 pcs; FOB Hamburg; private label required",
        )
        self.db.add(self.deal)
        self.db.flush()
        self.quotation = OnlineDocumentRef(
            deal_id=self.deal.id,
            document_type="quotation",
            document_id=f"QT-FACT-{suffix}",
            state="draft",
            title=f"Fact Reuse Quotation {suffix}",
        )
        self.db.add(self.quotation)
        self.db.commit()
        for row in [self.customer, self.product, self.deal, self.quotation]:
            self.db.refresh(row)

    def tearDown(self) -> None:
        try:
            for row in [self.quotation, self.deal, self.product, self.customer]:
                persistent = self.db.get(type(row), row.id)
                if persistent:
                    self.db.delete(persistent)
            self.db.commit()
        finally:
            self.db.close()

    def test_reuse_candidates_are_source_aware_and_price_free(self) -> None:
        context = build_document_context(self.db, self.deal, "quotation")
        rows = {row["id"]: row for row in context["reuse_candidates"]}

        self.assertEqual(rows["product-spec"]["value"], "SUS304 / 2.0 mm")
        self.assertTrue(rows["product-spec"]["default_selected"])
        self.assertFalse(rows["product-spec"]["confirmation_required"])
        self.assertEqual(rows["product-spec"]["source_label"], "产品资料")

        self.assertEqual(rows["product-moq"]["value"], "1000 pcs")
        self.assertTrue(rows["product-moq"]["default_selected"])
        self.assertEqual(rows["inquiry-quantity"]["value"], "5000 pcs")
        self.assertTrue(rows["inquiry-quantity"]["confirmation_required"])
        self.assertFalse(rows["inquiry-quantity"]["default_selected"])
        self.assertTrue(rows["inquiry-incoterm"]["value"].startswith("FOB Hamburg"))
        self.assertTrue(rows["product-lead-time"]["confirmation_required"])

        self.assertEqual(rows["product-carton-size"]["applies_to"], ["packing_list"])
        self.assertEqual(rows["product-marks"]["applies_to"], ["packing_list"])
        self.assertFalse(rows["product-packing-reference"]["seedable"])

        fields = {row.get("field") for row in context["reuse_candidates"]}
        self.assertNotIn("unit_price", fields)
        self.assertNotIn("total", fields)
        self.assertIn("unit_price", context["reuse_policy"]["never_auto_fields"])
        self.assertIn("total", context["reuse_policy"]["never_auto_fields"])
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 4321.0)

    def test_patch_prefill_merges_non_price_fields_and_preserves_manual_prices(self) -> None:
        save_document_fields(
            self.db,
            self.quotation,
            {
                "buyer": self.customer.company_name,
                "unit_price": "1.18",
                "total": "5900.00",
            },
        )
        out = patch_document_draft(
            self.quotation.id,
            DocumentDraftRequest(
                fields={
                    "spec": "SUS304 / 2.0 mm",
                    "quantity": "5000 pcs",
                    "incoterm": "FOB Hamburg",
                }
            ),
            self.db,
        )
        self.assertTrue(out["ok"])
        saved = load_document_fields(self.db, self.quotation.id)
        self.assertEqual(saved["buyer"], self.customer.company_name)
        self.assertEqual(saved["spec"], "SUS304 / 2.0 mm")
        self.assertEqual(saved["quantity"], "5000 pcs")
        self.assertEqual(saved["incoterm"], "FOB Hamburg")
        self.assertEqual(saved["unit_price"], "1.18")
        self.assertEqual(saved["total"], "5900.00")
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 4321.0)

        with self.assertRaises(HTTPException) as ctx:
            patch_document_draft(
                self.quotation.id,
                DocumentDraftRequest(fields={"unit_price": "0.99"}),
                self.db,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(load_document_fields(self.db, self.quotation.id)["unit_price"], "1.18")
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 4321.0)

    def test_saved_upstream_fields_remove_duplicate_candidates(self) -> None:
        save_document_fields(
            self.db,
            self.quotation,
            {
                "spec": "Confirmed SUS304",
                "moq": "1200 pcs",
                "lead_time": "28 days",
                "quantity": "5000 pcs",
                "incoterm": "FOB Hamburg",
                "unit_price": "1.18",
                "total": "5900.00",
            },
        )
        context = build_document_context(self.db, self.deal, "proforma_invoice")
        inherited = context["inherited_fields"]
        self.assertEqual(inherited["spec"], "Confirmed SUS304")
        self.assertEqual(inherited["quantity"], "5000 pcs")
        self.assertEqual(inherited["incoterm"], "FOB Hamburg")
        self.assertNotIn("unit_price", inherited)
        self.assertNotIn("total", inherited)
        candidate_fields = {row.get("field") for row in context["reuse_candidates"]}
        for field in ["spec", "moq", "lead_time", "quantity", "incoterm"]:
            self.assertNotIn(field, candidate_fields)

    def test_frontend_reuse_is_inline_and_uses_existing_fetch_owner(self) -> None:
        subprocess.run(["node", "--check", str(REUSE_JS)], check=True)
        subprocess.run(["node", "--check", str(CONTEXT_JS)], check=True)
        reuse = REUSE_JS.read_text(encoding="utf-8")
        context = CONTEXT_JS.read_text(encoding="utf-8")

        for marker in [
            "data-hbdr-candidate",
            "reuse_candidates",
            "confirmation_required",
            "method:'PATCH'",
            "seedNativeDocument",
            "正式价格不在这里复用",
        ]:
            self.assertIn(marker, reuse)
        self.assertIn("business-document-reuse-fusion.js?v=HUIDI-BUSINESS-DOCUMENT-REUSE-1", context)
        self.assertIn("HUIDIBusinessDocumentReuseFusion?.seedNativeDocument", context)
        self.assertLess(
            context.index("HUIDIBusinessLowInputFusion?.seedNativeDocument"),
            context.index("HUIDIBusinessDocumentReuseFusion?.seedNativeDocument"),
        )
        self.assertEqual(context.count("window.fetch="), 1)
        self.assertNotIn("window.fetch=", reuse)
        for forbidden in ["localStorage", "indexedDB", "MutationObserver", "window.open", "location.href"]:
            self.assertNotIn(forbidden, reuse)
        self.assertNotIn("unit_price", reuse)
        self.assertNotIn("total", reuse)
        self.assertNotIn("deal.amount", reuse)


if __name__ == "__main__":
    unittest.main()
