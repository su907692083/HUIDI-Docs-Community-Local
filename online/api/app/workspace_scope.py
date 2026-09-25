from __future__ import annotations

import os

from fastapi import Request

from .online_app import app


WORKSPACE_SCOPE_COOKIE = "huidi_workspace_scope"


def _production() -> bool:
    return os.getenv("APP_ENV", "development").strip().lower() == "production"


def _is_workspace_navigation(request: Request) -> bool:
    """Allow only top-level workspace navigations to choose browser cache scope.

    The published Community HTML can be served from the browser cache after an
    account switch. Therefore authenticated GET / must refresh the non-sensitive
    org-N cache namespace before it redirects to /community/workspace.html.
    Ordinary API/asset responses must never rewrite the namespace, otherwise an
    in-flight response from workspace A could race a later login to workspace B.
    """

    if request.method not in {"GET", "HEAD"}:
        return False
    path = request.url.path
    accept = request.headers.get("accept", "").lower()
    if path == "/":
        return not accept or "text/html" in accept or "*/*" in accept
    if not path.startswith("/community/"):
        return False
    return path.endswith(".html") or path.endswith("/") or "text/html" in accept


@app.middleware("http")
async def workspace_scope_cookie(request: Request, call_next):
    """Expose only a non-sensitive tenant cache namespace to Community pages.

    Authentication remains exclusively owned by the HttpOnly team session cookie
    and the server-side tenant router. This readable cookie is not authorization;
    it only lets the reused Community Local browser cache choose the correct
    per-organization namespace before any Local scripts read localStorage/IDB.

    The cookie is refreshed only by a top-level workspace navigation. API and
    static-asset responses cannot modify it. This prevents stale requests from a
    previous account from racing a browser account switch while still making a
    cached Community HTML navigation safe after GET / refreshes the namespace.
    """

    response = await call_next(request)
    if request.url.path == "/api/team/logout":
        response.delete_cookie(WORKSPACE_SCOPE_COOKIE, path="/")
        return response

    if not _is_workspace_navigation(request):
        return response

    organization_id = getattr(request.state, "organization_id", None)
    try:
        organization_id = int(organization_id)
    except (TypeError, ValueError):
        organization_id = 0
    if organization_id > 0:
        response.set_cookie(
            WORKSPACE_SCOPE_COOKIE,
            f"org-{organization_id}",
            max_age=14 * 86400,
            httponly=False,
            secure=_production(),
            samesite="strict",
            path="/",
        )
    return response
