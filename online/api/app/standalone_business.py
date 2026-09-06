from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .business_center import OnlineCustomer, OnlineDeal, OnlineDocumentRef, deal_dict, upsert_from_lead
from .main import Lead, add_activity, get_db, lead_to_dict
from .online_app import app
from .product_memory import ProductBrainRecord


DOC_NAMES = {
    "quotation": "报价单",
    "proforma_invoice": "形式发票 PI",
    "sales_contract": "销售合同",
    "commercial_invoice": "商业发票 CI",
    "packing_list": "装箱单",
}
DOC_PREFIX = {
    "quotation": "QT",
    "proforma_invoice": "PI",
    "sales_contract": "SC",
    "commercial_invoice": "CI",
    "packing_list": "PL",
}


class ManualLeadRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    product_keyword: str = Field(default="", max_length=255)
    country: str = Field(default="", max_length=120)
    website: str = Field(default="", max_length=1000)
    contact_name: str = Field(default="", max_length=255)
    contact_role: str = Field(default="", max_length=255)
    contact_email: str = Field(default="", max_length=255)
    requirements: str = Field(default="", max_length=10000)
    create_inquiry: bool = False


class NativeDocumentRequest(BaseModel):
    document_type: str = Field(pattern="^(quotation|proforma_invoice|sales_contract|commercial_invoice|packing_list)$")


def _domain(value: str) -> str:
    text = str(value or "").strip()
    text = re.sub(r"^https?://", "", text, flags=re.I)
    text = text.split("/")[0].strip().lower()
    return text[4:] if text.startswith("www.") else text


def _product_payload(row: ProductBrainRecord | None) -> dict[str, Any]:
    if not row:
        return {}
    try:
        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    return payload if isinstance(payload, dict) else {}


def _first(payload: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if value not in (None, "", [], {}):
            if isinstance(value, (list, tuple)):
                return ", ".join(str(x) for x in value if str(x).strip())
            if isinstance(value, dict):
                return "; ".join(f"{k}: {v}" for k, v in value.items() if str(v).strip())
            return str(value)
    return ""


def _match_product(db: Session, keyword: str) -> tuple[ProductBrainRecord | None, dict[str, Any]]:
    term = str(keyword or "").strip()
    if not term:
        return None, {}
    row = db.scalar(
        select(ProductBrainRecord)
        .where(or_(ProductBrainRecord.name.ilike(f"%{term}%"), ProductBrainRecord.sku.ilike(f"%{term}%")))
        .order_by(ProductBrainRecord.updated_at.desc())
    )
    return row, _product_payload(row)


def _quantity(requirements: str) -> str:
    text = str(requirements or "")
    patterns = [
        r"(?i)(?:qty|quantity|数量)\s*[:：]?\s*([\d,.]+\s*(?:pcs|pieces|sets|set|units|unit|件|套)?)",
        r"(?i)([\d,.]+\s*(?:pcs|pieces|sets|set|units|unit|件|套))",
    ]
    for pattern in patterns:
        hit = re.search(pattern, text)
        if hit:
            return hit.group(1).strip()
    return ""


def _incoterm(requirements: str) -> str:
    hit = re.search(r"(?i)\b(EXW|FOB|CFR|CIF|DAP|DDP|FCA|CPT|CIP)\b(?:\s+([A-Za-z][A-Za-z .-]{1,40}))?", str(requirements or ""))
    if not hit:
        return ""
    return " ".join(x for x in hit.groups() if x).strip()


@app.post("/api/leads/manual")
def create_manual_lead(req: ManualLeadRequest, db: Session = Depends(get_db)):
    name = req.company_name.strip()
    domain = _domain(req.website)
    existing = None
    if domain:
        existing = db.scalar(select(Lead).where(func.lower(Lead.domain) == domain.lower()))
    if not existing:
        existing = db.scalar(select(Lead).where(func.lower(Lead.company_name) == name.lower()).order_by(Lead.id.desc()))

    created = existing is None
    lead = existing or Lead(company_name=name)
    if created:
        db.add(lead)
        db.flush()
    lead.company_name = name
    lead.website = req.website.strip() or lead.website
    lead.domain = domain or lead.domain
    lead.country = req.country.strip() or lead.country
    lead.market_keyword = req.product_keyword.strip() or lead.market_keyword
    lead.contact_name = req.contact_name.strip() or lead.contact_name
    lead.contact_role = req.contact_role.strip() or lead.contact_role
    lead.contact_email = req.contact_email.strip() or lead.contact_email
    if req.requirements.strip():
        lead.reason = req.requirements.strip()
    elif created:
        lead.reason = "手工录入"
    lead.evidence_json = lead.evidence_json or "[]"
    lead.status = lead.status or "new"
    lead.updated_at = datetime.now(timezone.utc)
    add_activity(
        db,
        lead.id,
        "manual_lead_saved",
        "手动保存客户",
        "仅保存用户实际填写的资料，没有生成演示数据。",
        {"create_inquiry": bool(req.create_inquiry)},
    )
    db.commit()
    db.refresh(lead)

    if not req.create_inquiry:
        return {"ok": True, "created": created, "lead": lead_to_dict(lead, db), "deal": None}

    customer, deal = upsert_from_lead(db, lead)
    if req.requirements.strip():
        deal.requirements = req.requirements.strip()
    if req.product_keyword.strip():
        deal.product_keyword = req.product_keyword.strip()
    deal.next_action = deal.next_action or "核对产品、数量和价格并制作报价单"
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(deal)
    return {
        "ok": True,
        "created": created,
        "lead": lead_to_dict(lead, db),
        "customer": {"id": customer.id, "company_name": customer.company_name},
        "deal": deal_dict(deal, db),
    }


@app.post("/api/business/deals/{deal_id}/native-document")
def create_native_document(deal_id: int, req: NativeDocumentRequest, db: Session = Depends(get_db)):
    deal = db.get(OnlineDeal, deal_id)
    if not deal:
        raise HTTPException(404, "没有找到这笔询盘")
    name = DOC_NAMES[req.document_type]
    row = OnlineDocumentRef(
        deal_id=deal.id,
        document_type=req.document_type,
        document_id="",
        state="draft",
        title=f"{deal.title} · {name}",
    )
    db.add(row)
    db.flush()
    row.document_id = f"ONLINE-{DOC_PREFIX[req.document_type]}-{datetime.now().strftime('%Y%m%d')}-{row.id:05d}"
    deal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "id": row.id,
        "document_id": row.document_id,
        "document_type": row.document_type,
        "url": f"/documents/online/{row.id}",
        "local_optional": True,
    }


def _document_html(ref: OnlineDocumentRef, deal: OnlineDeal, customer: OnlineCustomer, product: ProductBrainRecord | None, payload: dict[str, Any]) -> str:
    doc_name = DOC_NAMES.get(ref.document_type, "业务单据")
    product_name = (product.name if product else "") or deal.product_keyword
    sku = (product.sku if product else "") or _first(payload, "sku", "model", "item_no")
    spec = _first(payload, "specification", "spec", "specs", "material", "description")
    moq = _first(payload, "moq", "minimum_order_quantity")
    lead_time = _first(payload, "lead_time", "delivery_time", "delivery")
    packing = _first(payload, "packing", "packaging", "package")
    reference_price = _first(payload, "reference_price", "price", "unit_price")
    qty = _quantity(deal.requirements)
    incoterm = _incoterm(deal.requirements)
    total = f"{deal.amount:g}" if deal.amount else ""

    def e(value: Any) -> str:
        return html.escape(str(value or ""), quote=True)

    packing_rows = ""
    if ref.document_type == "packing_list":
        packing_rows = f"""
        <div class='grid three'>
          <label>包装件数<input data-k='packages' placeholder='例如 20 cartons'></label>
          <label>净重<input data-k='net_weight' placeholder='例如 480 kg'></label>
          <label>毛重<input data-k='gross_weight' placeholder='例如 520 kg'></label>
          <label>外箱尺寸<input data-k='carton_size' value='{e(packing)}' placeholder='L × W × H'></label>
          <label>总体积<input data-k='volume' placeholder='例如 1.8 CBM'></label>
          <label>唛头<input data-k='marks' placeholder='Shipping marks'></label>
        </div>"""

    reference_price_note = (
        f"<div class='refprice'>产品资料参考价：{e(reference_price)} · 仅供核对，不会自动写入正式单价。</div>"
        if reference_price
        else ""
    )
    commercial_rows = ""
    if ref.document_type != "packing_list":
        commercial_rows = f"""
        <div class='grid three'>
          <label>数量<input data-k='quantity' value='{e(qty)}' placeholder='例如 5000 pcs'></label>
          <label>单价<input data-k='unit_price' value='' placeholder='请人工确认'></label>
          <label>总金额<input data-k='total' value='{e(total)}' placeholder='请人工确认'></label>
          <label>贸易条款<input data-k='incoterm' value='{e(incoterm)}' placeholder='例如 FOB Ningbo'></label>
          <label>交期<input data-k='lead_time' value='{e(lead_time)}' placeholder='例如 20 days'></label>
          <label>付款条件<input data-k='payment' placeholder='例如 T/T 30% deposit'></label>
        </div>{reference_price_note}"""

    return f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{e(doc_name)} · HUIDI Online</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#eef2f7;color:#172033;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.top{{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;padding:10px 18px;background:#101828;color:#fff}}.top b{{margin-right:auto}}button{{border:0;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}}.primary{{background:#2563eb;color:#fff}}.paper{{width:min(1000px,calc(100% - 32px));margin:22px auto;background:#fff;min-height:1240px;padding:46px 52px;box-shadow:0 12px 40px rgba(15,23,42,.13)}}h1{{text-align:center;margin:0;font-size:28px;letter-spacing:2px}}.docno{{text-align:center;color:#667085;margin:5px 0 28px}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}}.grid.three{{grid-template-columns:repeat(3,minmax(0,1fr))}}label{{font-size:11px;color:#667085;font-weight:700}}input,textarea{{display:block;width:100%;margin-top:4px;border:1px solid #d0d5dd;border-radius:7px;padding:8px 9px;font:inherit;color:#101828;background:#fff}}textarea{{min-height:90px;resize:vertical}}table{{width:100%;border-collapse:collapse;margin:18px 0}}th,td{{border:1px solid #98a2b3;padding:9px;text-align:left}}th{{background:#f8fafc}}.note{{font-size:11px;color:#667085}}.refprice{{margin:-4px 0 12px;padding:8px 10px;border-radius:8px;background:#fff8e8;border:1px solid #f1dba8;color:#755b20;font-size:11px}}.foot{{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:46px}}.sign{{border-top:1px solid #98a2b3;padding-top:10px}}@media(max-width:760px){{.paper{{padding:24px 18px}}.grid,.grid.three,.foot{{grid-template-columns:1fr}}}}@media print{{body{{background:#fff}}.top{{display:none}}.paper{{width:100%;margin:0;box-shadow:none;min-height:auto;padding:18mm 16mm}}input,textarea{{border:0;padding:0}}}}
</style></head><body>
<div class='top'><b>HUIDI Online · {e(doc_name)}</b><button id='back'>返回工作台</button><button id='save'>保存本机草稿</button><button id='download'>下载 HTML</button><button class='primary' onclick='window.print()'>打印 / 另存 PDF</button></div>
<main class='paper'><h1>{e(doc_name)}</h1><div class='docno'>{e(ref.document_id)}</div>
<div class='grid'><label>卖方 / Seller<input data-k='seller' placeholder='填写你的公司名称'></label><label>买方 / Buyer<input data-k='buyer' value='{e(customer.company_name)}'></label><label>联系人<input data-k='contact' value='{e(customer.contact_name)}'></label><label>邮箱<input data-k='email' value='{e(customer.email)}'></label><label>国家 / 地区<input data-k='country' value='{e(customer.country)}'></label><label>日期<input data-k='date' type='date'></label></div>
<table><thead><tr><th style='width:22%'>产品</th><th style='width:16%'>型号 / SKU</th><th>规格 / 描述</th></tr></thead><tbody><tr><td><input data-k='product' value='{e(product_name)}'></td><td><input data-k='sku' value='{e(sku)}'></td><td><textarea data-k='spec'>{e(spec or deal.requirements)}</textarea></td></tr></tbody></table>
{commercial_rows}{packing_rows}
<div class='grid'><label>MOQ<input data-k='moq' value='{e(moq)}'></label><label>币种<input data-k='currency' value='{e(deal.currency or 'USD')}'></label></div>
<label>客户需求 / 备注<textarea data-k='requirements'>{e(deal.requirements)}</textarea></label>
<label>补充条款<textarea data-k='terms' placeholder='只填写双方已经确认的正式条款；未确认内容请留空。'></textarea></label>
<p class='note'>HUIDI 只自动带入已有客户、产品和询盘事实。价格、付款、合同、重量、包装等未确认事实不会自动编造；请在出正式单据前人工核对。</p>
<div class='foot'><div class='sign'>Seller Signature / Stamp</div><div class='sign'>Buyer Confirmation</div></div></main>
<script>
(()=>{{const key='huidi-native-doc-{ref.id}';const fields=[...document.querySelectorAll('[data-k]')];const today=new Date().toISOString().slice(0,10);const date=document.querySelector('[data-k="date"]');if(date&&!date.value)date.value=today;try{{const saved=JSON.parse(localStorage.getItem(key)||'{{}}');fields.forEach(el=>{{if(Object.prototype.hasOwnProperty.call(saved,el.dataset.k))el.value=saved[el.dataset.k]}})}}catch(_){{}}function data(){{return Object.fromEntries(fields.map(el=>[el.dataset.k,el.value]))}}document.querySelector('#save').onclick=()=>{{localStorage.setItem(key,JSON.stringify(data()));alert('已保存到这台电脑')}};document.querySelector('#download').onclick=()=>{{localStorage.setItem(key,JSON.stringify(data()));const blob=new Blob([document.documentElement.outerHTML],{{type:'text/html;charset=utf-8'}});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='{e(ref.document_id)}.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}};document.querySelector('#back').onclick=()=>{{if(history.length>1)history.back();else location.href='/'}}}})();
</script></body></html>"""


@app.get("/documents/online/{ref_id}", response_class=HTMLResponse)
def open_native_document(ref_id: int, db: Session = Depends(get_db)):
    ref = db.get(OnlineDocumentRef, ref_id)
    if not ref:
        raise HTTPException(404, "没有找到这份单据")
    deal = db.get(OnlineDeal, ref.deal_id)
    if not deal:
        raise HTTPException(404, "没有找到对应询盘")
    customer = db.get(OnlineCustomer, deal.customer_id)
    if not customer:
        raise HTTPException(404, "没有找到对应客户")
    product, payload = _match_product(db, deal.product_keyword)
    return HTMLResponse(_document_html(ref, deal, customer, product, payload), headers={"Cache-Control": "no-store"})


@app.get("/api/standalone/readiness")
def standalone_readiness():
    return {
        "ok": True,
        "core": {
            "manual_customer": True,
            "manual_inquiry": True,
            "product_memory": True,
            "quotation": True,
            "proforma_invoice": True,
            "sales_contract": True,
            "commercial_invoice": True,
            "packing_list": True,
        },
        "note": "核心客户、询盘和单据可直接使用；自动找客户、自动找联系人和真实邮件需连接对应联网服务。",
    }
