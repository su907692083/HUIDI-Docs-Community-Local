import unittest
from uuid import uuid4

from sqlalchemy import select

from app.main import Lead, LeadActivity, SessionLocal
from app.online_app import LOCAL_STATUS_SCHEMA, LocalBusinessEventRequest, receive_local_business_event


class LocalStatusSyncTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        token = uuid4().hex[:10]
        self.lead = Lead(
            company_name=f"local-sync-{token}",
            domain=f"local-sync-{token}.example.com",
            website=f"https://local-sync-{token}.example.com",
            country="DE",
            market_keyword="hinge",
            buyer_type="importer",
            score=86,
            reason="sync regression",
            status="converted",
        )
        self.db.add(self.lead)
        self.db.commit()
        self.db.refresh(self.lead)
        self.lead_id = self.lead.id

    def tearDown(self):
        activities = self.db.scalars(select(LeadActivity).where(LeadActivity.lead_id == self.lead_id)).all()
        for row in activities:
            self.db.delete(row)
        lead = self.db.get(Lead, self.lead_id)
        if lead:
            self.db.delete(lead)
        self.db.commit()
        self.db.close()

    def test_local_progress_is_added_to_timeline_without_overwriting_lead_status(self):
        req = LocalBusinessEventRequest(
            schema=LOCAL_STATUS_SCHEMA,
            source="HUIDI Community Local",
            event="deal.updated",
            title="本地业务进度 · 已报价",
            customer_id="customer_1",
            customer_name="Acme GmbH",
            deal_id="deal_1",
            deal_title="Acme GmbH · hinge inquiry",
            stage="quotation",
            next_action="等待客户确认价格",
        )
        result = receive_local_business_event(self.lead_id, req, self.db)
        self.assertTrue(result["ok"])
        self.assertEqual(result["schema"], LOCAL_STATUS_SCHEMA)
        self.assertEqual(result["lead"]["status"], "converted")

        event = self.db.scalar(
            select(LeadActivity)
            .where(LeadActivity.lead_id == self.lead_id)
            .where(LeadActivity.event_type == "local_business_event")
            .order_by(LeadActivity.id.desc())
        )
        self.assertIsNotNone(event)
        self.assertIn("已报价", event.title)
        self.assertIn("Acme GmbH", event.detail)
        self.assertIn('"stage": "quotation"', event.payload_json)

    def test_schema_is_rejected_when_mismatched(self):
        req = LocalBusinessEventRequest(schema="wrong.schema/v9", title="bad")
        with self.assertRaises(Exception):
            receive_local_business_event(self.lead_id, req, self.db)


if __name__ == "__main__":
    unittest.main()
