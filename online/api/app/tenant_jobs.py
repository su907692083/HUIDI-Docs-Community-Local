from __future__ import annotations

import os
import threading

from sqlalchemy import select

from .mail_sequences import run_sequences_once
from .mail_sync import _sync_all_background, run_queue_once
from .team_access import Organization
from .tenant_storage import ControlSessionLocal, reset_current_organization, set_current_organization


_runtime_lock = threading.Lock()
_runtime_thread: threading.Thread | None = None
_runtime_stop = threading.Event()


def _team_mode() -> bool:
    return os.getenv("HUIDI_TEAM_ACCESS", "").strip().lower() in {"1", "true", "yes", "on"}


def enabled_organization_ids() -> list[int]:
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


def run_tenant_jobs_once() -> dict[str, int]:
    """Process non-default company queues under their own database context.

    Organization #1 keeps the historical mail workers. This coordinator covers
    organization #2+ so automatic send, reply sync and follow-up sequences keep
    working without crossing database boundaries.
    """
    organizations = 0
    queue_runs = 0
    sequence_runs = 0
    sync_runs = 0
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
        finally:
            reset_current_organization(token)
    return {
        "organizations": organizations,
        "queue_runs": queue_runs,
        "sequence_runs": sequence_runs,
        "sync_runs": sync_runs,
    }


def _runtime_loop() -> None:
    cycles = 0
    while not _runtime_stop.is_set():
        try:
            if cycles % 2 == 0:
                run_tenant_jobs_once()
            else:
                # Queue and sequence work are latency-sensitive; the full inbox
                # sync stays on the 60-second cadence of this coordinator.
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
                    finally:
                        reset_current_organization(token)
        except Exception:
            pass
        cycles += 1
        _runtime_stop.wait(30)


def _ensure_runtime_thread() -> None:
    global _runtime_thread
    if not _team_mode():
        return
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
            name="huidi-tenant-jobs",
            daemon=True,
        )
        _runtime_thread.start()


_ensure_runtime_thread()
