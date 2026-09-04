(()=>{'use strict';
if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
const DEFAULT_SELLER_KEY='flypigbox_v3341_default_seller';
const TEMPLATE_KEY='flypigbox_v3341_personal_section_templates';
const SELLER_FIELDS=['sellerName','sellerContact','sellerPhone','sellerEmail','sellerAddress','sellerTaxId','sellerRegistrationNo','sellerVatNo','sellerEoriNo'];
const SELLER_LABELS={sellerName:'卖方公司',sellerContact:'卖方联系人',sellerPhone:'卖方电话',sellerEmail:'卖方邮箱',sellerAddress:'卖方地址',sellerTaxId:'卖方税号',sellerRegistrationNo:'卖方公司注册号',sellerVatNo:'卖方增值税号（VAT）',sellerEoriNo:'卖方欧盟经营者编号（EORI）'};
const GROUPS={
 seller:{label:'卖方资料',fields:SELLER_FIELDS},
 references:{label:'关联单据与日期',fields:['inquiryNo','quotationVersion','customerOrderNo','internalOrderNo','relatedQuotationNo','relatedPiNo','relatedContractNo','relatedCommercialInvoiceNo','relatedPackingListNo','quotationValidUntil','proformaValidUntil','contractSignedDate','contractEffectiveDate','contractExpiryDate','packingDate']},
 buyer:{label:'买方、收货与通知资料',fields:['buyerName','buyerContact','buyerPhone','buyerEmail','buyerWebsite','buyerCountry','buyerCountryCode','buyerAddress','buyerTaxId','buyerRegistrationNo','buyerVatNo','buyerEoriNo','consigneeName','consigneeContact','consigneePhone','consigneeEmail','consigneeAddress','notifyPartyName','notifyPartyContact','notifyPartyPhone','notifyPartyEmail','notifyPartyAddress','billToAddress','shipToAddress']},
 logistics:{label:'包装、物流与实际出货',fields:['shippingMethod','portOfLoading','destinationPort','estimatedShipment','etd','eta','packageCount','packageType','netWeight','grossWeight','cbm','packageDimensions','shippingMarks','totalPieces','cartonRange','cartonsInLine','quantityPerCarton','palletNo','palletCount','mixedPackingNote','transportDocumentType','logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','actualShipmentDate','actualDepartureDate','actualArrivalDate','logisticsExtraRowsJson']},
 payment:{label:'付款计划与收款账户',fields:['paymentTemplate','bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress','paymentTerms','syncPaymentTerms','depositPercent','depositAmount','depositDueDate','balancePercent','balanceAmount','balanceDueCondition','balanceDueDate','creditDays']},
 terms:{label:'交易、质量与合同条款',fields:['paymentTerms','tradeTerms','deliveryTime','remarks','contractClauses','qualityStandard','inspectionMethod','inspectionDeadlineDays','riskTransferPoint','warrantyPeriod','governingLaw','disputeResolution','sellerSignatory','buyerSignatory','attachmentList','productionStartDate','expectedCompletionDate','inspectionDate','partialShipmentPlan']},
 signature:{label:'签章配置',fields:['assetProfileSelect','assetProfileName','signatureLayout','stampX','stampY','stampRotate','stampScale','signatureX','signatureY','signatureRotate','signatureScale']}
};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const observedDrawerRoots=new WeakSet(),protectedMoreHubs=new WeakSet();
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){notify('本地存储空间不足，暂时无法保存。','error');return false}};
const notify=(m,t='ok')=>{try{window.FlypigBOXApp?.setStatus?.(m,t)}catch(_){}};
const val=id=>{const el=document.getElementById(id);if(!el)return'';return el.type==='checkbox'?Boolean(el.checked):String(el.value??'')};
const has=v=>typeof v==='boolean'?v:clean(v)!=='';
const capture=ids=>Object.fromEntries(ids.filter(id=>document.getElementById(id)).map(id=>[id,val(id)]));
function setField(id,value,{blank=false}={}){const el=document.getElementById(id);if(!el)return false;if(blank&&has(val(id)))return false;if(el.type==='checkbox')el.checked=Boolean(value);else el.value=value??'';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true}
function refresh(){try{window.FlypigBOXApp?.renderPreview?.()}catch(_){}try{window.FlypigBOXTableOutput?.refresh?.({force:true})}catch(_){}}
function closeDrawer(){const root=$('#fpV3315ToolsRoot');if(!root)return;root.classList.remove('show','fp-v3320-fields-view','fp-v3339-guide-view');document.body.classList.remove('fp-v3315-drawer-open');setTimeout(()=>{root.hidden=true},170)}
function fieldLabel(id){const el=document.getElementById(id);const label=el?.closest('label')?.querySelector(':scope>span,:scope>small')?.textContent||el?.previousElementSibling?.textContent;return clean(label)||SELLER_LABELS[id]||id}
function contextSnapshot(){return{documentType:document.getElementById('documentType')?.value||'quotation',docMode:document.getElementById('docMode')?.value||'ecommerce',paperOrientation:document.getElementById('paperOrientation')?.value||'auto',tradeScenario:document.getElementById('tradeScenario')?.value||'wholesale'}}
function templates(){const rows=read(TEMPLATE_KEY,[]);return Array.isArray(rows)?rows:[]}
function saveTemplates(rows){return write(TEMPLATE_KEY,rows)}
function sellerSaved(){const data=read(DEFAULT_SELLER_KEY,null);return data&&typeof data==='object'?data:null}
function sellerEditorHtml(){return SELLER_FIELDS.map(id=>`<label><span>${esc(SELLER_LABELS[id])}</span><input data-rc15-seller-field="${id}" value=""></label>`).join('')}
function groupOptions(selected='all'){const first=`<option value="all"${selected==='all'?' selected':''}>全部分类</option>`;return first+Object.entries(GROUPS).map(([k,g])=>`<option value="${k}"${selected===k?' selected':''}>${esc(g.label)}</option>`).join('')}
function createGroupOptions(){return Object.entries(GROUPS).map(([k,g])=>`<option value="${k}">${esc(g.label)}</option>`).join('')}
function ensureHub(){
 const root=$('#fpV3315ToolsRoot');const main=root?.querySelector('.fp-v3315-drawer main');if(!root||!main)return false;
 let hub=$('#huidiRc15MoreHub');if(!hub){
  hub=document.createElement('section');hub.id='huidiRc15MoreHub';hub.className='huidi-rc15-more-hub';
  hub.innerHTML=`
   <nav class="huidi-rc15-tabs" aria-label="更多功能分类">
    <button type="button" class="active" data-rc15-tab="data">资料管理</button>
    <button type="button" data-rc15-tab="assist">单据辅助</button>
    <button type="button" data-rc15-tab="advanced">高级</button>
   </nav>
   <div class="huidi-rc15-panel active" data-rc15-panel="data">
    <section class="huidi-rc15-card huidi-rc15-seller-card">
     <header><div><b>默认卖方资料</b><span id="huidiRc15SellerState">尚未保存</span></div><button type="button" data-rc15-seller-from-current>读取当前单据</button></header>
     <p>这里管理以后新单据自动填充的卖方资料。默认只填空白，不覆盖已经导入或填写的内容。</p>
     <div class="huidi-rc15-seller-grid">${sellerEditorHtml()}</div>
     <div class="huidi-rc15-actions"><button type="button" class="primary" data-rc15-seller-save>保存默认资料</button><button type="button" data-rc15-seller-blank>填充当前空白</button><button type="button" data-rc15-seller-overwrite>覆盖到当前单据</button><button type="button" class="danger ghost" data-rc15-seller-delete>删除默认资料</button></div>
    </section>
    <section class="huidi-rc15-card huidi-rc15-template-card">
     <header><div><b>常用资料模板</b><span id="huidiRc15TemplateCount">0 个模板</span></div><button type="button" data-rc15-template-new>新建模板</button></header>
     <p>复用卖方、买方、收款、物流、条款或签章资料；这里不是 PDF 模板/样式。模板可搜索、编辑、复制和一键套用。</p>
     <div class="huidi-rc15-template-toolbar"><input id="huidiRc15TemplateSearch" placeholder="搜索模板名称或备注"><select id="huidiRc15TemplateFilter">${groupOptions()}</select></div>
     <div id="huidiRc15TemplateCreate" class="huidi-rc15-template-create" hidden><label><span>分类</span><select id="huidiRc15CreateCategory">${createGroupOptions()}</select></label><label><span>模板名称</span><input id="huidiRc15CreateName" placeholder="例如：香港收款账户"></label><label class="wide"><span>内部备注</span><textarea id="huidiRc15CreateNote" placeholder="例如：适用于 FOB 宁波；已核对"></textarea></label><div class="huidi-rc15-actions wide"><button type="button" class="primary" data-rc15-template-save-new>保存当前页面对应资料</button><button type="button" data-rc15-template-cancel-new>取消</button></div></div>
     <div id="huidiRc15TemplateList" class="huidi-rc15-template-list"></div>
     <div id="huidiRc15TemplateEditor" class="huidi-rc15-template-editor" hidden></div>
    </section>
   </div>
   <div class="huidi-rc15-panel" data-rc15-panel="assist">
    <section class="huidi-rc15-card"><header><div><b>单据辅助</b><span>检查建议、保存设置和签章等辅助操作</span></div></header><div class="huidi-rc15-action-list"><button type="button" data-rc15-action="check"><span>检查建议</span><small>仅辅助核对并定位字段，不限制导出</small></button><button type="button" data-rc15-action="guide"><span>单据与版本说明</span><small>查看用途、专业模式和字段差异</small></button><button type="button" data-rc15-action="metadata"><span>保存单据</span><small>可修改保存名称与内部备注；与顶部保存使用同一流程</small></button><button type="button" data-rc15-action="signature"><span>签名与公章</span><small>定位到当前单据签章区域</small></button></div></section>
   </div>
   <div class="huidi-rc15-panel" data-rc15-panel="advanced">
    <section class="huidi-rc15-card"><header><div><b>高级</b><span>不常用操作</span></div></header><div class="huidi-rc15-action-list"><button type="button" data-rc15-action="internal"><span>内部工具</span><small>成本、生产、质量与交付资料</small></button><button type="button" class="danger" data-rc15-action="clear"><span>清空当前单据</span><small>仅在确认不再需要当前内容时使用</small></button></div></section>
   </div>`;
  main.prepend(hub);bindHub(hub);
 }
 protectHub(hub,root);
 syncDrawerTitle();renderSeller(hub);renderTemplates(hub);return true;
}
function protectHub(hub,root){
 if(!hub||!root)return;
 hub.classList.remove('fp-v3341-hide-legacy');
 if(!protectedMoreHubs.has(hub)){
  protectedMoreHubs.add(hub);
  new MutationObserver(()=>{if(hub.classList.contains('fp-v3341-hide-legacy'))hub.classList.remove('fp-v3341-hide-legacy')}).observe(hub,{attributes:true,attributeFilter:['class']});
 }
 if(!observedDrawerRoots.has(root)){
  observedDrawerRoots.add(root);
  new MutationObserver(()=>{if(root.classList.contains('show')){ensureHub();syncDrawerTitle()}}).observe(root,{attributes:true,attributeFilter:['class','hidden']});
 }
}
function observeDrawerLifecycle(){
 const body=document.body;if(!body)return;
 new MutationObserver(mutations=>{for(const m of mutations){for(const node of m.addedNodes||[]){if(node?.nodeType===1&&(node.id==='fpV3315ToolsRoot'||node.querySelector?.('#fpV3315ToolsRoot'))){setTimeout(()=>{ensureHub();syncDrawerTitle()},0);return}}}}).observe(body,{childList:true});
}
function syncDrawerTitle(){const root=$('#fpV3315ToolsRoot');if(!root||root.classList.contains('fp-v3320-fields-view')||root.classList.contains('fp-v3339-guide-view'))return;const title=$('#fpV3315DrawerTitle');const sub=root.querySelector('.fp-v3315-drawer>header span');if(title)title.textContent='更多';if(sub)sub.textContent='只放低频设置与资料管理；高频操作留在顶部。'}
function bindHub(hub){
 hub.addEventListener('click',e=>{
  const tab=e.target.closest('[data-rc15-tab]');if(tab){const key=tab.dataset.rc15Tab;$$('[data-rc15-tab]',hub).forEach(b=>b.classList.toggle('active',b===tab));$$('[data-rc15-panel]',hub).forEach(p=>p.classList.toggle('active',p.dataset.rc15Panel===key));return}
  if(e.target.closest('[data-rc15-seller-from-current]')){fillSellerEditor(capture(SELLER_FIELDS));notify('已读取当前单据卖方资料；确认后点击“保存默认资料”。');return}
  if(e.target.closest('[data-rc15-seller-save]')){saveSellerFromEditor(hub);return}
  if(e.target.closest('[data-rc15-seller-blank]')){applySeller(hub,true);return}
  if(e.target.closest('[data-rc15-seller-overwrite]')){if(confirm('确定用默认卖方资料覆盖当前单据中的卖方字段吗？'))applySeller(hub,false);return}
  if(e.target.closest('[data-rc15-seller-delete]')){if(confirm('确定删除默认卖方资料吗？以后新单据将不再自动填充。')){localStorage.removeItem(DEFAULT_SELLER_KEY);renderSeller(hub);notify('默认卖方资料已删除。')}return}
  if(e.target.closest('[data-rc15-template-new]')){$('#huidiRc15TemplateCreate',hub).hidden=false;$('#huidiRc15CreateName',hub)?.focus();return}
  if(e.target.closest('[data-rc15-template-cancel-new]')){$('#huidiRc15TemplateCreate',hub).hidden=true;return}
  if(e.target.closest('[data-rc15-template-save-new]')){createTemplate(hub);return}
  const card=e.target.closest('[data-rc15-template-id]');if(card){const id=card.dataset.rc15TemplateId;if(e.target.closest('[data-rc15-template-blank]')){applyTemplate(id,true);return}if(e.target.closest('[data-rc15-template-edit]')){openTemplateEditor(hub,id);return}}
  const edit=e.target.closest('#huidiRc15TemplateEditor');if(edit&&!edit.hidden){const id=edit.dataset.templateId;if(e.target.closest('[data-rc15-template-save-edit]')){saveTemplateEdit(hub,id);return}if(e.target.closest('[data-rc15-template-update-current]')){updateTemplateFromCurrent(hub,id);return}if(e.target.closest('[data-rc15-template-duplicate]')){duplicateTemplate(hub,id);return}if(e.target.closest('[data-rc15-template-delete]')){deleteTemplate(hub,id);return}if(e.target.closest('[data-rc15-template-close-edit]')){edit.hidden=true;return}if(e.target.closest('[data-rc15-template-overwrite]')){if(confirm('确定用该模板覆盖当前同类字段吗？'))applyTemplate(id,false);return}}
  const action=e.target.closest('[data-rc15-action]')?.dataset.rc15Action;if(action){runAuxAction(action,e.target);return}
 });
 $('#huidiRc15TemplateSearch',hub)?.addEventListener('input',()=>renderTemplates(hub));$('#huidiRc15TemplateFilter',hub)?.addEventListener('change',()=>renderTemplates(hub));
}
function fillSellerEditor(data={}){$$('[data-rc15-seller-field]').forEach(input=>{input.value=data[input.dataset.rc15SellerField]??''})}
function sellerEditorData(){return Object.fromEntries($$('[data-rc15-seller-field]').map(input=>[input.dataset.rc15SellerField,input.value]))}
function renderSeller(hub){const saved=sellerSaved();fillSellerEditor(saved||{});const state=$('#huidiRc15SellerState',hub);if(state){const count=saved?Object.values(saved).filter(has).length:0;state.textContent=count?`已保存 · ${count} 项`:'尚未保存';state.classList.toggle('ready',Boolean(count))}}
function saveSellerFromEditor(hub){const data=sellerEditorData();if(!Object.values(data).some(has)){notify('请至少填写一项卖方资料。','error');return}if(write(DEFAULT_SELLER_KEY,data)){renderSeller(hub);notify('默认卖方资料已保存；以后新单据只填空白字段。')}}
function applySeller(hub,blank){const data=sellerSaved();if(!data||!Object.values(data).some(has)){notify('还没有可套用的默认卖方资料。','error');return}let count=0;Object.entries(data).forEach(([id,v])=>{if(setField(id,v,{blank}))count++});refresh();notify(`${blank?'已填充空白':'已覆盖'}卖方资料，共写入 ${count} 个字段。`)}
function renderTemplates(hub){const list=$('#huidiRc15TemplateList',hub);if(!list)return;const search=clean($('#huidiRc15TemplateSearch',hub)?.value).toLowerCase();const filter=$('#huidiRc15TemplateFilter',hub)?.value||'all';const all=templates().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));const rows=all.filter(r=>(filter==='all'||r.category===filter)&&(!search||`${r.name||''} ${r.note||''} ${GROUPS[r.category]?.label||''}`.toLowerCase().includes(search)));const count=$('#huidiRc15TemplateCount',hub);if(count)count.textContent=`${all.length} 个模板`;if(!rows.length){list.innerHTML=`<div class="huidi-rc15-empty">${all.length?'没有符合当前筛选的模板。':'还没有个人资料模板。点击“新建模板”即可把当前页面资料保存下来。'}</div>`;return}list.innerHTML=rows.map(r=>`<article data-rc15-template-id="${esc(r.id)}"><div><b>${esc(r.name||'未命名模板')}</b><span>${esc(GROUPS[r.category]?.label||r.category||'未分类')} · ${new Date(r.updatedAt||r.createdAt||Date.now()).toLocaleDateString()}</span><p>${esc(r.note||'无内部备注')}</p></div><div class="huidi-rc15-row-actions"><button type="button" class="primary" data-rc15-template-blank>填充空白</button><button type="button" data-rc15-template-edit>编辑管理</button></div></article>`).join('')}
function createTemplate(hub){const category=$('#huidiRc15CreateCategory',hub)?.value;const group=GROUPS[category],name=clean($('#huidiRc15CreateName',hub)?.value),note=clean($('#huidiRc15CreateNote',hub)?.value);if(!group||!name){notify('请选择分类并填写模板名称。','error');return}const data=capture(group.fields);if(!Object.values(data).some(has)){notify(`当前页面的“${group.label}”没有可保存内容。`,'error');return}const rows=templates(),now=Date.now();rows.push({id:`tpl_${now}_${Math.random().toString(36).slice(2,7)}`,category,name,note,data,context:contextSnapshot(),createdAt:now,updatedAt:now});if(saveTemplates(rows)){$('#huidiRc15CreateName',hub).value='';$('#huidiRc15CreateNote',hub).value='';$('#huidiRc15TemplateCreate',hub).hidden=true;renderTemplates(hub);notify(`已保存个人模板“${name}”。`)}}
function applyTemplate(id,blank){const row=templates().find(r=>r.id===id);if(!row)return;let count=0;Object.entries(row.data||{}).forEach(([fieldId,v])=>{if(setField(fieldId,v,{blank}))count++});refresh();notify(`${blank?'已填充空白':'已覆盖套用'}“${row.name}”，写入 ${count} 个字段。`)}
function openTemplateEditor(hub,id){const row=templates().find(r=>r.id===id),box=$('#huidiRc15TemplateEditor',hub);if(!row||!box)return;box.dataset.templateId=id;const fields=Object.entries(row.data||{}).map(([fieldId,v])=>{const boolean=typeof v==='boolean';return `<label><span>${esc(fieldLabel(fieldId))}</span>${boolean?`<input type="checkbox" data-rc15-edit-field="${esc(fieldId)}" ${v?'checked':''}>`:`<input data-rc15-edit-field="${esc(fieldId)}" value="${esc(v)}">`}</label>`}).join('');box.innerHTML=`<header><div><b>编辑模板</b><span>${esc(GROUPS[row.category]?.label||row.category)}</span></div><button type="button" data-rc15-template-close-edit>×</button></header><div class="huidi-rc15-template-edit-meta"><label><span>模板名称</span><input id="huidiRc15EditName" value="${esc(row.name||'')}"></label><label><span>内部备注</span><textarea id="huidiRc15EditNote">${esc(row.note||'')}</textarea></label></div><div class="huidi-rc15-template-edit-fields">${fields||'<p>此模板没有可编辑字段。</p>'}</div><div class="huidi-rc15-actions"><button type="button" class="primary" data-rc15-template-save-edit>保存修改</button><button type="button" data-rc15-template-update-current>用当前页面更新内容</button><button type="button" data-rc15-template-overwrite>覆盖到当前单据</button><button type="button" data-rc15-template-duplicate>复制模板</button><button type="button" class="danger ghost" data-rc15-template-delete>删除模板</button></div>`;box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'})}
function saveTemplateEdit(hub,id){const rows=templates(),row=rows.find(r=>r.id===id),box=$('#huidiRc15TemplateEditor',hub);if(!row||!box)return;const name=clean($('#huidiRc15EditName',box)?.value);if(!name){notify('模板名称不能为空。','error');return}row.name=name;row.note=clean($('#huidiRc15EditNote',box)?.value);$$('[data-rc15-edit-field]',box).forEach(el=>{row.data[el.dataset.rc15EditField]=el.type==='checkbox'?el.checked:el.value});row.updatedAt=Date.now();if(saveTemplates(rows)){renderTemplates(hub);notify(`模板“${name}”已更新。`)}}
function updateTemplateFromCurrent(hub,id){const rows=templates(),row=rows.find(r=>r.id===id),group=GROUPS[row?.category];if(!row||!group)return;const data=capture(group.fields);if(!Object.values(data).some(has)){notify(`当前页面的“${group.label}”没有可更新内容。`,'error');return}row.data=data;row.context=contextSnapshot();row.updatedAt=Date.now();if(saveTemplates(rows)){renderTemplates(hub);openTemplateEditor(hub,id);notify(`已用当前页面更新模板“${row.name}”。`)}}
function duplicateTemplate(hub,id){const rows=templates(),row=rows.find(r=>r.id===id);if(!row)return;const now=Date.now(),copy=JSON.parse(JSON.stringify(row));copy.id=`tpl_${now}_${Math.random().toString(36).slice(2,7)}`;copy.name=`${row.name} · 副本`;copy.createdAt=now;copy.updatedAt=now;rows.push(copy);if(saveTemplates(rows)){renderTemplates(hub);openTemplateEditor(hub,copy.id);notify('模板副本已创建。')}}
function deleteTemplate(hub,id){const row=templates().find(r=>r.id===id);if(!row||!confirm(`确定删除模板“${row.name}”吗？`))return;if(saveTemplates(templates().filter(r=>r.id!==id))){const box=$('#huidiRc15TemplateEditor',hub);if(box)box.hidden=true;renderTemplates(hub);notify('个人模板已删除。')}}
function runAuxAction(action,trigger){if(action==='check'){window.HUIDIActionOwner?.check?.();return}if(action==='guide'){document.querySelector('[data-v3339-guide]')?.click();setTimeout(syncDrawerTitle,220);return}if(action==='metadata'){window.FlypigBOXSmartSave?.openSettings?.();return}if(action==='signature'){closeDrawer();setTimeout(()=>window.FlypigBOXSharedActions?.invoke?.('signature-section'),190);return}if(action==='internal'){closeDrawer();setTimeout(()=>window.FlypigBOXInternalTools?.open?.('factory',trigger),190);return}if(action==='clear'){document.querySelector('[data-v3315-action="clear"]')?.click();return}}
function boot(){if(!document.getElementById('piForm'))return;document.body.dataset.huidiLocalUxRelease='rc15';observeDrawerLifecycle();window.addEventListener('click',e=>{if(e.target.closest?.('#fpLiteMoreMenu>summary'))[0,30,90,220].forEach(ms=>setTimeout(()=>{ensureHub();syncDrawerTitle()},ms));if(e.target.closest?.('[data-v3339-guide-back],[data-v3320-fields-back],[data-v3318-fields-close]'))[40,120,260].forEach(ms=>setTimeout(()=>{ensureHub();syncDrawerTitle()},ms));},true);document.addEventListener('HUIDI:document-type-changed',()=>setTimeout(()=>{ensureHub();syncDrawerTitle()},90));[300,700,1200,1700,2600,4200].forEach(ms=>setTimeout(()=>{ensureHub();syncDrawerTitle()},ms));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDILocalRC15=Object.freeze({version:'1.2.0-RC15',ensureHub,renderTemplates:()=>{const hub=$('#huidiRc15MoreHub');if(hub)renderTemplates(hub)}});
})();
