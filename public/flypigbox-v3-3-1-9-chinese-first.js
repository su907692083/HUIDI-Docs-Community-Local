/* HUIDI V3.3.6.24-R1.3A.10 — Chinese operator editing and multilingual output separation.
   The left editor remains concise Chinese. The right document preview keeps its selected output language.
   Explicit events only: no MutationObserver, ResizeObserver or polling loop. */
(()=>{
  'use strict';

  const VERSION='V3.3.6.24 R1.3A.14';
  const STORAGE_KEY='flypigbox_entry_english_assist_v3318';
  const MIGRATION_KEY='flypigbox_chinese_first_v3319_migrated';
  const OUTPUT_NAMES={bilingual:'中英双语',zh:'中文',en:'English',es:'Español',pt:'Português (Brasil)',de:'Deutsch',fr:'Français',it:'Italiano',ru:'Русский',ar:'العربية',ja:'日本語',ko:'한국어',tr:'Türkçe',nl:'Nederlands',pl:'Polski',vi:'Tiếng Việt',id:'Bahasa Indonesia',th:'ไทย'};
  const RESTORED_FIXED_LANGUAGES=['Español','Português','Deutsch','Français','Italiano','Русский','العربية','日本語','한국어','Türkçe','Nederlands','Polski','Tiếng Việt','Bahasa Indonesia','ไทย'];
  const KEEP_ACRONYM=/^(PI|CI|PL|PO|SKU|MOQ|HS\s*Code|CBM|SWIFT|IBAN|VAT|EORI|B\/L|AWB|ETD|ETA|ISO|OEM|ODM|Incoterms®?|API)$/i;
  const $=id=>document.getElementById(id);
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let scheduled=0;

  const LABELS={
    docLanguage:{label:'右侧单据语言'},
    currency:{label:'币种'},
    originCountry:{label:'原产国或地区',placeholder:'例如：中国 / China'},
    invoiceNo:{label:'单据编号',placeholder:'按编号规则自动生成，也可以手动输入'},
    issueDate:{label:'出单日期'},
    validUntil:{label:'有效期'},
    customerPo:{label:'客户采购单号（PO）',placeholder:'客户有采购单号时填写'},
    quoteNo:{label:'报价编号',placeholder:'有关联报价单时填写'},
    moq:{label:'最低起订量（MOQ）',placeholder:'例如：500 PCS；未填写不显示'},
    salesperson:{label:'业务员',placeholder:'负责本单据的业务员姓名'},
    piPrefix:{label:'编号前缀',placeholder:'例如：QT、PI、CI、PL、SC'},
    piScheme:{label:'编号方式'},
    piMarketCode:{label:'客户或国家代号',placeholder:'例如：US01、WAL、EU；不填时按客户国家推断'},
    piSerial:{label:'流水号',placeholder:'例如：001'},
    lockPiNo:{label:'发送客户后锁定编号，避免误改'},

    showOrigin:{label:'显示原产国'},
    showCustomerPo:{label:'显示客户采购单号（PO）'},
    showQuote:{label:'显示报价编号'},
    showMoq:{label:'显示最低起订量（MOQ）'},
    showSalesperson:{label:'显示业务员'},
    showProductImage:{label:'显示商品图片'},
    showHsCode:{label:'显示海关编码（HS Code）'},
    showDiscount:{label:'显示折扣'},
    showFreight:{label:'显示运费或附加费'},
    showTax:{label:'显示税费（VAT）'},
    showAmountWords:{label:'显示金额大写'},
    showLogistics:{label:'显示物流资料'},
    showPayment:{label:'显示收款资料'},
    showTerms:{label:'显示交易条款'},
    showRemarks:{label:'显示补充备注'},
    showSignature:{label:'显示签名与盖章图片'},

    tradeScenario:{label:'业务场景'},
    documentStatus:{label:'单据状态'},
    revisionNo:{label:'修订版本'},
    preparedBy:{label:'制单人'},
    approvedBy:{label:'审核人'},
    productionStartCondition:{label:'生产启动条件'},
    sampleApproval:{label:'样品确认状态'},
    artworkApproval:{label:'图稿或包装确认状态'},
    inspectionStandard:{label:'检验标准'},
    qualityTolerance:{label:'尺寸、颜色或工艺公差'},
    packagingConfirmation:{label:'包装确认要求'},
    warrantyTerms:{label:'质保与售后'},
    factoryDeliveryNote:{label:'工厂交付补充说明'},
    includeFactoryTermsInExternal:{label:'将工厂交付与质量说明显示在客户表格和表格文件中'},

    translationReviewed:{label:'我已核对：公司名称、联系人、型号、商品编号（SKU）、海关编码（HS Code）、金额、银行账号、SWIFT、品牌及国际贸易术语缩写保持原样；译文仅作辅助，正式导出前仍需人工确认。'},
    useOwnApi:{label:'高级设置：使用自己的翻译服务接口'},
    apiProvider:{label:'翻译服务商'},
    apiProfileSelect:{label:'已保存的接口配置'},
    apiProfileName:{label:'配置名称'},
    apiEndpoint:{label:'接口地址'},
    apiModel:{label:'模型名称'},
    apiKey:{label:'接口密钥'},

    sellerName:{label:'卖方公司'},
    sellerContact:{label:'卖方联系人'},
    sellerPhone:{label:'卖方电话'},
    sellerEmail:{label:'卖方邮箱'},
    sellerAddress:{label:'卖方公司地址'},
    sellerTaxId:{label:'卖方税务或海关识别号（可选）',placeholder:'可填写公司注册号、税务识别号、增值税号（VAT）或欧盟经营者编号（EORI）',help:'不同编号用途不同，请按客户或目的国要求填写。'},
    buyerName:{label:'买方公司'},
    buyerContact:{label:'买方联系人'},
    buyerCountry:{label:'客户国家或地区'},
    buyerCountryCode:{label:'国家代码（ISO）'},
    buyerPhone:{label:'客户电话'},
    buyerEmail:{label:'客户邮箱'},
    buyerWebsite:{label:'客户网站'},
    buyerAddress:{label:'买方公司地址',placeholder:'填写买方公司注册地址或主要营业地址',help:'实际送货地址请填写在“送货地址”或“最终收货人地址”，不要与买方公司地址混用。'},
    buyerTaxId:{label:'买方税务或海关识别号（可选）',placeholder:'可填写税务识别号、增值税号（VAT）、欧盟经营者编号（EORI）或其他海关登记号',help:'实际清关主体与买方不同时，请在最终收货人资料中补充。'},
    destinationPort:{label:'目的港或最终目的地'},
    consigneeName:{label:'最终收货人公司'},
    consigneeContact:{label:'最终收货人联系人'},
    consigneePhone:{label:'最终收货人电话'},
    consigneeEmail:{label:'最终收货人邮箱'},
    consigneeAddress:{label:'最终收货人地址'},
    notifyPartyName:{label:'到货通知方'},
    notifyPartyContact:{label:'到货通知方联系人'},
    notifyPartyPhone:{label:'到货通知方电话'},
    notifyPartyEmail:{label:'到货通知方邮箱'},
    notifyPartyAddress:{label:'到货通知方地址'},
    billToAddress:{label:'账单接收地址'},
    shipToAddress:{label:'送货地址'},

    extraFeeName:{label:'附加费用名称'},
    extraFeeAmount:{label:'附加费用金额'},
    taxAmount:{label:'税费金额（VAT）'},
    discountType:{label:'折扣方式'},
    discountValue:{label:'折扣值'},
    amountWordsOverride:{label:'金额大写内容'},

    shippingMethod:{label:'运输方式'},
    packageCount:{label:'总包装数'},
    packageType:{label:'包装类型'},
    netWeight:{label:'净重（N.W.，千克）'},
    grossWeight:{label:'毛重（G.W.，千克）'},
    cbm:{label:'总体积（CBM，立方米）'},
    logisticsCarrier:{label:'承运人或货代'},
    trackingNo:{label:'追踪号或运单号'},
    blNo:{label:'提单号（B/L）'},
    containerNo:{label:'柜号'},
    sealNo:{label:'封条号'},
    vesselFlight:{label:'船名、航班或车次'},
    etd:{label:'预计离港时间（ETD）'},
    eta:{label:'预计到港时间（ETA）'},
    packageDimensions:{label:'单箱尺寸'},
    shippingMarks:{label:'唛头或运输标记'},

    bankBeneficiary:{label:'收款人或账户名'},
    bankName:{label:'开户行'},
    bankAccount:{label:'收款账号'},
    bankSwift:{label:'银行国际代码（SWIFT）'},
    bankAddress:{label:'银行地址或付款备注'},
    savedPaymentTemplate:{label:'已保存的收款模板'},
    paymentTerms:{label:'付款条件'},
    syncPaymentTerms:{label:'付款方式与上方收款资料自动同步'},

    tradeTerms:{label:'国际贸易术语（Incoterms® 2020）'},
    deliveryTime:{label:'备货或生产周期'},
    portOfLoading:{label:'装运港或起运地点'},
    estimatedShipment:{label:'预计发运日期'},
    remarks:{label:'补充备注'},
    contractClauseTemplate:{label:'销售合同可选条款模板'},
    contractClauses:{label:'合同补充条款'},

    assetProfileSelect:{label:'已保存的签章组合'},
    assetProfileName:{label:'签章组合名称'},
    signatureLayout:{label:'签章排版方式'},
    stampX:{label:'公章左右位置'},
    stampY:{label:'公章上下位置'},
    stampRotate:{label:'公章旋转角度'},
    stampScale:{label:'公章大小'},
    signatureX:{label:'签名左右位置'},
    signatureY:{label:'签名上下位置'},
    signatureRotate:{label:'签名旋转角度'},
    signatureScale:{label:'签名大小'},
    emailAfterExport:{label:'导出后创建邮件草稿'}
  };

  const OPTION_LABELS={
    tradeScenario:{wholesale:'标准批发',sample:'样品订单',oem:'定制订单（OEM / ODM）',stock:'现货订单',project:'工程或项目订单'},
    documentStatus:{draft:'草稿',internal_review:'内部审核',sent:'已发送客户',customer_confirmed:'客户已确认',deposit_received:'已收定金',production:'生产中',ready_to_ship:'待发货',shipped:'已发货',completed:'已完成',cancelled:'已取消'},
    sampleApproval:{not_required:'不需要',required:'需要客户确认',pending:'待确认',approved:'已确认'},
    artworkApproval:{not_required:'不需要',required:'需要客户确认',pending:'待确认',approved:'已确认'},
    shippingMethod:{'':'未指定','Sea Freight':'海运','Air Freight':'空运',Express:'国际快递','Rail Freight':'铁路运输','Truck Freight':'陆运'},
    discountType:{percent:'按百分比扣减（%）',amount:'按固定金额扣减'},
    signatureLayout:{'stamp-left':'公章在左，签名在右（推荐）','sign-left':'签名在左，公章在右'}
  };


  const TEXT_SELECTORS={
    '#translateAllBtn':'智能翻译单据',
    '.fp-language-support-note':'当前可直接输出中英双语、中文和英文；其他语言已建立版本规划，等待语言服务连接后启用。',
    '.fp-trade-factory-header h2':'外贸出单与工厂执行控制台',
    '#applyTradeScenarioBtn':'应用业务场景',
    '#runTradeReadinessBtn':'检查出单完整性',
    '#syncFactoryTermsBtn':'写入对外条款',
    '.fp-trade-factory-details > summary':'生产、质量、包装与交付条件',
    '.api-card > details > summary':'语言版本与翻译（可选）',
    '#hostedAiPanel strong':'HUIDI 会员智能翻译',
    '#hostedAiPanel p':'右侧单据语言是唯一输出语言来源。当前仅在真实语言服务可用时生成译文；未连接时只保留语言版本和待确认状态。',
    '#openMapsBtn':'地图地址检索',
    '#apiProtocolChip':'当前服务协议',
    '#fetchGeminiModelsBtn':'读取可用模型',
    '#saveApiProfileBtn':'保存配置（不含密钥）'
  };

  const EXACT_TEXT={
    '买方 Buyer 是签约或付款主体；收货人 Consignee 是实际收货主体；通知方 Notify Party 是到港或交付通知对象。未填写时沿用买方资料，不会在 PDF 中重复显示。':'买方是签约或付款主体；最终收货人是实际收货主体；到货通知方负责接收抵港或交付通知。未填写时可以沿用买方资料，右侧单据不会重复显示。',
    '点击“写入对外条款 / Sync Terms”后，会追加到当前单据的备注或合同补充条款，可继续人工修改。':'点击“写入对外条款”后，会追加到当前单据的备注或合同补充条款，仍可继续人工修改。',
    'AI 状态同步':'语言状态同步',
    '高级选项：使用自己的 AI API':'高级设置：使用自己的翻译服务接口',
    '仅勾选后才显示 API 配置。相关文本将发送给您选择的第三方服务商；未勾选时始终使用 HUIDI 会员 AI。':'仅开启后才显示翻译服务接口配置。提交前会说明哪些文字将发送给所选服务商；未连接服务时不会生成译文。',
    '默认使用会员 AI 服务，翻译目标与 PDF 的单语 / 双语输出统一跟随页首“单据语言”。此模式不展示 API 地址、模型或密钥，也无需配置。':'右侧单据语言统一控制单语或双语输出。真实语言服务可用时才生成译文；服务未连接时只建立语言版本并等待人工填写或确认。'
  };

  const ITEM_LABELS=[
    ['.i-sku','商品编号（SKU）','例如：货号、SKU或产品编码'],
    ['.i-name','商品名称','填写客户可见的商品名称'],
    ['.i-spec','规格或型号','填写规格、型号、材质、颜色等'],
    ['.i-hs','海关编码（HS Code）','填写适用的海关编码'],
    ['.i-qty','数量',''],
    ['.i-unit','单位',''],
    ['.i-moq','最低起订量（MOQ）',''],
    ['.i-price','单价',''],
    ['.i-carton-no','箱号或箱号范围',''],
    ['.i-package-desc','包装说明',''],
    ['.i-net-weight','净重（N.W.）',''],
    ['.i-gross-weight','毛重（G.W.）',''],
    ['.i-cbm','体积（CBM）',''],
    ['.i-dimensions','外箱尺寸',''],
    ['.i-item-marks','唛头','']
  ];

  function migrate(){
    try{
      if(localStorage.getItem(MIGRATION_KEY)!=='1'){
        localStorage.setItem(STORAGE_KEY,'0');
        localStorage.setItem(MIGRATION_KEY,'1');
      }
    }catch(_){}
  }

  function setDirectText(label,text,control){
    const semantic=label.querySelector(':scope > [data-r13a6-label],:scope > [data-document-number-label],:scope > [data-fp-zh-label]');
    if(semantic){semantic.textContent=text;semantic.dataset.fpZhLabel='1';return;}
    const nestedHost=control&&control.parentElement!==label&&control.parentElement?.tagName==='SPAN'?control.parentElement:null;
    const host=nestedHost||label;
    const direct=[...host.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&String(node.nodeValue||'').trim());
    if(direct.length){direct[0].nodeValue=`${text} `;direct.slice(1).forEach(node=>{if(/[A-Za-z\/／]/.test(node.nodeValue||''))node.nodeValue='';});return;}
    const span=document.createElement('span');span.dataset.fpZhLabel='1';span.textContent=text;
    if(control?.matches('input[type="checkbox"],input[type="radio"]'))control.insertAdjacentElement('afterend',span);
    else host.insertBefore(span,control||host.firstChild);
  }

  function applyLabel(id,config){
    const control=$(id);const label=control?.closest('label');if(!control||!label)return;
    setDirectText(label,config.label,control);
    if(config.placeholder&&'placeholder' in control)control.placeholder=config.placeholder;
    const help=label.querySelector(':scope > [data-r13a6-help]');
    if(help&&config.help)help.textContent=config.help;
    label.dataset.fpOperatorLabel='zh';
  }

  function relabelOptions(id,map){
    const select=$(id);if(!select||select.tagName!=='SELECT')return;
    qsa('option',select).forEach(option=>{
      const originalValue=option.value;
      if(!option.hasAttribute('value'))option.setAttribute('value',originalValue);
      const next=map[originalValue];
      if(next)option.textContent=next;
    });
  }

  function compactBilingualText(text){
    const raw=String(text||'');
    if(!/[\/／]/.test(raw)||!/[\u3400-\u9fff]/.test(raw)||!/[A-Za-z]/.test(raw))return raw;
    const parts=raw.trim().split(/\s*[\/／]\s*/).map(v=>v.trim()).filter(Boolean);
    const chinese=parts.find(part=>/[\u3400-\u9fff]/.test(part));
    if(!chinese)return raw;
    const acronym=parts.find(part=>KEEP_ACRONYM.test(part));
    return acronym&&!chinese.toLowerCase().includes(acronym.toLowerCase())?`${chinese}（${acronym}）`:chinese;
  }

  function compactLegacyLabels(root){
    qsa('label,summary,button,.section-title h2,.paste-tip,.hint',root).forEach(node=>{
      if(node.closest('.preview-column,.preview-shell,#piPaper,#fpTableOutputPreview,[contenteditable="true"]'))return;
      [...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE&&String(child.nodeValue||'').trim()).forEach(child=>{
        const next=compactBilingualText(child.nodeValue);
        if(next!==child.nodeValue)child.nodeValue=`${next} `;
      });
    });
  }


  function localizeStaticText(root){
    Object.entries(TEXT_SELECTORS).forEach(([selector,text])=>{
      qsa(selector,root).forEach(node=>{if(!node.closest('.preview-column,.preview-shell,#piPaper,#fpTableOutputPreview'))node.textContent=text;});
    });
    qsa('p,span,small,summary,strong,button',root).forEach(node=>{
      if(node.closest('.preview-column,.preview-shell,#piPaper,#fpTableOutputPreview')||node.querySelector('input,select,textarea,button'))return;
      const current=String(node.textContent||'').replace(/\s+/g,' ').trim();
      if(EXACT_TEXT[current])node.textContent=EXACT_TEXT[current];
    });
  }

  function relabelItemRows(){
    qsa('.item-row').forEach(row=>{
      ITEM_LABELS.forEach(([selector,labelText,placeholder])=>{
        const control=row.querySelector(selector);const label=control?.closest('label');if(!control||!label)return;
        setDirectText(label,labelText,control);
        if(placeholder&&'placeholder' in control)control.placeholder=placeholder;
      });
    });
  }

  function hideEnglishAssist(root=document){
    qsa('.fp-field-en',root).forEach(node=>node.remove());
    qsa('[data-fp-english-assist],[data-table-english-assist],.fp-v3318-english-assist,.fp-table-english-assist',root).forEach(node=>{
      const wrap=node.closest('label')||node;wrap.hidden=true;wrap.setAttribute('aria-hidden','true');
    });
  }

  function ensureLanguageSeparation(){
    const language=$('docLanguage');const label=language?.closest('label');if(!language||!label)return;
    let card=$('fpR13A9LanguageSeparation');
    if(!card){
      card=document.createElement('aside');
      card.id='fpR13A9LanguageSeparation';
      card.className='fp-r13a9-language-separation';
      card.innerHTML=`<div class="fp-r13a9-language-state"><span>编辑区：<b>中文</b></span><span>右侧单据：<b data-fp-output-language></b></span></div><p>切换右侧单据语言，只改变预览、PDF和客户表格的固定标题与已确认语言内容，不改变左侧中文字段名称。</p><details><summary>其他语言版本状态</summary><p>${RESTORED_FIXED_LANGUAGES.join('、')}：固定标题、字段名和表头使用本地历史词典；商品名、备注、条款等业务内容保持原文，除非用户自行提供对应译文。</p></details>`;
      label.insertAdjacentElement('afterend',card);
    }
    const output=card.querySelector('[data-fp-output-language]');
    if(output)output.textContent=OUTPUT_NAMES[language.value]||'当前语言版本';
  }

  function stampVersion(){
    const badge=$('fpLiteVersion');
    if(badge){badge.textContent=VERSION;badge.title='正规商业发票与装箱单统一、分栏展开可见性候选版';}
    document.body.dataset.fpRelease='v3.3.6.24-r1.3a.13-formal-ci-pl-section-visibility';
    document.documentElement.dataset.fpOperatorLanguage='zh';
    const form=$('piForm');if(form)form.dataset.fpOperatorLanguage='zh';
  }

  function apply(){
    migrate();
    const form=$('piForm');if(!form)return;
    Object.entries(LABELS).forEach(([id,config])=>applyLabel(id,config));
    Object.entries(OPTION_LABELS).forEach(([id,map])=>relabelOptions(id,map));
    relabelItemRows();
    localizeStaticText(form);
    compactLegacyLabels(form);
    hideEnglishAssist(form);
    ensureLanguageSeparation();
    stampVersion();
  }

  function schedule(delay=40){
    clearTimeout(scheduled);
    scheduled=setTimeout(()=>requestAnimationFrame(apply),delay);
  }

  [
    'HUIDI:editor-view-change',
    'HUIDI:document-type-changed',
    'HUIDI:layout-updated',
    'HUIDI:apply-template',
    'HUIDI:startup-stable',
    'HUIDI:operator-labels-refresh'
  ].forEach(name=>document.addEventListener(name,()=>schedule(20)));

  document.addEventListener('change',event=>{
    const id=event.target?.id||'';
    if(['documentType','docMode','docLanguage','tradeScenario',...Object.keys(OPTION_LABELS)].includes(id))schedule(20);
  },true);

  document.addEventListener('click',event=>{
    if(event.target.closest('#piForm button,[data-doc-mode],[data-v3350-mode],[data-fp-template]'))schedule(70);
  },true);

  window.FlypigBOXChineseEditing={version:VERSION,refresh:()=>apply(),editorLanguage:'zh',outputLanguages:Object.keys(OUTPUT_NAMES)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(450),{once:true});else schedule(450);
})();
