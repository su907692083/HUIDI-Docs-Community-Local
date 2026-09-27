(()=>{'use strict';
if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
if(window.__HUIDILocalTranslationUIRC1630)return;window.__HUIDILocalTranslationUIRC1630=true;
const $=id=>document.getElementById(id),qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const SECTION_ALIAS={parties:'party',products:'products',delivery:'delivery',paymentSchedule:'paymentSchedule',customs:'customs',packing:'packing',plannedLogistics:'plannedLogistics',actualShipment:'actualShipment',payment:'payment',qualityRisk:'qualityRisk',terms:'terms'};
const ITEM_SELECTORS={name:'.i-name',spec:'.i-spec',packageDescription:'.i-package-desc',shippingMarks:'.i-item-marks'};
const TABLE_SECTION_SECTIONS={basic:['basic'],parties:['party'],products:['products','packing'],delivery:['delivery'],costs:['costs'],logistics:['logistics','plannedLogistics','actualShipment','packing'],payment:['payment','paymentSchedule'],terms:['terms','qualityRisk','customs'],more:['delivery','costs','logistics','plannedLogistics','actualShipment','packing','payment','paymentSchedule','customs','qualityRisk']};
const clean=v=>String(v??'').trim();
function injectStyle(){
 if($('huidiLocalTranslationStyle'))return;
 const style=document.createElement('style');style.id='huidiLocalTranslationStyle';style.textContent=
 '.huidi-community-local #translateAllBtn.huidi-local-translate-ready{display:inline-flex!important}.huidi-translate-section,.huidi-translate-field{border:1px solid #cbdced;background:#f8fbff;color:#315d82;border-radius:7px;font-weight:750;cursor:pointer;box-shadow:none!important}.huidi-translate-section{min-height:27px;padding:0 8px;font-size:11px}.huidi-translate-field{width:auto!important;min-width:30px!important;max-width:48px;height:23px!important;padding:0 7px!important;margin:3px 0 0 auto!important;align-self:flex-end!important;font-size:10.5px;vertical-align:middle;opacity:.42;transition:opacity .15s ease,border-color .15s ease,background .15s ease}.huidi-translate-field:hover,.huidi-translate-field:focus,.huidi-translate-field[data-huidi-translated="1"],label:hover>.huidi-translate-field,label:focus-within>.huidi-translate-field,.huidi-community-local #fpTableEditorWorkspace td:hover>.huidi-translate-field,.huidi-community-local #fpTableEditorWorkspace td:focus-within>.huidi-translate-field{opacity:1}.huidi-community-local #fpTableEditorWorkspace td>.huidi-translate-field{display:inline-flex!important;float:right;margin-top:4px!important}.huidi-community-local #fpTableEditorWorkspace .fp-sheet-panel-head>.huidi-translate-section{flex:0 0 auto;opacity:.78}.huidi-translate-result{display:block;clear:both;width:100%;max-width:100%;margin:3px 0 0;color:#18794e;font-size:10.5px;font-weight:650;line-height:1.45;white-space:normal;overflow-wrap:anywhere}.huidi-translate-result:empty{display:none}.huidi-translate-section[disabled],.huidi-translate-field[disabled]{opacity:.55;cursor:wait}.huidi-translation-status{display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:4px 8px;border-radius:999px;background:#eef6ff;color:#315d82;font-size:11px;font-weight:750}.huidi-translation-status[data-provider="google_cloud"]{background:#edf8f2;color:#18794e}.huidi-translation-status[data-error="1"]{background:#fff4e5;color:#8a5a00}';
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
function translatedResult(key){
 const api=owner(),st=state(),row=api?.collectField?.(key,st);if(!api||!row)return'';
 const source=clean(row.text),language=clean(st?.fields?.docLanguage||$('docLanguage')?.value||'bilingual')||'bilingual';
 const resolved=clean(api.resolve?.(key,row.text,language,st.translationVersions||{}));if(!resolved||resolved===source)return'';
 if(language==='bilingual'){
   const parts=resolved.split(/\n+/).map(clean).filter(Boolean),other=parts.find(part=>part!==source);
   return other||'';
 }
 return resolved;
}
function syncFieldResult(btn){
 if(!btn)return;const key=btn.dataset.huidiTranslateField,text=translatedResult(key);
 let note=btn.parentElement?.querySelector?.('[data-huidi-translate-result="'+CSS.escape(key)+'"]');
 if(!text){btn.dataset.huidiTranslated='0';note?.remove();return}
 btn.dataset.huidiTranslated='1';
 if(!note){note=document.createElement('small');note.className='huidi-translate-result';note.dataset.huidiTranslateResult=key;btn.insertAdjacentElement('afterend',note)}
 note.textContent='译文：'+text;
}
function syncTranslationResults(){qsa('[data-huidi-translate-field]').forEach(syncFieldResult)}
function appendFieldButton(input,key){
 if(!input||!key||input.disabled||input.readOnly)return;
 const api=owner(),rt=runtime();if(!api||!rt)return;
 const row=api.collectField(key,state());if(!row)return;
 const label=input.closest('label')||input.parentElement;if(!label)return;
 const existing=label.querySelector('[data-huidi-translate-field="'+CSS.escape(key)+'"]');if(existing){syncFieldResult(existing);return}
 const btn=document.createElement('button');btn.type='button';btn.className='huidi-translate-field';btn.dataset.huidiTranslateField=key;btn.textContent='译';btn.title='只翻译这个字段';input.insertAdjacentElement('afterend',btn);syncFieldResult(btn);
}
function ensureFieldButtons(){
 const api=owner(),rt=runtime();if(!api||!rt)return;
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
 qsa('#fpTableEditorWorkspace [data-bind-id]').forEach(input=>appendFieldButton(input,input.dataset.bindId));
 qsa('#fpTableEditorWorkspace [data-item-row][data-item-selector]').forEach(input=>{
   const index=Number(input.dataset.itemRow),selector=input.dataset.itemSelector;
   const field=Object.entries(ITEM_SELECTORS).find(([,value])=>value===selector)?.[0];
   if(!field)return;
   const item=state().items?.[index]||{},itemKey=item.itemKey||item.id||String(index);
   appendFieldButton(input,'item:'+itemKey+':'+field);
 });
 qsa('#fpTableEditorWorkspace [data-custom-field-id]').forEach(row=>{
   const id=row.dataset.customFieldId;if(!id)return;
   appendFieldButton(row.querySelector('[data-custom-field-prop="label"]'),'custom:'+id+':label');
   appendFieldButton(row.querySelector('[data-custom-field-prop="value"]'),'custom:'+id+':value');
 });
}
function uniqueSectionRows(api,keys){
 const seen=new Set(),rows=[];
 keys.forEach(key=>api.collectSection(key,state()).forEach(row=>{const id=row.key||row.id;if(!seen.has(id)){seen.add(id);rows.push(row)}}));
 return rows;
}
function ensureTableSectionButtons(){
 const api=owner(),rt=runtime();if(!api||!rt)return;
 qsa('#fpTableEditorWorkspace .fp-sheet-panel[data-section-key]').forEach(panel=>{
   const keys=TABLE_SECTION_SECTIONS[panel.dataset.sectionKey]||[];
   let btn=panel.querySelector(':scope > .fp-sheet-panel-head > [data-huidi-translate-sections]');
   const rows=keys.length?uniqueSectionRows(api,keys):[];
   if(!keys.length||!rows.length){btn?.remove();return}
   const head=panel.querySelector(':scope > .fp-sheet-panel-head');if(!head)return;
   if(!btn){btn=document.createElement('button');btn.type='button';btn.className='huidi-translate-section huidi-table-translate-section';btn.textContent='翻译本分栏';btn.title='翻译当前表格分栏中的可翻译文字';head.appendChild(btn)}
   btn.dataset.huidiTranslateSections=keys.join(',');
 });
}
function sync(){prepareMainButton();ensureSectionButtons();ensureFieldButtons();ensureTableSectionButtons();syncTranslationResults()}
function requireRuntime(method){
 const rt=runtime();
 if(!rt||typeof rt[method]!=='function')throw new Error('翻译组件尚未准备好，请刷新页面后重试。');
 return rt;
}
function reportTranslationError(error){
 const message=error?.message||'翻译暂不可用，请稍后重试。';
 window.FlypigBOXApp?.setStatus?.(message,'error');
}
async function runButton(btn,work){
 if(!btn||btn.disabled)return;const old=btn.textContent;btn.disabled=true;btn.textContent='翻译中…';
 try{const result=await work();btn.textContent=result?.translated>0?'已译':(result?.error?'重试':'无变化');syncTranslationResults();}
 catch(error){btn.textContent='重试';reportTranslationError(error);}
 finally{btn.disabled=false;setTimeout(()=>{btn.textContent=old;sync();},1400)}
}
document.addEventListener('click',event=>{
 const section=event.target.closest('[data-huidi-translate-section],[data-huidi-translate-sections]');if(section){event.preventDefault();event.stopImmediatePropagation();const keys=section.dataset.huidiTranslateSections?section.dataset.huidiTranslateSections.split(',').filter(Boolean):section.dataset.huidiTranslateSection;return runButton(section,()=>requireRuntime('translateSection').translateSection(keys))}
 const field=event.target.closest('[data-huidi-translate-field]');if(field){event.preventDefault();event.stopImmediatePropagation();return runButton(field,()=>requireRuntime('translateField').translateField(field.dataset.huidiTranslateField))}
},true);
['HUIDI:translation-owner-ready','HUIDI:document-type-changed','HUIDI:layout-updated','HUIDI:translation-updated','HUIDI:editor-view-change'].forEach(name=>document.addEventListener(name,()=>setTimeout(sync,40)));
document.addEventListener('change',event=>{if(['documentType','docMode','docLanguage','ciComplianceLevel','packingDetailMode'].includes(event.target?.id))setTimeout(sync,60)},true);
let timer=0;new MutationObserver(records=>{if(!records.some(r=>r.addedNodes?.length||r.removedNodes?.length))return;clearTimeout(timer);timer=setTimeout(sync,80)}).observe(document.body,{childList:true,subtree:true});
function boot(){injectStyle();sync();providerStatus();setTimeout(sync,300);setTimeout(sync,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();