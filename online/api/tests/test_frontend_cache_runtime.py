import os
import re
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("HUIDI_SECRET_KEY", "frontend-cache-runtime-test")
os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_TEAM_ACCESS", "0")

from app.daily_app import app  # noqa: E402
from app.frontend_runtime_guard import ASSET_VERSION  # noqa: E402


API = Path(__file__).resolve().parents[1]
ONLINE = API.parent
WEB = API / "web"


class FrontendCacheRuntimeTests(unittest.TestCase):
    def test_runtime_html_versions_every_local_asset_and_clears_local_cache(self):
        raw = (WEB / "index.html").read_text(encoding="utf-8")
        raw_refs = re.findall(r'(?:src|href)="(/assets/[^"?]+)"', raw)
        self.assertGreaterEqual(len(raw_refs), 40)

        client = TestClient(app, base_url="http://127.0.0.1:8080")
        response = client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response.headers.get("cache-control", ""))
        self.assertEqual(response.headers.get("clear-site-data"), '"cache"')
        self.assertEqual(response.headers.get("x-huidi-asset-version"), ASSET_VERSION)

        runtime_refs = re.findall(r'(?:src|href)="(/assets/[^"?]+\?v=[a-f0-9]{16})"', response.text)
        self.assertEqual(len(runtime_refs), len(raw_refs))
        self.assertTrue(all(ref.endswith(f"?v={ASSET_VERSION}") for ref in runtime_refs))

        asset = client.get(runtime_refs[-1])
        self.assertEqual(asset.status_code, 200)
        self.assertIn("immutable", asset.headers.get("cache-control", ""))
        self.assertEqual(asset.headers.get("x-huidi-asset-version"), ASSET_VERSION)

    def test_windows_launcher_has_no_locale_sensitive_timeout_chain(self):
        launcher = (ONLINE / "START-HUIDI-ONLINE.cmd").read_text(encoding="utf-8")
        opener = (ONLINE / "OPEN-HUIDI-ONLINE.cmd").read_text(encoding="utf-8")
        self.assertNotIn("timeout /t", launcher.lower())
        self.assertIn("OPEN-HUIDI-ONLINE.cmd", launcher)
        self.assertIn("ping 127.0.0.1 -n 4", opener)
        self.assertIn('start "" "%URL%"', opener)


if __name__ == "__main__":
    unittest.main()
