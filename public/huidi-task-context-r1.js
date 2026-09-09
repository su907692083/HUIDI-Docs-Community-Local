(()=>{
'use strict';
if(!window.HUIDI_COMMUNITY_ONLINE?.enabled||window.HUIDITaskContextR1)return;
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='huidi.task-flow/v1';
const buyerNames={importer:'进口商',distributor:'经销商',wholesaler:'批发商',retailer:'零售商',brand:'品牌商',agent:'代理商',manufacturer:'制造商'};
function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function values(state){
 const market=state.marketLabel||state.market;
 const map={
  develop:[state.productLabel,market,buyerNames[state.buyerType]],
  followup:[state.customerLabel],
  quote:[state.customerLabel,state.productLabel,state.currency,state.incoterm],
  market:[state.productLabel,market],
  ship:[state.customerLabel,state.productLabel]
 };
 return (map[state.task]||[]).filter(Boolean);
}
function sync(){
 const state=read(),bar=$('.htf-context'),span=bar?.querySelector('span');if(!bar||!span||!state.task)return;
 span.innerHTML=values(state).map(x=>`<em>${esc(x)}</em>`).join('');
}
function schedule(){for(const ms of [0,80,140,460,940])setTimeout(sync,ms)}
document.addEventListener('click',e=>{if(e.target.closest('[data-htf-task],[data-htf-set],[data-htf-go],[data-htf-edit]'))schedule()},true);
window.addEventListener('HUIDI:community-online-view',schedule);
window.addEventListener('HUIDI:fusion-pane-rendered',schedule);
window.addEventListener('storage',schedule);
window.HUIDITaskContextR1=Object.freeze({version:'1.0.1',sync,values});
schedule();
})();