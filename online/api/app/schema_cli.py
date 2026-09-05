from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from sqlalchemy import create_engine, text

from .daily_app import app  # noqa: F401 - register the complete Online metadata
from .main import Base
from .schema_migrations import apply_schema_migrations, schema_migration_status
from .team_access import Organization
from .tenant_storage import ControlSessionLocal, tenant_database_url


def _engine(organization_id: int):
    url = tenant_database_url(organization_id)
    sqlite = url.startswith("sqlite")
    return create_engine(
        url,
        connect_args={"check_same_thread": False} if sqlite else {},
        pool_pre_ping=not sqlite,
        pool_recycle=1800 if not sqlite else -1,
    )


def organization_ids(include_disabled: bool = False) -> list[int]:
    db = ControlSessionLocal()
    try:
        rows = db.query(Organization).order_by(Organization.id.asc()).all()
        ids = [int(row.id) for row in rows if include_disabled or bool(row.enabled)]
        return ids or [1]
    finally:
        db.close()


def database_status(organization_id: int) -> dict[str, Any]:
    engine = _engine(organization_id)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        status = schema_migration_status(engine)
        return {"organization_id": organization_id, "connected": True, **status}
    except Exception as exc:
        return {
            "organization_id": organization_id,
            "connected": False,
            "up_to_date": False,
            "pending": [],
            "error": str(exc)[:500],
        }
    finally:
        engine.dispose()


def upgrade_database(organization_id: int) -> dict[str, Any]:
    engine = _engine(organization_id)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        # V0.1 compatibility baseline: create any currently known business
        # tables first, then apply/record forward revisions. This makes schema
        # changes explicit in deployment while keeping existing SQLite installs
        # non-destructive. A later major release can retire create_all after all
        # historical tables have dedicated migrations.
        Base.metadata.create_all(engine)
        status = apply_schema_migrations(engine)
        return {"organization_id": organization_id, "connected": True, **status}
    finally:
        engine.dispose()


def _targets(args: argparse.Namespace) -> list[int]:
    if args.organization:
        return [max(1, int(args.organization))]
    if args.all:
        return organization_ids(include_disabled=bool(args.include_disabled))
    return [1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="HUIDI Online company database schema tool")
    parser.add_argument("command", choices=["status", "upgrade", "check"])
    parser.add_argument("--organization", type=int, default=0, help="one company ID")
    parser.add_argument("--all", action="store_true", help="all enabled companies")
    parser.add_argument("--include-disabled", action="store_true", help="include disabled companies with --all")
    args = parser.parse_args(argv)

    results = []
    failed = False
    for organization_id in _targets(args):
        try:
            if args.command == "upgrade":
                result = upgrade_database(organization_id)
            else:
                result = database_status(organization_id)
        except Exception as exc:
            result = {
                "organization_id": organization_id,
                "connected": False,
                "up_to_date": False,
                "error": str(exc)[:500],
            }
        if not result.get("connected") or not result.get("up_to_date"):
            failed = True
        results.append(result)

    print(json.dumps({"command": args.command, "results": results}, ensure_ascii=False, indent=2, default=str))
    if args.command == "check" and failed:
        return 2
    if args.command == "upgrade" and failed:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
