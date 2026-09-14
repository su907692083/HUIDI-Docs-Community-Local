(()=>{'use strict';
const cfg=window.HUIDI_BRAND=Object.assign({zh:'灰迪',en:'HUIDI',product:'HUIDI Docs Community Local',siteUrl:'',version:'COMMUNITY-LOCAL-1.1.0'},window.HUIDI_BRAND||{});
function safeSiteHost(value){if(!value)return cfg.en;try{const u=new URL(String(value),location.href);return /^https?:$/.test(u.protocol)?u.host:cfg.en}catch(_){return cfg.en}}
const replacements=[[/app\.flypigbox\.xyz/gi,safeSiteHost(cfg.siteUrl)],[/flypigbox\.xyz/gi,'huidios.com'],[/Flypig\s*Box/gi,cfg.en],[/FlypigBOX/gi,cfg.en],[/FLYPIGBOX/g,cfg.en]];
function text(v){let s=String(v||'');for(const [a,b] of replacements)s=s.replace(a,b);return s}
function insidePdf(node){return Boolean(node?.nodeType===1?node.closest?.('#piPaper,.pdf-page,.pdf-template'):node?.parentElement?.closest?.('#piPaper,.pdf-page,.pdf-template'))}
function apply(root=document,{allowPdf=false}={}){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(n.parentElement?.tagName||'')&&(allowPdf||!insidePdf(n))){const v=text(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}}
  root.querySelectorAll?.('[title],[aria-label],[alt],[placeholder]').forEach(el=>{if(!allowPdf&&insidePdf(el))return;['title','aria-label','alt','placeholder'].forEach(a=>{if(el.hasAttribute(a)){const before=el.getAttribute(a),after=text(before);if(after!==before)el.setAttribute(a,after)}})});
  root.querySelectorAll?.('img').forEach(img=>{if(!allowPdf&&insidePdf(img))return;const next=img.src.replace(/flypigbox-icon-64\.png/i,'huidi-icon-64.png').replace(/flypigbox-icon-192\.png/i,'huidi-icon-192.png').replace(/flypigbox-icon-512\.png/i,'huidi-icon-512.png').replace(/flypigbox-logo\.png/i,'huidi-logo-main.png');if(next!==img.src)img.src=next});
  document.title=text(document.title||cfg.product);
}
// Explicit editor lifecycle only; never rescan all DOM mutations.
let pending=false;
function refreshBrand(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshBrand,{once:true});else refreshBrand();
window.addEventListener('load',refreshBrand,{once:true});
for(const event of ['HUIDI:preview-rendered','HUIDI:document-type-changed','HUIDI:closure-rendered'])document.addEventListener(event,refreshBrand);
window.HUIDIBrandRuntime={version:'1.2.0-RC16.21',apply,preparePdf:(root=document.querySelector('#piPaper'))=>root&&apply(root,{allowPdf:true})};
})();
