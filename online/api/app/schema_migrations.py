from __future__ import annotations

import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Iterator

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, Text, inspect, select, text
from sqlalchemy.engine import Connection, Engine


SCHEMA_SERIES = "huidi.online.schema/v1"
LATEST_SCHEMA_REVISION = "20260907_005_document_master_data"
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

_intel_source_meta = MetaData()
_intel_source_table = Table(
    "intelligence_feed_sources",
    _intel_source_meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(160), nullable=False, default=""),
    Column("feed_url", Text, nullable=False, unique=True),
    Column("category", String(40), nullable=False, default="industry", index=True),
    Column("source_type", String(40), nullable=False, default="industry", index=True),
    Column("enabled", Integer, nullable=False, default=1, index=True),
    Column("created_by", String(160), nullable=False, default=""),
    Column("updated_by", String(160), nullable=False, default=""),
    Column("last_status", String(40), nullable=False, default=""),
    Column("last_message", String(500), nullable=False, default=""),
    Column("last_checked_at", DateTime, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

_industry_meta = MetaData()
_industry_pref_table = Table(
    "lead_industry_preferences",
    _industry_meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("lead_id", Integer, nullable=False, unique=True, index=True),
    Column("industry_id", String(120), nullable=False, index=True),
    Column("source", String(24), nullable=False, default="auto"),
    Column("updated_at", DateTime, nullable=False),
)

_master_meta = MetaData()
_customer_address_table = Table(
    "online_customer_addresses",
    _master_meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("customer_id", Integer, nullable=False, index=True),
    Column("address_type", String(40), nullable=False, default="shipping", index=True),
    Column("label", String(120), nullable=False, default=""),
    Column("contact_name", String(255), nullable=False, default=""),
    Column("phone", String(120), nullable=False, default=""),
    Column("country", String(120), nullable=False, default=""),
    Column("region", String(160), nullable=False, default=""),
    Column("city", String(160), nullable=False, default=""),
    Column("postal_code", String(60), nullable=False, default=""),
    Column("address_line1", Text, nullable=False, default=""),
    Column("address_line2", Text, nullable=False, default=""),
    Column("is_default", Integer, nullable=False, default=0, index=True),
    Column("notes", Text, nullable=False, default=""),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False, index=True),
)
_bank_account_table = Table(
    "company_bank_accounts",
    _master_meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("label", String(120), nullable=False, default=""),
    Column("bank_name", String(255), nullable=False, default=""),
    Column("account_name", String(255), nullable=False, default=""),
    Column("account_number", String(255), nullable=False, default=""),
    Column("swift_code", String(120), nullable=False, default=""),
    Column("bank_address", Text, nullable=False, default=""),
    Column("currency", String(40), nullable=False, default=""),
    Column("is_default", Integer, nullable=False, default=0, index=True),
    Column("notes", Text, nullable=False, default=""),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False, index=True),
)


def _baseline(_engine: Engine) -> None:
    # Existing installations are treated as the Online V0.1 baseline. Business
    # table compatibility remains protected by the full regression suite.
    return None


def _intelligence_projection(engine: Engine) -> None:
    _projection_table.create(engine, checkfirst=True)


def _intelligence_feed_sources(engine: Engine) -> None:
    _intel_source_table.create(engine, checkfirst=True)


def _industry_playbook_context(engine: Engine) -> None:
    # Industry taxonomy itself is a versioned code asset; only the user's
    # per-customer choice is persisted. This avoids duplicating 143 industry
    # definitions or thousands of generated templates in every company DB.
    _industry_pref_table.create(engine, checkfirst=True)


def _online_document_payload(engine: Engine) -> None:
    """Add durable draft payload to the existing DocumentRef owner."""
    inspector = inspect(engine)
    if "online_document_refs" not in inspector.get_table_names():
        return
    columns = {str(col.get("name") or "") for col in inspector.get_columns("online_document_refs")}
    if "payload_json" in columns:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE online_document_refs "
                "ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}'"
            )
        )


def _document_master_data(engine: Engine) -> None:
    """Extend the existing Customer and Company Settings owners for documents."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "online_customer_addresses" not in tables:
        _customer_address_table.create(engine, checkfirst=True)
    if "company_bank_accounts" not in tables:
        _bank_account_table.create(engine, checkfirst=True)
    inspector = inspect(engine)
    if "company_settings" not in inspector.get_table_names():
        return
    columns = {str(col.get("name") or "") for col in inspector.get_columns("company_settings")}
    additions = [
        ("company_name", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("legal_name", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("country", "VARCHAR(120) NOT NULL DEFAULT ''"),
        ("address", "TEXT NOT NULL DEFAULT ''"),
        ("website", "TEXT NOT NULL DEFAULT ''"),
        ("phone", "VARCHAR(120) NOT NULL DEFAULT ''"),
        ("email", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("tax_id", "VARCHAR(160) NOT NULL DEFAULT ''"),
    ]
    with engine.begin() as conn:
        for name, ddl in additions:
            if name in columns:
                continue
            conn.execute(text(f"ALTER TABLE company_settings ADD COLUMN {name} {ddl}"))


MIGRATIONS: list[tuple[str, str, Callable[[Engine], None]]] = [
    ("20260905_000_online_v01_baseline", "Online V0.1 existing business schema baseline", _baseline),
    (
        "20260906_001_intelligence_projection",
        "Canonical normalized intelligence projection storage",
        _intelligence_projection,
    ),
    (
        "20260906_002_intelligence_feed_sources",
        "Company-managed foreign-trade intelligence feed sources",
        _intelligence_feed_sources,
    ),
    (
        "20260906_003_industry_playbook_context",
        "Per-customer selection for the unified legacy-derived industry playbook",
        _industry_playbook_context,
    ),
    (
        "20260907_004_online_document_payload",
        "Durable draft payload on the existing OnlineDocumentRef owner",
        _online_document_payload,
    ),
    (
        "20260907_005_document_master_data",
        "Customer address history and seller payment data under existing owners",
        _document_master_data,
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
