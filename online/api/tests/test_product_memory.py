import unittest
from uuid import uuid4

from sqlalchemy import select

from app.daily_app import app  # noqa: F401
from app.main import SessionLocal
from app.product_memory import ProductBrainRecord, _product_brain_state, _upsert, _upsert_result


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

    def test_identical_round_trip_does_not_touch_server_timestamp(self):
        payload = {
            "id": self.brain_id,
            "local_product_id": "local-1",
            "name": "Stainless Steel Hinge",
            "sku": "H-001",
            "moq": "1000 PCS",
            "lead_time": "25 days",
        }
        row, changed = _upsert_result(self.db, payload)
        self.assertTrue(changed)
        self.db.commit()
        self.db.refresh(row)
        first_updated_at = row.updated_at

        same_payload = {**payload, "brain_id": self.brain_id, "server_updated_at": "2099-01-01T00:00:00+00:00"}
        same_row, changed = _upsert_result(self.db, same_payload)
        self.assertFalse(changed)
        self.db.commit()
        self.db.refresh(same_row)
        self.assertEqual(same_row.updated_at, first_updated_at)

        changed_row, changed = _upsert_result(self.db, {**payload, "lead_time": "30 days"})
        self.assertTrue(changed)
        self.db.commit()
        self.db.refresh(changed_row)
        self.assertNotEqual(changed_row.updated_at, first_updated_at)

    def test_state_version_changes_only_when_product_data_changes(self):
        before = _product_brain_state(self.db)
        row, changed = _upsert_result(
            self.db,
            {"id": self.brain_id, "name": "State Probe", "sku": "STATE-1"},
        )
        self.assertTrue(changed)
        self.db.commit()
        self.db.refresh(row)
        after_create = _product_brain_state(self.db)
        self.assertNotEqual(after_create["version"], before["version"])

        _, changed = _upsert_result(
            self.db,
            {"id": self.brain_id, "name": "State Probe", "sku": "STATE-1"},
        )
        self.assertFalse(changed)
        self.db.commit()
        after_noop = _product_brain_state(self.db)
        self.assertEqual(after_noop["version"], after_create["version"])


if __name__ == "__main__":
    unittest.main()
