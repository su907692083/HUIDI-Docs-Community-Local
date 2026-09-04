(()=>{'use strict';
const LOCAL=Object.freeze({edition:'community-local',version:'1.2.0-rc16.29',localOnly:true,strictNetwork:true});
window.HUIDI_COMMUNITY=LOCAL; window.HUIDI_LOCAL_ONLY=LOCAL;
window.FLYPIGBOX_SUPABASE={url:'',publishableKey:'',runtimeConfigFunction:''};
window.FlypigBOXRuntimeConfig={mode:'local-only',apiBase:'',enabled:false};
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
  bar.innerHTML='<b>本地模式</b><span>核心业务数据保存在当前浏览器；页面主动 API 外联已阻断。网络图片、外部邮箱等仅在你主动使用时需要联网。</span><button type="button" aria-label="关闭">×</button>';
  document.body.prepend(bar);
  bar.querySelector('button').onclick=()=>bar.remove();
};
const permit=()=>{
  const member=window.FlypigBOXMember=window.FlypigBOXMember||{};
  member.requestPdfExport=async()=>({allowed:true,watermark:false,plan:'community-local',remaining:null});
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
const boot=()=>{
  document.documentElement.dataset.huidiEdition='community-local';
  document.body?.classList.add('huidi-community-local');if(/\/editor\.html$/i.test(location.pathname))document.body?.classList.add('huidi-local-editor-rc5');if(/\/catalog-studio\/index\.html$/i.test(location.pathname))document.body?.classList.add('huidi-local-catalog-rc5');
  hideByText(); banner(); permit(); applyType();
  const badge=document.getElementById('memberBadge');
  if(badge){badge.hidden=false;badge.textContent='本地版 · 数据在本机';badge.title='HUIDI Docs Community Local'}
  const save=document.getElementById('saveAllBtn');
  if(save){save.title='保存到当前电脑浏览器';save.textContent='保存到本机'}
  ['memberAuthBtn','memberSignOutBtn','membershipPlansBtn','cloudSaveBtn','cloudHistoryBtn','openLaunchPlans','launchPlansBtn','headerTranslateBtn','translateAllBtn','fp-ai-widget','fp-assistant41-launcher'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.hidden=true;
  });
  setTimeout(()=>{permit();hideByText();applyType();window.FlypigBOXDocumentGate?.setTrialWatermark?.(false)},250);
  setTimeout(()=>{permit();hideByText()},1200);
  setTimeout(()=>{permit();hideByText();window.FlypigBOXApp?.applyEditorAccessGate?.(false)},3000);
  const obs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)hideByText(n)})));
  obs.observe(document.body,{subtree:true,childList:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();