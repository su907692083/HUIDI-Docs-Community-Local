(()=>{
'use strict';
if(window.HUIDIOpenBoxGuidanceClosure)return;
const $=s=>document.querySelector(s),clean=v=>String(v??'').trim();
let timer=0;
function foundation(){return window.HUIDIWorkspaceFoundation?.status||null}
function today(){return window.HUIDIBeginnerFlow?.data||null}
function overdue(data){return [...(data?.followups||[]),...(data?.deal_tasks||[])].filter(x=>x?.due_state==='overdue').length}
function setupRecommendation(status){if(!status?.company)return['先补公司资料','公司名称和所在国家只填一次，后面的客户开发和正式单据会直接复用。'];if(!status?.product)return['先建立第一条产品资料','先准备一个真实产品，找客户、开发信和产品目录就能直接复用。'];if(!status?.mail)return['连接一个常用邮箱','连接后才能在同一工作台里收回复、发信并自动停止已回复客户的冷开发。'];return null}
function removeDuplicateReadyActions(status){const home=$('#hufHome');if(!home||!status?.complete)return false;home.querySelector('.huf-actions')?.remove();home.querySelectorAll('[data-huf-find],[data-huf-business]').forEach(x=>x.remove());return true}
function applySingleNext(){const status=foundation(),data=today();if(!status)return false;removeDuplicateReadyActions(status);if(status.complete||!data)return true;const needsReply=Number(data?.mail?.needs_reply||0),late=overdue(data);if(needsReply>0||late>0)return true;const rec=setupRecommendation(status),now=$('#bfNow');if(!rec||!now)return true;now.innerHTML=`<div><b>${clean(rec[0])}</b><span>${clean(rec[1])}</span></div><button class="bf-btn primary" data-bf-action="setup">完成开箱设置</button>`;now.dataset.huidiOpenBoxPriority='setup';return true}
function schedule(ms=80){clearTimeout(timer);timer=setTimeout(()=>{applySingleNext();setTimeout(applySingleNext,180)},ms)}
function bind(){document.addEventListener('click',e=>{if(e.target.closest('[data-huidi-foundation],[data-huf-open],[data-bf-action],[data-huidi-product],[data-huidi-communication]'))schedule(120)},true);window.addEventListener('message',e=>{if(e.data?.type==='huidi-mail-connected')schedule(520)})}
function boot(){bind();[160,520,1100].forEach(schedule);document.body.dataset.huidiOpenBoxGuidance='v1'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIOpenBoxGuidanceClosure=Object.freeze({version:'1.0.0',refresh:applySingleNext});
})();
