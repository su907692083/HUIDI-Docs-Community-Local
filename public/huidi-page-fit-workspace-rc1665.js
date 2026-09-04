/* HUIDI Docs Community Local RC16.6.5 — page-fit and landscape workspace closure. */
(()=>{
  'use strict';
  const VERSION='1.2.0-RC16.6.5';
  if(window.HUIDIPageFitWorkspace?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const KEY='flypigbox_quotation_pdf_density_v1';
  const LANDSCAPE_SPLIT_KEY='huidi_editor_split_landscape_rc1665';
  const PORTRAIT_SPLIT_KEY='huidi_editor_split_portrait_rc1665';
  let fitting=false;
  let rerenderTimer=0;
  const type=()=>$('#documentType')?.value||window.FlypigBOXApp?.getDocumentType?.()||'';
  const paper=()=>$('#piPaper');
  const workbench=()=>$('.workbench');
  const enabled=()=>{try{return localStorage.getItem(KEY)==='one-page'}catch(_){return false}};
  const store=(key,value)=>{try{localStorage.setItem(key,String(value))}catch(_){}};
  const saved=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const itemCount=()=>{
    try{return window.FlypigBOXQuotationQuickFlow?.meaningfulRows?.().length||$$('.item-row').filter(row=>row.querySelector('.i-name')?.value?.trim()).length||0}catch(_){return 0}
  };
  function pageCount(){return $$('#piPaper .pdf-page').length}
  function ensureControl(){
    const row=$('.preview-toolbar-primary'), layout=$('#paperLayoutCompact');
    if(!row||$('#huidiPageFitControl'))return;
    const box=document.createElement('div');
    box.id='huidiPageFitControl';
    box.className='huidi-page-fit-control';
    box.setAttribute('aria-label','内容适配');
    box.innerHTML='<span>内容适配</span><div class="huidi-page-fit-segment" role="group" aria-label="内容分页方式"><button type="button" data-huidi-page-fit="standard">标准</button><button type="button" data-huidi-page-fit="one-page" title="少量报价会压缩间距并优先收在一页；内容较多时仍会安全分页">优先一页</button></div><small id="huidiPageFitStatus">标准分页</small>';
    if(layout)row.insertBefore(box,layout);else row.appendChild(box);
    box.addEventListener('click',event=>{
      const button=event.target.closest('[data-huidi-page-fit]');if(!button)return;
      setFit(button.dataset.huidiPageFit==='one-page',true);
    });
  }
  function hideLegacyControl(){
    $$('[data-fp-qf-layout-toggle]').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});
  }
  function updateControl(){
    ensureControl();hideLegacyControl();
    const quotation=type()==='quotation',on=quotation&&enabled();
    const box=$('#huidiPageFitControl');if(box)box.hidden=!quotation;
    $$('[data-huidi-page-fit]').forEach(btn=>btn.classList.toggle('active',btn.dataset.huidiPageFit===(on?'one-page':'standard')));
    const status=$('#huidiPageFitStatus');
    if(status){
      if(!quotation)status.textContent='';
      else if(!on)status.textContent='标准分页';
      else{const pages=pageCount();status.textContent=pages?`一页优先 · 当前 ${pages} 页`:'一页优先';}
    }
  }
  function setFit(on,announce=false){
    store(KEY,on?'one-page':'standard');
    const p=paper();
    if(p){
      p.classList.toggle('fp-quotation-one-page',Boolean(on&&type()==='quotation'));
      p.dataset.huidiPageFit=on?'one-page':'standard';
      p.dataset.huidiPageFitLevel=on?'1':'0';
    }
    try{window.FlypigBOXQuotationQuickFlow?.setOnePage?.(on,{announce:false})}catch(_){}
    updateControl();
    window.FlypigBOXApp?.renderPreview?.();
    if(announce)window.FlypigBOXApp?.setStatus?.(on?'已启用“优先一页”：少量报价会自动收紧版式；内容较多时仍会安全分页。':'已恢复标准分页。','ok');
  }
  function maybeStrengthenFit(){
    const p=paper();if(!p||type()!=='quotation'||!enabled()||fitting)return updateControl();
    const pages=pageCount();let level=Number(p.dataset.huidiPageFitLevel||1);
    // Only use the stronger density for a modest two-page quotation. Never keep
    // shrinking a genuinely long quotation just to force an unreadable one-page PDF.
    if(pages===2&&itemCount()<=6&&level<2){
      fitting=true;p.dataset.huidiPageFitLevel='2';
      clearTimeout(rerenderTimer);
      rerenderTimer=setTimeout(()=>{try{window.FlypigBOXApp?.renderPreview?.()}finally{setTimeout(()=>{fitting=false;updateControl()},0)}},20);
      return;
    }
    fitting=false;updateControl();
  }
  function splitKey(){return document.body.classList.contains('paper-landscape-mode')?LANDSCAPE_SPLIT_KEY:PORTRAIT_SPLIT_KEY}
  function defaultSplit(){
    if(document.body.classList.contains('paper-landscape-mode'))return document.body.classList.contains('fp-live-table-mode')?40:39;
    return 46;
  }
  function applyOrientationSplit({force=false}={}){
    const wb=workbench();if(!wb||innerWidth<=980)return;
    const key=splitKey(), remembered=Number(saved(key));
    const current=parseFloat(wb.style.getPropertyValue('--fp-left-pane-percent'));
    // On first use of each orientation use an orientation-aware default. Afterwards
    // preserve the user's own divider position independently for portrait/landscape.
    const next=Number.isFinite(remembered)&&remembered>=34&&remembered<=70?remembered:(force||!Number.isFinite(current)?defaultSplit():defaultSplit());
    wb.style.setProperty('--fp-left-pane-percent',`${next}%`);
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  function captureSplit(){
    const wb=workbench();if(!wb||innerWidth<=980)return;
    const value=parseFloat(wb.style.getPropertyValue('--fp-left-pane-percent'));
    if(Number.isFinite(value))store(splitKey(),Math.max(34,Math.min(70,value)));
  }
  function installSplitTracking(){
    document.addEventListener('pointerup',event=>{if(event.target.closest('.fp-workbench-resizer'))setTimeout(captureSplit,0)},true);
    document.addEventListener('keydown',event=>{if(event.target.closest('.fp-workbench-resizer')&&['ArrowLeft','ArrowRight'].includes(event.key))setTimeout(captureSplit,0)},true);
    document.addEventListener('dblclick',event=>{if(!event.target.closest('.fp-workbench-resizer'))return;setTimeout(()=>{const wb=workbench();if(!wb)return;const v=defaultSplit();wb.style.setProperty('--fp-left-pane-percent',`${v}%`);store(splitKey(),v);window.dispatchEvent(new Event('resize'))},0)},true);
  }
  function syncAll(){
    ensureControl();hideLegacyControl();
    const p=paper();if(p){
      const on=type()==='quotation'&&enabled();
      p.classList.toggle('fp-quotation-one-page',on);
      p.dataset.huidiPageFit=on?'one-page':'standard';
      if(on&&!p.dataset.huidiPageFitLevel)p.dataset.huidiPageFitLevel='1';
    }
    applyOrientationSplit();updateControl();
  }
  function boot(){
    ensureControl();hideLegacyControl();installSplitTracking();syncAll();
    document.addEventListener('HUIDI:preview-rendered',()=>{applyOrientationSplit();maybeStrengthenFit()});
    document.addEventListener('HUIDI:document-type-changed',()=>setTimeout(syncAll,30));
    document.addEventListener('change',event=>{
      if(event.target?.id==='documentType')setTimeout(syncAll,20);
      if(event.target?.id==='paperOrientation')setTimeout(()=>applyOrientationSplit({force:true}),40);
    },true);
    document.addEventListener('click',event=>{if(event.target.closest('[data-paper-choice]'))setTimeout(()=>applyOrientationSplit({force:true}),80)},true);
    window.addEventListener('resize',()=>{ensureControl();updateControl()},{passive:true});
    [250,900,1800].forEach(ms=>setTimeout(syncAll,ms));
    window.HUIDIPageFitWorkspace=Object.freeze({version:VERSION,setOnePage:setFit,sync:syncAll});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
