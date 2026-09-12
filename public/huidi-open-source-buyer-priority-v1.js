(()=>{
'use strict';
if(!window.HUIDI_COMMUNITY_ONLINE?.enabled||window.HUIDIOpenSourceBuyerPriority)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const cache=new Map();
let timer=0,busy=false;
async function api(url){const r=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(await r.text()||r.statusText);return r.json()}
function style(){if($('#hospBuyerPriorityStyle'))return;const s=document.createElement('style');s.id='hospBuyerPriorityStyle';s.textContent=`
.hosp-buyer-priority{display:flex;align-items:center;gap:5px;min-width:0;margin-top:2px}.hosp-buyer-priority b{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:18px;padding:0 5px;border:1px solid #bfd2e8;border-radius:999px;background:#eef5fd;color:#245d96;font-size:7.5px;line-height:1}.hosp-buyer-priority b[data-grade="A"]{border-color:#a9dac0;background:#edf9f2;color:#23704d}.hosp-buyer-priority b[data-grade="B"]{border-color:#b9d2ed;background:#f0f6fd;color:#2b6399}.hosp-buyer-priority b[data-grade="C"]{border-color:#ead7aa;background:#fff8e8;color:#8a6425}.hosp-buyer-priority b[data-grade="D"]{border-color:#e4c5c5;background:#fff3f3;color:#915050}.hosp-buyer-priority span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:7.8px;color:#58728d}.hosp-buyer-priority em{font-style:normal;flex:0 0 auto;font-size:7.4px;color:#8493a5}.hosp-batch-row .hosp-buyer-priority{margin-top:4px;max-width:540px}@media(max-width:760px){.hosp-buyer-priority span{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
`;document.head.appendChild(s)}
function grade(lead){const p=clean(lead?.priority).toUpperCase();if(['A','B','C','D'].includes(p))return p;const score=Number(lead?.score||0);return score>=80?'A':score>=65?'B':score>=45?'C':'D'}
function rationale(lead){const a=lead?.assessment||{},report=a?.report||{};const positives=Array.isArray(report.positives)?report.positives:[];return clean(lead?.reason)||clean(positives[0])||clean(a?.reason)||'暂无更多匹配依据，建议先看背调证据再决定是否联系。'}
function priorityHtml(lead){const g=grade(lead),score=Math.round(Number(lead?.score||0)),reason=rationale(lead);return `<div class="hosp-buyer-priority" data-hosp-priority-ready="1"><b data-grade="${esc(g)}">${esc(g)}级</b><em>${score}分</em><span title="${esc(reason)}">匹配依据：${esc(reason)}</span></div>`}
async function loadLead(id){id=clean(id);if(!id)return null;if(cache.has(id))return cache.get(id);const p=api(`/api/leads/${encodeURIComponent(id)}`).catch(()=>null);cache.set(id,p);return p}
async function decorateLeadRow(row){if(!row?.isConnected||row.dataset.hospPriorityLoading==='1')return;const id=clean(row.dataset.hospLead);if(!id)return;row.dataset.hospPriorityLoading='1';const lead=await loadLead(id);row.dataset.hospPriorityLoading='';if(!lead||!row.isConnected)return;const main=$('.hosp-lead-main',row);if(!main)return;main.querySelector('[data-hosp-priority-ready]')?.remove();main.insertAdjacentHTML('beforeend',priorityHtml(lead))}
async function decorateBatchRow(row){if(!row?.isConnected||row.dataset.hospPriorityLoading==='1')return;const id=clean(row.dataset.hospBatchLead);if(!id)return;row.dataset.hospPriorityLoading='1';const lead=await loadLead(id);row.dataset.hospPriorityLoading='';if(!lead||!row.isConnected)return;const main=row.firstElementChild;if(!main)return;main.querySelector('[data-hosp-priority-ready]')?.remove();main.insertAdjacentHTML('beforeend',priorityHtml(lead))}
async function enhance(){if(busy)return false;busy=true;try{style();const leadRows=$$('.hosp-cockpit [data-hosp-lead]').slice(0,12),batchRows=$$('#hospBatchDialog[open] [data-hosp-batch-lead]').slice(0,20);await Promise.all([...leadRows.map(decorateLeadRow),...batchRows.map(decorateBatchRow)]);document.body.dataset.huidiBuyerPriorityParity='v1';return Boolean(leadRows.length||batchRows.length)}finally{busy=false}}
function schedule(ms=70){clearTimeout(timer);timer=setTimeout(()=>enhance().catch(()=>{}),ms)}
function bind(){document.addEventListener('click',e=>{if(e.target.closest('[data-hosp-batch],[data-wi-search-market],[data-wi-market],[data-wi-country]'))[80,240,620].forEach(schedule)},true);window.addEventListener('HUIDI:fusion-pane-rendered',e=>{if(['online-intel','online-find'].includes(e.detail?.view))[60,220,560].forEach(schedule)})}
function boot(){style();bind();[120,420,900].forEach(schedule)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIOpenSourceBuyerPriority=Object.freeze({version:'1.0.0',enhance,refresh:()=>{cache.clear();return enhance()}});
})();
