import json
import unittest
import uuid

from app.daily_app import app
from app.development_workflow import (
    DraftContentRequest,
    ProductContextRequest,
    development_context,
    save_draft_content,
    set_product_context,
)
from app.main import Lead, LeadActivity, SessionLocal
from app.online_app import _draft_review_state
from app.product_memory import ProductBrainRecord


class DevelopmentWorkflowContractTests(unittest.TestCase):
    def test_routes_are_registered_on_the_one_daily_app(self):
        paths = {route.path for route in app.routes}
        self.assertIn("/api/leads/{lead_id}/development-context", paths)
        self.assertIn("/api/leads/{lead_id}/product-context", paths)
        self.assertIn("/api/leads/{lead_id}/draft-content", paths)
        self.assertIn("/api/leads/{lead_id}/draft", paths)
        self.assertIn("/api/leads/{lead_id}/draft-approval", paths)
        self.assertIn("/api/leads/{lead_id}/delivery-readiness", paths)
        self.assertIn("/api/leads/{lead_id}/send", paths)
        self.assertIn("/api/leads/{lead_id}/followup", paths)

    def test_context_reuses_product_and_draft_owners_and_edit_invalidates_approval(self):
        db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        try:
            lead = Lead(
                company_name=f"Development Buyer {suffix}",
                domain=f"development-{suffix}.example",
                website=f"https://development-{suffix}.example",
                country="DE",
                market_keyword="stainless steel hinge",
                buyer_type="importer",
                score=78,
                reason="verified development workflow test",
                evidence_json="[]",
                contact_name="Anna Buyer",
                contact_role="Purchasing Manager",
                contact_email=f"anna@development-{suffix}.example",
                status="qualified",
                draft_subject="Original subject",
                draft_body="Original approved body",
            )
            db.add(lead)
            db.flush()
            brain_id = f"pb_development_{suffix}"
            payload = {
                "id": brain_id,
                "brain_id": brain_id,
                "name": "Stainless Steel Hinge",
                "sku": "H-304",
                "spec": "SUS304 4 inch",
                "moq": "500 pcs",
                "lead_time": "15 days",
                "price": 1.25,
                "currency": "USD",
                "unit": "PCS",
                "target_keywords": ["stainless steel hinge", "hinge"],
            }
            db.add(
                ProductBrainRecord(
                    brain_id=brain_id,
                    local_product_id="",
                    name=payload["name"],
                    sku=payload["sku"],
                    payload_json=json.dumps(payload, ensure_ascii=False),
                )
            )
            db.add(
                LeadActivity(
                    lead_id=lead.id,
                    event_type="draft_approved",
                    title="开发信已确认",
                    detail="approved before edit",
                    payload_json="{}",
                )
            )
            db.commit()

            selected = set_product_context(lead.id, ProductContextRequest(product_brain_id=brain_id), db)
            self.assertTrue(selected["ok"])
            self.assertEqual(selected["product"]["brain_id"], brain_id)
            self.assertNotIn("price", selected["product"])
            self.assertNotIn("currency", selected["product"])

            ctx = development_context(db, lead)
            self.assertEqual(ctx["schema"], "huidi.community.development-workflow/v1")
            self.assertEqual(ctx["review_state"], "approved")
            self.assertEqual(ctx["low_input"]["product"]["brain_id"], brain_id)
            self.assertIn("mailboxes", ctx)
            self.assertIn("industry", ctx)
            self.assertIn("sender_defaults", ctx)

            out = save_draft_content(
                lead.id,
                DraftContentRequest(subject="Edited subject", body="Edited body that must be reviewed again."),
                db,
            )
            self.assertTrue(out["changed"])
            self.assertEqual(out["review_state"], "rejected")
            self.assertEqual(_draft_review_state(db, lead.id), "rejected")
            db.refresh(lead)
            self.assertEqual(lead.draft_subject, "Edited subject")
            self.assertEqual(lead.draft_body, "Edited body that must be reviewed again.")
            latest = db.query(LeadActivity).filter(LeadActivity.lead_id == lead.id).order_by(LeadActivity.id.desc()).first()
            self.assertEqual(latest.event_type, "draft_rejected")
            self.assertIn("重新确认", latest.title)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
