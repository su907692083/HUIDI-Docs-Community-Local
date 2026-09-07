(()=>{'use strict';
if(window.HUIDIBusinessContext)return;
const rawFetch=window.fetch.bind(window);
let leadId='',dealId='';
const contextual=new Set(['/api/tools/trade-news','/api/tools/tariff','/api/tools/fx','/api/tools/shipping']);
function urlOf(input){try{return typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin)}catch(_){return null}}
function withContext(input,init){const u=urlOf(input);if(!u||u.origin!==location.origin||!contextual.has(u.pathname)||!leadId)return init;const method=String(init?.method||'GET').toUpperCase();if(method!=='POST'||typeof init?.body!=='string')return init;try{const data=JSON.parse(init.body||'{}');if(!data||Array.isArray(data)||typeof data!=='object'||data.lead_id)return init;data.lead_id=Number(leadId);return {...init,body:JSON.stringify(data)}}catch(_){return init}}
function noteBusinessDeal(input,init){const u=urlOf(input);if(!u||u.origin!==location.origin)return;const method=String(init?.method||'GET').toUpperCase();if(method!=='GET')return;const match=u.pathname.match(/^\/api\/business\/deals\/(\d+)$/);if(!match)return;dealId=match[1];window.HUIDIBusinessLowInputFusion?.setDealId?.(dealId)}
function loadUnifiedNextActions(){if(window.HUIDIUnifiedNextActionsFusion||document.querySelector('script[data-huidi-unified-next]'))return;const s=document.createElement('script');s.src='/assets/unified-next-actions-fusion.js?v=HUIDI-UNIFIED-NEXT-3';s.dataset.huidiUnifiedNext='1';document.head.appendChild(s)}
function loadBusinessLowInput(){if(window.HUIDIBusinessLowInputFusion||document.querySelector('script[data-huidi-business-low-input]'))return;const s=document.createElement('script');s.src='/assets/business-low-input-fusion.js?v=HUIDI-BUSINESS-LOW-INPUT-2';s.dataset.huidiBusinessLowInput='1';s.onload=()=>{if(dealId)window.HUIDIBusinessLowInputFusion?.setDealId?.(dealId)};document.head.appendChild(s)}
window.fetch=(input,init={})=>{const next=withContext(input,init);noteBusinessDeal(input,next);return rawFetch(input,next)};
document.addEventListener('click',e=>{const open=e.target.closest('[data-open]');if(open)leadId=String(open.dataset.open||'')},true);
loadUnifiedNextActions();
loadBusinessLowInput();
window.HUIDIBusinessContext=Object.freeze({leadId:()=>leadId,dealId:()=>dealId,clear:()=>{leadId='';dealId=''}});
})();
