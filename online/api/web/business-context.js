(()=>{'use strict';
if(window.HUIDIBusinessContext)return;
const rawFetch=window.fetch.bind(window);
let leadId='';
const contextual=new Set(['/api/tools/trade-news','/api/tools/tariff','/api/tools/fx','/api/tools/shipping']);
function urlOf(input){try{return typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin)}catch(_){return null}}
function withContext(input,init){const u=urlOf(input);if(!u||u.origin!==location.origin||!contextual.has(u.pathname)||!leadId)return init;const method=String(init?.method||'GET').toUpperCase();if(method!=='POST'||typeof init?.body!=='string')return init;try{const data=JSON.parse(init.body||'{}');if(!data||Array.isArray(data)||typeof data!=='object'||data.lead_id)return init;data.lead_id=Number(leadId);return {...init,body:JSON.stringify(data)}}catch(_){return init}}
window.fetch=(input,init={})=>rawFetch(input,withContext(input,init));
document.addEventListener('click',e=>{const open=e.target.closest('[data-open]');if(open)leadId=String(open.dataset.open||'')},true);
window.HUIDIBusinessContext=Object.freeze({leadId:()=>leadId,clear:()=>{leadId=''}});
})();