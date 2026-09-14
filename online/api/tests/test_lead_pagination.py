import unittest
from uuid import uuid4

from sqlalchemy import select

from app.main import Lead, SessionLocal, list_leads


class LeadPaginationTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.prefix = f"pagination-{uuid4().hex[:10]}"
        self.ids = []
        for idx in range(15):
            row = Lead(
                company_name=f"{self.prefix}-{idx:02d}",
                domain=f"{self.prefix}-{idx:02d}.example.com",
                website=f"https://{self.prefix}-{idx:02d}.example.com",
                country="DE",
                market_keyword=self.prefix,
                buyer_type="importer",
                score=90 - idx,
                reason="pagination regression",
                status="new",
            )
            self.db.add(row)
            self.db.flush()
            self.ids.append(row.id)
        self.db.commit()

    def tearDown(self):
        rows = self.db.scalars(select(Lead).where(Lead.id.in_(self.ids))).all()
        for row in rows:
            self.db.delete(row)
        self.db.commit()
        self.db.close()

    def test_paged_response_is_bounded_and_reports_totals(self):
        result = list_leads(
            paged=True,
            page=1,
            page_size=10,
            q=self.prefix,
            db=self.db,
        )
        self.assertEqual(result["total"], 15)
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["page_size"], 10)
        self.assertEqual(result["pages"], 2)
        self.assertEqual(len(result["items"]), 10)

        second = list_leads(
            paged=True,
            page=2,
            page_size=10,
            q=self.prefix,
            db=self.db,
        )
        self.assertEqual(len(second["items"]), 5)
        self.assertEqual(second["page"], 2)

    def test_legacy_array_response_is_preserved(self):
        result = list_leads(paged=False, q=self.prefix, db=self.db)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 15)


if __name__ == "__main__":
    unittest.main()
