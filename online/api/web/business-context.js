(()=>{'use strict';
if(window.HUIDIBusinessContext)return;
const rawFetch=window.fetch.bind(window);
let leadId='',dealId='',dealSnapshot=null;
const contextual=new Set(['/api/tools/trade-news','/api/tools/tariff','/api/tools/fx','/api/tools/shipping']);
function urlOf(input){try{return typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin)}catch(_){return null}}
function withContext(input,init){const u=urlOf(input);if(!u||u.origin!==location.origin||!contextual.has(u.pathname)||!leadId)return init;const method=String(init?.method||'GET').toUpperCase();if(method!=='POST'||typeof init?.body!=='string')return init;try{const data=JSON.parse(init.body||'{}');if(!data||Array.isArray(data)||typeof data!=='object'||data.lead_id)return init;data.lead_id=Number(leadId);return {...init,body:JSON.stringify(data)}}catch(_){return init}}
function setDealOwners(id){window.HUIDIBusinessLowInputFusion?.setDealId?.(id);window.HUIDIBusinessDocumentReuseFusion?.setDealId?.(id)}
function acceptDealOwners(data){window.HUIDIBusinessLowInputFusion?.acceptDeal?.(data);window.HUIDIBusinessDocumentReuseFusion?.acceptDeal?.(data)}
function noteBusinessDeal(input,init){const u=urlOf(input);if(!u||u.origin!==location.origin)return;const method=String(init?.method||'GET').toUpperCase();if(method!=='GET')return;const match=u.pathname.match(/^\/api\/business\/deals\/(\d+)$/);if(!match)return;if(match[1]!==dealId)dealSnapshot=null;dealId=match[1];setDealOwners(dealId)}
async function observeBusinessResponse(input,init,response){const u=urlOf(input);if(!u||u.origin!==location.origin)return response;const method=String(init?.method||'GET').toUpperCase();const dealMatch=u.pathname.match(/^\/api\/business\/deals\/(\d+)$/);if(method==='GET'&&dealMatch&&response.ok){try{const data=await response.clone().json();if(dealMatch[1]===dealId){dealSnapshot=data;acceptDealOwners(data)}}catch(_){}}
const documentMatch=u.pathname.match(/^\/api\/business\/deals\/(\d+)\/native-document$/);if(method==='POST'&&documentMatch&&response.ok){try{const data=await response.clone().json();const refId=String(data?.id||''),documentType=String(data?.document_type||'quotation');if(refId){await window.HUIDIBusinessLowInputFusion?.seedNativeDocument?.(documentMatch[1],refId,documentType);await window.HUIDIBusinessDocumentReuseFusion?.seedNativeDocument?.(documentMatch[1],refId,documentType)}}catch(_){}}
return response}
function loadUnifiedNextActions(){if(window.HUIDIUnifiedNextActionsFusion||document.querySelector('script[data-huidi-unified-next]'))return;const s=document.createElement('script');s.src='/assets/unified-next-actions-fusion.js?v=HUIDI-UNIFIED-NEXT-3';s.dataset.huidiUnifiedNext='1';document.head.appendChild(s)}
function loadBusinessLowInput(){if(window.HUIDIBusinessLowInputFusion||document.querySelector('script[data-huidi-business-low-input]'))return;const s=document.createElement('script');s.src='/assets/business-low-input-fusion.js?v=HUIDI-BUSINESS-LOW-INPUT-3';s.dataset.huidiBusinessLowInput='1';s.onload=()=>{if(dealId)window.HUIDIBusinessLowInputFusion?.setDealId?.(dealId);if(dealSnapshot)window.HUIDIBusinessLowInputFusion?.acceptDeal?.(dealSnapshot)};document.head.appendChild(s)}
function loadBusinessDocumentReuse(){if(window.HUIDIBusinessDocumentReuseFusion||document.querySelector('script[data-huidi-business-document-reuse]'))return;const s=document.createElement('script');s.src='/assets/business-document-reuse-fusion.js?v=HUIDI-BUSINESS-DOCUMENT-REUSE-1';s.dataset.huidiBusinessDocumentReuse='1';s.onload=()=>{if(dealId)window.HUIDIBusinessDocumentReuseFusion?.setDealId?.(dealId);if(dealSnapshot)window.HUIDIBusinessDocumentReuseFusion?.acceptDeal?.(dealSnapshot)};document.head.appendChild(s)}
window.fetch=async(input,init={})=>{const next=withContext(input,init);noteBusinessDeal(input,next);const response=await rawFetch(input,next);return observeBusinessResponse(input,next,response)};
document.addEventListener('click',e=>{const open=e.target.closest('[data-open]');if(open)leadId=String(open.dataset.open||'')},true);
loadUnifiedNextActions();
loadBusinessLowInput();
loadBusinessDocumentReuse();
window.HUIDIBusinessContext=Object.freeze({leadId:()=>leadId,dealId:()=>dealId,deal:()=>dealSnapshot,clear:()=>{leadId='';dealId='';dealSnapshot=null;window.HUIDIBusinessLowInputFusion?.clearDealId?.();window.HUIDIBusinessDocumentReuseFusion?.clearDealId?.()}});
})();
