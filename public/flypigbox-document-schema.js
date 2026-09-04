/* HUIDI V3.3.6.24-R1.3A.14 — mode-safe structured fields and native output semantics.
   One source for document type, professional mode, real editor sections, navigation, workbook and customer-output metadata. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.14';
  const MODES=Object.freeze({DEFAULT:'ecommerce',DETAILED:'b2b'});
  const TOGGLES=Object.freeze([
    'showOrigin','showCustomerPo','showQuote','showMoq','showSalesperson','showProductImage','showHsCode',
    'showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature'
  ]);
  const PLANNED_LOGISTICS_FIELDS=Object.freeze(['shippingMethod','portOfLoading','destinationPort','estimatedShipment','etd','eta']);
  const PACKING_FIELDS=Object.freeze(['packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks','logisticsExtraRowsJson','totalPieces','cartonRange','cartonsInLine','quantityPerCarton','palletNo','palletCount','mixedPackingNote']);
  const ACTUAL_LOGISTICS_FIELDS=Object.freeze(['logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','transportDocumentType','actualShipmentDate','actualDepartureDate','actualArrivalDate']);
  const LOGISTICS_FIELDS=Object.freeze([...PLANNED_LOGISTICS_FIELDS,...PACKING_FIELDS,...ACTUAL_LOGISTICS_FIELDS]);
  const DELIVERY_FIELDS=Object.freeze([
    'consigneeName','consigneeContact','consigneePhone','consigneeEmail','consigneeAddress','notifyPartyName','notifyPartyContact',
    'notifyPartyPhone','notifyPartyEmail','notifyPartyAddress','billToAddress','shipToAddress'
  ]);
  const PAYMENT_FIELDS=Object.freeze(['paymentTemplate','bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress']);
  const PAYMENT_SCHEDULE_FIELDS=Object.freeze(['depositPercent','depositAmount','depositDueDate','balancePercent','balanceAmount','balanceDueCondition','balanceDueDate','creditDays','paidAmount','paymentStatus']);
  const REFERENCE_FIELDS=Object.freeze([
    'inquiryNo','quotationVersion','customerOrderNo','internalOrderNo','relatedQuotationNo','relatedPiNo','relatedContractNo','relatedCommercialInvoiceNo','relatedPackingListNo',
    'quotationValidUntil','proformaValidUntil','contractSignedDate','contractEffectiveDate','contractExpiryDate','packingDate'
  ]);
  const CUSTOMS_FIELDS=Object.freeze([
    'exportReason','customsDescription','customsDeclaredValue','manufacturerName','finalUse','finalUser','exportLicenseNo','regulatoryCertificateNo','customsDeclarationNote',
    'sellerRegistrationNo','sellerVatNo','sellerEoriNo','buyerRegistrationNo','buyerVatNo','buyerEoriNo'
  ]);
  const QUALITY_RISK_FIELDS=Object.freeze([
    'qualityStandard','inspectionMethod','inspectionDeadlineDays','riskTransferPoint','warrantyPeriod','governingLaw','disputeResolution','sellerSignatory','buyerSignatory','attachmentList',
    'productionStartDate','expectedCompletionDate','inspectionDate','partialShipmentPlan'
  ]);
  const STRUCTURED_FIELDS=Object.freeze([...REFERENCE_FIELDS,...PAYMENT_SCHEDULE_FIELDS,...CUSTOMS_FIELDS,...PACKING_FIELDS.filter(id=>!['packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks','logisticsExtraRowsJson'].includes(id)),...ACTUAL_LOGISTICS_FIELDS.filter(id=>!['logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight'].includes(id)),...QUALITY_RISK_FIELDS]);
  const ADVANCED_FIELDS=Object.freeze(['revisionNo','documentStatus','tradeScenario','preparedBy','approvedBy','sellerTaxId','buyerTaxId','buyerCountryCode','buyerWebsite']);
  const CI_REGULATORY_FIELDS=Object.freeze(['finalUse','finalUser','exportLicenseNo','regulatoryCertificateNo','customsDeclarationNote','sellerRegistrationNo','sellerVatNo','sellerEoriNo','buyerRegistrationNo','buyerVatNo','buyerEoriNo']);
  const PL_CARTON_DETAIL_FIELDS=Object.freeze(['cartonRange','cartonsInLine','quantityPerCarton','mixedPackingNote']);
  const PL_PALLET_DETAIL_FIELDS=Object.freeze(['palletNo','palletCount']);

  const selectOptions={
    exportReason:[['','请选择出口原因','Select export reason'],['normal_sale','正常销售','Normal sale'],['commercial_sample','商业样品','Commercial sample'],['free_sample','免费样品','Free sample'],['gift','赠品','Gift'],['warranty_replacement','保修替换','Warranty replacement'],['return','退运','Return shipment'],['no_commercial_value','无商业价值','No commercial value']],
    paymentStatus:[['','未设置','Not set'],['unpaid','未付款','Unpaid'],['deposit_received','已收定金','Deposit received'],['partially_paid','部分收款','Partially paid'],['paid','已付清','Paid'],['overdue','已逾期','Overdue']],
    transportDocumentType:[['','请选择运输单据','Select transport document'],['BL','海运提单（B/L）','Bill of Lading (B/L)'],['AWB','空运单（AWB）','Air Waybill (AWB)'],['RAIL','铁路运单','Rail Waybill'],['CMR','公路运单（CMR）','Road Consignment Note (CMR)'],['COURIER','快递运单','Courier Waybill'],['OTHER','其他','Other']],
    inspectionMethod:[['','请选择验货方式','Select inspection method'],['seller','卖方自检','Seller inspection'],['buyer','买方验货','Buyer inspection'],['third_party','第三方验货','Third-party inspection'],['sample','按确认样品验收','Against approved sample'],['drawing','按图纸或技术文件验收','Against drawing/specification']],
    riskTransferPoint:[['','请选择风险转移节点','Select risk-transfer point'],['incoterms','按国际贸易术语约定','According to Incoterms'],['carrier','交付第一承运人时','On delivery to first carrier'],['loading','装船或装车完成时','On completion of loading'],['delivery','货物送达指定地点时','On delivery at named place'],['acceptance','买方验收合格时','Upon buyer acceptance']]
  };

  const FIELD_DEFINITIONS=Object.freeze({
    inquiryNo:{section:'references',label:['客户询盘编号','Inquiry No.'],types:['quotation'],modes:['ecommerce','b2b']},
    quotationVersion:{section:'references',label:['报价版本号','Quotation Version'],types:['quotation'],modes:['ecommerce','b2b']},
    customerOrderNo:{section:'references',label:['客户订单号','Customer Order No.'],types:['proforma_invoice','commercial_invoice','packing_list','sales_contract'],modes:['ecommerce','b2b']},
    internalOrderNo:{section:'references',label:['内部订单号','Internal Order No.'],types:['quotation','proforma_invoice','commercial_invoice','packing_list','sales_contract'],modes:['ecommerce','b2b'],internal:true},
    relatedQuotationNo:{section:'references',label:['关联报价单号','Related Quotation No.'],types:['proforma_invoice','sales_contract'],modes:['ecommerce','b2b']},
    relatedPiNo:{section:'references',label:['关联形式发票号（PI）','Related PI No.'],types:['commercial_invoice','packing_list','sales_contract'],modes:['ecommerce','b2b']},
    relatedContractNo:{section:'references',label:['关联销售合同号','Related Contract No.'],types:['proforma_invoice','commercial_invoice','packing_list'],modes:['b2b','ecommerce']},
    relatedCommercialInvoiceNo:{section:'references',label:['关联商业发票号（CI）','Related Commercial Invoice No.'],types:['packing_list'],modes:['ecommerce','b2b']},
    relatedPackingListNo:{section:'references',label:['关联装箱单号（PL）','Related Packing List No.'],types:['commercial_invoice'],modes:['ecommerce','b2b']},
    quotationValidUntil:{section:'references',label:['报价有效期','Quotation Valid Until'],types:['quotation'],modes:['ecommerce','b2b'],input:'date'},
    proformaValidUntil:{section:'references',label:['形式发票有效期','PI Valid Until'],types:['proforma_invoice'],modes:['ecommerce','b2b'],input:'date'},
    contractSignedDate:{section:'references',label:['合同签订日期','Contract Signing Date'],types:['sales_contract'],modes:['ecommerce','b2b'],input:'date'},
    contractEffectiveDate:{section:'references',label:['合同生效日期','Contract Effective Date'],types:['sales_contract'],modes:['ecommerce','b2b'],input:'date'},
    contractExpiryDate:{section:'references',label:['合同终止日期','Contract Expiry Date'],types:['sales_contract'],modes:['b2b'],input:'date'},
    packingDate:{section:'references',label:['装箱日期','Packing Date'],types:['packing_list'],modes:['ecommerce','b2b'],input:'date'},

    depositPercent:{section:'paymentSchedule',label:['定金比例（%）','Deposit (%)'],types:['proforma_invoice','sales_contract'],modes:['ecommerce','b2b'],input:'number',min:'0',max:'100',step:'0.01'},
    depositAmount:{section:'paymentSchedule',label:['定金金额','Deposit Amount'],types:['proforma_invoice','sales_contract'],modes:['ecommerce','b2b'],input:'number',min:'0',step:'0.01'},
    depositDueDate:{section:'paymentSchedule',label:['定金到期日','Deposit Due Date'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'date'},
    balancePercent:{section:'paymentSchedule',label:['尾款比例（%）','Balance (%)'],types:['proforma_invoice','sales_contract'],modes:['ecommerce','b2b'],input:'number',min:'0',max:'100',step:'0.01'},
    balanceAmount:{section:'paymentSchedule',label:['尾款金额','Balance Amount'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'number',min:'0',step:'0.01'},
    balanceDueCondition:{section:'paymentSchedule',label:['尾款支付条件','Balance Due Condition'],types:['proforma_invoice','sales_contract'],modes:['ecommerce','b2b'],span:2},
    balanceDueDate:{section:'paymentSchedule',label:['尾款到期日','Balance Due Date'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'date'},
    creditDays:{section:'paymentSchedule',label:['账期天数','Credit Days'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'number',min:'0',step:'1'},
    paidAmount:{section:'paymentSchedule',label:['已收金额','Paid Amount'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'number',min:'0',step:'0.01',internal:true},
    paymentStatus:{section:'paymentSchedule',label:['收款状态','Payment Status'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'select',options:'paymentStatus',internal:true},

    exportReason:{section:'customs',label:['出口原因','Export Reason'],types:['commercial_invoice'],modes:['ecommerce','b2b'],input:'select',options:'exportReason'},
    customsDescription:{section:'customs',label:['海关申报品名','Customs Description'],types:['commercial_invoice'],modes:['ecommerce','b2b'],span:2,textarea:true},
    customsDeclaredValue:{section:'customs',label:['海关申报总值','Customs Declared Value'],types:['commercial_invoice'],modes:['ecommerce','b2b'],input:'number',min:'0',step:'0.01'},
    manufacturerName:{section:'customs',label:['制造商','Manufacturer'],types:['quotation','proforma_invoice','commercial_invoice'],modes:['b2b']},
    finalUse:{section:'customs',label:['最终用途','End Use'],types:['commercial_invoice'],modes:['b2b'],span:2},
    finalUser:{section:'customs',label:['最终用户','End User'],types:['commercial_invoice'],modes:['b2b']},
    exportLicenseNo:{section:'customs',label:['出口许可证号','Export License No.'],types:['commercial_invoice'],modes:['b2b']},
    regulatoryCertificateNo:{section:'customs',label:['监管或证书编号','Regulatory Certificate No.'],types:['commercial_invoice'],modes:['b2b']},
    customsDeclarationNote:{section:'customs',label:['清关声明或监管说明','Customs Declaration Note'],types:['commercial_invoice'],modes:['b2b'],span:2,textarea:true},
    sellerRegistrationNo:{section:'customs',label:['卖方公司注册号','Seller Registration No.'],types:['commercial_invoice'],modes:['b2b']},
    sellerVatNo:{section:'customs',label:['卖方增值税号（VAT）','Seller VAT No.'],types:['commercial_invoice'],modes:['b2b']},
    sellerEoriNo:{section:'customs',label:['卖方欧盟经营者编号（EORI）','Seller EORI No.'],types:['commercial_invoice'],modes:['b2b']},
    buyerRegistrationNo:{section:'customs',label:['买方公司注册号','Buyer Registration No.'],types:['commercial_invoice'],modes:['b2b']},
    buyerVatNo:{section:'customs',label:['买方增值税号（VAT）','Buyer VAT No.'],types:['commercial_invoice'],modes:['b2b']},
    buyerEoriNo:{section:'customs',label:['买方欧盟经营者编号（EORI）','Buyer EORI No.'],types:['commercial_invoice'],modes:['b2b']},

    totalPieces:{section:'packing',label:['总件数','Total Pieces'],types:['commercial_invoice','packing_list'],modes:['ecommerce','b2b'],input:'number',min:'0',step:'1'},
    cartonRange:{section:'packing',label:['箱号或箱号范围','Carton No. / Range'],types:['packing_list'],modes:['ecommerce','b2b']},
    cartonsInLine:{section:'packing',label:['本行箱数','Cartons in Line'],types:['packing_list'],modes:['b2b'],input:'number',min:'0',step:'1'},
    quantityPerCarton:{section:'packing',label:['每箱数量','Quantity per Carton'],types:['packing_list'],modes:['b2b'],input:'number',min:'0',step:'1'},
    palletNo:{section:'packing',label:['托盘号','Pallet No.'],types:['packing_list'],modes:['b2b']},
    palletCount:{section:'packing',label:['托盘数量','Pallet Count'],types:['packing_list'],modes:['b2b'],input:'number',min:'0',step:'1'},
    mixedPackingNote:{section:'packing',label:['混装箱或特殊包装说明','Mixed Packing Note'],types:['proforma_invoice','commercial_invoice','packing_list','sales_contract'],modes:['b2b'],span:2,textarea:true},

    transportDocumentType:{section:'actualShipment',label:['运输单据类型','Transport Document Type'],types:['commercial_invoice','packing_list'],modes:['ecommerce','b2b'],input:'select',options:'transportDocumentType'},
    actualShipmentDate:{section:'actualShipment',label:['实际发货日期','Actual Shipment Date'],types:['commercial_invoice','packing_list'],modes:['ecommerce','b2b'],input:'date'},
    actualDepartureDate:{section:'actualShipment',label:['实际离港日期','Actual Departure Date'],types:['commercial_invoice','packing_list'],modes:['b2b'],input:'date'},
    actualArrivalDate:{section:'actualShipment',label:['实际到港日期','Actual Arrival Date'],types:['commercial_invoice','packing_list'],modes:['b2b'],input:'date'},

    qualityStandard:{section:'qualityRisk',label:['质量标准','Quality Standard'],types:['sales_contract'],modes:['ecommerce','b2b'],span:2},
    inspectionMethod:{section:'qualityRisk',label:['验货方式','Inspection Method'],types:['sales_contract'],modes:['ecommerce','b2b'],input:'select',options:'inspectionMethod'},
    inspectionDeadlineDays:{section:'qualityRisk',label:['质量异议期限（天）','Inspection / Claim Period (Days)'],types:['sales_contract'],modes:['ecommerce','b2b'],input:'number',min:'0',step:'1'},
    riskTransferPoint:{section:'qualityRisk',label:['风险转移节点','Risk Transfer Point'],types:['sales_contract'],modes:['ecommerce','b2b'],input:'select',options:'riskTransferPoint'},
    warrantyPeriod:{section:'qualityRisk',label:['质保期限','Warranty Period'],types:['sales_contract'],modes:['ecommerce','b2b']},
    governingLaw:{section:'qualityRisk',label:['适用法律','Governing Law'],types:['sales_contract'],modes:['b2b']},
    disputeResolution:{section:'qualityRisk',label:['争议解决方式','Dispute Resolution'],types:['sales_contract'],modes:['b2b'],span:2,textarea:true},
    sellerSignatory:{section:'qualityRisk',label:['卖方签署人','Seller Signatory'],types:['sales_contract'],modes:['ecommerce','b2b']},
    buyerSignatory:{section:'qualityRisk',label:['买方签署人','Buyer Signatory'],types:['sales_contract'],modes:['ecommerce','b2b']},
    attachmentList:{section:'qualityRisk',label:['合同附件清单','Contract Attachments'],types:['sales_contract'],modes:['b2b'],span:2,textarea:true},
    productionStartDate:{section:'qualityRisk',label:['生产启动日期','Production Start Date'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'date'},
    expectedCompletionDate:{section:'qualityRisk',label:['预计完成日期','Expected Completion Date'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'date'},
    inspectionDate:{section:'qualityRisk',label:['预计验货日期','Planned Inspection Date'],types:['proforma_invoice','sales_contract'],modes:['b2b'],input:'date'},
    partialShipmentPlan:{section:'qualityRisk',label:['分批交付安排','Partial Shipment Plan'],types:['proforma_invoice','sales_contract'],modes:['b2b'],span:2,textarea:true}
  });

  const SECTION_TITLES=Object.freeze({
    quotation:{references:'报价参考',parties:'客户与卖方',products:'商品与金额',customs:'产品与合规参考',packing:'包装与预计物流',plannedLogistics:'预计物流',terms:'报价条件与说明'},
    proforma_invoice:{references:'订单参考',parties:'买卖双方',products:'商品与金额',customs:'产品与清关参考',delivery:'收货与通知',paymentSchedule:'付款与收款',packing:'包装与物流计划',plannedLogistics:'交付与物流计划',qualityRisk:'生产与确认',terms:'交易条件与确认'},
    commercial_invoice:{references:'发票与关联单据',parties:'出口方、买方与收货方',delivery:'收货与通知',products:'申报商品与金额',customs:'清关与监管',packing:'运输与包装',actualShipment:'实际出货',terms:'声明与签署'},
    packing_list:{references:'装箱与关联单据',parties:'发货与收货',delivery:'收货与通知',products:'装箱明细',packing:'包装汇总与逐箱资料',actualShipment:'运输与柜封'},
    sales_contract:{references:'合同参考',parties:'合同双方与交付',delivery:'收货与交付地址',products:'商品与金额',paymentSchedule:'付款与收款',packing:'包装与交付计划',plannedLogistics:'交付计划',qualityRisk:'质量、条款与风险',terms:'合同条款'}
  });
  const SECTION_DEFAULT_TITLES=Object.freeze({references:'关联与参考',delivery:'收货与通知',costs:'费用与金额',paymentSchedule:'付款计划',customs:'海关与合规',packing:'包装资料',plannedLogistics:'预计物流',actualShipment:'实际出货',qualityRisk:'质量、验收与风险'});

  const coreSections={basic:true,references:true,supplemental:true,parties:true,products:true,costs:true,delivery:false,paymentSchedule:false,customs:false,packing:false,plannedLogistics:false,actualShipment:false,logistics:false,payment:false,terms:true,qualityRisk:false,signature:false};
  const mode=(toggles,sections={},fields={})=>{
    const merged={...coreSections,...sections};
    merged.supplemental=Boolean(merged.references||merged.customs);
    merged.logistics=Boolean(merged.packing||merged.plannedLogistics||merged.actualShipment);
    return Object.freeze({
      toggles:Object.freeze([...toggles]),defaults:Object.freeze([...(fields.defaults||toggles)]),sections:Object.freeze(merged),
      logistics:Object.freeze([...(fields.logistics||[])]),delivery:Object.freeze([...(fields.delivery||[])]),productColumns:Object.freeze([...(fields.productColumns||[])]),
      navigation:Object.freeze([...(fields.navigation||[])]),paper:fields.paper||'portrait'
    });
  };
  const FULL_PRODUCTS=['image','sku','name','spec','hs','qty','unit','moq','price','amount','cartonNo','packageDescription','netWeight','grossWeight','cbm','dimensions','shippingMarks'];
  const SALES_PRODUCTS=['image','sku','name','spec','hs','qty','unit','moq','price','amount','dimensions'];
  const CUSTOMS_PRODUCTS=['image','sku','name','spec','hs','qty','unit','price','amount','netWeight','grossWeight'];
  const PACKING_PRODUCTS=['image','sku','name','spec','qty','unit','cartonNo','packageDescription','netWeight','grossWeight','cbm','dimensions','shippingMarks'];
  const SCENARIO_RULES=Object.freeze({
    wholesale:Object.freeze({label:'标准批发',preferredMode:'ecommerce',paper:'portrait',note:'适合常规成品、批发与重复采购。'}),
    sample:Object.freeze({label:'样品订单',preferredMode:'ecommerce',paper:'portrait',note:'突出样品费、快递、确认标准和非量产承诺。'}),
    oem:Object.freeze({label:'OEM / ODM 定制',preferredMode:'b2b',paper:'portrait',note:'突出图纸、样品、包装、生产启动条件和质检。'}),
    stock:Object.freeze({label:'现货订单',preferredMode:'ecommerce',paper:'portrait',note:'突出库存锁定、付款后发货和现有包装。'}),
    project:Object.freeze({label:'工程 / 项目订单',preferredMode:'b2b',paper:'portrait',note:'突出里程碑、技术资料、分批交付和变更确认。'})
  });
  const PROFILES=Object.freeze({
    quotation:Object.freeze({label:'报价单',abbr:'QT',purpose:'报价与供货条件确认',next:['proforma_invoice','sales_contract'],permanentExclude:['showPayment'],modeLabels:Object.freeze({ecommerce:Object.freeze({label:'快速报价',description:'快速完成价格、数量、有效期和交易条件。'}),b2b:Object.freeze({label:'完整报价',description:'增加合规参考、费用拆分、包装估算和预计物流。'})}),modes:Object.freeze({
      ecommerce:mode(['showProductImage','showQuote','showMoq','showFreight','showTerms','showRemarks'],{references:true,costs:true,terms:true},{productColumns:['image','sku','name','spec','qty','unit','moq','price','amount'],navigation:['basic','references','parties','products','costs','terms'],paper:'portrait'}),
      b2b:mode(['showOrigin','showCustomerPo','showQuote','showMoq','showSalesperson','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature'],{references:true,costs:true,customs:true,packing:true,plannedLogistics:true,terms:true,signature:true},{logistics:[...PLANNED_LOGISTICS_FIELDS,...PACKING_FIELDS],productColumns:SALES_PRODUCTS,navigation:['basic','references','parties','products','customs','packing','plannedLogistics','terms'],paper:'portrait'})
    }),notes:Object.freeze({default:'快速报价只保留价格、数量、有效期和交易条件。',detailed:'完整报价增加合规参考、包装估算和预计物流，但不开放发货后追踪字段。'})}),
    proforma_invoice:Object.freeze({label:'形式发票（PI）',abbr:'PI',purpose:'订单确认、收款与生产启动安排',next:['sales_contract','commercial_invoice','packing_list'],permanentExclude:[],modeLabels:Object.freeze({ecommerce:Object.freeze({label:'标准 PI',description:'用于订单确认、付款安排和预计交付。'}),b2b:Object.freeze({label:'订单执行 PI',description:'增加收货通知、包装、清关参考和生产执行资料。'})}),modes:Object.freeze({
      ecommerce:mode(['showOrigin','showCustomerPo','showProductImage','showFreight','showLogistics','showPayment','showTerms','showRemarks','showSignature'],{references:true,costs:true,paymentSchedule:true,plannedLogistics:true,payment:true,terms:true,signature:true},{logistics:PLANNED_LOGISTICS_FIELDS,productColumns:['image','sku','name','spec','qty','unit','price','amount'],navigation:['basic','references','parties','products','paymentSchedule','plannedLogistics','terms'],paper:'portrait'}),
      b2b:mode(TOGGLES,{references:true,delivery:true,costs:true,paymentSchedule:true,customs:true,packing:true,plannedLogistics:true,qualityRisk:true,payment:true,terms:true,signature:true},{logistics:[...PLANNED_LOGISTICS_FIELDS,...PACKING_FIELDS],delivery:DELIVERY_FIELDS,productColumns:SALES_PRODUCTS,navigation:['basic','references','parties','delivery','products','paymentSchedule','packing','qualityRisk','terms'],paper:'portrait'})
    }),notes:Object.freeze({default:'标准 PI 用于确认订单、付款和预计交付。',detailed:'订单执行 PI 增加完整收货、预计包装和生产确认；实际提单与柜封资料不进入 PI。'})}),
    commercial_invoice:Object.freeze({label:'商业发票',abbr:'CI',purpose:'出口申报、清关与正式结算核对',next:['packing_list'],permanentExclude:['showPayment'],formalSingleMode:true,formalMode:'b2b',formalLabel:'正规商业发票',formalAction:'申报配置',modeLabels:Object.freeze({ecommerce:Object.freeze({label:'正规商业发票',description:'统一使用正式清关结构；目的国、运输方式和监管扩展通过申报配置控制。'}),b2b:Object.freeze({label:'正规商业发票',description:'统一使用正式清关结构；目的国、运输方式和监管扩展通过申报配置控制。'})}),modes:Object.freeze({
      ecommerce:mode(['showOrigin','showCustomerPo','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature'],{references:true,delivery:true,costs:true,customs:true,packing:true,actualShipment:true,terms:true,signature:true},{defaults:['showOrigin','showCustomerPo','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature'],logistics:[...PACKING_FIELDS,...ACTUAL_LOGISTICS_FIELDS],delivery:DELIVERY_FIELDS,productColumns:CUSTOMS_PRODUCTS,navigation:['basic','references','parties','products','costs','customs','packing','actualShipment','terms'],paper:'portrait'}),
      b2b:mode(['showOrigin','showCustomerPo','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature'],{references:true,delivery:true,costs:true,customs:true,packing:true,actualShipment:true,terms:true,signature:true},{defaults:['showOrigin','showCustomerPo','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature'],logistics:[...PACKING_FIELDS,...ACTUAL_LOGISTICS_FIELDS],delivery:DELIVERY_FIELDS,productColumns:CUSTOMS_PRODUCTS,navigation:['basic','references','parties','products','costs','customs','packing','actualShipment','terms'],paper:'portrait'})
    }),notes:Object.freeze({default:'商业发票统一采用正规清关结构；国家、商品和运输差异通过申报配置与模板扩展。',detailed:'商业发票统一采用正规清关结构；国家、商品和运输差异通过申报配置与模板扩展。'})}),
    packing_list:Object.freeze({label:'装箱单',abbr:'PL',purpose:'包装、箱数、重量、体积与货代核对',next:[],permanentExclude:['showDiscount','showFreight','showTax','showAmountWords','showPayment'],formalSingleMode:true,formalMode:'b2b',formalLabel:'正规装箱单',formalAction:'装箱明细设置',modeLabels:Object.freeze({ecommerce:Object.freeze({label:'正规装箱单',description:'统一使用正式装箱结构；在装箱明细分栏选择按商品、按箱或按托盘记录。'}),b2b:Object.freeze({label:'正规装箱单',description:'统一使用正式装箱结构；在装箱明细分栏选择按商品、按箱或按托盘记录。'})}),modes:Object.freeze({
      ecommerce:mode(['showCustomerPo','showProductImage','showLogistics','showRemarks','showSignature'],{references:true,delivery:true,costs:false,packing:true,actualShipment:true,payment:false,terms:false,signature:true},{defaults:['showCustomerPo','showLogistics','showRemarks'],logistics:[...PACKING_FIELDS,...ACTUAL_LOGISTICS_FIELDS],delivery:DELIVERY_FIELDS,productColumns:PACKING_PRODUCTS,navigation:['basic','references','parties','products','packing','actualShipment'],paper:'landscape'}),
      b2b:mode(['showCustomerPo','showProductImage','showLogistics','showRemarks','showSignature'],{references:true,delivery:true,costs:false,packing:true,actualShipment:true,payment:false,terms:false,signature:true},{defaults:['showCustomerPo','showLogistics','showRemarks'],logistics:[...PACKING_FIELDS,...ACTUAL_LOGISTICS_FIELDS],delivery:DELIVERY_FIELDS,productColumns:PACKING_PRODUCTS,navigation:['basic','references','parties','products','packing','actualShipment'],paper:'landscape'})
    }),notes:Object.freeze({default:'装箱单统一采用正规结构；明细深度在装箱明细分栏中选择。',detailed:'装箱单统一采用正规结构；明细深度在装箱明细分栏中选择。'})}),
    sales_contract:Object.freeze({label:'销售合同',abbr:'SC',purpose:'双方责任、付款、交付、质量与争议约定',next:['commercial_invoice','packing_list'],permanentExclude:[],modeLabels:Object.freeze({ecommerce:Object.freeze({label:'销售确认书',description:'用于标准订单确认，保留商品、付款、交货、质量、验收与签署。'}),b2b:Object.freeze({label:'完整销售合同',description:'增加收货地址、包装、交付计划、适用法律与争议解决。'})}),modes:Object.freeze({
      ecommerce:mode(['showProductImage','showPayment','showTerms','showRemarks','showSignature'],{references:true,costs:true,paymentSchedule:true,qualityRisk:true,payment:true,terms:true,signature:true},{defaults:['showPayment','showTerms','showRemarks','showSignature'],productColumns:['sku','name','spec','qty','unit','price','amount'],navigation:['basic','references','parties','products','paymentSchedule','qualityRisk','terms','signature'],paper:'portrait'}),
      b2b:mode(['showCustomerPo','showQuote','showSalesperson','showProductImage','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature'],{references:true,delivery:true,costs:true,paymentSchedule:true,packing:true,plannedLogistics:true,qualityRisk:true,payment:true,terms:true,signature:true},{defaults:['showCustomerPo','showQuote','showSalesperson','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature'],logistics:[...PLANNED_LOGISTICS_FIELDS,...PACKING_FIELDS],delivery:DELIVERY_FIELDS,productColumns:SALES_PRODUCTS,navigation:['basic','references','parties','products','paymentSchedule','qualityRisk','packing','terms','signature'],paper:'portrait'})
    }),notes:Object.freeze({default:'销售确认书包含基础质量、验收、风险和双方签署。',detailed:'完整销售合同增加收货、包装、交付计划、适用法律与争议解决；正式签署前仍需企业审核。'})})
  });

  const normalizeType=value=>PROFILES[value]?value:'proforma_invoice';
  const normalizeMode=value=>value===MODES.DETAILED?MODES.DETAILED:MODES.DEFAULT;
  const profile=(type='proforma_invoice')=>PROFILES[normalizeType(type)];
  const effectiveMode=(type='proforma_invoice',docMode='ecommerce')=>profile(type).formalSingleMode?(profile(type).formalMode||MODES.DETAILED):normalizeMode(docMode);
  const isFormalSingleMode=(type='proforma_invoice')=>Boolean(profile(type).formalSingleMode);
  const formalConfig=(type='proforma_invoice')=>{const t=normalizeType(type);if(typeof document==='undefined')return{ciComplianceLevel:'standard',packingDetailMode:'summary'};return{ciComplianceLevel:String(document.getElementById('ciComplianceLevel')?.value||'standard'),packingDetailMode:String(document.getElementById('packingDetailMode')?.value||'summary')};};
  const modeProfile=(type='proforma_invoice',docMode='ecommerce')=>profile(type).modes[effectiveMode(type,docMode)];
  const modeInfo=(type='proforma_invoice',docMode='ecommerce')=>profile(type).modeLabels?.[effectiveMode(type,docMode)]||{label:effectiveMode(type,docMode)===MODES.DETAILED?'精细模式':'默认模式',description:''};
  const paperRecommendation=(type='proforma_invoice',docMode='ecommerce')=>modeProfile(type,docMode).paper||'portrait';
  const toggleAllowed=(id,type,docMode)=>modeProfile(type,docMode).toggles.includes(id)&&!profile(type).permanentExclude.includes(id);
  const toggleDefault=(id,type,docMode)=>modeProfile(type,docMode).defaults.includes(id)&&toggleAllowed(id,type,docMode);
  const sectionAllowed=(key,type,docMode)=>Boolean(modeProfile(type,docMode).sections[key]);
  const navigation=(type,docMode)=>[...modeProfile(type,docMode).navigation];
  const sectionTitle=(key,type)=>SECTION_TITLES[normalizeType(type)]?.[key]||SECTION_DEFAULT_TITLES[key]||key;
  const structuredFieldAllowed=(id,type,docMode)=>{const def=FIELD_DEFINITIONS[id];if(!def)return false;const t=normalizeType(type),m=effectiveMode(t,docMode),cfg=formalConfig(t);if(t==='commercial_invoice'&&CI_REGULATORY_FIELDS.includes(id)&&cfg.ciComplianceLevel!=='regulatory')return false;if(t==='packing_list'){if(cfg.packingDetailMode==='summary'&&(PL_CARTON_DETAIL_FIELDS.includes(id)||PL_PALLET_DETAIL_FIELDS.includes(id)))return false;if(cfg.packingDetailMode==='carton'&&PL_PALLET_DETAIL_FIELDS.includes(id))return false;}return def.types.includes(t)&&def.modes.includes(m)&&sectionAllowed(def.section,t,m);};
  const sectionFieldIds=(key,type,docMode)=>Object.keys(FIELD_DEFINITIONS).filter(id=>FIELD_DEFINITIONS[id].section===key&&structuredFieldAllowed(id,type,docMode));
  const requiredFields=(key,type,docMode)=>{
    const t=normalizeType(type),m=effectiveMode(t,docMode),rules={
      basic:['invoiceNo','issueDate','currency'],parties:['sellerName','buyerName'],products:[],
      references:t==='packing_list'?['relatedCommercialInvoiceNo']:t==='commercial_invoice'?['customerOrderNo']:[],
      delivery:['consigneeName','consigneeAddress'],
      customs:t==='commercial_invoice'?['exportReason','customsDescription','customsDeclaredValue']:[],
      packing:t==='packing_list'?['packageCount','grossWeight']:[],
      paymentSchedule:['depositPercent','balancePercent'],
      qualityRisk:t==='sales_contract'?['qualityStandard','riskTransferPoint']:[]
    };
    if(m===MODES.DEFAULT&&key==='delivery'&&!['commercial_invoice','packing_list'].includes(t))return [];
    return (rules[key]||[]).filter(id=>!FIELD_DEFINITIONS[id]||structuredFieldAllowed(id,t,m));
  };
  function fieldAllowed(id,type,docMode){
    const p=modeProfile(type,docMode),t=normalizeType(type),m=effectiveMode(t,docMode);
    if(TOGGLES.includes(id))return toggleAllowed(id,t,m);
    if(STRUCTURED_FIELDS.includes(id))return structuredFieldAllowed(id,t,m);
    if(PLANNED_LOGISTICS_FIELDS.includes(id))return p.sections.plannedLogistics&&p.logistics.includes(id);
    if(PACKING_FIELDS.includes(id))return p.sections.packing&&p.logistics.includes(id);
    if(ACTUAL_LOGISTICS_FIELDS.includes(id))return p.sections.actualShipment&&p.logistics.includes(id);
    if(DELIVERY_FIELDS.includes(id))return p.sections.delivery&&p.delivery.includes(id);
    if(PAYMENT_FIELDS.includes(id))return p.sections.payment;
    if(id==='tradeScenario')return true;
    if(['sellerTaxId','buyerTaxId','buyerCountryCode'].includes(id))return t==='commercial_invoice'||m===MODES.DETAILED;
    if(ADVANCED_FIELDS.includes(id))return m===MODES.DETAILED;
    if(id==='contractClauses'||id==='contractClauseBuilder')return t==='sales_contract'&&m===MODES.DETAILED;
    return true;
  }
  function productColumnAllowed(key,type,docMode){const t=normalizeType(type),cfg=formalConfig(t);if(t==='packing_list'&&key==='cartonNo'&&cfg.packingDetailMode==='summary')return false;return modeProfile(t,docMode).productColumns.includes(key);}
  function visibilityState(ids=[]){const set=new Set(ids);return Object.fromEntries(TOGGLES.map(id=>[id,set.has(id)]));}
  function legacyProfilePresets(){return Object.fromEntries(Object.entries(PROFILES).map(([type,p])=>[type,{label:p.label,mode:'ecommerce',visibility:visibilityState(p.modes.ecommerce.defaults),detailedVisibility:visibilityState(p.modes.b2b.defaults)}]));}
  function legacyVisibilityRules(){return Object.fromEntries(Object.entries(PROFILES).map(([type,p])=>[type,{defaultNote:p.notes.default,detailedNote:p.notes.detailed,defaultControls:[...p.modes.ecommerce.toggles],detailedControls:[...p.modes.b2b.toggles],labels:{}}]));}
  const first=(obj,keys)=>{for(const key of keys){const v=obj?.[key];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return'';};
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  function productToItem(product={}){return {id:product.id||'',itemKey:product.id?`product_${product.id}`:'',sku:first(product,['sku','model','product_code']),name:first(product,['name','title']),spec:first(product,['specification','specs','description']),hs:first(product,['hs_code','hs']),qty:1,unit:first(product,['pricing_unit','unit'])||'PCS',moq:first(product,['moq','minimum_order_quantity']),price:num(first(product,['suggested_price','price','sale_price'])),image:first(product,['image_url','main_image_url','primary_image_url']),cartonNo:first(product,['carton_no','cartonNo']),packageDescription:first(product,['package_description','package_type','packaging','packageDescription']),netWeight:num(first(product,['net_weight','netWeight'])),grossWeight:num(first(product,['gross_weight','package_weight','weight','grossWeight'])),cbm:num(first(product,['cbm','volume_cbm','volume'])),dimensions:first(product,['dimensions','package_size','package_dimensions']),shippingMarks:first(product,['shipping_marks','marks']),category:first(product,['category']),subcategory:first(product,['subcategory']),sourceUrl:first(product,['source_url']),supplierName:first(product,['supplier_name']),internalNotes:first(product,['internal_notes'])};}
  function customerToFields(customer={}){return {buyerName:first(customer,['company_name','name']),buyerContact:first(customer,['contact_name','contact']),buyerEmail:first(customer,['email']),buyerPhone:first(customer,['phone','whatsapp']),buyerAddress:first(customer,['address','company_address']),buyerCountry:first(customer,['country']),buyerCountryCode:first(customer,['country_code','iso_country_code']),buyerWebsite:first(customer,['website']),buyerTaxId:first(customer,['tax_id','vat_no']),consigneeName:first(customer,['consignee_name']),consigneeContact:first(customer,['consignee_contact']),consigneePhone:first(customer,['consignee_phone']),consigneeEmail:first(customer,['consignee_email']),consigneeAddress:first(customer,['consignee_address']),currency:first(customer,['currency'])||'USD',docLanguage:first(customer,['preferred_language'])||'en'};}
  function brandToFields(brand={},language='en'){const en=language==='en';return {sellerName:(en?first(brand,['company_name_en','company_name']):first(brand,['company_name','company_name_en'])),sellerContact:first(brand,['contact_name','contact']),sellerPhone:first(brand,['phone']),sellerEmail:first(brand,['email']),sellerAddress:(en?first(brand,['address_en','address']):first(brand,['address','address_en'])),sellerTaxId:first(brand,['tax_id','vat_no']),bankBeneficiary:first(brand,['bank_beneficiary','beneficiary']),bankName:first(brand,['bank_name']),bankAccount:first(brand,['bank_account']),bankSwift:first(brand,['bank_swift','swift']),bankAddress:first(brand,['bank_address'])};}
  function mergeEmpty(base={},incoming={}){const out={...base};Object.entries(incoming||{}).forEach(([k,v])=>{if((out[k]===undefined||out[k]===null||String(out[k]).trim()==='')&&v!==undefined&&v!==null&&String(v).trim()!=='')out[k]=v;});return out;}
  function convertState(state={},targetType='proforma_invoice'){const type=normalizeType(targetType),sourceFields=state.fields||{};const fields={...sourceFields,documentType:type,docMode:effectiveMode(type,sourceFields.docMode||'ecommerce')};const allowed=modeProfile(type,fields.docMode).defaults;TOGGLES.forEach(id=>{fields[id]=allowed.includes(id)?(sourceFields[id]===false?'':(sourceFields[id]||'on')):'';});if(type==='packing_list'){fields.showPayment='';fields.showFreight='';fields.showTax='';fields.showDiscount='';fields.showAmountWords='';}return {...state,fields,items:Array.isArray(state.items)?state.items.map(item=>({...item})):[]};}

  const html=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function inputHTML(id,def){
    const attrs=[`id="${id}"`];
    if(def.min!==undefined)attrs.push(`min="${def.min}"`);if(def.max!==undefined)attrs.push(`max="${def.max}"`);if(def.step!==undefined)attrs.push(`step="${def.step}"`);
    let control='';
    if(def.input==='select'){const options=(selectOptions[def.options]||[]).map(([value,zh])=>`<option value="${html(value)}">${html(zh)}</option>`).join('');control=`<select ${attrs.join(' ')}>${options}</select>`;}
    else if(def.textarea)control=`<textarea ${attrs.join(' ')}></textarea>`;
    else control=`<input ${attrs.join(' ')} type="${def.input||'text'}">`;
    return `<label class="${def.span===2?'span-2':''}" data-fp-structured-field="${id}">${html(def.label[0])}${control}</label>`;
  }
  function createSection(key){const section=document.createElement('section');section.className='card fp-a10-structured-section';section.id=`fpA10${key[0].toUpperCase()+key.slice(1)}Section`;section.dataset.fpSection=key;section.innerHTML=`<div class="section-title"><h2 data-fp-section-title="${key}">${html(SECTION_DEFAULT_TITLES[key]||key)}</h2><span class="fp-a10-section-status" data-fp-section-status>未开始</span></div><p class="hint" data-fp-section-hint>本分栏会根据当前单据、场景配置和模板自动显示；隐藏或切换不会删除已填写内容。</p><div class="grid fp-a10-section-grid" data-fp-section-grid="${key}"></div>`;return section;}
  function labelOf(id){const control=document.getElementById(id);return control?.closest('label')||null;}
  function moveControl(id,grid){const label=labelOf(id);if(label&&grid&&!grid.contains(label))grid.appendChild(label);}
  function installStructuredSections(){
    const form=document.getElementById('piForm'),column=document.querySelector('.form-column');if(!form||!column||document.getElementById('fpA10ReferencesSection'))return false;
    let custom=document.getElementById('customDocumentFieldsJson');if(!custom){custom=document.createElement('input');custom.type='hidden';custom.id='customDocumentFieldsJson';custom.value='[]';form.appendChild(custom);}
    [['ciComplianceLevel','standard'],['packingDetailMode','summary']].forEach(([id,value])=>{if(document.getElementById(id))return;const input=document.createElement('input');input.type='hidden';input.id=id;input.value=value;form.appendChild(input);});
    const parties=document.getElementById('buyerName')?.closest('section.card');const products=document.getElementById('itemList')?.closest('section.card');const legacyLogistics=document.querySelector('[data-optional-section="showLogistics"]');const payment=document.querySelector('[data-optional-section="showPayment"]');const terms=document.querySelector('[data-optional-section="showTerms"]');const signature=document.querySelector('[data-optional-section="showSignature"]');
    if(parties){parties.dataset.fpSection='parties';parties.id=parties.id||'fpA10PartiesSection';}
    if(products){products.dataset.fpSection='products';products.id=products.id||'fpA10ProductsSection';}
    if(payment)payment.dataset.fpSection='payment';if(terms)terms.dataset.fpSection='terms';if(signature)signature.dataset.fpSection='signature';
    const refs=createSection('references'),delivery=createSection('delivery'),costs=createSection('costs'),schedule=createSection('paymentSchedule'),customs=createSection('customs'),packing=createSection('packing'),planned=createSection('plannedLogistics'),actual=createSection('actualShipment'),quality=createSection('qualityRisk');
    if(parties)column.insertBefore(refs,parties);else column.appendChild(refs);
    if(parties)parties.after(delivery);else refs.after(delivery);
    if(products)products.after(costs);else delivery.after(costs);
    costs.after(customs);customs.after(packing);packing.after(planned);planned.after(actual);
    if(payment)column.insertBefore(schedule,payment);else actual.after(schedule);
    if(terms)column.insertBefore(quality,terms);else schedule.after(quality);
    const grids=Object.fromEntries(['references','delivery','costs','paymentSchedule','customs','packing','plannedLogistics','actualShipment','qualityRisk'].map(key=>[key,document.querySelector(`[data-fp-section-grid="${key}"]`)]));
    ['validUntil','customerPo','quoteNo','salesperson'].forEach(id=>moveControl(id,grids.references));
    const partyDetails=document.querySelector('.trade-party-details');const deliveryGrid=partyDetails?.querySelector('.grid');if(deliveryGrid){[...deliveryGrid.children].forEach(node=>grids.delivery.appendChild(node));partyDetails.hidden=true;partyDetails.classList.add('fp-v3350-hidden');}
    const summary=products?.querySelector('.summary-inputs');if(summary){[...summary.children].forEach(node=>grids.costs.appendChild(node));summary.remove();}
    ['originCountry'].forEach(id=>moveControl(id,grids.customs));
    ['packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks','logisticsExtraRowsJson'].forEach(id=>moveControl(id,grids.packing));
    const extra=document.querySelector('.logistics-extra');if(extra&&!grids.packing.contains(extra))grids.packing.appendChild(extra);
    ['shippingMethod','portOfLoading','destinationPort','estimatedShipment','etd','eta'].forEach(id=>moveControl(id,grids.plannedLogistics));
    ['logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight'].forEach(id=>moveControl(id,grids.actualShipment));
    Object.entries(FIELD_DEFINITIONS).forEach(([id,def])=>{const grid=grids[def.section];if(grid&&!document.getElementById(id))grid.insertAdjacentHTML('beforeend',inputHTML(id,def));});
    const copy=document.createElement('div');copy.className='span-2 fp-a10-copy-row';copy.innerHTML='<button type="button" class="btn secondary" id="fpA10CopyBuyerToDelivery">沿用买方资料到收货方</button><small>只填充空白项，不覆盖已经填写的收货资料。</small>';grids.delivery.prepend(copy);
    copy.querySelector('button')?.addEventListener('click',()=>{const pairs=[['buyerName','consigneeName'],['buyerContact','consigneeContact'],['buyerPhone','consigneePhone'],['buyerEmail','consigneeEmail'],['buyerAddress','consigneeAddress'],['buyerAddress','billToAddress'],['buyerAddress','shipToAddress']];pairs.forEach(([source,target])=>{const s=document.getElementById(source),t=document.getElementById(target);if(t&&!String(t.value||'').trim()&&String(s?.value||'').trim()){t.value=s.value;t.dispatchEvent(new Event('input',{bubbles:true}));}});});
    if(legacyLogistics){legacyLogistics.dataset.fpLegacyLogistics='1';legacyLogistics.hidden=true;legacyLogistics.classList.add('fp-v3350-hidden');}
    const syncLegacyDates=event=>{const t=normalizeType(document.getElementById('documentType')?.value);const map={quotation:'quotationValidUntil',proforma_invoice:'proformaValidUntil',packing_list:'packingDate'};const structured=map[t],legacy=t==='packing_list'?'issueDate':'validUntil';if(!structured)return;const source=document.getElementById(structured),target=document.getElementById(legacy);if(event?.target===source&&target){target.value=source.value;target.dispatchEvent(new Event('input',{bubbles:true}));}else if(source&&target&&!source.value&&target.value)source.value=target.value;};
    form.addEventListener('input',syncLegacyDates);form.addEventListener('change',syncLegacyDates);syncLegacyDates();
    document.documentElement.dataset.fpA10SectionsInstalled='1';return true;
  }
  function fixedText(zh,en,language='bilingual'){
    const i18n=window.HUIDIDocI18n;
    if(i18n?.text)return i18n.text(zh,en,language);
    return language==='zh'?zh:language==='en'?en:`${zh} / ${en}`;
  }
  function displayValue(id,value,language='bilingual'){
    const def=FIELD_DEFINITIONS[id],text=String(value??'').trim();if(!text)return '';
    if(def?.input==='select'){
      const row=(selectOptions[def.options]||[]).find(option=>option[0]===text);
      if(row)return fixedText(row[1],row[2],language);
    }
    if(['depositPercent','balancePercent'].includes(id)){
      const number=Number(text);return Number.isFinite(number)?`${Number(number.toFixed(2))}%`:`${text}%`;
    }
    return text;
  }
  function outputLabel(id,language='bilingual'){
    const def=FIELD_DEFINITIONS[id];if(!def)return id;
    return fixedText(def.label[0],def.label[1],language);
  }
  function structuredOutputRows(type,docMode,fields={},language='bilingual'){
    const t=normalizeType(type),m=normalizeMode(docMode),rows=[];
    Object.entries(FIELD_DEFINITIONS).forEach(([id,def])=>{
      if(def.internal||!structuredFieldAllowed(id,t,m))return;const value=displayValue(id,fields[id],language);if(!value)return;
      rows.push({id,section:def.section,group:def.section,label:outputLabel(id,language),value});
    });
    return rows;
  }
  function installOnReady(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installStructuredSections,{once:true});else installStructuredSections();}
  installOnReady();

  window.FlypigBOXDocumentSchema=Object.freeze({
    version:VERSION,modes:MODES,toggles:TOGGLES,logisticsFields:LOGISTICS_FIELDS,plannedLogisticsFields:PLANNED_LOGISTICS_FIELDS,packingFields:PACKING_FIELDS,actualLogisticsFields:ACTUAL_LOGISTICS_FIELDS,
    deliveryFields:DELIVERY_FIELDS,paymentFields:PAYMENT_FIELDS,paymentScheduleFields:PAYMENT_SCHEDULE_FIELDS,referenceFields:REFERENCE_FIELDS,customsFields:CUSTOMS_FIELDS,qualityRiskFields:QUALITY_RISK_FIELDS,
    structuredFields:STRUCTURED_FIELDS,fieldDefinitions:FIELD_DEFINITIONS,scenarioRules:SCENARIO_RULES,profiles:PROFILES,normalizeType,normalizeMode,effectiveMode,isFormalSingleMode,formalConfig,profile,modeProfile,modeInfo,paperRecommendation,toggleAllowed,toggleDefault,
    sectionAllowed,navigation,sectionTitle,sectionFieldIds,requiredFields,structuredFieldAllowed,fieldAllowed,productColumnAllowed,legacyProfilePresets,legacyVisibilityRules,productToItem,customerToFields,brandToFields,mergeEmpty,convertState,
    installStructuredSections,outputLabel,displayValue,structuredOutputRows
  });
})();
