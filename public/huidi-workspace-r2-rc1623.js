/* HUIDI Docs Community Local RC16.23 — Workspace R2
   Goal: zero-learning navigation, compact screen use, global find, first-run guidance,
   and non-blocking local backup awareness. No body-wide MutationObserver. */
(()=>{
'use strict';
const VERSION='1.2.0-RC16.23';
const K={
  customers:'huidi_local_customers_v1',products:'huidi_local_products_v1',deals:'huidi_local_deals_v2',
  brands:'huidi_local_brands_v2',templates:'huidi_local_templates_v2',mail:'huidi_local_mail_drafts_v2',
  recycle:'huidi_local_recycle_v2',docs:'flypigbox_workspace_document_mirror_v1'
};
const LAST_VIEW='huidi_workspace_last_view_v1',LAST_BACKUP='huidi_workspace_last_backup_export_v1';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
function read(key){try{const repo=window.HUIDILocalCore?.repoForKey?.(key);if(repo){const x=repo.list();return Array.isArray(x)?x:[]}}catch(_){}try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function data(){return{customers:read(K.customers),products:read(K.products),deals:read(K.deals),brands:read(K.brands),templates:read(K.templates),mail:read(K.mail),recycle:read(K.recycle),docs:read(K.docs)}}
function docType(x){const s=x?.summary||{};return s.document_type||x?.document_type||x?.payload?.documentType||''}
function docNo(x){const s=x?.summary||{};return s.document_no||x?.document_no||'未编号'}
function docCustomer(x){const s=x?.summary||{};return s.customer_name||x?.customer_name||''}
function nav(view){const b=$(`.nav-btn[data-view="${view}"]`);if(b)b.click()}
function renameNav(){
 const labels={home:'首页',deals:'询盘 / 订单',customers:'客户',products:'商品',documents:'单据',catalog:'产品目录',brands:'品牌 / 收款',templates:'条款模板',mail:'邮件草稿',feishu:'飞书资料',backup:'备份',recycle:'回收站',help:'帮助'};
 const tips={home:'今天要处理什么',deals:'跟进询盘、订单与出运',customers:'客户资料与跟进',products:'商品、价格、规格与图片',documents:'报价、PI、合同、CI、装箱单',catalog:'选商品制作客户目录',brands:'公司、Logo、银行与签章',templates:'常用付款、交期与贸易条款',mail:'本地邮件草稿',feishu:'读取飞书表格直接复用',backup:'备份、恢复与迁移',recycle:'恢复误删资料',help:'使用说明与离线边界'};
 $$('.nav-btn').forEach(b=>{const v=b.dataset.view,bold=$('.nav-copy b',b);if(bold&&labels[v])bold.textContent=labels[v];b.title=tips[v]||labels[v]||''});
}
function buildSidebar(){
 const side=$('.sidebar');if(!side)return;
 renameNav();
 const btn=Object.fromEntries($$('.nav-btn',side).map(x=>[x.dataset.view,x]));
 const old=$('.workspace-nav-groups',side);if(old)old.remove();
 let quick=$('.workspace-r2-quick',side);if(!quick){
   quick=document.createElement('div');quick.className='workspace-r2-quick';quick.innerHTML=`
    <button class="workspace-r2-quick-btn primary" data-action="new-deal"><span>＋</span><b>新询盘</b></button>
    <button class="workspace-r2-quick-btn" data-action="new-doc"><span>▤</span><b>做单据</b></button>
    <button class="workspace-r2-quick-btn" data-action="new-customer"><span>客</span><b>新客户</b></button>
    <button class="workspace-r2-quick-btn" data-action="new-product"><span>品</span><b>新商品</b></button>`;
   $('.version',side)?.insertAdjacentElement('afterend',quick);
 }
 let search=$('.workspace-r2-search',side);if(!search){
   search=document.createElement('div');search.className='workspace-r2-search';search.innerHTML=`<div class="workspace-r2-searchbox"><span>⌕</span><input id="workspaceR2Search" type="search" autocomplete="off" placeholder="找客户 / 商品 / 业务 / 单据" aria-label="全局查找"></div><div id="workspaceR2Results" class="workspace-r2-search-results" hidden></div>`;quick.insertAdjacentElement('afterend',search);
 }
 const wrap=document.createElement('div');wrap.className='workspace-nav-groups workspace-r2-nav';
 const core=document.createElement('section');core.className='workspace-r2-core';core.innerHTML='<div class="workspace-nav-group-title">常用</div><nav class="nav"></nav>';
 ['home','deals','customers','products','documents'].forEach(v=>btn[v]&&$('.nav',core).appendChild(btn[v]));wrap.appendChild(core);
 const more=document.createElement('details');more.className='workspace-r2-more';more.innerHTML='<summary><span>更多工具</span><small>目录、品牌、条款、备份…</small><i>⌄</i></summary><div class="workspace-r2-more-body"></div>';
 const sections=[['制作',['catalog']],['经营资料',['brands','templates','mail','feishu']],['数据与设置',['backup','recycle','help']]];
 for(const [title,views] of sections){const g=document.createElement('section');g.className='workspace-nav-group';g.innerHTML=`<div class="workspace-nav-group-title">${title}</div><nav class="nav"></nav>`;views.forEach(v=>btn[v]&&$('.nav',g).appendChild(btn[v]));$('.workspace-r2-more-body',more).appendChild(g)}
 wrap.appendChild(more);search.insertAdjacentElement('afterend',wrap);
}
function buildTopActions(){const box=$('.top-actions');if(!box||box.dataset.r2)return;box.dataset.r2='1';box.innerHTML=`
 <button class="btn primary" data-action="new-deal">＋ 新询盘</button>
 <button class="btn" data-action="new-doc">做报价 / 单据</button>
 <details class="workspace-r2-create"><summary class="btn">＋ 新建</summary><div class="workspace-r2-create-menu">
  <button data-action="new-customer">新客户</button><button data-action="new-product">新商品</button><button data-action="new-brand">品牌 / 收款</button><button data-action="new-template">条款模板</button><button data-action="new-mail">邮件草稿</button><button data-action="open-catalog">产品目录</button>
 </div></details>`}
function totalLocal(d){return d.customers.length+d.products.length+d.deals.length+d.brands.length+d.templates.length+d.mail.length+d.docs.length}
function firstRun(d){
 const home=$('#view-home');if(!home)return;let box=$('.workspace-r2-first-run',home);
 const done={brand:d.brands.length>0,customer:d.customers.length>0,product:d.products.length>0};const ready=done.brand&&done.customer&&done.product;
 const hasWork=d.deals.length+d.docs.length>0;
 if(ready&&hasWork){box?.remove();return}
 if(!box){box=document.createElement('section');box.className='workspace-r2-first-run';home.insertBefore(box,$('.workspace-r1-home',home)||home.firstChild)}
 if(!ready){box.innerHTML=`<div class="workspace-r2-first-head"><div><b>第一次使用，先准备 3 项</b><span>准备好后，报价和后续单据就不必重复填资料。</span></div><small>${[done.brand,done.customer,done.product].filter(Boolean).length}/3</small></div><div class="workspace-r2-setup-steps">
 ${setupStep('公司 / 收款',done.brand,'new-brand')}${setupStep('第一个客户',done.customer,'new-customer')}${setupStep('第一个商品',done.product,'new-product')}
 </div>`;return}
 box.innerHTML=`<div class="workspace-r2-ready"><div><b>基础资料已经准备好</b><span>现在可以直接记录客户需求，或开始制作第一张报价单。</span></div><div><button class="btn primary" data-action="new-deal">记录第一条询盘</button><button class="btn" data-action="new-doc">开始做单据</button></div></div>`
}
function setupStep(label,done,action){return `<button class="workspace-r2-setup-step${done?' done':''}" ${done?'disabled':`data-action="${action}"`}><i>${done?'✓':'○'}</i><span>${esc(label)}</span><b>${done?'已准备':'去设置'}</b></button>`}
function searchRows(q){const d=data(),query=clean(q).toLowerCase();if(!query)return[];const has=(...xs)=>xs.some(x=>clean(x).toLowerCase().includes(query)),out=[];
 d.deals.forEach(x=>{const c=d.customers.find(y=>String(y.id)===String(x.customer_id));if(has(x.title,c?.company,x.next_action,x.stage))out.push({view:'deals',id:x.id,kind:'业务',title:x.title||c?.company||'未命名业务',meta:c?.company||x.stage||''})});
 d.customers.forEach(x=>{if(has(x.company,x.contact,x.email,x.phone,x.country,x.tags))out.push({view:'customers',id:x.id,kind:'客户',title:x.company||x.contact||'未命名客户',meta:[x.contact,x.country].filter(Boolean).join(' · ')})});
 d.products.forEach(x=>{if(has(x.name,x.sku,x.spec,x.category,x.supplier_name,x.hs_code))out.push({view:'products',id:x.id,kind:'商品',title:x.name||'未命名商品',meta:[x.sku,x.category].filter(Boolean).join(' · ')})});
 d.docs.forEach(x=>{if(has(docNo(x),docCustomer(x),docType(x)))out.push({view:'documents',id:x.id,kind:'单据',title:`${docNo(x)} · ${docCustomer(x)||'未关联客户'}`,meta:({quotation:'报价',proforma_invoice:'PI',sales_contract:'合同',commercial_invoice:'CI',packing_list:'装箱单'})[docType(x)]||'单据'})});
 d.brands.forEach(x=>{if(has(x.brand_name,x.company_name,x.bank_name,x.beneficiary))out.push({view:'brands',id:x.id,kind:'品牌',title:x.brand_name||x.company_name||'品牌资料',meta:x.company_name||''})});
 d.templates.forEach(x=>{if(has(x.name,x.trade_terms,x.payment_terms,x.delivery_time))out.push({view:'templates',id:x.id,kind:'条款',title:x.name||'条款模板',meta:x.kind||''})});
 d.mail.forEach(x=>{if(has(x.subject,x.customer_name,x.to,x.body))out.push({view:'mail',id:x.id,kind:'邮件',title:x.subject||'未命名邮件',meta:x.customer_name||x.to||''})});
 return out.slice(0,9)}
function renderSearch(){const input=$('#workspaceR2Search'),box=$('#workspaceR2Results');if(!input||!box)return;const q=input.value,rows=searchRows(q);if(!clean(q)){box.hidden=true;box.innerHTML='';return}box.hidden=false;box.innerHTML=rows.length?rows.map(x=>`<button class="workspace-r2-search-result" data-r2-result="${esc(x.view)}" data-id="${esc(x.id)}"><span>${esc(x.kind)}</span><b>${esc(x.title)}</b><small>${esc(x.meta||'')}</small></button>`).join(''):'<div class="workspace-r2-search-empty">没有找到，换个客户名、SKU、单号或关键词试试。</div>'}
function openResult(view,id){nav(view);setTimeout(()=>{const scope=$(`#view-${view}`);if(!scope)return;const el=$$('[data-id]',scope).find(x=>String(x.dataset.id)===String(id));const target=el?.closest('tr,.data-card,.mini-product')||el;if(target){target.scrollIntoView({block:'center',behavior:'smooth'});target.classList.add('workspace-r2-flash');setTimeout(()=>target.classList.remove('workspace-r2-flash'),1200);if(target.tagName==='TR')target.click()}},80)}
function syncMore(){const more=$('.workspace-r2-more');if(!more)return;const view=document.body.dataset.huidiView||'home';more.open=['catalog','brands','templates','mail','feishu','backup','recycle','help'].includes(view)}
function backupStatus(d){
 const side=$('.sidebar');if(!side)return;let box=$('.workspace-r2-backup',side);if(!box){box=document.createElement('div');box.className='workspace-r2-backup';const foot=$('.sidebar-foot',side);side.insertBefore(box,foot||null)}
 const total=totalLocal(d),raw=Number(localStorage.getItem(LAST_BACKUP)||0),days=raw?Math.floor((Date.now()-raw)/86400000):null,warn=total>=3&&(!raw||days>=7);
 const msg=total===0?'资料只保存在本机':!raw?'还没有记录到完整备份':days===0?'今天已做完整备份':days===1?'昨天做过完整备份':`${days} 天前做过完整备份`;
 box.classList.toggle('warn',warn);box.innerHTML=`<div><b>${warn?'建议备份':'本机数据'}</b><span>${esc(msg)}</span></div><button class="workspace-r2-backup-btn" data-action="export-backup">备份</button>`
}
function compactDescriptions(){
 const short={home:['本地外贸工作台','今天该跟什么、最近做了什么、下一步去哪。'],deals:['询盘与订单','把客户需求、报价、生产、出运放在同一条业务线上。'],customers:['客户','客户资料录一次，后续报价和单据直接调用。'],products:['商品','图片、SKU、规格、价格、MOQ、HS Code 集中管理。'],documents:['单据','报价、PI、合同、CI、装箱单按业务继续制作。'],catalog:['产品目录','从商品库直接选择，不重复录产品。'],brands:['品牌 / 收款','公司、Logo、银行资料、签名和公章统一保存。'],templates:['条款模板','常用付款、交期、贸易术语保存一次重复用。'],mail:['邮件草稿','本地保存草稿，需要发送时再联网。'],feishu:['飞书资料','读取自己的飞书表格并复用到客户、商品和后续单据。'],backup:['备份','换电脑、清缓存或重装前，先导出完整备份。'],recycle:['回收站','恢复误删资料；永久删除前再确认。'],help:['帮助','第一次使用、浏览器和离线边界都在这里。']};
 const view=document.body.dataset.huidiView||'home',v=short[view];if(v){const h=$('#pageTitle'),p=$('#pageDesc');if(h)h.textContent=v[0];if(p)p.textContent=v[1]}
}
function refresh(){const d=data();firstRun(d);backupStatus(d);syncMore();compactDescriptions()}
function closeMenus(){const d=$('.workspace-r2-create');if(d)d.open=false}
function restoreLastView(){if(location.hash)return;const d=data();if(totalLocal(d)===0)return;const v=localStorage.getItem(LAST_VIEW)||'';if(['deals','customers','products','documents','catalog','brands','templates','mail','feishu'].includes(v))nav(v)}
function onClick(e){
 const result=e.target.closest('[data-r2-result]');if(result){openResult(result.dataset.r2Result,result.dataset.id);const i=$('#workspaceR2Search');if(i)i.value='';renderSearch();return}
 const navBtn=e.target.closest('.nav-btn');if(navBtn){const v=navBtn.dataset.view;if(!['backup','recycle','help'].includes(v))localStorage.setItem(LAST_VIEW,v);setTimeout(()=>{syncMore();compactDescriptions()},0)}
 const action=e.target.closest('[data-action]');if(action){if(action.dataset.action==='export-backup'){localStorage.setItem(LAST_BACKUP,String(Date.now()));setTimeout(refresh,20)}closeMenus();setTimeout(refresh,60)}
 if(!e.target.closest('.workspace-r2-search')&&!e.target.closest('.workspace-r2-create')){const r=$('#workspaceR2Results');if(r)r.hidden=true;closeMenus()}
}
function boot(){
 document.body.classList.add('workspace-r2');document.body.dataset.workspaceRelease=VERSION;buildSidebar();buildTopActions();
 const input=$('#workspaceR2Search');input?.addEventListener('input',renderSearch);input?.addEventListener('focus',renderSearch);input?.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';renderSearch();input.blur()}});
 document.addEventListener('click',onClick);window.addEventListener('HUIDI:local-data-change',()=>setTimeout(refresh,20));window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input?.focus();input?.select()}});
 try{window.HUIDILocalCore?.bus?.on?.(()=>setTimeout(refresh,30))}catch(_){}
 refresh();setTimeout(restoreLastView,0)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
