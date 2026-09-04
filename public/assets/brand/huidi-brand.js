(()=>{'use strict';
const cfg=window.HUIDI_BRAND=Object.assign({zh:'灰迪',en:'HUIDI',product:'HUIDI Docs Community Local',siteUrl:'',version:'COMMUNITY-LOCAL-1.1.0'},window.HUIDI_BRAND||{});
const replacements=[[/app\.flypigbox\.xyz/gi,new URL(cfg.siteUrl).host],[/flypigbox\.xyz/gi,'huidios.com'],[/Flypig\s*Box/gi,cfg.en],[/FlypigBOX/gi,cfg.en],[/FLYPIGBOX/g,cfg.en]];
function text(v){let s=String(v||'');for(const [a,b] of replacements)s=s.replace(a,b);return s}
function insidePdf(node){return Boolean(node?.nodeType===1?node.closest?.('#piPaper,.pdf-page,.pdf-template'):node?.parentElement?.closest?.('#piPaper,.pdf-page,.pdf-template'))}
function apply(root=document,{allowPdf=false}={}){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(n.parentElement?.tagName||'')&&(allowPdf||!insidePdf(n))){const v=text(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}}
  root.querySelectorAll?.('[title],[aria-label],[alt],[placeholder]').forEach(el=>{if(!allowPdf&&insidePdf(el))return;['title','aria-label','alt','placeholder'].forEach(a=>{if(el.hasAttribute(a)){const before=el.getAttribute(a),after=text(before);if(after!==before)el.setAttribute(a,after)}})});
  root.querySelectorAll?.('img').forEach(img=>{if(!allowPdf&&insidePdf(img))return;const next=img.src.replace(/flypigbox-icon-64\.png/i,'huidi-icon-64.png').replace(/flypigbox-icon-192\.png/i,'huidi-icon-192.png').replace(/flypigbox-icon-512\.png/i,'huidi-icon-512.png').replace(/flypigbox-logo\.png/i,'huidi-logo-main.png');if(next!==img.src)img.src=next});
  document.title=text(document.title||cfg.product);
}
apply();
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(insidePdf(n))return;if(n.nodeType===1)apply(n);else if(n.nodeType===3){const next=text(n.nodeValue);if(next!==n.nodeValue)n.nodeValue=next}}))).observe(document.documentElement,{childList:true,subtree:true});
window.HUIDIBrandRuntime={version:'1.2.0-RC16.21',apply,preparePdf:(root=document.querySelector('#piPaper'))=>root&&apply(root,{allowPdf:true})};
})();
