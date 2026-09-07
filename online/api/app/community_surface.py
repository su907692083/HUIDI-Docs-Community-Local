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
FUSION_ASSET_VERSION = "HUIDI-COMMUNITY-ONLINE-FUSION-2"


def community_surface_status() -> dict[str, object]:
    return {
        "enabled": COMMUNITY_SURFACE_ENABLED,
        "available": COMMUNITY_PUBLIC_DIR.is_dir(),
        "workspace": "/community/workspace.html",
        "document_start": "/community/document-start.html",
        "editor": "/community/editor.html",
        "mode": "community-online-fused-workspace",
    }


def _insert_after_button(html: str, marker: str, fragment: str) -> str:
    start = html.find(marker)
    if start < 0:
        raise HTTPException(status_code=500, detail=f"Community workspace marker missing: {marker}")
    end = html.find("</button>", start)
    if end < 0:
        raise HTTPException(status_code=500, detail="Community workspace navigation is invalid")
    end += len("</button>")
    return html[:end] + fragment + html[end:]


def _fusion_navigation(html: str) -> str:
    """Make Online capabilities native Community navigation entries.

    These buttons are present before the mature Community workspace boot runs,
    so its existing switchView/binding logic owns navigation exactly like its
    customer/product/deal/document views. No iframe or second application shell.
    """

    first_nav = '<nav class="nav">\n    <button class="nav-btn active" data-view="home"'
    fused_first_nav = '<nav class="nav huidi-fusion-nav" data-fusion="1">\n    <button class="nav-btn active" data-view="home"'
    if first_nav not in html:
        raise HTTPException(status_code=500, detail="Community primary navigation is unavailable")
    html = html.replace(first_nav, fused_first_nav, 1)

    find_and_intel = (
        '<button class="nav-btn" data-view="online-find"><span class="icon-tile">'
        '<svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#i-users"></use></svg>'
        '</span><span class="nav-copy"><b>找客户</b><small>真实搜索、联系人、转询盘</small></span>'
        '<span class="status-dot online">联网</span></button>'
        '<button class="nav-btn" data-view="online-intel"><span class="icon-tile">'
        '<svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#i-catalog"></use></svg>'
        '</span><span class="nav-copy"><b>市场情报</b><small>全球市场、新闻、已有客户</small></span>'
        '<span class="status-dot online">联网</span></button>'
    )
    html = _insert_after_button(html, 'data-view="home"', find_and_intel)

    admin = (
        '<button class="nav-btn" data-view="online-admin"><span class="icon-tile">'
        '<svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#i-help"></use></svg>'
        '</span><span class="nav-copy"><b>团队与服务</b><small>工作区、数据源、连接状态</small></span>'
        '<span class="status-dot online">联网</span></button>'
    )
    help_marker = '<button class="nav-btn" data-view="help">'
    if help_marker not in html:
        raise HTTPException(status_code=500, detail="Community tools navigation is unavailable")
    html = html.replace(help_marker, admin + help_marker, 1)
    return html


def _workspace_html() -> str:
    path = COMMUNITY_PUBLIC_DIR / "workspace.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Community workspace is unavailable")
    html = path.read_text(encoding="utf-8")
    if not COMMUNITY_SURFACE_ENABLED:
        return html

    if "huidi-community-online-fusion.js" not in html:
        assets = (
            f'<link rel="stylesheet" href="/community/huidi-community-online-fusion.css?v={FUSION_ASSET_VERSION}">'
            f'<script src="/community/huidi-community-online-fusion.js?v={FUSION_ASSET_VERSION}"></script>'
        )
        if "</head>" not in html:
            raise HTTPException(status_code=500, detail="Community workspace head is invalid")
        html = html.replace("</head>", assets + "</head>", 1)

    html = _fusion_navigation(html)
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
# response receives fused navigation/assets, so downloaded/offline Local stays Local.
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
