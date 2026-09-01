/* HUIDI V3.3.6.24-R1.3A.18.3 — router upgrade for formal rules, linkage and cloud-aware jobs. */
(()=>{
  'use strict';
  const base=window.FlypigBOXEngineRouter;if(!base)return;
  const VERSION='V3.3.6.24-R1.3A.18.15-ROUTER.2';
  const clean=value=>String(value??'').trim();
  function registry(){
    const rows=(base.registry?.()||[]).filter(row=>row.id!=='ajv');
    const replace=(id,patch)=>{const index=rows.findIndex(row=>row.id===id);if(index>=0)rows[index]={...rows[index],...patch};else rows.push({id,...patch});};
    replace('native_rules',{label:'正式单据统一规则',category:'rules',status:window.FlypigBOXRulePacks?.version?.includes('R1.3A.18')?'active':'loading',mode:'local',privacy:'本机处理'});
    replace('embedded_schema_runtime',{label:'字段结构检查',category:'rules',status:window.FlypigBOXSchemaRuntime?'active':'loading',mode:'local',privacy:'本机处理'});
    replace('document_linkage',{label:'单据转换与 CI/PL 核对',category:'workflow',status:window.FlypigBOXDocumentLinkage?'active':'loading',mode:'local',privacy:'本机处理'});
    replace('formal_output_gate',{label:'PDF、Excel 与打印统一检查',category:'output',status:window.FlypigBOXFormalOutputGate?'active':'loading',mode:'local',privacy:'本机处理'});
    const cloudStatus=window.FlypigBOXJobCenter?.getCloudMode?.();
    replace('durable_job_queue',{label:'任务中心',category:'queue',status:cloudStatus==='connected'?'connected':'active',mode:cloudStatus==='connected'?'cloud+local':'local',privacy:cloudStatus==='connected'?'仅同步任务摘要':'仅保存在当前浏览器'});
    return rows;
  }
  function classifyTask(input={}){
    const explicit=clean(input.taskType||input.type);if(explicit)return explicit;
    const text=clean(input.text||input.summary).toLowerCase();
    if(/(生成|转换|create|convert).*(pi|形式发票|合同|商业发票|ci|装箱单|pl)/i.test(text))return'document_transform';
    if(/(核对|检查|compare).*(ci|商业发票).*(pl|装箱单)|(ci|商业发票).*(pl|装箱单).*(一致|核对)/i.test(text))return'ci_pl_consistency';
    return base.classifyTask?.(input)||'text_capture';
  }
  function pick(task,input={}){
    if(task==='document_transform')return{id:'document_linkage',status:window.FlypigBOXDocumentLinkage?'active':'loading',reason:'使用确定性字段转换，不会修改或覆盖来源单据。'};
    if(task==='ci_pl_consistency')return{id:'document_linkage',status:window.FlypigBOXDocumentLinkage?'active':'loading',reason:'使用商品、数量、单位和运输字段进行确定性核对。'};
    if(task==='validate_document')return{id:'native_rules',status:'active',reason:'所有正式输出使用同一套规则。'};
    return base.pick?.(task,input)||{id:'unassigned',status:'loading',reason:'任务尚未登记。'};
  }
  async function run(task,input={},options={}){
    const taskType=classifyTask({...input,taskType:task});
    if(taskType==='document_transform'){
      const payload=input.payload||window.FlypigBOXApp?.formState?.(true);const target=input.targetType;
      if(!payload||!target)return{ok:false,taskType,error:'缺少来源单据或目标单据类型。'};
      return{ok:true,taskType,route:pick(taskType,input),result:window.FlypigBOXDocumentLinkage?.convertPayload?.(payload,target)};
    }
    if(taskType==='ci_pl_consistency'){
      if(!input.ciPayload||!input.plPayload)return{ok:false,taskType,error:'需要同时提供商业发票和装箱单。'};
      return{ok:true,taskType,route:pick(taskType,input),result:window.FlypigBOXDocumentLinkage?.compareCiPl?.(input.ciPayload,input.plPayload)};
    }
    return base.run?.(taskType,input,options);
  }
  window.FlypigBOXEngineRouter=Object.freeze({version:VERSION,registry,classifyTask,pick,run,outputRoute:base.outputRoute,queue:base.queue});
  document.dispatchEvent(new CustomEvent('HUIDI:engine-router-ready',{detail:{version:VERSION,registry:registry()}}));
})();
