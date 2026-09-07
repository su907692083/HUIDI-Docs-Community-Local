(()=>{'use strict';
const cookieValue=name=>{try{const prefix=`${name}=`;for(const part of String(document.cookie||'').split(';')){const item=part.trim();if(item.startsWith(prefix))return decodeURIComponent(item.slice(prefix.length))}}catch(_){}return''};
const rawScope=cookieValue('huidi_workspace_scope');
const communityPath=/\/community(?:\/|$)/i.test(location.pathname);
const onlineScope=communityPath&&/^org-\d+$/.test(rawScope)?rawScope:'';
const ONLINE=onlineScope?Object.freeze({enabled:true,scope:onlineScope,apiBase:'',mode:'community-online-mother-surface'}):null;
if(ONLINE)window.HUIDI_COMMUNITY_ONLINE=ONLINE;

function installScopedBrowserStorage(){
  if(!ONLINE)return;
  const prefix=`huidi_workspace_${ONLINE.scope}__`;
  const shouldScope=key=>/^(?:huidi_|flypigbox_)/i.test(String(key||''));
  const scopedKey=key=>{const value=String(key||'');if(value.startsWith(prefix))return value;return shouldScope(value)?prefix+value:value};
  const isWorkspaceStorage=storage=>storage===window.localStorage||storage===window.sessionStorage;
  window.HUIDI_WORKSPACE_STORAGE=Object.freeze({scope:ONLINE.scope,prefix,scopedKey,storages:['localStorage','sessionStorage']});
  try{
    const proto=window.Storage?.prototype;
    if(proto&&!proto.__huidiWorkspaceScoped){
      const getItem=proto.getItem,setItem=proto.setItem,removeItem=proto.removeItem,clear=proto.clear,keyAt=proto.key;
      Object.defineProperty(proto,'__huidiWorkspaceScoped',{value:true,configurable:false});
      proto.getItem=function(key){return isWorkspaceStorage(this)?getItem.call(this,scopedKey(key)):getItem.call(this,key)};
      proto.setItem=function(key,value){return isWorkspaceStorage(this)?setItem.call(this,scopedKey(key),value):setItem.call(this,key,value)};
      proto.removeItem=function(key){return isWorkspaceStorage(this)?removeItem.call(this,scopedKey(key)):removeItem.call(this,key)};
      proto.clear=function(){
        if(!isWorkspaceStorage(this))return clear.call(this);
        const owned=[];
        for(let i=0;i<this.length;i++){const key=keyAt.call(this,i);if(key&&key.startsWith(prefix))owned.push(key)}
        owned.forEach(key=>removeItem.call(this,key));
      };
    }
  }catch(error){console.error('HUIDI workspace browser-storage scope failed',error)}
  try{
    const proto=window.IDBFactory?.prototype;
    if(proto&&!proto.__huidiWorkspaceScoped){
      const open=proto.open,deleteDatabase=proto.deleteDatabase;
      const dbName=name=>{const value=String(name||'');return /^HUIDI_DOCS_LOCAL_DB_/i.test(value)?`HUIDI_DOCS_ONLINE_DB_${ONLINE.scope}_${value}`:value};
      Object.defineProperty(proto,'__huidiWorkspaceScoped',{value:true,configurable:false});
      proto.open=function(name,version){const next=dbName(name);return version===undefined?open.call(this,next):open.call(this,next,version)};
      proto.deleteDatabase=function(name){return deleteDatabase.call(this,dbName(name))};
      window.HUIDI_WORKSPACE_INDEXEDDB=Object.freeze({scope:ONLINE.scope,dbName});
    }
  }catch(error){console.error('HUIDI workspace IndexedDB scope failed',error)}
}
installScopedBrowserStorage();

/* Online direct-document gate. The published Local editor already owns
   localDoc -> HUIDILocalDB.getDocument -> applyState. We only delay that one
   read until the current tenant's cloud records have been hydrated into the
   scoped IndexedDB, so the mature editor restore path stays authoritative. */
function installCloudDocumentReadGate(){
  if(!ONLINE)return;
  const started=Date.now();
  const install=()=>{
    const db=window.HUIDILocalDB;
    if(!db?.getDocument){if(Date.now()-started<10000)setTimeout(install,8);return}
    if(db.__huidiCommunityCloudReadGate)return;
    const nativeGet=db.getDocument.bind(db);
    let settled=false;
    let resolveReady=()=>{};
    const ready=new Promise(resolve=>{resolveReady=resolve});
    const finish=()=>{if(settled)return;settled=true;resolveReady()};
    const probe=()=>{
      const status=document.documentElement.dataset.huidiCloud||'';
      if(status==='ready'||status==='error')return finish();
      if(Date.now()-started>12000)return finish();
      setTimeout(probe,20);
    };
    window.addEventListener('HUIDI:community-cloud-ready',finish,{once:true});
    setTimeout(probe,0);
    Object.defineProperty(db,'__huidiCommunityCloudReadGate',{value:true,configurable:false});
    db.getDocument=async function(...args){await ready;return nativeGet(...args)};
    window.HUIDI_COMMUNITY_DOCUMENT_READ_READY=ready;
  };
  install();
}
installCloudDocumentReadGate();

const LOCAL=Object.freeze({edition:'community-local',version:'1.2.0-rc16.29',localOnly:true,strictNetwork:true});
window.HUIDI_COMMUNITY=LOCAL; window.HUIDI_LOCAL_ONLY=LOCAL;
window.FLYPIGBOX_SUPABASE={url:'',publishableKey:'',runtimeConfigFunction:''};
window.FlypigBOXRuntimeConfig={mode:ONLINE?'community-online':'local-only',apiBase:'',enabled:Boolean(ONLINE)};
// RC5: normalise editor route before legacy editor scripts read query parameters.
(()=>{try{if(!/\/editor\.html$/i.test(location.pathname))return;const p=new URLSearchParams(location.search);const type=p.get('type')||p.get('doc')||sessionStorage.getItem('flypigbox_pending_document_type')||'';if(type){const before=p.toString();p.set('type',type);p.set('doc',type);p.set('local','1');if(p.toString()!==before)history.replaceState(null,'',`${location.pathname}?${p.toString()}${location.hash}`)}}catch(_){}})();

const sameOrigin=(value)=>{
  try{
    const url=value instanceof Request?new URL(value.url,location.href):new URL(String(value||''),location.href);
    if(['data:','blob:'].includes(url.protocol)) return true;
    return url.origin===location.origin;
  }catch(_){return false}
};
const blocked=(kind,url)=>{
  console.warn(`[HUIDI Local] blocked ${kind}:`,url);
  try{document.dispatchEvent(new CustomEvent('HUIDI:local-network-blocked',{detail:{kind,url:String(url||'')}}))}catch(_){}
};
if(window.fetch){
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>sameOrigin(input)?nativeFetch(input,init):(blocked('fetch',input),Promise.reject(new Error('HUIDI_LOCAL_ONLY_NETWORK_BLOCKED')));
}
if(window.XMLHttpRequest){
  const NativeXHR=window.XMLHttpRequest;
  const open=NativeXHR.prototype.open;
  NativeXHR.prototype.open=function(method,url,...rest){
    if(!sameOrigin(url)){blocked('xhr',url);throw new Error('HUIDI_LOCAL_ONLY_NETWORK_BLOCKED')}
    return open.call(this,method,url,...rest);
  };
}
if(window.WebSocket){
  const NativeWS=window.WebSocket;
  window.WebSocket=function(url,protocols){if(!sameOrigin(url)){blocked('websocket',url);throw new Error('HUIDI_LOCAL_ONLY_NETWORK_BLOCKED')}return new NativeWS(url,protocols)};
  window.WebSocket.prototype=NativeWS.prototype;
}
if(window.EventSource){
  const NativeES=window.EventSource;
  window.EventSource=function(url,config){if(!sameOrigin(url)){blocked('eventsource',url);throw new Error('HUIDI_LOCAL_ONLY_NETWORK_BLOCKED')}return new NativeES(url,config)};
  window.EventSource.prototype=NativeES.prototype;
}
if(navigator.sendBeacon){
  const nativeBeacon=navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon=(url,data)=>sameOrigin(url)?nativeBeacon(url,data):(blocked('beacon',url),false);
}
const hideByText=(root=document)=>{
  const rx=/(通知与协同|AI\s*网关|Founder OS|云端草稿|云端模板|会员方案|开通会员|登录\/注册)/i;
  root.querySelectorAll('button,a,[role="button"],summary').forEach(el=>{
    if(el.closest?.('[data-huidi-local-online-allowed="feishu"]'))return;
    const text=(el.textContent||'').trim();
    if(rx.test(text)){el.hidden=true;el.setAttribute('aria-hidden','true')}
  });
};
const banner=()=>{
  if(document.getElementById('huidiLocalModeBar'))return;
  const bar=document.createElement('div'); bar.id='huidiLocalModeBar';
  bar.innerHTML=ONLINE
    ?'<b>联网工作区</b><span>使用原 HUIDI Community 工作台；客户、商品、询盘与正式单据保存到当前登录工作区，本机只保留该工作区的隔离缓存。</span><button type="button" aria-label="关闭">×</button>'
    :'<b>本地模式</b><span>核心业务数据保存在当前浏览器；页面主动 API 外联已阻断。网络图片、外部邮箱等仅在你主动使用时需要联网。</span><button type="button" aria-label="关闭">×</button>';
  document.body.prepend(bar);
  bar.querySelector('button').onclick=()=>bar.remove();
};
const permit=()=>{
  const member=window.FlypigBOXMember=window.FlypigBOXMember||{};
  member.requestPdfExport=async()=>({allowed:true,watermark:false,plan:ONLINE?'community-online':'community-local',remaining:null});
  member.requestPremiumPrint=async()=>true;
  try{window.FlypigBOXApp?.applyEditorAccessGate?.(false)}catch(_){}
};
const applyType=()=>{
  const params=new URLSearchParams(location.search);
  const type=params.get('type')||params.get('doc');
  if(!type)return;
  const el=document.getElementById('documentType');
  if(el){el.value=type;el.dispatchEvent(new Event('change',{bubbles:true}));}
};
const loadCloudAdapter=()=>{
  if(!ONLINE||document.querySelector('script[data-huidi-community-cloud]'))return;
  const script=document.createElement('script');
  script.src='/community/huidi-community-cloud-adapter-v1.js?v=HUIDI-COMMUNITY-ONLINE-1';
  script.dataset.huidiCommunityCloud='1';
  document.head.appendChild(script);
};
// Start tenant hydration as early as possible. The adapter itself waits for
// HUIDILocalCore/HUIDILocalDB, so there is no need to defer it to DOMContentLoaded.
if(ONLINE)loadCloudAdapter();
const boot=()=>{
  document.documentElement.dataset.huidiEdition=ONLINE?'community-online':'community-local';
  if(ONLINE)document.documentElement.dataset.huidiWorkspaceScope=ONLINE.scope;
  document.body?.classList.add('huidi-community-local');if(ONLINE)document.body?.classList.add('huidi-community-online');if(/\/editor\.html$/i.test(location.pathname))document.body?.classList.add('huidi-local-editor-rc5');if(/\/catalog-studio\/index\.html$/i.test(location.pathname))document.body?.classList.add('huidi-local-catalog-rc5');
  hideByText(); banner(); permit(); applyType();loadCloudAdapter();
  const badge=document.getElementById('memberBadge');
  if(badge){badge.hidden=false;badge.textContent=ONLINE?'联网版 · 正在确认工作区':'本地版 · 数据在本机';badge.title=ONLINE?'HUIDI Online · Community Workspace':'HUIDI Docs Community Local'}
  const save=document.getElementById('saveAllBtn');
  if(save){save.title=ONLINE?'保存并同步到当前登录工作区':'保存到当前电脑浏览器';save.textContent=ONLINE?'保存':'保存到本机'}
  ['memberAuthBtn','membershipPlansBtn','cloudSaveBtn','cloudHistoryBtn','openLaunchPlans','launchPlansBtn','headerTranslateBtn','translateAllBtn','fp-ai-widget','fp-assistant41-launcher'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.hidden=true;
  });
  if(!ONLINE){const signOut=document.getElementById('memberSignOutBtn');if(signOut)signOut.hidden=true}
  setTimeout(()=>{permit();hideByText();applyType();window.FlypigBOXDocumentGate?.setTrialWatermark?.(false)},250);
  setTimeout(()=>{permit();hideByText()},1200);
  setTimeout(()=>{permit();hideByText();window.FlypigBOXApp?.applyEditorAccessGate?.(false)},3000);
  const obs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)hideByText(n)})));
  obs.observe(document.body,{subtree:true,childList:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();