const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public'); let failures=[];
const fail=m=>failures.push(m), ok=m=>console.log('[OK]',m);
for(const f of ['wrangler.preview.jsonc','wrangler.production.jsonc','package.json','RELEASE-MANIFEST.json']){try{JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));ok('JSON '+f)}catch(e){fail('JSON '+f+': '+e.message)}}
for(const f of ['index.html','workspace.html','document-start.html','editor.html','catalog-studio/index.html','admin/index.html','assets/HUIDI_Product_Template.xlsx','catalog-studio/HUIDI_Product_Template.xlsx','import-templates/HUIDI_客户与商品导入参考模板.xlsx']){if(fs.existsSync(path.join(pub,f)))ok('exists '+f);else fail('missing '+f)}
function walk(d){let a=[];for(const n of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,n.name);if(n.isDirectory())a=a.concat(walk(p));else a.push(p)}return a}
const files=walk(pub); for(const p of files.filter(p=>p.endsWith('.js'))){const r=cp.spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)fail('JS syntax '+path.relative(pub,p)+': '+(r.stderr||r.stdout).trim())} ok('JS syntax scan');
const htmls=files.filter(p=>p.endsWith('.html'));const re=/(?:src|href)=["']([^"']+)["']/gi;
for(const p of htmls){const s=fs.readFileSync(p,'utf8');let m;while((m=re.exec(s))){let ref=m[1].split(/[?#]/)[0];if(!ref||/^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(ref))continue;const q=ref.startsWith('/')?path.join(pub,ref.slice(1)):path.resolve(path.dirname(p),ref);if(!fs.existsSync(q)&&!ref.includes('${'))fail('HTML ref '+path.relative(pub,p)+' -> '+ref)}} ok('HTML local references');
let combined=files.filter(p=>/\.(html|js|json|webmanifest|css)$/i.test(p)).map(p=>fs.readFileSync(p,'utf8')).join('\n');
if(/app\.flypigbox\.xyz|flypigbox\.xyz/i.test(combined))fail('legacy public domain remains');else ok('legacy public domain 0');
for(const bad of ['FlypigBOX_Product_Template.xlsx','FlypigBOX_客户与商品导入参考模板.xlsx','FlypigBOX_单据清单_','FlypigBOX_商品导入异常报告_','FlypigBOX_当前账号业务数据_','FlypigBOX_当前账号完整备份_']){if(combined.includes(bad))fail('user-visible legacy output '+bad)}
if(failures.length){console.error('\nVALIDATION FAILED');for(const x of failures)console.error('-',x);process.exit(1)} console.log('\nVALIDATION PASSED');
