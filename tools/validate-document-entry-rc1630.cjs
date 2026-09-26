const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[DOCUMENT-ENTRY] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[DOCUMENT-ENTRY] PASS:',m);

const workspace=read('public/huidi-local-workspace-v120.js');
const start=read('public/document-start.html');
const catalog=read('public/catalog-studio/index.html');

const checks=[
  ['workspace routes launchDoc through document-start',workspace.includes("location.href=`./document-start.html?${qs.toString()}`;return;")],
  ['workspace persists active view in hash',workspace.includes("history.replaceState(null,'',`#${id}`)")],
  ['customer quote uses shared launchDoc owner',workspace.includes("if(a==='customer-quote')launchDoc('quotation',{customerId:id})")],
  ['product quote uses shared launchDoc owner',workspace.includes("if(a==='product-quote')launchDoc('quotation',{productIds:[id]})")],
  ['document-start reads preset deal/customer/product context',start.includes("preset={dealId:startParams.get('deal')||'',customerId:startParams.get('customer')||''")&&start.includes("productIds:startParams.getAll('product').filter(Boolean)")],
  ['document-start applies preset context',start.includes('function applyPreset(){')&&start.includes('render();applyPreset();')],
  ['document-start preserves selections across type changes',start.includes('function snapshotChoice(){')&&start.includes('function restoreChoice(saved){')],
  ['catalog returns with hash route',catalog.includes('../workspace.html#catalog')],
  ['legacy catalog query route removed',!catalog.includes('../workspace.html?view=catalog')]
];

for(const [name,ok] of checks) ok?pass(name):fail(name);

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return /\.(?:js|html)$/.test(entry.name)?[full]:[];
  });
}
const legacyActive=/workspace\.html\?view=(?:documents|products|catalog|customers|deals|mail)\b/;
const legacyHits=walk(path.join(root,'public')).filter(file=>legacyActive.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(root,file));
if(legacyHits.length)fail('legacy active workspace query routes remain: '+legacyHits.join(', '));else pass('active workspace routes use hash navigation');
if(process.exitCode)process.exit(process.exitCode);
console.log('[DOCUMENT-ENTRY] OK');
