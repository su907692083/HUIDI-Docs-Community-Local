/* HUIDI R1.3A.18.28 real-time business event bridge.
   Observes successful Supabase REST mutations and high-value user actions.
   No DOM-wide MutationObserver is used, preventing the workspace freeze seen in 18.26. */
(()=>{
  'use strict';
  const VERSION='R1.3A.18.28';
  const originalFetch=window.fetch.bind(window);
  const emit=payload=>{try{return window.FlypigBOXNotifications?.emit?.(payload);}catch(_){return null;}};
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const has=(obj,keys)=>keys.some(key=>Object.prototype.hasOwnProperty.call(obj||{},key));
  const first=(obj,keys)=>{for(const key of keys){const value=obj?.[key];if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;}return'';};
  const detailUrl=(view,id='')=>{const base=location.pathname.includes('/catalog-studio/')?'../workspace.html':'./workspace.html';return `${base}?view=${encodeURIComponent(view)}${id?`&record=${encodeURIComponent(id)}`:''}`;};
  const user=()=>{try{return window.FlypigBOXWorkspaceAuth?.getUser?.()||window.FlypigBOXMember?.getUser?.()||null;}catch(_){return null;}};
  function safeJson(text){try{return JSON.parse(text);}catch(_){return null;}}
  function requestBody(input,init){
    const body=init?.body;if(typeof body==='string')return safeJson(body)||{};
    if(body instanceof URLSearchParams)return Object.fromEntries(body.entries());
    return{};
  }
  function restMutation(input,init){
    const method=String(init?.method||input?.method||'GET').toUpperCase();if(!['POST','PATCH','DELETE'].includes(method))return null;
    let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch(_){return null;}
    const match=url.pathname.match(/\/rest\/v1\/([^/?]+)/);if(!match)return null;
    const table=decodeURIComponent(match[1]);if(/^notification_/.test(table))return null;
    return{method,url,table,body:requestBody(input,init)};
  }
  function rowId(meta,responseData){
    const data=Array.isArray(responseData)?responseData[0]:responseData;
    if(data?.id)return String(data.id);
    if(meta.body?.id)return String(meta.body.id);
    const raw=meta.url.searchParams.get('id')||'';return raw.replace(/^eq\./,'').replace(/^in\.\((.*)\)$/,'$1').split(',')[0]||'';
  }
  function operatorFields(){const current=user()||{};return{operatorId:current.id||'',operatorName:current.email||current.user_metadata?.name||''};}
  function mutationEvent(meta,responseData){
    const body=Array.isArray(meta.body)?meta.body[0]||{}:meta.body||{};const count=Array.isArray(meta.body)?meta.body.length:1;
    const id=rowId(meta,responseData),op=meta.method==='POST'?'create':meta.method==='PATCH'?'update':'delete';
    const deleted=meta.method==='DELETE'||(has(body,['deleted_at'])&&body.deleted_at);const restored=has(body,['deleted_at'])&&body.deleted_at===null;
    const common={objectId:id,ownerId:clean(first(body,['owner_id','assigned_to','responsible_user_id','sales_owner_id','user_id'])),...operatorFields(),metadata:{table:meta.table,operation:op,changedFields:Object.keys(body||{}),recordCount:count,dedupeKey:`db:${meta.table}:${op}:${id||clean(first(body,['name','title','company_name','document_no']))}:${deleted?'deleted':restored?'restored':''}`}};
    if(Array.isArray(meta.body)&&['customer_records','product_records'].includes(meta.table))return{type:'import.completed',objectType:meta.table==='customer_records'?'customer_import':'product_import',objectLabel:meta.table==='customer_records'?'客户批量导入':'商品批量导入',summary:`已成功写入 ${count} 条${meta.table==='customer_records'?'客户':'商品'}资料。`,nextAction:'检查待确认记录和重复项。',detailUrl:detailUrl(meta.table==='customer_records'?'customers':'products'),...common};
    if(meta.table==='customer_records'){
      const label=clean(first(body,['company_name','name','contact_name','email']))||'客户资料';
      if(deleted)return{type:'system.recycle_moved',objectType:'customer',objectLabel:label,summary:`客户“${label}”已移入回收站。`,detailUrl:detailUrl('recycle'),...common};
      if(restored)return{type:'system.recycle_restored',objectType:'customer',objectLabel:label,summary:`客户“${label}”已从回收站恢复。`,detailUrl:detailUrl('customers',id),...common};
      /* Normal customer creates/updates are emitted by the workspace form. Only specific changes are observed here. */
      if(meta.method==='PATCH'&&has(body,['email','contact_email']))return{type:'customer.email_changed',objectType:'customer',objectLabel:label,summary:`客户“${label}”的联系邮箱已更新。`,nextAction:'检查未发送的报价和邮件草稿。',detailUrl:detailUrl('customers',id),...common};
      if(meta.method==='PATCH'&&has(body,['owner_id','assigned_to','responsible_user_id','sales_owner_id']))return{type:'customer.owner_changed',objectType:'customer',objectLabel:label,summary:`客户“${label}”的负责人已变化。`,nextAction:'确认后续跟进负责人和下一步。',detailUrl:detailUrl('customers',id),...common};
      return null;
    }
    if(meta.table==='product_records'){
      const label=clean(first(body,['name','title','sku']))||'商品资料';
      if(deleted)return{type:'system.recycle_moved',objectType:'product',objectLabel:label,summary:`商品“${label}”已移入回收站。`,detailUrl:detailUrl('recycle'),...common};
      if(restored)return{type:'system.recycle_restored',objectType:'product',objectLabel:label,summary:`商品“${label}”已从回收站恢复。`,detailUrl:detailUrl('products',id),...common};
      if(meta.method==='PATCH'&&has(body,['suggested_price','price','currency','pricing_unit']))return{type:'product.price_changed',objectType:'product',objectLabel:label,summary:`商品“${label}”的价格或币种已更新。`,amount:first(body,['suggested_price','price'])||null,currency:clean(body.currency),nextAction:'检查相关报价单和产品目录价格。',detailUrl:detailUrl('products',id),...common};
      if(meta.method==='PATCH'&&has(body,['packaging','packaging_requirements','packing_qty','carton_qty','carton_size','gross_weight','net_weight']))return{type:'product.packaging_changed',objectType:'product',objectLabel:label,summary:`商品“${label}”的包装资料已更新。`,nextAction:'检查装箱单和客户包装要求。',detailUrl:detailUrl('products',id),...common};
      if(meta.method==='PATCH'&&/in\.\(/.test(meta.url.searchParams.get('id')||''))return{type:'product.updated',objectType:'product_batch',objectLabel:`${count>1?count:'多'}个商品`,summary:'已完成商品批量状态或资料更新。',detailUrl:detailUrl('products'),...common};
      return null;
    }
    if(meta.table==='business_deals'){
      const label=clean(first(body,['title','name']))||'业务记录';const stage=clean(first(body,['stage','status']));
      if(deleted)return{type:'system.recycle_moved',objectType:'deal',objectLabel:label,summary:`业务“${label}”已移入回收站。`,detailUrl:detailUrl('recycle'),...common};
      if(restored)return{type:'system.recycle_restored',objectType:'deal',objectLabel:label,summary:`业务“${label}”已恢复。`,detailUrl:detailUrl('deals',id),...common};
      if(meta.method==='PATCH'&&has(body,['payment_status','payment_received_at','paid_amount']))return{type:/overdue/i.test(stage||body.payment_status)?'order.payment_overdue':'order.payment_received',objectType:'order',objectLabel:label,summary:/overdue/i.test(stage||body.payment_status)?`订单“${label}”付款已逾期。`:`订单“${label}”已更新付款状态。`,amount:first(body,['paid_amount','estimated_amount'])||null,currency:clean(body.currency),detailUrl:detailUrl('deals',id),...common};
      if(meta.method==='PATCH'&&has(body,['delivery_date','expected_delivery_on','shipment_date','shipped_at']))return{type:has(body,['shipped_at'])?'order.shipped':'order.delivery_changed',objectType:'order',objectLabel:label,summary:has(body,['shipped_at'])?`订单“${label}”已标记发货。`:`订单“${label}”的交期或发货安排已变化。`,detailUrl:detailUrl('deals',id),...common};
      if(meta.method==='PATCH'&&/closed|completed|won/i.test(stage))return{type:'order.closed',objectType:'order',objectLabel:label,summary:`订单或业务“${label}”已关闭。`,detailUrl:detailUrl('deals',id),...common};
      if(meta.method==='PATCH'&&/order|confirmed|production|shipping/i.test(stage))return{type:'order.status_changed',objectType:'order',objectLabel:label,summary:`订单“${label}”的状态已更新为 ${stage}。`,detailUrl:detailUrl('deals',id),...common};
      return null;
    }
    if(meta.table==='documents'){
      const label=clean(first(body,['title','document_no','doc_no']))||'业务单据';
      if(deleted)return{type:'document.voided',objectType:'document',objectLabel:label,summary:`单据“${label}”已作废或移入回收站。`,detailUrl:detailUrl('recycle'),...common};
      if(restored)return{type:'document.restored',objectType:'document',objectLabel:label,summary:`单据“${label}”已恢复。`,detailUrl:detailUrl('documents',id),...common};
      const status=clean(body.status);
      if(meta.method==='PATCH'&&/review|pending_approval/i.test(status))return{type:'document.review_requested',objectType:'document',objectLabel:label,summary:`单据“${label}”已提交审核。`,detailUrl:detailUrl('documents',id),...common};
      if(meta.method==='PATCH'&&/approved|rejected/i.test(status))return{type:'document.reviewed',objectType:'document',objectLabel:label,summary:`单据“${label}”的审核状态已更新为 ${status}。`,detailUrl:detailUrl('documents',id),...common};
      if(meta.method==='PATCH'&&/sent/i.test(status))return{type:'document.sent',objectType:'document',objectLabel:label,summary:`单据“${label}”已标记发送。`,detailUrl:detailUrl('documents',id),...common};
      return null;
    }
    if(meta.table==='deal_products'){
      const label=clean(first(body,['product_name','name','sku']))||'订单商品明细';
      return{type:'order.items_changed',objectType:'order_item',objectId:id,objectLabel:label,summary:meta.method==='DELETE'?`订单商品“${label}”已移除。`:`订单商品“${label}”的数量、价格或资料已更新。`,amount:first(body,['line_total','unit_price','price'])||null,currency:clean(body.currency),nextAction:'检查订单金额、单据商品行和包装数量是否同步。',detailUrl:detailUrl('deals',body.deal_id||''),...common};
    }
    if(meta.table==='engine_jobs'){
      const status=clean(first(body,['status','state'])),label=clean(first(body,['title','job_type','type']))||'AI任务';
      return{type:/failed|error/i.test(status)?'ai.failed':/confirm|review|pending/i.test(status)?'ai.confirmation_pending':'ai.completed',objectType:'ai_task',objectId:id,objectLabel:label,summary:clean(first(body,['public_message','message','result_summary']))||(/failed|error/i.test(status)?'AI任务执行失败。':/confirm|review|pending/i.test(status)?'AI结果等待确认。':'AI任务状态已更新。'),detailUrl:detailUrl('ai'),...common};
    }
    if(meta.table==='profiles'&&meta.method==='PATCH'&&has(body,['role','roles','account_role','permissions']))return{type:'system.permission_changed',objectType:'profile',objectId:id,objectLabel:clean(first(body,['display_name','email']))||'用户账号',summary:'用户角色或权限已经发生变化。',risk:'权限变化可能影响可见资料和可执行操作。',detailUrl:detailUrl('settings'),...common};
    if(meta.table==='document_versions')return{type:'document.version_saved',objectType:'document',objectId:clean(body.document_id)||id,objectLabel:`单据版本 V${body.version_no||''}`.trim(),summary:`已保存单据版本${body.version_no?` V${body.version_no}`:''}${body.change_note?`：${clean(body.change_note)}`:'。'}`,detailUrl:detailUrl('documents',body.document_id||id),...common};
    if(meta.table==='catalog_projects'){
      const label=clean(first(body,['title','name']))||'产品目录';
      if(deleted)return{type:'system.recycle_moved',objectType:'catalog',objectLabel:label,summary:`产品目录“${label}”已删除。`,detailUrl:detailUrl('catalog'),...common};
      return null; /* Successful saves already dispatch HUIDI:catalog-saved with richer context. */
    }
    if(meta.table==='payment_milestones'){
      const status=clean(body.status);return{type:/overdue/i.test(status)?'order.payment_overdue':'order.payment_received',objectType:'payment',objectId:id,objectLabel:'订单付款节点',summary:/overdue/i.test(status)?'订单付款节点已逾期。':'订单付款节点状态已更新。',amount:first(body,['amount','paid_amount'])||null,currency:clean(body.currency),detailUrl:detailUrl('deals',body.deal_id||''),...common};
    }
    if(meta.table==='shipment_milestones')return{type:/shipped|completed/i.test(clean(body.status))?'order.shipped':'order.delivery_changed',objectType:'shipment',objectId:id,objectLabel:'订单交付节点',summary:/shipped|completed/i.test(clean(body.status))?'订单交付节点已完成。':'订单交期或交付节点已更新。',detailUrl:detailUrl('deals',body.deal_id||''),...common};
    if(meta.table==='smart_capture_sessions'&&meta.method==='POST')return{type:'import.completed',objectType:'smart_capture',objectId:id,objectLabel:'智能资料识别',summary:'智能录入资料已核对并保存。',nextAction:'检查客户、商品、询盘和单据候选结果。',detailUrl:detailUrl('ai'),...common};
    if(meta.table==='deal_activities'&&meta.method==='POST'){
      const activity=clean(body.activity_type),channel=clean(body.channel);if(/mail|email/i.test(activity+channel))return{type:/failed/i.test(activity)?'mail.failed':'mail.sent',objectType:'mail_activity',objectId:id,objectLabel:clean(body.summary)||'客户邮件',summary:clean(body.summary)||'客户邮件活动已记录。',detailUrl:detailUrl('deals',body.deal_id||''),...common};
    }
    if(meta.table==='workspace_templates'&&deleted)return{type:'system.recycle_moved',objectType:'template',objectLabel:clean(first(body,['title']))||'业务模板',summary:'业务模板已移入回收站。',detailUrl:detailUrl('recycle'),...common};
    if(meta.table==='brand_profiles'&&deleted)return{type:'system.recycle_moved',objectType:'brand',objectLabel:clean(first(body,['company_name','company_name_en']))||'品牌资料',summary:'品牌资料已移入回收站。',detailUrl:detailUrl('recycle'),...common};
    return null;
  }

  window.fetch=async function(input,init){
    const meta=restMutation(input,init);const response=await originalFetch(input,init);
    if(meta&&response.ok){
      const copy=response.clone();queueMicrotask(async()=>{try{const text=await copy.text(),data=safeJson(text);const event=mutationEvent(meta,data);if(event)await emit(event);}catch(error){console.warn('HUIDI notification mutation bridge skipped an event',error);}});
    }
    return response;
  };

  document.addEventListener('click',event=>{
    const target=event.target.closest?.('button,a,[data-action]');if(!target)return;
    const action=target.dataset?.action||'';
    if(action==='mail-open-selected')setTimeout(()=>emit({type:'mail.opened_external',objectType:'mail_draft',objectLabel:document.querySelector('#mail-subject')?.value||'邮件草稿',summary:'邮件草稿已打开到外部邮箱，最终发送状态需在邮箱中确认。',nextAction:'检查收件人、附件和正文后再发送。',detailUrl:detailUrl('mail'),metadata:{dedupeKey:`mail.open:${document.querySelector('#mail-draft-id')?.value||Date.now()}`}}),350);
    if(target.matches?.('[data-export]'))setTimeout(()=>emit({type:'export.data_completed',objectType:'data_export',objectLabel:target.textContent?.trim()||'业务资料',summary:'当前账号的业务资料导出已开始。',detailUrl:location.href,metadata:{dedupeKey:`data.export:${target.dataset.export}:${Date.now()}`}}),500);
    if(action==='recycle-batch-delete'||action==='empty-recycle-bin')setTimeout(()=>emit({type:'system.high_risk_delete',objectType:'recycle',objectLabel:'回收站资料',summary:action==='empty-recycle-bin'?'已执行清空回收站操作。':'已执行批量永久删除操作。',risk:'永久删除后无法恢复。',detailUrl:detailUrl('recycle'),metadata:{dedupeKey:`recycle.permanent:${Date.now()}`}}),700);
    if(action==='recycle-batch-restore')setTimeout(()=>emit({type:'system.recycle_restored',objectType:'recycle',objectLabel:'批量资料',summary:'已执行批量恢复操作。',detailUrl:detailUrl('recycle'),metadata:{dedupeKey:`recycle.restore:${Date.now()}`}}),700);
    if(action==='notification-demo')return;
    if(target.id==='downloadBtn'||target.id==='printBtn')setTimeout(()=>emit({type:'catalog.exported',objectType:'catalog',objectId:new URLSearchParams(location.search).get('project')||'',objectLabel:document.querySelector('#catalogProjectName')?.value||'产品目录',summary:target.id==='downloadBtn'?'产品目录 PDF 已生成或开始下载。':'产品目录已进入打印或另存 PDF。',detailUrl:location.href,metadata:{dedupeKey:`catalog.export:${target.id}:${Date.now()}`}}),1200);
    if(['saveInfo','saveBasic','syncCurrentInfo','bulkAddInfo','bulkFillInfo'].includes(target.id))setTimeout(()=>emit({type:'catalog.updated',objectType:'catalog',objectId:new URLSearchParams(location.search).get('project')||'',objectLabel:document.querySelector('#catalogProjectName')?.value||'产品目录',summary:'产品目录中的商品展示信息已更新。',detailUrl:location.href,metadata:{dedupeKey:`catalog.update:${target.id}:${Date.now()}`}}),450);
  },true);

  document.addEventListener('HUIDI:notifications-ready',()=>{document.documentElement.dataset.fpbRealtimeNotificationBridge=VERSION;},{once:true});
  window.FlypigBOXRealtimeNotificationBridge=Object.freeze({version:VERSION,mutationEvent});
})();
