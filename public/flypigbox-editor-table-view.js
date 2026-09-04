/* HUIDI V3.3.1.9 — Chinese-first entry, real default/detailed fields and unified output language
   Canonical data remains in the existing form controls. This view mirrors and edits
   those controls, so PDF templates, autosave, histories and Supabase workflows stay unchanged. */
(() => {
  'use strict';

  const VIEW_FIELD_ID = 'editorViewMode';
  const VIEW_STORAGE_KEY = 'flypigbox_editor_view_mode_v1';
  const SPLIT_STORAGE_PREFIX = 'flypigbox_editor_split_v322_';
  const COLUMN_STORAGE_PREFIX = 'flypigbox_product_columns_v322_';
  const CUSTOM_FIELDS_ID = 'customDocumentFieldsJson';
  const GRID_SCROLL_STORAGE_PREFIX = 'flypigbox_grid_scroll_v324_';
  const INTERNAL_DRAWER_ID = 'fpInternalToolsDrawerRoot';
  const ENTRY_LAYOUT_STORAGE_KEY = 'flypigbox_table_entry_layout_v33';
  const TABLE_SHEET_LAYOUT_STORAGE_KEY = 'flypigbox_table_sheet_layout_v3314';
  const ENGLISH_ASSIST_STORAGE_KEY = 'flypigbox_entry_english_assist_v3318';
  const LAYOUT_STORAGE_PREFIX = 'flypigbox_layout_v331_';
  const SECTION_TEMPLATE_STORAGE_KEY = 'flypigbox_section_templates_v3312';
  const $ = id => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const numberValue = value => Number(value || 0) || 0;
  function outputLanguage(){return canonicalInput('docLanguage')?.value || 'bilingual';}
  function englishAssistEnabled(){try{return localStorage.getItem(ENGLISH_ASSIST_STORAGE_KEY)==='1';}catch(_){return false;}}
  // RC16.4: table-mode section and field labels follow the selected customer document language.
  // The canonical form data stays unchanged; only labels/workbook presentation are localized.
  function currentLanguage(){return outputLanguage();}
  function localizedLabel(label,mode=currentLanguage()){
    const text=String(label??'').trim();if(!text)return text;
    const i18n=window.HUIDIDocI18n;if(i18n?.localizeLabel)return i18n.localizeLabel(text,mode);
    if(mode==='bilingual')return text;const parts=text.split(/\s*\/\s*/).map(part=>part.trim()).filter(Boolean);if(parts.length<2)return text;
    const hasZh=part=>/[㐀-鿿]/.test(part);if(mode==='zh')return parts.filter(hasZh).join(' / ')||parts[0]||text;return parts.filter(part=>!hasZh(part)).join(' / ')||parts[parts.length-1]||text;
  }
  function localizedText(zh,en,mode=currentLanguage()){const i18n=window.HUIDIDocI18n;return i18n?.text?i18n.text(zh,en,mode):(mode==='zh'?zh:mode==='en'?en:`${zh} / ${en}`);}

  const DOCUMENT_TYPES = [
    ['quotation', '报价单'],
    ['proforma_invoice', '形式发票（PI）'],
    ['commercial_invoice', '商业发票（CI）'],
    ['packing_list', '装箱单（PL）'],
    ['sales_contract', '销售合同']
  ];

  const BASIC_FIELDS = [
    ['docLanguage','PDF 输出语言 / PDF Language'],['currency','主币种 / Currency'],['originCountry','原产国 / Country of Origin'],['invoiceNo','单据编号 / Document No.'],
    ['revisionNo','修订版本 / Revision'],['documentStatus','单据状态 / Document Status'],['tradeScenario','业务场景 / Trade Scenario'],['issueDate','出单日期 / Issue Date'],
    ['validUntil','有效期 / Valid Until'],['customerPo','客户 PO 编号 / Customer PO No.'],['quoteNo','报价编号 / Quotation No.'],['moq','整单 MOQ / Order MOQ'],
    ['salesperson','业务员 / Salesperson'],['preparedBy','制单人 / Prepared by'],['approvedBy','审核人 / Approved by']
  ];

  const PARTY_FIELDS = [
    ['sellerName','卖方公司 / Seller'],['buyerName','买方公司 / Buyer'],
    ['sellerContact','卖方联系人 / Seller Contact'],['buyerContact','买方联系人 / Buyer Contact'],
    ['sellerPhone','卖方电话 / Seller Phone'],['buyerPhone','买方电话 / Buyer Phone'],
    ['sellerEmail','卖方邮箱 / Seller Email'],['buyerEmail','买方邮箱 / Buyer Email'],
    ['sellerAddress','卖方地址 / Seller Address'],['buyerAddress','买方地址 / Buyer Address'],
    ['sellerTaxId','卖方税号 / Seller Tax ID'],['buyerTaxId','买方税号 / Buyer Tax ID'],
    ['buyerCountry','买方国家 / Buyer Country'],['buyerCountryCode','ISO 国家代码 / ISO Code'],
    ['buyerWebsite','买方网站 / Buyer Website'],['destinationPort','目的地 / 目的港 / Destination']
  ];

  const DELIVERY_FIELDS = [
    ['consigneeName','收货人公司 / Consignee'],['consigneeContact','收货人联系人 / Consignee Contact'],['consigneePhone','收货人电话 / Consignee Phone'],['consigneeEmail','收货人邮箱 / Consignee Email'],
    ['consigneeAddress','收货人地址 / Consignee Address'],['notifyPartyName','通知方 / Notify Party'],['notifyPartyContact','通知方联系人 / Notify Contact'],['notifyPartyPhone','通知方电话 / Notify Phone'],
    ['notifyPartyEmail','通知方邮箱 / Notify Email'],['notifyPartyAddress','通知方地址 / Notify Address'],['billToAddress','账单地址 / Bill To'],['shipToAddress','送货地址 / Ship To']
  ];

  const COST_FIELDS = [
    ['extraFeeName','附加费用名称 / Extra Fee'],['extraFeeAmount','附加费用金额 / Extra Fee Amount'],['taxAmount','税费 / VAT'],
    ['discountType','折扣方式 / Discount Type'],['discountValue','折扣值 / Discount Value'],['amountWordsOverride','金额大写覆盖 / Amount in Words']
  ];

  const LOGISTICS_FIELDS = [
    ['shippingMethod','运输方式 / Shipping Method'],['packageCount','总箱数 / Packages'],['packageType','包装类型 / Package Type'],['netWeight','总净重 / N.W. (KG)'],
    ['grossWeight','总毛重 / G.W. (KG)'],['cbm','总体积 / CBM'],['logisticsCarrier','承运人 / 货代 / Carrier'],['trackingNo','追踪号 / 运单号 / Tracking No.'],
    ['blNo','提单号 / B/L No.'],['containerNo','柜号 / Container No.'],['sealNo','封条号 / Seal No.'],['vesselFlight','船名 / 航班 / 车次 / Vessel / Flight'],
    ['etd','ETD'],['eta','ETA'],['packageDimensions','单箱尺寸 / Carton Dimensions'],['shippingMarks','运输唛头 / Shipping Marks']
  ];

  const PAYMENT_FIELDS = [
    ['paymentTemplate','收款渠道 / Payment Channel'],['bankBeneficiary','收款人 / 账户名 / Beneficiary'],['bankName','开户行 / Bank Name'],['bankAccount','银行账号 / Account No.'],
    ['bankSwift','SWIFT'],['bankAddress','银行地址 / 付款备注 / Bank Address']
  ];

  const TERMS_FIELDS = [
    ['paymentTerms','付款条款 / Payment Terms'],['tradeTerms','贸易术语 / Incoterms®'],['deliveryTime','交期 / Lead Time'],['portOfLoading','装运港 / Port of Loading'],
    ['estimatedShipment','预计发货日期 / Estimated Shipment'],['remarks','补充备注 / Remarks'],['contractClauses','合同补充条款 / Contract Clauses']
  ];

  const FACTORY_FIELDS = [
    ['productionStartCondition','生产启动条件 / Production Start'],['sampleApproval','样品确认 / Sample Approval'],['artworkApproval','图稿 / 包装确认 / Artwork Approval'],['inspectionStandard','检验标准 / Inspection Standard'],
    ['qualityTolerance','尺寸 / 颜色 / 工艺公差 / Tolerance'],['packagingConfirmation','包装确认要求 / Packaging Approval'],['warrantyTerms','质保与售后 / Warranty'],['factoryDeliveryNote','工厂交付补充说明 / Factory Delivery Note']
  ];

  const MODE_FIELD_IDS = {
    basic:new Set(['docLanguage','currency','originCountry','invoiceNo','issueDate','validUntil','customerPo','quoteNo','moq','salesperson']),
    parties:new Set(['sellerName','buyerName','sellerContact','buyerContact','sellerPhone','buyerPhone','sellerEmail','buyerEmail','sellerAddress','buyerAddress']),
    delivery:new Set(['consigneeName','consigneeContact','consigneePhone','consigneeAddress','shipToAddress']),
    costs:new Set(['extraFeeAmount','taxAmount','discountValue']),
    logistics:new Set(['shippingMethod','packageCount','netWeight','grossWeight','cbm','trackingNo']),
    payment:new Set(['paymentTemplate','bankBeneficiary','bankName','bankAccount','bankSwift']),
    terms:new Set(['paymentTerms','tradeTerms','deliveryTime','remarks']),
    factory:new Set([])
  };
  const DOCUMENT_ENTRY_PROFILES = {
    quotation:{
      sectionLabels:{basic:'报价信息',parties:'客户与卖方',products:'报价商品',terms:'报价与交付条件',more:'物流与补充资料'},
      groups:{basic:true,parties:true,delivery:false,costs:true,logistics:true,payment:false,terms:true},
      fields:{basic:new Set(['docLanguage','currency','originCountry','invoiceNo','revisionNo','documentStatus','tradeScenario','issueDate','validUntil','customerPo','quoteNo','moq','salesperson','preparedBy','approvedBy']),terms:new Set(['paymentTerms','tradeTerms','deliveryTime','portOfLoading','estimatedShipment','remarks'])}
    },
    proforma_invoice:{
      sectionLabels:{basic:'形式发票信息',parties:'买卖双方',products:'订单商品',terms:'付款与交付条件',more:'收货、物流与收款'},
      groups:{basic:true,parties:true,delivery:true,costs:true,logistics:true,payment:true,terms:true},
      fields:{basic:new Set(['docLanguage','currency','originCountry','invoiceNo','revisionNo','documentStatus','tradeScenario','issueDate','validUntil','customerPo','quoteNo','salesperson','preparedBy','approvedBy'])}
    },
    commercial_invoice:{
      sectionLabels:{basic:'发票与清关信息',parties:'出口方与收货方',products:'清关商品',terms:'清关与运输说明',more:'收货与物流资料'},
      groups:{basic:true,parties:true,delivery:true,costs:true,logistics:true,payment:false,terms:true},
      fields:{basic:new Set(['docLanguage','currency','originCountry','invoiceNo','revisionNo','documentStatus','issueDate','customerPo','salesperson','preparedBy','approvedBy']),terms:new Set(['tradeTerms','portOfLoading','estimatedShipment','remarks'])}
    },
    packing_list:{
      sectionLabels:{basic:'装箱信息',parties:'发货方与收货方',products:'包装与箱单明细',terms:'装运备注',more:'收货与物流资料'},
      groups:{basic:true,parties:true,delivery:true,costs:false,logistics:true,payment:false,terms:true},
      fields:{basic:new Set(['docLanguage','originCountry','invoiceNo','revisionNo','documentStatus','issueDate','customerPo','preparedBy','approvedBy']),terms:new Set(['portOfLoading','estimatedShipment','remarks'])}
    },
    sales_contract:{
      sectionLabels:{basic:'合同信息',parties:'合同双方',products:'合同商品',terms:'合同条款',more:'交付、收款与签署资料'},
      groups:{basic:true,parties:true,delivery:true,costs:true,logistics:true,payment:true,terms:true},
      fields:{basic:new Set(['docLanguage','currency','originCountry','invoiceNo','revisionNo','documentStatus','tradeScenario','issueDate','validUntil','customerPo','quoteNo','salesperson','preparedBy','approvedBy'])}
    }
  };
  function documentEntryProfile(){return DOCUMENT_ENTRY_PROFILES[currentDocumentType()]||DOCUMENT_ENTRY_PROFILES.proforma_invoice;}
  function documentGroupEnabled(group){const value=documentEntryProfile().groups?.[group];return value!==false;}
  function documentFieldAllowed(group,id){const allowed=documentEntryProfile().fields?.[group];return !allowed||allowed.has(id);}
  function documentSectionLabel(key,fallback=''){return documentEntryProfile().sectionLabels?.[key]||fallback;}
  const ALL_FIELD_GROUPS = {basic:BASIC_FIELDS,parties:PARTY_FIELDS,delivery:DELIVERY_FIELDS,costs:COST_FIELDS,logistics:LOGISTICS_FIELDS,payment:PAYMENT_FIELDS,terms:TERMS_FIELDS,factory:FACTORY_FIELDS};
  const SECTION_TEMPLATE_FIELDS = {
    basic:BASIC_FIELDS.map(row=>row[0]),
    parties:PARTY_FIELDS.map(row=>row[0]),
    delivery:DELIVERY_FIELDS.map(row=>row[0]),
    costs:COST_FIELDS.map(row=>row[0]),
    logistics:LOGISTICS_FIELDS.map(row=>row[0]),
    payment:PAYMENT_FIELDS.map(row=>row[0]),
    terms:TERMS_FIELDS.map(row=>row[0]),
    more:[...DELIVERY_FIELDS,...COST_FIELDS,...LOGISTICS_FIELDS,...PAYMENT_FIELDS].map(row=>row[0])
  };
  const PRODUCT_TEMPLATE_COLUMNS = [
    ['sku','.i-sku'],['name','.i-name'],['spec','.i-spec'],['hs','.i-hs'],['unit','.i-unit'],['qty','.i-qty'],['moq','.i-moq'],['price','.i-price'],
    ['cartonNo','.i-carton-no'],['packageDescription','.i-package-desc'],['netWeight','.i-net-weight'],['grossWeight','.i-gross-weight'],['cbm','.i-cbm'],['dimensions','.i-dimensions'],['shippingMarks','.i-item-marks']
  ];
  function readSectionTemplates(){try{return JSON.parse(localStorage.getItem(SECTION_TEMPLATE_STORAGE_KEY)||'{}')||{};}catch(_){return {};}}
  function writeSectionTemplates(value){try{localStorage.setItem(SECTION_TEMPLATE_STORAGE_KEY,JSON.stringify(value));return true;}catch(_){showTemplateMessage('模板保存失败','浏览器本机存储不可用，请检查隐私模式或存储权限。');return false;}}
  function showTemplateMessage(title,message,{section='',emptyTemplate=false}={}){
    let dialog=$('fpSectionTemplateMessageDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='fpSectionTemplateMessageDialog';dialog.className='fp-section-template-dialog';document.body.appendChild(dialog);}
    const actions=emptyTemplate?`<button type="button" class="primary" data-template-empty-save="${escapeHTML(section)}">保存当前为模板</button><button type="button" class="secondary" data-template-open-center>打开模板/样式</button><button type="button" class="secondary" data-template-message-close>取消</button>`:`<button type="button" class="primary" data-template-message-close>知道了</button>`;
    dialog.innerHTML=`<div class="inner"><button type="button" class="fp-template-dialog-close" data-template-message-close aria-label="关闭">×</button><h3>${escapeHTML(title)}</h3><p>${escapeHTML(message)}</p><div class="fp-template-dialog-note">“套用本类模板”只加载以前保存的本类资料；粘贴并识别新内容请使用对应分栏的“粘贴识别”按钮。</div><div class="actions">${actions}</div></div>`;
    dialog.onclick=event=>{
      if(event.target.closest('[data-template-message-close]')){dialog.close?.();return;}
      const save=event.target.closest('[data-template-empty-save]');if(save){dialog.close?.();saveSectionTemplate(save.dataset.templateEmptySave);return;}
      if(event.target.closest('[data-template-open-center]')){dialog.close?.();document.getElementById('fpV3321TemplateHeader')?.click();return;}
    };
    try{if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.style.display='block';}}catch(_){dialog.setAttribute('open','');dialog.style.display='block';}
  }
  function sectionTemplateKey(section){return `${currentDocumentType()}:${section}`;}
  function captureProductTemplateRows(){return canonicalRows().map(row=>{const item={image:row.dataset.image||''};PRODUCT_TEMPLATE_COLUMNS.forEach(([key,selector])=>{const input=row.querySelector(selector);item[key]=input?.value??'';});return item;}).filter(item=>{
    const nonDefaultUnit=clean(item.unit)&&clean(item.unit).toUpperCase()!=='PCS';
    const nonDefaultQty=clean(item.qty)&&Number(item.qty)!==1;
    return Boolean(item.image||clean(item.sku)||clean(item.name)||clean(item.spec)||clean(item.hs)||clean(item.moq)||numberValue(item.price)||clean(item.cartonNo)||clean(item.packageDescription)||numberValue(item.netWeight)||numberValue(item.grossWeight)||numberValue(item.cbm)||clean(item.dimensions)||clean(item.shippingMarks)||nonDefaultUnit||nonDefaultQty);
  });}
  function captureSectionTemplate(section){
    if(section==='products')return {section,documentType:currentDocumentType(),items:captureProductTemplateRows(),savedAt:Date.now()};
    const fields={};(SECTION_TEMPLATE_FIELDS[section]||[]).forEach(id=>{const input=canonicalInput(id);if(!input)return;fields[id]=input.type==='checkbox'?Boolean(input.checked):input.value;});
    return {section,documentType:currentDocumentType(),fields,savedAt:Date.now()};
  }
  function saveSectionTemplate(section){
    const payload=captureSectionTemplate(section);
    const count=section==='products'?(payload.items?.length||0):Object.values(payload.fields||{}).filter(value=>clean(value)||value===true).length;
    if(!count){showTemplateMessage('没有可保存的内容','请先填写当前分栏，再点击“保存本类为模板”。');return;}
    const store=readSectionTemplates();store[sectionTemplateKey(section)]=payload;
    if(writeSectionTemplates(store)){
      const message=section==='products'?`已保存 ${payload.items.length} 行商品。以后点击“套用商品模板”即可填入。`:'已保存当前分栏为模板。以后点击“套用本类模板”即可加载以前保存的内容。';
      notify(message,'ok');showTemplateMessage('模板保存成功',message);
    }
  }
  function applyFieldTemplate(payload,mode){Object.entries(payload.fields||{}).forEach(([id,value])=>{const input=canonicalInput(id);if(!input)return;const current=input.type==='checkbox'?input.checked:clean(input.value);if(mode==='fill'&&(current||input.type==='checkbox'))return;if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value??'';flushCanonical(input,input.tagName==='SELECT'||input.type==='checkbox'?'change':'input');});}
  function writeProductRow(row,item,mode){if(!row)return;PRODUCT_TEMPLATE_COLUMNS.forEach(([key,selector])=>{const input=row.querySelector(selector);if(!input)return;const current=clean(input.value);if(mode==='fill'&&current)return;input.value=item[key]??'';dispatchCanonical(input,input.tagName==='SELECT'?'change':'input');});if(item.image&&(mode==='overwrite'||!row.dataset.image)){row.dataset.image=item.image;const label=row.querySelector('.file-name');if(label)label.textContent='已从模板带入';row.querySelector('.i-name,.i-sku,.i-spec')?.dispatchEvent(new Event('input',{bubbles:true}));}}
  function applyProductTemplate(payload,mode){const items=Array.isArray(payload.items)?payload.items:[];if(!items.length)return false;if(mode==='overwrite'){const state=window.FlypigBOXApp?.formState?.(true);if(state){state.items=items.map((item,index)=>({itemKey:`template_${Date.now()}_${index}`,...item}));window.FlypigBOXApp?.applyState?.(state);window.setTimeout(()=>{renderTableEditor();window.FlypigBOXTableOutput?.refresh?.({force:true});window.FlypigBOXApp?.renderPreview?.();},100);return true;}}
    if(items.length>canonicalRows().length)addRows(items.length-canonicalRows().length,false);window.setTimeout(()=>{items.forEach((item,index)=>writeProductRow(canonicalRows()[index],item,'fill'));renderTableEditor();window.FlypigBOXTableOutput?.refresh?.();window.FlypigBOXApp?.renderPreview?.();},90);return true;}
  function applySectionTemplate(section,mode='fill'){const payload=readSectionTemplates()[sectionTemplateKey(section)];if(!payload){notify('当前单据类型还没有保存这一分类的模板。','error');return;}if(section==='products')applyProductTemplate(payload,mode);else{applyFieldTemplate(payload,mode);renderTableEditor();window.FlypigBOXTableOutput?.refresh?.();window.FlypigBOXApp?.renderPreview?.();}notify(mode==='overwrite'?'已覆盖当前分类内容。':'已仅填充当前分类的空白内容。','ok');}
  function sectionTemplateDialog(section){
    const labels={basic:'基础信息',parties:'买卖双方',products:'商品明细',delivery:'收货与地址',costs:'费用与金额',logistics:'物流信息',payment:'收款账户',terms:'交易条件',more:'更多资料'};
    const payload=readSectionTemplates()[sectionTemplateKey(section)];
    if(!payload){showTemplateMessage('还没有保存过本类模板',`这里用于加载你以前保存的“${labels[section]||'当前分栏'}”资料，不是粘贴识别。你可以先填写当前内容并保存为模板，或使用分栏里的“粘贴识别”处理新资料。`,{section,emptyTemplate:true});return;}
    let dialog=$('fpSectionTemplateDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='fpSectionTemplateDialog';dialog.className='fp-section-template-dialog';document.body.appendChild(dialog);}
    dialog.innerHTML=`<div class="inner"><h3>套用“${escapeHTML(labels[section]||section)}”模板</h3><p>这里会调用你之前保存的本类模板，不是剪贴板识别。建议选择“只填空白”，避免覆盖当前已经填写的资料。</p><div class="actions"><button type="button" class="primary" data-template-mode="fill">只填空白</button><button type="button" class="danger" data-template-mode="overwrite">覆盖本类</button><button type="button" class="secondary" data-template-mode="cancel">取消</button></div></div>`;
    dialog.onclick=event=>{const mode=event.target.closest('[data-template-mode]')?.dataset.templateMode;if(!mode)return;if(mode==='cancel'){dialog.close?.();return;}if(mode==='overwrite'&&!window.confirm('确认覆盖当前分类已经填写的内容？其他分类不会受影响。'))return;dialog.close?.();applySectionTemplate(section,mode);};
    try{if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.style.display='block';}}catch(_){dialog.setAttribute('open','');dialog.style.display='block';}
  }
  function layoutStorageKey(){ return `${LAYOUT_STORAGE_PREFIX}${currentDocumentType()}`; }
  function layoutConfig(){
    let local={};
    try { local=JSON.parse(localStorage.getItem(layoutStorageKey())||'{}')||{}; } catch (_) {}
    const brand=window.FlypigBOXBranding?.get?.()||{};
    const brandLayout=brand.layoutProfiles?.[currentDocumentType()]||{};
    const current=window.FlypigBOXLayoutCurrent?.[currentDocumentType()]||{};
    return {...brandLayout,...local,...current,fields:{...(brandLayout.fields||{}),...(local.fields||{}),...(current.fields||{})},columns:{...(brandLayout.columns||{}),...(local.columns||{}),...(current.columns||{})},hiddenColumns:{...(brandLayout.hiddenColumns||{}),...(local.hiddenColumns||{}),...(current.hiddenColumns||{})}};
  }
  function orderedByKeys(items,keys,keyOf){
    if(!Array.isArray(keys)||!keys.length)return items;
    const rank=new Map(keys.map((key,index)=>[String(key),index]));
    return [...items].sort((a,b)=>(rank.has(String(keyOf(a)))?rank.get(String(keyOf(a))):9999)-(rank.has(String(keyOf(b)))?rank.get(String(keyOf(b))):9999));
  }
  function orderedFields(group,rows){ return orderedByKeys(rows,layoutConfig().fields?.[group],row=>row[0]); }
  function mainSectionOrder(){const defaults=['basic','parties','products','terms','more'];const config=layoutConfig().sections||[];const moreKeys=new Set(['delivery','logistics','payment','signature','ai']);const rank=new Map();config.forEach((key,index)=>{if(moreKeys.has(key)){if(!rank.has('more'))rank.set('more',index)}else if(defaults.includes(key)&&!rank.has(key))rank.set(key,index)});return [...defaults].sort((a,b)=>(rank.get(a)??9999)-(rank.get(b)??9999));}
  function orderedSections(rows){const keys=rows.map(row=>row.key);const order=keys.includes('more')?mainSectionOrder():layoutConfig().sections;return orderedByKeys(rows,order,row=>row.key); }
  function orderedProductColumns(rows){ const cfg=layoutConfig(); const hidden=new Set(cfg.hiddenColumns?.products||[]); const required=new Set(['image','sku','name','spec','qty','unit','price','amount']); return orderedByKeys(rows.filter(row=>required.has(row.key)||!hidden.has(row.key)),cfg.columns?.products,row=>row.key); }
  function fieldsForMode(group) {
    if(!documentGroupEnabled(group))return [];
    const all = (ALL_FIELD_GROUPS[group] || []).filter(([id]) => documentFieldAllowed(group,id));
    if (isDetailedMode()) return orderedFields(group,all);
    const core = MODE_FIELD_IDS[group] || new Set();
    // 默认版只显示当前单据真正需要的常用字段；切换单据会同步改变字段集合。
    return orderedFields(group,all.filter(([id]) => core.has(id)));
  }
  function groupHasContent(group) { return sectionHasContent(ALL_FIELD_GROUPS[group] || []); }

  function ensureCustomFieldStore() {
    let field = canonicalInput(CUSTOM_FIELDS_ID);
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.id = CUSTOM_FIELDS_ID;
      field.value = '[]';
      $('piForm')?.appendChild(field);
    }
    return field;
  }

  function customFields() {
    try {
      const parsed = JSON.parse(ensureCustomFieldStore().value || '[]');
      return Array.isArray(parsed) ? parsed.filter(row => row && typeof row === 'object') : [];
    } catch (_) { return []; }
  }

  function customFieldsFor(group) {
    return customFields().filter(row => row.group === group);
  }

  function saveCustomFields(rows, {dispatch = true} = {}) {
    const field = ensureCustomFieldStore();
    field.value = JSON.stringify(rows);
    if (!dispatch) return;
    window.clearTimeout(customFieldsDispatchTimer);
    customFieldsDispatchTimer = window.setTimeout(() => {
      syncingFromTable = true;
      try { dispatchCanonical(field, 'input'); } finally { syncingFromTable = false; }
    }, 160);
  }

  function customRowsHTML(group) {
    const rows = customFieldsFor(group);
    return rows.map(row => `<tr class="fp-custom-field-row" data-custom-field-id="${escapeHTML(row.id)}"><th><input type="text" data-custom-field-prop="label" value="${escapeHTML(row.label || '')}" aria-label="自定义字段名称"></th><td colspan="3"><div class="fp-custom-field-value"><textarea data-custom-field-prop="value" aria-label="自定义字段内容">${escapeHTML(row.value || '')}</textarea><button type="button" data-custom-field-delete="${escapeHTML(row.id)}">删除</button></div></td></tr>`).join('');
  }

  function customProgress(group) {
    const rows = customFieldsFor(group);
    return {filled: rows.filter(row => clean(row.value)).length, total: rows.length};
  }

  let currentView = 'form';
  let currentEntryLayout = (() => { try { return localStorage.getItem(ENTRY_LAYOUT_STORAGE_KEY) === 'horizontal' ? 'horizontal' : 'standard'; } catch (_) { return 'standard'; } })();
  let currentSheetLayout = (() => { try { return localStorage.getItem(TABLE_SHEET_LAYOUT_STORAGE_KEY) === 'wide' ? 'wide' : 'standard'; } catch (_) { return 'standard'; } })();
  let syncingFromTable = false;
  let renderTimer = 0;
  let itemObserver = null;
  let statePoll = null;
  let lastContextKey = '';
  const sectionOpenState = new Map();
  let activeSectionKey = 'products';
  const selectedProductRows = new Set();
  let lastRenderSnapshot = null;
  let composingControl = null;
  const canonicalDispatchTimers = new Map();
  let customFieldsDispatchTimer = 0;
  let activeColumnResize = null;
  let activeSplitResize = null;
  let previewLocateTimer = 0;
  let internalSectionsCache = [];
  let internalDrawerLastFocus = null;

  function canonicalInput(id) { return $(id); }
  function canonicalRows() { return qsa('#itemList .item-row'); }
  function currentDocumentType() { return canonicalInput('documentType')?.value || 'proforma_invoice'; }
  function isPackingList() { return currentDocumentType() === 'packing_list'; }
  function isDetailedMode() { return canonicalInput('docMode')?.value === 'b2b'; }
  function currentPaper() { return canonicalInput('paperOrientation')?.value || 'auto'; }
  function fieldVisible(id) { const input = canonicalInput(id); return input ? Boolean(input.checked) : false; }

  function notify(message, type = 'ok') {
    if (window.FlypigBOXApp?.setStatus) window.FlypigBOXApp.setStatus(message, type);
  }

  function ensureHiddenField() {
    let field = canonicalInput(VIEW_FIELD_ID);
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.id = VIEW_FIELD_ID;
      field.value = 'form';
      $('piForm')?.appendChild(field);
    }
    return field;
  }

  function createViewSwitcher() {
    const workbench = document.querySelector('.workbench');
    if (!workbench || $('fpEditorViewSwitcher')) return;
    const section = document.createElement('section');
    section.id = 'fpEditorViewSwitcher';
    section.className = 'card fp-editor-view-switch-card';
    section.innerHTML = `
      <div class="fp-editor-view-switch-copy">
        <div><b>工作方式 / Workspace</b><span>同一份数据，按需要切换逐项核对或 Excel 式批量处理。</span></div>
      </div>
      <div class="fp-editor-view-segment" role="group" aria-label="切换单据编辑方式">
        <button class="fp-editor-view-button active" type="button" data-editor-view="form"><span>表单核对</span><small>资料库、签章与高级设置</small></button>
        <button class="fp-editor-view-button" type="button" data-editor-view="table"><span>表格工作台</span><small>整表识别、批量录入与Excel</small></button>
      </div>
      <div class="fp-editor-view-state" id="fpEditorViewState">当前：表单核对</div>`;
    workbench.parentNode.insertBefore(section, workbench);
    section.addEventListener('click', event => {
      const button = event.target.closest('[data-editor-view]');
      if (button) setViewMode(button.dataset.editorView, {announce:true, persist:true});
    });
  }

  function createTableWorkspace() {
    const column = document.querySelector('.form-column');
    if (!column || $('fpTableEditorWorkspace')) return;
    const section = document.createElement('section');
    section.id = 'fpTableEditorWorkspace';
    section.className = 'card fp-table-editor-workspace';
    section.innerHTML = `
      <header class="fp-table-editor-head">
        <div class="fp-table-editor-headline">
          <div><p class="fp-table-kicker">外贸单据工作区</p><h2>外贸表格工作台</h2><p>优先处理商品和关键业务资料。整张旧单据可直接识别；精细字段按需打开，不要求逐项填写。</p></div>
          <div class="fp-table-editor-actions">
            <button class="fp-table-editor-action primary" type="button" data-table-action="smart-import">✨ 智能导入原单据</button>
            <button class="fp-table-editor-action" type="button" data-table-action="add-item">＋ 添加商品</button>
            <button class="fp-table-editor-action" type="button" data-table-action="add-field">＋ 添加字段或说明</button>
          </div>
        </div>
        <div class="fp-table-editor-toolbar">
          <label><span data-table-toolbar-label="document">单据类型</span><select data-table-document-type></select></label>
          <label><span data-table-toolbar-label="language">客户文件语言</span><select data-table-language><option value="bilingual">中英双语</option><option value="zh">中文</option><option value="en">English</option></select></label>
          <label><span data-table-toolbar-label="entry">录入布局</span><select data-table-entry-layout><option value="standard">标准分栏</option><option value="horizontal">横向录入</option></select></label>
          <label><span data-table-toolbar-label="fields">字段版本</span><select data-table-doc-mode><option value="ecommerce">默认版 · 常用字段</option><option value="b2b">精细版 · 完整字段</option></select></label>
          <label><span data-table-toolbar-label="sheet">表格方向</span><select data-table-sheet-layout><option value="standard">纵向紧凑</option><option value="wide">横向宽表</option></select></label>
          <label class="fp-table-english-assist"><span>英文术语辅助</span><input type="checkbox" data-table-english-assist></label>
          <button class="fp-table-brand-button" type="button" data-table-action="brand-template">品牌与模板</button>
        </div>
        <div class="fp-table-flow-strip" aria-label="推荐使用步骤"><span><b>1</b>整表粘贴或智能识别</span><span><b>2</b>核对商品和关键字段</span><span><b>3</b>右侧预览并导出 PDF / Excel</span></div>
        <div id="fpSmartSheetImportMount"></div>
      </header>
      <div class="fp-table-editor-body" id="fpTableEditorBody"></div>
      <dialog class="fp-custom-field-dialog" id="fpCustomFieldDialog">
        <form method="dialog">
          <header><div><b>添加字段或补充说明</b><small>空白内容不会进入预览或导出。</small></div><button value="cancel" aria-label="关闭">×</button></header>
          <label>显示位置<select id="fpCustomFieldGroup"><option value="basic">基础信息</option><option value="parties">买卖双方</option><option value="delivery">收货与地址</option><option value="logistics">物流与包装</option><option value="payment">收款信息</option><option value="terms">条款与备注</option></select></label>
          <label>字段名称<input id="fpCustomFieldLabel" type="text" placeholder="例如：客户项目编号"></label>
          <label>内容<textarea id="fpCustomFieldValue" placeholder="填写后会同步到右侧预览和导出文件"></textarea></label>
          <footer><button value="cancel">取消</button><button type="button" class="primary" id="fpCustomFieldSave">添加到当前单据</button></footer>
        </form>
      </dialog>`;
    column.insertBefore(section, column.firstChild);
    section.addEventListener('input', handleTableInput);
    section.addEventListener('change', handleTableInput);
    section.addEventListener('click', handleTemplateClickCapture, true);
    section.addEventListener('click', handleTableClick);
    section.addEventListener('paste', handleProductPaste);
    section.addEventListener('keydown', handleGridKeyboard);
    section.addEventListener('compositionstart', event => { composingControl = event.target; }, true);
    section.addEventListener('compositionend', event => { composingControl = null; flushMirrorControl(event.target); }, true);
    section.addEventListener('focusin', handleTableFocus, true);
    section.addEventListener('focusout', event => flushMirrorControl(event.target), true);
    section.addEventListener('pointerdown', handleColumnResizeStart);
    section.addEventListener('dblclick', handleColumnAutoFit);
    section.addEventListener('scroll', handleWorkspaceScroll, true);
    $('fpCustomFieldSave')?.addEventListener('click', saveCustomFieldFromDialog);
  }

  function originalOptionsHTML(input) {
    if (!input || input.tagName !== 'SELECT') return '';
    return Array.from(input.options).map(option => `<option value="${escapeHTML(option.value)}" ${option.value === input.value ? 'selected' : ''}>${escapeHTML(option.textContent)}</option>`).join('');
  }

  function boundControlHTML(id, {textarea = false} = {}) {
    const input = canonicalInput(id);
    if (!input) return '<span class="fp-sheet-empty">—</span>';
    const label = input.getAttribute('aria-label') || input.placeholder || id;
    if(id==='tradeTerms'){
      const list=document.getElementById(input.getAttribute('list')||'incotermsOptions');
      const options=Array.from(list?.options||[]).map(option=>`<option value="${escapeHTML(option.value)}">${escapeHTML(option.value)}</option>`).join('');
      return `<div class="fp-table-incoterms-group"><select data-incoterms-preset aria-label="选择常用贸易术语"><option value="">选择常用 Incoterms® 2020</option>${options}</select><input type="text" data-bind-id="tradeTerms" value="${escapeHTML(input.value)}" list="incotermsOptions" placeholder="选择后仍可修改指定地点" class="fp-table-incoterms-input" aria-label="${escapeHTML(label)}"></div>`;
    }
    if (input.tagName === 'SELECT') return `<select data-bind-id="${escapeHTML(id)}" aria-label="${escapeHTML(label)}">${originalOptionsHTML(input)}</select>`;
    if (input.type === 'checkbox') return `<input type="checkbox" data-bind-id="${escapeHTML(id)}" ${input.checked ? 'checked' : ''} aria-label="${escapeHTML(label)}">`;
    const placeholder = input.placeholder ? ` placeholder="${escapeHTML(input.placeholder)}"` : '';
    const list = input.getAttribute('list') ? ` list="${escapeHTML(input.getAttribute('list'))}"` : '';
    const autocomplete = input.getAttribute('autocomplete') ? ` autocomplete="${escapeHTML(input.getAttribute('autocomplete'))}"` : '';
    if (input.tagName === 'TEXTAREA' || textarea) return `<textarea data-bind-id="${escapeHTML(id)}" aria-label="${escapeHTML(label)}"${placeholder}>${escapeHTML(input.value)}</textarea>`;
    const type = ['date','number','email'].includes(input.type) ? input.type : 'text';
    const attrs = type === 'number' ? ` min="${escapeHTML(input.min || '0')}" step="${escapeHTML(input.step || 'any')}"` : '';
    const className = id === 'tradeTerms' ? ' class="fp-table-incoterms-input"' : '';
    return `<input type="${type}" data-bind-id="${escapeHTML(id)}" value="${escapeHTML(input.value)}"${attrs}${placeholder}${list}${autocomplete}${className} aria-label="${escapeHTML(label)}">`;
  }

  function sectionHasContent(fields = []) {
    return fields.some(([id]) => {
      const input = canonicalInput(id);
      if (!input) return false;
      if (input.type === 'checkbox') return input.checked;
      return clean(input.value) !== '';
    });
  }

  function resolvedSectionOpen(key, defaultOpen, fields = []) {
    if (sectionOpenState.has(key)) return sectionOpenState.get(key);
    return Boolean(defaultOpen || sectionHasContent(fields));
  }

  function fieldOrderControls(group,id,index,total){return `<span class="fp-inline-field-order" aria-label="调整字段顺序"><button type="button" data-field-order-move="-1" data-field-order-group="${escapeHTML(group)}" data-field-order-id="${escapeHTML(id)}" ${index===0?'disabled':''} title="上移字段">↑</button><button type="button" data-field-order-move="1" data-field-order-group="${escapeHTML(group)}" data-field-order-id="${escapeHTML(id)}" ${index===total-1?'disabled':''} title="下移字段">↓</button></span>`;}
  function fieldHeadingHTML(group,row,index,total){return `<div class="fp-sheet-field-heading"><button type="button" class="fp-sheet-locate-button" data-locate-field="${escapeHTML(row[0])}" title="点击定位右侧预览">${escapeHTML(localizedLabel(row[1]))}</button>${fieldOrderControls(group,row[0],index,total)}</div>`;}

  function sectionOrderControls(key){const order=mainSectionOrder(),index=order.indexOf(key);if(index<0)return '';return `<span class="fp-inline-section-order" aria-label="调整分栏顺序"><button type="button" data-section-order-move="-1" data-section-order-key="${escapeHTML(key)}" ${index===0?'disabled':''} title="上移分栏">↑</button><button type="button" data-section-order-move="1" data-section-order-key="${escapeHTML(key)}" ${index===order.length-1?'disabled':''} title="下移分栏">↓</button></span>`;}
  function contextActionButton(action,label,{primary=false,danger=false}={}){return `<button type="button" class="fp-panel-context-button${primary?' primary':''}${danger?' danger':''}" data-table-source-action="${escapeHTML(action)}">${escapeHTML(localizedLabel(label))}</button>`;}
  function sectionContextActions(key,{templates=true,addCustom=false}={}){
    const buttons=[];
    if(['basic','parties','products','terms','more'].includes(key))buttons.push(sectionOrderControls(key));
    if(key==='basic'){buttons.push(contextActionButton('save-defaults','保存默认资料'),contextActionButton('save-template','保存整份单据模板'));}
    if(key==='parties'){buttons.push(contextActionButton('buyer-paste','粘贴识别买方',{primary:true}),contextActionButton('customer','客户库'),contextActionButton('save-customer','保存客户'));}
    if(key==='products'){buttons.push(contextActionButton('products','粘贴或导入商品',{primary:true}));}
    if(key==='terms'){buttons.push(contextActionButton('terms','粘贴或插入条款',{primary:true}));}
    if(['delivery','costs','logistics','more'].includes(key)){buttons.push(`<button type="button" class="fp-panel-context-button primary" data-table-action="paste-recognize" data-paste-section="${escapeHTML(key)}">粘贴识别</button>`);}
    if(key==='payment'){buttons.push(contextActionButton('payment-paste','粘贴识别收款',{primary:true}),contextActionButton('payment','收款模板'),contextActionButton('save-payment','保存收款模板'));}
    if(templates){buttons.push(`<button type="button" class="fp-panel-template-button" data-table-action="apply-section-template" data-template-section="${escapeHTML(key)}" title="加载以前保存的本类资料，不是粘贴识别">套用本类模板</button>`,`<button type="button" class="fp-panel-template-button" data-table-action="save-section-template" data-template-section="${escapeHTML(key)}" title="把当前分栏资料保存，供以后重复使用">保存本类为模板</button>`);}
    if(addCustom)buttons.push(`<button type="button" class="fp-panel-add-field" data-table-action="add-field" data-custom-group="${escapeHTML(key)}">${escapeHTML(localizedText('＋ 添加字段','＋ Add field'))}</button>`);
    return `<div class="fp-panel-actions fp-panel-context-actions">${buttons.join('')}</div>`;
  }

  function pairSection(key, title, fields) {
    const valid = fields.filter(([id]) => canonicalInput(id));
    const customs = customFieldsFor(key);
    if (!valid.length && !customs.length) return '';
    const rows = [];
    for (let index = 0; index < valid.length; index += 2) {
      const left = valid[index];
      const right = valid[index + 1];
      rows.push(`<tr><th>${fieldHeadingHTML(key,left,index,valid.length)}</th><td>${boundControlHTML(left[0], {textarea: canonicalInput(left[0])?.tagName === 'TEXTAREA'})}</td>${right ? `<th>${fieldHeadingHTML(key,right,index+1,valid.length)}</th><td>${boundControlHTML(right[0], {textarea: canonicalInput(right[0])?.tagName === 'TEXTAREA'})}</td>` : '<th></th><td class="fp-sheet-empty">—</td>'}</tr>`);
    }
    const canAddCustom = ['basic','parties','delivery','logistics','payment','terms'].includes(key);
    const contextActions=sectionContextActions(key,{templates:SECTION_TEMPLATE_FIELDS[key]!==undefined,addCustom:canAddCustom});
    return `<section class="fp-sheet-panel" data-section-key="${escapeHTML(key)}"><header class="fp-sheet-panel-head"><div><h3>${escapeHTML(localizedLabel(title))}</h3><p>${escapeHTML(localizedText('只需填写当前业务真正需要的内容；空白可选字段不会进入正式文件。','Only completed business fields appear in the final workbook.'))}</p></div>${contextActions}</header><div class="fp-sheet-scroll"><table class="fp-sheet-table fp-sheet-pair-table"><tbody>${rows.join('')}${customRowsHTML(key)}</tbody></table></div></section>`;
  }

  function horizontalSection(key, title, fields) {
    const valid = fields.filter(([id]) => canonicalInput(id));
    const customs = customFieldsFor(key);
    if (!valid.length && !customs.length) return '';
    const headers = valid.map((row,index) => `<th>${fieldHeadingHTML(key,row,index,valid.length)}</th>`).join('') + customs.map(row => `<th>${escapeHTML(row.label || '补充字段')}</th>`).join('');
    const values = valid.map(([id]) => `<td>${boundControlHTML(id,{textarea:canonicalInput(id)?.tagName==='TEXTAREA'})}</td>`).join('') + customs.map(row => `<td><textarea data-custom-field-id="${escapeHTML(row.id)}" data-custom-field-prop="value">${escapeHTML(row.value || '')}</textarea></td>`).join('');
    const contextActions=sectionContextActions(key,{templates:SECTION_TEMPLATE_FIELDS[key]!==undefined,addCustom:['basic','parties','delivery','logistics','payment','terms'].includes(key)});
    return `<section class="fp-sheet-panel fp-horizontal-entry-section" data-section-key="${escapeHTML(key)}"><header class="fp-sheet-panel-head"><div><h3>${escapeHTML(localizedLabel(title))}</h3><p>${escapeHTML(localizedText('字段横向排列；可使用 Tab 向右录入，空白字段不会进入输出。','Fields run horizontally; use Tab to move right. Blank fields are omitted.'))}</p></div>${contextActions}</header><div class="fp-sheet-scroll"><table class="fp-sheet-table fp-horizontal-entry-table"><thead><tr>${headers}</tr></thead><tbody><tr>${values}</tr></tbody></table></div></section>`;
  }

  function horizontalMoreSections() {
    const sections=[];
    if (fieldsForMode('delivery').length || customFieldsFor('delivery').length) sections.push(horizontalSection('delivery','收货、通知与地址 / Delivery Parties',fieldsForMode('delivery')));
    if (!isPackingList() && (fieldsForMode('costs').length || customFieldsFor('costs').length)) sections.push(horizontalSection('costs','费用、折扣与金额 / Fees & Totals',fieldsForMode('costs')));
    if (fieldVisible('showLogistics') || groupHasContent('logistics') || customFieldsFor('logistics').length) sections.push(horizontalSection('logistics','物流信息 / Logistics Details',fieldsForMode('logistics')));
    if (!isPackingList() && (fieldVisible('showPayment') || groupHasContent('payment') || customFieldsFor('payment').length)) sections.push(horizontalSection('payment','收款账户 / Payment Details',fieldsForMode('payment')));
    return sections.join('');
  }

  function fieldProgress(fields = []) {
    const available = fields.filter(([id]) => canonicalInput(id));
    const filled = available.filter(([id]) => {
      const input = canonicalInput(id);
      return input?.type === 'checkbox' ? input.checked : clean(input?.value);
    }).length;
    return {filled,total:available.length};
  }

  function tabButton(section) {
    const progress = section.progress || {filled:0,total:0};
    const active = section.key === activeSectionKey;
    const status = progress.filled ? `${progress.filled}` : '0';
    return `<button type="button" class="fp-sheet-tab ${active ? 'active' : ''}" data-table-section="${escapeHTML(section.key)}" aria-pressed="${active}"><span>${escapeHTML(localizedLabel(section.short))}</span><small>${status}${section.key === 'products' ? ' 行' : ` / ${progress.total}`}</small></button>`;
  }

  function captureRenderSnapshot() {
    const workspace = $('fpTableEditorWorkspace');
    if (!workspace) return null;
    qsa('.fp-sheet-panel[data-section-key]', workspace).forEach(details => sectionOpenState.set(details.dataset.sectionKey, details.open));
    const active = document.activeElement?.closest?.('#fpTableEditorWorkspace [data-bind-id],#fpTableEditorWorkspace [data-grid-row][data-grid-col]');
    const focus = active ? {
      bindId:active.dataset.bindId || '',
      row:active.dataset.gridRow || '',
      col:active.dataset.gridCol || '',
      start:typeof active.selectionStart === 'number' ? active.selectionStart : null,
      end:typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    } : null;
    const scrolls = {};
    qsa('.fp-sheet-panel[data-section-key]', workspace).forEach(details => {
      const scroller = details.querySelector('.fp-sheet-scroll');
      if (scroller) scrolls[details.dataset.sectionKey] = {left:scroller.scrollLeft,top:scroller.scrollTop};
    });
    return {focus,scrolls};
  }

  function restoreRenderSnapshot(snapshot) {
    if (!snapshot) return;
    const workspace = $('fpTableEditorWorkspace');
    Object.entries(snapshot.scrolls || {}).forEach(([key,pos]) => {
      const scroller = workspace?.querySelector(`.fp-sheet-panel[data-section-key="${CSS.escape(key)}"] .fp-sheet-scroll`);
      if (scroller) { scroller.scrollLeft = pos.left || 0; scroller.scrollTop = pos.top || 0; }
    });
    const focus = snapshot.focus;
    if (!focus) return;
    let target = focus.bindId ? workspace?.querySelector(`[data-bind-id="${CSS.escape(focus.bindId)}"]`) : null;
    if (!target && focus.row !== '') target = workspace?.querySelector(`[data-grid-row="${CSS.escape(focus.row)}"][data-grid-col="${CSS.escape(focus.col)}"]`);
    if (target) {
      target.focus({preventScroll:true});
      if (focus.start !== null && target.setSelectionRange) {
        const max = String(target.value || '').length;
        target.setSelectionRange(Math.min(focus.start,max),Math.min(focus.end ?? focus.start,max));
      }
    }
  }

  function bindSectionState() {
    const workspace = $('fpTableEditorWorkspace');
    qsa('.fp-sheet-panel[data-section-key]', workspace).forEach(details => {
      details.addEventListener('toggle', () => sectionOpenState.set(details.dataset.sectionKey, details.open));
    });
  }

  function productColumnStorageKey() {
    return `${COLUMN_STORAGE_PREFIX}${currentDocumentType()}_${isDetailedMode() ? 'detail' : 'quick'}`;
  }

  function loadProductColumnWidths() {
    try { return JSON.parse(localStorage.getItem(productColumnStorageKey()) || '{}') || {}; } catch (_) { return {}; }
  }

  function saveProductColumnWidths(widths) {
    try { localStorage.setItem(productColumnStorageKey(), JSON.stringify(widths)); } catch (_) {}
  }

  function productColumnHasValue(selector, {numeric = false} = {}) {
    return canonicalRows().some(row => {
      const value = row.querySelector(selector)?.value;
      return numeric ? numberValue(value) !== 0 : clean(value) !== '';
    });
  }

  function productColumns() {
    const type=currentDocumentType();
    const packing = type==='packing_list';
    const detailed = isDetailedMode();
    const columns = [
      {key:'image',label:'产品图片 / Image',image:true,width:112},
      {key:'sku',label:'货号 / SKU',selector:'.i-sku',width:132},
      {key:'name', label:'商品名称 / Product', selector:'.i-name', width:210},
      {key:'spec', label:'规格 / 描述 / Specifications', selector:'.i-spec', width:220}
    ];
    if (['commercial_invoice','packing_list'].includes(type) || fieldVisible('showHsCode') || productColumnHasValue('.i-hs')) columns.push({key:'hs',label:'海关编码（HS Code）',selector:'.i-hs',width:126});
    columns.push({key:'unit',label:'单位 / Unit',selector:'.i-unit',width:88},{key:'qty',label:'数量 / Qty',selector:'.i-qty',width:92,type:'number'});
    if (['quotation','proforma_invoice'].includes(type) && (fieldVisible('showMoq') || productColumnHasValue('.i-moq',{numeric:true}))) columns.push({key:'moq',label:'最小起订量（MOQ）',selector:'.i-moq',width:112});
    if (!packing) {
      columns.push({key:'price',label:'单价 / Unit Price',selector:'.i-price',width:112,type:'number'});
      columns.push({key:'amount',label:'金额 / Amount',readonly:true,width:122});
    }
    const optional = [
      {key:'cartonNo',label:'箱号 / Carton No.',selector:'.i-carton-no',width:112},
      {key:'packageDescription',label:'包装说明 / Packing',selector:'.i-package-desc',width:150},
      {key:'netWeight',label:'净重 / N.W. KG',selector:'.i-net-weight',width:98,type:'number'},
      {key:'grossWeight',label:'毛重 / G.W. KG',selector:'.i-gross-weight',width:98,type:'number'},
      {key:'cbm',label:'CBM',selector:'.i-cbm',width:90,type:'number'},
      {key:'dimensions',label:'单箱尺寸 / Dimensions',selector:'.i-dimensions',width:150},
      {key:'shippingMarks',label:'本行唛头 / Shipping Marks',selector:'.i-item-marks',width:155}
    ];
    optional.forEach(column => {
      if (packing || detailed || productColumnHasValue(column.selector,{numeric:column.type==='number'})) columns.push(column);
    });
    const saved = loadProductColumnWidths();
    return orderedProductColumns(columns).map(column => ({...column,width:Math.max(64,Math.min(520,Number(saved[column.key]) || column.width || 100))}));
  }

  function productCellHTML(row, rowIndex, column, columnIndex) {
    if (column.readonly) {
      const qty = numberValue(row.querySelector('.i-qty')?.value);
      const price = numberValue(row.querySelector('.i-price')?.value);
      const currency = canonicalInput('currency')?.value || 'USD';
      return `<td class="fp-sheet-readonly" data-product-amount>${escapeHTML(currency)} ${(qty * price).toFixed(2)}</td>`;
    }
    if (column.image) {
      const image = row.dataset.image || '';
      const label = clean(row.querySelector('.file-name')?.textContent) || (image ? '已上传' : '添加图片');
      return `<td><button type="button" class="fp-sheet-image-button" data-table-image-row="${rowIndex}" title="点击上传或更换产品图片">${image?`<img src="${escapeHTML(image)}" alt="${escapeHTML(label)}">`:`<span class="fp-image-empty">＋ 添加图片</span>`}</button></td>`;
    }
    const input = row.querySelector(column.selector);
    if (!input) return '<td class="fp-sheet-empty">—</td>';
    const common = `data-item-row="${rowIndex}" data-item-selector="${escapeHTML(column.selector)}" data-grid-row="${rowIndex}" data-grid-col="${columnIndex}"`;
    if (input.tagName === 'SELECT') {
      const options = Array.from(input.options).map(option => `<option value="${escapeHTML(option.value)}" ${option.value === input.value ? 'selected' : ''}>${escapeHTML(option.textContent)}</option>`).join('');
      return `<td><select ${common}>${options}</select></td>`;
    }
    const type = column.type === 'number' || input.type === 'number' ? 'number' : 'text';
    const attrs = type === 'number' ? ` min="${escapeHTML(input.min || '0')}" step="${escapeHTML(input.step || 'any')}"` : '';
    return `<td><input type="${type}" ${common} value="${escapeHTML(input.value)}"${attrs}></td>`;
  }

  function productSection() {
    const rows = canonicalRows();
    const columns = productColumns();
    const colgroup = `<col class="fp-fixed-select-col"><col class="fp-fixed-row-col">${columns.map(column => `<col data-product-col="${escapeHTML(column.key)}" style="width:${column.width}px;min-width:${column.width}px">`).join('')}<col class="fp-fixed-action-col">`;
    const visibleColumnKeys=columns.map(column=>column.key);
    const header = columns.map((column,index) => `<th data-column-key="${escapeHTML(column.key)}"><div class="fp-product-column-heading"><button type="button" class="fp-sheet-locate-button" data-locate-product-key="${escapeHTML(column.key)}" title="点击定位右侧对应列">${escapeHTML(localizedLabel(column.label))}</button><span class="fp-inline-column-order" aria-label="调整商品列顺序"><button type="button" data-product-column-move="-1" data-product-column-key="${escapeHTML(column.key)}" data-product-visible-columns="${escapeHTML(visibleColumnKeys.join(','))}" ${index===0?'disabled':''} title="左移一列">←</button><button type="button" data-product-column-move="1" data-product-column-key="${escapeHTML(column.key)}" data-product-visible-columns="${escapeHTML(visibleColumnKeys.join(','))}" ${index===columns.length-1?'disabled':''} title="右移一列">→</button></span></div><i class="fp-column-resizer" data-column-resizer="${escapeHTML(column.key)}" title="拖动调整列宽；双击自动适宽"></i></th>`).join('');
    const body = rows.map((row, rowIndex) => `<tr data-product-table-row="${rowIndex}" class="${selectedProductRows.has(rowIndex)?'is-selected':''}"><td class="fp-sheet-select"><input type="checkbox" data-table-select-row="${rowIndex}" ${selectedProductRows.has(rowIndex)?'checked':''} aria-label="选择第 ${rowIndex+1} 行"></td><td class="fp-sheet-row-no">${rowIndex + 1}</td>${columns.map((column, columnIndex) => productCellHTML(row,rowIndex,column,columnIndex)).join('')}<td class="fp-sheet-action-cell"><button class="fp-sheet-delete-row" type="button" data-table-delete-row="${rowIndex}" title="删除这一行">×</button></td></tr>`).join('');
    const totalQty = rows.reduce((sum,row) => sum + numberValue(row.querySelector('.i-qty')?.value), 0);
    const totalAmount = rows.reduce((sum,row) => sum + numberValue(row.querySelector('.i-qty')?.value) * numberValue(row.querySelector('.i-price')?.value), 0);
    const currency = canonicalInput('currency')?.value || 'USD';
    const selected = selectedProductRows.size;
    return `<section class="fp-sheet-panel fp-product-panel" data-section-key="products"><header class="fp-sheet-panel-head"><div><h3>${escapeHTML(documentSectionLabel('products','商品明细'))}</h3><p>当前单据类型会使用对应的商品列和正式输出结构；可拖动表头边缘调整列宽。</p></div><div class="fp-product-bulk-actions">${sectionOrderControls('products')}<span>${rows.length} ${escapeHTML(localizedText('行','rows'))} · ${escapeHTML(localizedText('数量','Qty'))} ${totalQty.toFixed(2)}${isPackingList()?'':` · ${escapeHTML(currency)} ${totalAmount.toFixed(2)}`}</span>${contextActionButton('products','导入商品 / Import products',{primary:true})}<button type="button" data-table-action="apply-section-template" data-template-section="products">套用商品模板</button><button type="button" data-table-action="save-section-template" data-template-section="products">保存商品为模板</button><button type="button" data-table-action="add-item">＋ 1 ${escapeHTML(localizedText('行','row'))}</button><button type="button" data-table-action="add-10">＋ 10 ${escapeHTML(localizedText('行','rows'))}</button>${selected?`<button type="button" data-table-action="duplicate-selected">${escapeHTML(localizedText('复制','Duplicate'))} ${selected} ${escapeHTML(localizedText('行','rows'))}</button><button type="button" class="danger" data-table-action="delete-selected">${escapeHTML(localizedText('删除','Delete'))} ${selected} ${escapeHTML(localizedText('行','rows'))}</button>`:''}</div></header><div class="fp-table-spreadsheet-help"><span><b>快速粘贴：</b>点击任一单元格后粘贴 Excel 区域；整张旧单据请使用上方“智能导入原单据”。</span></div><div class="fp-sheet-scroll"><table class="fp-sheet-table fp-product-sheet"><colgroup>${colgroup}</colgroup><thead><tr><th class="fp-sheet-select"><input type="checkbox" data-table-select-all ${rows.length&&selected===rows.length?'checked':''} aria-label="全选商品行"></th><th class="fp-sheet-row-no">#</th>${header}<th class="fp-sheet-action-cell">操作</th></tr></thead><tbody>${body || '<tr><td colspan="99" class="fp-table-mode-empty">暂无商品行</td></tr>'}</tbody><tfoot><tr><td class="fp-sheet-select"></td><td class="fp-sheet-row-no">Σ</td><td colspan="${Math.max(1,columns.length)}">数量合计：${totalQty.toFixed(2)}${isPackingList()?'':`　|　金额合计：${escapeHTML(currency)} ${totalAmount.toFixed(2)}`}</td><td class="fp-sheet-action-cell"></td></tr></tfoot></table></div></section>`;
  }

  function handleColumnResizeStart(event) {
    const handle = event.target.closest('[data-column-resizer]');
    if (!handle || event.button !== 0) return;
    event.preventDefault();
    const key = handle.dataset.columnResizer;
    const table = handle.closest('table');
    const col = table?.querySelector(`col[data-product-col="${CSS.escape(key)}"]`);
    if (!col) return;
    const startWidth = parseFloat(col.style.width) || handle.parentElement.getBoundingClientRect().width;
    activeColumnResize = {key,col,startX:event.clientX,startWidth,table};
    document.body.classList.add('fp-column-resizing');
    const move = moveEvent => {
      if (!activeColumnResize) return;
      const width = Math.max(64,Math.min(520,activeColumnResize.startWidth + moveEvent.clientX - activeColumnResize.startX));
      activeColumnResize.col.style.width = `${width}px`;
      activeColumnResize.col.style.minWidth = `${width}px`;
    };
    const up = () => {
      if (activeColumnResize) {
        const widths = loadProductColumnWidths();
        widths[activeColumnResize.key] = Math.round(parseFloat(activeColumnResize.col.style.width) || activeColumnResize.startWidth);
        saveProductColumnWidths(widths);
      }
      activeColumnResize = null;
      document.body.classList.remove('fp-column-resizing');
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',up);
    };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',up,{once:true});
  }

  function handleColumnAutoFit(event) {
    const handle = event.target.closest('[data-column-resizer]');
    if (!handle) return;
    const key = handle.dataset.columnResizer;
    const table = handle.closest('table');
    const col = table?.querySelector(`col[data-product-col="${CSS.escape(key)}"]`);
    const header = handle.parentElement;
    if (!col || !header) return;
    let chars = clean(header.textContent).length;
    const index = Array.from(header.parentElement.children).indexOf(header) + 1;
    qsa(`tbody tr`,table).forEach(row => {
      const cell = row.children[index];
      const value = cell?.querySelector('input,select,textarea')?.value || cell?.textContent || '';
      chars = Math.max(chars,clean(value).length);
    });
    const width = Math.max(72,Math.min(420,Math.round(chars * 8.2 + 34)));
    col.style.width = `${width}px`; col.style.minWidth = `${width}px`;
    const widths = loadProductColumnWidths(); widths[key] = width; saveProductColumnWidths(widths);
  }

  function renderToolbar() {
    const workspace = $('fpTableEditorWorkspace');
    if (!workspace) return;
    const typeSelect = workspace.querySelector('[data-table-document-type]');
    typeSelect.innerHTML = DOCUMENT_TYPES.map(([value,label]) => `<option value="${value}" ${value === currentDocumentType() ? 'selected' : ''}>${label}</option>`).join('');
    workspace.querySelector('[data-table-doc-mode]').value = canonicalInput('docMode')?.value || 'ecommerce';
    const language = workspace.querySelector('[data-table-language]'); if (language) language.value = outputLanguage();
    const entry = workspace.querySelector('[data-table-entry-layout]'); if (entry) entry.value = currentEntryLayout;
    const sheetLayout=workspace.querySelector('[data-table-sheet-layout]');if(sheetLayout)sheetLayout.value=currentSheetLayout;
    const assist=workspace.querySelector('[data-table-english-assist]');if(assist)assist.checked=englishAssistEnabled();
    const toolbarLabels={document:localizedText('单据类型','Document'),language:localizedText('客户文件语言','Output Language'),entry:localizedText('录入布局','Entry Layout'),fields:localizedText('字段版本','Fields'),sheet:localizedText('表格方向','Sheet Orientation')};
    Object.entries(toolbarLabels).forEach(([key,text])=>{const node=workspace.querySelector(`[data-table-toolbar-label="${key}"]`);if(node)node.textContent=text;});
    const setOptions=(selector,rows)=>{const select=workspace.querySelector(selector);if(!select)return;const current=select.value;select.innerHTML=rows.map(([value,zh,en])=>`<option value="${value}">${escapeHTML(localizedText(zh,en))}</option>`).join('');select.value=current;};
    const languageRows=(window.HUIDIDocI18n?.languages||[['bilingual','中英双语','Bilingual'],['zh','中文','Chinese'],['en','English','English']]).map(([value,label,en])=>[value,label,en]);
    setOptions('[data-table-language]',languageRows);
    setOptions('[data-table-entry-layout]',[['standard','标准分栏','Standard sections'],['horizontal','横向录入','Horizontal entry']]);
    setOptions('[data-table-doc-mode]',[['ecommerce','默认版 · 常用字段','Default · Common fields'],['b2b','精细版 · 完整字段','Detailed · Full fields']]);
    setOptions('[data-table-sheet-layout]',[['standard','纵向紧凑','Portrait compact'],['wide','横向宽表','Landscape wide']]);
    const brand=workspace.querySelector('[data-table-action="brand-template"]');if(brand)brand.textContent=localizedText('品牌与模板','Brand / Templates');
  }

  function combinedProgress(...groups) {
    const rows = groups.flatMap(group => fieldsForMode(group));
    const base = fieldProgress(rows);
    const custom = groups.map(customProgress).reduce((acc,row)=>({filled:acc.filled+row.filled,total:acc.total+row.total}),{filled:0,total:0});
    return {filled:base.filled+custom.filled,total:base.total+custom.total};
  }

  function moreSectionHTML() {
    const parts = [];
    if (documentGroupEnabled('delivery') && (fieldsForMode('delivery').length || customFieldsFor('delivery').length)) parts.push(pairSection('delivery','收货、通知与地址',fieldsForMode('delivery')));
    if (documentGroupEnabled('costs') && (fieldsForMode('costs').length || customFieldsFor('costs').length)) parts.push(pairSection('costs','费用、折扣与金额',fieldsForMode('costs')));
    if (documentGroupEnabled('logistics') && (fieldVisible('showLogistics') || groupHasContent('logistics') || currentDocumentType()==='packing_list' || customFieldsFor('logistics').length)) parts.push(pairSection('logistics',currentDocumentType()==='packing_list'?'包装与物流信息':'物流信息',fieldsForMode('logistics')));
    if (documentGroupEnabled('payment') && (fieldVisible('showPayment') || groupHasContent('payment') || customFieldsFor('payment').length)) parts.push(pairSection('payment','收款账户',fieldsForMode('payment')));
    return `<section class="fp-sheet-panel fp-more-panel" data-section-key="more"><header class="fp-sheet-panel-head"><div><h3>${escapeHTML(documentSectionLabel('more','更多资料'))}</h3><p>${escapeHTML('这里只显示当前单据类型需要的收货、物流、费用或收款资料。')}</p></div>${sectionContextActions('more',{templates:false,addCustom:false})}</header><div class="fp-more-section-stack">${parts.join('') || `<div class="fp-table-mode-empty">当前单据没有额外资料需要填写。</div>`}</div></section>`;
  }

  function renderTableEditor() {
    if (!$('fpTableEditorBody')) return;
    const snapshot = captureRenderSnapshot();
    renderToolbar();
    const primary = orderedSections([
      {key:'basic',short:documentSectionLabel('basic','基础信息'),html:pairSection('basic',documentSectionLabel('basic','基础信息'),fieldsForMode('basic')),progress:combinedProgress('basic')},
      {key:'parties',short:documentSectionLabel('parties','买卖双方'),html:pairSection('parties',documentSectionLabel('parties','买卖双方'),fieldsForMode('parties')),progress:combinedProgress('parties')},
      {key:'products',short:documentSectionLabel('products','商品明细'),html:productSection(),progress:{filled:canonicalRows().filter(row=>clean(row.querySelector('.i-name')?.value)).length,total:canonicalRows().length}},
      {key:'terms',short:documentSectionLabel('terms','交易条件'),html:pairSection('terms',documentSectionLabel('terms','交易条件'),fieldsForMode('terms')),progress:combinedProgress('terms')},
      {key:'more',short:documentSectionLabel('more','更多资料'),html:moreSectionHTML(),progress:combinedProgress('delivery','costs','logistics','payment')}
    ].filter(section=>section.html));
    const internal = [
      {key:'factory',short:'工厂执行',html:pairSection('factory','生产、质量、包装与交付',FACTORY_FIELDS),progress:combinedProgress('factory')},
      {key:'costing',short:'内部核算',html:'<section class="fp-sheet-panel" data-section-key="costing"><header class="fp-sheet-panel-head"><div><h3>工厂内部核算</h3><p>仅限内部使用，不进入客户文件。</p></div></header></section>',progress:{filled:0,total:0}}
    ];
    const all = [...primary,...internal];
    if (!all.some(section=>section.key===activeSectionKey)) activeSectionKey = primary.some(section=>section.key==='products')?'products':primary[0]?.key;
    const active = all.find(section=>section.key===activeSectionKey) || primary[0];
    internalSectionsCache = internal.map(section => ({key:section.key,short:section.short,active:section.key===activeSectionKey}));
    const internalButton = internal.length ? `<button type="button" class="fp-internal-tools-button ${internal.some(section=>section.key===activeSectionKey)?'active':''}" data-table-action="open-internal-tools" aria-haspopup="dialog" aria-controls="${INTERNAL_DRAWER_ID}">内部工具</button>` : '';
    const body = $('fpTableEditorBody');
    const workspace = $('fpTableEditorWorkspace');
    workspace?.classList.toggle('fp-horizontal-entry-mode',currentEntryLayout==='horizontal');
    if (currentEntryLayout === 'horizontal') {
      const horizontalMap = {
        basic:horizontalSection('basic','单据基础信息 / Document Information',fieldsForMode('basic')),
        parties:horizontalSection('parties','买卖双方 / Seller & Buyer',fieldsForMode('parties')),
        products:productSection(),
        terms:horizontalSection('terms','交易、交付与备注 / Terms & Remarks',fieldsForMode('terms')),
        more:horizontalMoreSections()
      };
      const horizontalPrimary = orderedSections(primary).map(section=>horizontalMap[section.key]).filter(Boolean).join('');
      body.innerHTML = `<div class="fp-sheet-nav-wrap fp-horizontal-entry-toolbar"><div class="fp-horizontal-entry-note"><b>横向表格录入</b><span>适合 Excel / WPS 使用习惯；所有区域连续显示，横向滚动位置会保留。</span></div>${internalButton}<div class="fp-sheet-sync-state"><span class="dot"></span>已与正式单据同步</div></div><div class="fp-horizontal-entry-stack">${horizontalPrimary}</div>`;
    } else {
      body.innerHTML = `<div class="fp-sheet-nav-wrap"><nav class="fp-sheet-tabs" aria-label="表格工作区栏目">${primary.map(tabButton).join('')}</nav>${internalButton}<div class="fp-sheet-sync-state"><span class="dot"></span>已与正式单据同步</div></div><div class="fp-sheet-active-panel">${active?.html||''}</div>`;
    }
    workspace?.classList.toggle('fp-costing-active',activeSectionKey==='costing');
    restoreRenderSnapshot(snapshot);
    ensureInternalToolsDrawer();
    updateInternalToolsDrawer();
    restoreRememberedGridScroll(activeSectionKey);
    if (activeSectionKey === 'costing') window.setTimeout(() => window.FlypigBOXTradeFactory?.renderCosting?.(), 0);
    lastContextKey = contextKey();
  }

  function contextKey() {
    return [currentDocumentType(),canonicalInput('docMode')?.value,outputLanguage(),currentPaper(),fieldVisible('showHsCode'),fieldVisible('showMoq'),fieldVisible('showProductImage'),fieldVisible('showLogistics'),fieldVisible('showPayment'),fieldVisible('showTerms'),canonicalRows().length,Boolean($('fpFactoryCostingPanel'))].join('|');
  }

  function scheduleRender(delay = 80) {
    if (currentView !== 'table') return;
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderTableEditor, delay);
  }

  function dispatchCanonical(input, eventName) {
    if (!input) return;
    input.dispatchEvent(new Event(eventName, {bubbles:true}));
  }

  function scheduleCanonicalDispatch(original, eventName = 'input', delay = 150) {
    if (!original) return;
    const old = canonicalDispatchTimers.get(original);
    if (old) window.clearTimeout(old);
    const timer = window.setTimeout(() => {
      canonicalDispatchTimers.delete(original);
      syncingFromTable = true;
      try { dispatchCanonical(original,eventName); } finally { syncingFromTable = false; }
    },delay);
    canonicalDispatchTimers.set(original,timer);
  }

  function flushCanonical(original, eventName = 'input') {
    if (!original) return;
    const timer = canonicalDispatchTimers.get(original);
    if (timer) window.clearTimeout(timer);
    canonicalDispatchTimers.delete(original);
    syncingFromTable = true;
    try { dispatchCanonical(original,eventName); } finally { syncingFromTable = false; }
  }

  function copyValueToCanonical(control, original, eventType = 'input') {
    if (!original) return;
    if (original.type === 'checkbox') original.checked = Boolean(control.checked);
    else original.value = control.value;
    const immediate = eventType === 'change' || control.tagName === 'SELECT' || original.type === 'checkbox';
    if (immediate) flushCanonical(original,control.tagName === 'SELECT' || original.type === 'checkbox' ? 'change' : 'input');
    else if (control !== composingControl) scheduleCanonicalDispatch(original,'input',160);
  }

  function flushMirrorControl(control) {
    if (!control?.dataset) return;
    const bindId = control.dataset.bindId;
    const itemSelector = control.dataset.itemSelector;
    if (bindId) flushCanonical(canonicalInput(bindId),'input');
    if (itemSelector) flushCanonical(canonicalRows()[Number(control.dataset.itemRow)]?.querySelector(itemSelector),'input');
  }

  function updateCustomFieldControl(control) {
    const row = control.closest('[data-custom-field-id]');
    const id = row?.dataset.customFieldId;
    const prop = control.dataset.customFieldProp;
    if (!id || !prop) return false;
    const rows = customFields();
    const target = rows.find(item => item.id === id);
    if (!target) return false;
    target[prop] = control.value;
    saveCustomFields(rows);
    return true;
  }

  function productKeyFromSelector(selector) {
    return productColumns().find(column=>column.selector===selector)?.key || '';
  }

  function previewTargetFromControl(control) {
    if (!control) return null;
    const bindId=control.dataset?.bindId || (control.id && canonicalInput(control.id)===control ? control.id : '');
    if (bindId) return {fieldId:bindId,value:control.value||'',label:clean(control.closest('label')?.textContent||control.getAttribute('aria-label')||bindId)};
    const selector=control.dataset?.itemSelector;
    if (selector) return {itemIndex:Number(control.dataset.itemRow),itemKey:productKeyFromSelector(selector),value:control.value||''};
    const sourceRow=control.closest?.('#itemList .item-row');
    if (sourceRow) {
      const itemIndex=canonicalRows().indexOf(sourceRow);
      const column=productColumns().find(candidate=>candidate.selector&&control.matches(candidate.selector));
      if(itemIndex>=0&&column)return {itemIndex,itemKey:column.key,value:control.value||''};
    }
    return null;
  }

  function locatePreviewForControl(control,{scroll=false,delay=35}={}) {
    const target=previewTargetFromControl(control);
    if(!target||(!target.fieldId&&!target.itemKey))return;
    window.clearTimeout(previewLocateTimer);
    previewLocateTimer=window.setTimeout(()=>window.FlypigBOXTableOutput?.focusPreviewTarget?.(target,{scroll}),delay);
  }

  function ensureInternalToolsDrawer() {
    let root = $(INTERNAL_DRAWER_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = INTERNAL_DRAWER_ID;
    root.className = 'fp-internal-drawer-root';
    root.hidden = true;
    root.innerHTML = `<div class="fp-internal-drawer-backdrop" data-internal-drawer-close></div><aside class="fp-internal-drawer" role="dialog" aria-modal="true" aria-labelledby="fpInternalDrawerTitle"><header><div><b id="fpInternalDrawerTitle">内部工具</b><small>仅内部使用，不进入客户文件</small></div><button type="button" data-internal-drawer-close aria-label="关闭内部工具">×</button></header><div class="fp-internal-drawer-list"></div></aside>`;
    document.body.appendChild(root);
    root.addEventListener('click', event => {
      if (event.target.closest('[data-internal-drawer-close]')) { closeInternalToolsDrawer(); return; }
      const button = event.target.closest('[data-internal-section]');
      if (!button) return;
      activeSectionKey = button.dataset.internalSection;
      closeInternalToolsDrawer({restoreFocus:false});
      renderTableEditor();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !root.hidden) closeInternalToolsDrawer();
    });
    return root;
  }

  function updateInternalToolsDrawer() {
    const root = ensureInternalToolsDrawer();
    const list = root.querySelector('.fp-internal-drawer-list');
    if (!list) return;
    list.innerHTML = internalSectionsCache.map(section => `<button type="button" data-internal-section="${escapeHTML(section.key)}" class="${section.active?'active':''}"><span>${escapeHTML(section.short)}</span><small>${section.key==='costing'?'成本、费用与毛利测算':'生产、质量、包装和交付资料'}</small></button>`).join('') || '<p>当前没有可用的内部工具。</p>';
  }

  function openInternalToolsDrawer(trigger) {
    const root = ensureInternalToolsDrawer();
    internalDrawerLastFocus = trigger || document.activeElement;
    updateInternalToolsDrawer();
    root.hidden = false;
    document.body.classList.add('fp-internal-drawer-open');
    window.requestAnimationFrame(() => {
      root.classList.add('show');
      root.querySelector('.fp-internal-drawer [data-internal-section],.fp-internal-drawer [data-internal-drawer-close]')?.focus({preventScroll:true});
    });
  }

  function closeInternalToolsDrawer({restoreFocus=true}={}) {
    const root = $(INTERNAL_DRAWER_ID);
    if (!root || root.hidden) return;
    root.classList.remove('show');
    document.body.classList.remove('fp-internal-drawer-open');
    window.setTimeout(() => { root.hidden = true; }, 170);
    if (restoreFocus) internalDrawerLastFocus?.focus?.({preventScroll:true});
  }

  function gridScrollStorageKey(section='products') {
    return `${GRID_SCROLL_STORAGE_PREFIX}${section}_${currentDocumentType()}`;
  }

  function gridScrollerFor(control) {
    return control?.closest?.('.fp-sheet-scroll,.fp-cost-table-wrap') || null;
  }

  function rememberGridScroll(scroller, section='products') {
    if (!scroller) return;
    scroller.dataset.fpRememberedLeft = String(scroller.scrollLeft || 0);
    try { sessionStorage.setItem(gridScrollStorageKey(section), String(scroller.scrollLeft || 0)); } catch (_) {}
  }

  function restoreRememberedGridScroll(section='products') {
    const workspace = $('fpTableEditorWorkspace');
    const scroller = section === 'costing' ? $('fpFactoryCostingPanel')?.querySelector('.fp-cost-table-wrap') : workspace?.querySelector(`.fp-sheet-panel[data-section-key="${CSS.escape(section)}"] .fp-sheet-scroll`);
    if (!scroller) return;
    let left = Number(scroller.dataset.fpRememberedLeft || 0);
    try { left = Number(sessionStorage.getItem(gridScrollStorageKey(section))) || left; } catch (_) {}
    scroller.scrollLeft = Math.max(0,left);
  }

  function handleWorkspaceScroll(event) {
    const scroller = event.target;
    if (!scroller?.matches?.('.fp-sheet-scroll')) return;
    const section = scroller.closest('[data-section-key]')?.dataset.sectionKey || activeSectionKey || 'products';
    rememberGridScroll(scroller,section);
  }

  function focusGridCell(target,{scroller,left,vertical=true}={}) {
    if (!target) return false;
    const host = scroller || gridScrollerFor(target);
    const savedLeft = Number.isFinite(left) ? left : (host?.scrollLeft || 0);
    target.focus({preventScroll:true});
    if (vertical && host) {
      const row = target.closest('tr');
      if (row) {
        const top = row.offsetTop, bottom = top + row.offsetHeight;
        if (top < host.scrollTop) host.scrollTop = top;
        else if (bottom > host.scrollTop + host.clientHeight) host.scrollTop = Math.max(0,bottom-host.clientHeight);
      }
      host.scrollLeft = savedLeft;
      rememberGridScroll(host,activeSectionKey || 'products');
    }
    return true;
  }

  function previewTargetForControl(control){
    if(!control)return null;
    if(control.dataset.bindId){const heading=control.closest('tr')?.querySelector(`[data-locate-field="${CSS.escape(control.dataset.bindId)}"]`)||document.querySelector(`[data-locate-field="${CSS.escape(control.dataset.bindId)}"]`);return {fieldId:control.dataset.bindId,value:control.value||'',label:clean(heading?.textContent||control.getAttribute('aria-label')||control.dataset.bindId)};}
    if(control.dataset.itemSelector){const row=Number(control.dataset.itemRow);const columns=productColumns();const col=Number(control.dataset.gridCol);const column=columns[col];if(column)return {itemIndex:row,itemKey:column.key,value:control.value||'',label:column.label};}
    return null;
  }
  function handleTableFocus(event){
    const control=event.target.closest('[data-bind-id],[data-item-selector]');if(!control)return;
    const target=previewTargetForControl(control);if(!target)return;
    clearTimeout(previewLocateTimer);
    const layout=window.FlypigBOXTableOutput?.getSheetLayout?.()||currentSheetLayout||'standard';
    const shouldScroll=layout!=='wide';
    previewLocateTimer=window.setTimeout(()=>{
      window.FlypigBOXTableOutput?.focusPreviewTarget?.(target,{scroll:shouldScroll,behavior:'auto',sticky:true,block:shouldScroll?'center':'nearest',inline:shouldScroll?'center':'nearest'});
    },shouldScroll?85:0);
  }

  function handleTableInput(event) {
    const control = event.target;
    if(control.matches?.('[data-incoterms-preset]')){
      const input=control.closest('.fp-table-incoterms-group')?.querySelector('[data-bind-id="tradeTerms"]');
      if(input&&control.value){input.value=control.value;copyValueToCanonical(input,canonicalInput('tradeTerms'),'change');window.FlypigBOXTableOutput?.focusPreviewTarget?.({fieldId:'tradeTerms',value:input.value,label:'贸易术语（Incoterms® 2020）'},{scroll:false,sticky:true});}
      return;
    }
    if (control.tagName === 'SELECT' && event.type === 'input') return;
    if (control.dataset.customFieldProp) { event.stopPropagation(); updateCustomFieldControl(control); return; }
    const bindId = control.dataset.bindId;
    const itemSelector = control.dataset.itemSelector;
    if (!bindId && !itemSelector) return;
    event.stopPropagation();
    if (bindId) copyValueToCanonical(control, canonicalInput(bindId), event.type);
    if (itemSelector) {
      const row = canonicalRows()[Number(control.dataset.itemRow)];
      copyValueToCanonical(control, row?.querySelector(itemSelector), event.type);
      updateProductRowAmount(control.closest('tr'));
      updateProductTotals();
    }
    if (bindId === 'currency') {
      qsa('#fpTableEditorWorkspace [data-product-table-row]').forEach(updateProductRowAmount);
      updateProductTotals();
    }
    const previewTarget=previewTargetForControl(control);if(previewTarget)window.FlypigBOXTableOutput?.focusPreviewTarget?.(previewTarget,{scroll:false,sticky:true});
  }

  function updateProductRowAmount(tableRow) {
    if (!tableRow) return;
    const index = Number(tableRow.dataset.productTableRow);
    const source = canonicalRows()[index];
    const amount = tableRow.querySelector('[data-product-amount]');
    if (!source || !amount) return;
    const qty = numberValue(source.querySelector('.i-qty')?.value);
    const price = numberValue(source.querySelector('.i-price')?.value);
    amount.textContent = `${canonicalInput('currency')?.value || 'USD'} ${(qty * price).toFixed(2)}`;
  }


  function updateProductTotals() {
    const workspace = $('fpTableEditorWorkspace');
    if (!workspace) return;
    const rows = canonicalRows();
    const totalQty = rows.reduce((sum,row) => sum + numberValue(row.querySelector('.i-qty')?.value), 0);
    const totalAmount = rows.reduce((sum,row) => sum + numberValue(row.querySelector('.i-qty')?.value) * numberValue(row.querySelector('.i-price')?.value), 0);
    const currency = canonicalInput('currency')?.value || 'USD';
    const footer = workspace.querySelector('.fp-product-sheet tfoot td[colspan]');
    if (footer) footer.textContent = `当前商品数量合计：${totalQty.toFixed(2)}${isPackingList() ? '' : `　|　商品金额合计：${currency} ${totalAmount.toFixed(2)}`}`;
    const chips = workspace.querySelectorAll('.fp-table-spreadsheet-help .fp-table-chip');
    if (chips[0]) chips[0].textContent = `${rows.length} 行商品`;
    if (chips[1]) chips[1].textContent = `数量 ${totalQty.toFixed(2)}`;
    if (chips[2]) chips[2].textContent = `商品金额 ${currency} ${totalAmount.toFixed(2)}`;
  }

  function handleTemplateClickCapture(event){
    const button=event.target.closest?.('[data-table-action="save-section-template"],[data-table-action="apply-section-template"]');
    if(!button||!button.closest('#fpTableEditorWorkspace'))return;
    event.preventDefault();event.stopImmediatePropagation();
    const section=button.dataset.templateSection||activeSectionKey;
    if(button.dataset.tableAction==='save-section-template')saveSectionTemplate(section);
    else sectionTemplateDialog(section);
  }

  function handleTableClick(event) {
    const sectionButton = event.target.closest('[data-table-section]');
    if (sectionButton) { activeSectionKey = sectionButton.dataset.tableSection; renderTableEditor(); return; }
    const selectAll = event.target.closest('[data-table-select-all]');
    if (selectAll) { selectedProductRows.clear(); if (selectAll.checked) canonicalRows().forEach((_,i)=>selectedProductRows.add(i)); renderTableEditor(); return; }
    const selectRow = event.target.closest('[data-table-select-row]');
    if (selectRow) { const i=Number(selectRow.dataset.tableSelectRow); selectRow.checked?selectedProductRows.add(i):selectedProductRows.delete(i); renderTableEditor(); return; }
    const sectionMove=event.target.closest('[data-section-order-move]');
    if(sectionMove){const moved=window.FlypigBOXLayoutManager?.moveMainSection?.(sectionMove.dataset.sectionOrderKey,Number(sectionMove.dataset.sectionOrderMove));if(moved)window.setTimeout(renderTableEditor,40);return;}
    const fieldMove=event.target.closest('[data-field-order-move]');
    if(fieldMove){const moved=window.FlypigBOXLayoutManager?.moveField?.(fieldMove.dataset.fieldOrderGroup,fieldMove.dataset.fieldOrderId,Number(fieldMove.dataset.fieldOrderMove));if(moved)window.setTimeout(renderTableEditor,30);return;}
    const columnMove=event.target.closest('[data-product-column-move]');
    if(columnMove){const visible=(columnMove.dataset.productVisibleColumns||'').split(',').filter(Boolean);const moved=window.FlypigBOXLayoutManager?.moveColumn?.('products',columnMove.dataset.productColumnKey,Number(columnMove.dataset.productColumnMove),visible);if(moved)window.setTimeout(renderTableEditor,30);return;}
    const locateField=event.target.closest('[data-locate-field]');
    if(locateField){const id=locateField.dataset.locateField;window.FlypigBOXTableOutput?.focusPreviewTarget?.({fieldId:id,value:canonicalInput(id)?.value||'',label:locateField.textContent},{scroll:true});return;}
    const locateProduct=event.target.closest('[data-locate-product-key]');
    if(locateProduct){window.FlypigBOXTableOutput?.focusPreviewTarget?.({itemIndex:0,itemKey:locateProduct.dataset.locateProductKey},{scroll:true});return;}
    const sourceAction=event.target.closest('[data-table-source-action]')?.dataset.tableSourceAction;
    if(sourceAction){window.FlypigBOXSharedActions?.invoke?.(sourceAction);return;}
    const actionNode=event.target.closest('[data-table-action]');
    const action = actionNode?.dataset.tableAction;
    if(action==='save-section-template'){saveSectionTemplate(actionNode.dataset.templateSection||activeSectionKey);return;}
    if(action==='apply-section-template'){sectionTemplateDialog(actionNode.dataset.templateSection||activeSectionKey);return;}
    if(action==='paste-recognize'){
      const section=actionNode.dataset.pasteSection||activeSectionKey;
      const panel=$('fpSmartImportPanel');
      if(panel){panel.open=true;const text=$('fpSmartPasteText');if(text){text.placeholder=section==='logistics'?'粘贴物流、包装、箱数、重量、体积、港口或运单资料':section==='delivery'?'粘贴收货人、通知方和地址资料':section==='costs'?'粘贴运费、税费、折扣等费用资料':'粘贴当前分类的原始表格或文字资料';}panel.scrollIntoView({behavior:'auto',block:'center'});setTimeout(()=>text?.focus({preventScroll:true}),120);}return;
    }
    if (action === 'open-internal-tools') { openInternalToolsDrawer(event.target.closest('[data-table-action]')); return; }
    if (action === 'brand-template') { window.FlypigBOXTemplateCenter?.open?.({tab:'pdf_brand'}); return; }
    if (action === 'smart-import') { const panel=$('fpSmartImportPanel'); if(panel){panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('fpSmartPasteText')?.focus(),250);} return; }
    if (action === 'add-item') { activeSectionKey='products'; return addRows(1, true); }
    if (action === 'add-10') { activeSectionKey='products'; return addRows(10, true); }
    if (action === 'add-field') { openCustomFieldDialog(event.target.closest('[data-custom-group]')?.dataset.customGroup || activeSectionKey); return; }
    if (action === 'refresh') return renderTableEditor();
    if (action === 'toggle-detail') { const next=isDetailedMode()?'ecommerce':'b2b'; document.querySelector(`[data-doc-mode="${next}"]`)?.click(); scheduleRender(30); return; }
    if (action === 'duplicate-selected') {
      const selected=[...selectedProductRows].sort((a,b)=>a-b); if(!selected.length)return;
      const values=selected.map(i=>{const row=canonicalRows()[i];return productColumns().map(col=>col.selector?row?.querySelector(col.selector)?.value:'');});
      addRows(values.length,false); setTimeout(()=>{const rows=canonicalRows();const start=rows.length-values.length;values.forEach((vals,ri)=>vals.forEach((value,ci)=>setOriginalItemValue(start+ri,productColumns()[ci],value)));selectedProductRows.clear();renderTableEditor();notify(`已复制 ${values.length} 行商品。`,'ok');},100); return;
    }
    if (action === 'delete-selected') { const selected=[...selectedProductRows].sort((a,b)=>b-a); if(!selected.length)return; if(!window.confirm(`确认删除已选择的 ${selected.length} 行商品？`))return; selected.forEach(i=>canonicalRows()[i]?.querySelector('.remove-item')?.click());selectedProductRows.clear();scheduleRender(30);return; }
    if (action === 'form-advanced') {
      setViewMode('form', {announce:true,persist:true});
      document.querySelector('.form-column')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const customDelete = event.target.closest('[data-custom-field-delete]');
    if (customDelete) {
      const id = customDelete.dataset.customFieldDelete;
      saveCustomFields(customFields().filter(row => row.id !== id));
      renderTableEditor();
      notify('已删除自定义字段。','ok');
      return;
    }
    const deleteButton = event.target.closest('[data-table-delete-row]');
    if (deleteButton) {
      const row = canonicalRows()[Number(deleteButton.dataset.tableDeleteRow)];
      row?.querySelector('.remove-item')?.click();
      selectedProductRows.clear();
      scheduleRender(20);
      return;
    }
    const imageButton = event.target.closest('[data-table-image-row]');
    if (imageButton) canonicalRows()[Number(imageButton.dataset.tableImageRow)]?.querySelector('.i-file')?.click();
  }

  function openCustomFieldDialog(group = '') {
    const dialog = $('fpCustomFieldDialog');
    if (!dialog) return;
    const allowed = ['basic','parties','delivery','logistics','payment','terms'];
    const safe = allowed.includes(group) ? group : (group === 'more' ? 'delivery' : 'terms');
    $('fpCustomFieldGroup').value = safe;
    $('fpCustomFieldLabel').value = '';
    $('fpCustomFieldValue').value = '';
    dialog.showModal();
    window.setTimeout(() => $('fpCustomFieldLabel')?.focus(),40);
  }

  function saveCustomFieldFromDialog() {
    const label = clean($('fpCustomFieldLabel')?.value);
    if (!label) { notify('请先填写字段名称。','error'); $('fpCustomFieldLabel')?.focus(); return; }
    const group = $('fpCustomFieldGroup')?.value || 'terms';
    const rows = customFields();
    rows.push({id:`custom_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,group,label,value:$('fpCustomFieldValue')?.value || ''});
    saveCustomFields(rows);
    activeSectionKey = ['basic','parties','terms'].includes(group) ? group : 'more';
    $('fpCustomFieldDialog')?.close();
    renderTableEditor();
    notify('已添加字段；空白内容不会进入预览或导出。','ok');
  }

  function splitStorageKey() {
    return `${SPLIT_STORAGE_PREFIX}${document.body.classList.contains('fp-live-table-mode') ? 'table' : 'document'}`;
  }

  function applyStoredSplit() {
    const workbench = document.querySelector('.workbench');
    if (!workbench || window.innerWidth <= 980) return;
    let percent = document.body.classList.contains('fp-live-table-mode') ? 58 : 44;
    try { percent = Number(localStorage.getItem(splitStorageKey())) || percent; } catch (_) {}
    percent = Math.max(34,Math.min(72,percent));
    workbench.style.setProperty('--fp-left-pane-percent',`${percent}%`);
  }

  function installWorkbenchResizer() {
    const workbench = document.querySelector('.workbench');
    const preview = document.querySelector('.preview-shell');
    if (!workbench || !preview || workbench.querySelector('.fp-workbench-resizer')) return;
    const divider = document.createElement('div');
    divider.className = 'fp-workbench-resizer';
    divider.tabIndex = 0;
    divider.title = '拖动调整填写区与预览区宽度；双击恢复默认';
    divider.innerHTML = '<span></span>';
    workbench.insertBefore(divider,preview);
    divider.addEventListener('pointerdown',event => {
      if (window.innerWidth <= 980 || event.button !== 0) return;
      event.preventDefault();
      activeSplitResize = {startX:event.clientX,rect:workbench.getBoundingClientRect()};
      divider.setPointerCapture?.(event.pointerId);
      document.body.classList.add('fp-split-resizing');
    });
    divider.addEventListener('pointermove',event => {
      if (!activeSplitResize) return;
      const rect = activeSplitResize.rect;
      const percent = Math.max(34,Math.min(72,(event.clientX-rect.left)/rect.width*100));
      workbench.style.setProperty('--fp-left-pane-percent',`${percent}%`);
    });
    const finish = event => {
      if (!activeSplitResize) return;
      const value = parseFloat(workbench.style.getPropertyValue('--fp-left-pane-percent')) || 50;
      try { localStorage.setItem(splitStorageKey(),String(value)); } catch (_) {}
      activeSplitResize = null;
      document.body.classList.remove('fp-split-resizing');
      if (event?.pointerId !== undefined) divider.releasePointerCapture?.(event.pointerId);
    };
    divider.addEventListener('pointerup',finish);
    divider.addEventListener('pointercancel',finish);
    divider.addEventListener('dblclick',() => {
      const percent = document.body.classList.contains('fp-live-table-mode') ? 58 : 44;
      workbench.style.setProperty('--fp-left-pane-percent',`${percent}%`);
      try { localStorage.removeItem(splitStorageKey()); } catch (_) {}
    });
    divider.addEventListener('keydown',event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const current = parseFloat(workbench.style.getPropertyValue('--fp-left-pane-percent')) || 50;
      const next = Math.max(34,Math.min(72,current + (event.key === 'ArrowRight' ? 2 : -2)));
      workbench.style.setProperty('--fp-left-pane-percent',`${next}%`);
      try { localStorage.setItem(splitStorageKey(),String(next)); } catch (_) {}
    });
    window.addEventListener('resize',applyStoredSplit,{passive:true});
    document.addEventListener('HUIDI:editor-view-change',() => window.setTimeout(applyStoredSplit,0));
    applyStoredSplit();
  }

  function addRows(count, focusLast = false) {
    const button = $('addItemBtn');
    if (!button) return;
    for (let index = 0; index < count; index += 1) button.click();
    window.setTimeout(() => {
      renderTableEditor();
      if (focusLast) $('fpTableEditorWorkspace')?.querySelector('tbody tr:last-child [data-grid-col="0"]')?.focus();
    }, 60);
  }

  function parseClipboard(text) {
    return String(text || '').replace(/\r/g,'').split('\n').filter((row,index,all) => row.length || index < all.length - 1).map(row => row.split('\t'));
  }

  function setOriginalItemValue(rowIndex, column, value) {
    const row = canonicalRows()[rowIndex];
    if (!row || !column?.selector || column.readonly || column.image) return;
    const input = row.querySelector(column.selector);
    if (!input) return;
    input.value = value;
    dispatchCanonical(input, input.tagName === 'SELECT' ? 'change' : 'input');
  }

  function handleProductPaste(event) {
    const target = event.target.closest('[data-grid-row][data-grid-col]');
    if (!target) return;
    const text = event.clipboardData?.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    event.preventDefault();
    event.stopPropagation();
    const matrix = parseClipboard(text);
    if (!matrix.length) return;
    const startRow = Number(target.dataset.gridRow);
    const startCol = Number(target.dataset.gridCol);
    const columns = productColumns();
    const requiredRows = startRow + matrix.length;
    if (requiredRows > canonicalRows().length) addRows(requiredRows - canonicalRows().length, false);
    syncingFromTable = true;
    try {
      matrix.forEach((values,rowOffset) => values.forEach((value,colOffset) => {
        const column = columns[startCol + colOffset];
        if (column) setOriginalItemValue(startRow + rowOffset, column, value);
      }));
    } finally { syncingFromTable = false; }
    window.setTimeout(() => {
      renderTableEditor();
      notify(`已从表格粘贴 ${matrix.length} 行数据，并同步到正式单据和表格预览。`,'ok');
    }, 80);
  }

  function handleGridKeyboard(event) {
    const target = event.target.closest('[data-grid-row][data-grid-col]');
    if (!target || event.altKey || event.ctrlKey || event.metaKey || composingControl) return;
    const row = Number(target.dataset.gridRow), col = Number(target.dataset.gridCol);
    const scroller = gridScrollerFor(target);
    const savedLeft = scroller?.scrollLeft || 0;
    const workspace = $('fpTableEditorWorkspace');
    const find = (r,c) => workspace?.querySelector(`[data-grid-row="${r}"][data-grid-col="${c}"]`);
    if (event.key === 'Enter') {
      event.preventDefault();
      flushMirrorControl(target);
      const nextRow = Math.max(0,row + (event.shiftKey ? -1 : 1));
      const next = find(nextRow,col);
      if (next) { focusGridCell(next,{scroller,left:savedLeft}); return; }
      if (event.shiftKey) return;
      addRows(1,false);
      window.setTimeout(() => {
        const newScroller = $('fpTableEditorWorkspace')?.querySelector('.fp-product-panel .fp-sheet-scroll');
        if (newScroller) newScroller.scrollLeft = savedLeft;
        focusGridCell(find(row+1,col),{scroller:newScroller,left:savedLeft});
      },90);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      flushMirrorControl(target);
      const editableCols = productColumns().map((column,index)=>column.readonly||column.image?null:index).filter(index=>index!==null);
      let position = editableCols.indexOf(col);
      if (position < 0) return;
      let nextRow=row,nextPos=position+(event.shiftKey?-1:1);
      if (nextPos >= editableCols.length) { nextPos=0; nextRow=row+1; }
      if (nextPos < 0) { nextPos=editableCols.length-1; nextRow=Math.max(0,row-1); }
      let next=find(nextRow,editableCols[nextPos]);
      if (!next && nextRow>row) {
        addRows(1,false);
        window.setTimeout(()=>{
          const newScroller=$('fpTableEditorWorkspace')?.querySelector('.fp-product-panel .fp-sheet-scroll');
          if(newScroller)newScroller.scrollLeft=savedLeft;
          focusGridCell(find(nextRow,editableCols[nextPos]),{scroller:newScroller,left:savedLeft});
        },90);
      } else focusGridCell(next,{scroller,left:savedLeft});
    }
  }

  function applyToolbarChange(event) {
    const target = event.target;
    if (target.matches('[data-table-document-type]')) {
      const original=canonicalInput('documentType');
      if(original){original.value=target.value;flushCanonical(original,'change');}
      else window.FlypigBOXApp?.applyDocumentProfile?.(target.value, {silent:false});
      try{document.dispatchEvent(new CustomEvent('HUIDI:document-type-changed',{detail:{type:target.value}}));}catch(_){ }
      activeSectionKey='basic';
      scheduleRender(20);
      window.setTimeout(()=>{window.FlypigBOXTableOutput?.refresh?.({force:true});window.FlypigBOXApp?.renderPreview?.();},50);
    }
    if (target.matches('[data-table-doc-mode]')) {
      document.querySelector(`[data-doc-mode="${CSS.escape(target.value)}"]`)?.click();
      scheduleRender(30);
    }
    if (target.matches('[data-table-sheet-layout]')) {
      currentSheetLayout=target.value==='wide'?'wide':'standard';
      try{localStorage.setItem(TABLE_SHEET_LAYOUT_STORAGE_KEY,currentSheetLayout);}catch(_){ }
      window.FlypigBOXTableOutput?.setSheetLayout?.(currentSheetLayout,{announce:true,persist:true});
      scheduleRender(30);
    }
    if (target.matches('[data-table-english-assist]')) {
      try { localStorage.setItem(ENGLISH_ASSIST_STORAGE_KEY,target.checked?'1':'0'); } catch (_) {}
      renderTableEditor();
      document.dispatchEvent(new CustomEvent('HUIDI:english-assist-changed',{detail:{enabled:Boolean(target.checked)}}));
      return;
    }
    if (target.matches('[data-table-language]')) {
      const original = canonicalInput('docLanguage');
      if (original) { original.value = target.value; flushCanonical(original,'change'); }
      renderTableEditor();
      window.FlypigBOXTableOutput?.refresh?.({force:true});
    }
    if (target.matches('[data-table-entry-layout]')) {
      currentEntryLayout = target.value === 'horizontal' ? 'horizontal' : 'standard';
      try { localStorage.setItem(ENTRY_LAYOUT_STORAGE_KEY,currentEntryLayout); } catch (_) {}
      renderTableEditor();
      notify(currentEntryLayout === 'horizontal' ? '已切换到横向表格录入。' : '已切换到标准分栏录入。','ok');
    }
  }

  function setViewMode(mode, {announce = false, persist = true} = {}) {
    const safe = mode === 'table' ? 'table' : 'form';
    currentView = safe;
    ensureHiddenField().value = safe;
    document.body.classList.toggle('fp-table-editor-mode', safe === 'table');
    document.body.classList.toggle('fp-form-editor-mode', safe === 'form');
    qsa('[data-editor-view]').forEach(button => {
      const active = button.dataset.editorView === safe;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const state = $('fpEditorViewState');
    if (state) state.textContent = `当前：${safe === 'table' ? '表格工作台' : '表单核对'}`;
    if (persist) {
      try { localStorage.setItem(VIEW_STORAGE_KEY, safe); } catch (_) {}
    }
    if (safe === 'table') { renderTableEditor(); window.FlypigBOXTableOutput?.setSheetLayout?.(currentSheetLayout,{announce:false,persist:false}); window.FlypigBOXTableOutput?.setPreviewMode?.('table',{announce:false,persist:true}); }
    else window.FlypigBOXTableOutput?.setPreviewMode?.('document',{announce:false,persist:true});
    document.dispatchEvent(new CustomEvent('HUIDI:editor-view-change',{detail:{mode:safe}}));
    window.setTimeout(applyStoredSplit,0);
    if (announce) notify(safe === 'table' ? '已切换到表格工作台：右侧已同步显示表格工作簿，可直接智能导入、批量录入和导出 Excel。' : '已切换到表单核对：右侧恢复正式 PDF 预览，表格中填写的数据全部保留。','ok');
  }

  function restoreViewMode() {
    const savedField = ensureHiddenField().value;
    let savedLocal = '';
    try { savedLocal = localStorage.getItem(VIEW_STORAGE_KEY) || ''; } catch (_) {}
    setViewMode(savedField === 'table' || savedLocal === 'table' ? 'table' : 'form', {announce:false,persist:false});
  }

  function wrapApplyState() {
    const app = window.FlypigBOXApp;
    if (!app?.applyState || app.applyState.__fpTableWrapped) return;
    const original = app.applyState;
    const wrapped = function(...args) {
      const result = original.apply(this,args);
      window.setTimeout(() => {
        const mode = ensureHiddenField().value;
        setViewMode(mode === 'table' ? 'table' : currentView, {announce:false,persist:false});
        scheduleRender(10);
      }, 30);
      return result;
    };
    wrapped.__fpTableWrapped = true;
    app.applyState = wrapped;
  }

  function installObservers() {
    const form = $('piForm');
    const internalCostIds = new Set(['factoryCostRowsJson','factoryCostCurrency','factoryFxRate','factoryOverheadRate','factoryCommissionRate','factoryTargetMargin']);
    form?.addEventListener('input', event => {
      if (syncingFromTable || internalCostIds.has(event.target.id) || event.target.closest('#fpTableEditorWorkspace')) return;
      scheduleRender(100);
    }, true);
    form?.addEventListener('change', event => {
      if (syncingFromTable || internalCostIds.has(event.target.id) || event.target.closest('#fpTableEditorWorkspace')) return;
      scheduleRender(60);
    }, true);
    $('fpTableEditorWorkspace')?.addEventListener('change', applyToolbarChange);
    const list = $('itemList');
    if (list) {
      itemObserver = new MutationObserver(() => { if (!syncingFromTable) scheduleRender(30); });
      itemObserver.observe(list,{childList:true,subtree:true});
    }
    ['HUIDI:apply-template','HUIDI:branding-updated','HUIDI:branding-ready'].forEach(name => document.addEventListener(name,() => scheduleRender(80)));
    statePoll = window.setInterval(() => {
      const savedMode = ensureHiddenField().value === 'table' ? 'table' : 'form';
      if (savedMode !== currentView) { setViewMode(savedMode,{announce:false,persist:false}); return; }
      if (currentView !== 'table') return;
      const key = contextKey();
      if (key !== lastContextKey) renderTableEditor();
    }, 700);
  }

  function boot() {
    if (!$('piForm') || !document.querySelector('.workbench')) return;
    ensureHiddenField();
    ensureCustomFieldStore();
    createViewSwitcher();
    createTableWorkspace();
    installWorkbenchResizer();
    wrapApplyState();
    installObservers();
    restoreViewMode();
    window.FlypigBOXTableEditor = {
      setViewMode,
      refresh:renderTableEditor,
      getMode:() => currentView,
      getSectionState:() => Object.fromEntries(sectionOpenState),
      setSectionOpen:(key,open)=>{sectionOpenState.set(key,Boolean(open));renderTableEditor();},
      addCustomField:openCustomFieldDialog,
      getLayout:layoutConfig,
      refreshLayout:()=>renderTableEditor()
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => window.setTimeout(boot,0));
  else window.setTimeout(boot,0);
})();
