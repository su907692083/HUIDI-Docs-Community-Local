(()=>{'use strict';
const KEY='huidi_online_product_brains_v1';
const clean=v=>String(v??'').trim();
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
const write=rows=>localStorage.setItem(KEY,JSON.stringify(rows.slice(0,500)));
const stamp=x=>Date.parse(x?.server_updated_at||x?.updated_at||x?.created_at||0)||0;
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text()||r.statusText);return r.json()}
function key(x){return clean(x?.id||x?.brain_id)||clean(x?.local_product_id)||clean(x?.sku).toLowerCase()||clean(x?.name).toLowerCase()}
function brainId(x){return clean(x?.brain_id||x?.id)}
function merge(localRows,serverRows){const map=new Map();for(const row of [...localRows,...serverRows]){const k=key(row);if(!k)continue;const old=map.get(k);if(!old||stamp(row)>=stamp(old))map.set(k,{...(old||{}),...row,id:row.id||row.brain_id||old?.id})}return [...map.values()].sort((a,b)=>stamp(b)-stamp(a))}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value).sort()){if(k==='server_updated_at')continue;out[k]=canonical(value[k])}return out}return value}
function signature(rows){const data=(Array.isArray(rows)?rows:[]).map(row=>[key(row),canonical(row)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));const text=JSON.stringify(data);let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return `${data.length}:${(h>>>0).toString(16)}`}
let inFlight=null,timer=0,serverVersion='',lastLocalSignature='';
function announce(detail){window.dispatchEvent(new CustomEvent('huidi-product-brain-synced',{detail}))}
async function performSync(){const localRows=read();const localSig=signature(localRows);const state=await api('/api/product-brains/state');const version=clean(state?.version);if(serverVersion&&lastLocalSignature&&version===serverVersion&&localSig===lastLocalSignature){const result={ok:true,mode:'state-only',count:localRows.length,version};announce(result);return result}const server=await api('/api/product-brains');const serverRows=Array.isArray(server)?server:[];const merged=merge(localRows,serverRows);write(merged);const mergedSig=signature(merged);const serverSig=signature(serverRows);let nextVersion=version,changed=0;if(mergedSig!==serverSig){const imported=await api('/api/product-brains/import',{method:'POST',body:JSON.stringify({items:merged})});nextVersion=clean(imported?.version)||nextVersion;changed=Number(imported?.changed||0)}serverVersion=nextVersion;lastLocalSignature=mergedSig;const result={ok:true,mode:'full',count:merged.length,changed,version:nextVersion};announce(result);return result}
function sync(){if(inFlight)return inFlight;inFlight=performSync().catch(()=>({ok:false,mode:'offline',count:read().length})).finally(()=>{inFlight=null});return inFlight}
function later(ms=800){clearTimeout(timer);timer=setTimeout(sync,ms)}
async function deleteServerRows(ids){const values=[...new Set((ids||[]).map(clean).filter(Boolean))];if(!values.length)return{ok:true,deleted:0};let deleted=0;for(const id of values){const response=await fetch(`/api/product-brains/${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin'});if(response.ok||response.status===404){deleted+=1;continue}throw new Error(await response.text()||response.statusText)}serverVersion='';lastLocalSignature='';const result={ok:true,mode:'delete',deleted,count:read().length};announce(result);await sync();return result}
function captureDelete(){const before=read();const beforeByKey=new Map(before.map(row=>[key(row),row]).filter(([k])=>k));setTimeout(()=>{const afterKeys=new Set(read().map(key).filter(Boolean));const removed=[...beforeByKey.entries()].filter(([k])=>!afterKeys.has(k)).map(([,row])=>brainId(row)).filter(Boolean);if(removed.length)deleteServerRows(removed).catch(()=>later(300));else later(300)},0)}
function loadAcquisitionMemory(){if(document.querySelector('script[data-huidi-acquisition-memory]')||window.HUIDIAcquisitionMemoryFusion)return;const s=document.createElement('script');s.dataset.huidiAcquisitionMemory='1';s.src='/assets/acquisition-memory-fusion.js?v=HUIDI-ACQ-MEMORY-1';document.head.appendChild(s)}
function loadAcquisitionFusion(){if(document.querySelector('script[data-huidi-acquisition-batch]')||window.HUIDIAcquisitionBatchFusion){loadAcquisitionMemory();return}const s=document.createElement('script');s.dataset.huidiAcquisitionBatch='1';s.src='/assets/acquisition-batch-fusion.js?v=HUIDI-ACQ-BATCH-1';s.addEventListener('load',loadAcquisitionMemory,{once:true});document.head.appendChild(s)}
document.addEventListener('submit',e=>{if(e.target?.id==='pbForm')later(1000)},true);
document.addEventListener('click',e=>{if(e.target.closest?.('#pbDelete')){captureDelete();return}if(e.target.closest?.('#pbActivate,#pbNew'))later(1200)},true);
window.addEventListener('storage',e=>{if(e.key===KEY)later(500)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();loadAcquisitionFusion()},{once:true});else{sync();loadAcquisitionFusion()}
setInterval(()=>sync(),120000);
window.HUIDIProductServer=Object.freeze({sync,deleteProducts:deleteServerRows});
})();
