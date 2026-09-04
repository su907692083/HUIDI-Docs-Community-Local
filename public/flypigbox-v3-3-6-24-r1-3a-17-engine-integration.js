/* HUIDI V3.3.6.24-R1.3A.18.3 — formal rule, router, workbench and document-save integration. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.15-INTEGRATION.2-RC16.14';
  const $=(selector,root=document)=>root.querySelector(selector);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  let intelligenceWrapped=false;
  function config(){return window.FLYPIGBOX_ENGINE_CONFIG||{};}
  function router(){return window.FlypigBOXEngineRouter;}
  function rules(){return window.FlypigBOXRulePacks;}
  function validationSummary(result={}){return{valid:Boolean(result.valid),status:result.status||'',formal:Boolean(result.formal),output:result.output||'preview',engine:result.engine||'deterministic_rules',blocker_count:(result.blockers||[]).length,warning_count:(result.warnings||[]).length,rule_pack_version:result.rulePackVersion||'',checked_at:result.checkedAt||new Date().toISOString()};}
  function engineTrace(payload,type){
    const route=router()?.pick?.('validate_document',{payload,documentType:type})||{id:'native_rules',status:'active'};
    return{version:VERSION,rule_engine:route.id,rule_status:route.status,capture_engine:clean(payload?.fields?.workspaceCaptureEngine||payload?.recognition?.engine||'manual'),saved_at:new Date().toISOString(),human_confirmation_required:config().safety?.requireHumanConfirmation!==false};
  }
  function wrapIntelligence(){
    if(intelligenceWrapped||!window.FlypigBOXDocumentIntelligence||!rules())return false;
    const api=window.FlypigBOXDocumentIntelligence;
    const originalEnrich=api.enrichPayload?.bind(api);
    const originalMeta=api.recordMeta?.bind(api);
    if(!originalEnrich||!originalMeta)return false;
    api.enrichPayload=(payload,type,ctx)=>{
      const summary=originalEnrich(payload,type,ctx);
      const documentType=type||summary?.document_type||payload?.fields?.documentType;
      const result=rules().validate(payload,documentType,{formal:false,includeExisting:false});
      payload.fields=payload.fields||{};
      const gate=window.FlypigBOXFormalOutputGate,currentFingerprint=gate?.fingerprint?.(payload)||'';
      const storedFormalStatus=clean(payload.fields.workspaceLastFormalStatus),storedFormalFingerprint=clean(payload.fields.workspaceLastFormalFingerprint);
      const formalCurrent=Boolean(currentFingerprint&&storedFormalFingerprint===currentFingerprint&&['formal_ready','needs_review'].includes(storedFormalStatus));
      const validationStatus=formalCurrent?storedFormalStatus:(result.status||(result.valid?(result.warnings.length?'draft_needs_review':'draft_ready'):'draft_has_errors'));
      const validation={...validationSummary(result),status:validationStatus,formal:formalCurrent,last_formal_checked_at:formalCurrent?clean(payload.fields.workspaceLastFormalCheckedAt):'',last_formal_output:formalCurrent?clean(payload.fields.workspaceLastFormalOutput):''};
      payload.rule_pack={version:result.rulePackVersion,document_type:result.documentType,validation};
      payload.engine_trace=engineTrace(payload,documentType);
      payload.fields.workspaceRulePackVersion=formalCurrent?(clean(payload.fields.workspaceLastFormalRulePackVersion)||result.rulePackVersion):result.rulePackVersion;
      payload.fields.workspaceValidationStatus=validationStatus;
      payload.fields.workspaceValidationFormal=formalCurrent?'1':'0';
      const validationBlockers=formalCurrent?Number(payload.fields.workspaceLastFormalBlockers||0):result.blockers.length;
      const validationWarnings=formalCurrent?Number(payload.fields.workspaceLastFormalWarnings||0):result.warnings.length;
      payload.fields.workspaceValidationBlockers=String(validationBlockers);
      payload.fields.workspaceValidationWarnings=String(validationWarnings);
      payload.fields.workspaceEngineTrace=JSON.stringify(payload.engine_trace);
      if(summary&&typeof summary==='object'){
        summary.rule_pack_version=payload.fields.workspaceRulePackVersion;
        summary.validation_status=payload.fields.workspaceValidationStatus;
        summary.validation_blockers=validationBlockers;
        summary.validation_warnings=validationWarnings;
        summary.search_text=[summary.search_text,result.documentLabel,result.purpose,payload.fields.workspaceValidationStatus,payload?.fields?.workspaceLinkageGroupId,payload?.fields?.sourceDocumentNo,payload?.fields?.sourceDocumentType].filter(Boolean).join(' ');
      }
      return summary;
    };
    api.recordMeta=(payload,type,ctx)=>{
      api.enrichPayload(payload,type,ctx);
      const meta=originalMeta(payload,type,ctx);
      return{...meta,rule_pack_version:payload?.fields?.workspaceRulePackVersion||null,validation_status:payload?.fields?.workspaceValidationStatus||null};
    };
    intelligenceWrapped=true;
    document.dispatchEvent(new CustomEvent('HUIDI:document-intelligence-extended',{detail:{version:VERSION}}));
    return true;
  }
  function ensureDialog(){
    let dialog=$('#fp-a17-engine-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='fp-a17-engine-dialog';dialog.className='fp-a17-dialog';dialog.innerHTML='<section class="fp-a17-dialog-card"><header><div><p data-fp-a17-eyebrow>处理结果</p><h2 data-fp-a17-title>系统检查</h2></div><button class="fp-a17-dialog-close" type="button" aria-label="关闭">×</button></header><div data-fp-a17-body></div><div class="fp-a17-dialog-actions"><button type="button" class="primary" data-fp-a17-close>知道了</button></div></section>';
    dialog.addEventListener('click',event=>{
      if(event.target===dialog||event.target.closest('[data-fp-a17-close],.fp-a17-dialog-close')){dialog.close();return;}
      const issueButton=event.target.closest('[data-fp-a17-issue-index]');if(issueButton){const issue=dialog.__huidiIssues?.[Number(issueButton.dataset.fpA17IssueIndex)];dialog.close();if(issue)setTimeout(()=>window.HUIDIIssueNavigator?.locate?.(issue),40);}
    });
    document.body.appendChild(dialog);return dialog;
  }
  function showDialog({title='系统检查',eyebrow='处理结果',summary='',tone='ok',issues=[],html=''}={}){
    const dialog=ensureDialog();$('[data-fp-a17-title]',dialog).textContent=title;$('[data-fp-a17-eyebrow]',dialog).textContent=eyebrow;
    const body=$('[data-fp-a17-body]',dialog);
    dialog.__huidiIssues=issues;
    if(html)body.innerHTML=html;
    else body.innerHTML=`<div class="fp-a17-result-summary ${tone}">${escapeHTML(summary)}</div>${issues.length?`<div class="fp-a17-issue-list">${issues.map((row,index)=>`<div class="fp-a17-issue ${row.severity==='blocker'?'blocker':'warning'}"><span>${escapeHTML(row.message||row)}</span>${(row.path||row.fieldId||row.selector||row.itemField)?`<button type="button" data-fp-a17-issue-index="${index}">定位修改</button>`:''}</div>`).join('')}</div>`:''}`;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function stateLabel(state){return({active:'可使用',connected:'服务可用',waiting:'暂未开放',available:'后续可用',loading:'正在准备'}[state]||'待确认');}
  function taskCards(){
    const registry=router()?.registry?.()||[];
    const byId=id=>registry.find(row=>row.id===id)||{};
    const doc=router()?.pick?.('document_parse',{})||byId('documentParser');
    const ocr=router()?.pick?.('image_ocr',{})||byId('ocr');
    const pdf=router()?.outputRoute?.('pdf')||byId('pdfRenderer');
    return[
      {id:'capture',title:'客户消息生成单据草稿',description:'粘贴邮件、聊天或询盘，先识别字段，再由用户核对。',state:'active',action:'开始识别'},
      {id:'spreadsheet',title:'Excel整理商品资料',description:'读取表格结构，核对SKU、数量、价格和规格后再保存。',state:byId('xlsx_lite').status||'active',action:'导入表格'},
      {id:'rules',title:'检查当前单据',description:'核对必填项、金额、重量和不应出现的字段。',state:rules()?'active':'loading',action:'开始检查'},
      {id:'document',title:'历史文件识别',description:'用于PDF、Word和邮件附件，功能开放后可使用。',state:doc.status||'waiting',action:stateLabel(doc.status)},
      {id:'ocr',title:'扫描件与图片识别',description:'用于纸质单据、照片和截图，功能开放后可使用。',state:ocr.status||'waiting',action:stateLabel(ocr.status)},
      {id:'pdf',title:'稳定正式PDF',description:'当前继续使用浏览器输出，后续开放后可统一生成。',state:pdf.status||'waiting',action:pdf.status==='connected'?'已连接':'当前可正常导出'}
    ];
  }
  function publicRegistryRows(){
    const allowed=new Set([
      'native_rules','deterministic_calculation','local_text_structure','xlsx_lite',
      'local_job_queue','embedded_schema_runtime','document_linkage',
      'formal_output_gate','durable_job_queue','founder_os_project_bridge',
      'pagedjs','exceljs'
    ]);
    const labels={
      native_rules:'正式单据统一规则',
      deterministic_calculation:'金额、数量与重量计算',
      local_text_structure:'文字与表格结构识别',
      xlsx_lite:'表格轻量读取',
      local_job_queue:'本机处理记录',
      embedded_schema_runtime:'字段结构检查',
      document_linkage:'单据转换与关联核对',
      formal_output_gate:'文件输出前统一检查',
      durable_job_queue:'处理记录中心',
      founder_os_project_bridge:'智能处理服务',
      pagedjs:'分页排版增强',
      exceljs:'标准表格增强'
    };
    return(router()?.registry?.()||[])
      .filter(row=>allowed.has(row.id))
      .map(row=>({...row,label:labels[row.id]||row.label}));
  }
  function statusRows(){return publicRegistryRows().map(row=>`<div class="fp-a17-status-row" data-state="${escapeHTML(row.status)}"><b>${escapeHTML(row.label)}</b><span>${escapeHTML(stateLabel(row.status))}</span></div>`).join('');}
  function ensureWorkbenchCenter(){
    const host=$('#ai-workbench-view');if(!host)return false;
    let section=$('#fp-a17-engine-center',host);
    if(!section){section=document.createElement('section');section.id='fp-a17-engine-center';section.className='fp-a17-engine-center';const smart=$('#fp-smart-capture-center',host);if(smart)smart.insertAdjacentElement('afterend',section);else host.prepend(section);}
    const registryRows=publicRegistryRows();
    const active=registryRows.filter(row=>['active','connected'].includes(row.status)).length;
    const queued=router()?.queue?.list?.().filter(row=>['waiting','failed'].includes(row.status)).length||0;
    const signature=JSON.stringify({states:registryRows.map(row=>[row.id,row.status]),queued,smart:Boolean(window.FlypigBOXSmartCapture)});
    if(section.dataset.signature===signature)return true;
    section.dataset.signature=signature;
    section.innerHTML=`<div class="fp-a17-engine-head"><div><p>当前可用功能</p><h3>按需要选择处理方式</h3><span>能在本机完成的直接处理；暂未开放的功能会明确显示状态，不会假装已经运行。</span></div><em class="fp-a17-engine-state">${active} 项可使用</em></div><div class="fp-a17-task-grid">${taskCards().map(row=>`<button type="button" class="fp-a17-task" data-fp-a17-task="${row.id}" aria-disabled="${['waiting','available','loading'].includes(row.state)&&['document','ocr'].includes(row.id)?'true':'false'}"><b>${escapeHTML(row.title)}</b><span>${escapeHTML(row.description)}</span><em>${escapeHTML(row.action)}</em></button>`).join('')}</div><details class="fp-a17-engine-details"><summary>查看功能状态</summary><div class="fp-a17-status-list">${statusRows()}</div><p class="fp-a17-queue-note">待处理或失败任务：${queued} 项。文件不会在未得到允许时上传处理。</p></details>`;
    return true;
  }
  function currentPayload(){try{return window.FlypigBOXApp?.formState?.(false)||{fields:{},items:[]};}catch(_){return{fields:{},items:[]};}}
  async function checkCurrentDocument(formal=true){
    const payload=currentPayload();const type=payload?.fields?.documentType||$('#documentType')?.value;
    const response=await router()?.run?.('validate_document',{payload,documentType:type,formal},{persist:false});
    const result=response?.result||rules()?.validate(payload,type,{formal});
    if(!result)return showDialog({title:'规则尚未准备完成',tone:'warn',summary:'请刷新页面后再试。'});
    const issues=[...(result.blockers||[]),...(result.warnings||[])];
    const tone=result.blockers.length?'error':result.warnings.length?'warn':'ok';
    const summary=result.blockers.length?`发现 ${result.blockers.length} 项必须补充、${result.warnings.length} 项建议核对。`:result.warnings.length?`关键内容完整，还有 ${result.warnings.length} 项建议人工核对。`:'当前单据的关键字段与基础规则检查通过。';
    showDialog({title:`${result.documentLabel}检查结果`,eyebrow:result.formal?'正式输出检查':'草稿检查',summary,tone,issues});
    return result;
  }
  function ensureEditorButton(){
    if(!window.FlypigBOXApp||$('[data-fp-a17-check]'))return false;
    const actions=$('#fpTradeFactoryCenter .fp-trade-factory-actions')||$('.editor-top-actions')||$('.top-actions');if(!actions)return false;
    const button=document.createElement('button');button.type='button';button.className='btn secondary fp-a17-editor-check';button.dataset.fpA17Check='1';button.textContent='检查单据';actions.appendChild(button);return true;
  }
  function openCapture(){if(window.FlypigBOXSmartCapture?.open)return window.FlypigBOXSmartCapture.open();location.href='./workspace.html?view=ai&smartCapture=1';}
  async function chooseFile(kind){
    const input=document.createElement('input');input.type='file';input.accept=kind==='document'?'.pdf,.doc,.docx,.eml,.msg,.html,.epub':'.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff';
    input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const result=await router()?.run?.(kind==='document'?'document_parse':'image_ocr',{file,sourceName:file.name});if(result?.waiting)showDialog({title:'功能暂未开放',tone:'warn',summary:`“${file.name}”没有上传。这类文件处理暂未开放，当前文件没有上传。`});else if(result?.ok)showDialog({title:'识别完成',tone:'ok',summary:'结果已经返回，请继续人工核对。'});else showDialog({title:'处理失败',tone:'error',summary:result?.error||'暂时无法处理该文件。'});});input.click();
  }
  function bind(){
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-a17-check]')){event.preventDefault();checkCurrentDocument(true);return;}
      const button=event.target.closest('[data-fp-a17-task]');if(!button)return;
      const task=button.dataset.fpA17Task;
      if(task==='capture')return openCapture();
      if(task==='spreadsheet')return openCapture();
      if(task==='rules'){
        if(window.FlypigBOXApp)return checkCurrentDocument(true);
        return showDialog({title:'请先打开一张单据',tone:'warn',summary:'进入单据编辑器后，可以检查必填项、金额、重量和字段适用性。'});
      }
      if(task==='document'||task==='ocr')return chooseFile(task);
      if(task==='pdf'){
        const route=router()?.outputRoute?.('pdf');return showDialog({title:'PDF输出方式',tone:'ok',summary:route?.reason||'继续使用当前浏览器预览和导出。'});
      }
    },true);
  }
  function observe(){
    const refresh=()=>{wrapIntelligence();ensureWorkbenchCenter();ensureEditorButton();};
    let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,80);}).observe(document.documentElement,{childList:true,subtree:true});
    ['HUIDI:engine-router-ready','HUIDI:engine-job','HUIDI:document-intelligence-extended','HUIDI:founder-os-state','HUIDI:founder-os-task'].forEach(name=>document.addEventListener(name,refresh));
    setInterval(refresh,2500);refresh();
  }
  function boot(){bind();observe();document.documentElement.dataset.fpbEngineFoundation=VERSION;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
