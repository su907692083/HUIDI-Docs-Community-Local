/* HUIDI V3.3.6.17 — persistent prepared-task handoff for document and catalog pages. */
(()=>{'use strict';
  const KEY='flypigbox_ai_task_request_v1';
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const read=()=>{for(const store of [localStorage,sessionStorage]){try{const value=JSON.parse(store.getItem(KEY)||'null');if(value)return value}catch(_){}}return null};
  const remove=()=>{try{localStorage.removeItem(KEY)}catch(_){}try{sessionStorage.removeItem(KEY)}catch(_){}};
  function route(){const p=location.pathname.toLowerCase();if(p.includes('catalog-studio'))return'catalog';if(p.endsWith('document-start.html'))return'document';return''}
  function language(code){return ({bilingual:'中英双语',zh:'中文',en:'English',es:'Español',pt:'Português (Brasil)',de:'Deutsch',fr:'Français',it:'Italiano',ru:'Русский',ar:'العربية',ja:'日本語',ko:'한국어',tr:'Türkçe',nl:'Nederlands',pl:'Polski',vi:'Tiếng Việt',id:'Bahasa Indonesia',th:'ไทย'})[code]||code||'待确认'}
  function boot(){
    const task=read(),r=route();if(!task||!r||task.kind!==r)return;const host=document.querySelector('main')||document.body;const box=document.createElement('section');box.className='fp-ai-task-handoff';
    const details=r==='document'?[task.customerName&&`客户：${task.customerName}`,task.dealTitle&&`业务：${task.dealTitle}`,task.brandName&&`品牌：${task.brandName}`,task.currency&&`币种：${task.currency}`,Number.isFinite(Number(task.selectedProductCount))&&`已选商品：${Number(task.selectedProductCount)} 个`,task.requestText&&`要求：${task.requestText}`].filter(Boolean).join('\n'):[task.customerName&&`客户：${task.customerName}`,task.brandName&&`品牌：${task.brandName}`,task.language&&`语言：${language(task.language)}`,task.priceMode&&`价格显示：${({show:'显示价格',hide:'隐藏价格',inquiry:'显示“询价”'})[task.priceMode]||task.priceMode}`,Array.isArray(task.selectedProductIds)&&`已选商品：${task.selectedProductIds.length} 个`,task.requestText&&`要求：${task.requestText}`].filter(Boolean).join('\n');
    const back=r==='catalog'?'../workspace.html?view=ai':'./workspace.html?view=ai';
    box.innerHTML=`<div><b>${r==='document'?'已带入单据准备任务':'已带入产品目录任务'}</b><span>${esc(details||'请继续核对当前页面资料。')}</span></div><div class="fp-ai-task-handoff-actions"><a href="${back}">返回修改</a><button type="button" data-fp-clear-task>清除任务</button><button type="button" data-fp-hide-task>关闭提示</button></div>`;
    host.prepend(box);
    box.querySelector('[data-fp-hide-task]')?.addEventListener('click',()=>box.remove());
    box.querySelector('[data-fp-clear-task]')?.addEventListener('click',()=>{if(!confirm('清除后只会删除当前浏览器中的任务提示，不会删除已经创建的客户、商品、业务或单据。确定清除吗？'))return;remove();box.remove();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
