/* HUIDI fast smart routing.
   Simple structured inquiries stay in the browser. Complex/ambiguous content
   uses the controlled smart service with a compact request. */
((root)=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.18-SMART-ROUTING.1';
  if(root.FlypigBOXSmartRouting?.version===VERSION)return;

  const CACHE_KEY='flypigbox_smart_route_cache_v1';
  const clean=value=>String(value??'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const number=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const m=clean(value).replace(/,/g,'').match(/[-+]?\d+(?:\.\d+)?/);
    return m&&Number.isFinite(Number(m[0]))?Number(m[0]):null;
  };
  const session=(()=>{
    try{
      const test='__fp_route_test__';
      sessionStorage.setItem(test,'1');sessionStorage.removeItem(test);
      return sessionStorage;
    }catch(_){
      const map=new Map();
      return{getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
    }
  })();
  const hash=text=>{
    let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return(h>>>0).toString(36);
  };
  const normalizeKey=(text,language='auto')=>hash(`${language}|${clean(text).toLowerCase()}`);
  const readCache=()=>{
    try{
      const rows=JSON.parse(session.getItem(CACHE_KEY)||'{}');
      return rows&&typeof rows==='object'?rows:{};
    }catch(_){return{};}
  };
  const writeCache=rows=>{
    try{session.setItem(CACHE_KEY,JSON.stringify(rows));}catch(_){}
  };
  const prune=rows=>{
    const now=Date.now();
    return Object.fromEntries(Object.entries(rows).filter(([,row])=>Number(row?.expiresAt||0)>now).slice(-12));
  };
  const genericProduct=value=>/^(?:产品|商品|货物|item|product|待确认商品)$/i.test(clean(value));
  const ambiguousPattern=/(上次|之前|照旧|保持原|原来的|同样|这种|那个|参考附件|见图|按以前|as before|same as|previous|attached|attachment|this one|that one)/i;
  const complexPattern=/(分别|多种|多个|每个|各自|合并|拆分|除了|除外|如果|否则|含税|不含税|折扣|阶梯价|多币种|分批|多地址|multiple|except|unless|tiered|discount|split shipment)/i;

  function fallback(text){
    const normalizer=root.FlypigBOXSmartResultNormalizer;
    const result=normalizer?.textFallback?.(text)||{};
    return{
      customerName:clean(result.customerName),
      productName:clean(result.productName),
      quantity:number(result.quantity),
      unit:clean(result.unit)||'PCS',
      unitPrice:number(result.unitPrice),
      currency:clean(result.currency).toUpperCase(),
      documentType:clean(result.documentType)||'quotation'
    };
  }
  function facts(text){
    const f=fallback(text);
    const known=[
      f.customerName?'客户':'',
      f.quantity!==null?'数量':'',
      f.unitPrice!==null?'单价':'',
      f.currency?'币种':'',
      f.documentType?'单据类型':''
    ].filter(Boolean);
    const productCertain=Boolean(f.productName&&!genericProduct(f.productName));
    return{
      ...f,productCertain,
      knownCount:known.length+(productCertain?1:0),
      ambiguous:ambiguousPattern.test(text),
      complex:complexPattern.test(text),
      length:clean(text).length,
      lineCount:clean(text).split(/\n/).filter(Boolean).length
    };
  }
  function dedupeLines(text){
    const pieces=clean(text).split(/\n|(?<=[。！？!?;；])\s*/).map(clean).filter(Boolean);
    const seen=new Set(),out=[];
    for(const row of pieces){
      const key=row.toLowerCase();
      if(seen.has(key))continue;
      seen.add(key);out.push(row);
    }
    return out;
  }
  function compactForService(text,localFacts){
    const lines=dedupeLines(text);
    const priority=lines.filter(row=>ambiguousPattern.test(row)||complexPattern.test(row));
    const remainder=lines.filter(row=>!priority.includes(row));
    const source=[...priority,...remainder].join('\n').slice(0,1800);
    const fixed=[
      localFacts.customerName?`客户：${localFacts.customerName}`:'',
      localFacts.productCertain?`商品：${localFacts.productName}`:'',
      localFacts.quantity!==null?`数量：${localFacts.quantity} ${localFacts.unit}`:'',
      localFacts.unitPrice!==null?`单价：${localFacts.unitPrice}`:'',
      localFacts.currency?`币种：${localFacts.currency}`:'',
      localFacts.documentType?`建议单据：${localFacts.documentType}`:''
    ].filter(Boolean).join('；');
    return clean(`以下字段已由本机确定，不要改写：${fixed||'暂无'}。
只判断不确定内容并返回待确认字段：
${source}`);
  }
  function localResult(text,language='auto'){
    const f=facts(text);
    const missing=[];
    if(!f.customerName)missing.push('客户名称');
    if(!f.productCertain)missing.push('产品名称');
    if(f.quantity===null)missing.push('数量');
    if(f.unitPrice===null)missing.push('单价');
    const result={
      customer:{company_name:f.customerName,currency:f.currency||'USD'},
      products:[{
        name:f.productCertain?f.productName:'待确认商品',
        quantity:f.quantity,
        unit:f.unit||'PCS',
        unit_price:f.unitPrice,
        currency:f.currency||'USD'
      }],
      deal:{
        stage:'new_inquiry',
        estimated_amount:f.quantity!==null&&f.unitPrice!==null
          ? Number((f.quantity*f.unitPrice).toFixed(4)):null
      },
      document:{type:f.documentType||'quotation',language:language==='auto'?'en':language},
      source:{detected_language:/[\u4e00-\u9fff]/.test(text)?'zh':'auto'},
      missing_fields:missing,
      warnings:['本次由本机快速整理；正式保存前仍需人工核对。'],
      summary:'已完成基础字段整理，结果可直接核对。'
    };
    return result;
  }
  function pseudoTask(text,language,source='local'){
    const result=localResult(text,language);
    const now=new Date().toISOString();
    return{
      id:`${source}-${Date.now().toString(36)}-${hash(clean(text)).slice(0,6)}`,
      task_type:'capture_and_classify',
      status:'completed',
      requiresConfirmation:true,
      localOnly:true,
      processingMode:source==='cache'?'session_cache':'local_zero',
      createdAt:now,updatedAt:now,result
    };
  }
  function cacheTask(text,language,task){
    const key=normalizeKey(text,language);
    const rows=prune(readCache());
    rows[key]={
      expiresAt:Date.now()+8*60*60*1000,
      task:{
        ...task,
        id:`cache-${Date.now().toString(36)}-${key.slice(0,6)}`,
        status:'completed',
        localOnly:true,
        processingMode:'session_cache',
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        confirmation:null
      }
    };
    writeCache(rows);
  }
  function cached(text,language){
    const rows=prune(readCache());
    writeCache(rows);
    return rows[normalizeKey(text,language)]?.task||null;
  }
  function evaluate(text,{mode='auto',language='auto'}={}){
    text=clean(text);
    const localFacts=facts(text);
    const hit=cached(text,language);
    if(hit&&mode!=='service')return{kind:'cache',task:hit,localFacts,message:'已复用本次浏览器中相同资料的处理结果。'};

    const locallyComplete=Boolean(
      localFacts.customerName &&
      localFacts.quantity!==null &&
      localFacts.unitPrice!==null &&
      localFacts.currency &&
      localFacts.documentType
    );
    const safeLocal=locallyComplete&&!localFacts.ambiguous&&!localFacts.complex&&localFacts.length<=900&&localFacts.lineCount<=12;
    if(mode==='local'||(mode==='auto'&&safeLocal)){
      const task=pseudoTask(text,language,'local');
      cacheTask(text,language,task);
      return{kind:'local',task,localFacts,message:'已在本机快速整理，未使用智能额度。'};
    }
    return{
      kind:'service',
      localFacts,
      serviceText:compactForService(text,localFacts),
      originalLength:text.length,
      serviceLength:compactForService(text,localFacts).length,
      message:'内容较复杂，将使用智能整理，并只提交必要内容。'
    };
  }
  function remember(text,language,task){
    if(!task||!task.result&&!task.output&&!task.candidate)return;
    cacheTask(text,language,task);
  }
  root.FlypigBOXSmartRouting=Object.freeze({
    version:VERSION,evaluate,remember,facts,compactForService,localResult
  });
  if(typeof module!=='undefined'&&module.exports)module.exports=root.FlypigBOXSmartRouting;
})(typeof window!=='undefined'?window:globalThis);
