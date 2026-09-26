/* HUIDI Docs Community Local RC16.22 — Workspace R1
   No body-wide MutationObserver. Uses explicit render hooks/events only. */
(()=>{
'use strict';
const VERSION='1.2.0-RC16.22';
const K={
  customers:'huidi_local_customers_v1',products:'huidi_local_products_v1',deals:'huidi_local_deals_v2',
  brands:'huidi_local_brands_v2',templates:'huidi_local_templates_v2',mail:'huidi_local_mail_drafts_v2',
  recycle:'huidi_local_recycle_v2',docs:'flypigbox_workspace_document_mirror_v1'
};
const names={quotation:'报价单',proforma_invoice:'PI',sales_contract:'销售合同',commercial_invoice:'商业发票',packing_list:'装箱单'};
const state={filters:Object.create(null),drawer:null};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>String(v??'').trim();
const today=()=>new Date().toISOString().slice(0,10);
const dateOnly=v=>String(v||'').slice(0,10);
const fmtDate=v=>v?String(v).replace('T',' ').slice(0,16):'—';
const fmtMoney=(v,c='USD')=>{const n=Number(v);return Number.isFinite(n)&&n?`${c||'USD'} ${n.toLocaleString(undefined,{maximumFractionDigits:2})}`:'—'};
function fallback(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function list(name,key){try{const a=window.HUIDILocalCore?.repositories?.[name]?.list?.();if(Array.isArray(a))return a}catch(_){}try{const a=window.HUIDILocalCore?.repoForKey?.(key)?.list?.();if(Array.isArray(a))return a}catch(_){}return fallback(key)}
function data(){return{
  customers:list('customers',K.customers),products:list('products',K.products),deals:list('deals',K.deals),
  brands:list('brands',K.brands),templates:list('templates',K.templates),mail:list('mail',K.mail),
  recycle:list('recycle',K.recycle),docs:list('documents',K.docs)
}}
function nav(view){const b=$(`.nav-btn[data-view="${view}"]`);if(b)b.click()}
function getDocType(d){const s=d?.summary||{};return s.document_type||d?.document_type||d?.payload?.documentType||''}
function getDocNo(d){const s=d?.summary||{};return s.document_no||d?.document_no||'—'}
function getDocCustomer(d){const s=d?.summary||{};return s.customer_name||d?.customer_name||'—'}
function docCustomerId(d){const s=d?.summary||{};return s.customer_id||d?.customer_id||d?.payload?.customer?.id||''}
function activeDeal(d){return d&&d.stage!=='completed'}
function dueDeal(d){return activeDeal(d)&&dateOnly(d.next_action_at)&&dateOnly(d.next_action_at)<=today()}
function executionDeal(d){return ['pi_confirmed','order_confirmed','production','inspection','booking'].includes(d.stage)}
function quoteDeal(d){return ['qualified','catalog','quotation','negotiation'].includes(d.stage)}
function recent(v,days=7){if(!v)return false;const t=new Date(v).getTime();return Number.isFinite(t)&&Date.now()-t<=days*86400000}
function rowId(row){return row?.querySelector('[data-id]')?.dataset.id||''}
function byId(rows,id){return rows.find(x=>String(x.id)===String(id))||null}
function productNames(ids,products){const m=new Map(products.map(x=>[String(x.id),x]));return (ids||[]).map(id=>m.get(String(id))?.name).filter(Boolean)}

function buildNav(){
  const side=$('.sidebar');if(!side||$('.workspace-nav-groups'))return;
  const buttons=Object.fromEntries($$('.nav-btn',side).map(b=>[b.dataset.view,b]));
  $$('.nav-section-title,.nav',side).forEach(x=>x.remove());
  const groups=[
    ['工作',['home','deals']],['资料',['customers','products']],['制作',['catalog','documents']],
    ['经营资料',['brands','templates','mail']],['数据与设置',['backup','recycle','help']]
  ];
  const box=document.createElement('div');box.className='workspace-nav-groups';
  for(const [title,views] of groups){const g=document.createElement('section');g.className='workspace-nav-group';g.innerHTML=`<div class="workspace-nav-group-title">${title}</div><nav class="nav"></nav>`;const n=$('.nav',g);views.forEach(v=>buttons[v]&&n.appendChild(buttons[v]));box.appendChild(g)}
  side.insertBefore(box,$('.sidebar-foot',side));
}
function navCounts(d){
  const counts={home:'',deals:d.deals.filter(activeDeal).length,customers:d.customers.length,products:d.products.length,catalog:d.products.length,documents:d.docs.length,brands:d.brands.length,templates:d.templates.length,mail:d.mail.length,recycle:d.recycle.length,backup:'',help:''};
  $$('.nav-btn').forEach(b=>{let x=$('.workspace-nav-count',b);if(!x){x=document.createElement('span');x.className='workspace-nav-count';b.appendChild(x)}const v=counts[b.dataset.view];x.textContent=v===''?'':String(v);x.hidden=v===''});
}
function ensureHome(){const home=$('#view-home');if(!home)return null;let box=$('.workspace-r1-home',home);if(!box){box=document.createElement('div');box.className='workspace-r1-home';home.insertBefore(box,$('.home-grid',home)||home.firstChild)}return box}
function stageRows(ds){const defs=[['待确认需求',d=>['new_inquiry','qualified'].includes(d.stage)],['待报价/谈判',quoteDeal],['订单执行中',executionDeal],['已出运/完成',d=>['shipped','completed'].includes(d.stage)]];const max=Math.max(1,...defs.map(([,f])=>ds.filter(f).length));return defs.map(([label,f])=>{const n=ds.filter(f).length;return `<div class="workspace-r1-stage-row"><span>${label}</span><div class="workspace-r1-stage-track"><div class="workspace-r1-stage-fill" style="width:${Math.round(n/max*100)}%"></div></div><strong>${n}</strong></div>`}).join('')}
function recentRows(d){const rows=[];d.docs.forEach(x=>rows.push({kind:names[getDocType(x)]||'单据',title:`${getDocCustomer(x)} · ${getDocNo(x)}`,at:x.updated_at||x.created_at||''}));d.deals.forEach(x=>rows.push({kind:'业务',title:x.title||'未命名业务',at:x.updated_at||x.created_at||''}));d.customers.forEach(x=>rows.push({kind:'客户',title:x.company||x.contact||'未命名客户',at:x.updated_at||x.created_at||''}));return rows.sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,6).map(x=>`<div class="workspace-r1-recent-item"><span class="kind">${esc(x.kind)}</span><b>${esc(x.title)}</b><time>${esc(dateOnly(x.at)||'—')}</time></div>`).join('')||'<div class="workspace-r1-recent-item"><span class="kind">最近</span><b>暂无业务记录</b><time>—</time></div>'}
function renderHomeR1(d){const box=ensureHome();if(!box)return;const due=d.deals.filter(dueDeal).length,quote=d.deals.filter(quoteDeal).length,exec=d.deals.filter(executionDeal).length,recentDocs=d.docs.filter(x=>recent(x.updated_at||x.created_at,7)).length;box.innerHTML=`
<div class="workspace-r1-attention">
 <button class="workspace-r1-stat" data-r1-nav="deals" data-r1-filter="attention" data-tone="warn"><span><b>今天 / 已逾期跟进</b><small>需要先处理的业务</small></span><strong>${due}</strong></button>
 <button class="workspace-r1-stat" data-r1-nav="deals" data-r1-filter="quote" data-tone="brand"><span><b>待报价 / 谈判</b><small>仍在成交推进阶段</small></span><strong>${quote}</strong></button>
 <button class="workspace-r1-stat" data-r1-nav="deals" data-r1-filter="execution" data-tone="ok"><span><b>订单执行中</b><small>PI 后到出运前</small></span><strong>${exec}</strong></button>
 <button class="workspace-r1-stat" data-r1-nav="documents" data-r1-filter="recent"><span><b>近 7 天单据</b><small>最近制作或修改</small></span><strong>${recentDocs}</strong></button>
</div>
<div class="workspace-r1-overview">
 <section class="workspace-r1-mini-panel"><div class="workspace-r1-mini-head"><b>业务组成</b><span>按当前阶段归类，不让用户猜数字</span></div><div class="workspace-r1-stage-list">${stageRows(d.deals)}</div></section>
 <section class="workspace-r1-mini-panel"><div class="workspace-r1-mini-head"><b>最近工作</b><span>最近修改的业务 / 客户 / 单据</span></div><div class="workspace-r1-recent-list">${recentRows(d)}</div></section>
</div>`}

function summaryHost(view){const sec=$(`#view-${view}`);if(!sec)return null;let h=$('.workspace-r1-summary',sec);if(!h){h=document.createElement('div');h.className='workspace-r1-summary';const head=$('.section-head',sec);head?.insertAdjacentElement('afterend',h)}return h}
function chip(view,key,label,count,active){return `<button class="workspace-r1-chip${active?' active':''}" data-r1-summary="${view}" data-r1-filter="${key}"><span>${esc(label)}</span><strong>${count}</strong></button>`}
function renderSummaries(d){
 const todayV=today();
 const activeCustomerIds=new Set(d.deals.filter(activeDeal).map(x=>String(x.customer_id||'')));
 const usedProductIds=new Set(d.deals.filter(activeDeal).flatMap(x=>x.product_ids||[]).map(String));
 const defs={
  deals:[['all','全部',d.deals.length],['attention','今天/逾期',d.deals.filter(dueDeal).length],['quote','待报价/谈判',d.deals.filter(quoteDeal).length],['execution','执行中',d.deals.filter(executionDeal).length],['closed','已出运/完成',d.deals.filter(x=>['shipped','completed'].includes(x.stage)).length]],
  customers:[['all','全部客户',d.customers.length],['active','有进行中业务',d.customers.filter(x=>activeCustomerIds.has(String(x.id))).length],['due','近期需跟进',d.customers.filter(x=>dateOnly(x.followup_date)&&dateOnly(x.followup_date)<=todayV).length],['contact','联系方式待补',d.customers.filter(x=>!text(x.email)&&!text(x.phone)).length]],
  products:[['all','全部商品',d.products.length],['used','当前业务在用',d.products.filter(x=>usedProductIds.has(String(x.id))).length],['ready','基础资料较完整',d.products.filter(x=>text(x.price)&&text(x.spec)&&(text(x.image_url)||text(x.remote_image_url))).length],['hs','HS Code 待补',d.products.filter(x=>!text(x.hs_code)).length]],
  documents:[['all','全部单据',d.docs.length],['quotation','报价',d.docs.filter(x=>getDocType(x)==='quotation').length],['order','PI / 合同',d.docs.filter(x=>['proforma_invoice','sales_contract'].includes(getDocType(x))).length],['shipment','CI / 装箱',d.docs.filter(x=>['commercial_invoice','packing_list'].includes(getDocType(x))).length],['recent','近 7 天',d.docs.filter(x=>recent(x.updated_at||x.created_at,7)).length]],
  catalog:[['all','商品总数',d.products.length],['image','有图片',d.products.filter(x=>text(x.image_url)||text(x.remote_image_url)).length],['priced','有价格',d.products.filter(x=>text(x.price)).length]],
  brands:[['all','品牌资料',d.brands.length],['logo','已有 Logo',d.brands.filter(x=>text(x.logo_data)).length],['bank','已有收款信息',d.brands.filter(x=>text(x.bank_name)||text(x.bank_account)||text(x.account_no)).length]],
  templates:[['all','常用模板',d.templates.length],['typed','已关联单据类型',d.templates.filter(x=>text(x.kind)).length]],
  mail:[['all','邮件草稿',d.mail.length],['linked','已关联客户',d.mail.filter(x=>text(x.customer_id)||text(x.customer_name)).length],['recent','近 7 天修改',d.mail.filter(x=>recent(x.updated_at||x.created_at,7)).length]],
  recycle:[['all','回收项目',d.recycle.length]]
 };
 Object.entries(defs).forEach(([view,items])=>{const h=summaryHost(view);if(!h)return;const active=state.filters[view]||'all';h.innerHTML=`<span class="workspace-r1-summary-label">快速归类</span>${items.map(x=>chip(view,x[0],x[1],x[2],x[0]===active)).join('')}`});
}
function idsFor(view,key,d){if(!key||key==='all')return null;switch(view){
 case'deals':return new Set(d.deals.filter(x=>key==='attention'?dueDeal(x):key==='quote'?quoteDeal(x):key==='execution'?executionDeal(x):key==='closed'?['shipped','completed'].includes(x.stage):true).map(x=>String(x.id)));
 case'customers':{const activeIds=new Set(d.deals.filter(activeDeal).map(x=>String(x.customer_id||'')));return new Set(d.customers.filter(x=>key==='active'?activeIds.has(String(x.id)):key==='due'?(dateOnly(x.followup_date)&&dateOnly(x.followup_date)<=today()):key==='contact'?(!text(x.email)&&!text(x.phone)):true).map(x=>String(x.id)))}
 case'products':{const used=new Set(d.deals.filter(activeDeal).flatMap(x=>x.product_ids||[]).map(String));return new Set(d.products.filter(x=>key==='used'?used.has(String(x.id)):key==='ready'?(text(x.price)&&text(x.spec)&&(text(x.image_url)||text(x.remote_image_url))):key==='hs'?!text(x.hs_code):true).map(x=>String(x.id)))}
 case'documents':return new Set(d.docs.filter(x=>key==='quotation'?getDocType(x)==='quotation':key==='order'?['proforma_invoice','sales_contract'].includes(getDocType(x)):key==='shipment'?['commercial_invoice','packing_list'].includes(getDocType(x)):key==='recent'?recent(x.updated_at||x.created_at,7):true).map(x=>String(x.id)));
 default:return null}}
function tableFor(view){return $(`#view-${view} tbody`)}
function applyFilter(view,d){const tbody=tableFor(view);if(!tbody)return;const key=state.filters[view]||'all',ids=idsFor(view,key,d);$$('tr',tbody).forEach(row=>{const id=rowId(row);row.hidden=!!ids&&!!id&&!ids.has(String(id))});}
function markRows(){['deals','customers','products','documents'].forEach(v=>$$(`#view-${v} tbody tr`).forEach(r=>{if(rowId(r))r.classList.add('workspace-r1-clickable')}))}

function detailField(label,value,full=false){return `<div class="workspace-r1-detail-field${full?' full':''}"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`}
function drawer(){let d=$('.workspace-r1-drawer');if(d)return d;d=document.createElement('aside');d.className='workspace-r1-drawer';d.setAttribute('aria-hidden','true');d.innerHTML='<div class="workspace-r1-drawer-head"><div><small id="r1DrawerKind">详情</small><h3 id="r1DrawerTitle">—</h3></div><button class="workspace-r1-drawer-close" type="button" aria-label="关闭">×</button></div><div class="workspace-r1-drawer-body" id="r1DrawerBody"></div>';document.body.appendChild(d);$('.workspace-r1-drawer-close',d).onclick=closeDrawer;return d}
function closeDrawer(){const d=drawer();d.classList.remove('open');d.setAttribute('aria-hidden','true');state.drawer=null}
function related(title,items){if(!items.length)return'';return `<section class="workspace-r1-detail-section"><h4>${esc(title)}</h4><div class="workspace-r1-related">${items.map(x=>`<div class="workspace-r1-related-item"><b>${esc(x.label)}</b><span>${esc(x.meta||'')}</span></div>`).join('')}</div></section>`}
function showDetail(view,id){const d=data(),dr=drawer(),kind=$('#r1DrawerKind',dr),title=$('#r1DrawerTitle',dr),body=$('#r1DrawerBody',dr);let html='',actions='';
 if(view==='deals'){const x=byId(d.deals,id);if(!x)return;const c=byId(d.customers,x.customer_id),ps=productNames(x.product_ids,d.products);kind.textContent='业务详情';title.textContent=x.title||c?.company||'未命名业务';html=`<section class="workspace-r1-detail-section"><h4>当前状态</h4><div class="workspace-r1-detail-grid">${detailField('客户',c?.company||'未关联')}${detailField('阶段',x.stage||'未设置')}${detailField('预计金额',fmtMoney(x.estimated_amount,x.currency))}${detailField('成交概率',`${x.probability||0}%`)}${detailField('下一步',x.next_action||'待安排',true)}${detailField('跟进日期',x.next_action_at||'未定')}${detailField('关联商品',ps.join('、')||'未关联',true)}</div></section>`;actions=`<button class="btn primary" data-action="deal-next" data-id="${esc(id)}">继续业务</button><button class="btn" data-action="deal-edit" data-id="${esc(id)}">编辑资料</button>`;}
 if(view==='customers'){const x=byId(d.customers,id);if(!x)return;const ds=d.deals.filter(y=>String(y.customer_id||'')===String(id)),docs=d.docs.filter(y=>String(docCustomerId(y)||'')===String(id)||getDocCustomer(y)===x.company);kind.textContent='客户详情';title.textContent=x.company||x.contact||'未命名客户';html=`<section class="workspace-r1-detail-section"><h4>基础资料</h4><div class="workspace-r1-detail-grid">${detailField('联系人',x.contact)}${detailField('国家 / 地区',x.country)}${detailField('邮箱',x.email,true)}${detailField('电话 / WhatsApp',x.phone,true)}${detailField('币种',x.currency)}${detailField('下次跟进',x.followup_date)}${detailField('标签',x.tags,true)}</div></section>${related('关联业务',ds.slice(0,5).map(y=>({label:y.title||'未命名业务',meta:y.stage||''})))}${related('最近单据',docs.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,5).map(y=>({label:`${names[getDocType(y)]||'单据'} · ${getDocNo(y)}`,meta:dateOnly(y.updated_at)})))}`;actions=`<button class="btn primary" data-action="customer-quote" data-id="${esc(id)}">做报价</button><button class="btn" data-action="customer-edit" data-id="${esc(id)}">编辑客户</button>`;}
 if(view==='products'){const x=byId(d.products,id);if(!x)return;const ds=d.deals.filter(y=>(y.product_ids||[]).map(String).includes(String(id)));kind.textContent='商品详情';title.textContent=x.name||'未命名商品';html=`<section class="workspace-r1-detail-section"><h4>商品资料</h4><div class="workspace-r1-detail-grid">${detailField('SKU / 型号',x.sku)}${detailField('分类',x.category)}${detailField('参考价格',fmtMoney(x.price,x.currency))}${detailField('MOQ',x.moq)}${detailField('HS Code',x.hs_code)}${detailField('供应商',x.supplier_name)}${detailField('规格 / 描述',x.spec,true)}</div></section>${related('当前关联业务',ds.filter(activeDeal).slice(0,5).map(y=>({label:y.title||'未命名业务',meta:y.stage||''})))}`;actions=`<button class="btn primary" data-action="product-quote" data-id="${esc(id)}">做报价</button><button class="btn" data-action="product-edit" data-id="${esc(id)}">编辑商品</button><button class="btn" data-action="catalog-one" data-id="${esc(id)}">做目录</button>`;}
 if(view==='documents'){const x=byId(d.docs,id);if(!x)return;const s=x.summary||{},type=getDocType(x);kind.textContent='单据详情';title.textContent=`${names[type]||'单据'} · ${getDocNo(x)}`;html=`<section class="workspace-r1-detail-section"><h4>单据信息</h4><div class="workspace-r1-detail-grid">${detailField('类型',names[type]||type)}${detailField('状态',s.document_status||x.document_status||'draft')}${detailField('客户',getDocCustomer(x),true)}${detailField('单号',getDocNo(x))}${detailField('更新时间',fmtDate(x.updated_at))}${detailField('来源单号',s.source_document_no||x.source_document_no||'—',true)}</div></section>`;actions=`<button class="btn primary" data-action="doc-open" data-id="${esc(id)}">继续编辑</button>`;}
 if(!html)return;body.innerHTML=`${html}<div class="workspace-r1-drawer-actions">${actions}</div>`;dr.classList.add('open');dr.setAttribute('aria-hidden','false');state.drawer={view,id}}

function refresh(){const d=data();navCounts(d);renderHomeR1(d);renderSummaries(d);['deals','customers','products','documents'].forEach(v=>applyFilter(v,d));markRows();}
function scheduleRefresh(ms=0){clearTimeout(scheduleRefresh.t);scheduleRefresh.t=setTimeout(refresh,ms)}
function onClick(e){
 const navAction=e.target.closest('[data-r1-nav]');if(navAction){const view=navAction.dataset.r1Nav,key=navAction.dataset.r1Filter||'all';state.filters[view]=key;nav(view);scheduleRefresh();return}
 const chip=e.target.closest('[data-r1-summary]');if(chip){const view=chip.dataset.r1Summary;state.filters[view]=chip.dataset.r1Filter||'all';refresh();return}
 if(e.target.closest('.workspace-r1-drawer-close'))return;
 if(e.target.closest('button,a,input,label,select,textarea,[data-action]')){scheduleRefresh(40);return}
 const row=e.target.closest('tbody tr.workspace-r1-clickable');if(row){const view=document.body.dataset.huidiView||'',id=rowId(row);if(['deals','customers','products','documents'].includes(view)&&id)showDetail(view,id)}
 const navBtn=e.target.closest('.nav-btn');if(navBtn)scheduleRefresh();
}
function boot(){document.body.classList.add('workspace-r1');document.body.dataset.workspaceRelease=VERSION;buildNav();drawer();refresh();document.addEventListener('click',onClick);document.addEventListener('input',()=>scheduleRefresh(20),true);document.addEventListener('change',()=>scheduleRefresh(20),true);window.addEventListener('HUIDI:local-data-change',()=>scheduleRefresh(20));window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.drawer)closeDrawer()});try{window.HUIDILocalCore?.bus?.on?.(()=>scheduleRefresh(30))}catch(_){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
