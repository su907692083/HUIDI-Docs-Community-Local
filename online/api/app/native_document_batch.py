from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


BATCH_MARKER = "huidi-native-document-batch-v2"

_BATCH_STYLE = """
.hnd-batch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 8px;padding:9px 10px;border:1px solid #d0d5dd;border-radius:9px;background:#f8fafc}.hnd-batch label{display:inline-flex;align-items:center;gap:5px;color:#344054}.hnd-batch label input{display:inline-block;width:auto;margin:0}.hnd-batch button{padding:6px 9px;border:1px solid #d0d5dd;background:#fff;color:#344054;font-size:12px}.hnd-batch button:disabled{opacity:.45;cursor:not-allowed}.hnd-batch .hnd-status{min-width:220px;flex:1;color:#475467;font-size:11px}.hnd-batch .hnd-progress{width:100%;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:#475467;font-size:10px}.hnd-batch .hnd-progress b{color:#101828}.hnd-batch .hnd-warning{width:100%;color:#8a6a1f;font-size:10px}.item-table tr.hnd-selected>td{background:#f0f6ff}.item-table tr.hnd-incomplete>td:first-child{box-shadow:inset 3px 0 0 #f59e0b}.item-table [data-hnd-row-select]{display:inline-block;width:auto;margin:0 5px 0 0;vertical-align:middle}.item-table td:first-child{white-space:nowrap}.hnd-price-active{border-color:#f59e0b!important;box-shadow:0 0 0 1px rgba(245,158,11,.15)}.hnd-amount-ok{border-color:#16a34a!important}.hnd-amount-pending{border-color:#d97706!important}.hnd-amount-mismatch{border-color:#dc2626!important;box-shadow:0 0 0 1px rgba(220,38,38,.12)}
@media print{.hnd-batch,.item-table [data-hnd-row-select]{display:none!important}.item-table tr.hnd-selected>td,.item-table tr.hnd-incomplete>td:first-child{background:transparent;box-shadow:none}.hnd-amount-ok,.hnd-amount-pending,.hnd-amount-mismatch{border-color:transparent!important;box-shadow:none!important}}
"""

_BATCH_BAR = """
<div class='hnd-batch' data-hnd-batch>
  <label><input type='checkbox' data-hnd-select-all>全选</label>
  <span class='hnd-status' data-hnd-status>勾选产品行，再点一个要复制的当前格。</span>
  <button type='button' data-hnd-fill-empty disabled>填到已选空白</button>
  <button type='button' data-hnd-overwrite disabled>覆盖已选</button>
  <button type='button' data-hnd-next-missing>下一缺项</button>
  <button type='button' data-hnd-clear>取消选择</button>
  <div class='hnd-progress' data-hnd-progress></div>
  <small class='hnd-warning' data-hnd-warning>只复制你当前点选格的内容；系统不会自动生成数量、价格、重量或包装执行数据。</small>
</div>
"""

_BATCH_SCRIPT = r"""
<script id='huidi-native-document-batch-v2'>
(()=>{
  const bar=document.querySelector('[data-hnd-batch]');
  const rows=[...document.querySelectorAll('[data-item-row]')];
  if(!bar||!rows.length)return;
  const labels={product:'产品',sku:'SKU',spec:'规格',quantity:'数量',unit_price:'单价',total:'金额',lead_time:'交期',packages:'包装件数',net_weight:'净重',gross_weight:'毛重',carton_size:'外箱尺寸',volume:'体积',marks:'唛头'};
  const packing=Boolean(document.querySelector('.item-table.packing'));
  const requiredKeys=packing?['quantity','packages','net_weight','gross_weight']:['quantity','unit_price','lead_time'];
  const selectAll=bar.querySelector('[data-hnd-select-all]');
  const status=bar.querySelector('[data-hnd-status]');
  const progress=bar.querySelector('[data-hnd-progress]');
  const warning=bar.querySelector('[data-hnd-warning]');
  const fillEmpty=bar.querySelector('[data-hnd-fill-empty]');
  const overwrite=bar.querySelector('[data-hnd-overwrite]');
  const nextMissing=bar.querySelector('[data-hnd-next-missing]');
  const clear=bar.querySelector('[data-hnd-clear]');
  let active=null;
  const rowCheck=row=>row.querySelector('[data-hnd-row-select]');
  const selectedRows=()=>rows.filter(row=>rowCheck(row)?.checked);
  const cell=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const value=(row,key)=>String(cell(row,key)?.value||'').trim();
  function parseNumber(raw){
    const text=String(raw||'').replace(/,/g,'');
    const hit=text.match(/-?\d+(?:\.\d+)?/);
    return hit?Number(hit[0]):NaN;
  }
  function expectedAmount(row){
    const quantity=parseNumber(value(row,'quantity'));
    const price=parseNumber(value(row,'unit_price'));
    if(!Number.isFinite(quantity)||!Number.isFinite(price))return null;
    return quantity*price;
  }
  function amountState(row){
    const totalInput=cell(row,'total');
    if(!totalInput)return 'none';
    totalInput.classList.remove('hnd-amount-ok','hnd-amount-pending','hnd-amount-mismatch');
    const expected=expectedAmount(row);
    if(expected===null){
      totalInput.title='数量和正式单价确认后，可在这里核对行金额。';
      return 'none';
    }
    const actual=parseNumber(totalInput.value);
    const reference=expected.toFixed(2);
    if(!String(totalInput.value||'').trim()||!Number.isFinite(actual)){
      totalInput.classList.add('hnd-amount-pending');
      totalInput.title=`参考计算 ${reference}；系统不会自动写入，请人工确认金额。`;
      return 'pending';
    }
    const tolerance=Math.max(0.01,Math.abs(expected)*0.0001);
    if(Math.abs(actual-expected)<=tolerance){
      totalInput.classList.add('hnd-amount-ok');
      totalInput.title=`金额与数量 × 单价参考计算 ${reference} 一致。`;
      return 'ok';
    }
    totalInput.classList.add('hnd-amount-mismatch');
    totalInput.title=`请核对：数量 × 单价参考为 ${reference}，当前金额为 ${totalInput.value}。`;
    return 'mismatch';
  }
  function missingKeys(row){return requiredKeys.filter(key=>!value(row,key));}
  function updateProgress(){
    let complete=0;
    const missingCounts=Object.fromEntries(requiredKeys.map(key=>[key,0]));
    let amountOk=0,amountPending=0,amountMismatch=0;
    rows.forEach(row=>{
      const missing=missingKeys(row);
      row.classList.toggle('hnd-incomplete',missing.length>0);
      if(!missing.length)complete+=1;
      missing.forEach(key=>{missingCounts[key]=(missingCounts[key]||0)+1});
      const state=amountState(row);
      if(state==='ok')amountOk+=1;
      else if(state==='pending')amountPending+=1;
      else if(state==='mismatch')amountMismatch+=1;
    });
    const missingText=requiredKeys.filter(key=>missingCounts[key]>0).map(key=>`缺${labels[key]||key} ${missingCounts[key]}`).join(' · ');
    let amountText='';
    if(!packing){
      const parts=[];
      if(amountOk)parts.push(`金额一致 ${amountOk}`);
      if(amountPending)parts.push(`金额待确认 ${amountPending}`);
      if(amountMismatch)parts.push(`金额需核对 ${amountMismatch}`);
      amountText=parts.length?` · ${parts.join(' · ')}`:'';
    }
    progress.innerHTML=`<b>完成度 ${complete}/${rows.length} 行</b>${missingText?` · ${missingText}`:''}${amountText}`;
    nextMissing.disabled=complete===rows.length;
  }
  function sync(){
    const selected=selectedRows();
    rows.forEach(row=>row.classList.toggle('hnd-selected',Boolean(rowCheck(row)?.checked)));
    if(selectAll){
      selectAll.checked=selected.length===rows.length&&rows.length>0;
      selectAll.indeterminate=selected.length>0&&selected.length<rows.length;
    }
    const key=active?.dataset.itemK||'';
    const current=String(active?.value||'').trim();
    if(key){
      status.textContent=`已选 ${selected.length} 行 · 当前格：${labels[key]||key}${current?` = ${current}`:'（空）'}`;
    }else{
      status.textContent=`已选 ${selected.length} 行 · 再点一个要复制的当前格`;
    }
    const ready=Boolean(key&&selected.length);
    fillEmpty.disabled=!ready;
    overwrite.disabled=!ready;
    const priceActive=key==='unit_price'||key==='total';
    if(active)active.classList.toggle('hnd-price-active',priceActive);
    warning.textContent=priceActive
      ? '当前是正式价格字段：价格只会在你主动点击批量按钮时复制；不会自动继承到下游单据。'
      : '只复制你当前点选格的内容；“填到已选空白”不会覆盖已经填写的行。Enter 向下移动同列，Shift+Enter 向上。';
    updateProgress();
  }
  function apply(overwriteExisting){
    if(!active)return;
    const key=active.dataset.itemK||'';
    const current=active.value??'';
    if(!key)return;
    selectedRows().forEach(row=>{
      const target=cell(row,key);
      if(!target||target===active)return;
      if(overwriteExisting||!String(target.value||'').trim()){
        target.value=current;
        target.dispatchEvent(new Event('input',{bubbles:true}));
        target.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    sync();
  }
  function moveVertical(input,direction){
    const row=input.closest('[data-item-row]');
    const key=input.dataset.itemK||'';
    const index=rows.indexOf(row);
    if(index<0||!key)return;
    const target=cell(rows[index+direction],key);
    if(!target)return;
    target.focus();
    if(typeof target.select==='function'&&target.tagName!=='TEXTAREA')target.select();
  }
  function focusNextMissing(){
    for(const row of rows){
      const key=missingKeys(row)[0];
      if(!key)continue;
      const target=cell(row,key);
      if(target){target.focus();if(typeof target.select==='function'&&target.tagName!=='TEXTAREA')target.select();return;}
    }
  }
  rows.forEach(row=>{
    const first=row.querySelector('td');
    if(first&&!rowCheck(row)){
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.setAttribute('data-hnd-row-select','');
      checkbox.setAttribute('aria-label','选择此产品行用于批量操作');
      checkbox.title='选择此产品行用于批量操作';
      checkbox.addEventListener('click',event=>event.stopPropagation());
      checkbox.addEventListener('change',sync);
      first.prepend(checkbox);
    }
    row.querySelectorAll('[data-item-k]').forEach(input=>{
      input.addEventListener('focus',()=>{
        if(active&&active!==input)active.classList.remove('hnd-price-active');
        active=input;
        sync();
      });
      input.addEventListener('input',sync);
      input.addEventListener('change',sync);
      input.addEventListener('keydown',event=>{
        if(event.key!=='Enter'||input.tagName==='TEXTAREA'||event.altKey||event.ctrlKey||event.metaKey)return;
        event.preventDefault();
        moveVertical(input,event.shiftKey?-1:1);
      });
    });
  });
  selectAll?.addEventListener('change',()=>{
    rows.forEach(row=>{const checkbox=rowCheck(row);if(checkbox)checkbox.checked=Boolean(selectAll.checked)});
    sync();
  });
  fillEmpty?.addEventListener('click',()=>apply(false));
  overwrite?.addEventListener('click',()=>apply(true));
  nextMissing?.addEventListener('click',focusNextMissing);
  clear?.addEventListener('click',()=>{
    rows.forEach(row=>{const checkbox=rowCheck(row);if(checkbox)checkbox.checked=false});
    sync();
  });
  sync();
})();
</script>
"""


def decorate_native_document_html(page: str) -> str:
    """Add bounded batch-entry controls to an existing native multi-product document.

    This is presentation-only: no API, persistence owner, route, automatic
    price generation, or blocking validation is introduced. The existing native
    document save owner still serializes the final row values into the same
    OnlineDocumentRef draft.
    """
    text = str(page or "")
    if BATCH_MARKER in text or "data-item-row" not in text:
        return text
    if "</style>" in text:
        text = text.replace("</style>", _BATCH_STYLE + "</style>", 1)
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", _BATCH_BAR + "<div class='table-wrap'>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _BATCH_SCRIPT + "</body>", 1)
    return text


def install_native_document_batch(standalone_module: ModuleType) -> None:
    """Decorate the existing standalone native-document renderer once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_batch", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_html(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_batch", True)
    setattr(wrapped, "_huidi_native_batch_original", original)
    standalone_module._document_html = wrapped
