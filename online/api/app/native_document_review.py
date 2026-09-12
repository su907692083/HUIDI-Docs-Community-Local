from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


REVIEW_MARKER = "huidi-native-document-review-v1"

_REVIEW_STYLE = """
.hnd-review{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px;padding:7px 9px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-review select,.hnd-review button{height:30px;margin:0;padding:4px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;font-size:12px}.hnd-review button:disabled{opacity:.45;cursor:not-allowed}.hnd-review-summary{min-width:280px;flex:1;color:#475467;font-size:11px}.hnd-review-total{width:100%;color:#667085;font-size:10px}.hnd-review-total strong{color:#344054}.item-table tr.hnd-review-hidden{display:none!important}.item-table .hnd-review-duplicate{outline:1px dashed #f79009!important;outline-offset:-1px}.item-table tr.hnd-review-duplicate-row>td:first-child{box-shadow:inset 3px 0 0 #f79009}.hnd-review-source{color:#8a6a1f}.hnd-review-danger{color:#b42318}
@media print{.hnd-review{display:none!important}.item-table .hnd-review-duplicate{outline:none!important}.item-table tr.hnd-review-duplicate-row>td:first-child{box-shadow:none!important}}
"""

_REVIEW_BAR = """
<div class='hnd-review' data-hnd-review>
  <select data-hnd-review-filter aria-label='核对筛选'>
    <option value='all'>全部核对状态</option>
    <option value='anomaly'>只看异常</option>
    <option value='duplicate'>只看重复 SKU / 产品</option>
  </select>
  <button type='button' data-hnd-review-next disabled>下一异常</button>
  <span class='hnd-review-summary' data-hnd-review-summary>正在核对产品行…</span>
  <div class='hnd-review-total' data-hnd-review-total></div>
</div>
"""

_REVIEW_SCRIPT = r"""
<script id='huidi-native-document-review-v1'>
(()=>{
  const bar=document.querySelector('[data-hnd-review]');
  const table=document.querySelector('.item-table');
  const rows=[...document.querySelectorAll('[data-item-row]')];
  if(!bar||!table||!rows.length)return;
  const filter=bar.querySelector('[data-hnd-review-filter]');
  const next=bar.querySelector('[data-hnd-review-next]');
  const summary=bar.querySelector('[data-hnd-review-summary]');
  const totalSummary=bar.querySelector('[data-hnd-review-total]');
  const gridSearch=document.querySelector('[data-hnd-grid-search]');
  const gridFilter=document.querySelector('[data-hnd-grid-filter]');
  const pasteArea=document.querySelector('[data-hnd-paste-text]');
  const field=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const textValue=(row,key)=>String(field(row,key)?.value||'').trim();
  const identity=value=>String(value||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');
  function safeNumber(raw){
    let text=String(raw||'').trim().replace(/[，]/g,',').replace(/[．]/g,'.').replace(/\s+/g,'');
    if(!text)return null;
    if(/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))text=text.replace(/,/g,'');
    else if(text.includes(','))return null;
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(text))return null;
    const number=Number(text);
    return Number.isFinite(number)?number:null;
  }
  function groupsBy(key,onlyIfMissing=false){
    const groups=new Map();
    rows.forEach(row=>{
      if(onlyIfMissing&&identity(textValue(row,'sku')))return;
      const value=identity(textValue(row,key));
      if(!value)return;
      const list=groups.get(value)||[];
      list.push(row);
      groups.set(value,list);
    });
    return [...groups.values()].filter(list=>list.length>1);
  }
  function markDuplicates(){
    rows.forEach(row=>{
      row.classList.remove('hnd-review-duplicate-row');
      ['sku','product'].forEach(key=>{
        const input=field(row,key);
        input?.classList?.remove('hnd-review-duplicate');
        if(input?.dataset?.hndReviewTitle==='1'){
          input.removeAttribute('title');
          delete input.dataset.hndReviewTitle;
        }
      });
      delete row.dataset.hndReviewDuplicate;
    });
    const skuGroups=groupsBy('sku');
    const productGroups=groupsBy('product',true);
    [...skuGroups,...productGroups].forEach(group=>{
      const key=identity(textValue(group[0],'sku'))?'sku':'product';
      const label=key==='sku'?textValue(group[0],'sku'):textValue(group[0],'product');
      group.forEach(row=>{
        row.classList.add('hnd-review-duplicate-row');
        row.dataset.hndReviewDuplicate=key;
        const input=field(row,key);
        if(input){
          input.classList.add('hnd-review-duplicate');
          input.title=`${key==='sku'?'同 SKU':'同产品'}“${label}”共 ${group.length} 行；可能是分批/拆分，请人工确认是否需要保留多行。`;
          input.dataset.hndReviewTitle='1';
        }
      });
    });
    return {skuGroups,productGroups,rows:new Set([...skuGroups.flat(),...productGroups.flat()])};
  }
  function sourceDuplicateInfo(){
    const raw=String(pasteArea?.value||'').trim();
    if(!raw)return [];
    const matrix=raw.replace(/\r\n?/g,'\n').split('\n').filter(line=>line.trim()).map(line=>line.split('\t').map(cell=>String(cell||'').trim()));
    const headerKey=value=>{
      const h=String(value||'').toLocaleLowerCase().replace(/[\s_\-\/\\.()（）\[\]{}:：]+/g,'');
      if(/(?:sku|itemno|itemnumber|货号|型号|产品编号)/.test(h))return 'sku';
      if(/(?:productname|itemname|产品名称|品名|^product$|^item$)/.test(h))return 'product';
      return '';
    };
    let headerIndex=-1,skuIndex=-1,productIndex=-1;
    for(let index=0;index<Math.min(matrix.length,5);index+=1){
      const keys=(matrix[index]||[]).map(headerKey);
      const s=keys.indexOf('sku'),p=keys.indexOf('product');
      if(s>=0||p>=0){headerIndex=index;skuIndex=s;productIndex=p;break;}
    }
    if(headerIndex<0)return [];
    const counts=new Map();
    matrix.slice(headerIndex+1).forEach(cells=>{
      const sku=skuIndex>=0?String(cells[skuIndex]||'').trim():'';
      const product=productIndex>=0?String(cells[productIndex]||'').trim():'';
      const key=identity(sku)?`SKU:${identity(sku)}`:(identity(product)?`PRODUCT:${identity(product)}`:'');
      const label=sku||product;
      if(key)counts.set(key,{label,count:(counts.get(key)?.count||0)+1,type:sku?'SKU':'产品'});
    });
    return [...counts.values()].filter(item=>item.count>1).slice(0,6);
  }
  function auditAmounts(){
    let comparable=0,expectedSum=0,actualSum=0,mismatch=0,pending=0;
    rows.forEach(row=>{
      const quantity=safeNumber(textValue(row,'quantity'));
      const price=safeNumber(textValue(row,'unit_price'));
      const actual=safeNumber(textValue(row,'total'));
      if(quantity===null||price===null)return;
      const expected=quantity*price;
      if(actual===null){pending+=1;return;}
      comparable+=1;
      expectedSum+=expected;
      actualSum+=actual;
      const tolerance=Math.max(0.01,Math.abs(expected)*0.0001);
      if(Math.abs(actual-expected)>tolerance)mismatch+=1;
    });
    return {comparable,expectedSum,actualSum,mismatch,pending,diff:actualSum-expectedSum};
  }
  function anomalyTargets(){
    const targets=[];
    rows.forEach(row=>{
      const amount=field(row,'total');
      if(amount?.classList?.contains('hnd-amount-mismatch'))targets.push({row,input:amount,type:'amount'});
      const paste=[...row.querySelectorAll('.hnd-paste-cell-warning')];
      paste.forEach(input=>targets.push({row,input,type:'paste'}));
    });
    return targets;
  }
  function applyReviewFilter(){
    const mode=String(filter?.value||'all');
    const anomalies=new Set(anomalyTargets().map(item=>item.row));
    rows.forEach(row=>{
      const duplicate=row.classList.contains('hnd-review-duplicate-row');
      const show=mode==='anomaly'?anomalies.has(row):(mode==='duplicate'?duplicate:true);
      row.classList.toggle('hnd-review-hidden',!show);
    });
  }
  function focusNextAnomaly(){
    const targets=anomalyTargets().filter(item=>!item.row.hidden&&!item.row.classList.contains('hnd-review-hidden'));
    if(!targets.length)return;
    const active=document.activeElement;
    let index=targets.findIndex(item=>item.input===active);
    index=(index+1)%targets.length;
    const target=targets[index].input;
    target?.scrollIntoView?.({block:'center',inline:'nearest'});
    target?.focus?.();
    if(typeof target?.select==='function'&&target.tagName!=='TEXTAREA')target.select();
  }
  function refresh(){
    const duplicates=markDuplicates();
    const sourceDuplicates=sourceDuplicateInfo();
    const anomalies=anomalyTargets();
    const amount=auditAmounts();
    const pasteWarnings=anomalies.filter(item=>item.type==='paste').length;
    const duplicateRows=duplicates.rows.size;
    const parts=[`异常 ${anomalies.length}`,`金额异常 ${amount.mismatch}`,`粘贴需核对 ${pasteWarnings}`,`重复行 ${duplicateRows}`];
    if(summary)summary.textContent=parts.join(' · ');
    if(next)next.disabled=anomalies.length===0;
    const amountText=amount.comparable
      ? `<strong>整表金额参考：</strong>可核对 ${amount.comparable} 行 · 数量×单价 ${amount.expectedSum.toFixed(2)} · 已填金额 ${amount.actualSum.toFixed(2)} · 差异 ${amount.diff.toFixed(2)}${amount.pending?` · 待填金额 ${amount.pending} 行`:''}`
      : `<strong>整表金额参考：</strong>当前没有同时具备数量、正式单价和金额的可核对行${amount.pending?` · 待填金额 ${amount.pending} 行`:''}`;
    const sourceText=sourceDuplicates.length
      ? ` <span class='hnd-review-source'>· 粘贴源重复：${sourceDuplicates.map(item=>`${item.type} ${item.label} ×${item.count}`).join('；')}（可能是批次/拆分，系统不自动合并）</span>`
      : '';
    if(totalSummary)totalSummary.innerHTML=amountText+sourceText;
    applyReviewFilter();
  }
  filter?.addEventListener('change',refresh);
  next?.addEventListener('click',focusNextAnomaly);
  table.addEventListener('input',()=>queueMicrotask(refresh));
  table.addEventListener('change',()=>queueMicrotask(refresh));
  pasteArea?.addEventListener('input',()=>queueMicrotask(refresh));
  gridSearch?.addEventListener('input',()=>queueMicrotask(refresh));
  gridFilter?.addEventListener('change',()=>queueMicrotask(refresh));
  refresh();
})();
</script>
"""


def decorate_native_document_review(page: str) -> str:
    """Add read-only anomaly/duplicate/amount review to the existing multi-product grid.

    The review layer never writes business fields, creates rows, persists state,
    merges duplicate products, changes price inheritance, or owns a route/API.
    It only classifies the current DOM and provides bounded navigation/filtering.
    """
    text = str(page or "")
    if REVIEW_MARKER in text or "data-item-row" not in text or "data-hnd-grid-tools" not in text or "data-hnd-paste" not in text:
        return text
    if "</style>" in text:
        text = text.replace("</style>", _REVIEW_STYLE + "</style>", 1)
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", _REVIEW_BAR + "<div class='table-wrap'>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _REVIEW_SCRIPT + "</body>", 1)
    return text


def install_native_document_review(standalone_module: ModuleType) -> None:
    """Decorate the paste-enabled native renderer exactly once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_review", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_review(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_review", True)
    setattr(wrapped, "_huidi_native_review_original", original)
    standalone_module._document_html = wrapped
