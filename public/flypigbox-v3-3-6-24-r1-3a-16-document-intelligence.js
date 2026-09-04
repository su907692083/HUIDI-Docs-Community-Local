/* HUIDI V3.3.6.24-R1.3A.16 — document save intelligence, workbench indexing and compact save receipt. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.16';
  const TYPES=Object.freeze({
    quotation:{label:'报价单',short:'报价'},
    proforma_invoice:{label:'形式发票（PI）',short:'PI'},
    commercial_invoice:{label:'商业发票（CI）',short:'CI'},
    packing_list:{label:'装箱单（PL）',short:'PL'},
    sales_contract:{label:'销售合同',short:'合同'}
  });
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const unique=values=>[...new Set((values||[]).map(clean).filter(Boolean))];
  const compact=(value,max=24)=>{const text=clean(value);return text.length>max?`${text.slice(0,Math.max(1,max-1))}…`:text;};
  const normalize=value=>clean(value).toLowerCase().replace(/[\s._\-—–·,，。()（）\[\]【】]/g,'');
  const context=()=>{try{return JSON.parse(sessionStorage.getItem('flypigbox_document_context')||'{}')||{};}catch(_){return {};}};
  const saveContext=value=>{try{sessionStorage.setItem('flypigbox_document_context',JSON.stringify(value||{}));}catch(_){}};
  const formatAmount=(currency,amount)=>`${clean(currency)||'USD'} ${num(amount).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const parseJson=(value,fallback)=>{try{const parsed=typeof value==='string'?JSON.parse(value||'null'):value;return parsed??fallback;}catch(_){return fallback;}};
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

  function normalizeType(type,fields={}){
    const value=clean(type||fields.documentType||'proforma_invoice');
    return TYPES[value]?value:'proforma_invoice';
  }
  function financialSummary(payload,type){
    const fields=payload?.fields||{};
    const items=Array.isArray(payload?.items)?payload.items:[];
    if(type==='packing_list')return{subtotal:0,positive:0,tax:0,discount:0,total:0,excluded:[]};
    const priced=items.filter(item=>num(item?.qty)>0&&num(item?.price)>0);
    const subtotal=priced.reduce((sum,item)=>sum+num(item.qty)*num(item.price),0);
    let fees=parseJson(fields.fpFeeItemsJson,[]);
    if(!Array.isArray(fees)||!fees.length){
      fees=[];
      if(num(fields.extraFeeAmount)>0)fees.push({type:'freight',mode:'amount',value:num(fields.extraFeeAmount),includeTotal:true,label:clean(fields.extraFeeName)||'附加费用'});
      if(num(fields.taxAmount)>0)fees.push({type:'tax',mode:'amount',value:num(fields.taxAmount),includeTotal:true,label:'税费'});
      if(num(fields.discountValue)>0)fees.push({type:'discount',mode:fields.discountType==='percent'?'percent':'amount',value:num(fields.discountValue),includeTotal:true,label:'折扣'});
    }
    const result={subtotal,positive:0,tax:0,discount:0,total:subtotal,excluded:[]};
    fees.forEach(item=>{
      const value=Math.max(0,num(item?.value));
      const amount=item?.mode==='percent'?subtotal*value/100:value;
      if(!amount)return;
      if(item?.includeTotal===false){result.excluded.push({type:clean(item.type),label:clean(item.label),amount});return;}
      if(item?.type==='discount')result.discount+=amount;
      else if(item?.type==='tax')result.tax+=amount;
      else result.positive+=amount;
    });
    result.total=Math.max(0,subtotal+result.positive+result.tax-result.discount);
    if(!priced.length&&num(fields.customsDeclaredValue)>0)result.total=num(fields.customsDeclaredValue);
    return result;
  }
  function readSummary(payload,type,ctx={}){
    const fields=payload?.fields||{};
    const items=(Array.isArray(payload?.items)?payload.items:[]).filter(item=>item&&typeof item==='object');
    const documentType=normalizeType(type,fields);
    const financial=financialSummary(payload,documentType);
    const productNames=unique(items.map(item=>item.name));
    const skus=unique(items.map(item=>item.sku||item.itemKey));
    const hsCodes=unique(items.map(item=>item.hs));
    const units=unique(items.map(item=>item.unit));
    const totalQuantity=items.reduce((sum,item)=>sum+Math.max(0,num(item.qty)),0);
    const itemNet=items.reduce((sum,item)=>sum+Math.max(0,num(item.netWeight)),0);
    const itemGross=items.reduce((sum,item)=>sum+Math.max(0,num(item.grossWeight)),0);
    const itemCbm=items.reduce((sum,item)=>sum+Math.max(0,num(item.cbm)),0);
    const customerName=clean(ctx?.customer?.company_name||ctx?.customer?.name||fields.buyerName);
    const brandName=clean(ctx?.brand?.company_name||fields.sellerName);
    const documentNo=clean(fields.invoiceNo||fields.quoteNo);
    const customerPo=clean(fields.customerOrderNo||fields.customerPo);
    const internalOrderNo=clean(fields.internalOrderNo);
    const country=clean(fields.buyerCountry);
    const currency=clean(fields.currency||ctx?.customer?.currency||'USD')||'USD';
    const packageCount=num(fields.packageCount)||num(fields.cartonsInLine);
    const netWeight=num(fields.netWeight)||itemNet;
    const grossWeight=num(fields.grossWeight)||itemGross;
    const cbm=num(fields.cbm)||itemCbm;
    const issueDate=clean(fields.issueDate||fields.packingDate||fields.contractSignedDate);
    const deliveryDate=clean(fields.estimatedShipment||fields.deliveryTime||fields.expectedCompletionDate||fields.eta);
    const tradeTerms=clean(fields.tradeTerms);
    const paymentTerms=clean(fields.paymentTerms||fields.balanceDueCondition);
    const shippingMethod=clean(fields.shippingMethod||fields.transportDocumentType);
    const portOfLoading=clean(fields.portOfLoading);
    const destinationPort=clean(fields.destinationPort);
    const relatedNumbers=unique([
      fields.inquiryNo,fields.relatedQuotationNo,fields.relatedPiNo,fields.relatedContractNo,
      fields.relatedCommercialInvoiceNo,fields.relatedPackingListNo,fields.blNo,fields.trackingNo,
      fields.containerNo,fields.customerOrderNo,fields.internalOrderNo
    ]);
    const primaryProduct=productNames[0]||clean(fields.customsDescription);
    const sourceType=clean(fields.workspaceSourceDocumentType);
    const sourceNo=clean(fields.workspaceSourceDocumentNo);
    const rawTokens=[
      TYPES[documentType]?.label,TYPES[documentType]?.short,documentNo,customerName,brandName,country,currency,
      customerPo,internalOrderNo,...productNames,...skus,...hsCodes,...units,tradeTerms,paymentTerms,shippingMethod,
      portOfLoading,destinationPort,...relatedNumbers,fields.buyerContact,fields.buyerEmail,fields.buyerPhone,
      fields.consigneeName,fields.notifyPartyName,fields.billToAddress,fields.shipToAddress,fields.remarks,
      fields.workspaceDocumentNote,sourceType,sourceNo,totalQuantity,packageCount,netWeight,grossWeight,cbm,
      financial.total,formatAmount(currency,financial.total)
    ];
    const searchText=unique(rawTokens).join(' ');
    return{
      schema_version:VERSION,
      document_type:documentType,
      document_type_label:TYPES[documentType]?.label||'业务单据',
      document_no:documentNo,
      customer_name:customerName,
      brand_name:brandName,
      buyer_country:country,
      buyer_email:clean(fields.buyerEmail),
      customer_po:customerPo,
      internal_order_no:internalOrderNo,
      primary_product:primaryProduct,
      product_names:productNames,
      skus,
      hs_codes:hsCodes,
      item_count:items.filter(item=>clean(item.name)||num(item.qty)>0).length,
      total_quantity:totalQuantity,
      units,
      currency,
      subtotal:financial.subtotal,
      extra_amount:financial.positive,
      tax_amount:financial.tax,
      discount_amount:financial.discount,
      total_amount:financial.total,
      excluded_fees:financial.excluded,
      package_count:packageCount,
      net_weight:netWeight,
      gross_weight:grossWeight,
      cbm,
      issue_date:issueDate,
      delivery_date:deliveryDate,
      trade_terms:tradeTerms,
      payment_terms:paymentTerms,
      shipping_method:shippingMethod,
      port_of_loading:portOfLoading,
      destination_port:destinationPort,
      related_numbers:relatedNumbers,
      source_document_type:sourceType,
      source_document_no:sourceNo,
      customer_id:ctx?.customer_id||ctx?.customer?.id||null,
      brand_id:ctx?.brand_id||ctx?.brand?.id||null,
      deal_id:ctx?.deal_id||ctx?.deal?.id||null,
      search_text:searchText,
      indexed_at:new Date().toISOString()
    };
  }
  function suggestedTitle(summary={}){
    const type=summary.document_type||'proforma_invoice';
    const parts=[TYPES[type]?.short||'单据'];
    if(summary.customer_name)parts.push(compact(summary.customer_name,18));
    if(summary.document_no)parts.push(compact(summary.document_no,22));
    else if(summary.primary_product)parts.push(compact(summary.primary_product,18));
    if(type==='packing_list'){
      if(summary.package_count>0)parts.push(`${Number(summary.package_count).toLocaleString('zh-CN')}箱`);
      else if(summary.total_quantity>0)parts.push(`数量${Number(summary.total_quantity).toLocaleString('zh-CN')}`);
    }else if(summary.total_amount>0)parts.push(formatAmount(summary.currency,summary.total_amount));
    return parts.filter(Boolean).join('｜')||TYPES[type]?.label||'业务单据';
  }
  function enrichPayload(payload,type,ctx=context()){
    if(!payload||typeof payload!=='object')return readSummary({fields:{},items:[]},type,ctx);
    payload.fields=payload.fields||{};
    const summary=readSummary(payload,type,ctx);
    payload.workspace_index=summary;
    payload.fields.workspaceIndexVersion=VERSION;
    payload.fields.workspaceSearchText=summary.search_text;
    payload.fields.workspacePrimaryProduct=summary.primary_product;
    payload.fields.workspaceFormalTotal=summary.total_amount?String(summary.total_amount):'';
    payload.fields.workspaceCustomerPo=summary.customer_po;
    payload.fields.workspaceInternalOrderNo=summary.internal_order_no;
    return summary;
  }
  function recordMeta(payload,type,ctx=context()){
    const summary=enrichPayload(payload,type,ctx);
    return{
      document_type:summary.document_type,
      document_no:summary.document_no||null,
      customer_id:summary.customer_id||null,
      brand_id:summary.brand_id||null,
      deal_id:summary.deal_id||null,
      customer_name:summary.customer_name||null,
      brand_name:summary.brand_name||null,
      currency:summary.currency||'USD',
      total_amount:num(summary.total_amount)
    };
  }
  function fromDocument(doc={}){
    const payload=doc.payload||{};
    const stored=payload.workspace_index;
    if(stored&&stored.schema_version)return stored;
    return readSummary(payload,doc.document_type||payload?.fields?.documentType||'proforma_invoice',{
      customer_id:doc.customer_id||null,
      brand_id:doc.brand_id||null,
      deal_id:doc.deal_id||null,
      customer:doc.customer_name?{id:doc.customer_id||null,company_name:doc.customer_name}:null,
      brand:doc.brand_name?{id:doc.brand_id||null,company_name:doc.brand_name}:null
    });
  }
  function searchableText(doc={}){
    const summary=fromDocument(doc);
    return unique([doc.title,doc.document_no,doc.customer_name,doc.brand_name,doc.status,summary.search_text,doc.payload?.fields?.workspaceDocumentNote]).join(' ');
  }
  function summaryFrom(value={}){
    if(value?.payload||value?.document_type&&value?.title)return fromDocument(value);
    return value?.workspace_index||value;
  }
  function compactFacts(value={}){
    const summary=summaryFrom(value);
    const facts=[];
    if(summary.customer_po)facts.push(`客户PO ${summary.customer_po}`);
    else if(summary.internal_order_no)facts.push(`订单 ${summary.internal_order_no}`);
    if(summary.primary_product)facts.push(compact(summary.primary_product,20));
    if(summary.buyer_country)facts.push(summary.buyer_country);
    if(summary.document_type==='packing_list'&&summary.package_count>0)facts.push(`${Number(summary.package_count).toLocaleString('zh-CN')}箱`);
    else if(summary.total_quantity>0)facts.push(`数量 ${Number(summary.total_quantity).toLocaleString('zh-CN')}`);
    return facts.slice(0,4);
  }
  function secondaryFacts(value={}){
    const summary=summaryFrom(value);
    const facts=[];
    if(summary.trade_terms)facts.push(summary.trade_terms);
    if(summary.delivery_date)facts.push(`交付 ${summary.delivery_date}`);
    if(summary.document_type==='packing_list'){
      if(summary.gross_weight>0)facts.push(`毛重 ${Number(summary.gross_weight).toLocaleString('zh-CN')} kg`);
      if(summary.cbm>0)facts.push(`${Number(summary.cbm).toLocaleString('zh-CN',{maximumFractionDigits:3})} CBM`);
    }
    return facts.slice(0,3);
  }
  async function findExistingCustomer(client,userId,summary,currentCustomerId=''){
    if(!client||!userId||currentCustomerId||!summary?.customer_name)return null;
    try{
      const {data,error}=await client.from('customer_records').select('id,company_name,name,email,country').eq('user_id',userId);
      if(error||!Array.isArray(data))return null;
      const targetName=normalize(summary.customer_name),targetEmail=normalize(summary.buyer_email);
      const matches=data.filter(row=>{
        const nameMatch=targetName&&[row.company_name,row.name].some(value=>normalize(value)===targetName);
        const emailMatch=targetEmail&&normalize(row.email)===targetEmail;
        return nameMatch||emailMatch;
      });
      return matches.length===1?matches[0]:null;
    }catch(_){return null;}
  }
  function applyCustomerMatch(ctx,customer){
    if(!customer?.id)return ctx||{};
    const next={...(ctx||{}),customer_id:customer.id,customer:{id:customer.id,company_name:customer.company_name||customer.name||'',name:customer.name||'',email:customer.email||'',country:customer.country||''}};
    saveContext(next);
    return next;
  }
  function localMirror(record={}){
    if(window.HUIDI_LOCAL_ONLY?.localOnly)return record;
    try{
      const key='flypigbox_workspace_document_mirror_v1';
      const rows=parseJson(localStorage.getItem(key),[]);
      const list=Array.isArray(rows)?rows:[];
      const id=clean(record.id)||clean(record.local_id)||`local_${Date.now()}`;
      const next={...record,id,updated_at:new Date().toISOString()};
      const index=list.findIndex(row=>String(row.id)===String(id));
      if(index>=0)list[index]=next;else list.unshift(next);
      localStorage.setItem(key,JSON.stringify(list.slice(0,80)));
      return next;
    }catch(_){return record;}
  }
  function ensureStyles(){
    if(document.getElementById('fp-a16-document-intelligence-style'))return;
    const style=document.createElement('style');
    style.id='fp-a16-document-intelligence-style';
    style.textContent=`
      .fp-a16-save-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(15,23,42,.34);display:grid;place-items:center;padding:18px}.fp-a16-save-card{width:min(560px,calc(100vw - 28px));border-radius:20px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.25);padding:22px;color:#0f172a}.fp-a16-save-card header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.fp-a16-save-card h2{margin:4px 0 5px;font-size:21px}.fp-a16-save-card p{margin:0;color:#64748b}.fp-a16-save-card .fp-a16-close{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer}.fp-a16-save-title{margin:18px 0 12px;padding:13px 15px;border-radius:13px;background:#eff6ff;color:#1d4ed8;font-weight:750;overflow-wrap:anywhere}.fp-a16-save-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.fp-a16-save-facts span{padding:10px 12px;border:1px solid #e2e8f0;border-radius:11px;font-size:13px;overflow-wrap:anywhere}.fp-a16-save-next{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc;color:#475569;font-size:13px}.fp-a16-save-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.fp-a16-save-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 14px;cursor:pointer}.fp-a16-save-actions .primary{background:#2563eb;color:#fff;border-color:#2563eb}.fp-a16-index-line{display:block;margin-top:5px;color:#475569;font-size:12px;white-space:normal}.fp-a16-secondary-line{display:block;margin-top:3px;color:#64748b;font-size:11px;white-space:normal}@media(max-width:640px){.fp-a16-save-backdrop{align-items:end;padding:0}.fp-a16-save-card{width:100%;border-radius:20px 20px 0 0;padding:20px}.fp-a16-save-facts{grid-template-columns:1fr}.fp-a16-save-actions{display:grid;grid-template-columns:1fr 1fr}.fp-a16-save-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }
  function suggestedNext(summary={}){
    const map={
      quotation:'报价已保存，可回到业务记录继续跟进客户确认。',
      proforma_invoice:'PI 已保存，可在业务记录中安排定金或付款跟进。',
      sales_contract:'合同已保存，建议核对签章、付款和交付节点。',
      commercial_invoice:'商业发票已保存，建议与装箱单核对商品和数量。',
      packing_list:'装箱单已保存，建议与商业发票核对商品、数量、箱数和重量。'
    };
    return map[summary.document_type]||'单据已保存，可返回工作台继续处理。';
  }
  function showSaveReceipt({title='',summary={},cloud=true,customerMatched=false}={}){
    ensureStyles();
    document.querySelector('.fp-a16-save-backdrop')?.remove();
    const root=document.createElement('div');
    root.className='fp-a16-save-backdrop';
    const facts=[];
    if(summary.customer_name)facts.push(`客户：${summary.customer_name}`);
    if(summary.primary_product)facts.push(`主要商品：${summary.primary_product}`);
    if(summary.document_type==='packing_list'&&summary.package_count>0)facts.push(`包装：${Number(summary.package_count).toLocaleString('zh-CN')} 箱`);
    else if(summary.total_amount>0)facts.push(`总额：${formatAmount(summary.currency,summary.total_amount)}`);
    if(summary.customer_po)facts.push(`客户PO：${summary.customer_po}`);
    else if(summary.internal_order_no)facts.push(`内部订单：${summary.internal_order_no}`);
    root.innerHTML=`<section class="fp-a16-save-card" role="dialog" aria-modal="true" aria-label="单据保存结果"><header><div><p>${cloud?'已同步到工作台单据中心':'已保存到当前浏览器'}</p><h2>单据保存完成</h2></div><button type="button" class="fp-a16-close" aria-label="关闭">×</button></header><div class="fp-a16-save-title">${escapeHTML(title||suggestedTitle(summary))}</div><div class="fp-a16-save-facts">${facts.slice(0,4).map(item=>`<span>${escapeHTML(item)}</span>`).join('')||'<span>已保存完整表单内容</span>'}</div>${customerMatched?'<div class="fp-a16-save-next">已根据公司名称或邮箱，自动关联到工作台中的现有客户。</div>':''}<div class="fp-a16-save-next">${escapeHTML(suggestedNext(summary))}</div><div class="fp-a16-save-actions"><button type="button" data-fp-a16-continue>继续编辑</button><button type="button" class="primary" data-fp-a16-workspace>返回单据中心</button></div></section>`;
    const close=()=>root.remove();
    root.addEventListener('click',event=>{if(event.target===root||event.target.closest('.fp-a16-close')||event.target.closest('[data-fp-a16-continue]'))close();if(event.target.closest('[data-fp-a16-workspace]'))location.href='./workspace.html?view=documents';});
    document.body.appendChild(root);
  }

  ensureStyles();
  window.FlypigBOXDocumentIntelligence={
    VERSION,TYPES,clean,num,context,saveContext,financialSummary,readSummary,enrichPayload,recordMeta,
    suggestedTitle,fromDocument,searchableText,compactFacts,secondaryFacts,findExistingCustomer,
    applyCustomerMatch,localMirror,showSaveReceipt,formatAmount
  };
})();
