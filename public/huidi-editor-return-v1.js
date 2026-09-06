/* HUIDI Editor Return V1 — contextual secondary-page return owner.
   Navigation only. Does not own editor state, save, PDF or document linkage. */
(()=>{
'use strict';
if(window.HUIDIEditorReturn)return;
const RETURN_KEY='huidi_document_return_v1';
const FOCUS_KEY='huidi_workspace_focus_v1';
const MAX_AGE=6*60*60*1000;
const core=window.HUIDILocalCore;
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const parse=(raw,fallback)=>{try{return JSON.parse(raw||'null')??fallback}catch(_){return fallback}};
const trimLabel=(value,max=30)=>{const s=clean(value);return s.length>max?s.slice(0,max-1)+'…':s};
function currentContext(){try{return core?.context?.current?.()||null}catch(_){return null}}
function resolveReturn(){
 const stored=parse(sessionStorage.getItem(RETURN_KEY),null);
 if(stored&&Date.now()-Number(stored.at||0)<=MAX_AGE&&['deals','documents','customers','products'].includes(stored.view))return stored;
 const ctx=currentContext();
 if(clean(ctx?.dealId))return{view:'deals',id:clean(ctx.dealId),at:Date.now(),inferred:true};
 return{view:'documents',id:'',at:Date.now(),inferred:true};
}
function dealTitle(id){try{return core?.repositories?.deals?.get?.(id)?.title||''}catch(_){return''}}
function customerTitle(id){try{return core?.repositories?.customers?.get?.(id)?.company||''}catch(_){return''}}
function productTitle(id){try{return core?.repositories?.products?.get?.(id)?.name||''}catch(_){return''}}
function viewLabel(ret){
 if(ret.view==='deals')return ret.id?`← 返回询盘 · ${trimLabel(dealTitle(ret.id)||'当前业务')}`:'← 返回询盘';
 if(ret.view==='customers')return ret.id?`← 返回客户 · ${trimLabel(customerTitle(ret.id)||'当前客户')}`:'← 返回客户';
 if(ret.view==='products')return ret.id?`← 返回商品 · ${trimLabel(productTitle(ret.id)||'当前商品')}`:'← 返回商品';
 return'← 返回单据中心';
}
function hrefFor(ret){return`./workspace.html#${encodeURIComponent(ret.view||'documents')}`}
function prepareFocus(ret){if(!ret?.id)return;try{sessionStorage.setItem(FOCUS_KEY,JSON.stringify({view:ret.view,id:String(ret.id),at:Date.now()}))}catch(_){}}
function apply(){
 const ret=resolveReturn();
 const nav=document.querySelector('.site-header .launch-nav');
 const anchor=nav?.querySelector('a[href="./workspace.html"],a[href="./workspace.html#documents"],a[data-huidi-editor-return]')||null;
 if(anchor){anchor.dataset.huidiEditorReturn='1';anchor.href=hrefFor(ret);anchor.textContent=viewLabel(ret);anchor.title=ret.view==='deals'?'返回原询盘并继续查看业务进度':'返回 HUIDI 工作台对应页面';anchor.addEventListener('click',()=>prepareFocus(ret),{capture:true});}
 let chip=document.getElementById('huidiEditorContextChip');
 if(!chip&&ret.view==='deals'&&ret.id){const header=document.querySelector('.site-header');if(header){chip=document.createElement('button');chip.type='button';chip.id='huidiEditorContextChip';chip.style.cssText='max-width:280px;min-height:32px;padding:0 10px;border:1px solid #dbe4ee;border-radius:8px;background:#f7faff;color:#36516f;font:700 11px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer';chip.textContent=`当前业务：${trimLabel(dealTitle(ret.id)||ret.id,34)}`;chip.title='返回这条询盘';chip.addEventListener('click',()=>{prepareFocus(ret);location.href=hrefFor(ret)});const actions=header.querySelector('.header-actions');header.insertBefore(chip,actions||null)}}
 document.documentElement.dataset.huidiEditorReturn='v1';
 return ret;
}
function boot(){apply();setTimeout(apply,180);setTimeout(apply,700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIEditorReturn=Object.freeze({version:'1.0.0',resolveReturn,prepareFocus,apply});
})();
