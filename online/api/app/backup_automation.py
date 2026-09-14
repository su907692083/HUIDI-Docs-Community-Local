from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column

from .backup_restore import create_company_backup
from .main import Base, SessionLocal, engine
from .tenant_storage import current_organization_id, tenant_database_url


class BackupAutomationState(Base):
    __tablename__ = "backup_automation_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    status: Mapped[str] = mapped_column(String(40), default="never", index=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_backup_id: Mapped[str] = mapped_column(String(80), default="")
    last_error: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


def automatic_backup_enabled() -> bool:
    return os.getenv("HUIDI_AUTO_BACKUP", "1").strip().lower() not in {"0", "false", "no", "off"}


def automatic_backup_hours() -> int:
    try:
        value = int(os.getenv("HUIDI_AUTO_BACKUP_HOURS", "24") or 24)
    except Exception:
        value = 24
    return max(1, min(168, value))


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _state(db) -> BackupAutomationState:
    row = db.get(BackupAutomationState, 1)
    if not row:
        row = BackupAutomationState(id=1, status="never", updated_at=datetime.now(timezone.utc))
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def backup_automation_status() -> dict:
    db = SessionLocal()
    try:
        row = _state(db)
        return {
            "enabled": automatic_backup_enabled(),
            "interval_hours": automatic_backup_hours(),
            "status": row.status,
            "last_attempt_at": row.last_attempt_at.isoformat() if row.last_attempt_at else None,
            "last_success_at": row.last_success_at.isoformat() if row.last_success_at else None,
            "last_backup_id": row.last_backup_id,
            "last_error": row.last_error,
        }
    finally:
        db.close()


def run_automatic_backup_once(force: bool = False) -> dict:
    """Create a verified business backup for the current company when due."""
    organization_id = current_organization_id()
    db = SessionLocal()
    try:
        row = _state(db)
        if not automatic_backup_enabled() and not force:
            row.status = "disabled"
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {"organization_id": organization_id, "state": "disabled", "created": False}

        # HUIDI's built-in restore is intentionally limited to SQLite. Server
        # databases must rely on their own managed backup facility.
        try:
            url = tenant_database_url(organization_id)
        except Exception as exc:
            row.status = "failed"
            row.last_attempt_at = _now_naive()
            row.last_error = str(exc)[:1200]
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {"organization_id": organization_id, "state": "failed", "created": False}
        if not url.startswith("sqlite:///"):
            row.status = "external_required"
            row.last_error = "当前使用服务器数据库，请使用数据库服务自带的自动备份。"
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {"organization_id": organization_id, "state": "external_required", "created": False}

        due_before = _now_naive() - timedelta(hours=automatic_backup_hours())
        if not force and row.last_success_at and row.last_success_at > due_before:
            return {
                "organization_id": organization_id,
                "state": "current",
                "created": False,
                "backup_id": row.last_backup_id,
            }

        row.status = "running"
        row.last_attempt_at = _now_naive()
        row.last_error = ""
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        try:
            manifest = create_company_backup("automatic")
            row.status = "ok"
            row.last_success_at = _now_naive()
            row.last_backup_id = str(manifest.get("id") or "")
            row.last_error = ""
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {
                "organization_id": organization_id,
                "state": "ok",
                "created": True,
                "backup_id": row.last_backup_id,
            }
        except Exception as exc:
            row.status = "failed"
            row.last_error = str(exc)[:1200] or "自动备份失败"
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {
                "organization_id": organization_id,
                "state": "failed",
                "created": False,
                "error": row.last_error,
            }
    finally:
        db.close()
