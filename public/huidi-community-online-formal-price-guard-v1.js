(()=>{
'use strict';
if(window.HUIDICommunityFormalPriceGuard)return;
const clean=v=>String(v??'').trim();
const state={done:false,tries:0};
function context(){try{return JSON.parse(sessionStorage.getItem('huidi_local_document_context_v2')||'null')}catch(_){return null}}
function samePrice(a,b){const x=clean(a),y=clean(b);if(!x||!y)return false;if(x===y)return true;const nx=Number(x),ny=Number(y);return Number.isFinite(nx)&&Number.isFinite(ny)&&Math.abs(nx-ny)<1e-9}
function referencePrice(product){if(!product||typeof product!=='object')return'';for(const key of ['reference_price','price','suggested_price']){const value=product[key];if(value!==null&&value!==undefined&&clean(value)!=='')return String(value)}return''}
function isFreshFormalContext(ctx){if(!ctx||ctx.sourceDocumentId)return false;if(sessionStorage.getItem('huidi_local_doc_id_v1'))return false;if(sessionStorage.getItem('huidi_local_open_document_v1'))return false;return Array.isArray(ctx.products)&&ctx.products.length>0}
function protect(){
 if(state.done)return true;
 const ctx=context();if(!isFreshFormalContext(ctx))return false;
 const rows=[...document.querySelectorAll('.item-row')];if(!rows.length)return false;
 const byId=new Map((ctx.products||[]).map(p=>[clean(p?.id),p]));let guarded=0;
 rows.forEach((row,index)=>{
  const product=byId.get(clean(row.dataset.huidiProductId))||ctx.products[index];
  const ref=referencePrice(product),input=row.querySelector('.i-price');
  if(!input||!ref)return;
  const currency=clean(product?.currency||ctx.deal?.currency||ctx.customer?.currency||'USD')||'USD';
  input.dataset.huidiReferencePrice=ref;
  input.placeholder=`参考 ${currency} ${ref} · 请确认正式单价`;
  input.title=`产品资料参考价 ${currency} ${ref}；仅供核对，不会自动写入正式单价。`;
  if(samePrice(input.value,ref)){
   input.value='';
   input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  guarded+=1;
 });
 if(!guarded)return false;
 state.done=true;
 document.documentElement.dataset.huidiFormalPriceGuard='reference-only';
 try{window.FlypigBOXApp?.renderPreview?.()}catch(_){}
 return true;
}
function schedule(){if(state.done)return;state.tries=0;const run=()=>{if(protect()||state.tries++>=24)return;setTimeout(run,80)};queueMicrotask(run)}
window.addEventListener('HUIDI:document.context.applied',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.HUIDICommunityFormalPriceGuard=Object.freeze({version:'1.0.1',protect,referencePrice,samePrice});
})();
