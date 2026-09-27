const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[LOCAL-TRANSLATION] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[LOCAL-TRANSLATION] PASS:',m);

const server=read('tools/local-server.cjs');
const editor=read('public/editor.html');
const ui=read('public/huidi-local-translation-ui-rc1630.js');
const tableView=read('public/flypigbox-editor-table-view.js');
const tableOutput=read('public/flypigbox-editor-table-output.js');
const stability=read('public/huidi-runtime-stability-rc1615.js');
const templateCenter=read('public/flypigbox-v8-template-center.js');
const mode=read('public/community-local-mode.js');
const css=read('public/community-local-mode.css');
const gitignore=read('.gitignore');

const checks=[
 ['translation config is gitignored',gitignore.split(/\r?\n/).includes('config/translation.local.json')],
 ['same-origin status route exists',server.includes("p==='/api/translation/status'")],
 ['same-origin config route exists',server.includes("p==='/api/translation/config'")],
 ['same-origin test route exists',server.includes("p==='/api/translation/test'")],
 ['same-origin translate route exists',server.includes("p==='/api/translation/translate'")],
 ['translation routes handled by local server',server.includes("p.startsWith('/api/translation/')")],
 ['default no-key provider exists',server.includes("return'mymemory'")&&server.includes('api.mymemory.translated.net')],
 ['Brazilian Portuguese provider mapping is explicit',server.includes("'pt-BR'")],
 ['Google Cloud provider uses server-side key',server.includes('translation.googleapis.com')&&server.includes("'X-Goog-Api-Key':cfg.google_api_key")],
 ['request text is limited',server.includes('total>16000')&&server.includes('fields.length>96')&&server.includes('text.length>1800')],
 ['browser Local translation uses same-origin API',editor.includes("fetch('/api/translation/translate'")],
 ['Local translation payload uses canonical key',editor.includes("id:x.key||x.id")],
 ['whole-document translation uses translation owner',editor.includes("owner.collectDocument(state)")],
 ['section translation uses translation owner',editor.includes("owner.collectSection(key,state)")||editor.includes("owner.collectSection(section,state)")],
 ['single-field translation uses translation owner',editor.includes("owner.collectField(key,state)")],
 ['bilingual translation groups by opposite target',editor.includes('function translationTargetForText')&&editor.includes('const groups=new Map()')],
 ['field translation gives visible completion feedback',ui.includes("'已译'")&&ui.includes("'重试'")],
 ['field translation shows the translated text beside the source field',ui.includes('function translatedResult(key)')&&ui.includes("note.textContent='译文：'+text")&&ui.includes('syncTranslationResults()')],
 ['table preview refreshes after translation',tableOutput.includes("addEventListener('HUIDI:translation-updated'")&&tableOutput.includes("renderTablePreview({force:true})")],
 ['table preview resolves translated business fields',tableOutput.includes("translated('paymentTerms')")&&tableOutput.includes("translated('sellerAddress')")&&tableOutput.includes("translated('shippingMarks')")&&tableOutput.includes("translated('contractClauses')")],
 ['first-paint curtain fully covers partial UI',editor.includes('正在打开报价单…')&&editor.includes('position:fixed;inset:0')&&editor.includes('background:#f7f9fc')],
 ['whole editor surface is required before first paint',stability.includes('HUIDIToolbarOwner?.isLocked?.()')&&stability.includes("dataset.huidiActionOwner==='rc16.21'")&&stability.includes('window.FlypigBOXTableOutput')&&stability.includes("dataset?.huidiLocalUxRelease==='rc15'")&&stability.includes('>=420')],
 ['startup preview errors retry before becoming visible',editor.includes("startupRetry<8")&&editor.includes('firstPreviewCommitted')&&editor.includes("paper.dataset.fpPreviewStatus='preparing'")&&editor.includes('正在准备预览…')],
 ['first paint no longer drops the boot gate at 3.2 seconds',!editor.includes("remove('huidi-rc1615-boot')},3200")&&stability.includes("'bounded-fallback'")&&stability.includes('},8000);')],
 ['field translation waits for runtime readiness',ui.includes('const api=owner(),rt=runtime();if(!api||!rt)return;')],
 ['field translation does not silently optional-chain runtime',ui.includes("requireRuntime('translateField').translateField")&&!ui.includes("runtime()?.translateField?.")],
 ['translation button capture owns its click',ui.includes('stopImmediatePropagation()')],
 ['runtime readiness errors are surfaced',ui.includes('reportTranslationError')&&ui.includes("setStatus?.(message,'error')")],
 ['field translate button stays compact',ui.includes('width:auto!important')&&ui.includes('max-width:44px')],
 ['table mode exposes canonical field translate controls',ui.includes("#fpTableEditorWorkspace [data-bind-id]")&&ui.includes('input.dataset.bindId')],
 ['table mode exposes product field translate controls',ui.includes("#fpTableEditorWorkspace [data-item-row][data-item-selector]")&&ui.includes('ITEM_SELECTORS')],
 ['table mode exposes custom field translate controls',ui.includes("#fpTableEditorWorkspace [data-custom-field-id]")&&ui.includes("custom:'+id+':value")],
 ['table mode exposes section translate controls',ui.includes('TABLE_SECTION_SECTIONS')&&ui.includes('data-huidi-translate-sections')],
 ['runtime accepts multi-section table translation',editor.includes('const keys=Array.isArray(key)?key:[key]')&&editor.includes('owner.collectSection(section,state)')],
 ['sales contract PDF resolves translated contract clauses',editor.includes("translatedDisplay('terms','contractClauses',get('contractClauses'))")],
 ['five customer document PDF renderers registered',['quotation','proforma_invoice','commercial_invoice','sales_contract','packing_list'].every(x=>editor.includes(x+':render'))],
 ['five PDF styles registered',['classic_business','minimal_trade','formal_contract','brand_showcase','customs_clean'].every(x=>templateCenter.includes(x+':'))],
 ['PDF styles use shared template family',editor.includes('function renderPdfTemplateFamily')&&editor.includes('PDF_DOCUMENT_RENDERERS')],
 ['table workspace mirrors canonical controls',tableView.includes('data-bind-id=')&&tableView.includes('data-item-row=')],
 ['Local translation runtime is exported',editor.includes('window.HUIDITranslationRuntime=Object.freeze({')],
 ['Local translation UI loaded',editor.includes('huidi-local-translation-ui-rc1630.js')],
 ['whole-document button is enabled by Local UI',ui.includes("b.classList.remove('is-hidden')")&&ui.includes("b.textContent='翻译整份单据'")],
 ['section translate control exists',ui.includes('data-huidi-translate-section')&&ui.includes("btn.textContent='翻译本分栏'")],
 ['single-field translate control exists',ui.includes('data-huidi-translate-field')&&ui.includes("btn.textContent='译'")],
 ['provider status is visible',ui.includes("fetch('/api/translation/status'")],
 ['Community Local no longer hides translateAll',!mode.includes("'headerTranslateBtn','translateAllBtn'")&&!mode.includes("'translateAllBtn','fp-ai-widget'")],
 ['Community Local CSS no longer hides translateAll',!css.includes('.huidi-community-local #translateAllBtn')]
];

for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[LOCAL-TRANSLATION] OK');
