const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const editor=fs.readFileSync(path.join(root,'public/editor.html'),'utf8');
const fail=m=>{console.error('[EDITOR-BUDGET] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[EDITOR-BUDGET] PASS:',m);
const scripts=[...editor.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const css=[...editor.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]).filter(x=>/\.css(?:\?|$)/i.test(x));
const canonical=x=>x.split('?')[0].replace(/^\.\//,'');
const duplicates=list=>Object.entries(list.reduce((m,x)=>(m[canonical(x)]=(m[canonical(x)]||0)+1,m),{})).filter(([,n])=>n>1);
const inlineScriptBytes=[...editor.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].reduce((n,m)=>n+m[1].length,0);
const inlineStyleBytes=[...editor.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce((n,m)=>n+m[1].length,0);

scripts.length<=63?pass('external JS budget '+scripts.length+'/63'):fail('external JS budget exceeded: '+scripts.length);
css.length<=52?pass('external CSS budget '+css.length+'/52'):fail('external CSS budget exceeded: '+css.length);
inlineScriptBytes<=360000?pass('inline JS budget '+inlineScriptBytes+'/360000'):fail('inline JS budget exceeded: '+inlineScriptBytes);
inlineStyleBytes<=55000?pass('inline CSS budget '+inlineStyleBytes+'/55000'):fail('inline CSS budget exceeded: '+inlineStyleBytes);

const dupScripts=duplicates(scripts),dupCss=duplicates(css);
dupScripts.length?fail('duplicate scripts: '+dupScripts.map(x=>x[0]).join(', ')):pass('no duplicate external JS');
dupCss.length?fail('duplicate stylesheets: '+dupCss.map(x=>x[0]).join(', ')):pass('no duplicate external CSS');

const names=scripts.map(canonical);
const index=name=>names.indexOf(name);
const required=[
 'community-local-mode.js',
 'huidi-local-db-rc165.js',
 'huidi-local-core-rc167.js',
 'flypigbox-editor-unified.js',
 'flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js',
 'huidi-toolbar-owner-rc1617.js',
 'huidi-action-owner-rc1621.js',
 'huidi-runtime-stability-rc1615.js'
];
for(const name of required)index(name)>=0?pass('required owner present: '+name):fail('required owner missing: '+name);
if(names[0]==='community-local-mode.js')pass('Community Local guard loads first');else fail('Community Local guard must be first external script');
if(index('huidi-local-db-rc165.js')<index('huidi-local-core-rc167.js'))pass('local DB loads before local core');else fail('local DB/core load order invalid');
if(index('flypigbox-editor-unified.js')<index('huidi-toolbar-owner-rc1617.js'))pass('editor core loads before toolbar owner');else fail('editor/toolbar owner order invalid');
if(index('huidi-toolbar-owner-rc1617.js')<index('huidi-action-owner-rc1621.js'))pass('toolbar owner loads before action owner');else fail('toolbar/action owner order invalid');
if(names.at(-1)==='huidi-runtime-stability-rc1615.js')pass('runtime stability owner loads last');else fail('runtime stability owner must load last');

if(process.exitCode)process.exit(process.exitCode);
console.log('[EDITOR-BUDGET] OK');
