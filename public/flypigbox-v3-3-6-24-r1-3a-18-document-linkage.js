/* HUIDI V3.3.6.24-R1.3A.18 — deterministic document conversion and CI/PL consistency checks. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18-LINKAGE.1';
  const $=(selector,root=document)=>root.querySelector(selector);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const clone=value=>{try{return structuredClone(value);}catch(_){return JSON.parse(JSON.stringify(value||{}));}};
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const TYPES={quotation:{label:'报价单',prefix:'QUO'},proforma_invoice:{label:'形式发票（PI）',prefix:'PI'},sales_contract:{label:'销售合同',prefix:'SC'},commercial_invoice:{label:'商业发票（CI）',prefix:'CI'},packing_list:{label:'装箱单（PL）',prefix:'PL'}};
  const TRANSITIONS={quotation:['proforma_invoice','sales_contract'],proforma_invoice:['sales_contract','commercial_invoice','packing_list'],sales_contract:['commercial_invoice','packing_list'],commercial_invoice:['packing_list'],packing_list:['commercial_invoice']};
  const moneyFields=['customsDeclaredValue','subtotal','taxAmount','discountValue','extraFeeAmount','showDiscount','showFreight','showTax','showAmountWords','showPayment','bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress','beneficiaryName','swiftCode'];
  const sourceFieldByType={quotation:'relatedQuotationNo',proforma_invoice:'relatedPiNo',sales_contract:'relatedContractNo',commercial_invoice:'relatedCommercialInvoiceNo',packing_list:'relatedPackingListNo'};
  const currentPayload=()=>{try{return window.FlypigBOXApp?.formState?.(true)||{fields:{},items:[]};}catch(_){return{fields:{},items:[]};}};
  const typeOf=payload=>clean(payload?.fields?.documentType||$('#documentType')?.value||'proforma_invoice');
  const documentNo=payload=>clean(payload?.fields?.invoiceNo||payload?.fields?.quoteNo);
  const groupId=()=>`link_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  function nextNo(type){const date=new Date(),ymd=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('');return`${TYPES[type]?.prefix||'DOC'}-${ymd}-${String(date.getTime()).slice(-4)}`;}
  function meaningfulItems(payload){return(Array.isArray(payload?.items)?payload.items:[]).filter(item=>item&&Object.values(item).some(value=>clean(value)||num(value)!==0));}
  function normalizeKey(item,index){return clean(item?.sku||item?.itemKey||item?.name).toLowerCase()||`row_${index}`;}
  function aggregateItems(payload){
    const map=new Map();
    meaningfulItems(payload).forEach((item,index)=>{
      const key=normalizeKey(item,index),current=map.get(key)||{key,qty:0,units:new Set(),name:clean(item.name),sku:clean(item.sku||item.itemKey),rows:[]};
      current.qty+=num(item.qty);if(clean(item.unit))current.units.add(clean(item.unit).toLowerCase());current.rows.push(index+1);map.set(key,current);
    });
    return map;
  }
  function compareCiPl(ciPayload,plPayload){
    const ciMap=aggregateItems(ciPayload),plMap=aggregateItems(plPayload),issues=[];
    ciMap.forEach((ciRow,key)=>{
      const plRow=plMap.get(key),label=ciRow.name||ciRow.sku||key;
      if(!plRow){issues.push({severity:'blocker',code:'missing_in_pl',message:`CI 商品“${label}”在 PL 中没有对应行。`});return;}
      if(Math.abs(ciRow.qty-plRow.qty)>0.000001)issues.push({severity:'blocker',code:'quantity_mismatch',message:`商品“${label}”的数量不一致：CI ${ciRow.qty}，PL ${plRow.qty}。`});
      if(ciRow.units.size&&plRow.units.size&&[...ciRow.units].sort().join('|')!==[...plRow.units].sort().join('|'))issues.push({severity:'warning',code:'unit_mismatch',message:`商品“${label}”的单位不一致：CI ${[...ciRow.units].join('/')}，PL ${[...plRow.units].join('/')}。`});
      plMap.delete(key);
    });
    plMap.forEach(row=>issues.push({severity:'warning',code:'extra_in_pl',message:`PL 中的商品“${row.name||row.sku||row.key}”未在 CI 中找到对应行。`}));
    const cf=ciPayload?.fields||{},pf=plPayload?.fields||{};
    const pairs=[
      [clean(cf.customerOrderNo||cf.customerPo),clean(pf.customerOrderNo||pf.customerPo),'客户PO号'],
      [clean(cf.internalOrderNo),clean(pf.internalOrderNo),'内部订单号'],
      [clean(cf.buyerName),clean(pf.buyerName),'客户名称'],
      [clean(cf.shippingMethod),clean(pf.shippingMethod),'运输方式'],
      [clean(cf.portOfLoading),clean(pf.portOfLoading),'起运港'],
      [clean(cf.destinationPort),clean(pf.destinationPort),'目的港']
    ];
    pairs.forEach(([ciValue,plValue,label])=>{if(ciValue&&plValue&&ciValue!==plValue)issues.push({severity:'warning',code:'field_mismatch',message:`${label}不一致：CI“${ciValue}”，PL“${plValue}”。`});});
    return{valid:!issues.some(row=>row.severity==='blocker'),issues,checkedAt:new Date().toISOString(),version:VERSION};
  }
  function convertPayload(source,target){
    const next=clone(source);next.fields=next.fields||{};next.items=Array.isArray(next.items)?next.items:[];
    const sourceType=typeOf(source),sourceNo=documentNo(source),linkId=clean(source.fields?.workspaceLinkageGroupId)||groupId();
    next.fields.documentType=target;next.documentType=target;next.fields.workspaceSourceDocumentType=sourceType;next.fields.workspaceSourceDocumentNo=sourceNo;next.fields.workspaceLinkageGroupId=linkId;
    next.fields.workspaceLineageJson=JSON.stringify({source_type:sourceType,source_no:sourceNo,target_type:target,created_at:new Date().toISOString(),rule_version:VERSION});
    if(sourceFieldByType[sourceType]&&sourceNo)next.fields[sourceFieldByType[sourceType]]=sourceNo;
    if(target==='quotation'){next.fields.quoteNo=nextNo(target);next.fields.invoiceNo='';}
    else{next.fields.invoiceNo=nextNo(target);if(target!=='proforma_invoice')next.fields.quoteNo=next.fields.quoteNo||source.fields?.quoteNo||'';}
    if(target==='packing_list'){
      moneyFields.forEach(key=>{if(key.startsWith('show'))next.fields[key]='0';else next.fields[key]='';});
      next.fields.currency='';next.fields.paymentTerms='';next.fields.fpFeeItemsJson='[]';
      next.items=next.items.map(item=>{const row={...item};['price','unitPrice','amount','subtotal','tax','discount'].forEach(key=>delete row[key]);return row;});
    }
    if(target==='commercial_invoice'){
      ['bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress','beneficiaryName','swiftCode'].forEach(key=>{next.fields[key]='';});
      next.fields.showPayment='0';
    }
    if(target==='sales_contract'){
      next.fields.deliveryTime=next.fields.deliveryTime||next.fields.estimatedShipment||'';
    }
    next.savedAt=Date.now();next.version=Math.max(6,Number(next.version||0));return next;
  }

  function ensureMetaInputs(){
    const form=$('#piForm');if(!form)return;
    ['workspaceLinkageGroupId','workspaceLineageJson'].forEach(id=>{if($('#'+id))return;const input=document.createElement('input');input.type='hidden';input.id=id;form.appendChild(input);});
  }
  function sourceSnapshot(){try{return JSON.parse(sessionStorage.getItem('flypigbox_linkage_source_snapshot')||'null');}catch(_){return null;}}
  function storeSource(payload){try{sessionStorage.setItem('flypigbox_linkage_source_snapshot',JSON.stringify(payload));}catch(_){} }
  function ensureDialog(){
    let dialog=$('#fp-a18-link-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='fp-a18-link-dialog';dialog.className='fp-a18-link-dialog';
    dialog.innerHTML='<section class="fp-a18-link-card"><header><div><p>单据贯通</p><h2 data-a18-link-title>生成关联单据</h2><span data-a18-link-subtitle>系统只带入可继承内容，不会自动保存或覆盖原单据。</span></div><button type="button" data-a18-link-close aria-label="关闭">×</button></header><div class="fp-a18-link-options" data-a18-link-options></div><div class="fp-a18-link-note">生成后请核对变化字段，再点击保存。原单据和已经发给客户的历史版本不会被修改。</div><div class="fp-a18-link-check" data-a18-link-check hidden></div><footer><button type="button" data-a18-link-close>取消</button></footer></section>';
    dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-a18-link-close]'))dialog.close();const target=event.target.closest('[data-a18-link-target]')?.dataset.a18LinkTarget;if(target)performConvert(target,dialog);});
    document.body.appendChild(dialog);return dialog;
  }
  function showDialog(){
    const payload=currentPayload(),type=typeOf(payload),targets=TRANSITIONS[type]||[];const dialog=ensureDialog();
    $('[data-a18-link-title]',dialog).textContent=`由${TYPES[type]?.label||'当前单据'}生成关联单据`;
    $('[data-a18-link-options]',dialog).innerHTML=targets.length?targets.map(target=>`<button type="button" class="fp-a18-link-option" data-a18-link-target="${target}"><b>生成${TYPES[target].label}</b><span>${target==='packing_list'?'自动移除价格、金额和收款资料':target==='commercial_invoice'?'继承商品与数量，保留正式货值字段':target==='sales_contract'?'继承客户、商品、金额与付款约定':'继承客户、商品和报价资料'}</span></button>`).join(''):'<div>当前单据暂时没有可继续生成的类型。</div>';
    const prior=sourceSnapshot();const check=$('[data-a18-link-check]',dialog);
    if(prior&&['commercial_invoice','packing_list'].includes(type)&&['commercial_invoice','packing_list'].includes(typeOf(prior))&&typeOf(prior)!==type){const result=type==='commercial_invoice'?compareCiPl(payload,prior):compareCiPl(prior,payload);check.hidden=false;check.textContent=result.issues.length?`关联核对：${result.issues.length} 项需要注意。`:'关联核对：CI 与 PL 的商品和数量一致。';}else check.hidden=true;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function performConvert(target,dialog){
    ensureMetaInputs();
    const source=currentPayload(),sourceType=typeOf(source);storeSource(source);
    const route=window.FlypigBOXEngineRouter?.pick?.('document_transform',{payload:source,targetType:target})||{id:'document_linkage',status:'active'};
    const job=window.FlypigBOXEngineRouter?.queue?.add?.('document_transform',{summary:`由${TYPES[sourceType]?.label||sourceType}生成${TYPES[target]?.label||target}`,sourceName:documentNo(source)||TYPES[sourceType]?.label},{route});
    let next;
    try{next=convertPayload(source,target);if(job)window.FlypigBOXEngineRouter?.queue?.update?.(job.id,{status:'completed',engine:'document_linkage',resultSummary:`已生成${TYPES[target]?.label||target}未保存草稿`});}
    catch(error){if(job)window.FlypigBOXEngineRouter?.queue?.update?.(job.id,{status:'failed',engine:'document_linkage',error:clean(error?.message)||'转换失败'});throw error;}
    const context=window.FlypigBOXDocumentIntelligence?.context?.()||{};
    window.FlypigBOXDocumentIntelligence?.saveContext?.({...context,document_id:null,id:null,source_document_id:context.document_id||context.id||null,source_document_type:sourceType,source_document_no:documentNo(source),linkage_group_id:next.fields.workspaceLinkageGroupId});
    window.FlypigBOXApp?.applyState?.(next);dialog?.close?.();
    document.dispatchEvent(new CustomEvent('HUIDI:document-converted',{detail:{sourceType,targetType:target,sourceNo:documentNo(source),linkageGroupId:next.fields.workspaceLinkageGroupId}}));
    setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);
  }
  function ensureButton(){
    ensureMetaInputs();
    if(!window.FlypigBOXApp||$('[data-a18-link-document]'))return;
    const actions=$('#fpTradeFactoryCenter .fp-trade-factory-actions')||$('.editor-top-actions')||$('.top-actions');if(!actions)return;
    const button=document.createElement('button');button.type='button';button.className='btn secondary fp-a18-link-button';button.dataset.a18LinkDocument='1';button.textContent='生成关联单据';actions.appendChild(button);
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-a18-link-document]')){event.preventDefault();showDialog();return;}if(event.target.closest('[data-a18-workbench-linkage]')){event.preventDefault();location.href='./workspace.html?view=documents';}},true);

  function ensureWorkbenchCard(){
    const grid=$('#fp-a17-engine-center .fp-a17-task-grid');if(!grid||$('[data-a18-workbench-linkage]',grid))return;
    const button=document.createElement('button');button.type='button';button.className='fp-a17-task';button.dataset.a18WorkbenchLinkage='1';button.innerHTML='<b>单据一键贯通</b><span>从报价生成 PI 或合同，再从订单资料生成 CI 和 PL。</span><em>进入单据中心</em>';grid.appendChild(button);
  }
  const observer=new MutationObserver(()=>{ensureButton();ensureWorkbenchCard();});observer.observe(document.documentElement,{childList:true,subtree:true});setInterval(()=>{ensureButton();ensureWorkbenchCard();},2500);ensureButton();ensureWorkbenchCard();
  window.FlypigBOXDocumentLinkage=Object.freeze({version:VERSION,transitions:TRANSITIONS,convertPayload,compareCiPl,show:showDialog});
  document.documentElement.dataset.fpbDocumentLinkage=VERSION;
})();
