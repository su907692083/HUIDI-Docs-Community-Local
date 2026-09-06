import subprocess
import unittest
from pathlib import Path

from app.daily_app import app
from app.low_input_workflow import extract_reply_facts

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
