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
 ['bilingual companion language resolver exists',i18n.includes('companionLanguage')&&i18n.includes("companionLanguage(original)")],
 ['all required translation sections registered',requiredSections.every(x=>i18n.includes("'"+x+"'"))],
 ['all known dynamic gap fields registered',requiredDynamic.every(x=>i18n.includes(x+':')||i18n.includes("'"+x+"'"))],
 ['protected identifiers registry exists',i18n.includes('TRANSLATION_EXCLUDED_FIELDS')],
 ['product translatable fields registered',i18n.includes("name:'products'")&&i18n.includes("spec:'products'")&&i18n.includes("customsDescription:'products'")&&i18n.includes("originCountry:'products'")&&i18n.includes("packageDescription:'packing'")&&i18n.includes("shippingMarks:'packing'")],
 ['custom/logistics translation keys registered',i18n.includes('logisticsExtra:')&&i18n.includes('custom:')],
 ['table custom groups are part of translation sections',i18n.includes("'basic','party','products','delivery','costs'")&&i18n.includes("'logistics','payment','qualityRisk','terms'")],
 ['table parties custom group aliases to party',i18n.includes("group==='parties'?'party':group")],
 ['PDF/editor resolver delegates to owner',editor.includes("owner.resolve(key,original,get('docLanguage'),translationVersions)")],
 ['structured schema delegates values to owner',schema.includes('owner.resolve(id,text,language)')],
 ['table output field values delegate to owner',table.includes('owner.resolve(id,source,languageMode(snapshot),snapshot.translationVersions)')],
 ['table output item values delegate to owner',table.includes("['name','spec','customsDescription','originCountry','packageDescription','shippingMarks']")&&table.includes('itemKey')&&table.includes('next[field]=owner.resolve')],
 ['table output logistics values delegate to owner',table.includes('logisticsExtra:')&&table.includes('snapshot.translationVersions')],
 ['table output custom values delegate to owner',table.includes('custom:')&&table.includes('customFieldPairs')&&table.includes('snapshot.translationVersions')],
 ['PDF custom fields delegate labels and values to owner',editor.includes('custom:${id}:label')&&editor.includes('custom:${id}:value')],
 ['PDF custom logistics label delegates to owner',editor.includes('logisticsExtra:${row.id}:label')]
];

for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[TRANSLATION-OWNER] OK');
