from __future__ import annotations

import os

from . import production_readiness, service_hub


_original_provider_status = service_hub._provider_status
_original_readiness = production_readiness.build_production_readiness


def _configured(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _provider_status(db):
    out = _original_provider_status(db)
    out["lead_search"] = _configured("SERPER_API_KEY") or _configured("TAVILY_API_KEY")
    out["contact_search"] = _configured("SERPER_API_KEY") or _configured("HUNTER_API_KEY")
    out["acquisition"] = {
        "company_primary": "serper" if _configured("SERPER_API_KEY") else "tavily" if _configured("TAVILY_API_KEY") else "",
        "company_fallback": "tavily" if _configured("SERPER_API_KEY") and _configured("TAVILY_API_KEY") else "",
        "contact_primary": "hunter" if _configured("HUNTER_API_KEY") else "serper" if _configured("SERPER_API_KEY") else "",
        "contact_fallback": "serper" if _configured("HUNTER_API_KEY") and _configured("SERPER_API_KEY") else "",
    }
    return out


def _readiness():
    out = _original_readiness()
    items = list(out.get("items") or [])
    items = [x for x in items if x.get("name") != "找客户 / 地图 / 市场动态"]
    company_ready = _configured("SERPER_API_KEY") or _configured("TAVILY_API_KEY")
    contact_ready = _configured("SERPER_API_KEY") or _configured("HUNTER_API_KEY")
    serper_ready = _configured("SERPER_API_KEY")
    items.extend([
        {
            "group": "开发客户", "name": "在线找客户", "state": "ready" if company_ready else "action",
            "message": "真实企业搜索已经连接。" if company_ready else "还没有连接真实企业搜索。",
            "action": "" if company_ready else "连接 Serper 或 Tavily 后再开始真实找客户。",
        },
        {
            "group": "开发客户", "name": "联系人查找", "state": "ready" if contact_ready else "action",
            "message": "公开联系人查找已经连接。" if contact_ready else "还没有连接公开联系人查找。",
            "action": "" if contact_ready else "连接 Hunter 或 Serper 后才能查找真实联系人。",
        },
        {
            "group": "外贸资料", "name": "地图与搜索新闻", "state": "ready" if serper_ready else "optional",
            "message": "地图找客户和搜索新闻可以使用。" if serper_ready else "地图找客户和搜索新闻需要 Serper；不影响普通企业搜索、邮件和询盘。",
            "action": "" if serper_ready else "需要地图搜索时再连接 Serper。",
        },
    ])
    out["items"] = items
    actions = sum(1 for item in items if item.get("state") == "action")
    ready = sum(1 for item in items if item.get("state") == "ready")
    optional = sum(1 for item in items if item.get("state") == "optional")
    out["summary"] = {"ready": ready, "action": actions, "optional": optional, "total": len(items)}
    out["ready_for_daily_use"] = actions == 0
    return out


service_hub._provider_status = _provider_status
production_readiness.build_production_readiness = _readiness
