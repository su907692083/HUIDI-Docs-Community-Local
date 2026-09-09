from __future__ import annotations

import os
import hashlib
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
FUSION_ASSET_VERSION = "HUIDI-COMMUNITY-ONLINE-FUSION-13"

def _fusion_content_revision() -> str:
    digest = hashlib.sha256()
    for folder in (COMMUNITY_PUBLIC_DIR, Path(__file__).resolve().parents[1] / "web"):
        for asset in sorted(folder.glob("*")):
            if asset.is_file() and asset.suffix in {".js", ".css"}:
                digest.update(asset.name.encode())
                digest.update(asset.read_bytes())
    return digest.hexdigest()[:16]

FUSION_ASSET_VERSION += "-" + _fusion_content_revision()
# Only the existing tab owner's critical presentation is inlined. Hidden panels
# also use the HTML hidden property: a missing stylesheet cannot expose them.
_CRITICAL_TABS = (
    '<style data-huidi-critical-tabs>'
    '.fv2-pane[hidden]{display:none!important}'
    '.fv2-tabs{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:8px 0}'
    'body.huidi-community-online .fv2-tabs .fv2-tab{font:inherit;font-size:13px;min-height:34px;padding:6px 12px;border:1px solid #d9e2ec;border-radius:7px;background:#fff;color:#36516f;cursor:pointer}'
    '.fv2-tab[aria-selected=true]{background:#eaf2ff;color:#185fc2;border-color:#a5c3ef}'
    '.huidi-tab-more{position:relative;margin-left:auto}'
    '.huidi-tab-more:not([open])>.huidi-tab-more-menu{display:none}'
    '</style>'
)

def _interaction_assets(html: str, *, workspace: bool = False) -> str:
    meta = f'<meta name="huidi-asset-revision" content="{FUSION_ASSET_VERSION}">'
    assets = meta + (_CRITICAL_TABS if workspace else "")
    assets += f'<script defer src="/community/huidi-quick-choices-v1.js?v={FUSION_ASSET_VERSION}"></script>'
    return html.replace("</head>", assets + "</head>", 1)


def community_surface_status() -> dict[str, object]:
    return {
        "enabled": COMMUNITY_SURFACE_ENABLED,
        "available": COMMUNITY_PUBLIC_DIR.is_dir(),
        "workspace": "/community/workspace.html",
        "document_start": "/community/document-start.html",
        "editor": "/community/editor.html",
        "mode": "community-online-fused-workspace",
        "formal_price_policy": "reference-only-until-human-confirmation",
    }


def _workspace_html() -> str:
    path = COMMUNITY_PUBLIC_DIR / "workspace.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Community workspace is unavailable")
    html = path.read_text(encoding="utf-8")
    if not COMMUNITY_SURFACE_ENABLED:
        return html

    # Community remains the visual/business owner. The first fusion layer adds
    # shared Online summaries and base pages. Full Fusion V2 then mounts the
    # existing Online capability modules into those Community pages. Final
    # shell/functional closures only position those existing capabilities.
    if "huidi-community-online-fusion.js" not in html:
        head_assets = (
            f'<link rel="stylesheet" href="/community/huidi-community-online-fusion.css?v={FUSION_ASSET_VERSION}">'
            f'<link rel="stylesheet" href="/community/huidi-community-online-full-v2.css?v={FUSION_ASSET_VERSION}">'
            f'<link rel="stylesheet" href="/community/huidi-community-online-development-workbench-v1.css?v={FUSION_ASSET_VERSION}">'
            f'<link rel="stylesheet" href="/community/huidi-community-online-shell-closure-v1.css?v={FUSION_ASSET_VERSION}">'
            f'<link rel="stylesheet" href="/community/huidi-community-online-functional-closure-v1.css?v={FUSION_ASSET_VERSION}">'
            f'<script src="/community/huidi-community-online-fusion.js?v={FUSION_ASSET_VERSION}"></script>'
        )
        if "</head>" not in html:
            raise HTTPException(status_code=500, detail="Community workspace head is invalid")
        html = html.replace("</head>", head_assets + "</head>", 1)

    # The interactive country map reads public Natural Earth geometry from the
    # same upstream source used by the existing Online map project. Company map
    # results may render a selected real coordinate with OpenStreetMap. These
    # CSP relaxations apply only to the deployed fused response, never Local.
    html = html.replace(
        "connect-src 'self';",
        "connect-src 'self' https://cdn.jsdelivr.net;",
        1,
    )
    html = html.replace(
        "frame-src 'none';",
        "frame-src https://www.openstreetmap.org;",
        1,
    )

    # Online navigation and Full Fusion V2 must run after Community R1-R6 have
    # completed the mature sidebar and page owners. The development workbench is
    # loaded after the capability tabs. A scoped routing bridge connects
    # potential-customer / follow-up / reply rows into that same workbench.
    # Shell closure compacts the DOM; functional closure runs last and connects
    # the visible pages to existing status, mail, map and sequence capabilities.
    if "huidi-community-online-nav-v1.js" not in html:
        body_assets = (
            f'<script src="/community/huidi-community-online-nav-v1.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-full-v2.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-intelligence-v2.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-development-workbench-v1.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-development-routing-v1.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-shell-closure-v1.js?v={FUSION_ASSET_VERSION}"></script>'
            f'<script src="/community/huidi-community-online-functional-closure-v1.js?v={FUSION_ASSET_VERSION}"></script>'
        )
        if "</body>" not in html:
            raise HTTPException(status_code=500, detail="Community workspace body is invalid")
        html = html.replace("</body>", body_assets + "</body>", 1)

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
    return _interaction_assets(html, workspace=True)


def _editor_html() -> str:
    """Fuse only Online governance into the existing Community formal editor.

    Community still owns every formal document field, save/export flow and
    document record. On a fresh document, the injected guard runs immediately
    after tenant-scoped browser storage is installed and before the Community
    editor reads product context, so reference prices never hydrate a formal
    unit-price field. Saved and chained formal documents keep their own prices.
    """

    path = COMMUNITY_PUBLIC_DIR / "editor.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Community editor is unavailable")
    html = path.read_text(encoding="utf-8")
    if not COMMUNITY_SURFACE_ENABLED:
        return html
    asset = "huidi-community-online-formal-price-guard-v1.js"
    if asset not in html:
        script = f'<script src="/community/{asset}?v={FUSION_ASSET_VERSION}"></script>'
        local_mode = '<script src="./community-local-mode.js"></script>'
        if local_mode in html:
            html = html.replace(local_mode, local_mode + script, 1)
        elif "</head>" in html:
            html = html.replace("</head>", script + "</head>", 1)
        else:
            raise HTTPException(status_code=500, detail="Community editor head is invalid")
    return _interaction_assets(html)


# These exact routes must be registered before the StaticFiles /community mount.
# The standalone Community files are never rewritten: only the deployed Online
# responses receive fused assets, so downloaded/offline Local stays Local.
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


@app.get("/community/editor.html", response_class=HTMLResponse)
def get_fused_community_editor():
    return HTMLResponse(
        _editor_html(),
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-HUIDI-Editor-Owner": "community-formal-document-owner",
            "X-HUIDI-Formal-Price-Policy": "reference-only-until-human-confirmation",
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
