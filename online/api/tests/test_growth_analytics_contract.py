from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class GrowthAnalyticsContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = (ROOT / "app" / "growth_funnel.py").read_text(encoding="utf-8")
        self.ui = (ROOT / "web" / "growth-funnel-ui.js").read_text(encoding="utf-8")

    def test_analytics_extend_existing_growth_owner_without_new_storage(self) -> None:
        self.assertIn('/api/growth/funnel', self.backend)
        self.assertIn('mode": "authoritative_operational_analytics', self.backend)
        self.assertIn('"analysis": {', self.backend)
        for marker in (
            '_lead_priorities(db)',
            '_customer_countries(db)',
            '_deal_stages(db)',
            '_document_types(db)',
            '_pipeline_by_currency(db)',
        ):
            self.assertIn(marker, self.backend)
        for forbidden in ('__tablename__', 'mapped_column(', 'Base.metadata.create_all', 'CREATE TABLE', 'raw_sql'):
            self.assertNotIn(forbidden, self.backend)
        self.assertIn('new_analytics_storage', self.backend)
        self.assertIn('raw_sql_console', self.backend)
        self.assertIn('read_only', self.backend)

    def test_pipeline_never_mixes_currencies_or_writes_prices(self) -> None:
        self.assertIn('group_by(OnlineDeal.currency)', self.backend)
        self.assertIn('func.sum(OnlineDeal.amount)', self.backend)
        self.assertIn('mixed_currency_totals', self.backend)
        self.assertIn('formal_price_write', self.backend)
        self.assertIn('Never add unlike currencies together', self.backend)
        self.assertNotIn('db.commit()', self.backend)
        self.assertNotIn('setattr(', self.backend)

    def test_dashboard_drills_back_into_existing_business_owners(self) -> None:
        for route in ('leads', 'communication', 'business', 'documents'):
            self.assertIn(f'"{route}"', self.backend)
        self.assertIn('data-gf-route', self.ui)
        self.assertIn("openTab('online-find','pool'", self.ui)
        self.assertIn("[data-huidi-communication]", self.ui)
        self.assertIn("[data-huidi-business=\"deals\"]", self.ui)
        self.assertIn('HUIDIDocumentWorkbench?.open', self.ui)
        for forbidden in ('localStorage', 'indexedDB', 'MutationObserver', '/api/sql', 'SELECT *', 'window.open('):
            self.assertNotIn(forbidden, self.ui)

    def test_dashboard_surfaces_foreign_trade_specific_slices(self) -> None:
        for label in ('潜客优先级', '询盘阶段', '正式单据', '在途业务金额'):
            self.assertIn(label, self.ui)
        self.assertIn('不同币种金额', self.ui)
        self.assertIn('BI 数据副本', self.ui)

    def test_growth_ui_javascript_parses(self) -> None:
        node = shutil.which('node')
        if not node:
            self.skipTest('node is not installed')
        result = subprocess.run(
            [node, '--check', str(ROOT / 'web' / 'growth-funnel-ui.js')],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == '__main__':
    unittest.main()
