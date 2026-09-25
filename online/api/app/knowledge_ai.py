from __future__ import annotations

import json
from typing import Any, Literal

import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .knowledge_context import _strip_price_text, search_business_knowledge
from .main import get_db
from .online_app import app
from .provider_settings import read_provider_json, resolve_provider
from .service_adapters import _validate_endpoint


class KnowledgeSuggestionRequest(BaseModel):
    query: str = Field(min_length=2, max_length=240)
    purpose: Literal["outreach_strategy", "account_summary", "inquiry_next_step", "market_brief"] = "outreach_strategy"
    language: Literal["Chinese", "English"] = "Chinese"
    max_sources: int = Field(default=6, ge=2, le=8)


PURPOSE_LABELS = {
    "outreach_strategy": "给销售人员一段下一步开发建议；不要直接发送邮件",
    "account_summary": "总结当前客户/潜客的已知事实、机会和缺口",
    "inquiry_next_step": "根据已知询盘事实建议下一步核对/推进动作；不要替用户确认商业条款",
    "market_brief": "根据已有市场事实整理一段简洁业务判断；不要把旧情报说成最新消息",
}


def _provider_unavailable(retrieval: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": False,
        "mode": "provider_unavailable",
        "network_requests": 0,
        "suggestion": "",
        "citations": [],
        "uncertainties": [],
        "retrieval": {
            "query": retrieval.get("query", ""),
            "items": retrieval.get("items", []),
            "guardrails": retrieval.get("guardrails", {}),
        },
        "human_review_required": True,
        "message": "文字生成服务尚未配置；已返回可引用的 HUIDI 事实，但不会用模板或假模型结果冒充 AI 建议。",
    }


def _safe_sources(retrieval: dict[str, Any], max_sources: int) -> list[dict[str, Any]]:
    rows = []
    for item in retrieval.get("items", [])[:max_sources]:
        citation = str(item.get("citation") or "").strip()
        title = str(item.get("title") or "").strip()
        snippet = _strip_price_text(item.get("snippet"), 520)
        if not citation or not (title or snippet):
            continue
        rows.append({
            "citation": citation,
            "source": item.get("source"),
            "source_label": item.get("source_label"),
            "record_id": item.get("record_id"),
            "title": title,
            "snippet": snippet,
            "route": item.get("route") or {},
        })
    return rows


@app.post("/api/knowledge/suggest")
async def suggest_from_huidi_knowledge(req: KnowledgeSuggestionRequest, db: Session = Depends(get_db)):
    """Generate a non-persistent suggestion grounded only in cited HUIDI facts.

    The endpoint cannot write Customer/Product/Deal/Document/Mail data and exposes
    no arbitrary tool execution. The retrieval layer strips reference/formal-price
    fragments before any provider call. Human review remains mandatory.
    """
    retrieval = search_business_knowledge(q=req.query, limit=max(req.max_sources, 6), db=db)
    sources = _safe_sources(retrieval, req.max_sources)
    if not sources:
        return {
            "ok": False,
            "mode": "no_context",
            "network_requests": 0,
            "suggestion": "",
            "citations": [],
            "uncertainties": ["当前工作区没有找到足够的已有事实。"],
            "retrieval": retrieval,
            "human_review_required": True,
            "message": "没有足够的 HUIDI 来源可供引用，因此不调用模型，也不生成猜测性答案。",
        }

    cfg = resolve_provider("llm", db)
    if not cfg.get("configured"):
        return _provider_unavailable(retrieval)

    allowed = [x["citation"] for x in sources]
    source_text = "\n".join(
        f"[{x['citation']}] {x['title']} — {x['snippet']}" for x in sources
    )
    prompt = f"""You are HUIDI's citation-grounded B2B foreign-trade assistant.
Task: {PURPOSE_LABELS[req.purpose]}
Output language: {req.language}
User query: {req.query}

Authoritative HUIDI sources:
{source_text}

Hard rules:
- Use ONLY the facts in the HUIDI sources above.
- Every factual conclusion must be traceable to one or more allowed citations.
- Do not invent missing company, contact, trade, certification, customer-intent, shipping, tariff or market facts.
- Product/reference/formal prices are intentionally excluded. Do not estimate, reconstruct, infer or recommend any price.
- Do not claim cached intelligence is current/latest unless a source explicitly proves that.
- Do not send mail, change CRM state, create an inquiry, edit a document or imply any action was executed.
- If facts are insufficient, say what is uncertain instead of guessing.
- The result is a draft recommendation for human review.

Return strict JSON only:
{{
  "suggestion":"concise actionable recommendation",
  "used_citations":["exact citation from allowed list"],
  "uncertainties":["missing or unverified fact"]
}}
"""
    _validate_endpoint(cfg["endpoint_url"])
    async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
        response = await client.post(
            f"{cfg['endpoint_url']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['token']}", "Content-Type": "application/json"},
            json={
                "model": cfg["model"],
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
        )
        payload = read_provider_json(response, "HUIDI 知识建议")
    try:
        content = payload["choices"][0]["message"]["content"]
        model_result = json.loads(content)
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        raise HTTPException(502, "文字生成服务没有返回可验证的引用 JSON") from None

    suggestion = _strip_price_text(model_result.get("suggestion"), 2400)
    cited = [str(x).strip() for x in model_result.get("used_citations", []) if str(x).strip() in allowed]
    cited = list(dict.fromkeys(cited))
    uncertainties = [
        _strip_price_text(x, 360)
        for x in model_result.get("uncertainties", [])[:8]
        if str(x or "").strip()
    ]
    if suggestion and not cited:
        raise HTTPException(502, "文字生成结果没有引用任何允许的 HUIDI 来源，已拒绝展示")

    source_by_citation = {x["citation"]: x for x in sources}
    return {
        "ok": True,
        "mode": "grounded_llm",
        "network_requests": 1,
        "suggestion": suggestion,
        "citations": [source_by_citation[x] for x in cited],
        "uncertainties": uncertainties,
        "human_review_required": True,
        "provider": {"model": cfg.get("model", ""), "source": cfg.get("source", "")},
        "guardrails": {
            "retrieval_grounded": True,
            "citations_required": True,
            "formal_price_excluded": True,
            "writes_business_data": False,
            "tool_execution": False,
            "human_review_required": True,
        },
        "message": "建议只基于所列 HUIDI 引用生成，未写入任何客户、询盘、单据或邮件数据。",
    }
