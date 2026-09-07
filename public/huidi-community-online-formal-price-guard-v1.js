(()=>{
'use strict';
if(window.HUIDICommunityFormalPriceGuard)return;
const CONTEXT_KEY='huidi_local_document_context_v2';
const clean=v=>String(v??'').trim();
const state={done:false,tries:0,contextSanitized:false,clearing:false,formStateWrapped:false};
function context(){try{return JSON.parse(sessionStorage.getItem(CONTEXT_KEY)||'null')}catch(_){return null}}
function samePrice(a,b){const x=clean(a),y=clean(b);if(!x||!y)return false;if(x===y)return true;const nx=Number(x),ny=Number(y);return Number.isFinite(nx)&&Number.isFinite(ny)&&Math.abs(nx-ny)<1e-9}
function referencePrice(product){if(!product||typeof product!=='object')return'';for(const key of ['reference_price','price','suggested_price']){const value=product[key];if(value!==null&&value!==undefined&&clean(value)!=='')return String(value)}return''}
function isFreshFormalContext(ctx){
 if(!ctx||ctx.sourceDocumentId)return false;
 if(new URLSearchParams(location.search).get('localDoc'))return false;
 if(sessionStorage.getItem('huidi_local_doc_id_v1'))return false;
 if(sessionStorage.getItem('huidi_local_open_document_v1'))return false;
 return Array.isArray(ctx.products)&&ctx.products.length>0;
}
function sanitizeContext(){
 const ctx=context();if(!isFreshFormalContext(ctx))return false;
 let changed=false,guarded=0;
 const products=ctx.products.map(product=>{
  const ref=referencePrice(product);if(!ref)return product;
  const next={...product};
  if(clean(next.reference_price)!==ref){next.reference_price=ref;changed=true}
  if(clean(next.price)!==''){next.price='';changed=true}
  guarded+=1;return next;
 });
 if(!guarded)return false;
 if(changed)sessionStorage.setItem(CONTEXT_KEY,JSON.stringify({...ctx,products}));
 state.contextSanitized=true;
 document.documentElement.dataset.huidiFormalPriceContext='reference-sanitized';
 return true;
}
function markManual(input){
 if(input.dataset.huidiFormalPriceBound==='1')return;
 input.dataset.huidiFormalPriceBound='1';
 input.dataset.huidiFormalPriceConfirmed='0';
 input.addEventListener('input',()=>{if(!state.clearing)input.dataset.huidiFormalPriceConfirmed='1'});
 input.addEventListener('change',()=>{if(!state.clearing)input.dataset.huidiFormalPriceConfirmed='1'});
}
function clearInheritedFormalPrice(input){
 state.clearing=true;
 try{
  input.value='';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.value='';
 }finally{state.clearing=false}
 queueMicrotask(()=>{if(document.activeElement!==input&&input.dataset.huidiFormalPriceConfirmed!=='1'&&clean(input.value)==='0')input.value=''});
 setTimeout(()=>{if(document.activeElement!==input&&input.dataset.huidiFormalPriceConfirmed!=='1'&&clean(input.value)==='0')input.value=''},0);
}
function wrapFormalState(){
 if(state.formStateWrapped)return true;
 const app=window.FlypigBOXApp,native=app?.formState;
 if(typeof native!=='function')return false;
 const wrapped=function(...args){
  const result=native.apply(app,args);
  if(!result||!Array.isArray(result.items))return result;
  const rows=[...document.querySelectorAll('.item-row')];
  result.items.forEach((item,index)=>{
   const input=rows[index]?.querySelector('.i-price');
   if(!input||input.dataset.huidiFormalPricePolicy!=='manual-required'||input.dataset.huidiFormalPriceConfirmed==='1')return;
   if(clean(item?.price)==='0'||samePrice(item?.price,input.dataset.huidiReferencePrice))item.price='';
  });
  return result;
 };
 wrapped.__huidiFormalPriceGuard=true;
 wrapped.__huidiNativeFormState=native;
 app.formState=wrapped;
 state.formStateWrapped=true;
 document.documentElement.dataset.huidiFormalPriceState='reference-sanitized';
 return true;
}
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
  input.dataset.huidiFormalPricePolicy='manual-required';
  markManual(input);
  input.placeholder=`参考 ${currency} ${ref} · 请确认正式单价`;
  input.title=`产品资料参考价 ${currency} ${ref}；仅供核对，不会自动写入正式单价。`;
  const inheritedDefaultZero=state.contextSanitized&&clean(input.value)==='0';
  if(state.contextSanitized&&(samePrice(input.value,ref)||inheritedDefaultZero))clearInheritedFormalPrice(input);
  guarded+=1;
 });
 if(!guarded||!wrapFormalState())return false;
 state.done=true;
 document.documentElement.dataset.huidiFormalPriceGuard='reference-only';
 try{window.FlypigBOXApp?.renderPreview?.()}catch(_){}
 return true;
}
function schedule(){if(state.done)return;state.tries=0;const run=()=>{if(protect()||state.tries++>=30)return;setTimeout(run,80)};queueMicrotask(run)}
sanitizeContext();
window.addEventListener('HUIDI:document.context.applied',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.HUIDICommunityFormalPriceGuard=Object.freeze({version:'1.2.0',sanitizeContext,protect,referencePrice,samePrice});
})();
