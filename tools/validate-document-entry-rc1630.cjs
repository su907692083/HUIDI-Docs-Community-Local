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
  ['customer quote uses shared launchDoc owner',workspace.includes("if(a==='customer-quote')launchDoc('quotation',{customerId:id})")],
  ['product quote uses shared launchDoc owner',workspace.includes("if(a==='product-quote')launchDoc('quotation',{productIds:[id]})")],
  ['document-start reads preset deal/customer/product context',start.includes("preset={dealId:startParams.get('deal')||'',customerId:startParams.get('customer')||''")&&start.includes("productIds:startParams.getAll('product').filter(Boolean)")],
  ['document-start applies preset context',start.includes('function applyPreset(){')&&start.includes('render();applyPreset();')],
  ['catalog returns with hash route',catalog.includes('../workspace.html#catalog')],
  ['legacy catalog query route removed',!catalog.includes('../workspace.html?view=catalog')]
];

for(const [name,ok] of checks) ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[DOCUMENT-ENTRY] OK');
