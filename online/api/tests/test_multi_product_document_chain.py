from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

os.environ.setdefault("HUIDI_SECRET_KEY", "multi-product-document-test")
os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_TEAM_ACCESS", "0")

from app.daily_app import app  # noqa: E402
from app.business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef  # noqa: E402
from app.community_sync import CommunityDealProductLink  # noqa: E402
from app.document_context import build_document_context, load_document_fields  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.product_memory import ProductBrainRecord  # noqa: E402


class MultiProductDocumentChainTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app, base_url="http://127.0.0.1:8080")

    def setUp(self) -> None:
        self.db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        self.customer = OnlineCustomer(
            company_name=f"Multi Product Buyer {suffix}",
            contact_name="Buyer",
            email=f"multi-{suffix}@example.com",
            country="DE",
        )
        self.db.add(self.customer)
        self.db.flush()
        self.products: list[ProductBrainRecord] = []
        specs = ["SUS304 / 2.0 mm", "SUS316 / 2.5 mm", "SPCC / black powder coat"]
        for index, spec in enumerate(specs, start=1):
            row = ProductBrainRecord(
                brain_id=f"brain-multi-{index}-{suffix}",
                local_product_id=f"local-multi-{index}-{suffix}",
                name=f"Multi Hinge {index} {suffix}",
                sku=f"MH-{index}-{suffix}",
                payload_json=json.dumps(
                    {
                        "specification": spec,
                        "moq": f"{index * 500} pcs",
                        "lead_time": f"{20 + index} days",
                        "reference_price": f"{1 + index / 10:.2f}",
                        "packing": f"{10 * index} pcs/carton",
                        "carton_size": f"{40 + index} x 30 x 20 cm",
                        "shipping_marks": f"MARK-{index}",
                    },
                    ensure_ascii=False,
                ),
            )
            self.db.add(row)
            self.products.append(row)
        self.db.flush()
        self.deal = OnlineDeal(
            customer_id=self.customer.id,
            title=f"Multi Product Deal {suffix}",
            currency="USD",
            amount=9876.0,
            product_keyword=self.products[0].name,
            requirements="Quantity: 5000 pcs total, FOB Hamburg; mixed 3 products",
        )
        self.db.add(self.deal)
        self.db.flush()
        for row in self.products:
            self.db.add(CommunityDealProductLink(deal_id=self.deal.id, brain_id=row.brain_id))
        self.db.commit()
        self.db.refresh(self.deal)

    def tearDown(self) -> None:
        try:
            refs = self.db.scalars(
                select(OnlineDocumentRef).where(OnlineDocumentRef.deal_id == self.deal.id)
            ).all()
            for ref in refs:
                self.db.delete(ref)
            links = self.db.scalars(
                select(CommunityDealProductLink).where(CommunityDealProductLink.deal_id == self.deal.id)
            ).all()
            for link in links:
                self.db.delete(link)
            for row in [*self.products, self.deal, self.customer]:
                persistent = self.db.get(type(row), row.id)
                if persistent:
                    self.db.delete(persistent)
            self.db.commit()
        finally:
            self.db.close()

    def test_context_preserves_selected_product_order_and_does_not_assign_global_quantity(self) -> None:
        context = build_document_context(self.db, self.deal, "quotation")
        self.assertTrue(context["multi_product"]["enabled"])
        self.assertEqual(context["multi_product"]["count"], 3)
        self.assertEqual(
            [row["brain_id"] for row in context["products"]],
            [row.brain_id for row in self.products],
        )
        self.assertEqual(context["product"]["brain_id"], self.products[0].brain_id)
        self.assertIn("逐产品确认", context["multi_product"]["quantity_policy"])

        candidates = {row["id"]: row for row in context["reuse_candidates"]}
        self.assertIn("multi-product-rows", candidates)
        self.assertNotIn("product-spec", candidates)
        self.assertNotIn("product-moq", candidates)
        self.assertIn("inquiry-quantity", candidates)
        self.assertFalse(candidates["inquiry-quantity"]["seedable"])
        self.assertEqual(candidates["inquiry-quantity"]["field"], "")
        self.assertTrue(candidates["inquiry-incoterm"]["seedable"])
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 9876.0)

    def _create_document(self, document_type: str) -> dict:
        response = self.client.post(
            f"/api/business/deals/{self.deal.id}/native-document",
            json={"document_type": document_type},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_quote_to_pi_keeps_three_rows_but_strips_every_row_price(self) -> None:
        quote = self._create_document("quotation")
        quote_page = self.client.get(quote["url"])
        self.assertEqual(quote_page.status_code, 200, quote_page.text)
        page = quote_page.text
        self.assertEqual(page.count("data-item-row"), 3)
        for row in self.products:
            self.assertIn(row.name, page)
            self.assertIn(row.sku, page)
        self.assertIn("参考价 1.10", page)
        self.assertIn("参考价 1.20", page)
        self.assertIn("参考价 1.30", page)
        self.assertEqual(page.count("data-item-k='unit_price' value=''"), 3)
        self.assertNotIn("data-item-k='unit_price' value='1.10'", page)
        self.assertIn("data-k='unit_price' value=''", page)

        script = re.findall(r"<script>(.*?)</script>", page, re.S)
        self.assertTrue(script)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "native-multi.js"
            target.write_text("\n".join(script), encoding="utf-8")
            subprocess.run(["node", "--check", str(target)], check=True)

        quote_rows = []
        quantities = ["1200 pcs", "1800 pcs", "2000 pcs"]
        prices = ["1.05", "1.25", "0.95"]
        totals = ["1260.00", "2250.00", "1900.00"]
        for index, row in enumerate(self.products):
            quote_rows.append(
                {
                    "product_id": row.local_product_id,
                    "brain_id": row.brain_id,
                    "product": row.name,
                    "sku": row.sku,
                    "spec": json.loads(row.payload_json)["specification"],
                    "quantity": quantities[index],
                    "unit_price": prices[index],
                    "total": totals[index],
                    "lead_time": f"{25 + index} days",
                }
            )
        saved = self.client.put(
            f"/api/business/documents/{quote['id']}/draft",
            json={
                "fields": {
                    "buyer": self.customer.company_name,
                    "incoterm": "FOB Hamburg",
                    "currency": "USD",
                    "items_json": json.dumps(quote_rows, ensure_ascii=False),
                }
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        stored = json.loads(saved.json()["fields"]["items_json"])
        self.assertEqual([row["unit_price"] for row in stored], prices)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 9876.0)

        pi = self._create_document("proforma_invoice")
        pi_context = self.client.get(
            f"/api/business/deals/{self.deal.id}/document-context",
            params={"document": "proforma_invoice", "current_ref_id": pi["id"]},
        )
        self.assertEqual(pi_context.status_code, 200, pi_context.text)
        context = pi_context.json()
        inherited_rows = json.loads(context["inherited_fields"]["items_json"])
        self.assertEqual(len(inherited_rows), 3)
        self.assertEqual([row["quantity"] for row in inherited_rows], quantities)
        self.assertEqual([row["spec"] for row in inherited_rows], [json.loads(x.payload_json)["specification"] for x in self.products])
        for row in inherited_rows:
            self.assertNotIn("unit_price", row)
            self.assertNotIn("total", row)
        upstream = next(x for x in context["price_references"] if x.get("source") == "upstream_document")
        self.assertEqual(upstream["item_price_count"], 3)

        pi_page = self.client.get(pi["url"])
        self.assertEqual(pi_page.status_code, 200, pi_page.text)
        self.assertEqual(pi_page.text.count("data-item-row"), 3)
        for quantity in quantities:
            self.assertIn(f"data-item-k='quantity' value='{quantity}'", pi_page.text)
        self.assertEqual(pi_page.text.count("data-item-k='unit_price' value=''"), 3)
        for price in prices:
            self.assertNotIn(f"data-item-k='unit_price' value='{price}'", pi_page.text)
        self.assertIn("3 行逐项价格", pi_page.text)
        self.assertEqual(self.client.get(f"/api/business/deals/{self.deal.id}").json()["amount"], 9876.0)

    def test_packing_list_uses_product_rows_without_guessing_execution_totals(self) -> None:
        packing = self._create_document("packing_list")
        page = self.client.get(packing["url"])
        self.assertEqual(page.status_code, 200, page.text)
        self.assertEqual(page.text.count("data-item-row"), 3)
        for index, row in enumerate(self.products, start=1):
            self.assertIn(row.name, page.text)
            self.assertIn(f"placeholder='{40 + index} x 30 x 20 cm'", page.text)
            self.assertIn(f"placeholder='MARK-{index}'", page.text)
        self.assertEqual(page.text.count("data-item-k='packages' value=''"), 3)
        self.assertEqual(page.text.count("data-item-k='net_weight' value=''"), 3)
        self.assertEqual(page.text.count("data-item-k='gross_weight' value=''"), 3)
        self.assertEqual(page.text.count("data-item-k='volume' value=''"), 3)
        self.assertIn("总包装件数", page.text)
        self.assertIn("总体积", page.text)
        self.assertIn("系统不会从产品资料猜算", page.text)

    def test_reuse_patch_cannot_modify_multi_product_detail_blob(self) -> None:
        quote = self._create_document("quotation")
        response = self.client.patch(
            f"/api/business/documents/{quote['id']}/draft",
            json={"fields": {"items_json": "[]"}},
        )
        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn("多产品逐行明细", response.json()["detail"])
        self.assertEqual(load_document_fields(self.db, int(quote["id"])).get("items_json", ""), "")
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 9876.0)


if __name__ == "__main__":
    unittest.main()
