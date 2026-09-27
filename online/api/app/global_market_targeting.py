from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# Lightweight, dependency-free global prospecting query planner.
# It never blocks a market: unknown countries fall back to English buyer intent.
# Local-language buyer terms are added for high-volume trading regions to improve recall.

_ALIAS = {
    "US": {"us","usa","united states","美国"},
    "CA": {"ca","canada","加拿大"},
    "GB": {"gb","uk","united kingdom","英国"},
    "DE": {"de","germany","deutschland","德国"},
    "FR": {"fr","france","法国"},
    "ES": {"es","spain","españa","西班牙"},
    "PT": {"pt","portugal","葡萄牙"},
    "IT": {"it","italy","italia","意大利"},
    "NL": {"nl","netherlands","holland","荷兰"},
    "PL": {"pl","poland","polska","波兰"},
    "RU": {"ru","russia","俄罗斯"},
    "TR": {"tr","turkey","türkiye","土耳其"},
    "AE": {"ae","uae","united arab emirates","阿联酋"},
    "SA": {"sa","saudi arabia","沙特","沙特阿拉伯"},
    "JP": {"jp","japan","日本"},
    "KR": {"kr","south korea","korea","韩国"},
    "VN": {"vn","vietnam","viet nam","越南"},
    "TH": {"th","thailand","泰国"},
    "MY": {"my","malaysia","马来西亚"},
    "SG": {"sg","singapore","新加坡"},
    "ID": {"id","indonesia","印尼","印度尼西亚"},
    "IN": {"in","india","印度"},
    "AU": {"au","australia","澳大利亚","澳洲"},
    "NZ": {"nz","new zealand","新西兰"},
    "BR": {"br","brazil","brasil","巴西"},
    "MX": {"mx","mexico","méxico","墨西哥"},
    "CL": {"cl","chile","智利"},
    "AR": {"ar","argentina","阿根廷"},
    "CO": {"co","colombia","哥伦比亚"},
}

_LOCAL_BUYER_TERMS = {
    "DE": ("Importeur","Großhändler","Händler","Einkauf","Beschaffung"),
    "FR": ("importateur","distributeur","grossiste","acheteur","approvisionnement"),
    "ES": ("importador","distribuidor","mayorista","compras","abastecimiento"),
    "PT": ("importador","distribuidor","atacadista","compras"),
    "BR": ("importador","distribuidor","atacadista","compras"),
    "IT": ("importatore","distributore","grossista","acquisti"),
    "NL": ("importeur","distributeur","groothandel","inkoop"),
    "PL": ("importer","dystrybutor","hurtownia","zakupy"),
    "RU": ("импортер","дистрибьютор","оптовик","закупки"),
    "TR": ("ithalatçı","distribütör","toptancı","satın alma"),
    "AE": ("importer","distributor","wholesaler","procurement","مستورد","موزع"),
    "SA": ("importer","distributor","wholesaler","procurement","مستورد","موزع"),
    "JP": ("輸入業者","代理店","卸売","調達","仕入れ"),
    "KR": ("수입업체","유통업체","도매","구매","조달"),
    "VN": ("nhà nhập khẩu","nhà phân phối","bán buôn","thu mua"),
    "TH": ("ผู้นำเข้า","ผู้จัดจำหน่าย","ค้าส่ง","จัดซื้อ"),
    "MY": ("importer","distributor","wholesaler","pembelian"),
    "SG": ("importer","distributor","wholesaler","procurement"),
    "ID": ("importir","distributor","grosir","pengadaan"),
    "IN": ("importer","distributor","wholesaler","procurement","sourcing"),
    "MX": ("importador","distribuidor","mayorista","compras"),
    "CL": ("importador","distribuidor","mayorista","compras"),
    "AR": ("importador","distribuidor","mayorista","compras"),
    "CO": ("importador","distribuidor","mayorista","compras"),
}

_PERSONAS = {
    "importer": ("importer","import company","import manager"),
    "distributor": ("distributor","dealer","authorized distributor"),
    "wholesaler": ("wholesaler","wholesale company","trade wholesaler"),
    "retailer": ("retailer","retail chain","store buyer"),
    "ecommerce": ("ecommerce","online retailer","marketplace seller"),
    "brand": ("brand owner","brand company","private label"),
    "manufacturer": ("manufacturer","factory","industrial buyer"),
    "contractor": ("contractor","project procurement","engineering contractor"),
    "agent": ("agent","sales agent","commercial representative"),
    "procurement": ("procurement","purchasing","sourcing"),
}


@dataclass(frozen=True)
class MarketContext:
    raw: str
    code: str
    label: str


def _clean(value: str) -> str:
    return re.sub(r"\s+"," ",str(value or "")).strip()


def market_context(country: str) -> MarketContext:
    raw = _clean(country)
    key = raw.casefold()
    for code, aliases in _ALIAS.items():
        if key in {x.casefold() for x in aliases}:
            label = next((x for x in aliases if not re.fullmatch(r"[A-Z]{2}", x)), raw)
            return MarketContext(raw=raw, code=code, label=label)
    return MarketContext(raw=raw, code="", label=raw)


def _persona_terms(value: str) -> list[str]:
    raw = _clean(value).lower()
    found: list[str] = []
    for key, terms in _PERSONAS.items():
        if key in raw or any(term in raw for term in terms):
            found.extend(terms)
    if not found:
        found.extend(x for x in re.split(r"[,/|]+|\s{2,}", raw) if _clean(x))
    return list(dict.fromkeys(_clean(x) for x in found if _clean(x)))[:8]


def _quoted(value: str) -> str:
    value = _clean(value)
    return f'"{value}"' if " " in value else value


def _join(parts: Iterable[str]) -> str:
    return " ".join(_clean(x) for x in parts if _clean(x))


def prospect_query_plan(
    *,
    product_keyword: str,
    country: str = "",
    buyer_type: str = "",
    industry: str = "",
    category: str = "",
    hs_code: str = "",
    max_queries: int = 5,
) -> list[str]:
    product = _clean(product_keyword)
    market = market_context(country)
    buyer_terms = _persona_terms(buyer_type) or ["importer","distributor","wholesaler"]
    local_terms = list(_LOCAL_BUYER_TERMS.get(market.code, ()))
    context_terms = list(dict.fromkeys(x for x in (_clean(category), _clean(industry), _clean(hs_code)) if x))

    exclude = "-site:alibaba.com -site:amazon.com -site:made-in-china.com -site:globalsources.com -site:indiamart.com"
    queries = [
        _join([_quoted(product), " ".join(buyer_terms[:3]), market.raw, *context_terms[:2], exclude]),
        _join([_quoted(product), "procurement purchasing sourcing", market.raw, *context_terms[:2], "company", exclude]),
        _join([_quoted(product), "import distributor wholesale", market.raw, "official website", exclude]),
    ]
    if local_terms:
        queries.insert(1, _join([_quoted(product), " ".join(local_terms[:4]), market.raw, *context_terms[:1], exclude]))
    if hs_code:
        queries.append(_join([_quoted(product), _clean(hs_code), "importer distributor", market.raw, exclude]))
    if category or industry:
        queries.append(_join([_quoted(product), _quoted(category or industry), "buyer distributor", market.raw, exclude]))

    out: list[str] = []
    seen: set[str] = set()
    for q in queries:
        q = _clean(q)
        if not q or q in seen:
            continue
        seen.add(q)
        out.append(q)
        if len(out) >= max(1, min(8, int(max_queries or 5))):
            break
    return out


def market_alias_terms(country: str) -> list[str]:
    ctx = market_context(country)
    if not ctx.code:
        return [ctx.raw] if ctx.raw else []
    return [ctx.code, *_ALIAS.get(ctx.code, set())]
