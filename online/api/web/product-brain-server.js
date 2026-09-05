(()=>{'use strict';
const KEY='huidi_online_product_brains_v1';
const clean=v=>String(v??'').trim();
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
const write=rows=>localStorage.setItem(KEY,JSON.stringify(rows.slice(0,500)));
const stamp=x=>Date.parse(x?.server_updated_at||x?.updated_at||x?.created_at||0)||0;
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});if(!r.ok)throw new Error(await r.text()||r.statusText);return r.json()}
function key(x){return clean(x?.id||x?.brain_id)||clean(x?.local_product_id)||clean(x?.sku).toLowerCase()||clean(x?.name).toLowerCase()}
function merge(localRows,serverRows){const map=new Map();for(const row of [...localRows,...serverRows]){const k=key(row);if(!k)continue;const old=map.get(k);if(!old||stamp(row)>=stamp(old))map.set(k,{...(old||{}),...row,id:row.id||row.brain_id||old?.id})}return [...map.values()].sort((a,b)=>stamp(b)-stamp(a))}
let busy=false,timer=0;
async function sync(){if(busy)return;busy=true;try{const server=await api('/api/product-brains');const merged=merge(read(),Array.isArray(server)?server:[]);write(merged);await api('/api/product-brains/import',{method:'POST',body:JSON.stringify({items:merged})});window.dispatchEvent(new CustomEvent('huidi-product-brain-synced',{detail:{count:merged.length}}))}catch(_){/* 本地仍可继续使用，恢复联网后会再次同步 */}finally{busy=false}}
function later(ms=800){clearTimeout(timer);timer=setTimeout(sync,ms)}
document.addEventListener('submit',e=>{if(e.target?.id==='pbForm')later(1000)},true);
document.addEventListener('click',e=>{if(e.target.closest?.('#pbDelete,#pbActivate,#pbNew'))later(1200)},true);
window.addEventListener('storage',e=>{if(e.key===KEY)later(500)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>sync(),{once:true});else sync();
setInterval(()=>sync(),120000);
window.HUIDIProductServer=Object.freeze({sync});
})();