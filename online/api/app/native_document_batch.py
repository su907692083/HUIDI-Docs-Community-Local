from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


BATCH_MARKER = "huidi-native-document-batch-v1"

_BATCH_STYLE = """
.hnd-batch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 8px;padding:9px 10px;border:1px solid #d0d5dd;border-radius:9px;background:#f8fafc}.hnd-batch label{display:inline-flex;align-items:center;gap:5px;color:#344054}.hnd-batch label input{display:inline-block;width:auto;margin:0}.hnd-batch button{padding:6px 9px;border:1px solid #d0d5dd;background:#fff;color:#344054;font-size:12px}.hnd-batch button:disabled{opacity:.45;cursor:not-allowed}.hnd-batch .hnd-status{min-width:220px;flex:1;color:#475467;font-size:11px}.hnd-batch .hnd-warning{width:100%;color:#8a6a1f;font-size:10px}.item-table tr.hnd-selected>td{background:#f0f6ff}.item-table [data-hnd-row-select]{display:inline-block;width:auto;margin:0 5px 0 0;vertical-align:middle}.item-table td:first-child{white-space:nowrap}.hnd-price-active{border-color:#f59e0b!important;box-shadow:0 0 0 1px rgba(245,158,11,.15)}
@media print{.hnd-batch,.item-table [data-hnd-row-select]{display:none!important}.item-table tr.hnd-selected>td{background:transparent}}
"""

_BATCH_BAR = """
<div class='hnd-batch' data-hnd-batch>
  <label><input type='checkbox' data-hnd-select-all>全选</label>
  <span class='hnd-status' data-hnd-status>勾选产品行，再点一个要复制的当前格。</span>
  <button type='button' data-hnd-fill-empty disabled>填到已选空白</button>
  <button type='button' data-hnd-overwrite disabled>覆盖已选</button>
  <button type='button' data-hnd-clear>取消选择</button>
  <small class='hnd-warning' data-hnd-warning>只复制你当前点选格的内容；系统不会自动生成数量、价格、重量或包装执行数据。</small>
</div>
"""

_BATCH_SCRIPT = r"""
<script id='huidi-native-document-batch-v1'>
(()=>{
  const bar=document.querySelector('[data-hnd-batch]');
  const rows=[...document.querySelectorAll('[data-item-row]')];
  if(!bar||!rows.length)return;
  const labels={product:'产品',sku:'SKU',spec:'规格',quantity:'数量',unit_price:'单价',total:'金额',lead_time:'交期',packages:'包装件数',net_weight:'净重',gross_weight:'毛重',carton_size:'外箱尺寸',volume:'体积',marks:'唛头'};
  const selectAll=bar.querySelector('[data-hnd-select-all]');
  const status=bar.querySelector('[data-hnd-status]');
  const warning=bar.querySelector('[data-hnd-warning]');
  const fillEmpty=bar.querySelector('[data-hnd-fill-empty]');
  const overwrite=bar.querySelector('[data-hnd-overwrite]');
  const clear=bar.querySelector('[data-hnd-clear]');
  let active=null;
  const rowCheck=row=>row.querySelector('[data-hnd-row-select]');
  const selectedRows=()=>rows.filter(row=>rowCheck(row)?.checked);
  function sync(){
    const selected=selectedRows();
    rows.forEach(row=>row.classList.toggle('hnd-selected',Boolean(rowCheck(row)?.checked)));
    if(selectAll){
      selectAll.checked=selected.length===rows.length&&rows.length>0;
      selectAll.indeterminate=selected.length>0&&selected.length<rows.length;
    }
    const key=active?.dataset.itemK||'';
    const value=String(active?.value||'').trim();
    if(key){
      status.textContent=`已选 ${selected.length} 行 · 当前格：${labels[key]||key}${value?` = ${value}`:'（空）'}`;
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
      : '只复制你当前点选格的内容；“填到已选空白”不会覆盖已经填写的行。';
  }
  function apply(overwriteExisting){
    if(!active)return;
    const key=active.dataset.itemK||'';
    const value=active.value??'';
    if(!key)return;
    selectedRows().forEach(row=>{
      const target=row.querySelector(`[data-item-k="${key}"]`);
      if(!target||target===active)return;
      if(overwriteExisting||!String(target.value||'').trim()){
        target.value=value;
        target.dispatchEvent(new Event('input',{bubbles:true}));
        target.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    sync();
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
    });
  });
  selectAll?.addEventListener('change',()=>{
    rows.forEach(row=>{const checkbox=rowCheck(row);if(checkbox)checkbox.checked=Boolean(selectAll.checked)});
    sync();
  });
  fillEmpty?.addEventListener('click',()=>apply(false));
  overwrite?.addEventListener('click',()=>apply(true));
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

    This is presentation-only: no API, persistence owner, route, or automatic
    price logic is introduced. The existing native document save owner still
    serializes the final row values into the same OnlineDocumentRef draft.
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
