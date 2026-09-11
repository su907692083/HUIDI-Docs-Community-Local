from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class BusinessActivityTimelineContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = (ROOT / "app" / "business_activity.py").read_text(encoding="utf-8")
        self.daily = (ROOT / "app" / "daily_app.py").read_text(encoding="utf-8")
        self.surface = (ROOT / "app" / "community_surface.py").read_text(encoding="utf-8")
        self.ui = (REPO / "public" / "huidi-business-activity-timeline-v1.js").read_text(encoding="utf-8")

    def test_timeline_reuses_existing_owners_without_activity_table(self) -> None:
        for owner in (
            "LeadActivity",
            "MailboxMessage",
            "MailDeliveryLog",
            "OnlineCustomer",
            "OnlineDeal",
            "OnlineDocumentRef",
        ):
            self.assertIn(owner, self.backend)
        for forbidden in ("__tablename__", "mapped_column(", "Base.metadata", "db.add(", "db.commit(", "db.delete("):
            self.assertNotIn(forbidden, self.backend)
        self.assertIn('new_activity_storage', self.backend)
        self.assertIn('read_only', self.backend)
        self.assertIn('formal_price_projection', self.backend)

    def test_customer_and_deal_timeline_routes_are_registered(self) -> None:
        self.assertIn('/api/business/customers/{customer_id}/activity', self.backend)
        self.assertIn('/api/business/deals/{deal_id}/activity', self.backend)
        self.assertIn('from . import business_activity', self.daily)
        self.assertIn('existing_business_projection', self.backend)

    def test_timeline_uses_real_mail_and_documents_but_not_formal_amounts(self) -> None:
        self.assertIn('MailboxMessage.direction == "incoming"', self.backend)
        self.assertIn('MailDeliveryLog', self.backend)
        self.assertIn('DOCUMENT_NAMES', self.backend)
        self.assertIn('_strip_price_text', self.backend)
        for forbidden in ('deal.amount', 'deal.currency', 'unit_price', 'total_amount'):
            self.assertNotIn(forbidden, self.backend)

    def test_fused_quick_detail_receives_timeline_without_second_crm_surface(self) -> None:
        self.assertIn('huidi-business-activity-timeline-v1.js', self.surface)
        self.assertIn('#huidiQuickBackdrop', self.ui)
        self.assertIn('#huidiQuickBody', self.ui)
        self.assertIn('.huidi-quick-actions', self.ui)
        self.assertIn('业务时间线', self.ui)
        self.assertIn('/api/business/customers/', self.ui)
        self.assertIn('/api/business/deals/', self.ui)
        self.assertIn('HUIDICommunityDevelopmentRouting?.openLead?.', self.ui)
        self.assertIn('data-focus-view="deals"', self.ui)
        self.assertIn('不建立第二套 CRM 活动库', self.ui)
        for forbidden in ('localStorage', 'indexedDB', 'MutationObserver', 'window.open(', 'method:\'POST\'', 'method:"POST"'):
            self.assertNotIn(forbidden, self.ui)

    def test_timeline_javascript_parses(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        result = subprocess.run(
            [node, "--check", str(REPO / "public" / "huidi-business-activity-timeline-v1.js")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
