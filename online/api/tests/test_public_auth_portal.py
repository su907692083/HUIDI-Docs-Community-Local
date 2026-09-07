import os
import unittest
import uuid

from fastapi.testclient import TestClient

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-public-auth-secret-key-2026")

from app.daily_app import app  # noqa: E402


class PublicAuthPortalTests(unittest.TestCase):
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
        email = f"auth-{label}-{uuid.uuid4().hex[:12]}@example.test"
        response = client.post(
            "/api/auth/register",
            json={
                "account_type": "individual",
                "display_name": label,
                "organization_name": "",
                "email": email,
                "password": "correct-horse-2026",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertGreater(int(payload["organization"]["id"]), 1)
        self.assertEqual(payload["isolation"], "physical_database_per_organization")
        return email, payload

    def test_anonymous_business_routes_are_blocked_and_root_redirects(self):
        client = TestClient(app, follow_redirects=False)
        root = client.get("/")
        self.assertEqual(root.status_code, 303)
        self.assertEqual(root.headers.get("location"), "/login")
        business = client.get("/api/leads?paged=1")
        self.assertEqual(business.status_code, 401)
        login_page = client.get("/login")
        self.assertEqual(login_page.status_code, 200)
        self.assertIn("HUIDI Online", login_page.text)

    def test_two_public_accounts_receive_physically_separate_business_data(self):
        first = TestClient(app)
        second = TestClient(app)
        _, one = self._register(first, "甲工作区")
        _, two = self._register(second, "乙工作区")
        self.assertNotEqual(one["organization"]["id"], two["organization"]["id"])

        marker_a = "Tenant-A-" + uuid.uuid4().hex[:10]
        marker_b = "Tenant-B-" + uuid.uuid4().hex[:10]
        created_a = first.post(
            "/api/leads/manual",
            json={"company_name": marker_a, "country": "DE", "create_inquiry": False},
        )
        self.assertEqual(created_a.status_code, 200, created_a.text)
        created_b = second.post(
            "/api/leads/manual",
            json={"company_name": marker_b, "country": "JP", "create_inquiry": False},
        )
        self.assertEqual(created_b.status_code, 200, created_b.text)

        rows_a = first.get("/api/leads?paged=1&page_size=200").json()["items"]
        rows_b = second.get("/api/leads?paged=1&page_size=200").json()["items"]
        names_a = {row["company_name"] for row in rows_a}
        names_b = {row["company_name"] for row in rows_b}
        self.assertIn(marker_a, names_a)
        self.assertNotIn(marker_b, names_a)
        self.assertIn(marker_b, names_b)
        self.assertNotIn(marker_a, names_b)

    def test_password_login_and_reset_contract(self):
        client = TestClient(app)
        email, _ = self._register(client, "密码测试")
        self.assertEqual(client.post("/api/team/logout", json={}).status_code, 200)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "password": "correct-horse-2026"},
        )
        self.assertEqual(login.status_code, 200, login.text)
        invalid = client.post(
            "/api/auth/password/reset",
            json={"token": "not-a-real-reset-token-value", "password": "new-password-2026"},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_public_auth_status_does_not_expose_other_account_counts(self):
        client = TestClient(app)
        response = client.get("/api/auth/status")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["isolation"], "physical_database_per_organization")
        self.assertNotIn("members", payload)
        self.assertNotIn("organizations", payload)


if __name__ == "__main__":
    unittest.main()
