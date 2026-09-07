from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .online_app import app


# Community owns the mature workspace, customer/product/deal repositories and
# formal document editor. Online supplies auth, tenant, cloud persistence and
# network capabilities. The deployed product fuses those layers into one UI;
# it must not grow a second customer/deal/document shell.
def _community_public_dir() -> Path:
    """Resolve the published Community surface without assuming repo depth."""

    configured = os.getenv("HUIDI_COMMUNITY_PUBLIC_DIR", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "public"
        if candidate.is_dir():
            return candidate.resolve()
    return (current.parent / "public").resolve()


COMMUNITY_PUBLIC_DIR = _community_public_dir()
COMMUNITY_SURFACE_ENABLED = os.getenv("HUIDI_COMMUNITY_SURFACE", "0").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
FUSION_ASSET_VERSION = "HUIDI-COMMUNITY-ONLINE-FUSION-3"


def community_surface_status() -> dict[str, object]:
    return {
        "enabled": COMMUNITY_SURFACE_ENABLED,
        "available": COMMUNITY_PUBLIC_DIR.is_dir(),
        "workspace": "/community/workspace.html",
        "document_start": "/community/document-start.html",
        "editor": "/community/editor.html",
        "mode": "community-online-fused-workspace",
    }


def _workspace_html() -> str:
    path = COMMUNITY_PUBLIC_DIR / "workspace.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Community workspace is unavailable")
    html = path.read_text(encoding="utf-8")
    if not COMMUNITY_SURFACE_ENABLED:
        return html

    # Capability UI can initialize with the page, but the Online navigation
    # extension must run after Community R1-R6 have finished constructing the
    # mature sidebar. This preserves Community as the navigation owner instead
    # of racing it with a body observer or maintaining a second shell.
    if "huidi-community-online-fusion.js" not in html:
        head_assets = (
            f'<link rel="stylesheet" href="/community/huidi-community-online-fusion.css?v={FUSION_ASSET_VERSION}">'
            f'<script src="/community/huidi-community-online-fusion.js?v={FUSION_ASSET_VERSION}"></script>'
        )
        if "</head>" not in html:
            raise HTTPException(status_code=500, detail="Community workspace head is invalid")
        html = html.replace("</head>", head_assets + "</head>", 1)

    if "huidi-community-online-nav-v1.js" not in html:
        nav_asset = (
            f'<script src="/community/huidi-community-online-nav-v1.js?v={FUSION_ASSET_VERSION}"></script>'
        )
        if "</body>" not in html:
            raise HTTPException(status_code=500, detail="Community workspace body is invalid")
        html = html.replace("</body>", nav_asset + "</body>", 1)

    html = html.replace(
        "<title>HUIDI Docs · 本地外贸工作台</title>",
        "<title>HUIDI · 外贸工作台</title>",
        1,
    )
    html = html.replace(
        '<body class="',
        '<body class="huidi-community-online ',
        1,
    )
    return html


# This exact route must be registered before the StaticFiles /community mount.
# The standalone Community files are never rewritten: only the deployed Online
# response receives fused assets, so downloaded/offline Local stays Local.
@app.get("/community/workspace.html", response_class=HTMLResponse)
def get_fused_community_workspace():
    return HTMLResponse(
        _workspace_html(),
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-HUIDI-Workspace-Mode": "community-online-fused-workspace",
        },
    )


if COMMUNITY_PUBLIC_DIR.is_dir():
    app.mount(
        "/community",
        StaticFiles(directory=str(COMMUNITY_PUBLIC_DIR), html=True),
        name="community-open-source",
    )


@app.get("/api/community-surface/status")
def get_community_surface_status():
    return community_surface_status()


@app.middleware("http")
async def community_surface_entry(request: Request, call_next):
    """Use the fused Community workspace as the one deployed product entry."""

    if (
        COMMUNITY_SURFACE_ENABLED
        and COMMUNITY_PUBLIC_DIR.is_dir()
        and request.method == "GET"
        and request.url.path == "/"
    ):
        return RedirectResponse("/community/workspace.html", status_code=307)
    return await call_next(request)
