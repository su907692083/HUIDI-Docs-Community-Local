from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select

from .lead_engine import clean_domain, merge_evidence, score_search_result
from .main import Lead, LeadSearchRequest, SessionLocal, add_activity, lead_to_dict, serper_search
from .online_app import app
from .provider_settings import provider_ready, resolve_provider, read_provider_json


_EXCLUDED_DOMAINS = {
    "linkedin.com", "facebook.com", "instagram.com", "youtube.com", "x.com", "twitter.com",
    "wikipedia.org", "reddit.com", "amazon.com", "alibaba.com", "made-in-china.com",
    "globalsources.com", "indiamart.com", "pinterest.com", "tiktok.com",
}
_BUYER_ROLE_TERMS = (
    "procurement", "purchasing", "buyer", "sourcing", "supply chain", "category manager",
    "merchandiser", "import manager", "commodity manager", "采购", "买手", "供应链",
)
_OWNER_ROLE_TERMS = ("owner", "founder", "director", "general manager", "managing director", "ceo")


def acquisition_provider_status() -> dict[str, Any]:
    with SessionLocal() as db:
        serper, tavily, hunter = (provider_ready(key, db) for key in ("serper", "tavily", "hunter"))
    return {"serper": serper, "tavily": tavily, "hunter": hunter,
            "live_company_search": serper or tavily, "live_contact_search": serper or hunter,
            "company_search_order": [name for name, ready in (("Serper", serper), ("Tavily", tavily)) if ready],
            "contact_search_order": [name for name, ready in (("Hunter", hunter), ("Serper", serper)) if ready]}


@app.get("/api/acquisition/status")
def acquisition_status():
    status = acquisition_provider_status()
    return {"ok": True, **status}


def _host_excluded(domain: str) -> bool:
    host = str(domain or "").lower().strip(".")
    return any(host == blocked or host.endswith("." + blocked) for blocked in _EXCLUDED_DOMAINS)


async def _tavily_company_search(req: LeadSearchRequest) -> list[dict[str, Any]]:
    cfg = resolve_provider("tavily")
    query = " ".join(x for x in [req.product_keyword, req.buyer_type, req.country, "company importer distributor buyer official website"] if x)
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                cfg["endpoint_url"] + "/search",
                headers={"Authorization": "Bearer " + cfg["token"], "Content-Type": "application/json"},
                json={
                    "query": query,
                    "search_depth": "basic",
                    "max_results": min(max(req.limit * 3, 10), 20),
                    "include_answer": False,
                    "include_raw_content": False,
                    "topic": "general",
                },
            )
    except httpx.RequestError as exc:
        raise RuntimeError("在线找客户备用来源暂时连接不上") from exc
    if response.status_code in {401, 403}:
        raise RuntimeError("在线找客户备用来源授权信息没有通过，请管理员检查连接")
    if response.status_code == 429:
        raise RuntimeError("在线找客户备用来源当前额度或请求频率已到限制")
    if response.status_code >= 400:
        raise RuntimeError("在线找客户备用来源没有成功返回结果")
    try:
        payload = read_provider_json(response, "Tavily")
        if not isinstance(payload.get("results"), list):
            raise ValueError("missing results")
    except Exception as exc:
        raise RuntimeError("在线找客户备用来源返回了无法读取的数据") from exc
    rows: list[dict[str, Any]] = []
    for item in (payload.get("results") or [])[:20]:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        domain = clean_domain(url)
        if not domain or _host_excluded(domain):
            continue
        rows.append({
            "title": str(item.get("title") or domain).strip(),
            "link": url,
            "snippet": str(item.get("content") or "").strip(),
            "search_score": float(item.get("score") or 0),
        })
    return rows


async def _company_search_with_failover(req: LeadSearchRequest) -> tuple[str, list[dict[str, Any]], list[str]]:
    errors: list[str] = []
    empty_provider = ""
    if provider_ready("serper"):
        try:
            rows = await serper_search(req)
            if rows:
                return "serper", rows, errors
            empty_provider = "serper"
            errors.append("主搜索来源没有返回候选")
        except HTTPException as exc:
            errors.append(str(exc.detail))
        except Exception:
            errors.append("主搜索来源暂时不可用，请检查服务器网络")
    if provider_ready("tavily"):
        try:
            rows = await _tavily_company_search(req)
            if rows:
                return "tavily", rows, errors
            empty_provider = "tavily"
            errors.append("备用搜索来源没有返回候选")
        except RuntimeError as exc:
            errors.append(str(exc))
    return empty_provider, [], errors


def _persist_company_results(req: LeadSearchRequest, raw: list[dict[str, Any]], provider: str) -> JSONResponse:
    db = SessionLocal()
    try:
        created: list[Lead] = []
        seen_domains: set[str] = set()
        for item in raw:
            link = str(item.get("link") or "")
            domain = clean_domain(link)
            if not domain or domain in seen_domains or _host_excluded(domain):
                continue
            seen_domains.add(domain)
            existing = db.scalar(select(Lead).where(Lead.domain == domain))
            score, reason, breakdown, level = score_search_result(
                item,
                product_keyword=req.product_keyword,
                buyer_type=req.buyer_type,
                country=req.country,
            )
            evidence = {
                "title": item.get("title"), "url": link, "snippet": item.get("snippet", ""),
                "source": "online_company_search", "provider": provider,
                "score_breakdown": breakdown, "priority": level,
            }
            if existing:
                existing.evidence_json = merge_evidence(existing.evidence_json, [evidence])
                if score > existing.score:
                    existing.score = score
                    existing.reason = reason
                    existing.market_keyword = req.product_keyword
                    existing.buyer_type = req.buyer_type
                    existing.country = req.country or existing.country
                    existing.updated_at = datetime.now(timezone.utc)
                continue
            lead = Lead(
                company_name=(str(item.get("title") or domain).split("|")[0].strip() or domain)[:255],
                domain=domain, website=link, country=req.country, market_keyword=req.product_keyword,
                buyer_type=req.buyer_type, score=score, reason=reason,
                evidence_json=merge_evidence("[]", [evidence]),
            )
            db.add(lead); db.flush()
            add_activity(
                db, lead.id, "discovered", "发现潜在客户", f"优先级 {level} · 匹配分 {score}",
                {"breakdown": breakdown, "source": "online_company_search", "provider": provider},
            )
            created.append(lead)
            if len(created) >= req.limit:
                break
        db.commit()
        for lead in created:
            db.refresh(lead)
        return JSONResponse({"mode": "live", "provider": provider, "items": [lead_to_dict(x, db) for x in created]})
    except Exception:
        db.rollback()
        return JSONResponse({"detail": "真实客户结果已经返回，但保存时没有成功，请稍后再试"}, status_code=500)
    finally:
        db.close()


async def _handle_company_search(request: Request) -> JSONResponse:
    try:
        req = LeadSearchRequest.model_validate(await request.json())
    except (ValidationError, ValueError, TypeError):
        return JSONResponse({"detail": "请填写产品关键词、目标市场和客户类型"}, status_code=422)
    if not (provider_ready("serper") or provider_ready("tavily")):
        return JSONResponse(
            {
                "detail": "尚未配置真实客户搜索来源。为避免把演示数据混入客户库，本次不会生成或保存模拟客户。请管理员先连接 Serper 或 Tavily。",
                "code": "live_acquisition_provider_required",
                "mode": "unavailable",
                "items": [],
            },
            status_code=503,
        )
    provider, raw, errors = await _company_search_with_failover(req)
    if not provider:
        return JSONResponse({"detail": "；".join(errors) or "在线找客户服务暂时没有可用结果", "mode": "unavailable", "items": []}, status_code=503)
    return _persist_company_results(req, raw, provider)


def _contact_rank(row: dict[str, Any]) -> tuple[int, float]:
    role = str(row.get("position") or "").lower()
    kind = str(row.get("type") or "").lower()
    score = 20
    if any(term in role for term in _BUYER_ROLE_TERMS):
        score = 120
    elif any(term in role for term in _OWNER_ROLE_TERMS):
        score = 90
    elif kind == "personal":
        score = 65
    elif kind == "generic":
        score = 35
    try:
        confidence = float(row.get("confidence") or 0)
    except Exception:
        confidence = 0
    return score, confidence


def _best_hunter_contact(payload: dict[str, Any], domain: str) -> tuple[dict[str, Any] | None, list[str]]:
    data = payload.get("data") if isinstance(payload, dict) else None
    emails = data.get("emails") if isinstance(data, dict) else []
    valid: list[dict[str, Any]] = []
    values: list[str] = []
    for row in emails or []:
        if not isinstance(row, dict):
            continue
        email = str(row.get("value") or "").strip().lower()
        if not email or "@" not in email or email.rsplit("@", 1)[-1] != domain.lower():
            continue
        valid.append(row); values.append(email)
    if not valid:
        return None, []
    valid.sort(key=_contact_rank, reverse=True)
    return valid[0], list(dict.fromkeys(values))


async def _hunter_domain_search(domain: str) -> dict[str, Any]:
    cfg = resolve_provider("hunter")
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.get(
                cfg["endpoint_url"] + "/domain-search",
                params={"domain": domain, "limit": 10, "api_key": cfg["token"]},
                headers={"Accept": "application/json"},
            )
    except httpx.RequestError as exc:
        raise RuntimeError("联系人查找服务暂时连接不上") from exc
    if response.status_code in {401, 403}:
        raise RuntimeError("联系人查找服务授权信息没有通过，请管理员检查连接")
    if response.status_code == 429:
        raise RuntimeError("联系人查找服务当前额度或请求频率已到限制，请稍后再试")
    if response.status_code >= 400:
        raise RuntimeError("联系人查找服务没有成功返回结果")
    try:
        data = read_provider_json(response, "Hunter")
        if not isinstance(data.get("data"), dict) or not isinstance(data["data"].get("emails"), list):
            raise ValueError("missing emails")
        return data
    except Exception as exc:
        raise RuntimeError("联系人查找服务返回了无法读取的数据") from exc


async def _handle_hunter_contact(lead_id: int) -> JSONResponse | None:
    db = SessionLocal()
    try:
        lead = db.get(Lead, lead_id)
        if not lead:
            return JSONResponse({"detail": "没有找到这个客户"}, status_code=404)
        domain = str(lead.domain or "").strip().lower()
        if not domain:
            return JSONResponse({"detail": "请先确认这个客户的公司官网，再查找联系人"}, status_code=400)
        try:
            payload = await _hunter_domain_search(domain)
        except RuntimeError as exc:
            return None if provider_ready("serper") else JSONResponse({"detail": str(exc)}, status_code=503)
        best, emails = _best_hunter_contact(payload, domain)
        if not emails and provider_ready("serper"):
            return None
        if best:
            first = str(best.get("first_name") or "").strip(); last = str(best.get("last_name") or "").strip()
            name = " ".join(x for x in [first, last] if x).strip()
            lead.contact_email = str(best.get("value") or "").strip().lower()
            if name: lead.contact_name = name[:255]
            role = str(best.get("position") or "").strip()
            if role: lead.contact_role = role[:255]
            lead.updated_at = datetime.now(timezone.utc)
        if emails:
            lead.evidence_json = merge_evidence(lead.evidence_json, [
                {"title": "公开业务联系人", "url": lead.website, "snippet": email, "source": "verified_contact_search", "provider": "hunter"}
                for email in emails[:10]
            ])
        add_activity(
            db, lead.id, "contact_search", "查找公开联系人",
            f"发现 {len(emails)} 个同域公开邮箱" if emails else "暂未找到可核验的同域公开邮箱",
            {"emails": emails[:10], "source": "verified_contact_search", "provider": "hunter"},
        )
        db.commit(); db.refresh(lead)
        return JSONResponse({"mode": "live", "provider": "hunter", "emails": emails, "lead": lead_to_dict(lead, db)})
    except Exception:
        db.rollback()
        return JSONResponse({"detail": "联系人结果处理时没有成功，请稍后再试"}, status_code=500)
    finally:
        db.close()


@app.middleware("http")
async def legacy_acquisition_provider_fusion(request: Request, call_next):
    """Fuse live acquisition providers into the current lead/contact owners only."""
    path = request.url.path
    method = request.method.upper()
    if method == "POST" and path == "/api/leads/search":
        return await _handle_company_search(request)
    match = re.fullmatch(r"/api/leads/(\d+)/find-contact", path)
    if method == "POST" and match and provider_ready("hunter"):
        response = await _handle_hunter_contact(int(match.group(1)))
        if response is not None:
            return response
    return await call_next(request)
