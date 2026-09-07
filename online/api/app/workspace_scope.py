from __future__ import annotations

import os

from fastapi import Request

from .online_app import app


WORKSPACE_SCOPE_COOKIE = "huidi_workspace_scope"


def _production() -> bool:
    return os.getenv("APP_ENV", "development").strip().lower() == "production"


def _is_community_navigation(request: Request) -> bool:
    """Only Community document navigations are allowed to choose cache scope.

    API responses must never rewrite the readable cache namespace. Otherwise an
    in-flight response from workspace A can land after the browser has switched
    its HttpOnly session to workspace B and overwrite B's cache selector.
    """

    if request.method not in {"GET", "HEAD"}:
        return False
    path = request.url.path
    if not path.startswith("/community/"):
        return False
    accept = request.headers.get("accept", "").lower()
    return (
        path.endswith(".html")
        or path.endswith("/")
        or "text/html" in accept
    )


@app.middleware("http")
async def workspace_scope_cookie(request: Request, call_next):
    """Expose only a non-sensitive tenant cache namespace to Community pages.

    Authentication remains exclusively owned by the HttpOnly team session cookie
    and the server-side tenant router. This readable cookie is not authorization;
    it only lets the reused Community Local browser cache choose the correct
    per-organization namespace before any Local scripts read localStorage/IDB.

    The cookie is refreshed only by a Community HTML navigation. This prevents a
    stale API response from a previous account from racing a browser account
    switch and pointing the next Local script execution at the wrong cache.
    """

    response = await call_next(request)
    if request.url.path == "/api/team/logout":
        response.delete_cookie(WORKSPACE_SCOPE_COOKIE, path="/")
        return response

    if not _is_community_navigation(request):
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
