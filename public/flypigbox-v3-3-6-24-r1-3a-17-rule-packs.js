/* HUIDI V3.3.6.24-R1.3A.17 — unified document rule packs and deterministic validation. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.17-RULES.1-RC16.14-LOCATORS';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const unique=rows=>[...new Map((rows||[]).filter(Boolean).map(row=>[`${row.code}|${row.path}|${row.message}`,row])).values()];
  const typeOf=(payload,type)=>clean(type||payload?.fields?.documentType||'proforma_invoice');
  const itemsOf=payload=>(Array.isArray(payload?.items)?payload.items:[]).filter(item=>item&&typeof item==='object');
  const fieldsOf=payload=>(payload?.fields&&typeof payload.fields==='object'?payload.fields:{});
  const has=value=>clean(value)!=='';
  const labels={
    quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票（CI）',
    packing_list:'装箱单（PL）',sales_contract:'销售合同'
  };
  const common={
    requiredFormal:[
      ['sellerName','卖方名称'],['buyerName','客户或买方名称'],['issueDate','单据日期']
    ],
    itemRequired:[['name','商品名称'],['qty','数量'],['unit','单位']]
  };
  const PACKS=Object.freeze({
    quotation:{
      version:VERSION,label:labels.quotation,
      purpose:'向客户说明商品、数量、价格、有效期、交期和贸易条件。',
      requiredFormal:[...common.requiredFormal,['quoteNo','报价编号'],['currency','币种']],
      itemRequired:[...common.itemRequired,['price','单价']],
      conditional:[
        {when:f=>has(f.tradeTerms),require:['tradeTerms'],message:'贸易术语已经启用，请确认包含指定地点，例如 FOB Ningbo。'},
        {when:f=>has(f.quoteValidity),require:['quoteValidity'],message:'报价有效期需要是明确日期或期限。'}
      ],
      forbidden:['bankPassword','smtpPassword'],outputs:['pdf','xlsx','print']
    },
    proforma_invoice:{
      version:VERSION,label:labels.proforma_invoice,
      purpose:'用于订单确认和付款安排，不等同于税务发票。',
      requiredFormal:[...common.requiredFormal,['invoiceNo','PI编号'],['currency','币种'],['paymentTerms','付款条款']],
      itemRequired:[...common.itemRequired,['price','单价']],
      conditional:[
        {when:f=>has(f.bankName)||has(f.bankAccount),require:['beneficiaryName','bankName','bankAccount'],message:'显示收款资料时，需要同时核对收款人、银行和账号。'},
        {when:f=>has(f.tradeTerms),require:['tradeTerms'],message:'贸易术语应包含约定地点。'}
      ],
      forbidden:['smtpPassword'],outputs:['pdf','xlsx','print']
    },
    commercial_invoice:{
      version:VERSION,label:labels.commercial_invoice,
      purpose:'用于货值、发货、申报和清关核对。',
      requiredFormal:[...common.requiredFormal,['invoiceNo','商业发票编号'],['currency','币种'],['originCountry','原产国']],
      itemRequired:[...common.itemRequired,['price','申报单价']],
      conditional:[
        {when:f=>has(f.tradeTerms),require:['tradeTerms'],message:'贸易术语应包含指定地点。'},
        {when:f=>has(f.consigneeName),require:['consigneeAddress'],message:'填写收货方后，建议同时补齐收货地址。'},
        {when:f=>has(f.hsCode),require:[],message:'HS Code必须由用户、报关行或专业人员最终确认，系统不应自行猜测。',severity:'warning'}
      ],
      forbidden:['smtpPassword'],outputs:['pdf','xlsx','print']
    },
    packing_list:{
      version:VERSION,label:labels.packing_list,
      purpose:'说明实际包装、箱数、重量、体积和装运信息。',
      requiredFormal:[...common.requiredFormal,['invoiceNo','装箱单编号']],
      itemRequired:[...common.itemRequired],
      conditional:[
        {when:f=>num(f.packageCount)>0,require:['packageCount'],message:'箱数已经填写，请继续核对箱号、包装类型、毛重和体积。',severity:'warning'},
        {when:f=>num(f.grossWeight)>0&&num(f.netWeight)>num(f.grossWeight),require:[],message:'净重不能大于毛重。',code:'weight_order'}
      ],
      forbidden:['price','unitPrice','subtotal','taxAmount','discountValue','bankAccount','bankName','swiftCode'],outputs:['pdf','xlsx','print']
    },
    sales_contract:{
      version:VERSION,label:labels.sales_contract,
      purpose:'确认双方商品、付款、交付、验货、质量、责任和争议处理。',
      requiredFormal:[...common.requiredFormal,['invoiceNo','合同编号'],['currency','币种'],['paymentTerms','付款条款'],['deliveryTime','交付约定']],
      itemRequired:[...common.itemRequired,['price','单价']],
      conditional:[
        {when:f=>has(f.inspectionTerms),require:['inspectionTerms'],message:'验货条款应说明时间、方式和不合格处理。',severity:'warning'},
        {when:f=>has(f.disputeResolution),require:['disputeResolution'],message:'争议解决条款属于重要法律内容，正式使用前应人工确认。',severity:'warning'}
      ],
      forbidden:['smtpPassword'],outputs:['pdf','xlsx','print']
    }
  });
  function issue(severity,code,path,message,source='rule_pack',locator={}){
    return{severity,code,path,message,source,...(locator&&typeof locator==='object'?locator:{})};
  }
  function validateRequired(fields,required,formal){
    if(!formal)return[];
    return(required||[]).filter(([key])=>!has(fields[key])).map(([key,label])=>issue('blocker','required',`fields.${key}`,`${label}尚未填写。`));
  }
  function validateItems(items,required,formal,type){
    const rows=items.filter(item=>Object.values(item||{}).some(has));
    const result=[];
    if(formal&&!rows.length)result.push(issue('blocker','items_empty','items','至少需要一条商品明细。'));
    rows.forEach((item,index)=>{
      (required||[]).forEach(([key,label])=>{
        const value=item[key];
        const empty=key==='qty'||key==='price'?num(value)<=0:!has(value);
        if(formal&&empty)result.push(issue('blocker','item_required',`items.${index}.${key}`,`第${index+1}条商品的${label}尚未填写。`));
      });
      if(type!=='packing_list'&&num(item.qty)>0&&num(item.price)<0)result.push(issue('blocker','negative_price',`items.${index}.price`,`第${index+1}条商品的单价不能为负数。`));
      if(num(item.netWeight)>0&&num(item.grossWeight)>0&&num(item.netWeight)>num(item.grossWeight))result.push(issue('blocker','item_weight_order',`items.${index}.netWeight`,`第${index+1}条商品的净重不能大于毛重。`));
    });
    return result;
  }
  function validateForbidden(fields,items,forbidden,type){
    const result=[];
    (forbidden||[]).forEach(key=>{
      const fieldHas=has(fields[key])||num(fields[key])!==0;
      const itemHas=items.some(item=>has(item[key])||num(item[key])!==0);
      if(fieldHas||itemHas)result.push(issue(type==='packing_list'?'blocker':'warning','forbidden',fieldHas?`fields.${key}`:`items.${key}`,`${labels[type]||'当前单据'}不应输出“${key}”对应内容。`));
    });
    return result;
  }
  function validateConditions(fields,conditions){
    const result=[];
    (conditions||[]).forEach(rule=>{
      let active=false;try{active=Boolean(rule.when(fields));}catch(_){active=false;}
      if(!active)return;
      const missing=(rule.require||[]).filter(key=>!has(fields[key]));
      if(missing.length||!(rule.require||[]).length)result.push(issue(rule.severity||'blocker',rule.code||'conditional',missing.length?`fields.${missing[0]}`:'fields',rule.message));
    });
    return result;
  }
  const ajvCache=new Map();
  function ajvConstructor(){
    const candidate=window.ajv7?.default||window.ajv7?.Ajv||window.Ajv?.default||window.Ajv;
    return typeof candidate==='function'?candidate:null;
  }
  function ajvSchema(pack,formal){
    const fieldRequired=formal?(pack.requiredFormal||[]).map(row=>row[0]):[];
    const itemRequired=formal?(pack.itemRequired||[]).map(row=>row[0]):[];
    return{
      type:'object',required:['fields','items'],additionalProperties:true,
      properties:{
        fields:{type:'object',required:fieldRequired,additionalProperties:true},
        items:{type:'array',items:{type:'object',required:itemRequired,additionalProperties:true}}
      }
    };
  }
  function validateWithAjv(payload,pack,formal){
    const Constructor=ajvConstructor();if(!Constructor)return{active:false,issues:[]};
    try{
      const key=`${pack.label}|${formal?'formal':'draft'}`;
      let validate=ajvCache.get(key);
      if(!validate){const ajv=new Constructor({allErrors:true,strict:false,allowUnionTypes:true});validate=ajv.compile(ajvSchema(pack,formal));ajvCache.set(key,validate);}
      const valid=validate(payload);
      if(valid)return{active:true,issues:[]};
      const issues=(validate.errors||[]).filter(error=>error.keyword!=='required').map(error=>issue(formal?'blocker':'warning','json_schema',clean(error.instancePath||error.schemaPath)||'document',`字段结构不符合规则：${clean(error.message)||'请核对数据格式。'}`,'ajv'));
      return{active:true,issues};
    }catch(_){return{active:false,issues:[]};}
  }
  function tradeFactoryIssues(){
    try{
      const result=window.FlypigBOXTradeFactory?.evaluateReadiness?.();
      if(!result)return[];
      const rows=[];
      const map=(list,severity)=>{
        (Array.isArray(list)?list:[]).forEach((entry,index)=>{
          const locator=entry&&typeof entry==='object'?{fieldId:clean(entry.fieldId),selector:clean(entry.selector),section:clean(entry.section),itemIndex:entry.itemIndex,itemField:clean(entry.itemField)}:{};
          let path=clean(entry?.path||entry?.target);
          if(!path&&window.HUIDIIssueNavigator?.pathFromTradeIssue)path=window.HUIDIIssueNavigator.pathFromTradeIssue(locator);
          if(!path&&locator.fieldId)path=`fields.${locator.fieldId}`;
          if(!path&&locator.selector){
            const nth=locator.selector.match(/\.item-row:nth-child\((\d+)\)/);
            const field=locator.selector.match(/\.i-([a-z-]+)/)?.[1]||'';
            const aliases={'net-weight':'netWeight','gross-weight':'grossWeight','carton-no':'cartonNo','package-desc':'packageDescription','item-marks':'shippingMarks'};
            if(nth&&field)path=`items.${Math.max(0,Number(nth[1])-1)}.${aliases[field]||field}`;
          }
          rows.push(issue(severity,`trade_factory_${index}`,path||'document',clean(entry?.message||entry?.text||entry)||'单据仍有待核对内容。','trade_factory',locator));
        });
      };
      map(result.blockers||result.errors,'blocker');map(result.warnings,'warning');
      return rows;
    }catch(_){return[];}
  }
  function validate(payload,type,{formal=false,includeExisting=true}={}){
    const documentType=typeOf(payload,type);
    const pack=PACKS[documentType]||PACKS.proforma_invoice;
    const fields=fieldsOf(payload),items=itemsOf(payload);
    const ajvResult=validateWithAjv(payload,pack,formal);
    let issues=[
      ...validateRequired(fields,pack.requiredFormal,formal),
      ...validateItems(items,pack.itemRequired,formal,documentType),
      ...validateForbidden(fields,items,pack.forbidden,documentType),
      ...validateConditions(fields,pack.conditional),
      ...ajvResult.issues
    ];
    if(includeExisting&&document.getElementById('documentType'))issues.push(...tradeFactoryIssues());
    issues=unique(issues);
    const blockers=issues.filter(row=>row.severity==='blocker');
    const warnings=issues.filter(row=>row.severity!=='blocker');
    const result={
      valid:blockers.length===0,
      formal,
      documentType,
      documentLabel:pack.label,
      rulePackVersion:VERSION,
      engine:ajvResult.active?'native_rule_pack+ajv':'native_rule_pack',
      blockers,warnings,
      checkedAt:new Date().toISOString(),
      purpose:pack.purpose,
      outputs:pack.outputs
    };
    document.dispatchEvent(new CustomEvent('HUIDI:rule-validation',{detail:result}));
    return result;
  }
  function describe(type){const key=PACKS[type]?type:'proforma_invoice';return JSON.parse(JSON.stringify(PACKS[key]));}
  window.FlypigBOXRulePacks=Object.freeze({version:VERSION,packs:PACKS,validate,describe,list:()=>Object.entries(PACKS).map(([id,row])=>({id,label:row.label,purpose:row.purpose,version:row.version}))});
})();
