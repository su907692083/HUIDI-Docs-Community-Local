(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineNav)return;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const VIEWS={
  'online-find':{label:'客户开发',sub:'找客户、潜客、跟进与开发',icon:'i-users'},
  'online-intel':{label:'市场情报',sub:'市场、贸易、关税、汇率与物流',icon:'i-catalog'},
  'online-admin':{label:'团队与设置',sub:'团队、公司、来源、提醒与备份',icon:'i-help'}
};
const LABELS={
  home:['今天的工作','回复、跟进、询盘和新客户'],
  mail:['客户沟通','收件、发送与自动跟进'],
  customers:['客户资料','正式客户资料与跟进'],
  deals:['客户 / 询盘','从需求跟到成交与交付'],
  products:['产品资料','产品事实、规格与图片'],
  catalog:['产品目录','从产品资料直接制作目录'],
  documents:['单据工作台','报价、PI、合同、CI 与装箱'],
  'online-find':['客户开发','找客户、潜客、跟进与开发'],
  'online-intel':['市场情报','市场、贸易、关税、汇率与物流'],
  'online-admin':['团队与设置','团队、公司、来源、提醒与备份']
};
const GROUPS=[
  ['今天',['home','mail']],
  ['客户',['online-find','customers','deals']],
  ['产品与单据',['products','catalog','documents']],
  ['市场与工具',['online-intel']],
  ['设置',['online-admin']]
];
const MORE=[
  ['资料',['brands','templates','feishu']],
  ['数据与帮助',['backup','recycle','help']]
];
function icon(id){return `<svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#${id}"></use></svg>`}
function makeButton(view){
  const cfg=VIEWS[view],b=document.createElement('button');
  b.className='nav-btn';b.dataset.view=view;b.dataset.huidiOnlineNav='1';
  b.innerHTML=`<span class="icon-tile">${icon(cfg.icon)}</span><span class="nav-copy"><b>${cfg.label}</b><small>${cfg.sub}</small></span>`;
  return b;
}
function activate(view){
  const target=$(`#view-${CSS.escape(view)}`);if(!target)return false;
  document.body.dataset.huidiView=view;
  $$('.view').forEach(v=>v.classList.toggle('active',v===target));
  $$('.nav-btn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(location.hash!==`#${view}`)history.replaceState(null,'',`${location.pathname}${location.search}#${view}`);
  try{window.HUIDIWorkspaceClosure?.renderView?.(view)}catch(_){}
  window.dispatchEvent(new CustomEvent('HUIDI:community-online-view',{detail:{view}}));
  return true;
}
function bindButton(button){
  if(!button||button.dataset.huidiOnlineNavBound==='1')return;
  button.dataset.huidiOnlineNavBound='1';
  button.addEventListener('click',()=>activate(button.dataset.view));
}
function insertAfter(anchor,button){anchor.parentNode.insertBefore(button,anchor.nextSibling)}
function applyLabel(button){
  const cfg=LABELS[button?.dataset?.view];if(!cfg)return;
  const label=button.querySelector('.nav-copy b'),sub=button.querySelector('.nav-copy small');
  if(label)label.textContent=cfg[0];if(sub)sub.textContent=cfg[1];
}
function normalizeCounts(root=document){
  $$('.workspace-nav-count',root).forEach(x=>{
    const value=String(x.textContent||'').trim().toLowerCase();
    if(!value||value==='undefined'||value==='null'||value==='nan'){
      x.textContent='';x.hidden=true;
    }
  });
  for(const view of Object.keys(VIEWS)){
    const x=$(`.nav-btn[data-view="${view}"] .workspace-nav-count`,root);
    if(x){x.textContent='';x.hidden=true}
  }
}
function ensureOnlineButtons(){
  const home=$('.nav-btn[data-view="home"]');
  const help=$('.nav-btn[data-view="help"]');
  if(!home||!help)return false;
  let find=$('.nav-btn[data-view="online-find"]');
  if(!find){find=makeButton('online-find');insertAfter(home,find)}
  let intel=$('.nav-btn[data-view="online-intel"]');
  if(!intel){intel=makeButton('online-intel');insertAfter(find,intel)}
  let admin=$('.nav-btn[data-view="online-admin"]');
  if(!admin){admin=makeButton('online-admin');help.parentNode.insertBefore(admin,help)}
  for(const b of [find,intel,admin]){applyLabel(b);bindButton(b)}
  return true;
}
function makeGroup(title,views,buttons){
  const group=document.createElement('section');group.className='workspace-nav-group';
  group.innerHTML=`<div class="workspace-nav-group-title">${title}</div><nav class="nav"></nav>`;
  const nav=$('.nav',group);
  for(const view of views){const b=buttons.get(view);if(b){applyLabel(b);nav.appendChild(b)}}
  return group;
}
function rebuildDomains(){
  const side=$('.sidebar'),root=$('.workspace-nav-groups',side);if(!side||!root)return false;
  const buttons=new Map($$('.nav-btn[data-view]',side).map(b=>[b.dataset.view,b]));
  if(root.dataset.huidiOnlineDomains==='1'){
    buttons.forEach(applyLabel);normalizeCounts(root);return true;
  }
  const used=new Set();root.innerHTML='';root.dataset.huidiOnlineDomains='1';root.classList.add('huidi-online-domain-nav');
  for(const [title,views] of GROUPS){views.forEach(v=>used.add(v));root.appendChild(makeGroup(title,views,buttons))}
  const details=document.createElement('details');details.className='huidi-online-more';
  details.innerHTML='<summary><span>更多工具</span><small>低频资料、备份与帮助</small><i>⌄</i></summary><div class="huidi-online-more-body"></div>';
  const body=$('.huidi-online-more-body',details);
  for(const [title,views] of MORE){views.forEach(v=>used.add(v));const g=makeGroup(title,views,buttons);if($('.nav-btn',g))body.appendChild(g)}
  const extra=[...buttons.keys()].filter(v=>!used.has(v));
  if(extra.length)body.appendChild(makeGroup('其他',extra,buttons));
  root.appendChild(details);
  buttons.forEach(applyLabel);normalizeCounts(root);
  return true;
}
function ensureNav(){
  if(!ensureOnlineButtons())return false;
  rebuildDomains();normalizeCounts();
  document.body.dataset.huidiOnlineNav='ready';
  return true;
}
function taskAsset(file,marker,onload){
  if(document.querySelector(`script[${marker}]`))return;
  const rev=document.querySelector('meta[name=huidi-asset-revision]')?.content||'task-v1';
  const tag=document.createElement('script');tag.src=`/community/${file}?v=${encodeURIComponent(rev)}`;tag.defer=true;tag.setAttribute(marker,'1');if(onload)tag.onload=onload;document.head.appendChild(tag);
}
function loadTaskContext(){if(window.HUIDITaskContextR1)return;taskAsset('huidi-task-context-r1.js','data-huidi-task-context')}
function loadTaskFlow(){
  if(window.HUIDITaskFlow){loadTaskContext();return}
  taskAsset('huidi-task-flow-v1.js','data-huidi-task-flow',loadTaskContext);
}
function boot(){
  ensureNav();loadTaskFlow();
  setTimeout(ensureNav,0);
  setTimeout(ensureNav,180);
  setTimeout(ensureNav,520);
  window.addEventListener('HUIDI:closure-rendered',ensureNav);
  window.addEventListener('HUIDI:community-cloud-ready',()=>setTimeout(ensureNav,0));
  window.addEventListener('HUIDI:local-data-change',()=>setTimeout(ensureNav,0));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineNav=Object.freeze({version:'1.3.1',ensureNav,activate,loadTaskFlow,loadTaskContext});
})();