from __future__ import annotations

import os
import threading

from sqlalchemy import select

from .backup_automation import run_automatic_backup_once
from .mail_sequences import run_sequences_once
from .mail_sync import _sync_all_background, run_queue_once
from .notification_delivery import run_notification_delivery_once
from .team_access import Organization
from .tenant_storage import ControlSessionLocal, reset_current_organization, set_current_organization


_runtime_lock = threading.Lock()
_runtime_thread: threading.Thread | None = None
_runtime_stop = threading.Event()


def _team_mode() -> bool:
    return os.getenv("HUIDI_TEAM_ACCESS", "").strip().lower() in {"1", "true", "yes", "on"}


def enabled_organization_ids() -> list[int]:
    """Non-default companies that need the tenant mail coordinator."""
    db = ControlSessionLocal()
    try:
        rows = db.scalars(
            select(Organization.id)
            .where(Organization.enabled == 1)
            .where(Organization.id > 1)
            .order_by(Organization.id.asc())
        ).all()
        return [int(x) for x in rows]
    finally:
        db.close()


def all_enabled_organization_ids() -> list[int]:
    """All active companies for shared background duties such as backups."""
    db = ControlSessionLocal()
    try:
        rows = db.scalars(
            select(Organization.id)
            .where(Organization.enabled == 1)
            .order_by(Organization.id.asc())
        ).all()
        values = [int(x) for x in rows]
        return values or [1]
    finally:
        db.close()


def run_tenant_jobs_once() -> dict[str, int]:
    """Process non-default company background work inside its own database.

    Organization #1 keeps the historical mail workers. This coordinator covers
    organization #2+ so mail, follow-up and external reminders continue working
    without crossing company boundaries.
    """
    organizations = 0
    queue_runs = 0
    sequence_runs = 0
    sync_runs = 0
    notification_runs = 0
    for organization_id in enabled_organization_ids():
        token = set_current_organization(organization_id)
        try:
            organizations += 1
            try:
                run_queue_once(20)
                queue_runs += 1
            except Exception:
                pass
            try:
                run_sequences_once(20)
                sequence_runs += 1
            except Exception:
                pass
            try:
                _sync_all_background()
                sync_runs += 1
            except Exception:
                pass
            try:
                run_notification_delivery_once(40)
                notification_runs += 1
            except Exception:
                pass
        finally:
            reset_current_organization(token)
    return {
        "organizations": organizations,
        "queue_runs": queue_runs,
        "sequence_runs": sequence_runs,
        "sync_runs": sync_runs,
        "notification_runs": notification_runs,
    }


def run_default_company_reminders_once() -> dict[str, int]:
    """Keep company #1 / single-user external reminders automatic too."""
    token = set_current_organization(1)
    try:
        return run_notification_delivery_once(40)
    finally:
        reset_current_organization(token)


def run_all_automatic_backups_once() -> dict[str, int]:
    """Check the backup cadence independently for every active company."""
    checked = created = failed = external_required = 0
    for organization_id in all_enabled_organization_ids():
        token = set_current_organization(organization_id)
        try:
            checked += 1
            try:
                out = run_automatic_backup_once()
                if out.get("created"):
                    created += 1
                if out.get("state") == "failed":
                    failed += 1
                if out.get("state") == "external_required":
                    external_required += 1
            except Exception:
                failed += 1
        finally:
            reset_current_organization(token)
    return {
        "checked": checked,
        "created": created,
        "failed": failed,
        "external_required": external_required,
    }


def _run_quick_tenant_jobs() -> None:
    if not _team_mode():
        return
    for organization_id in enabled_organization_ids():
        token = set_current_organization(organization_id)
        try:
            try:
                run_queue_once(20)
            except Exception:
                pass
            try:
                run_sequences_once(20)
            except Exception:
                pass
            try:
                run_notification_delivery_once(40)
            except Exception:
                pass
        finally:
            reset_current_organization(token)


def _runtime_loop() -> None:
    cycles = 0
    while not _runtime_stop.is_set():
        try:
            # Default-company external reminders must work in both single-user
            # and team deployments. Existing default mail workers stay untouched.
            try:
                run_default_company_reminders_once()
            except Exception:
                pass

            if _team_mode():
                if cycles % 2 == 0:
                    run_tenant_jobs_once()
                else:
                    # Queue and sequence work are latency-sensitive. Notification
                    # delivery also gets a 30-second retry pass, while inbox sync
                    # stays on the 60-second full cycle.
                    _run_quick_tenant_jobs()

            # Backup checks are cheap when a current backup exists. Run the
            # company-by-company due check once an hour; each company still uses
            # its own configured backup interval (24h by default).
            if cycles % 120 == 0:
                try:
                    run_all_automatic_backups_once()
                except Exception:
                    pass
        except Exception:
            pass
        cycles += 1
        _runtime_stop.wait(30)


def _ensure_runtime_thread() -> None:
    global _runtime_thread
    if os.getenv("HUIDI_DISABLE_BACKGROUND_JOBS", "").strip() == "1":
        return
    if os.getenv("CI", "").strip().lower() in {"1", "true", "yes"}:
        return
    with _runtime_lock:
        if _runtime_thread and _runtime_thread.is_alive():
            return
        _runtime_stop.clear()
        _runtime_thread = threading.Thread(
            target=_runtime_loop,
            name="huidi-runtime-jobs",
            daemon=True,
        )
        _runtime_thread.start()


_ensure_runtime_thread()
