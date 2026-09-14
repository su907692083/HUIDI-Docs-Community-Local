from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FUSION = ROOT / "web" / "contact-reuse-fusion.js"
INDEX = ROOT / "web" / "index.html"
CONTACT_CENTER = ROOT / "app" / "contact_center.py"


class ContactReuseFusionContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fusion = FUSION.read_text(encoding="utf-8")
        cls.index = INDEX.read_text(encoding="utf-8")
        cls.contact_center = CONTACT_CENTER.read_text(encoding="utf-8")

    def test_javascript_syntax(self) -> None:
        subprocess.run(["node", "--check", str(FUSION)], check=True)

    def test_reuses_one_contact_projection_in_lead_and_formal_customer(self) -> None:
        self.assertIn("/api/contacts", self.fusion)
        self.assertIn("#dContact", self.fusion)
        self.assertIn("#dRole", self.fusion)
        self.assertIn("#dEmail", self.fusion)
        self.assertIn("#hbCustomerContact", self.fusion)
        self.assertIn("#hbCustomerEmail", self.fusion)
        self.assertIn("#hbCustomerPhone", self.fusion)
        self.assertNotIn("/api/customers", self.fusion)
        self.assertNotIn("/api/deals", self.fusion)
        self.assertNotIn("/api/contact", self.fusion.replace("/api/contacts", ""))

    def test_selection_is_form_fill_not_automatic_write_or_outreach(self) -> None:
        self.assertIn("仍需点击“保存资料”确认", self.fusion)
        self.assertIn("仍需点击“保存客户资料”确认", self.fusion)
        self.assertIn("不会自动发邮件", self.fusion)
        self.assertNotIn("method:'POST'", self.fusion)
        self.assertNotIn('method:"POST"', self.fusion)
        self.assertNotIn("method:'PATCH'", self.fusion)
        self.assertNotIn('method:"PATCH"', self.fusion)
        self.assertNotIn("/send", self.fusion)
        self.assertNotIn("#saveLead", self.fusion)

    def test_backend_is_read_only_projection_over_existing_owners(self) -> None:
        self.assertIn("from .business_center import OnlineCustomer", self.contact_center)
        self.assertIn("from .main import Lead", self.contact_center)
        self.assertIn("union_all", self.contact_center)
        self.assertIn("row_number", self.contact_center)
        self.assertIn('literal("customer").label("source_kind")', self.contact_center)
        self.assertIn('literal("lead").label("source_kind")', self.contact_center)
        self.assertIn('@app.get("/api/contacts")', self.contact_center)
        self.assertNotIn("db.add(", self.contact_center)
        self.assertNotIn("db.commit(", self.contact_center)
        self.assertNotIn("__tablename__", self.contact_center)

    def test_formal_contacts_are_opt_in_only_for_reuse_surface(self) -> None:
        self.assertIn("def _contact_candidates(include_formal: bool = False):", self.contact_center)
        self.assertIn("def _ranked_contacts(include_formal: bool = False):", self.contact_center)
        self.assertIn("include_formal: bool = Query(default=False)", self.contact_center)
        self.assertIn("_ranked_contacts(include_formal)", self.contact_center)
        self.assertIn("include_formal=true", self.fusion)
        self.assertIn("[data-customer-id],[data-open-customer],[data-save-customer]", self.fusion)

    def test_deal_and_mail_do_not_gain_parallel_contact_owners(self) -> None:
        self.assertNotIn("#hbDealContact", self.fusion)
        self.assertNotIn("#hbDealEmail", self.fusion)
        self.assertNotIn("mailRecipient", self.fusion)
        self.assertNotIn("threadRecipient", self.fusion)

    def test_no_new_global_observer_or_parallel_storage(self) -> None:
        self.assertNotIn("MutationObserver", self.fusion)
        self.assertNotIn("localStorage", self.fusion)
        self.assertNotIn("sessionStorage", self.fusion)
        self.assertNotIn("indexedDB", self.fusion)
        self.assertIn("window.HUIDIContactReuseFusion", self.fusion)

    def test_workbench_loads_fusion_once_after_navigation_owner(self) -> None:
        marker = '<script src="/assets/contact-reuse-fusion.js"></script>'
        self.assertEqual(self.index.count(marker), 1)
        self.assertLess(
            self.index.index('<script src="/assets/daily-navigation.js"></script>'),
            self.index.index(marker),
        )


if __name__ == "__main__":
    unittest.main()
