import json
import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.business_center import OnlineCustomer, OnlineDeal  # noqa: E402
from app.deal_reference import build_deal_facts  # noqa: E402
from app.intelligence_normalizer import NORMALIZED_SCHEMA, normalize_intelligence  # noqa: E402
from app.intelligence_records import (  # noqa: E402
    OnlineIntelligenceProjection,
    intelligence_dict,
    record_intelligence,
)
from app.main import SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class IntelligenceNormalizationTests(unittest.TestCase):
    def test_company_fields_are_extracted_without_inventing_missing_values(self):
        out = normalize_intelligence(
            "company",
            {"company": "Buyer GmbH", "country": "DE"},
            {
                "legalName": "Buyer GmbH",
                "registrationStatus": "ACTIVE",
                "companyNumber": "HRB-12345",
                "registeredAddress": "Hamburg, Germany",
            },
        )
        self.assertEqual(out["schema"], NORMALIZED_SCHEMA)
        self.assertEqual(out["facts"]["legal_name"], "Buyer GmbH")
        self.assertEqual(out["facts"]["status"], "ACTIVE")
        self.assertEqual(out["facts"]["registration_number"], "HRB-12345")
        self.assertNotIn("employee_count", out["facts"])
        self.assertTrue(out["has_business_facts"])

    def test_tariff_and_fx_keep_provider_values_as_reference_not_calculated_facts(self):
        tariff = normalize_intelligence(
            "tariff",
            {"hs_code": "830210", "origin": "CN", "destination": "DE"},
            {"hsCode": "830210", "dutyRate": "5%", "vatRate": "19%"},
        )
        fx = normalize_intelligence(
            "fx",
            {"base": "USD", "quote": "EUR", "amount": 100},
            {"base": "USD", "quote": "EUR", "rate": 0.91, "converted": 91, "date": "2026-09-05"},
        )
        self.assertEqual(tariff["facts"]["import_duty_rate"], "5%")
        self.assertEqual(tariff["facts"]["vat_rate"], "19%")
        self.assertEqual(fx["facts"]["rate"], 0.91)
        self.assertEqual(fx["facts"]["converted"], 91)

    def test_unknown_provider_shape_is_preserved_as_raw_but_not_fabricated_into_facts(self):
        out = normalize_intelligence("company", {"company": "Buyer"}, {"opaque": {"vendorThing": "abc"}})
        self.assertEqual(out["facts"], {})
        self.assertFalse(out["has_business_facts"])
        self.assertIn("暂未识别", out["summary"])

    def test_projection_is_persisted_and_deal_snapshot_uses_only_normalized_fields(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'normalized-{organization_id}.db'}"
            )
            token = set_current_organization(895001)
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
                    company_record = record_intelligence(
                        db,
                        "company",
                        "Buyer GmbH",
                        {"company": "Buyer GmbH"},
                        {"legalName": "Buyer GmbH", "registrationStatus": "ACTIVE"},
                        deal_id=deal.id,
                    )
                    record_intelligence(
                        db,
                        "tariff",
                        "830210 · CN → DE",
                        {"hs_code": "830210", "origin": "CN", "destination": "DE"},
                        {"hsCode": "830210", "dutyRate": "5%", "vatRate": "19%"},
                        deal_id=deal.id,
                    )
                    record_intelligence(
                        db,
                        "fx",
                        "USD → EUR",
                        {"base": "USD", "quote": "EUR", "amount": 100},
                        {"base": "USD", "quote": "EUR", "rate": 0.91, "date": "2026-09-05"},
                        deal_id=deal.id,
                    )
                    db.commit()

                    projection = db.query(OnlineIntelligenceProjection).filter_by(record_id=company_record.id).one()
                    normalized = json.loads(projection.normalized_json)
                    self.assertEqual(normalized["facts"]["legal_name"], "Buyer GmbH")
                    payload = intelligence_dict(company_record, db)
                    self.assertEqual(payload["normalized"]["schema"], NORMALIZED_SCHEMA)

                    facts = build_deal_facts(db, deal, "quotation")
                    self.assertEqual(facts["company"]["status"], "ACTIVE")
                    self.assertEqual(facts["pricing_reference"]["hs_code"], "830210")
                    self.assertEqual(facts["pricing_reference"]["import_duty_rate"], "5%")
                    self.assertEqual(facts["pricing_reference"]["fx_rate"], 0.91)
                    self.assertEqual(facts["missing"], [])
                    self.assertEqual(deal.amount, 12000)
                    self.assertEqual(deal.requirements, "Need stainless steel hinges")
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
