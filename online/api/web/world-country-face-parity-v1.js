(()=>{'use strict';
if(window.HUIDIWorldCountryFaceParityLoader)return;
window.HUIDIWorldCountryFaceParityLoader=true;
const CORE='/assets/world-country-face-parity-core-v1.js';
let bound=false;
function css(){
  if(document.querySelector('#huidiWorldFaceInteractionSyncCss'))return;
  const s=document.createElement('style');
  s.id='huidiWorldFaceInteractionSyncCss';
  s.textContent='.wi-country-land{pointer-events:none!important}';
  document.head.appendChild(s);
}
function syncSelected(){
  const root=document.querySelector('#wiMap');
  if(!root)return false;
  const id=root.querySelector('.wi-country-marker.selected')?.dataset.marketId
    || root.querySelector('.wi-country-face.selected')?.dataset.marketId || '';
  if(!id)return false;
  root.querySelectorAll('.wi-country-land').forEach(
    x=>x.classList.toggle('selected',(x.dataset.marketId||x.dataset.countryCode||'')===id)
  );
  return true;
}
function syncBurst(){[0,20,80,180].forEach(ms=>setTimeout(syncSelected,ms))}
function bind(){
  if(bound)return;bound=true;
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target?.matches?.('#wiCountrySearch'))syncBurst()
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-wi-search-market],.wi-country-marker,.wi-country-face,.wi-country-land'))syncBurst()
  },true);
  window.addEventListener('HUIDI:fusion-pane-rendered',e=>{
    if(e.detail?.view==='online-intel')syncBurst()
  });
}
function afterCore(){
  css();bind();syncBurst();
  window.HUIDIWorldCountryFaceParity?.refresh?.();
}
function loadCore(){
  if(window.HUIDIWorldCountryFaceParity){afterCore();return}
  let tag=document.querySelector('script[data-huidi-world-face-core]');
  if(tag){tag.addEventListener('load',afterCore,{once:true});return}
  tag=document.createElement('script');
  tag.dataset.huidiWorldFaceCore='1';tag.async=false;tag.src=CORE;
  tag.addEventListener('load',afterCore,{once:true});
  document.head.appendChild(tag);
}
css();bind();loadCore();
window.HUIDIWorldCountryFaceSelectionSync=Object.freeze({version:'1.0.1',sync:syncSelected,refresh:syncBurst});
})();