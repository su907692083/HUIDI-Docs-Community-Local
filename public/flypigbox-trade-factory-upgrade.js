/* HUIDI V3.2.6.2 — editable sale prices, persisted costing settings and stable internal grid */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const num = value => Number(value || 0) || 0;
  const html = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const on = value => value === true || value === 'true' || value === '1' || value === 'on' || value === 1;

  const STATUS_LABELS = {
    draft:'草稿 / Draft',internal_review:'内部审核 / Internal Review',sent:'已发送客户 / Sent',customer_confirmed:'客户已确认 / Confirmed',
    deposit_received:'已收定金 / Deposit Received',production:'生产中 / In Production',ready_to_ship:'待发货 / Ready to Ship',
    shipped:'已发货 / Shipped',completed:'已完成 / Completed',cancelled:'已取消 / Cancelled'
  };
  const SCENARIO_LABELS = {wholesale:'标准批发 / Wholesale',sample:'样品订单 / Sample Order',oem:'OEM / ODM 定制',stock:'现货订单 / Stock Order',project:'工程 / 项目订单'};
  const APPROVAL_LABELS = {not_required:'不需要 / Not required',required:'需要客户确认 / Customer approval required',pending:'待确认 / Pending approval',approved:'已确认 / Approved'};

  const SCENARIOS = {
    wholesale:{paymentTerms:'30% T/T deposit in advance, 70% balance before shipment. / 30% 电汇定金，70% 余款发货前付清。',deliveryTime:'Within 15–30 days after receipt of deposit and confirmation of specifications. / 收到定金并确认规格后 15–30 天内交货。',productionStartCondition:'Production starts after deposit receipt, signed PI and final specification confirmation. / 收到定金、签回 PI 并确认最终规格后开始生产。',sampleApproval:'not_required',artworkApproval:'not_required',inspectionStandard:'Pre-shipment inspection according to confirmed specifications. / 按确认规格执行出货前检验。',qualityTolerance:'According to approved specifications and samples. / 按双方确认规格及样品执行。',packagingConfirmation:'Standard export packing unless otherwise agreed. / 未另行约定时采用标准出口包装。',warrantyTerms:'Limited warranty subject to the agreed product category and confirmed specification. / 按产品类别及确认规格提供有限质保。',factoryDeliveryNote:'Lead time starts after deposit and all commercial details are confirmed. / 交期自定金到账且全部商务资料确认后开始计算。'},
    sample:{paymentTerms:'100% payment before sample production. Sample and courier charges are non-refundable unless otherwise agreed. / 样品制作前支付 100% 费用；除另有约定外，样品费和快递费不退。',deliveryTime:'Within 7–12 days after payment and sample specification confirmation. / 付款并确认样品规格后 7–12 天内完成。',productionStartCondition:'Sample production starts after payment and written confirmation of specifications, color and branding. / 付款并书面确认规格、颜色及品牌要求后开始制作样品。',sampleApproval:'required',artworkApproval:'required',inspectionStandard:'Sample shall be checked against the confirmed specification before dispatch. / 样品发出前按确认规格检验。',qualityTolerance:'Mass production shall follow the approved sample. / 大货以客户确认样为质量依据。',packagingConfirmation:'Sample packaging is for presentation only unless final retail packaging is separately confirmed. / 样品包装仅用于展示，正式零售包装需另行确认。',warrantyTerms:'Sample evaluation does not replace final mass-production inspection. / 样品评估不能替代大货检验。',factoryDeliveryNote:'Mass production lead time will be confirmed separately after sample approval. / 样品确认后另行确认大货交期。'},
    oem:{paymentTerms:'30% T/T deposit in advance, 70% balance before shipment after inspection. / 30% 电汇定金，验货完成后发货前付清 70% 余款。',deliveryTime:'Within 25–45 days after deposit, signed PI, sample / drawing and packaging artwork approval. / 定金到账、PI 签回并确认样品 / 图纸及包装文件后 25–45 天内交货。',productionStartCondition:'Mass production starts only after deposit receipt and written approval of sample, drawing, logo, artwork and packaging. / 定金到账并书面确认样品、图纸、Logo、图稿及包装后方可量产。',sampleApproval:'required',artworkApproval:'required',inspectionStandard:'AQL 2.5 / 4.0 or the inspection standard separately agreed in writing. / 按 AQL 2.5 / 4.0 或双方书面确认的检验标准执行。',qualityTolerance:'Dimensions, color and workmanship shall follow the approved drawing and golden sample. / 尺寸、颜色和工艺以确认图纸及签样为准。',packagingConfirmation:'Barcode, label, color box, shipping mark and master carton artwork must be approved before mass production. / 条码、标签、彩盒、唛头和外箱图稿须在量产前确认。',warrantyTerms:'12-month limited warranty unless otherwise agreed; misuse, unauthorized modification and normal wear are excluded. / 除另有约定外提供 12 个月有限质保，不含误用、擅自改装和正常磨损。',factoryDeliveryNote:'Changes after approval may affect cost and lead time and require written confirmation. / 确认后变更可能影响价格和交期，须书面确认。'},
    stock:{paymentTerms:'100% payment before shipment unless credit terms are separately approved. / 除另行批准账期外，发货前支付 100% 货款。',deliveryTime:'Within 3–7 days after payment and stock confirmation. / 付款并确认库存后 3–7 天内发货。',productionStartCondition:'No production required; shipment is arranged after payment and final stock allocation. / 无需生产，付款并最终锁定库存后安排发货。',sampleApproval:'not_required',artworkApproval:'not_required',inspectionStandard:'Quantity and appearance inspection before shipment. / 发货前进行数量与外观检查。',qualityTolerance:'Subject to the existing stock specification and available batch. / 以现有库存规格和实际批次为准。',packagingConfirmation:'Existing factory packing applies unless repacking is quoted separately. / 默认使用现有工厂包装，重新包装需单独报价。',warrantyTerms:'Warranty follows the original product policy and batch condition. / 质保按原产品政策和实际批次执行。',factoryDeliveryNote:'Stock is not reserved until payment or written allocation confirmation. / 未付款或未书面锁货前，库存不予保留。'},
    project:{paymentTerms:'Payment by agreed milestones: deposit, production progress and balance before delivery. / 按约定里程碑付款：定金、生产进度款及交付前尾款。',deliveryTime:'According to the approved project schedule, drawings, sample and site requirements. / 按确认的项目计划、图纸、样品及现场要求执行。',productionStartCondition:'Production starts after contract effectiveness, deposit receipt, approved drawings / samples and final bill of quantities. / 合同生效、定金到账、图纸 / 样品及最终工程量清单确认后开始生产。',sampleApproval:'required',artworkApproval:'required',inspectionStandard:'Factory inspection plus customer or third-party inspection as agreed. / 按约定执行工厂检验及客户或第三方验货。',qualityTolerance:'According to approved technical drawings, project specification and signed sample. / 按确认技术图纸、项目规范和签样执行。',packagingConfirmation:'Packing and marks shall follow project batches, destination and site handling requirements. / 包装与唛头按项目批次、目的地及现场搬运要求执行。',warrantyTerms:'Warranty, spare parts and site service shall follow the signed contract and project scope. / 质保、备件和现场服务按已签合同及项目范围执行。',factoryDeliveryNote:'Any drawing, quantity or site-condition change requires written variation approval and may affect price and schedule. / 图纸、数量或现场条件变更须书面确认，并可能影响价格和工期。'}
  };

  let readiness = {blockers:[],warnings:[],passes:[]};
  let readinessTimer = 0;
  let costRenderTimer = 0;
  let itemObserver = null;
  let costInputSyncing = false;
  let costDispatchTimer = 0;
  const COST_SCROLL_KEY = 'flypigbox_cost_scroll_v324';

  function notify(message,type='ok'){ window.FlypigBOXApp?.setStatus?.(message,type); }
  function dispatch(input,name){ input?.dispatchEvent(new Event(name,{bubbles:true})); }
  function setField(id,value){ const input=$(id); if(!input)return; if(input.type==='checkbox')input.checked=Boolean(value); else input.value=value ?? ''; dispatch(input,input.tagName==='SELECT'||input.type==='checkbox'?'change':'input'); }
  function snapshot(){ return window.FlypigBOXApp?.formState?.(false) || {fields:{},items:[]}; }
  function currentType(){ return $('documentType')?.value || 'proforma_invoice'; }
  function meaningfulItems(state=snapshot()){ return (state.items||[]).filter(item=>clean(item.name)||clean(item.spec)||num(item.qty)||num(item.price)||clean(item.cartonNo)); }
  function validDate(value){ return /^\d{4}-\d{2}-\d{2}$/.test(clean(value)); }
  function normalizedHs(value){ return clean(value).replace(/[^0-9]/g,''); }
  function incotermCode(value){ return (clean(value).match(/\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i)?.[1]||'').toUpperCase(); }

  function generateFactorySummary(){
    const lines=[];
    const add=(label,value)=>{const v=clean(value);if(v)lines.push(`${label}: ${v}`);};
    add('Production Start / 生产启动',$('productionStartCondition')?.value);
    const sample=$('sampleApproval')?.value; if(sample&&sample!=='not_required')add('Sample Approval / 样品确认',APPROVAL_LABELS[sample]);
    const artwork=$('artworkApproval')?.value; if(artwork&&artwork!=='not_required')add('Artwork & Packing Approval / 图稿与包装确认',APPROVAL_LABELS[artwork]);
    add('Inspection Standard / 检验标准',$('inspectionStandard')?.value);
    add('Tolerance / 公差与质量依据',$('qualityTolerance')?.value);
    add('Packaging Confirmation / 包装确认',$('packagingConfirmation')?.value);
    add('Warranty / 质保与售后',$('warrantyTerms')?.value);
    add('Factory Delivery Note / 工厂交付说明',$('factoryDeliveryNote')?.value);
    const text=lines.join('\n');
    const hidden=$('factoryTermsSummary');if(hidden)hidden.value=text;
    return text;
  }

  function preferredScenarioMode(type,key){
    const schema=window.FlypigBOXDocumentSchema,rule=schema?.scenarioRules?.[key];
    if((type==='commercial_invoice'||type==='packing_list')&&['oem','project'].includes(key))return 'b2b';
    return rule?.preferredMode==='b2b'?'b2b':'ecommerce';
  }
  function scenarioToggleSet(type,key){
    const common={
      wholesale:['showTerms','showRemarks'],
      sample:['showProductImage','showFreight','showTerms','showRemarks'],
      oem:['showCustomerPo','showOrigin','showHsCode','showLogistics','showTerms','showRemarks'],
      stock:['showFreight','showTerms','showRemarks'],
      project:['showCustomerPo','showOrigin','showHsCode','showLogistics','showTerms','showRemarks']
    }[key]||[];
    const specific=[];
    if(type==='proforma_invoice'||type==='sales_contract')specific.push('showPayment','showSignature');
    if(type==='commercial_invoice')specific.push('showOrigin','showHsCode','showLogistics');
    if(type==='packing_list')specific.push('showLogistics');
    return new Set([...common,...specific]);
  }
  function applyScenarioDocumentProfile(key){
    const schema=window.FlypigBOXDocumentSchema,type=currentType(),mode=preferredScenarioMode(type,key);
    if(!schema)return mode;
    const modeButton=document.querySelector(`[data-doc-mode="${mode}"]`);
    if($('docMode')?.value!==mode&&modeButton)modeButton.click();else setField('docMode',mode);
    const extra=scenarioToggleSet(type,key);
    (schema.toggles||[]).forEach(id=>{
      if(!schema.toggleAllowed?.(id,type,mode))return;
      setField(id,Boolean(schema.toggleDefault?.(id,type,mode)||extra.has(id)));
    });
    document.body.dataset.fpTradeScenario=key;
    document.body.dataset.fpDocumentMode=mode;
    try{document.dispatchEvent(new CustomEvent('HUIDI:trade-scenario-applied',{detail:{scenario:key,documentType:type,docMode:mode,paper:schema.paperRecommendation?.(type,mode)||'portrait'}}));}catch(_){ }
    return mode;
  }
  function applyScenario(){
    const key=$('tradeScenario')?.value||'wholesale';const preset=SCENARIOS[key];if(!preset)return;
    const type=currentType(),mode=preferredScenarioMode(type,key),modeLabel=window.FlypigBOXDocumentSchema?.modeInfo?.(type,mode)?.label||(mode==='b2b'?'专业模式':'快速模式');
    const ok=window.confirm(`应用“${SCENARIO_LABELS[key]}”业务场景？

系统会切换到更匹配的“${modeLabel}”，并更新付款、交期、生产启动、样品 / 包装确认和检验标准。客户、商品、价格、银行账号和已填写物流值不会被删除。`);
    if(!ok)return;
    applyScenarioDocumentProfile(key);
    Object.entries(preset).forEach(([id,value])=>setField(id,value));
    if(!$('revisionNo')?.value)setField('revisionNo','R0');
    setField('documentStatus','draft');
    generateFactorySummary();
    window.FlypigBOXApp?.renderPreview?.();
    scheduleReadiness(30);
    notify(`已应用“${SCENARIO_LABELS[key]}”并切换到“${modeLabel}”。发送客户前仍需结合产品、工厂和目的国要求人工复核。`,'ok');
  }

  function syncFactoryTerms(){
    const type=currentType();
    if(type==='packing_list'||type==='commercial_invoice'){
      notify('装箱单和商业发票不建议加入生产质量条款。请在报价单、PI 或销售合同中写入。','error');return;
    }
    const summary=generateFactorySummary();if(!summary){notify('请先填写至少一项生产、检验、包装或质保条件。','error');return;}
    const targetId=type==='sales_contract'?'contractClauses':'remarks';const target=$(targetId);if(!target)return;
    const start='[HUIDI Factory Delivery & Quality]';const end='[/HUIDI Factory Delivery & Quality]';
    const block=`${start}\n${summary}\n${end}`;
    const pattern=/\n?\[HUIDI Factory Delivery & Quality\][\s\S]*?\[\/HUIDI Factory Delivery & Quality\]\n?/g;
    const existing=String(target.value||'').replace(pattern,'').trim();
    target.value=[existing,block].filter(Boolean).join('\n\n');
    setField('includeFactoryTermsInExternal',true);
    dispatch(target,'input');
    window.FlypigBOXApp?.renderPreview?.();
    scheduleReadiness(20);
    notify(`工厂交付与质量说明已写入${type==='sales_contract'?'合同补充条款':'补充备注'}。发送客户前请人工复核。`,'ok');
  }

  function pushIssue(list,severity,label,message,fieldId='',selector=''){ list.push({severity,label,message,fieldId,selector}); }
  function evaluateReadiness(){
    const state=snapshot();const f=state.fields||{};const items=meaningfulItems(state);const type=f.documentType||'proforma_invoice';
    const result={blockers:[],warnings:[],passes:[]};
    const pass=(label,message)=>pushIssue(result.passes,'pass',label,message);
    const block=(label,message,fieldId='',selector='')=>pushIssue(result.blockers,'block',label,message,fieldId,selector);
    const warn=(label,message,fieldId='',selector='')=>pushIssue(result.warnings,'warn',label,message,fieldId,selector);

    clean(f.invoiceNo)?pass('单据编号','已填写单据编号。'):block('单据编号','正式出单前必须填写单据编号。','invoiceNo');
    validDate(f.issueDate)?pass('出单日期','出单日期格式有效。'):block('出单日期','请填写有效的出单日期。','issueDate');
    clean(f.sellerName)?pass('卖方主体','已填写卖方公司。'):block('卖方主体','请填写卖方公司或工厂主体。','sellerName');
    clean(f.buyerName)?pass('买方主体','已填写买方公司。'):block('买方主体','请填写客户 / 买方公司。','buyerName');
    /^[A-Z]{3}$/.test(clean(f.currency).toUpperCase())?pass('币种','币种代码有效。'):block('币种','请使用三位币种代码，例如 USD、EUR、CNY。','currency');
    if(!items.length)block('商品明细','至少需要一行有效商品。','','#addItemBtn');
    items.forEach((item,index)=>{
      if(!clean(item.name))block(`第 ${index+1} 行商品`,'缺少商品名称。','',`#itemList .item-row:nth-child(${index+1}) .i-name`);
      if(num(item.qty)<=0)block(`第 ${index+1} 行数量`,'数量必须大于 0。','',`#itemList .item-row:nth-child(${index+1}) .i-qty`);
      if(!clean(item.unit))warn(`第 ${index+1} 行单位`,'建议填写 PCS、SET、KG 等单位。','',`#itemList .item-row:nth-child(${index+1}) .i-unit`);
      if(type!=='packing_list'&&num(item.price)<=0){
        const declaration=`${f.remarks||''} ${f.contractClauses||''} ${item.spec||''}`;
        const declaredFree=/free sample|free of charge|no commercial value|warranty replacement|complimentary|免费样品|免费赠品|无商业价值|保修替换/i.test(declaration);
        if(type==='commercial_invoice')block(`第 ${index+1} 行申报价值`,'商业发票不能使用 0 作为海关申报价值；免费样品或赠品也应填写合理参考申报价值。','',`#itemList .item-row:nth-child(${index+1}) .i-price`);
        else if(f.tradeScenario==='sample'&&declaredFree)warn(`第 ${index+1} 行免费样品`,'当前已按免费样品处理；如后续生成商业发票，请另填合理海关申报价值。','',`#itemList .item-row:nth-child(${index+1}) .i-price`);
        else block(`第 ${index+1} 行单价`,'单价必须大于 0；免费样品、赠品或保修替换请在备注中明确性质，并在清关文件中填写合理申报价值。','',`#itemList .item-row:nth-child(${index+1}) .i-price`);
      }
      if(type==='commercial_invoice'){
        const hs=normalizedHs(item.hs);if(hs.length<6||hs.length>10)block(`第 ${index+1} 行 HS Code`,'商业发票建议填写 6–10 位有效 HS Code。','',`#itemList .item-row:nth-child(${index+1}) .i-hs`);
      }
      if(num(item.grossWeight)>0&&num(item.netWeight)>num(item.grossWeight))block(`第 ${index+1} 行重量`,'毛重不能小于净重。','',`#itemList .item-row:nth-child(${index+1}) .i-gross-weight`);
    });

    if(validDate(f.validUntil)&&validDate(f.issueDate)&&new Date(f.validUntil)<new Date(f.issueDate))block('有效期','有效期不能早于出单日期。','validUntil');
    else if((type==='quotation'||type==='proforma_invoice')&&!validDate(f.validUntil))warn('有效期','报价单和 PI 建议填写有效期。','validUntil');

    if(type==='quotation'){
      clean(f.deliveryTime)?pass('报价交期','已填写交期。'):warn('报价交期','建议填写生产或备货交期。','deliveryTime');
      clean(f.moq)||items.some(item=>clean(item.moq))?pass('MOQ','已填写整单或单品 MOQ。'):warn('MOQ','工厂报价通常应明确 MOQ。','moq');
    }
    if(type==='proforma_invoice'||type==='sales_contract'){
      clean(f.paymentTerms)?pass('付款条款','已填写付款条款。'):block('付款条款','PI 和销售合同必须明确付款条款。','paymentTerms');
      clean(f.deliveryTime)?pass('交货期','已填写交货期。'):block('交货期','PI 和销售合同必须明确交货期。','deliveryTime');
      if(on(f.showPayment)){
        const hasAccount=clean(f.bankAccount)||clean(f.bankAddress);const hasBeneficiary=clean(f.bankBeneficiary);
        if(!hasAccount)block('收款资料','已启用收款账户，但未填写账号或付款链接。','bankAccount');
        if(!hasBeneficiary)warn('收款人','建议填写并核对收款人 / 账户名。','bankBeneficiary');
        if(clean(f.bankAccount)&&!clean(f.bankSwift)&&String(f.paymentTemplate||'').toUpperCase()==='TT')warn('SWIFT','T/T 电汇建议填写 SWIFT。','bankSwift');
      }
    }
    if(type==='commercial_invoice'){
      clean(f.originCountry)?pass('原产国','已填写原产国。'):block('原产国','商业发票必须填写原产国。','originCountry');
      clean(f.shippingMethod)?pass('运输方式','已填写运输方式。'):warn('运输方式','商业发票建议填写运输方式。','shippingMethod');
      num(f.grossWeight)>0?pass('总毛重','已填写总毛重。'):warn('总毛重','清关资料通常需要总毛重。','grossWeight');
      clean(f.customerPo)||clean(f.quoteNo)||clean(f.workspaceSourceDocumentNo)?pass('关联单据','已填写客户 PO、报价或来源单据编号。'):warn('关联单据','建议关联客户 PO、PI、合同或订单编号，便于与装箱单和清关资料核对。','customerPo');
      if(on(f.showProductImage))warn('商品图片','商业发票以清晰申报文字为主；图片仅在客户或目的国明确需要时保留。','showProductImage');
    }
    if(type==='packing_list'){
      clean(f.customerPo)||clean(f.quoteNo)||clean(f.workspaceSourceDocumentNo)?pass('关联单据','已填写客户 PO、商业发票或来源单据编号。'):warn('关联单据','建议关联商业发票编号、客户 PO 或订单编号。','customerPo');
      if(on(f.showProductImage))warn('商品图片','正式装箱单优先展示箱号、数量、包装、重量和尺寸；图片仅在仓库图示或客户要求时保留。','showProductImage');
      num(f.packageCount)>0?pass('总箱数','已填写总箱数。'):block('总箱数','装箱单必须填写总箱数。','packageCount');
      num(f.netWeight)>0?pass('总净重','已填写总净重。'):warn('总净重','装箱单建议填写总净重。','netWeight');
      num(f.grossWeight)>0?pass('总毛重','已填写总毛重。'):block('总毛重','装箱单应填写总毛重。','grossWeight');
      num(f.cbm)>0?pass('总体积','已填写 CBM。'):warn('总体积','海运、空运或卡车运输通常需要 CBM。','cbm');
      if(num(f.grossWeight)>0&&num(f.netWeight)>num(f.grossWeight))block('重量合计','总毛重不能小于总净重。','grossWeight');
      if(!items.some(item=>clean(item.cartonNo)||clean(item.packageDescription)||num(item.grossWeight)||num(item.cbm)))warn('逐行装箱数据','建议填写箱号、包装、重量或 CBM，方便仓库和货代核对。','','#itemList');
      const rowNet=items.reduce((sum,item)=>sum+num(item.netWeight),0),rowGross=items.reduce((sum,item)=>sum+num(item.grossWeight),0),rowCbm=items.reduce((sum,item)=>sum+num(item.cbm),0);
      const mismatch=(header,total)=>header>0&&total>0&&Math.abs(header-total)>Math.max(.01,Math.abs(total)*.01);
      if(mismatch(num(f.netWeight),rowNet))warn('净重合计','表头总净重与逐行净重合计不一致，请核对。','netWeight');
      else if(rowNet>0)pass('逐行净重','逐行净重已可汇总核对。');
      if(mismatch(num(f.grossWeight),rowGross))warn('毛重合计','表头总毛重与逐行毛重合计不一致，请核对。','grossWeight');
      else if(rowGross>0)pass('逐行毛重','逐行毛重已可汇总核对。');
      if(mismatch(num(f.cbm),rowCbm))warn('CBM 合计','表头总体积与逐行 CBM 合计不一致，请核对。','cbm');
      else if(rowCbm>0)pass('逐行 CBM','逐行 CBM 已可汇总核对。');
    }

    if(type!=='packing_list'){
      const trade=clean(f.tradeTerms);const code=incotermCode(trade);
      if(!trade)warn('贸易术语','建议填写完整 Incoterms® 2020 术语和指定地点。','tradeTerms');
      else{
        /2020/.test(trade)?pass('Incoterms® 版本','已注明 2020 版本。'):warn('Incoterms® 版本','建议注明 Incoterms® 2020。','tradeTerms');
        code?pass('贸易术语代码',`已识别 ${code}。`):warn('贸易术语代码','未识别 EXW / FCA / FOB / CIF / DAP / DDP 等标准代码。','tradeTerms');
        const method=clean(f.shippingMethod).toLowerCase();if(/air|courier|express|空运|快递/.test(method)&&['FAS','FOB','CFR','CIF'].includes(code))warn('运输方式匹配',`${code} 通常用于海运或内河运输；空运 / 快递建议复核 FCA、CPT、CIP、DAP 等。`,'tradeTerms');
        if(code==='DDP'&&!/duty|tax|custom|关税|税费|清关/i.test(`${f.remarks||''} ${f.contractClauses||''}`))warn('DDP 责任','DDP 建议明确进口清关、关税和税费责任。','remarks');
      }
    }

    if(validDate(f.etd)&&validDate(f.eta)&&new Date(f.eta)<new Date(f.etd))block('ETD / ETA','ETA 不能早于 ETD。','eta');
    if(clean(f.buyerCountryCode)&&!/^[A-Za-z]{2}$/.test(clean(f.buyerCountryCode)))warn('国家代码','ISO 国家代码建议使用两位字母，例如 US、DE、JP。','buyerCountryCode');
    if(clean(f.sellerName)&&clean(f.buyerName)&&clean(f.sellerName).toLowerCase()===clean(f.buyerName).toLowerCase())warn('买卖双方','卖方和买方公司名称相同，请确认是否填写错误。','buyerName');
    if(['sent','customer_confirmed','deposit_received','production','ready_to_ship','shipped','completed'].includes(f.documentStatus)&&!clean(f.revisionNo))warn('修订版本','已发送或执行中的单据建议填写 Revision。','revisionNo');
    if(f.documentStatus==='cancelled')block('单据状态','当前单据已标记为取消，不应继续导出发送。','documentStatus');
    if(['draft','internal_review'].includes(f.documentStatus))warn('单据状态','当前仍为草稿 / 内部审核，发送客户前请更新状态。','documentStatus');
    if(!clean(f.preparedBy))warn('制单人','建议记录制单人，方便工厂内部追溯。','preparedBy');
    if(f.documentStatus==='internal_review'&&!clean(f.approvedBy))warn('审核人','内部审核状态建议填写审核人。','approvedBy');

    if(f.tradeScenario==='oem'||f.tradeScenario==='project'){
      clean(f.productionStartCondition)?pass('生产启动条件','已明确量产启动条件。'):warn('生产启动条件','OEM / 项目订单应明确定金、样品、图纸和包装确认条件。','productionStartCondition');
      clean(f.inspectionStandard)?pass('检验标准','已填写检验标准。'):warn('检验标准','OEM / 项目订单建议明确 AQL、图纸或签样标准。','inspectionStandard');
      if(f.sampleApproval==='pending'||f.artworkApproval==='pending')warn('客户确认','样品或图稿仍处于待确认状态，量产前不得忽略。','sampleApproval');
    }

    readiness=result;renderReadinessSummary();return result;
  }

  function renderReadinessSummary(){
    const b=readiness.blockers.length,w=readiness.warnings.length,p=readiness.passes.length;
    if($('fpReadinessBlockCount'))$('fpReadinessBlockCount').textContent=b;
    if($('fpReadinessWarnCount'))$('fpReadinessWarnCount').textContent=w;
    if($('fpReadinessPassCount'))$('fpReadinessPassCount').textContent=p;
    const status=$('fpReadinessStatus');if(status){status.className=`fp-readiness-status ${b?'blocked':w?'warning':'ready'}`;status.textContent=b?`当前有 ${b} 项会阻止正式导出。`:w?`没有阻断项，但有 ${w} 项需要人工复核。`:'当前单据达到基础出单条件。';}
  }
  function renderReadinessPanel(show=true){
    const panel=$('fpReadinessPanel');if(!panel)return;const all=[...readiness.blockers,...readiness.warnings,...readiness.passes];
    panel.classList.toggle('show',show);
    if(!show)return;
    panel.innerHTML=`<div class="fp-readiness-list">${all.length?all.map((issue,index)=>`<div class="fp-readiness-item ${issue.severity}"><strong>${issue.severity==='block'?'阻断':issue.severity==='warn'?'提醒':'通过'}</strong><span><b>${html(issue.label)}</b> · ${html(issue.message)}</span>${issue.fieldId||issue.selector?`<button type="button" data-readiness-index="${index}">定位修改</button>`:''}</div>`).join(''):'<div class="fp-readiness-item pass"><strong>通过</strong><span>当前没有发现明显问题。</span></div>'}</div>`;
  }
  function scheduleReadiness(delay=150){clearTimeout(readinessTimer);readinessTimer=setTimeout(evaluateReadiness,delay);}
  function focusIssue(issue){
    if(!issue)return;
    let target=issue.fieldId?$(issue.fieldId):null;if(!target&&issue.selector)target=document.querySelector(issue.selector);
    if(!target)return;
    qsa('details').forEach(details=>{if(details.contains(target))details.open=true;});
    if(target.closest('.form-column')&&window.FlypigBOXTableEditor?.getMode?.()==='table')window.FlypigBOXTableEditor.setViewMode('form',{announce:false,persist:true});
    setTimeout(()=>{target.scrollIntoView({behavior:'smooth',block:'center'});target.focus?.({preventScroll:true});},80);
  }
  function validateBeforeExport({kind='file',silent=false}={}){
    const result=evaluateReadiness();
    if(result.blockers.length){renderReadinessPanel(true);if(!silent){notify(`无法导出：还有 ${result.blockers.length} 项关键问题未处理。`,'error');window.alert(`当前单据有 ${result.blockers.length} 项会阻止正式导出：\n\n${result.blockers.slice(0,8).map(x=>`• ${x.label}：${x.message}`).join('\n')}${result.blockers.length>8?'\n…':''}`);focusIssue(result.blockers[0]);}return false;}
    if(result.warnings.length&&!silent){const ok=window.confirm(`当前没有阻断项，但还有 ${result.warnings.length} 项需要人工复核：\n\n${result.warnings.slice(0,8).map(x=>`• ${x.label}：${x.message}`).join('\n')}${result.warnings.length>8?'\n…':''}\n\n点击“确定”表示你已人工核对，并继续导出 ${kind}。`);if(!ok){renderReadinessPanel(true);focusIssue(result.warnings[0]);return false;}}
    return true;
  }

  function readCostRows(){try{const rows=JSON.parse($('factoryCostRowsJson')?.value||'[]');return Array.isArray(rows)?rows:[];}catch(_){return [];}}
  function dispatchCostRowsLater(delay=180){
    clearTimeout(costDispatchTimer);
    costDispatchTimer=setTimeout(()=>{
      const input=$('factoryCostRowsJson');if(!input)return;
      costInputSyncing=true;
      try{dispatch(input,'input');}finally{costInputSyncing=false;}
    },delay);
  }
  function writeCostRows(rows,{dispatchEvent=true}={}){
    const input=$('factoryCostRowsJson');if(!input)return;
    input.value=JSON.stringify(rows);
    if(dispatchEvent)dispatchCostRowsLater();
  }
  function costMap(){return new Map(readCostRows().map(row=>[String(row.itemKey||''),row]));}
  function canonicalRows(){return qsa('#itemList .item-row');}
  function ensureCostStateFields(){
    const form=$('piForm');if(!form)return;
    const defaults={factoryCostCurrency:'CNY',factoryFxRate:'1',factoryOverheadRate:'0',factoryCommissionRate:'0',factoryTargetMargin:'0'};
    Object.entries(defaults).forEach(([id,value])=>{if($(id))return;const input=document.createElement('input');input.type='hidden';input.id=id;input.value=value;form.appendChild(input);});
  }
  function nearZero(value){return Math.abs(Number(value)||0)<1e-9?0:Number(value)||0;}
  function costSettings(){
    ensureCostStateFields();
    const sale=$('currency')?.value||'USD';const cost=$('factoryCostCurrency')?.value||'CNY';
    return {saleCurrency:sale,costCurrency:cost,fx:cost===sale?1:Math.max(.000001,num($('factoryFxRate')?.value)||1),overhead:num($('factoryOverheadRate')?.value),commission:num($('factoryCommissionRate')?.value),target:num($('factoryTargetMargin')?.value)};
  }
  function calcCost(row,record,settings){
    const qty=num(row.querySelector('.i-qty')?.value);const salePrice=num(row.querySelector('.i-price')?.value);const direct=num(record.unitCost)+num(record.packingCost)+num(record.inlandCost)+num(record.otherCost);
    const baseSale=direct/settings.fx*(1+settings.overhead/100);const totalUnit=nearZero(baseSale+salePrice*settings.commission/100);const margin=nearZero(salePrice-totalUnit);const marginPct=salePrice>0?nearZero(margin/salePrice*100):0;const denominator=1-settings.commission/100-settings.target/100;const suggested=denominator>0?nearZero(baseSale/denominator):0;
    return {qty,salePrice,direct,baseSale,totalUnit,margin,marginPct,suggested,totalProfit:nearZero(margin*qty),sales:nearZero(salePrice*qty),totalCost:nearZero(totalUnit*qty)};
  }
  function ensureCostPanel(){
    ensureCostStateFields();
    const workspace=$('fpTableEditorWorkspace');if(!workspace||$('fpFactoryCostingPanel'))return false;
    const panel=document.createElement('section');panel.id='fpFactoryCostingPanel';panel.className='fp-factory-costing';panel.innerHTML=`<header class="fp-factory-costing-head"><div><h3>工厂内部核算与毛利检查</h3><p>用于工厂成本、包装、国内运费、佣金和目标毛利测算。当前售价可直接修改，并会同步到当前客户单据；内部成本不会进入客户文件。</p><span class="confidential">CONFIDENTIAL · 仅限内部</span></div><div class="fp-trade-factory-actions"><button class="fp-table-editor-action" type="button" data-cost-action="refresh">刷新核算</button><button class="fp-table-editor-action danger" type="button" data-cost-action="clear">清空内部成本</button></div></header><div class="fp-cost-settings"><label>成本币种<select data-cost-setting="factoryCostCurrency"><option>CNY</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>JPY</option></select></label><label>汇率：1 销售币种 = 成本币种<input type="number" min="0.000001" step="0.0001" data-cost-setting="factoryFxRate"></label><label>制造 / 管理损耗 %<input type="number" min="0" step="0.1" data-cost-setting="factoryOverheadRate"></label><label>平台 / 业务佣金 %<input type="number" min="0" step="0.1" data-cost-setting="factoryCommissionRate"></label><label>目标毛利率 %<input type="number" min="0" max="95" step="0.1" data-cost-setting="factoryTargetMargin"></label></div><div id="fpFactoryCostingBody"></div>`;
    workspace.appendChild(panel);
    panel.addEventListener('input',handleCostInput);panel.addEventListener('change',handleCostInput);panel.addEventListener('click',handleCostClick);panel.addEventListener('keydown',handleCostKeyboard);panel.addEventListener('scroll',event=>{if(event.target.matches('.fp-cost-table-wrap'))rememberCostScroll(event.target);},true);return true;
  }
  function rememberCostScroll(wrap){
    if(!wrap)return;wrap.dataset.fpScrollLeft=String(wrap.scrollLeft||0);
    try{sessionStorage.setItem(COST_SCROLL_KEY,String(wrap.scrollLeft||0));}catch(_){}
  }
  function readCostScroll(wrap){let left=Number(wrap?.dataset.fpScrollLeft||0);try{left=Number(sessionStorage.getItem(COST_SCROLL_KEY))||left;}catch(_){}return left;}
  function captureCostFocus(){
    const wrap=$('fpFactoryCostingPanel')?.querySelector('.fp-cost-table-wrap');const active=document.activeElement?.closest?.('#fpFactoryCostingPanel [data-cost-key],#fpFactoryCostingPanel [data-cost-price],#fpFactoryCostingPanel [data-cost-setting]');
    return {left:wrap?.scrollLeft||readCostScroll(wrap),top:wrap?.scrollTop||0,key:active?.dataset.costPrice!==undefined?'salePrice':(active?.dataset.costKey||''),row:active?.closest('[data-cost-row]')?.dataset.costRow||'',setting:active?.dataset.costSetting||'',start:typeof active?.selectionStart==='number'?active.selectionStart:null};
  }
  function restoreCostFocus(snapshot){
    if(!snapshot)return;const wrap=$('fpFactoryCostingPanel')?.querySelector('.fp-cost-table-wrap');if(wrap){wrap.scrollLeft=snapshot.left||0;wrap.scrollTop=snapshot.top||0;rememberCostScroll(wrap);}let target=null;
    if(snapshot.setting)target=$('fpFactoryCostingPanel')?.querySelector(`[data-cost-setting="${CSS.escape(snapshot.setting)}"]`);
    else if(snapshot.row&&snapshot.key)target=$('fpFactoryCostingPanel')?.querySelector(snapshot.key==='salePrice'?`[data-cost-row="${CSS.escape(snapshot.row)}"] [data-cost-price]`:`[data-cost-row="${CSS.escape(snapshot.row)}"] [data-cost-key="${CSS.escape(snapshot.key)}"]`);
    if(target){target.focus({preventScroll:true});if(snapshot.start!==null&&target.setSelectionRange){const max=String(target.value||'').length;target.setSelectionRange(Math.min(snapshot.start,max),Math.min(snapshot.start,max));}if(wrap)wrap.scrollLeft=snapshot.left||0;}
  }
  function costOutputHTML(c,settings){
    const cls=c.margin<0?'margin-bad':c.marginPct<settings.target?'margin-warn':'margin-good';
    return {direct:`${settings.costCurrency} ${c.direct.toFixed(2)}`,totalUnit:`${settings.saleCurrency} ${c.totalUnit.toFixed(2)}`,margin:`${settings.saleCurrency} ${c.margin.toFixed(2)}`,marginPct:`${c.marginPct.toFixed(1)}%`,suggested:`${settings.saleCurrency} ${c.suggested.toFixed(2)}`,cls};
  }
  function renderCosting(){
    const snapshot=captureCostFocus();ensureCostPanel();const body=$('fpFactoryCostingBody');if(!body)return;const rows=canonicalRows(),map=costMap(),settings=costSettings();
    qsa('[data-cost-setting]',$('fpFactoryCostingPanel')).forEach(control=>{const source=$(control.dataset.costSetting);if(source&&document.activeElement!==control)control.value=source.value;});
    const data=[];let totalSales=0,totalCost=0,totalProfit=0;
    const lines=rows.map((row,index)=>{
      const itemKey=row.dataset.itemKey||`row_${index}`;const record={itemKey,unitCost:0,packingCost:0,inlandCost:0,otherCost:0,...(map.get(itemKey)||{})};data.push(record);const c=calcCost(row,record,settings);totalSales+=c.sales;totalCost+=c.totalCost;totalProfit+=c.totalProfit;const out=costOutputHTML(c,settings);
      return `<tr data-cost-row="${html(itemKey)}" data-cost-index="${index}"><td>${index+1}</td><td class="name"><b>${html(clean(row.querySelector('.i-name')?.value)||`商品 ${index+1}`)}</b><br><small>${html(clean(row.querySelector('.i-spec')?.value))}</small></td><td class="money" data-cost-output="qty">${c.qty.toFixed(2)}</td><td><div class="fp-cost-price-editor"><span>${settings.saleCurrency}</span><input type="number" min="0" step="0.0001" inputmode="decimal" aria-label="当前售价" data-cost-price data-cost-grid-row="${index}" data-cost-grid-col="0" value="${c.salePrice||''}"></div></td>${['unitCost','packingCost','inlandCost','otherCost'].map((key,col)=>`<td><input type="number" min="0" step="0.0001" inputmode="decimal" data-cost-key="${key}" data-cost-grid-row="${index}" data-cost-grid-col="${col+1}" value="${num(record[key])||''}"></td>`).join('')}<td class="money" data-cost-output="direct">${out.direct}</td><td class="money" data-cost-output="totalUnit">${out.totalUnit}</td><td class="money ${out.cls}" data-cost-output="margin">${out.margin}</td><td class="money ${out.cls}" data-cost-output="marginPct">${out.marginPct}</td><td class="money" data-cost-output="suggested">${out.suggested}</td><td><button type="button" class="apply-price" data-cost-action="apply-price" data-item-key="${html(itemKey)}">采用建议价</button></td></tr>`;
    }).join('');
    if(JSON.stringify(data)!==JSON.stringify(readCostRows()))writeCostRows(data,{dispatchEvent:false});
    const marginPct=totalSales>0?totalProfit/totalSales*100:0;const totalCls=totalProfit<0?'margin-bad':marginPct<settings.target?'margin-warn':'margin-good';
    body.innerHTML=rows.length?`<div class="fp-cost-table-wrap"><table class="fp-cost-table"><thead><tr><th>#</th><th>商品</th><th>数量</th><th>当前售价<br><small>可编辑并同步客户单据</small></th><th>生产 / 采购成本<br>${settings.costCurrency}</th><th>包装成本<br>${settings.costCurrency}</th><th>国内运费<br>${settings.costCurrency}</th><th>其他成本<br>${settings.costCurrency}</th><th>直接成本</th><th>综合单位成本<br>${settings.saleCurrency}</th><th>单位毛利</th><th>毛利率</th><th>目标毛利建议价</th><th>操作</th></tr></thead><tbody>${lines}</tbody></table></div><div class="fp-cost-summary" data-cost-summary><span>销售额：<b data-cost-total="sales">${settings.saleCurrency} ${totalSales.toFixed(2)}</b></span><span>综合成本：<b data-cost-total="cost">${settings.saleCurrency} ${totalCost.toFixed(2)}</b></span><span>预计毛利：<b data-cost-total="profit" class="${totalCls}">${settings.saleCurrency} ${totalProfit.toFixed(2)}</b></span><span>综合毛利率：<b data-cost-total="marginPct" class="${totalCls}">${marginPct.toFixed(1)}%</b></span><span>汇率口径：1 ${settings.saleCurrency} = <b data-cost-total="fx">${settings.fx.toFixed(4)} ${settings.costCurrency}</b></span></div>`:'<div class="fp-cost-empty">请先添加商品后再进行内部核算。</div>';
    restoreCostFocus(snapshot||{left:readCostScroll(body.querySelector('.fp-cost-table-wrap')),top:0});
  }
  function updateCostRowInPlace(itemKey){
    const panel=$('fpFactoryCostingPanel'),tr=panel?.querySelector(`[data-cost-row="${CSS.escape(itemKey)}"]`),source=canonicalRows().find(row=>(row.dataset.itemKey||'')===itemKey);if(!tr||!source)return;
    const record=costMap().get(itemKey)||{itemKey};const settings=costSettings(),c=calcCost(source,record,settings),out=costOutputHTML(c,settings);
    const set=(key,value,cls='')=>{const cell=tr.querySelector(`[data-cost-output="${key}"]`);if(!cell)return;cell.textContent=value;if(['margin','marginPct'].includes(key))cell.className=`money ${cls}`;};
    set('qty',c.qty.toFixed(2));const priceInput=tr.querySelector('[data-cost-price]');if(priceInput&&document.activeElement!==priceInput)priceInput.value=c.salePrice||'';set('direct',out.direct);set('totalUnit',out.totalUnit);set('margin',out.margin,out.cls);set('marginPct',out.marginPct,out.cls);set('suggested',out.suggested);
  }
  function updateCostSummaryInPlace(){
    const panel=$('fpFactoryCostingPanel'),settings=costSettings(),map=costMap();let sales=0,cost=0,profit=0;
    canonicalRows().forEach(row=>{const itemKey=row.dataset.itemKey||'',c=calcCost(row,map.get(itemKey)||{itemKey},settings);sales+=c.sales;cost+=c.totalCost;profit+=c.totalProfit;});
    const marginPct=sales>0?profit/sales*100:0,cls=profit<0?'margin-bad':marginPct<settings.target?'margin-warn':'margin-good';const put=(key,text)=>{const el=panel?.querySelector(`[data-cost-total="${key}"]`);if(el)el.textContent=text;};
    put('sales',`${settings.saleCurrency} ${sales.toFixed(2)}`);put('cost',`${settings.saleCurrency} ${cost.toFixed(2)}`);put('profit',`${settings.saleCurrency} ${profit.toFixed(2)}`);put('marginPct',`${marginPct.toFixed(1)}%`);put('fx',`${settings.fx.toFixed(4)} ${settings.costCurrency}`);
    ['profit','marginPct'].forEach(key=>{const el=panel?.querySelector(`[data-cost-total="${key}"]`);if(el)el.className=cls;});
  }
  function updateAllCostRowsInPlace(){qsa('#fpFactoryCostingPanel [data-cost-row]').forEach(row=>updateCostRowInPlace(row.dataset.costRow));updateCostSummaryInPlace();}
  function scheduleCosting(delay=120){clearTimeout(costRenderTimer);costRenderTimer=setTimeout(renderCosting,delay);}
  function syncCostSetting(control){
    const source=$(control.dataset.costSetting);if(!source)return;
    source.value=control.value;costInputSyncing=true;try{dispatch(source,source.tagName==='SELECT'?'change':'input');}finally{costInputSyncing=false;}
  }
  function handleCostInput(event){
    const control=event.target;
    if(control.dataset.costSetting){syncCostSetting(control);updateAllCostRowsInPlace();return;}
    const row=control.closest('[data-cost-row]');const itemKey=row?.dataset.costRow;if(!itemKey)return;
    if(control.dataset.costPrice!==undefined){
      const source=canonicalRows().find(x=>(x.dataset.itemKey||'')===itemKey),price=source?.querySelector('.i-price');if(!price)return;
      price.value=control.value;costInputSyncing=true;try{dispatch(price,'input');}finally{costInputSyncing=false;}
      updateCostRowInPlace(itemKey);updateCostSummaryInPlace();return;
    }
    const key=control.dataset.costKey;if(!key)return;
    const rows=readCostRows();let record=rows.find(x=>String(x.itemKey)===itemKey);if(!record){record={itemKey};rows.push(record);}record[key]=num(control.value);writeCostRows(rows,{dispatchEvent:true});updateCostRowInPlace(itemKey);updateCostSummaryInPlace();
  }
  function focusCostCell(target,wrap,left){if(!target)return;target.focus({preventScroll:true});const row=target.closest('tr');if(row&&wrap){const top=row.offsetTop,bottom=top+row.offsetHeight;if(top<wrap.scrollTop)wrap.scrollTop=top;else if(bottom>wrap.scrollTop+wrap.clientHeight)wrap.scrollTop=Math.max(0,bottom-wrap.clientHeight);const restore=()=>{wrap.scrollLeft=left;rememberCostScroll(wrap);};restore();window.requestAnimationFrame(restore);window.setTimeout(restore,0);}}
  function handleCostKeyboard(event){
    const target=event.target.closest('[data-cost-grid-row][data-cost-grid-col]');if(!target||event.altKey||event.ctrlKey||event.metaKey)return;
    if(!['Enter','Tab'].includes(event.key))return;event.preventDefault();
    const row=Number(target.dataset.costGridRow),col=Number(target.dataset.costGridCol),wrap=target.closest('.fp-cost-table-wrap'),left=wrap?.scrollLeft||0;let nextRow=row,nextCol=col;
    if(event.key==='Enter')nextRow=Math.max(0,row+(event.shiftKey?-1:1));else{nextCol=col+(event.shiftKey?-1:1);if(nextCol>4){nextCol=0;nextRow=row+1;}if(nextCol<0){nextCol=4;nextRow=Math.max(0,row-1);}}
    const next=$('fpFactoryCostingPanel')?.querySelector(`[data-cost-grid-row="${nextRow}"][data-cost-grid-col="${nextCol}"]`);focusCostCell(next,wrap,left);
  }
  function handleCostClick(event){const button=event.target.closest('[data-cost-action]');if(!button)return;const action=button.dataset.costAction;if(action==='refresh'){renderCosting();return;}if(action==='clear'){if(window.confirm('确认清空当前单据的全部内部成本数据？客户资料、售价和商品不会被删除。')){writeCostRows([]);renderCosting();notify('已清空内部成本数据。','ok');}return;}if(action==='apply-price'){const itemKey=button.dataset.itemKey;const row=canonicalRows().find(x=>(x.dataset.itemKey||'')===itemKey);const record=costMap().get(itemKey);if(!row||!record)return;const calc=calcCost(row,record,costSettings());if(calc.suggested<=0){notify('无法计算建议售价，请检查汇率、成本、佣金和目标毛利率。','error');return;}const price=row.querySelector('.i-price');price.value=calc.suggested.toFixed(2);dispatch(price,'input');updateCostRowInPlace(itemKey);updateCostSummaryInPlace();notify(`已将建议售价写入商品：${$('currency')?.value||'USD'} ${calc.suggested.toFixed(2)}。`,'ok');}}

  function installEvents(){
    $('applyTradeScenarioBtn')?.addEventListener('click',applyScenario);
    $('runTradeReadinessBtn')?.addEventListener('click',()=>{evaluateReadiness();renderReadinessPanel(!$('fpReadinessPanel')?.classList.contains('show'));});
    $('syncFactoryTermsBtn')?.addEventListener('click',syncFactoryTerms);
    $('fpReadinessPanel')?.addEventListener('click',event=>{const button=event.target.closest('[data-readiness-index]');if(!button)return;const all=[...readiness.blockers,...readiness.warnings,...readiness.passes];focusIssue(all[Number(button.dataset.readinessIndex)]);});
    $('piForm')?.addEventListener('input',event=>{if(event.target.closest('#fpFactoryCostingPanel'))return;generateFactorySummary();scheduleReadiness();if(costInputSyncing)return;if(['currency','factoryCostCurrency','factoryFxRate','factoryOverheadRate','factoryCommissionRate','factoryTargetMargin'].includes(event.target.id)||event.target.closest('.item-row'))scheduleCosting(140);},true);
    $('piForm')?.addEventListener('change',event=>{generateFactorySummary();scheduleReadiness(80);if(!costInputSyncing&&!event.target.closest('#fpFactoryCostingPanel'))scheduleCosting(120);},true);
    document.addEventListener('click',event=>{const button=event.target.closest('#exportPdfBtn');if(!button)return;if(window.FlypigBOXPdfExportState?.unifiedPreflight===true)return;if(!validateBeforeExport({kind:'PDF'})){event.preventDefault();event.stopImmediatePropagation();}},true);
    const list=$('itemList');if(list){itemObserver=new MutationObserver(()=>{scheduleReadiness(40);scheduleCosting(40);});itemObserver.observe(list,{childList:true,subtree:true});}
    ['HUIDI:apply-template','HUIDI:branding-ready','HUIDI:branding-updated'].forEach(name=>document.addEventListener(name,()=>{setTimeout(()=>{generateFactorySummary();evaluateReadiness();renderCosting();},80);}));
  }

  function boot(){
    if(!$('piForm')||!$('fpTradeFactoryCenter'))return;ensureCostStateFields();
    generateFactorySummary();installEvents();
    const wait=()=>{if(ensureCostPanel())renderCosting();else setTimeout(wait,60);};wait();
    setTimeout(evaluateReadiness,80);
    window.FlypigBOXTradeFactory={evaluateReadiness,validateBeforeExport,renderCosting,getCostingSnapshot:()=>({rows:readCostRows(),settings:costSettings()}),generateFactorySummary,applyScenario,applyScenarioDocumentProfile};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();
