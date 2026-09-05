import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.business_center import OnlineCustomer, OnlineDeal  # noqa: E402
from app.deal_reference import build_deal_reference  # noqa: E402
from app.intelligence_records import record_intelligence  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class DealReferenceTests(unittest.TestCase):
    def test_latest_connected_data_is_projected_without_rewriting_business_facts(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'deal-reference-{organization_id}.db'}"
            )
            token = set_current_organization(884001)
            try:
                db = SessionLocal()
                try:
                    customer = OnlineCustomer(company_name="Buyer GmbH", country="DE")
                    db.add(customer)
                    db.flush()
                    deal = OnlineDeal(
                        customer_id=customer.id,
                        title="Buyer GmbH · hinges",
                        stage="quoting",
                        probability=40,
                        currency="USD",
                        amount=12000,
                        product_keyword="hinges",
                        requirements="Need stainless steel hinges",
                    )
                    db.add(deal)
                    db.flush()
                    record_intelligence(
                        db,
                        "company",
                        "Buyer GmbH",
                        {"company": "Buyer GmbH"},
                        {"status": "active"},
                        deal_id=deal.id,
                    )
                    record_intelligence(
                        db,
                        "tariff",
                        "830210 · CN → DE",
                        {"hs_code": "830210"},
                        {"rate": "5%"},
                        deal_id=deal.id,
                    )
                    db.commit()

                    result = build_deal_reference(db, deal, "quotation")
                    kinds = {x["kind"] for x in result["references"]}
                    missing = {x["kind"] for x in result["missing"]}
                    self.assertEqual(kinds, {"company", "tariff"})
                    self.assertEqual(missing, {"fx"})
                    self.assertTrue(result["has_reference"])
                    self.assertIn("不会自动改写正式产品资料", result["note"])
                    self.assertEqual(deal.requirements, "Need stainless steel hinges")
                    self.assertEqual(deal.amount, 12000)
                finally:
                    db.close()
            finally:
                reset_current_organization(token)
        if old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = old_template


if __name__ == "__main__":
    unittest.main()
