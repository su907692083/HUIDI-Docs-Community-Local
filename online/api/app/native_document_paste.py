from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


PASTE_MARKER = "huidi-native-document-paste-v2"

_PASTE_STYLE = """
.hnd-paste{margin:0 0 8px;border:1px solid #e4e7ec;border-radius:8px;background:#fff}.hnd-paste>summary{cursor:pointer;padding:7px 9px;color:#344054;font-size:12px;font-weight:700;list-style:none}.hnd-paste>summary::-webkit-details-marker{display:none}.hnd-paste>summary:after{content:'⌄';float:right;color:#98a2b3}.hnd-paste[open]>summary:after{content:'⌃'}.hnd-paste-body{padding:0 9px 9px}.hnd-paste textarea{width:100%;min-height:92px;margin:0 0 7px;padding:7px 8px;border:1px solid #d0d5dd;border-radius:7px;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}.hnd-paste-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.hnd-paste-actions button{padding:6px 9px;border:1px solid #d0d5dd;background:#fff;color:#344054;font-size:12px}.hnd-paste-actions button:disabled{opacity:.45;cursor:not-allowed}.hnd-paste-status{min-width:260px;flex:1;color:#667085;font-size:11px}.hnd-paste-note{display:block;margin-top:6px;color:#8a6a1f;font-size:10px}.hnd-paste-error{color:#b42318!important}.hnd-paste-issues{display:none;margin:7px 0 0;padding:7px 9px;border:1px solid #fedf89;border-radius:7px;background:#fffaeb;color:#854a0e;font-size:10px;line-height:1.45}.hnd-paste-issues[data-show='1']{display:block}.hnd-paste-issues b{display:block;margin-bottom:3px}.hnd-paste-issues ul{margin:0;padding-left:17px}.hnd-paste-issues .hnd-paste-block{color:#b42318}.hnd-paste-cell-warning{outline:1px solid #fdb022!important;outline-offset:-1px}
@media print{.hnd-paste{display:none!important}}
"""

_PASTE_PANEL = """
<details class='hnd-paste' data-hnd-paste>
  <summary>批量粘贴 Excel / 旧表格</summary>
  <div class='hnd-paste-body'>
    <textarea data-hnd-paste-text placeholder='从 Excel 复制后粘贴这里。支持表头或前置标题：SKU、产品、规格、QTY(PCS)、Unit Price(USD)、金额、交期、箱数、N.W.(KG)、G.W.(KG)、Carton Size(CM)、CBM、唛头。'></textarea>
    <div class='hnd-paste-actions'>
      <button type='button' data-hnd-paste-fill disabled>填到目标空白</button>
      <button type='button' data-hnd-paste-overwrite disabled>覆盖目标字段</button>
      <button type='button' data-hnd-paste-clear>清空</button>
      <span class='hnd-paste-status' data-hnd-paste-status>粘贴后先核对解析结果；不会自动保存。</span>
    </div>
    <div class='hnd-paste-issues' data-hnd-paste-issues></div>
    <small class='hnd-paste-note'>系统只规范化明确无歧义的千分位、PCS/CTNS、KG、CBM 等格式；逗号小数、未知单位等会标成“需核对”并跳过。SKU/产品始终只用于匹配现有产品行，不改产品身份，也不会新增产品行或自动保存。</small>
  </div>
</details>
"""

_PASTE_SCRIPT = r"""
<script id='huidi-native-document-paste-v2'>
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
  const issuesBox=panel.querySelector('[data-hnd-paste-issues]');
  const aliases=new Map();
  const add=(key,names)=>names.forEach(name=>aliases.set(headerNorm(name),key));
  function norm(value){return String(value||'').trim().toLocaleLowerCase().replace(/[\s_\-\/]+/g,'');}
  function headerNorm(value){return String(value||'').trim().toLocaleLowerCase().replace(/[\s_\-\/\\.()（）\[\]{}:：]+/g,'');}
  add('product',['产品','产品名称','品名','product','product name','item','item name','name']);
  add('sku',['sku','型号','货号','产品编号','item no','item number','model']);
  add('spec',['规格','规格参数','描述','spec','specification','description']);
  add('quantity',['数量','qty','quantity','qty pcs','quantity pcs']);
  add('unit_price',['单价','价格','unit price','unitprice','price']);
  add('total',['金额','总价','amount','total','line total']);
  add('lead_time',['交期','交货期','lead time','leadtime','delivery','delivery time']);
  add('packages',['包装件数','箱数','件数','cartons','ctns','packages','package qty']);
  add('net_weight',['净重','nw','n.w.','net weight','netweight']);
  add('gross_weight',['毛重','gw','g.w.','gross weight','grossweight']);
  add('carton_size',['箱规','外箱尺寸','carton size','cartonsize']);
  add('volume',['体积','cbm','volume']);
  add('marks',['唛头','shipping marks','shippingmarks','marks']);
  const writable=new Set(['spec','quantity','unit_price','total','lead_time','packages','net_weight','gross_weight','carton_size','volume','marks']);
  const numericKeys=new Set(['quantity','unit_price','total','packages','net_weight','gross_weight','volume']);
  const labels={spec:'规格',quantity:'数量',unit_price:'单价',total:'金额',lead_time:'交期',packages:'箱数',net_weight:'净重',gross_weight:'毛重',carton_size:'箱规',volume:'CBM',marks:'唛头'};
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
  function headerKey(value){
    const h=headerNorm(value);
    if(!h)return '';
    if(aliases.has(h))return aliases.get(h)||'';
    if(/(?:sku|itemno|itemnumber|货号|型号|产品编号)/.test(h))return 'sku';
    if(/(?:productname|itemname|产品名称|品名)/.test(h))return 'product';
    if(/(?:specification|spec|description|规格参数|规格|描述)/.test(h))return 'spec';
    if(/(?:netweight|净重|^nw)/.test(h))return 'net_weight';
    if(/(?:grossweight|毛重|^gw)/.test(h))return 'gross_weight';
    if(/(?:cartonsize|外箱尺寸|箱规)/.test(h))return 'carton_size';
    if(/(?:shippingmarks|唛头|marks)/.test(h))return 'marks';
    if(/(?:packageqty|packages|cartons|ctns|包装件数|箱数)/.test(h))return 'packages';
    if(/(?:unitprice|单价)/.test(h))return 'unit_price';
    if(/(?:linetotal|amount|总价|金额)/.test(h))return 'total';
    if(/(?:leadtime|deliverytime|交货期|交期)/.test(h))return 'lead_time';
    if(/(?:quantity|qty|数量)/.test(h))return 'quantity';
    if(/(?:cbm|volume|体积)/.test(h))return 'volume';
    if(/^(?:product|item|name)$/.test(h))return 'product';
    if(/^price/.test(h))return 'unit_price';
    return '';
  }
  function currencies(value){
    const found=String(value||'').toUpperCase().match(/\b(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|AED)\b/g)||[];
    return [...new Set(found)];
  }
  function headerInfo(matrix){
    const headerCandidates=Math.min(matrix.length,5);
    let best={hasHeader:false,keys:[],headerIndex:-1,recognized:0,currencies:[]};
    for(let index=0;index<headerCandidates;index+=1){
      const cells=matrix[index]||[];
      const keys=cells.map(headerKey);
      const unique=new Set(keys.filter(Boolean));
      const recognized=keys.filter(Boolean).length;
      const useful=keys.some(key=>['product','sku','quantity','unit_price','packages','net_weight','gross_weight'].includes(key));
      if(recognized>=2&&unique.size>=2&&useful&&recognized>best.recognized){
        best={hasHeader:true,keys,headerIndex:index,recognized,currencies:[...new Set(cells.flatMap(currencies))]};
      }
    }
    return best;
  }
  function rowMatch(source,targetRows,used){
    const sku=identity(source.sku);
    const product=identity(source.product);
    let match=null;
    if(sku)match=targetRows.find(row=>!used.has(row)&&identity(field(row,'sku')?.value)===sku)||null;
    if(!match&&product)match=targetRows.find(row=>!used.has(row)&&identity(field(row,'product')?.value)===product)||null;
    return match;
  }
  function issue(row,key,message,blocking=true,input=null){return {row,key,message,blocking,input};}
  function normalizeNumber(key,raw,rowNumber,input){
    const original=String(raw??'').trim();
    if(!original)return {safe:true,value:'',issues:[]};
    let text=original.replace(/[，]/g,',').replace(/[．]/g,'.').replace(/\s+/g,'');
    const foundIssues=[];
    const currencyMarks=text.match(/(?:US\$|RMB|CNY|USD|EUR|GBP|JPY|AUD|CAD|HKD|AED|[$€£¥￥])/gi)||[];
    if((key==='unit_price'||key==='total')&&currencyMarks.length){
      foundIssues.push(issue(rowNumber,key,`${labels[key]}带货币标记 ${[...new Set(currencyMarks)].join('/')}，请确认与单据币种一致。`,false,input));
      text=text.replace(/(?:US\$|RMB|CNY|USD|EUR|GBP|JPY|AUD|CAD|HKD|AED|[$€£¥￥])/gi,'');
    }
    if(key==='quantity')text=text.replace(/(?:pcs?|pieces?|sets?|units?|件|套)$/i,'');
    if(key==='packages')text=text.replace(/(?:cartons?|ctns?|boxes?|packages?|箱|件)$/i,'');
    if(key==='net_weight'||key==='gross_weight'){
      if(/(?:kg|kgs|公斤|千克)$/i.test(text))text=text.replace(/(?:kg|kgs|公斤|千克)$/i,'');
      else if(/[a-zA-Z一-鿿]+$/.test(text))return {safe:false,value:original,issues:[...foundIssues,issue(rowNumber,key,`${labels[key]}“${original}”含非 KG 单位，未自动换算。`,true,input)]};
    }
    if(key==='volume'){
      if(/(?:cbm|m3|m³|立方米)$/i.test(text))text=text.replace(/(?:cbm|m3|m³|立方米)$/i,'');
      else if(/[a-zA-Z一-鿿]+$/.test(text))return {safe:false,value:original,issues:[...foundIssues,issue(rowNumber,key,`CBM“${original}”含未知单位，未自动换算。`,true,input)]};
    }
    text=text.replace(/\s+/g,'');
    if(/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))text=text.replace(/,/g,'');
    else if(/^[-+]?\d+,\d{1,2}$/.test(text))return {safe:false,value:original,issues:[...foundIssues,issue(rowNumber,key,`${labels[key]}“${original}”可能是逗号小数，存在歧义，已跳过。`,true,input)]};
    else if(text.includes(','))return {safe:false,value:original,issues:[...foundIssues,issue(rowNumber,key,`${labels[key]}“${original}”的逗号格式无法安全识别，已跳过。`,true,input)]};
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(text))return {safe:false,value:original,issues:[...foundIssues,issue(rowNumber,key,`${labels[key]}“${original}”不是可安全识别的数字，已跳过。`,true,input)]};
    return {safe:true,value:text,issues:foundIssues};
  }
  function normalizedValue(key,raw,rowNumber,input){
    if(!numericKeys.has(key))return {safe:true,value:String(raw??'').trim(),issues:[]};
    return normalizeNumber(key,raw,rowNumber,input);
  }
  function makePlan(){
    const matrix=splitMatrix(area?.value);
    if(!matrix.length)return {ok:false,message:'请先粘贴 Excel / 表格内容。',ops:[],rows:0,unmatched:0,issues:[]};
    const info=headerInfo(matrix);
    const targets=visibleRows();
    if(!targets.length)return {ok:false,message:'当前筛选下没有可见产品行。',ops:[],rows:0,unmatched:0,issues:[]};
    const dataRows=info.hasHeader?matrix.slice(info.headerIndex+1):matrix;
    if(!dataRows.length)return {ok:false,message:'检测到表头，但没有数据行。',ops:[],rows:0,unmatched:0,issues:[]};
    const ops=[];
    const issues=[];
    let unmatched=0;
    if(info.hasHeader){
      info.currencies.forEach(code=>issues.push(issue(info.headerIndex+1,'unit_price',`表头检测到币种 ${code}，请确认与当前正式单据币种一致。`,false,null)));
      const identityColumns=info.keys.some(key=>key==='sku'||key==='product');
      const used=new Set();
      let sequentialIndex=0;
      dataRows.forEach((cells,dataIndex)=>{
        const rowNumber=info.headerIndex+2+dataIndex;
        const source={};
        info.keys.forEach((key,index)=>{if(key)source[key]=cells[index]??'';});
        let target=null;
        if(identityColumns){
          target=rowMatch(source,targets,used);
          if(!target){
            unmatched+=1;
            issues.push(issue(rowNumber,'product',`第 ${rowNumber} 行的 SKU/产品未匹配当前可见产品，已跳过整行。`,true,null));
            return;
          }
        }else{
          target=targets[sequentialIndex++]||null;
          if(!target){unmatched+=1;issues.push(issue(rowNumber,'product',`第 ${rowNumber} 行超出当前可见产品范围，已跳过。`,true,null));return;}
        }
        used.add(target);
        info.keys.forEach((key,index)=>{
          if(!writable.has(key))return;
          const input=field(target,key);
          if(!input)return;
          const normalized=normalizedValue(key,cells[index]??'',rowNumber,input);
          issues.push(...normalized.issues);
          if(normalized.safe)ops.push({input,value:normalized.value,key,rowNumber});
        });
      });
      const mapped=[...new Set(info.keys.filter(key=>writable.has(key)))];
      const matched=dataRows.length-unmatched;
      const identityText=identityColumns?'按 SKU/产品匹配':'按当前可见行顺序';
      const blocked=issues.filter(item=>item.blocking).length;
      return {ok:ops.length>0,message:`表头第 ${info.headerIndex+1} 行 · 数据 ${dataRows.length} 行 · ${identityText} · 匹配 ${matched} · 未匹配 ${unmatched} · 可写 ${mapped.join(' / ')||'0'}${blocked?` · 需核对 ${blocked}`:''}`,ops,rows:dataRows.length,unmatched,issues};
    }
    if(!anchor||!writable.has(anchor.key))return {ok:false,message:'未检测到表头：请先点击数量/单价/交期/包装等起始格，再粘贴。产品和 SKU 不作为无表头写入起点。',ops:[],rows:dataRows.length,unmatched:0,issues:[]};
    const startRow=targets.indexOf(anchor.row);
    if(startRow<0)return {ok:false,message:'起始格当前被筛选隐藏，请先点击一个可见行中的起始格。',ops:[],rows:dataRows.length,unmatched:0,issues:[]};
    const firstFields=fields(anchor.row);
    const startField=firstFields.findIndex(input=>input.dataset.itemK===anchor.key);
    if(startField<0)return {ok:false,message:'没有找到起始列。',ops:[],rows:dataRows.length,unmatched:0,issues:[]};
    dataRows.forEach((cells,rowOffset)=>{
      const rowNumber=rowOffset+1;
      const target=targets[startRow+rowOffset];
      if(!target){unmatched+=1;issues.push(issue(rowNumber,'product',`粘贴第 ${rowNumber} 行超出当前可见产品范围，已跳过。`,true,null));return;}
      const targetFields=fields(target);
      let fieldIndex=startField;
      cells.forEach(cellValue=>{
        while(fieldIndex<targetFields.length&&!writable.has(targetFields[fieldIndex].dataset.itemK||''))fieldIndex+=1;
        const input=targetFields[fieldIndex++];
        if(!input)return;
        const key=input.dataset.itemK||'';
        const normalized=normalizedValue(key,cellValue,rowNumber,input);
        issues.push(...normalized.issues);
        if(normalized.safe)ops.push({input,value:normalized.value,key,rowNumber});
      });
    });
    const blocked=issues.filter(item=>item.blocking).length;
    return {ok:ops.length>0,message:`无表头 · 从“${anchor.key}”起始 · ${dataRows.length} 行 · 超出当前可见行 ${unmatched}${blocked?` · 需核对 ${blocked}`:''}`,ops,rows:dataRows.length,unmatched,issues};
  }
  function renderIssues(plan){
    document.querySelectorAll('.hnd-paste-cell-warning').forEach(node=>node.classList.remove('hnd-paste-cell-warning'));
    (plan.issues||[]).forEach(item=>item.input?.classList?.add('hnd-paste-cell-warning'));
    if(!issuesBox)return;
    const items=(plan.issues||[]).slice(0,8);
    if(!items.length){issuesBox.dataset.show='0';issuesBox.innerHTML='';return;}
    const more=(plan.issues||[]).length-items.length;
    issuesBox.dataset.show='1';
    issuesBox.innerHTML=`<b>粘贴核对提示 ${plan.issues.length} 项</b><ul>${items.map(item=>`<li class="${item.blocking?'hnd-paste-block':''}">${escapeHtml(item.message)}</li>`).join('')}${more?`<li>还有 ${more} 项未展开，请优先处理标红/标黄字段。</li>`:''}</ul>`;
  }
  function escapeHtml(value){const div=document.createElement('div');div.textContent=String(value||'');return div.innerHTML;}
  function preview(){
    const plan=makePlan();
    status.textContent=plan.message;
    status.classList.toggle('hnd-paste-error',!plan.ok);
    fill.disabled=!plan.ok;
    overwrite.disabled=!plan.ok;
    renderIssues(plan);
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
    const blocked=(plan.issues||[]).filter(item=>item.blocking).length;
    status.classList.remove('hnd-paste-error');
    status.textContent=`已写入 ${changed} 格${skipped?` · 保留已有 ${skipped} 格`:''}${plan.unmatched?` · 未匹配 ${plan.unmatched} 行`:''}${blocked?` · 跳过歧义 ${blocked} 项`:''}；尚未保存，请继续核对后使用原“保存草稿”。`;
    renderIssues(plan);
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
    """Add bounded Excel/TSV paste assistance to the existing multi-product grid.

    The tool mutates only existing form controls after an explicit user action.
    Product identity rows are never created, re-keyed or persisted by this layer;
    ambiguous numeric/unit formats are reported and skipped rather than guessed.
    The existing native draft owner remains the only save path.
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
