/* HUIDI smart-result normalizer.
   Converts different service/provider response shapes into one review-safe schema. */
((root)=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.19.2-RECOGNITION-TRUTHFULNESS.1';
  if(root.FlypigBOXSmartResultNormalizer?.version===VERSION)return;

  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const asObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const asArray=value=>Array.isArray(value)?value:(value===null||value===undefined?[]:[value]);
  const number=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const text=clean(value).replace(/,/g,'').match(/[-+]?\d+(?:\.\d+)?/);
    if(!text)return null;
    const parsed=Number(text[0]);
    return Number.isFinite(parsed)?parsed:null;
  };
  const parseMaybeJSON=value=>{
    if(typeof value!=='string')return value;
    let text=value.trim();
    if(!text)return {};
    text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    try{return JSON.parse(text);}catch(_){return value;}
  };
  const keysLower=obj=>Object.fromEntries(Object.entries(asObject(obj)).map(([key,value])=>[key.toLowerCase(),value]));
  const findValue=(source,aliases,maxDepth=5)=>{
    const wanted=new Set(aliases.map(x=>String(x).toLowerCase()));
    const seen=new Set();
    const visit=(value,depth)=>{
      value=parseMaybeJSON(value);
      if(value===null||value===undefined||depth>maxDepth)return undefined;
      if(typeof value!=='object')return undefined;
      if(seen.has(value))return undefined;
      seen.add(value);
      if(Array.isArray(value)){
        for(const item of value){const found=visit(item,depth+1);if(found!==undefined&&found!==null&&found!=='')return found;}
        return undefined;
      }
      for(const [key,item] of Object.entries(value)){
        if(wanted.has(key.toLowerCase())&&item!==undefined&&item!==null&&item!=='')return item;
      }
      for(const item of Object.values(value)){
        const found=visit(item,depth+1);
        if(found!==undefined&&found!==null&&found!=='')return found;
      }
      return undefined;
    };
    return visit(source,0);
  };
  const findObject=(source,aliases)=>{
    const value=findValue(source,aliases);
    const parsed=parseMaybeJSON(value);
    return asObject(parsed);
  };
  const findArray=(source,aliases)=>{
    const value=findValue(source,aliases);
    const parsed=parseMaybeJSON(value);
    if(Array.isArray(parsed))return parsed;
    return [];
  };
  const currency=value=>{
    const text=clean(value).toUpperCase();
    if(!text)return'';
    if(/USD|US\$|美元|\$/.test(text))return'USD';
    if(/CNY|RMB|人民币|元/.test(text))return'CNY';
    if(/EUR|欧元|€/.test(text))return'EUR';
    if(/GBP|英镑|£/.test(text))return'GBP';
    if(/JPY|日元|円|¥/.test(text))return'JPY';
    const match=text.match(/\b[A-Z]{3}\b/);
    return match?match[0]:'';
  };
  const language=value=>{
    const text=clean(value).toLowerCase();
    if(!text)return'auto';
    if(['en','english','英文'].includes(text))return'en';
    if(['zh','zh-cn','chinese','中文'].includes(text))return'zh';
    if(['es','spanish','西班牙语'].includes(text))return'es';
    if(['fr','french','法语'].includes(text))return'fr';
    if(['de','german','德语'].includes(text))return'de';
    if(['ja','japanese','日语'].includes(text))return'ja';
    if(text.includes('中')&&text.includes('英'))return'bilingual';
    return text.length<=12?text:'auto';
  };
  const stage=value=>{
    const text=clean(value).toLowerCase();
    const map={
      new_inquiry:'new_inquiry',new:'new_inquiry','新询盘':'new_inquiry','询盘':'new_inquiry',
      qualified:'qualified','已确认需求':'qualified',
      quoted:'quoted','已报价':'quoted',
      negotiation:'negotiation','洽谈中':'negotiation',
      order_confirmed:'order_confirmed','已确认订单':'order_confirmed',
      won:'won','已成交':'won',
      lost:'lost','未成交':'lost','已结束':'lost'
    };
    return map[text]||'new_inquiry';
  };
  const docType=(value,text='')=>{
    const raw=clean(value).toLowerCase();
    if(/proforma|形式发票|\bpi\b/.test(raw)||/形式发票|\bPI\b/.test(text))return'proforma_invoice';
    if(/commercial|商业发票|\bci\b/.test(raw)||/商业发票|\bCI\b/.test(text))return'commercial_invoice';
    if(/packing|装箱单|\bpl\b/.test(raw)||/装箱单|\bPL\b/.test(text))return'packing_list';
    if(/contract|合同/.test(raw)||/销售合同|合同/.test(text))return'sales_contract';
    return'quotation';
  };
  const firstMatch=(text,patterns)=>{
    for(const pattern of patterns){
      const match=text.match(pattern);
      if(match)return match;
    }
    return null;
  };
  const unsafeProductName=value=>{
    const text=clean(value).replace(/^[、,，;；:：\-\s]+/,'');
    if(!text)return true;
    if(/^(?:产品|商品|货物|item|product|待确认商品|未命名商品)$/i.test(text))return true;
    if(/^(?:订单|正式单据|订单或正式单据|单据|客户|客户资料|商品资料|业务|业务资料|报价单|形式发票|商业发票|装箱单|销售合同)$/i.test(text))return true;
    if(/^(?:客户、?商品、?订单或正式单据|客户、?商品、?业务或正式单据)$/i.test(text))return true;
    return false;
  };
  const safeProductName=value=>{
    const text=clean(value).replace(/^[、,，;；:：\-\s]+/,'');
    return unsafeProductName(text)?'待确认商品':text;
  };
  const textFallback=input=>{
    const text=String(input||'');
    const explicitCustomer=firstMatch(text,[
      /(?:客户名称|客户公司|buyer|customer)\s*[:：=为]\s*([^\n,，;；。]{2,60})/i
    ]);
    const naturalCustomer=firstMatch(text,[
      /([^\s，。；;]{2,30}?客户)(?=希望|想要|需要|询价|采购|订购)/i
    ]);
    const customerMatch=explicitCustomer||naturalCustomer;
    const quantityMatch=firstMatch(text,[
      /(?:数量|采购数量|订购数量|qty|quantity)\s*[:：=为]?\s*([\d,]+(?:\.\d+)?)\s*(PCS|PC|件|个|套|SET|SETS)?/i,
      /(?:采购|订购|需要|要)\s*([\d,]+(?:\.\d+)?)\s*(PCS|PC|件|个|套|SET|SETS)/i
    ]);
    const priceMatch=firstMatch(text,[
      /(?:单价|价格|unit\s*price|price)\s*[:：=为]?\s*(?:(USD|CNY|RMB|EUR|GBP|JPY|US\$|\$|€|£|美元|人民币|元)\s*)?([\d,]+(?:\.\d+)?)\s*(USD|CNY|RMB|EUR|GBP|JPY|美元|人民币|元)?/i
    ]);
    const productMatch=firstMatch(text,[
      /(?:产品名称|商品名称|品名|product\s*name|item\s*name)\s*[:：=]\s*([^\n,，;；。]{1,80})/i,
      /(?:产品|商品)\s*(?:是|为)\s*([^\n,，;；。]{1,80})/i,
      /(?:采购|订购|需要)\s*[\d,]+(?:\.\d+)?\s*(?:PCS|PC|件|个|套|SET|SETS)?\s*([^\n,，;；。]{1,50})/i
    ]);
    const productName=safeProductName(productMatch?.[1]);
    const priceCurrency=currency(priceMatch?.[1]||priceMatch?.[3]||text);
    return{
      customerName:clean(customerMatch?.[1]).replace(/(?:希望|想要|需要|询价|采购|订购).*$/,''),
      quantity:number(quantityMatch?.[1]),
      unit:clean(quantityMatch?.[2])||'PCS',
      unitPrice:number(priceMatch?.[2]),
      currency:priceCurrency||currency(text)||'',
      productName,
      documentType:docType('',text)
    };
  };
  const resultRoot=task=>{
    let value=task?.result??task?.output??task?.candidate??task?.data??{};
    value=parseMaybeJSON(value);
    for(let i=0;i<4;i++){
      const obj=asObject(value);
      const next=obj.result??obj.output??obj.candidate??obj.normalized??obj.extracted??obj.payload??obj.data;
      if(next===undefined||next===value)break;
      const parsed=parseMaybeJSON(next);
      if(typeof parsed==='object'&&parsed!==null)value=parsed;else break;
    }
    return asObject(value);
  };
  const missingLabels={
    product_sku:'产品SKU',sku:'产品SKU',product_name:'产品名称',name:'产品名称',
    product_specification:'产品规格',specification:'产品规格',
    quantity:'数量',qty:'数量',unit_price:'单价',price:'单价',
    payment_terms:'付款方式',delivery_time:'交货期',destination:'目的地',
    customer_contact:'客户联系人',contact_name:'客户联系人',
    customer_email:'客户邮箱',email:'客户邮箱',customer_phone:'客户电话',phone:'客户电话'
  };
  const normalizeMissing=(items,known)=>{
    const rows=asArray(items).map(item=>{
      if(typeof item==='string')return item;
      const obj=asObject(item);
      return clean(obj.label||obj.field||obj.name||obj.message);
    }).filter(Boolean);
    return [...new Set(rows.map(row=>missingLabels[row]||missingLabels[row.toLowerCase()]||row).filter(row=>{
      if(row==='数量'&&known.quantity!==null)return false;
      if(row==='单价'&&known.unitPrice!==null)return false;
      if(row==='产品名称'&&known.productName&&known.productName!=='待确认商品')return false;
      if(row==='客户名称'&&known.customerName)return false;
      return true;
    }))];
  };
  const normalizeWarnings=items=>[...new Set(asArray(items).map(item=>{
    if(typeof item==='string')return clean(item);
    const obj=asObject(item);
    return clean(obj.message||obj.label||obj.warning||obj.text);
  }).filter(Boolean))];

  function normalizeTask(task,options={}){
    const rootResult=resultRoot(task);
    const sourceObj=asObject(rootResult.source||rootResult.source_info);
    const sourceText=clean(options.inputText||sourceObj.original_text||findValue(rootResult,['original_text','source_text','input_text','input','prompt'])||'');
    const fallback=textFallback(sourceText);

    const customerObj={
      ...findObject(rootResult,['customer','buyer','client','customer_info','buyer_info','customer_data'])
    };
    const customerName=clean(
      customerObj.company_name||customerObj.company||customerObj.name||
      findValue(rootResult,['company_name','customer_name','buyer_name','client_name'])||
      fallback.customerName
    );

    let rawProducts=findArray(rootResult,['products','items','line_items','product_items','goods','order_items','catalog_items']);
    if(!rawProducts.length){
      const productObject=findObject(rootResult,['product','item','goods_item','product_info']);
      if(Object.keys(productObject).length)rawProducts=[productObject];
    }

    const globalQuantity=number(findValue(rootResult,['quantity','qty','order_quantity','requested_quantity','product_quantity']))??fallback.quantity;
    const globalPrice=number(findValue(rootResult,['unit_price','unitprice','quoted_price','quote_price','suggested_price','sales_price','price']))??fallback.unitPrice;
    const globalCurrency=currency(
      findValue(rootResult,['currency','currency_code','price_currency','document_currency'])||
      fallback.currency
    )||'USD';
    const globalUnit=clean(findValue(rootResult,['unit','uom','quantity_unit','pricing_unit'])||fallback.unit)||'PCS';
    const globalProductName=safeProductName(
      findValue(rootResult,['product_name','item_name','goods_name','product_title'])||
      fallback.productName
    );

    if(!rawProducts.length&&(globalQuantity!==null||globalPrice!==null||globalProductName!=='待确认商品')){
      rawProducts=[{}];
    }

    const products=rawProducts.map((raw,index)=>{
      const item=typeof raw==='string'?{name:raw}:asObject(parseMaybeJSON(raw));
      let name=safeProductName(item.name||item.product_name||item.item_name||item.title||item.goods_name);
      if(name==='待确认商品')name=index===0?globalProductName:'待确认商品';
      return{
        id:clean(item.id||item.product_id),
        name:name||'待确认商品',
        sku:clean(item.sku||item.model||item.product_code||item.item_code),
        specification:clean(item.specification||item.spec||item.description||item.details),
        quantity:number(item.quantity??item.qty??item.order_quantity)??(index===0?globalQuantity:null),
        unit:clean(item.unit||item.uom||item.quantity_unit)||(index===0?globalUnit:'PCS'),
        suggested_price:number(item.unit_price??item.unitPrice??item.price??item.quoted_price??item.suggested_price)??(index===0?globalPrice:null),
        currency:currency(item.currency||item.currency_code)||(index===0?globalCurrency:'USD'),
        moq:number(item.moq??item.minimum_order_quantity),
        hs_code:clean(item.hs_code||item.hs||item.customs_code),
        image_url:clean(item.image_url||item.image)
      };
    });

    const firstProduct=products[0]||{};
    const known={
      customerName,
      productName:firstProduct.name||'',
      quantity:firstProduct.quantity??null,
      unitPrice:firstProduct.suggested_price??null
    };

    const tradeObj={
      ...findObject(rootResult,['trade','trade_terms','terms','commercial_terms'])
    };
    const dealObj={
      ...findObject(rootResult,['deal','business','inquiry','business_deal'])
    };
    const documentObj={
      ...findObject(rootResult,['document','document_intent','document_info','suggested_document'])
    };
    const documentFields={
      ...asObject(documentObj.fields),
      ...findObject(rootResult,['document_fields','fields'])
    };
    const resultCurrency=currency(customerObj.currency||dealObj.currency||tradeObj.currency||documentFields.currency)||globalCurrency;
    const estimatedAmount=number(dealObj.estimated_amount??dealObj.amount??findValue(rootResult,['estimated_amount','total_amount'])) ??
      ((firstProduct.quantity!==null&&firstProduct.quantity!==undefined&&firstProduct.suggested_price!==null&&firstProduct.suggested_price!==undefined)
        ? Number((firstProduct.quantity*firstProduct.suggested_price).toFixed(4))
        : null);

    const rawMissing=findValue(rootResult,['missing_fields','missing','required_fields','unresolved_fields']);
    const rawWarnings=[
      ...asArray(findValue(rootResult,['warnings','warning_messages'])),
      ...asArray(findValue(rootResult,['risks','risk_messages','alerts']))
    ];

    const recognized=[
      customerName,
      firstProduct.name&&!unsafeProductName(firstProduct.name)?firstProduct.name:'',
      firstProduct.quantity!==null&&firstProduct.quantity!==undefined?'quantity':'',
      firstProduct.suggested_price!==null&&firstProduct.suggested_price!==undefined?'price':'',
      resultCurrency
    ].filter(Boolean).length;
    const score=Math.max(20,Math.min(100,Math.round(recognized/5*100)));

    const taskId=clean(task?.task_id||task?.taskId||task?.id);
    const publicId=taskId.replace(/^(?:task|local|cache)[-_:]?/i,'')||taskId;
    const detectedLanguage=language(
      sourceObj.detected_language||sourceObj.source_language||sourceObj.language||
      rootResult.detected_language||rootResult.source_language||
      (/[一-龥]/.test(sourceText)?'zh':'auto')
    );

    const processingMode=clean(task?.processingMode||task?.processing_mode);
    const engine=processingMode==='local_zero'?'local_fast':processingMode==='session_cache'?'session_cache':'smart_service';
    const sourceType=engine;
    const review={
      version:VERSION,
      engine,
      quality:{score,recognized_fields:recognized,source_rows:0,parser:'controlled_service_normalizer'},
      source:{
        type:sourceType,
        name:engine==='local_fast'?'本机快速整理':engine==='session_cache'?'复用本次结果':'智能整理',
        received_at:task?.updatedAt||task?.updated_at||task?.createdAt||task?.created_at||new Date().toISOString(),
        original_text:sourceText,
        detected_language:detectedLanguage
      },
      customer:{
        id:clean(customerObj.id||customerObj.customer_id),
        company_name:customerName,
        contact_name:clean(customerObj.contact_name||customerObj.contact||customerObj.person||findValue(rootResult,['contact_name','customer_contact'])),
        email:clean(customerObj.email||findValue(rootResult,['customer_email','buyer_email','email'])),
        phone:clean(customerObj.phone||customerObj.whatsapp||findValue(rootResult,['customer_phone','buyer_phone','whatsapp'])),
        country:clean(customerObj.country||findValue(rootResult,['customer_country','buyer_country','country'])),
        address:clean(customerObj.address||findValue(rootResult,['customer_address','buyer_address','address'])),
        preferred_language:language(customerObj.preferred_language||customerObj.language||'auto')||'auto',
        currency:resultCurrency,
        source:clean(customerObj.source)||'other'
      },
      products,
      deal:{
        id:clean(dealObj.id||dealObj.deal_id),
        title:clean(dealObj.title)||clean(`${customerName||'客户'} ${firstProduct.name||'新询盘'}`),
        requirements:clean(dealObj.requirements||dealObj.summary||findValue(rootResult,['requirements','request_summary','summary'])||sourceText),
        stage:stage(dealObj.stage||findValue(rootResult,['deal_stage','business_stage','stage'])),
        currency:resultCurrency,
        estimated_amount:estimatedAmount,
        next_action:clean(dealObj.next_action||findValue(rootResult,['next_action']))||'核对资料并准备单据',
        next_action_at:clean(dealObj.next_action_at||findValue(rootResult,['next_action_at']))||new Date().toISOString().slice(0,10),
        risk_notes:clean(dealObj.risk_notes||findValue(rootResult,['risk_notes','internal_notes']))
      },
      document:{
        type:docType(documentObj.type||documentObj.document_type||findValue(rootResult,['document_type','suggested_document_type']),sourceText),
        language:language(documentObj.language||documentObj.output_language||options.outputLanguage||'en')||'en',
        fields:{
          invoiceNo:clean(documentFields.invoiceNo||documentFields.invoice_no||documentObj.invoice_no||findValue(rootResult,['invoice_no','document_no'])),
          issueDate:clean(documentFields.issueDate||documentFields.issue_date||documentObj.issue_date||findValue(rootResult,['issue_date'])),
          customerPo:clean(documentFields.customerPo||documentFields.customer_po||tradeObj.customer_po||findValue(rootResult,['customer_po','po_number'])),
          originCountry:clean(documentFields.originCountry||documentFields.origin_country||tradeObj.origin_country||findValue(rootResult,['origin_country'])),
          currency:resultCurrency,
          tradeTerms:clean(documentFields.tradeTerms||documentFields.trade_terms||tradeObj.incoterm||tradeObj.trade_terms||findValue(rootResult,['incoterm','trade_terms'])),
          deliveryTime:clean(documentFields.deliveryTime||documentFields.delivery_time||tradeObj.delivery_time||findValue(rootResult,['delivery_time','lead_time'])),
          paymentTerms:clean(documentFields.paymentTerms||documentFields.payment_terms||tradeObj.payment_terms||findValue(rootResult,['payment_terms'])),
          destinationPort:clean(documentFields.destinationPort||documentFields.destination_port||tradeObj.destination||tradeObj.destination_port||findValue(rootResult,['destination','destination_port'])),
          remarks:'系统生成的待确认内容，核对无误后再保存。'
        }
      },
      missing:normalizeMissing(rawMissing,known),
      warnings:[
        ...normalizeWarnings(rawWarnings),
        '该内容尚未写入正式客户、商品、订单或单据。'
      ]
    };

    if(!review.products.length){
      review.missing=[...new Set([...review.missing,'产品资料'])];
    }
    return review;
  }

  const api=Object.freeze({version:VERSION,normalizeTask,resultRoot,textFallback});
  root.FlypigBOXSmartResultNormalizer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
