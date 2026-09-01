/* HUIDI V3.3.6.24-R1.3A.18.3 — local/cloud job center with safe Supabase mirroring. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.3-JOBS.3';
  const $=(selector,root=document)=>root.querySelector(selector);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const router=()=>window.FlypigBOXEngineRouter;
  const labels={validate_document:'单据检查',spreadsheet_import:'表格导入',text_capture:'文字识别',inquiry_to_quotation:'询盘转报价',document_change_request:'客户修改整理',capture_and_classify:'资料智能整理',translate_document_fields:'单据翻译',translate_catalog_fields:'产品目录翻译',prepare_document_draft:'准备单据草稿',apply_business_command:'业务修改建议',quotation_to_pi:'报价生成PI',order_to_ci_pl:'订单生成CI与PL',render_pdf:'正式PDF任务',document_parse:'历史文件识别',parse_legacy_document:'历史文件识别',image_ocr:'图片识别',ocr_document:'图片识别',document_transform:'生成关联单据',ci_pl_consistency:'CI / PL 一致性核对'};
  const statuses={waiting:'等待处理',running:'处理中',needs_confirmation:'待确认',completed:'已完成',failed:'处理失败',cancelled:'已取消'};
  let cloudMode='checking',cloudError='';
  function cloud(){const core=window.FlypigBOXCloudCore;return{core,client:core?.getClient?.(),user:core?.getUser?.()};}
  async function mirrorJob(job){
    const {client,user}=cloud();if(!client||!user||!job)return false;
    const record={user_id:user.id,task_type:job.taskType,status:job.status||'waiting',requested_engine:job.meta?.route?.id||null,actual_engine:job.engine||null,source_ref:job.id,request:{summary:clean(job.summary).slice(0,180),source_name:clean(job.sourceName).slice(0,160),local_job_id:job.id},result:job.resultSummary?{summary:clean(job.resultSummary).slice(0,180)}:null,error_message:clean(job.error).slice(0,500)||null,attempts:Number(job.attempts||0),rule_pack_version:window.FlypigBOXRulePacks?.version||null,updated_at:new Date().toISOString()};
    try{
      const {error}=await client.from('engine_jobs').upsert(record,{onConflict:'user_id,source_ref'});
      if(error){cloudError=clean(error.message);cloudMode=/does not exist|schema cache|relation/i.test(cloudError)?'migration_required':'unavailable';return false;}
      cloudMode='connected';cloudError='';return true;
    }catch(error){cloudMode='unavailable';cloudError=clean(error?.message);return false;}
  }
  async function testCloud(){
    const {client,user}=cloud();if(!client||!user){cloudMode='local';return false;}
    try{const {error}=await client.from('engine_jobs').select('id').limit(1);if(error)throw error;cloudMode='connected';cloudError='';return true;}catch(error){cloudError=clean(error?.message);cloudMode=/does not exist|schema cache|relation/i.test(cloudError)?'migration_required':'unavailable';return false;}
  }
  function jobs(){return(router()?.queue?.list?.()||[]).slice().sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));}
  const time=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
  function cloudText(){return cloudMode==='connected'?'云端任务表已连接':cloudMode==='migration_required'?'云端任务表尚未建立，当前使用本机记录':cloudMode==='local'?'本地预览使用本机记录':'云端暂不可用，当前使用本机记录';}
  function render(){
    const host=$('#ai-workbench-view');if(!host)return false;
    let section=$('#fp-a18-job-center',host);if(!section){section=document.createElement('section');section.id='fp-a18-job-center';section.className='fp-a18-job-center';const engine=$('#fp-a17-engine-center',host);if(engine)engine.insertAdjacentElement('afterend',section);else host.appendChild(section);}
    const rows=jobs().slice(0,12);
    section.innerHTML=`<div class="fp-a18-job-head"><div><p>任务中心</p><h3>查看处理进度和失败原因</h3><span>${escapeHTML(cloudText())}</span></div><button type="button" data-a18-job-refresh>刷新</button></div><div class="fp-a18-job-list">${rows.length?rows.map(row=>`<article class="fp-a18-job-row"><div><b>${escapeHTML(labels[row.taskType]||row.taskType||'业务任务')}</b><small>${escapeHTML(row.sourceName||row.summary||'未命名任务')} · ${escapeHTML(time(row.updatedAt||row.createdAt))}</small></div><span class="fp-a18-job-status">${escapeHTML(statuses[row.status]||row.status||'待确认')}</span><div class="fp-a18-job-actions">${row.status==='failed'?'<button type="button" data-a18-job-retry="'+escapeHTML(row.id)+'">重新处理</button>':''}${['waiting','running'].includes(row.status)?'<button type="button" data-a18-job-cancel="'+escapeHTML(row.id)+'">取消</button>':''}<button type="button" data-a18-job-remove="${escapeHTML(row.id)}">移除</button></div></article>`).join(''):'<div class="fp-a18-job-empty">暂无任务。使用智能录入、文件识别或单据检查后，处理记录会显示在这里。</div>'}</div><div class="fp-a18-cloud-note">任务记录不保存完整客户原文或文件内容；外部服务未连接时不会上传文件。${cloudError&&cloudMode!=='connected'?` 云端提示：${escapeHTML(cloudError.slice(0,120))}`:''}</div>`;
    return true;
  }
  async function retry(id){
    const job=jobs().find(row=>row.id===id);if(!job)return;
    if(job.taskType==='validate_document'){
      const payload=window.FlypigBOXApp?.formState?.(false);if(payload)return router()?.run?.('validate_document',{payload,documentType:payload?.fields?.documentType,formal:true},{jobId:id});
    }
    router()?.queue?.update?.(id,{status:'waiting',error:'请重新打开原资料后继续处理。'});
    if(window.FlypigBOXSmartCapture?.open)window.FlypigBOXSmartCapture.open();
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-a18-job-refresh]')){testCloud().finally(render);return;}
    const retryId=event.target.closest('[data-a18-job-retry]')?.dataset.a18JobRetry;if(retryId){retry(retryId).finally(render);return;}
    const cancelId=event.target.closest('[data-a18-job-cancel]')?.dataset.a18JobCancel;if(cancelId){const job=router()?.queue?.update?.(cancelId,{status:'cancelled',error:''});mirrorJob(job).finally(render);return;}
    const removeId=event.target.closest('[data-a18-job-remove]')?.dataset.a18JobRemove;if(removeId){router()?.queue?.remove?.(removeId);render();}
  },true);
  document.addEventListener('HUIDI:engine-job',event=>{const job=event.detail?.job;if(job)mirrorJob(job);render();});
  document.addEventListener('HUIDI:cloud-state',()=>{testCloud().finally(render);});
  document.addEventListener('HUIDI:founder-os-state',render);
  document.addEventListener('HUIDI:founder-os-task',render);
  let renderTimer=0;
  function scheduleRender(delay=80){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderTimer=0;render();},delay);
  }
  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(mutation=>{
      const target=mutation.target;
      if(target?.nodeType===1&&target.closest?.('#fp-a18-job-center'))return false;
      return Array.from(mutation.addedNodes||[]).some(node=>node?.nodeType===1&&(node.matches?.('#ai-workbench-view,#fp-a17-engine-center')||node.querySelector?.('#ai-workbench-view,#fp-a17-engine-center')));
    });
    if(relevant)scheduleRender();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>scheduleRender(0),3000);
  testCloud().finally(()=>scheduleRender(0));
  window.FlypigBOXJobCenter=Object.freeze({version:VERSION,list:jobs,mirrorJob,testCloud,getCloudMode:()=>cloudMode});
  document.documentElement.dataset.fpbJobCenter=VERSION;
})();
