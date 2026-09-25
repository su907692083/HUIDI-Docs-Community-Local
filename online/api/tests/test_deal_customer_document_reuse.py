from __future__ import annotations

import subprocess
import unittest
import uuid
from pathlib import Path

from app.daily_app import app  # noqa: F401
from app.business_center import (
    OnlineCustomer,
    OnlineCustomerAddress,
    OnlineDeal,
    OnlineDocumentRef,
    address_dict,
)
from app.document_context import build_document_context, save_document_fields
from app.main import SessionLocal


ROOT = Path(__file__).resolve().parents[1]
LOW_INPUT_JS = ROOT / "web" / "business-low-input-fusion.js"
BUSINESS_CONTEXT_JS = ROOT / "web" / "business-context.js"


class DealCustomerDocumentReuseTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        self.customer = OnlineCustomer(
            company_name=f"Reuse Buyer {suffix}",
            contact_name="Primary Buyer",
            email=f"buyer-{suffix}@example.com",
            phone="+49 30 1000",
            country="DE",
        )
        self.db.add(self.customer)
        self.db.flush()
        self.default_address = OnlineCustomerAddress(
            customer_id=self.customer.id,
            address_type="shipping",
            label="Berlin HQ",
            contact_name="Primary Buyer",
            phone="+49 30 1000",
            country="DE",
            city="Berlin",
            postal_code="10115",
            address_line1="Default Street 1",
            is_default=1,
        )
        self.alt_address = OnlineCustomerAddress(
            customer_id=self.customer.id,
            address_type="shipping",
            label="Hamburg Warehouse",
            contact_name="Warehouse Receiver",
            phone="+49 40 2000",
            country="DE",
            city="Hamburg",
            postal_code="20095",
            address_line1="Warehouse Road 9",
            is_default=0,
        )
        self.deal = OnlineDeal(
            customer_id=self.customer.id,
            title=f"Reuse Deal {suffix}",
            currency="USD",
            amount=987.65,
            product_keyword="stainless hinge",
            requirements="5000 pcs FOB Hamburg",
        )
        self.db.add_all([self.default_address, self.alt_address, self.deal])
        self.db.flush()
        self.quotation = OnlineDocumentRef(
            deal_id=self.deal.id,
            document_type="quotation",
            document_id=f"QT-{suffix}",
            state="draft",
            title=f"Quotation {suffix}",
        )
        self.db.add(self.quotation)
        self.db.commit()
        for row in [
            self.customer,
            self.default_address,
            self.alt_address,
            self.deal,
            self.quotation,
        ]:
            self.db.refresh(row)

    def tearDown(self) -> None:
        try:
            for row in [
                self.quotation,
                self.deal,
                self.alt_address,
                self.default_address,
                self.customer,
            ]:
                persistent = self.db.get(type(row), row.id)
                if persistent:
                    self.db.delete(persistent)
            self.db.commit()
        finally:
            self.db.close()

    def test_selected_customer_context_inherits_but_prices_do_not(self) -> None:
        alt = address_dict(self.alt_address)
        save_document_fields(
            self.db,
            self.quotation,
            {
                "buyer": self.customer.company_name,
                "buyer_address_id": str(self.alt_address.id),
                "buyer_address": alt["formatted"],
                "buyer_phone": self.alt_address.phone,
                "contact": self.alt_address.contact_name,
                "email": self.customer.email,
                "country": self.alt_address.country,
                "unit_price": "1.25",
                "total": "6250.00",
            },
        )

        pi_context = build_document_context(self.db, self.deal, "proforma_invoice")
        inherited = pi_context["inherited_fields"]
        self.assertEqual(inherited["buyer"], self.customer.company_name)
        self.assertEqual(inherited["buyer_address_id"], str(self.alt_address.id))
        self.assertEqual(inherited["buyer_address"], alt["formatted"])
        self.assertEqual(inherited["buyer_phone"], self.alt_address.phone)
        self.assertEqual(inherited["contact"], self.alt_address.contact_name)
        self.assertEqual(inherited["email"], self.customer.email)
        self.assertEqual(inherited["country"], "DE")
        self.assertNotIn("unit_price", inherited)
        self.assertNotIn("total", inherited)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 987.65)

        contract_context = build_document_context(self.db, self.deal, "sales_contract")
        self.assertEqual(
            contract_context["inherited_fields"]["buyer_address_id"],
            str(self.alt_address.id),
        )
        self.assertNotIn("unit_price", contract_context["inherited_fields"])
        self.assertNotIn("total", contract_context["inherited_fields"])

    def test_default_master_address_remains_safe_fallback(self) -> None:
        context = build_document_context(self.db, self.deal, "quotation")
        master = context["master_fields"]
        self.assertEqual(master["buyer_address_id"], str(self.default_address.id))
        self.assertEqual(master["buyer_phone"], self.default_address.phone)
        self.assertEqual(
            context["master_data"]["default_customer_address"]["id"],
            self.default_address.id,
        )
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 987.65)

    def test_frontend_customer_reuse_contracts(self) -> None:
        subprocess.run(["node", "--check", str(LOW_INPUT_JS)], check=True)
        subprocess.run(["node", "--check", str(BUSINESS_CONTEXT_JS)], check=True)
        low = LOW_INPUT_JS.read_text(encoding="utf-8")
        context = BUSINESS_CONTEXT_JS.read_text(encoding="utf-8")

        for marker in [
            "data-hbli-address",
            "data-hbli-contact",
            "buyer_address_id",
            "buyer_address",
            "buyer_phone",
            "seedNativeDocument",
            "/api/business/documents/",
            "/draft",
        ]:
            self.assertIn(marker, low)
        self.assertIn("native-document", context)
        self.assertIn("seedNativeDocument", context)
        self.assertIn("response.clone().json()", context)
        self.assertIn("HUIDI-BUSINESS-LOW-INPUT-3", context)
        self.assertEqual(context.count("window.fetch="), 1)
        self.assertNotIn("window.fetch=", low)

        for forbidden in [
            "localStorage",
            "indexedDB",
            "MutationObserver",
            "window.open",
            "location.href",
        ]:
            self.assertNotIn(forbidden, low)
            self.assertNotIn(forbidden, context)
        self.assertNotIn("deal.amount", low)
        self.assertNotIn("unit_price", low)
        self.assertNotIn("total", low)


if __name__ == "__main__":
    unittest.main()
