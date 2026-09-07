(()=>{'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityCloudAdapter)return;
const state={ready:false,hydrating:false,syncingState:false,stateQueued:false,stateRunPromise:null,stateFollowupPromise:null,syncingDocs:false,docsQueued:false,identity:null,knownCloudDocs:new Set(),docFingerprints:new Map(),customerIds:new Map(),dealIds:new Map(),stateTimer:0,docTimer:0};
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();
const clone=v=>{try{return structuredClone(v)}catch(_){return JSON.parse(JSON.stringify(v))}};
const parse=(raw,fallback)=>{try{return JSON.parse(raw||'null')??fallback}catch(_){return fallback}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fnv=value=>{let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
function detailOf(payload,status){return clean(payload?.detail||payload?.message)||`联网请求失败 (${status})`}
async function api(path,options={}){
  const headers={Accept:'application/json',...(options.headers||{})};
  if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  const response=await fetch(path,{credentials:'same-origin',...options,headers});
  let payload=null;try{payload=await response.json()}catch(_){}
  if(response.status===401){if(!location.pathname.startsWith('/login'))location.assign('/login');throw new Error('登录状态已失效')}
  if(!response.ok)throw new Error(detailOf(payload,response.status));
  return payload;
}
async function waitOwners(){
  const deadline=Date.now()+6000;
  while(Date.now()<deadline){if(window.HUIDILocalCore?.repositories&&window.HUIDILocalDB)return{core:window.HUIDILocalCore,db:window.HUIDILocalDB};await sleep(40)}
  throw new Error('Community 数据核心没有就绪')
}
function scopeId(){return Number(clean(online.scope).replace(/^org-/,''))||0}
async function verifyIdentity(){
  const me=await api('/api/team/me');
  const org=me?.organization||me?.member?.organization||{};
  if(Number(org.id||me?.member?.organization_id||0)!==scopeId())throw new Error('当前登录工作区与浏览器缓存作用域不一致，请重新登录')
  state.identity=me;
  const badge=document.getElementById('memberBadge');
  if(badge){badge.hidden=false;badge.textContent=`${clean(org.name)||'当前工作区'} · 联网`;badge.title=clean(me?.member?.display_name||me?.member?.email)}
  document.documentElement.dataset.huidiCloudIdentity='verified';
  return me;
}
function customerMatch(local,remotes,used){
  const id=clean(local?.id);let hit=remotes.find(x=>!used.has(String(x.id))&&String(x.id)===id);
  if(hit)return hit;
  const email=lower(local?.email);if(email){hit=remotes.find(x=>!used.has(String(x.id))&&lower(x.email)===email);if(hit)return hit}
  const company=lower(local?.company||local?.name),contact=lower(local?.contact||local?.contact_name);
  return remotes.find(x=>!used.has(String(x.id))&&company&&lower(x.company||x.name)===company&&(!contact||lower(x.contact||x.contact_name)===contact))||null;
}
function rebuildCustomerMap(locals,remotes){
  const used=new Set();state.customerIds.clear();
  for(const row of locals||[]){const hit=customerMatch(row,remotes||[],used);if(!hit)continue;used.add(String(hit.id));state.customerIds.set(String(row.id),String(hit.id))}
}
function dealMatch(local,remotes,used){
  const id=clean(local?.id);let hit=remotes.find(x=>!used.has(String(x.id))&&String(x.id)===id);if(hit)return hit;
  const expectedCustomer=state.customerIds.get(String(local?.customer_id))||String(local?.customer_id||'');
  const title=lower(local?.title),currency=clean(local?.currency||'USD');
  hit=remotes.find(x=>!used.has(String(x.id))&&title&&lower(x.title)===title&&String(x.customer_id||'')===expectedCustomer&&clean(x.currency||'USD')===currency);
  if(hit)return hit;
  const req=lower(local?.requirements);
  return remotes.find(x=>!used.has(String(x.id))&&title&&lower(x.title)===title&&(!req||lower(x.requirements)===req))||null;
}
function rebuildDealMap(locals,remotes){
  const used=new Set();state.dealIds.clear();
  for(const row of locals||[]){const hit=dealMatch(row,remotes||[],used);if(!hit)continue;used.add(String(hit.id));state.dealIds.set(String(row.id),String(hit.id))}
}
function emitHydrated(core){
  for(const topic of ['customer.changed','product.changed','deal.changed','document.saved']){try{core.emit?.(topic,{source:'community-cloud',action:'hydrate'})}catch(_){}}
  try{window.dispatchEvent(new CustomEvent('HUIDI:community-cloud-ready',{detail:{scope:online.scope,organization:state.identity?.organization||null}}))}catch(_){}
}
function applyCoreBootstrap(core,data,{mapFrom=null}={}){
  const before=mapFrom||{customers:core.repositories.customers.list(),deals:core.repositories.deals.list()};
  rebuildCustomerMap(before.customers,data.customers||[]);
  rebuildDealMap(before.deals,data.deals||[]);
  state.hydrating=true;
  try{
    core.repositories.customers.replaceAll(data.customers||[],{silent:true});
    core.repositories.products.replaceAll(data.products||[],{silent:true});
    core.repositories.deals.replaceAll(data.deals||[],{silent:true});
    emitHydrated(core);
  }finally{state.hydrating=false}
}
async function hydrateDocuments(db){
  const payload=await api('/api/community-sync/document-records');
  const records=Array.isArray(payload?.records)?payload.records:[];
  const serverIds=new Set(records.map(x=>String(x?.id||'')).filter(Boolean));
  const current=await db.listDocuments();
  for(const row of current||[]){if(row?.id&&!serverIds.has(String(row.id)))await db.deleteDocument(row.id)}
  if(records.length)await db.importDocuments(records);
  state.knownCloudDocs=serverIds;
  state.docFingerprints.clear();
  for(const row of records){if(row?.id)state.docFingerprints.set(String(row.id),fnv(JSON.stringify(row)))}
  return records;
}
function recycleRows(){return parse(localStorage.getItem('huidi_local_recycle_v2'),[])}
function archivedPayload(){
  const out={customer:[],product:[],deal:[],document:[]};
  for(const item of recycleRows()){
    const rawType=clean(item?.type).toLowerCase();
    const kind=rawType==='customer'||rawType==='product'||rawType==='deal'||rawType==='document'?rawType:'';
    if(!kind)continue;
    const id=clean(item?.original_id||item?.payload?.id);if(id&&!out[kind].includes(id))out[kind].push(id);
  }
  return out;
}
function statePayload(core){return{customers:core.repositories.customers.list(),products:core.repositories.products.list(),deals:core.repositories.deals.list(),archived:archivedPayload()}}
function queueStateBarrier(){
  state.stateQueued=true;
  if(state.stateFollowupPromise)return state.stateFollowupPromise;
  const active=state.stateRunPromise;
  if(!active)return syncState();
  let followup;
  followup=active.then(()=>{
    state.stateQueued=false;
    return syncState();
  }).finally(()=>{
    if(state.stateFollowupPromise===followup)state.stateFollowupPromise=null;
  });
  state.stateFollowupPromise=followup;
  return followup;
}
function syncState(){
  if(!state.ready||state.hydrating||!navigator.onLine)return Promise.resolve();
  if(state.stateRunPromise)return queueStateBarrier();
  state.syncingState=true;
  const run=(async()=>{
    try{
      const {core}=await waitOwners();
      const before={customers:core.repositories.customers.list(),deals:core.repositories.deals.list()};
      const result=await api('/api/community-sync/state',{method:'PUT',body:JSON.stringify(statePayload(core))});
      applyCoreBootstrap(core,result,{mapFrom:before});
      document.documentElement.dataset.huidiCloudState='saved';
      return result;
    }catch(error){document.documentElement.dataset.huidiCloudState='error';console.error('HUIDI Community cloud state sync failed',error);return null}
  })();
  let barrier;
  barrier=run.finally(()=>{
    state.syncingState=false;
    if(state.stateRunPromise===barrier)state.stateRunPromise=null;
  });
  state.stateRunPromise=barrier;
  return barrier;
}
function mapId(map,value){const raw=clean(value);return map.get(raw)||raw}
function canonicalDocument(record){
  const next=clone(record||{}),summary=next.summary&&typeof next.summary==='object'?next.summary:null,payload=next.payload&&typeof next.payload==='object'?next.payload:null;
  if(next.deal_id!=null)next.deal_id=mapId(state.dealIds,next.deal_id);
  if(next.customer_id!=null)next.customer_id=mapId(state.customerIds,next.customer_id);
  if(summary){if(summary.deal_id!=null)summary.deal_id=mapId(state.dealIds,summary.deal_id);if(summary.customer_id!=null)summary.customer_id=mapId(state.customerIds,summary.customer_id)}
  if(payload){if(payload.dealId!=null)payload.dealId=mapId(state.dealIds,payload.dealId);if(payload.customerId!=null)payload.customerId=mapId(state.customerIds,payload.customerId)}
  return next;
}
async function syncDocuments(){
  if(!state.ready||state.hydrating||!navigator.onLine)return;
  if(state.syncingDocs){state.docsQueued=true;return}
  state.syncingDocs=true;
  try{
    if(state.stateTimer||state.syncingState)await syncState();
    const {db}=await waitOwners();
    const rows=await db.listDocuments(),currentIds=new Set();
    for(const raw of rows||[]){
      if(!raw?.id)continue;
      const record=canonicalDocument(raw),id=String(record.id);currentIds.add(id);
      const fingerprint=fnv(JSON.stringify(record));
      if(state.docFingerprints.get(id)===fingerprint)continue;
      await api(`/api/community-sync/documents/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({record})});
      state.docFingerprints.set(id,fingerprint);state.knownCloudDocs.add(id);
    }
    for(const id of [...state.knownCloudDocs]){
      if(currentIds.has(id))continue;
      await api(`/api/community-sync/document/${encodeURIComponent(id)}`,{method:'DELETE'});
      state.knownCloudDocs.delete(id);state.docFingerprints.delete(id);
    }
    document.documentElement.dataset.huidiCloudDocuments='saved';
  }catch(error){document.documentElement.dataset.huidiCloudDocuments='error';console.error('HUIDI Community document sync failed',error)}
  finally{state.syncingDocs=false;if(state.docsQueued){state.docsQueued=false;scheduleDocs(180)}}
}
function scheduleState(delay=420){if(state.hydrating)return;clearTimeout(state.stateTimer);state.stateTimer=setTimeout(()=>{state.stateTimer=0;syncState()},delay)}
function scheduleDocs(delay=520){if(state.hydrating)return;clearTimeout(state.docTimer);state.docTimer=setTimeout(()=>{state.docTimer=0;syncDocuments()},delay)}
function bind(core){
  core.bus?.on?.(message=>{
    if(state.hydrating)return;
    const topic=clean(message?.topic);
    if(/^(customer|product|deal)\.changed$/.test(topic))scheduleState();
    if(/^document\./.test(topic))scheduleDocs();
  });
  window.addEventListener('HUIDI:local-data-change',event=>{
    if(state.hydrating)return;
    const key=clean(event?.detail?.key);
    if(key.includes('recycle'))scheduleState();
    if(key.includes('document_mirror')||event?.detail?.storage==='indexeddb')scheduleDocs();
  });
  window.addEventListener('storage',event=>{
    const key=clean(event.key);if(!key.includes(`huidi_workspace_${online.scope}__`))return;
    if(key.includes('recycle'))scheduleState();
    else if(key.includes('document_mirror'))scheduleDocs();
    else if(/customers|products|deals/.test(key))scheduleState();
  });
  window.addEventListener('online',()=>{scheduleState(80);scheduleDocs(240)});
}
async function boot(){
  try{
    const {core,db}=await waitOwners();
    await verifyIdentity();
    const bootstrap=await api('/api/community-sync/bootstrap');
    applyCoreBootstrap(core,bootstrap);
    await hydrateDocuments(db);
    state.ready=true;bind(core);emitHydrated(core);
    document.documentElement.dataset.huidiCloud='ready';
  }catch(error){document.documentElement.dataset.huidiCloud='error';console.error('HUIDI Community cloud adapter boot failed',error)}
}
window.HUIDICommunityCloudAdapter=Object.freeze({version:'1.1',scope:online.scope,status:()=>({ready:state.ready,scope:online.scope,organization:state.identity?.organization||null,syncingState:state.syncingState,stateQueued:state.stateQueued}),syncState,syncDocuments});
boot();
})();