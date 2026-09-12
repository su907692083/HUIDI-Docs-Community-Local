(()=>{'use strict';
if(window.HUIDIOnlineCatalog)return;

const $=s=>document.querySelector(s);
const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='huidi_online_catalog_page_v2';
const PAGE_SIZE=50;
const MAX_SELECTED=500;
const DEAL_MAX=100;

let rows=[];
let selected=new Set();
let selectedRows=new Map();
let pageMeta={page:1,pages:1,total:0,page_size:PAGE_SIZE};
let query='';
let loadSerial=0;
let hydrateSerial=0;
let defaultsApplied=false;
let mounted=false;
let refreshing=null;

function css(){
  if($('#huidiOnlineCatalogCss'))return;
  const s=document.createElement('style');
  s.id='huidiOnlineCatalogCss';
  s.textContent=`
.hoc{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;min-height:calc(100vh - 125px)}
.hoc-side,.hoc-main{background:#fff;border:1px solid #e0e7ef;border-radius:12px;min-width:0}
.hoc-side{padding:14px;overflow:auto}.hoc-main{padding:16px;overflow:auto}
.hoc-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.hoc-title h2{font-size:15px;margin:0}.hoc-title h2 small{font-size:8px;color:#7b8999;font-weight:700;margin-left:5px}
.hoc-actions,.hoc-toolbar,.hoc-context-actions{display:flex;gap:6px;flex-wrap:wrap}
.hoc-btn{border:1px solid #d8e1ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:800;color:#38516d;cursor:pointer}
.hoc-btn.primary{background:#1d63e9;border-color:#1d63e9;color:#fff}.hoc-btn:disabled{opacity:.42;cursor:default}
.hoc-search,.hoc-field{width:100%;height:34px;border:1px solid #d8e1ec;border-radius:8px;padding:0 9px;font:inherit;font-size:10px}
.hoc-list{display:grid;gap:6px;margin-top:10px}
.hoc-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;border:1px solid #e5eaf0;border-radius:9px;padding:8px;background:#fbfcfe}
.hoc-item b{display:block;font-size:10px;color:#314a68}.hoc-item small{display:block;margin-top:2px;color:#7c8998;font-size:8.5px;line-height:1.45}
.hoc-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid #edf1f5}
.hoc-pager small{font-size:8.5px;color:#728196}.hoc-pager span{display:flex;gap:5px}
.hoc-context{margin:0 0 12px;padding:10px 11px;border:1px solid #dce6f3;border-radius:10px;background:#f8fbff;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}
.hoc-context-copy{min-width:180px;flex:1}.hoc-context-copy b{display:block;font-size:10px;color:#314a68}.hoc-context-copy small{display:block;margin-top:2px;font-size:8.5px;color:#718197;line-height:1.45}.hoc-sync{font-size:8.5px;color:#718197}.hoc-sync.ok{color:#25724a}.hoc-sync.warn{color:#8a6a2f}
.hoc-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
.hoc-settings label{font-size:9px;font-weight:800;color:#64758b}.hoc-settings input{display:block;margin-top:4px}.hoc-settings .full{grid-column:1/-1}
.hoc-toolbar{margin-bottom:12px}.hoc-preview{border:1px solid #dfe6ee;background:#f2f4f7;border-radius:11px;padding:14px}
.hoc-paper{background:#fff;max-width:900px;margin:0 auto;padding:34px 38px;min-height:980px;box-shadow:0 8px 26px rgba(24,39,75,.08)}
.hoc-cover{text-align:center;padding:36px 0 28px;border-bottom:1px solid #e7ebf0}.hoc-cover h1{font-size:28px;margin:0}.hoc-cover h3{font-size:14px;color:#52657b;margin:8px 0 0}.hoc-cover p{font-size:10px;color:#7a8798}
.hoc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:22px}
.hoc-card{border:1px solid #e0e6ed;border-radius:10px;overflow:hidden;break-inside:avoid;background:#fff}
.hoc-image{height:180px;background:#f3f5f8;display:grid;place-items:center;overflow:hidden;color:#9aa5b1;font-size:10px}.hoc-image img{width:100%;height:100%;object-fit:contain}
.hoc-copy{padding:11px 12px}.hoc-copy h3{font-size:13px;margin:0 0 5px;color:#243a55;overflow-wrap:anywhere}.hoc-copy p{font-size:9px;color:#607186;margin:4px 0;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap}
.hoc-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.hoc-tags span{font-size:8px;background:#f0f4f8;color:#536a82;border-radius:999px;padding:3px 6px}
.hoc-empty{padding:28px 12px;text-align:center;color:#8190a2;font-size:10px}.hoc-ref{color:#8a6a2f!important}
@media(max-width:900px){.hoc{grid-template-columns:1fr}.hoc-side{max-height:420px}.hoc-settings,.hoc-grid{grid-template-columns:1fr}.hoc-settings .full{grid-column:auto}.hoc-paper{padding:22px 18px}}
@media print{body.hoc-print .side,body.hoc-print .hpr-head,body.hoc-print .hoc-side,body.hoc-print .hoc-settings,body.hoc-print .hoc-toolbar,body.hoc-print .hoc-context{display:none!important}body.hoc-print .app,body.hoc-print .main,body.hoc-print #huidiPageHost,body.hoc-print #huidiPageMount,body.hoc-print .hoc,body.hoc-print .hoc-main,body.hoc-print .hoc-preview{display:block!important;margin:0!important;padding:0!important;border:0!important;background:#fff!important}body.hoc-print .hoc-paper{max-width:none!important;box-shadow:none!important;min-height:auto!important;padding:12mm!important}.hoc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hoc-card{break-inside:avoid-page;page-break-inside:avoid}}
`;
  document.head.appendChild(s);
}

function imageOf(x){
  const direct=[x.main_image,x.image_url,x.image,x.cover_image,x.cover,x.thumbnail,x.photo_url].map(clean).find(Boolean);
  if(direct)return direct;
  for(const key of ['images','pictures','photos','media']){
    const value=x[key];
    if(!Array.isArray(value)||!value.length)continue;
    const first=value[0];
    if(typeof first==='string'&&clean(first))return clean(first);
    if(first&&typeof first==='object'){
      const src=clean(first.url||first.src||first.image_url);
      if(src)return src;
    }
  }
  return'';
}

function keyOf(x){
  const stable=clean(x?.brain_id||x?.id||x?.local_product_id);
  if(stable)return stable;
  const sku=clean(x?.sku||x?.model);
  if(sku)return`sku:${sku.toLowerCase()}`;
  const name=clean(x?.name||x?.title);
  return name?`name:${name.toLowerCase()}`:'';
}

function aliasesOf(x){
  const values=[x?.brain_id,x?.id,x?.local_product_id].map(clean).filter(Boolean);
  const sku=clean(x?.sku||x?.model);
  const name=clean(x?.name||x?.title);
  if(sku)values.push(`sku:${sku.toLowerCase()}`);
  if(name)values.push(`name:${name.toLowerCase()}`);
  return[...new Set(values)];
}

function state(){
  try{
    const value=JSON.parse(localStorage.getItem(KEY)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch(_){return{}}
}

function save(extra={}){
  const previous=state();
  delete previous.selected_items;
  const next={...previous,...extra,selected:[...selected].slice(0,MAX_SELECTED)};
  localStorage.setItem(KEY,JSON.stringify(next));
  return next;
}

function restoreSelections(saved){
  const legacyItems=Array.isArray(saved?.selected_items)?saved.selected_items.slice(0,MAX_SELECTED):[];
  const legacyMap=new Map();
  for(const row of legacyItems){
    const current=keyOf(row);
    const old=clean(row?.brain_id||row?.id||row?.local_product_id||row?.sku||row?.name).toLowerCase();
    if(current&&old)legacyMap.set(old,current);
  }
  const values=Array.isArray(saved?.selected)?saved.selected.slice(0,MAX_SELECTED):[];
  selected=new Set(values.map(raw=>{
    const value=clean(raw);
    return legacyMap.get(value.toLowerCase())||value;
  }).filter(Boolean));
  selectedRows=new Map();
}

function remember(row){
  const key=keyOf(row);
  if(!key)return'';
  const aliases=aliasesOf(row);
  const lowerAliases=new Set(aliases.map(value=>value.toLowerCase()));
  for(const old of [...selected]){
    if(old===key)continue;
    if(lowerAliases.has(String(old).toLowerCase())){
      selected.delete(old);
      selected.add(key);
    }
  }
  if(selected.has(key))selectedRows.set(key,row);
  return key;
}

function inputs(){
  return{
    company:clean($('#hocCompany')?.value),
    title:clean($('#hocTitle')?.value)||'产品目录',
    contact:clean($('#hocContact')?.value),
    showPrice:Boolean($('#hocPrice')?.checked)
  };
}

function defaultContact(company){
  return[clean(company?.email),clean(company?.phone),clean(company?.website)].filter(Boolean).join(' · ');
}

function selectedProducts(){
  return[...selected].map(key=>selectedRows.get(key)).filter(Boolean);
}

function card(x,showPrice){
  const image=imageOf(x);
  const name=clean(x.name||x.title);
  const sku=clean(x.sku||x.model);
  const spec=clean(x.spec||x.specification||x.description);
  const category=[clean(x.category),clean(x.series)].filter(Boolean).join(' / ');
  const moq=clean(x.moq);
  const lead=clean(x.lead_time||x.delivery_time);
  const price=clean(x.price_range)||(x.price!==undefined&&x.price!==null&&String(x.price).trim()?`${clean(x.currency)||'USD'} ${x.price} / ${clean(x.unit)||'PCS'}`:'');
  const tags=[];
  if(moq)tags.push(`MOQ ${moq}`);
  if(lead)tags.push(`交期 ${lead}`);
  for(const value of (Array.isArray(x.certifications)?x.certifications:[]).slice(0,3))if(clean(value))tags.push(clean(value));
  return`<article class="hoc-card" data-hoc-product-card="${esc(keyOf(x))}"><div class="hoc-image">${image?`<img src="${esc(image)}" alt="${esc(name)}" onerror="this.remove();this.parentElement.textContent='暂无产品图片'">`:'暂无产品图片'}</div><div class="hoc-copy"><h3>${esc(name)}</h3>${sku?`<p>型号 / SKU：${esc(sku)}</p>`:''}${category?`<p>${esc(category)}</p>`:''}${spec?`<p>${esc(spec)}</p>`:''}${showPrice&&price?`<p class="hoc-ref">参考价：${esc(price)}（仅供目录展示核对，不写入正式报价）</p>`:''}<div class="hoc-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></article>`;
}

function renderPreview(){
  const box=$('#hocPreview');
  if(!box)return;
  const cfg=inputs();
  const picked=selectedProducts();
  save(cfg);
  box.innerHTML=`<div class="hoc-paper" id="hocPaper"><section class="hoc-cover"><h1>${esc(cfg.company||'产品目录')}</h1><h3>${esc(cfg.title)}</h3>${cfg.contact?`<p>${esc(cfg.contact)}</p>`:''}<p>${new Date().toLocaleDateString('zh-CN')}</p></section>${picked.length?`<section class="hoc-grid">${picked.map(x=>card(x,cfg.showPrice)).join('')}</section>`:`<div class="hoc-empty">${selected.size?'正在同步已选产品的最新资料…':'从左侧选择产品后会自动更新目录预览。'}</div>`}</div>`;
}

function renderPager(){
  const box=$('#hocPager');
  if(!box)return;
  const current=Number(pageMeta.page||1),pages=Number(pageMeta.pages||1);
  box.innerHTML=`<small>共 ${Number(pageMeta.total||0)} 个产品 · 第 ${current}/${pages} 页</small><span><button class="hoc-btn" data-hoc-prev ${current<=1?'disabled':''}>上一页</button><button class="hoc-btn" data-hoc-next ${current>=pages?'disabled':''}>下一页</button></span>`;
  box.querySelector('[data-hoc-prev]')?.addEventListener('click',()=>loadProducts(current-1,query));
  box.querySelector('[data-hoc-next]')?.addEventListener('click',()=>loadProducts(current+1,query));
}

function renderList(){
  const box=$('#hocList');
  if(!box)return;
  const count=$('#hocCount');
  if(count)count.textContent=`${selected.size} 已选 / ${Number(pageMeta.total||0)}`;
  if(!rows.length){
    box.innerHTML=`<div class="hoc-empty">${pageMeta.total?'没有匹配产品。':'还没有产品资料。'}${pageMeta.total?'':'<div style="margin-top:9px"><button class="hoc-btn" data-hoc-go-product>去建立产品资料</button></div>'}</div>`;
    box.querySelector('[data-hoc-go-product]')?.addEventListener('click',()=>window.HUIDIWorkspacePages?.open?.('product'));
    renderPager();
    return;
  }
  box.innerHTML=rows.map(x=>{
    const key=remember(x)||keyOf(x);
    return`<label class="hoc-item"><input type="checkbox" data-hoc-select="${esc(key)}" ${selected.has(key)?'checked':''}><span><b>${esc(x.name||x.title)}</b><small>${esc([x.sku,x.category,x.series].filter(Boolean).join(' · ')||'未填写型号 / 分类')}</small></span></label>`;
  }).join('');
  box.querySelectorAll('[data-hoc-select]').forEach(control=>control.onchange=()=>{
    const row=rows.find(x=>keyOf(x)===control.dataset.hocSelect);
    if(control.checked){
      if(selected.size>=MAX_SELECTED&&!selected.has(control.dataset.hocSelect)){
        control.checked=false;
        alert(`单个目录最多选择 ${MAX_SELECTED} 个产品`);
        return;
      }
      selected.add(control.dataset.hocSelect);
      if(row)remember(row);
    }else{
      selected.delete(control.dataset.hocSelect);
      selectedRows.delete(control.dataset.hocSelect);
    }
    save();
    renderList();
    renderPreview();
  });
  renderPager();
}

function localPage(nextPage,nextQuery){
  const all=Array.isArray(window.HUIDIProductBrain?.list?.())?window.HUIDIProductBrain.list():[];
  const q=clean(nextQuery).toLowerCase();
  const filtered=all.filter(x=>!q||[x.name,x.sku,x.category,x.series,x.spec].some(v=>clean(v).toLowerCase().includes(q)));
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page=Math.max(1,Math.min(Number(nextPage||1),pages));
  const start=(page-1)*PAGE_SIZE;
  return{items:filtered.slice(start,start+PAGE_SIZE),page,pages,page_size:PAGE_SIZE,total:filtered.length,q:clean(nextQuery),offline:true};
}

async function api(url,opt={}){
  const response=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},credentials:'same-origin',...opt});
  if(!response.ok)throw new Error(await response.text()||response.statusText);
  return response.json();
}

async function fetchPage(nextPage,nextQuery){
  const params=new URLSearchParams({paged:'1',page:String(nextPage||1),page_size:String(PAGE_SIZE)});
  const q=clean(nextQuery);
  if(q)params.set('q',q);
  const out=await api(`/api/product-brains?${params.toString()}`);
  if(!out||!Array.isArray(out.items))throw new Error('产品分页响应格式异常');
  return out;
}

async function fetchRowsByIds(ids){
  const values=[...new Set((ids||[]).map(clean).filter(Boolean))];
  if(!values.length)return[];
  const found=[];
  for(let index=0;index<values.length;index+=80){
    const chunk=values.slice(index,index+80);
    const params=new URLSearchParams({paged:'1',page:'1',page_size:'100',ids:chunk.join(',')});
    const out=await api(`/api/product-brains?${params.toString()}`);
    if(!out||!Array.isArray(out.items))throw new Error('产品身份同步响应格式异常');
    found.push(...out.items);
  }
  return found;
}

function mapSelectedRows(requested,latest,{prune=true}={}){
  const requestedValues=[...requested];
  const requestedLower=new Map(requestedValues.map(value=>[String(value).toLowerCase(),value]));
  const nextSelected=new Set();
  const nextRows=new Map();
  for(const row of latest){
    const aliases=aliasesOf(row);
    const matches=aliases.some(value=>requested.has(value)||requestedLower.has(value.toLowerCase()));
    if(!matches)continue;
    const key=keyOf(row);
    if(!key)continue;
    nextSelected.add(key);
    nextRows.set(key,row);
  }
  if(!prune){
    for(const value of requestedValues)if(![...nextSelected].some(key=>String(key).toLowerCase()===String(value).toLowerCase()))nextSelected.add(value);
    for(const [key,row] of selectedRows.entries())if(nextSelected.has(key)&&!nextRows.has(key))nextRows.set(key,row);
  }
  selected=nextSelected;
  selectedRows=nextRows;
}

async function hydrateSelected({prune=true}={}){
  const run=++hydrateSerial;
  const requested=new Set([...selected]);
  if(!requested.size){selectedRows.clear();renderPreview();return true}
  try{
    const latest=await fetchRowsByIds([...requested]);
    if(run!==hydrateSerial)return false;
    mapSelectedRows(requested,latest,{prune});
    save();
    renderList();
    renderPreview();
    return true;
  }catch(_){
    if(run!==hydrateSerial)return false;
    const local=Array.isArray(window.HUIDIProductBrain?.list?.())?window.HUIDIProductBrain.list():[];
    const hits=local.filter(row=>aliasesOf(row).some(value=>requested.has(value)||[...requested].some(saved=>String(saved).toLowerCase()===value.toLowerCase())));
    mapSelectedRows(requested,hits,{prune:false});
    renderList();
    renderPreview();
    return false;
  }
}

async function loadProducts(nextPage=1,nextQuery=query,{quiet=false}={}){
  const serial=++loadSerial;
  const list=$('#hocList');
  if(list&&!quiet)list.innerHTML='<div class="hoc-empty">正在读取产品资料…</div>';
  let out;
  try{out=await fetchPage(nextPage,nextQuery)}catch(_){out=localPage(nextPage,nextQuery)}
  if(serial!==loadSerial)return;
  query=clean(nextQuery);
  pageMeta={page:Number(out.page||1),pages:Number(out.pages||1),page_size:Number(out.page_size||PAGE_SIZE),total:Number(out.total||0)};
  rows=Array.isArray(out.items)?out.items:[];
  for(const row of rows)remember(row);
  if(!defaultsApplied){
    defaultsApplied=true;
    if(!selected.size){
      rows.slice(0,Math.min(6,rows.length)).forEach(row=>{
        const key=keyOf(row);
        if(key){selected.add(key);remember(row)}
      });
    }
  }
  renderList();
  renderPreview();
}

function currentDeal(){
  const id=clean(window.HUIDIBusinessContext?.dealId?.()||window.HUIDIDocumentEntryConnectivity?.dealId?.());
  const snapshot=window.HUIDIBusinessContext?.deal?.()||null;
  return{id,snapshot};
}

function renderContext(message='',level=''){
  const box=$('#hocContext');
  if(!box)return;
  const {id,snapshot}=currentDeal();
  const buyer=clean(snapshot?.customer?.company_name||snapshot?.customer?.name);
  const title=clean(snapshot?.title||snapshot?.product_keyword);
  const sync=message||'目录选择只保存产品身份；产品名称、规格、分类和图片始终从正式产品资料重新读取。';
  box.innerHTML=`<div class="hoc-context-copy"><b>${id?`当前询盘 #${esc(id)}${buyer?` · ${esc(buyer)}`:''}`:'当前没有打开询盘'}</b><small>${id?(title?esc(title):'可把目录所选产品与这笔询盘同步，后续报价 / PI / 合同 / CI / 装箱单继续复用同一产品关联。'):'先从客户 / 询盘进入一笔业务，再打开产品目录即可联通。'}</small><span class="hoc-sync ${esc(level)}" id="hocSyncState">${esc(sync)}</span></div><div class="hoc-context-actions"><button class="hoc-btn" data-hoc-load-deal ${id?'':'disabled'}>载入询盘产品</button><button class="hoc-btn" data-hoc-sync-deal ${id?'':'disabled'}>同步目录选择到询盘</button><button class="hoc-btn" data-hoc-documents ${id?'':'disabled'}>单据工作台</button></div>`;
  box.querySelector('[data-hoc-load-deal]')?.addEventListener('click',loadDealSelection);
  box.querySelector('[data-hoc-sync-deal]')?.addEventListener('click',syncDealSelection);
  box.querySelector('[data-hoc-documents]')?.addEventListener('click',openDocuments);
}

function setSyncState(text,level=''){
  const node=$('#hocSyncState');
  if(!node)return;
  node.textContent=text;
  node.className=`hoc-sync ${level}`.trim();
}

async function loadDealSelection(){
  const {id}=currentDeal();
  if(!id)return;
  setSyncState('正在读取当前询盘的产品关联…');
  try{
    const out=await api(`/api/business/deals/${encodeURIComponent(id)}/products?limit=100`);
    const linked=new Set((Array.isArray(out.selected)?out.selected:[]).map(clean).filter(Boolean));
    selected=linked;
    selectedRows=new Map();
    defaultsApplied=true;
    await hydrateSelected({prune:true});
    save();
    renderContext(`已载入当前询盘的 ${selected.size} 个产品。`,'ok');
  }catch(error){renderContext(`载入询盘产品失败：${clean(error?.message||error)}`,'warn')}
}

async function syncDealSelection(){
  const {id}=currentDeal();
  if(!id)return;
  await hydrateSelected({prune:true});
  const products=selectedProducts();
  if(products.length!==selected.size){alert('仍有已选产品没有完成最新资料同步，请先点击“刷新产品”。');return}
  if(products.length>DEAL_MAX){alert(`单笔询盘最多关联 ${DEAL_MAX} 个产品；当前目录选择 ${products.length} 个。`);return}
  const productIds=products.map(row=>clean(row.local_product_id||row.brain_id||row.id)).filter(Boolean);
  if(!confirm(`确认让当前询盘 #${id} 的产品关联与目录选择一致？\n将关联 ${productIds.length} 个产品；未在目录中选择的旧关联会移除。正式价格不会被修改。`))return;
  setSyncState('正在同步目录选择到询盘…');
  try{
    const out=await api(`/api/business/deals/${encodeURIComponent(id)}/products`,{method:'PUT',body:JSON.stringify({product_ids:productIds})});
    await window.HUIDIDocumentEntryConnectivity?.setDeal?.(id);
    renderContext(`已同步 ${Number(out.selected_count??productIds.length)} 个产品到当前询盘；单据工作台会使用同一关联。`,'ok');
    window.HUIDIPlainLanguage?.toast?.('产品目录与当前询盘已同步');
  }catch(error){renderContext(`同步询盘失败：${clean(error?.message||error)}`,'warn')}
}

async function openDocuments(){
  const {id}=currentDeal();
  if(id)await window.HUIDIDocumentEntryConnectivity?.setDeal?.(id);
  mounted=false;
  if(typeof window.HUIDIWorkspaceFoundation?.documents==='function')window.HUIDIWorkspaceFoundation.documents();
  else document.querySelector('[data-huidi-doc-workbench]')?.click();
  setTimeout(()=>window.HUIDIDocumentEntryConnectivity?.refresh?.(),80);
}

async function refreshFromSource({sync=true,quiet=false}={}){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    if(!quiet)setSyncState('正在同步正式产品资料…');
    if(sync){try{await window.HUIDIProductServer?.sync?.()}catch(_){}}
    await Promise.all([hydrateSelected({prune:true}),loadProducts(pageMeta.page||1,query,{quiet:true})]);
    if(mounted)renderContext(`产品资料已刷新 · ${selected.size} 个已选项使用最新数据。`,'ok');
    return true;
  })().finally(()=>{refreshing=null});
  return refreshing;
}

function download(){
  const paper=$('#hocPaper');
  if(!paper)return;
  const cfg=inputs();
  const style=`*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#22354d}.paper{max-width:900px;margin:0 auto;padding:34px 38px}.hoc-cover{text-align:center;padding:36px 0 28px;border-bottom:1px solid #e7ebf0}.hoc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:22px}.hoc-card{border:1px solid #e0e6ed;border-radius:10px;overflow:hidden;break-inside:avoid-page;page-break-inside:avoid}.hoc-image{height:180px;background:#f3f5f8;display:grid;place-items:center;color:#9aa5b1;font-size:10px}.hoc-image img{width:100%;height:100%;object-fit:contain}.hoc-copy{padding:11px 12px}.hoc-copy h3{font-size:13px;margin:0 0 5px;overflow-wrap:anywhere}.hoc-copy p{font-size:9px;color:#607186;margin:4px 0;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap}.hoc-tags{display:flex;gap:4px;flex-wrap:wrap}.hoc-tags span{font-size:8px;background:#f0f4f8;border-radius:999px;padding:3px 6px}.hoc-ref{color:#8a6a2f}@media print{.paper{max-width:none;padding:12mm}}`;
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(cfg.title)+'</title><style>'+style+'</style></head><body><main class="paper">'+paper.innerHTML+'</main></body></html>';
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const anchor=document.createElement('a');
  anchor.href=URL.createObjectURL(blob);
  anchor.download=(cfg.title||'HUIDI产品目录')+'.html';
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(anchor.href),1200);
}

async function open(){
  css();
  const router=window.HUIDIWorkspacePages;
  const mount=router?.mount?.('catalog','产品目录','从正式产品资料生成目录；目录选择、当前询盘和单据工作台使用同一套产品身份。');
  if(!mount)return;
  const token=router.epoch();
  mounted=true;
  loadSerial+=1;
  hydrateSerial+=1;
  query='';
  defaultsApplied=false;
  mount.innerHTML='<div class="hoc-empty">正在读取产品资料…</div>';

  let company={};
  try{
    const response=await fetch('/api/company-settings',{credentials:'same-origin'});
    if(response.ok)company=await response.json();
  }catch(_){}
  if(router.epoch()!==token){mounted=false;return}

  const saved=state();
  restoreSelections(saved);
  const companyName=clean(saved.company)||clean(company.company_name||company.legal_name);
  const contact=clean(saved.contact)||defaultContact(company);
  mount.innerHTML=`<div class="hoc"><aside class="hoc-side"><div class="hoc-title"><h2>选择产品 <small id="hocCount"></small></h2><button class="hoc-btn" data-hoc-product>产品资料</button></div><input class="hoc-search" id="hocSearch" placeholder="搜索产品、SKU、分类、系列、规格"><div class="hoc-actions" style="margin-top:8px"><button class="hoc-btn" data-hoc-all>全选本页</button><button class="hoc-btn" data-hoc-none>清空选择</button><button class="hoc-btn" data-hoc-refresh>刷新产品</button></div><div class="hoc-list" id="hocList"></div><div class="hoc-pager" id="hocPager"></div></aside><section class="hoc-main"><div class="hoc-context" id="hocContext"></div><div class="hoc-settings"><label>公司名称<input class="hoc-field" id="hocCompany" value="${esc(companyName)}"></label><label>目录标题<input class="hoc-field" id="hocTitle" value="${esc(saved.title||'产品目录')}"></label><label class="full">联系方式 / 页眉说明<input class="hoc-field" id="hocContact" value="${esc(contact)}"></label><label><input type="checkbox" id="hocPrice" ${saved.showPrice?'checked':''}> 显示产品资料里的参考价</label></div><div class="hoc-toolbar"><button class="hoc-btn primary" data-hoc-print>打印 / 另存 PDF</button><button class="hoc-btn" data-hoc-download>下载 HTML</button></div><div class="hoc-preview" id="hocPreview"></div></section></div>`;
  renderContext();

  let searchTimer=0;
  $('#hocSearch').oninput=event=>{
    clearTimeout(searchTimer);
    const next=clean(event.target.value);
    searchTimer=setTimeout(()=>loadProducts(1,next),260);
  };
  $('[data-hoc-all]').onclick=()=>{
    rows.forEach(row=>{
      if(selected.size>=MAX_SELECTED)return;
      const key=keyOf(row);
      if(key){selected.add(key);remember(row)}
    });
    save();renderList();renderPreview();
  };
  $('[data-hoc-none]').onclick=()=>{
    selected.clear();selectedRows.clear();save();renderList();renderPreview();
  };
  $('[data-hoc-refresh]').onclick=()=>refreshFromSource({sync:true});
  $('[data-hoc-download]').onclick=download;
  $('[data-hoc-print]').onclick=async()=>{
    await hydrateSelected({prune:true});
    renderPreview();
    document.body.classList.add('hoc-print');
    window.print();
    setTimeout(()=>document.body.classList.remove('hoc-print'),500);
  };
  $('[data-hoc-product]').onclick=()=>router.open('product');
  ['hocCompany','hocTitle','hocContact'].forEach(id=>$('#'+id)?.addEventListener('input',renderPreview));
  $('#hocPrice')?.addEventListener('change',renderPreview);

  await hydrateSelected({prune:true});
  if(router.epoch()!==token){mounted=false;return}
  await loadProducts(1,'');
}

window.addEventListener('huidi-product-brain-synced',()=>{
  if(document.querySelector('#hocPreview'))refreshFromSource({sync:false,quiet:true});
});
document.addEventListener('click',event=>{
  const nav=event.target.closest?.('[data-page],[data-huidi-nav],[data-huidi-doc-workbench]');
  if(nav&&!event.target.closest?.('[data-hoc-product],[data-hoc-documents]'))setTimeout(()=>{mounted=Boolean(document.querySelector('#hocPreview'))},0);
},true);

window.HUIDIOnlineCatalog=Object.freeze({
  open,
  refresh:()=>refreshFromSource({sync:true}),
  selectedProductIds:()=>[...selected],
  selectedProducts:()=>selectedProducts().map(row=>({...row})),
  loadDealSelection,
  syncDealSelection
});
})();
