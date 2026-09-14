(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineShellClosure)return;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const PRIMARY_TABS={
  'online-find':new Set(['base','pool','followups','develop']),
  'online-admin':new Set(['base','team','company','sources'])
};
const PURPOSE={
  lead_search:'找客户',map_search:'地图找客户',company_check:'企业核验',trade_data:'贸易记录',
  trade_news:'市场情报',tariff:'HS / 关税',fx:'汇率',shipping:'船期 / 物流',
  gmail:'Gmail 邮箱',outlook:'Outlook 邮箱',company_mail:'企业邮箱'
};
function compactTabs(viewId){
  const keep=PRIMARY_TABS[viewId],view=$(`#view-${viewId}`),bar=view?.querySelector(':scope > .fv2-tabs');
  if(!keep||!bar)return false;
  let more=$('.huidi-tab-more',bar);
  if(!more){
    more=document.createElement('details');more.className='huidi-tab-more';
    more.innerHTML='<summary>更多</summary><div class="huidi-tab-more-menu"></div>';
    more.addEventListener('click',e=>{if(e.target.closest('[data-fv2-tab]'))setTimeout(()=>more.removeAttribute('open'),0)});
    bar.appendChild(more);
  }
  const menu=$('.huidi-tab-more-menu',more);
  const buttons=$$('.fv2-tab',bar);
  for(const b of buttons){
    const key=b.dataset.fv2Tab||'';
    if(keep.has(key))bar.insertBefore(b,more);else menu.appendChild(b);
  }
  more.hidden=!menu.children.length;
  bar.dataset.huidiCompacted='1';
  return true;
}
function compactHeaders(){
  const findStatus=$('#hfFindStatus');if(findStatus)findStatus.hidden=true;
  const findRefresh=$('#hfFindRefresh');if(findRefresh)findRefresh.textContent='刷新';
  const adminRefresh=$('#hfAdminRefresh');if(adminRefresh)adminRefresh.textContent='刷新';
}
function sourcePurpose(key){return PURPOSE[String(key||'').trim()]||'联网能力'}
function enhanceSources(){
  const pane=$('#view-online-admin [data-fv2-pane="sources"]'),list=pane?.querySelector('.fv2-list');if(!pane||!list)return false;
  let header=$('.huidi-source-header',pane);
  if(!header){
    header=document.createElement('div');header.className='huidi-source-header';
    header.innerHTML='<span>数据源</span><span>状态</span><span>用途</span><span>操作</span>';
    list.insertAdjacentElement('beforebegin',header);
  }
  $$('.fv2-item[data-fv2-source]',list).forEach(item=>{
    const row=$('.fv2-source',item),actions=$('.fv2-actions',row);if(!row||!actions)return;
    row.classList.add('huidi-source-row');
    let state=$('.huidi-source-state',row);
    if(!state){
      state=document.createElement('div');state.className='huidi-source-state';
      const badge=$('.fv2-badge',actions);if(badge)state.appendChild(badge);else state.textContent='—';
      row.insertBefore(state,actions);
    }
    let purpose=$('.huidi-source-purpose',row);
    if(!purpose){
      purpose=document.createElement('div');purpose.className='huidi-source-purpose';purpose.textContent=sourcePurpose(item.dataset.fv2Source);
      row.insertBefore(purpose,actions);
    }
  });
  pane.dataset.huidiSourcesDense='1';
  return true;
}
function run(){compactTabs('online-find');compactTabs('online-admin');compactHeaders();enhanceSources();document.body.dataset.huidiOnlineShellClosure='ready'}
function settle(){for(const delay of [0,80,220,520,1100])setTimeout(run,delay)}
function relevantClick(target){return target?.closest?.('[data-fv2-tab],[data-fv2-source-edit],[data-fv2-source-save],[data-fv2-source-reset],[data-view="online-find"],[data-view="online-admin"]')}
function boot(){
  settle();
  window.addEventListener('HUIDI:community-online-view',settle);
  document.addEventListener('click',e=>{if(relevantClick(e.target))settle()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineShellClosure=Object.freeze({version:'1.0.0',run,compactTabs,enhanceSources});
})();