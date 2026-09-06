from __future__ import annotations

import os
import subprocess
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("HUIDI_SECRET_KEY", "standalone-business-test")
os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_TEAM_ACCESS", "0")

from app.daily_app import app  # noqa: E402


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class StandaloneBusinessContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url="http://127.0.0.1:8080")

    def test_manual_real_customer_can_become_inquiry_without_provider(self):
        response = self.client.post(
            "/api/leads/manual",
            json={
                "company_name": "Standalone Contract Buyer",
                "product_keyword": "stainless steel hinge",
                "country": "DE",
                "contact_name": "Purchasing",
                "contact_email": "purchasing@standalone-contract.example",
                "requirements": "Quantity: 5000 pcs, FOB Ningbo, SUS304 4 inch",
                "create_inquiry": True,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["lead"]["company_name"], "Standalone Contract Buyer")
        self.assertEqual(payload["deal"]["product_keyword"], "stainless steel hinge")
        self.assertIn("5000 pcs", payload["deal"]["requirements"])
        self.__class__.deal_id = int(payload["deal"]["id"])

    def test_all_five_documents_generate_inside_online(self):
        deal_id = getattr(self.__class__, "deal_id", None)
        if not deal_id:
            self.test_manual_real_customer_can_become_inquiry_without_provider()
            deal_id = self.__class__.deal_id
        types = {
            "quotation": "报价单",
            "proforma_invoice": "形式发票 PI",
            "sales_contract": "销售合同",
            "commercial_invoice": "商业发票 CI",
            "packing_list": "装箱单",
        }
        for document_type, label in types.items():
            created = self.client.post(
                f"/api/business/deals/{deal_id}/native-document",
                json={"document_type": document_type},
            )
            self.assertEqual(created.status_code, 200, created.text)
            data = created.json()
            self.assertTrue(data["url"].startswith("/documents/online/"))
            self.assertNotIn("8765", data["url"])
            page = self.client.get(data["url"])
            self.assertEqual(page.status_code, 200, page.text)
            self.assertIn(label, page.text)
            self.assertIn("Standalone Contract Buyer", page.text)
            self.assertIn("stainless steel hinge", page.text.lower())
            self.assertIn("打印 / 另存 PDF", page.text)
            self.assertNotIn("online-bridge.html", page.text)
            if document_type != "packing_list":
                self.assertIn("data-k='unit_price' value=''", page.text)
                self.assertNotIn("data-k='unit_price' value='1.25'", page.text)
                if "产品资料参考价" in page.text:
                    self.assertIn("仅供核对，不会自动写入正式单价", page.text)

    def test_standalone_ui_intercepts_old_local_document_button(self):
        source = (WEB / "standalone-business-ui.js").read_text(encoding="utf-8")
        index = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("/api/leads/manual", source)
        self.assertIn("/native-document", source)
        self.assertIn("stopImmediatePropagation", source)
        self.assertNotIn("MutationObserver", source)
        self.assertIn("standalone-business-ui.js", index)
        subprocess.run(["node", "--check", str(WEB / "standalone-business-ui.js")], check=True)

    def test_readiness_distinguishes_core_from_connected_automation(self):
        response = self.client.get("/api/standalone/readiness")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertTrue(data["core"]["manual_customer"])
        self.assertTrue(data["core"]["quotation"])
        self.assertTrue(data["core"]["packing_list"])
        self.assertIn("联网服务", data["note"])


if __name__ == "__main__":
    unittest.main()
