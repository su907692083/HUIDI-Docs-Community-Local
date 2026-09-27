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

const hard=[],warn=[];
const fail=m=>{hard.push(m);console.error('[TRANSLATION-AUDIT] FAIL:',m)};
const note=m=>{warn.push(m);console.warn('[TRANSLATION-AUDIT] WARN:',m)};
const pass=m=>console.log('[TRANSLATION-AUDIT] PASS:',m);

const langSelect=(editor.match(/<select id="docLanguage"[\s\S]*?<\/select>/)||[''])[0];
const languageOptions=[...langSelect.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]);
languageOptions.length===18?pass('18 output-language choices present'):fail('expected 18 output-language choices, got '+languageOptions.length);
languageOptions.includes('zh')&&languageOptions.includes('bilingual')?pass('Chinese and bilingual modes present'):fail('Chinese/bilingual language modes missing');
editor.includes("zh:'Chinese'")?pass('Chinese translation target name is explicit'):fail('Chinese translation target name must be explicit');

const localHidesTranslate=/\['[^\]]*translateAllBtn[^\]]*\]/.test(localMode)||/\.huidi-community-local\s+#translateAllBtn/.test(localMode);
localHidesTranslate?note('Community Local still hard-hides full-document translation'):pass('Community Local translation entry is allowed');

const hasFull=/async function translateAll\(\)/.test(editor);
const hasSection=/async function translateSection\(sectionKey\)/.test(editor)&&i18n.includes('collectSection:collectTranslationSection');
const hasSingle=/async function translateField\(key\)/.test(editor)&&i18n.includes('collectField:collectTranslationField');
hasFull?pass('full-document translation implementation exists'):fail('full-document translation implementation missing');
hasSection?pass('section translation implementation exists'):fail('section translation implementation missing');
hasSingle?pass('single-field translation implementation exists'):fail('single-field translation implementation missing');

const requiredSections=['party','products','delivery','paymentSchedule','customs','packing','plannedLogistics','actualShipment','payment','qualityRisk','terms'];
const currentScopes=requiredSections.filter(x=>i18n.includes("'"+x+"'"));
console.log('[TRANSLATION-AUDIT] INFO: canonical translation sections = '+currentScopes.join(', '));
const missingSections=requiredSections.filter(x=>!currentScopes.includes(x));
missingSections.length?fail('canonical translation owner missing sections: '+missingSections.join(', ')):pass('all required translation sections registered');

const structuredLabels=[...schema.matchAll(/label:\s*\[\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)].map(m=>({zh:m[1],en:m[2]}));
const phraseEns=new Set([...i18n.matchAll(/add\((?:'([^']*)'|\"([^\"]*)\")\s*,/g)].map(m=>m[1]||m[2]));
const directMissing=structuredLabels.filter(x=>!phraseEns.has(x.en));
console.log('[TRANSLATION-AUDIT] INFO: structured labels='+structuredLabels.length+', direct 18-language phrase misses='+directMissing.length);
directMissing.length?fail('structured labels missing direct 18-language entries: '+directMissing.length):pass('all structured labels have direct 18-language entries');
const directLines=i18n.split(/\r?\n/).filter(line=>/^add\((?:'|")/.test(line.trim()));
const directEntryCount=new Map();
for(const line of directLines){
  const strings=line.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)||[];
  if(strings.length<2)continue;
  const en=strings[0].slice(1,-1);directEntryCount.set(en,strings.length);
}
const directDefinitionCount=new Map();
for(const line of directLines){
  const strings=line.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)||[];
  if(strings.length<2)continue;
  const en=strings[0].slice(1,-1);
  directDefinitionCount.set(en,(directDefinitionCount.get(en)||0)+1);
}
const duplicateDirect=structuredLabels.map(x=>({en:x.en,count:directDefinitionCount.get(x.en)||0})).filter(x=>x.count!==1);
duplicateDirect.length?fail('structured labels must have exactly one direct definition: '+JSON.stringify(duplicateDirect)):pass('all structured labels have exactly one direct definition');
const directArityProblems=structuredLabels.map(x=>({en:x.en,count:directEntryCount.get(x.en)||0})).filter(x=>x.count!==17);
directArityProblems.length?fail('structured labels without complete 17-string direct entry: '+JSON.stringify(directArityProblems)):pass('all structured direct entries contain 17 strings');

const expectedBusinessText=[
 'balanceDueCondition','customsDescription','finalUse','customsDeclarationNote','mixedPackingNote',
 'qualityStandard','warrantyPeriod','governingLaw','disputeResolution','attachmentList','partialShipmentPlan',
 'consigneeAddress','notifyPartyAddress','billToAddress','shipToAddress','contractClauses'
];
const uncovered=expectedBusinessText.filter(id=>!i18n.includes(id+':')&&!i18n.includes("'"+id+"'"));
console.log('[TRANSLATION-AUDIT] INFO: dynamic text missing from owner = '+uncovered.join(', '));
uncovered.length?fail('dynamic business text missing from canonical translation owner'):pass('known dynamic business text gaps are registered');

const tableUsesTranslations=(tableOutput.match(/HUIDITranslationOwner/g)||[]).length;
console.log('[TRANSLATION-AUDIT] INFO: table/workbook translation owner references = '+tableUsesTranslations);
tableUsesTranslations>=3?pass('table/workbook uses shared translation owner'):fail('table/workbook does not sufficiently use shared translation owner');

localServer.includes("/api/translation/translate")?pass('local server contains same-origin translation service'):fail('local same-origin translation service missing');
editor.includes("fetch('/api/translation/translate'")?pass('Local editor calls same-origin translation service'):fail('Local editor is not wired to same-origin translation service');

console.log(JSON.stringify({
  languages:languageOptions,
  hardFailures:hard,
  warnings:warn,
  directStructuredLabelMisses:directMissing.map(x=>x.en),
  uncoveredBusinessTextFields:uncovered
},null,2));

if(hard.length)process.exit(1);
console.log('[TRANSLATION-AUDIT] COMPLETE');
