const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),fail=[];const need=(x,m)=>{if(!x)fail.push(m)};
const manifest=JSON.parse(read('RELEASE-MANIFEST.json')),pkg=JSON.parse(read('package.json')),html=read('public/workspace.html'),js=read('public/huidi-feishu-data-rc1624.js'),css=read('public/huidi-feishu-data-rc1624.css'),node=read('tools/local-server.cjs'),ps=read('tools/local-server.ps1');
need(/^1\.2\.0-RC16\.\d+(?:\.\d+)?$/.test(manifest.version)&&manifest.release===manifest.version.replace('1.2.0-',''),'RC16.26 manifest identity');
need(/^1\.2\.0-rc16\.\d+$/.test(pkg.version),'RC16 retained package family');
need(html.includes('huidi-feishu-data-rc1624.css')&&html.includes('huidi-feishu-data-rc1624.js'),'Feishu Data assets referenced');
need(html.includes('data-view="feishu"')&&html.includes('id="view-feishu"'),'Feishu Data navigation/view missing');
need((html.match(/data-action="feishu-import"/g)||[]).length>=2,'customer/product Feishu import entry missing');
need(html.includes('feishuSourceUrl')&&html.includes('feishuImportTarget')&&html.includes('feishuMapping'),'Feishu Data workspace controls missing');
need(js.includes('huidi_feishu_field_mappings_v1')&&js.includes('autoMap')&&js.includes('saveMapping'),'saved field mapping missing');
need(js.includes('匹配到同一客户 / SKU 时更新已有资料')&&js.includes('writeRows'),'master-data reuse/update behavior missing');
need(js.includes('feishu_source')&&js.includes('imported_at'),'source trace missing');
need(!/MutationObserver\s*\(|new\s+MutationObserver/.test(js),'Feishu Data must not add observer loop');
for(const srv of [node,ps]){
  need(srv.includes('/api/feishu/source/list'),'source/list endpoint missing');
  need(srv.includes('/api/feishu/source/inspect'),'source/inspect endpoint missing');
  need(srv.includes('/open-apis/drive/v1/files'),'Drive file list missing');
  need(srv.includes('/open-apis/sheets/v3/spreadsheets/')&&srv.includes('/open-apis/sheets/v2/spreadsheets/'),'Sheets read path missing');
  need(srv.includes('/open-apis/bitable/v1/apps/'),'Bitable read path missing');
}
need(!fs.existsSync(path.join(root,'config','feishu.local.json')),'real Feishu config must not enter public SOURCE');
need(/1\.2\.0-RC16\.\d+/.test(read('public/huidi-public-config.json')),'public RC16 identity');
need(/version:'1\.2\.0-RC16\.\d+'/.test(read('public/huidi-local-workspace-v120.js')),'backup RC16 identity');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
need(sha('public/flypigbox-v3-3-2-3-pdf-flow-fix.js')==='abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36','protected PDF flow changed');
need(sha('public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js')==='570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583','protected output gate changed');
if(fail.length){console.error('RC16.26 FEISHU DATA VALIDATION FAILED');fail.forEach(x=>console.error('-',x));process.exit(1)}
console.log('RC16.26 FEISHU DATA VALIDATION PASSED');
