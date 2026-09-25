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

    def _deal_id(self) -> int:
        deal_id = getattr(self.__class__, "deal_id", None)
        if not deal_id:
            self.test_manual_real_customer_can_become_inquiry_without_provider()
            deal_id = self.__class__.deal_id
        return int(deal_id)

    def test_all_five_documents_generate_inside_online(self):
        deal_id = self._deal_id()
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
            self.assertIn("document-context", data["context_url"])
            self.assertNotIn("8765", data["url"])
            page = self.client.get(data["url"])
            self.assertEqual(page.status_code, 200, page.text)
            self.assertIn(label, page.text)
            self.assertIn("Standalone Contract Buyer", page.text)
            self.assertIn("stainless steel hinge", page.text.lower())
            self.assertIn("打印 / 另存 PDF", page.text)
            self.assertIn("保存草稿", page.text)
            self.assertNotIn("online-bridge.html", page.text)
            if document_type != "packing_list":
                self.assertIn("data-k='unit_price' value=''", page.text)
                self.assertNotIn("data-k='unit_price' value='1.25'", page.text)
                if "产品资料参考价" in page.text:
                    self.assertIn("仅供核对，不会自动写入正式单价", page.text)

    def test_durable_draft_connects_real_master_data_and_preserves_snapshot_without_price_autofill(self):
        deal_id = self._deal_id()
        before = self.client.get(f"/api/business/deals/{deal_id}")
        self.assertEqual(before.status_code, 200, before.text)
        deal = before.json()
        amount_before = deal["amount"]
        customer_id = int(deal["customer_id"])

        company = self.client.put(
            "/api/company-settings",
            json={
                "company_name": "HUIDI Metal Works",
                "legal_name": "HUIDI Metal Works Ltd",
                "country": "CN",
                "address": "88 Export Road, Ningbo, Zhejiang, China",
                "phone": "+86 574 1234 5678",
                "email": "sales@huidi.example",
                "tax_id": "CN-TEST-001",
            },
        )
        self.assertEqual(company.status_code, 200, company.text)
        bank = self.client.post(
            "/api/company-settings/bank-accounts",
            json={
                "label": "USD main",
                "bank_name": "Bank of Test",
                "account_name": "HUIDI Metal Works Ltd",
                "account_number": "62220000000001",
                "swift_code": "DEUTTESTXXX",
                "bank_address": "1 Finance Street, Ningbo",
                "currency": "USD",
                "is_default": True,
            },
        )
        self.assertEqual(bank.status_code, 200, bank.text)
        bank_id = int(bank.json()["bank_account"]["id"])
        address = self.client.post(
            f"/api/business/customers/{customer_id}/addresses",
            json={
                "address_type": "shipping",
                "label": "Germany warehouse",
                "contact_name": "Purchasing",
                "phone": "+49 30 123456",
                "country": "DE",
                "city": "Berlin",
                "postal_code": "10115",
                "address_line1": "Werkstrasse 8",
                "is_default": True,
            },
        )
        self.assertEqual(address.status_code, 200, address.text)
        address_id = int(address.json()["address"]["id"])

        quote = self.client.post(
            f"/api/business/deals/{deal_id}/native-document",
            json={"document_type": "quotation"},
        )
        self.assertEqual(quote.status_code, 200, quote.text)
        quote_id = int(quote.json()["id"])
        quote_context = self.client.get(
            f"/api/business/deals/{deal_id}/document-context",
            params={"document": "quotation", "current_ref_id": quote_id},
        )
        self.assertEqual(quote_context.status_code, 200, quote_context.text)
        master = quote_context.json()
        self.assertTrue(master["availability"]["customer_address_history"]["available"])
        self.assertTrue(master["availability"]["seller_bank_accounts"]["available"])
        self.assertEqual(master["master_fields"]["seller"], "HUIDI Metal Works Ltd")
        self.assertIn("Werkstrasse 8", master["master_fields"]["buyer_address"])
        self.assertEqual(master["master_fields"]["bank_name"], "Bank of Test")
        self.assertNotIn("unit_price", master["master_fields"])

        quote_page = self.client.get(quote.json()["url"])
        self.assertEqual(quote_page.status_code, 200, quote_page.text)
        self.assertIn("HUIDI Metal Works Ltd", quote_page.text)
        self.assertIn("Werkstrasse 8", quote_page.text)
        self.assertIn("Bank of Test", quote_page.text)
        self.assertIn("DEUTTESTXXX", quote_page.text)
        self.assertIn("data-k='unit_price' value=''", quote_page.text)

        saved = self.client.put(
            f"/api/business/documents/{quote_id}/draft",
            json={
                "fields": {
                    "seller": "HUIDI Metal Works Ltd",
                    "seller_address": "88 Export Road, Ningbo, Zhejiang, China",
                    "buyer_address_id": str(address_id),
                    "buyer_address": "Werkstrasse 8, 10115 Berlin DE",
                    "buyer_phone": "+49 30 123456",
                    "bank_account_id": str(bank_id),
                    "bank_label": "USD main",
                    "bank_name": "Bank of Test",
                    "bank_account_name": "HUIDI Metal Works Ltd",
                    "bank_account_number": "62220000000001",
                    "bank_swift": "DEUTTESTXXX",
                    "bank_address": "1 Finance Street, Ningbo",
                    "bank_currency": "USD",
                    "quantity": "7200 pcs",
                    "payment": "T/T 30% deposit",
                    "terms": "Artwork confirmed before production.",
                    "unit_price": "8.50",
                    "total": "61200",
                }
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["fields"]["unit_price"], "8.50")

        self.assertEqual(
            self.client.delete(f"/api/business/customers/{customer_id}/addresses/{address_id}").status_code,
            200,
        )
        self.assertEqual(self.client.delete(f"/api/company-settings/bank-accounts/{bank_id}").status_code, 200)

        reopened = self.client.get(quote.json()["url"])
        self.assertEqual(reopened.status_code, 200, reopened.text)
        self.assertIn("data-k='unit_price' value='8.50'", reopened.text)
        self.assertIn("Werkstrasse 8, 10115 Berlin DE", reopened.text)
        self.assertIn("Bank of Test", reopened.text)

        pi = self.client.post(
            f"/api/business/deals/{deal_id}/native-document",
            json={"document_type": "proforma_invoice"},
        )
        self.assertEqual(pi.status_code, 200, pi.text)
        pi_id = int(pi.json()["id"])
        context = self.client.get(
            f"/api/business/deals/{deal_id}/document-context",
            params={"document": "proforma_invoice", "current_ref_id": pi_id},
        )
        self.assertEqual(context.status_code, 200, context.text)
        data = context.json()
        self.assertEqual(data["schema"], "huidi.document.context/v1")
        self.assertEqual(data["inherited_fields"]["seller"], "HUIDI Metal Works Ltd")
        self.assertEqual(data["inherited_fields"]["quantity"], "7200 pcs")
        self.assertEqual(data["inherited_fields"]["payment"], "T/T 30% deposit")
        self.assertEqual(data["inherited_fields"]["terms"], "Artwork confirmed before production.")
        self.assertIn("Werkstrasse 8", data["inherited_fields"]["buyer_address"])
        self.assertEqual(data["inherited_fields"]["bank_name"], "Bank of Test")
        self.assertNotIn("unit_price", data["inherited_fields"])
        self.assertNotIn("total", data["inherited_fields"])
        self.assertTrue(any(x.get("source") == "upstream_document" for x in data["price_references"]))
        self.assertFalse(data["availability"]["customer_address_history"]["available"])
        self.assertFalse(data["availability"]["seller_bank_accounts"]["available"])

        pi_page = self.client.get(pi.json()["url"])
        self.assertEqual(pi_page.status_code, 200, pi_page.text)
        self.assertIn("value='7200 pcs'", pi_page.text)
        self.assertIn("T/T 30% deposit", pi_page.text)
        self.assertIn("Werkstrasse 8", pi_page.text)
        self.assertIn("Bank of Test", pi_page.text)
        self.assertIn("data-k='unit_price' value=''", pi_page.text)
        self.assertIn("仅供返单/议价核对", pi_page.text)

        after = self.client.get(f"/api/business/deals/{deal_id}")
        self.assertEqual(after.status_code, 200, after.text)
        self.assertEqual(after.json()["amount"], amount_before)

    def test_manual_entry_and_document_navigation_have_separate_single_owners(self):
        standalone = (WEB / "standalone-business-ui.js").read_text(encoding="utf-8")
        business = (WEB / "business-center-ui.js").read_text(encoding="utf-8")
        company = (WEB / "company-settings.js").read_text(encoding="utf-8")
        index = (WEB / "index.html").read_text(encoding="utf-8")
        self.assertIn("/api/leads/manual", standalone)
        self.assertNotIn("/native-document", standalone)
        self.assertNotIn("data-make-doc", standalone)
        self.assertNotIn("stopImmediatePropagation", standalone)
        self.assertNotIn("MutationObserver", standalone)
        self.assertIn("/native-document", business)
        self.assertIn("/api/business/customers/${id}", business)
        self.assertIn("/addresses", business)
        self.assertIn("/api/company-settings/bank-accounts", company)
        self.assertIn("HUIDIWorkspacePages?.openDocument", business)
        self.assertNotIn("online-bridge.html", business)
        self.assertNotIn("127.0.0.1:8765", business)
        self.assertIn("standalone-business-ui.js", index)
        subprocess.run(["node", "--check", str(WEB / "standalone-business-ui.js")], check=True)
        subprocess.run(["node", "--check", str(WEB / "business-center-ui.js")], check=True)
        subprocess.run(["node", "--check", str(WEB / "company-settings.js")], check=True)

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
