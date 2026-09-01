/* HUIDI V3.3.6.24-R1.3A.18 — one formal validation gate for PDF, Excel, CSV and print. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.23.3-OUTPUT-GATE.3';
  let bypassElement=null,bypassUntil=0;
  const $=(selector,root=document)=>root.querySelector(selector);
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const outputInfo=element=>{
    if(element?.id==='exportPdfBtn')return{kind:'pdf',label:'正式 PDF'};
    const mode=element?.dataset?.sheetExport;
    if(mode==='customer-xlsx')return{kind:'customer-xlsx',label:'客户版 Excel'};
    if(mode==='data-xlsx')return{kind:'data-xlsx',label:'数据版 Excel'};
    if(mode==='csv')return{kind:'csv',label:'商品明细 CSV'};
    if(element?.matches?.('[data-fp-print],[data-action="print-document"],#printDocumentBtn,#printPdfBtn'))return{kind:'print',label:'打印'};
    return null;
  };
  const payload=()=>{try{return window.FlypigBOXApp?.formState?.(false)||{fields:{},items:[]};}catch(_){return{fields:{},items:[]};}};
  const typeOf=data=>data?.fields?.documentType||$('#documentType')?.value||'proforma_invoice';
  function stableValue(value){
    if(Array.isArray(value))return value.map(stableValue);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(key=>!/^workspace/i.test(key)&&!['savedAt','updatedAt','version'].includes(key)).sort().map(key=>[key,stableValue(value[key])]));
    return value;
  }
  function fingerprint(data){
    const text=JSON.stringify(stableValue({fields:data?.fields||{},items:Array.isArray(data?.items)?data.items:[]}));let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return`fp_${(hash>>>0).toString(16).padStart(8,'0')}_${text.length}`;
  }
  function ensureMetaFields(){
    const form=$('#piForm');if(!form)return;
    ['workspaceLastFormalStatus','workspaceLastFormalCheckedAt','workspaceLastFormalFingerprint','workspaceLastFormalOutput','workspaceLastFormalRulePackVersion','workspaceLastFormalBlockers','workspaceLastFormalWarnings'].forEach(id=>{if($('#'+id))return;const input=document.createElement('input');input.type='hidden';input.id=id;form.appendChild(input);});
  }
  function setMeta(id,value){ensureMetaFields();const input=$('#'+id);if(input)input.value=String(value??'');}
  function clearStaleFormal(){
    const stored=$('#workspaceLastFormalFingerprint')?.value;if(!stored)return;const data=payload();
    if(stored!==fingerprint(data)){setMeta('workspaceLastFormalStatus','');setMeta('workspaceLastFormalCheckedAt','');setMeta('workspaceLastFormalFingerprint','');setMeta('workspaceLastFormalOutput','');setMeta('workspaceLastFormalRulePackVersion','');setMeta('workspaceLastFormalBlockers','');setMeta('workspaceLastFormalWarnings','');}
  }
  function ensureDialog(){
    let dialog=$('#fp-a18-formal-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='fp-a18-formal-dialog';dialog.className='fp-a18-formal-dialog';
    dialog.innerHTML='<section class="fp-a18-formal-card"><header><div><p>正式输出检查</p><h2 data-a18-title>请先核对单据</h2><span data-a18-subtitle></span></div><button type="button" data-a18-close aria-label="关闭">×</button></header><div data-a18-summary></div><div data-a18-issues></div><footer><button type="button" data-a18-clean-empty hidden>清理空白商品行</button><button type="button" data-a18-cancel>返回补充</button><button type="button" class="primary" data-a18-continue hidden>确认并继续</button></footer></section>';
    dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-a18-close],[data-a18-cancel]')){dialog.close();return;}const issueButton=event.target.closest('[data-a18-issue-path]');if(issueButton){dialog.close();focusIssue(issueButton.dataset.a18IssuePath);return;}if(event.target.closest('[data-a18-clean-empty]')){window.FlypigBOXEmptyItemGuard?.cleanup?.({announce:true,render:true});dialog.close();setTimeout(()=>document.getElementById('exportPdfBtn')?.focus(),120);}});
    document.body.appendChild(dialog);return dialog;
  }
  function focusIssue(path){
    if(window.FlypigBOXEmptyItemGuard?.focusPath?.(path))return true;
    const value=String(path||'').trim();let target=null;
    const field=value.match(/^fields\.([A-Za-z0-9_-]+)$/),item=value.match(/^items\.(\d+)\.([A-Za-z0-9_-]+)$/);
    if(field)target=document.getElementById(field[1]);
    if(item){const row=[...document.querySelectorAll('.item-row')][Number(item[1])];const map={name:'.i-name',sku:'.i-sku',spec:'.i-spec',qty:'.i-qty',unit:'.i-unit',price:'.i-price',hs:'.i-hs',netWeight:'.i-net-weight',grossWeight:'.i-gross-weight',cbm:'.i-cbm'};target=row?.querySelector(map[item[2]]||'.i-name')||row;}
    if(!target&&value==='items')target=document.getElementById('itemList');
    if(!target)return false;target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.focus?.({preventScroll:true}),240);return true;
  }
  function issueHtml(row,index){
    const label=row.severity==='blocker'?'必须处理':'建议核对';
    const path=escapeHTML(row.path||'');
    return`<article class="fp-a18-formal-issue ${row.severity==='blocker'?'blocker':'warning'}"><span>${index+1}</span><div><b>${label}</b><p>${escapeHTML(row.message||'请核对当前内容。')}</p>${path?`<button type="button" data-a18-issue-path="${path}">去补充</button>`:''}</div></article>`;
  }
  function show(result,info,element){
    const dialog=ensureDialog();
    $('[data-a18-title]',dialog).textContent=result.blockers.length?`${info.label}暂不能生成`:`${info.label}可以继续生成`;
    $('[data-a18-subtitle]',dialog).textContent=`${result.documentLabel} · 规则 ${result.rulePackVersion}`;
    const total=result.blockers.length+result.warnings.length;
    $('[data-a18-summary]',dialog).innerHTML=`<div class="fp-a18-formal-summary ${result.blockers.length?'error':result.warnings.length?'warn':'ok'}"><b>${result.blockers.length?`还有 ${result.blockers.length} 项必须补充`:result.warnings.length?`关键内容完整，还有 ${result.warnings.length} 项建议核对`:'正式输出检查通过'}</b><span>${total?`本次共检查到 ${total} 项需要关注。`:'当前没有发现阻断项或警告项。'}</span></div>`;
    const rows=[...result.blockers,...result.warnings];
    $('[data-a18-issues]',dialog).innerHTML=rows.length?`<div class="fp-a18-formal-list">${rows.map(issueHtml).join('')}</div>`:'<div class="fp-a18-formal-empty">单据关键字段、商品明细和输出规则已通过检查。</div>';
    const cleanupButton=$('[data-a18-clean-empty]',dialog);const blankCount=window.FlypigBOXEmptyItemGuard?.removableBlankCount?.()||0;if(cleanupButton){cleanupButton.hidden=blankCount===0;cleanupButton.textContent=blankCount?`清理 ${blankCount} 条空白商品行`:'清理空白商品行';}
    const continueButton=$('[data-a18-continue]',dialog);continueButton.hidden=Boolean(result.blockers.length);
    continueButton.onclick=()=>{
      bypassElement=element;bypassUntil=Date.now()+1500;dialog.close();
      setTimeout(()=>element?.click?.(),20);
    };
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function recordPass(result,kind){
    const data=payload(),stamp=result.checkedAt||new Date().toISOString(),mark=fingerprint(data);
    const approved={...result,output:kind,checkedAt:stamp,fingerprint:mark};
    try{sessionStorage.setItem('flypigbox_last_formal_validation',JSON.stringify(approved));}catch(_){}
    setMeta('workspaceLastFormalStatus',result.status||'formal_ready');setMeta('workspaceLastFormalCheckedAt',stamp);setMeta('workspaceLastFormalFingerprint',mark);setMeta('workspaceLastFormalOutput',kind);setMeta('workspaceLastFormalRulePackVersion',result.rulePackVersion||'');setMeta('workspaceLastFormalBlockers',(result.blockers||[]).length);setMeta('workspaceLastFormalWarnings',(result.warnings||[]).length);
    document.dispatchEvent(new CustomEvent('HUIDI:formal-output-approved',{detail:approved}));
  }
  function intercept(event){
    const element=event.target.closest('#exportPdfBtn,[data-sheet-export],[data-fp-print],[data-action="print-document"],#printDocumentBtn,#printPdfBtn');
    const info=outputInfo(element);if(!element||!info)return;
    const sharedPdfState=window.FlypigBOXPdfExportState;
    if(info.kind==='pdf'&&sharedPdfState?.unifiedPreflight===true&&sharedPdfState?.unifiedPreflightReady===true){
      if(sharedPdfState.allowCurrentPdfExport===true){
        const approvedResult=window.FlypigBOXRulePacks?.validate?.(payload(),typeOf(payload()),{formal:true,output:info.kind});
        if(approvedResult)recordPass(approvedResult,info.kind);
      }
      return;
    }
    if(element===bypassElement&&Date.now()<bypassUntil){bypassElement=null;recordPass(window.FlypigBOXRulePacks?.validate?.(payload(),typeOf(payload()),{formal:true,output:info.kind})||{},info.kind);return;}
    const data=payload(),type=typeOf(data);const result=window.FlypigBOXRulePacks?.validate?.(data,type,{formal:true,output:info.kind});
    if(!result)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(!result.blockers.length&&!result.warnings.length){recordPass(result,info.kind);bypassElement=element;bypassUntil=Date.now()+1000;setTimeout(()=>element.click(),10);return;}
    show(result,info,element);
  }
  document.addEventListener('click',intercept,true);
  document.addEventListener('input',event=>{if(event.target?.closest?.('#piForm')&&!event.target.id?.startsWith('workspaceLastFormal'))queueMicrotask(clearStaleFormal);},true);
  document.addEventListener('change',event=>{if(event.target?.closest?.('#piForm')&&!event.target.id?.startsWith('workspaceLastFormal'))queueMicrotask(clearStaleFormal);},true);
  ensureMetaFields();
  window.FlypigBOXFormalOutputGate=Object.freeze({version:VERSION,fingerprint,focusIssue,check:(kind='pdf')=>{const data=payload();return window.FlypigBOXRulePacks?.validate?.(data,typeOf(data),{formal:true,output:kind});},open:(kind='pdf')=>{const data=payload(),info={kind,label:kind==='pdf'?'正式 PDF':'正式文件'},result=window.FlypigBOXRulePacks?.validate?.(data,typeOf(data),{formal:true,output:kind});if(result)show(result,info,document.getElementById('exportPdfBtn'));return result;}});
  document.documentElement.dataset.fpbFormalOutputGate=VERSION;
})();
