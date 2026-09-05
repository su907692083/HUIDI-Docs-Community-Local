import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class NormalizedIntelligenceContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_raw_provider_results_and_normalized_business_facts_have_separate_owners(self):
        records = self.text("app/intelligence_records.py")
        normalizer = self.text("app/intelligence_normalizer.py")
        self.assertIn("OnlineIntelligenceRecord", records)
        self.assertIn("OnlineIntelligenceProjection", records)
        self.assertIn("huidi.intelligence.normalized/v1", normalizer)
        self.assertIn("has_business_facts", normalizer)
        self.assertIn("暂未识别出可稳定复用的业务字段", normalizer)

    def test_deal_reference_uses_normalized_fields_without_overwriting_formal_business_data(self):
        reference = self.text("app/deal_reference.py")
        regression = self.text("tests/test_intelligence_normalization.py")
        self.assertIn("huidi.deal.intelligence/v1", reference)
        self.assertIn("online_business_facts", reference)
        self.assertIn("不会自动写入报价金额", reference)
        self.assertIn("self.assertEqual(deal.amount, 12000)", regression)
        self.assertIn("self.assertEqual(deal.requirements", regression)

    def test_deal_detail_has_plain_language_reference_ui(self):
        ui = self.text("web/deal-facts-ui.js")
        index = self.text("web/index.html")
        self.assertIn("联网业务参考", ui)
        self.assertIn("不会自动改价格", ui)
        self.assertIn("/facts", ui)
        self.assertIn("deal-facts-ui.js", index)

    def test_each_tenant_database_has_an_idempotent_schema_revision_ledger(self):
        migrations = self.text("app/schema_migrations.py")
        storage = self.text("app/tenant_storage.py")
        regression = self.text("tests/test_schema_migrations.py")
        self.assertIn("huidi_schema_migrations", migrations)
        self.assertIn("LATEST_SCHEMA_REVISION", migrations)
        self.assertIn("apply_schema_migrations(engine)", storage)
        self.assertIn("migration_application_is_idempotent", regression)
        self.assertIn("each_company_database_records_the_current_revision", regression)

    def test_postgresql_runtime_driver_is_part_of_the_online_install(self):
        requirements = self.text("requirements.txt")
        self.assertIn("psycopg[binary]", requirements)


if __name__ == "__main__":
    unittest.main()
