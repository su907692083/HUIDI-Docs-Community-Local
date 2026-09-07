from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class WorkspacePagesContractTests(unittest.TestCase):
    def test_router_loads_before_popup_owners(self):
        index = (WEB / "index.html").read_text(encoding="utf-8")
        router = index.index('/assets/page-router.js')
        catalog = index.index('/assets/catalog-studio-online.js')
        self.assertLess(router, catalog)
        self.assertNotIn('/assets/workspace-pages.js', index)
        self.assertLess(router, index.index('/assets/product-brain.js'))
        self.assertLess(router, index.index('/assets/daily-services.js'))
        self.assertLess(router, index.index('/assets/business-center-ui.js'))
        self.assertLess(router, index.index('/assets/standalone-business-ui.js'))
        self.assertLess(router, index.index('/assets/daily-navigation.js'))
        self.assertLess(router, index.index('/assets/sequence-ui.js'))
        self.assertLess(router, index.index('/assets/customer-intelligence.js'))
        self.assertLess(router, index.index('/assets/audit-ui.js'))

    def test_primary_sidebar_routes_into_one_main_workspace_page(self):
        source = (WEB / "page-router.js").read_text(encoding="utf-8")
        self.assertIn("#huidiPageHost", source)
        self.assertIn("hpr-active", source)
        self.assertIn("hpr-docked", source)
        self.assertIn("stopImmediatePropagation", source)
        self.assertIn("routeEpoch", source)
        self.assertIn("closeStrays", source)
        self.assertIn("token!==routeEpoch", source)
        self.assertIn(".side [data-huidi-business]", source)
        self.assertIn(".side [data-huidi-product]", source)
        self.assertIn(".side [data-huidi-catalog]", source)
        self.assertIn(".side [data-huidi-service]", source)
        self.assertIn("#huidiBusinessBack", source)
        self.assertIn("#huidiServiceBack", source)
        self.assertIn("#pbBackdrop", source)
        self.assertIn("#huidiIntelBack", source)
        self.assertIn("#sqBack", source)
        self.assertIn("#auBack", source)
        subprocess.run(["node", "--check", str(WEB / "page-router.js")], check=True)
        subprocess.run(["node", "--check", str(WEB / "catalog-studio-online.js")], check=True)

    def test_contacts_and_notifications_are_native_page_surfaces_not_docked_modals(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        navigation = (WEB / "daily-navigation.js").read_text(encoding="utf-8")
        self.assertIn("openNavigationPage", router)
        self.assertIn("HUIDIDailyNavigation.mount", router)
        self.assertIn("HUIDIDailyNavigation?.unmount", router)
        self.assertIn("return openNavigationPage('notifications')", router)
        self.assertIn("return openNavigationPage('contacts')", router)
        self.assertIn("hn-page-surface", navigation)
        self.assertIn("async function mount(", navigation)
        self.assertIn("function unmount()", navigation)
        self.assertIn("surface='page'", navigation)
        self.assertIn("position:static", navigation)
        self.assertIn("leaveToLead", navigation)
        self.assertIn("HUIDIWorkspacePages?.home", navigation)
        self.assertIn("Object.freeze({notifications,contacts:openContacts,mount,unmount", navigation)
        subprocess.run(["node", "--check", str(WEB / "daily-navigation.js")], check=True)

    def test_market_intelligence_is_a_native_page_surface_not_a_docked_modal(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        intelligence = (WEB / "customer-intelligence.js").read_text(encoding="utf-8")
        self.assertIn("openIntelligencePage", router)
        self.assertIn("HUIDICustomerIntelligence.mount", router)
        self.assertIn("HUIDICustomerIntelligence?.unmount", router)
        self.assertIn("return openIntelligencePage()", router)
        self.assertIn("ci-page-surface", intelligence)
        self.assertIn("function mount(", intelligence)
        self.assertIn("function unmount()", intelligence)
        self.assertIn("surface='page'", intelligence)
        self.assertIn("position:static", intelligence)
        self.assertIn("open:openDaily,mount,unmount", intelligence)
        self.assertIn("needs_source_check", intelligence)
        self.assertIn("不会自动改正式询盘事实", intelligence)
        subprocess.run(["node", "--check", str(WEB / "customer-intelligence.js")], check=True)

    def test_mail_and_service_tools_are_native_page_surfaces_not_docked_modals(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        services = (WEB / "daily-services.js").read_text(encoding="utf-8")
        self.assertIn("openServicePage", router)
        self.assertIn("HUIDIDailyServices.mount", router)
        self.assertIn("HUIDIDailyServices?.unmount", router)
        self.assertIn("return openServicePage(target)", router)
        self.assertIn("hs-page-surface", services)
        self.assertIn("async function mount(", services)
        self.assertIn("function unmount()", services)
        self.assertIn("surface='page'", services)
        self.assertIn("position:static", services)
        self.assertIn("leavePageToReplies", services)
        self.assertIn("HUIDIWorkspacePages?.home", services)
        self.assertIn("window.open(out.authorize_url,'huidi-mail-connect'", services)
        self.assertIn("Object.freeze({open,mount,unmount,close", services)
        subprocess.run(["node", "--check", str(WEB / "daily-services.js")], check=True)

    def test_audit_is_a_native_page_surface_not_a_docked_drawer(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        audit = (WEB / "audit-ui.js").read_text(encoding="utf-8")
        self.assertIn("openAuditPage", router)
        self.assertIn("HUIDIAuditUI.mount", router)
        self.assertIn("HUIDIAuditUI?.unmount", router)
        self.assertIn("return openAuditPage()", router)
        self.assertIn("au-page-surface", audit)
        self.assertIn("async function mount(", audit)
        self.assertIn("function unmount()", audit)
        self.assertIn("surface='page'", audit)
        self.assertIn("position:static", audit)
        self.assertIn("Object.freeze({open,mount,unmount", audit)
        subprocess.run(["node", "--check", str(WEB / "audit-ui.js")], check=True)

    def test_business_center_is_a_native_page_surface_not_a_docked_modal(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        business = (WEB / "business-center-ui.js").read_text(encoding="utf-8")
        self.assertIn("openBusinessPage", router)
        self.assertIn("HUIDIBusinessCenter.mount", router)
        self.assertIn("HUIDIBusinessCenter?.unmount", router)
        self.assertIn("surfaceCleanup", router)
        self.assertIn("hb-page-surface", business)
        self.assertIn("function mount(", business)
        self.assertIn("function unmount()", business)
        self.assertIn("surface='page'", business)
        self.assertIn("position:static", business)
        self.assertIn("Object.freeze({open,mount,unmount", business)
        subprocess.run(["node", "--check", str(WEB / "business-center-ui.js")], check=True)

    def test_automatic_followup_is_a_native_page_surface_not_a_docked_modal(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        sequence = (WEB / "sequence-ui.js").read_text(encoding="utf-8")
        self.assertIn("openSequencePage", router)
        self.assertIn("HUIDISequenceUI.mount", router)
        self.assertIn("HUIDISequenceUI?.unmount", router)
        self.assertIn("sq-page-surface", sequence)
        self.assertIn("function mount(", sequence)
        self.assertIn("function unmount()", sequence)
        self.assertIn("surface='page'", sequence)
        self.assertIn("position:static", sequence)
        self.assertIn("Object.freeze({open,mount,unmount", sequence)
        subprocess.run(["node", "--check", str(WEB / "sequence-ui.js")], check=True)

    def test_product_brain_is_a_native_page_surface_not_a_docked_modal(self):
        router = (WEB / "page-router.js").read_text(encoding="utf-8")
        product = (WEB / "product-brain.js").read_text(encoding="utf-8")
        self.assertIn("openProductPage", router)
        self.assertIn("HUIDIProductBrain.mount", router)
        self.assertIn("HUIDIProductBrain?.unmount", router)
        self.assertIn("pb-page-surface", product)
        self.assertIn("async function mount(", product)
        self.assertIn("function unmount()", product)
        self.assertIn("surface='page'", product)
        self.assertIn("position:static", product)
        self.assertIn("open:openManager,mount,unmount", product)
        subprocess.run(["node", "--check", str(WEB / "product-brain.js")], check=True)

    def test_detail_enhancers_are_explicit_not_global_dom_watchers(self):
        deal_facts = (WEB / "deal-facts-ui.js").read_text(encoding="utf-8")
        intelligence = (WEB / "customer-intelligence.js").read_text(encoding="utf-8")
        for source in (deal_facts, intelligence):
            self.assertNotIn("MutationObserver", source)
            self.assertNotIn("observe(document.body", source)
        self.assertIn("loadEpoch", deal_facts)
        self.assertIn("scheduleDealCard", intelligence)
        self.assertIn("dealLoadEpoch", intelligence)
        subprocess.run(["node", "--check", str(WEB / "deal-facts-ui.js")], check=True)
        subprocess.run(["node", "--check", str(WEB / "customer-intelligence.js")], check=True)

    def test_native_document_stays_inside_workspace(self):
        source = (WEB / "page-router.js").read_text(encoding="utf-8")
        self.assertIn("openNativeDocument", source)
        self.assertIn("hwpDocumentFrame", source)
        self.assertIn("u.origin!==location.origin", source)
        self.assertIn("不再打开第二个窗口", source)
        self.assertNotIn("window.open(out.url", source)

    def test_catalog_is_native_and_does_not_require_local_8765(self):
        source = (WEB / "catalog-studio-online.js").read_text(encoding="utf-8")
        self.assertIn("产品目录", source)
        self.assertIn("/api/product-brains", source)
        self.assertIn("生成 / 刷新目录预览", source)
        self.assertIn("打印 / 另存 PDF", source)
        self.assertIn("下载 HTML", source)
        self.assertIn("selected=new Set", source)
        self.assertNotIn("catalog-studio/index.html", source)
        self.assertNotIn("127.0.0.1:8765", source)
        self.assertNotIn("localhost:8765", source)

    def test_catalog_uses_real_product_fields_only(self):
        source = (WEB / "catalog-studio-online.js").read_text(encoding="utf-8")
        for token in ["name", "sku", "spec", "moq", "lead_time", "certifications", "price_range"]:
            self.assertIn(token, source)
        self.assertIn("暂无产品图片", source)
        self.assertIn("不写入正式报价", source)
        self.assertNotIn("Demo Product", source)
        self.assertNotIn("示例产品", source)


if __name__ == "__main__":
    unittest.main()