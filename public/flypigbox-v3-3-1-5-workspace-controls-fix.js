/* HUIDI V3.3.4.0 — restore workspace controls, real field switches and dependable drawers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const DOCS={
 quotation:'报价单',
 proforma_invoice:'形式发票',
 commercial_invoice:'商业发票',
 packing_list:'装箱单',
 sales_contract:'销售合同'
};
const sectionFor=id=>$(id)?.closest('section.card,.top-workspace')||null;
const SECTION_META=[
 {key:'basic',label:'基础信息',node:()=>$('#editorTop')},
 {key:'parties',label:'买卖双方',node:()=>sectionFor('saveCustomerBtn')||cardByTitle('买卖双方')},
 {key:'products',label:'商品明细',node:()=>sectionFor('itemList')||cardByTitle('商品明细')},
 {key:'terms',label:'交易条款',node:()=>sectionFor('paymentTerms')||cardByTitle('交易条款')},
 {key:'delivery',label:'收货与地址',node:()=>sectionFor('consigneeName')||sectionFor('shipToAddress')||cardByTitle('收货')},
 {key:'logistics',label:'物流信息',node:()=>document.querySelector('[data-optional-section="showLogistics"]')||sectionFor('shippingMethod')},
 {key:'payment',label:'收款账户',node:()=>document.querySelector('[data-optional-section="showPayment"]')||sectionFor('paymentTemplate')},
 {key:'signature',label:'签名与公章',node:()=>document.querySelector('[data-optional-section="showSignature"]')||sectionFor('signatureFile')},
 {key:'ai',label:'翻译辅助',node:()=>document.querySelector('.form-column>.api-card')}
];
let observerTimer=0;
function cardByTitle(text){return qsa('.form-column>section.card,.form-column>.collapsible-card').find(card=>clean(card.querySelector('.section-collapse-head h2,.section-title h2,:scope>h2')?.textContent).includes(text))||null}
function currentDocType(){return new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc')||'quotation'}
function currentDocMode(){return $('docMode')?.value==='b2b'?'b2b':'ecommerce'}
function toast(message,kind='ok'){window.FlypigBOXApp?.setStatus?.(message,kind);if(!window.FlypigBOXApp?.setStatus){let node=$('fpV3315Toast');if(!node){node=document.createElement('div');node.id='fpV3315Toast';node.className='fp-v3315-toast';document.body.appendChild(node)}node.textContent=message;node.classList.add('show');clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove('show'),2600)}}
function canonicalModeButton(mode){return qsa('[data-doc-mode]').find(button=>button.dataset.docMode===mode)}
function setDocMode(mode){const safe=mode==='b2b'?'b2b':'ecommerce';const button=canonicalModeButton(safe);if(button)button.click();else{$('docMode').value=safe;$('docMode').dispatchEvent(new Event('change',{bubbles:true}));window.FlypigBOXApp?.renderPreview?.()}syncModeControls()}
function setDocumentType(type){if(!DOCS[type])return;window.FlypigBOXApp?.applyDocumentProfile?.(type,{silent:false});syncAllControls();window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.()}
function openCanonicalSection(kind){window.FlypigBOXSharedActions?.invoke?.(kind==='payment'?'payment-section':'signature-section')}
function ensureModeStrip(){
 let strip=$('fpV3315ModeStrip');if(!strip){strip=document.createElement('section');strip.id='fpV3315ModeStrip';strip.className='fp-v3315-mode-strip';strip.innerHTML=`<div><b>字段版本</b><span>默认版保持精简，精细版展开当前单据可补充字段。</span></div><div class="fp-v3315-mode-buttons" role="group" aria-label="字段显示版本"><button type="button" data-v3315-doc-mode="ecommerce">默认版本</button><button type="button" data-v3315-doc-mode="b2b">精细版本</button></div>`;strip.addEventListener('click',event=>{const mode=event.target.closest('[data-v3315-doc-mode]')?.dataset.v3315DocMode;if(mode)setDocMode(mode)})}
 const dock=$('fpV33LeftDock');const form=document.querySelector('.form-column');if(dock){if(strip.parentElement!==dock)dock.prepend(strip)}else if(form&&strip.parentElement!==form)form.prepend(strip);syncModeControls()
}
function syncModeControls(){const mode=currentDocMode();qsa('[data-v3315-doc-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.v3315DocMode===mode);button.setAttribute('aria-pressed',String(button.dataset.v3315DocMode===mode))});qsa('[data-v3315-drawer-mode]').forEach(button=>{button.classList.toggle('active',button.dataset.v3315DrawerMode===mode);button.setAttribute('aria-pressed',String(button.dataset.v3315DrawerMode===mode))})}

function visibilitySourceRows(){return qsa('.visibility-grid .switch-line').map(label=>({label,input:label.querySelector('input[id]'),caption:clean(label.querySelector('[data-visibility-caption]')?.textContent||label.textContent)})).filter(row=>row.input)}
function renderDrawerFieldSettings(root=ensureDrawer()){
 const panel=root.querySelector('#fpV3318FieldSettings');if(!panel)return;
 const rows=visibilitySourceRows().filter(row=>!row.label.classList.contains('fp-visibility-hidden')&&!row.input.disabled);
 const mode=currentDocMode();
 panel.hidden=false;
 panel.innerHTML=`<div class="fp-v3318-field-head"><div><h3>字段显示设置</h3><p>${mode==='b2b'?'精细版本可选择更多补充字段。':'默认版本显示当前单据的标准字段；可直接关闭不需要的字段。'}</p></div><button type="button" data-v3318-fields-close aria-label="收起字段设置">收起</button></div><div class="fp-v3318-field-grid">${rows.map(row=>`<label><input type="checkbox" data-v3318-field-id="${row.input.id}" ${row.input.checked?'checked':''}><span>${row.caption}</span></label>`).join('')||'<p class="fp-v3318-field-empty">当前单据和版本没有可调整字段。</p>'}</div>${mode==='ecommerce'?'<button type="button" class="fp-v3318-more-fields" data-v3318-open-detailed>切换到精细版本查看更多字段</button>':''}`;
}
function toggleDrawerFieldSettings(root=ensureDrawer()){
 const panel=root.querySelector('#fpV3318FieldSettings');if(!panel)return;
 if(panel.hidden)renderDrawerFieldSettings(root);else panel.hidden=true;
}
function ensureDrawer(){
 let root=$('fpV3315ToolsRoot');if(root)return root;
 root=document.createElement('div');root.id='fpV3315ToolsRoot';root.hidden=true;root.innerHTML=`<div class="fp-v3315-drawer-backdrop" data-v3315-close></div><aside class="fp-v3315-drawer" role="dialog" aria-modal="true" aria-labelledby="fpV3315DrawerTitle"><header><div><b id="fpV3315DrawerTitle">更多工具</b><span>PDF与表格工作簿共用同一份单据数据和设置。</span></div><button type="button" data-v3315-close aria-label="关闭">×</button></header><main><section><h3>更换单据类型</h3><label class="fp-v3315-select-row"><span>当前单据</span><select id="fpV3315DocumentType">${Object.entries(DOCS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><p>切换类型不会清空已填写资料；系统会同步标准字段、PDF与表格标题。</p></section><section><h3>字段显示版本</h3><div class="fp-v3315-drawer-mode" role="group"><button type="button" data-v3315-drawer-mode="ecommerce">默认版本</button><button type="button" data-v3315-drawer-mode="b2b">精细版本</button></div></section><section class="fp-v3315-drawer-actions"><button type="button" data-v3315-action="draft">保存草稿</button><button type="button" data-v3315-action="layout">调整分栏与字段</button><button type="button" data-v3315-action="fields">字段显示设置</button><button type="button" data-v3315-action="payment">收款信息</button><button type="button" data-v3315-action="signature">签名与公章</button><button type="button" data-v3315-action="clear" class="danger">清空当前单据</button></section><section id="fpV3318FieldSettings" class="fp-v3318-field-settings" hidden></section></main></aside>`;document.body.appendChild(root);
 root.addEventListener('click',event=>{
   if(event.target.closest('[data-v3315-close]'))return closeDrawer();
   if(event.target.closest('[data-v3318-fields-close]')){root.querySelector('#fpV3318FieldSettings').hidden=true;return}
   if(event.target.closest('[data-v3318-open-detailed]')){setDocMode('b2b');setTimeout(()=>renderDrawerFieldSettings(root),40);return}
   const mirror=event.target.closest('[data-v3318-field-id]');if(mirror){const original=$(mirror.dataset.v3318FieldId);if(original){original.checked=mirror.checked;original.dispatchEvent(new Event('change',{bubbles:true}));window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.({force:true});window.FlypigBOXApp?.renderPreview?.();setTimeout(()=>renderDrawerFieldSettings(root),30)}return}
   const mode=event.target.closest('[data-v3315-drawer-mode]')?.dataset.v3315DrawerMode;if(mode){setDocMode(mode);setTimeout(()=>{if(!root.querySelector('#fpV3318FieldSettings')?.hidden)renderDrawerFieldSettings(root)},40);return}
   const action=event.target.closest('[data-v3315-action]')?.dataset.v3315Action;if(!action)return;
   if(action==='draft')$('saveDraftBtn')?.click();
   if(action==='layout')window.FlypigBOXLayoutManager?.open?.();
   if(action==='fields'){toggleDrawerFieldSettings(root);return}
   if(action==='payment')openCanonicalSection('payment');
   if(action==='signature')openCanonicalSection('signature');
   if(action==='clear')window.FlypigBOXApp?.clearCurrentDocument?.();
   if(!['layout','fields','payment','signature','clear'].includes(action))closeDrawer();
 });
 $('fpV3315DocumentType')?.addEventListener('change',event=>{const type=event.target.value;if(type!==currentDocType()){setDocumentType(type);toast(`已切换为${DOCS[type]}。`,'ok')}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden)closeDrawer()});return root
}
function openDrawer(){const root=ensureDrawer();root.hidden=false;const fields=root.querySelector('#fpV3318FieldSettings');if(fields)fields.hidden=true;document.body.classList.add('fp-v3315-drawer-open');const type=$('fpV3315DocumentType');if(type)type.value=currentDocType();syncModeControls();requestAnimationFrame(()=>root.classList.add('show'))}
function closeDrawer(){const root=$('fpV3315ToolsRoot');if(!root||root.hidden)return;root.classList.remove('show');document.body.classList.remove('fp-v3315-drawer-open');setTimeout(()=>{root.hidden=true},170)}
function installMoreTrigger(){
 document.addEventListener('click',event=>{const summary=event.target.closest('#fpLiteMoreMenu>summary');if(!summary)return;event.preventDefault();event.stopImmediatePropagation();const details=$('fpLiteMoreMenu');if(details)details.open=false;openDrawer()},true)
}
function sectionHeader(node,key){
 if(!node)return null;
 if(key==='basic')return node.querySelector(':scope>.card:first-child>.section-title')||node.querySelector('.fp-pdf-base-card>.section-title')||node.querySelector('.section-title');
 if(key==='ai')return node.querySelector(':scope>details>summary')||node.querySelector('summary');
 let header=node.querySelector(':scope>.section-title,:scope>.section-collapse-head');if(header)return header;
 const heading=node.querySelector(':scope>h2');if(!heading)return null;
 header=document.createElement('div');header.className='section-title fp-v3315-generated-section-title';heading.before(header);header.appendChild(heading);return header
}
function sectionButtons(key){return `<span class="fp-v3315-section-order" aria-label="调整分栏位置"><button type="button" data-v3315-section-move="-1" data-v3315-section-key="${key}" title="上移当前分栏">↑</button><button type="button" data-v3315-section-move="1" data-v3315-section-key="${key}" title="下移当前分栏">↓</button></span>`}
function ensurePdfSectionControls(){
 const config=window.FlypigBOXLayoutManager?.get?.();const order=config?.sections||SECTION_META.map(row=>row.key);const seenNodes=new Set();
 SECTION_META.forEach(meta=>{
  const node=meta.node();if(!node||seenNodes.has(node))return;seenNodes.add(node);const header=sectionHeader(node,meta.key);if(!header)return;
  let tools=header.querySelector(`.fp-v3315-section-tools[data-section-key="${meta.key}"]`);if(!tools){tools=document.createElement('div');tools.className='fp-v3315-section-tools';tools.dataset.sectionKey=meta.key;
   if(meta.key==='basic')tools.innerHTML=`<button type="button" data-v3315-source="payment-section">收款信息</button><button type="button" data-v3315-source="signature-section">签名与公章</button>${sectionButtons(meta.key)}`;
   else tools.innerHTML=sectionButtons(meta.key);
   header.appendChild(tools)
  }
  const i=order.indexOf(meta.key);tools.querySelectorAll('[data-v3315-section-move]').forEach(button=>{const delta=Number(button.dataset.v3315SectionMove);button.disabled=(delta<0&&i<=0)||(delta>0&&i===order.length-1)})
 })
 const basicHeader=document.querySelector('#editorTop>.card:first-child>.section-title');
 if(basicHeader&&!basicHeader.querySelector('.fp-v3315-section-tools[data-section-key="basic"]')){
   const tools=document.createElement('div');tools.className='fp-v3315-section-tools';tools.dataset.sectionKey='basic';tools.innerHTML=`<button type="button" data-v3315-source="payment-section">收款信息</button><button type="button" data-v3315-source="signature-section">签名与公章</button>${sectionButtons('basic')}`;basicHeader.appendChild(tools)
 }
 syncPdfNavOrder()
}
function syncPdfNavOrder(){
 const nav=$('fpPdfSectionNav'),cfg=window.FlypigBOXLayoutManager?.get?.();if(!nav||!cfg?.sections)return;
 const mapping={basic:'base',parties:'party',products:'products',terms:'terms',logistics:'logistics',payment:'payment',signature:'signature',ai:'ai'};
 const main=['basic','parties','products','terms'];const orderedMain=cfg.sections.filter(key=>main.includes(key));main.forEach(key=>{if(!orderedMain.includes(key))orderedMain.push(key)});
 const details=nav.querySelector('details');orderedMain.forEach(key=>{const button=nav.querySelector(`[data-pdf-nav="${mapping[key]}"]`);if(button)nav.insertBefore(button,details)});
 const menu=details?.querySelector('.fp-pdf-nav-menu');cfg.sections.filter(key=>!main.includes(key)).forEach(key=>{const target=mapping[key];if(!target)return;const button=menu?.querySelector(`[data-pdf-nav="${target}"]`);if(button)menu.appendChild(button)})
}
function installGlobalActions(){
 document.addEventListener('click',event=>{
  const source=event.target.closest('[data-v3315-source]')?.dataset.v3315Source;if(source){event.preventDefault();window.FlypigBOXSharedActions?.invoke?.(source);return}
  const move=event.target.closest('[data-v3315-section-move]');if(move){event.preventDefault();const ok=window.FlypigBOXLayoutManager?.moveSection?.(move.dataset.v3315SectionKey,Number(move.dataset.v3315SectionMove));if(ok)setTimeout(()=>{ensurePdfSectionControls();syncPdfNavOrder()},50);return}
  const outsideSource=event.target.closest('[data-table-source-action]');if(outsideSource&&!outsideSource.closest('#fpTableEditorWorkspace')){event.preventDefault();window.FlypigBOXSharedActions?.invoke?.(outsideSource.dataset.tableSourceAction)}
 },true)
}
function syncAllControls(){const selector=$('fpV3315DocumentType');if(selector)selector.value=currentDocType();syncModeControls();ensurePdfSectionControls();}
function scheduleEnsure(){clearTimeout(observerTimer);observerTimer=setTimeout(()=>{ensureModeStrip();ensurePdfSectionControls();syncAllControls()},90)}
function boot(){if(!$('piForm'))return;ensureDrawer();ensureModeStrip();installMoreTrigger();installGlobalActions();syncAllControls();['HUIDI:document-type-changed','HUIDI:layout-updated','HUIDI:editor-view-change'].forEach(name=>document.addEventListener(name,scheduleEnsure));document.addEventListener('change',event=>{if(event.target.id==='docMode'||event.target.id==='documentType')scheduleEnsure()},true);new MutationObserver(mutations=>{if(mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>node.nodeType===1)))scheduleEnsure()}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,650));else setTimeout(boot,650);
})();
