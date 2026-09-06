(()=>{'use strict';
if(window.HUIDIAcquisitionStatus)return;
const $=s=>document.querySelector(s),esc=s=>String(s??'');
async function refresh(){const el=$('#health');if(!el)return;try{const r=await fetch('/api/acquisition/status');if(!r.ok)throw new Error();const x=await r.json();const company=x.live_company_search?'找客户已连接':'找客户未连接';const contact=x.live_contact_search?'联系人已连接':'联系人未连接';el.textContent=`${company} · ${contact}`;el.title=`企业来源：${(x.company_search_order||[]).join(' → ')||'未连接'}；联系人来源：${(x.contact_search_order||[]).join(' → ')||'未连接'}`;}catch(_){}}
function boot(){refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIAcquisitionStatus=Object.freeze({refresh});
})();