const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const editor=read('public/editor.html');
const i18n=read('public/huidi-doc-i18n-rc164.js');
const schema=read('public/flypigbox-document-schema.js');
const localMode=read('public/community-local-mode.js')+'\n'+read('public/community-local-mode.css');
const tableOutput=read('public/flypigbox-editor-table-output.js');
const localServer=read('tools/local-server.cjs');

const hard=[];const warn=[];
const fail=m=>{hard.push(m);console.error('[TRANSLATION-AUDIT] FAIL:',m)};
const note=m=>{warn.push(m);console.warn('[TRANSLATION-AUDIT] WARN:',m)};
const pass=m=>console.log('[TRANSLATION-AUDIT] PASS:',m);

const langSelect=(editor.match(/<select id="docLanguage"[\s\S]*?<\/select>/)||[''])[0];
const languageOptions=[...langSelect.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]);
languageOptions.length===18?pass('18 output-language choices present'):fail('expected 18 output-language choices, got '+languageOptions.length);
languageOptions.includes('zh')&&languageOptions.includes('bilingual')?pass('Chinese and bilingual modes present'):fail('Chinese/bilingual language modes missing');

editor.includes("zh:'Chinese'")?pass('Chinese translation target name is explicit'):fail('Chinese translation target name must be explicit');

const hiddenByLocal=/headerTranslateBtn[\s\S]{0,500}translateAllBtn|translateAllBtn[\s\S]{0,500}headerTranslateBtn/.test(localMode);
if(hiddenByLocal)note('Community Local currently hides full-document translation entry');
else pass('Community Local does not hard-hide both translation entries');

const hasFull=/async function translateAll\(\)/.test(editor);
const hasSection=/function\s+(?:translateSection|translateScope|translateCurrentSection)\s*\(/.test(editor);
const hasSingle=/function\s+(?:translateField|translateSingleField|translateTargetField)\s*\(/.test(editor);
hasFull?pass('full-document translation implementation exists'):note('full-document translation implementation missing');
hasSection?pass('section translation implementation exists'):note('section translation implementation missing');
hasSingle?pass('single-field translation implementation exists'):note('single-field translation implementation missing');

const collect=(editor.match(/function collectScopeFields\(scope\)\{[\s\S]*?return fields;\n  \}/)||[''])[0];
const currentScopes=['party','products','logistics','payment','terms'].filter(x=>collect.includes("scope==='"+x+"'"));
console.log('[TRANSLATION-AUDIT] INFO: full-document collector scopes = '+currentScopes.join(', '));
['delivery','paymentSchedule','customs','packing','actualShipment','qualityRisk'].forEach(x=>{
  if(!collect.includes("scope==='"+x+"'"))note('structured section not explicitly collected for business translation: '+x);
});

const structuredLabels=[...schema.matchAll(/label:\s*\[\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)].map(m=>({zh:m[1],en:m[2]}));
const phraseEns=new Set([...i18n.matchAll(/add\('([^']*)'\s*,/g)].map(m=>m[1]));
const directMissing=structuredLabels.filter(x=>!phraseEns.has(x.en));
console.log('[TRANSLATION-AUDIT] INFO: structured labels='+structuredLabels.length+', direct 18-language phrase misses='+directMissing.length);
if(directMissing.length)note('many structured labels depend on alias/core fallback instead of direct 18-language entries');

const expectedBusinessText=[
 'balanceDueCondition','customsDescription','finalUse','customsDeclarationNote','mixedPackingNote',
 'qualityStandard','warrantyPeriod','governingLaw','disputeResolution','attachmentList','partialShipmentPlan',
 'consigneeAddress','notifyPartyAddress','billToAddress','shipToAddress','contractClauses'
];
const uncovered=expectedBusinessText.filter(id=>!collect.includes("'"+id+"'")&&!collect.includes('"'+id+'"'));
console.log('[TRANSLATION-AUDIT] INFO: expected dynamic text not in current collector = '+uncovered.join(', '));
if(uncovered.length)note('dynamic business text fields remain outside translateAll collector');

const tableUsesTranslations=(tableOutput.match(/translationVersions/g)||[]).length;
console.log('[TRANSLATION-AUDIT] INFO: table output translationVersions references = '+tableUsesTranslations);
if(tableUsesTranslations<4)note('table/workbook output only partially consumes translated business text');

if((localServer.match(/translat/gi)||[]).length===0)note('local server exposes no translation endpoint; Local automated business translation has no same-origin service');
else pass('local server contains a translation service path');

console.log(JSON.stringify({
  languages:languageOptions,
  hardFailures:hard,
  warnings:warn,
  directStructuredLabelMisses:directMissing.map(x=>x.en),
  uncoveredBusinessTextFields:uncovered
},null,2));

if(hard.length)process.exit(1);
console.log('[TRANSLATION-AUDIT] COMPLETE');
