from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
PUBLIC = REPO / "public"
APP = REPO / "online" / "api" / "app"


class MailOnboardingAssistContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.asset_path = PUBLIC / "huidi-mail-setup-modal-compat-v1.js"
        cls.asset = cls.asset_path.read_text(encoding="utf-8")
        cls.surface = (APP / "community_surface.py").read_text(encoding="utf-8")

    def test_existing_modal_compatibility_owner_is_preserved(self) -> None:
        for marker in (
            "HUIDIMailSetupModalCompatibility",
            "mgModalBack",
            "data-hms-compat",
            "#hmsBack.open",
        ):
            self.assertIn(marker, self.asset)

    def test_onboarding_assist_loads_after_beginner_mail_refinement(self) -> None:
        refinement = "huidi-mail-setup-refinement-v1.js"
        compatibility = "huidi-mail-setup-modal-compat-v1.js"
        self.assertIn(refinement, self.surface)
        self.assertIn(compatibility, self.surface)
        self.assertLess(self.surface.index(refinement), self.surface.index(compatibility))
        self.assertIn("HUIDIMailOnboardingAssist", self.asset)

    def test_domestic_and_foreign_trade_mail_options_are_plain_and_guided(self) -> None:
        for label in (
            "QQ 邮箱",
            "腾讯企业邮箱",
            "网易 163 邮箱",
            "网易 126 邮箱",
            "阿里企业邮箱",
            "阿里外贸邮",
            "Zoho 个人邮箱",
            "Zoho 企业邮箱",
        ):
            self.assertIn(label, self.asset)
        for host in (
            "smtp.alibaba.com",
            "smtppro.zoho.com",
        ):
            self.assertIn(host, self.asset)
        self.assertIn("授权码或安全密码", self.asset)
        self.assertIn("应用专用密码", self.asset)
        self.assertIn("查看官方帮助", self.asset)

    def test_common_public_domains_select_the_right_path(self) -> None:
        for domain in (
            "gmail.com",
            "outlook.com",
            "hotmail.com",
            "qq.com",
            "foxmail.com",
            "163.com",
            "126.com",
            "yeah.net",
            "zoho.com",
        ):
            self.assertIn(f"'{domain}'", self.asset)
        self.assertIn("改用一键连接", self.asset)
        self.assertIn("select.dispatchEvent(new Event('change'", self.asset)

    def test_business_mail_and_system_mail_capabilities_are_not_mixed(self) -> None:
        self.assertIn("一键授权后可收信、发信、同步回复和自动刷新授权", self.asset)
        self.assertIn("当前通过 SMTP 安全发信", self.asset)
        self.assertIn("自动收件仍建议使用 Gmail 或 Outlook", self.asset)
        self.assertIn("注册验证、找回密码属于平台通知邮箱", self.asset)
        self.assertIn("与业务邮箱分开配置", self.asset)

    def test_assist_is_presentation_only_and_does_not_touch_credentials_or_business_data(self) -> None:
        assist = self.asset.split("/* HUIDI Mail Onboarding Assist V1", 1)[1]
        for forbidden in (
            "fetch(",
            "/api/",
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "MutationObserver",
            "repositories.customers",
            "repositories.deals",
            "data-hms-secret]')?.value",
        ):
            self.assertNotIn(forbidden, assist)
        self.assertIn('rel="noopener noreferrer"', assist)
        self.assertIn("data-hms-owner-connect", assist)
        self.assertIn("data-hms-preset", assist)

    def test_browser_asset_parses(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        result = subprocess.run(
            [node, "--check", str(self.asset_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
