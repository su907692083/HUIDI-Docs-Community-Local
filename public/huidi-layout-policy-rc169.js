/* HUIDI Docs Community Local RC16.9 — stable per-document layout policy.
   One pagination authority, per-document state, no post-pagination density rerender. */
(()=>{
  'use strict';
  const VERSION='1.2.0-RC16.9';
  if(window.HUIDILayoutPolicy?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const TYPES=['quotation','proforma_invoice','sales_contract','commercial_invoice','packing_list'];
  const TYPE_SET=new Set(TYPES);
  const TYPE_LABEL={quotation:'报价单',proforma_invoice:'形式发票',sales_contract:'销售合同',commercial_invoice:'商业发票',packing_list:'装箱单'};
  const KEY_PREFIX='huidi_document_page_fit_v2:';
  const LEGACY_GLOBAL='huidi_document_page_fit_v1';
  const LEGACY_QUOTATION='flypigbox_quotation_pdf_density_v1';
  const MIGRATION_KEY='huidi_document_page_fit_v2_migrated';
  const LANDSCAPE_SPLIT_KEY='huidi_editor_split_landscape_rc1665';
  const PORTRAIT_SPLIT_KEY='huidi_editor_split_portrait_rc1665';
  let renderTimer=0,lastAnnounced='';
  const store=(key,value)=>{try{localStorage.setItem(key,String(value))}catch(_){}};
  const saved=key=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const normalizeType=value=>TYPE_SET.has(value)?value:'quotation';
  const type=()=>normalizeType($('#documentType')?.value||window.FlypigBOXApp?.getDocumentType?.()||'quotation');
  const paper=()=>$('#piPaper');
  const workbench=()=>$('.workbench');
  const keyFor=t=>KEY_PREFIX+normalizeType(t);
  function migrate(){
    if(saved(MIGRATION_KEY)==='1')return;
    const quotationLegacy=saved(LEGACY_QUOTATION);
    const globalLegacy=saved(LEGACY_GLOBAL);
    if(!saved(keyFor('quotation'))){
      const q=quotationLegacy==='one-page'||quotationLegacy==='standard'?quotationLegacy:(globalLegacy==='one-page'?'one-page':'standard');
      store(keyFor('quotation'),q);
    }
    TYPES.filter(t=>t!=='quotation').forEach(t=>{if(!saved(keyFor(t)))store(keyFor(t),'standard')});
    store(MIGRATION_KEY,'1');
  }
  function getMode(documentType=type()){
    migrate();
    return saved(keyFor(documentType))==='one-page'?'one-page':'standard';
  }
  const isOnePage=(documentType=type())=>getMode(documentType)==='one-page';
  const pageCount=()=>$$('#piPaper .pdf-page').length;
  function ensureControl(){
    const row=$('.preview-toolbar-primary'),layout=$('#paperLayoutCompact');
    if(!row)return null;
    let box=$('#huidiPageFitControl');
    if(!box){
      box=document.createElement('div');box.id='huidiPageFitControl';box.className='huidi-page-fit-control';box.setAttribute('aria-label','内容适配');
      box.innerHTML='<span>内容适配</span><div class="huidi-page-fit-segment" role="group" aria-label="内容分页方式"><button type="button" data-huidi-page-fit="standard">标准</button><button type="button" data-huidi-page-fit="one-page" title="在当前单据内使用紧凑版式，优先减少页数；内容较多时继续安全分页">优先一页</button></div><small id="huidiPageFitStatus">标准分页</small>';
      if(layout)row.insertBefore(box,layout);else row.appendChild(box);
      box.addEventListener('click',event=>{const button=event.target.closest('[data-huidi-page-fit]');if(button)setMode(button.dataset.huidiPageFit,{announce:true,source:'toolbar'});});
    }
    box.hidden=false;box.removeAttribute('aria-hidden');return box;
  }
  function hideLegacyControl(){$$('[data-fp-qf-layout-toggle]').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});}
  function applyPolicyToPaper(documentType=type()){
    const p=paper();if(!p)return;
    const t=normalizeType(documentType),on=isOnePage(t);
    p.classList.toggle('huidi-document-one-page',on);
    // Compatibility class is visual only. The quotation helper no longer owns state or rendering.
    p.classList.toggle('fp-quotation-one-page',Boolean(on&&t==='quotation'));
    p.dataset.huidiPageFit=on?'one-page':'standard';
    p.dataset.huidiPageFitLevel=on?'1':'0';
    p.dataset.huidiLayoutPolicyVersion=VERSION;
    p.dataset.huidiLayoutDocumentType=t;
    document.body.dataset.huidiPageFit=on?'one-page':'standard';
    document.body.dataset.huidiStablePagination='1';
  }
  function updateControl(){
    ensureControl();hideLegacyControl();
    const t=type(),on=isOnePage(t);
    $$('[data-huidi-page-fit]').forEach(btn=>btn.classList.toggle('active',btn.dataset.huidiPageFit===(on?'one-page':'standard')));
    const status=$('#huidiPageFitStatus');
    if(status){const pages=pageCount();status.textContent=on?(pages?`优先一页 · 当前 ${pages} 页`:'优先一页'):'标准分页';status.title=`${TYPE_LABEL[t]} · ${status.textContent}`;}
  }
  function dispatchPolicy(source='sync',documentType=type()){
    const t=normalizeType(documentType);document.dispatchEvent(new CustomEvent('HUIDI:layout-policy-changed',{detail:{mode:getMode(t),onePage:isOnePage(t),documentType:t,source,version:VERSION}}));
  }
  function scheduleSingleRender(source='policy'){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderTimer=0;try{window.FlypigBOXApp?.renderPreview?.();}catch(error){console.warn('RC16.9 layout render failed',source,error)}},0);
  }
  function setMode(next,{documentType=type(),announce=false,source='api',render=true}={}){
    const t=normalizeType(documentType),normalized=next==='one-page'?'one-page':'standard';
    store(keyFor(t),normalized);
    if(t==='quotation')store(LEGACY_QUOTATION,normalized);
    applyPolicyToPaper(t);updateControl();dispatchPolicy(source,t);
    try{window.FlypigBOXTableOutput?.refresh?.({force:true})}catch(_){ }
    if(render&&t===type())scheduleSingleRender(source);
    if(announce){const msg=normalized==='one-page'?`已为${TYPE_LABEL[t]}启用“优先一页”；只收紧当前单据，不影响其他单据，内容较多时继续安全分页。`:`已为${TYPE_LABEL[t]}恢复“标准”分页。`;if(msg!==lastAnnounced){lastAnnounced=msg;window.FlypigBOXApp?.setStatus?.(msg,'ok')}}
    return normalized;
  }
  function prepareDocumentType(nextType,source='documentType-capture'){
    const t=normalizeType(nextType);applyPolicyToPaper(t);updateControl();dispatchPolicy(source,t);
  }
  function splitKey(){return document.body.classList.contains('paper-landscape-mode')?LANDSCAPE_SPLIT_KEY:PORTRAIT_SPLIT_KEY}
  function defaultSplit(){if(document.body.classList.contains('paper-landscape-mode'))return document.body.classList.contains('fp-live-table-mode')?40:39;return 46}
  function applyOrientationSplit({force=false}={}){
    const wb=workbench();if(!wb||innerWidth<=980)return;
    const remembered=Number(saved(splitKey()));const next=Number.isFinite(remembered)&&remembered>=34&&remembered<=70?remembered:defaultSplit();
    if(force||wb.style.getPropertyValue('--fp-left-pane-percent')!==`${next}%`)wb.style.setProperty('--fp-left-pane-percent',`${next}%`);
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  function captureSplit(){const wb=workbench();if(!wb||innerWidth<=980)return;const value=parseFloat(wb.style.getPropertyValue('--fp-left-pane-percent'));if(Number.isFinite(value))store(splitKey(),Math.max(34,Math.min(70,value)))}
  function installSplitTracking(){
    document.addEventListener('pointerup',event=>{if(event.target.closest('.fp-workbench-resizer'))setTimeout(captureSplit,0)},true);
    document.addEventListener('keydown',event=>{if(event.target.closest('.fp-workbench-resizer')&&['ArrowLeft','ArrowRight'].includes(event.key))setTimeout(captureSplit,0)},true);
    document.addEventListener('dblclick',event=>{if(!event.target.closest('.fp-workbench-resizer'))return;setTimeout(()=>{const wb=workbench();if(!wb)return;const v=defaultSplit();wb.style.setProperty('--fp-left-pane-percent',`${v}%`);store(splitKey(),v);window.dispatchEvent(new Event('resize'))},0)},true);
  }
  function sync({source='sync'}={}){migrate();ensureControl();hideLegacyControl();applyPolicyToPaper(type());applyOrientationSplit();updateControl();dispatchPolicy(source,type())}
  function boot(){
    migrate();ensureControl();hideLegacyControl();installSplitTracking();sync({source:'boot'});
    // Capture runs before the editor's bubble-phase document-type handler, so the
    // next document is paginated with its own mode on the very first render.
    document.addEventListener('change',event=>{
      if(event.target?.id==='documentType')prepareDocumentType(event.target.value,'documentType-capture');
      if(event.target?.id==='paperOrientation')setTimeout(()=>applyOrientationSplit({force:true}),30);
    },true);
    document.addEventListener('HUIDI:preview-rendered',()=>{applyPolicyToPaper(type());updateControl();});
    ['HUIDI:document-type-changed','HUIDI:document-type-change'].forEach(name=>document.addEventListener(name,event=>{const t=event.detail?.type||type();prepareDocumentType(t,name)}));
    document.addEventListener('click',event=>{if(event.target.closest('[data-paper-choice]'))setTimeout(()=>applyOrientationSplit({force:true}),60)},true);
    window.addEventListener('storage',event=>{if(event.key?.startsWith(KEY_PREFIX)||event.key===LEGACY_QUOTATION)sync({source:'storage'})});
    window.addEventListener('resize',updateControl,{passive:true});
    [250,900].forEach(ms=>setTimeout(()=>sync({source:`boot-${ms}`}),ms));
    window.HUIDILayoutPolicy=Object.freeze({version:VERSION,getMode,isOnePage,setMode,sync,prepareDocumentType,supportedTypes:[...TYPES]});
    window.HUIDIPageFitWorkspace=Object.freeze({version:VERSION,setOnePage:on=>setMode(on?'one-page':'standard',{documentType:'quotation',source:'compat'}),sync});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
