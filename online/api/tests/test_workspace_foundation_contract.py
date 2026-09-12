from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
APP = ROOT / "app"


class WorkspaceFoundationContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.js = (WEB / "workspace-foundation.js").read_text(encoding="utf-8")
        self.guidance = (WEB / "open-box-guidance-closure-v1.js").read_text(encoding="utf-8")
        self.documents = (WEB / "document-workbench-closure.js").read_text(encoding="utf-8")
        self.guard = (APP / "frontend_runtime_guard.py").read_text(encoding="utf-8")

    def test_root_surface_loads_foundation_through_versioned_runtime_guard(self) -> None:
        self.assertIn('/assets/workspace-foundation.js', self.guard)
        self.assertIn('/assets/open-box-guidance-closure-v1.js', self.guard)
        self.assertIn('inject_workspace_foundation', self.guard)
        self.assertIn('html = inject_workspace_foundation', self.guard)
        self.assertLess(
            self.guard.index('html = inject_workspace_foundation'),
            self.guard.index('html = version_asset_refs'),
        )

    def test_navigation_is_consolidated_to_five_visible_work_domains(self) -> None:
        for label in ["今天", "客户", "产品与单据", "市场与工具", "设置"]:
            self.assertIn(f'<div class="nav-title">{label}</div>', self.js)
        for legacy_visible_label in [
            '<div class="nav-title">开发客户</div>',
            '<div class="nav-title">邮件跟进</div>',
            '<div class="nav-title">客户与业务</div>',
            '<div class="nav-title">查资料</div>',
            '<div class="nav-title">管理</div>',
        ]:
            self.assertNotIn(legacy_visible_label, self.js)
        self.assertIn('huf-side-hidden', self.js)
        self.assertIn('data-huidi-communication>客户沟通', self.js)
        self.assertIn('data-huidi-doc-workbench>单据工作台', self.js)
        self.assertIn('data-huidi-foundation>基础设置', self.js)
        self.assertNotIn('data-huidi-service="mail" data-huidi-mail-folder="inbox">客户沟通', self.js)

    def test_first_run_requires_only_company_product_and_mailbox(self) -> None:
        self.assertIn('先完成 3 项基础设置', self.js)
        self.assertIn('公司资料', self.js)
        self.assertIn('产品资料', self.js)
        self.assertIn('常用邮箱', self.js)
        self.assertIn('连接 Gmail', self.js)
        self.assertIn('连接 Outlook', self.js)
        self.assertIn('其他企业邮箱（高级）', self.js)
        self.assertIn('普通用户不需要理解 SMTP', self.js)
        self.assertIn('普通业务员不需要配置 Serper / Tavily / Hunter', self.js)

    def test_open_box_guidance_keeps_one_next_action_without_new_owner(self) -> None:
        self.assertIn('HUIDIWorkspaceFoundation?.status', self.guidance)
        self.assertIn('HUIDIBeginnerFlow?.data', self.guidance)
        self.assertIn("needsReply>0||late>0", self.guidance)
        self.assertIn("if(!status?.company)", self.guidance)
        self.assertIn("if(!status?.product)", self.guidance)
        self.assertIn("if(!status?.mail)", self.guidance)
        self.assertIn("home.querySelector('.huf-actions')?.remove()", self.guidance)
        self.assertIn('完成开箱设置', self.guidance)
        for forbidden in ["fetch(", "indexedDB", "localStorage", "MutationObserver", "/api/"]:
            self.assertNotIn(forbidden, self.guidance)

    def test_communication_is_one_work_domain_over_existing_mail_owners(self) -> None:
        self.assertIn("mount?.('communication','客户沟通'", self.js)
        self.assertIn('data-huf-communication="${route}"', self.js)
        for route in ['mail', 'sent', 'queue', 'sequences']:
            self.assertIn(f"['{route}'", self.js)
        self.assertIn('收件箱、已发送、待发送和自动跟进集中在一个工作域', self.js)
        self.assertIn('普通用户不需要配置 SMTP', self.js)
        self.assertIn('不创建第二套客户库', self.js)
        self.assertIn("page==='communication'", self.js)
        self.assertNotIn('邮件 Owner', self.js)

    def test_documents_use_one_capable_native_workbench_not_a_second_shallow_hub(self) -> None:
        self.assertIn('window.HUIDIDocumentWorkbench?.open', self.js)
        self.assertNotIn('data-huf-document="${route}"', self.js)
        self.assertIn("mount?.('documents','单据工作台'", self.documents)
        self.assertIn('/api/business/deals?', self.documents)
        self.assertIn('data-hdw-doc="${type}"', self.documents)
        for route in ['quotation', 'proforma_invoice', 'sales_contract', 'commercial_invoice', 'packing_list']:
            self.assertIn(f"['{route}'", self.documents)
        self.assertIn('选一笔询盘后直接做报价、PI、合同、CI 或 Packing', self.documents)
        self.assertIn('当前正式价格仍由你确认', self.documents)
        self.assertIn("page==='documents'", self.js)

    def test_document_workbench_has_no_normal_path_local_bridge_or_extra_window(self) -> None:
        for forbidden in [
            'window.open(',
            '127.0.0.1:8765',
            'data-hdw-local',
            'data-hdw-sync-local',
            '直接打开离线版',
            '带当前业务到离线版',
            'online-bridge.html',
        ]:
            self.assertNotIn(forbidden, self.documents)
        self.assertIn('data-hdw-business', self.documents)
        self.assertIn('window.HUIDIWorkspacePages?.open?.(\'business\')', self.documents)

    def test_foundation_reuses_existing_owners_and_has_no_second_business_plane(self) -> None:
        for endpoint in [
            "/api/company-settings",
            "/api/product-brains",
            "/api/mail/accounts",
            "/api/mail/connect/",
            "/api/services/status",
        ]:
            self.assertIn(endpoint, self.js)
        for forbidden in [
            "MutationObserver",
            "indexedDB",
            "localStorage",
            "/api/business/customers",
            "/api/business/deals",
            "/api/business/documents",
            "fake lead",
            "demo lead",
        ]:
            self.assertNotIn(forbidden, self.js)
        self.assertIn('不会用假数据补结果', self.js)
        self.assertIn('不会生成或保存假客户、假贸易数据或假物流结果', self.js)

    def test_product_quick_start_uses_existing_product_brain_owner(self) -> None:
        self.assertIn("'/api/product-brains/'+encodeURIComponent(id)", self.js)
        self.assertIn("brain_id:id", self.js)
        self.assertIn("source:'manual'", self.js)
        self.assertIn('window.HUIDIProductServer?.sync?.()', self.js)

    def test_market_tools_are_one_hub_not_seven_visible_sidebar_pages(self) -> None:
        self.assertIn('data-huidi-tool-hub', self.js)
        for key in ['intelligence', 'map', 'company', 'trade', 'tariff', 'fx', 'shipping']:
            self.assertIn(f"['{key}'", self.js)
        self.assertIn('只使用真实已连接数据', self.js)
        self.assertIn("'可用':'未连接'", self.js)

    def test_browser_scripts_syntax(self) -> None:
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed")
        for source in (self.js, self.guidance, self.documents):
            with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
                tmp.write(source)
                path = Path(tmp.name)
            try:
                result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
            finally:
                path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
