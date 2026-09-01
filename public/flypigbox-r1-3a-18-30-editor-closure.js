(()=>{
  'use strict';
  if(window.__FP30_EDITOR_CLOSURE__)return;window.__FP30_EDITOR_CLOSURE__=true;
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const storeKey='flypigbox_editor_advanced_tools_v18_30';
  function docType(){const el=qs('#documentType');const label=el?.selectedOptions?.[0]?.textContent||el?.value||'业务单据';return label.replace(/\s+/g,' ').trim()}
  function invoiceNo(){return qs('#invoiceNo')?.value?.trim()||'尚未编号'}
  function context(){
    const editor=qs('#editorTop');if(!editor)return;
    let bar=qs('#fp30EditorContext');if(!bar){bar=document.createElement('section');bar.id='fp30EditorContext';bar.className='fp30-editor-context';editor.before(bar);}
    bar.innerHTML=`<div><small>当前工作</small><b>${docType()} · ${invoiceNo()}</b><span>先填写和核对，再保存或导出；缺少普通字段时会提示但不强制阻断。</span></div><div class="fp30-editor-context-actions"><a href="./workspace.html?view=documents">返回单据中心</a><button type="button" data-fp30-focus-products>定位商品明细</button><button type="button" data-fp30-focus-preview>查看预览</button></div>`;
  }
  function moreMenu(){
    const actions=qs('.site-header .header-actions');if(!actions||qs('.fp30-editor-more',actions))return;
    const details=document.createElement('details');details.className='fp30-editor-more';details.innerHTML='<summary class="btn secondary">更多 <span aria-hidden="true">⌄</span></summary><div class="fp30-editor-more-menu"></div>';
    const menu=qs('.fp30-editor-more-menu',details);
    ['openHistoryBtn','headerTranslateBtn','membershipPlansBtn','memberSignOutBtn','clearDocumentBtn'].forEach(id=>{const el=qs('#'+id);if(el)menu.append(el)});
    const advanced=document.createElement('button');advanced.type='button';advanced.className='btn secondary';advanced.dataset.fp30ToggleAdvanced='1';menu.append(advanced);
    const maintenance=document.createElement('button');maintenance.type='button';maintenance.className='btn secondary';maintenance.dataset.fp30ToggleMaintenance='1';maintenance.textContent='维护设置';menu.append(maintenance);
    const exportBtn=qs('#headerExportPdfBtn');actions.insertBefore(details,exportBtn?.nextSibling||null);syncAdvancedLabels();
    document.addEventListener('click',event=>{if(!details.open)return;if(event.target.closest('.fp30-editor-more'))return;details.open=false},{capture:true});
  }
  function advancedEnabled(){try{return localStorage.getItem(storeKey)==='1'}catch(_){return false}}
  function syncAdvancedLabels(){
    document.body.classList.toggle('fp30-show-advanced',advancedEnabled());
    qs('[data-fp30-toggle-advanced]')?.replaceChildren(document.createTextNode(advancedEnabled()?'隐藏生产与外贸高级工具':'显示生产与外贸高级工具'));
  }
  function installResizer(){
    const workbench=qs('.workbench'),preview=qs('.preview-shell');if(!workbench||!preview||qs('.fp-workbench-resizer',workbench))return;
    const divider=document.createElement('div');divider.className='fp-workbench-resizer';divider.tabIndex=0;divider.title='拖动调整填写区和预览区宽度；双击恢复';divider.innerHTML='<span></span>';workbench.insertBefore(divider,preview);
    const key='flypigbox_editor_split_v18_30';let active=null;
    const apply=value=>{const p=Math.max(34,Math.min(70,Number(value)||46));workbench.style.setProperty('--fp-left-pane-percent',p+'%');return p};
    try{apply(localStorage.getItem(key)||46)}catch(_){apply(46)}
    divider.addEventListener('pointerdown',e=>{if(innerWidth<=980||e.button!==0)return;e.preventDefault();active=workbench.getBoundingClientRect();divider.setPointerCapture?.(e.pointerId);document.body.classList.add('fp-split-resizing')});
    divider.addEventListener('pointermove',e=>{if(!active)return;apply((e.clientX-active.left)/active.width*100)});
    const finish=e=>{if(!active)return;active=null;document.body.classList.remove('fp-split-resizing');const p=parseFloat(workbench.style.getPropertyValue('--fp-left-pane-percent'))||46;try{localStorage.setItem(key,String(p))}catch(_){};divider.releasePointerCapture?.(e.pointerId)};
    divider.addEventListener('pointerup',finish);divider.addEventListener('pointercancel',finish);
    divider.addEventListener('dblclick',()=>{apply(46);try{localStorage.removeItem(key)}catch(_){}});
    divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const p=parseFloat(workbench.style.getPropertyValue('--fp-left-pane-percent'))||46;const next=apply(p+(e.key==='ArrowRight'?2:-2));try{localStorage.setItem(key,String(next))}catch(_){}});
  }
  function labels(){const brand=qs('.site-header .brand small');if(brand)brand.textContent='外贸单据工作台';const eyebrow=qs('.intro .eyebrow');if(eyebrow)eyebrow.textContent='外贸单据编辑器';}
  function apply(){document.body.dataset.fpEditorClosure='18.30';labels();context();moreMenu();installResizer();syncAdvancedLabels();window.FlypigBOXUI30?.polish?.(document)}
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-fp30-focus-products]'))qs('#itemsCard,#items,#productItems,.items')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(event.target.closest('[data-fp30-focus-preview]'))qs('.preview-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(event.target.closest('[data-fp30-toggle-advanced]')){try{localStorage.setItem(storeKey,advancedEnabled()?'0':'1')}catch(_){};syncAdvancedLabels();}
    if(event.target.closest('[data-fp30-toggle-maintenance]'))document.body.classList.toggle('fp30-show-maintenance');
  });
  ['change','input'].forEach(type=>document.addEventListener(type,event=>{if(event.target.matches('#documentType,#invoiceNo'))context()}));
  document.addEventListener('HUIDI:editor-view-change',()=>setTimeout(apply,20));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();setTimeout(apply,700)},{once:true});else{apply();setTimeout(apply,700)}
})();
