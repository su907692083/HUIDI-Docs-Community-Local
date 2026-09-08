(()=>{'use strict';
if(window.HUIDIOnlineCatalog)return;

const $=s=>document.querySelector(s);
const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='huidi_online_catalog_page_v2';
const PAGE_SIZE=50;

let rows=[];
let selected=new Set();
let selectedRows=new Map();
let pageMeta={page:1,pages:1,total:0,page_size:PAGE_SIZE};
let query='';
let loadSerial=0;
let defaultsApplied=false;

function css(){
  if($('#huidiOnlineCatalogCss'))return;
  const s=document.createElement('style');
  s.id='huidiOnlineCatalogCss';
  s.textContent=`
.hoc{display:grid;grid-template-columns:290px minmax(0,1fr);gap:14px;min-height:calc(100vh - 125px)}
.hoc-side,.hoc-main{background:#fff;border:1px solid #e0e7ef;border-radius:12px;min-width:0}
.hoc-side{padding:14px;overflow:auto}.hoc-main{padding:16px;overflow:auto}
.hoc-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.hoc-title h2{font-size:15px;margin:0}.hoc-title h2 small{font-size:8px;color:#7b8999;font-weight:700;margin-left:5px}
.hoc-actions,.hoc-toolbar{display:flex;gap:6px;flex-wrap:wrap}
.hoc-btn{border:1px solid #d8e1ec;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:800;color:#38516d;cursor:pointer}
.hoc-btn.primary{background:#1d63e9;border-color:#1d63e9;color:#fff}.hoc-btn:disabled{opacity:.42;cursor:default}
.hoc-search,.hoc-field{width:100%;height:34px;border:1px solid #d8e1ec;border-radius:8px;padding:0 9px;font:inherit;font-size:10px}
.hoc-list{display:grid;gap:6px;margin-top:10px}
.hoc-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;border:1px solid #e5eaf0;border-radius:9px;padding:8px;background:#fbfcfe}
.hoc-item b{display:block;font-size:10px;color:#314a68}.hoc-item small{display:block;margin-top:2px;color:#7c8998;font-size:8.5px}
.hoc-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:9px;border-top:1px solid #edf1f5}
.hoc-pager small{font-size:8.5px;color:#728196}.hoc-pager span{display:flex;gap:5px}
.hoc-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
.hoc-settings label{font-size:9px;font-weight:800;color:#64758b}.hoc-settings input{display:block;margin-top:4px}.hoc-settings .full{grid-column:1/-1}
.hoc-toolbar{margin-bottom:12px}.hoc-preview{border:1px solid #dfe6ee;background:#f2f4f7;border-radius:11px;padding:14px}
.hoc-paper{background:#fff;max-width:900px;margin:0 auto;padding:34px 38px;min-height:980px;box-shadow:0 8px 26px rgba(24,39,75,.08)}
.hoc-cover{text-align:center;padding:36px 0 28px;border-bottom:1px solid #e7ebf0}.hoc-cover h1{font-size:28px;margin:0}.hoc-cover h3{font-size:14px;color:#52657b;margin:8px 0 0}.hoc-cover p{font-size:10px;color:#7a8798}
.hoc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:22px}
.hoc-card{border:1px solid #e0e6ed;border-radius:10px;overflow:hidden;break-inside:avoid;background:#fff}
.hoc-image{height:180px;background:#f3f5f8;display:grid;place-items:center;overflow:hidden;color:#9aa5b1;font-size:10px}.hoc-image img{width:100%;height:100%;object-fit:contain}
.hoc-copy{padding:11px 12px}.hoc-copy h3{font-size:13px;margin:0 0 5px;color:#243a55}.hoc-copy p{font-size:9px;color:#607186;margin:4px 0;line-height:1.5}
.hoc-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.hoc-tags span{font-size:8px;background:#f0f4f8;color:#536a82;border-radius:999px;padding:3px 6px}
.hoc-empty{padding:28px 12px;text-align:center;color:#8190a2;font-size:10px}.hoc-ref{color:#8a6a2f!important}
@media(max-width:900px){.hoc{grid-template-columns:1fr}.hoc-side{max-height:380px}.hoc-settings,.hoc-grid{grid-template-columns:1fr}.hoc-settings .full{grid-column:auto}.hoc-paper{padding:22px 18px}}
@media print{body.hoc-print .side,body.hoc-print .hpr-head,body.hoc-print .hoc-side,body.hoc-print .hoc-settings,body.hoc-print .hoc-toolbar{display:none!important}body.hoc-print .app,body.hoc-print .main,body.hoc-print #huidiPageHost,body.hoc-print #huidiPageMount,body.hoc-print .hoc,body.hoc-print .hoc-main,body.hoc-print .hoc-preview{display:block!important;margin:0!important;padding:0!important;border:0!important;background:#fff!important}body.hoc-print .hoc-paper{max-width:none!important;box-shadow:none!important;min-height:auto!important;padding:12mm!important}.hoc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  document.head.appendChild(s);
}

function imageOf(x){
  const direct=[x.main_image,x.image_url,x.image,x.cover_image,x.cover,x.thumbnail,x.photo_url].map(clean).find(Boolean);
  if(direct)return direct;
  for(const key of ['images','pictures','photos','media']){
    const v=x[key];
    if(Array.isArray(v)&&v.length){
      const a=v[0];
      if(typeof a==='string'&&clean(a))return clean(a);
      if(a&&typeof a==='object'){
        const src=clean(a.url||a.src||a.image_url);
        if(src)return src;
      }
    }
  }
  return'';
}

function keyOf(x){
  return clean(x?.brain_id||x?.id||x?.local_product_id||x?.sku||x?.name).toLowerCase();
}

function state(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||'{}');
    return x&&typeof x==='object'?x:{};
  }catch(_){
    return{};
  }
}

function selectedSnapshots(){
  return [...selected]
    .map(key=>selectedRows.get(key))
    .filter(Boolean)
    .slice(0,500);
}

function save(extra={}){
  const next={
    ...state(),
    ...extra,
    selected:[...selected].slice(0,500),
    selected_items:selectedSnapshots()
  };
  localStorage.setItem(KEY,JSON.stringify(next));
  return next;
}

function restoreSelections(saved){
  selected=new Set(Array.isArray(saved?.selected)?saved.selected.map(clean).filter(Boolean).slice(0,500):[]);
  selectedRows=new Map();
  for(const raw of (Array.isArray(saved?.selected_items)?saved.selected_items:[]).slice(0,500)){
    const key=keyOf(raw);
    if(key&&selected.has(key))selectedRows.set(key,raw);
  }
}

function remember(row){
  const key=keyOf(row);
  if(key)selectedRows.set(key,row);
}

function inputs(){
  return{
    company:clean($('#hocCompany')?.value),
    title:clean($('#hocTitle')?.value)||'产品目录',
    contact:clean($('#hocContact')?.value),
    showPrice:Boolean($('#hocPrice')?.checked)
  };
}

function defaultContact(c){
  return[clean(c?.email),clean(c?.phone),clean(c?.website)].filter(Boolean).join(' · ');
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
  for(const c of (Array.isArray(x.certifications)?x.certifications:[]).slice(0,3))tags.push(clean(c));
  return`<article class="hoc-card"><div class="hoc-image">${image?`<img src="${esc(image)}" alt="${esc(name)}" onerror="this.remove();this.parentElement.textContent='暂无产品图片'">`:'暂无产品图片'}</div><div class="hoc-copy"><h3>${esc(name)}</h3>${sku?`<p>型号 / SKU：${esc(sku)}</p>`:''}${category?`<p>${esc(category)}</p>`:''}${spec?`<p>${esc(spec)}</p>`:''}${showPrice&&price?`<p class="hoc-ref">参考价：${esc(price)}（仅供目录展示核对，不写入正式报价）</p>`:''}<div class="hoc-tags">${tags.filter(Boolean).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></article>`;
}

function renderPreview(){
  const box=$('#hocPreview');
  if(!box)return;
  const cfg=inputs();
  const picked=[...selected].map(key=>selectedRows.get(key)).filter(Boolean);
  save(cfg);
  box.innerHTML=`<div class="hoc-paper" id="hocPaper"><section class="hoc-cover"><h1>${esc(cfg.company||'产品目录')}</h1><h3>${esc(cfg.title)}</h3>${cfg.contact?`<p>${esc(cfg.contact)}</p>`:''}<p>${new Date().toLocaleDateString('zh-CN')}</p></section>${picked.length?`<section class="hoc-grid">${picked.map(x=>card(x,cfg.showPrice)).join('')}</section>`:'<div class="hoc-empty">从左侧选择产品后会自动更新目录预览。</div>'}</div>`;
}

function renderPager(){
  const box=$('#hocPager');
  if(!box)return;
  const current=Number(pageMeta.page||1);
  const pages=Number(pageMeta.pages||1);
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
    const key=keyOf(x);
    return`<label class="hoc-item"><input type="checkbox" data-hoc-select="${esc(key)}" ${selected.has(key)?'checked':''}><span><b>${esc(x.name||x.title)}</b><small>${esc([x.sku,x.category,x.series].filter(Boolean).join(' · ')||'未填写型号 / 分类')}</small></span></label>`;
  }).join('');
  box.querySelectorAll('[data-hoc-select]').forEach(c=>c.onchange=()=>{
    const row=rows.find(x=>keyOf(x)===c.dataset.hocSelect);
    if(c.checked){
      selected.add(c.dataset.hocSelect);
      if(row)remember(row);
    }else{
      selected.delete(c.dataset.hocSelect);
      selectedRows.delete(c.dataset.hocSelect);
    }
    renderList();
    renderPreview();
  });
  renderPager();
}

function localPage(nextPage,nextQuery){
  const all=Array.isArray(window.HUIDIProductBrain?.list?.())?window.HUIDIProductBrain.list():[];
  const q=clean(nextQuery).toLowerCase();
  const filtered=all.filter(x=>!q||[x.name,x.sku,x.category,x.series].some(v=>clean(v).toLowerCase().includes(q)));
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page=Math.max(1,Math.min(Number(nextPage||1),pages));
  const start=(page-1)*PAGE_SIZE;
  return{items:filtered.slice(start,start+PAGE_SIZE),page,pages,page_size:PAGE_SIZE,total:filtered.length,q:clean(nextQuery)};
}

async function fetchPage(nextPage,nextQuery){
  const params=new URLSearchParams({
    paged:'1',
    page:String(nextPage||1),
    page_size:String(PAGE_SIZE)
  });
  const q=clean(nextQuery);
  if(q)params.set('q',q);
  const response=await fetch(`/api/product-brains?${params.toString()}`);
  if(!response.ok)throw new Error(await response.text()||response.statusText);
  const out=await response.json();
  if(!out||!Array.isArray(out.items))throw new Error('产品分页响应格式异常');
  return out;
}

async function loadProducts(nextPage=1,nextQuery=query){
  const serial=++loadSerial;
  const list=$('#hocList');
  if(list)list.innerHTML='<div class="hoc-empty">正在读取产品资料…</div>';
  let out;
  try{
    out=await fetchPage(nextPage,nextQuery);
  }catch(_){
    out=localPage(nextPage,nextQuery);
  }
  if(serial!==loadSerial)return;
  query=clean(nextQuery);
  pageMeta={
    page:Number(out.page||1),
    pages:Number(out.pages||1),
    page_size:Number(out.page_size||PAGE_SIZE),
    total:Number(out.total||0)
  };
  rows=Array.isArray(out.items)?out.items:[];
  for(const row of rows){
    const key=keyOf(row);
    if(key&&selected.has(key))remember(row);
  }
  if(!defaultsApplied){
    defaultsApplied=true;
    if(!selected.size){
      rows.slice(0,Math.min(6,rows.length)).forEach(row=>{
        const key=keyOf(row);
        if(key){
          selected.add(key);
          remember(row);
        }
      });
    }
  }
  renderList();
  renderPreview();
}

function download(){
  const paper=$('#hocPaper');
  if(!paper)return;
  const cfg=inputs();
  const style=`*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#22354d}.paper{max-width:900px;margin:0 auto;padding:34px 38px}.hoc-cover{text-align:center;padding:36px 0 28px;border-bottom:1px solid #e7ebf0}.hoc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:22px}.hoc-card{border:1px solid #e0e6ed;border-radius:10px;overflow:hidden;break-inside:avoid}.hoc-image{height:180px;background:#f3f5f8;display:grid;place-items:center;color:#9aa5b1;font-size:10px}.hoc-image img{width:100%;height:100%;object-fit:contain}.hoc-copy{padding:11px 12px}.hoc-copy h3{font-size:13px;margin:0 0 5px}.hoc-copy p{font-size:9px;color:#607186;margin:4px 0;line-height:1.5}.hoc-tags{display:flex;gap:4px;flex-wrap:wrap}.hoc-tags span{font-size:8px;background:#f0f4f8;border-radius:999px;padding:3px 6px}.hoc-ref{color:#8a6a2f}@media print{.paper{max-width:none;padding:12mm}}`;
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(cfg.title)+'</title><style>'+style+'</style></head><body><main class="paper">'+paper.innerHTML+'</main></body></html>';
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(cfg.title||'HUIDI产品目录')+'.html';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}

async function open(){
  css();
  const router=window.HUIDIWorkspacePages;
  const m=router?.mount?.('catalog','产品目录','从真实产品资料生成目录；公司资料自动复用，选择或修改后直接更新预览。');
  if(!m)return;
  const token=router.epoch();
  loadSerial++;
  query='';
  defaultsApplied=false;
  m.innerHTML='<div class="hoc-empty">正在读取产品资料…</div>';

  let company={};
  try{
    const companyResponse=await fetch('/api/company-settings');
    if(companyResponse.ok)company=await companyResponse.json();
  }catch(_){}
  if(token!==router.epoch())return;

  const saved=state();
  restoreSelections(saved);
  const companyName=clean(saved.company)||clean(company.company_name||company.legal_name);
  const contact=clean(saved.contact)||defaultContact(company);

  m.innerHTML=`<div class="hoc"><aside class="hoc-side"><div class="hoc-title"><h2>选择产品 <small id="hocCount"></small></h2><button class="hoc-btn" data-hoc-product>产品资料</button></div><input class="hoc-search" id="hocSearch" placeholder="搜索产品、型号、分类"><div class="hoc-actions" style="margin-top:8px"><button class="hoc-btn" data-hoc-all>全选本页</button><button class="hoc-btn" data-hoc-none>清空选择</button></div><div class="hoc-list" id="hocList"></div><div class="hoc-pager" id="hocPager"></div></aside><section class="hoc-main"><div class="hoc-settings"><label>公司名称<input class="hoc-field" id="hocCompany" value="${esc(companyName)}"></label><label>目录标题<input class="hoc-field" id="hocTitle" value="${esc(saved.title||'产品目录')}"></label><label class="full">联系方式 / 页眉说明<input class="hoc-field" id="hocContact" value="${esc(contact)}"></label><label><input type="checkbox" id="hocPrice" ${saved.showPrice?'checked':''}> 显示产品资料里的参考价</label></div><div class="hoc-toolbar"><button class="hoc-btn primary" data-hoc-print>打印 / 另存 PDF</button><button class="hoc-btn" data-hoc-download>下载 HTML</button></div><div class="hoc-preview" id="hocPreview"></div></section></div>`;

  let searchTimer=0;
  $('#hocSearch').oninput=e=>{
    clearTimeout(searchTimer);
    const next=clean(e.target.value);
    searchTimer=setTimeout(()=>loadProducts(1,next),260);
  };
  $('[data-hoc-all]').onclick=()=>{
    rows.forEach(row=>{
      const key=keyOf(row);
      if(key){
        selected.add(key);
        remember(row);
      }
    });
    renderList();
    renderPreview();
  };
  $('[data-hoc-none]').onclick=()=>{
    selected.clear();
    selectedRows.clear();
    renderList();
    renderPreview();
  };
  $('[data-hoc-download]').onclick=download;
  $('[data-hoc-print]').onclick=()=>{
    renderPreview();
    document.body.classList.add('hoc-print');
    window.print();
    setTimeout(()=>document.body.classList.remove('hoc-print'),500);
  };
  $('[data-hoc-product]').onclick=()=>router.open('product');
  ['hocCompany','hocTitle','hocContact'].forEach(id=>$('#'+id)?.addEventListener('input',renderPreview));
  $('#hocPrice')?.addEventListener('change',renderPreview);

  await loadProducts(1,'');
}

window.HUIDIOnlineCatalog=Object.freeze({open});
})();
