from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
ASSET = ROOT / "public" / "huidi-mail-setup-refinement-v1.js"
SURFACE = ROOT / "online" / "api" / "app" / "community_surface.py"


class MailSetupRefinementContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.asset = ASSET.read_text(encoding="utf-8")
        cls.surface = SURFACE.read_text(encoding="utf-8")

    def test_refinement_loads_after_customer_workflow_refinement(self):
        workflow = "huidi-customer-workflow-refinement-v1.js"
        mail = "huidi-mail-setup-refinement-v1.js"
        self.assertIn(mail, self.surface)
        self.assertLess(self.surface.index(workflow), self.surface.index(mail))

    def test_refinement_reuses_existing_mail_owners(self):
        for forbidden in ("localStorage", "sessionStorage", "indexedDB", "MutationObserver", "setInterval"):
            self.assertNotIn(forbidden, self.asset)
        for required in (
            "/api/mail/accounts",
            "/smtp",
            "/test",
            "data-connect",
            "data-huf-mail",
            "HUIDIBeginnerFlow",
            "HUIDI:mail-accounts-changed",
        ):
            self.assertIn(required, self.asset)
        self.assertNotIn("/api/mail/connect/", self.asset)

    def test_beginner_mail_copy_and_common_smtp_presets_are_present(self):
        for text in (
            "一键连接 Gmail",
            "一键连接 Outlook",
            "企业邮箱 / 其他邮箱",
            "授权码 / 专用密码",
            "连接并检查",
            "高级设置 · 只有服务商要求时才打开",
            "QQ 邮箱",
            "腾讯企业邮箱",
            "网易 163 邮箱",
            "网易 126 邮箱",
            "阿里企业邮箱",
            "Zoho Mail",
        ):
            self.assertIn(text, self.asset)

    def test_normal_copy_does_not_require_business_users_to_understand_oauth_internals(self):
        self.assertIn("业务员不用处理技术参数", self.asset)
        self.assertIn("管理员提供", self.asset)
        self.assertIn("企业邮箱连接用于发信", self.asset)
        self.assertNotIn("POST · Bearer", self.asset)
        self.assertNotIn("client_secret", self.asset.lower())


if __name__ == "__main__":
    unittest.main()
