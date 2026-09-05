from __future__ import annotations

import os
import re

from fastapi import Request
from fastapi.responses import JSONResponse

from .online_app import app


@app.middleware("http")
async def require_real_business_sources(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()
    search_ready = bool(os.getenv("SERPER_API_KEY", "").strip())

    if method == "POST" and path == "/api/leads/search" and not search_ready:
        return JSONResponse(
            status_code=503,
            content={"detail": "还没有连接在线找客户服务，请先在“连接与工具”里完成连接。"},
        )

    if method == "POST" and re.fullmatch(r"/api/leads/\d+/find-contact", path) and not search_ready:
        return JSONResponse(
            status_code=503,
            content={"detail": "还没有连接联系人查找服务，当前不会用演示联系人代替真实结果。"},
        )

    return await call_next(request)
