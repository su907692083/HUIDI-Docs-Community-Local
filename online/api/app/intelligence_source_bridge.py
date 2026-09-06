from __future__ import annotations

from typing import Any

from . import customer_intelligence
from .intelligence_sources import configured_intelligence_sources, fetch_feed_entries
from .main import SessionLocal


def _managed_sources() -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        return configured_intelligence_sources(db, enabled_only=True)
    finally:
        db.close()


async def _managed_feed(_client: Any, source: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        return await fetch_feed_entries(source, limit=customer_intelligence.MAX_SOURCE_ITEMS)
    except Exception:
        # One unavailable source must never break the customer's whole brief.
        return []


# Keep the mature ranking/customer-context owner intact. These runtime owners
# only replace where configurable feeds come from and how those feed URLs are
# fetched. SessionLocal is already organization-aware at this point, so each
# company sees only its own managed sources plus platform presets.
customer_intelligence._configured_rss_sources = _managed_sources
customer_intelligence._custom_rss = _managed_feed
