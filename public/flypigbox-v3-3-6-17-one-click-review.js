/* HUIDI V3.3.6.17 — one-click task review, batch mail audit and local draft protection. */
(()=>{'use strict';
  const API=()=>window.FlypigBOXWorkspaceAPI||null;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const clean=v=>String(v||'').trim();
  const nowIso=()=>new Date().toISOString();
  const DRAFT_KEY='flypigbox_mail_drafts_v1';
  const PREF_KEY='flypigbox_mail_preferences_v1';
  const TASK_KEY='flypigbox_ai_task_request_v1';
  const TASK_DRAFT_KEY='flypigbox_ai_task_draft_v2';
  const BATCH_DRAFT_KEY='flypigbox_batch_mail_review_v2';
  const CUSTOMER_SELECTION_KEY='flypigbox_customer_selection_v1';
  const BATCH_MAX=50;
  const supportedLanguages=new Set(['zh','bilingual','en']);
  const selectedCustomers=new Set(readLocal(CUSTOMER_SELECTION_KEY,[]).map(String));
  let batchReview=[];
  let batchStep='settings';
  let taskStep='edit';

  function state(){return API()?.getState?.()||{customers:[],products:[],deals:[],brands:[],selectedProducts:new Set()};}
  function readLocal(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(_){return fallback}}
  function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){API()?.toast?.('当前设备无法保存草稿。',true);return false}}
  function removeLocal(key){try{localStorage.removeItem(key)}catch(_){}}
  function readPending(){try{return sessionStorage.getItem('flypigbox_ai_pending_text_v1')||''}catch(_){return''}}
  function writeTask(task){let ok=false;try{localStorage.setItem(TASK_KEY,JSON.stringify(task));ok=true}catch(_){}try{sessionStorage.setItem(TASK_KEY,JSON.stringify(task));ok=true}catch(_){}return ok}
  function customerName(row){return clean(row?.contact_name)||clean(row?.company_name)||clean(row?.name)||'Customer'}
  function customerCompany(row){return clean(row?.company_name)||clean(row?.name)||''}
  function languageLabel(code){return ({zh:'中文',bilingual:'中英双语',en:'英文',es:'西班牙语',fr:'法语',de:'德语',pt:'葡萄牙语',ar:'阿拉伯语',ja:'日语',ko:'韩语'})[code]||'英文';}
  function defaultBrand(){return API()?.defaultMailBrand?.()||state().brands?.find(x=>x.is_default)||state().brands?.[0]||null}
  function brandSignature(brand){return API()?.mailBrandSignature?.(brand)||[brand?.contact_name,brand?.company_name_en||brand?.company_name,brand?.website,brand?.email].filter(Boolean).join('\n')||'Seller'}
  function productTitle(row){return clean(row?.name)||clean(row?.title)||clean(row?.sku)||'未命名商品'}
  function selectedProductRows(){const st=state();const ids=st.selectedProducts instanceof Set?[...st.selectedProducts].map(String):[];return ids.map(id=>(st.products||[]).find(row=>String(row.id)===id)).filter(Boolean)}
  function saveCustomerSelection(){writeLocal(CUSTOMER_SELECTION_KEY,[...selectedCustomers]);}

  function template(type,row,brand,note=''){
    const name=customerName(row);const lang=row?.preferred_language||'en';const sign=brandSignature(brand);
    const cn={
      followup:['跟进我们之前的沟通',`您好，${name}：\n\n想跟进一下我们之前沟通的内容。如需更新产品资料、价格、样品或交期，请告诉我。`],
      document:['请查收业务单据',`您好，${name}：\n\n相关业务单据已准备好，请查收并核对。如需修改，请在确认前告诉我。`],
      catalog:['产品目录供您选品',`您好，${name}：\n\n现将产品目录发送给您参考。请告诉我您感兴趣的型号、数量和目标市场，我们会进一步准备报价。`],
      payment:['付款事项提醒',`您好，${name}：\n\n温馨提醒您核对当前订单的付款安排。如已经付款，请忽略本邮件并把付款凭证发给我们核对。`],
      aftersales:['售后与使用情况确认',`您好，${name}：\n\n想确认产品到货及使用情况。如有任何质量、包装或使用问题，请及时告诉我们。`],
      outreach:['合作机会沟通',`您好，${name}：\n\n我们希望与贵司探讨相关产品与供应合作。如您愿意，我可以根据您的市场和采购需求准备更合适的产品资料。`]
    };
    const en={
      followup:['Following up on our discussion',`Dear ${name},\n\nI am following up on our recent discussion. Please let me know if you need updated product details, pricing, samples or lead-time information.`],
      document:['Documents for your review',`Dear ${name},\n\nThe related business documents are ready for your review. Please let me know if anything needs to be updated before confirmation.`],
      catalog:['Product catalog for your selection',`Dear ${name},\n\nI am sharing our product catalog for your review. Please let me know the models, quantities and target market you are interested in, so we can prepare a suitable quotation.`],
      payment:['Payment reminder for your order',`Dear ${name},\n\nThis is a friendly reminder to review the payment arrangement for the current order. If payment has already been made, please disregard this message and share the payment slip for confirmation.`],
      aftersales:['After-sales follow-up',`Dear ${name},\n\nI would like to confirm the delivery and product condition. Please let us know if you have any quality, packaging or usage concerns.`],
      outreach:['Potential cooperation opportunity',`Dear ${name},\n\nWe would like to explore a possible product and sourcing cooperation with your company. We can prepare suitable product information based on your market and purchasing needs.`]
    };
    const useCn=lang==='zh';const [subject,body0]=(useCn?cn:en)[type]||(useCn?cn.followup:en.followup);const bilingual=lang==='bilingual';let body=body0;
    if(bilingual){const [,cnBody]=cn[type]||cn.followup;body=`${body0}\n\n---\n\n${cnBody}`;}
    if(clean(note))body+=`\n\n${clean(note)}`;
    body+=useCn||bilingual?`\n\n此致\n${sign}`:`\n\nBest regards,\n${sign}`;
    return {subject,body,needsTranslation:!supportedLanguages.has(lang)};
  }

  function draftFor(type,row,brand,platform,note,batchId,index,total){
    const createdAt=nowIso();const t=template(type,row,brand,note);
    return {id:`mail_${Date.now()}_${index}_${Math.random().toString(36).slice(2,7)}`,batchId,batchIndex:index+1,batchTotal:total,customerId:row.id||'',brandId:brand?.id||'',brandManual:false,brandName:brand?.company_name||brand?.company_name_en||'',brandSignature:brandSignature(brand),customerName:customerName(row),customerCompany:customerCompany(row),customerEmail:clean(row.email)||'待填写客户邮箱',customerCountry:clean(row.country)||'待补充',customerPhone:clean(row.phone),customerLanguage:languageLabel(row.preferred_language||'en'),needsTranslation:t.needsTranslation,mailType:type,subject:t.subject,body:t.body,relatedDocumentType:'',relatedDocumentNo:'',relatedCatalogSummary:'',platform,createdAt,updatedAt:createdAt,lastOpenedAt:'',status:'草稿已生成'};
  }

  function ensureCustomerToolbar(){
    const section=$('#customers');if(!section||$('#fp-customer-batch-bar'))return;const quick=$('.quick-filters',section);if(!quick)return;
    const bar=document.createElement('div');bar.id='fp-customer-batch-bar';bar.className='fp-customer-batch-bar';
    bar.innerHTML='<div><b>批量客户操作</b><span data-fp-customer-selected-count>已选择 0 位客户</span></div><div class="fp-customer-batch-actions"><button type="button" data-fp-select-visible>选择当前结果</button><button type="button" data-fp-clear-customers disabled>取消选择</button><button class="primary" type="button" data-fp-batch-mail disabled>批量生成邮件草稿</button></div>';
    quick.insertAdjacentElement('afterend',bar);syncCustomerToolbar();
  }
  function enhanceCustomerRows(){
    const root=$('#customer-list');if(!root)return;const valid=new Set((state().customers||[]).map(row=>String(row.id)));[...selectedCustomers].forEach(id=>{if(!valid.has(id))selectedCustomers.delete(id)});saveCustomerSelection();
    $$('.table-row',root).forEach(row=>{const id=row.querySelector('[data-open-customer]')?.dataset.openCustomer;if(!id)return;row.dataset.fpCustomerId=id;const first=row.firstElementChild;if(!first||first.querySelector('.fp-customer-select'))return;const label=document.createElement('label');label.className='fp-customer-select';label.title='选择该客户';label.innerHTML=`<input type="checkbox" data-fp-customer-check="${esc(id)}" ${selectedCustomers.has(String(id))?'checked':''}><span>选择</span>`;first.prepend(label);});syncCustomerToolbar();
  }
  function visibleCustomerIds(){return $$('#customer-list .table-row[data-fp-customer-id]').map(row=>String(row.dataset.fpCustomerId)).filter(Boolean)}
  function syncCustomerToolbar(){const bar=$('#fp-customer-batch-bar');if(!bar)return;const count=selectedCustomers.size;$('[data-fp-customer-selected-count]',bar).textContent=`已选择 ${count} 位客户${count>BATCH_MAX?'，最多处理前 50 位':''}`;$('[data-fp-clear-customers]',bar).disabled=!count;$('[data-fp-batch-mail]',bar).disabled=!count;$$('[data-fp-customer-check]').forEach(input=>{input.checked=selectedCustomers.has(String(input.dataset.fpCustomerCheck));});window.FlypigBOXAIWidget?.refresh?.();}
  function selectedCustomerRows(){const all=state().customers||[];return [...selectedCustomers].slice(0,BATCH_MAX).map(id=>all.find(row=>String(row.id)===String(id))).filter(Boolean)}

  function createBatchDialog(){
    if($('#fp-batch-mail-dialog'))return;const dialog=document.createElement('dialog');dialog.id='fp-batch-mail-dialog';dialog.className='modal wide fp-batch-mail-dialog';
    dialog.innerHTML=`<form class="dialog" id="fp-batch-mail-form"><header><div><p>批量邮件草稿</p><h2>逐封审核后保存草稿</h2><span>每位客户生成一封独立草稿，不会把多个客户放进同一封邮件。</span></div><button class="close" type="button" data-fp-batch-close aria-label="关闭">×</button></header><div class="fp-batch-progress"><span data-step="settings" class="active">1 设置内容</span><i>→</i><span data-step="review">2 逐封审核</span></div><div class="fp-batch-mail-body"><section class="fp-batch-mail-settings" data-fp-batch-settings><label>邮件类型<select name="mail_type"><option value="followup">客户跟进</option><option value="document">发送业务单据</option><option value="catalog">发送产品目录</option><option value="payment">付款提醒</option><option value="aftersales">售后回访</option><option value="outreach">开发客户</option></select></label><label>打开邮箱方式<select name="platform"><option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="qq">QQ 邮箱</option><option value="default">默认邮箱 App</option></select></label><label>使用品牌<select name="brand_id"></select></label><label class="full">统一补充内容（可选）<textarea name="note" rows="4" placeholder="例如：请查看附件中的新品目录；本周五前回复可优先安排样品。"></textarea></label><div class="fp-batch-settings-note full">设置只负责生成初稿。下一步可以逐封修改主题、正文或排除某位客户。</div></section><section class="fp-batch-mail-preview"><div class="fp-batch-mail-preview-head"><div><b data-fp-batch-panel-title>收件人检查</b><span data-fp-batch-summary></span></div><button type="button" data-fp-refresh-batch>刷新</button></div><div data-fp-batch-list></div><p data-fp-batch-footnote>缺少邮箱的客户不会进入草稿；其他语言会先生成英文内容并标记待翻译。</p></section></div><footer><button class="btn ghost" type="button" data-fp-batch-discard>放弃本次</button><button class="btn secondary" type="button" data-fp-batch-back hidden>返回设置</button><button class="btn primary" type="submit" data-fp-batch-next>下一步：逐封审核</button></footer></form>`;
    document.body.appendChild(dialog);
  }
  function fillBrandSelect(){const select=$('#fp-batch-mail-form [name="brand_id"]');if(!select)return;const brands=state().brands||[];select.innerHTML=brands.length?brands.map((b,i)=>`<option value="${esc(b.id)}" ${b.is_default||(!brands.some(x=>x.is_default)&&i===0)?'selected':''}>${esc(b.company_name||b.company_name_en||'未命名品牌')}</option>`).join(''):'<option value="">默认署名</option>';}
  function batchSettings(form=$('#fp-batch-mail-form')){const data=new FormData(form);return {mailType:clean(data.get('mail_type'))||'followup',platform:clean(data.get('platform'))||'gmail',brandId:clean(data.get('brand_id')),note:clean(data.get('note'))};}
  function makeBatchReview(preserve=true){
    const form=$('#fp-batch-mail-form');if(!form)return;const settings=batchSettings(form);const brand=(state().brands||[]).find(b=>String(b.id)===settings.brandId)||defaultBrand();const old=new Map((preserve?batchReview:[]).map(item=>[String(item.customerId),item]));
    batchReview=selectedCustomerRows().map((row,index)=>{const generated=draftFor(settings.mailType,row,brand,settings.platform,settings.note,'pending',index,selectedCustomerRows().length);const previous=old.get(String(row.id));return {...generated,include:Boolean(clean(row.email)),missingEmail:!clean(row.email),subject:previous?.subject??generated.subject,body:previous?.body??generated.body,include:previous?.missingEmail?false:(previous?.include??Boolean(clean(row.email)))};});
    saveBatchReviewDraft();
  }
  function saveBatchReviewDraft(){const form=$('#fp-batch-mail-form');if(!form)return;writeLocal(BATCH_DRAFT_KEY,{updatedAt:nowIso(),step:batchStep,settings:batchSettings(form),selectedIds:[...selectedCustomers],items:batchReview.map(item=>({customerId:item.customerId,subject:item.subject,body:item.body,include:item.include}))});}
  function restoreBatchReviewDraft(){const saved=readLocal(BATCH_DRAFT_KEY,null);if(!saved||!Array.isArray(saved.selectedIds))return false;if(!selectedCustomers.size)saved.selectedIds.forEach(id=>selectedCustomers.add(String(id)));saveCustomerSelection();const form=$('#fp-batch-mail-form');if(form&&saved.settings){form.elements.mail_type.value=saved.settings.mailType||'followup';form.elements.platform.value=saved.settings.platform||'gmail';form.elements.note.value=saved.settings.note||'';if(saved.settings.brandId)form.elements.brand_id.value=saved.settings.brandId;}makeBatchReview(false);const edits=new Map((saved.items||[]).map(item=>[String(item.customerId),item]));batchReview=batchReview.map(item=>({...item,...(edits.get(String(item.customerId))||{})}));batchStep=saved.step==='review'?'review':'settings';return true;}
  function renderBatchPreview(){
    const list=$('[data-fp-batch-list]'),summary=$('[data-fp-batch-summary]'),title=$('[data-fp-batch-panel-title]');if(!list||!summary)return;const rows=batchReview;const ready=rows.filter(r=>!r.missingEmail&&r.include);const missing=rows.filter(r=>r.missingEmail);const excluded=rows.filter(r=>!r.missingEmail&&!r.include);const translate=ready.filter(r=>r.needsTranslation);
    summary.textContent=`可保存 ${ready.length} 封 · 缺邮箱 ${missing.length} 位 · 已排除 ${excluded.length} 位${translate.length?` · 待翻译 ${translate.length} 封`:''}`;title.textContent=batchStep==='review'?'逐封审核':'收件人检查';
    if(batchStep==='settings'){
      list.innerHTML=rows.length?rows.map(row=>`<article class="${row.missingEmail?'is-missing':''}"><div><b>${esc(row.customerCompany||row.customerName)}</b><span>${esc(row.customerName)} · ${esc(row.customerLanguage)}</span></div><em>${row.missingEmail?'缺少邮箱，暂不生成':esc(row.customerEmail)}</em>${row.needsTranslation?'<small>待翻译</small>':''}</article>`).join(''):'<div class="empty compact"><b>还没有选择客户</b></div>';
      return;
    }
    list.innerHTML=rows.length?rows.map((row,index)=>`<article class="fp-batch-review-card ${row.missingEmail?'is-missing':''} ${row.include?'':'is-excluded'}" data-review-index="${index}"><div class="fp-batch-review-top"><label><input type="checkbox" data-fp-review-include="${index}" ${row.include&&!row.missingEmail?'checked':''} ${row.missingEmail?'disabled':''}><span>${row.missingEmail?'不可生成':'保留本封'}</span></label><div><b>${esc(row.customerCompany||row.customerName)}</b><span>${esc(row.customerEmail)} · ${esc(row.customerLanguage)}</span></div>${row.needsTranslation?'<small>待翻译</small>':''}</div><label>主题<input data-fp-review-subject="${index}" value="${esc(row.subject)}" ${row.missingEmail?'disabled':''}></label><label>正文<textarea rows="7" data-fp-review-body="${index}" ${row.missingEmail?'disabled':''}>${esc(row.body)}</textarea></label></article>`).join(''):'<div class="empty compact"><b>还没有可审核的客户</b></div>';
  }
  function setBatchStep(step){batchStep=step==='review'?'review':'settings';const settings=$('[data-fp-batch-settings]'),back=$('[data-fp-batch-back]'),next=$('[data-fp-batch-next]');if(settings)settings.hidden=batchStep==='review';if(back)back.hidden=batchStep!=='review';if(next)next.textContent=batchStep==='review'?'保存全部审核草稿':'下一步：逐封审核';$$('.fp-batch-progress [data-step]').forEach(node=>node.classList.toggle('active',node.dataset.step===batchStep));renderBatchPreview();saveBatchReviewDraft();}
  function openBatchDialog(){const rows=selectedCustomerRows();if(!rows.length)return API()?.toast?.('请先选择客户。',true);createBatchDialog();fillBrandSelect();makeBatchReview(false);restoreBatchReviewDraft();syncCustomerToolbar();setBatchStep(batchStep);API()?.openWorkspaceDialog?.($('#fp-batch-mail-dialog'))||$('#fp-batch-mail-dialog').showModal();}
  function saveBatchDrafts(form){
    const rows=batchReview.filter(item=>item.include&&!item.missingEmail);if(!rows.length)return API()?.toast?.('没有可保存的邮件草稿，请保留至少一位有邮箱的客户。',true);if(form.dataset.submitting==='1')return;form.dataset.submitting='1';
    try{
      const batchId=`batch_${Date.now()}`;const generated=rows.map((item,index)=>({...item,id:`mail_${Date.now()}_${index}_${Math.random().toString(36).slice(2,7)}`,batchId,batchIndex:index+1,batchTotal:rows.length,createdAt:nowIso(),updatedAt:nowIso(),status:'草稿已生成'}));
      const existing=readLocal(DRAFT_KEY,[]);const all=[...generated,...(Array.isArray(existing)?existing:[])];const seen=new Set();const normalized=all.filter(d=>{const k=[d.subject,d.customerEmail,d.body].join('\u0001');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,50);if(!writeLocal(DRAFT_KEY,normalized))return;
      const settings=batchSettings(form);writeLocal(PREF_KEY,{...(readLocal(PREF_KEY,{})||{}),defaultPlatform:settings.platform,lastMailType:settings.mailType});removeLocal(BATCH_DRAFT_KEY);selectedCustomers.clear();saveCustomerSelection();batchReview=[];syncCustomerToolbar();API()?.closeWorkspaceDialog?.($('#fp-batch-mail-dialog'))||$('#fp-batch-mail-dialog').close();API()?.handleNav?.('mail');API()?.renderMailCenter?.();API()?.toast?.(`已保存 ${generated.length} 封独立邮件草稿。请逐封核对附件后再打开邮箱发送。`);
    }finally{form.dataset.submitting='0';}
  }

  function createTaskDialog(){
    if($('#fp-ai-task-dialog'))return;const dialog=document.createElement('dialog');dialog.id='fp-ai-task-dialog';dialog.className='modal wide fp-ai-task-dialog';
    dialog.innerHTML=`<form class="dialog" id="fp-ai-task-form"><header><div><p>一键任务准备</p><h2 data-fp-task-title>准备业务任务</h2><span data-fp-task-subtitle>系统先整理上下文，正式结果仍需人工确认。</span></div><button class="close" type="button" data-fp-task-close aria-label="关闭">×</button></header><div class="fp-task-progress"><span data-step="edit" class="active">1 填写任务</span><i>→</i><span data-step="review">2 核对内容</span></div><div class="fp-ai-task-fields" data-fp-task-fields></div><section class="fp-task-review" data-fp-task-review hidden></section><section class="fp-ai-task-check"><b>执行边界</b><span data-fp-task-boundary>不会自动猜测价格、银行账户、付款条款或直接发送邮件。</span></section><footer><button class="btn ghost" type="button" data-fp-task-discard>放弃本次</button><button class="btn secondary" type="button" data-fp-task-back hidden>返回修改</button><button class="btn primary" type="submit" data-fp-task-submit>检查并预览</button></footer></form>`;
    document.body.appendChild(dialog);
  }
  function options(rows,label,selected=''){return `<option value="">${esc(label)}</option>${rows.map(r=>`<option value="${esc(r.id)}" ${String(r.id)===String(selected)?'selected':''}>${esc(r.company_name||r.title||r.name||r.document_no||'未命名')}</option>`).join('')}`}
  function taskDraft(){return readLocal(TASK_DRAFT_KEY,null)}
  function saveTaskDraft(form){if(!form?.dataset.taskKind)return;const data=new FormData(form);const values={};for(const [key,value] of data.entries())values[key]=String(value);writeLocal(TASK_DRAFT_KEY,{kind:form.dataset.taskKind,updatedAt:nowIso(),values});renderTaskResume();}
  function fillTaskDraft(form,kind){const saved=taskDraft();if(!saved||saved.kind!==kind||!saved.values)return;Object.entries(saved.values).forEach(([key,value])=>{const field=form.elements.namedItem(key);if(field&&'value'in field)field.value=value;});}
  function setTaskStep(step){taskStep=step==='review'?'review':'edit';const fields=$('[data-fp-task-fields]'),review=$('[data-fp-task-review]'),back=$('[data-fp-task-back]'),submit=$('[data-fp-task-submit]');if(fields)fields.hidden=taskStep==='review';if(review)review.hidden=taskStep!=='review';if(back)back.hidden=taskStep!=='review';if(submit)submit.textContent=taskStep==='review'?(($('#fp-ai-task-form')?.dataset.taskKind)==='document'?'确认进入单据准备':'确认进入目录制作'):'检查并预览';$$('.fp-task-progress [data-step]').forEach(node=>node.classList.toggle('active',node.dataset.step===taskStep));}
  function openTaskDialog(kind){
    if(kind==='product'){API()?.handleNav?.('products');setTimeout(()=>$('[data-action="import-products"]')?.click(),80);return;}
    if(kind==='batch_mail'){if(selectedCustomerRows().length)return openBatchDialog();API()?.handleNav?.('customers');setTimeout(()=>{ensureCustomerToolbar();API()?.toast?.('请先勾选客户，再点击“批量生成邮件草稿”。');},80);return;}
    createTaskDialog();const st=state(),form=$('#fp-ai-task-form'),fields=$('[data-fp-task-fields]'),title=$('[data-fp-task-title]'),subtitle=$('[data-fp-task-subtitle]');form.dataset.taskKind=kind;taskStep='edit';
    const products=selectedProductRows(),defaultCustomer=(st.customers||[])[0]||null,defaultCurrency=clean(defaultCustomer?.currency)||'USD';
    if(kind==='document'){
      title.textContent='一键准备单据草稿';subtitle.textContent='先核对客户、业务、商品、币种和要求，再进入现有单据流程。';
      fields.innerHTML=`<label>选择客户<select name="customer_id">${options(st.customers||[],'请选择客户')}</select></label><label>关联业务<select name="deal_id">${options(st.deals||[],'暂不关联业务')}</select></label><label>单据类型<select name="document_type"><option value="quotation">报价单</option><option value="proforma_invoice">形式发票（PI）</option><option value="commercial_invoice">商业发票</option><option value="packing_list">装箱单</option><option value="sales_contract">销售合同</option></select></label><label>输出语言<select name="language"><option value="en">英文</option><option value="bilingual">中英双语</option><option value="zh">中文</option></select></label><label>币种<input name="currency" value="${esc(defaultCurrency)}" maxlength="8" placeholder="USD"></label><label>使用品牌<select name="brand_id">${options(st.brands||[],'使用默认品牌')}</select></label><label class="full">已选商品<input value="${products.length} 个" readonly><small>${products.length?esc(products.slice(0,5).map(productTitle).join('、'))+(products.length>5?' 等':''):'可继续到准备页选择商品'}</small></label><label class="full">客户要求或单据说明<textarea name="request_text" rows="7" placeholder="粘贴客户聊天、商品数量、价格、交期、包装和付款要求">${esc(readPending())}</textarea></label><div class="fp-ai-task-warning full">系统只准备草稿上下文。缺少商品、数量、单价、币种、重量或箱规时，仍需要进入编辑器补齐并人工确认。</div>`;
    }else{
      title.textContent='一键准备客户产品目录';subtitle.textContent='先核对客户、语言、价格显示、品牌和商品，再进入目录制作。';
      fields.innerHTML=`<label>选择客户<select name="customer_id">${options(st.customers||[],'暂不选择客户')}</select></label><label>目录语言<select name="language"><option value="en">英文</option><option value="bilingual">中英双语</option><option value="zh">中文</option><option value="es">西班牙语</option><option value="fr">法语</option><option value="de">德语</option></select></label><label>价格显示<select name="price_mode"><option value="show">显示价格</option><option value="hide">隐藏价格</option><option value="inquiry">显示“询价”</option></select></label><label>使用品牌<select name="brand_id">${options(st.brands||[],'使用默认品牌')}</select></label><label class="full">已选商品<input value="${products.length} 个" readonly><small>${products.length?esc(products.slice(0,5).map(productTitle).join('、'))+(products.length>5?' 等':''):'请先在商品资料库勾选商品，或进入目录页后再导入'}</small></label><label class="full">目录要求<textarea name="request_text" rows="7" placeholder="例如：面向美国批发客户，突出500ml与750ml，可定制Logo，不显示采购成本。">${esc(readPending())}</textarea></label><div class="fp-ai-task-warning full">目录制作页仍需检查图片、标题、价格和商品顺序；当前不会未经确认自动导出PDF。</div>`;
    }
    fillTaskDraft(form,kind);setTaskStep('edit');saveTaskDraft(form);API()?.openWorkspaceDialog?.($('#fp-ai-task-dialog'))||$('#fp-ai-task-dialog').showModal();
  }
  function collectTask(form){
    const data=new FormData(form),st=state(),products=selectedProductRows();const customer=(st.customers||[]).find(r=>String(r.id)===String(data.get('customer_id')))||null;const brand=(st.brands||[]).find(r=>String(r.id)===String(data.get('brand_id')))||defaultBrand();const deal=(st.deals||[]).find(r=>String(r.id)===String(data.get('deal_id')))||null;
    return {kind:form.dataset.taskKind,customer,brand,deal,documentType:clean(data.get('document_type'))||'quotation',language:clean(data.get('language'))||'en',currency:clean(data.get('currency'))||clean(customer?.currency)||'USD',priceMode:clean(data.get('price_mode'))||'show',requestText:clean(data.get('request_text')),products};
  }
  function renderTaskPreview(form){
    const info=collectTask(form),review=$('[data-fp-task-review]');if(!review)return;const missingPrice=info.products.filter(p=>!Number(p.suggested_price||p.price||0));const missingImage=info.products.filter(p=>!clean(p.image_url));const checks=[];
    checks.push({label:'客户',value:info.customer?(customerCompany(info.customer)||customerName(info.customer)):'尚未选择',tone:info.customer?'ok':'warn'});
    if(info.kind==='document')checks.push({label:'关联业务',value:info.deal?clean(info.deal.title)||'已关联':'暂不关联',tone:'neutral'});
    checks.push({label:info.kind==='document'?'单据类型':'目录语言',value:info.kind==='document'?({quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'})[info.documentType]||info.documentType:languageLabel(info.language),tone:'ok'});
    checks.push({label:'品牌',value:clean(info.brand?.company_name)||clean(info.brand?.company_name_en)||'使用默认品牌',tone:'neutral'});
    checks.push({label:'已选商品',value:`${info.products.length} 个`,tone:info.products.length?'ok':'warn'});
    if(info.kind==='document')checks.push({label:'币种',value:info.currency||'待补充',tone:info.currency?'ok':'warn'});else checks.push({label:'价格显示',value:({show:'显示价格',hide:'隐藏价格',inquiry:'显示“询价”'})[info.priceMode],tone:'ok'});
    const warnings=[];if(!info.customer)warnings.push('尚未选择客户，进入下一页后仍需补充买方资料。');if(!info.products.length)warnings.push('尚未选择商品，进入下一页后需要继续选择或导入商品。');if(missingPrice.length&&info.kind==='document')warnings.push(`${missingPrice.length} 个商品缺少建议价格，不能直接作为最终报价。`);if(missingImage.length&&info.kind==='catalog')warnings.push(`${missingImage.length} 个商品缺少图片，目录导出前需要补图或隐藏图片。`);if(!info.requestText)warnings.push('尚未填写本次客户要求，后续仍可人工补充。');
    review.innerHTML=`<div class="fp-task-review-head"><div><p>任务核对</p><h3>${info.kind==='document'?'准备单据草稿':'准备产品目录'}</h3></div><span>当前任务保存在本浏览器，换设备不会同步。</span></div><div class="fp-task-review-grid">${checks.map(item=>`<article class="${item.tone}"><small>${esc(item.label)}</small><b>${esc(item.value)}</b></article>`).join('')}</div><section class="fp-task-warning-list"><b>${warnings.length?'仍需注意':'可以继续'}</b>${warnings.length?warnings.map(text=>`<span>• ${esc(text)}</span>`).join(''):'<span>已完成当前可检查的基础信息，进入下一页后仍需人工核对正式内容。</span>'}</section>${info.requestText?`<section class="fp-task-request-preview"><b>本次要求</b><span>${esc(info.requestText)}</span></section>`:''}`;setTaskStep('review');
  }
  function submitTask(form){
    if(taskStep!=='review'){saveTaskDraft(form);return renderTaskPreview(form);}if(form.dataset.submitting==='1')return;form.dataset.submitting='1';
    try{
      const info=collectTask(form);const request={id:`task_${Date.now()}`,kind:info.kind,status:'prepared',createdAt:nowIso(),updatedAt:nowIso(),customerId:info.customer?.id||'',customerName:info.customer?(customerCompany(info.customer)||customerName(info.customer)):'',brandId:info.brand?.id||'',brandName:clean(info.brand?.company_name)||clean(info.brand?.company_name_en),requestText:info.requestText,language:info.language,selectedProductIds:info.products.map(p=>p.id),selectedProductCount:info.products.length};
      if(info.kind==='document'){request.documentType=info.documentType;request.currency=info.currency;request.dealId=info.deal?.id||'';request.dealTitle=clean(info.deal?.title);}
      else request.priceMode=info.priceMode;
      if(!writeTask(request))return API()?.toast?.('当前设备无法保存任务，请先不要关闭页面。',true);removeLocal(TASK_DRAFT_KEY);renderTaskResume();API()?.closeWorkspaceDialog?.($('#fp-ai-task-dialog'))||$('#fp-ai-task-dialog').close();
      if(info.kind==='document'){API()?.prepareDocument?.(request.documentType,{customer:info.customer,deal:info.deal},'ai_assist');return;}
      if(request.selectedProductIds.length&&typeof API()?.openCatalogStudioFromSelectedProducts==='function'){API().openCatalogStudioFromSelectedProducts();return;}
      location.href='./catalog-studio/index.html?source=ai-task';
    }finally{form.dataset.submitting='0';}
  }

  function enhanceAiWorkbench(){
    const root=$('#ai-workbench-view');if(!root)return;const pending=$('.ai-pending-center-v33612',root);if(!pending)return;
    if(!$('#fp-one-click-task-center')){const section=document.createElement('section');section.id='fp-one-click-task-center';section.className='center-section-v2 fp-one-click-task-center';section.innerHTML=`<div class="fp-one-click-head"><div><p>一键任务入口</p><h3>先准备，再确认</h3><span>使用现有客户、商品和业务资料开始任务，不会未经确认直接生成正式文件或发送邮件。</span></div></div><div class="fp-one-click-grid"><button type="button" data-fp-one-click="document"><b>生成单据草稿</b><span>报价单、PI、商业发票、装箱单或销售合同</span></button><button type="button" data-fp-one-click="catalog"><b>生成产品目录</b><span>选择客户、语言、价格显示和已选商品</span></button><button type="button" data-fp-one-click="product"><b>整理商品资料</b><span>上传表格，识别字段、重复SKU和异常行</span></button><button type="button" data-fp-one-click="batch_mail"><b>批量邮件草稿</b><span>多选客户，为每位客户生成独立草稿</span></button></div>`;pending.insertAdjacentElement('afterend',section);}
    renderTaskResume();
  }
  function renderTaskResume(){const root=$('#ai-workbench-view');if(!root)return;let box=$('#fp-task-resume');const saved=taskDraft();if(!saved){box?.remove();return;}if(!box){box=document.createElement('section');box.id='fp-task-resume';box.className='center-section-v2 fp-task-resume';const center=$('#fp-one-click-task-center');center?.insertAdjacentElement('beforebegin',box);}const label=saved.kind==='catalog'?'产品目录任务':'单据任务';const markup=`<div><p>未完成任务</p><h3>${label}</h3><span>最近保存：${esc(new Date(saved.updatedAt||Date.now()).toLocaleString())}。当前内容只保存在本浏览器。</span></div><div><button type="button" data-fp-resume-task="${esc(saved.kind)}">继续填写</button><button type="button" data-fp-discard-saved-task>放弃任务</button></div>`;if(box.innerHTML!==markup)box.innerHTML=markup;}

  function bind(){
    document.addEventListener('change',event=>{
      const input=event.target.closest('[data-fp-customer-check]');if(input){const id=String(input.dataset.fpCustomerCheck);input.checked?selectedCustomers.add(id):selectedCustomers.delete(id);saveCustomerSelection();syncCustomerToolbar();return;}
      const form=event.target.closest('#fp-batch-mail-form');if(form&&event.target.matches('select,textarea')){makeBatchReview(true);renderBatchPreview();saveBatchReviewDraft();return;}
      if(event.target.matches('[data-fp-review-include]')){const index=Number(event.target.dataset.fpReviewInclude);if(batchReview[index])batchReview[index].include=event.target.checked;renderBatchPreview();saveBatchReviewDraft();return;}
      const taskForm=event.target.closest('#fp-ai-task-form');if(taskForm){saveTaskDraft(taskForm);if(taskStep==='review')setTaskStep('edit');}
    },true);
    document.addEventListener('input',event=>{
      const indexSubject=event.target.dataset?.fpReviewSubject,indexBody=event.target.dataset?.fpReviewBody;if(indexSubject!==undefined&&batchReview[Number(indexSubject)])batchReview[Number(indexSubject)].subject=event.target.value;if(indexBody!==undefined&&batchReview[Number(indexBody)])batchReview[Number(indexBody)].body=event.target.value;if(indexSubject!==undefined||indexBody!==undefined){saveBatchReviewDraft();return;}
      const taskForm=event.target.closest('#fp-ai-task-form');if(taskForm){saveTaskDraft(taskForm);if(taskStep==='review')setTaskStep('edit');}
    },true);
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-select-visible]')){visibleCustomerIds().slice(0,BATCH_MAX).forEach(id=>selectedCustomers.add(id));saveCustomerSelection();return syncCustomerToolbar();}
      if(event.target.closest('[data-fp-clear-customers]')){selectedCustomers.clear();saveCustomerSelection();return syncCustomerToolbar();}
      if(event.target.closest('[data-fp-batch-mail]'))return openBatchDialog();
      if(event.target.closest('[data-fp-batch-close]'))return API()?.closeWorkspaceDialog?.($('#fp-batch-mail-dialog'))||$('#fp-batch-mail-dialog')?.close();
      if(event.target.closest('[data-fp-refresh-batch]')){makeBatchReview(true);return renderBatchPreview();}
      if(event.target.closest('[data-fp-batch-back]'))return setBatchStep('settings');
      if(event.target.closest('[data-fp-batch-discard]')){if(!confirm('放弃后将清除本次批量邮件设置和逐封修改，已保存到邮件草稿中心的内容不会受影响。确定放弃吗？'))return;removeLocal(BATCH_DRAFT_KEY);batchReview=[];batchStep='settings';API()?.closeWorkspaceDialog?.($('#fp-batch-mail-dialog'))||$('#fp-batch-mail-dialog')?.close();return;}
      const task=event.target.closest('[data-fp-one-click]');if(task)return openTaskDialog(task.dataset.fpOneClick);
      const resume=event.target.closest('[data-fp-resume-task]');if(resume)return openTaskDialog(resume.dataset.fpResumeTask);
      if(event.target.closest('[data-fp-discard-saved-task],[data-fp-task-discard]')){if(!confirm('放弃后将清除当前浏览器中尚未完成的任务内容。已经创建的客户、商品、业务和单据不会被删除。确定放弃吗？'))return;removeLocal(TASK_DRAFT_KEY);renderTaskResume();const dialog=$('#fp-ai-task-dialog');if(dialog?.open)(API()?.closeWorkspaceDialog?.(dialog)||dialog.close());return;}
      if(event.target.closest('[data-fp-task-close]'))return API()?.closeWorkspaceDialog?.($('#fp-ai-task-dialog'))||$('#fp-ai-task-dialog')?.close();
      if(event.target.closest('[data-fp-task-back]'))return setTaskStep('edit');
    },true);
    document.addEventListener('submit',event=>{if(event.target.id==='fp-batch-mail-form'){event.preventDefault();if(batchStep==='settings'){makeBatchReview(true);setBatchStep('review');return;}return saveBatchDrafts(event.target);}if(event.target.id==='fp-ai-task-form'){event.preventDefault();return submitTask(event.target);}},true);
  }
  function observe(){const customerRoot=$('#customer-list');if(customerRoot)new MutationObserver(enhanceCustomerRows).observe(customerRoot,{childList:true,subtree:true});const aiRoot=$('#ai-workbench-view');if(aiRoot){let aiScheduled=false;const scheduleAiEnhance=()=>{if(aiScheduled)return;aiScheduled=true;requestAnimationFrame(()=>{aiScheduled=false;enhanceAiWorkbench();});};new MutationObserver(scheduleAiEnhance).observe(aiRoot,{childList:true,subtree:true});}new MutationObserver(()=>{ensureCustomerToolbar();enhanceCustomerRows();enhanceAiWorkbench();}).observe(document.body,{attributes:true,attributeFilter:['data-workspace-view']});}
  function boot(){if(!API()){setTimeout(boot,60);return;}ensureCustomerToolbar();enhanceCustomerRows();enhanceAiWorkbench();createBatchDialog();createTaskDialog();bind();observe();window.FlypigBOXOneClickTasks={open:openTaskDialog,openBatch:openBatchDialog,selectedCustomerCount:()=>selectedCustomers.size,resume:()=>{const saved=taskDraft();if(saved?.kind)openTaskDialog(saved.kind);}};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
