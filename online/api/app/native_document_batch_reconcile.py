from __future__ import annotations

import html
from types import ModuleType
from typing import Any, Callable

from . import document_context


RECONCILE_MARKER = "huidi-native-document-batch-reconcile-v1"
BATCH_RECONCILE_FIELD = "_huidi_batch_reconcile"
BATCH_RECONCILE_SCHEMA = "huidi.document.batch-reconcile/v1"

# This is review metadata on the current OnlineDocumentRef only. It is added
# after INHERITABLE_FIELDS was constructed, so it can be saved by the existing
# draft owner but never becomes an automatic downstream business fact.
document_context.DRAFT_FIELDS.add(BATCH_RECONCILE_FIELD)
document_context.LONG_FIELDS.add(BATCH_RECONCILE_FIELD)

_RECONCILE_STYLE = """
.hnd-batch-reconcile{margin:0 0 8px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-batch-reconcile>summary{cursor:pointer;padding:7px 9px;color:#344054;font-size:12px;font-weight:700;list-style:none}.hnd-batch-reconcile>summary::-webkit-details-marker{display:none}.hnd-batch-reconcile>summary:after{content:'⌄';float:right;color:#98a2b3}.hnd-batch-reconcile[open]>summary:after{content:'⌃'}.hnd-batch-reconcile-body{padding:0 9px 9px}.hnd-batch-reconcile-summary{color:#667085;font-size:11px}.hnd-batch-reconcile-groups{display:grid;gap:7px;margin-top:7px}.hnd-batch-reconcile-card{padding:8px 9px;border:1px solid #e4e7ec;border-radius:7px;background:#f8fafc}.hnd-batch-reconcile-card[data-state='ok']{border-color:#86efac;background:#f0fdf4}.hnd-batch-reconcile-card[data-state='warn']{border-color:#fedf89;background:#fffaeb}.hnd-batch-reconcile-card[data-state='bad']{border-color:#fda29b;background:#fff5f5}.hnd-batch-reconcile-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hnd-batch-reconcile-head b{color:#344054}.hnd-batch-reconcile-head small{color:#667085}.hnd-batch-reconcile-target{display:flex;gap:6px;align-items:center;margin-left:auto;color:#667085;font-size:10px}.hnd-batch-reconcile-target input{width:108px;height:28px;margin:0;padding:4px 6px;font-size:11px}.hnd-batch-reconcile-metrics{margin-top:5px;color:#475467;font-size:10px;line-height:1.55}.hnd-batch-reconcile-metrics strong{color:#344054}.hnd-batch-reconcile-ok{color:#166534}.hnd-batch-reconcile-warn{color:#a15c00}.hnd-batch-reconcile-bad{color:#b42318}.hnd-batch-timeline{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:6px}.hnd-batch-timeline span{padding:3px 6px;border:1px solid #d0d5dd;border-radius:999px;background:#fff;color:#475467;font-size:10px}.hnd-batch-timeline i{color:#98a2b3;font-style:normal;font-size:10px}.hnd-batch-packing-check{margin-top:6px;color:#667085;font-size:10px}.hnd-batch-reconcile-note{display:block;margin-top:6px;color:#667085;font-size:10px}
@media print{.hnd-batch-reconcile{display:none!important}}
"""

_RECONCILE_PANEL = """
<details class='hnd-batch-reconcile' data-hnd-batch-reconcile>
  <summary>批次总量 / 交期 / 装箱核对</summary>
  <div class='hnd-batch-reconcile-body'>
    <div class='hnd-batch-reconcile-summary' data-hnd-batch-reconcile-summary>读取当前批次行进行核对；不会修改任何业务字段。</div>
    <div class='hnd-batch-reconcile-groups' data-hnd-batch-reconcile-groups></div>
    <small class='hnd-batch-reconcile-note'>第一次从单行人工拆批时，会在数量可安全识别的情况下记录“拆批前总量基准”。也可人工修改总量基准；核对结果只读，不自动分配数量、箱数、重量、CBM 或交期。</small>
  </div>
</details>
"""

_RECONCILE_SCRIPT = r"""
<script id='huidi-native-document-batch-reconcile-v1'>
(()=>{
  const panel=document.querySelector('[data-hnd-batch-reconcile]');
  const groupsBox=panel?.querySelector('[data-hnd-batch-reconcile-groups]');
  const summary=panel?.querySelector('[data-hnd-batch-reconcile-summary]');
  const table=document.querySelector('.item-table');
  const sourceSelect=document.querySelector('[data-hnd-batch-source]');
  const splitButton=document.querySelector('[data-hnd-batch-split]');
  const stateField=document.querySelector('[data-k="_huidi_batch_reconcile"]');
  if(!panel||!groupsBox||!table||!sourceSelect||!splitButton||!stateField)return;
  const packing=table.classList.contains('packing');
  const rows=()=>[...document.querySelectorAll('[data-item-row]')];
  const field=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const value=(row,key)=>String(field(row,key)?.value||'').trim();
  const norm=v=>String(v||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let saved={schema:'huidi.document.batch-reconcile/v1',targets:{}};
  try{
    const parsed=JSON.parse(String(stateField.value||'{}'));
    if(parsed&&typeof parsed==='object'&&parsed.targets&&typeof parsed.targets==='object')saved={schema:'huidi.document.batch-reconcile/v1',targets:parsed.targets};
  }catch(_){saved={schema:'huidi.document.batch-reconcile/v1',targets:{}};}

  function safeNumber(raw,kind='number'){
    let text=String(raw||'').trim().replace(/[，]/g,',').replace(/[．]/g,'.').replace(/\s+/g,'');
    if(!text)return null;
    if(kind==='quantity')text=text.replace(/(?:pcs?|pieces?|sets?|units?|件|套)$/i,'');
    if(kind==='packages')text=text.replace(/(?:cartons?|ctns?|boxes?|packages?|箱|件)$/i,'');
    if(kind==='weight'){
      if(/(?:kg|kgs|公斤|千克)$/i.test(text))text=text.replace(/(?:kg|kgs|公斤|千克)$/i,'');
      else if(/[a-zA-Z一-鿿]+$/.test(text))return null;
    }
    if(kind==='volume'){
      if(/(?:cbm|m3|m³|立方米)$/i.test(text))text=text.replace(/(?:cbm|m3|m³|立方米)$/i,'');
      else if(/[a-zA-Z一-鿿]+$/.test(text))return null;
    }
    if(/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))text=text.replace(/,/g,'');
    else if(text.includes(','))return null;
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(text))return null;
    const number=Number(text);
    return Number.isFinite(number)?number:null;
  }
  function identity(row){
    const sku=norm(value(row,'sku'));
    const product=norm(value(row,'product'));
    const owner=String(row.dataset.productId||row.dataset.brainId||'').trim();
    if(sku)return `sku|${sku}|${owner}`;
    if(product)return `product|${product}|${owner}`;
    return '';
  }
  function labelFor(row){return value(row,'sku')||value(row,'product')||'未命名产品';}
  function duplicateGroups(){
    const map=new Map();
    rows().forEach(row=>{
      const key=identity(row);
      if(!key)return;
      const list=map.get(key)||[];list.push(row);map.set(key,list);
    });
    return [...map.entries()].filter(([,list])=>list.length>1).map(([key,list])=>({key,label:labelFor(list[0]),rows:list}));
  }
  function writeState(){stateField.value=JSON.stringify(saved);}
  function format(value,digits=2){return Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});}
  function metricSum(group,key,kind){
    const parsed=group.rows.map(row=>safeNumber(value(row,key),kind));
    const known=parsed.filter(number=>number!==null);
    return {known:known.length,total:known.reduce((sum,number)=>sum+number,0),missing:parsed.length-known.length};
  }
  function targetFor(group){
    const raw=String(saved.targets[group.key]?.quantity??'').trim();
    return {raw,number:safeNumber(raw,'quantity')};
  }
  function captureSplitBaseline(event){
    const list=rows();
    const source=list[Number(sourceSelect.value)||0];
    if(!source)return;
    if(source.dataset.hndUnsavedBatch==='1'){
      event.preventDefault();event.stopImmediatePropagation();
      if(summary)summary.textContent='尚未保存的新批次不能继续复制；请先保存草稿或撤销新批次。';
      return;
    }
    const key=identity(source);
    if(!key||saved.targets[key])return;
    const quantity=value(source,'quantity');
    const number=safeNumber(quantity,'quantity');
    saved.targets[key]={quantity:number===null?'':quantity,source:number===null?'manual_required':'pre_split',label:labelFor(source)};
    writeState();
  }
  function updateSplitAvailability(){
    const source=rows()[Number(sourceSelect.value)||0];
    const unsaved=source?.dataset?.hndUnsavedBatch==='1';
    splitButton.disabled=Boolean(unsaved);
    if(unsaved)splitButton.title='新复制但未保存的批次不能继续递归拆分';
    else splitButton.removeAttribute('title');
  }
  function timeline(group){
    if(packing)return '';
    const items=group.rows.map((row,index)=>{
      const qty=value(row,'quantity')||'数量未填';
      const date=value(row,'lead_time')||'交期未填';
      return `<span>批次 ${index+1} · ${esc(qty)} · ${esc(date)}</span>`;
    });
    return `<div class='hnd-batch-timeline'>${items.map((item,index)=>`${index?'<i>→</i>':''}${item}`).join('')}</div>`;
  }
  function packingCheck(group){
    if(!packing)return '';
    const packages=metricSum(group,'packages','packages');
    const net=metricSum(group,'net_weight','weight');
    const gross=metricSum(group,'gross_weight','weight');
    const volume=metricSum(group,'volume','volume');
    const badWeight=[];
    group.rows.forEach((row,index)=>{
      const n=safeNumber(value(row,'net_weight'),'weight'),g=safeNumber(value(row,'gross_weight'),'weight');
      if(n!==null&&g!==null&&g<n)badWeight.push(`批次 ${index+1} 毛重小于净重`);
    });
    const parts=[
      `箱/包装件数 ${packages.known?format(packages.total):'—'}${packages.missing?`（${packages.missing} 批未安全识别）`:''}`,
      `净重 ${net.known?format(net.total):'—'} kg${net.missing?`（${net.missing} 批未安全识别）`:''}`,
      `毛重 ${gross.known?format(gross.total):'—'} kg${gross.missing?`（${gross.missing} 批未安全识别）`:''}`,
      `体积 ${volume.known?format(volume.total,4):'—'} CBM${volume.missing?`（${volume.missing} 批未安全识别）`:''}`,
    ];
    return `<div class='hnd-batch-packing-check'><strong>分批装箱汇总：</strong>${esc(parts.join(' · '))}${badWeight.length?`<br><span class='hnd-batch-reconcile-bad'>${esc(badWeight.join('；'))}</span>`:''}</div>`;
  }
  function render(){
    updateSplitAvailability();
    const groups=duplicateGroups();
    const active=new Set(groups.map(group=>group.key));
    Object.keys(saved.targets||{}).forEach(key=>{if(!active.has(key))delete saved.targets[key];});
    writeState();
    if(!groups.length){
      groupsBox.innerHTML="<div class='hnd-batch-reconcile-card'><small>当前没有需要做批次总量核对的重复 SKU / 产品行。</small></div>";
      if(summary)summary.textContent='当前没有批次组；人工拆批后会在这里核对总量、交期和装箱。';
      return;
    }
    let ok=0,warn=0,bad=0;
    groupsBox.innerHTML=groups.map(group=>{
      const quantity=metricSum(group,'quantity','quantity');
      const target=targetFor(group);
      let state='warn',statusText='缺少总量基准，需人工填写';
      if(target.number!==null&&quantity.known===group.rows.length){
        const tolerance=Math.max(0.000001,Math.abs(target.number)*0.000001);
        const diff=quantity.total-target.number;
        if(Math.abs(diff)<=tolerance){state='ok';statusText=`一致：各批数量合计 ${format(quantity.total)} = 总量基准 ${format(target.number)}`;ok+=1;}
        else{state='bad';statusText=`差异：各批数量合计 ${format(quantity.total)}，总量基准 ${format(target.number)}，相差 ${format(diff)}`;bad+=1;}
      }else{
        warn+=1;
        if(target.number!==null&&quantity.missing)statusText=`待核对：${quantity.missing} 个批次数量未安全识别；当前可合计 ${format(quantity.total)}`;
      }
      const sourceText=saved.targets[group.key]?.source==='pre_split'?'拆批前自动记录':'人工基准';
      return `<div class='hnd-batch-reconcile-card' data-reconcile-key='${esc(group.key)}' data-state='${state}'>
        <div class='hnd-batch-reconcile-head'><b>${esc(group.label)} × ${group.rows.length} 批</b><small class='${state==='ok'?'hnd-batch-reconcile-ok':state==='bad'?'hnd-batch-reconcile-bad':'hnd-batch-reconcile-warn'}'>${esc(statusText)}</small><label class='hnd-batch-reconcile-target'>总量基准 <input data-hnd-batch-target value='${esc(target.raw)}' placeholder='例如 1000'><em>${esc(sourceText)}</em></label></div>
        <div class='hnd-batch-reconcile-metrics'><strong>数量核对：</strong>已安全识别 ${quantity.known}/${group.rows.length} 批 · 当前合计 ${quantity.known?format(quantity.total):'—'}${quantity.missing?` · ${quantity.missing} 批待核对`:''}</div>
        ${timeline(group)}${packingCheck(group)}
      </div>`;
    }).join('');
    if(summary)summary.textContent=`批次组 ${groups.length} · 总量一致 ${ok} · 待核对 ${warn} · 总量差异 ${bad}。结果只读，不会改产品行。`;
  }
  splitButton.addEventListener('click',captureSplitBaseline,true);
  splitButton.addEventListener('click',()=>queueMicrotask(render));
  sourceSelect.addEventListener('change',updateSplitAvailability);
  groupsBox.addEventListener('input',event=>{
    const input=event.target?.closest?.('[data-hnd-batch-target]');
    if(!input)return;
    const card=input.closest('[data-reconcile-key]');
    const key=String(card?.dataset.reconcileKey||'');
    if(!key)return;
    const current=saved.targets[key]||{};
    current.quantity=String(input.value||'').slice(0,120);current.source='manual';
    saved.targets[key]=current;writeState();queueMicrotask(render);
  });
  table.addEventListener('input',()=>queueMicrotask(render));
  table.addEventListener('change',()=>queueMicrotask(render));
  table.addEventListener('click',event=>{if(event.target?.closest?.('[data-hnd-batch-remove-new]'))queueMicrotask(render);});
  render();
})();
</script>
"""


def decorate_native_document_batch_reconcile(page: str, saved_reconcile_json: str = "") -> str:
    """Add current-document batch quantity/timeline/packing reconciliation.

    The layer stores only a non-inheritable quantity baseline on the same draft.
    It never distributes quantities, changes rows, computes formal prices, or
    owns a new API/table/document path.
    """
    text = str(page or "")
    if RECONCILE_MARKER in text or "data-hnd-batch-confirm" not in text or "data-item-row" not in text:
        return text
    escaped_state = html.escape(str(saved_reconcile_json or ""), quote=True)
    hidden = f"<input type='hidden' data-k='{BATCH_RECONCILE_FIELD}' value='{escaped_state}'>"
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", hidden + _RECONCILE_PANEL + "<div class='table-wrap'>", 1)
    if "</style>" in text:
        text = text.replace("</style>", _RECONCILE_STYLE + "</style>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _RECONCILE_SCRIPT + "</body>", 1)
    return text


def install_native_document_batch_reconcile(standalone_module: ModuleType) -> None:
    """Decorate the manually batch-confirmed renderer exactly once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_batch_reconcile", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        saved_fields = kwargs.get("saved_fields")
        if not isinstance(saved_fields, dict) and len(args) >= 7 and isinstance(args[6], dict):
            saved_fields = args[6]
        reconcile_json = str((saved_fields or {}).get(BATCH_RECONCILE_FIELD) or "")
        return decorate_native_document_batch_reconcile(original(*args, **kwargs), reconcile_json)

    setattr(wrapped, "_huidi_native_batch_reconcile", True)
    setattr(wrapped, "_huidi_native_batch_reconcile_original", original)
    standalone_module._document_html = wrapped
