from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


PASTE_MARKER = "huidi-native-document-paste-v1"

_PASTE_STYLE = """
.hnd-paste{margin:0 0 8px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-paste>summary{cursor:pointer;padding:7px 9px;color:#344054;font-size:12px;font-weight:700;list-style:none}.hnd-paste>summary::-webkit-details-marker{display:none}.hnd-paste>summary:after{content:'⌄';float:right;color:#98a2b3}.hnd-paste[open]>summary:after{content:'⌃'}.hnd-paste-body{padding:0 9px 9px}.hnd-paste textarea{width:100%;min-height:92px;margin:0 0 7px;padding:7px 8px;border:1px solid #d0d5dd;border-radius:7px;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}.hnd-paste-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.hnd-paste-actions button{padding:6px 9px;border:1px solid #d0d5dd;background:#fff;color:#344054;font-size:12px}.hnd-paste-actions button:disabled{opacity:.45;cursor:not-allowed}.hnd-paste-status{min-width:260px;flex:1;color:#667085;font-size:11px}.hnd-paste-note{display:block;margin-top:6px;color:#8a6a1f;font-size:10px}.hnd-paste-error{color:#b42318!important}
@media print{.hnd-paste{display:none!important}}
"""

_PASTE_PANEL = """
<details class='hnd-paste' data-hnd-paste>
  <summary>批量粘贴 Excel / 旧表格</summary>
  <div class='hnd-paste-body'>
    <textarea data-hnd-paste-text placeholder='从 Excel 复制后粘贴这里。支持带表头：SKU、产品、规格、数量、单价、金额、交期、箱数、净重、毛重、箱规、CBM、唛头。'></textarea>
    <div class='hnd-paste-actions'>
      <button type='button' data-hnd-paste-fill disabled>填到目标空白</button>
      <button type='button' data-hnd-paste-overwrite disabled>覆盖目标字段</button>
      <button type='button' data-hnd-paste-clear>清空</button>
      <span class='hnd-paste-status' data-hnd-paste-status>粘贴后先核对解析结果；不会自动保存。</span>
    </div>
    <small class='hnd-paste-note'>有 SKU/产品列时只用于匹配现有产品行，不改产品身份；无表头时请先点表格中的起始格，再按 Excel 行列顺序粘贴。不会新增产品行，也不会自动生成价格、金额、数量或装箱数据。</small>
  </div>
</details>
"""

_PASTE_SCRIPT = r"""
<script id='huidi-native-document-paste-v1'>
(()=>{
  const panel=document.querySelector('[data-hnd-paste]');
  const table=document.querySelector('.item-table');
  const rows=[...document.querySelectorAll('[data-item-row]')];
  if(!panel||!table||!rows.length)return;
  const area=panel.querySelector('[data-hnd-paste-text]');
  const fill=panel.querySelector('[data-hnd-paste-fill]');
  const overwrite=panel.querySelector('[data-hnd-paste-overwrite]');
  const clear=panel.querySelector('[data-hnd-paste-clear]');
  const status=panel.querySelector('[data-hnd-paste-status]');
  const aliases=new Map();
  const add=(key,names)=>names.forEach(name=>aliases.set(norm(name),key));
  function norm(value){return String(value||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');}
  add('product',['产品','产品名称','品名','product','product name','item','item name','name']);
  add('sku',['sku','型号','货号','产品编号','item no','item number','model']);
  add('spec',['规格','规格参数','描述','spec','specification','description']);
  add('quantity',['数量','qty','quantity']);
  add('unit_price',['单价','价格','unit price','unitprice','price']);
  add('total',['金额','总价','amount','total','line total']);
  add('lead_time',['交期','交货期','lead time','leadtime','delivery','delivery time']);
  add('packages',['包装件数','箱数','件数','cartons','packages','package qty']);
  add('net_weight',['净重','nw','net weight','netweight']);
  add('gross_weight',['毛重','gw','gross weight','grossweight']);
  add('carton_size',['箱规','外箱尺寸','carton size','cartonsize']);
  add('volume',['体积','cbm','volume']);
  add('marks',['唛头','shipping marks','shippingmarks','marks']);
  const writable=new Set(['spec','quantity','unit_price','total','lead_time','packages','net_weight','gross_weight','carton_size','volume','marks']);
  let anchor=null;
  table.addEventListener('focusin',event=>{
    const input=event.target?.closest?.('[data-item-k]');
    const row=input?.closest?.('[data-item-row]');
    if(input&&row)anchor={row,key:input.dataset.itemK||''};
  });
  const field=(row,key)=>row?.querySelector?.(`[data-item-k="${key}"]`)||null;
  const visibleRows=()=>rows.filter(row=>!row.hidden);
  const fields=row=>[...row.querySelectorAll('[data-item-k]')];
  function splitMatrix(raw){
    const lines=String(raw||'').replace(/\r\n?/g,'\n').split('\n');
    while(lines.length&&!lines[lines.length-1].trim())lines.pop();
    return lines.filter(line=>line.trim()).map(line=>line.split('\t').map(cell=>String(cell??'').trim()));
  }
  function identity(value){return norm(value);}
  function headerInfo(matrix){
    const first=matrix[0]||[];
    const keys=first.map(cell=>aliases.get(norm(cell))||'');
    const recognized=keys.filter(Boolean).length;
    const unique=new Set(keys.filter(Boolean));
    const hasHeader=recognized>=2&&unique.size>=2;
    return {hasHeader,keys};
  }
  function rowMatch(source,targetRows,used){
    const sku=identity(source.sku);
    const product=identity(source.product);
    let match=null;
    if(sku)match=targetRows.find(row=>!used.has(row)&&identity(field(row,'sku')?.value)===sku)||null;
    if(!match&&product)match=targetRows.find(row=>!used.has(row)&&identity(field(row,'product')?.value)===product)||null;
    return match;
  }
  function makePlan(){
    const matrix=splitMatrix(area?.value);
    if(!matrix.length)return {ok:false,message:'请先粘贴 Excel / 表格内容。',ops:[],rows:0,unmatched:0};
    const info=headerInfo(matrix);
    const targets=visibleRows();
    if(!targets.length)return {ok:false,message:'当前筛选下没有可见产品行。',ops:[],rows:0,unmatched:0};
    const dataRows=info.hasHeader?matrix.slice(1):matrix;
    if(!dataRows.length)return {ok:false,message:'检测到表头，但没有数据行。',ops:[],rows:0,unmatched:0};
    const ops=[];
    let unmatched=0;
    if(info.hasHeader){
      const identityColumns=info.keys.some(key=>key==='sku'||key==='product');
      const used=new Set();
      let sequentialIndex=0;
      dataRows.forEach(cells=>{
        const source={};
        info.keys.forEach((key,index)=>{if(key)source[key]=cells[index]??'';});
        let target=null;
        if(identityColumns){
          target=rowMatch(source,targets,used);
          if(!target){unmatched+=1;return;}
        }else{
          target=targets[sequentialIndex++]||null;
          if(!target){unmatched+=1;return;}
        }
        used.add(target);
        info.keys.forEach((key,index)=>{
          if(!writable.has(key))return;
          const input=field(target,key);
          if(input)ops.push({input,value:cells[index]??'',key});
        });
      });
      const mapped=[...new Set(info.keys.filter(key=>writable.has(key)))];
      const matched=dataRows.length-unmatched;
      const identityText=identityColumns?'按 SKU/产品匹配':'按当前可见行顺序';
      return {ok:ops.length>0,message:`检测到表头 · ${dataRows.length} 行 · ${identityText} · 匹配 ${matched} · 未匹配 ${unmatched} · 可写字段 ${mapped.join(' / ')||'0'}`,ops,rows:dataRows.length,unmatched};
    }
    if(!anchor||!writable.has(anchor.key))return {ok:false,message:'未检测到表头：请先点击数量/单价/交期/包装等起始格，再粘贴。产品和 SKU 不作为无表头写入起点。',ops:[],rows:dataRows.length,unmatched:0};
    const startRow=targets.indexOf(anchor.row);
    if(startRow<0)return {ok:false,message:'起始格当前被筛选隐藏，请先点击一个可见行中的起始格。',ops:[],rows:dataRows.length,unmatched:0};
    const firstFields=fields(anchor.row);
    const startField=firstFields.findIndex(input=>input.dataset.itemK===anchor.key);
    if(startField<0)return {ok:false,message:'没有找到起始列。',ops:[],rows:dataRows.length,unmatched:0};
    dataRows.forEach((cells,rowOffset)=>{
      const target=targets[startRow+rowOffset];
      if(!target){unmatched+=1;return;}
      const targetFields=fields(target);
      let fieldIndex=startField;
      cells.forEach(cellValue=>{
        while(fieldIndex<targetFields.length&&!writable.has(targetFields[fieldIndex].dataset.itemK||''))fieldIndex+=1;
        const input=targetFields[fieldIndex++];
        if(input)ops.push({input,value:cellValue,key:input.dataset.itemK||''});
      });
    });
    return {ok:ops.length>0,message:`无表头 · 从“${anchor.key}”起始 · ${dataRows.length} 行 · 超出当前可见行 ${unmatched}`,ops,rows:dataRows.length,unmatched};
  }
  function preview(){
    const plan=makePlan();
    status.textContent=plan.message;
    status.classList.toggle('hnd-paste-error',!plan.ok);
    fill.disabled=!plan.ok;
    overwrite.disabled=!plan.ok;
    return plan;
  }
  function apply(overwriteExisting){
    const plan=makePlan();
    if(!plan.ok){preview();return;}
    let changed=0,skipped=0;
    plan.ops.forEach(op=>{
      if(!overwriteExisting&&String(op.input.value||'').trim()){skipped+=1;return;}
      op.input.value=op.value;
      op.input.dispatchEvent(new Event('input',{bubbles:true}));
      op.input.dispatchEvent(new Event('change',{bubbles:true}));
      changed+=1;
    });
    status.classList.remove('hnd-paste-error');
    status.textContent=`已写入 ${changed} 格${skipped?` · 保留已有 ${skipped} 格`:''}${plan.unmatched?` · 未匹配 ${plan.unmatched} 行`:''}；尚未保存，请继续核对后使用原“保存草稿”。`;
  }
  area?.addEventListener('input',preview);
  fill?.addEventListener('click',()=>apply(false));
  overwrite?.addEventListener('click',()=>apply(true));
  clear?.addEventListener('click',()=>{if(area)area.value='';preview();area?.focus();});
  preview();
})();
</script>
"""


def decorate_native_document_paste(page: str) -> str:
    """Add Excel/TSV paste assistance to the existing multi-product grid.

    The tool mutates only existing form controls after an explicit user action.
    Product identity rows are never created, re-keyed or persisted by this layer;
    the existing native draft owner remains the only save path.
    """
    text = str(page or "")
    if PASTE_MARKER in text or "data-item-row" not in text or "data-hnd-grid-tools" not in text:
        return text
    if "</style>" in text:
        text = text.replace("</style>", _PASTE_STYLE + "</style>", 1)
    if "<div class='table-wrap'>" in text:
        text = text.replace("<div class='table-wrap'>", _PASTE_PANEL + "<div class='table-wrap'>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _PASTE_SCRIPT + "</body>", 1)
    return text


def install_native_document_paste(standalone_module: ModuleType) -> None:
    """Decorate the already-batched/grid native renderer exactly once."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_paste", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_paste(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_paste", True)
    setattr(wrapped, "_huidi_native_paste_original", original)
    standalone_module._document_html = wrapped
