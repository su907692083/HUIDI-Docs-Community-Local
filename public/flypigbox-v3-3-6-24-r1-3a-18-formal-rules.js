/* HUIDI V3.3.6.24-R1.3A.18 — formal validation rule packs and output policy. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18-RULES.2';
  const base=window.FlypigBOXRulePacks;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const has=value=>clean(value)!=='';
  const fieldsOf=payload=>payload?.fields&&typeof payload.fields==='object'?payload.fields:{};
  const itemsOf=payload=>(Array.isArray(payload?.items)?payload.items:[]).filter(item=>item&&typeof item==='object');
  const typeOf=(payload,type)=>clean(type||payload?.fields?.documentType||'proforma_invoice');
  const LABELS={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票（CI）',packing_list:'装箱单（PL）',sales_contract:'销售合同'};
  const FIELD_LABELS={sellerName:'卖方名称',buyerName:'客户或买方名称',issueDate:'单据日期',quoteNo:'报价编号',invoiceNo:'单据编号',currency:'币种',paymentTerms:'付款条款',deliveryTime:'交付约定',originCountry:'原产国',tradeTerms:'贸易术语',buyerEmail:'客户邮箱',consigneeName:'收货方',consigneeAddress:'收货地址',bankName:'收款银行',bankAccount:'银行账号',beneficiaryName:'收款人',bankBeneficiary:'收款人',bankSwift:'SWIFT / BIC',inspectionStandard:'检验标准',contractClauses:'合同补充条款',packageCount:'箱数',netWeight:'净重',grossWeight:'毛重',cbm:'体积',portOfLoading:'起运港',destinationPort:'目的港'};
  const ITEM_LABELS={name:'商品名称',sku:'SKU',qty:'数量',unit:'单位',price:'单价',hs:'HS Code',origin:'原产国',netWeight:'净重',grossWeight:'毛重',cbm:'体积',cartons:'箱数'};
  const FORMAL_REQUIRED={
    quotation:['sellerName','buyerName','issueDate','quoteNo','currency'],
    proforma_invoice:['sellerName','buyerName','issueDate','invoiceNo','currency','paymentTerms'],
    commercial_invoice:['sellerName','buyerName','issueDate','invoiceNo','currency','originCountry'],
    packing_list:['sellerName','buyerName','issueDate','invoiceNo'],
    sales_contract:['sellerName','buyerName','issueDate','invoiceNo','currency','paymentTerms','deliveryTime']
  };
  const ITEM_REQUIRED={
    quotation:['name','qty','unit','price'],proforma_invoice:['name','qty','unit','price'],commercial_invoice:['name','qty','unit','price'],
    packing_list:['name','qty','unit'],sales_contract:['name','qty','unit','price']
  };
  const FORBIDDEN={
    packing_list:['price','unitPrice','subtotal','customsDeclaredValue','taxAmount','discountValue','extraFeeAmount','bankAccount','bankName','bankSwift','bankBeneficiary','swiftCode','beneficiaryName']
  };
  const CURRENCY=/^[A-Z]{3}$/;
  const DATE=/^\d{4}-\d{2}-\d{2}$/;
  const INCOTERM=/\b(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i;
  const schemaFor=(type,formal)=>({
    type:'object',required:['fields','items'],properties:{
      fields:{type:'object',required:formal?(FORMAL_REQUIRED[type]||[]):[],properties:{
        documentType:{type:'string',enum:Object.keys(LABELS)},sellerName:{type:'string',minLength:formal?1:0,maxLength:300},buyerName:{type:'string',minLength:formal?1:0,maxLength:300},
        issueDate:{type:'string',pattern:formal?'^\\d{4}-\\d{2}-\\d{2}$':'.*'},currency:{type:'string',pattern:formal?'^[A-Z]{3}$':'.*'},buyerEmail:{type:'string',maxLength:200},
        quoteNo:{type:'string',maxLength:120},invoiceNo:{type:'string',maxLength:120},tradeTerms:{type:'string',maxLength:300},paymentTerms:{type:'string',maxLength:2000},
        bankBeneficiary:{type:'string',maxLength:300},bankName:{type:'string',maxLength:300},bankAccount:{type:'string',maxLength:300},bankSwift:{type:'string',maxLength:120},inspectionStandard:{type:'string',maxLength:2000},contractClauses:{type:'string',maxLength:12000},packageCount:{type:['string','number']},netWeight:{type:['string','number']},grossWeight:{type:['string','number']},cbm:{type:['string','number']}
      },additionalProperties:true},
      items:{type:'array',minItems:formal?1:0,items:{type:'object',properties:{name:{type:'string',maxLength:500},sku:{type:'string',maxLength:160},qty:{type:['string','number']},unit:{type:'string',maxLength:60},price:{type:['string','number']},hs:{type:'string',maxLength:80},netWeight:{type:['string','number']},grossWeight:{type:['string','number']},cbm:{type:['string','number']}},additionalProperties:true}}
    },additionalProperties:true
  });
  const issue=(severity,code,path,message,source='formal_rules')=>({severity,code,path,message,source});
  const unique=rows=>[...new Map((rows||[]).filter(Boolean).map(row=>[`${row.severity}|${row.code}|${row.path}|${row.message}`,row])).values()];
  function schemaIssues(payload,type,formal){
    const runtime=window.FlypigBOXSchemaRuntime;if(!runtime)return[];
    const result=runtime.validate(schemaFor(type,formal),payload);
    return(result.errors||[]).filter(error=>!['required','minItems'].includes(error.keyword)).map(error=>{
      const path=clean(error.instancePath).replace(/^\//,'').replace(/\//g,'.')||'document';
      const missing=error.params?.missingProperty;
      const label=missing?(FIELD_LABELS[missing]||ITEM_LABELS[missing]||missing):path;
      const message=error.keyword==='required'?`${label}尚未填写。`:error.keyword==='pattern'?`${label}格式不正确。`:`${label}：${error.message||'不符合规则。'}`;
      return issue(formal?'blocker':'warning',`schema_${error.keyword}`,path,message,'embedded_schema_runtime');
    });
  }
  function requiredIssues(fields,type,formal){
    if(!formal)return[];
    return(FORMAL_REQUIRED[type]||[]).filter(key=>!has(fields[key])).map(key=>issue('blocker','required',`fields.${key}`,`${FIELD_LABELS[key]||key}尚未填写。`));
  }
  function itemIssues(items,type,formal){
    const rows=items.filter(item=>Object.values(item).some(value=>has(value)||num(value)!==0));
    const issues=[];
    if(formal&&!rows.length)issues.push(issue('blocker','items_empty','items','至少需要一条商品明细。'));
    rows.forEach((item,index)=>{
      (ITEM_REQUIRED[type]||[]).forEach(key=>{
        const missing=['qty','price'].includes(key)?num(item[key])<=0:!has(item[key]);
        if(formal&&missing)issues.push(issue('blocker','item_required',`items.${index}.${key}`,`第${index+1}条商品的${ITEM_LABELS[key]||key}尚未填写。`));
      });
      if(num(item.qty)<0)issues.push(issue('blocker','negative_qty',`items.${index}.qty`,`第${index+1}条商品数量不能为负数。`));
      if(type!=='packing_list'&&num(item.price)<0)issues.push(issue('blocker','negative_price',`items.${index}.price`,`第${index+1}条商品单价不能为负数。`));
      if(num(item.netWeight)>0&&num(item.grossWeight)>0&&num(item.netWeight)>num(item.grossWeight))issues.push(issue('blocker','weight_order',`items.${index}.netWeight`,`第${index+1}条商品净重不能大于毛重。`));
    });
    return issues;
  }
  function fieldLogic(fields,items,type,formal){
    const out=[];
    if(has(fields.issueDate)&&!DATE.test(clean(fields.issueDate)))out.push(issue(formal?'blocker':'warning','date_format','fields.issueDate','单据日期应使用 YYYY-MM-DD 格式。'));
    if(type!=='packing_list'&&has(fields.currency)&&!CURRENCY.test(clean(fields.currency).toUpperCase()))out.push(issue(formal?'blocker':'warning','currency_format','fields.currency','币种应使用三位英文代码，例如 USD、EUR、CNY。'));
    if(has(fields.buyerEmail)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(fields.buyerEmail)))out.push(issue('warning','email_format','fields.buyerEmail','客户邮箱格式可能不正确，请核对。'));
    if(has(fields.tradeTerms)){
      if(!INCOTERM.test(clean(fields.tradeTerms)))out.push(issue('warning','incoterm_unknown','fields.tradeTerms','贸易术语未识别为常见 Incoterms，请人工确认。'));
      const normalized=clean(fields.tradeTerms).replace(INCOTERM,'').replace(/[()（）,:：-]/g,'').trim();
      if(!normalized)out.push(issue(formal?'blocker':'warning','incoterm_place','fields.tradeTerms','贸易术语需要写明指定地点，例如 FOB Ningbo。'));
    }
    if(has(fields.consigneeName)&&!has(fields.consigneeAddress))out.push(issue(formal?'blocker':'warning','consignee_address','fields.consigneeAddress','填写收货方后，需要补充收货地址。'));
    const beneficiary=fields.bankBeneficiary||fields.beneficiaryName;
    const paymentEnabled=['proforma_invoice','sales_contract'].includes(type) && [true,'true','1','on',1].includes(fields.showPayment);
    const bankActive=paymentEnabled&&[fields.bankName,fields.bankAccount,beneficiary,fields.bankSwift,fields.swiftCode].some(has);
    if(bankActive&&![fields.bankName,fields.bankAccount,beneficiary].every(has))out.push(issue(formal?'blocker':'warning','bank_bundle','fields.bankAccount','收款资料只填写了一部分，请补齐收款人、银行名称和账号，或关闭本单收款资料。'));
    if(type==='commercial_invoice'){
      if(!items.some(item=>has(item.hs))&&!has(fields.hsCode))out.push(issue('warning','hs_missing','items.hs','商业发票尚未填写 HS Code；正式申报前请由用户或报关行确认。'));
      if(!items.some(item=>has(item.origin))&&!has(fields.originCountry))out.push(issue(formal?'blocker':'warning','origin_missing','fields.originCountry','商业发票需要原产国信息。'));
    }
    if(type==='packing_list'){
      const fNet=num(fields.netWeight),fGross=num(fields.grossWeight);
      if(fNet>0&&fGross>0&&fNet>fGross)out.push(issue('blocker','weight_order','fields.netWeight','总净重不能大于总毛重。'));
      if(formal&&num(fields.packageCount)<=0&&!items.some(item=>num(item.cartons)>0))out.push(issue('warning','package_count_missing','fields.packageCount','装箱单建议填写箱数或每条商品的包装箱数。'));
      if(formal&&fGross<=0&&!items.some(item=>num(item.grossWeight)>0))out.push(issue('warning','gross_weight_missing','fields.grossWeight','装箱单建议填写毛重。'));
      if(formal&&num(fields.cbm)<=0&&!items.some(item=>num(item.cbm)>0))out.push(issue('warning','cbm_missing','fields.cbm','装箱单建议填写体积（CBM）。'));
    }
    if(type==='sales_contract'){
      const clauses=clean(fields.contractClauses);
      if(!has(fields.inspectionStandard)&&!/inspection|acceptance|验货|检验|验收/i.test(clauses))out.push(issue('warning','inspection_missing','fields.inspectionStandard','合同建议明确验货时间、方式和不合格处理。'));
      if(!/dispute|arbitration|court|governing law|争议|仲裁|法院|适用法律/i.test(clauses))out.push(issue('warning','dispute_missing','fields.contractClauses','合同建议在补充条款中明确适用法律或争议解决方式，正式使用前应人工确认。'));
    }
    return out;
  }
  function forbiddenIssues(fields,items,type,formal){
    const keys=FORBIDDEN[type]||[];const out=[];
    keys.forEach(key=>{
      const fieldHas=has(fields[key])||num(fields[key])!==0;
      const itemHas=items.some(item=>has(item[key])||num(item[key])!==0);
      if(fieldHas||itemHas)out.push(issue(formal?'blocker':'warning','forbidden',fieldHas?`fields.${key}`:`items.${key}`,`${LABELS[type]}不应包含${FIELD_LABELS[key]||ITEM_LABELS[key]||key}。`));
    });return out;
  }
  function financialIssues(payload,type){
    if(type==='packing_list')return[];
    const financial=window.FlypigBOXDocumentIntelligence?.financialSummary?.(payload,type);if(!financial)return[];
    const out=[];
    if(financial.total<0)out.push(issue('blocker','negative_total','fields','单据总金额不能为负数。'));
    const declared=num(payload?.fields?.customsDeclaredValue);
    if(type==='commercial_invoice'&&declared>0&&Math.abs(declared-financial.total)>0.01)out.push(issue('blocker','declared_total_mismatch','fields.customsDeclaredValue',`总申报金额与商品及费用计算结果不一致（当前差额 ${Math.abs(declared-financial.total).toFixed(2)}）。`));
    return out;
  }
  function statusOf(formal,blockers,warnings){
    if(!formal)return blockers.length?'draft_has_errors':warnings.length?'draft_needs_review':'draft_ready';
    if(blockers.length)return'incomplete';
    if(warnings.length)return'needs_review';
    return'formal_ready';
  }
  function validate(payload,type,{formal=false,output='preview',includeExisting=true}={}){
    payload=payload&&typeof payload==='object'?payload:{fields:{},items:[]};payload.fields=payload.fields||{};payload.items=Array.isArray(payload.items)?payload.items:[];
    const documentType=typeOf(payload,type);const fields=fieldsOf(payload),items=itemsOf(payload);
    const inherited=base?.validate?.(payload,documentType,{formal:false,includeExisting})||{blockers:[],warnings:[]};
    let issues=[...schemaIssues(payload,documentType,formal),...requiredIssues(fields,documentType,formal),...itemIssues(items,documentType,formal),...fieldLogic(fields,items,documentType,formal),...forbiddenIssues(fields,items,documentType,formal),...financialIssues(payload,documentType)];
    if(includeExisting){
      (inherited.blockers||[]).forEach(row=>issues.push({...row,severity:formal?row.severity:'warning'}));
      (inherited.warnings||[]).forEach(row=>issues.push(row));
    }
    issues=unique(issues);const blockers=issues.filter(row=>row.severity==='blocker'),warnings=issues.filter(row=>row.severity!=='blocker');
    const result={valid:blockers.length===0,formal,output,documentType,documentLabel:LABELS[documentType]||'业务单据',rulePackVersion:VERSION,engine:'embedded_schema_runtime+deterministic_rules',blockers,warnings,status:statusOf(formal,blockers,warnings),checkedAt:new Date().toISOString(),outputs:['pdf','customer-xlsx','data-xlsx','csv','print']};
    document.dispatchEvent(new CustomEvent('HUIDI:formal-validation',{detail:result}));return result;
  }
  function outputAllowed(payload,type,output){return validate(payload,type,{formal:true,output});}
  function describe(type){return{...(base?.describe?.(type)||{}),version:VERSION,label:LABELS[type]||type,requiredFormal:FORMAL_REQUIRED[type]||[],itemRequired:ITEM_REQUIRED[type]||[],forbidden:FORBIDDEN[type]||[]};}
  window.FlypigBOXRulePacks=Object.freeze({version:VERSION,packs:base?.packs||{},validate,outputAllowed,describe,list:()=>Object.keys(LABELS).map(id=>describe(id)),statusOf,schemaFor});
  document.documentElement.dataset.fpbFormalRules=VERSION;
  document.dispatchEvent(new CustomEvent('HUIDI:formal-rules-ready',{detail:{version:VERSION}}));
})();
