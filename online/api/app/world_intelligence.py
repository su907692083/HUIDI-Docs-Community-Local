from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from fastapi import Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal
from .customer_intelligence import _collect
from .main import Lead, get_db
from .online_app import app


WORLD_MARKETS: list[dict[str, Any]] = [
    {"id": "US", "name": "美国", "query": "United States", "region": "北美", "lat": 39.8, "lng": -98.6, "aliases": ["US", "USA", "United States", "United States of America", "美国"]},
    {"id": "CA", "name": "加拿大", "query": "Canada", "region": "北美", "lat": 56.1, "lng": -106.3, "aliases": ["CA", "Canada", "加拿大"]},
    {"id": "MX", "name": "墨西哥", "query": "Mexico", "region": "北美", "lat": 23.6, "lng": -102.5, "aliases": ["MX", "Mexico", "México", "墨西哥"]},
    {"id": "BR", "name": "巴西", "query": "Brazil", "region": "拉美", "lat": -14.2, "lng": -51.9, "aliases": ["BR", "Brazil", "Brasil", "巴西"]},
    {"id": "AR", "name": "阿根廷", "query": "Argentina", "region": "拉美", "lat": -38.4, "lng": -63.6, "aliases": ["AR", "Argentina", "阿根廷"]},
    {"id": "CL", "name": "智利", "query": "Chile", "region": "拉美", "lat": -33.4, "lng": -70.7, "aliases": ["CL", "Chile", "智利"]},
    {"id": "CO", "name": "哥伦比亚", "query": "Colombia", "region": "拉美", "lat": 4.6, "lng": -74.1, "aliases": ["CO", "Colombia", "哥伦比亚"]},
    {"id": "PE", "name": "秘鲁", "query": "Peru", "region": "拉美", "lat": -9.2, "lng": -75.0, "aliases": ["PE", "Peru", "Perú", "秘鲁"]},
    {"id": "GB", "name": "英国", "query": "United Kingdom", "region": "欧洲", "lat": 54.0, "lng": -2.0, "aliases": ["GB", "UK", "United Kingdom", "Britain", "Great Britain", "英国"]},
    {"id": "DE", "name": "德国", "query": "Germany", "region": "欧洲", "lat": 51.2, "lng": 10.5, "aliases": ["DE", "Germany", "Deutschland", "德国"]},
    {"id": "FR", "name": "法国", "query": "France", "region": "欧洲", "lat": 46.2, "lng": 2.2, "aliases": ["FR", "France", "法国"]},
    {"id": "IT", "name": "意大利", "query": "Italy", "region": "欧洲", "lat": 41.9, "lng": 12.6, "aliases": ["IT", "Italy", "Italia", "意大利"]},
    {"id": "ES", "name": "西班牙", "query": "Spain", "region": "欧洲", "lat": 40.5, "lng": -3.7, "aliases": ["ES", "Spain", "España", "西班牙"]},
    {"id": "NL", "name": "荷兰", "query": "Netherlands", "region": "欧洲", "lat": 52.1, "lng": 5.3, "aliases": ["NL", "Netherlands", "Holland", "荷兰"]},
    {"id": "BE", "name": "比利时", "query": "Belgium", "region": "欧洲", "lat": 50.5, "lng": 4.5, "aliases": ["BE", "Belgium", "比利时"]},
    {"id": "PL", "name": "波兰", "query": "Poland", "region": "欧洲", "lat": 51.9, "lng": 19.1, "aliases": ["PL", "Poland", "Polska", "波兰"]},
    {"id": "CZ", "name": "捷克", "query": "Czech Republic", "region": "欧洲", "lat": 49.8, "lng": 15.5, "aliases": ["CZ", "Czechia", "Czech Republic", "捷克"]},
    {"id": "SE", "name": "瑞典", "query": "Sweden", "region": "欧洲", "lat": 60.1, "lng": 18.6, "aliases": ["SE", "Sweden", "瑞典"]},
    {"id": "NO", "name": "挪威", "query": "Norway", "region": "欧洲", "lat": 60.5, "lng": 8.5, "aliases": ["NO", "Norway", "挪威"]},
    {"id": "DK", "name": "丹麦", "query": "Denmark", "region": "欧洲", "lat": 56.3, "lng": 9.5, "aliases": ["DK", "Denmark", "丹麦"]},
    {"id": "FI", "name": "芬兰", "query": "Finland", "region": "欧洲", "lat": 61.9, "lng": 25.7, "aliases": ["FI", "Finland", "芬兰"]},
    {"id": "CH", "name": "瑞士", "query": "Switzerland", "region": "欧洲", "lat": 46.8, "lng": 8.2, "aliases": ["CH", "Switzerland", "Swiss", "瑞士"]},
    {"id": "AT", "name": "奥地利", "query": "Austria", "region": "欧洲", "lat": 47.5, "lng": 14.6, "aliases": ["AT", "Austria", "Österreich", "奥地利"]},
    {"id": "PT", "name": "葡萄牙", "query": "Portugal", "region": "欧洲", "lat": 39.4, "lng": -8.2, "aliases": ["PT", "Portugal", "葡萄牙"]},
    {"id": "TR", "name": "土耳其", "query": "Turkey", "region": "中东", "lat": 39.0, "lng": 35.2, "aliases": ["TR", "Turkey", "Türkiye", "Turkiye", "土耳其"]},
    {"id": "AE", "name": "阿联酋", "query": "United Arab Emirates", "region": "中东", "lat": 23.4, "lng": 53.8, "aliases": ["AE", "UAE", "United Arab Emirates", "阿联酋"]},
    {"id": "SA", "name": "沙特阿拉伯", "query": "Saudi Arabia", "region": "中东", "lat": 23.9, "lng": 45.1, "aliases": ["SA", "Saudi Arabia", "Saudi", "沙特", "沙特阿拉伯"]},
    {"id": "IL", "name": "以色列", "query": "Israel", "region": "中东", "lat": 31.0, "lng": 34.9, "aliases": ["IL", "Israel", "以色列"]},
    {"id": "EG", "name": "埃及", "query": "Egypt", "region": "中东", "lat": 26.8, "lng": 30.8, "aliases": ["EG", "Egypt", "埃及"]},
    {"id": "ZA", "name": "南非", "query": "South Africa", "region": "非洲", "lat": -30.6, "lng": 22.9, "aliases": ["ZA", "South Africa", "南非"]},
    {"id": "NG", "name": "尼日利亚", "query": "Nigeria", "region": "非洲", "lat": 9.1, "lng": 8.7, "aliases": ["NG", "Nigeria", "尼日利亚"]},
    {"id": "KE", "name": "肯尼亚", "query": "Kenya", "region": "非洲", "lat": 0.0, "lng": 37.9, "aliases": ["KE", "Kenya", "肯尼亚"]},
    {"id": "MA", "name": "摩洛哥", "query": "Morocco", "region": "非洲", "lat": 31.8, "lng": -7.1, "aliases": ["MA", "Morocco", "摩洛哥"]},
    {"id": "CN", "name": "中国", "query": "China", "region": "亚太", "lat": 35.9, "lng": 104.2, "aliases": ["CN", "China", "PRC", "中国", "中国大陆", "Mainland China"]},
    {"id": "JP", "name": "日本", "query": "Japan", "region": "亚太", "lat": 36.2, "lng": 138.3, "aliases": ["JP", "Japan", "日本"]},
    {"id": "KR", "name": "韩国", "query": "South Korea", "region": "亚太", "lat": 36.5, "lng": 127.9, "aliases": ["KR", "South Korea", "Korea", "Republic of Korea", "韩国"]},
    {"id": "IN", "name": "印度", "query": "India", "region": "亚太", "lat": 20.6, "lng": 79.0, "aliases": ["IN", "India", "印度"]},
    {"id": "SG", "name": "新加坡", "query": "Singapore", "region": "亚太", "lat": 1.35, "lng": 103.82, "aliases": ["SG", "Singapore", "新加坡"]},
    {"id": "MY", "name": "马来西亚", "query": "Malaysia", "region": "亚太", "lat": 4.2, "lng": 102.0, "aliases": ["MY", "Malaysia", "马来西亚"]},
    {"id": "TH", "name": "泰国", "query": "Thailand", "region": "亚太", "lat": 15.9, "lng": 100.9, "aliases": ["TH", "Thailand", "泰国"]},
    {"id": "VN", "name": "越南", "query": "Vietnam", "region": "亚太", "lat": 14.1, "lng": 108.3, "aliases": ["VN", "Vietnam", "Viet Nam", "越南"]},
    {"id": "ID", "name": "印度尼西亚", "query": "Indonesia", "region": "亚太", "lat": -0.8, "lng": 113.9, "aliases": ["ID", "Indonesia", "印尼", "印度尼西亚"]},
    {"id": "PH", "name": "菲律宾", "query": "Philippines", "region": "亚太", "lat": 12.9, "lng": 121.8, "aliases": ["PH", "Philippines", "菲律宾"]},
    {"id": "AU", "name": "澳大利亚", "query": "Australia", "region": "亚太", "lat": -25.3, "lng": 133.8, "aliases": ["AU", "Australia", "澳大利亚", "澳洲"]},
    {"id": "NZ", "name": "新西兰", "query": "New Zealand", "region": "亚太", "lat": -40.9, "lng": 174.9, "aliases": ["NZ", "New Zealand", "新西兰"]},
]


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", str(value or "").strip().lower())


_MARKET_BY_ALIAS: dict[str, dict[str, Any]] = {}
_MARKET_BY_ID: dict[str, dict[str, Any]] = {}
for _market in WORLD_MARKETS:
    _MARKET_BY_ID[_market["id"]] = _market
    for _alias in [_market["id"], _market["name"], _market["query"], *_market["aliases"]]:
        _MARKET_BY_ALIAS[_key(_alias)] = _market


def _market_for(value: str) -> dict[str, Any] | None:
    return _MARKET_BY_ID.get(str(value or "").upper()) or _MARKET_BY_ALIAS.get(_key(value))


def _market_payload(market: dict[str, Any], counts: dict[str, int] | None = None) -> dict[str, Any]:
    counts = counts or {}
    return {
        "id": market["id"],
        "name": market["name"],
        "query": market["query"],
        "region": market["region"],
        "lat": market["lat"],
        "lng": market["lng"],
        "lead_count": int(counts.get("lead_count", 0)),
        "contact_count": int(counts.get("contact_count", 0)),
        "customer_count": int(counts.get("customer_count", 0)),
        "deal_count": int(counts.get("deal_count", 0)),
        "replied_count": int(counts.get("replied_count", 0)),
    }


def _country_counts(db: Session) -> tuple[dict[str, dict[str, int]], int]:
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    unmapped = 0

    lead_rows = db.execute(
        select(
            Lead.country,
            func.count(Lead.id),
            func.sum(case((func.length(func.trim(Lead.contact_email)) > 0, 1), else_=0)),
            func.sum(case((Lead.status == "replied", 1), else_=0)),
        ).where(func.length(func.trim(Lead.country)) > 0).group_by(Lead.country)
    ).all()
    for country, lead_count, contact_count, replied_count in lead_rows:
        market = _market_for(str(country or ""))
        if not market:
            unmapped += int(lead_count or 0)
            continue
        bucket = counts[market["id"]]
        bucket["lead_count"] += int(lead_count or 0)
        bucket["contact_count"] += int(contact_count or 0)
        bucket["replied_count"] += int(replied_count or 0)

    customer_rows = db.execute(
        select(OnlineCustomer.country, func.count(OnlineCustomer.id))
        .where(func.length(func.trim(OnlineCustomer.country)) > 0)
        .group_by(OnlineCustomer.country)
    ).all()
    for country, total in customer_rows:
        market = _market_for(str(country or ""))
        if market:
            counts[market["id"]]["customer_count"] += int(total or 0)

    deal_rows = db.execute(
        select(OnlineCustomer.country, func.count(OnlineDeal.id))
        .join(OnlineCustomer, OnlineCustomer.id == OnlineDeal.customer_id)
        .where(func.length(func.trim(OnlineCustomer.country)) > 0)
        .where(OnlineDeal.stage != "lost")
        .group_by(OnlineCustomer.country)
    ).all()
    for country, total in deal_rows:
        market = _market_for(str(country or ""))
        if market:
            counts[market["id"]]["deal_count"] += int(total or 0)

    return counts, unmapped


def _country_values(market: dict[str, Any]) -> list[str]:
    values = list(dict.fromkeys([market["id"], market["name"], market["query"], *market["aliases"]]))
    return [str(x).strip().lower() for x in values if str(x).strip()]


def _lead_dict(row: Lead) -> dict[str, Any]:
    return {
        "id": row.id,
        "company_name": row.company_name,
        "website": row.website,
        "score": row.score,
        "status": row.status,
        "product": row.market_keyword,
        "contact_name": row.contact_name,
        "contact_role": row.contact_role,
        "contact_email": row.contact_email,
    }


def _customer_dict(row: OnlineCustomer) -> dict[str, Any]:
    return {
        "id": row.id,
        "source_lead_id": row.source_lead_id,
        "company_name": row.company_name,
        "contact_name": row.contact_name,
        "email": row.email,
        "status": row.status,
        "website": row.website,
    }


def _deal_dict(row: OnlineDeal, customer_name: str = "") -> dict[str, Any]:
    return {
        "id": row.id,
        "source_lead_id": row.source_lead_id,
        "customer_id": row.customer_id,
        "customer_name": customer_name,
        "title": row.title,
        "stage": row.stage,
        "probability": row.probability,
        "currency": row.currency,
        "amount": row.amount,
        "product": row.product_keyword,
        "next_action": row.next_action,
        "next_action_at": row.next_action_at,
    }


@app.get("/api/intel/world")
def world_intelligence_overview(db: Session = Depends(get_db)):
    counts, unmapped = _country_counts(db)
    markets = [_market_payload(market, counts.get(market["id"])) for market in WORLD_MARKETS]
    markets.sort(key=lambda x: (x["lead_count"] + x["customer_count"] + x["deal_count"], x["name"]), reverse=True)
    return {
        "ok": True,
        "markets": markets,
        "regions": ["全部", "北美", "拉美", "欧洲", "中东", "非洲", "亚太"],
        "summary": {
            "markets_with_leads": sum(1 for x in markets if x["lead_count"] > 0),
            "lead_count": sum(x["lead_count"] for x in markets),
            "contact_count": sum(x["contact_count"] for x in markets),
            "customer_count": sum(x["customer_count"] for x in markets),
            "deal_count": sum(x["deal_count"] for x in markets),
            "unmapped_lead_count": unmapped,
        },
        "note": "地图圆点只表示国家 / 市场入口和你自己的真实业务数量，不代表冲突等级或风险等级。",
    }


@app.get("/api/intel/world/country")
async def world_intelligence_country(
    market: str = Query(min_length=2, max_length=120),
    keyword: str = Query(default="", max_length=255),
    news_limit: int = Query(default=16, ge=4, le=30),
    db: Session = Depends(get_db),
):
    selected = _market_for(market)
    if not selected:
        raise HTTPException(404, "这个国家 / 市场暂时还没有地图入口")
    aliases = _country_values(selected)

    lead_stmt = (
        select(Lead)
        .where(func.lower(func.trim(Lead.country)).in_(aliases))
        .where(Lead.status != "archived")
        .order_by(Lead.score.desc(), Lead.updated_at.desc(), Lead.id.desc())
        .limit(20)
    )
    leads = db.scalars(lead_stmt).all()

    customer_stmt = (
        select(OnlineCustomer)
        .where(func.lower(func.trim(OnlineCustomer.country)).in_(aliases))
        .where(OnlineCustomer.status != "archived")
        .order_by(OnlineCustomer.updated_at.desc(), OnlineCustomer.id.desc())
        .limit(15)
    )
    customers = db.scalars(customer_stmt).all()
    customer_ids = [x.id for x in customers]
    customer_names = {x.id: x.company_name for x in customers}

    deals: list[OnlineDeal] = []
    if customer_ids:
        deals = db.scalars(
            select(OnlineDeal)
            .where(OnlineDeal.customer_id.in_(customer_ids))
            .where(OnlineDeal.stage != "lost")
            .order_by(OnlineDeal.updated_at.desc(), OnlineDeal.id.desc())
            .limit(15)
        ).all()

    intelligence = await _collect(
        country=selected["query"],
        product=keyword.strip(),
        company="",
        limit=news_limit,
    )
    return {
        "ok": True,
        "market": _market_payload(selected, {
            "lead_count": len(leads),
            "contact_count": sum(1 for x in leads if x.contact_email.strip()),
            "customer_count": len(customers),
            "deal_count": len(deals),
            "replied_count": sum(1 for x in leads if x.status == "replied"),
        }),
        "keyword": keyword.strip(),
        "leads": [_lead_dict(x) for x in leads],
        "customers": [_customer_dict(x) for x in customers],
        "deals": [_deal_dict(x, customer_names.get(x.customer_id, "")) for x in deals],
        "items": intelligence.get("items") or [],
        "sources": intelligence.get("sources") or {},
        "note": "新闻和政策是公开信息线索；潜在客户、正式客户和询盘数量只来自当前公司的真实业务数据。",
    }
