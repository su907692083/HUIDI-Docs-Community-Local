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
from .document_context import build_document_context, load_document_fields
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
        "context_url": f"/api/business/deals/{deal.id}/document-context?document={row.document_type}&current_ref_id={row.id}",
        "local_optional": True,
    }


def _document_html(
    ref: OnlineDocumentRef,
    deal: OnlineDeal,
    customer: OnlineCustomer,
    product: ProductBrainRecord | None,
    payload: dict[str, Any],
    context: dict[str, Any],
    saved_fields: dict[str, str],
) -> str:
    doc_name = DOC_NAMES.get(ref.document_type, "业务单据")
    inherited = context.get("inherited_fields") if isinstance(context.get("inherited_fields"), dict) else {}
    master = context.get("master_fields") if isinstance(context.get("master_fields"), dict) else {}
    master_data = context.get("master_data") if isinstance(context.get("master_data"), dict) else {}

    def pick(key: str, default: Any = "", *, inherit: bool = True, use_master: bool = True) -> str:
        if key in saved_fields:
            return str(saved_fields.get(key) or "")
        if inherit and key in inherited:
            return str(inherited.get(key) or "")
        if use_master and key in master:
            return str(master.get(key) or "")
        return str(default or "")

    product_name = pick("product", (product.name if product else "") or deal.product_keyword)
    sku = pick("sku", (product.sku if product else "") or _first(payload, "sku", "model", "item_no"))
    spec = pick("spec", _first(payload, "specification", "spec", "specs", "material", "description") or deal.requirements)
    moq = pick("moq", _first(payload, "moq", "minimum_order_quantity"))
    lead_time = pick("lead_time", _first(payload, "lead_time", "delivery_time", "delivery"))
    packing = _first(payload, "packing", "packaging", "package")
    reference_price = _first(payload, "reference_price", "price", "unit_price")
    qty = pick("quantity", _quantity(deal.requirements))
    incoterm = pick("incoterm", _incoterm(deal.requirements))
    unit_price = pick("unit_price", "", inherit=False, use_master=False)
    total = pick("total", f"{deal.amount:g}" if deal.amount else "", inherit=False, use_master=False)
    payment = pick("payment")
    seller = pick("seller")
    seller_address = pick("seller_address")
    seller_phone = pick("seller_phone")
    seller_email = pick("seller_email")
    seller_tax_id = pick("seller_tax_id")
    buyer = pick("buyer", customer.company_name)
    buyer_address_id = pick("buyer_address_id")
    buyer_address = pick("buyer_address")
    buyer_phone = pick("buyer_phone", customer.phone)
    contact = pick("contact", customer.contact_name)
    email = pick("email", customer.email)
    country = pick("country", customer.country)
    date_value = pick("date", "", inherit=False, use_master=False)
    currency = pick("currency", deal.currency or "USD")
    requirements = pick("requirements", deal.requirements)
    terms = pick("terms")
    bank_account_id = pick("bank_account_id")
    bank_label = pick("bank_label")
    bank_name = pick("bank_name")
    bank_account_name = pick("bank_account_name")
    bank_account_number = pick("bank_account_number")
    bank_swift = pick("bank_swift")
    bank_address = pick("bank_address")
    bank_currency = pick("bank_currency")

    def e(value: Any) -> str:
        return html.escape(str(value or ""), quote=True)

    inherited_from = context.get("inherited_from") if isinstance(context.get("inherited_from"), dict) else None
    history = context.get("customer_history") if isinstance(context.get("customer_history"), list) else []
    price_refs = context.get("price_references") if isinstance(context.get("price_references"), list) else []
    addresses = master_data.get("customer_addresses") if isinstance(master_data.get("customer_addresses"), list) else []
    banks = master_data.get("bank_accounts") if isinstance(master_data.get("bank_accounts"), list) else []
    inherited_note = ""
    if inherited_from:
        source_name = DOC_NAMES.get(str(inherited_from.get("document_type") or ""), "上游单据")
        source_id = str(inherited_from.get("document_id") or "")
        inherited_note = (
            f"<div class='ctx ok'><b>已联动：</b>从 {e(source_name)} {e(source_id)} 带入已保存的非价格字段。"
            "正式单价和金额未自动继承，请人工核对。</div>"
        )

    price_lines: list[str] = []
    for item in price_refs[:5]:
        if not isinstance(item, dict):
            continue
        source = str(item.get("source") or "")
        if source == "product_brain" and item.get("value"):
            label = f"产品资料参考价 {item.get('value')}"
        elif source == "upstream_document":
            values = []
            if item.get("unit_price"):
                values.append(f"单价 {item.get('unit_price')}")
            if item.get("total"):
                values.append(f"金额 {item.get('total')}")
            label = f"上游 {item.get('document_id') or ''} " + " / ".join(values)
        elif source == "customer_history" and item.get("amount"):
            label = f"历史业务 #{item.get('deal_id')} {item.get('currency') or ''} {item.get('amount')}"
        else:
            continue
        price_lines.append(f"<span>{e(label)}</span>")
    price_reference_panel = ""
    if price_lines:
        price_reference_panel = (
            "<div class='ctx warn'><b>价格参考：</b>"
            + " · ".join(price_lines)
            + "<br><small>仅供返单/议价核对，不自动写入当前正式单价或 deal.amount。</small></div>"
        )

    context_summary = (
        f"<div class='ctx'><b>同一业务链：</b>Deal #{deal.id} · 已有 {len(context.get('current_documents') or [])} 份单据 · "
        f"同客户历史业务 {len(history)} 笔 · 客户地址 {len(addresses)} 条 · 收款账户 {len(banks)} 个。"
        "主数据直接来自正式客户和公司设置；当前单据保存后形成自己的快照。</div>"
    )

    address_options = ["<option value=''>手工填写 / 未选择</option>"]
    for item in addresses:
        if not isinstance(item, dict):
            continue
        label = item.get("label") or item.get("address_type") or "客户地址"
        formatted = item.get("formatted") or ""
        selected = " selected" if str(item.get("id") or "") == buyer_address_id else ""
        address_options.append(
            f"<option value='{e(item.get('id'))}'{selected}>{e(label)} · {e(formatted)}</option>"
        )
    bank_options = ["<option value=''>手工填写 / 未选择</option>"]
    for item in banks:
        if not isinstance(item, dict):
            continue
        label = item.get("label") or item.get("bank_name") or "收款账户"
        currency_label = f" · {item.get('currency')}" if item.get("currency") else ""
        selected = " selected" if str(item.get("id") or "") == bank_account_id else ""
        bank_options.append(
            f"<option value='{e(item.get('id'))}'{selected}>{e(label)}{e(currency_label)}</option>"
        )

    address_rows = f"""
    <div class='grid'>
      <label>客户地址记录<select id='buyerAddressSelect'>{''.join(address_options)}</select><input type='hidden' data-k='buyer_address_id' value='{e(buyer_address_id)}'></label>
      <label>联系电话<input data-k='buyer_phone' value='{e(buyer_phone)}'></label>
      <label class='wide'>买方地址 / Buyer Address<textarea data-k='buyer_address' placeholder='从正式客户地址中选择，或手工填写'>{e(buyer_address)}</textarea></label>
    </div>"""

    seller_rows = f"""
    <div class='grid'>
      <label>卖方 / Seller<input data-k='seller' value='{e(seller)}' placeholder='公司设置中的抬头'></label>
      <label>卖方税号 / Tax ID<input data-k='seller_tax_id' value='{e(seller_tax_id)}'></label>
      <label>卖方电话<input data-k='seller_phone' value='{e(seller_phone)}'></label>
      <label>卖方邮箱<input data-k='seller_email' value='{e(seller_email)}'></label>
      <label class='wide'>卖方地址 / Seller Address<textarea data-k='seller_address' placeholder='公司设置中的正式地址'>{e(seller_address)}</textarea></label>
    </div>"""

    bank_rows = ""
    if ref.document_type != "packing_list":
        bank_rows = f"""
        <section class='section'><h3>收款账户</h3>
        <div class='grid three'>
          <label>账户选择<select id='bankAccountSelect'>{''.join(bank_options)}</select><input type='hidden' data-k='bank_account_id' value='{e(bank_account_id)}'></label>
          <label>账户标签<input data-k='bank_label' value='{e(bank_label)}'></label>
          <label>收款币种<input data-k='bank_currency' value='{e(bank_currency)}'></label>
          <label>银行<input data-k='bank_name' value='{e(bank_name)}'></label>
          <label>账户名<input data-k='bank_account_name' value='{e(bank_account_name)}'></label>
          <label>账号<input data-k='bank_account_number' value='{e(bank_account_number)}'></label>
          <label>SWIFT<input data-k='bank_swift' value='{e(bank_swift)}'></label>
          <label class='wide'>银行地址<textarea data-k='bank_address'>{e(bank_address)}</textarea></label>
        </div><p class='note'>收款账户来自公司设置；保存后写入当前单据快照，后续改公司设置不会篡改这份已保存单据。</p></section>"""

    packing_rows = ""
    if ref.document_type == "packing_list":
        packing_rows = f"""
        <div class='grid three'>
          <label>包装件数<input data-k='packages' value='{e(pick("packages"))}' placeholder='例如 20 cartons'></label>
          <label>净重<input data-k='net_weight' value='{e(pick("net_weight"))}' placeholder='例如 480 kg'></label>
          <label>毛重<input data-k='gross_weight' value='{e(pick("gross_weight"))}' placeholder='例如 520 kg'></label>
          <label>外箱尺寸<input data-k='carton_size' value='{e(pick("carton_size", packing))}' placeholder='L × W × H'></label>
          <label>总体积<input data-k='volume' value='{e(pick("volume"))}' placeholder='例如 1.8 CBM'></label>
          <label>唛头<input data-k='marks' value='{e(pick("marks"))}' placeholder='Shipping marks'></label>
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
          <label>单价<input data-k='unit_price' value='{e(unit_price)}' placeholder='请人工确认'></label>
          <label>总金额<input data-k='total' value='{e(total)}' placeholder='请人工确认'></label>
          <label>贸易条款<input data-k='incoterm' value='{e(incoterm)}' placeholder='例如 FOB Ningbo'></label>
          <label>交期<input data-k='lead_time' value='{e(lead_time)}' placeholder='例如 20 days'></label>
          <label>付款条件<input data-k='payment' value='{e(payment)}' placeholder='例如 T/T 30% deposit'></label>
        </div>{reference_price_note}"""

    server_saved = "true" if saved_fields else "false"
    address_json = json.dumps(addresses, ensure_ascii=False).replace("</", "<\\/")
    bank_json = json.dumps(banks, ensure_ascii=False).replace("</", "<\\/")
    return f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{e(doc_name)} · HUIDI Online</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#eef2f7;color:#172033;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.top{{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;padding:10px 18px;background:#101828;color:#fff}}.top b{{margin-right:auto}}button{{border:0;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}}.primary{{background:#2563eb;color:#fff}}#saveState{{font-size:11px;color:#cbd5e1;min-width:70px}}.paper{{width:min(1000px,calc(100% - 32px));margin:22px auto;background:#fff;min-height:1240px;padding:46px 52px;box-shadow:0 12px 40px rgba(15,23,42,.13)}}h1{{text-align:center;margin:0;font-size:28px;letter-spacing:2px}}h3{{margin:0 0 10px;font-size:14px}}.docno{{text-align:center;color:#667085;margin:5px 0 18px}}.ctx{{margin:8px 0;padding:9px 11px;border-radius:8px;background:#f8fafc;border:1px solid #e4e7ec;color:#475467;font-size:11px}}.ctx.ok{{background:#f0fdf4;border-color:#bbf7d0;color:#166534}}.ctx.warn{{background:#fff8e8;border-color:#f1dba8;color:#755b20}}.ctx span{{display:inline-block;margin-right:6px}}.section{{margin:18px 0;padding:14px;border:1px solid #e4e7ec;border-radius:10px;background:#fcfdff}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}}.grid.three{{grid-template-columns:repeat(3,minmax(0,1fr))}}.wide{{grid-column:1/-1}}label{{font-size:11px;color:#667085;font-weight:700}}input,textarea,select{{display:block;width:100%;margin-top:4px;border:1px solid #d0d5dd;border-radius:7px;padding:8px 9px;font:inherit;color:#101828;background:#fff}}textarea{{min-height:72px;resize:vertical}}table{{width:100%;border-collapse:collapse;margin:18px 0}}th,td{{border:1px solid #98a2b3;padding:9px;text-align:left}}th{{background:#f8fafc}}.note{{font-size:11px;color:#667085}}.refprice{{margin:-4px 0 12px;padding:8px 10px;border-radius:8px;background:#fff8e8;border:1px solid #f1dba8;color:#755b20;font-size:11px}}.foot{{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:46px}}.sign{{border-top:1px solid #98a2b3;padding-top:10px}}@media(max-width:760px){{.paper{{padding:24px 18px}}.grid,.grid.three,.foot{{grid-template-columns:1fr}}.wide{{grid-column:auto}}}}@media print{{body{{background:#fff}}.top,.ctx,select{{display:none}}.paper{{width:100%;margin:0;box-shadow:none;min-height:auto;padding:18mm 16mm}}input,textarea{{border:0;padding:0}}}}
</style></head><body>
<div class='top'><b>HUIDI Online · {e(doc_name)}</b><span id='saveState'></span><button id='back'>返回工作台</button><button id='save'>保存草稿</button><button id='download'>下载 HTML</button><button class='primary' onclick='window.print()'>打印 / 另存 PDF</button></div>
<main class='paper'><h1>{e(doc_name)}</h1><div class='docno'>{e(ref.document_id)}</div>
{context_summary}{inherited_note}{price_reference_panel}
<section class='section'><h3>交易双方</h3>{seller_rows}<div class='grid'><label>买方 / Buyer<input data-k='buyer' value='{e(buyer)}'></label><label>联系人<input data-k='contact' value='{e(contact)}'></label><label>邮箱<input data-k='email' value='{e(email)}'></label><label>国家 / 地区<input data-k='country' value='{e(country)}'></label><label>日期<input data-k='date' type='date' value='{e(date_value)}'></label></div>{address_rows}</section>
<table><thead><tr><th style='width:22%'>产品</th><th style='width:16%'>型号 / SKU</th><th>规格 / 描述</th></tr></thead><tbody><tr><td><input data-k='product' value='{e(product_name)}'></td><td><input data-k='sku' value='{e(sku)}'></td><td><textarea data-k='spec'>{e(spec)}</textarea></td></tr></tbody></table>
{commercial_rows}{packing_rows}
<div class='grid'><label>MOQ<input data-k='moq' value='{e(moq)}'></label><label>币种<input data-k='currency' value='{e(currency)}'></label></div>
{bank_rows}
<label>客户需求 / 备注<textarea data-k='requirements'>{e(requirements)}</textarea></label>
<label>补充条款<textarea data-k='terms' placeholder='只填写双方已经确认的正式条款；未确认内容请留空。'>{e(terms)}</textarea></label>
<p class='note'>HUIDI 自动带入当前 Deal 已有客户、产品、询盘事实、正式客户地址、公司资料和上游已保存的非价格字段。产品参考价、历史业务金额、上游价格与联网资料只作为参考；正式单价仍由你人工确认，保存草稿也不会改写 deal.amount。</p>
<div class='foot'><div class='sign'>Seller Signature / Stamp</div><div class='sign'>Buyer Confirmation</div></div></main>
<script>
(()=>{{const key='huidi-native-doc-{ref.id}';const fields=[...document.querySelectorAll('[data-k]')];const state=document.querySelector('#saveState');const serverSaved={server_saved};const addresses={address_json};const banks={bank_json};const today=new Date().toISOString().slice(0,10);const date=document.querySelector('[data-k="date"]');if(date&&!date.value)date.value=today;if(!serverSaved){{try{{const local=JSON.parse(localStorage.getItem(key)||'{{}}');fields.forEach(el=>{{if(Object.prototype.hasOwnProperty.call(local,el.dataset.k))el.value=local[el.dataset.k]}})}}catch(_){{}}}}function field(k){{return document.querySelector(`[data-k="${{k}}"]`)}}function set(k,v){{const el=field(k);if(el)el.value=v??''}}function data(){{return Object.fromEntries(fields.map(el=>[el.dataset.k,el.value]))}}const addressSelect=document.querySelector('#buyerAddressSelect');if(addressSelect){{const current=field('buyer_address_id')?.value||'';if(current)addressSelect.value=current;addressSelect.onchange=()=>{{const row=addresses.find(x=>String(x.id)===addressSelect.value);set('buyer_address_id',row?.id||'');if(row){{set('buyer_address',row.formatted||'');if(row.phone)set('buyer_phone',row.phone);if(row.country)set('country',row.country)}}}}}}const bankSelect=document.querySelector('#bankAccountSelect');if(bankSelect){{const current=field('bank_account_id')?.value||'';if(current)bankSelect.value=current;bankSelect.onchange=()=>{{const row=banks.find(x=>String(x.id)===bankSelect.value);set('bank_account_id',row?.id||'');if(row){{set('bank_label',row.label||'');set('bank_name',row.bank_name||'');set('bank_account_name',row.account_name||'');set('bank_account_number',row.account_number||'');set('bank_swift',row.swift_code||'');set('bank_address',row.bank_address||'');set('bank_currency',row.currency||'')}}}}}}async function persist(){{const payload=data();try{{localStorage.setItem(key,JSON.stringify(payload))}}catch(_){{}}state.textContent='保存中…';try{{const response=await fetch('/api/business/documents/{ref.id}/draft',{{method:'PUT',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{fields:payload}})}});if(!response.ok)throw new Error('HTTP '+response.status);state.textContent='已保存';return true}}catch(err){{state.textContent='仅本机备份';return false}}}}document.querySelector('#save').onclick=async()=>{{const ok=await persist();alert(ok?'草稿已保存到联网版':'服务器保存失败，已保留这台电脑的本地备份')}};document.querySelector('#download').onclick=async()=>{{await persist();const blob=new Blob([document.documentElement.outerHTML],{{type:'text/html;charset=utf-8'}});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='{e(ref.document_id)}.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}};document.querySelector('#back').onclick=()=>{{if(history.length>1)history.back();else location.href='/'}}}})();
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
    context = build_document_context(db, deal, ref.document_type, current_ref_id=ref.id)
    saved_fields = load_document_fields(db, ref.id)
    return HTMLResponse(
        _document_html(ref, deal, customer, product, payload, context, saved_fields),
        headers={"Cache-Control": "no-store"},
    )


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
