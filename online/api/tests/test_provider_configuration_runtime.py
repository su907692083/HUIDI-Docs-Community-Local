"""No live credentials or external sends: real routes/storage, mocked upstream HTTP."""
from __future__ import annotations

import asyncio
import itertools
import json
import os
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "isolated-provider-settings-test-only")
from app.daily_app import app
from app.main import Lead, LeadSearchRequest, SessionLocal, serper_query
from app.service_connections import ServiceConnection, _decrypt, test_resolved_service
from app.provider_settings import resolve_provider, public_provider_status, provider_ready, test_provider, save_provider
from app.mail_provider import begin_connection, provider_config
from app.service_adapters import execute_service_request
from app.acquisition_provider_fusion import _company_search_with_failover, _hunter_domain_search
from app.tenant_storage import set_current_organization, reset_current_organization

IDS = itertools.count(890501)


class Upstream:
    calls = []
    payload = {}
    status = 200
    body = None
    fail = None

    def __init__(self, *a, **kw):
        pass

    def __enter__(self): return self
    def __exit__(self, *a): return False
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False
    @classmethod
    def answer(cls, method, url, **kw):
        cls.calls.append({"method": method, "url": url, **kw})
        if cls.fail: raise cls.fail
        req = httpx.Request(method, url)
        return httpx.Response(cls.status, request=req, text=cls.body) if cls.body is not None else httpx.Response(cls.status, request=req, json=cls.payload)
    def get(self, url, **kw): return self.answer("GET", url, **kw)
    def post(self, url, **kw): return self.answer("POST", url, **kw)


class AsyncUpstream(Upstream):
    async def get(self, url, **kw): return self.answer("GET", url, **kw)
    async def post(self, url, **kw): return self.answer("POST", url, **kw)


class ProviderConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.org = next(IDS)
        self.token = set_current_organization(self.org)
        env = {"HUIDI_TEAM_ACCESS": "0", "HUIDI_PUBLIC_BASE_URL": "https://workspace.example.test", "HUIDI_SECRET_KEY": "isolated-provider-settings-test-only"}
        env.update({name: "" for name in ("SERPER_API_KEY", "TAVILY_API_KEY", "HUNTER_API_KEY", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET", "LLM_API_KEY", "TAVILY_BASE_URL", "HUNTER_BASE_URL", "GMAIL_REDIRECT_URI", "OUTLOOK_REDIRECT_URI")})
        self.env = patch.dict(os.environ, env)
        self.env.start()
        self.db = SessionLocal()
        # Also supports intentional repeat runs against the same temporary database.
        self.db.query(ServiceConnection).delete()
        self.db.commit()
        self.client = TestClient(app)
        Upstream.calls = []; Upstream.status = 200; Upstream.payload = {}; Upstream.body = None; Upstream.fail = None
        AsyncUpstream.calls = []; AsyncUpstream.status = 200; AsyncUpstream.payload = {}; AsyncUpstream.body = None; AsyncUpstream.fail = None

    def tearDown(self):
        self.client.close(); self.db.close(); self.env.stop(); reset_current_organization(self.token)

    def put(self, key, **data):
        response = self.client.put("/api/service-connections/"+key, json=data)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_named_providers_have_real_configuration_fields_without_secrets(self):
        response = self.client.get("/api/service-connections")
        self.assertEqual(response.status_code, 200, response.text)
        items = {x["service_key"]: x for x in response.json()["items"]}
        self.assertEqual(len(items), 10)
        self.assertFalse(items["tavily"]["connected"])
        self.assertEqual(items["gmail_oauth"]["redirect_uri"], "https://workspace.example.test/api/mail/connect/gmail/callback")
        self.assertNotIn("client_secret", items["gmail_oauth"])

    def test_saved_key_is_encrypted_and_applied_without_restart(self):
        out = self.put("serper", token="isolated-serper-secret", enabled=True)
        self.assertNotIn("isolated-serper-secret", json.dumps(out))
        with SessionLocal() as db:
            row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == "serper"))
            self.assertNotIn("isolated-serper-secret", row.encrypted_token)
            self.assertIn("isolated-serper-secret", _decrypt(row.encrypted_token))
            self.assertEqual(resolve_provider("serper", db)["token"], "isolated-serper-secret")
        AsyncUpstream.payload = {"organic": [{"title": "Fixture company", "link": "https://fixture.example.test", "snippet": "hardware importer"}]}
        with patch("httpx.AsyncClient", AsyncUpstream):
            rows = asyncio.run(serper_query("fixture", 1))
        self.assertEqual(rows[0]["title"], "Fixture company")
        self.assertEqual(AsyncUpstream.calls[0]["headers"]["X-API-KEY"], "isolated-serper-secret")
        self.assertEqual(os.environ["SERPER_API_KEY"], "")

    def test_actual_find_customer_route_uses_saved_tavily_and_same_lead_owner(self):
        self.put("tavily", token="isolated-tavily-secret", enabled=True)
        AsyncUpstream.payload = {"results": [{"title": "Fixture Buyer", "url": "https://buyer-fixture.example.test", "content": "hardware importer sourcing", "score": 0.7}]}
        with patch("httpx.AsyncClient", AsyncUpstream):
            result = self.client.post("/api/leads/search", json={"product_keyword": "hinge", "country": "Germany", "buyer_type": "importer", "limit": 1})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["provider"], "tavily")
        self.assertEqual(AsyncUpstream.calls[0]["headers"]["Authorization"], "Bearer isolated-tavily-secret")
        self.assertIsNotNone(self.db.scalar(select(Lead).where(Lead.domain == "buyer-fixture.example.test")))

    def test_saved_hunter_token_is_used_for_contact_request(self):
        self.put("hunter", token="isolated-hunter-secret")
        AsyncUpstream.payload = {"data": {"emails": []}}
        with patch("httpx.AsyncClient", AsyncUpstream):
            asyncio.run(_hunter_domain_search("buyer-fixture.example.test"))
        self.assertEqual(AsyncUpstream.calls[0]["params"]["api_key"], "isolated-hunter-secret")
        self.assertTrue(self.client.get("/api/acquisition/status").json()["hunter"])

    def test_save_is_not_a_successful_external_connection(self):
        out = self.put("tavily", token="isolated-tavily-secret")
        self.assertTrue(out["service"]["configured"])
        self.assertFalse(out["service"]["verified"])
        for status_code in (401, 403, 429, 500):
            Upstream.status = status_code
            with patch("httpx.Client", Upstream):
                with self.assertRaises(HTTPException) as caught:
                    test_provider(self.db, "tavily")
            self.assertNotIn("isolated-tavily-secret", str(caught.exception.detail))
        Upstream.status = 200; Upstream.body = "<html>not an API</html>"
        with patch("httpx.Client", Upstream):
            with self.assertRaises(HTTPException): test_provider(self.db, "tavily")

    def test_test_endpoint_validates_shape_and_does_not_create_leads(self):
        self.put("tavily", token="isolated-tavily-secret")
        before = self.db.query(Lead).count()
        Upstream.payload = {"key": {"usage": 0}, "account": {"plan_limit": 1000}}
        with patch("httpx.Client", Upstream):
            out = test_provider(self.db, "tavily")
        self.assertTrue(out["verified"])
        self.assertEqual(Upstream.calls[0]["url"], "https://api.tavily.com/usage")
        self.assertEqual(before, self.db.query(Lead).count())
        self.assertNotIn("account", out)

    def test_timeouts_are_safe_and_actionable(self):
        self.put("hunter", token="isolated-hunter-secret")
        Upstream.fail = httpx.ReadTimeout("secret MUST NOT escape in error")
        with patch("httpx.Client", Upstream):
            with self.assertRaises(HTTPException) as caught: test_provider(self.db, "hunter")
        self.assertEqual(caught.exception.status_code, 504)
        self.assertNotIn("MUST NOT", str(caught.exception.detail))

    def test_disabled_override_and_empty_update_preserve_secret(self):
        self.put("serper", token="company-secret")
        with patch.dict(os.environ, {"SERPER_API_KEY": "platform-secret"}):
            self.put("serper", token="", enabled=False)
            self.assertFalse(provider_ready("serper", self.db))
            self.db.expire_all()
            self.assertTrue(public_provider_status(self.db, "serper")["token_saved"])
            self.put("serper", enabled=True)
            self.db.expire_all()
            self.assertEqual(resolve_provider("serper", self.db)["token"], "company-secret")
            self.assertEqual(self.client.delete("/api/service-connections/serper").status_code, 200)
            self.db.expire_all()
            self.assertEqual(resolve_provider("serper", self.db)["token"], "platform-secret")

    def test_tenant_settings_never_leak(self):
        self.put("tavily", token="tenant-a-secret")
        token_b = set_current_organization(next(IDS))
        try:
            with SessionLocal() as db_b:
                self.assertFalse(provider_ready("tavily", db_b))
                save_provider(db_b, "tavily", {"token": "tenant-b-secret"}, "B")
                self.assertEqual(resolve_provider("tavily", db_b)["token"], "tenant-b-secret")
        finally: reset_current_organization(token_b)
        self.db.expire_all()
        self.assertEqual(resolve_provider("tavily", self.db)["token"], "tenant-a-secret")

    def test_mail_app_configuration_start_and_refresh_config_share_saved_credentials(self):
        out = self.put("gmail_oauth", client_id="fixture.apps.googleusercontent.com", client_secret="fixture-client-secret")
        self.assertNotIn("fixture-client-secret", json.dumps(out))
        with SessionLocal() as db:
            cfg = provider_config("gmail", "http://internal:8080/wrong", db)
            self.assertEqual(cfg["client_id"], "fixture.apps.googleusercontent.com")
            self.assertEqual(cfg["client_secret"], "fixture-client-secret")
            self.assertEqual(cfg["redirect_uri"], "https://workspace.example.test/api/mail/connect/gmail/callback")
            started = begin_connection(db, "gmail", "http://internal:8080/wrong")
            query = parse_qs(urlsplit(started["authorize_url"]).query)
            self.assertEqual(query["client_id"], [cfg["client_id"]])
            self.assertEqual(query["redirect_uri"], [cfg["redirect_uri"]])
            self.assertNotIn("fixture-client-secret", started["authorize_url"])
            checked = test_provider(db, "gmail_oauth")
            self.assertFalse(checked["verified"])
            self.assertEqual(checked["state"], "authorization_required")
        status = self.client.get("/api/services/status").json()
        self.assertTrue(status["services"]["mail"]["gmail"])

    def test_builtin_urls_and_outlook_tenant_cannot_redirect_secrets(self):
        self.assertEqual(self.client.put("/api/service-connections/tavily", json={"token": "key", "endpoint_url": "https://attacker.example.test"}).status_code, 400)
        self.assertEqual(self.client.put("/api/service-connections/outlook_oauth", json={"client_id": "client", "client_secret": "secret", "tenant": "../../attacker"}).status_code, 400)
        self.assertEqual(self.client.put("/api/service-connections/hunter", json={"token": "test-api-key"}).status_code, 400)
        self.assertEqual(self.client.put("/api/service-connections/gmail_oauth", json={"client_id": "client", "client_secret": "secret", "redirect_uri": "https://attacker.example.test/api/mail/connect/gmail/callback"}).status_code, 400)

    def test_generic_check_and_actual_call_share_get_query_adapter(self):
        with patch("app.service_adapters._validate_endpoint"):
            self.put("tariff", endpoint_url="https://tariff.example.test/check", token="fixture-tariff-secret", adapter_key="get_key_query", credential_name="access_key")
            Upstream.payload = {"result": {"rate": "fixture"}}
            with patch("httpx.Client", Upstream):
                self.assertTrue(test_resolved_service(self.db, "tariff")["verified"])
                execute_service_request(self.db, "tariff", {"hs_code": "830210"})
        self.assertEqual([x["method"] for x in Upstream.calls], ["GET", "GET"])
        self.assertEqual([x["params"]["access_key"] for x in Upstream.calls], ["fixture-tariff-secret"]*2)

    def test_valid_empty_search_is_not_a_connection_failure(self):
        self.put("serper", token="isolated-serper-secret")
        AsyncUpstream.payload = {"organic": []}
        with patch("httpx.AsyncClient", AsyncUpstream):
            provider, items, errors = asyncio.run(_company_search_with_failover(LeadSearchRequest(product_keyword="unmatched")))
        self.assertEqual(provider, "serper")
        self.assertEqual(items, [])


    def test_oauth_callback_and_refresh_use_saved_app_without_environment_changes(self):
        from datetime import datetime, timedelta, timezone
        from app.mail_provider import finish_connection, token_row, access_token
        from app.online_app import MailboxAccount
        self.put("gmail_oauth", client_id="saved-client.apps.googleusercontent.com", client_secret="saved-client-secret")
        started = begin_connection(self.db, "gmail", "http://unused")
        state = parse_qs(urlsplit(started["authorize_url"]).query)["state"][0]
        class OAuthUpstream(Upstream):
            def post(self, url, **kw):
                Upstream.calls.append({"method": "POST", "url": url, **kw})
                return httpx.Response(200, json={"access_token": "fixture-access", "refresh_token": "fixture-refresh", "expires_in": 3600})
            def get(self, url, **kw):
                return httpx.Response(200, json={"email": "fixture-oauth@example.test", "name": "Fixture"})
        with patch("httpx.Client", OAuthUpstream):
            result = finish_connection(self.db, state, "fixture-code")
            mailbox = self.db.get(MailboxAccount, result["mailbox_id"])
            row = token_row(self.db, mailbox.id)
            self.assertNotIn("fixture-access", row.access_ciphertext)
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=30)
            self.db.commit()
            self.assertEqual(access_token(self.db, mailbox), "fixture-access")
        self.assertEqual(Upstream.calls[0]["data"]["redirect_uri"], "https://workspace.example.test/api/mail/connect/gmail/callback")
        self.assertEqual([x["data"]["client_secret"] for x in Upstream.calls], ["saved-client-secret"] * 2)
        self.assertEqual(Upstream.calls[1]["data"]["grant_type"], "refresh_token")
        self.assertEqual(os.environ["GMAIL_CLIENT_SECRET"], "")

    def test_smtp_blank_secret_preserved_only_for_same_server(self):
        from app.mail_delivery import save_smtp_credentials, SmtpCredentialRequest, _credential, _decrypt_secret
        from app.online_app import MailboxAccount
        mailbox = MailboxAccount(email="fixture-smtp@example.test", display_name="Fixture", provider="smtp", auth_mode="smtp")
        self.db.add(mailbox); self.db.commit()
        fields = {"host": "smtp.example.test", "port": 587, "security": "starttls", "username": mailbox.email}
        save_smtp_credentials(mailbox.id, SmtpCredentialRequest(**fields, password="smtp-fixture-secret"), self.db)
        save_smtp_credentials(mailbox.id, SmtpCredentialRequest(**fields, password=""), self.db)
        self.assertEqual(_decrypt_secret(_credential(self.db, mailbox.id).secret_ciphertext), "smtp-fixture-secret")
        with self.assertRaises(HTTPException) as caught:
            save_smtp_credentials(mailbox.id, SmtpCredentialRequest(**{**fields, "host": "other.example.test"}), self.db)
        self.assertEqual(caught.exception.status_code, 400)
        self.assertEqual(_credential(self.db, mailbox.id).host, fields["host"])

    def test_corrupt_cipher_can_only_be_replaced_with_fresh_complete_credentials(self):
        self.put("tavily", token="old-secret")
        with SessionLocal() as db:
            row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == "tavily"))
            row.encrypted_token = "unreadable-fixture-cipher"
            db.commit()
        self.assertEqual(self.client.put("/api/service-connections/tavily", json={"enabled": True}).status_code, 400)
        self.put("tavily", token="new-complete-secret")
        self.db.expire_all()
        self.assertEqual(resolve_provider("tavily", self.db)["token"], "new-complete-secret")
