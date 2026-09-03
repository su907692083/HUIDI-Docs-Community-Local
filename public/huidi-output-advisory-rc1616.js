/* HUIDI Docs Community Local RC16.16 — advisory-only output owner + responsive export routing. */
(()=>{
  'use strict';
  if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
  if(window.__HUIDIOutputAdvisoryRC1616)return;window.__HUIDIOutputAdvisoryRC1616=true;
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.16-OUTPUT-ADVISORY';
  const $=(s,r=document)=>r?.querySelector?.(s)||null;
  let pdfBusy=false;
  function kindOf(el){
    if(!el)return'';
    if(el.matches?.('#exportPdfBtn,#headerExportPdfBtn,[data-lite-export="pdf"],[data-local-export="pdf"]'))return'pdf';
    const sheet=el.dataset?.sheetExport;
    if(sheet==='customer-xlsx')return'xlsx';
    if(sheet==='data-xlsx')return'data-xlsx';
    if(sheet==='csv')return'csv';
    if(sheet==='internal-xlsx')return'internal-xlsx';if(sheet==='factory-xlsx')return'factory-xlsx';
    const local=el.dataset?.localExport||el.dataset?.liteExport;
    if(['xlsx','data-xlsx','internal-xlsx','factory-xlsx','csv','pdf','print'].includes(local))return local;
    if(el.matches?.('[data-fp-print],[data-action="print-document"],#printDocumentBtn,#printPdfBtn'))return'print';
    return'';
  }
  function advisory(kind){
    let result=null;
    try{result=window.FlypigBOXFormalOutputGate?.check?.(kind==='pdf'?'pdf':kind)||null;}catch(_){ }
    const blockers=Array.isArray(result?.blockers)?result.blockers:[],warnings=Array.isArray(result?.warnings)?result.warnings:[];
    if(blockers.length||warnings.length){
      const total=blockers.length+warnings.length;
      try{window.FlypigBOXApp?.setStatus?.(`导出提醒：当前还有 ${total} 项可继续补充/核对；本次不会阻止导出。可点击“检查”定位修改。`,'');}catch(_){ }
      try{document.dispatchEvent(new CustomEvent('HUIDI:output-advisory',{detail:{kind,blockers,warnings,result}}));}catch(_){ }
    }
    return result;
  }
  function tableApi(){return window.FlypigBOXTableOutput||null;}
  async function doPdf(source='user'){
    if(pdfBusy){try{window.FlypigBOXApp?.setStatus?.('PDF 正在生成，请等待当前导出完成，不会重复启动第二个导出任务。','');}catch(_){ }return false;}
    const app=window.FlypigBOXApp;
    if(typeof app?.exportPdf!=='function'){app?.setStatus?.('PDF 导出器仍在加载，请稍候后重试。','error');return false;}
    advisory('pdf');pdfBusy=true;
    const state=window.FlypigBOXPdfExportState||(window.FlypigBOXPdfExportState={});
    state.unifiedPreflight=true;state.unifiedPreflightReady=true;state.allowCurrentPdfExport=true;state.approvedOnce=true;
    document.documentElement.dataset.huidiPdfExportBusy='1';
    try{
      await new Promise(resolve=>setTimeout(resolve,0));
      return (await app.exportPdf({source,advisoryOnly:true}))!==false;
    }catch(error){
      console.error('HUIDI RC16.16 PDF export failed',error);
      app?.setStatus?.(`PDF 导出失败：${error?.message||error}`,'error');
      return false;
    }finally{
      state.allowCurrentPdfExport=false;state.approvedOnce=false;pdfBusy=false;
      delete document.documentElement.dataset.huidiPdfExportBusy;
    }
  }
  function doTable(kind){
    advisory(kind);
    const api=tableApi();
    if(!api)throw new Error('表格导出组件还在加载，请稍候后重试。');
    if(kind==='xlsx'){if(typeof api.exportCustomerExcel!=='function')throw new Error('客户版 Excel 导出器不可用');return api.exportCustomerExcel();}
    if(kind==='data-xlsx'){if(typeof api.exportDataExcel!=='function')throw new Error('数据版 Excel 导出器不可用');return api.exportDataExcel();}
    if(kind==='csv'){if(typeof api.exportCsv!=='function')throw new Error('CSV 导出器不可用');return api.exportCsv();}
    if(kind==='internal-xlsx'){if(typeof api.exportInternalExcel!=='function')throw new Error('内部核算 Excel 导出器不可用');return api.exportInternalExcel();}
    if(kind==='factory-xlsx'){if(typeof api.exportFactoryExcel!=='function')throw new Error('工厂执行 Excel 导出器不可用');return api.exportFactoryExcel();}
  }
  async function run(kind,{source='user'}={}){
    if(kind==='pdf')return doPdf(source);
    if(kind==='print'){advisory('print');window.print();return true;}
    try{doTable(kind);return true;}catch(error){console.error(error);window.FlypigBOXApp?.setStatus?.(`导出失败：${error?.message||error}`,'error');return false;}
  }
  // Window capture is intentionally the earliest export owner. It runs before the
  // protected document-level formal gate, so validation remains available as an
  // advisory/check surface without being able to block a user-requested export.
  window.addEventListener('click',event=>{
    const el=event.target?.closest?.('#exportPdfBtn,#headerExportPdfBtn,[data-sheet-export],[data-local-export],[data-lite-export],[data-fp-print],[data-action="print-document"],#printDocumentBtn,#printPdfBtn');
    const kind=kindOf(el);if(!kind)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    el.closest?.('details')?.removeAttribute?.('open');
    run(kind,{source:'click'});
  },true);
  window.HUIDIOutputPolicy=Object.freeze({version:VERSION,advisoryOnly:true,neverBlockForCompleteness:true});
  window.HUIDIOutputController=Object.freeze({version:VERSION,run,exportPdf:options=>doPdf(options?.source||'api'),check:advisory,isBusy:()=>pdfBusy});
  document.documentElement.dataset.huidiOutputPolicy='rc16.16-advisory';
})();
