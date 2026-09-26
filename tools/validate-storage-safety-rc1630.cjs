const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const workspace=fs.readFileSync(path.join(root,'public/huidi-local-workspace-v120.js'),'utf8');
const fail=m=>{console.error('[STORAGE-SAFETY] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[STORAGE-SAFETY] PASS:',m);

const start=workspace.indexOf('async function renderStorageHealth(){');
const end=workspace.indexOf('function renderBackup(){',start);
const block=start>=0&&end>start?workspace.slice(start,end):'';
const checks=[
  ['storage health renderer exists',!!block],
  ['backup page invokes storage health renderer',workspace.includes("function renderBackup(){")&&workspace.includes('renderStorageHealth()')],
  ['browser quota estimate is read only',block.includes('HUIDILocalDB?.estimate?.()')||block.includes('navigator.storage?.estimate?.()')],
  ['localStorage usage is estimated',workspace.includes('function localStorageApproxBytes(){')&&block.includes('localStorageApproxBytes()')],
  ['local inline product images are counted',block.includes("startsWith('data:image/')")&&block.includes('inlineImages')],
  ['high-usage warning exists',block.includes('ratio>=.8')&&block.includes('localBytes>=4*1024*1024')],
  ['early warning exists',block.includes('ratio>=.65')&&block.includes('localBytes>=3*1024*1024')],
  ['backup advice remains explicit',block.includes('完整备份')],
  ['health renderer never clears storage',!/(?:localStorage\.clear|localStorage\.removeItem|indexedDB\.deleteDatabase|deleteDocument|remove\()/.test(block)]
];
for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[STORAGE-SAFETY] OK');
