(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineNav)return;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const VIEWS={
  'online-find':{label:'找客户',sub:'真实搜索、联系人、转询盘',icon:'i-users'},
  'online-intel':{label:'市场情报',sub:'全球市场、新闻、已有客户',icon:'i-catalog'},
  'online-admin':{label:'团队与服务',sub:'工作区、数据源、连接状态',icon:'i-help'}
};
function icon(id){return `<svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#${id}"></use></svg>`}
function makeButton(view){
  const cfg=VIEWS[view],b=document.createElement('button');
  b.className='nav-btn';b.dataset.view=view;b.dataset.huidiOnlineNav='1';
  b.innerHTML=`<span class="icon-tile">${icon(cfg.icon)}</span><span class="nav-copy"><b>${cfg.label}</b><small>${cfg.sub}</small></span><span class="status-dot online">联网</span>`;
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
function ensureNav(){
  const home=$('.nav-btn[data-view="home"]');
  const help=$('.nav-btn[data-view="help"]');
  if(!home||!help)return false;
  const workNav=home.closest('.nav');
  const toolsNav=help.closest('.nav');
  if(!workNav||!toolsNav)return false;
  workNav.classList.add('huidi-fusion-nav');toolsNav.classList.add('huidi-fusion-nav');
  let find=$('.nav-btn[data-view="online-find"]');
  if(!find){find=makeButton('online-find');insertAfter(home,find)}
  let intel=$('.nav-btn[data-view="online-intel"]');
  if(!intel){intel=makeButton('online-intel');insertAfter(find,intel)}
  let admin=$('.nav-btn[data-view="online-admin"]');
  if(!admin){admin=makeButton('online-admin');toolsNav.insertBefore(admin,help)}
  [find,intel,admin].forEach(bindButton);
  document.body.dataset.huidiOnlineNav='ready';
  return true;
}
function boot(){
  ensureNav();
  setTimeout(ensureNav,0);
  setTimeout(ensureNav,180);
  window.addEventListener('HUIDI:closure-rendered',ensureNav);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineNav=Object.freeze({version:'1.0.0',ensureNav,activate});
})();