import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")
os.environ.setdefault("HUIDI_SECRET_KEY", "ci-only-huidi-notification-secret")

from app.daily_app import app  # noqa: F401,E402
from app.main import SessionLocal  # noqa: E402
from app.notification_delivery import (  # noqa: E402
    NotificationDelivery,
    NotificationRoute,
    _encrypt,
    route_dict,
    run_notification_delivery_once,
)
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class NotificationDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")

    def tearDown(self):
        if self.old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = self.old_template

    def _template(self, tmp):
        os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
            f"sqlite:///{Path(tmp) / 'notify-org-{organization_id}.db'}"
        )

    def test_destination_is_encrypted_and_never_returned_to_ui(self):
        encrypted = _encrypt("https://notify.example/secret-path")
        self.assertNotIn("secret-path", encrypted)
        row = NotificationRoute(
            id=1,
            name="销售提醒",
            channel="feishu",
            encrypted_destination=encrypted,
            categories_json='["reply"]',
            enabled=1,
        )
        public = route_dict(row)
        self.assertTrue(public["destination_saved"])
        self.assertNotIn("destination", public)
        self.assertNotIn("encrypted_destination", public)

    def test_same_business_event_is_delivered_only_once(self):
        event = {
            "key": "mail.reply:88",
            "category": "reply",
            "title": "客户回复 · Buyer A",
            "summary": "Please send quotation",
            "priority": "high",
            "due_at": "",
            "action": {"type": "lead", "id": 1},
            "state": "open",
        }
        sent = []
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token = set_current_organization(661001)
            try:
                db = SessionLocal()
                try:
                    db.add(
                        NotificationRoute(
                            name="销售提醒",
                            channel="feishu",
                            encrypted_destination=_encrypt("https://notify.example/a"),
                            categories_json='["reply"]',
                            enabled=1,
                            quiet_start="00:00",
                            quiet_end="00:00",
                        )
                    )
                    db.commit()
                finally:
                    db.close()
                with patch("app.notification_delivery.build_notifications", return_value=[event]), patch(
                    "app.notification_delivery._post_destination",
                    side_effect=lambda channel, destination, text, item: sent.append(item["key"]),
                ):
                    first = run_notification_delivery_once()
                    second = run_notification_delivery_once()
                self.assertEqual(first["sent"], 1)
                self.assertEqual(second["sent"], 0)
                self.assertEqual(sent, ["mail.reply:88"])
                db = SessionLocal()
                try:
                    rows = db.query(NotificationDelivery).all()
                    self.assertEqual(len(rows), 1)
                    self.assertEqual(rows[0].state, "sent")
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_done_event_is_not_sent_externally(self):
        event = {
            "key": "lead.followup:4:2026-09-05",
            "category": "followup",
            "title": "今天要跟进 · Buyer B",
            "summary": "Follow up",
            "priority": "normal",
            "due_at": "",
            "action": {"type": "lead", "id": 4},
            "state": "done",
        }
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token = set_current_organization(661002)
            try:
                db = SessionLocal()
                try:
                    db.add(
                        NotificationRoute(
                            name="团队提醒",
                            channel="wecom",
                            encrypted_destination=_encrypt("https://notify.example/b"),
                            categories_json='["followup"]',
                            enabled=1,
                            quiet_start="00:00",
                            quiet_end="00:00",
                        )
                    )
                    db.commit()
                finally:
                    db.close()
                with patch("app.notification_delivery.build_notifications", return_value=[event]), patch(
                    "app.notification_delivery._post_destination"
                ) as sender:
                    out = run_notification_delivery_once()
                self.assertEqual(out["sent"], 0)
                sender.assert_not_called()
            finally:
                reset_current_organization(token)

    def test_failed_delivery_retries_without_creating_duplicates(self):
        event = {
            "key": "mail.failed:19",
            "category": "mail",
            "title": "邮件没有发出 · Buyer C",
            "summary": "Temporary failure",
            "priority": "high",
            "due_at": "",
            "action": {"type": "lead", "id": 9},
            "state": "open",
        }
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token = set_current_organization(661003)
            try:
                db = SessionLocal()
                try:
                    db.add(
                        NotificationRoute(
                            name="异常提醒",
                            channel="dingtalk",
                            encrypted_destination=_encrypt("https://notify.example/c"),
                            categories_json='["mail"]',
                            enabled=1,
                            quiet_start="00:00",
                            quiet_end="00:00",
                        )
                    )
                    db.commit()
                finally:
                    db.close()
                with patch("app.notification_delivery.build_notifications", return_value=[event]), patch(
                    "app.notification_delivery._post_destination",
                    side_effect=RuntimeError("temporary"),
                ):
                    out = run_notification_delivery_once()
                self.assertEqual(out["sent"], 0)
                db = SessionLocal()
                try:
                    rows = db.query(NotificationDelivery).all()
                    self.assertEqual(len(rows), 1)
                    self.assertEqual(rows[0].state, "retrying")
                    self.assertEqual(rows[0].attempts, 1)
                finally:
                    db.close()
            finally:
                reset_current_organization(token)

    def test_routes_and_deliveries_are_physically_isolated_by_company(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._template(tmp)
            token_a = set_current_organization(662001)
            try:
                db_a = SessionLocal()
                try:
                    db_a.add(
                        NotificationRoute(
                            name="A reminder",
                            channel="feishu",
                            encrypted_destination=_encrypt("https://notify.example/a"),
                            enabled=1,
                        )
                    )
                    db_a.commit()
                    self.assertEqual(db_a.query(NotificationRoute).count(), 1)
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(662002)
            try:
                db_b = SessionLocal()
                try:
                    self.assertEqual(db_b.query(NotificationRoute).count(), 0)
                    self.assertEqual(db_b.query(NotificationDelivery).count(), 0)
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)


if __name__ == "__main__":
    unittest.main()
