from __future__ import annotations

import json
import os
import unittest
import uuid

from sqlalchemy import select

os.environ.setdefault("HUIDI_SECRET_KEY", "document-product-match-test")
os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_TEAM_ACCESS", "0")

from app import document_context  # noqa: E402
from app.document_product_match_guard import (  # noqa: E402
    install_safe_document_product_match,
    safe_match_product,
)
from app.main import SessionLocal  # noqa: E402
from app.product_memory import ProductBrainRecord  # noqa: E402


class DocumentProductMatchGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]
        base_name = f"Guard Hinge {self.suffix}"
        self.base = ProductBrainRecord(
            brain_id=f"guard-base-{self.suffix}",
            local_product_id=f"local-guard-base-{self.suffix}",
            name=base_name,
            sku=f"GH-BASE-{self.suffix}",
            payload_json=json.dumps(
                {"specification": "SUS304 4 inch", "reference_price": "1.25"},
                ensure_ascii=False,
            ),
        )
        self.heavy = ProductBrainRecord(
            brain_id=f"guard-heavy-{self.suffix}",
            local_product_id=f"local-guard-heavy-{self.suffix}",
            name=f"{base_name} Heavy Duty",
            sku=f"GH-HD-{self.suffix}",
            payload_json=json.dumps(
                {"specification": "SUS316 5 inch heavy duty", "reference_price": "2.40"},
                ensure_ascii=False,
            ),
        )
        ambiguous_prefix = f"Guard Ambiguous {self.suffix}"
        self.ambiguous_a = ProductBrainRecord(
            brain_id=f"guard-amb-a-{self.suffix}",
            local_product_id=f"local-guard-amb-a-{self.suffix}",
            name=f"{ambiguous_prefix} Small",
            sku=f"GA-S-{self.suffix}",
            payload_json=json.dumps({"specification": "small"}),
        )
        self.ambiguous_b = ProductBrainRecord(
            brain_id=f"guard-amb-b-{self.suffix}",
            local_product_id=f"local-guard-amb-b-{self.suffix}",
            name=f"{ambiguous_prefix} Large",
            sku=f"GA-L-{self.suffix}",
            payload_json=json.dumps({"specification": "large"}),
        )
        self.rows = [self.base, self.heavy, self.ambiguous_a, self.ambiguous_b]
        self.db.add_all(self.rows)
        self.db.commit()

    def tearDown(self) -> None:
        try:
            brain_ids = [row.brain_id for row in self.rows]
            stored = self.db.scalars(
                select(ProductBrainRecord).where(ProductBrainRecord.brain_id.in_(brain_ids))
            ).all()
            for row in stored:
                self.db.delete(row)
            self.db.commit()
        finally:
            self.db.close()

    def test_exact_product_name_beats_longer_variant(self) -> None:
        row, payload = safe_match_product(self.db, self.base.name)
        self.assertIsNotNone(row)
        self.assertEqual(row.brain_id, self.base.brain_id)
        self.assertEqual(payload.get("specification"), "SUS304 4 inch")

    def test_exact_sku_selects_exact_variant(self) -> None:
        row, payload = safe_match_product(self.db, self.heavy.sku)
        self.assertIsNotNone(row)
        self.assertEqual(row.brain_id, self.heavy.brain_id)
        self.assertEqual(payload.get("specification"), "SUS316 5 inch heavy duty")

    def test_unique_fuzzy_candidate_may_be_used(self) -> None:
        row, _ = safe_match_product(self.db, f"Guard Hinge {self.suffix} Heavy")
        self.assertIsNotNone(row)
        self.assertEqual(row.brain_id, self.heavy.brain_id)

    def test_ambiguous_fuzzy_variants_are_not_guessed(self) -> None:
        row, payload = safe_match_product(self.db, f"Guard Ambiguous {self.suffix}")
        self.assertIsNone(row)
        self.assertEqual(payload, {})

    def test_document_context_installer_replaces_only_fallback_matcher(self) -> None:
        original = document_context._match_product
        try:
            install_safe_document_product_match(document_context)
            guarded = document_context._match_product
            self.assertTrue(getattr(guarded, "_huidi_safe_product_match", False))
            row, _ = guarded(self.db, self.base.name)
            self.assertEqual(row.brain_id, self.base.brain_id)
        finally:
            document_context._match_product = original


if __name__ == "__main__":
    unittest.main()
