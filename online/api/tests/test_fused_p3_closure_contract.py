from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class FusedP3ClosureContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.surface = (ROOT / "app" / "community_surface.py").read_text(encoding="utf-8")
        self.ui = (REPO / "public" / "huidi-fused-p3-closure-v1.js").read_text(encoding="utf-8")

    def test_fused_surface_loads_p3_closure_without_new_owner(self) -> None:
        self.assertIn('huidi-fused-p3-closure-v1.js', self.surface)
        self.assertIn('/api/growth/funnel', self.ui)
        self.assertIn('/api/automation/overview', self.ui)
        for forbidden in ('localStorage', 'indexedDB', 'MutationObserver', 'window.open(', 'new Function(', 'eval('):
            self.assertNotIn(forbidden, self.ui)

    def test_today_surface_gets_read_only_foreign_trade_analytics(self) -> None:
        self.assertIn('#view-home', self.ui)
        self.assertIn('#huidiFusionToday', self.ui)
        self.assertIn('开发进度与经营分析', self.ui)
        for label in ('潜客优先级', '询盘阶段', '正式单据', '在途业务金额'):
            self.assertIn(label, self.ui)
        self.assertIn('不同币种分别统计', self.ui)
        self.assertIn('BI 数据副本', self.ui)
        self.assertIn("openTab?.('online-find','pool'", self.ui)
        self.assertIn("openTab?.('mail','inbox'", self.ui)

    def test_admin_notification_tab_gets_safe_automation_projection(self) -> None:
        self.assertIn('业务自动化运行', self.ui)
        self.assertIn("[data-fv2-route-cat=\"system\"]", self.ui)
        self.assertIn('system.checked=false', self.ui)
        self.assertIn('HTTPS 接收地址', self.ui)
        self.assertIn('notification_only', self.ui)
        self.assertIn('自动发业务邮件', self.ui)
        self.assertIn('自动转客户/询盘', self.ui)
        self.assertIn('自动改单据/价格', self.ui)
        self.assertIn('任意代码执行', self.ui)
        self.assertIn('默认不勾选', self.ui)
        self.assertIn('内网/本机地址安全校验', self.ui)

    def test_fused_p3_javascript_parses(self) -> None:
        node = shutil.which('node')
        if not node:
            self.skipTest('node is not installed')
        result = subprocess.run(
            [node, '--check', str(REPO / 'public' / 'huidi-fused-p3-closure-v1.js')],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == '__main__':
    unittest.main()
