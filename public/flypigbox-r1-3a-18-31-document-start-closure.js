(()=>{
  'use strict';
  if(window.__FP31_DOC_START_CLOSURE__)return;
  window.__FP31_DOC_START_CLOSURE__=true;
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  function updateProductState(){
    const selected=qsa('#product-picker .product.selected').length;
    const count=qs('#selected-products-count');if(count)count.textContent=`已选择 ${selected} 项`;
    const clear=qs('#clear-products');if(clear){clear.disabled=selected===0;clear.setAttribute('aria-disabled',selected===0?'true':'false');}
  }
  function improveJourney(){
    const bar=qs('#fp-xm-doc-start');if(!bar)return;
    const link=qs(':scope > a',bar);if(link)link.textContent='返回单据中心';
    const steps=qsa('.fp-xm-page-steps span',bar);
    steps.forEach((step,index)=>{step.dataset.step=String(index+1);});
  }
  function apply(){
    document.body.dataset.fpDocStartClosure='18.31';
    const back=qs('.doc-start-back');if(back){back.textContent='工作台首页';back.setAttribute('aria-label','返回工作台首页');}
    const status=qs('.doc-start-status');if(status)status.textContent='先选择常用资料，也可以直接进入空白单据';
    const typeCard=qs('.doc-start-more-settings');if(typeCard&&!typeCard.hasAttribute('open'))typeCard.setAttribute('open','');
    improveJourney();updateProductState();
    window.FlypigBOXUI30?.polish?.(document);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-product],#clear-products'))setTimeout(updateProductState,20);
  },true);
  document.addEventListener('change',event=>{
    if(event.target.matches('#customer-select,#brand-select,#doc-language,#currency'))setTimeout(improveJourney,20);
  });
  const observer=new MutationObserver(records=>{
    if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&((n.id==='fp-xm-doc-start')||n.querySelector?.('#fp-xm-doc-start')))))improveJourney();
  });
  function start(){apply();observer.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
