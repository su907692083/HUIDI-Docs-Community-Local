(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineFullV2)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=v=>clean(v).replace('T',' ').slice(0,16)||'—';
const savedTabs={};
const paneLoaders=new Map(),paneStates=new WeakMap(),paneForms=new WeakMap();
let paneSerial=Promise.resolve(),paneEpoch=0,activeRequest=null;
const loaders=new Map();
const roleName=v=>({owner:'老板',admin:'管理员',sales:'业务员',viewer:'只读成员'})[v]||v||'成员';
const statusName=v=>({new:'新客户',qualified:'已筛选',contacted:'已联系',replied:'已回复',converted:'已转询盘',archived:'已归档'})[v]||v||'未设置';
const moduleDefs={sourceSettings:['service-settings.js','HUIDIServiceSettings'],
 plain:['plain-language.js','HUIDIPlainLanguage'],
 nav:['daily-navigation.js','HUIDIDailyNavigation'],
 services:['daily-services.js','HUIDIDailyServices'],
 sequence:['sequence-ui.js','HUIDISequenceUI'],
 audit:['audit-ui.js','HUIDIAuditUI'],
 mailbox:['mail-governance.js','HUIDIMailGovernance'],
 mailPaging:['mail-list-pagination-ui.js','HUIDIMailListPagination'],
 sequencePaging:['sequence-pagination-ui.js','HUIDISequencePagination'],
 mailThreads:['mail-thread-ui.js','HUIDIMailThreads']
};
async function api(url,opt={}){const headers={Accept:'application/json',...(opt.headers||{})};if(opt.body&&!headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(url,{credentials:'same-origin',...opt,headers});let body=null;try{body=await r.json()}catch(_){body=await r.text().catch(()=>null)}if(r.status===401){location.assign('/login');throw new Error('登录状态已失效')}if(!r.ok)throw new Error(clean(body?.detail||body?.message||body)||`请求失败 (${r.status})`);return body}
function toast(message,type='ok'){const wrap=$('#toastWrap');if(!wrap)return;const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;wrap.appendChild(el);setTimeout(()=>el.remove(),3600)}
function loadModule(key){
 if(loaders.has(key))return loaders.get(key);
 const def=moduleDefs[key];if(!def)return Promise.reject(new Error('未知联网模块'));
 const [file,global]=def;if(window[global])return Promise.resolve(window[global]);
 if(key==='mailbox'&&!document.querySelector('link[data-fv2-mailbox-css]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/mail-governance.css';link.dataset.fv2MailboxCss='1';document.head.appendChild(link);
 }
 let tag;
 const task=new Promise((resolve,reject)=>{
  tag=document.createElement('script');tag.src=`/assets/${file}?v=${encodeURIComponent(document.querySelector('meta[name=huidi-asset-revision]')?.content||'ux-v1')}`;tag.dataset.fv2Module=file;
  const timer=setTimeout(()=>{tag.remove();reject(new Error(`${file} 加载超时，请重试`))},12000);
  tag.onload=()=>{clearTimeout(timer);window[global]?resolve(window[global]):reject(new Error(`${file} 未初始化`))};
  tag.onerror=()=>{clearTimeout(timer);tag.remove();reject(new Error(`${file} 加载失败，请重试`))};
  document.head.appendChild(tag);
 }).catch(error=>{loaders.delete(key);tag?.remove();throw error});
 loaders.set(key,task);return task;
}
function rememberPane(pane){
 if(!pane)return;
 const fields=[...pane.querySelectorAll('input[id],select[id],textarea[id]')].filter(x=>!['password','file','hidden'].includes(x.type));
 paneForms.set(pane,{scroll: pane.scrollTop,fields:fields.map(x=>({id:x.id,value:x.value,checked:x.checked}))});
}
function restorePane(pane){
 const saved=paneForms.get(pane);if(!saved)return;
 for(const f of saved.fields){const x=pane.querySelector('#'+CSS.escape(f.id));if(!x)continue;
  if(x.tagName==='SELECT'&&![...x.options].some(o=>o.value===f.value))continue;
  x.value=f.value;if(['checkbox','radio'].includes(x.type))x.checked=f.checked;
 }
 pane.scrollTop=saved.scroll||0;
}
function registerPane(view,key,loader){paneLoaders.set(`${view}:${key}`,loader)}
function invalidate(view,key){const pane=ensurePane($(`#view-${view}`),key);if(pane)paneStates.delete(pane)}
function sharedRoot(view,key){
 if(view==='mail'&&['inbox','sent','mailbox','queue'].includes(key))return '#huidiServiceBack';
 if(view==='online-find'&&['map','company'].includes(key))return '#huidiServiceBack';
 if(view==='online-find'&&['contacts','notifications'].includes(key))return '#huidiNavBack';
 if(view==='online-intel'&&['live','trade','tariff','fx','shipping'].includes(key))return '#huidiServiceBack';
 if(view==='online-intel'&&['world-map','customer-intel'].includes(key))return '#huidiIntelBack';
 if(view==='mail'&&key==='sequences')return '#sqBack';
 return '';
}
function detachModule(name,rootSelector){
 const root=$(rootSelector);if(root?.parentElement?.closest('.fv2-pane'))rememberPane(root.parentElement.closest('.fv2-pane'));
 window[name]?.unmount?.();
}
function note(text,tone=''){return `<div class="fv2-note ${tone}">${esc(text)}</div>`}
function empty(text){return `<div class="fv2-empty">${esc(text)}</div>`}
function button(label,attrs='',tone=''){return `<button class="fv2-btn ${tone}" ${attrs}>${esc(label)}</button>`}
function ensurePane(view,key){return view?.querySelector(`[data-fv2-pane="${CSS.escape(key)}"]`)||null}
function tabState(viewId){return savedTabs[viewId]||'base'}
function setHeading(view,title,desc){const h=view?.querySelector(':scope > .section-head h3'),p=view?.querySelector(':scope > .section-head p');if(h&&title)h.textContent=title;if(p&&desc)p.textContent=desc}
function installTabs(viewId,tabs,title,desc){const view=$(`#view-${viewId}`);if(!view||view.dataset.fv2Installed==='1')return;view.dataset.fv2Installed='1';setHeading(view,title,desc);const head=view.querySelector(':scope > .section-head');const movable=[...view.children].filter(x=>x!==head);const bar=document.createElement('div');bar.className='fv2-tabs';bar.setAttribute('role','tablist');const area=document.createElement('div');area.className='fv2-panes';for(const t of tabs){const b=document.createElement('button');b.className='fv2-tab';b.dataset.fv2Tab=t.key;b.dataset.fv2View=viewId;b.textContent=t.label;bar.appendChild(b);const pane=document.createElement('section');pane.className='fv2-pane';pane.dataset.fv2Pane=t.key;pane.dataset.fv2View=viewId;pane.hidden=true;pane.id=`huidi-pane-${viewId}-${t.key}`;b.id=`huidi-tab-${viewId}-${t.key}`;b.type='button';b.setAttribute('aria-controls',pane.id);pane.setAttribute('aria-labelledby',b.id);if(t.key==='base')movable.forEach(n=>pane.appendChild(n));else pane.replaceChildren();area.appendChild(pane)}if(head)head.insertAdjacentElement('afterend',bar);else view.prepend(bar);bar.insertAdjacentElement('afterend',area);bar.addEventListener('click',e=>{const b=e.target.closest('[data-fv2-tab]');if(b)openTab(viewId,b.dataset.fv2Tab,{history:'push'})});bar.addEventListener('keydown',e=>{
 const target=e.target.closest('[role=tab]');if(!target)return;
 const visible=[...bar.querySelectorAll('[role=tab]')].filter(b=>b.getClientRects().length);
 let i=visible.indexOf(target);if(i<0)return;
 if(e.key==='ArrowRight')i=(i+1)%visible.length;else if(e.key==='ArrowLeft')i=(i+visible.length-1)%visible.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=visible.length-1;else return;
 e.preventDefault();visible[i].focus();openTab(viewId,visible[i].dataset.fv2Tab,{history:'push'});
 });openTab(viewId,'base')}
function openTab(viewId,key,options={}){
 const view=$(`#view-${viewId}`),pane=ensurePane(view,key);if(!pane)return Promise.resolve(false);
 const spec=`${viewId}:${key}`;
 const previous=view.querySelector(':scope > .fv2-panes > .fv2-pane.active');
 if(previous&&previous!==pane)rememberPane(previous);
 savedTabs[viewId]=key;
 view.querySelectorAll(':scope > .fv2-tabs .fv2-tab').forEach(b=>{const selected=b.dataset.fv2Tab===key;b.classList.toggle('active',selected);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1});
 view.querySelectorAll(':scope > .fv2-panes > .fv2-pane').forEach(p=>{p.classList.toggle('active',p===pane);p.hidden=p!==pane;p.setAttribute('role','tabpanel')});
 if(view.classList.contains('active')){
  const url=new URL(location.href);if(key==='base')url.searchParams.delete('tab');else url.searchParams.set('tab',key);
  if(url.href!==location.href)history[options.history==='push'?'pushState':'replaceState'](null,'',url);
 }
 if(!view.classList.contains('active'))return Promise.resolve(false);
 if(activeRequest?.spec===spec&&!options.force)return activeRequest.promise;
 const root=sharedRoot(viewId,key),stillMounted=!root||Boolean(pane.querySelector(root));
 if(paneStates.get(pane)==='ready'&&stillMounted&&!options.force)return Promise.resolve(true);
 const epoch=++paneEpoch;
 const job=async()=>{
  if(epoch!==paneEpoch)return false;
  pane.setAttribute('aria-busy','true');
  try{
   if(options.force)rememberPane(pane);
   const custom=paneLoaders.get(spec);
   if(custom)await custom(pane);else await loadPane(viewId,key,pane);
   restorePane(pane);paneStates.set(pane,'ready');
   window.dispatchEvent(new CustomEvent('HUIDI:fusion-pane-rendered',{detail:{view:viewId,key}}));
   return true;
  }catch(error){
   paneStates.delete(pane);pane.replaceChildren();
   const message=document.createElement('div');message.className='fv2-note warn';message.setAttribute('role','status');message.textContent=error.message||String(error);
   const retry=document.createElement('button');retry.className='fv2-btn';retry.textContent='重新加载';retry.onclick=()=>openTab(viewId,key,{force:true});pane.append(message,retry);return false;
  }finally{pane.removeAttribute('aria-busy');if(activeRequest?.promise===promise)activeRequest=null}
 };
 const promise=paneSerial.then(job,job);paneSerial=promise.catch(()=>{});activeRequest={spec,promise};return promise;
}
async function loadPane(view,key,pane){if(key==='base')return;if(view==='online-find'){if(key==='pool')return renderLeadPool(pane);if(key==='followups')return renderFollowups(pane);if(key==='notifications')return mountNavigation(pane,'notifications');if(key==='map')return mountService(pane,'map');if(key==='contacts')return mountNavigation(pane,'contacts');if(key==='company')return mountService(pane,'company');if(key==='smart')return renderSmartDevelopment(pane)}if(view==='mail'){if(key==='inbox')return mountService(pane,'mail','inbox');if(key==='sent')return mountService(pane,'mail','sent');if(key==='mailbox')return mountService(pane,'mail','settings');if(key==='queue')return mountService(pane,'queue');if(key==='sequences')return mountSequence(pane)}if(view==='online-intel'){if(key==='live')return mountService(pane,'intel');if(['trade','tariff','fx','shipping'].includes(key))return mountService(pane,key)}if(view==='online-admin'){if(key==='team')return renderTeam(pane);if(key==='company')return renderCompanySettings(pane);if(key==='sources')return renderSources(pane);if(key==='notifications')return renderNotificationRoutes(pane);if(key==='audit')return mountAudit(pane);if(key==='safety')return renderSafety(pane)}}
async function mountNavigation(pane,view){
 await loadModule('plain').catch(()=>null);const nav=await loadModule('nav');
 detachModule('HUIDIDailyNavigation','#huidiNavBack');pane.replaceChildren();pane.classList.add('fv2-mounted');await nav.mount(pane,view);
}
async function mountService(pane,view,detail=''){
 await loadModule('plain').catch(()=>null);
 const services=await loadModule('services');
 if(view==='mail')await Promise.all([loadModule('mailbox'),loadModule('mailPaging'),loadModule('mailThreads')]);
 if(view==='queue')await loadModule('mailPaging');
 detachModule('HUIDIDailyServices','#huidiServiceBack');pane.replaceChildren();pane.classList.add('fv2-mounted');await services.mount(pane,view,detail);
}
async function mountSequence(pane){
 await loadModule('plain').catch(()=>null);const seq=await loadModule('sequence');await loadModule('sequencePaging');
 detachModule('HUIDISequenceUI','#sqBack');pane.replaceChildren();pane.classList.add('fv2-mounted');await seq.mount(pane);
}
async function mountAudit(pane){
 await loadModule('plain').catch(()=>null);const audit=await loadModule('audit');
 audit.unmount?.();pane.replaceChildren();pane.classList.add('fv2-mounted');await audit.mount(pane);
}
function leadRows(out){return Array.isArray(out)?out:(out?.items||[])}
function poolRow(x){return `<tr data-fv2-lead="${esc(x.id)}"><td><b>${esc(x.company_name||'未命名公司')}</b><small>${esc(x.domain||x.website||'')}</small></td><td>${esc(x.country||'—')}<small>${esc(x.market_keyword||'')}</small></td><td><span class="fv2-badge info">${esc(x.priority||'—')}级 · ${Math.round(Number(x.score||0))}分</span><small>${esc(x.reason||'')}</small></td><td>${esc(x.contact_name||'—')}<small>${esc([x.contact_role,x.contact_email].filter(Boolean).join(' · '))}</small></td><td><span class="fv2-badge ${x.status==='converted'?'ok':''}">${esc(statusName(x.status))}</span></td><td><div class="fv2-actions">${button('查联系人',`data-fv2-contact="${esc(x.id)}"`)}${button('背调',`data-fv2-assess="${esc(x.id)}"`)}${button('联网资料',`data-fv2-history="${esc(x.id)}"`)}${x.status!=='converted'?button('加入客户/询盘',`data-fv2-adopt="${esc(x.id)}"`,'primary'):''}</div></td></tr>`}
async function renderLeadPool(pane){
 // UI paging only: the existing Lead API remains the sole source and mutation owner.
 const saved=pane._poolState||{page:1,size:50,q:'',status:''};pane._poolState=saved;
 pane.innerHTML=`<div class="fv2-section-title"><div><h4>潜在客户池</h4></div>${button('刷新','data-fv2-pool-refresh')}</div>
 <form class="fv2-toolbar" data-fv2-pool-form><input class="fv2-input" id="fv2PoolQ" aria-label="搜索潜在客户" placeholder="公司、域名、产品、邮箱" value="${esc(saved.q)}"><select class="fv2-select" id="fv2PoolStatus" aria-label="潜客状态"><option value="">全部状态</option><option value="new">新客户</option><option value="qualified">已筛选</option><option value="contacted">已联系</option><option value="replied">已回复</option><option value="converted">已转询盘</option></select>${button('搜索','type="submit"','primary')}${button('清除','type="button" data-fv2-pool-clear')}</form>
 <div id="fv2PoolTable"></div><div class="fv2-pager" data-fv2-pool-pager></div><div id="fv2LeadHistory"></div>`;
 pane.querySelector('#fv2PoolStatus').value=saved.status;
 let ticket=0;
 const load=async()=>{
  const turn=++ticket,table=pane.querySelector('#fv2PoolTable'),pager=pane.querySelector('[data-fv2-pool-pager]');
  table.setAttribute('aria-busy','true');pager.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const params=new URLSearchParams({paged:'true',page:String(saved.page),page_size:String(saved.size),q:saved.q,status:saved.status});
   const out=await api('/api/leads?'+params);if(turn!==ticket||!pane.isConnected)return;
   const rows=leadRows(out),pages=Math.max(1,Number(out.pages)||Math.ceil((Number(out.total)||rows.length)/saved.size));
   if(saved.page>pages){saved.page=pages;return await load()}
   table.dataset.page=String(saved.page);
   table.innerHTML=rows.length?`<div class="fv2-table-wrap"><table class="fv2-table"><thead><tr><th>公司</th><th>市场 / 产品</th><th>匹配</th><th>联系人</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(poolRow).join('')}</tbody></table></div>`:empty('没有符合条件的潜在客户。');
   pager.innerHTML=`<span>共 ${Number(out.total)||0} 条</span><label>每页 <select data-fv2-pool-size>${[20,50,100].map(n=>`<option ${n===saved.size?'selected':''}>${n}</option>`).join('')}</select></label><div>${button('上一页',`data-fv2-pool-prev ${saved.page<=1?'disabled':''}`)}<span>${saved.page} / ${pages}</span>${button('下一页',`data-fv2-pool-next ${saved.page>=pages?'disabled':''}`)}</div>`;
   window.HUIDICommunityDevelopmentRouting?.enhancePool?.(pane);
  }catch(error){if(turn!==ticket)return;table.innerHTML=note(error.message||'读取失败','warn');pager.innerHTML=button('重试','data-fv2-pool-refresh')}
  finally{if(turn===ticket)table.removeAttribute('aria-busy')}
 };
 const search=()=>{saved.q=clean(pane.querySelector('#fv2PoolQ').value);saved.status=pane.querySelector('#fv2PoolStatus').value;saved.page=1;return load()};
 pane.querySelector('[data-fv2-pool-form]').onsubmit=e=>{e.preventDefault();search()};
 pane.onchange=e=>{if(e.target.matches('#fv2PoolStatus'))search();if(e.target.matches('[data-fv2-pool-size]')){saved.size=Number(e.target.value);saved.page=1;load()}};
 pane.onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-fv2-pool-prev')){saved.page=Math.max(1,saved.page-1);return load()}
  if(b.hasAttribute('data-fv2-pool-next')){saved.page++;return load()}
  if(b.hasAttribute('data-fv2-pool-refresh'))return load();
  if(b.hasAttribute('data-fv2-pool-clear')){pane.querySelector('#fv2PoolQ').value='';pane.querySelector('#fv2PoolStatus').value='';return search()}
  try{
   if(b.dataset.fv2Contact){b.disabled=true;const out=await api(`/api/leads/${b.dataset.fv2Contact}/find-contact`,{method:'POST',body:'{}'});if(out?.mode==='demo')throw new Error('当前没有连接真实联系人搜索服务');toast('联系人搜索完成');return await load()}
   if(b.dataset.fv2Assess){b.disabled=true;await api(`/api/leads/${b.dataset.fv2Assess}/assess`,{method:'POST',body:'{}'});toast('客户背调完成');return await load()}
   if(b.dataset.fv2History)return await renderLeadHistory(b.dataset.fv2History);
   if(b.dataset.fv2Adopt){b.disabled=true;await window.HUIDICommunityOnlineFusion.adoptLead(b.dataset.fv2Adopt);return await load()}
  }catch(error){toast(error.message||String(error),'error')}finally{if(b.isConnected)b.disabled=false}
 };
 await load();
}
async function renderLeadHistory(id){const host=$('#fv2LeadHistory');if(!host)return;host.innerHTML=empty('正在读取联网资料…');try{const out=await api(`/api/intelligence/summary/${encodeURIComponent(id)}`),rows=out.items||[];const names={company:'企业核验',trade:'贸易记录',tariff:'关税资料',fx:'汇率记录',shipping:'船期 / 物流',market_news:'市场动态'};host.innerHTML=`<div class="fv2-panel"><div class="fv2-section-title"><div><h4>联网资料 · 潜客 #${esc(id)}</h4><p>这些是已经查询保存过的真实联网资料，不会覆盖客户或正式单据。</p></div></div><div class="fv2-list">${rows.length?rows.map(x=>`<div class="fv2-item"><b>${esc(names[x.kind]||x.kind||'联网资料')}${x.title?` · ${esc(x.title)}`:''}</b><span>${esc(JSON.stringify(x.normalized||{}).slice(0,460))}</span><small>${esc(when(x.checked_at))}</small></div>`).join(''):empty('这个潜在客户还没有联网资料。')}</div></div>`}catch(e){host.innerHTML=note(e.message||String(e),'warn')}}
async function renderFollowups(pane){pane.innerHTML=empty('正在整理待跟进和客户回复…');const out=await api('/api/workbench/today'),follow=[...(out.followups||[]),...(out.deal_tasks||[])],replies=out.replies||[];pane.innerHTML=`<div class="fv2-grid">${[['待推进',follow.length,'潜在客户 + 询盘'],['客户待回复',replies.length,'真实邮箱回复'],['今天已发送',out.mail?.sent_today||0,'真实发送记录']].map(x=>`<div class="fv2-stat"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div><div class="fv2-split" style="margin-top:9px"><div class="fv2-panel"><h4>待跟进</h4><div class="fv2-list" style="margin-top:8px">${follow.length?follow.map(x=>`<div class="fv2-item"><b>${x.due_state==='overdue'?'已逾期 · ':''}${esc(x.company_name||x.title||'待推进')}</b><span>${esc(x.detail||x.next_action||'继续推进')}</span><small>${esc(when(x.due_at||x.created_at))}</small></div>`).join(''):empty('没有到期待跟进事项。')}</div></div><div class="fv2-panel"><h4>客户回复</h4><div class="fv2-list" style="margin-top:8px">${replies.length?replies.map(x=>`<div class="fv2-item"><b>${esc(x.company_name||x.sender||'客户回复')}</b><span>${esc(x.subject||x.snippet||'收到新回复')}</span><small>${esc(when(x.received_at))}</small></div>`).join(''):empty('当前没有待回复客户邮件。')}</div></div></div>`}
async function renderSmartDevelopment(pane){pane.innerHTML=empty('正在读取 Product Brain、行业打法和真实开发漏斗…');const [pRes,iRes,gRes]=await Promise.allSettled([api('/api/product-brains'),api('/api/industries?include_overview=true&q='),api('/api/growth/funnel')]);const products=pRes.status==='fulfilled'?(Array.isArray(pRes.value)?pRes.value:(pRes.value?.items||[])):[],industries=iRes.status==='fulfilled'?(iRes.value?.items||[]):[],growth=gRes.status==='fulfilled'?gRes.value:{};const stages=growth.stages||[];pane.innerHTML=`<div class="fv2-note ok">少填模式：产品、潜客、客户回复和下一步可以自动复用；正式报价价格、成交金额仍必须由你确认，Product Brain 价格只作参考。</div><div class="fv2-grid" style="margin-top:9px">${stages.slice(0,7).map(x=>`<div class="fv2-stat"><small>${esc(x.name)}</small><b>${Number(x.count||0)}</b><span>${Number(x.rate||0).toFixed(1)}%</span></div>`).join('')||'<div class="fv2-stat"><small>开发漏斗</small><b>—</b><span>暂无统计</span></div>'}</div><div class="fv2-grid two" style="margin-top:9px"><div class="fv2-panel"><div class="fv2-section-title"><div><h4>Product Brain</h4><p>产品事实、规格、MOQ、交期与参考价供开发/目录/报价核对复用。</p></div></div><div class="fv2-list" id="fv2ProductBrains">${products.length?products.slice(0,30).map(x=>`<div class="fv2-item"><b>${esc(x.name||x.title||'产品')}</b><span>${esc([x.sku,x.spec,x.moq?`MOQ ${x.moq}`:'',x.lead_time?`交期 ${x.lead_time}`:''].filter(Boolean).join(' · '))}</span><small>${x.price_range?`参考价 ${esc(x.currency||'USD')} ${esc(x.price_range)} · 仅参考`:''}</small></div>`).join(''):empty('还没有 Product Brain 产品资料。')}</div></div><div class="fv2-panel"><div class="fv2-section-title"><div><h4>行业打法库</h4><p>联网版已经融合的行业 Playbook，按专业行业复用客户角色、风险和邮件场景。</p></div></div><input class="fv2-input" id="fv2IndustryQ" placeholder="搜索行业 / 产品" style="width:100%;margin-bottom:8px"><div class="fv2-list" id="fv2Industries">${renderIndustryRows(industries)}</div></div></div><div class="fv2-panel"><h4>真实开发漏斗</h4><div class="fv2-kv" style="margin-top:8px"><span>回复率</span><b>${Number(growth.summary?.reply_rate||0).toFixed(1)}%</b><span>发出后转询盘</span><b>${Number(growth.summary?.inquiry_rate_from_sent||0).toFixed(1)}%</b><span>主要市场</span><b>${esc((growth.top_countries||[]).slice(0,5).map(x=>`${x.name} ${x.count}`).join(' · ')||'—')}</b><span>主要行业</span><b>${esc((growth.top_industries||[]).slice(0,5).map(x=>`${x.name} ${x.count}`).join(' · ')||'—')}</b></div></div>`;const q=$('#fv2IndustryQ');if(q)q.oninput=async()=>{try{const out=await api('/api/industries?include_overview=true&q='+encodeURIComponent(q.value));$('#fv2Industries').innerHTML=renderIndustryRows(out.items||[])}catch(e){$('#fv2Industries').innerHTML=note(e.message||String(e),'warn')}}}
function renderIndustryRows(rows){return rows.length?rows.slice(0,50).map(x=>`<div class="fv2-item"><b>${esc(x.name)}</b><span>${esc([x.family,x.risk,x.selectable?'可执行':'行业概览'].filter(Boolean).join(' · '))}</span><small>${esc((x.products||[]).slice(0,4).join(' / '))}</small></div>`).join(''):empty('没有匹配行业。')}
async function renderTeam(pane){pane.innerHTML=empty('正在读取团队与权限…');const [meOut,members]=await Promise.all([api('/api/team/me'),api('/api/team/members').catch(()=>[])]);const me=meOut.member||meOut,org=meOut.organization||me?.organization||{},canManage=['owner','admin'].includes(me?.role);pane.innerHTML=`<div class="fv2-panel"><div class="fv2-section-title"><div><h4>${esc(org.name||'当前工作区')}</h4><p>${esc(me.display_name||me.email||'当前成员')} · ${esc(roleName(me.role))}</p></div></div><div class="fv2-list">${(members||[]).map(x=>`<div class="fv2-source"><div><b>${esc(x.display_name||x.email)}</b><span>${esc(x.email)} · ${esc(roleName(x.role))}${x.enabled?'':' · 已停用'}</span></div>${canManage&&x.id!==me.id?button(x.enabled?'停用':'启用',`data-fv2-member="${x.id}" data-enabled="${x.enabled?'1':'0'}"`):''}</div>`).join('')||empty('当前没有其他成员。')}</div></div>${canManage?`<div class="fv2-panel"><h4>添加成员</h4><div class="fv2-form" style="margin-top:8px"><div class="fv2-field"><label>姓名</label><input class="fv2-input" id="fv2MemberName"></div><div class="fv2-field"><label>邮箱</label><input class="fv2-input" id="fv2MemberEmail" type="email"></div><div class="fv2-field"><label>角色</label><select class="fv2-select" id="fv2MemberRole"><option value="sales">业务员</option><option value="viewer">只读成员</option><option value="admin">管理员</option>${me.role==='owner'?'<option value="owner">老板</option>':''}</select></div><div class="fv2-field"><label>初始密码</label><input class="fv2-input" id="fv2MemberPassword" type="password"></div></div><div class="fv2-actions" style="margin-top:8px">${button('添加成员','data-fv2-add-member','primary')}</div></div>`:''}`;pane.onclick=async e=>{const toggle=e.target.closest('[data-fv2-member]'),add=e.target.closest('[data-fv2-add-member]');try{if(toggle){await api('/api/team/members/'+toggle.dataset.fv2Member,{method:'PATCH',body:JSON.stringify({enabled:toggle.dataset.enabled!=='1'})});await renderTeam(pane);return}if(add){const payload={display_name:clean($('#fv2MemberName')?.value),email:clean($('#fv2MemberEmail')?.value),role:clean($('#fv2MemberRole')?.value),password:clean($('#fv2MemberPassword')?.value)};if(!payload.email||payload.password.length<8)throw new Error('成员邮箱不能为空，初始密码至少 8 位');await api('/api/team/members',{method:'POST',body:JSON.stringify(payload)});toast('成员已添加');await renderTeam(pane)}}catch(err){toast(err.message||String(err),'error')}}}
async function renderCompanySettings(pane){pane.innerHTML=empty('正在读取公司资料与收款账户…');const x=await api('/api/company-settings'),banks=x.bank_accounts||[];pane.innerHTML=`<div class="fv2-panel"><h4>公司资料</h4><div class="fv2-form" style="margin-top:8px"><div class="fv2-field"><label>常用公司名称</label><input class="fv2-input" id="fv2Company" value="${esc(x.company_name||'')}"></div><div class="fv2-field"><label>正式抬头 / Legal Name</label><input class="fv2-input" id="fv2Legal" value="${esc(x.legal_name||'')}"></div><div class="fv2-field"><label>国家 / 地区</label><input class="fv2-input" id="fv2Country" value="${esc(x.country||'')}"></div><div class="fv2-field"><label>税号 / 注册号</label><input class="fv2-input" id="fv2Tax" value="${esc(x.tax_id||'')}"></div><div class="fv2-field"><label>电话</label><input class="fv2-input" id="fv2Phone" value="${esc(x.phone||'')}"></div><div class="fv2-field"><label>邮箱</label><input class="fv2-input" id="fv2CompanyEmail" value="${esc(x.email||'')}"></div><div class="fv2-field"><label>网站</label><input class="fv2-input" id="fv2Website" value="${esc(x.website||'')}"></div><div class="fv2-field"><label>工作时区</label><select class="fv2-select" id="fv2Timezone">${Object.entries(x.choices||{}).map(([v,n])=>`<option value="${esc(v)}" ${v===x.timezone_name?'selected':''}>${esc(n)}</option>`).join('')}</select></div><div class="fv2-field full"><label>正式地址</label><textarea class="fv2-textarea" id="fv2Address">${esc(x.address||'')}</textarea></div></div><div class="fv2-actions" style="margin-top:8px">${button('保存公司资料','data-fv2-company-save','primary')}</div></div><div class="fv2-panel"><div class="fv2-section-title"><div><h4>收款账户</h4><p>报价 / PI / 合同 / CI 可复用；历史单据保存自己的快照。</p></div>${button('新增账户','data-fv2-bank-new')}</div><div class="fv2-list">${banks.length?banks.map(b=>`<div class="fv2-source"><div><b>${esc(b.label||b.bank_name)}${b.is_default?' · 默认':''}</b><span>${esc(b.bank_name)} · ${esc(b.account_name)} · ${esc(b.currency||'未限定币种')}<br>${esc(b.account_number)}${b.swift_code?` · SWIFT ${esc(b.swift_code)}`:''}</span></div><div class="fv2-actions">${button('编辑',`data-fv2-bank-edit="${b.id}"`)}${button('删除',`data-fv2-bank-delete="${b.id}"`,'danger')}</div></div>`).join(''):empty('还没有收款账户。')}</div><div id="fv2BankEditor"></div></div>`;pane.onclick=async e=>{try{if(e.target.closest('[data-fv2-company-save]')){const payload={timezone_name:$('#fv2Timezone').value,company_name:clean($('#fv2Company').value),legal_name:clean($('#fv2Legal').value),country:clean($('#fv2Country').value),address:clean($('#fv2Address').value),website:clean($('#fv2Website').value),phone:clean($('#fv2Phone').value),email:clean($('#fv2CompanyEmail').value),tax_id:clean($('#fv2Tax').value)};await api('/api/company-settings',{method:'PUT',body:JSON.stringify(payload)});toast('公司资料已保存');return}const add=e.target.closest('[data-fv2-bank-new]'),edit=e.target.closest('[data-fv2-bank-edit]'),del=e.target.closest('[data-fv2-bank-delete]');if(add||edit){showBankEditor(edit?banks.find(b=>String(b.id)===String(edit.dataset.fv2BankEdit)):null);return}if(del){if(!confirm('确认删除这个收款账户？历史单据里的账户快照不会被删除。'))return;await api('/api/company-settings/bank-accounts/'+del.dataset.fv2BankDelete,{method:'DELETE'});await renderCompanySettings(pane)}}catch(err){toast(err.message||String(err),'error')}}}
function showBankEditor(row=null){const host=$('#fv2BankEditor');if(!host)return;row=row||{};host.innerHTML=`<div class="fv2-panel" style="margin-top:9px;background:#fbfcfe"><h4>${row.id?'编辑':'新增'}收款账户</h4><div class="fv2-form" style="margin-top:8px"><div class="fv2-field"><label>账户标签</label><input class="fv2-input" id="fv2BankLabel" value="${esc(row.label||'')}"></div><div class="fv2-field"><label>币种</label><input class="fv2-input" id="fv2BankCurrency" value="${esc(row.currency||'')}"></div><div class="fv2-field"><label>银行名称</label><input class="fv2-input" id="fv2BankName" value="${esc(row.bank_name||'')}"></div><div class="fv2-field"><label>账户名</label><input class="fv2-input" id="fv2BankAccount" value="${esc(row.account_name||'')}"></div><div class="fv2-field"><label>账号</label><input class="fv2-input" id="fv2BankNumber" value="${esc(row.account_number||'')}"></div><div class="fv2-field"><label>SWIFT</label><input class="fv2-input" id="fv2BankSwift" value="${esc(row.swift_code||'')}"></div><div class="fv2-field full"><label>银行地址</label><textarea class="fv2-textarea" id="fv2BankAddress">${esc(row.bank_address||'')}</textarea></div></div><label style="font-size:8.5px;color:#65768b"><input type="checkbox" id="fv2BankDefault" ${row.is_default?'checked':''}> 默认收款账户</label><div class="fv2-actions" style="margin-top:8px">${button('保存账户','data-fv2-bank-save','primary')}${button('取消','data-fv2-bank-cancel')}</div></div>`;host.onclick=async e=>{if(e.target.closest('[data-fv2-bank-cancel]')){host.innerHTML='';return}if(!e.target.closest('[data-fv2-bank-save]'))return;try{const payload={label:clean($('#fv2BankLabel').value),bank_name:clean($('#fv2BankName').value),account_name:clean($('#fv2BankAccount').value),account_number:clean($('#fv2BankNumber').value),swift_code:clean($('#fv2BankSwift').value),bank_address:clean($('#fv2BankAddress').value),currency:clean($('#fv2BankCurrency').value),is_default:Boolean($('#fv2BankDefault').checked),notes:''};if(!payload.bank_name||!payload.account_name||!payload.account_number)throw new Error('请填写银行名称、账户名和账号');await api(row.id?`/api/company-settings/bank-accounts/${row.id}`:'/api/company-settings/bank-accounts',{method:row.id?'PUT':'POST',body:JSON.stringify(payload)});toast('收款账户已保存');await renderCompanySettings($('#view-online-admin [data-fv2-pane="company"]'))}catch(err){toast(err.message||String(err),'error')}}}
async function renderSources(pane){await loadModule('sourceSettings');await window.HUIDIServiceSettings.mount(pane);}
async function renderNotificationRoutes(pane){pane.innerHTML=empty('正在读取提醒方式…');const out=await api('/api/notification-routes'),rows=out.items||[],channels=out.channels||{},categories=out.categories||{};pane.innerHTML=`<div class="fv2-panel"><h4>提醒方式</h4><p>客户回复、逾期跟进和业务异常可发到团队常用工具；站内提醒不受影响。</p><div class="fv2-form" style="margin-top:8px"><div class="fv2-field"><label>名称</label><input class="fv2-input" id="fv2RouteName" placeholder="销售团队提醒"></div><div class="fv2-field"><label>发送到</label><select class="fv2-select" id="fv2RouteChannel">${Object.entries(channels).map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select></div><div class="fv2-field full"><label>接收地址</label><input class="fv2-input" id="fv2RouteDestination" type="password"></div><div class="fv2-field"><label>不打扰开始</label><input class="fv2-input" id="fv2QuietStart" type="time" value="22:00"></div><div class="fv2-field"><label>不打扰结束</label><input class="fv2-input" id="fv2QuietEnd" type="time" value="08:00"></div></div><div class="fv2-compact" style="margin-top:8px">${Object.entries(categories).map(([v,n])=>`<label class="fv2-badge"><input type="checkbox" data-fv2-route-cat="${esc(v)}" checked> ${esc(n)}</label>`).join('')}</div><div class="fv2-actions" style="margin-top:8px">${button('添加提醒方式','data-fv2-route-add','primary')}</div></div><div class="fv2-panel"><div class="fv2-list">${rows.length?rows.map(x=>`<div class="fv2-source"><div><b>${esc(x.name)}</b><span>${esc(x.channel_name)} · ${esc((x.category_names||[]).join('、'))}<br>不打扰 ${esc(x.quiet_start)}–${esc(x.quiet_end)}</span></div><div class="fv2-actions"><span class="fv2-badge ${x.enabled?'ok':''}">${x.enabled?'已开启':'已关闭'}</span>${button('检查',`data-fv2-route-test="${x.id}"`,x.destination_saved?'':'disabled')}${button(x.enabled?'关闭':'开启',`data-fv2-route-toggle="${x.id}" data-enabled="${x.enabled?'1':'0'}"`)}${button('删除',`data-fv2-route-delete="${x.id}"`,'danger')}</div></div>`).join(''):empty('还没有设置外部提醒。')}</div></div>`;pane.onclick=async e=>{const add=e.target.closest('[data-fv2-route-add]'),test=e.target.closest('[data-fv2-route-test]'),toggle=e.target.closest('[data-fv2-route-toggle]'),del=e.target.closest('[data-fv2-route-delete]');try{if(add){const payload={name:clean($('#fv2RouteName').value),channel:$('#fv2RouteChannel').value,destination:clean($('#fv2RouteDestination').value),categories:$$('[data-fv2-route-cat]:checked').map(x=>x.dataset.fv2RouteCat),high_only:false,timezone_name:'Asia/Shanghai',quiet_start:$('#fv2QuietStart').value||'22:00',quiet_end:$('#fv2QuietEnd').value||'08:00',enabled:true};if(!payload.destination)throw new Error('请填写接收地址');await api('/api/notification-routes',{method:'POST',body:JSON.stringify(payload)});toast('提醒方式已添加');await renderNotificationRoutes(pane);return}if(test){const x=await api(`/api/notification-routes/${test.dataset.fv2RouteTest}/test`,{method:'POST',body:'{}'});toast(x.message||'连接正常');return}if(toggle){await api(`/api/notification-routes/${toggle.dataset.fv2RouteToggle}`,{method:'PATCH',body:JSON.stringify({enabled:toggle.dataset.enabled!=='1'})});await renderNotificationRoutes(pane);return}if(del){if(!confirm('删除这个提醒方式吗？站内提醒不会删除。'))return;await api(`/api/notification-routes/${del.dataset.fv2RouteDelete}`,{method:'DELETE'});await renderNotificationRoutes(pane)}}catch(err){toast(err.message||String(err),'error')}}}
function sizeText(n){n=Number(n||0);if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
async function renderSafety(pane){pane.innerHTML=empty('正在检查使用状态与备份…');const [ready,b]=await Promise.all([api('/api/production/readiness'),api('/api/backups')]),s=ready.summary||{},backups=b.items||[];pane.innerHTML=`<div class="fv2-grid"><div class="fv2-stat"><small>正常</small><b>${s.ready||0}</b><span>无需处理</span></div><div class="fv2-stat"><small>需要处理</small><b>${s.action||0}</b><span>建议优先处理</span></div><div class="fv2-stat"><small>按需开启</small><b>${s.optional||0}</b><span>可选能力</span></div></div><div class="fv2-panel" style="margin-top:9px"><h4>使用检查</h4><div class="fv2-list" style="margin-top:8px">${(ready.items||[]).map(x=>`<div class="fv2-source"><div><b>${esc(x.group)} · ${esc(x.name)}</b><span>${esc(x.message)}${x.action?`<br>下一步：${esc(x.action)}`:''}</span></div><span class="fv2-badge ${x.state==='ready'?'ok':x.state==='action'?'warn':''}">${x.state==='ready'?'正常':x.state==='action'?'需要处理':'按需开启'}</span></div>`).join('')||empty('没有检查结果。')}</div></div><div class="fv2-panel"><div class="fv2-section-title"><div><h4>云端公司备份</h4><p>恢复前会自动保留当前数据；本地完整 JSON 备份仍建议保留。</p></div>${button('立即备份','data-fv2-backup-create','primary')}</div><div class="fv2-table-wrap">${backups.length?`<table class="fv2-table" style="min-width:620px"><thead><tr><th>时间</th><th>类型</th><th>数据量</th><th>大小</th><th>状态</th><th>操作</th></tr></thead><tbody>${backups.map(x=>`<tr><td>${esc(when(x.created_at))}</td><td>${x.reason==='before_restore'?'恢复前自动保留':'手动备份'}</td><td>${Number(x.rows||0)} 条</td><td>${sizeText(x.size)}</td><td>${x.verified?'可用':'待检查'}</td><td><div class="fv2-actions">${button('检查',`data-fv2-backup-verify="${esc(x.id)}"`)}<a class="fv2-btn" href="/api/backups/${encodeURIComponent(x.id)}/download">下载</a>${button('恢复',`data-fv2-backup-restore="${esc(x.id)}"`,'danger')}</div></td></tr>`).join('')}</tbody></table>`:empty('还没有云端公司备份。')}</div></div>`;pane.onclick=async e=>{const create=e.target.closest('[data-fv2-backup-create]'),verify=e.target.closest('[data-fv2-backup-verify]'),restore=e.target.closest('[data-fv2-backup-restore]');try{if(create){await api('/api/backups',{method:'POST',body:'{}'});toast('备份已创建并检查完成');await renderSafety(pane);return}if(verify){await api(`/api/backups/${encodeURIComponent(verify.dataset.fv2BackupVerify)}/verify`,{method:'POST',body:'{}'});toast('备份检查通过');await renderSafety(pane);return}if(restore){if(!confirm('确认恢复这份公司业务备份吗？系统会先自动保留当前数据。'))return;const typed=prompt('为避免误操作，请输入“恢复”');if(typed!=='恢复')return;await api(`/api/backups/${encodeURIComponent(restore.dataset.fv2BackupRestore)}/restore`,{method:'POST',body:JSON.stringify({confirmation:'RESTORE'})});toast('业务数据已恢复');await renderSafety(pane)}}catch(err){toast(err.message||String(err),'error')}}}
function installAll(){installTabs('online-find',[{key:'base',label:'找客户'},{key:'pool',label:'潜在客户'},{key:'followups',label:'待跟进'},{key:'notifications',label:'提醒'},{key:'map',label:'地图找客户'},{key:'contacts',label:'联系人'},{key:'company',label:'客户背调'},{key:'smart',label:'智能开发'}],'客户开发','找客户、地图开发、潜客池、背调、联系人、行业打法和少填开发集中在一页。');installTabs('mail',[{key:'base',label:'邮件草稿'},{key:'inbox',label:'收件箱'},{key:'sent',label:'已发送'},{key:'mailbox',label:'邮箱设置'},{key:'queue',label:'待发送'},{key:'sequences',label:'自动跟进'}],'邮件与跟进','本地草稿、真实邮箱、客户回复、待发送和自动跟进使用同一个业务上下文。');installTabs('online-intel',[{key:'base',label:'全球市场'},{key:'live',label:'市场动态'},{key:'trade',label:'贸易记录'},{key:'tariff',label:'HS / 关税'},{key:'fx',label:'汇率'},{key:'shipping',label:'船期 / 物流'}],'市场情报','全球市场、实时动态、贸易、关税、汇率与物流资料统一服务客户开发和订单判断。');installTabs('online-admin',[{key:'base',label:'工作区概览'},{key:'team',label:'团队与权限'},{key:'company',label:'公司资料'},{key:'sources',label:'数据来源'},{key:'notifications',label:'提醒方式'},{key:'audit',label:'操作记录'},{key:'safety',label:'检查与备份'}],'团队与设置','团队、公司资料、数据来源、提醒、操作记录和备份统一在当前工作区管理。')}
function renameNav(){const map={'online-find':['客户开发','找客户、地图、背调、联系人'],'online-intel':['市场情报','全球市场、贸易、关税、汇率、物流'],'online-admin':['团队与设置','团队、公司、来源、提醒、备份']};for(const [view,[label,sub]] of Object.entries(map)){const b=$(`.nav-btn[data-view="${view}"]`);if(!b)continue;const x=b.querySelector('.nav-copy b'),y=b.querySelector('.nav-copy small');if(x)x.textContent=label;if(y)y.textContent=sub}}
function bindView(){
 const selectCurrent=view=>{
  if(!$(`#view-${view}`)?.classList.contains('active'))return;
  const urlTab=new URL(location.href).searchParams.get('tab');
  const key=(urlTab&&ensurePane($(`#view-${view}`),urlTab)?urlTab:null)||savedTabs[view]||'base';
  if($(`#view-${view}`)?.dataset.fv2Installed==='1')openTab(view,key);
 };
 window.addEventListener('HUIDI:community-online-view',e=>selectCurrent(e.detail?.view));
 document.addEventListener('click',e=>{const b=e.target.closest('.nav-btn[data-view]');if(b)queueMicrotask(()=>{renameNav();selectCurrent(b.dataset.view)})});
 document.addEventListener('keydown',e=>{
  const tab=e.target.closest('.fv2-tab');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=[...tab.closest('.fv2-tabs').querySelectorAll('.fv2-tab')].filter(b=>b.getClientRects().length);
  let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  e.preventDefault();tabs[i]?.focus();tabs[i]?.click();
 });
 window.addEventListener('HUIDI:mail-accounts-changed',()=>{if($('#view-mail')?.classList.contains('active')&&savedTabs.mail==='mailbox')openTab('mail','mailbox',{force:true})});
 window.addEventListener('popstate',()=>{
  const view=location.hash.slice(1),b=$(`.nav-btn[data-view="${CSS.escape(view)}"]`);
  if(b){b.click();selectCurrent(view)}
 });
}
function boot(){installAll();renameNav();bindView();document.body.dataset.huidiFullFusion='v2';setTimeout(()=>{installAll();renameNav()},180)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineFullV2=Object.freeze({version:'2.1.0',openTab,registerPane,loadModule,invalidate,renderLeadPool,renderSmartDevelopment,renderTeam,renderCompanySettings,renderSources,renderNotificationRoutes,renderSafety});
})();
