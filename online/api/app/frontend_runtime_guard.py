from __future__ import annotations

import hashlib
import re

from fastapi.responses import HTMLResponse

from .main import WEB_DIR, app


_ASSET_RX = re.compile(r'(?P<prefix>(?:src|href)="/assets/[^"?]+)(?P<tail>")')


def _asset_version() -> str:
    digest = hashlib.sha256()
    if WEB_DIR.exists():
        for asset in sorted(WEB_DIR.iterdir(), key=lambda item: item.name):
            if asset.is_file() and asset.suffix.lower() in {".js", ".css"}:
                digest.update(asset.name.encode("utf-8"))
                digest.update(asset.read_bytes())
    return digest.hexdigest()[:16]


ASSET_VERSION = _asset_version()
_HTML_CACHE_CONTROL = "no-store, no-cache, must-revalidate, max-age=0"
_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"


def _headers(response_headers: dict[str, str] | None = None, *, clear_cache: bool = False) -> dict[str, str]:
    headers = dict(response_headers or {})
    headers.pop("content-length", None)
    headers.pop("content-type", None)
    headers["Cache-Control"] = _HTML_CACHE_CONTROL
    headers["Pragma"] = "no-cache"
    headers["Expires"] = "0"
    headers["X-HUIDI-Asset-Version"] = ASSET_VERSION
    if clear_cache:
        headers["Clear-Site-Data"] = '"cache"'
    return headers


def version_asset_refs(html: str) -> str:
    return _ASSET_RX.sub(lambda match: f"{match.group('prefix')}?v={ASSET_VERSION}{match.group('tail')}", html)


@app.middleware("http")
async def frontend_runtime_guard(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" and response.status_code == 200 and "text/html" in response.headers.get("content-type", ""):
        chunks: list[bytes] = []
        async for chunk in response.body_iterator:
            chunks.append(chunk if isinstance(chunk, bytes) else str(chunk).encode("utf-8"))
        html = version_asset_refs(b"".join(chunks).decode("utf-8"))
        return HTMLResponse(
            html,
            status_code=response.status_code,
            headers=_headers(dict(response.headers), clear_cache=request.url.hostname in {"127.0.0.1", "localhost", "::1"}),
            background=response.background,
        )
    if path.startswith("/assets/"):
        response.headers["Cache-Control"] = _ASSET_CACHE_CONTROL
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-HUIDI-Asset-Version"] = ASSET_VERSION
    return response
