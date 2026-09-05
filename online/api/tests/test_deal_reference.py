import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.business_center import OnlineCustomer, OnlineDeal  # noqa: E402
from app.deal_reference import (  # noqa: E402
    DealReferenceApproval,
    build_deal_reference,
    build_document_handoff,
)
from app.intelligence_records import record_intelligence  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class DealReferenceTests(unittest.TestCase):
    def _configure(self, tmp: str) -> None:
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'deal-reference-{organization_id}.db'}"
        )

    @staticmethod
    def _deal(db, name: str = "Buyer GmbH"):
        customer = OnlineCustomer(company_name=name, country="DE")
        db.add(customer)
        db.flush()
        deal = OnlineDeal(
            customer_id=customer.id,
            title=f"{name} · hinges",
            stage="quoting",
            probability=40,
            currency="USD",
            amount=12000,
            product_keyword="hinges",
            requirements="Need stainless steel hinges",
        )
        db.add(deal)
        db.flush()
        return customer, deal

    def test_latest_connected_data_is_projected_without_rewriting_business_facts(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(884001)
            try:
                db = SessionLocal()
                try:
                    _, deal = self._deal(db)
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

    def test_reference_never_enters_document_bundle_without_human_confirmation(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(884002)
            try:
                db = SessionLocal()
                try:
                    _, deal = self._deal(db, "No Auto Fill Buyer")
                    record_intelligence(
                        db,
                        "company",
                        "No Auto Fill Buyer",
                        {"company": "No Auto Fill Buyer"},
                        {"status": "active"},
                        deal_id=deal.id,
                    )
                    db.commit()
                    out = build_document_handoff(
                        db,
                        deal,
                        "quotation",
                        confirm_reference=False,
                        approved_by="Tester",
                    )
                    self.assertTrue(out["reference_available"])
                    self.assertFalse(out["reference_included"])
                    self.assertNotIn("online_business_reference", out["bundle"])
                    self.assertEqual(db.query(DealReferenceApproval).count(), 0)
                finally:
                    db.close()
            finally:
                reset_current_organization(token)
        if old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = old_template

    def test_confirmed_reference_is_attached_only_as_reference_with_approval_record(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            self._configure(tmp)
            token = set_current_organization(884003)
            try:
                db = SessionLocal()
                try:
                    customer, deal = self._deal(db, "Confirmed Buyer")
                    record_intelligence(
                        db,
                        "tariff",
                        "830210 · CN → DE",
                        {"hs_code": "830210"},
                        {"rate": "5%"},
                        deal_id=deal.id,
                    )
                    db.commit()
                    out = build_document_handoff(
                        db,
                        deal,
                        "quotation",
                        confirm_reference=True,
                        approved_by="Alice",
                    )
                    self.assertTrue(out["reference_included"])
                    self.assertIn("online_business_reference", out["bundle"])
                    self.assertIn("reference_confirmation", out["bundle"])
                    approval = db.query(DealReferenceApproval).one()
                    self.assertEqual(approval.approved_by, "Alice")
                    self.assertEqual(approval.document_type, "quotation")
                    # Connected reference never overwrites formal business facts.
                    self.assertEqual(out["bundle"]["customer"]["company"], customer.company_name)
                    self.assertEqual(out["bundle"]["deal"]["requirements"], deal.requirements)
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
