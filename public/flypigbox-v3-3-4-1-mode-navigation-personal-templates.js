/* HUIDI V3.3.6.24-R1.3A.14 — structured document sections, professional modes and reusable templates.
   Explicit events only. No MutationObserver / ResizeObserver / requestAnimationFrame loop. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.14';
  const DEFAULT_SELLER_KEY='flypigbox_v3341_default_seller';
  const TEMPLATE_KEY='flypigbox_v3341_personal_section_templates';
  const $=id=>document.getElementById(id);
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const DOC_LABELS={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'};
  const DOCUMENT_SEMANTICS={
    quotation:{valid:'报价有效期',address:'买方公司地址',logistics:'预计物流与包装',paper:'报价商品较少时使用竖版；商品列较多或超过 7 行时建议横版。'},
    proforma_invoice:{valid:'PI 有效期',address:'买方公司地址',logistics:'预计交付、物流与包装',paper:'标准 PI 建议竖版；商品超过 8 行或开启大量扩展列时建议横版。'},
    commercial_invoice:{valid:'',address:'买方 / 进口商公司地址',logistics:'清关与实际出货信息',paper:'标准清关通常使用竖版；商品超过 8 行或开启图片时建议横版。'},
    packing_list:{valid:'装箱日期',address:'买方公司地址',logistics:'包装与实际出货信息',paper:'装箱单优先使用横版，便于展示箱号、尺寸、重量和 CBM。'},
    sales_contract:{valid:'合同有效期（可选）',address:'买方公司地址',logistics:'预计交付与物流计划',paper:'销售确认书和完整合同优先使用竖版；条款很多时自然分页。'}
  };
  const SEA_ONLY_TERMS=new Set(['FAS','FOB','CFR','CIF']);
  const INCOTERM_OPTIONS=['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'];
  const contextSnapshot=()=>({documentType:$('documentType')?.value||'proforma_invoice',docMode:currentMode(),paperOrientation:$('paperOrientation')?.value||'auto',tradeScenario:$('tradeScenario')?.value||'wholesale'});

  const SELLER_FIELDS=['sellerName','sellerContact','sellerPhone','sellerEmail','sellerAddress','sellerTaxId','sellerRegistrationNo','sellerVatNo','sellerEoriNo'];
  const REFERENCE_TEMPLATE_FIELDS=['inquiryNo','quotationVersion','customerOrderNo','internalOrderNo','relatedQuotationNo','relatedPiNo','relatedContractNo','relatedCommercialInvoiceNo','relatedPackingListNo','quotationValidUntil','proformaValidUntil','contractSignedDate','contractEffectiveDate','contractExpiryDate','packingDate'];
  const DELIVERY_TEMPLATE_FIELDS=['buyerName','buyerContact','buyerPhone','buyerEmail','buyerWebsite','buyerCountry','buyerCountryCode','buyerAddress','buyerTaxId','buyerRegistrationNo','buyerVatNo','buyerEoriNo','consigneeName','consigneeContact','consigneePhone','consigneeEmail','consigneeAddress','notifyPartyName','notifyPartyContact','notifyPartyPhone','notifyPartyEmail','notifyPartyAddress','billToAddress','shipToAddress'];
  const LOGISTICS_TEMPLATE_FIELDS=['shippingMethod','portOfLoading','destinationPort','estimatedShipment','etd','eta','packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks','totalPieces','cartonRange','cartonsInLine','quantityPerCarton','palletNo','palletCount','mixedPackingNote','transportDocumentType','logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','actualShipmentDate','actualDepartureDate','actualArrivalDate','logisticsExtraRowsJson'];
  const PAYMENT_TEMPLATE_FIELDS=['paymentTemplate','bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress','paymentTerms','syncPaymentTerms','depositPercent','depositAmount','depositDueDate','balancePercent','balanceAmount','balanceDueCondition','balanceDueDate','creditDays'];
  const QUALITY_TEMPLATE_FIELDS=['qualityStandard','inspectionMethod','inspectionDeadlineDays','riskTransferPoint','warrantyPeriod','governingLaw','disputeResolution','sellerSignatory','buyerSignatory','attachmentList','productionStartDate','expectedCompletionDate','inspectionDate','partialShipmentPlan'];
  const TEMPLATE_GROUPS={
    seller:{label:'卖方资料',fields:SELLER_FIELDS},
    references:{label:'关联单据与日期',fields:REFERENCE_TEMPLATE_FIELDS},
    buyer:{label:'买方、收货与通知资料',fields:DELIVERY_TEMPLATE_FIELDS},
    logistics:{label:'包装、物流与实际出货',fields:LOGISTICS_TEMPLATE_FIELDS},
    payment:{label:'付款计划与收款账户',fields:PAYMENT_TEMPLATE_FIELDS},
    terms:{label:'交易、质量与合同条款',fields:['paymentTerms','tradeTerms','deliveryTime','remarks','contractClauses',...QUALITY_TEMPLATE_FIELDS]},
    signature:{label:'签章配置',fields:['assetProfileSelect','assetProfileName','signatureLayout','stampX','stampY','stampRotate','stampScale','signatureX','signatureY','signatureRotate','signatureScale']}
  };
  const FIELD_LABELS={
    sellerName:'卖方公司',sellerContact:'卖方联系人',sellerPhone:'卖方电话',sellerEmail:'卖方邮箱',sellerAddress:'卖方地址',sellerTaxId:'卖方税号',
    buyerName:'买方公司',buyerContact:'买方联系人',buyerPhone:'买方电话',buyerEmail:'买方邮箱',buyerWebsite:'买方网站',buyerCountry:'客户国家',buyerCountryCode:'国家代码',buyerAddress:'买方地址',buyerTaxId:'买方税号',destinationPort:'目的地',
    shippingMethod:'运输方式',packageCount:'总箱数',packageType:'包装类型',netWeight:'净重',grossWeight:'毛重',cbm:'总体积',logisticsCarrier:'承运人/货代',trackingNo:'追踪号/运单号',blNo:'提单号',containerNo:'柜号',sealNo:'封条号',vesselFlight:'船名/航班/车次',etd:'ETD',eta:'ETA',packageDimensions:'单箱尺寸',portOfLoading:'装运港',estimatedShipment:'预计发运日期',shippingMarks:'唛头',logisticsExtraRowsJson:'自定义物流字段',
    paymentTemplate:'收款渠道',bankBeneficiary:'收款人',bankName:'开户行',bankAccount:'账号',bankSwift:'SWIFT',bankAddress:'银行地址/付款备注',paymentTerms:'付款条款',syncPaymentTerms:'付款条款自动同步',
    tradeTerms:'贸易术语',deliveryTime:'交货期',remarks:'补充备注',contractClauses:'合同补充条款',
    assetProfileSelect:'签章组合',assetProfileName:'签章组合名称',signatureLayout:'签章排版方式'
  };

  const TARGETS={
    basic:()=>document.querySelector('#editorTop>section.card:first-child')||$('editorTop'),references:()=>$('fpA10ReferencesSection'),parties:()=>document.querySelector('[data-fp-section="parties"]'),delivery:()=>$('fpA10DeliverySection'),products:()=>document.querySelector('[data-fp-section="products"]')||$('itemList'),costs:()=>$('fpA10CostsSection'),fees:()=>$('fpA10CostsSection'),paymentSchedule:()=>$('fpA10PaymentScheduleSection'),customs:()=>$('fpA10CustomsSection'),packing:()=>$('fpA10PackingSection'),plannedLogistics:()=>$('fpA10PlannedLogisticsSection'),actualShipment:()=>$('fpA10ActualShipmentSection'),qualityRisk:()=>$('fpA10QualityRiskSection'),terms:()=>document.querySelector('[data-fp-section="terms"]'),deliveryLegacy:()=>$('fpA10DeliverySection'),logistics:()=>$('fpA10PlannedLogisticsSection')||$('fpA10ActualShipmentSection')||$('fpA10PackingSection'),payment:()=>document.querySelector('[data-fp-section="payment"]'),signature:()=>document.querySelector('[data-fp-section="signature"]'),supplemental:()=>$('fpA10ReferencesSection'),supplement:()=>$('fpA10ReferencesSection')
  };
  const FOCUS_IDS={basic:'docLanguage',references:'customerOrderNo',parties:'buyerName',delivery:'consigneeName',products:'itemList',costs:'extraFeeName',fees:'extraFeeName',paymentSchedule:'depositPercent',customs:'customsDescription',packing:'packageCount',plannedLogistics:'shippingMethod',actualShipment:'transportDocumentType',qualityRisk:'qualityStandard',terms:'paymentTerms',logistics:'shippingMethod',payment:'bankBeneficiary',signature:'signatureFile',supplemental:'customerOrderNo',supplement:'customerOrderNo'};

  function currentMode(){const raw=$('docMode')?.value==='b2b'?'b2b':'ecommerce';return window.FlypigBOXDocumentSchema?.effectiveMode?.(documentType(),raw)||raw;}
  function isVisible(node){return Boolean(node&&node.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');}
  function notify(message,type='ok'){
    try{window.FlypigBOXApp?.setStatus?.(message,type);}catch(_){ }
  }
  function readJson(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'');return value??fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){notify('浏览器本地存储空间不足，暂时无法保存。','error');return false;}}
  function fieldValue(id){const el=$(id);if(!el)return '';if(el.type==='checkbox')return Boolean(el.checked);return String(el.value??'');}
  function fieldHasValue(id){const value=fieldValue(id);return typeof value==='boolean'?value:clean(value)!=='';}
  function setField(id,value,{onlyBlank=false}={}){
    const el=$(id);if(!el)return false;
    if(onlyBlank&&fieldHasValue(id))return false;
    if(el.type==='checkbox')el.checked=Boolean(value);else el.value=value??'';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function captureFields(ids){return Object.fromEntries(ids.filter(id=>$(id)).map(id=>[id,fieldValue(id)]));}
  function meaningfulCount(data){return Object.entries(data||{}).filter(([id,value])=>typeof value==='boolean'?value:clean(value)!=='').length;}

  function removeDuplicateLogisticsGuidance(){
    $('fpLogisticsVisibilityGuidance')?.remove();
  }
  function syncModeExperience(){
    const mode=currentMode(),formal=Boolean(window.FlypigBOXDocumentSchema?.isFormalSingleMode?.(documentType()));
    document.body.classList.toggle('fp-v3341-default-mode',!formal&&mode==='ecommerce');
    document.body.classList.toggle('fp-v3341-detailed-mode',!formal&&mode==='b2b');
    removeDuplicateLogisticsGuidance();
    qsa('[data-optional-section]').forEach(section=>{
      const toggle=section.dataset.optionalSection;
      const allowed=typeof window.documentAllowsField==='function'?Boolean(window.documentAllowsField(toggle)):!section.classList.contains('is-hidden');
      const checked=$(toggle)?.checked!==false;
      const usable=section.dataset.fpUsableFields!=='0';
      section.classList.toggle('is-hidden',!(allowed&&checked&&usable));
      section.setAttribute('aria-hidden',allowed&&checked&&usable?'false':'true');
    });
    syncProfessionalGovernance();
    syncSideNavVisibility();
  }

  function expandTarget(target){
    if(!target)return null;
    let details=target.closest?.('details');
    while(details){details.open=true;details=details.parentElement?.closest?.('details')||null;}
    const card=target.closest?.('section.card,.collapsible-card')||target;
    if(window.FlypigBOXSectionDisclosure?.open){window.FlypigBOXSectionDisclosure.open(card,{persist:true});return card;}
    card?.classList?.remove?.('is-collapsed','is-hidden');
    const body=card?.querySelector?.(':scope>.section-collapse-body');if(body)body.hidden=false;
    const toggle=card?.querySelector?.('.section-collapse-toggle');
    if(toggle){toggle.setAttribute('aria-expanded','true');toggle.textContent='收起 ▲';}
    return card;
  }
  function formScroller(){
    const candidates=[document.querySelector('.workbench>.form-column'),document.querySelector('.form-column')].filter(Boolean);
    return candidates.find(node=>node.scrollHeight>node.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(node).overflowY))||candidates[0]||null;
  }
  function locateSection(key){
    const target=TARGETS[key]?.();
    if(!target||!isVisible(target)){
      notify('当前专业模式不需要这一分栏。可切换到该单据的完整模式，或在字段设置中主动启用后再填写。','error');
      return;
    }
    const card=expandTarget(target);
    requestAnimationFrame(()=>{
      const scroller=formScroller();
      if(scroller&&card&&scroller.contains(card)){
        const sr=scroller.getBoundingClientRect(),cr=card.getBoundingClientRect();
        const desired=scroller.scrollTop+(cr.top-sr.top)-14;
        scroller.scrollTo({top:Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,desired)),behavior:'auto'});
      }else card?.scrollIntoView?.({block:'start',behavior:'auto'});
      card?.classList?.add?.('fp-v3341-nav-target');
      setTimeout(()=>card?.classList?.remove?.('fp-v3341-nav-target'),1300);
      const focus=$(FOCUS_IDS[key])||card?.querySelector?.('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])');
      try{focus?.focus?.({preventScroll:true});}catch(_){ }
    });
  }
  function syncSideNavVisibility(){
    window.FlypigBOXV3350?.refresh?.(false);
  }
  function installReliableNavigation(){
    window.addEventListener('click',event=>{
      const button=event.target.closest?.('#fpV3321SideNav [data-v3321-section]');
      if(!button)return;
      const key=button.dataset.v3321Section;
      event.preventDefault();event.stopImmediatePropagation();
      if(window.FlypigBOXV3350?.navigate)window.FlypigBOXV3350.navigate(key==='fees'?'costs':key);
      else locateSection(key==='fees'?'costs':key);
      qsa('#fpV3321SideNav [data-v3321-section]').forEach(node=>node.classList.toggle('active',node===button));
    },true);
  }

  function sellerSummary(data){
    return SELLER_FIELDS.map(id=>`<div><small>${escapeHtml(FIELD_LABELS[id]||window.FlypigBOXDocumentSchema?.fieldDefinitions?.[id]?.label?.[0]||id)}</small><b>${escapeHtml(clean(data[id])||'未填写')}</b></div>`).join('');
  }
  function groupOptions(){return Object.entries(TEMPLATE_GROUPS).map(([key,group])=>`<option value="${key}">${escapeHtml(group.label)}</option>`).join('');}
  function templates(){const rows=readJson(TEMPLATE_KEY,[]);return Array.isArray(rows)?rows:[];}
  function saveTemplates(rows){return writeJson(TEMPLATE_KEY,rows);}
  function renderTemplateList(root){
    const list=root.querySelector('#fpV3341TemplateList');if(!list)return;
    const rows=templates().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    if(!rows.length){list.innerHTML='<div class="fp-v3341-empty">还没有个人资料模板。选择分类、填写名称和备注后即可保存。</div>';return;}
    list.innerHTML=rows.map(row=>{const ctx=row.context||{};const modeLabel=window.FlypigBOXDocumentSchema?.modeInfo?.(ctx.documentType,ctx.docMode)?.label||(ctx.docMode==='b2b'?'专业模式':'快速模式');const contextText=ctx.documentType?`${DOC_LABELS[ctx.documentType]||ctx.documentType} · ${modeLabel} · ${ctx.paperOrientation==='landscape'?'横版':ctx.paperOrientation==='portrait'?'竖版':'自适应'}`:'';return `<article class="fp-v3341-template-card" data-template-id="${escapeHtml(row.id)}"><header><div><h4>${escapeHtml(row.name)} · ${escapeHtml(TEMPLATE_GROUPS[row.category]?.label||row.category)}</h4><p>${escapeHtml(row.note||'未填写备注')}</p>${contextText?`<div class="fp-r13a6-template-context">${escapeHtml(contextText)}</div>`:''}</div><time>${new Date(row.updatedAt||row.createdAt||Date.now()).toLocaleDateString()}</time></header><div class="fp-v3341-actions"><button type="button" class="primary" data-fp3341-template-apply="blank">填充空白</button><button type="button" data-fp3341-template-apply="overwrite">覆盖套用</button>${row.context?'<button type="button" data-fp3341-template-apply="context">按原单据场景套用</button>':''}<button type="button" class="danger" data-fp3341-template-delete>删除</button></div></article>`}).join('');
  }
  function updateDefaultSellerView(root){
    const current=captureFields(SELLER_FIELDS),saved=readJson(DEFAULT_SELLER_KEY,null);
    const grid=root.querySelector('#fpV3341SellerCurrent');if(grid)grid.innerHTML=sellerSummary(current);
    const state=root.querySelector('#fpV3341SellerDefaultState');if(state)state.textContent=saved&&meaningfulCount(saved)?'已保存默认卖方资料；新单据会自动填充空白字段。':'尚未保存默认卖方资料。';
    const check=root.querySelector('#fpV3341UseSellerDefault');if(check)check.checked=Boolean(saved&&meaningfulCount(saved));
  }
  function autoFillDefaultSeller(){
    const saved=readJson(DEFAULT_SELLER_KEY,null);if(!saved||!meaningfulCount(saved))return;
    let count=0;Object.entries(saved).forEach(([id,value])=>{if(setField(id,value,{onlyBlank:true}))count+=1;});
    if(count)window.FlypigBOXApp?.renderPreview?.();
  }
  function saveDefaultSeller(root){
    const check=root.querySelector('#fpV3341UseSellerDefault');
    if(!check?.checked){localStorage.removeItem(DEFAULT_SELLER_KEY);updateDefaultSellerView(root);notify('已关闭默认卖方资料自动填充。','ok');return;}
    const data=captureFields(SELLER_FIELDS);
    if(!meaningfulCount(data)){notify('请先在左侧填写至少一项卖方资料。','error');return;}
    if(writeJson(DEFAULT_SELLER_KEY,data)){updateDefaultSellerView(root);notify('已保存当前卖方资料为默认；以后新单据会填充空白卖方字段。','ok');}
  }
  function savePersonalTemplate(root){
    const category=root.querySelector('#fpV3341TemplateCategory')?.value;
    const name=clean(root.querySelector('#fpV3341TemplateName')?.value);
    const note=clean(root.querySelector('#fpV3341TemplateNote')?.value);
    const group=TEMPLATE_GROUPS[category];
    if(!group)return;
    if(!name){notify('请填写模板名称，方便下次查找。','error');return;}
    const data=captureFields(group.fields);
    if(!meaningfulCount(data)){notify(`当前“${group.label}”还没有可保存的内容。`,'error');return;}
    const rows=templates();const now=Date.now();
    rows.push({id:`tpl_${now}_${Math.random().toString(36).slice(2,7)}`,category,name,note,data,context:contextSnapshot(),createdAt:now,updatedAt:now});
    if(saveTemplates(rows)){
      root.querySelector('#fpV3341TemplateName').value='';root.querySelector('#fpV3341TemplateNote').value='';
      renderTemplateList(root);notify(`已保存个人模板“${name}”。`,'ok');
    }
  }
  function applyTemplate(root,id,mode){
    const row=templates().find(item=>item.id===id);if(!row)return;
    if(mode==='overwrite'&&!window.confirm(`确定覆盖套用“${row.name}”吗？当前分类中已有内容可能被替换。`))return;
    if(mode==='context'){
      const ctx=row.context||{};
      const ok=window.confirm(`按保存时的单据场景套用“${row.name}”？\n\n将切换单据类型、专业模式、业务场景和纸张建议，并覆盖该模板分类字段；商品、金额和其他分类不会被修改。`);if(!ok)return;
      if(ctx.documentType)window.FlypigBOXApp?.applyDocumentProfile?.(ctx.documentType,{silent:true});
      if(ctx.docMode==='b2b')document.querySelector('[data-doc-mode="b2b"]')?.click();
      if(ctx.tradeScenario&&$('tradeScenario'))setField('tradeScenario',ctx.tradeScenario);
      if(ctx.paperOrientation&&ctx.paperOrientation!=='auto')window.FlypigBOXPaperLayout?.setPreference?.(ctx.paperOrientation,{announce:false});
    }
    let count=0;Object.entries(row.data||{}).forEach(([fieldId,value])=>{if(setField(fieldId,value,{onlyBlank:mode==='blank'}))count+=1;});
    try{window.FlypigBOXApp?.renderLogisticsExtraRowsFromState?.($('logisticsExtraRowsJson')?.value||'[]');}catch(_){ }
    window.FlypigBOXApp?.renderPreview?.();
    try{window.FlypigBOXTableOutput?.refresh?.({force:true});}catch(_){ }
    notify(`已${mode==='blank'?'填充空白':mode==='context'?'按原场景套用':'覆盖套用'}“${row.name}”，写入 ${count} 个字段。`,'ok');
  }
  function deleteTemplate(root,id){
    const row=templates().find(item=>item.id===id);if(!row)return;
    if(!window.confirm(`确定删除个人模板“${row.name}”吗？`))return;
    saveTemplates(templates().filter(item=>item.id!==id));renderTemplateList(root);notify('个人模板已删除。','ok');
  }

  function documentType(){return $('documentType')?.value||'proforma_invoice';}
  function modeInfo(type=documentType(),mode=currentMode()){
    return window.FlypigBOXDocumentSchema?.modeInfo?.(type,mode)||{label:mode==='b2b'?'专业模式':'快速模式',description:''};
  }
  function meaningfulItems(){
    try{return (window.FlypigBOXApp?.formState?.(false)?.items||[]).filter(item=>clean(item?.name||item?.sku||item?.spec)||Number(item?.qty)>0||Number(item?.price)>0)}catch(_){return []}
  }
  function recommendedPaper(){
    const type=documentType(),mode=currentMode(),schema=window.FlypigBOXDocumentSchema,items=meaningfulItems().length;
    const columns=schema?.modeProfile?.(type,mode)?.productColumns?.length||0;
    const imageOn=Boolean($('showProductImage')?.checked&&schema?.toggleAllowed?.('showProductImage',type,mode));
    if(type==='packing_list')return'landscape';
    if(type==='sales_contract')return items>12?'landscape':'portrait';
    if(items>=10||columns>=11||(imageOn&&items>=6))return'landscape';
    return schema?.paperRecommendation?.(type,mode)||'portrait';
  }
  function replaceLabelText(id,text,placeholder='',note=''){
    const input=$(id),label=input?.closest('label');if(!label)return;
    let title=label.querySelector(':scope > [data-r13a6-label]');
    if(!title){title=document.createElement('span');title.dataset.r13a6Label='1';[...label.childNodes].forEach(node=>{if(node.nodeType===Node.TEXT_NODE&&clean(node.textContent))node.remove()});label.prepend(title);}
    title.textContent=text;
    if(placeholder)input.placeholder=placeholder;
    let help=label.querySelector(':scope > [data-r13a6-help]');
    if(note){if(!help){help=document.createElement('small');help.dataset.r13a6Help='1';help.className='fp-r13a6-field-help';label.appendChild(help)}help.textContent=note;}else help?.remove();
  }
  function syncSemanticLabels(){
    const type=documentType(),sem=DOCUMENT_SEMANTICS[type]||DOCUMENT_SEMANTICS.proforma_invoice;
    const validLabel=$('validUntil')?.closest('label');if(validLabel){validLabel.classList.toggle('is-hidden',type==='commercial_invoice');if(type!=='commercial_invoice')replaceLabelText('validUntil',sem.valid||'有效期');}
    replaceLabelText('buyerAddress',sem.address,'填写买方公司注册地址或主要营业地址','实际送货地址请填写在“送货地址”或“最终收货人地址”，不要与买方公司地址混用。');
    replaceLabelText('sellerTaxId','卖方税务或海关识别号（可选）','可填写公司注册号、税务识别号、增值税号（VAT）或欧盟经营者编号（EORI）','不同编号用途不同，请按客户或目的国要求填写。');
    replaceLabelText('buyerTaxId','买方税务或海关识别号（可选）','可填写税务识别号、增值税号（VAT）、欧盟经营者编号（EORI）或其他海关登记号','实际清关主体与买方不同时，请在最终收货人资料中补充。');
    const hints={
      references:type==='quotation'?'填写询盘、报价版本和报价有效期。':type==='proforma_invoice'?'填写客户订单、关联报价、PI有效期等订单参考。':type==='commercial_invoice'?'填写客户订单及关联PI、合同、装箱单编号。':type==='packing_list'?'填写关联商业发票、PI、合同和装箱日期。':'填写合同编号、签订、生效和关联订单资料。',
      plannedLogistics:'这里只填写预计运输方式、装运地点、目的地和预计时间；不会出现提单、柜号、封条或追踪号。',
      packing:type==='quotation'||type==='proforma_invoice'||type==='sales_contract'?'填写预计包装、重量、体积和唛头要求。':type==='commercial_invoice'?'填写用于清关核对的包裹数量、净重、毛重和体积。':'填写箱数、每箱数量、重量、体积、托盘和混装资料。',
      actualShipment:type==='commercial_invoice'?'填写实际承运商、运输单据、柜封及实际发运日期，并与装箱单保持一致。':'填写实际运输单据、柜号、封条、船名或航班等出货资料。',
      paymentSchedule:'使用结构化定金、尾款、到期日和账期字段；银行账户继续在“收款账户”中维护。',
      customs:'清关字段按当前单据和模式显示；未使用的监管字段不会进入客户文件。',
      qualityRisk:type==='sales_contract'?'填写质量标准、验收方式、风险转移、质保、适用法律及争议解决。':'填写生产启动、预计完成、验货和分批交付安排。'
    };
    Object.entries(hints).forEach(([key,text])=>{const section=document.querySelector(`[data-fp-section="${key}"]`);const hint=section?.querySelector(':scope > .hint,[data-fp-section-hint]');if(hint)hint.textContent=text;});
    const signature=document.querySelector('[data-optional-section="showSignature"]');if(signature){const h2=signature.querySelector(':scope > h2');if(h2)h2.textContent='签名与盖章图片（可选）';let note=signature.querySelector(':scope > .fp-r13a6-sign-note');if(!note){note=document.createElement('p');note.className='fp-r13a6-sign-note';signature.querySelector(':scope > h2')?.insertAdjacentElement('afterend',note)}note.textContent='上传图片仅用于版面展示，不代表平台对签署身份、时间戳或法律效力进行认证。';}
  }
  function markLogisticsGroups(){
    const section=document.querySelector('[data-optional-section="showLogistics"]'),grid=section?.querySelector('.grid');if(!grid)return;
    const planned=['shippingMethod','packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks'];
    const actual=['logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','etd','eta'];
    const ensure=(id,title,ids)=>{let node=$(id);if(!node){node=document.createElement('div');node.id=id;node.className='fp-r13a6-logistics-group';node.textContent=title;const first=ids.map(fid=>$(fid)?.closest('label')).find(Boolean);first?.insertAdjacentElement('beforebegin',node)}const visible=ids.some(fid=>{const c=$(fid)?.closest('label');return isVisible(c)});node.hidden=!visible;};
    ensure('fpR13A6PlanLogistics','预计物流与包装资料',planned);ensure('fpR13A6ActualLogistics','实际出货资料',actual);
  }
  function parseTradeTerms(){
    const value=clean($('tradeTerms')?.value);const code=(value.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i)||[])[1]?.toUpperCase()||'FOB';
    const place=clean(value.replace(new RegExp(`^${code}\\s*`,'i'),'').replace(/[—-]?\s*Incoterms®?\s*2020.*$/i,''))||'';
    return{code,place};
  }
  function ensureIncotermsBuilder(){
    const input=$('tradeTerms'),label=input?.closest('label');if(!label||$('fpR13A6IncotermsBuilder'))return;
    const parsed=parseTradeTerms(),box=document.createElement('div');box.id='fpR13A6IncotermsBuilder';box.className='fp-r13a6-incoterms-builder';
    box.innerHTML=`<div><b>结构化填写贸易术语</b><small>选择术语、指定地点和运输方式后生成标准写法；不会自动覆盖，点击“写入”才更新。</small></div><div class="fp-r13a6-incoterms-grid"><label>术语<select id="fpR13A6IncotermCode">${INCOTERM_OPTIONS.map(code=>`<option ${code===parsed.code?'selected':''}>${code}</option>`).join('')}</select></label><label>指定地点或港口<input id="fpR13A6NamedPlace" value="${escapeHtml(parsed.place)}" placeholder="例如：Ningbo Port, China"></label><label>运输方式<select id="fpR13A6Transport"><option value="multimodal">多式联运或未确定</option><option value="sea">海运或内河</option><option value="air">空运</option><option value="express">国际快递</option><option value="rail">铁路</option><option value="truck">陆运</option></select></label><button type="button" data-r13a6-apply-incoterm>写入标准格式</button></div><p id="fpR13A6IncotermHint"></p>`;
    label.insertAdjacentElement('afterend',box);
    box.addEventListener('click',event=>{if(!event.target.closest('[data-r13a6-apply-incoterm]'))return;const code=$('fpR13A6IncotermCode').value,place=clean($('fpR13A6NamedPlace').value);if(!place){notify('请填写指定地点、港口或交付地址。','error');return;}setField('tradeTerms',`${code} ${place} — Incoterms® 2020`);const transport=$('fpR13A6Transport').value;if(!$('shippingMethod')?.value){const map={sea:'Sea Freight',air:'Air Freight',express:'Express',rail:'Rail Freight',truck:'Truck Freight'};if(map[transport])setField('shippingMethod',map[transport]);}syncIncotermsHint();notify('已写入标准贸易术语，请结合合同和货代安排人工复核。','ok');});
    box.addEventListener('change',syncIncotermsHint);box.addEventListener('input',syncIncotermsHint);syncIncotermsHint();
  }

  let fpA11IncotermsSyncing=false,fpA11IncotermsTimer=0;
  function syncIncotermsBuilderFromSource(){
    const box=$('fpR13A6IncotermsBuilder'),source=$('tradeTerms');if(!box||!source||fpA11IncotermsSyncing)return;
    const parsed=parseTradeTerms();const code=$('fpR13A6IncotermCode'),place=$('fpR13A6NamedPlace');
    fpA11IncotermsSyncing=true;
    if(code&&parsed.code)code.value=parsed.code;
    if(place)place.value=parsed.place||'';
    fpA11IncotermsSyncing=false;syncIncotermsHint();
  }
  function writeIncotermsFromBuilder({silent=true}={}){
    if(fpA11IncotermsSyncing)return false;
    const code=$('fpR13A6IncotermCode')?.value||'',place=clean($('fpR13A6NamedPlace')?.value||'');
    if(!code||!place){syncIncotermsHint();return false;}
    const next=`${code} ${place} — Incoterms® 2020`,source=$('tradeTerms');if(!source)return false;
    if(clean(source.value)===clean(next)){syncIncotermsHint();return true;}
    fpA11IncotermsSyncing=true;source.value=next;source.dataset.fpUserConfirmed='1';source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));fpA11IncotermsSyncing=false;
    syncIncotermsHint();if(!silent)notify('贸易术语已同步到当前单据。','ok');return true;
  }
  function bindA11Incoterms(){
    const box=$('fpR13A6IncotermsBuilder'),source=$('tradeTerms');if(!box||box.dataset.fpA11Bound)return;
    box.dataset.fpA11Bound='1';const button=box.querySelector('[data-r13a6-apply-incoterm]');if(button)button.textContent='同步到单据';
    box.addEventListener('input',event=>{if(!event.target.closest('#fpR13A6IncotermCode,#fpR13A6NamedPlace,#fpR13A6Transport'))return;clearTimeout(fpA11IncotermsTimer);fpA11IncotermsTimer=setTimeout(()=>writeIncotermsFromBuilder({silent:true}),220);});
    box.addEventListener('change',event=>{if(!event.target.closest('#fpR13A6IncotermCode,#fpR13A6NamedPlace,#fpR13A6Transport'))return;writeIncotermsFromBuilder({silent:true});});
    source?.addEventListener('input',()=>{if(!fpA11IncotermsSyncing)syncIncotermsBuilderFromSource();});
    source?.addEventListener('change',()=>{if(!fpA11IncotermsSyncing)syncIncotermsBuilderFromSource();});
    syncIncotermsBuilderFromSource();
  }
  function syncIncotermsHint(){
    const code=$('fpR13A6IncotermCode')?.value||parseTradeTerms().code,transport=$('fpR13A6Transport')?.value||'multimodal',hint=$('fpR13A6IncotermHint');if(!hint)return;
    const mismatch=SEA_ONLY_TERMS.has(code)&&['air','express','rail','truck'].includes(transport);hint.className=mismatch?'warn':'ok';hint.textContent=mismatch?`${code} 通常只用于海运或内河运输；当前运输方式建议复核 FCA、CPT、CIP、DAP 等。`:'请确保指定地点明确，并与报价、PI、合同、商业发票保持一致。';
  }
  function ensureGovernanceCard(){
    const card=document.querySelector('.doc-mode-card>div')||document.querySelector('.doc-mode-card');if(!card)return null;let root=$('fpR13A6Governance');if(root)return root;
    root=document.createElement('section');root.id='fpR13A6Governance';root.className='fp-r13a6-governance';root.innerHTML='<div><b id="fpR13A6GovernanceTitle"></b><p id="fpR13A6GovernanceText"></p></div><div class="fp-r13a6-governance-meta"><span id="fpR13A6ScenarioChip"></span><span id="fpR13A6PaperChip"></span><button type="button" data-r13a6-paper>应用建议版式</button></div>';
    $('docModeEffect')?.insertAdjacentElement('afterend',root);root.addEventListener('click',event=>{if(!event.target.closest('[data-r13a6-paper]'))return;const paper=recommendedPaper();window.FlypigBOXPaperLayout?.setPreference?.(paper,{announce:true});syncGovernanceCard();});return root;
  }
  function syncModeLabels(){
    const type=documentType(),profile=window.FlypigBOXDocumentSchema?.profile?.(type),formal=Boolean(profile?.formalSingleMode);
    document.body.classList.toggle('fp-a13-formal-single-mode',formal);
    qsa('[data-doc-mode]').forEach(button=>{const info=modeInfo(type,button.dataset.docMode);const span=button.querySelector('span'),small=button.querySelector('small');if(span)span.textContent=info.label;if(small)small.textContent=info.description;button.title=info.description||info.label;button.hidden=formal;});
    qsa('[data-v3350-mode]').forEach(button=>{const value=button.dataset.v3350Mode,info=modeInfo(type,value),active=value===currentMode();button.textContent=info.label;button.title=info.description||info.label;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.hidden=formal;});
    const title=document.querySelector('.doc-mode-card h2');if(title)title.textContent=formal?(profile?.formalLabel||'正规单据结构'):'单据专业模式';
  }
  function syncGovernanceCard(){
    const root=ensureGovernanceCard();if(!root)return;const type=documentType(),info=modeInfo(type,currentMode()),scenario=$('tradeScenario')?.value||'wholesale',rule=window.FlypigBOXDocumentSchema?.scenarioRules?.[scenario],paper=recommendedPaper(),current=$('paperOrientation')?.value||'auto';
    $('fpR13A6GovernanceTitle').textContent=`${DOC_LABELS[type]||type} · ${info.label}`;$('fpR13A6GovernanceText').textContent=info.description||DOCUMENT_SEMANTICS[type]?.paper||'';$('fpR13A6ScenarioChip').textContent=`场景：${rule?.label||scenario}`;$('fpR13A6PaperChip').textContent=`建议：A4 ${paper==='landscape'?'横版':'竖版'}${current==='auto'?'（当前自适应）':current===paper?'（已采用）':'（当前不同）'}`;
    root.querySelector('[data-r13a6-paper]').hidden=current===paper;
  }
  function syncProfessionalGovernance(){syncModeLabels();syncSemanticLabels();ensureIncotermsBuilder();bindA11Incoterms();syncIncotermsBuilderFromSource();markLogisticsGroups();syncGovernanceCard();document.dispatchEvent(new CustomEvent('HUIDI:operator-labels-refresh',{detail:{source:'professional-governance'}}));}

  function ensureReuseCenter(){
    const root=$('fpV3315ToolsRoot');if(!root)return false;
    const main=root.querySelector('.fp-v3315-drawer main');if(!main)return false;
    qsa(':scope>section',main).forEach(section=>{
      if(!['fpV3339DocumentGuide','fpV3341ReuseCenter','fpV3318FieldSettings'].includes(section.id))section.classList.add('fp-v3341-hide-legacy');
    });
    let center=$('fpV3341ReuseCenter');
    if(!center){
      center=document.createElement('section');center.id='fpV3341ReuseCenter';center.className='fp-v3341-reuse-center';
      center.innerHTML=`
        <button type="button" class="fp-v3339-guide-button" data-v3339-guide><span>单据与版本说明</span><small>了解用途、专业模式、场景字段和隐藏原因</small></button>
        <button type="button" class="fp-v3339-guide-button" data-fp3341-save-metadata><span>修改保存名称与内部备注</span><small>正常保存会自动生成；只有需要自定义时再修改</small></button>
        <details id="fpV3341SellerDefaultDetails">
          <summary>默认卖方资料</summary>
          <div class="fp-v3341-reuse-body">
            <p id="fpV3341SellerDefaultState" class="fp-v3341-note"></p>
            <div id="fpV3341SellerCurrent" class="fp-v3341-current-grid"></div>
            <label class="fp-v3341-check"><input id="fpV3341UseSellerDefault" type="checkbox">勾选后保存：以后打开新单据时，自动填充当前卖方资料的空白字段；不会覆盖导入或已填写内容。</label>
            <div class="fp-v3341-actions"><button type="button" class="primary" data-fp3341-save-default-seller>保存当前卖方为默认</button><button type="button" data-fp3341-apply-default-seller>立即填充空白字段</button></div>
          </div>
        </details>
        <details id="fpV3341PersonalTemplatesDetails">
          <summary>个人资料模板</summary>
          <div class="fp-v3341-reuse-body">
            <p class="fp-v3341-note">把经常重复填写的卖方、买方、物流、收款、条款或签章配置保存为个人模板。模板同时记录当前单据类型、专业模式、业务场景和纸张选择；“填充空白”不会覆盖当前内容。</p>
            <div class="fp-v3341-template-form">
              <label>模板分类<select id="fpV3341TemplateCategory">${groupOptions()}</select></label>
              <label>模板名称<input id="fpV3341TemplateName" placeholder="例如：美国客户海运资料、香港收款账户"></label>
              <label>内部备注<textarea id="fpV3341TemplateNote" placeholder="例如：适用于FOB宁波；2026年7月已核对"></textarea></label>
              <div class="fp-v3341-actions"><button type="button" class="primary" data-fp3341-save-template>保存当前分类为个人模板</button></div>
            </div>
            <div id="fpV3341TemplateList" class="fp-v3341-template-list"></div>
          </div>
        </details>`;
      main.prepend(center);
      center.addEventListener('toggle',()=>{updateDefaultSellerView(center);renderTemplateList(center);},true);
      center.addEventListener('click',event=>{
        if(event.target.closest('[data-fp3341-save-metadata]')){window.FlypigBOXSmartSave?.openSettings?.();return;}
        if(event.target.closest('[data-fp3341-save-default-seller]')){saveDefaultSeller(center);return;}
        if(event.target.closest('[data-fp3341-apply-default-seller]')){autoFillDefaultSeller();updateDefaultSellerView(center);notify('已使用默认卖方资料填充空白字段。','ok');return;}
        if(event.target.closest('[data-fp3341-save-template]')){savePersonalTemplate(center);return;}
        const card=event.target.closest('[data-template-id]');
        if(card&&event.target.closest('[data-fp3341-template-apply]')){applyTemplate(center,card.dataset.templateId,event.target.closest('[data-fp3341-template-apply]').dataset.fp3341TemplateApply);return;}
        if(card&&event.target.closest('[data-fp3341-template-delete]')){deleteTemplate(center,card.dataset.templateId);return;}
      });
    }
    updateDefaultSellerView(center);renderTemplateList(center);
    return true;
  }
  function enhanceDrawerOnOpen(){setTimeout(()=>{ensureReuseCenter();},30);}

  function updateVersion(){
    const badge=$('fpLiteVersion');
    if(badge){badge.textContent='HUIDI';badge.title='外贸单据工作台';}
    document.body.dataset.fpDocumentGovernanceRelease='r1.3a.18.30';
  }
  function boot(){
    if(!$('piForm'))return;
    removeDuplicateLogisticsGuidance();installReliableNavigation();updateVersion();
    setTimeout(()=>{autoFillDefaultSeller();syncModeExperience();ensureReuseCenter();syncProfessionalGovernance();updateVersion();},1500);
    window.addEventListener('click',event=>{if(event.target.closest?.('#fpLiteMoreMenu>summary'))enhanceDrawerOnOpen();},true);
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-doc-mode],[data-v3350-mode],[data-v3321-mode],[data-v3315-drawer-mode]'))setTimeout(syncModeExperience,100);
    },true);
    document.addEventListener('change',event=>{
      if(['docMode','documentType','tradeScenario','paperOrientation','shippingMethod','tradeTerms','showOrigin','showCustomerPo','showQuote','showMoq','showSalesperson','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature'].includes(event.target?.id))setTimeout(syncModeExperience,70);
    },true);
    document.addEventListener('HUIDI:document-type-changed',()=>setTimeout(syncModeExperience,80));document.addEventListener('HUIDI:preview-rendered',()=>setTimeout(()=>{markLogisticsGroups();syncGovernanceCard();},0));document.addEventListener('HUIDI:paper-orientation-change',()=>setTimeout(syncGovernanceCard,0));
    [500,1300,2600].forEach(ms=>setTimeout(()=>{removeDuplicateLogisticsGuidance();syncModeExperience();updateVersion();},ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
