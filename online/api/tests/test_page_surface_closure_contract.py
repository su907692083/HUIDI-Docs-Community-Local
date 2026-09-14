from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class PageSurfaceClosureContractTests(unittest.TestCase):
    def test_surface_closure_loads_between_lead_owner_and_workspace_router(self):
        index = (WEB / "index.html").read_text(encoding="utf-8")
        app_pos = index.index('/assets/app.js')
        closure_pos = index.index('/assets/page-surface-closure.js')
        router_pos = index.index('/assets/page-router.js')
        self.assertLess(app_pos, closure_pos)
        self.assertLess(closure_pos, router_pos)
        subprocess.run(["node", "--check", str(WEB / "page-surface-closure.js")], check=True)

    def test_lead_detail_uses_existing_owner_as_native_workspace_page(self):
        closure = (WEB / "page-surface-closure.js").read_text(encoding="utf-8")
        css = (WEB / "app.css").read_text(encoding="utf-8")
        self.assertIn("rawLeadOpen=owner.open", closure)
        self.assertIn("open:()=>rawLeadOpen(leadId)", closure)
        self.assertIn("selector:'#backdrop'", closure)
        self.assertIn("window.HUIDIWorkspacePages.mount", closure)
        self.assertIn("lead-page-surface", closure)
        self.assertIn("#tbody [data-open]", closure)
        self.assertIn(".drawer-backdrop.lead-page-surface", css)
        self.assertIn("position:static", css)
        self.assertNotIn("fetch(", closure)
        self.assertNotIn("/api/", closure)

    def test_management_surfaces_reuse_existing_single_owners(self):
        closure = (WEB / "page-surface-closure.js").read_text(encoding="utf-8")
        expected = {
            "company-settings": "HUIDICompanySettings",
            "service-settings": "HUIDIServiceSettings",
            "notification-settings": "HUIDINotificationSettings",
            "admin-safety": "HUIDIAdminSafety",
            "team-settings": "HUIDITeamAccess",
        }
        for route, owner in expected.items():
            self.assertIn(f"'{route}'", closure)
            self.assertIn(owner, closure)
        self.assertIn("loginGuard:n=>n.classList.contains('ta-login')", closure)
        self.assertIn("hpsc-surface", closure)
        self.assertIn("display:block!important", closure)
        self.assertIn("box-shadow:none!important", closure)
        self.assertNotIn("class HUIDI", closure)
        self.assertNotIn("localStorage", closure)

    def test_user_visible_surfaces_close_duplicate_nav_and_legacy_popup_shells(self):
        closure = (WEB / "page-surface-closure.js").read_text(encoding="utf-8")
        self.assertIn("new Set(['客户回复','提醒方式','邮箱设置'])", closure)
        self.assertIn("data-huidi-notification-routes-inline", closure)
        self.assertIn(".hn-back.hn-page-surface>.hn-modal{min-height:0!important", closure)
        self.assertIn(".hn-back.hn-page-surface .hn-head{display:none!important}", closure)
        self.assertIn("normalizeSurface(node)", closure)
        self.assertIn("requestAnimationFrame(()=>normalizeSurface(node))", closure)
        self.assertIn("window.alert=msg=>toast(msg)", closure)
        self.assertIn("window.__huidiFriendlyAlert=true", closure)

    def test_management_and_lead_pages_are_not_reclassified_as_modals(self):
        secondary = (WEB / "secondary-page-closure.js").read_text(encoding="utf-8")
        self.assertIn("'hpsc-surface'", secondary)
        self.assertIn("'lead-page-surface'", secondary)
        self.assertIn("if(pageSurface(el))return false", secondary)
        self.assertIn("p.removeAttribute('aria-modal')", secondary)

    def test_surface_safety_observer_is_scoped_to_page_mount_only(self):
        closure = (WEB / "page-surface-closure.js").read_text(encoding="utf-8")
        self.assertEqual(closure.count("new MutationObserver"), 1)
        self.assertIn("const m=$('#huidiPageMount')", closure)
        self.assertIn("mountObserver.observe(m,{childList:true,subtree:true})", closure)
        self.assertNotIn("observe(document.body", closure)
        self.assertNotIn("MutationObserver(document.body", closure)
        self.assertNotIn("document.documentElement", closure)

    def test_only_short_auth_and_confirmation_flows_remain_modal_by_policy(self):
        closure = (WEB / "page-surface-closure.js").read_text(encoding="utf-8")
        team = (WEB / "team-access.js").read_text(encoding="utf-8")
        services = (WEB / "daily-services.js").read_text(encoding="utf-8")
        self.assertIn("loginGuard", closure)
        self.assertIn("ta-login", team)
        self.assertIn("window.open('about:blank','huidi-mail-connect'", services)
        self.assertIn('popup.location.href=dest.href', services)
        self.assertNotIn("authorize_url", closure)


if __name__ == "__main__":
    unittest.main()
