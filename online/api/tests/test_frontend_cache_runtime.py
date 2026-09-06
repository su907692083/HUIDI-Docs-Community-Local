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

    def test_windows_launcher_uses_path_safe_python_browser_opener(self):
        launcher = (ONLINE / "START-HUIDI-ONLINE.cmd").read_text(encoding="utf-8")
        lower = launcher.lower()
        self.assertNotIn("timeout /t", lower)
        self.assertNotIn("powershell", lower)
        self.assertNotIn("open-huidi-online.cmd", lower)
        self.assertIn('start "" /b "%VENV_PY%"', launcher)
        self.assertIn("webbrowser.open", launcher)
        self.assertIn("time.sleep(2)", launcher)
        self.assertIn("http://127.0.0.1:8080/", launcher)


if __name__ == "__main__":
    unittest.main()
