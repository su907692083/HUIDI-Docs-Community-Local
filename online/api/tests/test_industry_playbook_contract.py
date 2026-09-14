import unittest
from pathlib import Path

from fastapi import HTTPException

from app.daily_app import app  # noqa: F401
from app import main as main_owner
from app.industry_playbooks import (
    EXPECTED_OVERVIEW,
    EXPECTED_RECORDS,
    EXPECTED_SELECTABLE,
    SCENARIOS,
    _scenario_copy,
    _sequence_steps,
    industry_by_id,
    industry_catalog,
    industry_stats,
    industry_templates,
)
from app.mail_sequences import MailSequenceTemplate


ROOT = Path(__file__).resolve().parents[1]


class IndustryPlaybookContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_verified_legacy_catalog_contract_is_complete(self):
        rows = industry_catalog()
        stats = industry_stats()
        self.assertEqual(len(rows), EXPECTED_RECORDS)
        self.assertEqual(EXPECTED_RECORDS, 143)
        self.assertEqual(EXPECTED_SELECTABLE, 135)
        self.assertEqual(EXPECTED_OVERVIEW, 8)
        self.assertEqual(stats["records"], 143)
        self.assertEqual(stats["selectable"], 135)
        self.assertEqual(stats["overview"], 8)
        self.assertEqual(stats["families"], 14)
        self.assertEqual(stats["scenarios"], 10)
        self.assertEqual(len({row["id"] for row in rows}), 143)
        self.assertEqual(len(list((ROOT / "app" / "data").glob("industry_catalog_v3_*.json"))), 8)

    def test_overview_industries_cannot_execute_mail_or_automation(self):
        overview_ids = {
            "building-materials",
            "consumer-electronics",
            "food-agriculture",
            "furniture-lighting",
            "hardware-components",
            "industrial-machinery",
            "renewable-energy-storage",
            "textile-apparel-bags",
        }
        actual = {row["id"] for row in industry_catalog() if not row.get("selectable")}
        self.assertEqual(actual, overview_ids)
        for industry_id in overview_ids:
            with self.assertRaises(HTTPException) as ctx:
                industry_by_id(industry_id, executable=True)
            self.assertEqual(ctx.exception.status_code, 400)
        self.assertTrue(industry_by_id("general-b2b", executable=True)["selectable"])

    def test_templates_are_dynamic_scenarios_not_thousands_of_db_rows(self):
        profile = industry_by_id("fasteners-fixings", executable=True)
        templates = industry_templates(profile, role="Fastener Buyer")
        self.assertEqual(len(SCENARIOS), 10)
        self.assertEqual(len(templates), 10)
        self.assertEqual({x["scenario"] for x in templates}, {x[0] for x in SCENARIOS})
        self.assertTrue(all(x["role"] == "Fastener Buyer" for x in templates))
        source = self.text("app/industry_playbooks.py")
        self.assertIn("MailSequenceTemplate", source)
        self.assertNotIn("class IndustryMailQueue", source)
        self.assertNotIn("class IndustrySequenceEnrollment", source)

    def test_regulated_industry_copy_does_not_claim_unverified_certification(self):
        profile = industry_by_id("medical-chemical", executable=True)
        copy = _scenario_copy(profile, "technical-compliance", "Medical Device Buyer")
        body = copy["body"].lower()
        self.assertIn("will not assume", body)
        self.assertNotIn("we are certified", body)
        self.assertNotIn("fully certified", body)
        self.assertNotIn("all certifications", body)

    def test_industry_followup_reuses_existing_sequence_owner_and_requires_review(self):
        profile = industry_by_id("fasteners-fixings", executable=True)
        steps = _sequence_steps(profile)
        self.assertEqual([x["delay_hours"] for x in steps], [0, 96, 216, 384])
        self.assertEqual(MailSequenceTemplate.__tablename__, "mail_sequence_templates")
        source = self.text("app/industry_playbooks.py")
        self.assertIn("approved=0", source)
        self.assertIn("客户回复、退订或进入询盘后沿用现有自动停止规则", source)
        sequence_owner = self.text("app/mail_sequences.py")
        self.assertIn('lead.status in {"replied", "converted", "archived"}', sequence_owner)
        self.assertIn("_active_suppression", sequence_owner)

    def test_existing_draft_route_remains_primary_owner(self):
        main_source = self.text("app/main.py")
        playbook = self.text("app/industry_playbooks.py")
        scenario = self.text("app/industry_scenario_actions.py")
        self.assertIn('@app.post("/api/leads/{lead_id}/draft")', main_source)
        self.assertIn("main_owner.llm_draft = _industry_aware_llm_draft", playbook)
        self.assertIn("lead.draft_subject", scenario)
        self.assertIn("lead.draft_body", scenario)
        self.assertIn('"draft_rejected"', scenario)
        self.assertFalse(hasattr(main_owner, "IndustryLead"))

    def test_customer_ui_is_embedded_without_new_navigation_module(self):
        index = self.text("web/index.html")
        ui = self.text("web/industry-playbook-ui.js")
        self.assertIn('/assets/industry-playbook-ui.js', index)
        self.assertIn("行业策略", ui)
        self.assertIn("行业邮件场景", ui)
        self.assertIn("使用行业跟进计划", ui)
        self.assertIn("#draftBox", ui)
        self.assertIn("window.HUIDISequenceUI", ui)
        self.assertIn("/industry-draft", ui)
        self.assertIn("/industry-sequence", ui)
        self.assertNotIn("data-huidi-industry", index)
        self.assertNotIn("data-huidi-industry", ui)

    def test_schema_revision_persists_only_customer_choice(self):
        schema = self.text("app/schema_migrations.py")
        self.assertIn("20260906_003_industry_playbook_context", schema)
        self.assertIn("lead_industry_preferences", schema)
        self.assertNotIn("industry_mail_templates", schema)
        self.assertNotIn("industry_catalog", schema)


if __name__ == "__main__":
    unittest.main()
