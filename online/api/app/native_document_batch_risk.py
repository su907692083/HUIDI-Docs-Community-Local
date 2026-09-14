from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


RISK_MARKER = "huidi-native-document-batch-risk-v1"

_RISK_STYLE = """
.hnd-batch-risk{margin:0 0 8px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-batch-risk>summary{cursor:pointer;padding:7px 9px;color:#344054;font-size:12px;font-weight:700;list-style:none}.hnd-batch-risk>summary::-webkit-details-marker{display:none}.hnd-batch-risk>summary:after{content:'⌄';float:right;color:#98a2b3}.hnd-batch-risk[open]>summary:after{content:'⌃'}.hnd-batch-risk-body{padding:0 9px 9px}.hnd-batch-risk-summary{font-size:11px;color:#667085}.hnd-batch-risk-groups{display:grid;gap:7px;margin-top:7px}.hnd-batch-risk-card{padding:8px 9px;border:1px solid #e4e7ec;border-radius:7px;background:#f8fafc;font-size:10px;color:#475467;line-height:1.55}.hnd-batch-risk-card[data-level='ok']{border-color:#86efac;background:#f0fdf4}.hnd-batch-risk-card[data-level='warn']{border-color:#fedf89;background:#fffaeb}.hnd-batch-risk-card[data-level='bad']{border-color:#fda29b;background:#fff5f5}.hnd-batch-risk-head{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.hnd-batch-risk-head b{color:#344054}.hnd-batch-risk-ok{color:#166534}.hnd-batch-risk-warn{color:#a15c00}.hnd-batch-risk-bad{color:#b42318}.hnd-batch-risk-lines{display:grid;gap:3px;margin-top:5px}.hnd-batch-risk-line{padding:3px 6px;border-radius:5px;background:rgba(255,255,255,.72)}.hnd-batch-risk-note{display:block;margin-top:6px;color:#667085;font-size:10px}
@media print{.hnd-batch-risk{display:none!important}}
"""

_RISK_PANEL = """
<details class='hnd-batch-risk' data-hnd-batch-risk>
  <summary>批次交期风险 / Packing 缺项核对</summary>
  <div class='hnd-batch-risk-body'>
    <div class='hnd-batch-risk-summary' data-hnd-batch-risk-summary>只读取当前正式行，提示交期和装箱缺项；不会修改任何业务字段。</div>
    <div class='hnd-batch-risk-groups' data-hnd-batch-risk-groups></div>
    <small class='hnd-batch-risk-note'>逾期/临近只在交期可安全识别为明确日历日期时提示；无法识别的日期保持“需核对”。Packing 缺项仅提示，不阻塞保存，也不会自动补数量、箱数、重量、箱规、CBM 或唛头。</small>
  </div>
</details>
"""

_RISK_SCRIPT = r"""
<script id='huidi-native-document-batch-risk-v1'>
(()=>{
  const panel=document.querySelector('[data-hnd-batch-risk]');
  const summary=panel?.querySelector('[data-hnd-batch-risk-summary]');
  const box=panel?.querySelector('[data-hnd-batch-risk-groups]');
  const table=document.querySelector('.item-table');
  if(!panel||!summary||!box||!table)return;
  const packing=table.classList.contains('packing');
  const rows=()=>[...document.querySelectorAll('[data-item-row]')];
  const field=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const value=(row,key)=>String(field(row,key)?.value||'').trim();
  const topValue=key=>String(document.querySelector(`[data-k="${key}"]`)?.value||'').trim();
  const norm=v=>String(v||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels={quantity:'数量',packages:'箱/包装件数',net_weight:'净重',gross_weight:'毛重',carton_size:'外箱尺寸',volume:'体积'};
  const today=(()=>{const now=new Date();return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());})();

  function identity(row){
    const sku=norm(value(row,'sku')),product=norm(value(row,'product'));
    const owner=String(row.dataset.productId||row.dataset.brainId||'').trim();
    if(sku)return `sku|${sku}|${owner}`;
    if(product)return `product|${product}|${owner}`;
    return '';
  }
  function rowLabel(row,index){return value(row,'sku')||value(row,'product')||`第 ${index+1} 行`;}
  function duplicateGroups(){
    const map=new Map();
    rows().forEach((row,index)=>{
      const key=identity(row);if(!key)return;
      const list=map.get(key)||[];list.push({row,index});map.set(key,list);
    });
    return [...map.entries()].filter(([,list])=>list.length>1).map(([key,list])=>({key,label:rowLabel(list[0].row,list[0].index),list}));
  }
  function safeDate(raw){
    const text=String(raw||'').trim();
    if(!text)return null;
    let match=text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if(!match)match=text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(year<2000||year>2200||month<1||month>12||day<1||day>31)return null;
    const stamp=Date.UTC(year,month-1,day),date=new Date(stamp);
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
    return stamp;
  }
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
    const number=Number(text);return Number.isFinite(number)?number:null;
  }
  function format(number,digits=2){return Number(number).toLocaleString(undefined,{maximumFractionDigits:digits});}
  function deliveryRisk(group){
    let bad=0,warn=0;
    const stamps=[];
    const lines=group.list.map(({row,index})=>{
      const raw=value(row,'lead_time'),stamp=safeDate(raw);
      if(!raw){warn+=1;stamps.push(null);return `<div class='hnd-batch-risk-line hnd-batch-risk-warn'>批次 ${index+1} · ${esc(rowLabel(row,index))}：交期未填</div>`;}
      if(stamp===null){warn+=1;stamps.push(null);return `<div class='hnd-batch-risk-line hnd-batch-risk-warn'>批次 ${index+1} · ${esc(rowLabel(row,index))}：日期格式未安全识别（${esc(raw)}）</div>`;}
      stamps.push(stamp);
      const days=Math.round((stamp-today)/86400000);
      if(days<0){bad+=1;return `<div class='hnd-batch-risk-line hnd-batch-risk-bad'>批次 ${index+1} · ${esc(rowLabel(row,index))}：交期 ${esc(raw)} 已早于今天 ${Math.abs(days)} 天</div>`;}
      if(days===0){warn+=1;return `<div class='hnd-batch-risk-line hnd-batch-risk-warn'>批次 ${index+1} · ${esc(rowLabel(row,index))}：交期就是今天</div>`;}
      if(days<=7){warn+=1;return `<div class='hnd-batch-risk-line hnd-batch-risk-warn'>批次 ${index+1} · ${esc(rowLabel(row,index))}：交期 ${esc(raw)}，7 天内到期</div>`;}
      return `<div class='hnd-batch-risk-line hnd-batch-risk-ok'>批次 ${index+1} · ${esc(rowLabel(row,index))}：交期 ${esc(raw)}</div>`;
    });
    for(let i=1;i<stamps.length;i+=1){
      if(stamps[i]!==null&&stamps[i-1]!==null&&stamps[i]<stamps[i-1]){warn+=1;lines.push(`<div class='hnd-batch-risk-line hnd-batch-risk-warn'>交期顺序与当前批次行次序不一致：后一个批次日期早于前一批，请人工确认行次序或交期。</div>`);}
    }
    return {bad,warn,html:lines.join('')};
  }
  function packingTotals(){
    const specs=[['packages','packages','箱/包装件数'],['net_weight','weight','净重'],['gross_weight','weight','毛重'],['volume','volume','体积']];
    const lines=[];let bad=0,warn=0;
    specs.forEach(([key,kind,label])=>{
      const targetRaw=topValue(key);if(!targetRaw)return;
      const target=safeNumber(targetRaw,kind);
      const parsed=rows().map(row=>safeNumber(value(row,key),kind));
      const known=parsed.filter(number=>number!==null);
      if(target===null){warn+=1;lines.push(`<div class='hnd-batch-risk-line hnd-batch-risk-warn'>整票${label}“${esc(targetRaw)}”未安全识别，暂不对账。</div>`);return;}
      if(known.length!==rows().length){warn+=1;lines.push(`<div class='hnd-batch-risk-line hnd-batch-risk-warn'>整票${label} ${format(target)}；有 ${rows().length-known.length} 行未安全识别，暂不能与分批合计确认一致。</div>`);return;}
      const sum=known.reduce((total,number)=>total+number,0),tolerance=Math.max(.000001,Math.abs(target)*.000001),diff=sum-target;
      if(Math.abs(diff)<=tolerance)lines.push(`<div class='hnd-batch-risk-line hnd-batch-risk-ok'>整票${label} ${format(target,kind==='volume'?4:2)} = 分批合计 ${format(sum,kind==='volume'?4:2)}</div>`);
      else{bad+=1;lines.push(`<div class='hnd-batch-risk-line hnd-batch-risk-bad'>整票${label} ${format(target,kind==='volume'?4:2)}，分批合计 ${format(sum,kind==='volume'?4:2)}，相差 ${format(diff,kind==='volume'?4:2)}</div>`);}
    });
    return {bad,warn,html:lines.join('')};
  }
  function packingRows(){
    const required=['quantity','packages','net_weight','gross_weight','carton_size','volume'];
    let missing=0;
    const cards=rows().map((row,index)=>{
      const absent=required.filter(key=>!value(row,key));
      missing+=absent.length;
      const level=absent.length?'warn':'ok';
      return `<div class='hnd-batch-risk-card' data-level='${level}'><div class='hnd-batch-risk-head'><b>第 ${index+1} 行 · ${esc(rowLabel(row,index))}</b><span class='${absent.length?'hnd-batch-risk-warn':'hnd-batch-risk-ok'}'>${absent.length?`缺 ${absent.length} 项关键装箱字段`:'关键装箱字段已填'}</span></div><div class='hnd-batch-risk-lines'><div class='hnd-batch-risk-line'>${absent.length?`待补：${esc(absent.map(key=>labels[key]).join('、'))}`:'数量、箱数、净重、毛重、外箱尺寸、体积均已有值'}；唛头/备注保持可选，不作为缺项。</div></div></div>`;
    }).join('');
    const totals=packingTotals();
    const totalCard=totals.html?`<div class='hnd-batch-risk-card' data-level='${totals.bad?'bad':totals.warn?'warn':'ok'}'><div class='hnd-batch-risk-head'><b>整票合计 vs 分批合计</b></div><div class='hnd-batch-risk-lines'>${totals.html}</div></div>`:'';
    return {missing,bad:totals.bad,warn:totals.warn,html:cards+totalCard};
  }
  function render(){
    if(packing){
      const result=packingRows();box.innerHTML=result.html||"<div class='hnd-batch-risk-card'><small>当前没有产品行。</small></div>";
      summary.textContent=`Packing 行 ${rows().length} · 关键缺项 ${result.missing} · 整票对账差异 ${result.bad} · 待核对 ${result.warn}。只提示，不自动补值。`;
      return;
    }
    const groups=duplicateGroups();
    if(!groups.length){box.innerHTML="<div class='hnd-batch-risk-card'><small>当前没有同产品多批次组。</small></div>";summary.textContent='当前没有需要做批次交期风险核对的重复 SKU / 产品行。';return;}
    let bad=0,warn=0;
    box.innerHTML=groups.map(group=>{
      const result=deliveryRisk(group);bad+=result.bad;warn+=result.warn;
      const level=result.bad?'bad':result.warn?'warn':'ok';
      return `<div class='hnd-batch-risk-card' data-level='${level}'><div class='hnd-batch-risk-head'><b>${esc(group.label)} × ${group.list.length} 批</b><span class='${result.bad?'hnd-batch-risk-bad':result.warn?'hnd-batch-risk-warn':'hnd-batch-risk-ok'}'>${result.bad?`${result.bad} 个逾期提示`:result.warn?`${result.warn} 个需核对`:'交期未见明显风险'}</span></div><div class='hnd-batch-risk-lines'>${result.html}</div></div>`;
    }).join('');
    summary.textContent=`批次组 ${groups.length} · 逾期提示 ${bad} · 临近/格式/顺序需核对 ${warn}。日期风险只读，不改变单据状态。`;
  }
  table.addEventListener('input',()=>queueMicrotask(render));
  table.addEventListener('change',()=>queueMicrotask(render));
  if(packing){
    document.addEventListener('input',event=>{if(event.target?.matches?.('[data-k="packages"],[data-k="net_weight"],[data-k="gross_weight"],[data-k="volume"]'))queueMicrotask(render);});
    document.addEventListener('change',event=>{if(event.target?.matches?.('[data-k="packages"],[data-k="net_weight"],[data-k="gross_weight"],[data-k="volume"]'))queueMicrotask(render);});
  }
  render();
})();
</script>
"""


def decorate_native_document_batch_risk(page: str) -> str:
    """Add read-only delivery-risk and Packing completeness review.

    This seventh bounded layer reads only the already-rendered formal rows and
    optional whole-shipment Packing totals. It does not persist, mutate rows,
    infer dates, allocate quantities, or create a second owner/API.
    """
    text = str(page or "")
    if RISK_MARKER in text or "data-hnd-batch-reconcile" not in text or "data-item-row" not in text:
        return text
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", _RISK_PANEL + "<div class='table-wrap'>", 1)
    if "</style>" in text:
        text = text.replace("</style>", _RISK_STYLE + "</style>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _RISK_SCRIPT + "</body>", 1)
    return text


def install_native_document_batch_risk(standalone_module: ModuleType) -> None:
    """Decorate the reconciled native document renderer exactly once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_batch_risk", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_batch_risk(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_batch_risk", True)
    setattr(wrapped, "_huidi_native_batch_risk_original", original)
    standalone_module._document_html = wrapped
