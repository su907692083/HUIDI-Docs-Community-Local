/* HUIDI Docs Community Local RC16.10 — compact / standard document density policy.
   Compact changes content density only. It never means "force one page". */
(()=>{
  'use strict';
  const VERSION='1.2.0-RC16.10';
  if(window.HUIDILayoutPolicy?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const TYPES=['quotation','proforma_invoice','sales_contract','commercial_invoice','packing_list'];
  const TYPE_SET=new Set(TYPES);
  const TYPE_LABEL={quotation:'报价单',proforma_invoice:'形式发票',sales_contract:'销售合同',commercial_invoice:'商业发票',packing_list:'装箱单'};
  const KEY_PREFIX='huidi_document_density_v1:';
  const LEGACY_PREFIX='huidi_document_page_fit_v2:';
  const LEGACY_GLOBAL='huidi_document_page_fit_v1';
  const LEGACY_QUOTATION='flypigbox_quotation_pdf_density_v1';
  const MIGRATION_KEY='huidi_document_density_v1_migrated';
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
  const legacyKeyFor=t=>LEGACY_PREFIX+normalizeType(t);
  const normalizeMode=value=>value==='compact'||value==='one-page'?'compact':'standard';
  function migrate(){
    if(saved(MIGRATION_KEY)==='1')return;
    TYPES.forEach(t=>{
      if(saved(keyFor(t)))return;
      let legacy=saved(legacyKeyFor(t));
      if(!legacy&&t==='quotation')legacy=saved(LEGACY_QUOTATION)||saved(LEGACY_GLOBAL);
      store(keyFor(t),normalizeMode(legacy));
    });
    store(MIGRATION_KEY,'1');
  }
  function getMode(documentType=type()){
    migrate();
    return normalizeMode(saved(keyFor(documentType)));
  }
  const isCompact=(documentType=type())=>getMode(documentType)==='compact';
  function ensureControl(){
    const row=$('.preview-toolbar-primary'),layout=$('#paperLayoutCompact');
    if(!row)return null;
    let box=$('#huidiPageFitControl');
    if(!box){
      box=document.createElement('div');
      box.id='huidiPageFitControl';
      box.className='huidi-density-control';
      box.setAttribute('aria-label','排版密度');
      box.innerHTML='<div class="huidi-density-segment" role="group" aria-label="排版密度"><button type="button" data-huidi-density="compact" title="减少非必要留白并提高空间利用；内容较多时正常安全分页">紧凑</button><button type="button" data-huidi-density="standard">标准</button></div>';
      if(layout)row.insertBefore(box,layout);else row.appendChild(box);
      box.addEventListener('click',event=>{const button=event.target.closest('[data-huidi-density]');if(button)setMode(button.dataset.huidiDensity,{announce:true,source:'toolbar'});});
    }
    box.hidden=false;box.removeAttribute('aria-hidden');return box;
  }
  function hideLegacyControl(){
    $$('[data-fp-qf-layout-toggle],[data-fp-qf-layout]').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});
    // RC16.10 surface must expose only the two density choices.
    $$('.huidi-page-fit-control').forEach(el=>{if(el.id!=='huidiPageFitControl'){el.hidden=true;el.setAttribute('aria-hidden','true')}});
  }
  function applyPolicyToPaper(documentType=type()){
    const p=paper();if(!p)return;
    const t=normalizeType(documentType),compact=isCompact(t);
    p.classList.toggle('huidi-document-compact',compact);
    p.classList.remove('huidi-document-one-page');
    p.classList.remove('fp-quotation-one-page');
    p.dataset.huidiDensity=compact?'compact':'standard';
    // Compatibility marker remains standard so no legacy "force one-page" code can activate.
    p.dataset.huidiPageFit='standard';
    p.dataset.huidiPageFitLevel='0';
    p.dataset.huidiLayoutPolicyVersion=VERSION;
    p.dataset.huidiLayoutDocumentType=t;
    document.body.dataset.huidiDensity=compact?'compact':'standard';
    document.body.dataset.huidiPageFit='standard';
    document.body.dataset.huidiStablePagination='1';
  }
  function updateControl(){
    ensureControl();hideLegacyControl();
    const mode=getMode(type());
    $$('[data-huidi-density]').forEach(btn=>btn.classList.toggle('active',btn.dataset.huidiDensity===mode));
  }
  function dispatchPolicy(source='sync',documentType=type()){
    const t=normalizeType(documentType),mode=getMode(t);
    document.dispatchEvent(new CustomEvent('HUIDI:layout-policy-changed',{detail:{mode,compact:mode==='compact',onePage:false,documentType:t,source,version:VERSION}}));
  }
  function scheduleSingleRender(source='policy'){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderTimer=0;try{window.FlypigBOXApp?.renderPreview?.();}catch(error){console.warn('RC16.10 density render failed',source,error)}},0);
  }
  function setMode(next,{documentType=type(),announce=false,source='api',render=true}={}){
    const t=normalizeType(documentType),normalized=normalizeMode(next);
    store(keyFor(t),normalized);
    applyPolicyToPaper(t);updateControl();dispatchPolicy(source,t);
    try{window.FlypigBOXTableOutput?.refresh?.({force:true})}catch(_){ }
    if(render&&t===type())scheduleSingleRender(source);
    if(announce){
      const msg=normalized==='compact'?`已为${TYPE_LABEL[t]}切换为“紧凑”排版。`:`已为${TYPE_LABEL[t]}切换为“标准”排版。`;
      if(msg!==lastAnnounced){lastAnnounced=msg;window.FlypigBOXApp?.setStatus?.(msg,'ok')}
    }
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
    document.addEventListener('change',event=>{
      if(event.target?.id==='documentType')prepareDocumentType(event.target.value,'documentType-capture');
      if(event.target?.id==='paperOrientation')setTimeout(()=>applyOrientationSplit({force:true}),30);
    },true);
    document.addEventListener('HUIDI:preview-rendered',()=>{applyPolicyToPaper(type());updateControl();});
    ['HUIDI:document-type-changed','HUIDI:document-type-change'].forEach(name=>document.addEventListener(name,event=>{const t=event.detail?.type||type();prepareDocumentType(t,name)}));
    document.addEventListener('click',event=>{if(event.target.closest('[data-paper-choice]'))setTimeout(()=>applyOrientationSplit({force:true}),60)},true);
    window.addEventListener('storage',event=>{if(event.key?.startsWith(KEY_PREFIX)||event.key?.startsWith(LEGACY_PREFIX)||event.key===LEGACY_QUOTATION)sync({source:'storage'})});
    requestAnimationFrame(()=>requestAnimationFrame(()=>sync({source:'boot-settled'})));
    window.HUIDILayoutPolicy=Object.freeze({version:VERSION,getMode,isCompact,isOnePage:()=>false,setMode,sync,prepareDocumentType,supportedTypes:[...TYPES]});
    // Legacy helper stays callable but maps to compact/standard, never to force-one-page behavior.
    window.HUIDIPageFitWorkspace=Object.freeze({version:VERSION,setOnePage:on=>setMode(on?'compact':'standard',{documentType:'quotation',source:'compat'}),sync});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
