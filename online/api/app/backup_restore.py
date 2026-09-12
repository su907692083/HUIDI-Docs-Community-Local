from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .online_app import app
from .tenant_storage import (
    current_organization_id,
    dispose_tenant_engine,
    ensure_tenant_schema,
    tenant_database_url,
)


BACKUP_SCHEMA = "huidi.online.business-backup/v1"
CONTROL_TABLES = {"organizations", "team_members", "team_sessions"}
BACKUP_ID_RX = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")


class RestoreRequest(BaseModel):
    confirmation: str = Field(min_length=7, max_length=40)


def _require_manager(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    if not isinstance(member, dict) or not member:
        return {"role": "owner", "display_name": "单人使用"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以管理公司备份")
    return member


def _backup_dir() -> Path:
    path = Path(os.getenv("HUIDI_BACKUP_DIR", "./backups")).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sqlite_path(organization_id: int) -> Path:
    url = tenant_database_url(organization_id)
    if not url.startswith("sqlite:///"):
        raise HTTPException(
            409,
            "当前使用的是服务器数据库，请使用数据库服务自带的备份方案；HUIDI 不会假装本地备份已经覆盖它。",
        )
    raw = url[len("sqlite:///") :]
    if not raw:
        raise HTTPException(500, "没有找到当前公司的数据文件")
    path = Path(raw).expanduser().resolve()
    ensure_tenant_schema(organization_id)
    return path


def _key_fingerprint() -> str:
    secret = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if not secret:
        return ""
    return hashlib.sha256(("huidi-backup-key-v1:" + secret).encode("utf-8")).hexdigest()[:16]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            block = f.read(1024 * 1024)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def _business_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [str(row[0]) for row in rows if str(row[0]) not in CONTROL_TABLES]


def _schema_fingerprint(conn: sqlite3.Connection) -> str:
    tables = _business_tables(conn)
    if not tables:
        return hashlib.sha256(b"").hexdigest()
    marks = ",".join("?" for _ in tables)
    rows = conn.execute(
        f"SELECT type,name,tbl_name,sql FROM sqlite_master "
        f"WHERE tbl_name IN ({marks}) AND type IN ('table','index','trigger') AND sql IS NOT NULL "
        f"ORDER BY type,name",
        tables,
    ).fetchall()
    payload = "\n".join("|".join(str(v or "") for v in row) for row in rows)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _integrity(path: Path) -> str:
    conn = sqlite3.connect(str(path))
    try:
        row = conn.execute("PRAGMA integrity_check").fetchone()
        return str(row[0] if row else "")
    finally:
        conn.close()


def _copy_business_snapshot(source: Path, target: Path) -> dict[str, int]:
    src = sqlite3.connect(str(source))
    dst = sqlite3.connect(str(target))
    try:
        src.execute("PRAGMA busy_timeout=5000")
        dst.execute("PRAGMA foreign_keys=OFF")
        tables = _business_tables(src)
        counts: dict[str, int] = {}
        for table in tables:
            schema = src.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not schema or not schema[0]:
                continue
            dst.execute(str(schema[0]))
            cursor = src.execute(f'SELECT * FROM "{table}"')
            columns = [str(x[0]) for x in cursor.description or []]
            rows = cursor.fetchmany(1000)
            total = 0
            if columns:
                placeholders = ",".join("?" for _ in columns)
                sql = f'INSERT INTO "{table}" VALUES ({placeholders})'
                while rows:
                    dst.executemany(sql, rows)
                    total += len(rows)
                    rows = cursor.fetchmany(1000)
            counts[table] = total
        if tables:
            marks = ",".join("?" for _ in tables)
            objects = src.execute(
                f"SELECT type,name,sql FROM sqlite_master "
                f"WHERE tbl_name IN ({marks}) AND type IN ('index','trigger') AND sql IS NOT NULL "
                f"ORDER BY type,name",
                tables,
            ).fetchall()
            for _, _, sql in objects:
                try:
                    dst.execute(str(sql))
                except sqlite3.OperationalError:
                    # Some indexes are implicit and intentionally have no SQL.
                    pass
        dst.commit()
        return counts
    finally:
        src.close()
        dst.close()


def _backup_paths(organization_id: int, backup_id: str) -> tuple[Path, Path]:
    base = _backup_dir()
    stem = f"org-{organization_id}-{backup_id}"
    return base / f"{stem}.db", base / f"{stem}.json"


def _manifest_for(organization_id: int, backup_id: str) -> dict[str, Any]:
    db_path, manifest_path = _backup_paths(organization_id, backup_id)
    if not manifest_path.exists() or not db_path.exists():
        raise HTTPException(404, "没有找到这份备份")
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(409, "这份备份的说明文件已经损坏")
    if int(data.get("organization_id") or 0) != organization_id:
        raise HTTPException(403, "这份备份不属于当前公司")
    return data


def _public_manifest(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": data.get("id"),
        "created_at": data.get("created_at"),
        "reason": data.get("reason", "manual"),
        "size": data.get("size", 0),
        "sha256": data.get("sha256", ""),
        "tables": data.get("tables", 0),
        "rows": data.get("rows", 0),
        "verified": bool(data.get("verified")),
    }


def _prune(organization_id: int) -> None:
    keep = max(5, min(200, int(os.getenv("HUIDI_BACKUP_KEEP", "30") or 30)))
    manifests = sorted(
        _backup_dir().glob(f"org-{organization_id}-*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for manifest in manifests[keep:]:
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            backup_id = str(data.get("id") or "")
            db_path, _ = _backup_paths(organization_id, backup_id)
            db_path.unlink(missing_ok=True)
            manifest.unlink(missing_ok=True)
        except Exception:
            continue


def create_company_backup(reason: str = "manual") -> dict[str, Any]:
    organization_id = current_organization_id()
    source = _sqlite_path(organization_id)
    now = datetime.now(timezone.utc)
    backup_id = f"{now.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    final_db, final_manifest = _backup_paths(organization_id, backup_id)
    tmp_path = None
    try:
        fd, temp_name = tempfile.mkstemp(prefix="huidi-backup-", suffix=".db", dir=str(_backup_dir()))
        os.close(fd)
        tmp_path = Path(temp_name)
        counts = _copy_business_snapshot(source, tmp_path)
        if _integrity(tmp_path).lower() != "ok":
            raise HTTPException(500, "备份校验没有通过，未保存这份备份")
        check = sqlite3.connect(str(tmp_path))
        try:
            schema_fingerprint = _schema_fingerprint(check)
        finally:
            check.close()
        os.replace(tmp_path, final_db)
        tmp_path = None
        manifest = {
            "schema": BACKUP_SCHEMA,
            "id": backup_id,
            "organization_id": organization_id,
            "created_at": now.isoformat(),
            "reason": reason,
            "size": final_db.stat().st_size,
            "sha256": _sha256(final_db),
            "schema_fingerprint": schema_fingerprint,
            "secret_fingerprint": _key_fingerprint(),
            "tables": len(counts),
            "rows": sum(counts.values()),
            "row_counts": counts,
            "verified": True,
        }
        final_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        _prune(organization_id)
        return manifest
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


def verify_company_backup(backup_id: str) -> dict[str, Any]:
    if not BACKUP_ID_RX.fullmatch(backup_id):
        raise HTTPException(404, "没有找到这份备份")
    organization_id = current_organization_id()
    data = _manifest_for(organization_id, backup_id)
    db_path, _ = _backup_paths(organization_id, backup_id)
    if _sha256(db_path) != str(data.get("sha256") or ""):
        raise HTTPException(409, "备份文件校验不一致，请不要用于恢复")
    if _integrity(db_path).lower() != "ok":
        raise HTTPException(409, "备份文件完整性检查没有通过")
    conn = sqlite3.connect(str(db_path))
    try:
        if any(table in CONTROL_TABLES for table in _business_tables(conn)):
            raise HTTPException(409, "备份内容包含不应进入公司备份的控制数据")
        schema_fingerprint = _schema_fingerprint(conn)
    finally:
        conn.close()
    if schema_fingerprint != str(data.get("schema_fingerprint") or ""):
        raise HTTPException(409, "备份结构校验不一致，请不要用于恢复")
    return {"ok": True, "backup": _public_manifest(data)}


def restore_company_backup(backup_id: str) -> dict[str, Any]:
    organization_id = current_organization_id()
    verified = verify_company_backup(backup_id)
    data = _manifest_for(organization_id, backup_id)
    current_key = _key_fingerprint()
    backup_key = str(data.get("secret_fingerprint") or "")
    if backup_key and current_key != backup_key:
        raise HTTPException(
            409,
            "当前服务器安全密钥与备份时不同。为了避免邮箱和数据服务授权失效，已停止恢复。",
        )
    target = _sqlite_path(organization_id)
    source, _ = _backup_paths(organization_id, backup_id)
    target_conn = sqlite3.connect(str(target), timeout=10)
    source_conn = sqlite3.connect(str(source))
    try:
        if _schema_fingerprint(target_conn) != str(data.get("schema_fingerprint") or ""):
            raise HTTPException(409, "当前版本的数据结构与这份备份不同，不能直接覆盖恢复")
    finally:
        target_conn.close()
        source_conn.close()

    safety = create_company_backup(reason="before_restore")
    target_conn = sqlite3.connect(str(target), timeout=20)
    source_conn = sqlite3.connect(str(source))
    try:
        target_conn.execute("PRAGMA foreign_keys=OFF")
        target_conn.execute("BEGIN IMMEDIATE")
        target_tables = _business_tables(target_conn)
        source_tables = _business_tables(source_conn)
        for table in target_tables:
            target_conn.execute(f'DELETE FROM "{table}"')
        for table in source_tables:
            columns = [
                str(row[1])
                for row in source_conn.execute(f'PRAGMA table_info("{table}")').fetchall()
            ]
            if not columns:
                continue
            quoted = ",".join(f'"{name}"' for name in columns)
            placeholders = ",".join("?" for _ in columns)
            cursor = source_conn.execute(f'SELECT {quoted} FROM "{table}"')
            batch = cursor.fetchmany(1000)
            sql = f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders})'
            while batch:
                target_conn.executemany(sql, batch)
                batch = cursor.fetchmany(1000)
        target_conn.commit()
        check = target_conn.execute("PRAGMA integrity_check").fetchone()
        if not check or str(check[0]).lower() != "ok":
            raise RuntimeError("integrity_check failed after restore")
    except Exception:
        target_conn.rollback()
        raise
    finally:
        source_conn.close()
        target_conn.close()
    dispose_tenant_engine(organization_id)
    ensure_tenant_schema(organization_id)
    return {
        "ok": True,
        "restored": verified["backup"],
        "safety_backup": _public_manifest(safety),
        "message": "公司业务数据已恢复，恢复前的当前数据也已自动留了一份安全备份。",
    }


@app.get("/api/backups")
def list_backups(request: Request):
    _require_manager(request)
    organization_id = current_organization_id()
    items: list[dict[str, Any]] = []
    for path in sorted(
        _backup_dir().glob(f"org-{organization_id}-*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    ):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if int(data.get("organization_id") or 0) == organization_id:
                items.append(_public_manifest(data))
        except Exception:
            continue
    return {"ok": True, "items": items[:200], "local_backup": True}


@app.post("/api/backups")
def create_backup(request: Request):
    _require_manager(request)
    return {"ok": True, "backup": _public_manifest(create_company_backup("manual"))}


@app.post("/api/backups/{backup_id}/verify")
def verify_backup(backup_id: str, request: Request):
    _require_manager(request)
    return verify_company_backup(backup_id)


@app.get("/api/backups/{backup_id}/download")
def download_backup(backup_id: str, request: Request):
    _require_manager(request)
    verified = verify_company_backup(backup_id)
    organization_id = current_organization_id()
    db_path, _ = _backup_paths(organization_id, backup_id)
    return FileResponse(
        path=str(db_path),
        media_type="application/octet-stream",
        filename=f"HUIDI-company-backup-{backup_id}.db",
        headers={"X-HUIDI-Backup-SHA256": str(verified["backup"].get("sha256") or "")},
    )


@app.post("/api/backups/{backup_id}/restore")
def restore_backup(backup_id: str, req: RestoreRequest, request: Request):
    _require_manager(request)
    if req.confirmation.strip().upper() != "RESTORE":
        raise HTTPException(400, "恢复前需要明确确认")
    return restore_company_backup(backup_id)
