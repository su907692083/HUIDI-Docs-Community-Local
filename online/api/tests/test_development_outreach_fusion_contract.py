from __future__ import annotations

import json
import uuid
import unittest

from app.daily_app import app
from app import development_outreach_fusion as fusion
from app import development_workflow as workflow_owner
from app import main as main_owner
from app.main import Lead, LeadActivity, LeadAssessment, SessionLocal
from app.product_memory import ProductBrainRecord


class DevelopmentOutreachFusionContractTests(unittest.TestCase):
    def test_existing_owners_receive_grounded_non_price_context(self):
        paths = [route.path for route in app.routes]
        self.assertEqual(paths.count("/api/leads/{lead_id}/development-context"), 1)
        self.assertIn("/api/leads/{lead_id}/draft", paths)
        self.assertIn("/api/leads/{lead_id}/send", paths)

        db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        try:
            lead = Lead(
                company_name=f"Grounded Buyer {suffix}",
                domain=f"grounded-{suffix}.example",
                website=f"https://grounded-{suffix}.example",
                country="DE",
                market_keyword="stainless steel hinge",
                buyer_type="importer",
                score=82,
                reason="public sourcing evidence",
                evidence_json=json.dumps([{
                    "source": "online_company_search",
                    "provider": "serper",
                    "title": "Grounded Buyer product page",
                    "url": f"https://grounded-{suffix}.example/products",
                    "snippet": "Public product page mentions industrial hardware sourcing.",
                }]),
                contact_name="Anna Buyer",
                contact_role="Purchasing Manager",
                contact_email=f"anna@grounded-{suffix}.example",
                status="qualified",
            )
            db.add(lead)
            db.flush()

            brain_id = f"pb_outreach_{suffix}"
            payload = {
                "brain_id": brain_id,
                "name": "Stainless Steel Hinge",
                "sku": "H-304",
                "spec": "SUS304 4 inch",
                "moq": "500 pcs",
                "lead_time": "15 days",
                "price": 1.25,
                "currency": "USD",
                "reference_price": "1.25",
            }
            db.add(ProductBrainRecord(
                brain_id=brain_id,
                local_product_id="",
                name=payload["name"],
                sku=payload["sku"],
                payload_json=json.dumps(payload),
            ))
            db.add(LeadActivity(
                lead_id=lead.id,
                event_type="product_context_selected",
                title="product selected",
                detail=payload["name"],
                payload_json=json.dumps({"product_brain_id": brain_id, "product_name": payload["name"]}),
            ))
            db.add(LeadAssessment(
                lead_id=lead.id,
                confidence=81,
                readiness="ready_to_contact",
                basic_score=90,
                company_score=82,
                contact_score=80,
                digital_score=75,
                trade_score=0,
                fit_score=82,
                report_json=json.dumps({
                    "positives": ["public domain found", "public sourcing evidence retained"],
                    "gaps": ["official registry not verified"],
                }),
            ))
            db.commit()
            db.refresh(lead)

            ctx = workflow_owner.development_context(db, lead)
            variables = ctx["outreach_variables"]
            self.assertEqual(variables["schema"], fusion.SCHEMA)
            self.assertEqual(variables["product"]["brain_id"], brain_id)
            self.assertNotIn("price", variables["product"])
            self.assertNotIn("currency", variables["product"])
            self.assertNotIn("reference_price", variables["product"])
            self.assertEqual(variables["assessment"]["readiness"], "ready_to_contact")
            self.assertTrue(variables["evidence"])
            self.assertTrue(variables["safety"]["formal_price_excluded"])
            self.assertTrue(variables["safety"]["human_review_required"])
            self.assertFalse(variables["safety"]["automatic_send"])

            req = main_owner.DraftRequest(product_summary="hinge for industrial cabinets")
            summary = fusion._grounded_generation_summary(db, lead, req)
            self.assertIn("Saved seller product facts", summary)
            self.assertIn("Public evidence for cautious personalization", summary)
            self.assertIn("Known verification gaps", summary)
            self.assertNotIn("USD 1.25", summary)
            self.assertNotIn("reference_price", summary)
            self.assertNotIn("confidence=81", summary)
        finally:
            db.close()

    def test_patch_preserves_human_send_owner(self):
        self.assertIs(workflow_owner.development_context, fusion._development_context)
        self.assertIs(main_owner.llm_draft, fusion._llm_draft)
        source = open(fusion.__file__, "r", encoding="utf-8").read()
        self.assertNotIn('@app.post("/api/leads/{lead_id}/send")', source)
        self.assertNotIn("MailDeliveryLog(", source)
        self.assertNotIn("mapped_column(", source)
        self.assertIn('"human_review_required": True', source)
        self.assertIn('"automatic_send": False', source)


if __name__ == "__main__":
    unittest.main()
