const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');
const read=f=>fs.readFileSync(path.join(pub,f),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'RELEASE-MANIFEST.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const html=read('editor.html'),brand=read('assets/brand/huidi-brand.js'),i18n=read('huidi-doc-i18n-surface-rc164.js');
const unified=read('flypigbox-editor-unified.js'),ui30=read('flypigbox-r1-3a-18-30-ui-runtime.js'),ui39=read('flypigbox-r1-3a-18-39-navigation-plain-language-closure.js'),guest=read('flypigbox-v3-3-6-3-local-guest-ui.js'),sync=read('flypigbox-v3-3-5-0-sync-core.js');
const errors=[];const ok=(c,m)=>{if(!c)errors.push(m)};
ok(/^1\.2\.0-rc16\.\d+(?:\.\d+)?$/.test(pkg.version),'package version is not RC16.18');
ok(/^1\.2\.0-RC16\.\d+(?:\.\d+)?$/.test(manifest.version)&&manifest.release===manifest.version.replace('1.2.0-',''),'release manifest is not RC16.18');
// Logical PDF geometry / late reflow closure.
ok(html.includes('const displayScale=(body.clientHeight||0)>0&&bodyRect.height>0?bodyRect.height/body.clientHeight:1'),'logical/display coordinate normalization missing');
ok(html.includes(".pdf-proposal-grid,.pdf-proposal-grid>main,.pdf-proposal-grid>aside"),'visual grid stretch exclusion missing');
ok(!html.includes('return Math.max(0,bottom,template.scrollHeight||0,template.offsetHeight||0);'),'template shell height is still treated as business content');
ok(html.includes('fpPaginationGuardPx'),'dynamic pagination guard missing');
ok(html.includes('stabilityPass<2'),'bounded stability repagination missing');
ok(html.includes('await document.fonts?.ready'),'font-stability wait missing');
ok(html.includes('rebalanceSparseFinalPage'),'final sparse-tail rebalance missing');
ok(html.includes('rebalanceSparseTailWithProductContext'),'product-context tail rebalance missing');
ok(html.includes('PDF_PRODUCT_TAIL_SELECTOR')&&html.includes('.pdf-brand-finance-row'),'brand finance total is not protected as product tail');
ok(html.includes('HUIDIBrandRuntime?.preparePdf'),'brand normalization is not completed before pagination');
ok(html.includes('HUIDIDocI18nSurface?.preparePdf'),'i18n normalization is not completed before pagination');
ok(html.includes('FlypigBOXA12?.preparePdf'),'formal-output normalization is not completed before pagination');
// Post-pagination observer isolation.
ok(brand.includes("closest?.('#piPaper,.pdf-page,.pdf-template')"),'brand observer is not isolated from PDF');
ok(brand.includes("version:'1.2.0-RC16.21'"),'brand pre-pagination runtime version missing');
ok(i18n.includes("version:'1.2.0-RC16.21'"),'i18n pre-pagination runtime version missing');
ok(i18n.includes("document.body.dataset.huidiStablePagination==='1'&&!prePagination"),'i18n can still rewrite a stable paginated PDF');
ok(unified.includes("if(document.body.dataset.huidiStablePagination==='1')return;"),'fee renderer can still reshape stable paginated PDF');
ok(ui30.includes('#piPaper,.pdf-page,.pdf-template'),'UI30 plain-language walker still traverses PDF');
ok(ui39.includes('#piPaper,.pdf-page,.pdf-template'),'UI39 plain-language walker still traverses PDF');
ok(guest.includes('#piPaper,.pdf-page,.pdf-template'),'guest text sanitizer still traverses PDF');
ok(sync.includes('function fixOutput(options={})')&&sync.includes('prePagination:true'),'formal output fix lacks pre-pagination mode');
// Protected PDF core hashes must remain exact.
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(pub,f))).digest('hex');
ok(sha('flypigbox-v3-3-2-3-pdf-flow-fix.js')==='abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36','protected PDF flow core changed');
ok(sha('flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js')==='570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583','protected formal output gate changed');
if(errors.length){console.error('RC16.11 pagination stability validation FAIL');errors.forEach(e=>console.error(' - '+e));process.exit(1)}
console.log('RC16.11 pagination stability validation PASS');
