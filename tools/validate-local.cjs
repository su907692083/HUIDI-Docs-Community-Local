const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');let failures=[];const fail=m=>failures.push(m),ok=m=>console.log('[OK]',m);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(n=>n.isDirectory()?walk(path.join(d,n.name)):[path.join(d,n.name)]);
for(const f of ['package.json','RELEASE-MANIFEST.json','public/huidi-public-config.json','deploy/cloudflare/wrangler.example.jsonc']){
  try{JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));ok('JSON '+f)}catch(e){fail('JSON '+f+': '+e.message)}
}
for(const req of ['LICENSE','README.md','README-FIRST.zh-CN.md','SELF-HOSTING.md','SOURCE-AVAILABLE-SCOPE.md','COMMERCIAL-LICENSE.md','NOTICE','THIRD-PARTY-NOTICES.md','LICENSE-MIGRATION-RC6.zh-CN.md','NETWORK-POLICY.md','LEGACY-COMPATIBILITY.md','SECURITY.md','PRIVACY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','START-HUIDI-LOCAL.cmd','tools/local-server.ps1','tools/local-server.cjs','public/index.html','public/workspace.html','public/document-start.html','public/editor.html','public/catalog-studio/index.html','public/community-local-mode.js','public/community-local-mode.css','public/assets/brand/favicon-32.png','public/catalog-studio/HUIDI_Product_Template.xlsx']){
  if(fs.existsSync(path.join(root,req)))ok('exists '+req);else fail('missing '+req);
}
const files=walk(pub);
for(const p of files.filter(p=>p.endsWith('.js'))){const r=cp.spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0)fail('JS syntax '+path.relative(pub,p)+': '+(r.stderr||r.stdout).trim())} ok('JS syntax scan');
const htmls=files.filter(p=>p.endsWith('.html')),refRe=/(?:src|href)=["']([^"']+)["']/gi;
for(const p of htmls){const s=fs.readFileSync(p,'utf8');let m;while((m=refRe.exec(s))){let ref=m[1].split(/[?#]/)[0];if(!ref||/^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(ref))continue;const q=ref.startsWith('/')?path.join(pub,ref.slice(1)):path.resolve(path.dirname(p),ref);if(!fs.existsSync(q)&&!ref.includes('${'))fail('HTML ref '+path.relative(pub,p)+' -> '+ref)}}
ok('HTML local references');
for(const key of ['index.html','workspace.html','document-start.html','editor.html','catalog-studio/index.html']){
  const s=fs.readFileSync(path.join(pub,key),'utf8');
  if(!/Content-Security-Policy/i.test(s))fail(key+' missing CSP');
  if(!/connect-src 'self'/.test(s))fail(key+' connect-src is not self-only');
  if(!/community-local-mode\.js/.test(s))fail(key+' missing local mode guard');
}
ok('local CSP/guard presence');
const textFiles=files.filter(p=>/\.(html|js|json|webmanifest|css)$/i.test(p));
const combined=textFiles.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const runtimeCombined=textFiles.filter(p=>!p.includes(path.join('assets','vendor'))).map(p=>fs.readFileSync(p,'utf8')).join('\n');
for(const bad of ['icrdlqfszxygoxdldyhl','workspace.huidios.com','api.huidios.com','bridge-workspace.huidios.com','app.flypigbox.xyz','flypigbox.xyz'])if(combined.includes(bad))fail('production dependency remains: '+bad);
for(const bad of ['sb_publishable_','service_role','sb_secret_'])if(combined.includes(bad))fail('credential-like marker remains: '+bad);
for(const bad of ['cdnjs.cloudflare.com','cdn.jsdelivr.net','unpkg.com','api.openai.com','generativelanguage.googleapis.com','api.deepseek.com','dashscope.aliyuncs.com','openrouter.ai'])if(runtimeCombined.includes(bad))fail('external runtime endpoint remains: '+bad);
const externalTag=/<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//i;
for(const p of htmls){const s=fs.readFileSync(p,'utf8');if(externalTag.test(s))fail('external script/style dependency: '+path.relative(pub,p))}
if(fs.existsSync(path.join(pub,'admin')))fail('production admin directory present');else ok('admin excluded');
for(const f of ['notifications.html','founder-os-project-contract.json','notification-gateway-contract.json','flypigbox-supabase-loader.js','flypigbox-ai-gateway-config.js','flypigbox-founder-os-bridge.js','flypigbox-service-runtime.js','flypigbox-notification-client.js','community-mode.js','community-mode.css','PATCH-MANIFEST.json'])if(fs.existsSync(path.join(pub,f)))fail('cloud/stale file remains: '+f);
ok('cloud/stale surface prune');
const guard=fs.readFileSync(path.join(pub,'community-local-mode.js'),'utf8');
for(const term of ['window.fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon'])if(!guard.includes(term))fail('network guard missing '+term);
if(!guard.includes('applyEditorAccessGate?.(false)'))fail('editor local access unlock missing');
const catalog=fs.readFileSync(path.join(pub,'catalog-studio/index.html'),'utf8');
if(!catalog.includes('if(window.HUIDI_LOCAL_ONLY?.localOnly)return true;'))fail('catalog local brand access unlock missing');
const quick=fs.readFileSync(path.join(pub,'flypigbox-quick-result.js'),'utf8');
if(/cdnjs|cdn\.jsdelivr|unpkg/i.test(quick))fail('quick import still has CDN fallback');
if(!fs.readFileSync(path.join(root,'START-HUIDI-LOCAL.cmd'),'utf8').includes('-ExecutionPolicy Bypass'))fail('Windows launcher does not use safe one-click PowerShell path');
if(!fs.readFileSync(path.join(root,'tools/local-server.ps1'),'utf8').includes('IPAddress]::Loopback'))fail('PowerShell local server is not loopback-only');
if(!combined.includes('HUIDI Docs Community Local'))fail('local brand marker missing');
// RC6 license model gate
for(const rel of ['LICENSE','README.md','RELEASE-MANIFEST.json','package.json','public/index.html','public/SOURCE.html','public/terms.html','public/editor.html']){
  const p=path.join(root,rel); if(!fs.existsSync(p)) continue; const t=fs.readFileSync(p,'utf8');
  if(/AGPL-3\.0-only|GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t)) fail(`RC6 license residual: ${rel}`);
}
const lic=fs.readFileSync(path.join(root,'LICENSE'),'utf8');
if(!lic.includes('HUIDI Community Source License 1.0')) fail('missing HUIDI Community Source License 1.0');
if(!lic.includes('自己公司内部使用')) fail('missing internal-use grant');
if(!lic.includes('需要商业授权')) fail('missing commercial authorization boundary');
if(failures.length){console.error('\nVALIDATION FAILED');failures.forEach(x=>console.error('-',x));process.exit(1)}
console.log('\nVALIDATION PASSED');
