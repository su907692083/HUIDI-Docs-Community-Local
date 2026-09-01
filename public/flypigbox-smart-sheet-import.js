/* HUIDI V3.2.4 — conservative multilingual import with reliable product boundaries and conflict blocking.
   Supports horizontal tables, vertical key/value sheets and transposed product tables.
   Canonical data remains in the original editor form controls. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => String(value ?? '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm = value => clean(value).toLowerCase()
    .replace(/[（）()\[\]【】]/g,' ')
    .replace(/[：:]/g,' ')
    .replace(/[\/\\|·•—–_-]+/g,' ')
    .replace(/[.,，。;；'"`]/g,' ')
    .replace(/\s+/g,' ').trim();
  const compact = value => norm(value).replace(/\s+/g,'');
  const numberText = value => clean(value).replace(/[,，\s]/g,'').replace(/^(usd|eur|gbp|cny|rmb|jpy|aud|cad|hkd|\$|€|£|¥)/i,'').replace(/(usd|eur|gbp|cny|rmb|jpy|aud|cad|hkd)$/i,'').trim();
  const on = value => value === true || value === 'true' || value === '1' || value === 'on' || value === 1;

  const FIELD_META = {
    docLanguage:{zh:'PDF 输出语言',en:'PDF Language',aliases:['pdf language','document language','language','输出语言','单据语言','语言']},
    currency:{zh:'主币种',en:'Currency',aliases:['currency','币种','货币','currency code']},
    originCountry:{zh:'原产国',en:'Country of Origin',aliases:['country of origin','origin country','origin','原产国','原产地','产地']},
    invoiceNo:{zh:'单据编号',en:'Document No.',aliases:['document no','document number','invoice no','invoice number','pi no','quotation no','commercial invoice no','packing list no','contract no','单据编号','发票编号','形式发票编号','pi编号','报价单号','报价编号','装箱单号','合同编号']},
    revisionNo:{zh:'修订版本',en:'Revision',aliases:['revision','revision no','rev','版本','修订版本','修订号']},
    documentStatus:{zh:'单据状态',en:'Document Status',aliases:['document status','status','单据状态','状态']},
    tradeScenario:{zh:'业务场景',en:'Trade Scenario',aliases:['trade scenario','business scenario','order type','业务场景','订单类型']},
    issueDate:{zh:'出单日期',en:'Issue Date',aliases:['issue date','invoice date','quotation date','date issued','出单日期','开票日期','报价日期','日期']},
    validUntil:{zh:'有效期',en:'Valid Until',aliases:['valid until','validity','quotation validity','expiry date','有效期','报价有效期','有效日期']},
    customerPo:{zh:'客户 PO 编号',en:'Customer PO No.',aliases:['customer po','po no','purchase order no','purchase order number','客户po','客户 po 编号','采购订单号','po编号']},
    quoteNo:{zh:'报价编号',en:'Quotation No.',aliases:['quote no','quotation no','quotation number','报价编号','报价单号']},
    moq:{zh:'整单 MOQ',en:'Order MOQ',aliases:['order moq','total moq','minimum order quantity','整单moq','起订量','最低起订量']},
    salesperson:{zh:'业务员',en:'Salesperson',aliases:['salesperson','sales rep','sales representative','sales manager','业务员','销售员']},
    preparedBy:{zh:'制单人',en:'Prepared by',aliases:['prepared by','created by','制单人','编制人']},
    approvedBy:{zh:'审核人',en:'Approved by',aliases:['approved by','checked by','reviewed by','审核人','批准人']},

    sellerName:{zh:'卖方公司',en:'Seller',aliases:['seller','seller company','supplier','supplier name','exporter','卖方','卖方公司','供应商','出口商']},
    sellerContact:{zh:'卖方联系人',en:'Seller Contact',aliases:['seller contact','supplier contact','exporter contact','卖方联系人','供应商联系人']},
    sellerPhone:{zh:'卖方电话',en:'Seller Phone',aliases:['seller phone','supplier phone','seller tel','卖方电话','供应商电话']},
    sellerEmail:{zh:'卖方邮箱',en:'Seller Email',aliases:['seller email','supplier email','卖方邮箱','供应商邮箱']},
    sellerAddress:{zh:'卖方地址',en:'Seller Address',aliases:['seller address','supplier address','exporter address','卖方地址','供应商地址']},
    sellerTaxId:{zh:'卖方税号',en:'Seller Tax ID',aliases:['seller tax id','seller vat','supplier tax id','卖方税号','供应商税号']},
    buyerName:{zh:'买方公司',en:'Buyer',aliases:['buyer','buyer company','customer','customer name','importer','买方','买方公司','客户公司','进口商']},
    buyerContact:{zh:'买方联系人',en:'Buyer Contact',aliases:['buyer contact','customer contact','importer contact','买方联系人','客户联系人']},
    buyerPhone:{zh:'买方电话',en:'Buyer Phone',aliases:['buyer phone','customer phone','buyer tel','买方电话','客户电话']},
    buyerEmail:{zh:'买方邮箱',en:'Buyer Email',aliases:['buyer email','customer email','买方邮箱','客户邮箱']},
    buyerAddress:{zh:'买方地址',en:'Buyer Address',aliases:['buyer address','customer address','importer address','买方地址','客户地址']},
    buyerTaxId:{zh:'买方税号',en:'Buyer Tax ID',aliases:['buyer tax id','buyer vat','customer tax id','买方税号','客户税号','vat no','eori']},
    buyerCountry:{zh:'买方国家',en:'Buyer Country',aliases:['buyer country','customer country','country region','买方国家','客户国家','国家地区']},
    buyerCountryCode:{zh:'ISO 国家代码',en:'ISO Code',aliases:['iso country code','country code','iso code','iso 国家代码','国家代码']},
    buyerWebsite:{zh:'买方网站',en:'Buyer Website',aliases:['buyer website','customer website','website','买方网站','客户网站','网址']},
    destinationPort:{zh:'目的地 / 目的港',en:'Destination',aliases:['destination','destination port','port of destination','final destination','目的地','目的港']},

    consigneeName:{zh:'收货人公司',en:'Consignee',aliases:['consignee','consignee name','consignee company','收货人','收货人公司']},
    consigneeContact:{zh:'收货人联系人',en:'Consignee Contact',aliases:['consignee contact','收货人联系人']},
    consigneePhone:{zh:'收货人电话',en:'Consignee Phone',aliases:['consignee phone','consignee tel','收货人电话']},
    consigneeEmail:{zh:'收货人邮箱',en:'Consignee Email',aliases:['consignee email','收货人邮箱']},
    consigneeAddress:{zh:'收货人地址',en:'Consignee Address',aliases:['consignee address','delivery address','收货人地址','收货地址']},
    notifyPartyName:{zh:'通知方',en:'Notify Party',aliases:['notify party','notify party name','通知方','通知人']},
    notifyPartyContact:{zh:'通知方联系人',en:'Notify Contact',aliases:['notify contact','notify party contact','通知方联系人']},
    notifyPartyPhone:{zh:'通知方电话',en:'Notify Phone',aliases:['notify phone','notify party phone','通知方电话']},
    notifyPartyEmail:{zh:'通知方邮箱',en:'Notify Email',aliases:['notify email','notify party email','通知方邮箱']},
    notifyPartyAddress:{zh:'通知方地址',en:'Notify Address',aliases:['notify address','notify party address','通知方地址']},
    billToAddress:{zh:'账单地址',en:'Bill To',aliases:['bill to','billing address','bill to address','账单地址','开票地址']},
    shipToAddress:{zh:'送货地址',en:'Ship To',aliases:['ship to','shipping address','ship to address','送货地址','交货地址']},

    extraFeeName:{zh:'附加费用名称',en:'Extra Fee',aliases:['extra fee','additional fee','surcharge','附加费用','附加费']},
    extraFeeAmount:{zh:'附加费用金额',en:'Extra Fee Amount',aliases:['extra fee amount','additional fee amount','surcharge amount','附加费用金额','附加费金额']},
    taxAmount:{zh:'税费',en:'VAT / Tax',aliases:['tax','vat','tax amount','税费','增值税']},
    discountType:{zh:'折扣方式',en:'Discount Type',aliases:['discount type','折扣方式']},
    discountValue:{zh:'折扣值',en:'Discount Value',aliases:['discount','discount value','discount amount','折扣','折扣值']},
    amountWordsOverride:{zh:'金额大写',en:'Amount in Words',aliases:['amount in words','total in words','金额大写','金额英文大写']},

    shippingMethod:{zh:'运输方式',en:'Shipping Method',aliases:['shipping method','transport mode','mode of transport','shipment method','运输方式','运输模式']},
    packageCount:{zh:'总箱数',en:'Packages',aliases:['packages','package count','total cartons','cartons','total packages','总箱数','箱数','件数']},
    packageType:{zh:'包装类型',en:'Package Type',aliases:['package type','packing type','包装类型','包装方式']},
    netWeight:{zh:'总净重',en:'N.W.',aliases:['net weight','n w','nw','total net weight','总净重','净重']},
    grossWeight:{zh:'总毛重',en:'G.W.',aliases:['gross weight','g w','gw','total gross weight','总毛重','毛重']},
    cbm:{zh:'总体积',en:'CBM',aliases:['cbm','volume','total volume','总体积','体积','立方']},
    logisticsCarrier:{zh:'承运人 / 货代',en:'Carrier / Forwarder',aliases:['carrier','forwarder','freight forwarder','carrier forwarder','承运人','货代','运输公司']},
    trackingNo:{zh:'追踪号 / 运单号',en:'Tracking / Waybill No.',aliases:['tracking no','waybill no','air waybill','awb no','运单号','追踪号','快递单号']},
    blNo:{zh:'提单号',en:'B/L No.',aliases:['b l no','bl no','bill of lading no','提单号']},
    containerNo:{zh:'柜号',en:'Container No.',aliases:['container no','container number','柜号','集装箱号']},
    sealNo:{zh:'封条号',en:'Seal No.',aliases:['seal no','seal number','封条号','封签号']},
    vesselFlight:{zh:'船名 / 航班 / 车次',en:'Vessel / Flight',aliases:['vessel','vessel flight','flight no','train no','船名','航班','车次']},
    etd:{zh:'预计离港',en:'ETD',aliases:['etd','estimated time of departure','预计离港','预计开船']},
    eta:{zh:'预计到港',en:'ETA',aliases:['eta','estimated time of arrival','预计到港','预计到达']},
    packageDimensions:{zh:'单箱尺寸',en:'Carton Dimensions',aliases:['carton dimensions','package dimensions','carton size','单箱尺寸','外箱尺寸']},
    shippingMarks:{zh:'运输唛头',en:'Shipping Marks',aliases:['shipping marks','marks and numbers','carton marks','运输唛头','唛头']},

    paymentTemplate:{zh:'收款渠道',en:'Payment Channel',aliases:['payment channel','payment method','payment platform','收款渠道','支付平台','付款平台']},
    bankBeneficiary:{zh:'收款人 / 账户名',en:'Beneficiary',aliases:['beneficiary','beneficiary name','account name','收款人','账户名','受益人']},
    bankName:{zh:'开户行',en:'Bank Name',aliases:['bank name','bank','开户行','银行名称']},
    bankAccount:{zh:'银行账号',en:'Account No.',aliases:['bank account','account no','account number','银行账号','收款账号']},
    bankSwift:{zh:'SWIFT',en:'SWIFT / BIC',aliases:['swift','swift code','bic','bic code']},
    bankAddress:{zh:'银行地址 / 付款备注',en:'Bank Address / Payment Note',aliases:['bank address','payment note','bank remarks','银行地址','付款备注']},

    paymentTerms:{zh:'付款条款',en:'Payment Terms',aliases:['payment terms','terms of payment','付款条款','付款方式']},
    tradeTerms:{zh:'贸易术语',en:'Incoterms®',aliases:['incoterms','trade terms','delivery terms','贸易术语','成交方式']},
    deliveryTime:{zh:'交期',en:'Lead Time',aliases:['lead time','delivery time','production lead time','交期','生产周期']},
    portOfLoading:{zh:'装运港',en:'Port of Loading',aliases:['port of loading','loading port','pol','装运港','起运港']},
    estimatedShipment:{zh:'预计发货日期',en:'Estimated Shipment',aliases:['estimated shipment','estimated shipping date','shipment date','预计发货日期','预计出货日期']},
    remarks:{zh:'补充备注',en:'Remarks',aliases:['remarks','notes','comments','补充备注','备注']},
    contractClauses:{zh:'合同补充条款',en:'Contract Clauses',aliases:['contract clauses','additional clauses','special terms','合同补充条款','合同条款']},

    productionStartCondition:{zh:'生产启动条件',en:'Production Start',aliases:['production start condition','production starts','生产启动条件','开工条件']},
    sampleApproval:{zh:'样品确认',en:'Sample Approval',aliases:['sample approval','sample confirmation','样品确认','样品状态']},
    artworkApproval:{zh:'图稿 / 包装确认',en:'Artwork Approval',aliases:['artwork approval','artwork confirmation','packaging artwork','图稿确认','包装确认状态']},
    inspectionStandard:{zh:'检验标准',en:'Inspection Standard',aliases:['inspection standard','quality inspection','aql','检验标准','验货标准']},
    qualityTolerance:{zh:'质量公差',en:'Tolerance',aliases:['tolerance','quality tolerance','dimension tolerance','质量公差','尺寸公差','颜色公差','工艺公差']},
    packagingConfirmation:{zh:'包装确认要求',en:'Packaging Approval',aliases:['packaging confirmation','packaging approval','packing confirmation','包装确认要求','包装确认']},
    warrantyTerms:{zh:'质保与售后',en:'Warranty',aliases:['warranty','warranty terms','after sales','质保','售后','质保与售后']},
    factoryDeliveryNote:{zh:'工厂交付说明',en:'Factory Delivery Note',aliases:['factory delivery note','factory remarks','production note','工厂交付说明','工厂交付补充说明']}
  };

  const PRODUCT_META = {
    name:{label:'商品名称 / Product',aliases:['product','product name','item','item name','description','product description','description of goods','goods description','commodity','商品名称','产品名称','品名','货物名称']},
    sku:{label:'SKU / 型号',aliases:['sku','model','model no','item no','part no','product code','货号','型号','产品编码','商品编码']},
    spec:{label:'规格 / 描述 / Specifications',aliases:['specification','specifications','spec','details','规格','规格型号','技术规格']},
    material:{label:'材质与表面 / Material & Finish',aliases:['material','material finish','material and finish','material & finish','材质','材料','表面处理','材质与表面']},
    sizeSpec:{label:'尺寸规格 / Size / Spec',aliases:['size spec','size / spec','size specification','dimension spec','尺寸规格','尺寸','规格尺寸']},
    hs:{label:'HS Code',aliases:['hs code','hscode','tariff code','customs code','海关编码','hs编码']},
    unit:{label:'单位 / Unit',aliases:['unit','uom','unit of measure','单位']},
    qty:{label:'数量 / Qty',aliases:['qty','quantity','order quantity','数量','订购数量']},
    moq:{label:'MOQ',aliases:['moq','minimum order quantity','起订量','最低起订量']},
    price:{label:'单价 / Unit Price',aliases:['unit price','price','unit cost','单价','价格','报价']},
    amount:{label:'金额 / Amount',aliases:['amount','line total','total amount','金额','小计']},
    cartonNo:{label:'箱号 / Carton No.',aliases:['carton no','carton number','ctn no','box no','箱号','箱序号']},
    packageDescription:{label:'包装说明 / Packing',aliases:['packing','inner packing','package description','packing description','包装说明','包装方式','内包装']},
    qtyPerCarton:{label:'每箱数量 / QTY/CTN',aliases:['qty ctn','qty/ctn','quantity per carton','pcs per carton','q ty ctn','每箱数量','装箱数']},
    netWeight:{label:'净重 / N.W.',aliases:['net weight','n w','nw','净重']},
    grossWeight:{label:'毛重 / G.W.',aliases:['gross weight','g w','gw','毛重']},
    cbm:{label:'CBM',aliases:['cbm','volume','体积','立方']},
    dimensions:{label:'单箱尺寸 / Dimensions',aliases:['dimensions','carton dimensions','carton size','package dimensions','单箱尺寸','外箱尺寸']},
    shippingMarks:{label:'唛头 / Shipping Marks',aliases:['shipping marks','marks','carton marks','唛头','运输唛头']}
  };

  const FIELD_ALIASES = [];
  Object.entries(FIELD_META).forEach(([id,meta]) => {
    const aliases = [meta.zh,meta.en,...(meta.aliases || [])];
    aliases.forEach(alias => FIELD_ALIASES.push({id,alias:norm(alias),compact:compact(alias),raw:alias}));
  });
  const PRODUCT_ALIASES = [];
  Object.entries(PRODUCT_META).forEach(([key,meta]) => {
    [meta.label,...meta.aliases].forEach(alias => PRODUCT_ALIASES.push({key,alias:norm(alias),compact:compact(alias),raw:alias}));
  });

  /* Common foreign-trade labels used by Spanish, French, German, Portuguese,
     Italian, Japanese, Korean, Russian and Arabic workbooks. These are
     deterministic aliases, not a claim that every arbitrary document is exact. */
  const MULTILINGUAL_FIELD_ALIASES = {
    invoiceNo:['número de documento','número de factura','nº de documento','numéro du document','numéro de facture','dokumentnummer','rechnungsnummer','número do documento','numero documento','書類番号','請求書番号','문서 번호','송장 번호','номер документа','номер счета','رقم المستند','رقم الفاتورة'],
    issueDate:['fecha de emisión','date d émission','date de facture','ausstellungsdatum','rechnungsdatum','data de emissão','data emissione','発行日','작성일','дата выдачи','дата счета','تاريخ الإصدار'],
    validUntil:['válido hasta','validez','valable jusqu au','gültig bis','validade','valido fino al','有効期限','유효 기간','действительно до','صالح حتى'],
    currency:['moneda','devise','währung','moeda','valuta','通貨','통화','валюта','العملة'],
    sellerName:['vendedor','proveedor','exportador','vendeur','fournisseur','exportateur','verkäufer','lieferant','fornecedor','venditore','販売者','供給者','판매자','공급자','продавец','поставщик','البائع','المورد'],
    buyerName:['comprador','cliente','importador','acheteur','client','importateur','käufer','kunde','comprador empresa','acquirente','購入者','顧客','구매자','고객','покупатель','клиент','المشتري','العميل'],
    buyerContact:['contacto del comprador','contact acheteur','ansprechpartner käufer','contato do comprador','contatto acquirente','購入者連絡先','구매자 담당자','контакт покупателя','جهة اتصال المشتري'],
    buyerEmail:['correo del comprador','email acheteur','e mail käufer','e mail do comprador','email acquirente','購入者メール','구매자 이메일','электронная почта покупателя','بريد المشتري'],
    paymentTerms:['condiciones de pago','termes de paiement','zahlungsbedingungen','condições de pagamento','termini di pagamento','支払条件','결제 조건','условия оплаты','شروط الدفع'],
    tradeTerms:['términos comerciales','incoterms','conditions commerciales','lieferbedingungen','termos comerciais','termini commerciali','貿易条件','무역 조건','торговые условия','شروط التجارة'],
    deliveryTime:['plazo de entrega','délai de livraison','lieferzeit','prazo de entrega','tempo di consegna','納期','배송 기간','срок поставки','مدة التسليم'],
    remarks:['observaciones','remarques','bemerkungen','observações','note','備考','비고','примечания','ملاحظات']
  };
  const MULTILINGUAL_PRODUCT_ALIASES = {
    name:['producto','nombre del producto','produit','nom du produit','produkt','produktname','produto','nome do produto','prodotto','nome prodotto','製品','商品名','제품','제품명','товар','наименование товара','المنتج','اسم المنتج'],
    sku:['modelo','referencia','modèle','référence','modell','artikelnummer','modelo produto','modello','品番','型番','모델','품번','модель','артикул','الموديل','رقم الصنف'],
    spec:['especificaciones','especificación','spécifications','spezifikationen','especificações','specifiche','仕様','規格','사양','характеристики','المواصفات'],
    qty:['cantidad','quantité','menge','quantidade','quantità','数量','수량','количество','الكمية'],
    unit:['unidad','unité','einheit','unidade','unità','単位','단위','единица','الوحدة'],
    price:['precio unitario','prix unitaire','einzelpreis','stückpreis','preço unitário','prezzo unitario','単価','단가','цена за единицу','سعر الوحدة'],
    amount:['importe','montant','betrag','valor total','importo','金額','금액','сумма','المبلغ'],
    moq:['pedido mínimo','quantité minimum','mindestbestellmenge','quantidade mínima','quantità minima','最小注文数量','최소 주문 수량','минимальный заказ','الحد الأدنى للطلب']
  };
  Object.entries(MULTILINGUAL_FIELD_ALIASES).forEach(([id,aliases])=>aliases.forEach(alias=>FIELD_ALIASES.push({id,alias:norm(alias),compact:compact(alias),raw:alias})));
  Object.entries(MULTILINGUAL_PRODUCT_ALIASES).forEach(([key,aliases])=>aliases.forEach(alias=>PRODUCT_ALIASES.push({key,alias:norm(alias),compact:compact(alias),raw:alias})));

  const DEFAULT_FIELD_IDS = new Set([
    'docLanguage','currency','originCountry','invoiceNo','issueDate','validUntil','customerPo','quoteNo','moq','salesperson',
    'sellerName','buyerName','sellerContact','buyerContact','sellerPhone','buyerPhone','sellerEmail','buyerEmail','sellerAddress','buyerAddress',
    'consigneeName','consigneeContact','consigneePhone','consigneeAddress','shipToAddress',
    'extraFeeAmount','taxAmount','discountValue','shippingMethod','packageCount','netWeight','grossWeight','cbm','trackingNo',
    'paymentTemplate','bankBeneficiary','bankName','bankAccount','bankSwift','paymentTerms','tradeTerms','deliveryTime','remarks'
  ]);

  let lastAnalysis = null;
  let undoSnapshot = null;
  let autoApplyTimer = 0;

  function scoreAlias(label, alias) {
    const a = norm(label), ac = compact(label);
    if (!a || !alias.alias) return 0;
    if (a === alias.alias || ac === alias.compact) return 1;
    const aliasLength=alias.alias.replace(/\s+/g,'').length;
    const meaningful=/[\u3400-\u9fff]/.test(alias.alias)?aliasLength>=2:aliasLength>=4;
    if (a.startsWith(alias.alias) || alias.alias.startsWith(a)) return meaningful ? .94 : 0;
    if (a.includes(alias.alias) || alias.alias.includes(a)) return meaningful ? .86 : 0;
    return 0;
  }

  function bestAlias(label, pool) {
    let best = null;
    pool.forEach(entry => {
      const score = scoreAlias(label,entry);
      const bestLength=best?.alias?.replace(/\s+/g,'').length||0;
      const currentLength=entry.alias.replace(/\s+/g,'').length;
      if (score > (best?.score || 0) || (score === (best?.score || 0) && currentLength > bestLength)) best = {...entry,score};
    });
    return best?.score >= .72 ? best : null;
  }

  const SECTION_HEADING_RE = /^(document information|seller(?: and| &| \/)? buyer|seller buyer|ship to|bill to|consignee information|notify party information|product details|quoted items|invoice details|logistics details|packing shipping|payment details|terms conditions|terms.*remarks|authorized signature|factory execution|单据信息|买卖双方|收货.*地址|通知方信息|商品明细|产品明细|物流信息|包装运输|收款账户|付款信息|条款.*备注|交易条款|授权签字|生产质量|información del documento|datos del documento|vendedor.*comprador|detalles del producto|productos cotizados|términos.*observaciones|firma autorizada|informations du document|vendeur.*acheteur|détails des produits|conditions.*remarques|signature autorisée|dokumentinformationen|verkäufer.*käufer|produktdetails|bedingungen.*bemerkungen|autorisierte unterschrift|informações do documento|vendedor.*comprador|detalhes do produto|termos.*observações|assinatura autorizada|informazioni documento|venditore.*acquirente|dettagli prodotto|termini.*note|firma autorizzata|書類情報|売主.*買主|商品明細|製品詳細|条件.*備考|承認署名|문서 정보|판매자.*구매자|상품 명세|제품 상세|조건.*비고|승인 서명|информация о документе|продавец.*покупатель|сведения о товаре|условия.*примечания|подпись|معلومات المستند|البائع.*المشتري|تفاصيل المنتج|الشروط.*الملاحظات|التوقيع)/i;
  const TERMINAL_SECTION_RE = /^(terms?|remarks?|payment|payment details|payment terms|trade terms|incoterms|lead time|delivery time|authorized signature|signature|subtotal|grand total|total|条款|备注|付款|贸易术语|交期|授权签字|小计|总计|términos|observaciones|pago|plazo de entrega|firma|conditions|remarques|paiement|délai de livraison|signature|bedingungen|bemerkungen|zahlung|lieferzeit|unterschrift|termos|observações|pagamento|prazo de entrega|assinatura|termini|note|pagamento|tempo di consegna|firma|条件|備考|支払|納期|署名|조건|비고|결제|배송 기간|서명|условия|примечания|оплата|срок поставки|подпись|الشروط|ملاحظات|الدفع|مدة التسليم|التوقيع)/i;

  function isSectionHeading(text) {
    return SECTION_HEADING_RE.test(norm(text));
  }

  function rowText(row){return norm((row||[]).filter(Boolean).join(' '));}
  function isTerminalSectionRow(row){
    const cells=(row||[]).map(clean).filter(Boolean);if(!cells.length)return false;
    if(cells.some(cell=>isSectionHeading(cell)))return true;
    const first=norm(cells[0]||'');
    if(TERMINAL_SECTION_RE.test(first))return true;
    return /authorized signature|editable excel intentionally keeps a blank signature|terms.*remarks|payment terms|trade terms|lead time|sample policy|授权签字|条款.*备注|付款条款|贸易术语|交期|样品政策/i.test(rowText(row));
  }

  function matrixFromSingleTable(table) {
    const grid = [];
    Array.from(table?.rows || []).forEach((tr,r) => {
      grid[r] ||= [];
      let c = 0;
      Array.from(tr.cells).forEach(cell => {
        while (grid[r][c] !== undefined) c++;
        const value = clean(cell.innerText || cell.textContent || '');
        const rs = Math.max(1,Number(cell.rowSpan || 1));
        const cs = Math.max(1,Number(cell.colSpan || 1));
        for (let rr=0;rr<rs;rr++) {
          grid[r+rr] ||= [];
          for (let cc=0;cc<cs;cc++) grid[r+rr][c+cc] = rr === 0 && cc === 0 ? value : '';
        }
        c += cs;
      });
    });
    return trimMatrix(grid);
  }

  function matrixFromHtml(htmlText) {
    if (!htmlText || !/<table[\s>]/i.test(htmlText)) return [];
    const doc = new DOMParser().parseFromString(htmlText,'text/html');
    const candidates = Array.from(doc.querySelectorAll('table')).map(matrixFromSingleTable).filter(matrix => matrix.length);
    if (!candidates.length) return [];
    const score = matrix => {
      const nonEmpty = matrix.flat().filter(Boolean).length;
      const aliases = matrix.flat().reduce((sum,cell)=>sum + (bestAlias(cell,FIELD_ALIASES)?2:0) + (bestAlias(cell,PRODUCT_ALIASES)?2:0),0);
      return nonEmpty + aliases + matrix.length * Math.max(1,matrix[0]?.length || 1) * .05;
    };
    return candidates.sort((a,b)=>score(b)-score(a))[0];
  }

  function parseDelimitedText(text, delimiter='\t') {
    const rows=[];let row=[],cell='',quoted=false;
    const source=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<source.length;i++){
      const ch=source[i],next=source[i+1];
      if(ch==='"'){
        if(quoted&&next==='"'){cell+='"';i++;}
        else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){row.push(clean(cell));cell='';}
      else if(ch==='\n'&&!quoted){row.push(clean(cell));rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    if(cell||row.length){row.push(clean(cell));rows.push(row);}
    return rows;
  }

  function matrixFromText(text) {
    const source=String(text||'');
    if(source.includes('\t')) return trimMatrix(parseDelimitedText(source,'\t'));
    const lines=source.replace(/\r/g,'').split('\n');
    const matrix=lines.map(line=>{
      const colon=line.match(/^\s*([^:：]{1,80})\s*[:：]\s*(.+)$/);
      if(colon)return[clean(colon[1]),clean(colon[2])];
      return[clean(line)];
    });
    return trimMatrix(matrix);
  }

  function trimMatrix(matrix) {
    const rows = (matrix || []).map(row => (row || []).map(clean));
    while (rows.length && rows[rows.length-1].every(cell => !cell)) rows.pop();
    let max = rows.reduce((m,row)=>Math.max(m,row.length),0);
    while (max > 0 && rows.every(row => !clean(row[max-1] || ''))) max--;
    return rows.map(row => Array.from({length:max},(_,i)=>clean(row[i] || '')));
  }

  function detectDocumentType(text) {
    const t = norm(text);
    if (/packing list|装箱单|lista de empaque|liste de colisage|packliste|lista de embalagem|lista imballaggio|梱包明細書|포장 명세서|упаковочный лист|قائمة التعبئة/.test(t)) return 'packing_list';
    if (/commercial invoice|商业发票|factura comercial|facture commerciale|handelsrechnung|fatura comercial|fattura commerciale|商業送り状|상업 송장|коммерческий счет|فاتورة تجارية/.test(t)) return 'commercial_invoice';
    if (/proforma invoice|pro forma invoice|形式发票|\bpi\b|factura proforma|facture pro forma|proformarechnung|fatura proforma|fattura proforma|プロフォーマインボイス|견적 송장|счет проформа|فاتورة مبدئية/.test(t)) return 'proforma_invoice';
    if (/sales contract|purchase contract|销售合同|购销合同|contrato de venta|contrat de vente|kaufvertrag|contrato de venda|contratto di vendita|売買契約|판매 계약|договор купли продажи|عقد بيع/.test(t)) return 'sales_contract';
    if (/quotation|quote sheet|报价单|报价表|cotización|presupuesto|devis|angebot|orçamento|preventivo|見積書|견적서|коммерческое предложение|عرض سعر/.test(t)) return 'quotation';
    return '';
  }

  function looksLikeValue(value) {
    const t = clean(value);
    if (!t || isSectionHeading(t)) return false;
    return !bestAlias(t,FIELD_ALIASES) && !bestAlias(t,PRODUCT_ALIASES);
  }

  function normalizeDate(value) {
    const raw = clean(value);
    if (!raw) return '';
    const direct = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (direct) return `${direct[1]}-${String(direct[2]).padStart(2,'0')}-${String(direct[3]).padStart(2,'0')}`;
    const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      let a=Number(dmy[1]),b=Number(dmy[2]);
      const day = a > 12 ? a : b > 12 ? b : a;
      const month = a > 12 ? b : b > 12 ? a : b;
      return `${dmy[3]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10);
    return raw;
  }

  function normalizeFieldValue(id,value) {
    const text = clean(value);
    if (['issueDate','validUntil','etd','eta','estimatedShipment'].includes(id)) return normalizeDate(text);
    if (['extraFeeAmount','taxAmount','discountValue','packageCount','netWeight','grossWeight','cbm'].includes(id)) return numberText(text);
    if (id === 'currency') {
      const m = text.match(/\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED)\b/i);
      if (m) return m[1].toUpperCase() === 'RMB' ? 'CNY' : m[1].toUpperCase();
      if (/\$/.test(text)) return 'USD'; if (/€/.test(text)) return 'EUR'; if (/£/.test(text)) return 'GBP'; if (/¥|￥/.test(text)) return 'CNY';
    }
    return text;
  }

  function addField(result,id,value,source,score=.8) {
    const v = normalizeFieldValue(id,value);
    if (!id || !clean(v)) return;
    const existing = result.fields.find(item=>item.id===id);
    if (!existing || score > existing.score) {
      if (existing) Object.assign(existing,{value:v,source,score});
      else result.fields.push({id,value:v,source,score});
    }
  }

  function partyRoles(matrix){
    const roles=new Map();
    matrix.forEach(row=>row.forEach((cell,c)=>{
      const t=norm(cell);
      if(/^(to|buyer|customer|importer|买方|客户|收件人)$/.test(t))roles.set(c,'buyer');
      if(/^(from|seller|supplier|exporter|卖方|供应商|发件人)$/.test(t))roles.set(c,'seller');
    }));
    return roles;
  }

  function contextualField(label,column,roles){
    const t=norm(label),role=roles.get(column);
    if(/(?:^| )quotation no(?: |$)|(?:^| )quote no(?: |$)|报价编号|报价单号/.test(t))return{id:'quoteNo',score:1};
    if(t==='to')return{id:'buyerName',score:1};
    if(t==='from')return{id:'sellerName',score:1};
    if(/^(attn|attention|contact|contact person|联系人)$/.test(t)&&role)return{id:`${role}Contact`,score:.99};
    if(/^(email|e mail|邮箱)$/.test(t)&&role)return{id:`${role}Email`,score:.99};
    if(/^(phone|telephone|tel|mobile|电话|手机)$/.test(t)&&role)return{id:`${role}Phone`,score:.99};
    if(/^(address|company address|地址)$/.test(t)&&role)return{id:`${role}Address`,score:.99};
    return bestAlias(label,FIELD_ALIASES);
  }

  function strongLabelCell(text,match) {
    if(!match)return false;
    return match.score>=.99 || (match.score>=.9 && /[\/:：]/.test(clean(text)));
  }

  function nextMeaningfulValue(row,startColumn,roles,{maxLookahead=10}={}) {
    const limit=Math.min(row.length,startColumn+maxLookahead+1);
    for(let c=startColumn+1;c<limit;c++){
      const value=clean(row[c]);
      if(!value)continue;
      if(isSectionHeading(value))return null;
      const fieldLabel=contextualField(value,c,roles);
      const productLabel=bestAlias(value,PRODUCT_ALIASES);
      const hasLabelPunctuation=/[\/:：]/.test(value);
      const strongFieldLabel=fieldLabel&&(fieldLabel.score>=.99||(fieldLabel.score>=.9&&hasLabelPunctuation));
      const strongProductLabel=productLabel&&(productLabel.score>=.99||(productLabel.score>=.9&&hasLabelPunctuation));
      if(strongFieldLabel||strongProductLabel)return null;
      return {column:c,value};
    }
    return null;
  }

  function analyzeExportSummaryLines(matrix,result) {
    matrix.slice(0,8).forEach((row,r)=>{
      const values=row.map(clean).filter(Boolean);
      if(!values.length)return;
      const joined=values.join(' | ');
      const currency=(joined.match(/\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED)\b/i)||[])[1];
      if(currency)addField(result,'currency',currency.toUpperCase()==='RMB'?'CNY':currency.toUpperCase(),`R${r+1}`,.95);
      const noMatch=joined.match(/\b((?:QT|QUO|PI|INV|PL|SC)[-_]?(?=[A-Z0-9._/-]*\d)[A-Z0-9][A-Z0-9._/-]{3,})\b/i);
      if(noMatch){
        const id=result.documentType==='quotation'?'quoteNo':'invoiceNo';
        addField(result,id,noMatch[1],`R${r+1}`,.9);
        if(id==='quoteNo')addField(result,'invoiceNo',noMatch[1],`R${r+1}`,.88);
      }
      if(values.length>=2&&!values.some(value=>bestAlias(value,FIELD_ALIASES)||bestAlias(value,PRODUCT_ALIASES)||isSectionHeading(value))){
        const sellerCandidate=values.find(value=>value.length>=3&&!/^(quotation|proforma invoice|commercial invoice|packing list|sales contract|报价单|形式发票|商业发票|装箱单|销售合同)$/i.test(norm(value))&&!/\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED)\b/i.test(value)&&value!==noMatch?.[1]);
        if(sellerCandidate&&/company|co\.?\s*ltd|ltd|department|dept|公司|外贸部/i.test(sellerCandidate))addField(result,'sellerName',sellerCandidate,`R${r+1}`,.78);
      }
    });
  }

  function appendField(result,id,value,source){
    const text=clean(value);if(!text)return;
    const existing=result.fields.find(item=>item.id===id);
    if(existing){if(!norm(existing.value).includes(norm(text)))existing.value=`${existing.value}\n${text}`;}
    else addField(result,id,text,source,.83);
  }

  function analyzeInlineTerms(matrix,result){
    matrix.forEach((row,r)=>row.forEach((cell,c)=>{
      const match=clean(cell).match(/^\s*(?:\d+[.)、]\s*)?([^:：]{2,80})\s*[:：]\s*(.+)$/);
      if(!match)return;
      const label=norm(match[1]),value=clean(match[2]);
      if(/^(trade term|trade terms|incoterms|贸易术语|成交方式)$/.test(label))addField(result,'tradeTerms',value,`R${r+1}C${c+1}`,.99);
      else if(/^(payment term|payment terms|terms of payment|付款条款|付款方式)$/.test(label))addField(result,'paymentTerms',value,`R${r+1}C${c+1}`,.99);
      else if(/^(lead time|delivery time|交期|生产周期)$/.test(label))addField(result,'deliveryTime',value,`R${r+1}C${c+1}`,.99);
      else if(/^(sample policy|sample terms|样品政策|样品条款)$/.test(label))appendField(result,'remarks',`Sample Policy: ${value}`,`R${r+1}C${c+1}`);
      else if(/^(validity|price validity|报价有效说明)$/.test(label)&&!/^(\d{4})[-/.]/.test(value))appendField(result,'remarks',`Validity: ${value}`,`R${r+1}C${c+1}`);
    }));
  }

  function productTableRows(matrix){
    let start=-1,best=0;
    matrix.forEach((row,r)=>{const matches=productHeaderMatches(row),keys=new Set(matches.map(x=>x.match.key));const score=keys.size;if(score>=3&&(keys.has('name')||keys.has('sku')||keys.has('spec'))&&score>best){best=score;start=r;}});
    const rows=new Set();if(start<0)return rows;rows.add(start);let blankRun=0;
    const colMap=new Map();productHeaderMatches(matrix[start]||[]).forEach(({c,match})=>{if(!colMap.has(match.key))colMap.set(match.key,c);});
    for(let r=start+1;r<matrix.length;r++){
      const row=matrix[r]||[];
      if(row.every(cell=>!clean(cell))){blankRun++;rows.add(r);if(blankRun>=2)break;continue;}
      blankRun=0;if(isTerminalSectionRow(row)||isTotalRow(row))break;
      const item={};colMap.forEach((c,key)=>item[key]=clean(row[c]||''));
      if(productRowEvidence(item,row).valid)rows.add(r);else if(row.some(Boolean))break;
    }
    return rows;
  }

  function analyzeMetadata(matrix,result) {
    const roles=partyRoles(matrix),productRows=productTableRows(matrix);
    matrix.forEach((row,r)=>{
      if(productRows.has(r))return;
      for(let c=0;c<row.length;c++){
        const match=contextualField(row[c],c,roles);
        if(!strongLabelCell(row[c],match))continue;
        const next=nextMeaningfulValue(row,c,roles);
        if(!next)continue;
        addField(result,match.id,next.value,`R${r+1}C${next.column+1}`,match.score);
        c=next.column;
      }
      if(row.length===1){
        const colon=row[0].match(/^\s*([^:：]{1,80})\s*[:：]\s*(.+)$/);
        if(colon){const match=contextualField(colon[1],0,roles);if(match)addField(result,match.id,colon[2],`R${r+1}`,match.score);}
      }
    });
    for(let r=0;r<matrix.length-1;r++){
      if(productRows.has(r)||productRows.has(r+1))continue;
      const matches=matrix[r].map((cell,c)=>({c,match:contextualField(cell,c,roles)})).filter(x=>x.match);
      if(matches.length<2)continue;
      const next=matrix[r+1]||[];let count=0;
      matches.forEach(({c,match})=>{
        const value=next[c];
        if(clean(value)&&!isSectionHeading(value)&&!contextualField(value,c,roles)&&!bestAlias(value,PRODUCT_ALIASES)){
          addField(result,match.id,value,`R${r+2}C${c+1}`,match.score);count++;
        }
      });
      if(count>=2)result.layouts.add('横向字段表 / Horizontal fields');
    }
    const verticalPairs=matrix.filter(row=>contextualField(row[0],0,roles)&&looksLikeValue(row[1])).length;
    if(verticalPairs>=2)result.layouts.add('纵向键值表 / Vertical key-value');
    analyzeInlineTerms(matrix,result);
  }

  function productHeaderMatches(row) {
    return row.map((cell,c)=>{
      const t=norm(cell);let match=null;
      const exact=(key,score=1)=>({key,alias:t,compact:compact(t),raw:cell,score});
      if(/^(image|photo|图片|产品图)$/.test(t))match=null;
      else if(/unit price|price per unit|单价|报价/.test(t))match=exact('price');
      else if(/qty\s*[/\-]?\s*ctn|quantity per carton|pcs per carton|每箱数量|装箱数/.test(t))match=exact('qtyPerCarton');
      else if(/carton size|package dimensions|carton dimensions|外箱尺寸|单箱尺寸/.test(t))match=exact('dimensions');
      else if(/material.*finish|材质.*表面|材料.*表面/.test(t))match=exact('material');
      else if(/size.*spec|dimension.*spec|尺寸规格|规格尺寸/.test(t))match=exact('sizeSpec');
      else if(/^(description|product description|goods description|品名|产品名称|商品名称)$/.test(t))match=exact('name');
      else if(/item no|item number|product code|sku|model no|货号|型号/.test(t))match=exact('sku');
      else if(/minimum order|\bmoq\b|起订量/.test(t))match=exact('moq');
      else if(/gross weight|^g w(?:\b| )|毛重/.test(t))match=exact('grossWeight');
      else if(/net weight|^n w(?:\b| )|净重/.test(t))match=exact('netWeight');
      else if(/\bcbm\b|volume|体积/.test(t))match=exact('cbm');
      else if(/inner packing|packing|包装/.test(t))match=exact('packageDescription');
      else if(/^qty$|quantity|order quantity|数量/.test(t))match=exact('qty');
      else if(/^unit$|uom|unit of measure|单位/.test(t))match=exact('unit');
      else match=bestAlias(cell,PRODUCT_ALIASES);
      return {c,match};
    }).filter(x=>x.match);
  }

  function isTotalRow(row) {
    const t = norm((row || []).slice(0,4).join(' '));
    return /^(subtotal|total|grand total|sum|合计|小计|总计|总金额|总数量|subtotal parcial|total general|sous total|total général|zwischensumme|gesamtsumme|subtotal|totale|小計|合計|소계|합계|итого|промежуточный итог|المجموع الفرعي|الإجمالي)/i.test(t);
  }

  function looksLikeTermsText(value){
    const t=norm(value);if(!t)return false;
    return /^(payment terms?|trade terms?|incoterms|lead time|delivery time|sample policy|remarks?|validity|authorized signature|terms?|付款条款|贸易术语|交期|样品政策|备注|有效期|授权签字|condiciones de pago|términos comerciales|plazo de entrega|observaciones|termes de paiement|conditions commerciales|délai de livraison|remarques|zahlungsbedingungen|lieferbedingungen|lieferzeit|bemerkungen|condições de pagamento|termos comerciais|prazo de entrega|observações|termini di pagamento|termini commerciali|tempo di consegna|note|支払条件|貿易条件|納期|備考|결제 조건|무역 조건|배송 기간|비고|условия оплаты|торговые условия|срок поставки|примечания|شروط الدفع|شروط التجارة|مدة التسليم|ملاحظات)/i.test(t)
      || /\b(t\/t|deposit|balance|before shipment|days after|courier freight|valid for \d+ days|fob|cif|exw|ddp|dap)\b/i.test(t) && t.length>28;
  }

  function productRowEvidence(item,row){
    const identity=clean(item.name||item.sku||item.spec);
    const numeric=['qty','moq','price','amount','qtyPerCarton','netWeight','grossWeight','cbm'].some(key=>clean(item[key])!==''&&!Number.isNaN(Number(numberText(item[key]))));
    const packaging=clean(item.packageDescription||item.dimensions||item.cartonNo);
    const termCells=(row||[]).filter(cell=>looksLikeTermsText(cell)).length;
    return {identity,numeric,packaging,termCells,valid:Boolean(identity&&(numeric||packaging||clean(item.sku))&&!looksLikeTermsText(identity)&&termCells<2)};
  }

  function normalizeProductItem(item,headerCells){
    const spec=[item.spec,item.material,item.sizeSpec].map(clean).filter(Boolean);
    item.spec=[...new Set(spec)].join(' | ');
    if(item.qtyPerCarton){
      const extra=`QTY/CTN: ${clean(item.qtyPerCarton)}`;
      item.packageDescription=[clean(item.packageDescription),extra].filter(Boolean).join(' | ');
    }
    if(!item.unit&&headerCells.some(value=>/moq[\s\S]*(pcs|pieces)|qty[\s\S]*(pcs|pieces)/i.test(value)))item.unit='PCS';
    delete item.material;delete item.sizeSpec;delete item.qtyPerCarton;
    return item;
  }

  function parseHorizontalProducts(matrix,result) {
    let best=null;
    matrix.forEach((row,r)=>{
      const matches=productHeaderMatches(row);const keys=new Set(matches.map(x=>x.match.key));
      const core=keys.has('name')||keys.has('sku')||keys.has('spec');
      const commercial=keys.has('qty')||keys.has('unit')||keys.has('price')||keys.has('moq')||keys.has('cartonNo')||keys.has('qtyPerCarton');
      const score=keys.size+(core?2:0)+(commercial?1:0);
      if(core&&commercial&&score>(best?.score||0))best={r,matches,score,row};
    });
    if(!best)return;
    const colMap=new Map();best.matches.forEach(({c,match})=>{if(!colMap.has(match.key))colMap.set(match.key,c);});
    const headerText=best.row.join(' ');
    const currencyMatch=headerText.match(/(?:unit price|price|单价|precio unitario|prix unitaire|einzelpreis|preço unitário|prezzo unitario|単価|단가|цена за единицу|سعر الوحدة)[\s\S]*?\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED)\b/i);
    if(currencyMatch)addField(result,'currency',currencyMatch[1].toUpperCase()==='RMB'?'CNY':currencyMatch[1].toUpperCase(),`R${best.r+1}`,.96);
    const products=[];let blankRun=0,stoppedByBoundary=false,rejectedRows=0;
    for(let r=best.r+1;r<matrix.length;r++){
      const row=matrix[r]||[];
      if(row.every(cell=>!cell)){blankRun++;if(blankRun>=2)break;continue;}blankRun=0;
      if(isTerminalSectionRow(row)||isTotalRow(row)){stoppedByBoundary=true;break;}
      const item={};colMap.forEach((c,key)=>item[key]=clean(row[c]||''));normalizeProductItem(item,best.row);
      const evidence=productRowEvidence(item,row);
      if(!evidence.identity)continue;
      if(!evidence.valid){rejectedRows++;if(evidence.termCells||looksLikeTermsText(evidence.identity)){stoppedByBoundary=true;break;}continue;}
      products.push(item);
    }
    if(products.length){result.products=products;result.productOrientation='横向商品表 / Products in rows';result.layouts.add(result.productOrientation);result.productHeaders=[...colMap.keys()];result.productBoundaryDetected=stoppedByBoundary;result.productRejectedRows=rejectedRows;result.productHeaderScore=best.score;}
  }

  function parseTransposedProducts(matrix,result) {
    const rows=[];
    matrix.forEach((row,r)=>{
      const match=bestAlias(row[0],PRODUCT_ALIASES);
      if(match&&row.slice(1).some(Boolean))rows.push({r,key:match.key,row});
    });
    const unique=new Set(rows.map(x=>x.key));
    if(rows.length<2||!(unique.has('name')||unique.has('sku')||unique.has('spec'))||!(unique.has('qty')||unique.has('price')||unique.has('unit')||unique.has('cartonNo')))return;
    const maxCols=Math.max(...rows.map(x=>x.row.length));
    const products=[];
    for(let c=1;c<maxCols;c++){
      const item={};rows.forEach(x=>item[x.key]=clean(x.row[c]||''));
      if(clean(item.name||item.sku||item.spec))products.push(item);
    }
    if(products.length>result.products.length){result.products=products;result.productOrientation='纵向转置商品表 / Products in columns';result.layouts.add(result.productOrientation);result.productHeaders=[...unique];}
  }

  function analyzeSheet(matrix) {
    const result={matrix,fields:[],products:[],layouts:new Set(),documentType:'',productOrientation:'',productHeaders:[],warnings:[],confidence:0};
    const fullText=matrix.flat().join(' ');
    result.documentType=detectDocumentType(fullText);
    analyzeExportSummaryLines(matrix,result);
    analyzeMetadata(matrix,result);
    parseHorizontalProducts(matrix,result);
    parseTransposedProducts(matrix,result);
    if(result.documentType==='quotation'){const q=result.fields.find(item=>item.id==='quoteNo');if(q&&!result.fields.some(item=>item.id==='invoiceNo'))addField(result,'invoiceNo',q.value,q.source,.995);}
    const fieldScore=Math.min(.42,result.fields.length*.032);
    const productScore=result.products.length?Math.min(.36,.18+Math.min(.18,result.products.length*.035)):0;
    const structureScore=(result.documentType?.length?0.08:0)+Math.min(.12,result.layouts.size*.055)+(result.productBoundaryDetected?0.05:0)+Math.min(.12,(result.productHeaderScore||0)*.02);
    let score=Math.min(1,fieldScore+productScore+structureScore);
    result.blockAutoApply=false;
    if(result.productRejectedRows>=2){score-=.18;result.warnings.push('商品区域附近存在多行无法确认的内容，已停止继续识别，建议先核对商品数量。');}
    if(result.products.length&&result.productHeaderScore<5){score-=.1;result.warnings.push('商品表头匹配度较低，请核对商品列映射。');}
    if(result.products.some(item=>looksLikeTermsText(item.name||item.spec))){score-=.35;result.blockAutoApply=true;result.warnings.push('检测到条款内容可能被混入商品区域，已禁止自动覆盖。');}
    result.confidence=Math.max(0,Math.round(score*100));
    if(result.confidence<75&&result.products.length){result.blockAutoApply=true;result.warnings.push('当前识别置信度不足 75%，不会自动覆盖，请先核对候选字段。');}
    if(!result.fields.length&&!result.products.length)result.warnings.push('没有识别到可填充字段。请确认复制区域包含字段名称和内容。');
    if(result.products.length&&!result.productHeaders.includes('qty')&&result.productHeaders.includes('moq'))result.warnings.push('原表只有 MOQ，没有订单数量；已保留 MOQ，实际订购数量请在编辑器中确认。');
    else if(result.products.length&&!result.productHeaders.includes('qty'))result.warnings.push('商品表未识别到数量列，请导入后检查数量。');
    result.confidence=Math.min(result.confidence,result.warnings.length?94:98);
    result.advancedCount=result.fields.filter(item=>!DEFAULT_FIELD_IDS.has(item.id)).length;
    return result;
  }

  function currentRows(){return qsa('#itemList .item-row');}
  const ITEM_SELECTORS={sku:'.i-sku',name:'.i-name',spec:'.i-spec',hs:'.i-hs',unit:'.i-unit',qty:'.i-qty',moq:'.i-moq',price:'.i-price',cartonNo:'.i-carton-no',packageDescription:'.i-package-desc',netWeight:'.i-net-weight',grossWeight:'.i-gross-weight',cbm:'.i-cbm',dimensions:'.i-dimensions',shippingMarks:'.i-item-marks'};

  function dispatch(control){if(!control)return;control.dispatchEvent(new Event(control.tagName==='SELECT'||control.type==='checkbox'?'change':'input',{bubbles:true}));}
  function isEmptyControl(control){return !control?true:control.type==='checkbox'?!control.checked:!clean(control.value);}

  function selectSmart(control,value){
    const target=norm(value);let best=null;
    Array.from(control.options||[]).forEach(option=>{
      const score=Math.max(scoreAlias(target,{alias:norm(option.value),compact:compact(option.value)}),scoreAlias(target,{alias:norm(option.textContent),compact:compact(option.textContent)}));
      if(score>(best?.score||0))best={option,score};
    });
    if(best?.score>=.72)control.value=best.option.value;else control.value=value;
  }

  function setControl(control,value,{overwrite=false}={}){
    if(!control||(!overwrite&&!isEmptyControl(control)))return false;
    const normalized=normalizeFieldValue(control.id,value);
    if(control.tagName==='SELECT')selectSmart(control,normalized);
    else if(control.type==='checkbox')control.checked=on(normalized);
    else control.value=control.type==='number'?numberText(normalized):normalized;
    dispatch(control);return true;
  }

  function ensureToggleForField(id){
    const map={hs:'showHsCode',moq:'showMoq',cartonNo:'showLogistics',packageDescription:'showLogistics',netWeight:'showLogistics',grossWeight:'showLogistics',cbm:'showLogistics',dimensions:'showLogistics',shippingMarks:'showLogistics'};
    const toggle=$(map[id]);if(toggle&&!toggle.checked){toggle.checked=true;dispatch(toggle);}
  }

  function addRows(count){const b=$('addItemBtn');for(let i=0;i<count;i++)b?.click();}
  function clearProductRows(){
    const rows=currentRows();rows.slice(1).reverse().forEach(row=>row.querySelector('.remove-item')?.click());
    const first=currentRows()[0];if(first)Object.values(ITEM_SELECTORS).forEach(sel=>{const input=first.querySelector(sel);if(input){input.value='';dispatch(input);}});
  }

  function clearItemRowForImport(row){
    if(!row)return;
    Object.values(ITEM_SELECTORS).forEach(selector=>{
      const control=row.querySelector(selector);
      if(control)control.value='';
    });
    row.dataset.image='';
  }

  function setItemControl(row,key,value,overwrite){
    if(key==='amount'||!clean(value))return false;
    if(key==='sku'){
      const sku=row.querySelector('.i-sku');if(!sku)return false;
      if(!overwrite&&!isEmptyControl(sku))return false;
      sku.value=clean(value);dispatch(sku);return true;
    }
    const selector=ITEM_SELECTORS[key],control=selector?row.querySelector(selector):null;
    if(!control)return false;
    ensureToggleForField(key);
    if(!overwrite&&!isEmptyControl(control))return false;
    if(control.tagName==='SELECT')selectSmart(control,value);else control.value=['qty','price','moq','netWeight','grossWeight','cbm'].includes(key)?numberText(value):clean(value);
    dispatch(control);return true;
  }

  function captureSnapshot(){
    const fields={};Object.keys(FIELD_META).forEach(id=>{const c=$(id);if(c)fields[id]={value:c.value,checked:c.checked,type:c.type};});
    const products=currentRows().map(row=>{const item={};Object.entries(ITEM_SELECTORS).forEach(([key,sel])=>item[key]=row.querySelector(sel)?.value||'');return item;});
    return {documentType:$('documentType')?.value,docMode:$('docMode')?.value,fields,products};
  }

  function applySnapshot(snapshot){
    if(!snapshot)return;
    if(snapshot.documentType&&snapshot.documentType!==$('documentType')?.value)window.FlypigBOXApp?.applyDocumentProfile?.(snapshot.documentType,{silent:true});
    Object.entries(snapshot.fields||{}).forEach(([id,data])=>{const c=$(id);if(!c)return;if(c.type==='checkbox')c.checked=data.checked;else c.value=data.value;dispatch(c);});
    clearProductRows();if((snapshot.products||[]).length>1)addRows(snapshot.products.length-1);
    currentRows().forEach((row,i)=>Object.entries(snapshot.products[i]||{}).forEach(([key,value])=>setItemControl(row,key,value,true)));
    window.FlypigBOXTableEditor?.refresh?.();
  }

  function clearImportableFields(){
    Object.keys(FIELD_META).forEach(id=>{
      if(id==='docLanguage')return;
      const control=$(id);if(!control)return;
      if(control.type==='checkbox')control.checked=false;
      else control.value='';
      dispatch(control);
    });
  }

  function applyAnalysis(result,{mode='safe'}={}){
    if(!result)return {fields:0,products:0};
    undoSnapshot=captureSnapshot();
    const replaceAll=mode==='replace-all';const overwrite=mode==='replace'||replaceAll;
    if(result.documentType&&result.documentType!==$('documentType')?.value)window.FlypigBOXApp?.applyDocumentProfile?.(result.documentType,{silent:false});
    if(replaceAll){clearImportableFields();clearProductRows();}
    let fieldCount=0;
    if(mode!=='products')result.fields.forEach(item=>{if(setControl($(item.id),item.value,{overwrite}))fieldCount++;});
    let productCount=0;
    if(result.products.length){
      const rowsBefore=currentRows();
      const firstEmpty=rowsBefore.length===1&&!clean(rowsBefore[0].querySelector('.i-sku')?.value)&&!clean(rowsBefore[0].querySelector('.i-name')?.value)&&!clean(rowsBefore[0].querySelector('.i-spec')?.value);
      if(overwrite&&!replaceAll)clearProductRows();
      let start=overwrite||replaceAll||firstEmpty?0:currentRows().length;
      const needed=start+result.products.length-currentRows().length;if(needed>0)addRows(needed);
      result.products.forEach((item,index)=>{
        const row=currentRows()[start+index];if(!row)return;
        if(overwrite||replaceAll||firstEmpty)clearItemRowForImport(row);
        Object.entries(item).forEach(([key,value])=>{if(setItemControl(row,key,value,overwrite||firstEmpty))productCount++;});
      });
    }
    window.setTimeout(()=>window.FlypigBOXTableEditor?.refresh?.(),100);
    return {fields:fieldCount,products:result.products.length,productCells:productCount,replaced:replaceAll};
  }

  function analysisHTML(result){
    if(!result)return '<div class="fp-smart-empty">粘贴原表格后，系统会在这里显示识别结果。</div>';
    const fieldPreview=result.fields.slice(0,12).map(item=>`<span>${esc(FIELD_META[item.id]?.zh||item.id)} → <b>${esc(String(item.value).slice(0,42))}</b></span>`).join('');
    const products=result.products.slice(0,3).map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name||p.sku||p.spec||'—')}</td><td>${esc(p.qty||'—')}</td><td>${esc(p.price||'—')}</td></tr>`).join('');
    return `<div class="fp-smart-score"><b>${result.confidence}%</b><span>识别置信度 / Confidence</span></div>
      <div class="fp-smart-facts"><span>版式：${esc([...result.layouts].join(' + ')||'未判断')}</span><span>识别字段：${result.fields.length}</span><span>精细字段：${result.advancedCount||0}</span><span>商品：${result.products.length}</span>${result.blockAutoApply?'<span>状态：需核对</span>':'<span>状态：可填充</span>'}${result.documentType?`<span>单据：${esc(result.documentType)}</span>`:''}</div>
      ${fieldPreview?`<div class="fp-smart-field-preview">${fieldPreview}</div>`:''}
      ${products?`<div class="fp-smart-product-preview"><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th></tr></thead><tbody>${products}</tbody></table></div>`:''}
      ${result.warnings.map(w=>`<div class="fp-smart-warning">${esc(w)}</div>`).join('')}`;
  }

  function renderAnalysis(result){
    lastAnalysis=result;
    const box=$('fpSmartImportResult');if(box)box.innerHTML=analysisHTML(result);
    const apply=$('fpSmartApplyBtn');if(apply){apply.disabled=!(result&&(result.fields.length||result.products.length))||Boolean(result?.blockAutoApply);apply.title=result?.blockAutoApply?'识别存在冲突，请先核对或改用仅补充空白。':'';}
    const detailed=$('fpSmartDetailedBtn');if(detailed)detailed.hidden=!(result&&result.advancedCount>0);
  }

  function parseFromInput({htmlText=''}={}){
    const text=$('fpSmartPasteText')?.value||'';
    const matrix=matrixFromHtml(htmlText).length?matrixFromHtml(htmlText):matrixFromText(text);
    const result=analyzeSheet(matrix);renderAnalysis(result);return result;
  }

  function applyCurrent({auto=false}={}){
    if(!lastAnalysis)return;
    if(lastAnalysis.blockAutoApply){$('fpSmartImportStatus').textContent='识别结果存在冲突，已阻止自动覆盖。请调整复制范围或核对后改用仅补充空白。';window.FlypigBOXApp?.setStatus?.('智能识别存在冲突，未执行自动覆盖。','error');return;}
    const mode=$('fpSmartFillMode')?.value||'safe';
    const outcome=applyAnalysis(lastAnalysis,{mode});
    const undo=$('fpSmartUndoBtn');if(undo)undo.disabled=false;
    const status=$('fpSmartImportStatus');if(status)status.textContent=`已填充 ${outcome.fields} 个单据字段、${outcome.products} 个商品。${mode==='safe'?'原有非空内容未覆盖。':mode==='replace-all'?'当前单据已按导入内容重新生成。':''}`;
    window.FlypigBOXApp?.setStatus?.(`智能识别完成：已填充 ${outcome.fields} 个字段、${outcome.products} 个商品。`,'ok');
    if(auto)$('fpSmartImportPanel')?.classList.add('fp-smart-applied');
  }

  function createImporter(){
    const mount=$('fpSmartSheetImportMount');if(!mount||$('fpSmartImportPanel'))return;
    mount.innerHTML=`<details id="fpSmartImportPanel" class="fp-smart-import">
      <summary><span>✨ 智能粘贴原单据 / Smart Sheet Import</span><small>自动识别常见多语言表头、横向、纵向和转置商品表</small></summary>
      <div class="fp-smart-import-body">
        <div class="fp-smart-import-copy"><b>整表复制，少填表。</b><span>在 Excel、WPS、Google Sheets 或旧单据中复制全部区域，直接粘贴到下方。系统会识别中英文及常见外贸语言表头、横向字段、纵向字段、商品在行或商品在列，并填入对应位置。低置信内容会要求核对。</span></div>
        <textarea id="fpSmartPasteText" placeholder="把原报价单、PI、商业发票、装箱单或合同表格复制后粘贴到这里…\nPaste the full source sheet here. Horizontal and vertical layouts are both supported."></textarea>
        <div class="fp-smart-import-toolbar">
          <label>填充方式 / Fill Mode<select id="fpSmartFillMode"><option value="replace-all">覆盖当前单据 / Replace current document</option><option value="safe">仅补充空白 / Fill blanks only</option><option value="products">仅导入商品 / Products only</option></select></label>
          <label class="fp-smart-auto"><input id="fpSmartAutoApply" type="checkbox">粘贴后自动填充</label>
          <button id="fpSmartClipboardBtn" class="fp-table-editor-action" type="button">读取剪贴板</button>
          <button id="fpSmartAnalyzeBtn" class="fp-table-editor-action" type="button">识别预览</button>
          <button id="fpSmartApplyBtn" class="fp-table-editor-action primary" type="button" disabled>自动填充</button>
          <button id="fpSmartUndoBtn" class="fp-table-editor-action" type="button" disabled>撤销本次填充</button>
          <button id="fpSmartDetailedBtn" class="fp-table-editor-action" type="button" hidden>切换精细版核对</button>
          <button id="fpSmartClearBtn" class="fp-table-editor-action" type="button">清空</button>
        </div>
        <div id="fpSmartImportStatus" class="fp-smart-import-status">默认版只显示常用字段；识别到的精细字段仍会保存，需要时切换“精细版本”核对。</div>
        <div id="fpSmartImportResult" class="fp-smart-import-result">${analysisHTML(null)}</div>
      </div></details>`;
    const textarea=$('fpSmartPasteText');
    textarea.addEventListener('paste',event=>{
      const htmlText=event.clipboardData?.getData('text/html')||'';
      window.clearTimeout(autoApplyTimer);
      autoApplyTimer=window.setTimeout(()=>{
        const result=parseFromInput({htmlText});
        if($('fpSmartAutoApply')?.checked&&!result.blockAutoApply&&(result.fields.length||result.products.length))applyCurrent({auto:true});
      },30);
    });
    textarea.addEventListener('input',()=>{window.clearTimeout(autoApplyTimer);autoApplyTimer=window.setTimeout(()=>parseFromInput(),350);});
    $('fpSmartClipboardBtn').addEventListener('click',async()=>{
      try{
        const text=await navigator.clipboard.readText();
        if(!text){$('fpSmartImportStatus').textContent='剪贴板中没有可读取的文本表格。';return;}
        textarea.value=text;
        const result=parseFromInput();
        $('fpSmartImportStatus').textContent=`已从剪贴板读取 ${result.matrix?.length||0} 行，确认识别结果后可自动填充。`;
      }catch(error){
        console.warn(error);
        $('fpSmartImportStatus').textContent='浏览器未允许直接读取剪贴板，请在上方粘贴框中按 Ctrl + V。';
      }
    });
    $('fpSmartAnalyzeBtn').addEventListener('click',()=>parseFromInput());
    $('fpSmartApplyBtn').addEventListener('click',()=>applyCurrent());
    $('fpSmartUndoBtn').addEventListener('click',()=>{applySnapshot(undoSnapshot);undoSnapshot=null;$('fpSmartUndoBtn').disabled=true;$('fpSmartImportStatus').textContent='已撤销本次智能填充。';});
    $('fpSmartDetailedBtn').addEventListener('click',()=>{document.querySelector('[data-doc-mode="b2b"]')?.click();window.FlypigBOXTableEditor?.refresh?.();$('fpSmartImportStatus').textContent='已切换到精细版本，可核对识别到的扩展字段。';});
    $('fpSmartClearBtn').addEventListener('click',()=>{textarea.value='';renderAnalysis(null);$('fpSmartImportStatus').textContent='已清空粘贴区，不影响已填写单据。';});
  }

  function decorateFormLabels(){
    Object.entries(FIELD_META).forEach(([id,meta])=>{
      const control=$(id);if(!control||control.type==='hidden')return;
      const label=control.closest('label');if(!label||label.querySelector(`.fp-field-en[data-for="${CSS.escape(id)}"]`))return;
      const visibleText=clean(label.childNodes[0]?.textContent||label.textContent||'');
      if(norm(visibleText).includes(norm(meta.en)))return;
      const tag=document.createElement('span');tag.className='fp-field-en';tag.dataset.for=id;tag.textContent=` / ${meta.en}`;
      label.insertBefore(tag,control);
    });
  }

  function boot(){
    const wait=()=>{
      if(!$('fpSmartSheetImportMount')){window.setTimeout(wait,80);return;}
      createImporter();decorateFormLabels();
      const observer=new MutationObserver(()=>decorateFormLabels());observer.observe(document.body,{childList:true,subtree:true});
      window.FlypigBOXSmartImport={analyze:analyzeSheet,apply:applyAnalysis,parseText:text=>analyzeSheet(matrixFromText(text)),parseHtml:html=>analyzeSheet(matrixFromHtml(html)),parseMatrix:matrix=>analyzeSheet(trimMatrix(matrix)),matrixFromText,fieldMeta:FIELD_META,productMeta:PRODUCT_META};
    };wait();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
