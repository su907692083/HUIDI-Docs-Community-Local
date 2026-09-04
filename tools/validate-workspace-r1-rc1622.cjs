const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),fail=[];
const need=(v,m)=>{if(!v)fail.push(m)},sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const pkg=JSON.parse(read('package.json')),manifest=JSON.parse(read('RELEASE-MANIFEST.json')),
  html=read('public/workspace.html'),js=read('public/huidi-workspace-r1-rc1622.js'),css=read('public/huidi-workspace-r1-rc1622.css'),base=read('public/huidi-local-workspace-v120.js');
need(/^1\.2\.0-rc16\.\d+(?:\.\d+)?$/.test(pkg.version),'package identity');
need(/^1\.2\.0-RC16\.\d+(?:\.\d+)?$/.test(manifest.version)&&manifest.release===manifest.version.replace('1.2.0-',''),'manifest identity');
need(html.includes('huidi-workspace-r1-rc1622.css')&&html.includes('huidi-workspace-r1-rc1622.js'),'workspace R1 assets not referenced');
need(html.includes('v'+manifest.version.replace('1.2.0-','1.2.0 ')),'workspace visible identity');
need(js.includes("['工作',['home','deals']]")&&js.includes("['资料',['customers','products']]")&&js.includes("['制作',['catalog','documents']]")&&js.includes("['经营资料',['brands','templates','mail']]")&&js.includes("['数据与设置',['backup','recycle','help']]"),'navigation IA groups missing');
need(js.includes('workspace-r1-attention')&&js.includes('今天 / 已逾期跟进')&&js.includes('待报价 / 谈判')&&js.includes('订单执行中')&&js.includes('近 7 天单据'),'actionable home summary missing');
need(js.includes('workspace-r1-summary')&&js.includes('idsFor(view,key,d)'),'management summary/drilldown missing');
need(js.includes('workspace-r1-drawer')&&js.includes('showDetail(view,id)'),'non-blocking detail drawer missing');
need(!js.includes('new MutationObserver'),'Workspace R1 must not add MutationObserver');
need(css.includes('--ws-sidebar:224px')&&css.includes('.workspace-r1-drawer')&&css.includes('tbody tr.workspace-r1-clickable'),'density/detail styles missing');
need(base.includes(`version:'${manifest.version}'`),'backup release identity not current');
need(sha('public/flypigbox-v3-3-2-3-pdf-flow-fix.js')==='abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36','protected PDF flow core changed');
need(sha('public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js')==='570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583','protected formal output gate changed');
if(fail.length){console.error('RC16.23 WORKSPACE R1 VALIDATION FAILED');fail.forEach(x=>console.error('-',x));process.exit(1)}
console.log('RC16.23 WORKSPACE R1 VALIDATION PASSED');
