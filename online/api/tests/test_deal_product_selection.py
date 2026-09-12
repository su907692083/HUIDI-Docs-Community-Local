from __future__ import annotations

import subprocess
import unittest
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import func, select

from app.daily_app import app  # noqa: F401
from app.business_center import OnlineCustomer, OnlineDeal
from app.community_sync import CommunityDealProductLink
from app.deal_product_selection import (
    DealProductSelectionRequest,
    get_deal_products,
    set_deal_products,
)
from app.main import SessionLocal
from app.product_memory import ProductBrainRecord


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "web" / "business-low-input-fusion.js"
CONTEXT = ROOT / "web" / "business-context.js"
DAILY_APP = ROOT / "app" / "daily_app.py"
BACKEND = ROOT / "app" / "deal_product_selection.py"


class DealProductSelectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SessionLocal()
        suffix = uuid.uuid4().hex[:10]
        self.customer = OnlineCustomer(company_name=f"Low Input Buyer {suffix}")
        self.db.add(self.customer)
        self.db.flush()
        self.deal = OnlineDeal(
            customer_id=self.customer.id,
            title=f"Low Input Deal {suffix}",
            currency="USD",
            amount=321.45,
            product_keyword="legacy free text",
        )
        self.db.add(self.deal)
        self.product_a = ProductBrainRecord(
            brain_id=f"brain-a-{suffix}",
            local_product_id=f"local-a-{suffix}",
            name=f"Hinge A {suffix}",
            sku=f"HA-{suffix}",
            payload_json='{"spec":"SUS304","price":"1.25"}',
        )
        self.product_b = ProductBrainRecord(
            brain_id=f"brain-b-{suffix}",
            local_product_id=f"local-b-{suffix}",
            name=f"Hinge B {suffix}",
            sku=f"HB-{suffix}",
            payload_json='{"spec":"SUS316","reference_price":"2.50"}',
        )
        self.db.add_all([self.product_a, self.product_b])
        self.db.commit()
        self.db.refresh(self.deal)
        self.db.refresh(self.product_a)
        self.db.refresh(self.product_b)

    def tearDown(self) -> None:
        try:
            links = self.db.scalars(
                select(CommunityDealProductLink).where(
                    CommunityDealProductLink.deal_id == self.deal.id
                )
            ).all()
            for link in links:
                self.db.delete(link)
            for row in [self.product_a, self.product_b, self.deal, self.customer]:
                persistent = self.db.get(type(row), row.id)
                if persistent:
                    self.db.delete(persistent)
            self.db.commit()
        finally:
            self.db.close()

    def test_relation_update_is_idempotent_and_never_writes_amount(self) -> None:
        original_amount = self.deal.amount
        first = set_deal_products(
            self.deal.id,
            DealProductSelectionRequest(
                product_ids=[self.product_a.local_product_id, self.product_b.brain_id]
            ),
            self.db,
        )
        self.assertTrue(first["ok"])
        self.assertEqual(first["selected_count"], 2)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, original_amount)
        self.assertEqual(
            self.db.get(OnlineDeal, self.deal.id).product_keyword,
            self.product_a.name,
        )

        second = set_deal_products(
            self.deal.id,
            DealProductSelectionRequest(
                product_ids=[self.product_a.local_product_id, self.product_b.brain_id]
            ),
            self.db,
        )
        self.assertEqual(second["selected_count"], 2)
        count = int(
            self.db.scalar(
                select(func.count(CommunityDealProductLink.id)).where(
                    CommunityDealProductLink.deal_id == self.deal.id
                )
            )
            or 0
        )
        self.assertEqual(count, 2)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, original_amount)

        reduced = set_deal_products(
            self.deal.id,
            DealProductSelectionRequest(product_ids=[self.product_b.local_product_id]),
            self.db,
        )
        self.assertEqual(reduced["selected"], [self.product_b.local_product_id])
        self.assertEqual(reduced["selected_count"], 1)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, original_amount)

    def test_search_keeps_selected_rows_and_rejects_stale_product(self) -> None:
        set_deal_products(
            self.deal.id,
            DealProductSelectionRequest(product_ids=[self.product_a.local_product_id]),
            self.db,
        )
        out = get_deal_products(self.deal.id, q="no-match-token", limit=10, db=self.db)
        self.assertEqual(out["selected"], [self.product_a.local_product_id])
        self.assertEqual(out["items"][0]["id"], self.product_a.local_product_id)
        self.assertEqual(out["items"][0]["spec"], "SUS304")

        with self.assertRaises(HTTPException) as ctx:
            set_deal_products(
                self.deal.id,
                DealProductSelectionRequest(product_ids=["missing-product-id"]),
                self.db,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.db.get(OnlineDeal, self.deal.id).amount, 321.45)

    def test_frontend_and_loader_contracts(self) -> None:
        subprocess.run(["node", "--check", str(FRONTEND)], check=True)
        subprocess.run(["node", "--check", str(CONTEXT)], check=True)
        js = FRONTEND.read_text(encoding="utf-8")
        context = CONTEXT.read_text(encoding="utf-8")
        daily = DAILY_APP.read_text(encoding="utf-8")
        backend = BACKEND.read_text(encoding="utf-8")

        self.assertIn("data-hbli-product", js)
        self.assertIn("hbCurrency", js)
        self.assertIn("hbNext", js)
        self.assertIn("产品参考价不会写入询盘金额", js)
        self.assertIn("function setDealId", js)
        self.assertIn("dealAtRequest!==activeDealId", js)
        self.assertIn("dealAtSave!==activeDealId", js)
        self.assertNotIn("localStorage", js)
        self.assertNotIn("indexedDB", js)
        self.assertNotIn("MutationObserver", js)
        self.assertNotIn("window.open", js)
        self.assertNotIn("location.href", js)

        self.assertIn(
            "/assets/business-low-input-fusion.js?v=HUIDI-BUSINESS-LOW-INPUT-3",
            context,
        )
        self.assertIn("function noteBusinessDeal", context)
        self.assertIn(r"^\/api\/business\/deals\/(\d+)$".replace("\\\\", "\\"), context)
        self.assertIn("HUIDIBusinessLowInputFusion?.setDealId", context)
        self.assertIn("dealId:()=>dealId", context)
        self.assertIn("from . import deal_product_selection", daily)
        self.assertLess(
            daily.index("from . import community_sync"),
            daily.index("from . import deal_product_selection"),
        )
        self.assertIn("CommunityDealProductLink", backend)
        self.assertIn("ProductBrainRecord", backend)
        self.assertNotIn("deal.amount =", backend)


if __name__ == "__main__":
    unittest.main()
