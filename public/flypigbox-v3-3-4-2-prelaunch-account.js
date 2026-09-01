/* HUIDI V3.3.4.2 — hide unreleased plan pricing and rights without changing backend rules. */
(()=>{
  'use strict';
  const VERSION='V3.3.4.2';
  function apply(){
    document.querySelectorAll('[data-account-action="plan"]').forEach(button=>button.textContent='账号状态');
    document.querySelectorAll('[data-action="membership-center"]').forEach(button=>button.textContent='账号状态');
    document.querySelectorAll('[data-support-tab="payment"]').forEach(button=>button.removeAttribute('data-support-tab'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();setTimeout(apply,350);setTimeout(apply,1200);},{once:true});else{apply();setTimeout(apply,350);setTimeout(apply,1200);}
})();
