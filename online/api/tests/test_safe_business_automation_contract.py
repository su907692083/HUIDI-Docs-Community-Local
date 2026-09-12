from __future__ import annotations

import unittest
from pathlib import Path

from fastapi import HTTPException

from app.notification_delivery import (
    CATEGORY_NAMES,
    DEFAULT_CATEGORIES,
    NotificationRoute,
    _should_send,
    _validate_destination,
)


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class SafeBusinessAutomationContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.delivery = (ROOT / "app" / "notification_delivery.py").read_text(encoding="utf-8")
        self.overview = (ROOT / "app" / "automation_overview.py").read_text(encoding="utf-8")
        self.daily = (ROOT / "app" / "daily_app.py").read_text(encoding="utf-8")
        self.ui = (ROOT / "web" / "notification-settings.js").read_text(encoding="utf-8")

    def test_projection_reuses_existing_notification_owner_without_workflow_store(self) -> None:
        self.assertIn('from . import automation_overview', self.daily)
        self.assertIn('/api/automation/overview', self.overview)
        self.assertIn('NotificationRoute', self.overview)
        self.assertIn('NotificationDelivery', self.overview)
        self.assertIn('build_notifications', self.overview)
        self.assertIn('mode": "notification_projection', self.overview)
        self.assertIn('new_workflow_storage', self.overview)
        self.assertIn('ALLOWED_ACTIONS = ["notification_only"]', self.overview)
        self.assertIn('"allowed_actions": list(ALLOWED_ACTIONS)', self.overview)
        self.assertIn('"blocked_actions": list(BLOCKED_ACTIONS)', self.overview)
        for forbidden in ('__tablename__', 'mapped_column(', 'Base.metadata', 'subprocess', 'eval(', 'exec('):
            self.assertNotIn(forbidden, self.overview)

    def test_high_risk_business_actions_remain_blocked(self) -> None:
        for action in (
            'send_business_mail',
            'convert_lead_or_create_deal',
            'mutate_customer_or_deal',
            'write_formal_document',
            'change_formal_price',
            'execute_arbitrary_code',
        ):
            self.assertIn(action, self.overview)
        self.assertIn('configuration_requires_owner_or_admin', self.overview)
        self.assertIn('当前自动化只允许发送提醒', self.overview)

    def test_system_backup_event_is_real_opt_in_trigger(self) -> None:
        self.assertIn('system', CATEGORY_NAMES)
        label = CATEGORY_NAMES['system']
        self.assertIn('系统', label)
        self.assertIn('备份', label)
        self.assertNotIn('system', DEFAULT_CATEGORIES)
        route = NotificationRoute(
            name='系统异常提醒',
            channel='other',
            encrypted_destination='ciphertext-present',
            categories_json='["system"]',
            high_only=1,
            quiet_start='00:00',
            quiet_end='00:00',
            enabled=1,
        )
        event = {
            'key': 'backup.failed:2026-09-11T01:00:00',
            'category': 'system',
            'title': '自动备份需要处理',
            'summary': 'backup failed',
            'priority': 'high',
            'state': 'open',
        }
        self.assertTrue(_should_send(route, event))
        self.assertIn("v==='system'?'':'checked'", self.ui)
        self.assertIn('默认不勾选', self.ui)

    def test_automation_destinations_are_https_only_and_reuse_ssrf_guard(self) -> None:
        self.assertIn('urlparse(destination).scheme.lower() != "https"', self.delivery)
        self.assertIn('_validate_endpoint(destination)', self.delivery)
        with self.assertRaises(HTTPException) as http_error:
            _validate_destination('http://hooks.example.test/path')
        self.assertEqual(http_error.exception.status_code, 400)
        with self.assertRaises(HTTPException) as private_error:
            _validate_destination('https://127.0.0.1/hook')
        self.assertEqual(private_error.exception.status_code, 400)

    def test_ui_exposes_rules_and_runs_but_not_arbitrary_execution(self) -> None:
        for marker in (
            '业务自动化',
            '/api/automation/overview',
            '当前自动化运行',
            '只允许 notification_only',
            'HTTPS',
            '内网 / 本机目标安全校验',
        ):
            self.assertIn(marker, self.ui)
        for forbidden in (
            'send_business_mail',
            '/api/leads/{lead_id}/convert',
            '/api/business/deals',
            'window.eval',
            'new Function(',
        ):
            self.assertNotIn(forbidden, self.ui)


if __name__ == '__main__':
    unittest.main()
