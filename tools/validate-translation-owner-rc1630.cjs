const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[TRANSLATION-OWNER] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[TRANSLATION-OWNER] PASS:',m);

const i18n=read('public/huidi-doc-i18n-rc164.js');
const editor=read('public/editor.html');
const schema=read('public/flypigbox-document-schema.js');
const table=read('public/flypigbox-editor-table-output.js');

const requiredDynamic=[
  'balanceDueCondition','customsDescription','finalUse','customsDeclarationNote','mixedPackingNote',
  'qualityStandard','warrantyPeriod','governingLaw','disputeResolution','attachmentList','partialShipmentPlan',
  'consigneeAddress','notifyPartyAddress','billToAddress','shipToAddress','contractClauses'
];
const requiredSections=['party','products','delivery','paymentSchedule','customs','packing','plannedLogistics','actualShipment','payment','qualityRisk','terms'];

const checks=[
 ['translation owner exported',i18n.includes('window.HUIDITranslationOwner=Object.freeze({')],
 ['translation owner has document collector',i18n.includes('collectDocument:collectTranslationDocument')],
 ['translation owner has section collector',i18n.includes('collectSection:collectTranslationSection')],
 ['translation owner has field collector',i18n.includes('collectField:collectTranslationField')],
 ['translation owner has one resolver',i18n.includes('resolve:resolveBusinessValue')],
 ['all required translation sections registered',requiredSections.every(x=>i18n.includes("'"+x+"'"))],
 ['all known dynamic gap fields registered',requiredDynamic.every(x=>i18n.includes(x+':')||i18n.includes("'"+x+"'"))],
 ['protected identifiers registry exists',i18n.includes('TRANSLATION_EXCLUDED_FIELDS')],
 ['product translatable fields registered',i18n.includes("name:'products'")&&i18n.includes("spec:'products'")&&i18n.includes("packageDescription:'packing'")&&i18n.includes("shippingMarks:'packing'")],
 ['custom/logistics translation keys registered',i18n.includes('logisticsExtra:')&&i18n.includes('custom:')],
 ['PDF/editor resolver delegates to owner',editor.includes("owner.resolve(key,original,get('docLanguage'),translationVersions)")],
 ['structured schema delegates values to owner',schema.includes('owner.resolve(id,text,language)')],
 ['table output field values delegate to owner',table.includes('owner.resolve(id,source,languageMode(snapshot),snapshot.translationVersions)')],
 ['table output item values delegate to owner',table.includes("['name','spec','packageDescription','shippingMarks']")&&table.includes('itemKey')&&table.includes('next[field]=owner.resolve')],
 ['table output logistics values delegate to owner',table.includes('logisticsExtra:')&&table.includes('snapshot.translationVersions')],
 ['table output custom values delegate to owner',table.includes('custom:')&&table.includes('customFieldPairs')&&table.includes('snapshot.translationVersions')]
];

for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[TRANSLATION-OWNER] OK');
