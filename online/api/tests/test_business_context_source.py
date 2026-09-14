import unittest
from pathlib import Path


class BusinessContextSourceTests(unittest.TestCase):
    def test_connected_tools_receive_current_customer_context(self):
        text = (Path(__file__).resolve().parents[1] / "web" / "business-context.js").read_text(encoding="utf-8")
        self.assertIn("[data-open]", text)
        self.assertIn("data.lead_id=Number(leadId)", text)
        for path in [
            "/api/tools/trade-news",
            "/api/tools/tariff",
            "/api/tools/fx",
            "/api/tools/shipping",
        ]:
            self.assertIn(path, text)

    def test_context_script_loads_before_connected_tools(self):
        html = (Path(__file__).resolve().parents[1] / "web" / "index.html").read_text(encoding="utf-8")
        context_at = html.index('/assets/business-context.js')
        tools_at = html.index('/assets/daily-services.js')
        self.assertLess(context_at, tools_at)


if __name__ == "__main__":
    unittest.main()
