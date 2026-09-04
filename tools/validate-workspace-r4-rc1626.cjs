const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),http=require('http');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),fail=[];const need=(x,m)=>{if(!x)fail.push(m)};
const manifest=JSON.parse(read('RELEASE-MANIFEST.json')),pkg=JSON.parse(read('package.json')),html=read('public/workspace.html'),js=read('public/huidi-workspace-r4-rc1626.js'),css=read('public/huidi-workspace-r4-rc1626.css');
need(/^1\.2\.0-RC16\.\d+(?:\.\d+)?$/.test(manifest.version)&&manifest.release===manifest.version.replace('1.2.0-',''),'RC16.26 manifest identity');
need(/^1\.2\.0-rc16\.\d+(?:\.\d+)?$/.test(pkg.version),'RC16.26 package identity');
need(html.includes('huidi-workspace-r4-rc1626.css')&&html.includes('huidi-workspace-r4-rc1626.js'),'R4 assets not referenced');
need(html.indexOf('huidi-workspace-r4-rc1626.css')>html.indexOf('huidi-workspace-r3-rc1625.css')&&html.indexOf('huidi-workspace-r4-rc1626.css')<html.indexOf('huidi-workspace-r5-rc1627.css'),'R4 retained visual layer order');
need(html.indexOf('huidi-workspace-r4-rc1626.js')>html.indexOf('huidi-workspace-r3-rc1625.js')&&html.indexOf('huidi-workspace-r4-rc1626.js')<html.indexOf('huidi-workspace-r5-rc1627.js'),'R4 retained composition layer order');
need(js.includes('ensureFeishuNav')&&js.includes('workspaceNavAudit')&&js.includes("'feishu'"),'runtime nav repair/audit missing');
need(js.includes('renderDocuments')&&js.includes('继续到 PI')&&js.includes('继续到装箱'),'document management density owner missing');
need(js.includes('structuredCarton')&&js.includes('workspace-r4-dims'),'structured carton entry missing');
need(js.includes('accordion')&&js.includes("x.open=false"),'single-open progressive disclosure missing');
need(!/MutationObserver\s*\(|new\s+MutationObserver/.test(js),'R4 must not introduce MutationObserver loops');
need(css.includes('workspace-r4-template-list')&&css.includes('workspace-r4-catalog-empty')&&css.includes('#view-mail .empty-rich'),'management density CSS missing');
need(html.includes('id="view-feishu"')&&html.includes('data-view="feishu"'),'Feishu page/source entry missing from base HTML');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
need(sha('public/flypigbox-v3-3-2-3-pdf-flow-fix.js')==='abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36','protected PDF flow changed');
need(sha('public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js')==='570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583','protected output gate changed');
// Composition-model gate: model the actual R1 -> R2 -> R4 navigation ownership sequence.
// This catches the RC16.25 regression where R1 removed a later-added Feishu button before R2 could reuse it.
function viewsFromHtml(){return [...html.matchAll(/class="nav-btn[^\"]*"[^>]*data-view="([^\"]+)"|data-view="([^\"]+)"[^>]*class="nav-btn/g)].map(m=>m[1]||m[2]).filter(Boolean)}
function quotedViews(src,anchor){const i=src.indexOf(anchor);if(i<0)return[];const tail=src.slice(i,i+1400);return [...tail.matchAll(/'([a-z-]+)'/g)].map(m=>m[1]).filter(v=>/^[a-z][a-z-]+$/.test(v))}
const r1=read('public/huidi-workspace-r1-rc1622.js'),r2=read('public/huidi-workspace-r2-rc1623.js');
const original=new Set(viewsFromHtml());
const r1Keep=new Set(quotedViews(r1,'const groups=[').filter(v=>original.has(v)));
const afterR1=new Set([...original].filter(v=>r1Keep.has(v)));
const r2Keep=new Set(quotedViews(r2,"['home','deals','customers','products','documents']").filter(v=>original.has(v)));
// include the More Tools section list explicitly from R2 source
for(const v of quotedViews(r2,'const sections='))if(original.has(v))r2Keep.add(v);
const afterR2=new Set([...afterR1].filter(v=>r2Keep.has(v)));
need(original.has('feishu'),'base HTML must contain Feishu nav');
need(!afterR2.has('feishu'),'composition model should reproduce the pre-R4 Feishu-loss regression');
const afterR4=new Set(afterR2);if(js.includes('ensureFeishuNav'))afterR4.add('feishu');
const expected=['home','deals','customers','products','documents','catalog','brands','templates','mail','feishu','backup','recycle','help'];
need(expected.every(v=>afterR4.has(v)),`final composition model missing: ${expected.filter(v=>!afterR4.has(v)).join(',')}`);
need(js.includes("document.body.dataset.workspaceNavAudit=missing.length?'fail':'pass'"),'runtime DOM self-audit marker missing');
if(fail.length){console.error('RC16.26 WORKSPACE R4 VALIDATION FAILED');fail.forEach(x=>console.error('-',x));process.exit(1)}
console.log('RC16.26 WORKSPACE R4 VALIDATION PASSED');
