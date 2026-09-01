/* HUIDI R1.3A.18.26 release closure.
   Keeps user-controlled export available when only business fields are missing. */
(()=>{
  'use strict';
  const VERSION='R1.3A.18.26';
  function allowRiskConfirmedOutput(){
    const dialog=document.getElementById('fp-a18-formal-dialog');
    if(!dialog)return;
    const button=dialog.querySelector('[data-a18-continue]');
    const title=dialog.querySelector('[data-a18-title]');
    const summary=dialog.querySelector('[data-a18-summary] b');
    if(button&&button.hidden){
      button.hidden=false;
      button.textContent='已了解风险，仍然继续';
      button.classList.add('fp-risk-confirm-continue');
      if(title&&/暂不能生成/.test(title.textContent)){
        title.textContent=title.textContent.replace('暂不能生成','存在缺失项，可确认继续');
      }
      if(summary&&/必须补充/.test(summary.textContent)){
        summary.textContent=summary.textContent.replace(/还有\s*(\d+)\s*项必须补充/,'有 $1 项需要关注，不影响用户确认导出');
      }
    }
  }
  function boot(){
    allowRiskConfirmedOutput();
    const observer=new MutationObserver(allowRiskConfirmedOutput);
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});
    document.body.dataset.fpRelease='v3.3.6.24-r1.3a.18.26-native-notification-integration-candidate';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.FlypigBOXReleaseClosure=Object.freeze({version:VERSION,allowRiskConfirmedOutput});
})();
