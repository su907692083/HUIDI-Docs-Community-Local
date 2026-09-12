"""Built-in provider settings on the existing tenant ServiceConnection owner.

There is no new table and no mutation of process-wide environment variables.
Secrets are encrypted in ServiceConnection.encrypted_token; every consumer
resolves against the active tenant at request/job time.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

PROVIDERS = {
    "serper": {"name": "Serper · 企业 / 地图搜索", "kind": "key", "endpoint": "https://google.serper.dev", "key_env": "SERPER_API_KEY", "purpose": "找客户、地图找客户、公开联系人和搜索新闻", "docs_url": "https://serper.dev/", "test_note": "检查会进行一次真实搜索，可能消耗服务商额度；不保存客户。"},
    "tavily": {"name": "Tavily · 企业搜索", "kind": "key", "endpoint": "https://api.tavily.com", "key_env": "TAVILY_API_KEY", "url_env": "TAVILY_BASE_URL", "purpose": "找客户的独立来源或备用来源；不是收发邮箱服务", "docs_url": "https://docs.tavily.com/documentation/api-reference/introduction", "test_note": "检查 API Key 和账户用量，不创建客户。"},
    "hunter": {"name": "Hunter · 联系人查找", "kind": "key", "endpoint": "https://api.hunter.io/v2", "key_env": "HUNTER_API_KEY", "url_env": "HUNTER_BASE_URL", "purpose": "根据企业官网查找公开业务邮箱；不是发信账号", "docs_url": "https://hunter.io/api-documentation", "test_note": "检查账户授权，不发送邮件，不保存联系人。"},
    "gmail_oauth": {"name": "Gmail · 邮箱授权应用", "kind": "oauth", "provider": "gmail", "endpoint": "https://oauth2.googleapis.com", "prefix": "GMAIL", "purpose": "管理员先配置应用，使用者再登录自己的 Gmail 授权收发", "docs_url": "https://developers.google.com/identity/protocols/oauth2/web-server", "test_note": "此处仅检查配置完整性；须完成 Google 授权才能验证邮箱权限。"},
    "outlook_oauth": {"name": "Outlook · 邮箱授权应用", "kind": "oauth", "provider": "outlook", "endpoint": "https://login.microsoftonline.com", "prefix": "OUTLOOK", "purpose": "管理员先配置应用，使用者再登录自己的 Outlook / Microsoft 365 授权", "docs_url": "https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow", "test_note": "此处仅检查配置完整性；须完成 Microsoft 授权才能验证邮箱权限。"},
    "llm": {"name": "文字生成 · 兼容接口", "kind": "llm", "endpoint": "https://api.openai.com/v1", "key_env": "LLM_API_KEY", "url_env": "LLM_BASE_URL", "purpose": "仅生成待人工核对的开发信草稿，不自动发送", "docs_url": "", "test_note": "检查会向所填服务地址请求模型列表；不提交客户资料，不代表所选模型已可生成。"},
}
ENV_TO_PROVIDER = {v["key_env"]: k for k, v in PROVIDERS.items() if "key_env" in v}


def _stored(db: Session, key: str):
    from .service_connections import ServiceConnection
    return db.scalar(select(ServiceConnection).where(ServiceConnection.service_key == key))


def _decode(row) -> dict[str, Any]:
    from .service_connections import _decrypt
    if not row or not row.encrypted_token:
        return {}
    try:
        data = json.loads(_decrypt(row.encrypted_token))
        if not isinstance(data, dict) or data.get("schema") != "huidi.provider-settings/v1":
            raise ValueError()
        return data
    except (ValueError, TypeError):
        raise HTTPException(503, "服务授权记录无法读取，请管理员重新保存连接") from None


def resolve_provider(key: str, db: Session | None = None) -> dict[str, Any]:
    if key not in PROVIDERS:
        raise HTTPException(404, "没有找到这个内置来源")
    if db is None:
        from .main import SessionLocal
        with SessionLocal() as session:
            return resolve_provider(key, session)
    spec = PROVIDERS[key]
    row = _stored(db, key)
    if row:
        data = _decode(row)
        out = {**data, "endpoint_url": row.endpoint_url or spec["endpoint"], "enabled": bool(row.enabled), "source": "company"}
    else:
        out = {"source": "server", "enabled": True, "endpoint_url": os.getenv(spec.get("url_env", ""), "").strip().rstrip("/") or spec["endpoint"]}
        if spec["kind"] == "oauth":
            prefix = spec["prefix"]
            out.update(client_id=os.getenv(prefix+"_CLIENT_ID", "").strip(), client_secret=os.getenv(prefix+"_CLIENT_SECRET", "").strip(), redirect_uri=os.getenv(prefix+"_REDIRECT_URI", "").strip(), tenant=os.getenv("OUTLOOK_TENANT", "common").strip() or "common")
        else:
            out["token"] = os.getenv(spec["key_env"], "").strip()
            if key == "llm":
                out["model"] = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
    out["secret_saved"] = bool(out.get("token") or out.get("client_secret"))
    required = ("client_id", "client_secret") if spec["kind"] == "oauth" else ("token", "model") if key == "llm" else ("token",)
    out["configured"] = bool(out["enabled"] and all(out.get(f) for f in required))
    if not row and not any(out.get(f) for f in required if f != "model"):
        out["source"] = "none"
    # A disabled company override never falls through to platform credentials.
    if not out["enabled"]:
        out["token"] = out["client_secret"] = ""
    return out


def provider_ready(key: str, db: Session | None = None) -> bool:
    try:
        return bool(resolve_provider(key, db)["configured"])
    except HTTPException:
        return False


def configured_env(name: str, db: Session | None = None) -> bool:
    if name in ENV_TO_PROVIDER:
        return provider_ready(ENV_TO_PROVIDER[name], db)
    if name.startswith("GMAIL_CLIENT_"):
        return provider_ready("gmail_oauth", db)
    if name.startswith("OUTLOOK_CLIENT_"):
        return provider_ready("outlook_oauth", db)
    return bool(os.getenv(name, "").strip())


def callback_uri(provider: str, fallback: str = "") -> str:
    base = os.getenv("HUIDI_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if base:
        parsed = urlsplit(base)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.query or parsed.fragment or parsed.username:
            raise HTTPException(503, "服务器公开地址配置无效，请管理员检查 HUIDI_PUBLIC_BASE_URL")
        return base + "/api/mail/connect/" + provider + "/callback"
    return fallback


def public_provider_status(db: Session, key: str, request: Request | None = None) -> dict[str, Any]:
    spec = PROVIDERS[key]
    problem = ""
    try:
        cfg = resolve_provider(key, db)
    except HTTPException as exc:
        cfg = {"source": "company", "enabled": False, "configured": False, "endpoint_url": spec["endpoint"]}
        problem = str(exc.detail)
    out = {"service_key": key, **spec, "source": cfg["source"], "enabled": cfg["enabled"], "connected": cfg["configured"], "configured": cfg["configured"], "verified": False,
           "endpoint_url": cfg["endpoint_url"], "token_saved": bool(cfg.get("secret_saved")), "state": "configured" if cfg["configured"] else "disabled" if not cfg["enabled"] else "missing", "problem": problem}
    if spec["kind"] == "oauth":
        provider = spec["provider"]
        fallback = str(request.url_for("mail_connect_callback", provider=provider)) if request else ""
        out.update(client_id=cfg.get("client_id", "") if cfg["source"] == "company" else "", tenant=cfg.get("tenant", "common"), redirect_uri=cfg.get("redirect_uri") or callback_uri(provider, fallback), secret_saved=bool(cfg.get("secret_saved")))
    if key == "llm":
        out["model"] = cfg.get("model", "")
    # Environment variable identifiers are metadata, never their values.
    return out


def _clean_secret(value: str) -> str:
    value = value.strip()
    if value and (value.lower() in {"test-api-key", "your_api_key", "your-api-key", "api_key", "<token>"} or "在此粘贴" in value or "YOUR_API_KEY" in value):
        raise HTTPException(400, "请粘贴自己的真实密钥，不要使用示例或占位内容")
    if any(c in value for c in "\r\n"):
        raise HTTPException(400, "授权信息包含换行，请只粘贴密钥本身")
    return value


def save_provider(db: Session, key: str, payload: dict[str, Any], actor: str, expected_callback: str = "") -> None:
    from .service_connections import ServiceConnection, _encrypt
    spec = PROVIDERS[key]
    row = _stored(db, key)
    try:
        data = _decode(row)
    except HTTPException:
        # A changed server encryption key must not make re-entering credentials impossible.
        required = ("client_id", "client_secret") if spec["kind"] == "oauth" else ("token",)
        if not all(payload.get(f) for f in required):
            raise HTTPException(400, "旧授权无法读取，请完整重新填写应用 ID 和密钥或 API Key") from None
        data = {}
    if row and spec["kind"] == "llm" and payload.get("endpoint_url") and payload["endpoint_url"].strip().rstrip("/") != row.endpoint_url.rstrip("/") and not payload.get("token"):
        raise HTTPException(400, "更换文字生成服务地址时，请重新填写对应的 API Key")
    endpoint = (payload.get("endpoint_url") or (row.endpoint_url if row else "") or spec["endpoint"]).strip().rstrip("/")
    if spec["kind"] != "llm" and endpoint != spec["endpoint"]:
        raise HTTPException(400, "此服务使用内置官方地址，无需粘贴其他网址")
    if spec["kind"] == "llm":
        from .service_adapters import _validate_endpoint
        if urlsplit(endpoint).scheme != "https":
            raise HTTPException(400, "文字生成接口必须使用 HTTPS")
        _validate_endpoint(endpoint)
    fields = ("client_id", "client_secret", "tenant", "redirect_uri") if spec["kind"] == "oauth" else ("token", "model")
    for field in fields:
        value = payload.get(field)
        if value is None:
            continue
        value = value.strip()
        if field in ("token", "client_secret"):
            if value:
                data[field] = _clean_secret(value)
        else:
            data[field] = value
    if payload.get("clear_token"):
        data.pop("client_secret" if spec["kind"] == "oauth" else "token", None)
    if key == "outlook_oauth":
        data["tenant"] = data.get("tenant") or "common"
        if not re.fullmatch(r"[A-Za-z0-9.-]{1,255}", data["tenant"]):
            raise HTTPException(400, "Microsoft 租户仅接受 common、organizations、consumers、租户 ID 或域名")
    # Callback paths are generated by HUIDI, not arbitrary user destinations.
    if spec["kind"] == "oauth" and data.get("redirect_uri"):
        if data["redirect_uri"] != expected_callback:
            raise HTTPException(400, "请使用当前 HUIDI 显示的回调地址，不可填写其他站点")
        parsed = urlsplit(data["redirect_uri"])
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.netloc or not parsed.path.endswith("/api/mail/connect/" + spec["provider"] + "/callback"):
            raise HTTPException(400, "回调地址必须使用当前 HUIDI 显示的邮箱 callback 地址")
    enabled = bool(payload.get("enabled", True))
    required = ("client_id", "client_secret") if spec["kind"] == "oauth" else ("token", "model") if key == "llm" else ("token",)
    if enabled and not payload.get("clear_token") and not all(data.get(f) for f in required):
        raise HTTPException(400, "请填写完整的应用 ID 和密钥" if spec["kind"] == "oauth" else "请填写自己的 API Key" + ("及模型名称" if key == "llm" else ""))
    data["schema"] = "huidi.provider-settings/v1"
    encrypted = _encrypt(json.dumps(data, ensure_ascii=False))
    if row is None:
        row = ServiceConnection(service_key=key)
        db.add(row)
    row.endpoint_url, row.encrypted_token, row.enabled = endpoint, encrypted, int(enabled)
    row.updated_by, row.updated_at = actor[:160], datetime.now(timezone.utc)
    db.commit()


def read_provider_json(response: httpx.Response, name: str) -> dict[str, Any]:
    code = response.status_code
    if code in (401, 403):
        raise HTTPException(502, f"{name} 授权被拒绝（{code}），请检查密钥、接口权限或服务商的请求限制")
    if code in (402, 429, 432, 433):
        raise HTTPException(502, f"{name} 额度不足或请求受限（{code}），请核对余额与限额")
    if 300 <= code < 400:
        raise HTTPException(502, f"{name} 返回重定向，未跟随跳转以保护密钥")
    if code >= 400:
        raise HTTPException(502, f"{name} 接口请求失败（{code}），请检查地址、权限和请求参数")
    try:
        data = response.json()
    except (ValueError, TypeError):
        raise HTTPException(502, f"{name} 未返回有效 JSON，不能判定为连接成功") from None
    if not isinstance(data, dict) or data.get("error") or data.get("errors"):
        raise HTTPException(502, f"{name} 返回无效结果或服务错误，请检查服务配置")
    return data


def test_provider(db: Session, key: str) -> dict[str, Any]:
    spec = PROVIDERS[key]
    cfg = resolve_provider(key, db)
    if not cfg["configured"]:
        raise HTTPException(503, "此来源尚未配置或已停用，请先保存完整配置")
    if spec["kind"] == "oauth":
        return {"ok": True, "configured": True, "verified": False, "state": "authorization_required", "message": "配置字段完整，尚未验证应用密钥；请点击授权邮箱并完成登录，成功后才能收发。"}
    token, endpoint = cfg.get("token", ""), cfg["endpoint_url"]
    try:
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            if key == "serper":
                response = client.post(endpoint+"/search", headers={"X-API-KEY": token}, json={"q": "HUIDI connection test", "num": 1})
            elif key == "tavily":
                response = client.get(endpoint+"/usage", headers={"Authorization": "Bearer "+token})
            elif key == "hunter":
                response = client.get(endpoint+"/account", params={"api_key": token})
            else:
                from .service_adapters import _validate_endpoint
                _validate_endpoint(endpoint)
                response = client.get(endpoint+"/models", headers={"Authorization": "Bearer "+token})
    except httpx.TimeoutException:
        raise HTTPException(504, "服务连接超时，请检查服务器到服务商的网络") from None
    except httpx.RequestError:
        raise HTTPException(502, "无法连接服务商，请检查服务器 DNS、网络或服务地址") from None
    data = read_provider_json(response, spec["name"])
    valid = isinstance(data.get("organic"), list) if key == "serper" else isinstance(data.get("key"), dict) and isinstance(data.get("account"), dict) if key == "tavily" else isinstance(data.get("data"), dict) and bool(data["data"].get("email") or data["data"].get("requests")) if key == "hunter" else isinstance(data.get("data"), list)
    if not valid:
        raise HTTPException(502, "返回内容不符合此服务的接口格式，不能判定为连接成功")
    return {"ok": True, "verified": True, "state": "checked", "service_key": key, "checked_at": datetime.now(timezone.utc).isoformat(), "message": "本次接口检查通过；没有生成客户或发送邮件。" + (" 模型列表可读，具体模型生成能力仍需另行核对。" if key == "llm" else "")}
