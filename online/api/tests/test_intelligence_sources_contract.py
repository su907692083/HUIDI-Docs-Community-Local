import os
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app import customer_intelligence  # noqa: E402
from app import intelligence_source_bridge  # noqa: F401,E402
from app.intelligence_sources import _platform_sources, _safe_public_url  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


class IntelligenceSourceContractTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_manager_routes_and_company_storage_exist(self):
        backend = self.text("app/intelligence_sources.py")
        for route in [
            '/api/intel/sources',
            '/api/intel/sources/{source_id}',
            '/api/intel/sources/{source_id}/test',
        ]:
            self.assertIn(route, backend)
        self.assertIn('class IntelligenceFeedSource', backend)
        self.assertIn('只有老板或管理员可以修改新闻与行业来源', backend)
        self.assertIn('新闻订阅地址', backend)
        self.assertIn('fetch_feed_entries', backend)
        self.assertIn('来源跳转到了不允许访问的地址', backend)

    def test_platform_and_company_sources_merge_into_existing_owner(self):
        bridge = self.text("app/intelligence_source_bridge.py")
        daily = self.text("app/daily_app.py")
        self.assertIn('configured_intelligence_sources', bridge)
        self.assertIn('SessionLocal()', bridge)
        self.assertIn('customer_intelligence._configured_rss_sources = _managed_sources', bridge)
        self.assertIn('customer_intelligence._custom_rss = _managed_feed', bridge)
        self.assertIn('from . import intelligence_sources', daily)
        self.assertIn('from . import intelligence_source_bridge', daily)
        self.assertIs(customer_intelligence._configured_rss_sources.__name__, '_managed_sources')

    def test_public_url_guard_blocks_local_targets(self):
        self.assertFalse(_safe_public_url('http://127.0.0.1/feed.xml', resolve_dns=False))
        self.assertFalse(_safe_public_url('http://localhost/feed.xml', resolve_dns=False))
        self.assertFalse(_safe_public_url('http://169.254.169.254/latest/meta-data', resolve_dns=False))
        self.assertTrue(_safe_public_url('https://example.com/feed.xml', resolve_dns=False))

    def test_platform_sources_remain_backward_compatible(self):
        old = os.environ.get('HUIDI_INTEL_RSS_SOURCES')
        try:
            os.environ['HUIDI_INTEL_RSS_SOURCES'] = '[{"name":"Example Trade Office","url":"https://example.com/feed.xml","category":"policy","source_type":"official"}]'
            rows = _platform_sources()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['origin'], 'platform')
            self.assertEqual(rows[0]['source_type'], 'official')
            self.assertFalse(rows[0]['editable'])
        finally:
            if old is None:
                os.environ.pop('HUIDI_INTEL_RSS_SOURCES', None)
            else:
                os.environ['HUIDI_INTEL_RSS_SOURCES'] = old

    def test_beginner_ui_is_inside_existing_data_source_window(self):
        index = self.text("web/index.html")
        ui = self.text("web/intelligence-source-settings.js")
        self.assertIn('/assets/intelligence-source-settings.js', index)
        self.assertIn('新闻与行业来源', ui)
        self.assertIn('添加本公司来源', ui)
        self.assertIn('来源名称', ui)
        self.assertIn('来源类型', ui)
        self.assertIn('内容分类', ui)
        self.assertIn('新闻订阅地址', ui)
        self.assertIn('优先添加官方机构和行业协会来源', ui)
        self.assertNotIn('API Key', ui)
        self.assertNotIn('JSON', ui)
        self.assertNotIn('Tenant', ui)

    def test_schema_and_ci_gate_managed_sources(self):
        migration = self.text("app/schema_migrations.py")
        workflow = (REPO / '.github' / 'workflows' / 'online-v01-check.yml').read_text(encoding='utf-8')
        self.assertIn('20260906_002_intelligence_feed_sources', migration)
        self.assertIn('intelligence_feed_sources', migration)
        self.assertIn("'/api/intel/sources'", workflow)
        self.assertIn('web/intelligence-source-settings.js', workflow)


if __name__ == '__main__':
    unittest.main()
