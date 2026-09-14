/* HUIDI Catalog UX Closure V1 — common-first / advanced-on-demand.
   Presentation only. Does not own Catalog data, PDF generation or product mapping. */
(()=>{
'use strict';
if(window.HUIDICatalogUXClosure)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const MODE_KEY='huidi_catalog_ux_mode_v1';
const clean=v=>String(v??'').trim();
function ensureCss(){if(document.querySelector('link[data-huidi-catalog-ux]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='../huidi-catalog-ux-closure-v1.css?v=HUIDI-CATALOG-UX-V1';l.dataset.huidiCatalogUx='1';document.head.appendChild(l)}
function mark(el,label='高级'){if(!el)return;el.classList.add('huidi-catalog-advanced');const head=el.matches('details')?el.querySelector(':scope>summary'):null;if(head&&!head.querySelector('.huidi-catalog-advanced-mark'))head.insertAdjacentHTML('beforeend',`<span class="huidi-catalog-advanced-mark">${label}</span>`)}
function normalizeLinks(){
 $$('a[href*="workspace.html?view=catalog"],a.workspace-return[href$="workspace.html"],a[href="../workspace.html"]').forEach(a=>{a.href='../workspace.html#catalog'});
}
function classify(){
 const side=$('.catalog-company-card');if(!side)return;
 // Import guidance is useful but low-frequency after the first successful import.
 const importSection=$('.catalog-import-card',side);
 if(importSection){$$('details',importSection).forEach(x=>mark(x,'帮助'))}
 // Company/brand fields stay common; author QR belongs to optional support.
 $$('.company-box',side).forEach(box=>{if(/联系作者|定制开发/.test(clean(box.textContent)))mark(box,'帮助')});
 // Appearance: presets and filename stay common. Fine tuning moves to advanced.
 const imageGap=$('#imageGap')?.closest('.slider-row');mark(imageGap);
 mark($('#defaultFit')?.closest('.field'));
 const theme=$('#themePreset')?.closest('details');mark(theme);
 // Product visibility defaults stay common; field mapping is advanced.
 const mapping=$('#mappingTable')?.closest('details');mark(mapping);
 // Technical / bulk helper fragments are advanced where present.
 $$('.advanced-note,.fp-technical-only',side).forEach(el=>{const host=el.closest('details')||el.closest('.company-box')||el.parentElement;mark(host)});
}
function currentMode(){const v=localStorage.getItem(MODE_KEY);return v==='advanced'?'advanced':'common'}
function setMode(mode){const next=mode==='advanced'?'advanced':'common';localStorage.setItem(MODE_KEY,next);document.body.dataset.huidiCatalogMode=next;$$('[data-huidi-catalog-mode-btn]').forEach(b=>b.classList.toggle('active',b.dataset.huidiCatalogModeBtn===next));const note=$('#huidiCatalogModeNote');if(note)note.textContent=next==='common'?'只显示制作目录常用项；不会影响已保存的高级设置。':'显示图片微调、主题、字段映射和低频辅助。';updateSummary()}
function activePreset(){const b=$('#catalogPresetOptions .catalog-preset.active');return clean(b?.querySelector('b')?.textContent)||'默认目录'}
function valueText(id,map={}){const el=$(id);if(!el)return'—';return map[el.value]||clean(el.options?.[el.selectedIndex]?.textContent)||clean(el.value)||'—'}
function updateSummary(){const box=$('#huidiCatalogLiveSummary');if(!box)return;const count=clean($('#productCount')?.textContent)||'0 个产品';const preset=activePreset();const price=valueText('#priceMode',{show:'显示价格',quote:'询价模式',hide:'隐藏价格'});const cover=valueText('#coverMode',{none:'无封面',simple:'简洁封面'});box.innerHTML=`<span><b>${count}</b></span><span>用途 <b>${preset}</b></span><span>价格 <b>${price}</b></span><span>封面 <b>${cover}</b></span>`}
function ensureModebar(){const side=$('.catalog-company-card');if(!side||$('#huidiCatalogModebar'))return;const bar=document.createElement('div');bar.id='huidiCatalogModebar';bar.className='huidi-catalog-modebar';bar.innerHTML=`<div class="huidi-catalog-modebar-top"><div><b>目录设置</b><small id="huidiCatalogModeNote"></small></div><div class="huidi-catalog-mode-switch"><button type="button" data-huidi-catalog-mode-btn="common">常用</button><button type="button" data-huidi-catalog-mode-btn="advanced">高级</button></div></div><div id="huidiCatalogLiveSummary" class="huidi-catalog-live-summary"></div>`;side.prepend(bar);bar.addEventListener('click',e=>{const b=e.target.closest('[data-huidi-catalog-mode-btn]');if(b)setMode(b.dataset.huidiCatalogModeBtn)});setMode(currentMode())}
function bind(){if(document.documentElement.dataset.huidiCatalogUxBound)return;document.documentElement.dataset.huidiCatalogUxBound='1';document.addEventListener('change',e=>{if(e.target.matches('#priceMode,#coverMode,#pageSize,#catalogProjectLanguage,#catalogProjectCurrency'))updateSummary()});document.addEventListener('click',e=>{if(e.target.closest('.catalog-preset,[data-rows],#importFromProductLibrary,#clearImport'))setTimeout(updateSummary,60)});const pc=$('#productCount');if(pc&&window.MutationObserver)new MutationObserver(updateSummary).observe(pc,{childList:true,subtree:true,characterData:true})}
function apply(){ensureCss();document.body.dataset.huidiCatalogUx='v1';normalizeLinks();classify();ensureModebar();bind();updateSummary()}
function boot(){apply();[250,700,1500].forEach(ms=>setTimeout(apply,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICatalogUXClosure=Object.freeze({version:'1.0.0',apply,setMode,updateSummary});
})();
