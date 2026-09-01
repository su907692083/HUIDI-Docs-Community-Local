/* HUIDI R1.3A.18.27 release closure.
   Scoped output-risk patch. It deliberately avoids observing class/hidden
   changes across the whole document, which caused the 18.26 workspace freeze. */
(()=>{
  'use strict';
  const VERSION='R1.3A.18.27';
  let scheduled=false;
  function allowRiskConfirmedOutput(root=document){
    const dialog=(root?.id==='fp-a18-formal-dialog'?root:root?.querySelector?.('#fp-a18-formal-dialog'))||document.getElementById('fp-a18-formal-dialog');
    if(!dialog)return false;
    const button=dialog.querySelector('[data-a18-continue]');
    const title=dialog.querySelector('[data-a18-title]');
    const summary=dialog.querySelector('[data-a18-summary] b');
    if(button&&button.hidden){
      button.hidden=false;
      button.textContent='已了解风险，仍然继续';
      button.classList.add('fp-risk-confirm-continue');
    }
    if(title&&/暂不能生成/.test(title.textContent))title.textContent=title.textContent.replace('暂不能生成','存在缺失项，可确认继续');
    if(summary&&/必须补充/.test(summary.textContent))summary.textContent=summary.textContent.replace(/还有\s*(\d+)\s*项必须补充/,'有 $1 项需要关注，不影响用户确认导出');
    return true;
  }
  function schedule(root=document){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;allowRiskConfirmedOutput(root)});
  }
  function boot(){
    allowRiskConfirmedOutput();
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('[data-action],[data-a18-output],[data-a18-continue]');
      if(target)setTimeout(()=>schedule(),0);
    },true);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType!==1)continue;
          if(node.id==='fp-a18-formal-dialog'||node.querySelector?.('#fp-a18-formal-dialog')){schedule(node);return;}
        }
      }
    });
    observer.observe(document.body,{subtree:true,childList:true});
    document.body.dataset.fpRelease='v3.3.6.24-r1.3a.18.27-notification-stability-user-robot-config-candidate';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.FlypigBOXReleaseClosure=Object.freeze({version:VERSION,allowRiskConfirmedOutput});
})();
