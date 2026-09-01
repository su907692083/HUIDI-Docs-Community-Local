(()=>{
  'use strict';
  if(window.__FP31_WORKSPACE_DETAIL_CLOSURE__)return;
  window.__FP31_WORKSPACE_DETAIL_CLOSURE__=true;
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  function apply(root=document){
    document.body.dataset.fpWorkspaceDetailClosure='18.31';
    qsa('.section-head .actions,.card-actions,.row-actions,.table-actions,.detail-actions',root).forEach(group=>{
      const items=qsa('button,a',group).filter(el=>!el.hidden&&getComputedStyle(el).display!=='none');
      group.classList.toggle('fp31-dense-actions',items.length>3);
      items.forEach(el=>{const text=(el.textContent||'').trim();if(text&&!el.title)el.title=text;});
    });
    qsa('.fp30-module-guide b,.deal-card h3,.product-card h3,.brand-card h3',root).forEach(el=>{const text=(el.textContent||'').trim();if(text&&!el.title)el.title=text;});
  }
  let timer=0;const observer=new MutationObserver(records=>{if(!records.some(r=>r.addedNodes.length))return;clearTimeout(timer);timer=setTimeout(()=>apply(document),80)});
  function start(){apply();observer.observe(document.body,{childList:true,subtree:true});}
  document.addEventListener('HUIDI:workspace-rendered',()=>setTimeout(()=>apply(),0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
