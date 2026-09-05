import unittest
from uuid import uuid4

from sqlalchemy import select

from app.daily_app import app  # noqa: F401
from app.main import SessionLocal
from app.product_memory import ProductBrainRecord, _upsert


class ProductMemoryTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.brain_id = f"pb-{uuid4().hex[:12]}"

    def tearDown(self):
        row = self.db.scalar(select(ProductBrainRecord).where(ProductBrainRecord.brain_id == self.brain_id))
        if row:
            self.db.delete(row)
            self.db.commit()
        self.db.close()

    def test_product_fact_round_trip(self):
        row = _upsert(
            self.db,
            {
                "id": self.brain_id,
                "local_product_id": "local-1",
                "name": "Stainless Steel Hinge",
                "sku": "H-001",
                "moq": "1000 PCS",
                "lead_time": "25 days",
            },
        )
        self.db.commit()
        self.db.refresh(row)
        self.assertEqual(row.brain_id, self.brain_id)
        self.assertEqual(row.local_product_id, "local-1")
        self.assertIn("1000 PCS", row.payload_json)


if __name__ == "__main__":
    unittest.main()
