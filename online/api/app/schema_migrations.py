from __future__ import annotations

import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Iterator

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, Text, inspect, select, text
from sqlalchemy.engine import Connection, Engine


SCHEMA_SERIES = "huidi.online.schema/v1"
LATEST_SCHEMA_REVISION = "20260906_001_intelligence_projection"
# Stable signed bigint used only to serialize HUIDI schema revisions inside one
# PostgreSQL database. It contains no customer or deployment-specific data.
POSTGRES_MIGRATION_LOCK_ID = 6843443791448361
_local_migration_lock = threading.Lock()

_meta = MetaData()
_migration_table = Table(
    "huidi_schema_migrations",
    _meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("revision", String(120), nullable=False, unique=True, index=True),
    Column("description", String(255), nullable=False, default=""),
    Column("applied_at", DateTime, nullable=False),
)

_projection_meta = MetaData()
_projection_table = Table(
    "online_intelligence_projections",
    _projection_meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("record_id", Integer, nullable=False, unique=True, index=True),
    Column("kind", String(60), nullable=False, index=True),
    Column("schema_version", String(80), nullable=False, default="huidi.intelligence.normalized/v1"),
    Column("normalized_json", Text, nullable=False, default="{}"),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)


def _baseline(_engine: Engine) -> None:
    # Existing installations are treated as the Online V0.1 baseline. Business
    # table compatibility remains protected by the full regression suite.
    return None


def _intelligence_projection(engine: Engine) -> None:
    _projection_table.create(engine, checkfirst=True)


MIGRATIONS: list[tuple[str, str, Callable[[Engine], None]]] = [
    ("20260905_000_online_v01_baseline", "Online V0.1 existing business schema baseline", _baseline),
    (
        "20260906_001_intelligence_projection",
        "Canonical normalized intelligence projection storage",
        _intelligence_projection,
    ),
]


@contextmanager
def schema_migration_lock(engine: Engine) -> Iterator[None]:
    """Serialize schema writers without storing deployment secrets.

    PostgreSQL uses a session-scoped advisory lock, so separate worker or
    deployment processes cannot run HUIDI DDL/revision writes concurrently.
    SQLite/dev uses an in-process lock; production multi-worker deployments are
    expected to use the explicit PostgreSQL deployment path and schema CLI.
    """
    if engine.dialect.name == "postgresql":
        connection: Connection = engine.connect()
        try:
            connection.execute(
                text("SELECT pg_advisory_lock(:lock_id)"),
                {"lock_id": POSTGRES_MIGRATION_LOCK_ID},
            )
            yield
        finally:
            try:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_id)"),
                    {"lock_id": POSTGRES_MIGRATION_LOCK_ID},
                )
            finally:
                connection.close()
        return
    with _local_migration_lock:
        yield


def _applied(engine: Engine) -> set[str]:
    _migration_table.create(engine, checkfirst=True)
    with engine.begin() as conn:
        return {str(x) for x in conn.execute(select(_migration_table.c.revision)).scalars().all()}


def _apply_schema_migrations_unlocked(engine: Engine) -> dict[str, object]:
    applied = _applied(engine)
    newly_applied: list[str] = []
    for revision, description, upgrade in MIGRATIONS:
        if revision in applied:
            continue
        upgrade(engine)
        with engine.begin() as conn:
            conn.execute(
                _migration_table.insert().values(
                    revision=revision,
                    description=description,
                    applied_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
            )
        applied.add(revision)
        newly_applied.append(revision)
    return schema_migration_status(engine, newly_applied=newly_applied)


def apply_schema_migrations(engine: Engine) -> dict[str, object]:
    with schema_migration_lock(engine):
        return _apply_schema_migrations_unlocked(engine)


def upgrade_schema(engine: Engine, metadata: MetaData | None = None) -> dict[str, object]:
    """Lock the complete compatibility-create + forward-revision section."""
    with schema_migration_lock(engine):
        if metadata is not None:
            metadata.create_all(engine)
        return _apply_schema_migrations_unlocked(engine)


def schema_migration_status(engine: Engine, *, newly_applied: list[str] | None = None) -> dict[str, object]:
    inspector = inspect(engine)
    if "huidi_schema_migrations" not in inspector.get_table_names():
        applied: set[str] = set()
    else:
        with engine.begin() as conn:
            applied = {str(x) for x in conn.execute(select(_migration_table.c.revision)).scalars().all()}
    pending = [revision for revision, _, _ in MIGRATIONS if revision not in applied]
    current = ""
    for revision, _, _ in MIGRATIONS:
        if revision in applied:
            current = revision
    return {
        "schema": SCHEMA_SERIES,
        "latest_revision": LATEST_SCHEMA_REVISION,
        "current_revision": current,
        "pending": pending,
        "up_to_date": not pending and current == LATEST_SCHEMA_REVISION,
        "newly_applied": newly_applied or [],
        "dialect": engine.dialect.name,
        "serialized_writes": engine.dialect.name == "postgresql",
    }
