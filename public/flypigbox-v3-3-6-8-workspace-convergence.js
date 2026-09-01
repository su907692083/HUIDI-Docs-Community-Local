/* HUIDI V3.3.6.8 — workspace layout and interaction convergence */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function reorderDashboard(){
    const dashboard=$('#dashboard');
    const home=$('#workspace-home-v1');
    const metrics=$('#dashboard .metric-grid');
    const work=$('#dashboard .dashboard-grid');
    if(!dashboard||!home||!metrics||!work)return;
    if(home.previousElementSibling!==work || work.previousElementSibling!==metrics){
      dashboard.insertBefore(metrics,home);
      dashboard.insertBefore(work,home);
    }
  }

  function installMetricNavigation(){
    const map=[
      ['metric-deals','deals'],['metric-followups','deals'],['metric-payments','deals'],['metric-shipments','deals'],
      ['overview-customers','customers'],['overview-products','products'],['overview-inquiries','deals'],['overview-documents','documents'],['overview-incomplete-products','products']
    ];
    map.forEach(([id,view])=>{
      const value=$(`#${id}`); const card=value?.closest('article');
      if(!card||card.dataset.fpConvergedClick)return;
      card.dataset.fpConvergedClick='1'; card.tabIndex=0; card.setAttribute('role','button');
      const open=()=>document.querySelector(`#nav [data-view="${view}"]`)?.click();
      card.addEventListener('click',open);
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    });
  }

  function installBrandRelationshipNote(){
    const view=$('#brands');
    const filter=$('.filter-bar',view);
    if(!view||!filter||$('.fp-brand-relationship-note',view))return;
    const note=document.createElement('div');
    note.className='fp-brand-relationship-note';
    note.innerHTML='<b>品牌资料建议作为统一来源。</b> 公司名称、Logo 和默认品牌色在这里维护；进入 PDF 样式或产品目录时，请确认是否继承当前品牌，临时样式只影响当前制作。';
    view.insertBefore(note,filter);
  }

  function dedupeTopbarActions(){
    const root=$('.topbar-actions'); if(!root)return;
    const seen=new Set();
    [...root.children].forEach(node=>{
      const key=[node.getAttribute('data-action')||'',node.getAttribute('data-view')||'',node.getAttribute('href')||'',(node.textContent||'').trim()].join('|');
      if(seen.has(key))node.remove(); else seen.add(key);
    });
  }

  function classifyDetail(){
    const content=$('#detail-content'); if(!content)return;
    content.classList.remove('fp-deal-detail-v3368','fp-customer-detail-v3368');
    const label=content.querySelector('header p')?.textContent?.trim()||'';
    if(label.includes('业务记录'))content.classList.add('fp-deal-detail-v3368');
    if(label.includes('客户档案')){
      content.classList.add('fp-customer-detail-v3368');
      const grid=$('.detail-grid',content);
      if(grid){
        const hasDeal=[...grid.querySelectorAll('.timeline-item')].some(item=>item.querySelector('[data-open-deal]'));
        grid.classList.toggle('customer-no-deals-v3368',!hasDeal);
      }
    }
  }

  function normalizeRecordDialog(){
    const form=$('#record-form'); if(!form)return;
    const title=$('#record-title')?.textContent||'';
    form.dataset.fpRecordKind=title.includes('商品')?'product':title.includes('品牌')?'brand':title.includes('客户')?'customer':title.includes('业务')||title.includes('询盘')?'deal':'other';
  }

  function normalizeNames(){
    const names={catalog:'产品目录',mail:'邮件草稿',ai:'智能录入'};
    Object.entries(names).forEach(([view,label])=>{
      const button=$(`#nav [data-view="${view}"]`); if(!button)return;
      const em=button.querySelector('em'); const wanted=label+(em?' ':''); const first=button.childNodes[0]; if(first&&first.nodeValue!==wanted) first.nodeValue=wanted;
    });
  }

  function compactHelpButton(){
    $$('.fp-current-guide-button').forEach(btn=>{btn.title='查看当前模块说明';btn.setAttribute('aria-label','查看当前模块说明');});
  }

  function apply(){
    document.body.classList.add('fp-v3368-workspace');
    reorderDashboard(); installMetricNavigation(); installBrandRelationshipNote(); dedupeTopbarActions(); classifyDetail(); normalizeRecordDialog(); normalizeNames(); compactHelpButton();
  }

  const observer=new MutationObserver(()=>queueMicrotask(apply));
  const start=()=>{apply();observer.observe(document.body,{subtree:true,childList:true,characterData:true});};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
