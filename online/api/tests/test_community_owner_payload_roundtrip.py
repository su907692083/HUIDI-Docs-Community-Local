from __future__ import annotations

import os
import tempfile
import unittest

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-community-owner-payload-secret")

from app.business_center import OnlineCustomer, OnlineDeal  # noqa: E402
from app.community_sync import _save_customer, _save_deal, build_bootstrap  # noqa: E402
from app.main import Base  # noqa: E402
from app.schema_migrations import upgrade_schema  # noqa: E402


class CommunityOwnerPayloadRoundTripTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(prefix="huidi-community-owner-", suffix=".db", delete=False)
        handle.close()
        self.path = handle.name
        self.engine = create_engine(f"sqlite:///{self.path}", connect_args={"check_same_thread": False})
        upgrade_schema(self.engine, Base.metadata)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)

    def tearDown(self):
        self.engine.dispose()
        try:
            os.unlink(self.path)
        except OSError:
            pass

    def test_full_local_customer_and_deal_fields_round_trip_without_second_owner(self):
        columns = {x["name"] for x in inspect(self.engine).get_columns("online_customers")}
        self.assertIn("payload_json", columns)
        self.assertIn("local_customer_id", columns)
        self.assertIn("payload_json", {x["name"] for x in inspect(self.engine).get_columns("online_deals")})

        customer_raw = {
            "id": "local-customer-001",
            "company": "Payload Buyer GmbH",
            "contact": "Anna Buyer",
            "email": "anna.payload@example.test",
            "phone": "+49 30 123456",
            "country": "DE",
            "country_code": "DE",
            "website": "https://buyer.example.test",
            "address": "Berlin office",
            "tax_id": "DE-TAX-001",
            "vat": "DE123456789",
            "eori": "DE-EORI-001",
            "registration_no": "HRB-001",
            "preferred_language": "de",
            "tags": ["重点", "展会"],
            "followup_date": "2026-09-20",
            "bill_to": "Billing Address Payload",
            "ship_to": "Shipping Address Payload",
            "consignee_name": "Payload Consignee",
            "consignee_contact": "Ms C",
            "consignee_phone": "+49 30 8888",
            "notify_name": "Payload Notify",
            "notify_email": "notify@example.test",
            "destination_port": "Hamburg",
            "notes": "keep full Local customer payload",
        }
        deal_raw = {
            "id": "local-deal-001",
            "customer_id": "local-customer-001",
            "title": "Payload Inquiry",
            "stage": "new_inquiry",
            "currency": "EUR",
            "estimated_amount": 0,
            "incoterm": "FOB",
            "payment_terms": "30% deposit, 70% before shipment",
            "events": [
                {"type": "note", "at": "2026-09-07T10:00:00Z", "text": "customer asked for sample"}
            ],
            "document_ids": ["legacy-local-doc-001"],
            "custom_business_field": "must-survive-roundtrip",
            "product_ids": [],
        }

        with self.Session() as db:
            customer_ids: dict[str, int] = {}
            customer = _save_customer(db, customer_raw, customer_ids)
            deal = _save_deal(db, deal_raw, customer_ids, {})
            db.commit()
            self.assertIsInstance(customer, OnlineCustomer)
            self.assertIsInstance(deal, OnlineDeal)

            bootstrap = build_bootstrap(db)
            returned_customer = next(x for x in bootstrap["customers"] if x["company"] == "Payload Buyer GmbH")
            returned_deal = next(x for x in bootstrap["deals"] if x["title"] == "Payload Inquiry")

            self.assertTrue(str(returned_customer["id"]).isdigit())
            self.assertEqual(returned_customer["local_customer_id"], "local-customer-001")
            self.assertEqual(returned_customer["vat"], "DE123456789")
            self.assertEqual(returned_customer["eori"], "DE-EORI-001")
            self.assertEqual(returned_customer["tax_id"], "DE-TAX-001")
            self.assertEqual(returned_customer["bill_to"], "Billing Address Payload")
            self.assertEqual(returned_customer["ship_to"], "Shipping Address Payload")
            self.assertEqual(returned_customer["consignee_name"], "Payload Consignee")
            self.assertEqual(returned_customer["notify_name"], "Payload Notify")
            self.assertEqual(returned_customer["destination_port"], "Hamburg")
            self.assertEqual(returned_customer["tags"], ["重点", "展会"])

            self.assertTrue(str(returned_deal["id"]).isdigit())
            self.assertEqual(returned_deal["local_deal_id"], "local-deal-001")
            self.assertEqual(returned_deal["incoterm"], "FOB")
            self.assertEqual(returned_deal["payment_terms"], "30% deposit, 70% before shipment")
            self.assertEqual(returned_deal["document_ids"], ["legacy-local-doc-001"])
            self.assertEqual(returned_deal["events"][0]["text"], "customer asked for sample")
            self.assertEqual(returned_deal["custom_business_field"], "must-survive-roundtrip")
            self.assertEqual(returned_deal["amount"], 0)

            # A cloud-hydrated canonical numeric id must not erase the stable
            # Local bridge id or the Local-only fields on the next save.
            resaved = dict(returned_customer)
            resaved["notes"] = "updated through canonical cloud id"
            customer_ids = {}
            same_customer = _save_customer(db, resaved, customer_ids)
            db.commit()
            self.assertEqual(same_customer.id, customer.id)
            after = next(x for x in build_bootstrap(db)["customers"] if x["id"] == str(customer.id))
            self.assertEqual(after["local_customer_id"], "local-customer-001")
            self.assertEqual(after["vat"], "DE123456789")
            self.assertEqual(after["notes"], "updated through canonical cloud id")

        tables = set(inspect(self.engine).get_table_names())
        self.assertNotIn("community_customers", tables)
        self.assertNotIn("community_deals", tables)
        self.assertNotIn("community_documents", tables)


if __name__ == "__main__":
    unittest.main()
