import os
import unittest

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from starlette.requests import Request

from app.daily_app import app  # noqa: F401,E402
from app.team_access import TeamMember, _password_hash, _permission_error, _verify_password  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
