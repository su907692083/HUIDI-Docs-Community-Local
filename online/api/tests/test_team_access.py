import os
import unittest
from unittest.mock import patch

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from starlette.requests import Request
from starlette.responses import PlainTextResponse

from app.daily_app import app  # noqa: F401,E402
from app.team_access import (  # noqa: E402
    TeamMember,
    _is_public_path,
    _password_hash,
    _permission_error,
    _verify_password,
    team_access_middleware,
)


def request(method: str, path: str) -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "https",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 443),
            "root_path": "",
        }
    )


class TeamAccessTests(unittest.TestCase):
    def test_password_is_hashed_and_verifies(self):
        stored = _password_hash("correct-horse-battery")
        self.assertNotIn("correct-horse-battery", stored)
        self.assertTrue(_verify_password("correct-horse-battery", stored))
        self.assertFalse(_verify_password("wrong-password", stored))

    def test_viewer_cannot_write_business_data(self):
        member = TeamMember(email="viewer@example.com", role="viewer", enabled=1)
        error = _permission_error(member, request("POST", "/api/leads/1/followup"))
        self.assertIn("只读", error or "")

    def test_sales_can_do_daily_business_work(self):
        member = TeamMember(email="sales@example.com", role="sales", enabled=1)
        self.assertIsNone(_permission_error(member, request("POST", "/api/leads/1/followup")))
        self.assertIsNone(_permission_error(member, request("POST", "/api/leads/1/send")))

    def test_sales_cannot_change_mail_connection_or_team(self):
        member = TeamMember(email="sales@example.com", role="sales", enabled=1)
        self.assertIn("管理员", _permission_error(member, request("POST", "/api/mail/accounts")) or "")
        self.assertIn("管理员", _permission_error(member, request("POST", "/api/mail/connect/gmail/start")) or "")
        self.assertIn("管理员", _permission_error(member, request("POST", "/api/team/members")) or "")

    def test_viewer_can_logout(self):
        member = TeamMember(email="viewer@example.com", role="viewer", enabled=1)
        self.assertIsNone(_permission_error(member, request("POST", "/api/team/logout")))

    def test_community_static_assets_are_public_but_html_surfaces_are_not(self):
        for path in (
            "/community/huidi-community-online-fusion.js",
            "/community/huidi-workspace-r4-rc1626.css",
            "/community/icons/huidi.svg",
            "/community/manifest.webmanifest",
            "/community/fonts/workbench.woff2",
        ):
            with self.subTest(path=path):
                self.assertTrue(_is_public_path(path))
        for path in (
            "/community/workspace.html",
            "/community/editor.html",
            "/community/document-start.html",
            "/community/private.json",
            "/api/leads",
        ):
            with self.subTest(path=path):
                self.assertFalse(_is_public_path(path))


class TeamAccessStaticBypassTests(unittest.IsolatedAsyncioTestCase):
    async def test_community_static_request_never_opens_control_db_session(self):
        async def downstream(_request):
            return PlainTextResponse("asset")

        with (
            patch("app.team_access._access_required", return_value=True),
            patch(
                "app.team_access.ControlSessionLocal",
                side_effect=AssertionError("static asset must not open control DB"),
            ),
        ):
            response = await team_access_middleware(
                request("GET", "/community/huidi-community-online-fusion.js"), downstream
            )
        self.assertEqual(response.status_code, 200)

    async def test_community_html_surface_still_enters_team_access(self):
        async def downstream(_request):
            return PlainTextResponse("workspace")

        with (
            patch("app.team_access._access_required", return_value=True),
            patch(
                "app.team_access.ControlSessionLocal",
                side_effect=RuntimeError("protected html reached auth DB"),
            ),
            self.assertRaisesRegex(RuntimeError, "protected html reached auth DB"),
        ):
            await team_access_middleware(request("GET", "/community/workspace.html"), downstream)


if __name__ == "__main__":
    unittest.main()
