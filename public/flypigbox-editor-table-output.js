/* HUIDI V3.3.6.24-R1.3A.12 — unified workbook output driven by the structured document schema
   Adds a read-only spreadsheet preview plus self-contained XLSX/CSV output.
   The canonical editor form remains the single source of truth. */
(() => {
  'use strict';

  const PREVIEW_FIELD_ID = 'documentPreviewMode';
  const PREVIEW_STORAGE_KEY = 'flypigbox_document_preview_mode_v1';
  const $ = id => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const html = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const xml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
  const num = value => Number(value || 0) || 0;
  const nearZero = value => Math.abs(Number(value)||0)<1e-9?0:Number(value)||0;
  const on = value => value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
  const safeFile = value => (clean(value) || 'HUIDI-Document').replace(/[\\/:*?"<>|]+/g, '-').replace(/\.+$/,'').slice(0,120);
  const documentBaseName = (prefix, number) => { const no=safeFile(number||prefix); return no.toLowerCase().startsWith(String(prefix||'').toLowerCase()) ? no : `${safeFile(prefix)}-${no}`; };
  function languageMode(snapshot){return clean(snapshot?.fields?.docLanguage)||'bilingual';}
  function localizedLabel(label,snapshot){
    const mode=languageMode(snapshot),text=String(label??'').trim();if(mode==='bilingual'||!text)return text;
    const parts=text.split(/\s*\/\s*/).map(part=>part.trim()).filter(Boolean);if(parts.length<2)return text;
    const hasZh=part=>/[㐀-鿿]/.test(part);
    if(mode==='zh'){const zh=parts.filter(hasZh).join(' / ')||parts[0]||text;const keep=parts.find(part=>!hasZh(part)&&/^(SKU|MOQ|HS\s*Code|CBM|SWIFT|VAT|EORI|B\/L(?:\s*No\.)?|Incoterms®?|ETD|ETA|ISO(?:\s*Code)?|PO(?:\s*No\.)?)$/i.test(part));return keep&&!zh.toLowerCase().includes(keep.toLowerCase())?`${zh}（${keep}）`:zh;}
    return parts.filter(part=>!hasZh(part)).join(' / ')||parts[parts.length-1]||text;
  }
  function localizedText(snapshot,zh,en){const mode=languageMode(snapshot);return mode==='zh'?zh:mode==='en'?en:`${zh} / ${en}`;}
  function localizedOption(value,snapshot){
    const text=clean(value),mode=languageMode(snapshot);
    if(!text||mode==='bilingual')return text;
    const parts=text.split(/\s*\/\s*/).map(part=>part.trim()).filter(Boolean);
    if(parts.length<2)return text;
    const hasZh=part=>/[㐀-鿿]/.test(part);
    if(mode==='zh')return parts.find(hasZh)||parts[0]||text;
    return parts.find(part=>!hasZh(part))||parts[parts.length-1]||text;
  }
  const DOCUMENT_META = {
    quotation:{title:'QUOTATION / 报价单',prefix:'Quotation'},
    proforma_invoice:{title:'PROFORMA INVOICE / 形式发票',prefix:'PI'},
    commercial_invoice:{title:'COMMERCIAL INVOICE / 商业发票',prefix:'Commercial-Invoice'},
    packing_list:{title:'PACKING LIST / 装箱单',prefix:'Packing-List'},
    sales_contract:{title:'SALES CONTRACT / 销售合同',prefix:'Sales-Contract'}
  };
  function documentMeta(snapshot){const base=DOCUMENT_META[snapshot?.type]||DOCUMENT_META.proforma_invoice;return {...base,title:localizedLabel(base.title,snapshot)};}
  const TABLE_DOCUMENT_PROFILES = {
    quotation:{sheet:['报价单','Quotation'],subtitle:['价格、有效期与供货条件','PRICE OFFER · VALIDITY · SUPPLY TERMS'],info:['报价信息','QUOTATION INFORMATION'],parties:['客户与卖方','CUSTOMER & SELLER'],product:['报价商品','QUOTED ITEMS'],delivery:false,logistics:true,payment:false,terms:true,signature:false,packing:false},
    proforma_invoice:{sheet:['形式发票','Proforma Invoice'],subtitle:['订单确认、付款与交付资料','ORDER CONFIRMATION · PAYMENT · DELIVERY'],info:['订单与形式发票信息','PROFORMA & ORDER INFORMATION'],parties:['买卖双方','SELLER & BUYER'],product:['订单商品','ORDER ITEMS'],delivery:true,logistics:true,payment:true,terms:true,signature:true,packing:false},
    commercial_invoice:{sheet:['商业发票','Commercial Invoice'],subtitle:['出口、清关与申报资料','EXPORT · CUSTOMS · DECLARATION'],info:['发票与清关信息','INVOICE & CUSTOMS INFORMATION'],parties:['出口方与收货方','EXPORTER & CONSIGNEE'],product:['清关商品','CUSTOMS ITEMS'],delivery:true,logistics:true,payment:false,terms:true,signature:true,packing:false},
    packing_list:{sheet:['装箱单','Packing List'],subtitle:['箱数、重量、体积与包装资料','CARTONS · WEIGHT · VOLUME · PACKING'],info:['装箱信息','PACKING INFORMATION'],parties:['发货方与收货方','SHIPPER & CONSIGNEE'],product:['包装与箱单明细','PACKING DETAILS'],delivery:true,logistics:true,payment:false,terms:true,signature:true,packing:true},
    sales_contract:{sheet:['销售合同','Sales Contract'],subtitle:['合同双方、付款、交付与签署条款','PARTIES · PAYMENT · DELIVERY · SIGNATURE'],info:['合同信息','CONTRACT INFORMATION'],parties:['合同双方','CONTRACT PARTIES'],product:['合同商品','CONTRACT ITEMS'],delivery:true,logistics:true,payment:true,terms:true,signature:true,packing:false}
  };
  function tableDocumentProfile(snapshot){return TABLE_DOCUMENT_PROFILES[snapshot?.type]||TABLE_DOCUMENT_PROFILES.proforma_invoice;}
  function fieldSwitchOn(snapshot,id){return id?on(snapshot?.fields?.[id]):true;}
  function documentMode(snapshot){return snapshot?.detailed?'b2b':'ecommerce';}
  function sharedSchema(){return window.FlypigBOXDocumentSchema||null;}
  function tableSectionEnabled(snapshot,key){
    const schema=sharedSchema(),mode=documentMode(snapshot);
    if(schema?.sectionAllowed){
      const sectionKey=key==='products'?'products':key;
      if(!schema.sectionAllowed(sectionKey,snapshot.type,mode))return false;
      if(key==='logistics'&&!fieldSwitchOn(snapshot,'showLogistics'))return false;
      if(key==='payment'&&!fieldSwitchOn(snapshot,'showPayment'))return false;
      if(key==='terms'&&!(fieldSwitchOn(snapshot,'showTerms')||fieldSwitchOn(snapshot,'showRemarks')))return false;
      if(key==='signature'&&!fieldSwitchOn(snapshot,'showSignature'))return false;
      return true;
    }
    const profile=tableDocumentProfile(snapshot);if(key==='delivery')return Boolean(profile.delivery);if(key==='logistics')return Boolean(profile.logistics)&&fieldSwitchOn(snapshot,'showLogistics');if(key==='payment')return Boolean(profile.payment)&&fieldSwitchOn(snapshot,'showPayment');if(key==='terms')return Boolean(profile.terms)&&(fieldSwitchOn(snapshot,'showTerms')||fieldSwitchOn(snapshot,'showRemarks'));if(key==='signature')return Boolean(profile.signature)&&fieldSwitchOn(snapshot,'showSignature');return true;
  }
  function tableFieldAllowed(snapshot,id){const schema=sharedSchema();return !id||!schema?.fieldAllowed||schema.fieldAllowed(id,snapshot.type,documentMode(snapshot));}
  function tableProductColumnAllowed(snapshot,key){const schema=sharedSchema();return !schema?.productColumnAllowed||schema.productColumnAllowed(key,snapshot.type,documentMode(snapshot));}
  const DOCUMENT_STATUS_LABELS={draft:'草稿 / Draft',internal_review:'内部审核 / Internal Review',sent:'已发送客户 / Sent',customer_confirmed:'客户已确认 / Confirmed',deposit_received:'已收定金 / Deposit Received',production:'生产中 / In Production',ready_to_ship:'待发货 / Ready to Ship',shipped:'已发货 / Shipped',completed:'已完成 / Completed',cancelled:'已取消 / Cancelled'};
  const TRADE_SCENARIO_LABELS={wholesale:'标准批发 / Wholesale',sample:'样品订单 / Sample Order',oem:'OEM / ODM 定制',stock:'现货订单 / Stock Order',project:'工程 / 项目订单'};
  const statusLabel=value=>DOCUMENT_STATUS_LABELS[clean(value)]||clean(value);
  const scenarioLabel=value=>TRADE_SCENARIO_LABELS[clean(value)]||clean(value);

  const PREVIEW_LABEL_FIELD = new Map([
    ['单据编号 / Document No.','invoiceNo'],['修订版本 / Revision','revisionNo'],['单据状态 / Status','documentStatus'],['业务场景 / Scenario','tradeScenario'],
    ['出单日期 / Issue Date','issueDate'],['有效期 / Valid Until','validUntil'],['币种 / Currency','currency'],['客户 PO / Customer PO','customerPo'],
    ['客户参考号 / Customer Reference','quoteNo'],['关联报价单号 / Related Quotation No.','quoteNo'],['原产国 / Country of Origin','originCountry'],['业务员 / Salesperson','salesperson'],['制单人 / Prepared by','preparedBy'],['审核人 / Approved by','approvedBy'],
    ['卖方公司 / Seller','sellerName'],['买方公司 / Buyer','buyerName'],['卖方联系人 / Seller Contact','sellerContact'],['买方联系人 / Buyer Contact','buyerContact'],
    ['卖方电话 / Seller Phone','sellerPhone'],['买方电话 / Buyer Phone','buyerPhone'],['卖方邮箱 / Seller Email','sellerEmail'],['买方邮箱 / Buyer Email','buyerEmail'],
    ['卖方地址 / Seller Address','sellerAddress'],['买方地址 / Buyer Address','buyerAddress'],['卖方税号 / Seller Tax ID','sellerTaxId'],['买方税号 / Buyer Tax ID','buyerTaxId'],
    ['买方国家 / Buyer Country','buyerCountry'],['ISO 国家代码 / ISO Country Code','buyerCountryCode'],['买方网站 / Buyer Website','buyerWebsite'],['目的地 / Destination','destinationPort'],
    ['收货人 / Consignee','consigneeName'],['收货人联系人 / Consignee Contact','consigneeContact'],['收货人电话 / Consignee Phone','consigneePhone'],['收货人邮箱 / Consignee Email','consigneeEmail'],['收货地址 / Consignee Address','consigneeAddress'],
    ['通知方 / Notify Party','notifyPartyName'],['通知方联系人 / Notify Contact','notifyPartyContact'],['通知方电话 / Notify Phone','notifyPartyPhone'],['通知方邮箱 / Notify Email','notifyPartyEmail'],['通知方地址 / Notify Address','notifyPartyAddress'],
    ['账单地址 / Bill To','billToAddress'],['送货地址 / Ship To','shipToAddress'],
    ['运输方式 / Shipping Method','shippingMethod'],['总箱数 / Packages','packageCount'],['包装类型 / Package Type','packageType'],['总净重 / N.W.','netWeight'],['总毛重 / G.W.','grossWeight'],['总体积 / CBM','cbm'],
    ['承运人 / 货代 / Carrier / Forwarder','logisticsCarrier'],['追踪号 / 运单号 / Tracking / Waybill No.','trackingNo'],['提单号 / B/L No.','blNo'],['柜号 / Container No.','containerNo'],['封条号 / Seal No.','sealNo'],
    ['船名 / 航班 / 车次 / Vessel / Flight / Truck','vesselFlight'],['ETD','etd'],['ETA','eta'],['单箱尺寸 / Package Dimensions','packageDimensions'],['装运港 / Port of Loading','portOfLoading'],['预计发货日期 / Estimated Shipment','estimatedShipment'],['运输唛头 / Shipping Marks','shippingMarks'],
    ['收款渠道 / Payment Method','paymentTemplate'],['收款人 / Beneficiary','bankBeneficiary'],['开户行 / Bank Name','bankName'],['银行账号 / Account No.','bankAccount'],['SWIFT','bankSwift'],['银行地址 / 付款备注 / Bank Address / Payment Note','bankAddress'],
    ['付款条款 / Payment Terms','paymentTerms'],['贸易术语 / Incoterms®','tradeTerms'],['交期 / Lead Time','deliveryTime'],['补充备注 / Remarks','remarks'],['合同补充条款 / Additional Contract Clauses','contractClauses']
  ]);
  function previewFieldForLabel(label) {
    const text=clean(label);
    if(!text)return '';
    if(PREVIEW_LABEL_FIELD.has(text))return PREVIEW_LABEL_FIELD.get(text)||'';
    for(const [source,id] of PREVIEW_LABEL_FIELD.entries()){
      if(localizedLabel(source,{fields:{docLanguage:'zh'}})===text||localizedLabel(source,{fields:{docLanguage:'en'}})===text)return id;
    }
    return '';
  }

  let previewMode = 'document';
  let renderTimer = 0;
  let activePreviewSheet = '客户单据';
  let tableSheetLayout = (()=>{try{return localStorage.getItem('flypigbox_table_sheet_layout_v3314')==='wide'?'wide':'standard';}catch(_){return 'standard';}})();
  function currentPaperPreference(){
    const value=clean($('paperOrientation')?.value||'auto');
    return ['auto','portrait','landscape'].includes(value)?value:'auto';
  }
  function resolvedTableLayout(snapshot=stateSnapshot(),preference=currentPaperPreference()){
    if(preference==='landscape')return'wide';
    if(preference==='portrait')return'standard';
    const resolved=window.FlypigBOXPaperLayout?.resolveSpec?.();
    if(resolved?.orientation==='landscape')return'wide';
    const columnCount=customerProductColumns(snapshot).length;
    return snapshot.type==='packing_list'||columnCount>=8?'wide':'standard';
  }
  function exportFileName(ext,kind='customer'){
    const naming=window.FlypigBOXExportNaming;
    if(naming?.file)return naming.file(ext,kind);
    return `HUIDI-Document.${ext}`;
  }
  let previewZoom = 100;
  let previewFullscreen = false;
  let pendingPreviewTarget = null;
  let previewHighlightTimer = 0;
  let previewComposing = false;
  let lastPreviewSignature = '';
  let previewCanvasScroll={top:0,left:0};
  let workbookUserScrollAt = 0;
  let workbookUserScrollRevision = 0;
  let workbookReviewUntil = 0;
  let previewRenderSequence = 0;
  let lastPreviewDocumentKey = '';
  const PREVIEW_INPUT_DEBOUNCE = 900;
  function markWorkbookReview(duration=1200){
    workbookUserScrollAt=Date.now();
    workbookReviewUntil=Math.max(workbookReviewUntil,workbookUserScrollAt+duration);
    workbookUserScrollRevision+=1;
  }
  function workbookReviewActive(){return Date.now()<workbookReviewUntil;}
  function imageSignature(value){const text=String(value||'');if(!text)return'';let hash=2166136261;const step=Math.max(1,Math.floor(text.length/96));for(let i=0;i<text.length;i+=step){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${text.length}:${(hash>>>0).toString(16)}`;}

  function notify(message, type = 'ok') {
    window.FlypigBOXApp?.setStatus?.(message, type);
  }

  function ensurePreviewField() {
    let field = $(PREVIEW_FIELD_ID);
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.id = PREVIEW_FIELD_ID;
      field.value = 'document';
      $('piForm')?.appendChild(field);
    }
    return field;
  }

  function stateSnapshot() {
    const state = window.FlypigBOXApp?.formState?.(true) || {fields:{},items:[],assets:{signature:'',stamp:''}};
    const fields = {...(state.fields || {})};
    ['factoryCostCurrency','factoryFxRate','factoryOverheadRate','factoryCommissionRate','factoryTargetMargin','factoryCostRowsJson','fpFeeItemsJson'].forEach(id=>{const input=$(id);if(input)fields[id]=input.value;});
    const items = Array.isArray(state.items) ? state.items.map(item => ({...item})) : [];
    const type = fields.documentType || 'proforma_invoice';
    return {fields, items, assets:{...(state.assets||{})}, translationVersions:{...(state.translationVersions||{})}, type, packing:type === 'packing_list', detailed:fields.docMode === 'b2b'};
  }

  function value(snapshot, id) { return clean(snapshot.fields[id]); }
  function meaningfulItems(snapshot) {
    return snapshot.items.filter(item => clean(item.sku) || clean(item.name) || clean(item.spec) || item.image || num(item.qty) || num(item.price) || num(item.cbm) || clean(item.cartonNo));
  }

  function logisticsExtras(snapshot) {
    try {
      const rows = JSON.parse(snapshot.fields.logisticsExtraRowsJson || '[]');
      return Array.isArray(rows) ? rows.map(row => [clean(row.label), clean(row.value)]).filter(row => row[0] || row[1]) : [];
    } catch (_) { return []; }
  }

  function customFieldPairs(snapshot, group) {
    try {
      const rows = JSON.parse(snapshot.fields.customDocumentFieldsJson || '[]');
      return Array.isArray(rows) ? rows.filter(row => row?.group === group && clean(row.value)).map(row => [localizedLabel(clean(row.label) || '补充字段 / Additional Field',snapshot), clean(row.value)]) : [];
    } catch (_) { return []; }
  }

  function stripFactoryTermsBlock(value) {
    return String(value || '').replace(/\n?\[HUIDI Factory Delivery & Quality\][\s\S]*?\[\/HUIDI Factory Delivery & Quality\]\n?/g, '\n').trim();
  }

  function externalTermValue(snapshot,id,value) {
    const text=clean(value);
    if(!text)return '';
    if(id==='paymentTerms'){
      const input=$('paymentTerms');
      if(input?.dataset?.auto==='auto')return '';
    }
    if(id==='tradeTerms'&&text==='FOB')return '';
    if(id==='deliveryTime'&&text==='收到付款后 15–30 天内 / Within 15–30 days after payment')return '';
    return value;
  }

  function fieldPairs(snapshot, group) {
    if(!tableSectionEnabled(snapshot,group))return [];
    const f = snapshot.fields;
    const type=snapshot.type;
    const quoteReferenceLabel=type==='quotation'?'客户参考号 / Customer Reference':'关联报价单号 / Related Quotation No.';
    const showFactoryTerms = on(f.includeFactoryTermsInExternal) && clean(f.factoryTermsSummary);
    const externalRemarks = showFactoryTerms ? stripFactoryTermsBlock(f.remarks) : f.remarks;
    const externalContractClauses = showFactoryTerms ? stripFactoryTermsBlock(f.contractClauses) : f.contractClauses;
    const row=(label,value,{toggle='',detailed=false,types=null}={})=>({label,value,toggle,detailed,types});
    const groups = {
      basic:[
        row('单据编号 / Document No.',f.invoiceNo),row('修订版本 / Revision',f.revisionNo,{detailed:true}),row('单据状态 / Status',localizedLabel(statusLabel(f.documentStatus),snapshot),{detailed:true}),row('业务场景 / Scenario',localizedLabel(scenarioLabel(f.tradeScenario),snapshot),{detailed:true}),
        row('出单日期 / Issue Date',f.issueDate),row('有效期 / Valid Until',f.validUntil,{types:['quotation','proforma_invoice','sales_contract']}),row('币种 / Currency',f.currency),row('客户 PO / Customer PO',f.customerPo,{toggle:'showCustomerPo'}),
        row(quoteReferenceLabel,f.quoteNo,{toggle:'showQuote',types:['quotation','proforma_invoice','sales_contract']}),row('原产国 / Country of Origin',localizedOption(f.originCountry,snapshot),{toggle:'showOrigin',types:['commercial_invoice','proforma_invoice','quotation']}),row('业务员 / Salesperson',f.salesperson,{toggle:'showSalesperson'}),row('制单人 / Prepared by',f.preparedBy,{detailed:true}),row('审核人 / Approved by',f.approvedBy,{detailed:true})
      ],
      parties:[
        row('卖方公司 / Seller',f.sellerName),row('买方公司 / Buyer',f.buyerName),row('卖方联系人 / Seller Contact',f.sellerContact),row('买方联系人 / Buyer Contact',f.buyerContact),
        row('卖方电话 / Seller Phone',f.sellerPhone),row('买方电话 / Buyer Phone',f.buyerPhone),row('卖方邮箱 / Seller Email',f.sellerEmail),row('买方邮箱 / Buyer Email',f.buyerEmail),
        row('卖方地址 / Seller Address',f.sellerAddress),row('买方地址 / Buyer Address',f.buyerAddress),row('卖方税号 / Seller Tax ID',f.sellerTaxId,{detailed:true}),row('买方税号 / Buyer Tax ID',f.buyerTaxId,{detailed:true}),
        row('买方国家 / Buyer Country',localizedOption(f.buyerCountry,snapshot)),row('ISO 国家代码 / ISO Country Code',f.buyerCountryCode,{detailed:true}),row('买方网站 / Buyer Website',f.buyerWebsite,{detailed:true}),row('目的地 / Destination',f.destinationPort,{types:['quotation']})
      ],
      delivery:[
        row('收货人 / Consignee',f.consigneeName),row('收货人联系人 / Consignee Contact',f.consigneeContact),row('收货人电话 / Consignee Phone',f.consigneePhone),row('收货人邮箱 / Consignee Email',f.consigneeEmail,{detailed:true}),
        row('收货地址 / Consignee Address',f.consigneeAddress),row('通知方 / Notify Party',f.notifyPartyName,{detailed:true}),row('通知方联系人 / Notify Contact',f.notifyPartyContact,{detailed:true}),row('通知方电话 / Notify Phone',f.notifyPartyPhone,{detailed:true}),
        row('通知方邮箱 / Notify Email',f.notifyPartyEmail,{detailed:true}),row('通知方地址 / Notify Address',f.notifyPartyAddress,{detailed:true}),row('账单地址 / Bill To',f.billToAddress,{detailed:true}),row('送货地址 / Ship To',f.shipToAddress)
      ],
      logistics:[
        row('运输方式 / Shipping Method',localizedOption(f.shippingMethod,snapshot)),row('总箱数 / Packages',f.packageCount),row('包装类型 / Package Type',localizedOption(f.packageType,snapshot)),row('总净重 / N.W.',f.netWeight ? `${f.netWeight} KG` : ''),
        row('总毛重 / G.W.',f.grossWeight ? `${f.grossWeight} KG` : ''),row('总体积 / CBM',f.cbm ? `${f.cbm} m³` : ''),row('承运人 / 货代 / Carrier / Forwarder',f.logisticsCarrier,{detailed:true}),row('追踪号 / 运单号 / Tracking / Waybill No.',f.trackingNo,{detailed:true}),
        row('提单号 / B/L No.',f.blNo,{detailed:true}),row('柜号 / Container No.',f.containerNo,{detailed:true}),row('封条号 / Seal No.',f.sealNo,{detailed:true}),row('船名 / 航班 / 车次 / Vessel / Flight / Truck',f.vesselFlight,{detailed:true}),
        row('ETD',f.etd,{detailed:true}),row('ETA',f.eta,{detailed:true}),row('单箱尺寸 / Package Dimensions',f.packageDimensions),row('装运港 / Port of Loading',f.portOfLoading),row('目的地 / Destination',f.destinationPort),row('预计发货日期 / Estimated Shipment',f.estimatedShipment),row('运输唛头 / Shipping Marks',f.shippingMarks)
      ],
      payment:[
        row('收款渠道 / Payment Method',localizedOption(f.paymentTemplate,snapshot)),row('收款人 / Beneficiary',f.bankBeneficiary),row('开户行 / Bank Name',f.bankName),
        row('银行账号 / Account No.',f.bankAccount),row('SWIFT',f.bankSwift),row('银行地址 / 付款备注 / Bank Address / Payment Note',f.bankAddress,{detailed:true})
      ],
      terms:[
        row('付款条款 / Payment Terms',externalTermValue(snapshot,'paymentTerms',f.paymentTerms),{toggle:'showTerms'}),row('贸易术语 / Incoterms®',externalTermValue(snapshot,'tradeTerms',f.tradeTerms),{toggle:'showTerms'}),row('交期 / Lead Time',externalTermValue(snapshot,'deliveryTime',f.deliveryTime),{toggle:'showTerms'}),
        row('装运港 / Port of Loading',f.portOfLoading,{toggle:'showLogistics'}),row('预计发货日期 / Estimated Shipment',f.estimatedShipment,{toggle:'showLogistics'}),row('补充备注 / Remarks',externalRemarks,{toggle:'showRemarks'}),row('合同补充条款 / Additional Contract Clauses',externalContractClauses,{toggle:'showRemarks',types:['sales_contract']}),
        ...(showFactoryTerms?[row('工厂交付与质量说明 / Factory Delivery & Quality',f.factoryTermsSummary,{toggle:'showRemarks'})]:[])
      ]
    };
    const standard = (groups[group] || []).filter(entry=>{
      if(entry.types&&!entry.types.includes(type))return false;
      const fieldId=previewFieldForLabel(entry.label);
      if(entry.detailed&&!snapshot.detailed)return false;
      if(entry.toggle&&(!tableFieldAllowed(snapshot,entry.toggle)||!fieldSwitchOn(snapshot,entry.toggle)))return false;
      if(fieldId&&!tableFieldAllowed(snapshot,fieldId))return false;
      return clean(entry.value);
    }).map(entry=>[localizedLabel(clean(entry.label),snapshot),clean(entry.value)]);
    const logisticsRows=group==='logistics'&&tableSectionEnabled(snapshot,'logistics')?logisticsExtras(snapshot).map(([label,val])=>[localizedLabel(label||localizedText(snapshot,'补充物流字段','Additional Logistics Field'),snapshot),val]):[];
    return [...standard,...logisticsRows,...customFieldPairs(snapshot,group)];
  }

  function itemHasText(items,key) { return items.some(item => clean(item?.[key])); }
  function itemHasNumber(items,key) { return items.some(item => num(item?.[key]) !== 0); }

  function customerOutputItems(snapshot) {
    // Formal PDF output only treats rows with a product name as customer-facing items.
    return (snapshot.items||[]).filter(item=>clean(item?.name));
  }

  function customerOutputFlags(snapshot) {
    const items=customerOutputItems(snapshot),packing=snapshot.type==='packing_list';
    const anyText=key=>items.some(item=>clean(item?.[key]));
    const anyNumber=key=>items.some(item=>num(item?.[key])!==0);
    const hasMoney=!packing&&items.some(item=>num(item?.qty)>0&&num(item?.price)>0);
    return {
      items,packing,hasMoney,
      image:tableProductColumnAllowed(snapshot,'image')&&fieldSwitchOn(snapshot,'showProductImage')&&items.some(item=>clean(item?.image)),
      sku:tableProductColumnAllowed(snapshot,'sku')&&anyText('sku'),spec:tableProductColumnAllowed(snapshot,'spec')&&anyText('spec'),
      hs:tableProductColumnAllowed(snapshot,'hs')&&fieldSwitchOn(snapshot,'showHsCode')&&anyText('hs'),
      moq:tableProductColumnAllowed(snapshot,'moq')&&['quotation','proforma_invoice'].includes(snapshot.type)&&fieldSwitchOn(snapshot,'showMoq')&&anyNumber('moq'),
      cartonNo:tableProductColumnAllowed(snapshot,'cartonNo')&&anyText('cartonNo'),
      packageDescription:tableProductColumnAllowed(snapshot,'packageDescription')&&fieldSwitchOn(snapshot,'showLogistics')&&anyText('packageDescription'),
      netWeight:tableProductColumnAllowed(snapshot,'netWeight')&&fieldSwitchOn(snapshot,'showLogistics')&&anyNumber('netWeight'),
      grossWeight:tableProductColumnAllowed(snapshot,'grossWeight')&&fieldSwitchOn(snapshot,'showLogistics')&&anyNumber('grossWeight'),
      cbm:tableProductColumnAllowed(snapshot,'cbm')&&fieldSwitchOn(snapshot,'showLogistics')&&anyNumber('cbm'),
      dimensions:tableProductColumnAllowed(snapshot,'dimensions')&&fieldSwitchOn(snapshot,'showLogistics')&&anyText('dimensions'),
      shippingMarks:tableProductColumnAllowed(snapshot,'shippingMarks')&&fieldSwitchOn(snapshot,'showRemarks')&&anyText('shippingMarks')
    };
  }

  function customerProductColumns(snapshot) {
    const flags=customerOutputFlags(snapshot),items=flags.items,packing=flags.packing;
    const columns=[{key:'no',label:'序号 / No.',width:7}];
    if(flags.image)columns.push({key:'image',label:'产品图片 / Image',width:13,image:true});
    if(flags.sku)columns.push({key:'sku',label:'货号 / SKU',width:16});
    if(tableProductColumnAllowed(snapshot,'name'))columns.push({key:'name',label:'商品名称 / Product',width:24});
    if(flags.spec)columns.push({key:'spec',label:'规格 / Specifications',width:30});
    if(flags.hs)columns.push({key:'hs',label:'HS Code',width:14});
    if(packing){
      if(flags.cartonNo)columns.push({key:'cartonNo',label:'箱号 / Carton No.',width:14});
      if(tableProductColumnAllowed(snapshot,'qty'))columns.push({key:'qty',label:'数量 / Qty',width:10,numeric:true});if(tableProductColumnAllowed(snapshot,'unit'))columns.push({key:'unit',label:'单位 / Unit',width:10});
      if(flags.packageDescription)columns.push({key:'packageDescription',label:'包装说明 / Packing',width:19});
      if(flags.netWeight)columns.push({key:'netWeight',label:'净重 / N.W. KG',width:11,numeric:true});
      if(flags.grossWeight)columns.push({key:'grossWeight',label:'毛重 / G.W. KG',width:11,numeric:true});
      if(flags.cbm)columns.push({key:'cbm',label:'CBM',width:10,numeric:true});
      if(flags.dimensions)columns.push({key:'dimensions',label:'单箱尺寸 / Dimensions',width:18});
      if(flags.shippingMarks)columns.push({key:'shippingMarks',label:'唛头 / Marks',width:18});
    }else{
      if(tableProductColumnAllowed(snapshot,'qty'))columns.push({key:'qty',label:'数量 / Qty',width:10,numeric:true});if(tableProductColumnAllowed(snapshot,'unit'))columns.push({key:'unit',label:'单位 / Unit',width:10});
      if(flags.moq)columns.push({key:'moq',label:'MOQ',width:11,numeric:true});
      if(flags.hasMoney&&tableProductColumnAllowed(snapshot,'price'))columns.push({key:'price',label:'单价 / Unit Price',width:14,numeric:true});if(flags.hasMoney&&tableProductColumnAllowed(snapshot,'amount'))columns.push({key:'amount',label:'金额 / Amount',width:15,numeric:true,formula:true});
      const optional=[['cartonNo','箱号 / Carton No.',14,false,'cartonNo'],['packageDescription','包装说明 / Packing',19,false,'packageDescription'],['netWeight','净重 / N.W. KG',11,true,'netWeight'],['grossWeight','毛重 / G.W. KG',11,true,'grossWeight'],['cbm','CBM',10,true,'cbm'],['dimensions','单箱尺寸 / Dimensions',18,false,'dimensions'],['shippingMarks','唛头 / Marks',18,false,'shippingMarks']];
      optional.forEach(([key,label,width,numeric,flag])=>{if(snapshot.detailed&&flags[flag])columns.push({key,label,width,numeric});});
    }
    return columns.map(column=>({...column,label:localizedLabel(column.label,snapshot),width:Math.max(7,Math.round((column.width||12)*(tableSheetLayout==='wide'?1.18:.9)))}));
  }

  function dataProductColumns(snapshot) {
    const columns = [
      {key:'no',label:'No.',width:7},{key:'sku',label:'SKU / Item No.',width:16},{key:'name',label:'Product Name',width:24},{key:'spec',label:'Specifications',width:30},{key:'hs',label:'HS Code',width:14},
      {key:'unit',label:'Unit',width:10},{key:'qty',label:'Quantity',width:11,numeric:true},{key:'moq',label:'MOQ',width:11}
    ];
    if (!snapshot.packing) columns.push({key:'price',label:'Unit Price',width:14,numeric:true},{key:'amount',label:'Amount',width:15,numeric:true,formula:true});
    columns.push(
      {key:'cartonNo',label:'Carton No.',width:14},{key:'packageDescription',label:'Packing Description',width:20},
      {key:'netWeight',label:'N.W. KG',width:11,numeric:true},{key:'grossWeight',label:'G.W. KG',width:11,numeric:true},{key:'cbm',label:'CBM',width:10,numeric:true},
      {key:'dimensions',label:'Dimensions',width:18},{key:'shippingMarks',label:'Shipping Marks',width:18}
    );
    return columns.map(column=>({...column,label:localizedLabel(column.label,snapshot),width:Math.max(7,Math.round((column.width||12)*(tableSheetLayout==='wide'?1.18:.9)))}));
  }

  function itemValue(item, key, rowIndex) {
    if (key === 'no') return rowIndex + 1;
    if (key === 'amount') return num(item.qty) * num(item.price);
    if (key === 'image') return item.image ? 'Product image' : '';
    return item[key] ?? '';
  }

  function money(snapshot, amount) {
    return `${value(snapshot,'currency') || 'USD'} ${num(amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }


  const STRUCTURED_FEE_EN = Object.freeze({
    freight:'Freight',insurance:'Insurance',sample:'Sample Fee',mould:'Mould Fee',packing:'Packing Fee',inspection:'Inspection Fee',certification:'Certification Fee',bank:'Bank Fee',platform:'Platform Fee',tax:'VAT / Tax',discount:'Discount',other:'Other Fee'
  });
  const STRUCTURED_FEE_ZH = Object.freeze({
    freight:'运费',insurance:'保险费',sample:'样品费',mould:'模具费',packing:'包装费',inspection:'验货费',certification:'认证费',bank:'银行手续费',platform:'平台服务费',tax:'税费 / VAT',discount:'折扣',other:'其他费用'
  });

  function parseStructuredFees(snapshot) {
    const raw=clean(snapshot.fields.fpFeeItemsJson||$('fpFeeItemsJson')?.value||'');
    if(raw){
      try{
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)&&parsed.length)return parsed.filter(item=>item&&typeof item==='object').map(item=>({
          id:clean(item.id),type:STRUCTURED_FEE_ZH[item.type]?item.type:'other',label:clean(item.label),mode:item.mode==='percent'?'percent':'amount',value:Math.max(0,num(item.value)),includeTotal:item.includeTotal!==false,showPdf:item.showPdf!==false,note:clean(item.note)
        }));
      }catch(_){ }
    }
    const fallback=[];
    const extra=num(snapshot.fields.extraFeeAmount),tax=num(snapshot.fields.taxAmount),discount=num(snapshot.fields.discountValue);
    if(extra>0)fallback.push({id:'legacy-extra',type:'freight',label:value(snapshot,'extraFeeName')||'运费',mode:'amount',value:extra,includeTotal:true,showPdf:true,note:clean(snapshot.fields.extraFeeNote||'')});
    if(tax>0)fallback.push({id:'legacy-tax',type:'tax',label:'税费 / VAT',mode:'amount',value:tax,includeTotal:true,showPdf:true,note:clean(snapshot.fields.taxNote||'')});
    if(discount>0)fallback.push({id:'legacy-discount',type:'discount',label:'折扣',mode:snapshot.fields.discountType==='percent'?'percent':'amount',value:discount,includeTotal:true,showPdf:true,note:clean(snapshot.fields.discountNote||'')});
    return fallback;
  }

  function structuredFeeAllowed(snapshot,item){
    if(!item.showPdf||item.value<=0||snapshot.packing)return false;
    if(item.type==='discount')return tableFieldAllowed(snapshot,'showDiscount')&&fieldSwitchOn(snapshot,'showDiscount');
    if(item.type==='tax')return tableFieldAllowed(snapshot,'showTax')&&fieldSwitchOn(snapshot,'showTax');
    return tableFieldAllowed(snapshot,'showFreight')&&fieldSwitchOn(snapshot,'showFreight');
  }

  function structuredFeeAmount(item,subtotal){
    return item.mode==='percent'?subtotal*Math.max(0,num(item.value))/100:Math.max(0,num(item.value));
  }

  function structuredFeeText(snapshot,item,field='label'){
    const source=clean(item[field]);
    const language=snapshot.fields.docLanguage||'bilingual';
    const builtInZh=STRUCTURED_FEE_ZH[item.type]||'';
    const builtInEn=STRUCTURED_FEE_EN[item.type]||'';
    const record=snapshot.translationVersions?.[`fee:${item.id}:${field}`];
    const translated=record?.source===source?clean(record?.variants?.en):'';
    const fallbackEn=field==='label'&&(!source||source===builtInZh)?builtInEn:'';
    if(language==='zh')return source||builtInZh;
    if(language==='en')return translated||fallbackEn||source||builtInEn;
    const left=source||builtInZh,right=translated||fallbackEn;
    return right&&right!==left?`${left} / ${right}`:left;
  }

  function structuredFeeRows(snapshot,subtotal){
    return parseStructuredFees(snapshot).filter(item=>structuredFeeAllowed(snapshot,item)&&structuredFeeAmount(item,subtotal)>0).map(item=>({
      ...item,amount:structuredFeeAmount(item,subtotal),displayLabel:structuredFeeText(snapshot,item,'label'),displayNote:structuredFeeText(snapshot,item,'note')
    }));
  }

  function renderPairGrid(title, pairs) {
    if (!pairs.length) return '';
    return `<section class="fp-output-section"><h3>${html(title)}</h3><div class="fp-output-pair-grid">${pairs.map(([label,val])=>`<div class="fp-output-pair"><b>${html(label)}</b><span>${html(val)}</span></div>`).join('')}</div></section>`;
  }

  function columnLetter(index) {
    let value = index + 1, result = '';
    while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
    return result;
  }

  function workbookTable(headers, rows, {numeric = []} = {}) {
    const head = headers.map(label=>`<th>${html(label)}</th>`).join('');
    const body = rows.map(row=>`<tr>${headers.map((_,colIndex)=>`<td class="${numeric.includes(colIndex)?'is-number':''}">${html(row[colIndex] ?? '')}</td>`).join('')}</tr>`).join('');
    return `<div class="fp-workbook-grid-scroll"><table class="fp-workbook-grid"><thead><tr>${head}</tr></thead><tbody>${body||`<tr><td colspan="${Math.max(1,headers.length)}" class="fp-output-empty">${html(localizedText(stateSnapshot(),'暂无可显示数据','No data to display'))}</td></tr>`}</tbody></table></div>`;
  }

  function pairRows(snapshot, group) {
    return fieldPairs(snapshot,group).map(([label,val])=>[label,val]);
  }
  const STRUCTURED_OUTPUT_GROUPS=[
    ['references','关联与参考','References'],['paymentSchedule','付款计划','Payment Schedule'],['customs','海关与监管','Customs & Compliance'],
    ['packing','包装资料','Packing Details'],['plannedLogistics','预计物流','Planned Logistics'],['actualShipment','实际出货','Actual Shipment'],['qualityRisk','质量、验收与风险','Quality, Inspection & Risk']
  ];
  function structuredPreviewSheets(snapshot){
    return STRUCTURED_OUTPUT_GROUPS.filter(([key])=>tableSectionEnabled(snapshot,key)&&fieldPairs(snapshot,key).length).map(([key,zh,en])=>({key,label:localizedText(snapshot,zh,en),count:fieldPairs(snapshot,key).length,render:()=>workbookTable([localizedText(snapshot,'字段','Field'),localizedText(snapshot,'内容','Value')],pairRows(snapshot,key))}));
  }
  function addStructuredPairSections(sheet,snapshot,colCount){
    STRUCTURED_OUTPUT_GROUPS.forEach(([key,zh,en])=>{if(tableSectionEnabled(snapshot,key))addPairSection(sheet,localizedText(snapshot,zh,en).toUpperCase(),fieldPairs(snapshot,key),colCount);});
  }
  function structuredExtraSheets(snapshot){
    return STRUCTURED_OUTPUT_GROUPS.map(([key,zh,en])=>{const pairs=fieldPairs(snapshot,key);return tableSectionEnabled(snapshot,key)&&pairs.length?keyValueSheet(localizedText(snapshot,zh,en),pairs,snapshot):null;}).filter(Boolean);
  }

  function previewSheets(snapshot, items, columns, totals) {
    const sheets = [
      {key:'overview',label:localizedText(snapshot,'单据信息','Document Information'),count:fieldPairs(snapshot,'basic').length+fieldPairs(snapshot,'parties').length+fieldPairs(snapshot,'delivery').length,render:()=>workbookTable([localizedText(snapshot,'字段','Field'),localizedText(snapshot,'内容','Value')],[...pairRows(snapshot,'basic'),...pairRows(snapshot,'parties'),...pairRows(snapshot,'delivery')])},
      ...structuredPreviewSheets(snapshot),
      {key:'products',label:localizedText(snapshot,'商品明细','Product Details'),count:items.length,render:()=>{
        const headers=columns.map(col=>col.label);
        const rows=items.map((item,index)=>columns.map(col=>{
          const raw=itemValue(item,col.key,index);
          return col.key==='price'||col.key==='amount'?money(snapshot,raw):raw;
        }));
        const table=workbookTable(headers,rows,{numeric:columns.map((col,index)=>col.numeric?index:-1).filter(index=>index>=0)});
        return `${table}${snapshot.packing?'':`<div class="fp-workbook-total-strip"><span>${html(localizedText(snapshot,'商品小计','Subtotal'))} <b>${html(money(snapshot,totals.subtotal))}</b></span>${totals.extra?`<span>${html(localizedText(snapshot,'附加费用','Extra Fee'))} <b>${html(money(snapshot,totals.extra))}</b></span>`:''}${totals.tax?`<span>${html(localizedText(snapshot,'税费','Tax'))} <b>${html(money(snapshot,totals.tax))}</b></span>`:''}${totals.discount?`<span>${html(localizedText(snapshot,'折扣','Discount'))} <b>- ${html(money(snapshot,totals.discount))}</b></span>`:''}<span class="grand">${html(localizedText(snapshot,'总计','Total'))} <b>${html(money(snapshot,totals.total))}</b></span></div>`}`;
      }},
      ...(tableSectionEnabled(snapshot,'logistics')?[{key:'logistics',label:snapshot.packing?localizedText(snapshot,'包装物流','Packing & Shipping'):localizedText(snapshot,'物流信息','Logistics'),count:fieldPairs(snapshot,'logistics').length,render:()=>workbookTable([localizedText(snapshot,'字段','Field'),localizedText(snapshot,'内容','Value')],pairRows(snapshot,'logistics'))}]:[]),
      ...(!snapshot.packing&&tableSectionEnabled(snapshot,'payment')?[{key:'payment',label:localizedText(snapshot,'收款信息','Payment'),count:fieldPairs(snapshot,'payment').length,render:()=>workbookTable([localizedText(snapshot,'字段','Field'),localizedText(snapshot,'内容','Value')],pairRows(snapshot,'payment'))}]:[]),
      ...(tableSectionEnabled(snapshot,'terms')?[{key:'terms',label:localizedText(snapshot,'条款备注','Terms & Remarks'),count:fieldPairs(snapshot,'terms').length,render:()=>workbookTable([localizedText(snapshot,'字段','Field'),localizedText(snapshot,'内容','Value')],pairRows(snapshot,'terms'))}]:[])
    ];
    return sheets.filter(sheet=>sheet.count>0||sheet.key==='products');
  }

  function parseWorkbookCellRef(ref) {
    const match = String(ref || '').match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    let col = 0;
    for (const ch of match[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
    return {row:Number(match[2]), col};
  }

  function workbookMergeLayout(sheet) {
    const starts = new Map();
    const covered = new Set();
    (sheet.merges || []).forEach(range => {
      const [fromRef,toRef] = String(range).split(':');
      const from = parseWorkbookCellRef(fromRef);
      const to = parseWorkbookCellRef(toRef || fromRef);
      if (!from || !to) return;
      const rowspan = Math.max(1,to.row-from.row+1);
      const colspan = Math.max(1,to.col-from.col+1);
      starts.set(`${from.row}:${from.col}`,{rowspan,colspan});
      for (let row=from.row;row<=to.row;row+=1) {
        for (let col=from.col;col<=to.col;col+=1) {
          if (row !== from.row || col !== from.col) covered.add(`${row}:${col}`);
        }
      }
    });
    return {starts,covered};
  }

  function workbookCellDisplay(cell) {
    if (!cell) return '';
    if(cell.imageData)return `<img class="fp-workbook-product-image" src="${html(cell.imageData)}" alt="Product image">`;
    const value = cell.v ?? '';
    if (cell.t === 'n' || typeof value === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) return html(value);
      if ([STYLE.number,STYLE.totalNumber].includes(Number(cell.s))) {
        return html(number.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
      }
      return html(Number.isInteger(number) ? String(number) : number.toLocaleString(undefined,{maximumFractionDigits:6}));
    }
    return html(value);
  }

  function renderExportWorkbookSheet(sheet) {
    const columnCount = Math.max(
      1,
      sheet.widths?.length || 0,
      ...((sheet.rows || []).map(row => row.cells?.length || 0))
    );
    const layout = workbookMergeLayout(sheet);
    const cols = Array.from({length:columnCount},(_,index)=>{
      const excelWidth = Math.max(4,Number(sheet.widths?.[index]) || 14);
      return `<col style="width:${Math.round(excelWidth*7.2)}px">`;
    }).join('');
    const rows = (sheet.rows || []).map((row,rowIndex)=>{
      const rowNo = rowIndex + 1;
      const height = Math.max(24,Math.round((Number(row.height)||18)*1.33));
      const cells = [];
      for (let colIndex=0;colIndex<columnCount;colIndex+=1) {
        const colNo = colIndex + 1;
        const key = `${rowNo}:${colNo}`;
        if (layout.covered.has(key)) continue;
        const merge = layout.starts.get(key);
        const cell = row.cells?.[colIndex] || null;
        const style = Number(cell?.s || 0);
        const attrs = [
          merge?.rowspan > 1 ? `rowspan="${merge.rowspan}"` : '',
          merge?.colspan > 1 ? `colspan="${merge.colspan}"` : '',
          `class="fp-export-cell fp-xlsx-style-${style}${merge ? ' is-merged' : ''}"`,
          `data-cell-ref="${columnLetter(colIndex)}${rowNo}"`,
          cell?.previewField ? `data-preview-field="${html(cell.previewField)}"` : '',
          Number.isInteger(cell?.previewItemIndex) ? `data-preview-item-index="${cell.previewItemIndex}"` : '',
          cell?.previewItemKey ? `data-preview-item-key="${html(cell.previewItemKey)}"` : ''
        ].filter(Boolean).join(' ');
        cells.push(`<td ${attrs}>${workbookCellDisplay(cell)}</td>`);
      }
      return `<tr style="height:${height}px">${cells.join('')}</tr>`;
    }).join('');
    return `<div class="fp-export-sheet-scroll"><table class="fp-export-sheet"><colgroup>${cols}</colgroup><tbody>${rows || `<tr><td class="fp-export-cell">${html(localizedText(stateSnapshot(),'暂无可显示数据','No data to display'))}</td></tr>`}</tbody></table></div>`;
  }

  function renderTablePreview({force=false}={}) {
    const mount = $('fpTableOutputPreview');
    if (!mount) return;
    const snapshot = stateSnapshot();
    const documentKey = `${snapshot.type||''}|${clean(value(snapshot,'invoiceNo'))}`;
    const documentChanged = Boolean(lastPreviewDocumentKey && lastPreviewDocumentKey !== documentKey);
    lastPreviewDocumentKey = documentKey;
    const oldCanvas=mount.querySelector('.fp-workbook-canvas');
    const oldScroll=documentChanged?{top:0,left:0}:{top:oldCanvas?.scrollTop??previewCanvasScroll.top,left:oldCanvas?.scrollLeft??previewCanvasScroll.left};
    if(documentChanged)previewCanvasScroll={top:0,left:0};
    const renderScrollRevision=workbookUserScrollRevision;
    const renderSequence=++previewRenderSequence;
    tableSheetLayout=resolvedTableLayout(snapshot,currentPaperPreference());
    const signature=JSON.stringify({type:snapshot.type,fields:snapshot.fields,items:snapshot.items.map(item=>({...item,image:imageSignature(item.image)})),sheet:activePreviewSheet,zoom:previewZoom,fullscreen:previewFullscreen,layout:tableSheetLayout,paper:currentPaperPreference()});
    if(!force&&signature===lastPreviewSignature){applyPendingPreviewTarget({scroll:false});return;}
    lastPreviewSignature=signature;
    mount.classList.add('is-refreshing');
    const items = meaningfulItems(snapshot);
    const meta = documentMeta(snapshot);
    const sheets = customerWorkbookSheets(snapshot);
    let activeSheet = sheets.find(sheet=>sheet.name===activePreviewSheet);
    if (!activeSheet) {
      activeSheet = sheets[0];
      activePreviewSheet = activeSheet?.name || '';
    }
    const tabs = sheets.map(sheet=>`<button type="button" class="${sheet.name===activePreviewSheet?'active':''}" data-preview-sheet="${html(sheet.name)}"><span>${html(sheet.name)}</span><small>${sheet.rows?.length||0}</small></button>`).join('');
    mount.innerHTML = `
      <div class="fp-workbook-preview fp-export-faithful-preview fp-workbook-layout-${tableSheetLayout} ${previewFullscreen?'is-fullscreen':''}" style="--fp-workbook-zoom:${previewZoom/100}">
        <header class="fp-workbook-toolbar">
          <div class="fp-workbook-file"><span class="fp-workbook-icon">X</span><div><b>${html(meta.title)} · ${html(localizedText(snapshot,'客户 Excel 预览','Customer Excel Preview'))}</b><small>${html(value(snapshot,'invoiceNo')||localizedText(snapshot,'未填写单据编号','Document number not set'))} · ${items.length} ${html(localizedText(snapshot,'个商品','items'))} · ${html(value(snapshot,'currency')||'USD')}</small></div></div>
          <div class="fp-workbook-tools">
            <div class="fp-v3340-paper-switch" role="group" aria-label="纸张版式"><span>${html(localizedText(snapshot,'纸张版式','Paper layout'))}</span><button type="button" data-workbook-paper-choice="auto" class="${currentPaperPreference()==='auto'?'active':''}">${html(localizedText(snapshot,'自适应','Auto'))}</button><button type="button" data-workbook-paper-choice="portrait" class="${currentPaperPreference()==='portrait'?'active':''}">${html(localizedText(snapshot,'竖版','Portrait'))}</button><button type="button" data-workbook-paper-choice="landscape" class="${currentPaperPreference()==='landscape'?'active':''}">${html(localizedText(snapshot,'横版','Landscape'))}</button></div>
            <div class="fp-v3340-zoom-controls"><button type="button" data-workbook-action="zoom-out">−</button><span>${previewZoom}%</span><button type="button" data-workbook-action="zoom-in">＋</button><button type="button" data-workbook-action="fit">${html(localizedText(snapshot,'适合窗口','Fit view'))}</button><button type="button" data-workbook-action="fullscreen">${previewFullscreen?localizedText(snapshot,'退出全屏','Exit fullscreen'):localizedText(snapshot,'全屏核对','Fullscreen review')}</button></div>
          </div>
        </header>
        <div class="fp-workbook-canvas" tabindex="0" aria-label="客户 Excel 预览，可上下左右滚动并按住拖动"><div class="fp-workbook-sheet fp-export-workbook-sheet" style="zoom:var(--fp-workbook-zoom);transform:none;transform-origin:top left;width:max-content">${activeSheet?renderExportWorkbookSheet(activeSheet):''}</div></div>
        <nav class="fp-workbook-tabs" aria-label="工作表">${tabs}</nav>
      </div>`;
    const restoreScroll=()=>{
      if(renderSequence!==previewRenderSequence)return;
      const canvas=mount.querySelector('.fp-workbook-canvas');
      if(!canvas)return;
      const userMovedDuringRender=workbookUserScrollRevision!==renderScrollRevision;
      const targetScroll=userMovedDuringRender?previewCanvasScroll:oldScroll;
      const maxTop=Math.max(0,canvas.scrollHeight-canvas.clientHeight);
      const maxLeft=Math.max(0,canvas.scrollWidth-canvas.clientWidth);
      canvas.scrollTop=Math.min(maxTop,Math.max(0,targetScroll.top||0));
      canvas.scrollLeft=Math.min(maxLeft,Math.max(0,targetScroll.left||0));
      previewCanvasScroll={top:canvas.scrollTop,left:canvas.scrollLeft};
    };
    restoreScroll();
    window.requestAnimationFrame(()=>{restoreScroll();mount.classList.remove('is-refreshing');});
  }

  function previewTargetSelector(target) {
    if (!target) return '';
    if (target.fieldId) return `[data-preview-field="${CSS.escape(target.fieldId)}"]`;
    if (Number.isInteger(target.itemIndex) && target.itemKey) return `[data-preview-item-index="${target.itemIndex}"][data-preview-item-key="${CSS.escape(target.itemKey)}"]`;
    return '';
  }

  function previewScrollContainer(node){
    if(!node)return null;
    if(previewMode==='table')return document.querySelector('#fpTableOutputPreview .fp-workbook-canvas')||node.closest('.fp-export-sheet-scroll');
    return document.querySelector('.preview-shell')||node.closest('[style*="overflow"],.pdf-preview-scroll');
  }
  function scrollPreviewTarget(node,{behavior='auto',block='nearest',inline='nearest'}={}){
    const container=previewScrollContainer(node);if(!container)return false;
    const cr=container.getBoundingClientRect(),nr=node.getBoundingClientRect();
    let top=container.scrollTop,left=container.scrollLeft;
    if(block==='center')top+=nr.top-cr.top-(container.clientHeight-nr.height)/2;
    else if(nr.top<cr.top)top+=nr.top-cr.top-12;
    else if(nr.bottom>cr.bottom)top+=nr.bottom-cr.bottom+12;
    if(inline==='center')left+=nr.left-cr.left-(container.clientWidth-nr.width)/2;
    else if(nr.left<cr.left)left+=nr.left-cr.left-12;
    else if(nr.right>cr.right)left+=nr.right-cr.right+12;
    container.scrollTo({top:Math.max(0,top),left:Math.max(0,left),behavior});return true;
  }

  function clearPreviewHighlight() {
    qsa('.fp-preview-live-highlight,.fp-preview-live-highlight-soft').forEach(node=>node.classList.remove('fp-preview-live-highlight','fp-preview-live-highlight-soft'));
  }

  function applyPendingPreviewTarget(options={}) {
    const target=pendingPreviewTarget;
    let scroll=options.scroll??target?._scroll??false;
    if(previewMode==='table'&&workbookReviewActive())scroll=false;
    const behavior=options.behavior??target?._behavior??'auto';
    const block=options.block??target?._block??'nearest';
    const inline=options.inline??target?._inline??'nearest';
    const sticky=options.sticky??target?._sticky??false;
    if(!target)return false;
    clearTimeout(previewHighlightTimer);
    clearPreviewHighlight();
    let node=null;
    if(previewMode==='table'){
      scroll=false;
      const selector=previewTargetSelector(target);
      node=selector?$('fpTableOutputPreview')?.querySelector(selector):null;
    }else{
      const root=$('piPaper');
      const needle=clean(target.value||target.label||'');
      if(root&&needle){
        const candidates=qsa('td,th,[class*="value"],p,span,div',root).filter(el=>clean(el.textContent).includes(needle));
        candidates.sort((a,b)=>clean(a.textContent).length-clean(b.textContent).length);
        node=candidates[0]||null;
      }
    }
    if(!node)return false;
    const highlight=node.closest('td,tr,.fp-export-cell,.document-section,.section,.card')||node;
    highlight.classList.add('fp-preview-live-highlight');
    if(scroll)scrollPreviewTarget(highlight,{behavior,block,inline});
    if(!sticky)pendingPreviewTarget=null;
    if(!sticky)previewHighlightTimer=window.setTimeout(()=>highlight.classList.remove('fp-preview-live-highlight'),1800);
    return true;
  }

  function focusPreviewTarget(target,{scroll=true,behavior='auto',sticky=false,block='nearest',inline='nearest'}={}) {
    if(previewMode==='table')scroll=false;
    pendingPreviewTarget={...target,_scroll:scroll,_behavior:behavior,_sticky:sticky,_block:block,_inline:inline};
    applyPendingPreviewTarget({scroll,behavior,sticky,block,inline});
    if(previewMode!=='table')window.setTimeout(()=>applyPendingPreviewTarget({scroll,behavior,sticky,block,inline}),scroll?70:0);
  }
  function setSheetLayout(layout,{announce=false,persist=true,syncPaper=true}={}){
    const preference=['auto','portrait','landscape'].includes(layout)?layout:(layout==='wide'?'landscape':'portrait');
    if(syncPaper){
      const hidden=$('paperOrientation');if(hidden)hidden.value=preference;
      try{window.FlypigBOXPaperLayout?.setPreference?.(preference,{announce:false});}catch(_){ }
    }
    tableSheetLayout=resolvedTableLayout(stateSnapshot(),preference);
    if(persist){try{localStorage.setItem('flypigbox_table_sheet_layout_v3314',tableSheetLayout);}catch(_){ }}
    lastPreviewSignature='';renderTablePreview({force:true});
    if(announce)notify(preference==='auto'?'已设为自适应纸张版式，PDF与客户 Excel 将按当前单据自动选择方向。':preference==='landscape'?'已切换横版，PDF预览、表格预览与客户 Excel 导出方向已同步。':'已切换竖版，PDF预览、表格预览与客户 Excel 导出方向已同步。','ok');
  }

  function createPreviewUI() {
    const toolbarPrimary = document.querySelector('.preview-toolbar-primary');
    const paper = $('piPaper');
    if (!toolbarPrimary || !paper || $('fpPreviewModeSwitcher')) return;
    const switcher = document.createElement('div');
    switcher.id = 'fpPreviewModeSwitcher';
    switcher.className = 'fp-preview-mode-switcher';
    switcher.innerHTML = `<span>预览 / Preview</span><div role="group" aria-label="切换预览方式"><button type="button" class="active" data-preview-mode="document">正式 PDF</button><button type="button" data-preview-mode="table">表格工作簿</button></div>`;
    const layout = $('paperLayoutCompact');
    toolbarPrimary.insertBefore(switcher, layout || null);
    const preview = document.createElement('section');
    preview.id = 'fpTableOutputPreview';
    preview.className = 'fp-table-output-preview';
    preview.hidden = true;
    paper.insertAdjacentElement('afterend',preview);
    switcher.addEventListener('click',event=>{
      const button = event.target.closest('[data-preview-mode]');
      if (button) setPreviewMode(button.dataset.previewMode,{announce:true,persist:true});
    });
    preview.addEventListener('click',event=>{
      const tab=event.target.closest('[data-preview-sheet]');
      if(tab){activePreviewSheet=tab.dataset.previewSheet;renderTablePreview({force:true});return;}
      const paperChoice=event.target.closest('[data-workbook-paper-choice]')?.dataset.workbookPaperChoice;
      if(paperChoice){
        setSheetLayout(paperChoice,{announce:true,persist:true,syncPaper:true});
        window.setTimeout(()=>preview.querySelector('[data-workbook-action="fit"]')?.click(),50);
        return;
      }
      const action=event.target.closest('[data-workbook-action]')?.dataset.workbookAction;
      if(!action)return;
      if(action==='zoom-out')previewZoom=Math.max(60,previewZoom-10);
      if(action==='zoom-in')previewZoom=Math.min(150,previewZoom+10);
      if(action==='fit'){
        const canvas=preview.querySelector('.fp-workbook-canvas');
        const sheet=preview.querySelector('.fp-export-sheet');
        const stage=preview.querySelector('.fp-v3329-sheet-stage')||preview.querySelector('.fp-workbook-sheet');
        if(canvas&&sheet){
          const style=getComputedStyle(canvas);
          const horizontalPadding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
          const available=Math.max(280,canvas.clientWidth-horizontalPadding-18);
          const currentScale=Math.max(.01,previewZoom/100);
          const renderedWidth=Math.max(1,sheet.getBoundingClientRect().width,stage?.getBoundingClientRect?.().width||0);
          const natural=Math.max(1,renderedWidth/currentScale);
          previewZoom=Math.max(35,Math.min(100,Math.floor(available/natural*100)));
        }
      }
      if(action==='fullscreen')previewFullscreen=!previewFullscreen;
      renderTablePreview({force:true});
    });
  }

  function createExportUI() {
    const actions = document.querySelector('#previewExportActions .toolbar-actions');
    const pdfButton = $('exportPdfBtn');
    if (!actions || !pdfButton || $('fpSpreadsheetExportMenu')) return;

    const menu = document.createElement('details');
    menu.id = 'fpSpreadsheetExportMenu';
    menu.className = 'fp-spreadsheet-export-menu';
    menu.innerHTML = `<summary class="btn secondary" aria-haspopup="menu" aria-expanded="false">📊 导出表格 <span aria-hidden="true">⌄</span></summary>`;

    const dropdown = document.createElement('div');
    dropdown.id = 'fpSpreadsheetExportDropdown';
    dropdown.className = 'fp-spreadsheet-export-dropdown';
    dropdown.setAttribute('role','menu');
    dropdown.hidden = true;
    dropdown.innerHTML = `<button type="button" role="menuitem" data-sheet-export="customer-xlsx"><b>客户版 Excel (.xlsx)</b><small>接近正式单据结构，适合客户修改数量和内部审批</small></button><button type="button" role="menuitem" data-sheet-export="data-xlsx"><b>数据版 Excel (.xlsx)</b><small>多工作表结构，适合采购、财务、仓库与 ERP 数据处理</small></button><button type="button" role="menuitem" data-sheet-export="csv"><b>商品明细 CSV</b><small>每行一个商品，适合快速导入其他系统</small></button>`;

    actions.insertBefore(menu,pdfButton);
    document.body.appendChild(dropdown);

    const summary = menu.querySelector('summary');
    const closeMenu = () => {
      menu.open = false;
      dropdown.hidden = true;
      summary?.setAttribute('aria-expanded','false');
    };
    const positionMenu = () => {
      if (!menu.open || dropdown.hidden) return;
      const trigger = summary?.getBoundingClientRect();
      if (!trigger) return;
      const viewportWidth = Math.max(document.documentElement.clientWidth,window.innerWidth||0);
      const viewportHeight = Math.max(document.documentElement.clientHeight,window.innerHeight||0);
      const sideGap = viewportWidth <= 720 ? 12 : 10;
      const desiredWidth = viewportWidth <= 720 ? viewportWidth - sideGap * 2 : Math.min(340,viewportWidth - sideGap * 2);
      dropdown.style.width = `${Math.max(260,desiredWidth)}px`;
      dropdown.style.maxWidth = `calc(100vw - ${sideGap * 2}px)`;
      dropdown.style.left = `${sideGap}px`;
      dropdown.style.top = `${Math.round(trigger.bottom + 8)}px`;
      dropdown.style.visibility = 'hidden';
      dropdown.hidden = false;
      requestAnimationFrame(()=>{
        const rect = dropdown.getBoundingClientRect();
        let left = viewportWidth <= 720 ? sideGap : trigger.left;
        if (left + rect.width > viewportWidth - sideGap) left = viewportWidth - sideGap - rect.width;
        left = Math.max(sideGap,left);
        let top = trigger.bottom + 8;
        if (top + rect.height > viewportHeight - sideGap && trigger.top - rect.height - 8 >= sideGap) top = trigger.top - rect.height - 8;
        dropdown.style.left = `${Math.round(left)}px`;
        dropdown.style.top = `${Math.round(Math.max(sideGap,top))}px`;
        dropdown.style.visibility = 'visible';
      });
    };

    menu.addEventListener('toggle',()=>{
      const open = menu.open;
      summary?.setAttribute('aria-expanded',String(open));
      dropdown.hidden = !open;
      if (open) positionMenu();
    });
    dropdown.addEventListener('click',event=>{
      const button = event.target.closest('[data-sheet-export]');
      if (!button) return;
      event.preventDefault();
      const kind = button.dataset.sheetExport;
      closeMenu();
      if (kind === 'customer-xlsx') exportWorkbook('customer');
      if (kind === 'data-xlsx') exportWorkbook('data');
      if (kind === 'internal-xlsx') exportWorkbook('internal');
      if (kind === 'csv') exportCsv();
    });
    document.addEventListener('pointerdown',event=>{
      if (!menu.open) return;
      if (menu.contains(event.target) || dropdown.contains(event.target)) return;
      closeMenu();
    },true);
    document.addEventListener('keydown',event=>{
      if (event.key === 'Escape' && menu.open) { closeMenu(); summary?.focus(); }
    });
    window.addEventListener('resize',positionMenu,{passive:true});
    window.addEventListener('scroll',positionMenu,{passive:true,capture:true});
  }

  function setPreviewMode(mode,{announce=false,persist=true}={}) {
    const safe = mode === 'table' ? 'table' : 'document';
    const modeChanged = previewMode !== safe;
    previewMode = safe;
    ensurePreviewField().value = safe;
    document.body.classList.toggle('fp-table-preview-mode',safe === 'table');
    document.body.classList.toggle('fp-document-preview-mode',safe === 'document');
    const paper = $('piPaper');
    const preview = $('fpTableOutputPreview');
    if (paper) paper.hidden = safe === 'table';
    if (preview) preview.hidden = safe !== 'table';
    qsa('[data-preview-mode]').forEach(button=>{
      const active = button.dataset.previewMode === safe;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if (safe === 'table') {
      const empty=!preview?.querySelector('.fp-workbook-preview');
      renderTablePreview({force:modeChanged||empty});
    } else if(modeChanged) window.FlypigBOXApp?.renderPreview?.();
    if (persist) { try { localStorage.setItem(PREVIEW_STORAGE_KEY,safe); } catch (_) {} }
    if (announce) notify(safe === 'table'?'已切换到客户版 Excel 导出效果预览；空白字段和空栏目不会显示。':'已切换到正式单据预览，PDF 版式、分页、签名和公章保持原样。','ok');
  }

  function restorePreviewMode() {
    let saved = ensurePreviewField().value;
    try { saved = saved || localStorage.getItem(PREVIEW_STORAGE_KEY) || ''; } catch (_) {}
    const editorMode=$('editorViewMode')?.value;
    setPreviewMode(editorMode==='table'||saved==='table' ? 'table' : 'document',{announce:false,persist:false});
  }

  function schedulePreview(delay=PREVIEW_INPUT_DEBOUNCE) {
    if (previewMode !== 'table' || previewComposing) return;
    clearTimeout(renderTimer);
    const run=()=>{
      if(previewMode!=='table'||previewComposing)return;
      const remaining=workbookReviewUntil-Date.now();
      if(remaining>0){renderTimer=setTimeout(run,Math.min(1600,remaining+90));return;}
      renderTablePreview();
    };
    renderTimer=setTimeout(run,delay);
  }

  function editorLocked() { return !window.HUIDI_LOCAL_ONLY?.localOnly && document.body.classList.contains('editor-login-restricted'); }
  function syncExportAccess() { qsa('#fpSpreadsheetExportMenu button').forEach(button=>{button.disabled=editorLocked();button.setAttribute('aria-disabled',String(editorLocked()));}); }
  function requireExportAccess() {
    if (window.HUIDI_LOCAL_ONLY?.localOnly || !editorLocked()) return true;
    notify('请先登录后导出 Excel 或 CSV。未登录状态仅支持带水印预览。','error');
    return false;
  }

  function validateExport(snapshot,{includePayment=false,internal=false}={}) {
    if (!meaningfulItems(snapshot).length) { notify('请至少填写一个有效商品后再导出表格文件。','error'); return false; }
    if (!internal && window.FlypigBOXTradeFactory?.validateBeforeExport && !window.FlypigBOXTradeFactory.validateBeforeExport({kind:'Excel / CSV'})) return false;
    if (includePayment && !snapshot.packing && on(snapshot.fields.showPayment) && fieldPairs(snapshot,'payment').length) {
      const account = value(snapshot,'bankAccount');
      const ok = window.confirm(`表格文件将包含收款资料${account?`（账号尾号 ${account.slice(-4)}）`:''}。\n\n请确认收款人、账号、SWIFT 和付款渠道已经通过已知联系方式人工核对。\n\n点击“确定”继续导出。`);
      if (!ok) return false;
    }
    const trade = value(snapshot,'tradeTerms');
    if (!internal && !snapshot.packing && trade && !/2020/.test(trade)) {
      const ok = window.confirm('当前贸易术语未明确注明 Incoterms® 2020。\n\n建议补充指定地点和版本后再发送客户。\n\n点击“确定”仍然导出。');
      if (!ok) return false;
    }
    return true;
  }

  /* ---------- Minimal XLSX writer (Open XML + uncompressed ZIP) ---------- */
  const encoder = new TextEncoder();
  let crcTable = null;
  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n=0;n<256;n+=1) { let c=n; for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); table[n]=c>>>0; }
    return table;
  }
  function crc32(bytes) {
    if (!crcTable) crcTable=makeCrcTable();
    let crc=0xffffffff;
    for (const byte of bytes) crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }
  function u16(value){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,value,true);return b;}
  function u32(value){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,value>>>0,true);return b;}
  function joinBytes(parts){const length=parts.reduce((sum,p)=>sum+p.length,0);const out=new Uint8Array(length);let offset=0;parts.forEach(p=>{out.set(p,offset);offset+=p.length;});return out;}
  function dosDateTime(date=new Date()) {
    const year=Math.max(1980,date.getFullYear());
    return {time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((Math.floor(date.getSeconds()/2))&31),date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31)};
  }
  function zipStore(files) {
    const locals=[],centrals=[];let offset=0;const stamp=dosDateTime();
    files.forEach(file=>{
      const name=encoder.encode(file.name);const data=typeof file.data==='string'?encoder.encode(file.data):file.data;const crc=crc32(data);
      const local=joinBytes([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
      locals.push(local);
      const central=joinBytes([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(stamp.time),u16(stamp.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
      centrals.push(central);offset+=local.length;
    });
    const centralBlob=joinBytes(centrals);const end=joinBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBlob.length),u32(offset),u16(0)]);
    return new Blob([...locals,centralBlob,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function colName(index){let name='';let n=index;while(n>0){n-=1;name=String.fromCharCode(65+n%26)+name;n=Math.floor(n/26);}return name;}
  function safeSheetName(name,used) {
    let base=clean(name).replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'Sheet';let candidate=base,index=2;
    while(used.has(candidate)){const suffix=` ${index++}`;candidate=(base.slice(0,31-suffix.length)+suffix);}
    used.add(candidate);return candidate;
  }
  const STYLE={normal:0,title:1,section:2,label:3,text:4,number:5,totalLabel:6,totalNumber:7,header:8,note:9,date:10};
  function textCell(v,s=STYLE.text,meta={}){return {v:String(v??''),t:'s',s,...meta};}
  function numberCell(v,s=STYLE.number,meta={}){return {v:num(v),t:'n',s,...meta};}
  function formulaCell(f,s=STYLE.number,cached=0,meta={}){return {f,t:'n',s,v:cached,...meta};}
  function blankCell(s=STYLE.normal){return {v:'',t:'s',s};}
  function cellXml(cell,row,col){if(!cell)return'';const ref=`${colName(col)}${row}`;const style=cell.s?` s="${cell.s}"`:'';if(cell.f)return`<c r="${ref}"${style}><f>${xml(cell.f)}</f><v>${Number(cell.v)||0}</v></c>`;if(cell.t==='n')return`<c r="${ref}"${style}><v>${Number(cell.v)||0}</v></c>`;return`<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(cell.v)}</t></is></c>`;}
  function brandSettings(){return window.FlypigBOXBranding?.get?.()||{};}
  function rgbHex(value,fallback='173B83'){const match=String(value||'').match(/^#?([0-9a-f]{6})$/i);return (match?match[1]:fallback).toUpperCase();}
  function mixWithWhite(hex,ratio=.88){const h=rgbHex(hex),n=parseInt(h,16),r=n>>16,g=n>>8&255,b=n&255;const mix=v=>Math.round(v*(1-ratio)+255*ratio).toString(16).padStart(2,'0').toUpperCase();return `${mix(r)}${mix(g)}${mix(b)}`;}
  function dataUriImage(dataUri){const match=String(dataUri||'').match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);if(!match)return null;const rawExt=match[1].toLowerCase();const ext=rawExt==='png'?'png':rawExt==='webp'?'webp':'jpeg';try{const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);return{ext,bytes};}catch{return null;}}

  function worksheetXml(sheet) {
    const rows=sheet.rows.map((row,index)=>{const rn=index+1;const ht=row.height?` ht="${row.height}" customHeight="1"`:'';return`<row r="${rn}"${ht}>${row.cells.map((cell,col)=>cellXml(cell,rn,col+1)).join('')}</row>`;}).join('');
    const widths=(sheet.widths||[]).map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${Math.max(4,Number(width)||10)}" customWidth="1"/>`).join('');
    const merges=sheet.merges?.length?`<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:'';
    const freeze=sheet.freeze?`<sheetViews><sheetView workbookViewId="0" showRowColHeaders="0"><pane xSplit="${sheet.freeze.x||0}" ySplit="${sheet.freeze.y||0}" topLeftCell="${sheet.freeze.cell||'A1'}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`:'<sheetViews><sheetView workbookViewId="0" showRowColHeaders="0"/></sheetViews>';
    const filter=sheet.autoFilter?`<autoFilter ref="${sheet.autoFilter}"/>`:'';
    const orientation=sheet.orientation==='portrait'?'portrait':'landscape';
    const drawing=sheet._drawingIndex?'<drawing r:id="rId1"/>':'';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${freeze}<sheetFormatPr defaultRowHeight="18"/><cols>${widths}</cols><sheetData>${rows}</sheetData>${filter}${merges}${drawing}<printOptions horizontalCentered="1" verticalCentered="0"/><pageMargins left="0.25" right="0.25" top="0.42" bottom="0.42" header="0.18" footer="0.18"/><pageSetup orientation="${orientation}" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
  function stylesXml(brandColor){const primary=rgbHex(brandColor),soft=mixWithWhite(primary,.88),soft2=mixWithWhite(primary,.94),line=mixWithWhite(primary,.76);return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF667085"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${primary}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${soft}"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${soft2}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF${line}"/></left><right style="thin"><color rgb="FF${line}"/></right><top style="thin"><color rgb="FF${line}"/></top><bottom style="thin"><color rgb="FF${line}"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;}
  function addRow(sheet,cells,height){sheet.rows.push({cells,height});return sheet.rows.length;}
  function merge(sheet,startCol,startRow,endCol,endRow=startRow){sheet.merges.push(`${colName(startCol)}${startRow}:${colName(endCol)}${endRow}`);}
  function addSection(sheet,title,colCount){const row=addRow(sheet,[textCell(title,STYLE.section),...Array(colCount-1).fill(blankCell())],22);merge(sheet,1,row,colCount);}
  function addPairSection(sheet,title,pairs,colCount){
    if(!pairs.length)return;
    addSection(sheet,title,colCount);
    const half=Math.max(3,Math.floor(colCount/2));
    const labelSpan=half>=4?2:1;
    const rowHeight=value=>{const length=String(value||'').length;return length>110?52:length>55?40:30;};
    for(let i=0;i<pairs.length;i+=2){
      const left=pairs[i],right=pairs[i+1];
      const leftField=previewFieldForLabel(left[0]);
      const rightField=right?previewFieldForLabel(right[0]):'';
      const cells=Array(colCount).fill(null);
      cells[0]=textCell(left[0],STYLE.label,{previewField:leftField});
      cells[labelSpan]=textCell(left[1],STYLE.text,{previewField:leftField});
      if(right){cells[half]=textCell(right[0],STYLE.label,{previewField:rightField});cells[half+labelSpan]=textCell(right[1],STYLE.text,{previewField:rightField});}
      const row=addRow(sheet,cells,Math.max(rowHeight(left[1]),rowHeight(right?.[1])));
      if(labelSpan>1)merge(sheet,1,row,labelSpan);
      if(labelSpan+1<half)merge(sheet,labelSpan+1,row,half);
      if(right){
        if(labelSpan>1)merge(sheet,half+1,row,half+labelSpan);
        if(half+labelSpan+1<colCount)merge(sheet,half+labelSpan+1,row,colCount);
      }
    }
  }
  function productCell(item,col,rowIndex){const raw=itemValue(item,col.key,rowIndex);const meta={previewItemIndex:rowIndex,previewItemKey:col.key};if(col.key==='image')return {...blankCell(STYLE.text),...meta,imageData:item.image||''};if(col.key==='amount')return num(item.qty)>0&&num(item.price)>0?formulaCell('0',STYLE.number,raw,meta):{...blankCell(STYLE.number),...meta};if(col.numeric)return num(raw)!==0?numberCell(raw,STYLE.number,meta):{...blankCell(STYLE.number),...meta};return textCell(raw,STYLE.text,meta);}

  function customerWorkbookSheets(snapshot) {
    const items=customerOutputItems(snapshot),columns=customerProductColumns(snapshot),colCount=Math.max(tableSheetLayout==='wide'?8:6,columns.length),meta=documentMeta(snapshot),profile=tableDocumentProfile(snapshot);
    const brand=brandSettings();
    const orientation=tableSheetLayout==='wide'?'landscape':'portrait';
    const brandImage=dataUriImage(brand.logoScope==='none'?'':brand.logo);
    const sheet={name:localizedText(snapshot,profile.sheet[0],profile.sheet[1]),rows:[],merges:[],widths:Array.from({length:colCount},(_,i)=>columns[i]?.width||14),freeze:{x:0,y:3,cell:'A4'},orientation,brandImage,images:[]};
    if(brandImage&&colCount>=5){const cells=Array(colCount).fill(null);cells[2]=textCell(meta.title,STYLE.title);const titleRow=addRow(sheet,cells,42);merge(sheet,3,titleRow,colCount);const subtitleParts=[localizedText(snapshot,profile.subtitle[0],profile.subtitle[1]),value(snapshot,'sellerName'),value(snapshot,'invoiceNo'),value(snapshot,'currency')].filter(Boolean);const sub=Array(colCount).fill(null);sub[2]=textCell(subtitleParts.join('    |    '),STYLE.note);const subtitle=addRow(sheet,sub,26);merge(sheet,3,subtitle,colCount);}else{const titleRow=addRow(sheet,[textCell(meta.title,STYLE.title),...Array(colCount-1).fill(blankCell())],32);merge(sheet,1,titleRow,colCount);const subtitleParts=[localizedText(snapshot,profile.subtitle[0],profile.subtitle[1]),value(snapshot,'sellerName'),value(snapshot,'invoiceNo'),value(snapshot,'currency')].filter(Boolean);if(subtitleParts.length){const subtitle=addRow(sheet,[textCell(subtitleParts.join('    |    '),STYLE.note),...Array(colCount-1).fill(blankCell())],24);merge(sheet,1,subtitle,colCount);}}
    addPairSection(sheet,localizedText(snapshot,profile.info[0],profile.info[1]),fieldPairs(snapshot,'basic'),colCount);
    addPairSection(sheet,localizedText(snapshot,profile.parties[0],profile.parties[1]),fieldPairs(snapshot,'parties'),colCount);
    if(tableSectionEnabled(snapshot,'delivery'))addPairSection(sheet,localizedText(snapshot,'收货、通知与地址','DELIVERY PARTIES'),fieldPairs(snapshot,'delivery'),colCount);
    addStructuredPairSections(sheet,snapshot,colCount);
    if(items.length){
      addSection(sheet,localizedText(snapshot,profile.product[0],profile.product[1]),colCount);
      const headerRow=addRow(sheet,columns.map(col=>textCell(col.label,STYLE.header)),32);
    const qtyIndex=columns.findIndex(col=>col.key==='qty')+1,priceIndex=columns.findIndex(col=>col.key==='price')+1,amountIndex=columns.findIndex(col=>col.key==='amount')+1;
    const productStart=sheet.rows.length+1;
    items.forEach((item,index)=>{
      const excelRow=sheet.rows.length+1;
      const cells=columns.map(col=>{
        if(col.key==='amount')return num(item.qty)>0&&num(item.price)>0?formulaCell(`${colName(qtyIndex)}${excelRow}*${colName(priceIndex)}${excelRow}`,STYLE.number,num(item.qty)*num(item.price),{previewItemIndex:index,previewItemKey:'amount'}):{...blankCell(STYLE.number),previewItemIndex:index,previewItemKey:'amount'};
        return productCell(item,col,index);
      });
      const imageCol=columns.findIndex(col=>col.key==='image');
      const image=dataUriImage(item.image);if(image&&imageCol>=0)sheet.images.push({data:image,row:excelRow-1,col:imageCol,name:`Product ${index+1}`});
      addRow(sheet,cells,item.image?48:34);
    });
    const productEnd=sheet.rows.length;
    if (!snapshot.packing && amountIndex>0 && items.length) {
      const labelCol=Math.max(1,amountIndex-1);const cells=Array(colCount).fill(null);cells[labelCol-1]=textCell(localizedText(snapshot,'商品小计','Subtotal'),STYLE.totalLabel);cells[amountIndex-1]=formulaCell(`SUM(${colName(amountIndex)}${productStart}:${colName(amountIndex)}${productEnd})`,STYLE.totalNumber,items.reduce((s,i)=>s+num(i.qty)*num(i.price),0));const row=addRow(sheet,cells,24);if(labelCol<amountIndex-1)merge(sheet,labelCol,row,amountIndex-1);
      const subtotalRef=`${colName(amountIndex)}${row}`;
      const subtotalValue=items.reduce((sum,item)=>sum+num(item.qty)*num(item.price),0);
      const feeRows=structuredFeeRows(snapshot,subtotalValue);
      const positiveRefs=[],discountRefs=[];
      feeRows.filter(item=>item.includeTotal).forEach(item=>{
        const cells=Array(colCount).fill(null);
        const modeNote=item.mode==='percent'?` (${item.value}%)`:'';
        const note=item.displayNote?`
${item.displayNote}`:'';
        cells[labelCol-1]=textCell(`${item.displayLabel}${modeNote}${note}`,STYLE.totalLabel);
        const formula=item.mode==='percent'?`${subtotalRef}*${item.value}/100`:`${item.amount}`;
        const r=addRow(sheet,cells,item.displayNote?38:24);
        sheet.rows[r-1].cells[amountIndex-1]=formulaCell(formula,STYLE.totalNumber,item.amount);
        const ref=`${colName(amountIndex)}${r}`;
        if(item.type==='discount')discountRefs.push(ref);else positiveRefs.push(ref);
      });
      const positiveFormula=positiveRefs.length?positiveRefs.join('+'):'0';
      const discountFormula=discountRefs.length?discountRefs.join('+'):'0';
      const included=feeRows.filter(item=>item.includeTotal);
      const calculatedTotal=subtotalValue+included.filter(item=>item.type!=='discount').reduce((sum,item)=>sum+item.amount,0)-included.filter(item=>item.type==='discount').reduce((sum,item)=>sum+item.amount,0);
      const totalRow=addRow(sheet,Array(colCount).fill(null),27);sheet.rows[totalRow-1].cells[labelCol-1]=textCell(localizedText(snapshot,'总计','TOTAL'),STYLE.totalLabel);sheet.rows[totalRow-1].cells[amountIndex-1]=formulaCell(`${subtotalRef}+${positiveFormula}-${discountFormula}`,STYLE.totalNumber,calculatedTotal);
      feeRows.filter(item=>!item.includeTotal).forEach(item=>{
        const cells=Array(colCount).fill(null);
        const suffix=localizedText(snapshot,'（不计入总计）','(Excluded from total)');
        cells[labelCol-1]=textCell(`${item.displayLabel} ${suffix}${item.displayNote?`
${item.displayNote}`:''}`,STYLE.note);
        cells[amountIndex-1]=numberCell(item.amount,STYLE.number);
        addRow(sheet,cells,item.displayNote?38:24);
      });
      }
    }
    if(tableSectionEnabled(snapshot,'logistics'))addPairSection(sheet,snapshot.packing?localizedText(snapshot,'包装与运输','PACKING & SHIPPING'):localizedText(snapshot,'物流信息','LOGISTICS DETAILS'),fieldPairs(snapshot,'logistics'),colCount);
    if(tableSectionEnabled(snapshot,'payment'))addPairSection(sheet,localizedText(snapshot,'收款账户','PAYMENT DETAILS'),fieldPairs(snapshot,'payment'),colCount);
    if(tableSectionEnabled(snapshot,'terms'))addPairSection(sheet,localizedText(snapshot,snapshot.type==='sales_contract'?'合同条款与备注':'条款与备注',snapshot.type==='sales_contract'?'CONTRACT TERMS & REMARKS':'TERMS & REMARKS'),fieldPairs(snapshot,'terms'),colCount);
    const hasSignature=tableSectionEnabled(snapshot,'signature')&&Boolean(clean(snapshot.assets?.signature)||clean(snapshot.assets?.stamp));
    if(hasSignature){addSection(sheet,localizedText(snapshot,'授权签字','AUTHORIZED SIGNATURE'),colCount);const signRow=addRow(sheet,[textCell(localizedText(snapshot,'签名和公章以正式 PDF 为准；仅在存在签章内容时显示本区。','Signature and stamp assets are included in the formal PDF; this section appears only when signature content exists.'),STYLE.note),...Array(colCount-1).fill(blankCell())],36);merge(sheet,1,signRow,colCount);}
    const extras=[...structuredExtraSheets(snapshot)];
    const deliveryPairs=fieldPairs(snapshot,'delivery');if(tableSectionEnabled(snapshot,'delivery')&&deliveryPairs.length)extras.push(keyValueSheet(localizedText(snapshot,'收货与地址','Delivery Parties'),deliveryPairs,snapshot));
    const logisticsPairs=fieldPairs(snapshot,'logistics');if(tableSectionEnabled(snapshot,'logistics')&&logisticsPairs.length)extras.push(keyValueSheet(localizedText(snapshot,'物流信息','Logistics'),logisticsPairs,snapshot));
    const paymentPairs=fieldPairs(snapshot,'payment');if(tableSectionEnabled(snapshot,'payment')&&paymentPairs.length)extras.push(keyValueSheet(localizedText(snapshot,'付款信息','Payment'),paymentPairs,snapshot));
    const termsPairs=fieldPairs(snapshot,'terms');if(tableSectionEnabled(snapshot,'terms')&&termsPairs.length)extras.push(keyValueSheet(localizedText(snapshot,snapshot.type==='sales_contract'?'合同条款':'条款与备注',snapshot.type==='sales_contract'?'Contract Terms':'Terms & Remarks'),termsPairs,snapshot));
    const feeSubtotal=items.reduce((sum,item)=>sum+num(item.qty)*num(item.price),0);
    const feePairs=structuredFeeRows(snapshot,feeSubtotal).map(item=>{
      const modeText=item.mode==='percent'?` (${item.value}%)`:'';
      const totalText=item.includeTotal?'':` ${localizedText(snapshot,'（不计入总计）','(Excluded from total)')}`;
      const note=item.displayNote?`
${item.displayNote}`:'';
      return [`${item.displayLabel}${modeText}${totalText}`,`${money(snapshot,item.amount)}${note}`];
    });
    if(feePairs.length)extras.push(keyValueSheet(localizedText(snapshot,'费用、税费与折扣','Fees, Tax & Discount'),feePairs,snapshot));
    const productSheet=items.length?productDataSheet(snapshot,{customer:true}):null;
    return [sheet,productSheet,...extras].filter(Boolean);
  }

  function productDataSheet(snapshot,{customer=false}={}) {
    const items=customer?customerOutputItems(snapshot):meaningfulItems(snapshot),columns=customer?customerProductColumns(snapshot):dataProductColumns(snapshot);const sheet={name:localizedText(snapshot,'商品明细','Product Details'),rows:[],merges:[],widths:columns.map(col=>col.width||14),freeze:{x:1,y:1,cell:'B2'},images:[]};
    addRow(sheet,columns.map(col=>textCell(col.label,STYLE.header)),30);
    const qtyIndex=columns.findIndex(col=>col.key==='qty')+1,priceIndex=columns.findIndex(col=>col.key==='price')+1,amountIndex=columns.findIndex(col=>col.key==='amount')+1,imageIndex=columns.findIndex(col=>col.key==='image');
    items.forEach((item,index)=>{const excelRow=sheet.rows.length+1;addRow(sheet,columns.map(col=>col.key==='amount'?(num(item.qty)>0&&num(item.price)>0?formulaCell(`${colName(qtyIndex)}${excelRow}*${colName(priceIndex)}${excelRow}`,STYLE.number,num(item.qty)*num(item.price),{previewItemIndex:index,previewItemKey:'amount'}):{...blankCell(STYLE.number),previewItemIndex:index,previewItemKey:'amount'}):productCell(item,col,index)),item.image&&imageIndex>=0?48:28);const image=dataUriImage(item.image);if(image&&imageIndex>=0)sheet.images.push({data:image,row:excelRow-1,col:imageIndex,name:`Product ${index+1}`});});
    sheet.autoFilter=`A1:${colName(columns.length)}${Math.max(1,sheet.rows.length)}`;return sheet;
  }
  function keyValueSheet(name,pairs,snapshot=null) {if(!pairs?.length)return null;const sheet={name,rows:[],merges:[],widths:[32,66],freeze:{x:0,y:1,cell:'A2'}};addRow(sheet,[textCell(snapshot?localizedText(snapshot,'字段','Field'):'Field',STYLE.header),textCell(snapshot?localizedText(snapshot,'内容','Value'):'Value',STYLE.header)],28);pairs.forEach(([label,val])=>addRow(sheet,[textCell(label,STYLE.label),textCell(val,STYLE.text)],String(val||'').length>80?44:30));return sheet;}
  function dataWorkbookSheets(snapshot) {return [productDataSheet(snapshot),keyValueSheet(localizedText(snapshot,'单据信息','Document Information'),fieldPairs(snapshot,'basic'),snapshot),keyValueSheet(localizedText(snapshot,'买卖双方','Seller & Buyer'),fieldPairs(snapshot,'parties'),snapshot),keyValueSheet(localizedText(snapshot,'收货与通知','Delivery Parties'),fieldPairs(snapshot,'delivery'),snapshot),...structuredExtraSheets(snapshot),keyValueSheet(localizedText(snapshot,'物流信息','Logistics'),fieldPairs(snapshot,'logistics'),snapshot),...(!snapshot.packing?[keyValueSheet(localizedText(snapshot,'付款信息','Payment'),fieldPairs(snapshot,'payment'),snapshot)]:[]),keyValueSheet(localizedText(snapshot,'条款与备注','Terms & Remarks'),fieldPairs(snapshot,'terms'),snapshot)].filter(Boolean);}

  function internalCostRows(snapshot) {
    let rows=[];
    try { const parsed=JSON.parse(snapshot.fields.factoryCostRowsJson||'[]'); rows=Array.isArray(parsed)?parsed:[]; } catch (_) {}
    const map=new Map(rows.map(row=>[String(row.itemKey||''),row]));
    return meaningfulItems(snapshot).map((item,index)=>({item,index,record:{itemKey:item.itemKey||`row_${index}`,unitCost:0,packingCost:0,inlandCost:0,otherCost:0,...(map.get(String(item.itemKey||''))||{})}}));
  }
  function internalCostSettings(snapshot) {
    const sale=value(snapshot,'currency')||'USD',cost=value(snapshot,'factoryCostCurrency')||'CNY';
    return {sale,cost,fx:cost===sale?1:Math.max(.000001,num(snapshot.fields.factoryFxRate)||1),overhead:num(snapshot.fields.factoryOverheadRate),commission:num(snapshot.fields.factoryCommissionRate),target:num(snapshot.fields.factoryTargetMargin)};
  }
  function internalCalc(item,record,settings) {
    const qty=num(item.qty),salePrice=num(item.price),direct=num(record.unitCost)+num(record.packingCost)+num(record.inlandCost)+num(record.otherCost);
    const base=direct/settings.fx*(1+settings.overhead/100),totalUnit=nearZero(base+salePrice*settings.commission/100),margin=nearZero(salePrice-totalUnit),marginPct=salePrice>0?nearZero(margin/salePrice*100):0,den=1-settings.commission/100-settings.target/100,suggested=den>0?nearZero(base/den):0;
    return {qty,salePrice,direct,totalUnit,margin,marginPct,suggested,sales:nearZero(salePrice*qty),totalCost:nearZero(totalUnit*qty),totalProfit:nearZero(margin*qty)};
  }
  function internalCostSheet(snapshot) {
    const settings=internalCostSettings(snapshot),entries=internalCostRows(snapshot);
    const widths=[7,24,28,10,12,14,14,14,14,14,16,16,13,13,16,15,16,13];
    const sheet={name:'内部核算-保密',rows:[],merges:[],widths,freeze:{x:2,y:3,cell:'C4'}};
    addRow(sheet,[textCell('CONFIDENTIAL · HUIDI 工厂内部核算',STYLE.title),...Array(widths.length-1).fill(blankCell())],36);merge(sheet,1,1,widths.length);
    addRow(sheet,[textCell(`单据：${value(snapshot,'invoiceNo')||'未编号'}　销售币种：${settings.sale}　成本币种：${settings.cost}　汇率：1 ${settings.sale} = ${settings.fx} ${settings.cost}　损耗：${settings.overhead}%　佣金：${settings.commission}%　目标毛利：${settings.target}%`,STYLE.note),...Array(widths.length-1).fill(blankCell())],30);merge(sheet,1,2,widths.length);
    const headers=['No.','Product','Specifications','Qty','Unit','Sale Price','Sale Amount',`Production Cost (${settings.cost})`,`Packing Cost (${settings.cost})`,`Inland Freight (${settings.cost})`,`Other Cost (${settings.cost})`,`Direct Cost (${settings.cost})`,`Unit Total Cost (${settings.sale})`,'Gross Profit / Unit','Margin %','Suggested Price','Total Gross Profit','Risk'];
    addRow(sheet,headers.map(h=>textCell(h,STYLE.header)),30);
    let totalSales=0,totalCost=0,totalProfit=0;
    entries.forEach(({item,index,record})=>{const c=internalCalc(item,record,settings);totalSales+=c.sales;totalCost+=c.totalCost;totalProfit+=c.totalProfit;const risk=c.margin<0?'NEGATIVE MARGIN':c.marginPct<settings.target?'BELOW TARGET':'OK';
      addRow(sheet,[numberCell(index+1),textCell(item.name),textCell(item.spec),numberCell(c.qty),textCell(item.unit),numberCell(c.salePrice),numberCell(c.sales),(num(record.unitCost)?numberCell(record.unitCost):blankCell(STYLE.number)),(num(record.packingCost)?numberCell(record.packingCost):blankCell(STYLE.number)),(num(record.inlandCost)?numberCell(record.inlandCost):blankCell(STYLE.number)),(num(record.otherCost)?numberCell(record.otherCost):blankCell(STYLE.number)),(num(c.direct)?numberCell(c.direct):blankCell(STYLE.number)),numberCell(c.totalUnit),numberCell(c.margin),numberCell(c.marginPct),numberCell(c.suggested),numberCell(c.totalProfit),textCell(risk,risk==='OK'?STYLE.text:STYLE.note)],28);
    });
    const marginPct=totalSales>0?totalProfit/totalSales*100:0;
    addRow(sheet,[textCell('SUMMARY',STYLE.totalLabel),...Array(4).fill(blankCell()),textCell('Sales',STYLE.totalLabel),numberCell(totalSales,STYLE.totalNumber),textCell('Cost',STYLE.totalLabel),numberCell(totalCost,STYLE.totalNumber),textCell('Profit',STYLE.totalLabel),numberCell(totalProfit,STYLE.totalNumber),textCell('Margin %',STYLE.totalLabel),numberCell(marginPct,STYLE.totalNumber),...Array(5).fill(blankCell())],30);
    sheet.autoFilter=`A3:${colName(widths.length)}${Math.max(3,sheet.rows.length-1)}`;return sheet;
  }
  function internalWorkbookSheets(snapshot) {
    const settings=internalCostSettings(snapshot);
    const summary=[
      ['保密级别 / Confidentiality','INTERNAL USE ONLY · 禁止发送客户'],['单据编号 / Document No.',value(snapshot,'invoiceNo')],['修订版本 / Revision',value(snapshot,'revisionNo')],['单据状态 / Status',statusLabel(value(snapshot,'documentStatus'))],['业务场景 / Scenario',scenarioLabel(value(snapshot,'tradeScenario'))],['制单人 / Prepared by',value(snapshot,'preparedBy')],['审核人 / Approved by',value(snapshot,'approvedBy')],['销售币种 / Sales Currency',settings.sale],['成本币种 / Cost Currency',settings.cost],[`汇率 / FX`,`1 ${settings.sale} = ${settings.fx} ${settings.cost}`],['制造 / 管理损耗',`${settings.overhead}%`],['平台 / 业务佣金',`${settings.commission}%`],['目标毛利率',`${settings.target}%`]
    ];
    return [internalCostSheet(snapshot),keyValueSheet('内部参数',summary),productDataSheet(snapshot),keyValueSheet('生产质量条件',factoryConditionPairs(snapshot))];
  }

  const APPROVAL_LABELS={not_required:'不需要 / Not required',required:'需要确认 / Approval required',pending:'待确认 / Pending',approved:'已确认 / Approved'};
  function approvalLabel(value){return APPROVAL_LABELS[clean(value)]||clean(value);}
  function factoryConditionPairs(snapshot){
    const f=snapshot.fields||{};
    return [
      ['生产启动条件 / Production Start Condition',f.productionStartCondition],
      ['样品确认 / Sample Approval',approvalLabel(f.sampleApproval)],
      ['图稿 / 包装确认 / Artwork Approval',approvalLabel(f.artworkApproval)],
      ['检验标准 / Inspection Standard',f.inspectionStandard],
      ['尺寸 / 颜色 / 工艺公差 / Tolerance',f.qualityTolerance],
      ['包装确认要求 / Packaging Approval',f.packagingConfirmation],
      ['质保与售后 / Warranty & After-sales',f.warrantyTerms],
      ['工厂交付补充说明 / Factory Delivery Note',f.factoryDeliveryNote],
      ['交期 / Lead Time',f.deliveryTime],
      ['预计发货日期 / Estimated Shipment',f.estimatedShipment],
      ['运输方式 / Shipping Method',f.shippingMethod],
      ['包装类型 / Package Type',f.packageType],
      ['运输唛头 / Shipping Marks',f.shippingMarks]
    ].map(row=>[clean(row[0]),clean(row[1])]).filter(row=>row[1]);
  }
  function factoryExecutionSheet(snapshot){
    const items=meaningfulItems(snapshot);
    const widths=[7,24,32,11,11,12,18,18];
    const sheet={name:'工厂执行单-保密',rows:[],merges:[],widths,freeze:{x:2,y:7,cell:'C8'}};
    addRow(sheet,[textCell('CONFIDENTIAL · INTERNAL FACTORY EXECUTION / 工厂执行单',STYLE.title),...Array(widths.length-1).fill(blankCell())],36);merge(sheet,1,1,widths.length);
    addRow(sheet,[textCell('仅限内部使用 · INTERNAL USE ONLY · 禁止发送客户',STYLE.note),...Array(widths.length-1).fill(blankCell())],24);merge(sheet,1,2,widths.length);
    const meta=[
      ['单据编号 / Document No.',value(snapshot,'invoiceNo')],['修订版本 / Revision',value(snapshot,'revisionNo')],
      ['单据状态 / Status',statusLabel(value(snapshot,'documentStatus'))],['业务场景 / Scenario',scenarioLabel(value(snapshot,'tradeScenario'))],
      ['买方 / Buyer',value(snapshot,'buyerName')],['客户 PO / Customer PO',value(snapshot,'customerPo')],
      ['制单人 / Prepared by',value(snapshot,'preparedBy')],['审核人 / Approved by',value(snapshot,'approvedBy')]
    ].filter(row=>clean(row[1]));
    if(meta.length){addSection(sheet,'ORDER CONTROL / 订单控制',widths.length);for(let i=0;i<meta.length;i+=2){const left=meta[i],right=meta[i+1],cells=Array(widths.length).fill(null);cells[0]=textCell(left[0],STYLE.label);cells[1]=textCell(left[1],STYLE.text);if(right){cells[4]=textCell(right[0],STYLE.label);cells[5]=textCell(right[1],STYLE.text);}const r=addRow(sheet,cells,28);merge(sheet,2,r,4);if(right)merge(sheet,6,r,8);}}
    addSection(sheet,'PRODUCT & PRODUCTION ITEMS / 商品与生产明细',widths.length);
    addRow(sheet,['No.','Product / 商品','Specifications / 规格','Qty / 数量','Unit / 单位','MOQ','Packing / 包装','Marks / 唛头'].map(h=>textCell(h,STYLE.header)),30);
    items.forEach((item,index)=>addRow(sheet,[numberCell(index+1),textCell(item.name),textCell(item.spec),num(item.qty)?numberCell(item.qty):blankCell(STYLE.number),textCell(item.unit),num(item.moq)?numberCell(item.moq):blankCell(STYLE.number),textCell(item.packageDescription),textCell(item.shippingMarks)],34));
    const conditions=factoryConditionPairs(snapshot);
    if(conditions.length){addSection(sheet,'PRODUCTION, QUALITY & DELIVERY / 生产、质量与交付',widths.length);conditions.forEach(([label,val])=>{const r=addRow(sheet,[textCell(label,STYLE.label),textCell(val,STYLE.text),...Array(widths.length-2).fill(null)],34);merge(sheet,2,r,widths.length);});}
    return sheet;
  }
  function factoryWorkbookSheets(snapshot){
    const control=[
      ['保密级别 / Confidentiality','INTERNAL USE ONLY · 禁止发送客户'],
      ['单据编号 / Document No.',value(snapshot,'invoiceNo')],['修订版本 / Revision',value(snapshot,'revisionNo')],
      ['单据状态 / Status',statusLabel(value(snapshot,'documentStatus'))],['业务场景 / Scenario',scenarioLabel(value(snapshot,'tradeScenario'))],
      ['制单人 / Prepared by',value(snapshot,'preparedBy')],['审核人 / Approved by',value(snapshot,'approvedBy')]
    ].filter(row=>clean(row[1]));
    return [factoryExecutionSheet(snapshot),keyValueSheet('生产质量条件',factoryConditionPairs(snapshot)),keyValueSheet('内部控制',control)];
  }

  function spreadsheetImageContentType(ext){return ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':'image/png';}
  function sheetDrawingImages(sheet){
    const images=[];
    if(sheet.brandImage?.bytes?.length)images.push({image:sheet.brandImage,row:0,col:0,toRow:2,toCol:2,name:'Company Logo',colOff:90000,rowOff:50000});
    (sheet.images||[]).forEach((entry,index)=>{
      const image=entry?.data?.bytes?.length?entry.data:null;if(!image)return;
      const row=Math.max(0,Number(entry.row)||0),col=Math.max(0,Number(entry.col)||0);
      images.push({image,row,col,toRow:Math.max(row+1,Number(entry.toRow)||row+1),toCol:Math.max(col+1,Number(entry.toCol)||col+1),name:entry.name||`Product Image ${index+1}`,colOff:25000,rowOff:25000});
    });
    return images;
  }
  function drawingXml(images){
    const anchors=images.map((entry,index)=>`<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${entry.col}</xdr:col><xdr:colOff>${entry.colOff||0}</xdr:colOff><xdr:row>${entry.row}</xdr:row><xdr:rowOff>${entry.rowOff||0}</xdr:rowOff></xdr:from><xdr:to><xdr:col>${entry.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${entry.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index+2}" name="${xml(entry.name)}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${index+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
  }
  function workbookBlob(sheets,title) {
    const used=new Set();sheets=sheets.filter(Boolean).map(sheet=>({...sheet,name:safeSheetName(sheet.name,used)}));
    const brand=brandSettings(),brandColor=brand.brandColor||'#173B83';
    let drawingCounter=0,mediaCounter=0;
    const mediaFiles=[];
    sheets.forEach(sheet=>{
      const images=sheetDrawingImages(sheet);
      if(!images.length){sheet._drawingIndex=0;sheet._drawingImages=[];return;}
      sheet._drawingIndex=++drawingCounter;
      sheet._drawingImages=images.map(entry=>{
        const mediaIndex=++mediaCounter;
        mediaFiles.push({index:mediaIndex,ext:entry.image.ext,bytes:entry.image.bytes});
        return {...entry,mediaIndex};
      });
    });
    const now=new Date().toISOString();
    const workbookSheets=sheets.map((sheet,index)=>`<sheet name="${xml(sheet.name)}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('');
    const rels=sheets.map((_,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('');
    const overrides=sheets.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const extensionDefaults=[...new Set(mediaFiles.map(file=>file.ext))].map(ext=>`<Default Extension="${ext}" ContentType="${spreadsheetImageContentType(ext)}"/>`).join('');
    const drawingOverrides=Array.from({length:drawingCounter},(_,index)=>`<Override PartName="/xl/drawings/drawing${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('');
    const files=[
      {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${extensionDefaults}${drawingOverrides}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides}</Types>`},
      {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>HUIDI</dc:creator><dc:title>${xml(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`},
      {name:'docProps/app.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>HUIDI</Application><AppVersion>3.3.3.0</AppVersion></Properties>`},
      {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="0"/><sheets>${workbookSheets}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:'xl/styles.xml',data:stylesXml(brandColor)},
      ...sheets.map((sheet,index)=>({name:`xl/worksheets/sheet${index+1}.xml`,data:worksheetXml(sheet)}))
    ];
    sheets.forEach((sheet,sheetIndex)=>{
      if(!sheet._drawingIndex)return;
      const d=sheet._drawingIndex,images=sheet._drawingImages;
      files.push({name:`xl/worksheets/_rels/sheet${sheetIndex+1}.xml.rels`,data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`});
      files.push({name:`xl/drawings/drawing${d}.xml`,data:drawingXml(images)});
      files.push({name:`xl/drawings/_rels/drawing${d}.xml.rels`,data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${images.map((entry,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${entry.mediaIndex}.${entry.image.ext}"/>`).join('')}</Relationships>`});
    });
    mediaFiles.forEach(file=>files.push({name:`xl/media/image${file.index}.${file.ext}`,data:file.bytes}));
    return zipStore(files);
  }

  function saveBlob(blob,filename) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}

  function exportWorkbook(mode) {
    if (!requireExportAccess()) return;
    const snapshot=stateSnapshot();const internal=mode==='internal'||mode==='factory';if(!validateExport(snapshot,{includePayment:!internal,internal}))return;
    if(mode==='internal'){const ok=window.confirm(`即将导出“工厂内部核算 Excel”。

文件包含生产 / 采购成本、包装成本、国内运费、佣金、建议售价和毛利，仅限公司内部使用，禁止发送客户。

点击“确定”继续。`);if(!ok)return;}
    if(mode==='factory'){const ok=window.confirm(`即将导出“工厂执行单 Excel”。

文件包含生产、质量、包装和交付资料，仅限公司内部使用，禁止发送客户。

点击“确定”继续。`);if(!ok)return;}
    try {
      const sheets=mode==='customer'?customerWorkbookSheets(snapshot):mode==='internal'?internalWorkbookSheets(snapshot):mode==='factory'?factoryWorkbookSheets(snapshot):dataWorkbookSheets(snapshot);
      const meta=documentMeta(snapshot);const no=safeFile(value(snapshot,'invoiceNo')||meta.prefix);const suffix=mode==='customer'?'客户版':mode==='internal'?'工厂内部核算-保密':mode==='factory'?'工厂执行单-保密':'数据版';
      const blob=workbookBlob(sheets,`${meta.title} ${no} ${suffix}`);const fileKind=mode==='customer'?'customer':mode==='internal'?'internal':mode==='factory'?'factory':'data';saveBlob(blob,exportFileName('xlsx',fileKind));
      const message=mode==='internal'?`已生成工厂内部核算 Excel：${sheets.length} 个工作表。请勿发送客户。`:mode==='factory'?`已生成工厂执行单 Excel：${sheets.length} 个工作表。请勿发送客户。`:`已生成${suffix} Excel：${sheets.length} 个工作表。表格数据与当前正式 PDF 使用同一份内容。`;
      notify(message,'ok');
    } catch (error) { console.error(error); notify(`Excel 导出失败：${error?.message||error}`,'error'); }
  }

  function csvSafe(value) {const text=String(value??'');return /^[=+\-@]/.test(text)?`'${text}`:text;}
  function csvEscape(value){const text=csvSafe(value);return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  function exportCsv() {
    if (!requireExportAccess()) return;
    const snapshot=stateSnapshot();if(!validateExport(snapshot,{includePayment:false}))return;
    const columns=dataProductColumns(snapshot);const items=meaningfulItems(snapshot);const lines=[columns.map(col=>csvEscape(col.label)).join(',')];items.forEach((item,index)=>lines.push(columns.map(col=>csvEscape(itemValue(item,col.key,index))).join(',')));const blob=new Blob([`\ufeff${lines.join('\r\n')}`],{type:'text/csv;charset=utf-8'});saveBlob(blob,exportFileName('csv','products'));notify(`已导出 ${items.length} 行商品 CSV。文本字段已做公式注入保护。`,'ok');
  }

  let applyStatePreviewTimer=0;
  function wrapApplyState() {
    const app=window.FlypigBOXApp;if(!app?.applyState||app.applyState.__fpOutputWrapped)return;const original=app.applyState;const wrapped=function(...args){
      const result=original.apply(this,args);
      clearTimeout(applyStatePreviewTimer);
      applyStatePreviewTimer=setTimeout(()=>{
        const mode=ensurePreviewField().value;
        setPreviewMode(mode==='table'?'table':previewMode,{announce:false,persist:false});
        if(mode==='table'){lastPreviewSignature='';schedulePreview(220);}
      },180);
      return result;
    };wrapped.__fpOutputWrapped=true;app.applyState=wrapped;
  }

  function installObservers() {
    document.addEventListener('scroll',event=>{
      const target=event.target;
      if(target?.matches?.('#fpTableOutputPreview .fp-workbook-canvas')){
        previewCanvasScroll={top:target.scrollTop,left:target.scrollLeft};
      }
    },true);
    document.addEventListener('wheel',event=>{if(event.target?.closest?.('#fpTableOutputPreview .fp-workbook-canvas'))markWorkbookReview(1500);},{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{if(event.target?.closest?.('#fpTableOutputPreview .fp-workbook-canvas'))markWorkbookReview(1400);},true);
    document.addEventListener('touchstart',event=>{if(event.target?.closest?.('#fpTableOutputPreview .fp-workbook-canvas'))markWorkbookReview(1600);},{capture:true,passive:true});
    document.addEventListener('keydown',event=>{if(event.target?.closest?.('#fpTableOutputPreview .fp-workbook-canvas')&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(event.key))markWorkbookReview(1400);},true);
    const form=$('piForm');
    form?.addEventListener('compositionstart',()=>{previewComposing=true;clearTimeout(renderTimer);},true);
    form?.addEventListener('compositionend',()=>{previewComposing=false;schedulePreview(PREVIEW_INPUT_DEBOUNCE);},true);
    form?.addEventListener('input',event=>{if(event.isComposing)return;schedulePreview(PREVIEW_INPUT_DEBOUNCE);},true);
    form?.addEventListener('change',()=>schedulePreview(140),true);
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('#addItem,#addTenItems,[data-add-item],[data-remove-item],.remove-item,.item-remove'))schedulePreview(220);
    },true);
    ['HUIDI:apply-template','HUIDI:branding-updated','HUIDI:branding-ready','HUIDI:document-type-change','HUIDI:document-mode-change'].forEach(name=>document.addEventListener(name,()=>schedulePreview(120)));
    document.addEventListener('HUIDI:editor-view-change',event=>setPreviewMode(event.detail?.mode==='table'?'table':'document',{announce:false,persist:true}));
    document.addEventListener('HUIDI:paper-orientation-change',event=>{
      const preference=event.detail?.preference||currentPaperPreference();
      tableSheetLayout=resolvedTableLayout(stateSnapshot(),preference);
      lastPreviewSignature='';
      if(previewMode==='table')renderTablePreview({force:true});
    });
    ['HUIDI:auth-state-change','HUIDI:membership-change'].forEach(name=>document.addEventListener(name,syncExportAccess));
    window.addEventListener('storage',syncExportAccess);
  }

  function boot() {
    if (!$('piForm') || !$('previewShell')) return;
    ensurePreviewField();createPreviewUI();createExportUI();wrapApplyState();installObservers();syncExportAccess();restorePreviewMode();
    window.FlypigBOXTableOutput={setPreviewMode,setSheetLayout,getSheetLayout:()=>tableSheetLayout,syncPaperOrientation:(preference)=>setSheetLayout(preference,{announce:false,persist:true,syncPaper:false}),refresh:renderTablePreview,focusPreviewTarget,exportCustomerExcel:()=>exportWorkbook('customer'),exportDataExcel:()=>exportWorkbook('data'),exportInternalExcel:()=>exportWorkbook('internal'),exportFactoryExcel:()=>exportWorkbook('factory'),getInternalSnapshot:()=>stateSnapshot(),exportCsv};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();

