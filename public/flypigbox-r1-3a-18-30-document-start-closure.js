(()=>{
  'use strict';if(window.__FP30_DOC_START_CLOSURE__)return;window.__FP30_DOC_START_CLOSURE__=true;
  const qs=(s,r=document)=>r.querySelector(s);
  function apply(){
    document.body.dataset.fpDocStartClosure='18.30';
    const card=qs('.doc-start-more-settings');const head=qs('.head',card);
    if(card&&head&&!qs('.fp30-doc-more-toggle',head)){
      const btn=document.createElement('button');btn.type='button';btn.className='fp30-doc-more-toggle';btn.textContent='收起类型设置';head.append(btn);
      btn.addEventListener('click',()=>{const c=card.classList.toggle('fp30-collapsed');btn.textContent=c?'展开类型设置':'收起类型设置'});
    }
    const back=qs('.doc-start-back');if(back)back.textContent='返回工作台';
    window.FlypigBOXUI30?.polish?.(document);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
