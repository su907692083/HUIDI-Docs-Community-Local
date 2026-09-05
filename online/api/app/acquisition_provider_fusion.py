from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select

from .lead_engine import clean_domain, merge_evidence, score_search_result
from .main import Lead, LeadSearchRequest, SessionLocal, add_activity, lead_to_dict
from .online_app import app


TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
TAVILY_BASE_URL = os.getenv("TAVILY_BASE_URL", "https://api.tavily.com").rstrip("/")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY", "").strip()
HUNTER_BASE_URL = os.getenv("HUNTER_BASE_URL", "https://api.hunter.io/v2").rstrip("/")
SERPER_CONFIGURED = bool(os.getenv("SERPER_API_KEY", "").strip())

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
    return {
        "serper": SERPER_CONFIGURED,
        "company_search_fallback": bool(TAVILY_API_KEY),
        "contact_search_priority": bool(HUNTER_API_KEY),
        "live_company_search": bool(SERPER_CONFIGURED or TAVILY_API_KEY),
        "live_contact_search": bool(SERPER_CONFIGURED or HUNTER_API_KEY),
    }


def _host_excluded(domain: str) -> bool:
    host = str(domain or "").lower().strip(".")
    return any(host == blocked or host.endswith("." + blocked) for blocked in _EXCLUDED_DOMAINS)


def _friendly_provider_error(response: httpx.Response, label: str) -> JSONResponse:
    if response.status_code in {401, 403}:
        message = f"{label}授权信息没有通过，请管理员检查连接"
        status = 502
    elif response.status_code == 429:
        message = f"{label}当前额度或请求频率已到限制，请稍后再试"
        status = 503
    elif response.status_code >= 500:
        message = f"{label}暂时不可用，请稍后再试"
        status = 503
    else:
        message = f"{label}没有成功返回结果"
        status = 502
    return JSONResponse({"detail": message}, status_code=status)


async def _tavily_company_search(req: LeadSearchRequest) -> list[dict[str, Any]]:
    query = " ".join(
        x for x in [
            req.product_keyword,
            req.buyer_type,
            req.country,
            "company importer distributor buyer official website",
        ] if x
    )
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{TAVILY_BASE_URL}/search",
                headers={"Authorization": f"Bearer {TAVILY_API_KEY}", "Content-Type": "application/json"},
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
        raise RuntimeError("在线找客户服务暂时连接不上") from exc
    if response.status_code >= 400:
        error = _friendly_provider_error(response, "在线找客户服务")
        raise RuntimeError(str(error.body.decode("utf-8", errors="ignore")))
    try:
        payload = response.json()
    except Exception as exc:
        raise RuntimeError("在线找客户服务返回了无法读取的数据") from exc
    rows: list[dict[str, Any]] = []
    for item in (payload.get("results") or [])[:20]:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        domain = clean_domain(url)
        if not domain or _host_excluded(domain):
            continue
        rows.append(
            {
                "title": str(item.get("title") or domain).strip(),
                "link": url,
                "snippet": str(item.get("content") or "").strip(),
                "search_score": float(item.get("score") or 0),
            }
        )
    return rows


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
        valid.append(row)
        values.append(email)
    if not valid:
        return None, []
    valid.sort(key=_contact_rank, reverse=True)
    return valid[0], list(dict.fromkeys(values))


async def _hunter_domain_search(domain: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.get(
                f"{HUNTER_BASE_URL}/domain-search",
                params={"domain": domain, "limit": 10, "api_key": HUNTER_API_KEY},
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
        return response.json()
    except Exception as exc:
        raise RuntimeError("联系人查找服务返回了无法读取的数据") from exc


async def _handle_company_search(request: Request) -> JSONResponse:
    try:
        req = LeadSearchRequest.model_validate(await request.json())
    except (ValidationError, ValueError, TypeError):
        return JSONResponse({"detail": "请填写产品关键词、目标市场和客户类型"}, status_code=422)
    try:
        raw = await _tavily_company_search(req)
    except RuntimeError as exc:
        message = str(exc)
        if message.startswith('{') and 'detail' in message:
            try:
                import json
                message = json.loads(message).get("detail") or message
            except Exception:
                pass
        return JSONResponse({"detail": message}, status_code=502)

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
                "title": item.get("title"),
                "url": link,
                "snippet": item.get("snippet", ""),
                "source": "online_company_search",
                "score_breakdown": breakdown,
                "priority": level,
            }
            if existing:
                if score > existing.score:
                    existing.score = score
                    existing.reason = reason
                    existing.market_keyword = req.product_keyword
                    existing.buyer_type = req.buyer_type
                    existing.country = req.country or existing.country
                    existing.evidence_json = merge_evidence(existing.evidence_json, [evidence])
                    existing.updated_at = datetime.now(timezone.utc)
                continue
            lead = Lead(
                company_name=(str(item.get("title") or domain).split("|")[0].strip() or domain)[:255],
                domain=domain,
                website=link,
                country=req.country,
                market_keyword=req.product_keyword,
                buyer_type=req.buyer_type,
                score=score,
                reason=reason,
                evidence_json=merge_evidence("[]", [evidence]),
            )
            db.add(lead)
            db.flush()
            add_activity(
                db,
                lead.id,
                "discovered",
                "发现潜在客户",
                f"优先级 {level} · 匹配分 {score}",
                {"breakdown": breakdown, "source": "online_company_search"},
            )
            created.append(lead)
            if len(created) >= req.limit:
                break
        db.commit()
        for lead in created:
            db.refresh(lead)
        return JSONResponse({"mode": "live", "items": [lead_to_dict(x, db) for x in created]})
    except Exception:
        db.rollback()
        return JSONResponse({"detail": "真实客户结果已经返回，但保存时没有成功，请稍后再试"}, status_code=500)
    finally:
        db.close()


async def _handle_contact_search(lead_id: int) -> JSONResponse:
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
            return JSONResponse({"detail": str(exc)}, status_code=502)
        best, emails = _best_hunter_contact(payload, domain)
        if best:
            first = str(best.get("first_name") or "").strip()
            last = str(best.get("last_name") or "").strip()
            name = " ".join(x for x in [first, last] if x).strip()
            lead.contact_email = str(best.get("value") or "").strip().lower()
            if name:
                lead.contact_name = name[:255]
            role = str(best.get("position") or "").strip()
            if role:
                lead.contact_role = role[:255]
            lead.updated_at = datetime.now(timezone.utc)
        evidence_rows = []
        for email in emails[:10]:
            evidence_rows.append({"title": "公开业务联系人", "url": lead.website, "snippet": email, "source": "verified_contact_search"})
        if evidence_rows:
            lead.evidence_json = merge_evidence(lead.evidence_json, evidence_rows)
        add_activity(
            db,
            lead.id,
            "contact_search",
            "查找公开联系人",
            f"发现 {len(emails)} 个同域公开邮箱" if emails else "暂未找到可核验的同域公开邮箱",
            {"emails": emails[:10], "source": "verified_contact_search"},
        )
        db.commit(); db.refresh(lead)
        return JSONResponse({"mode": "live", "emails": emails, "lead": lead_to_dict(lead, db)})
    except Exception:
        db.rollback()
        return JSONResponse({"detail": "联系人结果处理时没有成功，请稍后再试"}, status_code=500)
    finally:
        db.close()


@app.middleware("http")
async def legacy_acquisition_provider_fusion(request: Request, call_next):
    """Absorb proven V3.x provider capability into current Online endpoints.

    This does not create a second lead/contact API. It only supplies a real
    provider fallback to the existing paths when the current Serper owner is not
    configured, and prefers the dedicated contact provider when available.
    """
    path = request.url.path
    method = request.method.upper()
    if method == "POST" and path == "/api/leads/search" and not SERPER_CONFIGURED and TAVILY_API_KEY:
        return await _handle_company_search(request)
    match = re.fullmatch(r"/api/leads/(\d+)/find-contact", path)
    if method == "POST" and match and HUNTER_API_KEY:
        return await _handle_contact_search(int(match.group(1)))
    return await call_next(request)
