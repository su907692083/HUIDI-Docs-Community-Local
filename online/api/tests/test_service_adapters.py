import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-only-adapter-secret")

from fastapi import HTTPException  # noqa: E402
from app.daily_app import app  # noqa: F401,E402
from app.main import SessionLocal  # noqa: E402
from app.service_adapters import (  # noqa: E402
    ServiceAdapterSetting,
    _validate_endpoint,
    execute_service_request,
    public_adapter_status,
)
from app.service_connections import ServiceConnection, _encrypt  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class FakeResponse:
    status_code = 200
    text = '{"ok":true}'

    def json(self):
        return {"ok": True}


class FakeClient:
    last_call = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def post(self, url, headers=None, params=None, json=None):
        FakeClient.last_call = {"method": "POST", "url": url, "headers": headers or {}, "params": params or {}, "json": json or {}}
        return FakeResponse()

    def get(self, url, headers=None, params=None):
        FakeClient.last_call = {"method": "GET", "url": url, "headers": headers or {}, "params": params or {}}
        return FakeResponse()


class ServiceAdapterTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        self.old_private = os.environ.get("HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS")
        os.environ.pop("HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS", None)

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template
        if self.old_private is None:
            os.environ.pop("HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS", None)
        else:
            os.environ["HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS"] = self.old_private

    def _configure(self, tmp, org):
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = f"sqlite:///{Path(tmp) / 'adapter-{organization_id}.db'}"
        token = set_current_organization(org)
        db = SessionLocal()
        db.add(ServiceConnection(service_key="company", endpoint_url="https://data.example/company", encrypted_token=_encrypt("secret-key"), enabled=1))
        db.commit()
        return token, db

    def test_bearer_header_adapter(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._configure(tmp, 892001)
            try:
                db.add(ServiceAdapterSetting(service_key="company", adapter_key="post_bearer_json"))
                db.commit()
                with patch("app.service_adapters.httpx.Client", FakeClient):
                    out = execute_service_request(db, "company", {"company": "Buyer"})
                self.assertTrue(out["ok"])
                self.assertEqual(FakeClient.last_call["method"], "POST")
                self.assertEqual(FakeClient.last_call["headers"].get("Authorization"), "Bearer secret-key")
            finally:
                db.close(); reset_current_organization(token)

    def test_header_key_adapter(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._configure(tmp, 892002)
            try:
                db.add(ServiceAdapterSetting(service_key="company", adapter_key="post_key_header_json", credential_name="X-Data-Key"))
                db.commit()
                with patch("app.service_adapters.httpx.Client", FakeClient):
                    execute_service_request(db, "company", {"company": "Buyer"})
                self.assertEqual(FakeClient.last_call["headers"].get("X-Data-Key"), "secret-key")
                self.assertNotIn("Authorization", FakeClient.last_call["headers"])
            finally:
                db.close(); reset_current_organization(token)

    def test_query_key_get_adapter(self):
        with tempfile.TemporaryDirectory() as tmp:
            token, db = self._configure(tmp, 892003)
            try:
                db.add(ServiceAdapterSetting(service_key="company", adapter_key="get_key_query", credential_name="token"))
                db.commit()
                with patch("app.service_adapters.httpx.Client", FakeClient):
                    execute_service_request(db, "company", {"company": "Buyer", "country": "DE"})
                self.assertEqual(FakeClient.last_call["method"], "GET")
                self.assertEqual(FakeClient.last_call["params"]["token"], "secret-key")
                self.assertEqual(FakeClient.last_call["params"]["company"], "Buyer")
            finally:
                db.close(); reset_current_organization(token)

    def test_adapter_settings_are_company_isolated_and_public_status_has_no_secret(self):
        with tempfile.TemporaryDirectory() as tmp:
            token_a, db_a = self._configure(tmp, 892101)
            try:
                db_a.add(ServiceAdapterSetting(service_key="company", adapter_key="post_key_header_json", credential_name="X-Key"))
                db_a.commit()
                status = public_adapter_status(db_a, "company")
                self.assertEqual(status["adapter_key"], "post_key_header_json")
                self.assertNotIn("secret", str(status).lower())
            finally:
                db_a.close(); reset_current_organization(token_a)

            token_b = set_current_organization(892102)
            try:
                db_b = SessionLocal()
                try:
                    self.assertEqual(db_b.query(ServiceAdapterSetting).count(), 0)
                    self.assertEqual(public_adapter_status(db_b, "company")["adapter_key"], "post_bearer_json")
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)

    def test_private_or_local_service_endpoints_are_blocked_by_default(self):
        for url in ["http://127.0.0.1:8080/data", "http://localhost/data", "http://10.10.0.8/data"]:
            with self.subTest(url=url):
                with self.assertRaises(HTTPException) as ctx:
                    _validate_endpoint(url)
                self.assertEqual(ctx.exception.status_code, 400)

    def test_private_service_endpoint_requires_explicit_opt_in(self):
        os.environ["HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS"] = "1"
        _validate_endpoint("http://127.0.0.1:8080/data")


if __name__ == "__main__":
    unittest.main()
