/* HUIDI V3.3.6.24-R1.3A.8 — editor shell compatibility without competing navigation ownership or DOM observers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const DOCS={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票（CI）',packing_list:'装箱单（PL）',sales_contract:'销售合同'};
let timer=0;
function notify(message,type='ok'){try{window.FlypigBOXApp?.setStatus?.(message,type)}catch(_){} }
function currentType(){return new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc')||'quotation'}
function currentMode(){return $('docMode')?.value==='b2b'?'b2b':'ecommerce'}
function currentView(){return document.body.classList.contains('fp-live-table-mode')||document.body.classList.contains('fp-table-editor-mode')?'table':'document'}
function visible(el){if(!el||!el.isConnected)return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&!el.hidden}
function sectionByTitle(text){return qsa('.form-column>section.card,.form-column>.collapsible-card').find(card=>(card.querySelector(':scope>h2,.section-title h2,.section-collapse-head h2')?.textContent||'').includes(text))||null}
function applyDocumentType(type){
 if(!DOCS[type]||type===currentType())return;
 if(window.FlypigBOXApp?.applyDocumentProfile){window.FlypigBOXApp.applyDocumentProfile(type,{silent:false})}
 else {const input=$('documentType');if(input){input.value=type;input.dispatchEvent(new Event('change',{bubbles:true}))}}
 window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.({force:true});
 document.dispatchEvent(new CustomEvent('HUIDI:document-type-changed',{detail:{type}}));
}
function openDrawerAction(action){
 const summary=document.querySelector('#fpLiteMoreMenu>summary');summary?.click();
 setTimeout(()=>document.querySelector(`[data-v3315-action="${action}"]`)?.click(),70);
}
function makeButton(id,text,title,handler,className='fp-v3325-head-action'){
 let button=$(id);if(button)return button;
 button=document.createElement('button');button.type='button';button.id=id;button.className=className;button.textContent=text;button.title=title;button.addEventListener('click',handler);return button;
}
function ensureDocumentSelector(){
 let wrap=$('fpV3325DocSelect');
 if(!wrap){wrap=document.createElement('label');wrap.id='fpV3325DocSelect';wrap.className='fp-v3325-doc-select';wrap.title='切换当前单据类型，保留已填写资料';wrap.innerHTML=`<span>单据</span><select id="fpV3325DocTypeHeader" aria-label="切换当前单据类型">${Object.entries(DOCS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select>`;$('fpV3325DocTypeHeader')}
 const select=wrap.querySelector('select');if(!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',event=>applyDocumentType(event.target.value))}
 select.value=currentType();return wrap;
}
function ensureHeader(){
 const actions=document.querySelector('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return false;
 const docSelect=ensureDocumentSelector();
 const layout=makeButton('fpV3325LayoutHeader','布局','管理分栏顺序、字段顺序和商品列布局',()=>window.FlypigBOXLayoutManager?.open?.());
 const clear=makeButton('fpV3325ClearHeader','清空','清空当前单据填写内容，不删除已保存单据和模板',()=>$('clearDocumentBtn')?.click(),'fp-v3325-head-action danger');
 const nodes=[
  $('fpLiteImportBtn'),document.querySelector('.fp-primary-workspace-switch'),docSelect,$('fpV3321SaveHeader'),$('fpV3321TemplateHeader'),$('fpV3321ModeHeader'),$('fpV3321FieldsHeader'),layout,$('fpLiteExportMenu'),clear,$('fpLiteMoreMenu'),$('fpLiteAccountBtn'),$('fpLiteVersion')
 ].filter(Boolean);
 if(actions.dataset.huidiToolbarOwner==='rc1617'){nodes.forEach(node=>{if(node.parentNode!==actions)window.HUIDIToolbarOwner?.place?.(node)});}
 else nodes.forEach(node=>{if(node.parentNode!==actions)actions.appendChild(node)});
 syncHeader();ensureExportEmailToggle();return true;
}
function syncHeader(){
 const select=$('fpV3325DocTypeHeader');if(select&&select.value!==currentType())select.value=currentType();
 const schema=window.FlypigBOXDocumentSchema,mode=currentMode();
 qsa('[data-v3350-mode],[data-v3321-mode]').forEach(btn=>{const value=btn.dataset.v3350Mode||btn.dataset.v3321Mode,active=value===mode,info=schema?.modeInfo?.(currentType(),value);if(info?.label)btn.textContent=info.label;if(info?.description)btn.title=info.description;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
}
function ensureExportEmailToggle(){
 const menu=$('fpLiteExportMenu')?.querySelector(':scope>div');const canonical=$('emailAfterExport');if(!menu||!canonical)return;
 let label=$('fpV3325EmailExportToggle');
 if(!label){label=document.createElement('label');label.id='fpV3325EmailExportToggle';label.className='fp-v3325-email-toggle';label.innerHTML='<input type="checkbox" aria-label="导出后创建邮件草稿"><span><b>导出后创建邮件草稿</b><small>默认关闭；导出PDF后可打开邮箱草稿</small></span>';menu.appendChild(label)}
 const mirror=label.querySelector('input');
 if(!localStorage.getItem('flypigbox_v3325_email_default_off')){canonical.checked=false;canonical.dispatchEvent(new Event('change',{bubbles:true}));localStorage.setItem('flypigbox_v3325_email_default_off','1')}
 mirror.checked=canonical.checked;
 if(!mirror.dataset.bound){mirror.dataset.bound='1';mirror.addEventListener('change',()=>{canonical.checked=mirror.checked;canonical.dispatchEvent(new Event('change',{bubbles:true}))});canonical.addEventListener('change',()=>mirror.checked=canonical.checked)}
}
function cleanDrawer(){
 const root=$('fpV3315ToolsRoot');if(!root)return;
 const title=root.querySelector('#fpV3315DrawerTitle');if(title)title.textContent='管理工具';
 const subtitle=title?.parentElement?.querySelector('span');if(subtitle)subtitle.textContent='管理分栏、字段、收款资料和签章资料。';
 root.querySelector('#fpV3315DocumentType')?.closest('section')?.classList.add('fp-v3325-drawer-migrated');
 root.querySelector('.fp-v3315-drawer-mode')?.closest('section')?.classList.add('fp-v3325-drawer-migrated');
 const names={draft:'',layout:'分栏与字段管理',fields:'字段类型管理',payment:'收款信息管理',signature:'签名公章管理',clear:''};
 Object.entries(names).forEach(([action,text])=>{const button=root.querySelector(`[data-v3315-action="${action}"]`);if(!button)return;if(!text){button.remove();return}button.textContent=text});
}
function cleanEditorChrome(){
 $('fpV3315ModeStrip')?.classList.add('fp-v3325-duplicate-control');
 qsa('.doc-mode-card').forEach(node=>node.classList.add('fp-v3325-duplicate-control'));
 qsa('.form-column>.api-card').forEach(node=>node.classList.add('fp-v3325-embedded-ai-card'));
 $('fpTradeFactoryCenter')?.classList.add('fp-v3325-duplicate-control');
 qsa('.fp-v3315-section-order').forEach(node=>node.classList.add('fp-v3325-duplicate-control'));
 qsa('[data-v3315-source="payment-section"],[data-v3315-source="signature-section"]').forEach(node=>node.classList.add('fp-v3325-duplicate-control'));
 $('previewExportActions')?.classList.add('fp-v3325-duplicate-control');
 document.querySelector('.email-draft-hint')?.classList.add('fp-v3325-duplicate-control');
 document.querySelector('.preview-toolbar .edit-hint')?.classList.add('fp-v3325-duplicate-control');
}
function updateAll(){timer=0;ensureHeader();cleanDrawer();cleanEditorChrome();syncHeader();window.FlypigBOXV3350?.refresh?.(false)}
window.FlypigBOXV3325={refresh:updateAll,rebuildSideNav:()=>window.FlypigBOXV3350?.refresh?.(false),ensureHeader};
function schedule(delay=80){clearTimeout(timer);timer=setTimeout(updateAll,delay)}
function boot(){
 if(!$('piForm'))return;
 updateAll();
 document.addEventListener('change',event=>{if(['docMode','documentType','showOrigin','showSalesperson','showTerms','showLogistics','showPayment','showSignature'].includes(event.target.id))schedule(30)},true);
 document.addEventListener('click',event=>{if(event.target.closest('[data-v3350-mode],[data-v3321-mode],[data-doc-mode],[data-v3315-doc-mode],[data-v3315-drawer-mode],[data-v3318-field-id]'))schedule(60)},true);
 ['HUIDI:document-type-changed','HUIDI:layout-updated','HUIDI:editor-view-change','HUIDI:startup-stable','HUIDI:branding-ready','HUIDI:apply-template'].forEach(name=>document.addEventListener(name,()=>schedule(40)));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1100));else setTimeout(boot,1100);
})();
