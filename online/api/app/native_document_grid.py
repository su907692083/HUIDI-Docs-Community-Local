from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


GRID_MARKER = "huidi-native-document-grid-v1"

_GRID_STYLE = """
.hnd-grid-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px;padding:7px 9px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-grid-tools input,.hnd-grid-tools select{height:30px;margin:0;padding:4px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;font-size:12px}.hnd-grid-tools input{min-width:240px;flex:1}.hnd-grid-tools select{min-width:132px}.hnd-grid-count{color:#667085;font-size:11px;white-space:nowrap}.table-wrap{position:relative;max-height:min(66vh,760px);overflow:auto}.item-table{border-collapse:separate;border-spacing:0}.item-table th,.item-table td{padding:4px 5px!important;vertical-align:top}.item-table input,.item-table textarea{font-size:12px!important;line-height:1.3!important}.item-table input{min-height:29px!important;padding:4px 6px!important}.item-table textarea{min-height:38px!important;height:38px!important;padding:4px 6px!important;resize:vertical}.item-table thead th{position:sticky;top:0;z-index:6;background:#f8fafc}.item-table th:nth-child(1),.item-table td:nth-child(1){position:sticky;left:0;z-index:5;min-width:48px;width:48px;background:#fff}.item-table th:nth-child(2),.item-table td:nth-child(2){position:sticky;left:48px;z-index:5;min-width:230px;width:230px;background:#fff}.item-table th:nth-child(3),.item-table td:nth-child(3){position:sticky;left:278px;z-index:5;min-width:132px;width:132px;background:#fff}.item-table thead th:nth-child(-n+3){z-index:8;background:#f8fafc}.item-table tr.hnd-selected>td:nth-child(-n+3){background:#f0f6ff}.item-table tr[hidden]{display:none!important}
@media(max-width:900px){.item-table th:nth-child(3),.item-table td:nth-child(3){position:static;min-width:112px;width:auto}.hnd-grid-tools input{min-width:180px}}
@media print{.hnd-grid-tools{display:none!important}.table-wrap{max-height:none;overflow:visible}.item-table thead th,.item-table th:nth-child(-n+3),.item-table td:nth-child(-n+3){position:static!important;background:transparent!important}}
"""

_GRID_TOOLS = """
<div class='hnd-grid-tools' data-hnd-grid-tools>
  <input type='search' data-hnd-grid-search placeholder='搜索产品 / SKU / 规格' autocomplete='off' aria-label='搜索产品、SKU或规格'>
  <select data-hnd-grid-filter aria-label='筛选产品行'>
    <option value='all'>全部产品</option>
    <option value='missing'>只看缺项</option>
    <option value='amount'>只看金额异常</option>
    <option value='selected'>只看已选</option>
  </select>
  <span class='hnd-grid-count' data-hnd-grid-count></span>
</div>
"""

_GRID_SCRIPT = r"""
<script id='huidi-native-document-grid-v1'>
(()=>{
  const tools=document.querySelector('[data-hnd-grid-tools]');
  const table=document.querySelector('.item-table');
  const rows=[...document.querySelectorAll('[data-item-row]')];
  if(!tools||!table||!rows.length)return;
  const search=tools.querySelector('[data-hnd-grid-search]');
  const filter=tools.querySelector('[data-hnd-grid-filter]');
  const count=tools.querySelector('[data-hnd-grid-count]');
  const selectAll=document.querySelector('[data-hnd-select-all]');
  let filtering=false;
  const checkbox=row=>row.querySelector('[data-hnd-row-select]');
  const field=(row,key)=>row.querySelector(`[data-item-k="${key}"]`);
  const text=row=>['product','sku','spec'].map(key=>String(field(row,key)?.value||'')).join(' ').toLocaleLowerCase();
  const visibleRows=()=>rows.filter(row=>!row.hidden);
  function modeMatch(row,mode){
    if(mode==='missing')return row.classList.contains('hnd-incomplete');
    if(mode==='amount')return Boolean(field(row,'total')?.classList.contains('hnd-amount-mismatch'));
    if(mode==='selected')return Boolean(checkbox(row)?.checked);
    return true;
  }
  function syncSelectAll(){
    if(!selectAll)return;
    const visible=visibleRows();
    const selected=visible.filter(row=>checkbox(row)?.checked);
    selectAll.checked=visible.length>0&&selected.length===visible.length;
    selectAll.indeterminate=selected.length>0&&selected.length<visible.length;
  }
  function applyFilter(){
    if(filtering)return;
    filtering=true;
    const query=String(search?.value||'').trim().toLocaleLowerCase();
    const mode=String(filter?.value||'all');
    let shown=0;
    let selectionChanged=false;
    rows.forEach(row=>{
      const matchesQuery=!query||text(row).includes(query);
      const show=matchesQuery&&modeMatch(row,mode);
      row.hidden=!show;
      if(show)shown+=1;
      const check=checkbox(row);
      if(!show&&check?.checked){check.checked=false;selectionChanged=true;}
    });
    if(count)count.textContent=`显示 ${shown} / ${rows.length} 行`;
    syncSelectAll();
    filtering=false;
    if(selectionChanged){
      const check=rows.map(checkbox).find(Boolean);
      check?.dispatchEvent(new Event('change',{bubbles:true}));
      syncSelectAll();
    }
  }
  search?.addEventListener('input',applyFilter);
  filter?.addEventListener('change',applyFilter);
  table.addEventListener('input',event=>{
    const key=event.target?.dataset?.itemK||'';
    if(['product','sku','spec','quantity','unit_price','total','lead_time','packages','net_weight','gross_weight'].includes(key))queueMicrotask(applyFilter);
  });
  table.addEventListener('change',event=>{
    if(event.target?.matches?.('[data-hnd-row-select],[data-item-k]'))queueMicrotask(applyFilter);
  });
  selectAll?.addEventListener('change',event=>{
    event.stopImmediatePropagation();
    const checked=Boolean(selectAll.checked);
    rows.forEach(row=>{
      const check=checkbox(row);
      if(check)check.checked=!row.hidden&&checked;
    });
    const check=rows.map(checkbox).find(Boolean);
    check?.dispatchEvent(new Event('change',{bubbles:true}));
    applyFilter();
  },true);
  applyFilter();
})();
</script>
"""


def decorate_native_document_grid(page: str) -> str:
    """Add bounded row-location, filtering and sticky-grid presentation.

    This layer owns no route, persistence, API, price calculation, validation or
    document state. It decorates only the existing multi-product native table.
    """
    text = str(page or "")
    if GRID_MARKER in text or "data-item-row" not in text or "data-hnd-batch" not in text:
        return text
    if "</style>" in text:
        text = text.replace("</style>", _GRID_STYLE + "</style>", 1)
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", _GRID_TOOLS + "<div class='table-wrap'>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _GRID_SCRIPT + "</body>", 1)
    return text


def install_native_document_grid(standalone_module: ModuleType) -> None:
    """Decorate the already-batched native document renderer once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_grid", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_grid(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_grid", True)
    setattr(wrapped, "_huidi_native_grid_original", original)
    standalone_module._document_html = wrapped
