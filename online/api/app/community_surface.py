from __future__ import annotations

import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .online_app import app


# HUIDI Online must reuse the published Community Local workspace/editor as its
# primary business UI instead of growing a second customer/deal/document shell.
# The Online backend remains the network/auth/tenant/provider capability layer.
def _community_public_dir() -> Path:
    """Resolve the published Local surface without assuming repository depth.

    Docker/packaged Online explicitly sets HUIDI_COMMUNITY_PUBLIC_DIR to
    /app/community-public. Source/dev runs fall back to the nearest ancestor
    containing public/. Never index a fixed parents[n] depth: the packaged
    module lives at /app/app/community_surface.py and has a shallower tree.
    """

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


def community_surface_status() -> dict[str, object]:
    return {
        "enabled": COMMUNITY_SURFACE_ENABLED,
        "available": COMMUNITY_PUBLIC_DIR.is_dir(),
        "workspace": "/community/workspace.html",
        "document_start": "/community/document-start.html",
        "editor": "/community/editor.html",
        "mode": "published-community-local-mother-surface",
    }


if COMMUNITY_PUBLIC_DIR.is_dir():
    # StaticFiles is mounted on the same FastAPI application. Existing auth/team
    # middleware therefore remains the only access gate; this module does not
    # create a second session, customer, deal, product or document owner.
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
    """Switch only the authenticated product entrypoint in deployed Online mode.

    The middleware deliberately redirects only GET / and returns no protected
    content itself. An unauthenticated browser is redirected to /community first
    and then passes through the existing Team/Auth middleware, which sends it to
    the login portal. After login, / resolves to the published Local workspace.

    Direct source/CI runs keep the legacy Online surface unless
    HUIDI_COMMUNITY_SURFACE=1 is explicitly set, allowing staged convergence.
    """

    if (
        COMMUNITY_SURFACE_ENABLED
        and COMMUNITY_PUBLIC_DIR.is_dir()
        and request.method == "GET"
        and request.url.path == "/"
    ):
        return RedirectResponse("/community/workspace.html", status_code=307)
    return await call_next(request)
