import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("HUIDI_DISABLE_BACKGROUND_JOBS", "1")

from app.daily_app import app  # noqa: F401,E402
from app.audit_log import AuditEvent, _friendly_action  # noqa: E402
from app.main import SessionLocal  # noqa: E402
from app.tenant_storage import reset_current_organization, set_current_organization  # noqa: E402


class AuditLogTests(unittest.TestCase):
    def test_friendly_business_labels(self):
        self.assertEqual(_friendly_action("POST", "/api/leads/12/send")[1], "发送邮件")
        self.assertEqual(_friendly_action("PATCH", "/api/business/deals/9")[1], "更新询盘")
        self.assertEqual(_friendly_action("POST", "/api/team/members")[1], "添加团队成员")
        self.assertEqual(_friendly_action("PUT", "/api/product-brains/p-1")[1], "保存产品资料")

    def test_audit_schema_does_not_store_sensitive_request_content(self):
        columns = {c.name for c in AuditEvent.__table__.columns}
        for forbidden in {"password", "request_body", "body", "mail_body", "payload", "headers", "token"}:
            self.assertNotIn(forbidden, columns)

    def test_audit_records_are_physically_isolated_by_company(self):
        old_template = os.environ.get("HUIDI_TENANT_DATABASE_URL_TEMPLATE")
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = (
                f"sqlite:///{Path(tmp) / 'audit-org-{organization_id}.db'}"
            )
            org_a = 991001
            org_b = 991002

            token_a = set_current_organization(org_a)
            try:
                db_a = SessionLocal()
                try:
                    db_a.add(
                        AuditEvent(
                            actor_member_id=1,
                            actor_name="A Sales",
                            actor_email="a@example.com",
                            actor_role="sales",
                            action="更新客户线索",
                            category="lead",
                            resource_type="lead",
                            resource_id="1",
                            method="PATCH",
                            path="/api/leads/1",
                            status_code=200,
                            success=1,
                            source="user",
                        )
                    )
                    db_a.commit()
                    self.assertEqual(db_a.query(AuditEvent).count(), 1)
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

            token_b = set_current_organization(org_b)
            try:
                db_b = SessionLocal()
                try:
                    self.assertEqual(db_b.query(AuditEvent).count(), 0)
                    db_b.add(
                        AuditEvent(
                            actor_member_id=2,
                            actor_name="B Sales",
                            actor_email="b@example.com",
                            actor_role="sales",
                            action="更新询盘",
                            category="business",
                            resource_type="deal",
                            resource_id="2",
                            method="PATCH",
                            path="/api/business/deals/2",
                            status_code=200,
                            success=1,
                            source="user",
                        )
                    )
                    db_b.commit()
                    names_b = [x.actor_name for x in db_b.query(AuditEvent).all()]
                    self.assertEqual(names_b, ["B Sales"])
                finally:
                    db_b.close()
            finally:
                reset_current_organization(token_b)

            token_a = set_current_organization(org_a)
            try:
                db_a = SessionLocal()
                try:
                    names_a = [x.actor_name for x in db_a.query(AuditEvent).all()]
                    self.assertEqual(names_a, ["A Sales"])
                finally:
                    db_a.close()
            finally:
                reset_current_organization(token_a)

        if old_template is None:
            os.environ.pop("HUIDI_TENANT_DATABASE_URL_TEMPLATE", None)
        else:
            os.environ["HUIDI_TENANT_DATABASE_URL_TEMPLATE"] = old_template


if __name__ == "__main__":
    unittest.main()
