/* HUIDI Community × Online Functional Closure V1
   Final capability-positioning layer for the fused Online workspace.
   Reuses existing APIs and Owners; no repository/storage/business ownership. */
(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineFunctionalClosure)return;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PAGE_COPY={
  home:['外贸工作台','今天的客户回复、跟进、询盘、邮件和单据集中处理。'],
  mail:['客户沟通','收件、发送、待发送和自动跟进统一处理。'],
  'online-find':['客户开发','搜索、地图、联系人、背调与潜客池在一条开发流程。'],
  'online-intel':['市场情报','市场、贸易、关税、汇率与物流用于开发和订单判断。'],
  'online-admin':['团队与设置','团队、公司资料、数据来源与安全设置统一管理。']
};
let capabilityPromise=null, mapRows=[], cleanupTimer=0, renderTimer=0;

async function api(url,opt={}){
  const headers={Accept:'application/json',...(opt.headers||{})};
  if(opt.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  const r=await fetch(url,{credentials:'same-origin',...opt,headers});
  let body=null;try{body=await r.json()}catch(_){body=await r.text().catch(()=>null)}
  if(r.status===401){location.assign('/login');throw new Error('登录状态已失效')}
  if(!r.ok)throw new Error(clean(body?.detail||body?.message||body)||`请求失败 (${r.status})`);
  return body;
}
function normalizePageCopy(){
  const view=document.body.dataset.huidiView||location.hash.replace(/^#/,'')||'home',copy=PAGE_COPY[view];
  if(!copy)return;
  const title=$('#pageTitle'),desc=$('#pageDesc');
  if(title&&title.textContent!==copy[0])title.textContent=copy[0];
  if(desc&&desc.textContent!==copy[1])desc.textContent=copy[1];
}
function normalizeCounts(){
  $$('.sidebar .nav-btn[data-view]').forEach(b=>{
    const count=$('.workspace-nav-count',b);if(!count)return;
    const value=clean(count.textContent).toLowerCase();
    if(b.dataset.view?.startsWith('online-')||['undefined','null','nan'].includes(value)){
      count.textContent='';count.hidden=true;
    }
  });
  normalizePageCopy();
}
function scheduleCleanup(ms=70){clearTimeout(cleanupTimer);cleanupTimer=setTimeout(normalizeCounts,ms)}
function statusLabel(on){return on?'可用':'待连接'}
function statusClass(on){return on?'ready':'off'}
function providers(xs){return Array.isArray(xs)&&xs.length?xs.join(' → '):'未配置'}
async function capabilities(force=false){
  if(force)capabilityPromise=null;
  if(capabilityPromise)return capabilityPromise;
  capabilityPromise=(async()=>{
    const [svc,acq,boxes]=await Promise.allSettled([api('/api/services/status'),api('/api/acquisition/status'),api('/api/mail/accounts')]);
    const services=svc.status==='fulfilled'?(svc.value.services||{}):{};
    const acquisition=acq.status==='fulfilled'?acq.value:{};
    const mailboxes=boxes.status==='fulfilled'&&Array.isArray(boxes.value)?boxes.value:[];
    return {services,acquisition,mailboxes,errors:[svc,acq,boxes].filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||'连接状态读取失败'))};
  })();
  return capabilityPromise;
}
function capCard(label,on,sub,action=''){
  return `<div class="hfc-cap ${statusClass(on)}"><div><b>${esc(label)}</b><span>${esc(sub)}</span></div><em>${statusLabel(on)}</em>${action?`<button type="button" data-hfc-tab="${esc(action)}">打开</button>`:''}</div>`;
}
function ensureCapHost(view,title,desc){
  const root=$(`#view-${view}`);if(!root)return null;
  let host=$(`.hfc-capability[data-hfc-view="${view}"]`,root);
  if(!host){
    host=document.createElement('details');host.className='hfc-capability';host.dataset.hfcView=view;
    const tabs=$(':scope > .fv2-tabs',root),head=$(':scope > .section-head',root);
    if(tabs)root.insertBefore(host,tabs);else if(head)head.insertAdjacentElement('afterend',host);else root.prepend(host);
  }
  host.innerHTML=`<summary class="hfc-cap-head"><strong>${esc(title)}</strong><span>连接状态 / 展开查看</span></summary><div class="hfc-cap-tools"><span>${esc(desc)}</span><button type="button" data-hfc-refresh>刷新状态</button></div><div class="hfc-cap-grid"><div class="hfc-cap-loading">正在读取真实连接状态…</div></div>`;
  return host;
}
async function renderCapabilities(force=false){
  const data=await capabilities(force),s=data.services||{},a=data.acquisition||{},mailboxes=data.mailboxes||[];
  const connectedMail=mailboxes.filter(x=>x?.enabled&&x?.connection_state==='connected');
  const mailReady=connectedMail.length>0;
  const find=ensureCapHost('online-find','客户开发引擎','搜索、联系人、地图和邮件必须明确告诉你当前能不能真实使用。');
  if(find){
    const cards=[
      capCard('企业搜索',!!a.live_company_search,`来源：${providers(a.company_search_order)}`,'online-find:base'),
      capCard('联系人搜索',!!a.live_contact_search,`来源：${providers(a.contact_search_order)}`,'online-find:contacts'),
      capCard('地图线索',!!s.map_search,s.map_search?'在线地点搜索已连接':'在线地图搜索服务尚未配置','online-find:map'),
      capCard('邮件触达',mailReady,mailReady?`${connectedMail.length} 个发送邮箱已连接`:`尚无已连接发送邮箱 · SMTP / IMAP ${s.mail?.company_mail?'可配置':'未启用'}`,'mail:mailbox')
    ];
    $('.hfc-cap-grid',find).innerHTML=cards.join('');
  }
  const mail=ensureCapHost('mail','邮件发送引擎','邮箱连接、待发送与自动跟进仍使用同一套邮件 Owner，不再用弹窗报错代替状态。');
  if(mail){
    $('.hfc-cap-grid',mail).innerHTML=[
      capCard('Gmail OAuth',!!s.mail?.gmail,s.mail?.gmail?'平台 OAuth 已配置':'平台尚未配置 Gmail OAuth','mail:inbox'),
      capCard('Outlook OAuth',!!s.mail?.outlook,s.mail?.outlook?'平台 OAuth 已配置':'平台尚未配置 Outlook OAuth','mail:inbox'),
      capCard('其他邮箱',!!s.mail?.company_mail,'可使用 SMTP / IMAP 连接','mail:mailbox'),
      capCard('自动跟进',mailReady,mailReady?'已有发送邮箱，可按确认序列执行':'先连接至少一个发送邮箱','mail:sequences')
    ].join('');
  }
  const intel=ensureCapHost('online-intel','外贸数据与判断引擎','把市场、企业、贸易、关税、汇率和物流能力放回各自业务位置。');
  if(intel){
    $('.hfc-cap-grid',intel).innerHTML=[
      capCard('市场动态',!!s.trade_news,s.trade_news?'在线新闻搜索已连接':'在线新闻来源尚未配置','online-intel:live'),
      capCard('企业核验',!!s.company_check,s.company_check?'企业数据源已连接':'企业核验数据源待连接','online-find:company'),
      capCard('贸易记录',!!s.trade_data,s.trade_data?'贸易数据源已连接':'贸易数据源待连接','online-intel:trade'),
      capCard('HS / 关税',!!s.tariff,s.tariff?'关税数据源已连接':'关税数据源待连接','online-intel:tariff'),
      capCard('汇率',s.fx===true,'内置实时汇率服务','online-intel:fx'),
      capCard('船期 / 物流',!!s.shipping,s.shipping?'物流数据源已连接':'物流数据源待连接','online-intel:shipping')
    ].join('');
  }
  const admin=ensureCapHost('online-admin','工作区能力总览','这里负责“能否使用/从哪里接入”；业务页面只负责使用，不重复配置。');
  if(admin){
    const ready=[
      !!a.live_company_search,!!a.live_contact_search,!!s.map_search,
      mailReady,
      !!s.company_check,!!s.trade_data,!!s.tariff,s.fx===true,!!s.shipping
    ].filter(Boolean).length;
    $('.hfc-cap-grid',admin).innerHTML=[
      `<div class="hfc-cap hfc-summary ready"><div><b>当前可用能力</b><span>按真实后端状态统计，不用演示数据冒充。</span></div><strong>${ready}/9</strong></div>`,
      capCard('搜索与获客',!!a.live_company_search,`企业：${providers(a.company_search_order)} · 联系人：${providers(a.contact_search_order)}`,'online-find:base'),
      capCard('邮箱与触达',mailReady,mailReady?`${connectedMail.length} 个邮箱已连接`:'尚无已连接邮箱 · 可使用 Gmail / Outlook / SMTP-IMAP','mail:mailbox'),
      capCard('外贸数据源',!!(s.company_check||s.trade_data||s.tariff||s.shipping),'企业、贸易、关税、物流统一在“数据来源”管理','online-admin:sources')
    ].join('');
  }
  normalizePageCopy();
  if(data.errors?.length){$$('.hfc-capability').forEach(host=>{const note=document.createElement('div');note.className='hfc-inline-state';note.setAttribute('role','status');note.textContent='部分连接状态未能读取，请刷新后核对。';host.appendChild(note)})}
  document.body.dataset.huidiFunctionalClosure='v1';
}
function scheduleCapabilities(ms=80,force=false){clearTimeout(renderTimer);renderTimer=setTimeout(()=>renderCapabilities(force).catch(()=>{}),ms)}
function openTabSpec(spec){
  const [view,key]=String(spec||'').split(':');if(!view||!key)return;
  const nav=$(`.nav-btn[data-view="${CSS.escape(view)}"]`);
  if(nav&&!nav.classList.contains('active'))nav.click();
  setTimeout(()=>window.HUIDICommunityOnlineFullV2?.openTab?.(view,key),40);
}
function inlineState(anchor,title,detail,tone='warn',actions=''){
  const card=anchor?.closest?.('.hs-card,.sq-card,.fv2-pane')||anchor?.parentElement;if(!card)return;
  let box=$('.hfc-inline-state',card);
  if(!box){box=document.createElement('div');box.className='hfc-inline-state';card.prepend(box)}
  box.dataset.tone=tone;
  box.innerHTML=`<div><b>${esc(title)}</b><span>${esc(detail)}</span></div>${actions?`<div class="hfc-inline-actions">${actions}</div>`:''}`;
}
async function handleMailConnect(btn){
  const provider=clean(btn.dataset.connect);if(!provider)return;
  const label=provider==='gmail'?'Gmail':'Outlook';
  const old=btn.textContent;btn.disabled=true;btn.textContent='正在检查…';
  try{
    const out=await api(`/api/mail/connect/${encodeURIComponent(provider)}/start`);
    if(!out?.authorize_url)throw new Error(`${label} 尚未完成连接配置`);
    window.open(out.authorize_url,'huidi-mail-connect','width=720,height=760');
    inlineState(btn,`${label} 授权已打开`,'完成授权后返回本页刷新邮箱状态。','ok');
  }catch(e){
    inlineState(btn,`${label} 当前不能连接`,clean(e.message||e)||'平台 OAuth 尚未配置。','warn',
      '<button type="button" data-hfc-other-mail>连接其他邮箱</button><button type="button" data-hfc-tab="online-admin:sources">查看连接状态</button>');
  }finally{btn.disabled=false;btn.textContent=old}
}
async function handleMailSync(btn){
  const old=btn.textContent;btn.disabled=true;btn.textContent='正在收取…';
  try{
    await api('/api/mail/sync-all',{method:'POST',body:'{}'});
    inlineState(btn,'邮箱已刷新','已完成本次收取。','ok');
    const active=$('#view-mail .fv2-tab.active')?.dataset.fv2Tab||'inbox';
    if(['inbox','sent','mailbox'].includes(active))setTimeout(()=>window.HUIDICommunityOnlineFullV2?.openTab?.('mail',active,{force:true}),50);
  }catch(e){
    inlineState(btn,'暂时无法收取邮件',clean(e.message||e),'warn',
      '<button type="button" data-hfc-tab="mail:mailbox">检查邮箱连接</button>');
  }finally{btn.disabled=false;btn.textContent=old}
}
function number(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function osmUrl(row){
  const lat=number(row?.lat),lng=number(row?.lng);if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return'';
  const d=.035,bbox=[lng-d,lat-d,lng+d,lat+d].map(x=>x.toFixed(6)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}
function mapCard(row,i){
  return `<article class="hfc-map-row${i===0?' active':''}" data-hfc-map-row="${i}">
    <div class="hfc-map-row-main"><b>${esc(row.name||'未命名公司')}</b><span>${esc([row.category,row.address].filter(Boolean).join(' · ')||'暂无地址资料')}</span><small>${esc([row.phone,row.rating?`评分 ${row.rating}`:'',row.reviews?`${row.reviews} 条评价`:''].filter(Boolean).join(' · '))}</small></div>
    <div class="hfc-map-actions">${row.website?`<a href="${esc(row.website)}" target="_blank" rel="noreferrer">官网</a>`:''}<button type="button" data-hfc-map-select="${i}">地图</button><button type="button" class="primary" data-hfc-map-add="${i}">加入潜客</button></div>
  </article>`;
}
function showMap(i=0){
  const box=$('#hfcRealMap'),row=mapRows[i];if(!box)return;
  $$('.hfc-map-row').forEach(x=>x.classList.toggle('active',Number(x.dataset.hfcMapRow)===i));
  if(!row){box.innerHTML='<div class="hfc-map-empty">选择一家公司查看位置。</div>';return}
  const url=osmUrl(row);
  box.innerHTML=url
    ?`<iframe title="${esc(row.name||'公司位置')}" src="${esc(url)}" loading="lazy" referrerpolicy="no-referrer"></iframe><div class="hfc-map-caption"><b>${esc(row.name||'公司')}</b><span>${esc(row.address||'坐标位置')}</span></div>`
    :`<div class="hfc-map-empty"><b>${esc(row.name||'公司')}</b><span>这条结果暂时没有可用坐标；仍可查看官网或加入潜客继续核验。</span></div>`;
}
function renderMapResults(rows){
  const box=$('#hsMapResults');if(!box)return;
  mapRows=Array.isArray(rows)?rows:[];
  if(!mapRows.length){box.innerHTML='<div class="hfc-map-empty">没有找到合适结果。换一个更具体的产品词、城市或买家类型再试。</div>';return}
  box.className='hfc-map-workbench';
  box.innerHTML=`<div class="hfc-map-list"><div class="hfc-map-list-head"><b>找到 ${mapRows.length} 家</b><span>先看位置与官网，确认后再加入潜客池。</span></div>${mapRows.map(mapCard).join('')}</div><div id="hfcRealMap" class="hfc-map-canvas"></div>`;
  showMap(0);
}
async function runMap(btn){
  const keyword=clean($('#hsMapKeyword')?.value),location=clean($('#hsMapLocation')?.value),buyer=clean($('#hsMapBuyer')?.value);
  if(!keyword){inlineState(btn,'先填写产品 / 行业','例如 stainless steel hinge、hardware importer。');$('#hsMapKeyword')?.focus();return}
  const {services}=await capabilities();
  if(!services?.map_search){
    const box=$('#hsMapResults');if(box){box.className='';box.innerHTML='<div class="hfc-engine-missing"><b>地图找客户引擎尚未连接</b><span>当前部署没有配置在线地点搜索来源，所以这里不会生成假公司。平台管理员连接地图搜索服务后，本页会直接返回真实公司与坐标。</span><button type="button" data-hfc-tab="online-admin:base">查看全部引擎状态</button></div>'}
    return;
  }
  const box=$('#hsMapResults');if(box){box.className='';box.innerHTML='<div class="hfc-map-empty">正在读取真实地点结果…</div>'}
  try{
    const out=await api('/api/tools/map-leads',{method:'POST',body:JSON.stringify({keyword,location,buyer_type:buyer,limit:30})});
    renderMapResults(out.items||[]);
  }catch(e){
    if(box)box.innerHTML=`<div class="hfc-engine-missing"><b>地图查询没有完成</b><span>${esc(clean(e.message||e))}</span><button type="button" data-hfc-tab="online-admin:base">查看引擎状态</button></div>`;
  }
}
async function addMapLead(i,btn){
  const row=mapRows[i];if(!row)return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='加入中…';
  try{
    const out=await api('/api/tools/map-leads/import',{method:'POST',body:JSON.stringify({
      name:row.name||'',website:row.website||'',address:row.address||'',
      country:clean($('#hsMapLocation')?.value),phone:row.phone||'',category:row.category||'',
      product_keyword:clean($('#hsMapKeyword')?.value),buyer_type:clean($('#hsMapBuyer')?.value),source_url:row.source_url||''
    })});
    btn.textContent=out.created?'已加入':'已在潜客池';btn.classList.remove('primary');btn.disabled=true;
    const head=$('.hfc-map-list-head span');if(head)head.textContent=out.created?'已加入潜客池，可继续联系人搜索、背调和开发。':'该公司已经在潜客池。';
    window.HUIDIDailyWorkbench?.refresh?.();window.HUIDIBeginnerFlow?.refresh?.();
  }catch(e){btn.disabled=false;btn.textContent=old;inlineState(btn,'加入潜客失败',clean(e.message||e))}
}
function handleClicks(e){
  const tab=e.target.closest('[data-hfc-tab]');if(tab){e.preventDefault();openTabSpec(tab.dataset.hfcTab);return}
  if(e.target.closest('[data-hfc-refresh]')){e.preventDefault();renderCapabilities(true).catch(()=>{});return}
  const other=e.target.closest('[data-hfc-other-mail]');if(other){e.preventDefault();const legacy=$('[data-other-mail]');if(legacy)legacy.click();else openTabSpec('mail:mailbox');return}
  const connect=e.target.closest('[data-connect]');if(connect){e.preventDefault();e.stopImmediatePropagation();handleMailConnect(connect);return}
  const sync=e.target.closest('[data-hs-sync]');if(sync){e.preventDefault();e.stopImmediatePropagation();handleMailSync(sync);return}
  const mapSearch=e.target.closest('[data-map-search]');if(mapSearch){e.preventDefault();e.stopImmediatePropagation();runMap(mapSearch);return}
  const select=e.target.closest('[data-hfc-map-select]');if(select){e.preventDefault();showMap(Number(select.dataset.hfcMapSelect));return}
  const add=e.target.closest('[data-hfc-map-add]');if(add){e.preventDefault();addMapLead(Number(add.dataset.hfcMapAdd),add);return}
  const row=e.target.closest('[data-hfc-map-row]');if(row&&!e.target.closest('a,button'))showMap(Number(row.dataset.hfcMapRow));
  scheduleCleanup(70);
  if(e.target.closest('.nav-btn,[data-fv2-tab]'))scheduleCapabilities(90,false);
}
function bind(){
  document.addEventListener('click',handleClicks,true);
  document.addEventListener('input',()=>scheduleCleanup(70),true);
  document.addEventListener('change',()=>scheduleCleanup(70),true);
  ['HUIDI:local-data-change','HUIDI:closure-rendered','HUIDI:community-cloud-ready','HUIDI:community-online-view'].forEach(name=>window.addEventListener(name,()=>{scheduleCleanup(80);scheduleCapabilities(110,false)}));
}
function boot(){
  bind();normalizeCounts();renderCapabilities().catch(()=>{});
  window.addEventListener('HUIDI:mail-accounts-changed',()=>renderCapabilities(true).catch(()=>{}));
  window.addEventListener('HUIDI:fusion-pane-rendered',()=>{normalizeCounts();normalizePageCopy()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineFunctionalClosure=Object.freeze({version:'1.0.1',normalizeCounts,normalizePageCopy,renderCapabilities,runMap});
})();