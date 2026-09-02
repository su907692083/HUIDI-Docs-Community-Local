/* HUIDI Docs Community Local RC16.8 — unified document layout policy across all document types. */
(()=>{
  'use strict';
  const VERSION='1.2.0-RC16.8';
  if(window.HUIDILayoutPolicy?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const KEY='huidi_document_page_fit_v1';
  const LEGACY_KEY='flypigbox_quotation_pdf_density_v1';
  const LANDSCAPE_SPLIT_KEY='huidi_editor_split_landscape_rc1665';
  const PORTRAIT_SPLIT_KEY='huidi_editor_split_portrait_rc1665';
  const TYPES=new Set(['quotation','proforma_invoice','sales_contract','commercial_invoice','packing_list']);
  const TYPE_LABEL={quotation:'报价单',proforma_invoice:'形式发票',sales_contract:'销售合同',commercial_invoice:'商业发票',packing_list:'装箱单'};
  const STRONG_FIT_LIMIT={quotation:6,proforma_invoice:5,sales_contract:3,commercial_invoice:5,packing_list:7};
  let fitting=false,rerenderTimer=0,lastAnnounced='';
  const type=()=>{const v=$('#documentType')?.value||window.FlypigBOXApp?.getDocumentType?.()||'';return TYPES.has(v)?v:'quotation'};
  const paper=()=>$('#piPaper');
  const workbench=()=>$('.workbench');
  const store=(key,value)=>{try{localStorage.setItem(key,String(value))}catch(_){}};
  const saved=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
  function migrateLegacy(){if(saved(KEY))return;const legacy=saved(LEGACY_KEY);if(legacy==='one-page'||legacy==='standard')store(KEY,legacy);}
  function mode(){migrateLegacy();return saved(KEY)==='one-page'?'one-page':'standard'}
  const enabled=()=>mode()==='one-page';
  const itemCount=()=>{try{return window.FlypigBOXQuotationQuickFlow?.meaningfulRows?.().length||$$('.item-row').filter(row=>row.querySelector('.i-name')?.value?.trim()).length||0}catch(_){return 0}};
  const pageCount=()=>$$('#piPaper .pdf-page').length;
  function ensureControl(){
    const row=$('.preview-toolbar-primary'),layout=$('#paperLayoutCompact');if(!row)return null;
    let box=$('#huidiPageFitControl');
    if(!box){box=document.createElement('div');box.id='huidiPageFitControl';box.className='huidi-page-fit-control';box.setAttribute('aria-label','内容适配');box.innerHTML='<span>内容适配</span><div class="huidi-page-fit-segment" role="group" aria-label="内容分页方式"><button type="button" data-huidi-page-fit="standard">标准</button><button type="button" data-huidi-page-fit="one-page" title="少量内容会适度收紧间距并优先收在一页；内容较多时仍会安全分页">优先一页</button></div><small id="huidiPageFitStatus">标准分页</small>';if(layout)row.insertBefore(box,layout);else row.appendChild(box);box.addEventListener('click',event=>{const button=event.target.closest('[data-huidi-page-fit]');if(!button)return;setMode(button.dataset.huidiPageFit==='one-page'?'one-page':'standard',{announce:true,source:'toolbar'});});}
    box.hidden=false;box.removeAttribute('aria-hidden');return box;
  }
  function hideLegacyControl(){$$('[data-fp-qf-layout-toggle]').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});}
  function applyPolicyToPaper({resetLevel=false}={}){const p=paper();if(!p)return;const currentType=type(),on=enabled();p.classList.toggle('huidi-document-one-page',on);p.classList.toggle('fp-quotation-one-page',Boolean(on&&currentType==='quotation'));p.dataset.huidiPageFit=on?'one-page':'standard';p.dataset.huidiLayoutPolicyVersion=VERSION;p.dataset.huidiLayoutDocumentType=currentType;if(!on)p.dataset.huidiPageFitLevel='0';else if(resetLevel||!['1','2'].includes(p.dataset.huidiPageFitLevel||''))p.dataset.huidiPageFitLevel='1';document.body.dataset.huidiPageFit=on?'one-page':'standard';}
  function updateControl(){ensureControl();hideLegacyControl();applyPolicyToPaper();const on=enabled();$$('[data-huidi-page-fit]').forEach(btn=>btn.classList.toggle('active',btn.dataset.huidiPageFit===(on?'one-page':'standard')));const status=$('#huidiPageFitStatus'),currentType=type();if(status){if(!on)status.textContent='标准分页';else{const pages=pageCount();status.textContent=pages?`优先一页 · 当前 ${pages} 页`:'优先一页';}status.title=`${TYPE_LABEL[currentType]||'当前单据'} · ${status.textContent}`;}}
  function dispatchPolicy(source='sync'){const detail={mode:mode(),onePage:enabled(),documentType:type(),source,version:VERSION};document.dispatchEvent(new CustomEvent('HUIDI:layout-policy-changed',{detail}));}
  function setMode(next,{announce=false,source='api',render=true}={}){const normalized=next==='one-page'?'one-page':'standard';store(KEY,normalized);store(LEGACY_KEY,normalized);applyPolicyToPaper({resetLevel:true});try{window.FlypigBOXQuotationQuickFlow?.setOnePage?.(normalized==='one-page',{announce:false})}catch(_){}updateControl();dispatchPolicy(source);try{window.FlypigBOXTableOutput?.refresh?.({force:true})}catch(_){}if(render)try{window.FlypigBOXApp?.renderPreview?.()}catch(_){}if(announce){const msg=normalized==='one-page'?'已启用“优先一页”：所有单据预览、PDF 与表格会使用同一布局策略；内容较多时仍会安全分页。':'已恢复“标准”：所有单据预览、PDF 与表格已同步恢复标准布局。';if(msg!==lastAnnounced){lastAnnounced=msg;window.FlypigBOXApp?.setStatus?.(msg,'ok');}}return normalized;}
  function maybeStrengthenFit(){const p=paper();if(!p||!enabled()||fitting)return updateControl();const pages=pageCount(),currentType=type(),limit=STRONG_FIT_LIMIT[currentType]||4,count=itemCount();let level=Number(p.dataset.huidiPageFitLevel||1);if((pages>2||count>limit)&&level!==1){p.dataset.huidiPageFitLevel='1';level=1;}if(pages===2&&count<=limit&&level<2){fitting=true;p.dataset.huidiPageFitLevel='2';clearTimeout(rerenderTimer);rerenderTimer=setTimeout(()=>{try{window.FlypigBOXApp?.renderPreview?.()}finally{setTimeout(()=>{fitting=false;updateControl()},0)}},20);return;}fitting=false;updateControl();}
  function splitKey(){return document.body.classList.contains('paper-landscape-mode')?LANDSCAPE_SPLIT_KEY:PORTRAIT_SPLIT_KEY}
  function defaultSplit(){if(document.body.classList.contains('paper-landscape-mode'))return document.body.classList.contains('fp-live-table-mode')?40:39;return 46}
  function applyOrientationSplit({force=false}={}){const wb=workbench();if(!wb||innerWidth<=980)return;const key=splitKey(),remembered=Number(saved(key));const next=Number.isFinite(remembered)&&remembered>=34&&remembered<=70?remembered:defaultSplit();if(force||wb.style.getPropertyValue('--fp-left-pane-percent')!==`${next}%`)wb.style.setProperty('--fp-left-pane-percent',`${next}%`);requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
  function captureSplit(){const wb=workbench();if(!wb||innerWidth<=980)return;const value=parseFloat(wb.style.getPropertyValue('--fp-left-pane-percent'));if(Number.isFinite(value))store(splitKey(),Math.max(34,Math.min(70,value)))}
  function installSplitTracking(){document.addEventListener('pointerup',event=>{if(event.target.closest('.fp-workbench-resizer'))setTimeout(captureSplit,0)},true);document.addEventListener('keydown',event=>{if(event.target.closest('.fp-workbench-resizer')&&['ArrowLeft','ArrowRight'].includes(event.key))setTimeout(captureSplit,0)},true);document.addEventListener('dblclick',event=>{if(!event.target.closest('.fp-workbench-resizer'))return;setTimeout(()=>{const wb=workbench();if(!wb)return;const v=defaultSplit();wb.style.setProperty('--fp-left-pane-percent',`${v}%`);store(splitKey(),v);window.dispatchEvent(new Event('resize'))},0)},true);}
  function syncAll({source='sync',resetLevel=false}={}){ensureControl();hideLegacyControl();applyPolicyToPaper({resetLevel});applyOrientationSplit();updateControl();dispatchPolicy(source);}
  function boot(){migrateLegacy();ensureControl();hideLegacyControl();installSplitTracking();syncAll({source:'boot',resetLevel:true});document.addEventListener('HUIDI:preview-rendered',()=>{ensureControl();applyPolicyToPaper();applyOrientationSplit();maybeStrengthenFit()});['HUIDI:document-type-changed','HUIDI:document-type-change'].forEach(name=>document.addEventListener(name,()=>setTimeout(()=>syncAll({source:name,resetLevel:true}),30)));document.addEventListener('change',event=>{if(event.target?.id==='documentType')setTimeout(()=>syncAll({source:'documentType',resetLevel:true}),20);if(event.target?.id==='paperOrientation')setTimeout(()=>applyOrientationSplit({force:true}),40);},true);document.addEventListener('click',event=>{if(event.target.closest('[data-paper-choice]'))setTimeout(()=>applyOrientationSplit({force:true}),80)},true);window.addEventListener('storage',event=>{if([KEY,LEGACY_KEY].includes(event.key))syncAll({source:'storage',resetLevel:true})});window.addEventListener('resize',()=>{ensureControl();updateControl()},{passive:true});[250,900,1800].forEach(ms=>setTimeout(()=>syncAll({source:`boot-${ms}`}),ms));window.HUIDILayoutPolicy=Object.freeze({version:VERSION,getMode:mode,isOnePage:enabled,setMode,sync:syncAll,supportedTypes:[...TYPES]});window.HUIDIPageFitWorkspace=Object.freeze({version:VERSION,setOnePage:on=>setMode(on?'one-page':'standard',{source:'compat'}),sync:syncAll});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
