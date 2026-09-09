"""Tenant-scoped adapter for the existing Community Feishu UI.

Only Feishu's fixed official API is called. Business imports remain owned by
Community; this module stores credentials in the existing ServiceConnection.
"""
from __future__ import annotations

import base64
import binascii
import json
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, quote, urlsplit

import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .main import get_db
from .online_app import app
from .service_connections import ServiceConnection, _decrypt, _encrypt, _require_manager

KEY = "feishu_docs"
API = "https://open.feishu.cn/open-apis/"
TOKEN = re.compile(r"[A-Za-z0-9_-]{1,160}\Z")
MAX_RESPONSE = 2_000_000


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def identifier(value: str, label: str, optional: bool = False) -> str:
    value = value.strip()
    if not value and optional:
        return ""
    if not TOKEN.fullmatch(value):
        raise HTTPException(400, f"{label}格式不正确，请粘贴标识本身或使用表格链接")
    return value


def split_url(value: str):
    try:
        u = urlsplit(value)
        u.port  # malformed ports must be a validation error, not an HTTP 500
        return u
    except ValueError:
        raise HTTPException(400, "链接格式不正确，请重新复制飞书链接") from None


def object_data(response: dict) -> dict:
    data = response.get("data")
    if not isinstance(data, dict):
        raise HTTPException(502, "飞书返回的数据结构不完整，请重新读取；没有导入")
    return data


def object_items(data: dict, key: str) -> list[dict]:
    items = data.get(key, [])
    if not isinstance(items, list) or any(not isinstance(x, dict) for x in items):
        raise HTTPException(502, "飞书返回的记录格式不正确，请重新读取；没有导入")
    return items


def domain(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    u = split_url(value if "://" in value else "https://" + value)
    host = (u.hostname or "").lower()
    if u.scheme != "https" or u.username or u.password or u.port or not host.endswith(".feishu.cn") or u.path not in ("", "/") or u.query or u.fragment:
        raise HTTPException(400, "请输入自己的飞书企业域名，例如 example.feishu.cn")
    return host


def load(db: Session) -> tuple[ServiceConnection | None, dict[str, Any]]:
    row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == KEY))
    if not row:
        return None, {}
    try:
        cfg = json.loads(_decrypt(row.encrypted_token))
        if not isinstance(cfg, dict) or cfg.get("schema") != "huidi.feishu/v1":
            raise ValueError()
        return row, cfg
    except (ValueError, TypeError):
        raise HTTPException(503, "飞书授权无法读取，请管理员重新填写应用凭证") from None


def save(db: Session, row, cfg: dict, actor: str = "") -> None:
    if row is None:
        row = ServiceConnection(service_key=KEY)
        db.add(row)
    row.endpoint_url = API
    row.encrypted_token = _encrypt(json.dumps({**cfg, "schema": "huidi.feishu/v1"}, ensure_ascii=False))
    row.enabled = 1
    row.updated_by = actor[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()


def public(cfg: dict) -> dict:
    app_id = cfg.get("app_id", "")
    doc = cfg.get("document_id", "")
    host = cfg.get("tenant_domain", "")
    return {"ok": True, "mode": "online", "configured": bool(app_id and cfg.get("app_secret")),
            "app_id": app_id, "app_id_masked": app_id[:6] + "…" + app_id[-4:] if app_id else "",
            "secret_saved": bool(cfg.get("app_secret")), "tenant_domain": host,
            "folder_token": cfg.get("folder_token", ""), "document_id": doc,
            "document_url": f"https://{host}/docx/{doc}" if host and doc else "",
            "last_sync_at": cfg.get("last_sync_at", ""), "last_test_at": cfg.get("last_test_at", ""),
            "verified": False, "scope_note": "已保存不代表表格权限已验证；先测试应用，再读取目标表格。"}


def request_json(method: str, path: str, token: str = "", body=None, params=None) -> dict:
    # Never follow a user URL or a provider redirect with a credential attached.
    if not path or path.startswith("/") or ".." in path or "://" in path:
        raise HTTPException(400, "无效的飞书接口路径")
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with httpx.Client(timeout=httpx.Timeout(18, connect=6), follow_redirects=False) as client:
            with client.stream(method, API + path, headers=headers, json=body, params=params) as response:
                if response.status_code != 200:
                    code = response.status_code
                    note = "授权或文件权限不足" if code in (401, 403) else "请求受限，请稍后重试" if code == 429 else "请求未完成"
                    raise HTTPException(502, f"飞书{note}（HTTP {code}）")
                raw = bytearray()
                for chunk in response.iter_bytes():
                    raw.extend(chunk)
                    if len(raw) > MAX_RESPONSE:
                        raise HTTPException(502, "飞书返回内容过大，请缩小当前表格范围")
        data = json.loads(raw)
    except httpx.TimeoutException:
        if method == "POST" and path.startswith("docx/"):
            raise HTTPException(504, "飞书写入结果尚未确认，请先检查飞书文档，勿重复点击同步") from None
        raise HTTPException(504, "连接飞书超时，输入已保留，请稍后重试") from None
    except httpx.HTTPError:
        raise HTTPException(502, "无法连接飞书开放平台，请检查服务器网络") from None
    except (ValueError, UnicodeError):
        raise HTTPException(502, "飞书未返回有效数据，不能判定为成功") from None
    if not isinstance(data, dict) or data.get("code") != 0:
        code = data.get("code", "unknown") if isinstance(data, dict) else "unknown"
        # Do not echo the upstream message: it may include request credentials.
        raise HTTPException(502, f"飞书未完成请求（代码 {str(code)[:20]}），请检查应用发布状态、接口权限和目标文件授权")
    return data


def access(cfg: dict) -> str:
    if not cfg.get("app_id") or not cfg.get("app_secret"):
        raise HTTPException(503, "请先配置飞书 App ID 和 App Secret")
    out = request_json("POST", "auth/v3/tenant_access_token/internal", body={"app_id": cfg["app_id"], "app_secret": cfg["app_secret"]})
    token = out.get("tenant_access_token")
    if not isinstance(token, str) or not token:
        raise HTTPException(502, "飞书没有返回有效授权，请检查应用凭证")
    return token


class Config(BaseModel):
    app_id: str = Field(min_length=1, max_length=160)
    app_secret: str = Field(default="", max_length=2048)
    tenant_domain: str = Field(default="", max_length=255)
    folder_token: str = Field(default="", max_length=160)
    document_id: str = Field(default="", max_length=160)


class Source(BaseModel):
    url: str = Field(default="", max_length=2000)
    type: str = Field(default="", max_length=20)
    token: str = Field(default="", max_length=160)
    title: str = Field(default="", max_length=200)
    sheet_id: str = Field(default="", max_length=160)
    table_id: str = Field(default="", max_length=160)
    page_token: str = Field(default="", max_length=2048)
    page_size: int = Field(default=50, ge=1, le=100)


def parse_source(src: Source) -> dict:
    kind, tok, sheet, table = src.type, src.token, src.sheet_id, src.table_id
    canonical = ""
    if src.url:
        u = split_url(src.url.strip())
        host = (u.hostname or "").lower()
        if u.scheme != "https" or u.username or u.password or u.port or not host.endswith(".feishu.cn"):
            raise HTTPException(400, "请粘贴自己的 HTTPS 飞书表格链接，不接受其他站点地址")
        parts = u.path.strip("/").split("/")
        if len(parts) != 2 or parts[0] not in ("sheets", "base", "bitable"):
            raise HTTPException(400, "请打开源电子表格或多维表格后复制链接；暂不直接读取 Wiki 页面")
        kind, tok = ("sheet" if parts[0] == "sheets" else "bitable"), parts[1]
        query = parse_qs(u.query)
        sheet = sheet or query.get("sheet", query.get("sheet_id", [""]))[0]
        table = table or query.get("table", query.get("table_id", [""]))[0]
        canonical = f"https://{host}/{parts[0]}/{tok}"
    if kind not in ("sheet", "bitable"):
        raise HTTPException(400, "请先选择电子表格或多维表格")
    return {"kind": kind, "token": identifier(tok, "表格标识"), "sheet_id": identifier(sheet, "工作表标识", True),
            "table_id": identifier(table, "数据表标识", True), "title": src.title, "url": canonical}


def scalar(value: Any, depth=0) -> str:
    if depth > 5:
        raise HTTPException(422, "字段结构过于复杂，请先转换为文本后读取，避免内容丢失")
    if value is None:
        return ""
    if isinstance(value, dict):
        for key in ("text", "name", "link"):
            if key in value:
                return scalar(value[key], depth + 1)
        return " / ".join(scalar(v, depth+1) for v in value.values())
    if isinstance(value, list):
        return " / ".join(scalar(v, depth+1) for v in value)
    return str(value)


def columns_for(values: list) -> list[str]:
    seen = set()
    columns = []
    for i, val in enumerate(values[:52]):
        base = scalar(val).strip() or f"列{i+1}"
        name = base
        n = 2
        while name in seen:
            name = f"{base}_{n}"
            n += 1
        seen.add(name)
        columns.append(name)
    return columns


@app.get("/api/feishu/status")
def status(db: Session = Depends(get_db)):
    return public(load(db)[1])


@app.post("/api/feishu/config")
def configure(payload: Config, request: Request, db: Session = Depends(get_db)):
    member = _require_manager(request)
    try:
        row, old = load(db)
    except HTTPException:
        if not payload.app_secret:
            raise
        row = db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == KEY))
        old = {}
    new = payload.model_dump()
    new["app_id"] = identifier(new["app_id"], "App ID")
    new["tenant_domain"] = domain(new["tenant_domain"])
    for key in ("folder_token", "document_id"):
        new[key] = identifier(new[key], key, True)
    secret = new["app_secret"].strip()
    if not secret:
        if old.get("app_id") != new["app_id"]:
            raise HTTPException(400, "更换 App ID 时请重新填写对应的 App Secret")
        secret = old.get("app_secret", "")
    if not secret or any(c in secret for c in "\r\n"):
        raise HTTPException(400, "请填写自己的 App Secret，不要包含换行")
    cfg = {**old, **new, "app_secret": secret, "last_test_at": ""}
    save(db, row, cfg, str(member.get("display_name", "")))
    return {**public(cfg), "message": "飞书配置已加密保存，请测试应用并读取目标表格"}


@app.post("/api/feishu/test")
def test(request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row, cfg = load(db)
    access(cfg)
    cfg["last_test_at"] = stamp()
    save(db, row, cfg)
    return {"ok": True, "verified": True, "message": "应用凭证检查通过；目标表格的读取权限需在读取时单独验证。不会自动导入或发送任何资料。"}


class Folder(BaseModel):
    folder_token: str = Field(default="", max_length=160)
    page_token: str = Field(default="", max_length=2048)


@app.post("/api/feishu/source/list")
def list_folder(payload: Folder, db: Session = Depends(get_db)):
    cfg = load(db)[1]
    folder = identifier(payload.folder_token or cfg.get("folder_token", ""), "文件夹 Token")
    params = {"folder_token": folder, "page_size": 50}
    if payload.page_token:
        params["page_token"] = payload.page_token
    data = object_data(request_json("GET", "drive/v1/files", access(cfg), params=params))
    items = [{"token": x.get("token", ""), "name": x.get("name", ""), "type": x.get("type", ""),
              "modified_time": x.get("modified_time", ""), "reusable": x.get("type") in ("sheet", "bitable")} for x in object_items(data, "files")[:50]]
    more, cursor = bool(data.get("has_more")), data.get("next_page_token", data.get("page_token", ""))
    if more and (not isinstance(cursor, str) or not cursor):
        raise HTTPException(502, "飞书未返回文件夹下一页位置，不能视为完整列表")
    return {"ok": True, "items": items, "has_more": more, "page_token": cursor}


@app.post("/api/feishu/source/inspect")
def inspect_source(payload: Source, db: Session = Depends(get_db)):
    src = parse_source(payload)  # Reject unrelated links before sending any credential.
    token = access(load(db)[1])
    root = quote(src["token"], safe="")
    if src["kind"] == "sheet":
        data = object_data(request_json("GET", f"sheets/v3/spreadsheets/{root}/sheets/query", token))
        choices = [{"id": x.get("sheet_id", ""), "name": x.get("title", ""), "rows": (x.get("grid_properties") or {}).get("row_count", 0), "columns": (x.get("grid_properties") or {}).get("column_count", 0)} for x in object_items(data, "sheets")]
        field = "sheet_id"
    else:
        data = object_data(request_json("GET", f"bitable/v1/apps/{root}/tables", token, params={"page_size": 100}))
        if data.get("has_more"):
            raise HTTPException(422, "该多维表格超过100个数据表，请先整理到单独表格后读取，避免遗漏可选表")
        choices = [{"id": x.get("table_id", ""), "name": x.get("name", "")} for x in object_items(data, "items")]
        field = "table_id"
    selected = src[field]
    if not selected and len(choices) != 1:
        if not choices:
            raise HTTPException(502, "没有可读取的数据表，请检查文件权限")
        return {"ok": True, "source": src, "choices": choices, "selection_required": True, "columns": [], "rows": []}
    selected = selected or choices[0]["id"]
    match = next((x for x in choices if x["id"] == selected), None)
    if not match:
        # Do not silently select another table when a requested ID is missing.
        raise HTTPException(400, "指定的数据表不在可读取列表中，请重新选择或核对权限")
    src[field] = identifier(selected, "数据表标识")
    src["title"] = match["name"] or src["title"] or "飞书表格"
    if src["kind"] == "bitable":
        params = {"page_size": payload.page_size}
        if payload.page_token:
            params["page_token"] = payload.page_token
        data = object_data(request_json("GET", f"bitable/v1/apps/{root}/tables/{selected}/records", token, params=params))
        raw_rows = object_items(data, "items")
        if len(raw_rows) > payload.page_size or any(not isinstance(x.get("fields", {}), dict) for x in raw_rows):
            raise HTTPException(502, "飞书返回的本页记录无效，请重新读取；没有导入")
        cols = list(dict.fromkeys(k for x in raw_rows for k in x.get("fields", {})))
        if len(cols) > 52:
            raise HTTPException(422, "当前数据表超过52列，请先在飞书拆分需要导入的资料，避免漏列")
        rows = [{c: scalar(x.get("fields", {}).get(c)) for c in cols} for x in raw_rows]
        more, cursor = bool(data.get("has_more")), data.get("page_token", "")
    else:
        if int(match.get("columns") or 0) > 52:
            raise HTTPException(422, "当前工作表超过52列，请先整理需要导入的资料，避免漏列")
        if payload.page_token and not re.fullmatch(r"[0-9]{1,7}", payload.page_token):
            raise HTTPException(400, "分页位置无效，请重新读取表格")
        start = max(2, int(payload.page_token or "2"))
        def values(a1):
            result = object_data(request_json("GET", f"sheets/v2/spreadsheets/{root}/values/{quote(selected+'!'+a1,safe='')}", token))
            value_range = result.get("valueRange")
            matrix = value_range.get("values", []) if isinstance(value_range, dict) else None
            if not isinstance(matrix, list) or any(not isinstance(row, list) or len(row) > 52 for row in matrix):
                raise HTTPException(502, "飞书返回的表格区域无效，请重新读取；没有导入")
            return matrix
        header = values("A1:AZ1")
        if not header:
            raise HTTPException(422, "第一行没有表头，请在飞书补充列名后重试")
        cols = columns_for(header[0])
        matrix = values(f"A{start}:AZ{start+payload.page_size-1}")
        rows = [{c: scalar(r[i]) if i < len(r) else "" for i,c in enumerate(cols)} for r in matrix if any(scalar(v).strip() for v in r)]
        end = start + payload.page_size
        more = len(matrix) >= payload.page_size and end <= int(match.get("rows") or end)
        cursor = str(end) if more else ""
    if more and (not isinstance(cursor, str) or not cursor):
        raise HTTPException(502, "飞书未返回下一页位置，请重新读取，当前结果不能视为整表")
    return {"ok": True, "source": src, "choices": choices, "columns": cols, "rows": rows,
            "has_more": more, "page_token": cursor, "page_size": payload.page_size,
            "scope_note": "仅当前页；导入只处理已预览的本页记录，不代表整表。"}


class Snapshot(BaseModel):
    snapshot_b64: str = Field(min_length=1, max_length=500000)


@app.post("/api/feishu/sync")
def sync_snapshot(payload: Snapshot, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    try:
        snap = json.loads(base64.b64decode(payload.snapshot_b64, validate=True))
        if not isinstance(snap, dict) or snap.get("format") != "HUIDI_FEISHU_COLLAB_SNAPSHOT_V1":
            raise ValueError()
    except (ValueError, binascii.Error, UnicodeError):
        raise HTTPException(400, "协作摘要格式不正确，没有发送") from None
    row, cfg = load(db)
    token = access(cfg)
    # Explicit, allowlisted text summaries only. Never upload arbitrary fields,
    # bank accounts, images, complete backups or credentials from the payload.
    blocks = [{"block_type": 2, "text": {"elements": [{"text_run": {"content": "HUIDI 协作摘要 · " + stamp() + "\n仅为主动发送的文字摘要，不是完整备份。"}}]}}]
    specs = [("customers", "客户", ("company", "contact", "country"), 50), ("products", "产品", ("sku", "name", "spec"), 50), ("deals", "业务", ("title", "customer", "stage", "next"), 50), ("documents", "单据", ("type", "no", "customer"), 80)]
    for key, label, fields, limit in specs:
        records = snap.get(key, [])
        if not isinstance(records, list):
            raise HTTPException(400, "协作摘要内容格式不正确，没有发送")
        text = label + "（最近 " + str(min(len(records), limit)) + " 条）\n"
        text += "\n".join(" · ".join(str(r.get(f, ""))[:150].replace("\n", " ") for f in fields) for r in records[:limit] if isinstance(r, dict))
        for start in range(0, len(text), 1500):
            blocks.append({"block_type": 2, "text": {"elements": [{"text_run": {"content": text[start:start+1500]}}]}})
    if not cfg.get("document_id"):
        body = {"title": "HUIDI 业务协作摘要"}
        if cfg.get("folder_token"):
            body["folder_token"] = cfg["folder_token"]
        doc = request_json("POST", "docx/v1/documents", token, body=body).get("data", {}).get("document", {}).get("document_id", "")
        cfg["document_id"] = identifier(doc, "飞书返回的文档标识")
        # Retain the created document even if a subsequent append fails.
        save(db, row, cfg)
        row, cfg = load(db)
    doc = cfg["document_id"]
    if len(blocks) > 50:
        raise HTTPException(400, "摘要过大，请减少本次记录数")
    request_json("POST", f"docx/v1/documents/{doc}/blocks/{doc}/children", token, body={"children": blocks}, params={"document_revision_id": -1})
    cfg["last_sync_at"] = stamp()
    save(db, row, cfg)
    return {**public(cfg), "synced_at": cfg["last_sync_at"], "blocks_written": len(blocks)}
