(()=>{'use strict';
if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
if(window.__HUIDILocalTranslationUIRC1630)return;window.__HUIDILocalTranslationUIRC1630=true;
const $=id=>document.getElementById(id),qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const SECTION_ALIAS={parties:'party',products:'products',delivery:'delivery',paymentSchedule:'paymentSchedule',customs:'customs',packing:'packing',plannedLogistics:'plannedLogistics',actualShipment:'actualShipment',payment:'payment',qualityRisk:'qualityRisk',terms:'terms'};
const ITEM_SELECTORS={name:'.i-name',spec:'.i-spec',packageDescription:'.i-package-desc',shippingMarks:'.i-item-marks'};
const clean=v=>String(v??'').trim();
function injectStyle(){
 if($('huidiLocalTranslationStyle'))return;
 const style=document.createElement('style');style.id='huidiLocalTranslationStyle';style.textContent=
 '.huidi-community-local #translateAllBtn.huidi-local-translate-ready{display:inline-flex!important}.huidi-translate-section,.huidi-translate-field{border:1px solid #cbdced;background:#f5f9ff;color:#24527a;border-radius:7px;font-weight:800;cursor:pointer}.huidi-translate-section{min-height:28px;padding:0 9px;font-size:11px}.huidi-translate-field{min-width:26px;height:24px;padding:0 6px;margin-left:6px;font-size:11px;vertical-align:middle}.huidi-translate-section[disabled],.huidi-translate-field[disabled]{opacity:.55;cursor:wait}.huidi-translation-status{display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:4px 8px;border-radius:999px;background:#eef6ff;color:#315d82;font-size:11px;font-weight:750}.huidi-translation-status[data-provider="google_cloud"]{background:#edf8f2;color:#18794e}.huidi-translation-status[data-error="1"]{background:#fff4e5;color:#8a5a00}';
 document.head.appendChild(style);
}
function state(){return window.HUIDITranslationRuntime?.state?.()||window.FlypigBOXApp?.formState?.(false)||{fields:{},items:[]}}
function owner(){return window.HUIDITranslationOwner}
function runtime(){return window.HUIDITranslationRuntime}
async function providerStatus(){
 let badge=$('huidiTranslationStatus');
 if(!badge){
   badge=document.createElement('span');badge.id='huidiTranslationStatus';badge.className='huidi-translation-status';badge.textContent='联网翻译检查中';
   const host=$('docLanguage')?.closest('label');host?.appendChild(badge);
 }
 try{
   const r=await fetch('/api/translation/status',{cache:'no-store'}),data=await r.json();
   if(!r.ok||data?.ok===false)throw new Error(data?.message||'不可用');
   badge.dataset.provider=data.provider||'local';
   badge.dataset.error='0';
   badge.textContent=data.provider==='google_cloud'?'联网翻译 · Google Cloud':'联网翻译 · 免配置';
 }catch(_){
   badge.dataset.error='1';badge.textContent='联网翻译 · 未连接';
 }
}
function prepareMainButton(){
 const b=$('translateAllBtn');if(!b)return;
 b.hidden=false;b.classList.remove('is-hidden');b.classList.add('huidi-local-translate-ready');b.dataset.huidiLocalOnlineAllowed='translation';b.textContent='翻译整份单据';b.title='只翻译当前单据中允许翻译的业务文字；编号、金额、银行账号等不会上传翻译';
}
function sectionKey(section){return SECTION_ALIAS[section?.dataset?.fpSection||'']||''}
function ensureSectionButtons(){
 const api=owner(),rt=runtime();if(!api||!rt)return;
 qsa('[data-fp-section]').forEach(section=>{
   const key=sectionKey(section),title=section.querySelector('.section-title');
   let btn=section.querySelector('[data-huidi-translate-section]');
   const rows=key?api.collectSection(key,state()):[];
   if(!key||!rows.length){btn?.remove();return}
   if(!title)return;
   if(!btn){btn=document.createElement('button');btn.type='button';btn.className='huidi-translate-section';btn.dataset.huidiTranslateSection=key;btn.textContent='翻译本分栏';btn.title='只翻译本分栏中的可翻译文字';title.appendChild(btn)}
   btn.dataset.huidiTranslateSection=key;
 });
}
function appendFieldButton(input,key){
 if(!input||!key||input.disabled||input.readOnly)return;
 const api=owner();if(!api)return;
 const row=api.collectField(key,state());if(!row)return;
 const label=input.closest('label')||input.parentElement;if(!label||label.querySelector('[data-huidi-translate-field="'+CSS.escape(key)+'"]'))return;
 const btn=document.createElement('button');btn.type='button';btn.className='huidi-translate-field';btn.dataset.huidiTranslateField=key;btn.textContent='译';btn.title='只翻译这个字段';input.insertAdjacentElement('afterend',btn);
}
function ensureFieldButtons(){
 const api=owner();if(!api)return;
 Object.keys(api.fieldSections||{}).forEach(id=>appendFieldButton($(id),id));
 qsa('.item-row').forEach((row,index)=>{
   const itemKey=row.dataset.itemKey||state().items?.[index]?.itemKey||String(index);
   Object.entries(ITEM_SELECTORS).forEach(([field,selector])=>appendFieldButton(row.querySelector(selector),'item:'+itemKey+':'+field));
 });
 qsa('.logistics-extra-row').forEach((row,index)=>{
   const id=row.dataset.logisticsId||String(index);
   appendFieldButton(row.querySelector('[data-logistics-extra-label]'),'logisticsExtra:'+id+':label');
   appendFieldButton(row.querySelector('[data-logistics-extra-value]'),'logisticsExtra:'+id);
 });
}
function sync(){prepareMainButton();ensureSectionButtons();ensureFieldButtons()}
async function runButton(btn,work){
 if(!btn||btn.disabled)return;const old=btn.textContent;btn.disabled=true;btn.textContent='翻译中…';
 try{await work()}finally{btn.disabled=false;btn.textContent=old;setTimeout(sync,0)}
}
document.addEventListener('click',event=>{
 const section=event.target.closest('[data-huidi-translate-section]');if(section){event.preventDefault();event.stopPropagation();return runButton(section,()=>runtime()?.translateSection?.(section.dataset.huidiTranslateSection))}
 const field=event.target.closest('[data-huidi-translate-field]');if(field){event.preventDefault();event.stopPropagation();return runButton(field,()=>runtime()?.translateField?.(field.dataset.huidiTranslateField))}
},true);
['HUIDI:translation-owner-ready','HUIDI:document-type-changed','HUIDI:layout-updated','HUIDI:translation-updated','HUIDI:editor-view-change'].forEach(name=>document.addEventListener(name,()=>setTimeout(sync,40)));
document.addEventListener('change',event=>{if(['documentType','docMode','docLanguage','ciComplianceLevel','packingDetailMode'].includes(event.target?.id))setTimeout(sync,60)},true);
let timer=0;new MutationObserver(records=>{if(!records.some(r=>r.addedNodes?.length||r.removedNodes?.length))return;clearTimeout(timer);timer=setTimeout(sync,80)}).observe(document.body,{childList:true,subtree:true});
function boot(){injectStyle();sync();providerStatus();setTimeout(sync,300);setTimeout(sync,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();