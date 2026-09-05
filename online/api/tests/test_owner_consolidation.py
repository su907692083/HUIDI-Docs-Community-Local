import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class OwnerConsolidationTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_today_never_counts_legacy_mail_dispatch_plans(self):
        workbench = self.text("app/workbench.py")
        self.assertNotIn("MailDispatchPlan", workbench)
        self.assertIn("MailQueueItem.state.in_", workbench)

    def test_legacy_mail_plan_is_history_only_and_writes_real_queue(self):
        online_app = self.text("app/online_app.py")
        compat = self.text("app/mail_plan_compat_owner.py")
        regression = self.text("tests/test_mail_plan_compat.py")
        self.assertIn("Read-only legacy history owner", online_app)
        self.assertIn("queue_message", online_app)
        self.assertIn("mail_plan_compat_queued", compat)
        self.assertIn("without creating any new", compat)
        self.assertIn("without_new_legacy_row", regression)

    def test_today_reply_action_is_cleared_by_thread_or_direct_send(self):
        workbench = self.text("app/workbench.py")
        regression = self.text("tests/test_workbench_actions.py")
        self.assertIn("later_outgoing", workbench)
        self.assertIn("later_delivery", workbench)
        self.assertIn("direct_successful_send_also_clears_reply_action", regression)

    def test_external_data_tools_use_one_configurable_adapter_owner(self):
        adapter = self.text("app/service_adapters.py")
        bridge = self.text("app/service_hub_adapter_patch.py")
        regression = self.text("tests/test_service_adapters.py")
        self.assertIn("execute_service_request", adapter)
        self.assertIn("_validate_endpoint", adapter)
        self.assertIn("follow_redirects=False", adapter)
        self.assertIn("execute_service_request", bridge)
        self.assertIn("private_or_local_service_endpoints_are_blocked_by_default", regression)

    def test_company_timezone_is_the_today_clock_owner(self):
        workbench = self.text("app/workbench.py")
        settings = self.text("app/company_settings.py")
        self.assertIn("company_timezone(db)", workbench)
        self.assertIn("CompanySetting", settings)
        self.assertIn("TIMEZONE_CHOICES", settings)


if __name__ == "__main__":
    unittest.main()
