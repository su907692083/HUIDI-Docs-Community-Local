/* HUIDI V3.3.4.0 — coordinated startup reveal and stable initial scroll position. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let finished=false,start=performance.now();
function resetScroll(){try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(_){window.scrollTo(0,0)};for(const selector of ['.form-column','.preview-shell','.fp-workbook-canvas','.fp-export-sheet-scroll']){const node=document.querySelector(selector);if(node){node.scrollTop=0;node.scrollLeft=0}}}
function pendingRestore(){try{return Boolean(sessionStorage.getItem('flypigbox_open_document_id')||sessionStorage.getItem('flypigbox_convert_document_state')||sessionStorage.getItem('flypigbox_pending_document_type'))}catch(_){return false}}
function finish(){if(finished)return;finished=true;document.body.classList.add('fp-v3320-workflow-ux');window.FlypigBOXLayoutManager?.apply?.();requestAnimationFrame(()=>requestAnimationFrame(()=>{resetScroll();document.documentElement.classList.remove('fp-startup-stabilizing');document.dispatchEvent(new CustomEvent('HUIDI:startup-stable'))}))}
function check(){const elapsed=performance.now()-start;if(elapsed<1350)return setTimeout(check,80);if(!pendingRestore()||elapsed>3600)return finish();setTimeout(check,100)}
function boot(){resetScroll();setTimeout(check,80)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
