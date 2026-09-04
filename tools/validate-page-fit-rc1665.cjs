const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');
const read=f=>fs.readFileSync(path.join(pub,f),'utf8');
const html=read('editor.html'),js=read('huidi-page-fit-workspace-rc1665.js'),css=read('huidi-page-fit-workspace-rc1665.css'),qf=read('flypigbox-quotation-quick-flow.js');
const errors=[];const ok=(c,m)=>{if(!c)errors.push(m)};
ok(html.includes('huidi-page-fit-workspace-rc1665.css'),'editor missing RC16.6.5 css');
ok(html.includes('huidi-page-fit-workspace-rc1665.js'),'editor missing RC16.6.5 js');
ok(js.includes("flypigbox_quotation_pdf_density_v1"),'page-fit does not reuse canonical quotation density key');
ok(js.includes("data-huidi-page-fit=\\\"one-page\\\"")||js.includes('data-huidi-page-fit="one-page"'),'preview toolbar lacks visible one-page control');
ok(js.includes("pages===2&&itemCount()<=6"),'one-page controller lacks bounded stronger-fit rule');
ok(css.includes('data-huidi-page-fit-level="2"'),'one-page level-2 CSS missing');
ok(css.includes('paper-landscape-mode.fp-live-document-mode .app'),'landscape workspace width rule missing');
ok(js.includes("LANDSCAPE_SPLIT_KEY")&&js.includes("defaultSplit"),'orientation-aware split persistence missing');
ok(!qf.includes('data-fp-qf-layout-toggle>优先一页'),'legacy one-page button still injected in common quotation conditions');
ok(/const next=isQuotation\(\)&&onePage/.test(qf),'quick-flow still gates one-page behind quickMode');
ok(qf.includes('setOnePage'),'quick-flow does not expose canonical one-page setter');
if(errors.length){console.error('RC16.6.5 validation FAIL');errors.forEach(e=>console.error(' - '+e));process.exit(1)}
console.log('RC16.6.5 page-fit / landscape workspace validation PASS');
