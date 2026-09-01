/* HUIDI V3.3.5.2 auth/support safety helpers. */
(()=>{'use strict';
  const dialog=document.getElementById('auth-dialog');
  const qr=dialog?.querySelector('.trial-qr-card img');
  if(!dialog||!qr)return;
  const card=qr.closest('.trial-qr-card');
  qr.addEventListener('error',()=>{
    card?.classList.add('is-unavailable');
    qr.hidden=true;
    const note=document.createElement('p');
    note.className='trial-qr-error';
    note.textContent='客服二维码暂未加载，请稍后刷新或在工作台联系官方支持。';
    card?.prepend(note);
  },{once:true});
})();
