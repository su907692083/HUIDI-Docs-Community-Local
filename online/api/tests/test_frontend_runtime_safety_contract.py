import unittest
from pathlib import Path


WEB = Path(__file__).resolve().parents[1] / "web"


class FrontendRuntimeSafetyContractTests(unittest.TestCase):
    def test_plain_language_is_idempotent_and_action_driven(self):
        source = (WEB / "plain-language.js").read_text(encoding="utf-8")
        self.assertIn("function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}", source)
        self.assertIn("function scheduleSweepBurst()", source)
        self.assertIn("requestAnimationFrame(sweep)", source)
        self.assertNotIn("MutationObserver", source)
        self.assertNotIn("pendingNodes", source)
        self.assertNotIn("if(small)small.textContent=", source)
        self.assertNotIn("if(note)note.textContent=", source)
        self.assertNotIn("if(manage)manage.textContent=", source)

    def test_mail_owner_is_idempotent_and_action_driven(self):
        source = (WEB / "mail-owner-v3.js").read_text(encoding="utf-8")
        self.assertIn("function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}", source)
        self.assertIn("function schedulePolishBurst()", source)
        self.assertIn("requestAnimationFrame(()=>{polishQueued=false;polish()})", source)
        self.assertNotIn("MutationObserver", source)
        self.assertNotIn("n.textContent=n.textContent.replace", source)
        self.assertIn("if(n.textContent!==next)n.textContent=next", source)

    def test_mail_enhancers_are_action_driven_not_global_dom_watchers(self):
        pagination = (WEB / "mail-list-pagination-ui.js").read_text(encoding="utf-8")
        threads = (WEB / "mail-thread-ui.js").read_text(encoding="utf-8")
        for source in (pagination, threads):
            self.assertNotIn("MutationObserver", source)
            self.assertNotIn("observe(document.body", source)
            self.assertIn("window.addEventListener('click'", source)
        self.assertIn("scheduleRefreshBurst", pagination)
        self.assertIn("scheduleEnsureBurst", threads)

    def test_legacy_mail_usability_layer_yields_navigation_to_workspace_router(self):
        source = (WEB / "workflow-usability-closure.js").read_text(encoding="utf-8")
        self.assertIn("if(window.HUIDIWorkspacePages?.open)return", source)
        self.assertIn("function interceptMailNavigation", source)
        self.assertNotIn("MutationObserver", source)

    def test_secondary_modal_closure_excludes_native_page_surfaces(self):
        source = (WEB / "secondary-page-closure.js").read_text(encoding="utf-8")
        for token in [
            "hn-page-surface",
            "hb-page-surface",
            "hs-page-surface",
            "ci-page-surface",
            "sq-page-surface",
            "pb-page-surface",
            "au-page-surface",
        ]:
            self.assertIn(token, source)
        self.assertIn("function pageSurface(el)", source)
        self.assertIn("if(pageSurface(el))return false", source)
        self.assertIn("p.removeAttribute('aria-modal')", source)
        self.assertIn("HUIDIWorkspacePages.open('mail')", source)
        self.assertNotIn("MutationObserver", source)

    def test_layout_enhancement_owners_do_not_watch_the_whole_document(self):
        for name in ["workflow-usability-closure.js", "secondary-page-closure.js"]:
            source = (WEB / name).read_text(encoding="utf-8")
            self.assertIn("scheduleRefreshBurst", source, name)
            self.assertNotIn("MutationObserver", source, name)


if __name__ == "__main__":
    unittest.main()