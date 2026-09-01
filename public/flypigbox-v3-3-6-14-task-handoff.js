/* HUIDI V3.3.6.14 — show prepared task context on document and catalog pages. */
(()=>{'use strict';
  const KEY='flypigbox_ai_task_request_v1';
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  function read(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
  function route(){const p=location.pathname.toLowerCase();if(p.includes('catalog-studio'))return'catalog';if(p.endsWith('document-start.html'))return'document';return''}
  function boot(){const task=read(),r=route();if(!task||!r||task.kind!==r)return;const host=document.querySelector('main')||document.body;const box=document.createElement('section');box.className='fp-ai-task-handoff';
    const details=r==='document'?[task.customerName&&`客户：${task.customerName}`,task.dealTitle&&`业务：${task.dealTitle}`,task.requestText&&`要求：${task.requestText}`].filter(Boolean).join('\n'):[task.customerName&&`客户：${task.customerName}`,task.language&&`语言：${task.language}`,task.priceMode&&`价格显示：${task.priceMode}`,Array.isArray(task.selectedProductIds)&&`已选商品：${task.selectedProductIds.length} 个`,task.requestText&&`要求：${task.requestText}`].filter(Boolean).join('\n');
    box.innerHTML=`<div><b>${r==='document'?'已带入单据准备任务':'已带入产品目录任务'}</b><span>${esc(details||'请继续核对当前页面资料。')}</span></div><button type="button" aria-label="关闭提示">关闭</button>`;
    host.prepend(box);box.querySelector('button').addEventListener('click',()=>box.remove());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
