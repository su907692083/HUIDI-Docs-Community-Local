/* HUIDI V3.3.6.24-R1.3A.5 — optional metadata editing, smart one-click save and compact basic section.
   Normal save reuses current form values; the metadata dialog is available only when the user chooses to edit it. */
(()=>{'use strict';
const $=id=>document.getElementById(id);const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const DOC_LABELS={quotation:'报价单',proforma_invoice:'形式发票',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'};
let ensureTimer=0,allowOriginalSave=false;
function currentType(){return new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc')||'proforma_invoice'}
function currentMode(){return $('docMode')?.value==='b2b'?'b2b':'ecommerce'}
function field(id,value){let el=$(id);if(!el){el=document.createElement('input');el.type='hidden';el.id=id;el.value=value||'';const host=$('fpFeeItemsJson')?.parentElement||$('piForm')||document.body;host.appendChild(el)}return el}
function ensureMetaFields(){field('workspaceDocumentTitle','');field('workspaceDocumentNote','');field('workspaceDocumentId','');field('workspaceSourceDocumentId','');field('workspaceSourceDocumentType','');field('workspaceSourceDocumentNo','')}
function cleanText(value){return String(value??'').replace(/\s+/g,' ').trim()}
function safeSegment(value,max=34){
 let text=cleanText(value);try{text=text.normalize('NFKC')}catch(_){}
 text=text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/[._\s]+/g,'_').replace(/_+/g,'_').replace(/^[_-]+|[_-]+$/g,'');
 return (text||'').slice(0,max)
}
function contextData(){try{return JSON.parse(sessionStorage.getItem('flypigbox_document_context')||'{}')||{}}catch(_){return {}}}
function currentDocumentNo(){return cleanText($('invoiceNo')?.value||$('quoteNo')?.value||'')}
function currentCustomer(){const ctx=contextData();return cleanText($('buyerName')?.value||ctx?.customer?.company_name||ctx?.customer?.name||'')}
function currentCurrency(){return cleanText($('currency')?.value||contextData()?.customer?.currency||'USD').toUpperCase()||'USD'}
function currentTotal(){
 try{const total=Number(window.FlypigBOXFees?.totals?.()?.total);if(Number.isFinite(total)&&total>0)return total}catch(_){}
 try{const state=window.FlypigBOXApp?.formState?.(false)||{};return (state.items||[]).reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.price)||0),0)}catch(_){return 0}
}
function amountToken(){const total=currentTotal();if(!(total>0))return '';const rounded=Math.round(total*100)/100;return `${currentCurrency()}${Number.isInteger(rounded)?String(rounded):rounded.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}`}
function defaultTitle(){
 const parts=[safeSegment(currentCustomer(),28),safeSegment(DOC_LABELS[currentType()]||'业务单据',16),safeSegment(currentDocumentNo(),30),safeSegment(amountToken(),20)].filter(Boolean);
 return (parts.join('_')||`${DOC_LABELS[currentType()]||'业务单据'}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`).slice(0,120)
}
function autoSummary(){
 const rows=[];const customer=currentCustomer(),total=currentTotal(),currency=currentCurrency();
 if(customer)rows.push(`客户：${customer}`);
 if(total>0)rows.push(`金额：${currency} ${Math.round(total*100)/100}`);
 const payment=cleanText($('paymentTerms')?.value);if(payment)rows.push(`付款：${payment}`);
 const trade=cleanText($('tradeTerms')?.value);if(trade)rows.push(`贸易术语：${trade}`);
 const delivery=cleanText($('deliveryTime')?.value);if(delivery)rows.push(`交付：${delivery}`);
 const date=cleanText($('issueDate')?.value);if(date)rows.push(`日期：${date}`);
 const items=window.FlypigBOXApp?.formState?.(false)?.items||[];const count=items.filter(item=>cleanText(item?.name||item?.sku||item?.spec)||Number(item?.qty)>0||Number(item?.price)>0).length;if(count)rows.push(`商品：${count}项`);
 return rows.join('｜').slice(0,500)
}
function isLegacyAutoTitle(value){
 const text=cleanText(value);if(!text)return true;
 if(/^(未命名|我的)\s*(PI|报价|单据|草稿)/i.test(text))return true;
 return /^(报价单|形式发票(?:（PI）)?|商业发票|销售合同|装箱单)\s*[·_\-]?\s*[A-Z]{0,4}\d+/i.test(text)
}
function prepareSmartMetadata({forceTitle=false,forceNote=false}={}){
 ensureMetaFields();const title=$('workspaceDocumentTitle'),note=$('workspaceDocumentNote');
 const currentId=cleanText($('workspaceDocumentId')?.value||sessionStorage.getItem('flypigbox_current_document_id')||'');
 const sourceId=cleanText($('workspaceSourceDocumentId')?.value||'');
 const existing=cleanText(title?.value);
 if(title&&(forceTitle||!existing||(!currentId&&(sourceId||isLegacyAutoTitle(existing)))))title.value=defaultTitle();
 if(note&&(forceNote||!cleanText(note.value)))note.value=autoSummary();
 return {title:cleanText(title?.value)||defaultTitle(),note:cleanText(note?.value),currentId}
}
function triggerOriginalSave(button=$('saveAllBtn')){if(!button||button.disabled)return;allowOriginalSave=true;setTimeout(()=>button.click(),0)}
function migrateBasicFirst(){
 const marker='flypigbox_v3322_basic_first_migrated';if(localStorage.getItem(marker)==='1')return;
 ['quotation','proforma_invoice','commercial_invoice','packing_list','sales_contract'].forEach(type=>{const key=`flypigbox_layout_v331_${type}`;try{const cfg=JSON.parse(localStorage.getItem(key)||'{}')||{};const sections=Array.isArray(cfg.sections)?cfg.sections:[];cfg.sections=['basic',...sections.filter(x=>x!=='basic')];localStorage.setItem(key,JSON.stringify(cfg))}catch(_){}});
 try{localStorage.setItem(marker,'1')}catch(_){}
}
function moveBasicToTop(){const form=document.querySelector('.form-column'),basic=$('editorTop');if(!form||!basic)return;const dock=$('fpV33LeftDock');const anchor=dock?.nextSibling||form.firstChild;if(basic.parentElement!==form||basic!==anchor)form.insertBefore(basic,anchor);basic.dataset.v3320Basic='1'}
function compactBasicCard(){
 const basic=$('editorTop')?.querySelector(':scope>.card:first-child');if(!basic)return;
 const title=basic.querySelector('.section-title h2');if(title)title.textContent='基础信息';
 const hint=basic.querySelector(':scope>.hint');if(hint)hint.innerHTML='<b>客户文件语言</b>只控制右侧预览和导出；左侧保持中文填写。常用编号、日期和币种在这里完成。';
 const panel=basic.querySelector('.pi-code-panel');if(panel&&!panel.dataset.v3320Ready){panel.dataset.v3320Ready='1';const head=panel.querySelector('.pi-code-head');if(head){const btn=document.createElement('button');btn.type='button';btn.className='fp-v3320-number-toggle';btn.textContent='展开编号规则';btn.addEventListener('click',()=>{panel.classList.toggle('fp-v3320-open');btn.textContent=panel.classList.contains('fp-v3320-open')?'收起编号规则':'展开编号规则'});head.appendChild(btn)}}
}
const DETAILED_IDS=['originCountry','quoteNo','customerPo','moqControl','salesperson','sellerTaxId','buyerCountryCode','buyerWebsite','buyerTaxId','consigneeName','notifyPartyName','billToAddress','shipToAddress','logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','etd','eta','packageDimensions','bankAddress','amountWordsOverride'];
function markDetailedElements(){
 const conditional={originCountry:'showOrigin',quoteNo:'showQuote',customerPo:'showCustomerPo',moqControl:'showMoq',salesperson:'showSalesperson'};
 DETAILED_IDS.forEach(id=>{const el=$(id);const node=(id==='moqControl'?el:el?.closest('label'))||el?.closest('details');if(!node)return;node.classList.remove('fp-v3320-detailed-only');const toggle=conditional[id];if(!toggle||!$(toggle)?.checked)node.classList.add('fp-v3320-detailed-only')});
 qsa('.trade-party-details,#fpTradeFactoryCenter').forEach(node=>node.classList.add('fp-v3320-detailed-only'));
 const logExtra=$('logisticsExtraRowsJson')?.closest('details,.card,.grid');if(logExtra)logExtra.classList.add('fp-v3320-detailed-only');
}
function syncModeDifference(){const detailed=currentMode()==='b2b';document.body.classList.toggle('fp-v3320-default',!detailed);document.body.classList.toggle('fp-v3320-detailed',detailed);const strip=$('fpV3315ModeStrip');let summary=strip?.querySelector('.fp-v3320-mode-summary');if(strip&&!summary){summary=document.createElement('div');summary.className='fp-v3320-mode-summary';strip.appendChild(summary)}if(summary)summary.textContent=detailed?'精细版已展开收货、清关、物流、税号、跟单和内部执行字段。':'默认版只保留当前单据最常用字段；已填写的精细字段不会被删除。'}
function actualVisibilityRows(){return qsa('.visibility-grid .switch-line').map(label=>{const input=label.querySelector('input[id]');return input?{input,label,text:(label.querySelector('[data-visibility-caption]')?.textContent||label.textContent||input.id).trim()}:null}).filter(Boolean).filter(row=>!row.input.disabled&&!row.label.classList.contains('fp-visibility-hidden'))}
function openFocusedFieldSettings(){
 const root=$('fpV3315ToolsRoot');if(!root)return;const panel=$('fpV3318FieldSettings');if(!panel)return;const rows=actualVisibilityRows();root.classList.add('fp-v3320-fields-view');panel.hidden=false;const detailed=currentMode()==='b2b';
 panel.innerHTML=`<div class="fp-v3320-fields-toolbar"><div><h3>字段显示设置</h3><p>${DOC_LABELS[currentType()]||'当前单据'} · ${detailed?'精细版本':'默认版本'}。关闭字段不会删除已经填写的内容。</p></div><button type="button" class="fp-v3320-fields-back" data-v3320-fields-back>返回更多工具</button></div><div class="fp-v3320-field-list">${rows.map(row=>`<label><span>${row.text}</span><input type="checkbox" data-v3320-field-id="${row.input.id}" ${row.input.checked?'checked':''}></label>`).join('')||'<div class="fp-v3320-field-empty">当前单据没有可调整的字段。</div>'}</div>${detailed?'':'<button type="button" class="fp-v3320-fields-more" data-v3320-open-detailed>切换到精细版本查看更多字段</button>'}`;
 const title=$('fpV3315DrawerTitle');if(title)title.textContent='字段显示设置';
}
function closeFocusedFieldSettings(){const root=$('fpV3315ToolsRoot');root?.classList.remove('fp-v3320-fields-view');const panel=$('fpV3318FieldSettings');if(panel)panel.hidden=true;const title=$('fpV3315DrawerTitle');if(title)title.textContent='更多工具'}
function ensureSaveDialog(){
 let dialog=$('fpV3320SaveDialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='fpV3320SaveDialog';
 dialog.innerHTML=`<form method="dialog" class="fp-v3320-save-card"><header><div><h2>修改保存名称与备注</h2><p>系统会根据客户、单据类型、编号和金额自动生成。只有需要自定义时才修改；这些内容不会进入客户 PDF 或 Excel。</p></div></header><label>单据名称<input id="fpV3320SaveTitle" maxlength="120" required></label><label>内部备注（可选）<textarea id="fpV3320SaveNote" maxlength="500" placeholder="系统会自动整理客户、金额、付款和交付摘要；也可在此改成自己的跟进备注。"></textarea></label><div class="fp-v3320-save-actions"><button type="button" data-v3320-save-auto>恢复自动生成</button><span class="fp-v3320-save-spacer"></span><button type="button" data-v3320-save-cancel>取消</button><button type="submit" class="primary" value="save">保存并继续</button></div></form>`;
 document.body.appendChild(dialog);
 dialog.querySelector('[data-v3320-save-cancel]').addEventListener('click',()=>dialog.close());
 dialog.querySelector('[data-v3320-save-auto]').addEventListener('click',()=>{$('fpV3320SaveTitle').value=defaultTitle();$('fpV3320SaveNote').value=autoSummary()});
 dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const title=cleanText($('fpV3320SaveTitle').value);if(!title)return;$('workspaceDocumentTitle').value=title;$('workspaceDocumentNote').value=cleanText($('fpV3320SaveNote').value);dialog.close();triggerOriginalSave()});
 return dialog
}
function openSaveDialog(){const meta=prepareSmartMetadata();const dialog=ensureSaveDialog();$('fpV3320SaveTitle').value=meta.title;$('fpV3320SaveNote').value=meta.note;dialog.showModal();setTimeout(()=>$('fpV3320SaveTitle')?.select(),30)}
window.FlypigBOXSmartSave={prepare:prepareSmartMetadata,openSettings:openSaveDialog,defaultTitle,autoSummary};
function interceptActions(){
 document.addEventListener('click',event=>{
   if(event.target.closest('[data-v3315-close]'))closeFocusedFieldSettings();
   const fieldAction=event.target.closest('[data-v3315-action="fields"]');if(fieldAction){event.preventDefault();event.stopImmediatePropagation();openFocusedFieldSettings();return}
   if(event.target.closest('[data-v3320-fields-back]')){event.preventDefault();closeFocusedFieldSettings();return}
   const toggle=event.target.closest('[data-v3320-field-id]');if(toggle){const original=$(toggle.dataset.v3320FieldId);if(original){original.checked=toggle.checked;original.dispatchEvent(new Event('change',{bubbles:true}));window.FlypigBOXApp?.renderPreview?.();window.FlypigBOXTableEditor?.refresh?.();window.FlypigBOXTableOutput?.refresh?.({force:true})}return}
   if(event.target.closest('[data-v3320-open-detailed]')){event.preventDefault();document.querySelector('[data-doc-mode="b2b"]')?.click();setTimeout(openFocusedFieldSettings,80);return}
   const editMeta=event.target.closest('[data-fp-smart-save-settings],[data-fp3341-save-metadata]');if(editMeta){event.preventDefault();event.stopImmediatePropagation();openSaveDialog();return}
   const save=event.target.closest('#saveAllBtn,[data-v3315-action="draft"],[data-fp-save]');if(save){if(allowOriginalSave){allowOriginalSave=false;return}event.preventDefault();event.stopImmediatePropagation();prepareSmartMetadata();triggerOriginalSave($('saveAllBtn')||save)}
 },true)
}
function scheduleEnsure(){if(ensureTimer)return;ensureTimer=setTimeout(()=>{ensureTimer=0;moveBasicToTop();compactBasicCard();markDetailedElements();syncModeDifference();},120)}
function boot(){if(!$('piForm'))return;document.body.classList.add('fp-v3320-workflow-ux');ensureMetaFields();migrateBasicFirst();interceptActions();scheduleEnsure();[450,1000,1800,3200,5200].forEach(ms=>setTimeout(scheduleEnsure,ms));document.addEventListener('click',event=>{if(event.target.closest('[data-doc-mode],[data-v3315-doc-mode],[data-v3315-drawer-mode]'))setTimeout(scheduleEnsure,45)},true);document.addEventListener('change',event=>{if(['docMode','documentType'].includes(event.target.id))setTimeout(scheduleEnsure,45)},true);['HUIDI:document-type-changed','HUIDI:layout-updated','HUIDI:editor-view-change'].forEach(name=>document.addEventListener(name,scheduleEnsure));new MutationObserver(mutations=>{if(mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>node.nodeType===1)))scheduleEnsure()}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,760));else setTimeout(boot,760);
})();
