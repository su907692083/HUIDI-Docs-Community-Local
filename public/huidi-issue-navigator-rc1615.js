/* HUIDI Docs Community Local RC16.15 — canonical issue locator/navigation, narrow-dialog observer. */
(()=>{
  'use strict';
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.15-ISSUE-NAVIGATOR';
  const $=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const $$=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
  const clean=value=>String(value??'').trim();
  const ITEM_MAP={
    name:'.i-name',sku:'.i-sku',spec:'.i-spec',qty:'.i-qty',unit:'.i-unit',price:'.i-price',hs:'.i-hs',moq:'.i-moq',
    cartonNo:'.i-carton-no',packageDescription:'.i-package-desc',netWeight:'.i-net-weight',grossWeight:'.i-gross-weight',
    cbm:'.i-cbm',dimensions:'.i-dimensions',shippingMarks:'.i-item-marks',origin:'.i-origin'
  };
  const FIELD_ALIASES={
    beneficiaryName:'bankBeneficiary',swiftCode:'bankSwift',bankAccountNo:'bankAccount',countryOfOrigin:'originCountry',
    hsCode:'showHsCode',cartonCount:'packageCount',totalNetWeight:'netWeight',totalGrossWeight:'grossWeight',totalCbm:'cbm'
  };
  const SWITCH_FOR_ITEM={hs:'showHsCode',cartonNo:'showLogistics',packageDescription:'showLogistics',netWeight:'showLogistics',grossWeight:'showLogistics',cbm:'showLogistics',dimensions:'showLogistics',shippingMarks:'showLogistics'};
  function meaningfulRows(){
    try{const rows=window.FlypigBOXQuotationQuickFlow?.meaningfulRows?.();if(Array.isArray(rows))return rows;}catch(_){ }
    try{const guard=window.FlypigBOXEmptyItemGuard;if(guard?.meaningfulItem&&guard?.rowSnapshot)return $$('#itemList .item-row').filter(row=>guard.meaningfulItem(guard.rowSnapshot(row)));}catch(_){ }
    return $$('#itemList .item-row').filter(row=>['.i-name','.i-sku','.i-spec','.i-hs','.i-carton-no','.i-package-desc','.i-item-marks'].some(selector=>clean($(selector,row)?.value))||Number($('.i-price',row)?.value||0)!==0);
  }
  function itemFieldFromSelector(selector=''){
    const hit=Object.entries(ITEM_MAP).find(([,css])=>String(selector).includes(css));
    return hit?.[0]||'';
  }
  function itemIndexFromSelector(selector=''){
    const match=String(selector).match(/\.item-row:nth-child\((\d+)\)/);
    return match?Math.max(0,Number(match[1])-1):null;
  }
  function normalize(input){
    const issue=typeof input==='string'?{path:input}:{...(input||{})};
    let path=clean(issue.path||issue.target);
    let fieldId=clean(issue.fieldId);
    let selector=clean(issue.selector);
    let itemIndex=Number.isFinite(Number(issue.itemIndex))?Number(issue.itemIndex):null;
    let itemField=clean(issue.itemField);
    if(!fieldId&&path){const m=path.match(/^fields\.([A-Za-z0-9_-]+)$/);if(m)fieldId=m[1];}
    const itemMatch=path.match(/^items\.(\d+)\.([A-Za-z0-9_-]+)$/);
    if(itemMatch){itemIndex=Number(itemMatch[1]);itemField=itemMatch[2];}
    const genericItem=path.match(/^items\.([A-Za-z0-9_-]+)$/);
    if(genericItem&&!itemField)itemField=genericItem[1];
    if(selector){if(itemIndex==null)itemIndex=itemIndexFromSelector(selector);if(!itemField)itemField=itemFieldFromSelector(selector);}
    if(fieldId&&FIELD_ALIASES[fieldId])fieldId=FIELD_ALIASES[fieldId];
    return {...issue,path,fieldId,selector,itemIndex,itemField};
  }
  function ensureFormView(){
    try{if(window.FlypigBOXTableEditor?.getMode?.()==='table')window.FlypigBOXTableEditor.setViewMode('form',{announce:false,persist:true});}catch(_){ }
  }
  function enableSwitch(id){
    const input=document.getElementById(id);if(!input||input.checked)return;
    input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function exposeTarget(target,locator){
    if(!target)return;
    ensureFormView();
    $$('#piForm details').forEach(details=>{if(details.contains(target))details.open=true;});
    const row=target.closest?.('.item-row');
    if(row){
      if(locator.itemField&&SWITCH_FOR_ITEM[locator.itemField])enableSwitch(SWITCH_FOR_ITEM[locator.itemField]);
      row.classList.add('fp-item-expanded');
      const more=$('.fp-item-more',row);if(more)more.textContent='收起';
    }
    if(target.offsetParent===null){
      const advanced=$('[data-fp-qf-action="advanced"]');
      if(advanced&&/更多|展开/.test(advanced.textContent||''))advanced.click();
    }
  }
  function targetFor(locator){
    if(locator.selector){try{const direct=$(locator.selector);if(direct)return direct;}catch(_){ }}
    if(locator.fieldId){const direct=document.getElementById(locator.fieldId);if(direct)return direct;}
    if(locator.itemField){
      const rows=meaningfulRows();
      if(locator.itemIndex!=null){const row=rows[locator.itemIndex]||$$('#itemList .item-row')[locator.itemIndex];return row?.querySelector(ITEM_MAP[locator.itemField]||'.i-name')||row||null;}
      const selector=ITEM_MAP[locator.itemField]||'.i-name';
      const preferred=rows.find(row=>{
        const control=$(selector,row);if(!control)return false;
        if(locator.itemField==='hs'){const digits=clean(control.value).replace(/\D/g,'');return digits.length<6||digits.length>10;}
        return !clean(control.value);
      });
      return preferred?.querySelector(selector)||rows[0]?.querySelector(selector)||null;
    }
    if(locator.path==='items'||locator.path==='document')return $('#itemList')||$('#piForm');
    if(locator.path==='fields'||locator.path==='field')return $('#piForm');
    return null;
  }
  function highlight(target){
    const card=target.closest?.('.card');card?.classList.add('huidi-issue-card-focus');
    target.classList?.add('huidi-issue-field-focus');
    window.setTimeout(()=>{target.classList?.remove('huidi-issue-field-focus');card?.classList.remove('huidi-issue-card-focus');},2400);
  }
  function locate(input,{behavior='smooth'}={}){
    const locator=normalize(input);let target=targetFor(locator);
    if(!target)return false;
    exposeTarget(target,locator);
    window.setTimeout(()=>{
      target=targetFor(locator)||target;
      exposeTarget(target,locator);
      target.scrollIntoView?.({behavior,block:'center',inline:'nearest'});
      window.setTimeout(()=>{target.focus?.({preventScroll:true});highlight(target);},180);
    },90);
    return true;
  }
  function pathFromTradeIssue(entry){
    const locator=normalize(entry);
    if(locator.path&&locator.path!=='document')return locator.path;
    if(locator.fieldId)return`fields.${locator.fieldId}`;
    if(locator.itemField&&locator.itemIndex!=null)return`items.${locator.itemIndex}.${locator.itemField}`;
    if(locator.itemField)return`items.${locator.itemField}`;
    return locator.path||'document';
  }
  function syncFormalDialog(){
    const dialog=document.getElementById('fp-a18-formal-dialog');
    const cancel=dialog?.querySelector?.('[data-a18-cancel]');
    if(cancel)cancel.textContent='返回并定位第一项';
  }
  document.addEventListener('click',event=>{
    const issueButton=event.target.closest?.('[data-a18-issue-path]');
    if(issueButton){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const path=clean(issueButton.dataset.a18IssuePath)||'items';
      issueButton.closest('dialog')?.close?.();
      window.setTimeout(()=>locate(path),40);
      return;
    }
    const cancel=event.target.closest?.('[data-a18-cancel]');
    if(cancel){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      let issue=null;try{issue=window.FlypigBOXFormalOutputGate?.check?.('pdf')?.blockers?.[0]||null;}catch(_){ }
      cancel.closest('dialog')?.close?.();
      if(issue)window.setTimeout(()=>locate(issue),40);
    }
  },true);
  let boundFormalDialog=null;
  let formalDialogObserver=null;
  function bindFormalDialog(){
    const dialog=document.getElementById('fp-a18-formal-dialog');
    if(!dialog||dialog===boundFormalDialog)return Boolean(dialog);
    formalDialogObserver?.disconnect?.();
    boundFormalDialog=dialog;
    formalDialogObserver=new MutationObserver(()=>syncFormalDialog());
    formalDialogObserver.observe(dialog,{childList:true,subtree:true});
    syncFormalDialog();
    return true;
  }
  function inspectTopLevelAdds(records){
    for(const record of records){
      for(const node of record.addedNodes||[]){
        if(node?.nodeType!==1)continue;
        if(node.id==='fp-a18-formal-dialog'||node.querySelector?.('#fp-a18-formal-dialog')){bindFormalDialog();return;}
      }
    }
  }
  let rootObserver=null;
  function startDialogDiscovery(){
    if(bindFormalDialog())return;
    if(rootObserver||!document.body)return;
    rootObserver=new MutationObserver(records=>{inspectTopLevelAdds(records);if(boundFormalDialog){rootObserver.disconnect();rootObserver=null;}});
    rootObserver.observe(document.body,{childList:true});
  }
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#exportPdfBtn,#headerExportPdfBtn,[data-lite-export="pdf"],[data-local-export="pdf"],#huidiLocalCheckHeader')){
      setTimeout(()=>{bindFormalDialog();syncFormalDialog();},0);
    }
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startDialogDiscovery,{once:true});else startDialogDiscovery();
  if(!document.getElementById('huidi-issue-navigator-rc1615-style')){
    const style=document.createElement('style');style.id='huidi-issue-navigator-rc1615-style';
    style.textContent='.huidi-issue-field-focus{outline:3px solid rgba(15,123,220,.28)!important;box-shadow:0 0 0 5px rgba(15,123,220,.10)!important;border-color:#0f7bdc!important;transition:.18s}.huidi-issue-card-focus{box-shadow:0 0 0 3px rgba(15,123,220,.12),0 10px 30px rgba(20,33,61,.08)!important}';
    document.head.appendChild(style);
  }
  window.HUIDIIssueNavigator=Object.freeze({version:VERSION,normalize,locate,pathFromTradeIssue});
  document.documentElement.dataset.huidiIssueNavigator='rc16.15';
})();
