/* HUIDI V3.3.6.24-R1.3A.18.3 — local rules plus Founder OS native task routing. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.15-ROUTER.1';
  const QUEUE_KEY='flypigbox_engine_jobs_v1';
  const clean=value=>String(value??'').trim();
  const now=()=>new Date().toISOString();
  const uid=()=>`job_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const config=()=>window.FLYPIGBOX_ENGINE_CONFIG||{safety:{},connectors:{},optionalLibraries:{}};
  const bridge=()=>window.FlypigBOXFounderOSBridge||null;
  const readQueue=()=>{try{const data=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(data)?data:[];}catch(_){return[];}};
  const writeQueue=rows=>{try{localStorage.setItem(QUEUE_KEY,JSON.stringify((rows||[]).slice(-200)));return true;}catch(_){return false;}};
  function emit(name,detail){document.dispatchEvent(new CustomEvent(name,{detail}));}
  function queueAdd(task,input={},meta={}){
    const record={id:uid(),taskType:task,status:'waiting',engine:'unassigned',sourceName:clean(input?.file?.name||input?.sourceName),summary:clean(input?.summary||input?.text||'等待处理').slice(0,180),createdAt:now(),updatedAt:now(),attempts:0,error:'',meta};
    const rows=readQueue();rows.push(record);writeQueue(rows);emit('HUIDI:engine-job',{action:'created',job:record});return record;
  }
  function queueUpdate(id,patch={}){
    const rows=readQueue();const index=rows.findIndex(row=>row.id===id);if(index<0)return null;
    rows[index]={...rows[index],...patch,updatedAt:now()};writeQueue(rows);emit('HUIDI:engine-job',{action:'updated',job:rows[index]});return rows[index];
  }
  function queueRemove(id){const rows=readQueue();const next=rows.filter(row=>row.id!==id);writeQueue(next);emit('HUIDI:engine-job',{action:'removed',id});return next.length!==rows.length;}
  function osSnapshot(){try{return bridge()?.snapshot?.()||{status:'waiting',connected:false,configured:Boolean(config().connectors?.founderOS?.endpoint),capabilityCount:0};}catch(_){return{status:'waiting',connected:false,configured:false,capabilityCount:0};}}
  function osSupports(task){try{return Boolean(bridge()?.supports?.(task));}catch(_){return false;}}
  function osStateFor(task){
    const snap=osSnapshot();
    if(!snap.configured)return{status:'waiting',reason:'智能处理服务尚未配置。'};
    if(!snap.connected)return{status:'waiting',reason:'智能处理服务暂未就绪。'};
    if(task&&!osSupports(task))return{status:'waiting',reason:'当前账号暂未开放这项功能。'};
    return{status:'connected',reason:'系统会选择合适的处理方式，结果仍需人工确认。'};
  }
  function registry(){
    const cfg=config(),snap=osSnapshot();
    const local=[
      {id:'native_rules',label:'单据规则检查',category:'rules',status:window.FlypigBOXRulePacks?'active':'loading',mode:'local',privacy:'本机处理'},
      {id:'deterministic_calculation',label:'金额、数量与重量计算',category:'calculation',status:window.FlypigBOXDocumentIntelligence?'active':'loading',mode:'local',privacy:'本机处理'},
      {id:'local_text_structure',label:'文字与表格结构识别',category:'capture',status:window.FlypigBOXSmartCapture?'active':'loading',mode:'local',privacy:'本机处理'},
      {id:'xlsx_lite',label:'Excel轻量读取',category:'spreadsheet',status:window.FlypigBOXXlsxLite?'active':'loading',mode:'local',privacy:'本机处理'},
      {id:'local_job_queue',label:'本机任务记录',category:'queue',status:'active',mode:'local',privacy:'仅保存必要摘要'}
    ];
    const optional=[
      {id:'ajv',label:'规则校验增强',category:'rules',status:(window.ajv7||window.Ajv)?'active':'available',mode:'optional',privacy:'本机处理'},
      {id:'pagedjs',label:'分页排版增强',category:'output',status:(window.Paged||window.PagedPolyfill)?'active':'available',mode:'optional',privacy:'本机处理'},
      {id:'exceljs',label:'标准表格增强',category:'output',status:window.ExcelJS?'active':'available',mode:'optional',privacy:'本机处理'}
    ];
    const native=[{
      id:'founder_os_project_bridge',label:'智能处理服务',category:'native_project_bridge',
      status:snap.connected?'connected':snap.status==='checking'?'loading':'waiting',mode:'remote',
      privacy:'当前用户身份＋受控任务＋必要摘要',endpointConfigured:Boolean(snap.configured),
      capabilityCount:Number(snap.capabilityCount||0),projectId:snap.projectId||cfg.connectors?.founderOS?.projectId||'02-APP-FLYPIGBOX'
    }];
    const legacy=Object.values(cfg.connectors||{}).filter(row=>row.id!=='founderOS').map(row=>({
      id:row.id,label:row.label,category:row.kind,status:row.enabled?'available':'waiting',mode:'legacy_remote',privacy:'默认不启用',endpointConfigured:Boolean(row.endpoint)
    }));
    return[...local,...optional,...native,...legacy];
  }
  function extension(file){return clean(file?.name).split('.').pop().toLowerCase();}
  function classifyTask(input={}){
    const explicit=clean(input.taskType||input.type);if(explicit)return explicit;
    const ext=extension(input.file);
    if(['png','jpg','jpeg','webp','bmp','tif','tiff'].includes(ext))return'image_ocr';
    if(['pdf','doc','docx','ppt','pptx','eml','msg','html','epub'].includes(ext))return'document_parse';
    if(['xlsx','xls','csv','tsv'].includes(ext))return'spreadsheet_import';
    const text=clean(input.text||input.summary).toLowerCase();
    if(/(生成|制作|create).*(报价|quotation)|询盘|inquiry/.test(text))return'inquiry_to_quotation';
    if(/(修改|变更|change|update).*(数量|价格|地址|付款)/.test(text))return'document_change_request';
    if(/(检查|核对|validate|review).*(单据|发票|装箱|合同)/.test(text))return'validate_document';
    return'text_capture';
  }
  const OS_TEXT_TASKS=new Set(['capture_and_classify','inquiry_to_quotation','prepare_document_draft','translate_document_fields','translate_catalog_fields','apply_business_command','document_change_request','quotation_to_pi','order_to_ci_pl']);
  const OS_FILE_TASKS=new Set(['parse_legacy_document','ocr_document']);
  function hasRemoteSource(input={}){return Boolean(clean(input.sourceRef||input.source_ref||input.sourceUrl||input.source_url||input.payload?.source_ref||input.payload?.source_url));}
  function pick(task,input={}){
    if(task==='validate_document')return{id:'native_rules',status:'active',reason:'正式字段、金额和禁用内容必须由确定性规则检查。'};
    if(task==='spreadsheet_import')return{id:window.FlypigBOXXlsxLite?'xlsx_lite':'local_text_structure',status:window.FlypigBOXXlsxLite?'active':'loading',reason:'优先读取表格结构，再进入人工核对。'};
    const mapped=task==='document_parse'?'parse_legacy_document':task==='image_ocr'?'ocr_document':task==='stable_pdf_render'?'render_pdf':task;
    if(OS_FILE_TASKS.has(mapped)){
      const os=osStateFor(mapped);
      if(os.status==='connected'&&hasRemoteSource(input))return{id:'founder_os_project_bridge',status:'connected',taskType:mapped,reason:'文件已进入受控处理，结果仍需人工确认。'};
      if(os.status==='connected'&&input.file)return{id:'founder_os_project_bridge',status:'waiting',taskType:mapped,reason:'文件处理尚未开放，当前文件不会上传。'};
      return{id:'founder_os_project_bridge',status:'waiting',taskType:mapped,reason:os.reason};
    }
    if(task==='stable_pdf_render'||task==='render_pdf'){
      const os=osStateFor('render_pdf');
      if(os.status==='connected'&&(input.html||input.payload||input.sourceRef||input.source_ref))return{id:'founder_os_project_bridge',status:'connected',taskType:'render_pdf',reason:'由受控文件服务生成正式文件。'};
      return{id:'founder_os_project_bridge',status:'available',taskType:'render_pdf',reason:os.status==='connected'?'OS已开放PDF能力；现有导出按钮仍继续使用浏览器输出，待正式联调后切换。':os.reason};
    }
    if(OS_TEXT_TASKS.has(task)){
      const os=osStateFor(task);
      if(os.status==='connected')return{id:'founder_os_project_bridge',status:'connected',taskType:task,reason:os.reason};
      if(['capture_and_classify','inquiry_to_quotation','document_change_request'].includes(task))return{id:window.FlypigBOXSmartCapture?'local_text_structure':'unassigned',status:window.FlypigBOXSmartCapture?'active':'loading',reason:`${os.reason} 当前先使用本地结构识别安全降级。`};
      return{id:'founder_os_project_bridge',status:'waiting',taskType:task,reason:os.reason};
    }
    if(task==='text_capture')return{id:window.FlypigBOXSmartCapture?'local_text_structure':'unassigned',status:window.FlypigBOXSmartCapture?'active':'loading',reason:'普通文字资料优先在本机识别。'};
    return{id:'unassigned',status:'waiting',reason:'当前任务类型尚未登记。'};
  }
  function osTaskInput(task,input={}){
    const common={text:clean(input.text),payload:input.payload??null,metadata:input.metadata||{},source_ref:clean(input.sourceRef||input.source_ref||input.payload?.source_ref),source_url:clean(input.sourceUrl||input.source_url||input.payload?.source_url)};
    if(task==='render_pdf')return{html:input.html||input.payload?.html||'',document:input.payload?.document||input.payload||null,options:input.options||input.metadata||{}};
    return common;
  }
  async function runThroughOS(task,input,options={}){
    const client=bridge();if(!client)throw new Error('智能处理服务尚未加载。');
    let snap=client.snapshot?.()||{};
    if(!snap.connected){await client.getCapabilities?.({force:true});snap=client.snapshot?.()||{};}
    if(!snap.connected||!client.supports?.(task))throw new Error('当前账号暂未开放这项功能。');
    const finalTask=await client.runTask(task,osTaskInput(task,input),{wait:options.wait!==false,language:input.outputLanguage||input.language||'auto',context:input.context||{},requestId:options.requestId,signal:options.signal,maxPollMs:options.maxPollMs,pollIntervalMs:options.pollIntervalMs});
    return finalTask?.result??finalTask?.output??finalTask?.candidate??finalTask;
  }
  async function run(task,input={},options={}){
    const taskType=classifyTask({...input,taskType:task});
    const route=pick(taskType,input);
    let job=options.jobId?readQueue().find(row=>row.id===options.jobId):null;
    if(!job&&options.persist!==false)job=queueAdd(taskType,input,{route});
    if(job)queueUpdate(job.id,{status:['waiting','available'].includes(route.status)?'waiting':'running',engine:route.id,attempts:Number(job.attempts||0)+1});
    emit('HUIDI:engine-task',{phase:'start',taskType,route,jobId:job?.id||null});
    try{
      let result;
      if(taskType==='validate_document'){
        const payload=input.payload||window.FlypigBOXApp?.formState?.(false)||{fields:{},items:[]};
        result=window.FlypigBOXRulePacks?.validate?.(payload,input.documentType,{formal:input.formal===true})||{valid:false,blockers:[{message:'规则引擎尚未加载。'}],warnings:[]};
      }else if(route.id==='founder_os_project_bridge'&&route.status==='connected'){
        result=await runThroughOS(route.taskType||taskType,input,options);
      }else if(taskType==='spreadsheet_import'||taskType==='text_capture'||['capture_and_classify','inquiry_to_quotation','document_change_request'].includes(taskType)){
        if(window.FlypigBOXSmartCapture?.recognize)result=await window.FlypigBOXSmartCapture.recognize(clean(input.text),{matrix:input.matrix,outputLanguage:input.outputLanguage||'auto'});
        else throw new Error('本地资料识别尚未准备完成。');
      }else if(['document_parse','image_ocr','parse_legacy_document','ocr_document','translate_document_fields','translate_catalog_fields','prepare_document_draft','apply_business_command','quotation_to_pi','order_to_ci_pl','render_pdf','stable_pdf_render'].includes(taskType)){
        if(job)queueUpdate(job.id,{status:'waiting',engine:route.id,error:route.reason});
        return{ok:false,waiting:true,taskType,route,job,error:route.reason};
      }else throw new Error('当前任务类型尚未登记。');
      if(job)queueUpdate(job.id,{status:'completed',engine:route.id,error:'',resultSummary:clean(result?.summary||result?.message||'处理完成').slice(0,180)});
      emit('HUIDI:engine-task',{phase:'completed',taskType,route,jobId:job?.id||null,result});
      return{ok:true,taskType,route,job,result};
    }catch(error){
      if(job)queueUpdate(job.id,{status:'failed',engine:route.id,error:clean(error?.message)||'任务失败'});
      emit('HUIDI:engine-task',{phase:'failed',taskType,route,jobId:job?.id||null,error});
      return{ok:false,taskType,route,job,error:clean(error?.message)||'任务失败'};
    }
  }
  function outputRoute(kind='pdf'){
    if(kind==='pdf'){
      const os=pick('render_pdf',{});
      if(os.status==='connected')return{id:'founder_os_project_bridge',status:'available',reason:'OS已开放正式PDF能力；现有浏览器导出保持可用，完成一次联调后可切换到OS渲染。'};
      if(window.Paged||window.PagedPolyfill)return{id:'pagedjs',status:'active',reason:'使用浏览器分页适配。'};
      return{id:'browser_pdf',status:'active',reason:'继续使用当前浏览器预览和打印输出。'};
    }
    if(kind==='xlsx')return window.ExcelJS?{id:'exceljs',status:'active',reason:'使用标准表格输出。'}:{id:'current_workbook',status:'active',reason:'继续使用当前表格输出引擎。'};
    return{id:'browser',status:'active',reason:'使用当前本地输出。'};
  }
  window.FlypigBOXEngineRouter=Object.freeze({
    version:VERSION,registry,classifyTask,pick,run,outputRoute,
    queue:Object.freeze({list:readQueue,add:queueAdd,update:queueUpdate,remove:queueRemove,clear:()=>writeQueue([])})
  });
  emit('HUIDI:engine-router-ready',{version:VERSION,registry:registry()});
})();
