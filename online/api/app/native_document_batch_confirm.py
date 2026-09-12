from __future__ import annotations

import html
from types import ModuleType
from typing import Any, Callable

from . import document_context


CONFIRM_MARKER = "huidi-native-document-batch-confirm-v1"
BATCH_REVIEW_FIELD = "_huidi_batch_review"
BATCH_REVIEW_SCHEMA = "huidi.document.batch-review/v1"

# Reuse the existing OnlineDocumentRef draft owner. This review metadata is
# intentionally added after INHERITABLE_FIELDS was created, so it can be saved
# on the current document but never auto-inherits downstream.
document_context.DRAFT_FIELDS.add(BATCH_REVIEW_FIELD)
document_context.LONG_FIELDS.add(BATCH_REVIEW_FIELD)

_CONFIRM_STYLE = """
.hnd-batch-confirm{margin:0 0 8px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-batch-confirm>summary{cursor:pointer;padding:7px 9px;color:#344054;font-size:12px;font-weight:700;list-style:none}.hnd-batch-confirm>summary::-webkit-details-marker{display:none}.hnd-batch-confirm>summary:after{content:'⌄';float:right;color:#98a2b3}.hnd-batch-confirm[open]>summary:after{content:'⌃'}.hnd-batch-confirm-body{padding:0 9px 9px}.hnd-batch-confirm-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.hnd-batch-confirm-actions select,.hnd-batch-confirm-actions button{height:30px;margin:0;padding:4px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;font-size:12px}.hnd-batch-confirm-status{min-width:240px;flex:1;color:#667085;font-size:11px}.hnd-batch-groups{display:grid;gap:7px;margin-top:8px}.hnd-batch-group{padding:8px 9px;border:1px solid #e4e7ec;border-radius:7px;background:#f8fafc}.hnd-batch-group[data-confirmed='1']{border-color:#86efac;background:#f0fdf4}.hnd-batch-group-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hnd-batch-group-head b{color:#344054}.hnd-batch-group-head small{color:#667085}.hnd-batch-group-head button{margin-left:auto;padding:4px 7px;border:1px solid #d0d5dd;background:#fff;font-size:11px}.hnd-batch-diff-text{margin-top:5px;color:#8a6a1f;font-size:10px}.hnd-batch-row-notes{display:grid;gap:5px;margin-top:6px}.hnd-batch-row-note{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.2fr);gap:7px;align-items:center;color:#667085;font-size:10px}.hnd-batch-row-note input{height:28px;margin:0;padding:4px 7px;font-size:11px}.hnd-batch-match{margin-top:8px;padding:7px 9px;border:1px solid #e4e7ec;border-radius:7px;color:#667085;font-size:10px}.hnd-batch-match strong{color:#344054}.hnd-batch-match .high{color:#166534}.hnd-batch-match .warn{color:#a15c00}.hnd-batch-match .bad{color:#b42318}.hnd-batch-new>td:first-child{box-shadow:inset 3px 0 0 #2563eb!important}.hnd-batch-new input[data-item-k='product'],.hnd-batch-new input[data-item-k='sku']{background:#f8fafc;color:#475467}.hnd-batch-diff{outline:1px dashed #f59e0b!important;outline-offset:-1px}.hnd-batch-remove-new{margin-left:4px;padding:2px 5px;border:1px solid #fecaca;background:#fff;color:#b42318;font-size:9px}.hnd-batch-save-note{display:block;margin-top:6px;color:#667085;font-size:10px}
@media(max-width:760px){.hnd-batch-row-note{grid-template-columns:1fr}}
@media print{.hnd-batch-confirm{display:none!important}.hnd-batch-diff{outline:none!important}.hnd-batch-new>td:first-child{box-shadow:none!important}}
"""

_CONFIRM_PANEL = """
<details class='hnd-batch-confirm' data-hnd-batch-confirm>
  <summary>批次确认 / Excel 匹配核对</summary>
  <div class='hnd-batch-confirm-body'>
    <div class='hnd-batch-confirm-actions'>
      <select data-hnd-batch-source aria-label='选择要复制为批次的产品行'></select>
      <button type='button' data-hnd-batch-split>复制为批次行</button>
      <span class='hnd-batch-confirm-status' data-hnd-batch-confirm-status>系统不会自动拆分、合并或求和；复制后请逐行确认。</span>
    </div>
    <div class='hnd-batch-groups' data-hnd-batch-groups></div>
    <div class='hnd-batch-match' data-hnd-batch-match><strong>Excel 匹配：</strong>粘贴表格后显示精确身份匹配置信度。</div>
    <small class='hnd-batch-save-note'>“确认保留多行”和批次备注属于当前正式单据的核对快照；点击顶部“保存草稿”后才持久化。它不会进入下游单据自动继承。</small>
  </div>
</details>
"""

_CONFIRM_SCRIPT = r"""
<script id='huidi-native-document-batch-confirm-v1'>
(()=>{
  const panel=document.querySelector('[data-hnd-batch-confirm]');
  const table=document.querySelector('.item-table');
  const sourceSelect=panel?.querySelector('[data-hnd-batch-source]');
  const splitButton=panel?.querySelector('[data-hnd-batch-split]');
  const status=panel?.querySelector('[data-hnd-batch-confirm-status]');
  const groupsBox=panel?.querySelector('[data-hnd-batch-groups]');
  const matchBox=panel?.querySelector('[data-hnd-batch-match]');
  const pasteArea=document.querySelector('[data-hnd-paste-text]');
  const stateField=document.querySelector('[data-k="_huidi_batch_review"]');
  if(!panel||!table||!sourceSelect||!splitButton||!groupsBox||!matchBox||!stateField)return;
  const packing=table.classList.contains('packing');
  const rows=()=>[...document.querySelectorAll('[data-item-row]')];
  const field=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const value=(row,key)=>String(field(row,key)?.value||'').trim();
  const norm=v=>String(v||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels={quantity:'数量',lead_time:'交期',spec:'规格',packages:'包装件数',net_weight:'净重',gross_weight:'毛重',carton_size:'箱规',volume:'CBM',marks:'唛头'};
  const differenceKeys=packing?['quantity','packages','net_weight','gross_weight','carton_size','volume','marks','spec']:['quantity','lead_time','spec'];
  let saved={schema:'huidi.document.batch-review/v1',groups:{}};
  try{
    const parsed=JSON.parse(String(stateField.value||'{}'));
    if(parsed&&typeof parsed==='object'&&parsed.groups&&typeof parsed.groups==='object')saved={schema:'huidi.document.batch-review/v1',groups:parsed.groups};
  }catch(_){saved={schema:'huidi.document.batch-review/v1',groups:{}};}

  function currentGroups(){
    const skuMap=new Map(),productMap=new Map();
    rows().forEach(row=>{
      const sku=norm(value(row,'sku'));
      const product=norm(value(row,'product'));
      if(sku){const list=skuMap.get(sku)||[];list.push(row);skuMap.set(sku,list);}
      else if(product){const list=productMap.get(product)||[];list.push(row);productMap.set(product,list);}
    });
    const out=[];
    skuMap.forEach((list,identity)=>{if(list.length>1)out.push(makeGroup('sku',identity,list));});
    productMap.forEach((list,identity)=>{if(list.length>1)out.push(makeGroup('product',identity,list));});
    return out;
  }
  function makeGroup(kind,identity,list){
    const label=kind==='sku'?value(list[0],'sku'):value(list[0],'product');
    const ids=list.map(row=>String(row.dataset.productId||row.dataset.brainId||'')).sort().join(',');
    const key=`${kind}|${identity}|${list.length}|${ids}`;
    const differences=[];
    differenceKeys.forEach(fieldKey=>{
      const values=list.map(row=>value(row,fieldKey)).filter(Boolean);
      const unique=[...new Set(values)];
      const missing=list.length-values.length;
      if(unique.length>1||missing){differences.push({key:fieldKey,values:unique.slice(0,3),missing});}
    });
    return {key,kind,identity,label,rows:list,differences};
  }
  function rowToken(group,row,index){
    const id=String(row.dataset.productId||row.dataset.brainId||group.identity||'row');
    return `${id}#${index+1}`;
  }
  function persistState(groups){
    const active=new Set(groups.map(group=>group.key));
    Object.keys(saved.groups||{}).forEach(key=>{if(!active.has(key))delete saved.groups[key];});
    stateField.value=JSON.stringify(saved);
  }
  function rowSummary(row){
    const parts=[];
    differenceKeys.forEach(key=>{const v=value(row,key);if(v)parts.push(`${labels[key]||key}: ${v}`);});
    return parts.slice(0,4).join(' · ')||'本行差异字段尚未填写';
  }
  function clearDiffMarks(){document.querySelectorAll('.hnd-batch-diff').forEach(node=>node.classList.remove('hnd-batch-diff'));}
  function renderGroups(){
    const groups=currentGroups();
    clearDiffMarks();
    if(!groups.length){
      groupsBox.innerHTML="<div class='hnd-batch-group'><small>当前没有重复 SKU / 产品行。需要拆批时，可先从上方选择一行并点“复制为批次行”。</small></div>";
      persistState(groups);
      return groups;
    }
    groupsBox.innerHTML=groups.map(group=>{
      const stored=saved.groups[group.key]||{confirmed:false,row_notes:{}};
      const diffText=group.differences.length
        ? group.differences.map(diff=>`${labels[diff.key]||diff.key}: ${diff.values.length?diff.values.join(' / '):'未填'}${diff.missing?`（${diff.missing} 行未填）`:''}`).join('；')
        : '各批次关键非价格字段当前一致；仍请确认是否确实需要保留多行。';
      const hasUnsaved=group.rows.some(row=>row.dataset.hndUnsavedBatch==='1');
      const notes=group.rows.map((row,index)=>{
        const token=rowToken(group,row,index);
        const note=String(stored.row_notes?.[token]||'');
        return `<label class='hnd-batch-row-note'><span>批次 ${index+1} · ${esc(rowSummary(row))}</span><input data-hnd-batch-note data-group-key='${esc(group.key)}' data-row-token='${esc(token)}' value='${esc(note)}' placeholder='批次备注，如：9/20 空运 / 10/15 海运'></label>`;
      }).join('');
      return `<div class='hnd-batch-group' data-group-key='${esc(group.key)}' data-confirmed='${stored.confirmed?'1':'0'}'>
        <div class='hnd-batch-group-head'><b>${group.kind==='sku'?'同 SKU':'同产品'}：${esc(group.label)} × ${group.rows.length}</b><small>${stored.confirmed?'已人工确认保留多行':'待人工确认'}</small><button type='button' data-hnd-batch-confirm-group ${hasUnsaved?'disabled title="新批次行请先保存草稿后重新打开再确认"':''}>${stored.confirmed?'撤销确认':'确认保留多行'}</button></div>
        <div class='hnd-batch-diff-text'>差异提示：${esc(diffText)}${hasUnsaved?' · 新复制批次尚未保存':''}</div>
        <div class='hnd-batch-row-notes'>${notes}</div>
      </div>`;
    }).join('');
    groups.forEach(group=>group.differences.forEach(diff=>group.rows.forEach(row=>field(row,diff.key)?.classList?.add('hnd-batch-diff'))));
    persistState(groups);
    return groups;
  }
  function refreshSourceSelect(){
    const previous=sourceSelect.value;
    sourceSelect.innerHTML=rows().map((row,index)=>`<option value='${index}'>${index+1}. ${esc(value(row,'sku')||value(row,'product')||'未命名产品')}</option>`).join('');
    if(previous&&Number(previous)<rows().length)sourceSelect.value=previous;
  }
  function renumber(){
    rows().forEach((row,index)=>{
      const first=row.querySelector('td');
      if(!first)return;
      const check=first.querySelector('[data-hnd-row-select]');
      const remove=first.querySelector('[data-hnd-batch-remove-new]');
      [...first.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
      const number=document.createTextNode(String(index+1));
      first.prepend(number);
      if(check)first.prepend(check);
      if(remove)first.append(remove);
    });
  }
  function cloneBatchRow(){
    const list=rows();
    const source=list[Number(sourceSelect.value)||0];
    if(!source)return;
    const clone=source.cloneNode(true);
    clone.dataset.hndUnsavedBatch='1';
    clone.classList.remove('hnd-selected','hnd-incomplete','hnd-review-duplicate-row','hnd-review-hidden');
    clone.classList.add('hnd-batch-new');
    clone.querySelector('[data-hnd-row-select]')?.remove();
    clone.querySelectorAll('.hnd-paste-cell-warning,.hnd-amount-ok,.hnd-amount-pending,.hnd-amount-mismatch,.hnd-review-duplicate,.hnd-batch-diff').forEach(node=>node.classList.remove('hnd-paste-cell-warning','hnd-amount-ok','hnd-amount-pending','hnd-amount-mismatch','hnd-review-duplicate','hnd-batch-diff'));
    ['product','sku'].forEach(key=>{const input=field(clone,key);if(input){input.readOnly=true;input.title='批次行沿用同一正式产品身份；不要在这里改产品身份。';}});
    const clearKeys=packing?['quantity','packages','net_weight','gross_weight','carton_size','volume','marks']:['quantity','unit_price','total','lead_time'];
    clearKeys.forEach(key=>{const input=field(clone,key);if(input)input.value='';});
    const first=clone.querySelector('td');
    if(first){
      const remove=document.createElement('button');
      remove.type='button';remove.className='hnd-batch-remove-new';remove.dataset.hndBatchRemoveNew='1';remove.textContent='撤销新批次';remove.title='只撤销本次尚未保存的新批次行';
      first.append(remove);
    }
    source.after(clone);
    renumber();refreshSourceSelect();renderGroups();renderMatch();
    if(status)status.textContent='已复制一个临时批次行：产品身份保持不变，执行字段已清空。填写后请点击顶部“保存草稿”。';
    field(clone,packing?'quantity':'quantity')?.focus?.();
  }
  function splitMatrix(raw){
    return String(raw||'').replace(/\r\n?/g,'\n').split('\n').filter(line=>line.trim()).map(line=>line.split('\t').map(cell=>String(cell||'').trim()));
  }
  function headerKind(value){
    const h=String(value||'').toLocaleLowerCase().replace(/[\s_\-\/\\.()（）\[\]{}:：]+/g,'');
    if(/(?:sku|itemno|itemnumber|货号|型号|产品编号)/.test(h))return 'sku';
    if(/(?:productname|itemname|产品名称|品名|^product$|^item$)/.test(h))return 'product';
    return '';
  }
  function matchConfidence(){
    const matrix=splitMatrix(pasteArea?.value);
    if(!matrix.length)return {empty:true,high:0,review:0,unmatched:0,examples:[]};
    let headerIndex=-1,skuIndex=-1,productIndex=-1;
    for(let index=0;index<Math.min(matrix.length,5);index+=1){
      const kinds=(matrix[index]||[]).map(headerKind);
      const s=kinds.indexOf('sku'),p=kinds.indexOf('product');
      if(s>=0||p>=0){headerIndex=index;skuIndex=s;productIndex=p;break;}
    }
    if(headerIndex<0)return {sequential:true,high:0,review:0,unmatched:0,examples:[]};
    const canonical=rows();
    let high=0,review=0,unmatched=0;
    const examples=[];
    matrix.slice(headerIndex+1).forEach((cells,index)=>{
      const rowNumber=headerIndex+2+index;
      const sku=skuIndex>=0?String(cells[skuIndex]||'').trim():'';
      const product=productIndex>=0?String(cells[productIndex]||'').trim():'';
      if(!sku&&!product)return;
      const skuMatches=sku?canonical.filter(row=>norm(value(row,'sku'))===norm(sku)):[];
      const productMatches=product?canonical.filter(row=>norm(value(row,'product'))===norm(product)):[];
      let level='unmatched',message='未匹配现有产品行';
      if(sku){
        if(skuMatches.length===1){
          const target=skuMatches[0];
          if(!product||norm(value(target,'product'))===norm(product)){level='high';message='高：SKU 精确匹配';}
          else{level='review';message='需核对：SKU 精确，但产品名称与目标行不同';}
        }else if(skuMatches.length>1){level='review';message=`需核对：SKU 对应 ${skuMatches.length} 个现有批次行`;}
        else if(productMatches.length===1){level='review';message='需核对：SKU 未匹配，但产品名称精确匹配';}
      }else if(productMatches.length===1){level='review';message='中：仅产品名称精确匹配';}
      else if(productMatches.length>1){level='review';message=`需核对：产品名称对应 ${productMatches.length} 行`;}
      if(level==='high')high+=1;else if(level==='review')review+=1;else unmatched+=1;
      if(examples.length<6)examples.push({rowNumber,label:sku||product,level,message});
    });
    return {high,review,unmatched,examples};
  }
  function renderMatch(){
    const result=matchConfidence();
    if(result.empty){matchBox.innerHTML='<strong>Excel 匹配：</strong>粘贴表格后显示精确身份匹配置信度。';return;}
    if(result.sequential){matchBox.innerHTML='<strong>Excel 匹配：</strong><span class="warn">未识别 SKU / 产品身份列；当前属于顺序粘贴，匹配置信度需要人工确认。</span>';return;}
    const examples=result.examples.map(item=>`第 ${item.rowNumber} 行 ${esc(item.label)}：<span class='${item.level==='high'?'high':item.level==='review'?'warn':'bad'}'>${esc(item.message)}</span>`).join('；');
    matchBox.innerHTML=`<strong>Excel 匹配：</strong><span class='high'>高 ${result.high}</span> · <span class='warn'>需核对 ${result.review}</span> · <span class='bad'>未匹配 ${result.unmatched}</span>${examples?`<br>${examples}`:''}<br><small>置信度只解释精确 SKU / 产品身份，不做模糊猜测，也不会改变产品身份。</small>`;
  }
  function refresh(){refreshSourceSelect();renderGroups();renderMatch();}
  splitButton.addEventListener('click',cloneBatchRow);
  groupsBox.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-hnd-batch-confirm-group]');
    if(!button)return;
    const card=button.closest('[data-group-key]');
    const key=String(card?.dataset.groupKey||'');
    const group=currentGroups().find(item=>item.key===key);
    if(!group)return;
    const current=saved.groups[key]||{confirmed:false,row_notes:{}};
    current.confirmed=!Boolean(current.confirmed);
    current.kind=group.kind;current.identity=group.label;current.row_count=group.rows.length;
    current.row_notes=current.row_notes||{};
    saved.groups[key]=current;
    stateField.value=JSON.stringify(saved);
    renderGroups();
    if(status)status.textContent=current.confirmed?'已记录“确认保留多行”；请点击顶部“保存草稿”持久化。':'已撤销批次确认；保存草稿后生效。';
  });
  groupsBox.addEventListener('input',event=>{
    const input=event.target?.closest?.('[data-hnd-batch-note]');
    if(!input)return;
    const key=String(input.dataset.groupKey||''),token=String(input.dataset.rowToken||'');
    const group=currentGroups().find(item=>item.key===key);
    if(!group||!token)return;
    const current=saved.groups[key]||{confirmed:false,row_notes:{}};
    current.kind=group.kind;current.identity=group.label;current.row_count=group.rows.length;
    current.row_notes=current.row_notes||{};current.row_notes[token]=String(input.value||'').slice(0,500);
    saved.groups[key]=current;stateField.value=JSON.stringify(saved);
  });
  table.addEventListener('click',event=>{
    const remove=event.target?.closest?.('[data-hnd-batch-remove-new]');
    if(!remove)return;
    const row=remove.closest('[data-item-row]');
    if(row?.dataset.hndUnsavedBatch==='1'){row.remove();renumber();refresh();if(status)status.textContent='已撤销尚未保存的新批次行。';}
  });
  table.addEventListener('input',()=>queueMicrotask(refresh));
  table.addEventListener('change',()=>queueMicrotask(refresh));
  pasteArea?.addEventListener('input',()=>queueMicrotask(renderMatch));
  refresh();
})();
</script>
"""


def decorate_native_document_batch_confirm(page: str, saved_review_json: str = "") -> str:
    """Add explicit manual batch splitting/confirmation without a second owner.

    New rows remain ordinary native document rows and are persisted only by the
    existing Save Draft owner. Confirmation/notes are stored in one reserved
    metadata field on the same OnlineDocumentRef and are not inherited.
    """
    text = str(page or "")
    if CONFIRM_MARKER in text or "data-hnd-review" not in text or "data-item-row" not in text:
        return text

    # The original document save owner captured a static row array. Replace only
    # that first base-script capture with a live proxy so a user-created batch row
    # is included by the same itemData()/persist() owner, without creating another
    # save path.
    static_rows = "const itemRows=[...document.querySelectorAll('[data-item-row]')];"
    live_rows = "const itemRows=new Proxy([],{get(_target,prop){const list=[...document.querySelectorAll('[data-item-row]')];const value=list[prop];return typeof value==='function'?value.bind(list):value}});"
    if static_rows not in text:
        return text
    text = text.replace(static_rows, live_rows, 1)

    escaped_state = html.escape(str(saved_review_json or ""), quote=True)
    hidden = f"<input type='hidden' data-k='{BATCH_REVIEW_FIELD}' value='{escaped_state}'>"
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", hidden + _CONFIRM_PANEL + "<div class='table-wrap'>", 1)
    if "</style>" in text:
        text = text.replace("</style>", _CONFIRM_STYLE + "</style>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _CONFIRM_SCRIPT + "</body>", 1)
    return text


def install_native_document_batch_confirm(standalone_module: ModuleType) -> None:
    """Decorate the fully reviewed native renderer exactly once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_batch_confirm", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        saved_fields = kwargs.get("saved_fields")
        if not isinstance(saved_fields, dict) and len(args) >= 7 and isinstance(args[6], dict):
            saved_fields = args[6]
        review_json = str((saved_fields or {}).get(BATCH_REVIEW_FIELD) or "")
        return decorate_native_document_batch_confirm(original(*args, **kwargs), review_json)

    setattr(wrapped, "_huidi_native_batch_confirm", True)
    setattr(wrapped, "_huidi_native_batch_confirm_original", original)
    standalone_module._document_html = wrapped
