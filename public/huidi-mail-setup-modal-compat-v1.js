/* HUIDI Mail Setup Modal Compatibility V1
   Keeps the retired mailbox-manager modal id reserved while the beginner-first
   mailbox setup owns the interaction, preventing legacy and new managers from
   opening as overlapping surfaces. */
(()=>{
'use strict';
if(window.HUIDIMailSetupModalCompatibility)return;
let scheduled=false;
function clear(){document.querySelector('#mgModalBack[data-hms-compat="1"]')?.remove()}
function sync(){
 scheduled=false;
 const active=document.querySelector('#hmsBack.open');
 if(!active){clear();return}
 const existing=document.getElementById('mgModalBack');
 if(existing&&!existing.dataset.hmsCompat)return;
 const node=existing||document.createElement('div');
 if(!existing){node.id='mgModalBack';node.dataset.hmsCompat='1';node.hidden=true;node.setAttribute('aria-hidden','true');document.body.appendChild(node)}
 node.classList.add('open');
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(sync,0);setTimeout(sync,60);setTimeout(sync,180)}
window.addEventListener('click',e=>{if(e.target?.closest?.('[data-other-mail],[data-huf-other-mail],#mgManage'))schedule();if(e.target?.closest?.('.hms-close'))setTimeout(clear,0)},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('#hmsBack.open'))setTimeout(clear,0)},true);
window.HUIDIMailSetupModalCompatibility=Object.freeze({version:'1.0.0',sync,clear});
})();
