/* HUIDI V3.3.6.24-R1.3A.18.4 — engine configuration and Founder OS native routing defaults. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.15';
  const previous=window.FLYPIGBOX_ENGINE_CONFIG||{};
  const configured=previous.connectors||{};
  const clean=value=>String(value??'').trim();
  const endpoint=name=>clean(configured[name]?.endpoint||previous[`${name}Endpoint`]||'');
  const connector=(name,label,kind)=>({
    id:name,label,kind,endpoint:endpoint(name),
    enabled:Boolean(configured[name]?.enabled&&endpoint(name)),
    timeoutMs:Number(configured[name]?.timeoutMs)||45000,
    headers:configured[name]?.headers&&typeof configured[name].headers==='object'?configured[name].headers:{},
    note:clean(configured[name]?.note)
  });
  const osPublic=window.FLYPIGBOX_FOUNDER_OS_BRIDGE_CONFIG||{};
  const osEndpoint=clean(osPublic.apiBaseUrl);
  const CONFIG={
    version:VERSION,
    mode:location.protocol==='file:'?'local_preview':'web',
    safety:{
      allowRemoteUpload:previous.safety?.allowRemoteUpload===true,
      requireHumanConfirmation:previous.safety?.requireHumanConfirmation!==false,
      retainOriginalSource:previous.safety?.retainOriginalSource!==false,
      neverInventMissingValues:true,
      neverExposeServiceSecrets:true,
      osCandidateOnly:true,
      osMayWriteFormalBusinessData:false
    },
    local:{
      deterministicRules:true,
      deterministicCalculation:true,
      textStructureRecognition:true,
      xlsxLite:Boolean(window.FlypigBOXXlsxLite),
      durableBrowserQueue:true
    },
    connectors:{
      founderOS:Object.freeze({
        id:'founderOS',label:'智能处理服务',kind:'native_project_bridge',
        endpoint:osEndpoint,enabled:Boolean(osPublic.enabled&&osEndpoint),
        timeoutMs:Number(osPublic.timeoutMs)||45000,headers:{},
        projectId:clean(osPublic.projectId||'02-APP-FLYPIGBOX'),
        note:'智能处理由受控服务统一提供，页面不保存服务凭据。'
      }),
      workflowGateway:connector('workflowGateway','历史处理入口','legacy_workflow'),
      documentParser:connector('documentParser','历史文件处理','legacy_document_parser'),
      ocr:connector('ocr','图片文字处理','legacy_ocr'),
      pdfRenderer:connector('pdfRenderer','正式文件输出','legacy_pdf_renderer'),
      automationWebhook:connector('automationWebhook','自动处理入口','legacy_automation')
    },
    optionalLibraries:{
      ajv:{detected:Boolean(window.ajv7||window.Ajv),label:'规则校验增强'},
      pagedjs:{detected:Boolean(window.Paged||window.PagedPolyfill),label:'分页排版增强'},
      exceljs:{detected:Boolean(window.ExcelJS),label:'标准表格增强'}
    },
    security:{
      workflowPackageBundled:false,
      workflowBridgeOnly:true,
      nativeProjectBridge:true,
      parallelSupabaseInboxOutbox:false,
      message:'暂未开放的处理功能会明确显示状态，不会假装已经运行。'
    }
  };
  window.FLYPIGBOX_ENGINE_CONFIG=Object.freeze(CONFIG);
})();
