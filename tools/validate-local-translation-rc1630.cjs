const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[LOCAL-TRANSLATION] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[LOCAL-TRANSLATION] PASS:',m);

const server=read('tools/local-server.cjs');
const editor=read('public/editor.html');
const ui=read('public/huidi-local-translation-ui-rc1630.js');
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
 ['section translation uses translation owner',editor.includes("owner.collectSection(key,state)")],
 ['single-field translation uses translation owner',editor.includes("owner.collectField(key,state)")],
 ['bilingual translation groups by opposite target',editor.includes('function translationTargetForText')&&editor.includes('const groups=new Map()')],
 ['field translation gives visible completion feedback',ui.includes("'已译'")&&ui.includes("'重试'")],
 ['field translate button stays compact',ui.includes('width:auto!important')&&ui.includes('max-width:54px')],
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
