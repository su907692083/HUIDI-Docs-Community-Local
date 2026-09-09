from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / 'public' / 'huidi-task-flow-v1.js'
NAV = ROOT / 'public' / 'huidi-community-online-nav-v1.js'


class TaskFlowContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.task = TASK.read_text(encoding='utf-8')
        cls.nav = NAV.read_text(encoding='utf-8')

    def test_task_flow_is_loaded_only_from_online_nav(self):
        self.assertIn('window.HUIDI_COMMUNITY_ONLINE?.enabled', self.task)
        self.assertIn('/community/huidi-task-flow-v1.js', self.nav)
        self.assertIn('data-huidi-task-flow', self.nav)

    def test_task_model_covers_high_frequency_foreign_trade_jobs(self):
        for token in ('develop:', 'followup:', 'quote:', 'market:', 'ship:'):
            self.assertIn(token, self.task)
        for text in ('开发新客户', '跟进已有客户', '客户问价格', '判断市场机会', '准备出货'):
            self.assertIn(text, self.task)

    def test_context_is_ui_only_and_does_not_create_business_owner(self):
        self.assertIn("sessionStorage.setItem(KEY", self.task)
        forbidden = (
            'fetch(', 'XMLHttpRequest', '.upsert(', '.create(', '.delete(',
            '/api/business/', '/api/customers', '/api/product-brains/import',
            'unit_price=', 'formal_price=', 'amount='
        )
        for token in forbidden:
            self.assertNotIn(token, self.task, token)

    def test_prefill_never_overwrites_existing_user_value(self):
        self.assertIn("if(!el||el.disabled||el.readOnly||clean(el.value))continue", self.task)
        self.assertIn("价格、数量、交期仍由你在正式业务/单据里确认", self.task)

    def test_task_context_reuses_existing_views_and_owners(self):
        for view in ("'online-find'", "'customers'", "'documents'", "'online-intel'"):
            self.assertIn(view, self.task)
        self.assertIn('window.HUIDICommunityOnlineFullV2?.openTab?.', self.task)
        self.assertIn("repositories?.[name]?.list?.()", self.task)

    def test_keyboard_choice_layer_remains_the_country_fallback(self):
        self.assertIn('data-huidi-choice=\\"country\\"', self.task)
        self.assertIn('搜索其他国家 / 地区', self.task)


if __name__ == '__main__':
    unittest.main()
