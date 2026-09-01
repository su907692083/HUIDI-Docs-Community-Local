/* HUIDI V3.3.2.8 — post-render PDF integrity guard. */
(()=>{'use strict';
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
let timer=0;
function markAndRepair(){
  timer=0;
  const pages=qsa('#piPaper .pdf-page');
  pages.forEach(page=>{
    const body=page.querySelector('.pdf-page-body');
    if(!body)return;
    qsa('th,td,.pdf-party-card,.pdf-meta-grid>div,.pdf-meta-bar>span',body).forEach(cell=>{
      cell.style.removeProperty('height');cell.style.removeProperty('max-height');
      cell.classList.toggle('fp-text-wrap-repaired',cell.scrollWidth>cell.clientWidth+1||cell.scrollHeight>cell.clientHeight+1);
    });
    const clipped=qsa('tr',body).filter(row=>{
      const rr=row.getBoundingClientRect(),br=body.getBoundingClientRect();
      return rr.bottom>br.bottom-8&&rr.top<br.bottom;
    });
    page.dataset.fpClippedRows=String(clipped.length);
  });
}
function schedule(delay=80){clearTimeout(timer);timer=setTimeout(markAndRepair,delay)}
function boot(){
  if(!document.getElementById('piForm'))return;
  [120,400,900,1600].forEach(ms=>setTimeout(schedule,ms));
  document.addEventListener('HUIDI:document-type-changed',()=>schedule(120));
  document.addEventListener('HUIDI:editor-view-change',()=>schedule(120));
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes?.length))schedule(80)}).observe(document.getElementById('piPaper')||document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));else setTimeout(boot,500);
})();
