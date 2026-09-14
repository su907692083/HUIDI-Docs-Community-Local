import os
import unittest
import uuid

from fastapi.testclient import TestClient

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-community-tenant-secret-key-2026")

from app.daily_app import app  # noqa: E402


class CommunityTenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self.previous_access = os.environ.get("HUIDI_TEAM_ACCESS")
        self.previous_signup = os.environ.get("HUIDI_SIGNUP_ENABLED")
        os.environ["HUIDI_TEAM_ACCESS"] = "1"
        os.environ["HUIDI_SIGNUP_ENABLED"] = "1"

    def tearDown(self):
        if self.previous_access is None:
            os.environ.pop("HUIDI_TEAM_ACCESS", None)
        else:
            os.environ["HUIDI_TEAM_ACCESS"] = self.previous_access
        if self.previous_signup is None:
            os.environ.pop("HUIDI_SIGNUP_ENABLED", None)
        else:
            os.environ["HUIDI_SIGNUP_ENABLED"] = self.previous_signup

    def _register(self, client: TestClient, label: str):
        email = f"community-{label}-{uuid.uuid4().hex[:10]}@example.test"
        response = client.post(
            "/api/auth/register",
            json={
                "account_type": "individual",
                "display_name": label,
                "organization_name": "",
                "email": email,
                "password": "community-password-2026",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _save_marker(self, client: TestClient, marker: str):
        payload = {
            "customers": [
                {
                    "id": f"customer-{marker}",
                    "company": f"Customer {marker}",
                    "contact": marker,
                    "email": f"{marker.lower()}@example.test",
                }
            ],
            "products": [
                {
                    "id": f"product-{marker}",
                    "name": f"Product {marker}",
                    "sku": marker,
                    "price": "12.50",
                    "currency": "USD",
                }
            ],
            "deals": [
                {
                    "id": f"deal-{marker}",
                    "customer_id": f"customer-{marker}",
                    "title": f"Deal {marker}",
                    "product_ids": [f"product-{marker}"],
                    "currency": "USD",
                    "estimated_amount": 1250,
                }
            ],
            "archived": {},
        }
        response = client.put("/api/community-sync/state", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_two_accounts_get_distinct_browser_scope_and_cloud_business_data(self):
        first = TestClient(app)
        second = TestClient(app)
        one = self._register(first, "scope-a")
        two = self._register(second, "scope-b")
        self.assertNotEqual(one["organization"]["id"], two["organization"]["id"])

        page_a = first.get("/community/workspace.html")
        page_b = second.get("/community/workspace.html")
        self.assertEqual(page_a.status_code, 200, page_a.text[:300])
        self.assertEqual(page_b.status_code, 200, page_b.text[:300])
        scope_a = first.cookies.get("huidi_workspace_scope")
        scope_b = second.cookies.get("huidi_workspace_scope")
        self.assertEqual(scope_a, f"org-{one['organization']['id']}")
        self.assertEqual(scope_b, f"org-{two['organization']['id']}")
        self.assertNotEqual(scope_a, scope_b)

        marker_a = "A" + uuid.uuid4().hex[:8]
        marker_b = "B" + uuid.uuid4().hex[:8]
        saved_a = self._save_marker(first, marker_a)
        saved_b = self._save_marker(second, marker_b)
        self.assertTrue(saved_a["ok"])
        self.assertTrue(saved_b["ok"])

        bootstrap_a = first.get("/api/community-sync/bootstrap")
        bootstrap_b = second.get("/api/community-sync/bootstrap")
        self.assertEqual(bootstrap_a.status_code, 200, bootstrap_a.text)
        self.assertEqual(bootstrap_b.status_code, 200, bootstrap_b.text)
        text_a = bootstrap_a.text
        text_b = bootstrap_b.text
        self.assertIn(marker_a, text_a)
        self.assertNotIn(marker_b, text_a)
        self.assertIn(marker_b, text_b)
        self.assertNotIn(marker_a, text_b)

    def test_logout_removes_readable_cache_scope_cookie(self):
        client = TestClient(app)
        self._register(client, "logout")
        page = client.get("/community/workspace.html")
        self.assertEqual(page.status_code, 200, page.text[:300])
        self.assertTrue(client.cookies.get("huidi_workspace_scope"))
        logout = client.post("/api/team/logout", json={})
        self.assertEqual(logout.status_code, 200, logout.text)
        self.assertIsNone(client.cookies.get("huidi_workspace_scope"))


if __name__ == "__main__":
    unittest.main()
