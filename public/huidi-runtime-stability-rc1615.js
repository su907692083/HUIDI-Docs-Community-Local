/* HUIDI Docs Community Local RC16.15 — First Paint & Runtime Stabilization. */
(()=>{
  'use strict';
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.15-RUNTIME-STABILITY';
  const root=document.documentElement;
  let released=false,stableSeenAt=0,checkTimer=0;
  function stable(){
    const toolbar=document.getElementById('fpLiteToolbar');
    const paper=document.getElementById('piPaper');
    const pages=paper?.querySelectorAll?.('.pdf-document .pdf-page')?.length||0;
    return Boolean(toolbar&&paper&&pages>0&&paper.dataset.fpPreviewStatus==='ready'&&paper.dataset.fpPaginationStable==='1');
  }
  function release(reason='stable'){
    if(released)return;released=true;
    clearTimeout(checkTimer);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.remove('huidi-rc1615-boot');
      root.dataset.huidiFirstPaint='ready';
      root.dataset.huidiFirstPaintReason=reason;
      const banner=document.getElementById('fpA12PreviewReadiness');if(banner)banner.removeAttribute('data-huidi-preview-hidden');
      try{document.dispatchEvent(new CustomEvent('HUIDI:first-paint-ready',{detail:{reason,version:VERSION}}));}catch(_){ }
    }));
  }
  function check(){
    if(released)return;
    if(stable()){
      if(!stableSeenAt)stableSeenAt=performance.now();
      if(performance.now()-stableSeenAt>=70){release('stable-preview');return;}
    }else stableSeenAt=0;
    checkTimer=setTimeout(check,45);
  }
  function boot(){
    const banner=document.getElementById('fpA12PreviewReadiness');if(banner)banner.setAttribute('data-huidi-preview-hidden','1');
    check();
    setTimeout(()=>release(stable()?'stable-timeout':'bounded-fallback'),2400);
  }
  document.addEventListener('HUIDI:preview-rendered',()=>{if(!released)check();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.HUIDIRuntimeStability=Object.freeze({version:VERSION,isReleased:()=>released,release});
})();
