import unittest
from pathlib import Path


WEB = Path(__file__).resolve().parents[1] / "web"


class FrontendRuntimeSafetyContractTests(unittest.TestCase):
    def test_plain_language_mutation_observer_is_idempotent_and_batched(self):
        source = (WEB / "plain-language.js").read_text(encoding="utf-8")
        self.assertIn("function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}", source)
        self.assertIn("requestAnimationFrame(flushObserved)", source)
        self.assertIn("const pendingNodes=new Set()", source)
        self.assertNotIn("if(small)small.textContent=", source)
        self.assertNotIn("if(note)note.textContent=", source)
        self.assertNotIn("if(manage)manage.textContent=", source)

        observe_start = source.index("function observe()")
        observe_end = source.index("function wrapAlerts()")
        observer_body = source[observe_start:observe_end]
        self.assertNotIn("friendlyResults(document)", observer_body)
        self.assertNotIn("polishMail();polishGrowth();friendlyResults(document)", observer_body)

    def test_plain_language_observer_does_not_watch_character_data(self):
        source = (WEB / "plain-language.js").read_text(encoding="utf-8")
        self.assertIn("characterData:false", source)


if __name__ == "__main__":
    unittest.main()
