const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
let fail=[];const need=(v,m)=>{if(!v)fail.push(m)};
const pkg=JSON.parse(read('package.json')),manifest=JSON.parse(read('RELEASE-MANIFEST.json'));
const css=read('public/huidi-toolbar-owner-rc1617.css'),js=read('public/huidi-toolbar-owner-rc1617.js'),editor=read('public/editor.html');
need(pkg.version==='1.2.0-rc16.20','package identity');
need(manifest.version==='1.2.0-RC16.20'&&manifest.release==='RC16.20','manifest identity');
need(css.includes('overflow:visible!important')&&css.includes('flex-wrap:wrap!important'),'action rail must not clip dropdowns');
need(!css.includes('overflow-y:hidden!important'),'toolbar action rail must not vertically clip dropdowns');
need(css.includes('.fp-lite-menu>div')&&css.includes('z-index:20050'),'dropdown layer authority missing');
need(!js.includes('visualViewport')&&!js.includes('syncGeometry')&&!js.includes('style.minHeight'),'interactive geometry feedback loop must be removed');
need(js.includes("actions.dataset.huidiToolbarOwner='rc1617'"),'legacy shell compatibility lock missing');
need(js.includes('closePeerMenus')&&js.includes("addEventListener('toggle'"),'menu interaction ownership missing');
need(editor.includes('huidi-toolbar-owner-rc1617.js?v=HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.20'),'editor toolbar runtime cache identity');
if(fail.length){console.error('RC16.20 TOOLBAR INTERACTION VALIDATION FAILED');fail.forEach(x=>console.error('-',x));process.exit(1)}
console.log('RC16.20 TOOLBAR INTERACTION STABILITY VALIDATION PASSED');
