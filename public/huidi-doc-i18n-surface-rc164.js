(()=>{'use strict';
if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
if(window.__HUIDIDocI18nSurfaceRC164)return;window.__HUIDIDocI18nSurfaceRC164=true;
const $=s=>document.querySelector(s);
const lang=()=>$('#docLanguage')?.value||'bilingual';
const isTarget=()=>!['bilingual','zh','en'].includes(lang());
function translateChunk(raw){
  const i18n=window.HUIDIDocI18n;if(!i18n||!isTarget())return raw;
  const text=String(raw||'').trim();if(!text)return raw;
  const direct=i18n.known?.(text,lang());if(direct)return direct;
  if(text.includes(' · ')){
    const parts=text.split(' · '),mapped=parts.map(part=>i18n.known?.(part.trim(),lang())||part.trim());
    if(mapped.some((v,i)=>v!==parts[i].trim()))return mapped.join(' · ');
  }
  return raw;
}
function translateNode(node){
  if(!node||node.nodeType!==1)return;
  const skip=node.matches('input,textarea,select,option,[contenteditable="true"],script,style')||node.closest('input,textarea,select,[contenteditable="true"]');
  if(skip)return;
  const children=[...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
  children.forEach(t=>{const next=translateChunk(t.nodeValue);if(next!==t.nodeValue)t.nodeValue=next;});
}
function surfaceSignature(root){
  if(!root)return'';
  if(root.id==='piPaper')return `${lang()}:${root.dataset.fpRenderGeneration||'0'}`;
  return `${lang()}:${root.childElementCount}:${root.textContent?.length||0}`;
}
function scan(root,{force=false,prePagination=false}={}){
  if(!root||!isTarget())return;
  if(root.id==='piPaper'&&document.body.dataset.huidiStablePagination==='1'&&!prePagination)return;
  const signature=surfaceSignature(root);
  if(!force&&root.dataset.huidiI18nSurfaceSignature===signature)return;
  const selector='h1,h2,h3,h4,.doc-section,th,.pdf-meta-label,.pdf-label,.fp-workbook-file b,.fp-workbook-toolbar span,.fp-workbook-toolbar button,.fp-workbook-tabs button,.fp-workbook-grid th,.fp-export-workbook-sheet td,.fp-export-workbook-sheet th';
  if(root.matches?.(selector))translateNode(root);
  root.querySelectorAll?.(selector).forEach(translateNode);
  root.dataset.huidiI18nSurface=lang();
  root.dataset.huidiI18nSurfaceSignature=surfaceSignature(root);
}
let queued=0;
function schedule(delay=35,force=false){clearTimeout(queued);queued=setTimeout(()=>{scan($('#piPaper'),{force});scan($('#fpTableOutputPreview'),{force});},delay);}
function observeWorkbook(root){
  if(!root||root.dataset.huidiI18nObserved==='1')return;
  root.dataset.huidiI18nObserved='1';
  const obs=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))schedule(120);});
  obs.observe(root,{subtree:true,childList:true});
}
function boot(){
  observeWorkbook($('#fpTableOutputPreview'));schedule(0,true);
  document.addEventListener('HUIDI:preview-rendered',()=>schedule(0,true));
  $('#docLanguage')?.addEventListener('change',()=>schedule(40,true));
  ['HUIDI:preview-only-mode-change','HUIDI:document-type-change','HUIDI:document-type-changed','HUIDI:document-mode-change','HUIDI:apply-template'].forEach(name=>document.addEventListener(name,()=>schedule(70,true)));
  [350,900].forEach(ms=>setTimeout(()=>{observeWorkbook($('#fpTableOutputPreview'));schedule(0,true);},ms));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIDocI18nSurface=Object.freeze({version:'1.2.0-RC16.21',refresh:()=>schedule(0),preparePdf:(root=$('#piPaper'))=>scan(root,{force:true,prePagination:true})});
})();