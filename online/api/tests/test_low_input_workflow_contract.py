import json
import subprocess
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.daily_app import app
from app.low_input_workflow import PrepareInquiryRequest, extract_reply_facts, prepare_inquiry
from app.mail_sync import MailboxMessage
from app.main import Lead, SessionLocal
from app.product_memory import ProductBrainRecord

ROOT = Path(__file__).resolve().parents[1]


class LowInputWorkflowContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_low_input_routes_are_registered(self):
        paths = {route.path for route in app.routes}
        self.assertIn("/api/leads/{lead_id}/low-input", paths)
        self.assertIn("/api/leads/{lead_id}/low-input/prepare-inquiry", paths)

    def test_reply_extraction_is_explicit_and_conservative(self):
        out = extract_reply_facts(
            "RFQ for hinges",
            "Please quote 5,000 pcs, FOB Ningbo. Material should be SUS304. We also need samples before production.",
        )
        facts = {x["key"]: x["value"] for x in out["facts"]}
        self.assertIn("quantity", facts)
        self.assertIn("5,000 pcs", facts["quantity"])
        self.assertEqual(facts.get("incoterm"), "FOB")
        self.assertIn("specification", facts)
        self.assertIn("sample", facts)
        self.assertNotIn("target_price", facts)

    def test_prepare_inquiry_reuses_real_records_and_does_not_set_amount(self):
        db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        try:
            lead = Lead(
                company_name=f"Low Input Buyer {suffix}",
                domain=f"low-input-{suffix}.example",
                website=f"https://low-input-{suffix}.example",
                country="DE",
                market_keyword="stainless steel hinge",
                buyer_type="importer",
                score=76,
                reason="matched public buyer evidence",
                evidence_json="[]",
                contact_name="Anna Buyer",
                contact_role="Purchasing Manager",
                contact_email=f"anna@low-input-{suffix}.example",
                status="replied",
            )
            db.add(lead)
            db.flush()
            brain_id = f"pb_low_input_{suffix}"
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
                "differentiators": ["custom sizes", "SUS304"],
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
            db.flush()
            db.add(
                MailboxMessage(
                    mailbox_id=987654,
                    provider_message_id=f"reply-{suffix}",
                    thread_id=f"thread-{suffix}",
                    internet_message_id=f"<{suffix}@example>",
                    direction="incoming",
                    folder="inbox",
                    sender=lead.contact_email,
                    recipients_json="[]",
                    subject="RFQ stainless hinge",
                    snippet="Please quote 5,000 pcs FOB Ningbo. Material SUS304, size 4 inch. Samples required.",
                    received_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    lead_id=lead.id,
                    has_unsubscribe=0,
                )
            )
            db.commit()
            out = prepare_inquiry(
                lead.id,
                PrepareInquiryRequest(confirm=True, product_brain_id=brain_id, include_reply=True),
                db,
            )
            self.assertTrue(out["ok"])
            self.assertEqual(out["product"]["brain_id"], brain_id)
            self.assertEqual(float(out["deal"]["amount"]), 0.0)
            self.assertEqual(out["deal"]["stage"], "qualified")
            self.assertIn("5,000 pcs", out["deal"]["requirements"])
            self.assertIn("FOB", out["deal"]["requirements"])
            self.assertIn("Stainless Steel Hinge", out["deal"]["requirements"])
            db.refresh(lead)
            self.assertEqual(lead.status, "converted")
        finally:
            db.close()

    def test_backend_reuses_existing_product_mail_and_business_owners(self):
        source = self.text("app/low_input_workflow.py")
        for marker in [
            "ProductBrainRecord",
            "MailboxMessage",
            "upsert_from_lead",
            "product_context_selected",
            "low_input_inquiry_prepared",
        ]:
            self.assertIn(marker, source)
        self.assertNotIn("__tablename__", source)
        self.assertNotIn("deal.amount =", source)
        self.assertIn("未自动写入正式价格或金额", source)
        self.assertIn("不会自动改正式价格、合同或装箱事实", source)

    def test_browser_owner_is_loaded_and_parses(self):
        index = self.text("web/index.html")
        self.assertIn('/assets/low-input-flow.js', index)
        result = subprocess.run(
            ["node", "--check", str(ROOT / "web/low-input-flow.js")],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_browser_reduces_reentry_but_keeps_confirmation(self):
        source = self.text("web/low-input-flow.js")
        for marker in [
            "自动带入",
            "确认要点并转询盘",
            "4天后提醒",
            "productSummary",
            "summaryEdited",
            "/low-input/prepare-inquiry",
            "confirm(message)",
            "不会自动填写正式价格或成交金额",
        ]:
            self.assertIn(marker, source)

    def test_manual_product_summary_is_not_silently_overwritten(self):
        source = self.text("web/low-input-flow.js")
        self.assertIn("!summaryEdited", source)
        self.assertIn("e.isTrusted", source)
        self.assertIn("dataset.autoProduct", source)

    def test_low_input_observer_is_scoped_to_customer_drawer(self):
        source = self.text("web/low-input-flow.js")
        self.assertIn("mo.observe(back,{attributes:true,attributeFilter:['class']})", source)
        self.assertNotIn("mo.observe(document.body", source)


if __name__ == "__main__":
    unittest.main()
