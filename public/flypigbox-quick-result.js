/* HUIDI V3.3.3.3 — restored live document workspace with export-faithful workbook preview and faithful clipboard import.
   Default: original left-side business editor + right-side live PDF preview.
   Optional: resizable spreadsheet workspace + export-faithful workbook preview.
   All modes edit the same canonical controls, so customer, brand, terms, logistics,
   autosave, histories, PDF and Excel outputs remain connected. */
(()=>{'use strict';
const $=id=>document.getElementById(id),qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DOCS={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票（CI）',packing_list:'装箱单（PL）',sales_contract:'销售合同'};
let mode='document',fullMode=false,importText='',importHtml='';
function getType(){return new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc')||'quotation'}
function closeMenus(except){qsa('.fp-lite-menu[open]').forEach(d=>{if(d!==except)d.open=false})}
function showToast(title,text){let toast=$('fpLiteToast');if(!toast){toast=document.createElement('div');toast.id='fpLiteToast';toast.className='fp-lite-toast';document.body.appendChild(toast)}toast.innerHTML=`<b>${esc(title)}</b><span>${esc(text)}</span>`;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),3600)}
function clickFirst(selectors){for(const selector of selectors){const target=document.querySelector(selector);if(!target)continue;if(target.disabled||target.getAttribute('aria-disabled')==='true'){showToast('登录后可使用','客户、品牌、条款和云端资料会在登录后开放。');return true}target.click();return true}return false}
function scrollCardByTitle(needle){const card=qsa('.form-column .card').find(node=>clean(node.querySelector('h2')?.textContent).includes(needle));if(!card)return false;card.classList.remove('is-collapsed');const body=card.querySelector('.section-collapse-body');if(body)body.hidden=false;card.scrollIntoView({behavior:'smooth',block:'start'});return true}
function openCanonicalSection(kind){
 const cfg=kind==='signature'?{toggle:'showSignature',needle:'电子签名',focus:'signatureFile',label:'签名与公章'}:{toggle:'showPayment',needle:'收款账户',focus:'paymentTemplate',label:'收款信息'};
 const toggle=$(cfg.toggle);if(toggle&&!toggle.checked){toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
 const card=document.querySelector(`[data-optional-section="${cfg.toggle}"]`)||$(cfg.focus)?.closest('section.card')||qsa('.form-column .card').find(node=>clean(node.querySelector('h2')?.textContent).includes(cfg.needle));if(!card){showToast('入口仍在加载',`暂未找到${cfg.label}分栏，请稍后再试。`);return false;}
 card.classList.remove('is-collapsed','is-hidden');const body=card.querySelector('.section-collapse-body');if(body)body.hidden=false;const head=card.querySelector('.section-collapse-head');if(head)head.setAttribute('aria-expanded','true');card.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$(cfg.focus)?.focus({preventScroll:true}),360);return true
}
function openCanonicalPasteDialog(kind='buyer'){
  const cfg=kind==='payment'?{title:'一键粘贴识别收款信息',source:'paymentPasteText',parse:'parsePaymentBtn',placeholder:'粘贴收款人、开户行、账号、SWIFT、银行地址或付款链接等信息。'}:{title:'一键粘贴识别买方信息',source:'buyerPasteText',parse:'parseBuyerBtn',placeholder:'粘贴客户邮件签名、名片文字、询盘内容或完整收货资料。'};
  let dialog=$('fpSharedPasteDialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='fpSharedPasteDialog';dialog.className='fp-shared-paste-dialog';dialog.innerHTML='<div class="inner"><header><div><h3></h3><p>PDF单据与表格工作簿共用同一份字段和识别逻辑。</p></div><button type="button" data-shared-paste-close aria-label="关闭">×</button></header><textarea data-shared-paste-text></textarea><footer><button type="button" data-shared-paste-clear>清空</button><button type="button" class="primary" data-shared-paste-apply>识别并自动填充</button></footer></div>';document.body.appendChild(dialog);dialog.addEventListener('click',event=>{if(event.target.closest('[data-shared-paste-close]'))dialog.close();if(event.target.closest('[data-shared-paste-clear]'))dialog.querySelector('[data-shared-paste-text]').value='';if(event.target.closest('[data-shared-paste-apply]')){const active=dialog._fpPasteCfg;if(!active)return;const original=$(active.source),text=dialog.querySelector('[data-shared-paste-text]').value;if(original){original.value=text;original.dispatchEvent(new Event('input',{bubbles:true}));}$(active.parse)?.click();dialog.close();setTimeout(()=>{window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.();window.FlypigBOXApp?.renderPreview?.();},120);}});}
  dialog._fpPasteCfg=cfg;dialog.querySelector('h3').textContent=cfg.title;const textarea=dialog.querySelector('[data-shared-paste-text]');textarea.placeholder=cfg.placeholder;textarea.value=$(cfg.source)?.value||'';dialog.showModal();setTimeout(()=>textarea.focus(),40);
}
function invokeSource(action){
  if(action==='customer'&&clickFirst(['#openCustomersBtn']))return;
  if(action==='save-customer'&&clickFirst(['#saveCustomerBtn']))return;
  if(action==='save-defaults'&&clickFirst(['#saveDefaultsBtn']))return;
  if(action==='buyer-paste'){openCanonicalPasteDialog('buyer');return;}
  if(action==='brand'&&clickFirst(['#flypigboxTemplateMount button','#flypigboxTemplateMount a','#openTemplateCenterFromAccount']))return;
  if(action==='save-template'&&clickFirst(['#saveTemplateBtn']))return;
  if(action==='products'){openImport();return;}
  if(action==='terms'&&clickFirst(['#openCopyLibraryTermsBtn']))return;
  if(action==='payment'&&clickFirst(['#openPaymentTemplatesBtn']))return;
  if(action==='save-payment'&&clickFirst(['#savePaymentTemplateBtn']))return;
  if(action==='payment-paste'){openCanonicalPasteDialog('payment');return;}
  if(action==='payment-section'){if(document.body.classList.contains('fp-live-table-mode')){window.FlypigBOXLiteEditor?.setMode?.('document',true);setTimeout(()=>openCanonicalSection('payment'),180);}else openCanonicalSection('payment');return;}
  if(action==='signature-section'){if(document.body.classList.contains('fp-live-table-mode')){window.FlypigBOXLiteEditor?.setMode?.('document',true);setTimeout(()=>openCanonicalSection('signature'),180);}else openCanonicalSection('signature');return;}
  if(action==='logistics'&&scrollCardByTitle('物流信息'))return;
  showToast('入口正在加载','稍后再点一次，或在左侧对应栏目中直接使用。');
}
function prepareLayout(){
  const formColumn=document.querySelector('.form-column'),editorTop=$('editorTop');
  if(!formColumn||!editorTop)return;
  if(editorTop.parentElement!==formColumn)formColumn.insertBefore(editorTop,formColumn.firstChild);
  const legacy=$('fpQuickSourceBar');if(legacy)legacy.remove();
}
function buildToolbar(){if($('fpLiteToolbar'))return;const bar=document.createElement('header');bar.id='fpLiteToolbar';bar.className='fp-lite-toolbar';bar.innerHTML=`<div class="fp-lite-toolbar-left"><a href="./workspace.html" class="fp-lite-back" aria-label="返回工作台">←</a><div><strong id="fpLiteTitle">业务单据</strong><small id="fpLiteSaveState">左侧填写 · 右侧实时预览</small></div></div><div class="fp-lite-toolbar-actions"><button type="button" id="fpLiteImportBtn">导入资料</button><div class="fp-primary-workspace-switch" role="group" aria-label="切换工作区"><button type="button" data-primary-mode="document" class="active">PDF 单据</button><button type="button" data-primary-mode="table">表格工作簿</button></div><details class="fp-lite-menu" id="fpLiteExportMenu"><summary>导出</summary><div><button type="button" data-lite-export="pdf"><b>正式 PDF</b><small>用于对外发送</small></button><button type="button" data-lite-export="xlsx"><b>客户 Excel</b><small>方便客户核对</small></button><button type="button" data-lite-export="csv"><b>商品 CSV</b><small>仅商品明细</small></button></div></details><details class="fp-lite-menu" id="fpLiteMoreMenu"><summary aria-label="更多操作">•••</summary><div><button type="button" data-lite-action="draft">保存本机草稿</button><button type="button" data-lite-action="full">显示完整高级区域</button><button type="button" data-lite-action="fields">单据字段设置</button><button type="button" data-lite-action="clear" class="danger">清空当前单据</button></div></details><button type="button" id="fpLiteAccountBtn" class="account">账号</button><button type="button" id="fpLiteVersion" class="version" title="当前系统版本">V3.3.6.13</button></div>`;document.querySelector('.app')?.before(bar);
  bar.addEventListener('click',event=>{
    const primary=event.target.closest('[data-primary-mode]')?.dataset.primaryMode;
    const exportKind=event.target.closest('[data-lite-export]')?.dataset.liteExport;
    const action=event.target.closest('[data-lite-action]')?.dataset.liteAction;
    if(primary)setMode(primary,true);
    if(event.target.id==='fpLiteImportBtn')openImport();
    if(event.target.id==='fpLiteAccountBtn')$('memberAuthBtn')?.click();
    if(event.target.id==='fpLiteVersion')showToast('HUIDI V3.3.6.13','AI悬浮助手现可拖动、自动吸附屏幕边缘并记住位置；前台不再展示内部接口架构名称。');
    if(exportKind){closeMenus();if(exportKind==='pdf')$('exportPdfBtn')?.click();if(exportKind==='xlsx')window.FlypigBOXTableOutput?.exportCustomerExcel?.();if(exportKind==='csv')window.FlypigBOXTableOutput?.exportCsv?.();}
    if(action){closeMenus();if(action==='draft')$('saveDraftBtn')?.click();if(action==='clear')$('clearDocumentBtn')?.click();if(action==='full')toggleFullMode();if(action==='fields')showFieldSettings();}
  });
  qsa('.fp-lite-menu',bar).forEach(d=>d.addEventListener('toggle',()=>{if(d.open)closeMenus(d)}));
  document.addEventListener('click',event=>{if(!event.target.closest('.fp-lite-menu'))closeMenus()});
}
function updateToolbar(){
  const title=$('fpLiteTitle');if(title)title.textContent=DOCS[getType()]||'业务单据';
  const save=$('fpLiteSaveState');if(save)save.textContent=mode==='table'?'左侧批量填写 · 右侧客户版 Excel 导出预览':'左侧填写与资料复用 · 右侧实时 PDF';
  qsa('[data-primary-mode]').forEach(button=>button.classList.toggle('active',button.dataset.primaryMode===mode));
  const account=$('fpLiteAccountBtn'),badge=$('memberBadge');if(account&&badge)account.textContent=/访客|未连接/.test(badge.textContent||'')?'登录':'账号';
  const full=document.querySelector('[data-lite-action="full"]');if(full)full.textContent=fullMode?'收起完整高级区域':'显示完整高级区域';
}
function setMode(next,announce=false){
  mode=next==='table'?'table':'document';
  const left=document.querySelector('.form-column');
  const leftTop=left?.scrollTop||0;
  const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
  document.body.classList.remove('fp-lite-editor-mode','fp-lite-preview-mode','fp-lite-advanced-mode','fp-live-table-mode','fp-table-editor-mode');
  document.body.classList.add('fp-live-document-mode','fp-form-editor-mode');
  document.body.classList.toggle('fp-preview-table-only',mode==='table');
  try{localStorage.setItem('flypigbox_editor_view_mode_v1','form')}catch(_){ }
  const hidden=$('editorViewMode');if(hidden)hidden.value='form';
  window.FlypigBOXTableEditor?.setViewMode?.('form',{announce:false,persist:false});
  if(mode==='table'){
    window.FlypigBOXTableOutput?.setPreviewMode?.('table',{announce:false,persist:false});
    window.FlypigBOXTableOutput?.refresh?.();
  }else{
    window.FlypigBOXTableOutput?.setPreviewMode?.('document',{announce:false,persist:false});
    window.FlypigBOXApp?.renderPreview?.();
  }
  updateToolbar();
  requestAnimationFrame(()=>{
    if(left)left.scrollTop=leftTop;
    if(active&&document.contains(active))active.focus?.({preventScroll:true});
  });
  document.dispatchEvent(new CustomEvent('HUIDI:preview-only-mode-change',{detail:{mode}}));
  if(announce)showToast(mode==='table'?'表格工作簿':'PDF 单据',mode==='table'?'左侧填写区保持不变，仅右侧切换为客户版 Excel 预览。':'左侧填写区保持不变，仅右侧恢复正式 PDF 预览。');
}
function toggleFullMode(){fullMode=!fullMode;document.body.classList.toggle('fp-live-full-mode',fullMode);if(fullMode&&mode!=='document')setMode('document',false);updateToolbar();if(fullMode)$('fpTradeFactoryCenter')?.scrollIntoView({behavior:'smooth',block:'start'})}
function showFieldSettings(){if(mode!=='document')setMode('document',false);document.body.classList.add('fp-show-document-settings');const card=document.querySelector('#editorTop .doc-mode-card');card?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>document.body.classList.remove('fp-show-document-settings'),12000)}
function buildImportModal(){if($('fpLiteImportModal'))return;const modal=document.createElement('div');modal.id='fpLiteImportModal';modal.className='fp-lite-modal';modal.hidden=true;modal.innerHTML=`<div class="fp-lite-modal-card" role="dialog" aria-modal="true" aria-labelledby="fpLiteImportTitle"><header><div><h2 id="fpLiteImportTitle">导入原单据</h2><p>上传 Excel、CSV，或从 Excel / WPS 复制整张表格。</p></div><button type="button" id="fpLiteImportClose" aria-label="关闭">×</button></header><label class="fp-lite-file"><input id="fpLiteImportFile" type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><span>选择文件</span><small id="fpLiteImportFileName">也可以直接粘贴</small></label><textarea id="fpLiteImportText" placeholder="在 Excel / WPS 中复制全部内容，然后在这里按 Ctrl + V…"></textarea><div class="fp-lite-import-options"><label><input id="fpLiteImportReplace" type="checkbox" checked>覆盖当前单据并替换商品</label><button type="button" id="fpLiteClipboard">读取剪贴板</button></div><div id="fpLiteImportStatus" class="fp-lite-import-status">默认按导入内容重新生成当前单据；取消勾选则只补充空白。</div><footer><button type="button" id="fpLiteImportCancel">取消</button><button type="button" id="fpLiteImportApply" class="primary">覆盖生成单据</button></footer></div>`;document.body.appendChild(modal);
  let returnFocus=null;
  const close=()=>{
    modal.hidden=true;
    modal.setAttribute('hidden','');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('fp-lite-modal-open');
    try{sessionStorage.removeItem('flypigbox_open_import_on_load')}catch{}
    const target=returnFocus;returnFocus=null;
    if(target&&document.contains(target))setTimeout(()=>target.focus?.(),0);
  };
  const open=()=>{
    returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modal.hidden=false;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('fp-lite-modal-open');
    setTimeout(()=>$('fpLiteImportText')?.focus(),20);
  };
  modal._fpOpen=open;modal._fpClose=close;
  modal.addEventListener('click',event=>{
    if(event.target===modal||event.target.closest('#fpLiteImportClose,#fpLiteImportCancel'))close();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden){event.preventDefault();close();}},true);
  $('fpLiteClipboard').onclick=async()=>{try{let text='',html='';if(navigator.clipboard?.read){const items=await navigator.clipboard.read();for(const item of items){if(!html&&item.types.includes('text/html'))html=await (await item.getType('text/html')).text();if(!text&&item.types.includes('text/plain'))text=await (await item.getType('text/plain')).text();}}else{text=await navigator.clipboard.readText();}if(!text&&!html)throw new Error('empty');$('fpLiteImportText').value=text;importText=text;importHtml=html;$('fpLiteImportStatus').textContent=html?'已读取带表格结构的剪贴板，点击“覆盖生成单据”。':'已读取剪贴板，点击“覆盖生成单据”。';}catch{$('fpLiteImportStatus').textContent='浏览器未允许读取剪贴板，请在粘贴框中按 Ctrl + V。';$('fpLiteImportText').focus();}};
  $('fpLiteImportText').addEventListener('paste',event=>{importHtml=event.clipboardData?.getData('text/html')||'';window.setTimeout(()=>{importText=$('fpLiteImportText')?.value||'';},0);});
  $('fpLiteImportText').addEventListener('input',event=>{importText=event.target.value;if(!event.isComposing&&event.inputType!=='insertFromPaste')importHtml='';});
  $('fpLiteImportReplace').addEventListener('change',event=>{$('fpLiteImportApply').textContent=event.target.checked?'覆盖生成单据':'补充到当前单据';$('fpLiteImportStatus').textContent=event.target.checked?'将覆盖当前业务字段并替换商品，不影响账号和资料库。':'只填写当前为空的字段，已有内容保留。';});
  $('fpLiteImportFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;$('fpLiteImportFileName').textContent=file.name;$('fpLiteImportStatus').textContent='正在读取文件…';try{importText=await fileToText(file);importHtml='';$('fpLiteImportText').value=importText;$('fpLiteImportStatus').textContent='文件已读取，点击“覆盖生成单据”。';}catch(error){$('fpLiteImportStatus').textContent=error.message||'文件读取失败，请复制表格后粘贴。';}});
  $('fpLiteImportApply').onclick=()=>applyImport(close);
}
function openImport(){buildImportModal();const modal=$('fpLiteImportModal');if(!modal)return;typeof modal._fpOpen==='function'?modal._fpOpen():(modal.hidden=false)}
async function loadXlsx(){throw new Error('Community Local 不从互联网加载 Excel 组件。请使用 .xlsx、CSV、TXT，或直接粘贴表格。')}
function csvToTsv(text){const output=[];let row=[],cell='',quote=false;for(let index=0;index<text.length;index++){const char=text[index],next=text[index+1];if(char==='"'){if(quote&&next==='"'){cell+='"';index++}else quote=!quote}else if(char===','&&!quote){row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quote){if(char==='\r'&&next==='\n')index++;row.push(cell);output.push(row);row=[];cell=''}else cell+=char}if(cell||row.length){row.push(cell);output.push(row)}return output.map(values=>values.join('\t')).join('\n')}
async function fileToText(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='xlsx'&&window.FlypigBOXXlsxLite?.readFile){try{const parsed=await window.FlypigBOXXlsxLite.readFile(file);return window.FlypigBOXXlsxLite.matrixToText(parsed.matrix)}catch(error){console.warn('Local XLSX reader failed, trying compatibility reader.',error)}}if(ext==='xls')throw new Error('Community Local 暂不读取旧版 .xls，请另存为 .xlsx、CSV 或直接粘贴表格。');if(ext==='xlsx')throw new Error('当前 .xlsx 未能被本地读取器识别，请检查文件格式或另存为标准 .xlsx。');const text=await file.text();return ext==='csv'?csvToTsv(text):text}
function applyImport(close){const status=$('fpLiteImportStatus'),text=clean($('fpLiteImportText')?.value||importText);if(!text&&!importHtml){status.textContent='请先粘贴或上传原单据。';return}if(!window.FlypigBOXSmartImport?.parseText||!window.FlypigBOXSmartImport?.apply){status.textContent='识别组件仍在加载，请稍后再试。';return}try{let result=importHtml&&window.FlypigBOXSmartImport.parseHtml?window.FlypigBOXSmartImport.parseHtml(importHtml):null;if(!result||(result.fields.length===0&&result.products.length===0))result=window.FlypigBOXSmartImport.parseText(text);if(!result.fields.length&&!result.products.length){status.textContent='没有识别到可填入内容，请确认复制区域包含字段名和数据。';return}const replace=$('fpLiteImportReplace')?.checked!==false;const out=window.FlypigBOXSmartImport.apply(result,{mode:replace?'replace-all':'safe'});const warning=result.warnings?.[0]?` ${result.warnings[0]}`:'';status.textContent=`已识别 ${result.fields.length} 个字段、${result.products.length} 个商品。${warning}`;setTimeout(()=>{close();window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.();window.FlypigBOXApp?.renderPreview?.();showToast(replace?'单据已重新生成':'资料已补充',`写入 ${out.fields} 个单据字段和 ${result.products.length} 个商品。${warning}`)},360)}catch(error){console.error(error);status.textContent='识别失败，请检查表格内容后重试。'}}
function consumePayload(){let payload=null;try{payload=JSON.parse(sessionStorage.getItem('flypigbox_quick_import_payload')||'null')}catch{}if(!payload?.text)return;const wait=()=>{if(!window.FlypigBOXSmartImport?.parseText||!window.FlypigBOXSmartImport?.apply){setTimeout(wait,80);return}try{const result=window.FlypigBOXSmartImport.parseText(payload.text);window.FlypigBOXSmartImport.apply(result,{mode:payload.fillMode==='safe'?'safe':'replace-all'});sessionStorage.removeItem('flypigbox_quick_import_payload');setTimeout(()=>{window.FlypigBOXApp?.renderPreview?.();window.FlypigBOXTableOutput?.refresh?.();showToast('单据已生成',`识别 ${result.fields.length} 个字段、${result.products.length} 个商品。`)},160)}catch(error){console.error(error);showToast('导入未完成','请点击“导入资料”重新粘贴。')}};wait()}
function boot(){if(!$('piForm')||!document.querySelector('.workbench'))return;document.body.dataset.fpRelease='v3.3.3.3-preview-only-switch';prepareLayout();buildToolbar();window.FlypigBOXSharedActions={invoke:invokeSource,openBuyerPaste:()=>openCanonicalPasteDialog('buyer'),openPaymentPaste:()=>openCanonicalPasteDialog('payment')};buildImportModal();consumePayload();setMode(new URLSearchParams(location.search).get('view')==='table'?'table':'document',false);const accountObserver=new MutationObserver(updateToolbar);if($('memberBadge'))accountObserver.observe($('memberBadge'),{childList:true,characterData:true,subtree:true});document.addEventListener('change',event=>{if(event.target.id==='documentType')updateToolbar()},true);document.addEventListener('HUIDI:document-type-changed',updateToolbar);window.FlypigBOXLiteEditor={setMode,openImport,getMode:()=>mode};if(sessionStorage.getItem('flypigbox_open_import_on_load')==='1'){sessionStorage.removeItem('flypigbox_open_import_on_load');setTimeout(()=>showToast('已进入编辑器','需要导入原单据时，点击顶部“导入资料”。页面不会被导入窗口阻塞。'),220)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();
