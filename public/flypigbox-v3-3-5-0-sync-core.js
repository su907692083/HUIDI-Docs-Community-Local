/* HUIDI V3.3.6.24-R1.3A.14 — true business sections, structured trade fields and schema-driven navigation.
   Explicit events only. No MutationObserver, ResizeObserver, polling interval, auth or session changes. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24 R1.3A.18.23.6';
  const $=id=>document.getElementById(id);
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const schema=window.FlypigBOXDocumentSchema;if(!schema)return;
  let syncTimer=0,highlightTimer=0,refreshTimer=0,switching=false;
  const SECTION_TOGGLE={packing:'showLogistics',plannedLogistics:'showLogistics',actualShipment:'showLogistics',payment:'showPayment',terms:'showTerms',signature:'showSignature'};
  const ITEM_CLASS={image:'.i-image-field',sku:'.i-sku-field',hs:'.i-hs-field',price:'.i-price-field',cartonNo:'.i-carton-no',packageDescription:'.i-package-desc',netWeight:'.i-net-weight',grossWeight:'.i-gross-weight',cbm:'.i-cbm',dimensions:'.i-dimensions',shippingMarks:'.i-item-marks'};
  const SYSTEM_DEFAULT_IDS=new Set(['currency','originCountry','paymentTerms','tradeTerms','deliveryTime','paymentTemplate','revisionNo','documentStatus','tradeScenario','sellerName','sellerContact','sellerAddress','extraFeeName','extraFeeAmount','taxAmount','discountType','discountValue']);
  const LEGACY_OUTPUT_PREFIX='fp-a10-';
  function type(){return schema.normalizeType(new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc'));}
  function rawMode(){return schema.normalizeMode($('docMode')?.value);}
  function mode(){return schema.effectiveMode?.(type(),rawMode())||rawMode();}
  function profile(){return schema.modeProfile(type(),mode());}
  function notify(message,kind='ok'){try{window.FlypigBOXApp?.setStatus?.(message,kind);}catch(_){} }
  function setVisible(node,visible){if(!node)return;node.hidden=!visible;node.classList.toggle('fp-v3350-hidden',!visible);if(visible)node.classList.remove('is-hidden');node.setAttribute('aria-hidden',visible?'false':'true');if(visible)node.style.removeProperty('display');}
  function sectionNode(key){
    const map={
      basic:$('editorTop'),references:$('fpA10ReferencesSection'),parties:document.querySelector('[data-fp-section="parties"]'),delivery:$('fpA10DeliverySection'),products:document.querySelector('[data-fp-section="products"]'),
      costs:$('fpA10CostsSection'),paymentSchedule:$('fpA10PaymentScheduleSection'),customs:$('fpA10CustomsSection'),packing:$('fpA10PackingSection'),plannedLogistics:$('fpA10PlannedLogisticsSection'),actualShipment:$('fpA10ActualShipmentSection'),
      qualityRisk:$('fpA10QualityRiskSection'),payment:document.querySelector('[data-fp-section="payment"],[data-optional-section="showPayment"]'),terms:document.querySelector('[data-fp-section="terms"],[data-optional-section="showTerms"]'),signature:document.querySelector('[data-fp-section="signature"],[data-optional-section="showSignature"]')
    };
    return map[key]||null;
  }
  function fieldContainer(id){const el=$(id);if(!el)return null;if(id==='logisticsExtraRowsJson')return el.closest('.logistics-extra');return el.closest('label,.contract-clause-builder,.optional-control,.trade-party-details')||el;}
  function toggleOn(id){const input=$(id);return !input||input.checked!==false;}
  function sectionToggleAllows(key){const toggle=SECTION_TOGGLE[key];return !toggle||toggleOn(toggle);}
  function renderedWithin(node,section){
    if(!node||!section||node.hidden||node.disabled||node.type==='hidden')return false;
    let current=node;while(current&&current!==section){if(current.hidden||current.classList?.contains('fp-v3350-hidden')||current.classList?.contains('is-hidden'))return false;const style=window.getComputedStyle?.(current);if(style&&(style.display==='none'||style.visibility==='hidden'))return false;current=current.parentElement;}return current===section;
  }
  function sectionControls(key){const section=sectionNode(key);if(!section)return[];return qsa('input,select,textarea',section).filter(control=>{if(!control.id||control.type==='hidden'||control.disabled||!schema.fieldAllowed(control.id,type(),mode()))return false;const holder=control.closest('label,.optional-control,.trade-party-details');if(holder&&(holder.hidden||holder.classList.contains('fp-v3350-hidden')||holder.classList.contains('is-hidden')))return false;return true;});}
  function itemLabelForControl(control){return control?.closest('label')||null;}
  function syncToggleControls(){schema.toggles.forEach(id=>{const input=$(id),label=input?.closest('.switch-line');if(!input||!label)return;const allowed=schema.toggleAllowed(id,type(),mode());setVisible(label,allowed);input.disabled=!allowed;});}
  function syncSpecificFields(){
    const ids=new Set([...schema.logisticsFields,...schema.deliveryFields,...schema.paymentFields,...schema.structuredFields,'revisionNo','documentStatus','tradeScenario','preparedBy','approvedBy','sellerTaxId','buyerTaxId','buyerCountryCode','buyerWebsite','contractClauses']);
    ids.forEach(id=>setVisible(fieldContainer(id),schema.fieldAllowed(id,type(),mode())));
    const builder=$('contractClauseBuilder');if(builder)setVisible(builder,schema.fieldAllowed('contractClauseBuilder',type(),mode()));
    const costs={extraFeeName:'showFreight',extraFeeAmount:'showFreight',taxAmount:'showTax',discountControl:'showDiscount',amountWordsControl:'showAmountWords'};
    Object.entries(costs).forEach(([id,toggle])=>{const node=$(id)?.closest('label')||$(id);if(node)setVisible(node,schema.toggleAllowed(toggle,type(),mode())&&toggleOn(toggle));});
  }
  function syncProductFields(){const allowed=new Set(profile().productColumns.filter(key=>schema.productColumnAllowed(key,type(),mode())));qsa('.item-row').forEach(row=>{setVisible(row.querySelector(ITEM_CLASS.image),allowed.has('image')&&toggleOn('showProductImage'));setVisible(row.querySelector(ITEM_CLASS.sku),allowed.has('sku'));setVisible(row.querySelector(ITEM_CLASS.hs),allowed.has('hs')&&toggleOn('showHsCode'));setVisible(row.querySelector(ITEM_CLASS.price),type()!=='packing_list'&&allowed.has('price'));['cartonNo','packageDescription','netWeight','grossWeight','cbm','dimensions','shippingMarks'].forEach(key=>setVisible(itemLabelForControl(row.querySelector(ITEM_CLASS[key])),allowed.has(key)));});}
  function sectionHasUsableFields(key){if(key==='basic')return true;if(key==='products')return Boolean($('itemList'));const section=sectionNode(key);if(!section)return false;const controls=sectionControls(key);if(controls.length)return true;if(key==='signature')return qsa('button',section).some(button=>!button.matches('.section-collapse-toggle,[data-collapse-toggle]'));return false;}
  function syncSectionTitles(){qsa('[data-fp-section-title]').forEach(node=>{const key=node.dataset.fpSectionTitle;node.textContent=schema.sectionTitle(key,type());});const legacy={parties:schema.sectionTitle('parties',type()),products:schema.sectionTitle('products',type()),payment:'收款账户',terms:schema.sectionTitle('terms',type())==='terms'?(type()==='sales_contract'?'合同条款':'交易条款'):schema.sectionTitle('terms',type()),signature:type()==='sales_contract'?'双方签署与盖章':'签名与盖章'};Object.entries(legacy).forEach(([key,title])=>{const section=sectionNode(key),h=section?.querySelector('h2');if(h)h.textContent=title;});}
  function syncSections(){
    const keys=['references','parties','delivery','products','costs','paymentSchedule','customs','packing','plannedLogistics','actualShipment','qualityRisk','payment','terms','signature'];
    keys.forEach(key=>{const section=sectionNode(key);if(!section)return;const allowed=schema.sectionAllowed(key,type(),mode())&&sectionToggleAllows(key);const usable=allowed&&sectionHasUsableFields(key);setVisible(section,usable);section.dataset.fpSchemaSection=key;section.dataset.fpSchemaMode=mode();section.dataset.fpUsableFields=usable?'1':'0';});
    const center=$('fpTradeFactoryCenter');if(center)setVisible(center,mode()==='b2b');
    const legacy=document.querySelector('[data-fp-legacy-logistics]');if(legacy)setVisible(legacy,false);
  }
  function meaningful(control){if(!control||control.disabled||control.hidden||control.type==='hidden')return false;if(control.type==='checkbox'||control.type==='radio')return control.checked;const value=clean(control.value);if(!value)return false;if(SYSTEM_DEFAULT_IDS.has(control.id)&&control.dataset.fpUserConfirmed!=='1')return false;return true;}
  function sectionStatus(key){
    const required=schema.requiredFields(key,type(),mode());
    if(key==='products'){
      const rows=qsa('.item-row');const has=rows.some(row=>clean(row.querySelector('.i-name')?.value));return has?{state:'complete',text:'已填写',title:'已有商品内容'}:{state:'error',text:'待补充',title:'至少需要填写一项商品名称'};
    }
    if(key==='paymentSchedule'){
      const dv=$('depositPercent')?.value,bv=$('balancePercent')?.value;if(dv!==''&&bv!==''){
        const total=Number(dv)+Number(bv);if(Number.isFinite(total)&&Math.abs(total-100)>=.01)return{state:'error',text:'比例不符',title:`定金与尾款比例合计为 ${Number(total.toFixed(2))}%，应核对为 100%`};
      }
    }
    const missing=required.filter(id=>!clean($(id)?.value));if(missing.length)return{state:'error',text:`缺${missing.length}项`,title:`缺少关键字段：${missing.map(id=>schema.fieldDefinitions[id]?.label?.[0]||id).join('、')}`};
    const controls=sectionControls(key);const user=controls.some(control=>control.dataset.fpUserConfirmed==='1'&&clean(control.value));const entered=controls.some(meaningful);const prefilled=controls.some(control=>clean(control.value));
    if(user||entered)return{state:'complete',text:'已填写',title:'已有人工填写或确认内容'};
    if(prefilled)return{state:'prefilled',text:'待确认',title:'系统已预填，等待人工核对'};
    return{state:'empty',text:'未开始',title:'尚未填写'};
  }
  function updateSectionStatuses(){qsa('[data-fp-section-status]').forEach(badge=>{const section=badge.closest('[data-fp-section]'),key=section?.dataset.fpSection;if(!key)return;const status=sectionStatus(key);badge.dataset.state=status.state;badge.textContent=status.text;badge.title=status.title;});}
  function navAvailable(key){const section=sectionNode(key);return Boolean(schema.sectionAllowed(key,type(),mode())&&sectionToggleAllows(key)&&section&&!section.hidden&&section.dataset.fpUsableFields!=='0');}
  function navLabel(key){const title=schema.sectionTitle(key,type());const map={basic:'基础信息',references:schema.sectionTitle('references',type()),parties:title!=='parties'?title:'买卖双方',delivery:schema.sectionTitle('delivery',type()),products:title!=='products'?title:'商品明细',costs:type()==='quotation'?'费用与报价总额':type()==='commercial_invoice'?'申报费用':'费用与金额',paymentSchedule:schema.sectionTitle('paymentSchedule',type()),customs:schema.sectionTitle('customs',type()),packing:schema.sectionTitle('packing',type()),plannedLogistics:schema.sectionTitle('plannedLogistics',type()),actualShipment:schema.sectionTitle('actualShipment',type()),qualityRisk:schema.sectionTitle('qualityRisk',type()),payment:'收款账户',terms:title!=='terms'?title:(type()==='sales_contract'?'合同条款':'交易条款'),signature:type()==='sales_contract'?'签署与盖章':'签名与盖章'};return map[key]||key;}
  function expandTarget(target){if(!target)return;let details=target.closest?.('details');while(details){details.open=true;details=details.parentElement?.closest?.('details')||null;}if(window.FlypigBOXSectionDisclosure?.open){window.FlypigBOXSectionDisclosure.open(target,{persist:true});return;}target.classList?.remove('is-collapsed','is-hidden');const body=target.querySelector?.(':scope>.section-collapse-body');if(body)body.hidden=false;}
  function navigate(key,button){const target=sectionNode(key);if(!target||!navAvailable(key)){notify('当前单据或当前模式没有这一分栏。','error');return;}expandTarget(target);clearTimeout(highlightTimer);qsa('.fp-v3350-nav-target').forEach(node=>node.classList.remove('fp-v3350-nav-target'));const scroller=document.querySelector('.form-column');requestAnimationFrame(()=>{if(scroller&&scroller.contains(target)){const sr=scroller.getBoundingClientRect(),tr=target.getBoundingClientRect();scroller.scrollTo({top:Math.max(0,scroller.scrollTop+tr.top-sr.top-10),behavior:'auto'});}else target.scrollIntoView?.({block:'start',behavior:'auto'});target.classList.add('fp-v3350-nav-target');const focus=target.querySelector?.('input:not([type="hidden"]),select,textarea,button');try{focus?.focus?.({preventScroll:true});}catch(_){}highlightTimer=setTimeout(()=>target.classList.remove('fp-v3350-nav-target'),1800);});qsa('#fpV3321SideNav [data-v3321-section]').forEach(node=>node.classList.toggle('active',node===button));}
  function ensureNav(){
    let nav=$('fpV3321SideNav');if(!nav){nav=document.createElement('aside');nav.id='fpV3321SideNav';document.body.appendChild(nav);}nav.setAttribute('aria-label',`${schema.profile(type()).label}填写目录`);nav.dataset.fpDocumentType=type();nav.dataset.fpDocumentMode=mode();
    const current=nav.querySelector('[data-v3321-section].active')?.dataset.v3321Section||'basic';const keys=schema.navigation(type(),mode());nav.innerHTML=keys.map(key=>`<button type="button" data-v3321-section="${key}"><span>${navLabel(key)}</span><i data-fp-nav-indicator></i></button>`).join('');
    if(!nav.dataset.fpV3350Bound){nav.dataset.fpV3350Bound='1';nav.addEventListener('click',event=>{const button=event.target.closest('[data-v3321-section]');if(!button)return;event.preventDefault();event.stopPropagation();navigate(button.dataset.v3321Section,button);});}
    let active=null;qsa('[data-v3321-section]',nav).forEach(button=>{const key=button.dataset.v3321Section,available=navAvailable(key),status=sectionStatus(key);button.hidden=!available;button.dataset.fpNavState=available?status.state:'hidden';button.title=`${button.textContent.trim()}：${status.title}`;const indicator=button.querySelector('[data-fp-nav-indicator]');if(indicator)indicator.textContent=status.state==='error'?'!':status.state==='complete'?'✓':status.state==='prefilled'?'•':'';if(available&&key===current)active=button;});
    active=active||nav.querySelector('[data-v3321-section]:not([hidden])');qsa('[data-v3321-section]',nav).forEach(button=>{const on=button===active;button.classList.toggle('active',on);button.setAttribute('aria-current',on?'step':'false');});
  }
  function parseCustomRows(){try{const rows=JSON.parse($('customDocumentFieldsJson')?.value||'[]');return Array.isArray(rows)?rows:[];}catch(_){return[];}}
  function syncStructuredOutput(){
    let field=$('customDocumentFieldsJson');if(!field){field=document.createElement('input');field.type='hidden';field.id='customDocumentFieldsJson';field.value='[]';$('piForm')?.appendChild(field);}
    const fields=Object.fromEntries(qsa('#piForm input,#piForm select,#piForm textarea').filter(node=>node.id).map(node=>[node.id,node.type==='checkbox'?node.checked:node.value]));const language=clean($('docLanguage')?.value)||'bilingual';const generated=schema.structuredOutputRows(type(),mode(),fields,language).map(row=>({id:`${LEGACY_OUTPUT_PREFIX}${row.id}`,group:row.group,label:row.label,value:row.value,locked:true,source:'structured-trade-field'}));const keep=parseCustomRows().filter(row=>!String(row?.id||'').startsWith(LEGACY_OUTPUT_PREFIX));const next=JSON.stringify([...keep,...generated]);if(field.value!==next)field.value=next;
  }
  const A13_FORMAL_STORAGE='flypigbox_a13_formal_';
  const A13_SECTION_STORAGE='flypigbox_a13_section_';
  function readLocal(key,fallback=''){try{const value=localStorage.getItem(key);return value===null?fallback:value;}catch(_){return fallback;}}
  function writeLocal(key,value){try{localStorage.setItem(key,String(value));return true;}catch(_){return false;}}
  function isEditorControl(node){return Boolean(node?.matches?.('input:not([type=hidden]),textarea,select,[contenteditable="true"]'));}
  function focusedDisclosureCard(){const active=document.activeElement;return isEditorControl(active)?active.closest?.('.form-column>section.card.fp-a13-disclosure'):null;}
  function captureEditorFocus(){const control=document.activeElement;if(!isEditorControl(control)||!control.closest?.('#piForm'))return null;const state={control};if(typeof control.selectionStart==='number'){state.start=control.selectionStart;state.end=control.selectionEnd;}return state;}
  function restoreEditorFocus(state){const control=state?.control;if(!control?.isConnected||control.disabled||control.hidden)return;const current=document.activeElement;if(current&&current!==document.body&&current!==control&&isEditorControl(current))return;const card=control.closest?.('.form-column>section.card.fp-a13-disclosure');if(card&&card.dataset.fpA13Open!=='1')applyDisclosure(card,true,{persist:true});requestAnimationFrame(()=>{if(!control.isConnected)return;try{control.focus({preventScroll:true});if(typeof state.start==='number'&&typeof control.setSelectionRange==='function')control.setSelectionRange(state.start,state.end);}catch(_){}});}
  function keepEditingSectionOpen(target){const card=target?.closest?.('.form-column>section.card.fp-a13-disclosure');if(!card)return;ensureDisclosure(card);if(card.dataset.fpA13Open!=='1')applyDisclosure(card,true,{persist:true});card.dataset.fpA13Editing='1';}
  function isFormalType(){return Boolean(schema.isFormalSingleMode?.(type()));}
  function formalSectionKey(){return type()==='commercial_invoice'?'customs':type()==='packing_list'?'products':'';}
  function syncFormalModeState(){
    const p=schema.profile(type()),formal=Boolean(p.formalSingleMode),input=$('docMode');
    document.body.classList.toggle('fp-a13-formal-single-mode',formal);
    if(formal&&input&&input.value!==(p.formalMode||'b2b'))input.value=p.formalMode||'b2b';
    const ci=$('ciComplianceLevel'),pl=$('packingDetailMode');
    if(ci&&!ci.dataset.fpA13Loaded){ci.value=readLocal(`${A13_FORMAL_STORAGE}commercial_invoice_compliance`,'standard');ci.dataset.fpA13Loaded='1';}
    if(pl&&!pl.dataset.fpA13Loaded){pl.value=readLocal(`${A13_FORMAL_STORAGE}packing_list_detail`,'summary');pl.dataset.fpA13Loaded='1';}
    document.body.dataset.fpA13CiCompliance=ci?.value||'standard';
    document.body.dataset.fpA13PackingDetail=pl?.value||'summary';
  }
  function setFormalValue(id,value){const input=$(id);if(!input)return;input.value=value;input.dataset.fpUserConfirmed='1';if(id==='ciComplianceLevel')writeLocal(`${A13_FORMAL_STORAGE}commercial_invoice_compliance`,value);if(id==='packingDetailMode')writeLocal(`${A13_FORMAL_STORAGE}packing_list_detail`,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));scheduleSync(true,20);}
  function ensureFormalControls(){
    qsa('.fp-a13-inline-config').forEach(node=>{if(node.dataset.fpDocumentType!==type())node.remove();});
    if(!isFormalType())return;
    const t=type(),key=formalSectionKey(),section=sectionNode(key);if(!section)return;
    let bar=section.querySelector(`.fp-a13-inline-config[data-fp-document-type="${t}"]`);
    if(!bar){bar=document.createElement('div');bar.className='fp-a13-inline-config';bar.dataset.fpDocumentType=t;const host=section.querySelector(':scope>.section-collapse-body')||section;host.prepend(bar);}
    if(t==='commercial_invoice'){
      const value=$('ciComplianceLevel')?.value||'standard';bar.innerHTML=`<div><b>正规商业发票 · 申报配置</b><small>核心清关字段始终保留；只有目的国、商品或监管要求需要时再展开登记、VAT、EORI、许可证和最终用途。</small></div><label>申报范围<select data-fp-a13-ci-level><option value="standard" ${value==='standard'?'selected':''}>通用正规申报</option><option value="regulatory" ${value==='regulatory'?'selected':''}>监管扩展申报</option></select></label>`;
      bar.querySelector('[data-fp-a13-ci-level]')?.addEventListener('change',event=>setFormalValue('ciComplianceLevel',event.target.value));
    }else{
      const value=$('packingDetailMode')?.value||'summary';bar.innerHTML=`<div><b>正规装箱单 · 明细方式</b><small>单据结构保持统一，只改变装箱明细的记录深度，不会删除已填写资料。</small></div><label>填写方式<select data-fp-a13-packing-mode><option value="summary" ${value==='summary'?'selected':''}>按商品汇总</option><option value="carton" ${value==='carton'?'selected':''}>按箱记录</option><option value="pallet" ${value==='pallet'?'selected':''}>按托盘记录</option></select></label>`;
      bar.querySelector('[data-fp-a13-packing-mode]')?.addEventListener('change',event=>setFormalValue('packingDetailMode',event.target.value));
    }
  }
  function openFormalConfig(){const key=formalSectionKey(),target=sectionNode(key);if(!target)return;expandTarget(target);ensureFormalControls();const control=target.querySelector('[data-fp-a13-ci-level],[data-fp-a13-packing-mode]');const scroller=document.querySelector('.form-column');if(scroller&&scroller.contains(target)){const sr=scroller.getBoundingClientRect(),tr=target.getBoundingClientRect();scroller.scrollTo({top:Math.max(0,scroller.scrollTop+tr.top-sr.top-10),behavior:'smooth'});}else target.scrollIntoView?.({behavior:'smooth',block:'start'});setTimeout(()=>control?.focus?.({preventScroll:true}),260);}
  function sectionKeyFor(card){return card?.dataset?.fpSection||card?.dataset?.fpSchemaSection||({fpA10ReferencesSection:'references',fpA10DeliverySection:'delivery',fpA10CostsSection:'costs',fpA10PaymentScheduleSection:'paymentSchedule',fpA10CustomsSection:'customs',fpA10PackingSection:'packing',fpA10PlannedLogisticsSection:'plannedLogistics',fpA10ActualShipmentSection:'actualShipment',fpA10QualityRiskSection:'qualityRisk'}[card?.id]||'');}
  function disclosureStorageKey(key){return `${A13_SECTION_STORAGE}${type()}_${key}`;}
  function applyDisclosure(card,open,{persist=false}={}){if(!card)return;const body=card.querySelector(':scope>.section-collapse-body'),button=card.querySelector(':scope>.section-collapse-head .section-collapse-toggle');if(body)body.hidden=!open;card.classList.toggle('is-collapsed',!open);card.dataset.fpA13Open=open?'1':'0';card.dataset.v751Open=open?'1':'0';if(button){button.textContent=open?'收起 ▲':'展开 ▼';button.setAttribute('aria-expanded',String(open));}if(persist){const key=sectionKeyFor(card);if(key)writeLocal(disclosureStorageKey(key),open?'1':'0');}}
  function ensureDisclosure(card){
    if(!card||card.classList.contains('api-card'))return;const key=sectionKeyFor(card);if(!key)return;
    let head=Array.from(card.children).find(node=>node.classList?.contains('section-collapse-head')),body=Array.from(card.children).find(node=>node.classList?.contains('section-collapse-body'));
    if(!head||!body){const title=Array.from(card.children).find(node=>node.classList?.contains('section-title'))||Array.from(card.children).find(node=>node.tagName==='H2');if(!title)return;head=document.createElement('div');head.className='section-collapse-head';card.insertBefore(head,title);head.appendChild(title);body=document.createElement('div');body.className='section-collapse-body';Array.from(card.children).filter(node=>node!==head).forEach(node=>body.appendChild(node));card.appendChild(body);}
    card.classList.add('collapsible-card','fp-a13-disclosure');let button=head.querySelector('.section-collapse-toggle');if(!button){button=document.createElement('button');button.type='button';button.className='section-collapse-toggle';head.appendChild(button);}button.setAttribute('aria-label',`${navLabel(key)}展开或收起`);
    if(!card.dataset.fpA13Bound){card.dataset.fpA13Bound='1';button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();applyDisclosure(card,card.dataset.fpA13Open!=='1',{persist:true});},true);head.addEventListener('click',event=>{if(event.target.closest('button,input,select,textarea,a,label'))return;button.click();});}
    const activeInside=card.contains(document.activeElement)&&isEditorControl(document.activeElement);
    if(card.dataset.fpA13Initialized!=='1'){const current=card.dataset.fpA13Open||card.dataset.v751Open||'';const stored=readLocal(disclosureStorageKey(key),'');const open=activeInside?true:(current==='1'?true:current==='0'?false:stored==='0'?false:true);applyDisclosure(card,open,{persist:false});card.dataset.fpA13Initialized='1';}
    else if(activeInside&&card.dataset.fpA13Open!=='1')applyDisclosure(card,true,{persist:true});
    else applyDisclosure(card,card.dataset.fpA13Open!=='0',{persist:false});
  }
  function ensureDisclosureToolbar(){const form=document.querySelector('.form-column');if(!form)return;let toolbar=$('fpA13SectionToolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.id='fpA13SectionToolbar';toolbar.className='fp-a13-section-toolbar';toolbar.innerHTML='<span>填写分栏</span><button type="button" data-fp-a13-expand-all>展开全部</button><button type="button" data-fp-a13-collapse-other>只看当前</button>';form.prepend(toolbar);toolbar.addEventListener('click',event=>{if(event.target.closest('[data-fp-a13-expand-all]'))window.FlypigBOXSectionDisclosure?.openAll();if(event.target.closest('[data-fp-a13-collapse-other]'))window.FlypigBOXSectionDisclosure?.collapseOthers();});}}
  function ensureSectionDisclosures(){const form=document.querySelector('.form-column');if(!form)return;qsa(':scope>section.card',form).forEach(ensureDisclosure);ensureDisclosureToolbar();const visible=qsa(':scope>section.card.fp-a13-disclosure',form).filter(card=>!card.hidden&&getComputedStyle(card).display!=='none');if(visible.length&&!visible.some(card=>card.dataset.fpA13Open==='1'))applyDisclosure(visible[0],true,{persist:false});}
  window.FlypigBOXSectionDisclosure={open:(target,options={})=>{const card=target?.closest?.('section.card')||target;ensureDisclosure(card);applyDisclosure(card,true,options);},toggle:target=>{const card=target?.closest?.('section.card')||target;ensureDisclosure(card);applyDisclosure(card,card.dataset.fpA13Open!=='1',{persist:true});},openAll:()=>qsa('.form-column>section.card.fp-a13-disclosure').filter(card=>!card.hidden).forEach(card=>applyDisclosure(card,true,{persist:true})),collapseOthers:()=>{const focused=focusedDisclosureCard();const active=document.querySelector('#fpV3321SideNav [data-v3321-section].active')?.dataset.v3321Section;const current=focused||sectionNode(active)||qsa('.form-column>section.card.fp-a13-disclosure').find(card=>card.dataset.fpA13Open==='1'&&!card.hidden);qsa('.form-column>section.card.fp-a13-disclosure').filter(card=>!card.hidden).forEach(card=>applyDisclosure(card,card===current,{persist:true}));}};
  function syncModeHeader(modes=$('fpV3321ModeHeader')){
    if(!modes)return;const p=schema.profile(type());
    if(p.formalSingleMode){modes.dataset.fpA13Formal=type();modes.innerHTML=`<span class="fp-a13-formal-mode-label">${p.formalLabel||p.label}</span><button type="button" data-fp-a13-formal-config>${p.formalAction||'配置'}</button>`;modes.setAttribute('aria-label',`${p.label}正规模式与场景配置`);return;}
    if(modes.dataset.fpA13Formal){delete modes.dataset.fpA13Formal;modes.innerHTML='<button type="button" data-v3350-mode="ecommerce"></button><button type="button" data-v3350-mode="b2b"></button>';}
    qsa('[data-v3350-mode]',modes).forEach(button=>{const value=button.dataset.v3350Mode,info=schema.modeInfo(type(),value),active=value===mode();button.textContent=info.label;button.title=info.description||info.label;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});modes.setAttribute('aria-label',`${p.label}专业模式`);
  }
  function openTemplateCenter(){const trigger=document.querySelector('#flypigboxTemplateMount .fp-v8-trigger,[data-fp-template]');trigger?.click?.();if(!trigger)notify('模板中心仍在加载，请稍后重试。','error');}
  function openToolsAction(action){document.querySelector('#fpLiteMoreMenu>summary')?.click();setTimeout(()=>document.querySelector(`[data-v3315-action="${action}"]`)?.click(),40);}
  function openInternalTools(trigger){if(window.FlypigBOXInternalTools?.open)window.FlypigBOXInternalTools.open('factory',trigger);else document.querySelector('[data-table-action="open-internal-tools"],[data-v331-open-internal]')?.click?.();}
  function ensureHeader(){const actions=document.querySelector('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return;const before=$('fpLiteExportMenu')||$('fpSpreadsheetExportMenu');const add=(id,text,handler,cls='fp-v3321-head-action')=>{let b=$(id);if(!b){b=document.createElement('button');b.type='button';b.id=id;b.className=cls;b.textContent=text;b.addEventListener('click',handler);actions.insertBefore(b,before||null);}return b;};add('fpV3350InternalHeader','内部工具',event=>openInternalTools(event.currentTarget));add('fpV3321SaveHeader','保存单据',()=>window.HUIDIActionOwner?.save?.()||$('saveAllBtn')?.click());add('fpV3321TemplateHeader','PDF模板/样式',openTemplateCenter);let modes=$('fpV3321ModeHeader');if(!modes){modes=document.createElement('div');modes.id='fpV3321ModeHeader';modes.className='fp-v3321-head-modes';modes.innerHTML='<button type="button" data-v3350-mode="ecommerce"></button><button type="button" data-v3350-mode="b2b"></button>';modes.addEventListener('click',event=>{if(event.target.closest('[data-fp-a13-formal-config]')){openFormalConfig();return;}const next=event.target.closest('[data-v3350-mode]')?.dataset.v3350Mode;if(!next)return;const input=$('docMode');if(input){input.value=next;input.dispatchEvent(new Event('change',{bubbles:true}));}});actions.insertBefore(modes,before||null);}add('fpV3321FieldsHeader','字段设置',()=>openToolsAction('fields'));syncModeHeader(modes);}
  function desiredPreview(){return document.body.classList.contains('fp-preview-table-only')?'table':'document';}
  function setPreviewVisibility(next){const table=next==='table',paper=$('piPaper'),workbook=$('fpTableOutputPreview');if(paper){paper.hidden=table;paper.setAttribute('aria-hidden',String(table));}if(workbook){workbook.hidden=!table;workbook.setAttribute('aria-hidden',String(!table));}}
  function forceCanonicalLeft(){document.body.classList.remove('fp-live-table-mode','fp-table-editor-mode');document.body.classList.add('fp-live-document-mode','fp-form-editor-mode','fp-unified-left-editor','fp-preview-only-switch');const duplicate=$('fpTableEditorWorkspace');if(duplicate){duplicate.hidden=true;duplicate.style.display='none';duplicate.setAttribute('aria-hidden','true');}const input=$('editorViewMode');if(input)input.value='form';}
  function switchPreview(next,{refresh=true}={}){if(switching)return;switching=true;const safe=next==='table'?'table':'document';const left=document.querySelector('.form-column'),top=left?.scrollTop||0,leftX=left?.scrollLeft||0,active=document.activeElement;document.body.classList.toggle('fp-preview-table-only',safe==='table');forceCanonicalLeft();setPreviewVisibility(safe);const output=window.FlypigBOXTableOutput;if(output?.setPreviewMode)output.setPreviewMode(safe,{announce:false,persist:true});else if(refresh){safe==='table'?output?.refresh?.({force:false}):window.FlypigBOXApp?.renderPreview?.();}requestAnimationFrame(()=>{forceCanonicalLeft();setPreviewVisibility(safe);if(left){left.scrollTop=top;left.scrollLeft=leftX;}try{active?.focus?.({preventScroll:true});}catch(_){}switching=false;document.dispatchEvent(new CustomEvent('HUIDI:preview-only-mode-change',{detail:{mode:safe}}));});}
  function bindPreviewSwitch(){if(document.documentElement.dataset.fpV3350PreviewBound)return;document.documentElement.dataset.fpV3350PreviewBound='1';document.addEventListener('click',event=>{const button=event.target.closest('[data-primary-mode],[data-preview-mode]');if(!button)return;const value=button.dataset.primaryMode||button.dataset.previewMode;setTimeout(()=>switchPreview(value==='table'?'table':'document'),0);},true);}
  function prepareWorkbook(){const root=$('fpTableOutputPreview'),canvas=root?.querySelector('.fp-workbook-canvas');if(!root||!canvas)return;canvas.tabIndex=0;canvas.setAttribute('role','region');canvas.setAttribute('aria-label','客户 Excel 预览，可使用滚轮、触控板和滚动条查看');root.querySelectorAll('.fp-workbook-formula-bar,.fp-workbook-status,.fp-workbook-current-field,.fp-v3343-scroll-hint,.fp-v3329-view-switch,.fp-v3329-view-note').forEach(node=>node.remove());}
  function scheduleWorkbookRefresh(delay=240){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(desiredPreview()==='table'){window.FlypigBOXTableOutput?.refresh?.({force:false});setTimeout(prepareWorkbook,40);}},delay);}
  function stampVersion(){const badge=$('fpLiteVersion');if(badge){badge.textContent=VERSION;badge.title='正规商业发票与装箱单统一、分栏展开可见性候选版';}document.body.dataset.fpRelease='v3.3.6.24-r1.3a.13-formal-ci-pl-section-visibility';}
  function applyRules({refresh=false}={}){
    if(!$('piForm'))return;const focusState=captureEditorFocus();schema.installStructuredSections?.();syncFormalModeState();window.FlypigBOXModeRules={matrix:schema.profiles,fieldAllowed:schema.fieldAllowed,sectionAllowed:schema.sectionAllowed,productColumnAllowed:schema.productColumnAllowed};
    syncSectionTitles();syncToggleControls();syncSpecificFields();syncProductFields();syncSections();ensureFormalControls();ensureSectionDisclosures();syncStructuredOutput();updateSectionStatuses();ensureNav();ensureHeader();forceCanonicalLeft();setPreviewVisibility(desiredPreview());prepareWorkbook();
    document.body.classList.toggle('fp-v3350-default-mode',!isFormalType()&&mode()==='ecommerce');document.body.classList.toggle('fp-v3350-detailed-mode',!isFormalType()&&mode()==='b2b');stampVersion();document.dispatchEvent(new CustomEvent('HUIDI:operator-labels-refresh',{detail:{source:'document-rules-a10'}}));
    if(refresh){try{window.FlypigBOXApp?.renderPreview?.();}catch(_){}scheduleWorkbookRefresh(90);}scheduleOutputIsolation(refresh?0:40);restoreEditorFocus(focusState);
  }
  function scheduleSync(refresh=false,delay=70){clearTimeout(syncTimer);syncTimer=setTimeout(()=>applyRules({refresh}),delay);}
  function exportNaming(){const safe=(value,fallback)=>{let text=clean(value)||fallback;try{text=text.normalize('NFKC');}catch(_){}return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/[. ]+$/g,'').replace(/\s*[-–—]+\s*/g,'-').replace(/-+/g,'-').slice(0,72)||fallback;};const today=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;};const base=()=>`FLP-${safe($('buyerName')?.value,'未填写买方公司')}-${safe($('buyerCountry')?.value,'未填写客户国家')}-${today()}`;window.FlypigBOXExportNaming={base,file:(ext,kind='customer')=>`${base()}${({data:'-数据版',internal:'-内部核算-保密',factory:'-工厂执行单-保密',products:'-商品明细'}[kind]||'')}.${String(ext||'').replace(/^\./,'')}`,today};}

  const A11_GROUP_TITLES={
    references:['关联与参考','REFERENCES'],paymentSchedule:['付款计划','PAYMENT SCHEDULE'],customs:['海关与合规','CUSTOMS & COMPLIANCE'],packing:['包装资料','PACKING DETAILS'],plannedLogistics:['交付与物流计划','DELIVERY & SHIPPING PLAN'],actualShipment:['实际出货','ACTUAL SHIPMENT'],qualityRisk:['质量、验收与风险','QUALITY, INSPECTION & RISK'],custom:['自定义字段','CUSTOM FIELDS'],quoteTerms:['报价条件','QUOTATION TERMS']
  };
  const A11_DUPLICATE_FIELDS=new Set(['quotationValidUntil','proformaValidUntil','packingDate']);
  function outLang(){
    const value=clean($('docLanguage')?.value)||'bilingual';
    const supported=(window.HUIDIDocI18n?.languages||[]).map(row=>row?.[0]).filter(Boolean);
    return supported.includes(value)?value:(['zh','en','bilingual'].includes(value)?value:'bilingual');
  }
  function outText(pair){
    const lang=outLang(),zh=pair?.[0]||'',en=pair?.[1]||'';
    const i18n=window.HUIDIDocI18n;
    if(i18n?.text)return i18n.text(zh,en,lang);
    return lang==='zh'?zh:lang==='en'?en:`${en} / ${zh}`;
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function compact(value){return clean(value).toLowerCase();}
  function sameValue(a,b){return compact(a)&&compact(a)===compact(b);}
  function currentFields(){return Object.fromEntries(qsa('#piForm input,#piForm select,#piForm textarea').filter(node=>node.id).map(node=>[node.id,node.type==='checkbox'?node.checked:node.value]));}
  function sectionRows(section){return qsa('tr',section).map(tr=>({tr,label:clean(tr.querySelector('th')?.textContent),value:clean(tr.querySelector('td')?.textContent)})).filter(row=>row.label&&row.value);}
  function structuredLabelMap(){
    const fields=currentFields(),lang=outLang(),rows=schema.structuredOutputRows(type(),mode(),fields,lang),map=new Map();
    rows.forEach(row=>map.set(compact(row.label),row));return map;
  }
  function legacyGroup(label){
    const text=compact(label);
    if(/moq|最低起订量/.test(text))return 'quoteTerms';
    if(/客户.*po|customer po|客户参考|customer reference|报价版本|询盘/.test(text))return 'references';
    if(/原产国|country of origin/.test(text))return 'customs';
    return 'custom';
  }
  function regroupSupplement(section){
    if(!section)return;
    const map=structuredLabelMap(),groups=new Map();
    sectionRows(section).forEach(({tr,label})=>{
      const structured=map.get(compact(label));
      if(structured&&A11_DUPLICATE_FIELDS.has(structured.id)){tr.remove();return;}
      let group=structured?.group||legacyGroup(label);
      const builtinQuote=/报价编号|quotation no\.?/i.test(label);
      if(!structured&&builtinQuote){
        const value=clean(tr.querySelector('td')?.textContent),th=tr.querySelector('th');
        if(!value){tr.remove();return;}
        if(type()==='quotation'){if(th)th.textContent=outText(['客户参考号','CUSTOMER REFERENCE']);group='references';}
        else if(['proforma_invoice','sales_contract'].includes(type())){if(th)th.textContent=outText(['关联报价单号','RELATED QUOTATION NO.']);group='references';}
        else{tr.remove();return;}
      }else if(!structured&&/业务员|salesperson/i.test(label)){
        if(!['quotation','proforma_invoice','sales_contract'].includes(type())){tr.remove();return;}group='references';
      }else if(!structured&&/原产国|country of origin/i.test(label)){
        if(!schema.fieldAllowed?.('originCountry',type(),mode())){tr.remove();return;}group='customs';
      }else if(!structured&&/moq|最低起订量/i.test(label)){
        if(type()!=='quotation'){tr.remove();return;}group='quoteTerms';
      }
      if(!groups.has(group))groups.set(group,[]);groups.get(group).push(tr);
    });
    if(!groups.size){section.remove();return;}
    const holder=document.createElement('div');holder.className='fp-a11-native-output';
    groups.forEach((rows,group)=>{
      const wrap=document.createElement('div');wrap.className=`fp-a11-native-group fp-a11-group-${group}`;
      const title=document.createElement('h4');title.textContent=outText(A11_GROUP_TITLES[group]||A11_GROUP_TITLES.custom);wrap.appendChild(title);
      const table=document.createElement('table');table.className='info fp-a11-native-table';const body=document.createElement('tbody');rows.forEach(row=>body.appendChild(row));table.appendChild(body);wrap.appendChild(table);holder.appendChild(wrap);
    });
    section.innerHTML='';section.classList.add('fp-a11-native-sections');section.appendChild(holder);
  }
  function tradePartyPolicy(){
    const t=type(),m=mode();
    if(t==='commercial_invoice')return{consignee:false,notify:true,bill:m==='b2b',ship:m==='b2b'};
    if(t==='packing_list')return{consignee:false,notify:true,bill:false,ship:false};
    if(t==='proforma_invoice'&&m==='b2b')return{consignee:true,notify:true,bill:true,ship:true};
    if(t==='sales_contract'&&m==='b2b')return{consignee:true,notify:true,bill:true,ship:true};
    return{consignee:false,notify:false,bill:false,ship:false};
  }
  function partyLines(prefix){
    const ids=[`${prefix}Name`,`${prefix}Contact`,`${prefix}Phone`,`${prefix}Email`,`${prefix}Address`],vals=ids.map(id=>clean($(id)?.value));if(!vals.some(Boolean))return'';
    const labels=[null,outText(['联系人','CONTACT']),outText(['电话','PHONE']),outText(['邮箱','EMAIL']),outText(['地址','ADDRESS'])];
    return vals.map((value,index)=>value?(index===0?`<strong>${esc(value)}</strong>`:`<span class="muted">${labels[index]}:</span> ${esc(value)}`):'').filter(Boolean).join('<br>');
  }
  function rebuildTradeParties(template){
    template.querySelectorAll('.pdf-additional-trade-parties').forEach(node=>node.remove());
    const policy=tradePartyPolicy(),cards=[];
    const buyerName=clean($('buyerName')?.value),buyerAddress=clean($('buyerAddress')?.value),consigneeName=clean($('consigneeName')?.value),consigneeAddress=clean($('consigneeAddress')?.value);
    if(policy.consignee&&partyLines('consignee')&&!(sameValue(buyerName,consigneeName)&&sameValue(buyerAddress,consigneeAddress)))cards.push(`<div class="pdf-party-card"><h3>${outText(['最终收货人','CONSIGNEE'])}</h3><p>${partyLines('consignee')}</p></div>`);
    if(policy.notify&&partyLines('notifyParty'))cards.push(`<div class="pdf-party-card"><h3>${outText(['到货通知方','NOTIFY PARTY'])}</h3><p>${partyLines('notifyParty')}</p></div>`);
    const addresses=[];const bill=clean($('billToAddress')?.value),ship=clean($('shipToAddress')?.value);
    if(policy.bill&&bill&&!sameValue(bill,buyerAddress))addresses.push([outText(['账单接收地址','BILL TO']),bill]);
    if(policy.ship&&ship&&!sameValue(ship,consigneeAddress||buyerAddress))addresses.push([outText(['送货地址','SHIP TO']),ship]);
    if(!cards.length&&!addresses.length)return;
    const section=document.createElement('section');section.className='pdf-flow-section pdf-additional-trade-parties fp-a11-trade-parties';section.innerHTML=`<div class="doc-section">${outText(['其他贸易主体','ADDITIONAL TRADE PARTIES'])}</div>${cards.length?`<div class="pdf-party-grid ${cards.length===1?'fp-a11-single-party':''}">${cards.join('')}</div>`:''}${addresses.length?`<table class="info pdf-address-table"><tbody>${addresses.map(([label,value])=>`<tr><th>${label}</th><td colspan="3">${esc(value)}</td></tr>`).join('')}</tbody></table>`:''}`;
    const parties=template.querySelector('.pdf-quotation-parties,.pdf-pi-parties,.pdf-commercial-parties,.pdf-packing-parties,.pdf-contract-parties');
    (parties||template.querySelector('.pdf-template-hero'))?.insertAdjacentElement('afterend',section);
  }
  function fixBuyerTitles(template){
    if(['quotation','proforma_invoice','sales_contract'].includes(type())){
      const main=template.querySelector('.pdf-quotation-parties,.pdf-pi-parties,.pdf-contract-parties');const cards=main?.querySelectorAll('.pdf-party-card');
      if(cards?.[1])cards[1].querySelector('h3').textContent=outText(['买方','BUYER']);
    }
  }
  function validIncoterm(value){const text=clean(value);return /^(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\s+.+/i.test(text)&&/Incoterms/i.test(text);}
  function removeInvalidIncoterms(template){
    if(validIncoterm($('tradeTerms')?.value))return;
    qsa('tr',template).forEach(tr=>{if(/incoterms|贸易术语/i.test(clean(tr.querySelector('th')?.textContent)))tr.remove();});
    qsa('.pdf-meta-grid>div,.pdf-meta-bar>span,.pdf-value-cards>article',template).forEach(node=>{if(/incoterms|贸易术语/i.test(clean(node.querySelector('b,small')?.textContent)))node.remove();});
  }
  function paymentComplete(){
    const beneficiary=clean($('bankBeneficiary')?.value),bank=clean($('bankName')?.value),account=clean($('bankAccount')?.value),note=clean($('bankAddress')?.value);
    return Boolean(account&&(beneficiary||bank))||/^https?:\/\//i.test(note);
  }
  function fixPayment(template){if(!paymentComplete())template.querySelectorAll('.pdf-payment-section').forEach(node=>node.remove());}
  function fixDuplicateDocumentMeta(template){
    const invoice=clean($('invoiceNo')?.value);if(!invoice)return;
    const numberPattern={quotation:/quotation no|报价单?编号/i,commercial_invoice:/commercial invoice no|商业发票编号|发票编号/i,packing_list:/packing list no|装箱单编号/i,sales_contract:/contract no|合同编号/i}[type()];
    if(!numberPattern)return;
    qsa('.pdf-meta-grid>div,.pdf-meta-bar>span,.pdf-value-cards>article',template).forEach(node=>{
      const label=clean(node.querySelector('b,small')?.textContent),value=clean(node.querySelector('span,em,strong')?.textContent);if(!numberPattern.test(label))return;
      if(sameValue(value,invoice)){node.remove();return;}
      if(type()==='quotation'&&value){const title=node.querySelector('b,small');if(title)title.textContent=outText(['客户参考号','CUSTOMER REFERENCE']);}
    });
  }
  function normalizeReferenceLabels(template){
    qsa('th,.pdf-meta-grid b,.pdf-meta-grid small,.pdf-meta-bar b,.pdf-meta-bar small,.pdf-value-cards b,.pdf-value-cards small',template).forEach(node=>{
      const label=clean(node.textContent);if(!/^(报价编号|QUOTATION NO\.?|Quotation No\.?)/i.test(label))return;
      if(['proforma_invoice','sales_contract'].includes(type()))node.textContent=outText(['关联报价单号','RELATED QUOTATION NO.']);
      else if(!['quotation'].includes(type()))node.closest('tr,.pdf-meta-grid>div,.pdf-meta-bar>span,.pdf-value-cards>article')?.remove();
    });
  }
  function compactCommercialTitle(template){const title=template.querySelector('.pdf-commercial-hero h2');if(title)title.classList.add('fp-a11-nowrap-title');}
  function isolatePdfOutput(root=$('piPaper')){
    if(!root)return;root.dataset.fpA11Output='1';qsa('.pdf-template',root).forEach(template=>{
      template.querySelectorAll('.pdf-supplement-info').forEach(regroupSupplement);rebuildTradeParties(template);fixBuyerTitles(template);removeInvalidIncoterms(template);fixPayment(template);fixDuplicateDocumentMeta(template);normalizeReferenceLabels(template);compactCommercialTitle(template);
    });
  }
  function syncA11EditorWarnings(){
    const section=$('fpA10PaymentScheduleSection');if(section){let note=$('fpA11PaymentRatioWarning');if(!note){note=document.createElement('p');note.id='fpA11PaymentRatioWarning';note.className='fp-a11-field-warning';section.appendChild(note);}const d=Number($('depositPercent')?.value),b=Number($('balancePercent')?.value),has=Number.isFinite(d)&&Number.isFinite(b)&&($('depositPercent')?.value!==''||$('balancePercent')?.value!=='');const ok=!has||Math.abs(d+b-100)<.01;note.hidden=ok;note.textContent=ok?'':`定金比例与尾款比例合计为 ${Number((d+b).toFixed(2))}%，正式输出前应核对为 100%。`;section.dataset.fpRatioValid=ok?'1':'0';}
    const terms=$('tradeTerms'),builder=$('fpR13A6IncotermsBuilder');if(builder)builder.classList.toggle('fp-a11-incoterms-incomplete',Boolean(clean(terms?.value)&&!validIncoterm(terms.value)));
    const payment=sectionNode('payment');if(payment){let warning=payment.querySelector('.fp-a11-payment-warning');if(!warning){warning=document.createElement('p');warning.className='fp-a11-field-warning fp-a11-payment-warning';payment.appendChild(warning);}warning.hidden=paymentComplete()||!toggleOn('showPayment');warning.textContent=warning.hidden?'':'当前收款资料不足以写入客户单据：请至少填写“收款人或平台＋账号”，或填写有效官方付款链接。';}
  }
  function patchPublicRender(){const app=window.FlypigBOXApp;if(!app?.renderPreview||app.renderPreview.__fpA11)return;const original=app.renderPreview.bind(app);const wrapped=(...args)=>{const result=original(...args);isolatePdfOutput();return result;};wrapped.__fpA11=true;app.renderPreview=wrapped;}
  function patchHtml2Canvas(){const original=window.html2canvas;if(typeof original!=='function'||original.__fpA11)return;const wrapped=function(target,options){isolatePdfOutput();return original.call(this,target,options);};wrapped.__fpA11=true;window.html2canvas=wrapped;}
  function scheduleOutputIsolation(delay=0){setTimeout(()=>{patchPublicRender();patchHtml2Canvas();syncA11EditorWarnings();isolatePdfOutput();},delay);}
  window.FlypigBOXV3350={refresh:(refresh=false)=>applyRules({refresh}),navigate:(key)=>{const button=document.querySelector(`#fpV3321SideNav [data-v3321-section="${key}"]`);if(button&&!button.hidden)navigate(key,button);},navAvailable};
  function boot(){
    if(!$('piForm'))return;schema.installStructuredSections?.();exportNaming();bindPreviewSwitch();patchPublicRender();patchHtml2Canvas();applyRules({refresh:false});scheduleOutputIsolation(120);
    const form=$('piForm');if(form&&!form.dataset.fpA10Bound){form.dataset.fpA10Bound='1';form.addEventListener('input',event=>{keepEditingSectionOpen(event.target);if(event.isTrusted&&event.target?.id)event.target.dataset.fpUserConfirmed='1';scheduleSync(false,170);});form.addEventListener('change',event=>{keepEditingSectionOpen(event.target);if(event.isTrusted&&event.target?.id)event.target.dataset.fpUserConfirmed='1';const id=event.target?.id||'';scheduleSync(true,['docMode','documentType',...schema.toggles].includes(id)?40:90);});}
    document.addEventListener('HUIDI:document-type-changed',()=>scheduleSync(true,50));document.addEventListener('HUIDI:paper-orientation-change',()=>setTimeout(prepareWorkbook,60));document.addEventListener('HUIDI:preview-only-mode-change',event=>{if(event.detail?.mode==='table')scheduleWorkbookRefresh(40);});['HUIDI:branding-ready','HUIDI:branding-updated'].forEach(name=>document.addEventListener(name,()=>scheduleSync(window.HUIDILayoutPolicy?.version==='1.2.0-RC16.10'?false:true,70)));document.addEventListener('HUIDI:apply-template',()=>scheduleSync(true,70));window.addEventListener('pageshow',()=>scheduleSync(false,50),{once:true});[180,600,1400].forEach(ms=>setTimeout(()=>applyRules({refresh:false}),ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();


/* HUIDI V3.3.6.24-R1.3A.14 — retained completion governance for formal CI/PL and section visibility closure.
   Explicit events only. No MutationObserver, ResizeObserver, polling, auth or session changes. */
(()=>{
  'use strict';
  const RELEASE='V3.3.6.24 R1.3A.14';
  const $=id=>document.getElementById(id);
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const type=()=>window.FlypigBOXDocumentSchema?.normalizeType?.(new URLSearchParams(location.search).get('type')||$('documentType')?.value||new URLSearchParams(location.search).get('doc'))||'proforma_invoice';
  const mode=()=>window.FlypigBOXDocumentSchema?.effectiveMode?.(type(),$('docMode')?.value)||window.FlypigBOXDocumentSchema?.normalizeMode?.($('docMode')?.value)||'ecommerce';
  const lang=()=>{
    const value=clean($('docLanguage')?.value)||'bilingual';
    const supported=(window.HUIDIDocI18n?.languages||[]).map(row=>row?.[0]).filter(Boolean);
    return supported.includes(value)?value:(['zh','en','bilingual'].includes(value)?value:'bilingual');
  };
  const out=(zh,en)=>{
    const current=lang(),i18n=window.HUIDIDocI18n;
    if(i18n?.text)return i18n.text(zh,en,current);
    return current==='zh'?zh:current==='en'?en:`${en} / ${zh}`;
  };
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let timer=0,drag=null;

  function itemRows(){return qsa('.item-row').map((row,index)=>({
    sourceIndex:index,index:index+1,row,itemKey:row.dataset.itemKey||'',sku:clean(row.querySelector('.i-sku')?.value),name:clean(row.querySelector('.i-name')?.value),spec:clean(row.querySelector('.i-spec')?.value),qty:num(row.querySelector('.i-qty')?.value),unit:clean(row.querySelector('.i-unit')?.value),price:num(row.querySelector('.i-price')?.value),hs:clean(row.querySelector('.i-hs')?.value),moq:clean(row.querySelector('.i-moq')?.value),cartonNo:clean(row.querySelector('.i-carton-no')?.value),packageDescription:clean(row.querySelector('.i-package-desc')?.value),dimensions:clean(row.querySelector('.i-dimensions')?.value),shippingMarks:clean(row.querySelector('.i-item-marks')?.value),image:clean(row.dataset.image),net:num(row.querySelector('.i-net-weight')?.value),gross:num(row.querySelector('.i-gross-weight')?.value),cbm:num(row.querySelector('.i-cbm')?.value)
  }));}
  function meaningfulItem(item){const text=[item.sku,item.name,item.spec,item.hs,item.moq,item.cartonNo,item.packageDescription,item.dimensions,item.shippingMarks,item.image].some(Boolean),numeric=item.price>0||item.net>0||item.gross>0||item.cbm>0,qtyChanged=item.qty>0&&Math.abs(item.qty-1)>.000001,unitChanged=item.unit&&item.unit.toUpperCase()!=='PCS';return Boolean(text||numeric||qtyChanged||unitChanged);}
  function validItems(){return itemRows().filter(meaningfulItem).map((item,index)=>({...item,index:index+1}));}
  function totalAmount(){return validItems().reduce((sum,item)=>sum+item.qty*item.price,0);}
  function validIncoterm(){const value=clean($('tradeTerms')?.value);return /^(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\s+.+/i.test(value)&&/Incoterms/i.test(value);}
  function paymentComplete(){const beneficiary=clean($('bankBeneficiary')?.value),bank=clean($('bankName')?.value),account=clean($('bankAccount')?.value),link=clean($('bankAddress')?.value);return Boolean(account&&(beneficiary||bank))||/^https?:\/\//i.test(link);}
  function shippingCategory(){const method=clean($('shippingMethod')?.value).toLowerCase(),doc=clean($('transportDocumentType')?.value).toUpperCase();if(doc==='AWB'||/air/.test(method))return'air';if(doc==='COURIER'||/express|courier/.test(method))return'courier';if(doc==='RAIL'||/rail/.test(method))return'rail';if(doc==='CMR'||/truck|road/.test(method))return'road';if(doc==='BL'||/sea|ocean/.test(method))return'sea';return'unknown';}
  function reason(code,text,section,level='block'){return{code,text,section,level};}
  function readiness(){
    const t=type(),m=mode(),items=validItems(),blocks=[],warnings=[];
    const add=(target,code,text,section)=>target.push(reason(code,text,section,target===blocks?'block':'warn'));
    if(!clean($('invoiceNo')?.value))add(blocks,'number','缺少单据编号','basic');
    if(!clean($('issueDate')?.value))add(blocks,'date','缺少出单日期','basic');
    if(!clean($('sellerName')?.value))add(blocks,'seller','缺少卖方/出口方公司','parties');
    if(!clean($('buyerName')?.value))add(blocks,'buyer','缺少买方/进口方公司','parties');
    if(!items.length)add(blocks,'items','至少填写一项商品','products');
    items.forEach(item=>{
      if(!item.name)add(blocks,`item-name-${item.index}`,`第${item.index}项缺少商品名称`,'products');
      if(item.qty<=0)add(blocks,`item-qty-${item.index}`,`第${item.index}项数量必须大于0`,'products');
      if(t!=='packing_list'&&item.price<=0)add(blocks,`item-price-${item.index}`,`第${item.index}项单价必须大于0`,'products');
      if(item.gross>0&&item.net>0&&item.gross<item.net)add(blocks,`weight-${item.index}`,`第${item.index}项毛重小于净重`,'packing');
      if(item.gross>0&&item.net>0&&Math.abs(item.gross-item.net)<0.0001)add(warnings,`equal-weight-${item.index}`,`第${item.index}项毛重与净重相同，请确认包装重量`,'packing');
    });
    if(t!=='packing_list'&&items.length&&totalAmount()<=0)add(blocks,'amount','商品总金额必须大于0','costs');
    if(['quotation','proforma_invoice','sales_contract','commercial_invoice'].includes(t)&&$('showTerms')?.checked&&!validIncoterm())add(warnings,'incoterm','贸易术语应包含指定地点和 Incoterms® 2020','terms');
    if(t==='proforma_invoice'){
      if(!clean($('paymentTerms')?.value))add(blocks,'payment-terms','缺少付款条件','terms');
      if($('showPayment')?.checked&&!paymentComplete())add(warnings,'payment-account','收款资料不完整，不会写入客户单据','payment');
    }
    if(t==='commercial_invoice'){
      if(!clean($('consigneeName')?.value)&&!clean($('buyerName')?.value))add(blocks,'consignee','缺少买方或最终收货人','delivery');
      if(!clean($('exportReason')?.value))add(blocks,'export-reason','缺少出口原因','customs');
      if(!clean($('customsDescription')?.value)&&!items.some(item=>item.name))add(blocks,'customs-name','缺少海关申报品名','customs');
      if(!items.some(item=>item.hs))add(warnings,'hs','商品未填写海关编码（HS Code）','products');
      if(num($('customsDeclaredValue')?.value)<=0&&totalAmount()<=0)add(blocks,'declared-value','缺少海关申报价值','customs');
    }
    if(t==='packing_list'){
      if(!clean($('relatedCommercialInvoiceNo')?.value))add(warnings,'related-ci','建议关联商业发票号（CI）','references');
      if(num($('packageCount')?.value)<=0)add(blocks,'packages','总箱数必须大于0','packing');
      if(num($('grossWeight')?.value)<=0&&!items.some(item=>item.gross>0))add(blocks,'gross-weight','缺少毛重','packing');
    }
    if(t==='sales_contract'){
      if(!clean($('qualityStandard')?.value))add(warnings,'quality','建议填写质量标准','qualityRisk');
      if(!clean($('riskTransferPoint')?.value)&&!validIncoterm())add(warnings,'risk','建议明确风险转移节点','qualityRisk');
    }
    const destination=clean($('destinationPort')?.value);if(destination&&/^\d+$/.test(destination))add(warnings,'destination','目的地仅为数字，请核对城市、港口或完整地点','plannedLogistics');
    const cbm=num($('cbm')?.value),gross=num($('grossWeight')?.value);if(cbm>0&&gross>0&&cbm>gross*2)add(warnings,'cbm','体积与毛重差异异常，请核对单位和数值','packing');
    const category=shippingCategory();if(category!=='unknown'){
      const conflicts={sea:['AWB','COURIER','RAIL','CMR'],air:['BL','COURIER','RAIL','CMR'],courier:['BL','AWB','RAIL','CMR'],rail:['BL','AWB','COURIER','CMR'],road:['BL','AWB','COURIER','RAIL']};
      const doc=clean($('transportDocumentType')?.value).toUpperCase();if(doc&&conflicts[category]?.includes(doc))add(warnings,'transport-conflict','运输方式与运输单据类型可能不匹配','actualShipment');
    }
    const allRows=itemRows(),removableBlankCount=Math.max(0,allRows.length-items.length-(items.length===0?1:0));return{type:t,mode:m,blocks,warnings,ready:blocks.length===0,items,total:totalAmount(),removableBlankCount};
  }

  const SECTION_LABELS={basic:'基础信息',references:'关联与参考',parties:'买卖双方',delivery:'收货与通知',products:'商品与金额',costs:'费用与金额',paymentSchedule:'付款计划',payment:'收款方式与账户',customs:'清关与监管',packing:'包装与重量',plannedLogistics:'交付与物流计划',actualShipment:'实际出货',qualityRisk:'质量、验收与风险',terms:'交易条件'};
  function applyNavReadiness(result){
    const bySection=new Map();[...result.blocks,...result.warnings].forEach(issue=>{if(!bySection.has(issue.section))bySection.set(issue.section,[]);bySection.get(issue.section).push(issue);});
    qsa('#fpV3321SideNav [data-v3321-section]').forEach(button=>{
      const key=button.dataset.v3321Section,issues=bySection.get(key)||[],blocks=issues.filter(i=>i.level==='block');
      button.classList.toggle('fp-a12-nav-block',blocks.length>0);button.classList.toggle('fp-a12-nav-warn',!blocks.length&&issues.length>0);
      if(issues.length)button.title=issues.map(i=>i.text).join('；');
      const badge=button.querySelector('[data-fp-nav-status],.fp-v3350-nav-state');if(badge&&issues.length){badge.dataset.state=blocks.length?'error':'warning';badge.textContent=blocks.length?'!':'·';}
      if(!issues.length){const section=document.querySelector(`[data-fp-section="${key}"]`),sectionBadge=section?.querySelector('[data-fp-section-status]');if(sectionBadge&&badge){badge.dataset.state=sectionBadge.dataset.state||'empty';badge.textContent=sectionBadge.dataset.state==='complete'?'✓':sectionBadge.dataset.state==='prefilled'?'•':'';button.title=sectionBadge.title||button.title;}else{button.classList.remove('fp-a12-nav-block','fp-a12-nav-warn');}}
    });
    qsa('[data-fp-section-status]').forEach(badge=>{const section=badge.closest('[data-fp-section]');const issues=bySection.get(section?.dataset.fpSection)||[];if(!issues.length)return;const blocks=issues.filter(i=>i.level==='block');badge.dataset.state=blocks.length?'error':'warning';badge.textContent=blocks.length?`缺${blocks.length}项`:`提醒${issues.length}项`;badge.title=issues.map(i=>i.text).join('；');});
  }
  function readinessBanner(template,result){
    template.querySelector('.fp-a12-readiness-banner')?.remove();template.classList.toggle('fp-a12-incomplete',!result.ready);template.dataset.fpReady=result.ready?'1':'0';
    const paper=$('piPaper'),host=paper?.parentElement||template.parentElement;let banner=host?.querySelector(':scope > #fpA12PreviewReadiness');
    if(result.ready){banner?.remove();return;}
    if(!banner){banner=document.createElement('section');banner.id='fpA12PreviewReadiness';banner.className='fp-a12-readiness-banner';host?.insertBefore(banner,paper||host.firstChild);}
    const issues=result.blocks.slice(0,5).map((item,index)=>`<button type="button" data-fp-readiness-issue="${index}">${esc(item.text)}</button>`).join('');
    banner.innerHTML=`<strong>这张单据还有内容需要补充</strong><span>${issues}${result.blocks.length>5?`<em>另有 ${result.blocks.length-5} 项</em>`:''}</span><div class="fp-readiness-actions">${result.removableBlankCount?`<button type="button" data-fp-clean-empty>清理 ${result.removableBlankCount} 条空白商品行</button>`:''}${result.blocks.length?'<button type="button" data-fp-first-issue>查看第一个问题</button>':''}</div><small>补充完成后才可以导出正式文件</small>`;
  }
  function setExportState(result){
    const note=$('pdfExportNote');if(note)note.textContent=result.ready?(result.warnings.length?`可以导出，但仍有 ${result.warnings.length} 项提醒需要核对。`:'当前核心资料已完成，可以进入正式导出核对。'):`尚缺 ${result.blocks.length} 项关键资料：${result.blocks.slice(0,3).map(i=>i.text).join('、')}。正式导出已阻止。`;
    ['exportPdfBtn','headerExportPdfBtn'].forEach(id=>{const button=$(id);if(!button)return;button.dataset.fpA12Blocked=result.ready?'0':'1';button.setAttribute('aria-disabled',result.ready?'false':'true');button.title=result.ready?(result.warnings.map(i=>i.text).join('；')||'可以导出'):`正式导出前请补充：${result.blocks.map(i=>i.text).join('；')}`;});
  }
  function ensureDialog(){let dialog=$('fpA12ReadinessDialog');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='fpA12ReadinessDialog';dialog.className='fp-a12-dialog';dialog.innerHTML='<div class="fp-a12-dialog-box"><button type="button" class="fp-a12-dialog-close" data-fp-a12-close>×</button><p class="eyebrow">正式导出检查</p><h2>这份单据还不能正式导出</h2><div data-fp-a12-dialog-content></div><div class="fp-a12-dialog-actions"><button type="button" class="btn primary" data-fp-a12-close>返回继续填写</button></div></div>';document.body.appendChild(dialog);dialog.addEventListener('click',event=>{if(event.target.matches('[data-fp-a12-close]')||event.target===dialog)dialog.close();});return dialog;}
  function showBlocked(result){const dialog=ensureDialog(),content=dialog.querySelector('[data-fp-a12-dialog-content]');content.innerHTML=`<p>缺少以下关键资料：</p><ol>${result.blocks.map(item=>`<li><b>${esc(SECTION_LABELS[item.section]||item.section)}</b>：${esc(item.text)}</li>`).join('')}</ol>${result.warnings.length?`<p class="fp-a12-dialog-warn">另有 ${result.warnings.length} 项提醒，可在补齐关键资料后继续核对。</p>`:''}`;dialog.showModal?.();try{window.FlypigBOXApp?.setStatus?.('当前单据缺少关键资料，已阻止正式导出。','error');}catch(_){}}
  function guardExport(event){const button=event.target.closest?.('#exportPdfBtn,#headerExportPdfBtn');if(!button)return;if(window.HUIDI_LOCAL_ONLY?.localOnly&&window.FlypigBOXPdfExportState?.unifiedPreflight===true)return;const result=readiness();if(result.ready)return;event.preventDefault();event.stopImmediatePropagation();showBlocked(result);}

  function partyHtml(prefix){const fields=[['Name',''],['Contact',out('联系人','CONTACT')],['Phone',out('电话','PHONE')],['Email',out('邮箱','EMAIL')],['Address',out('地址','ADDRESS')]],values=fields.map(([suffix])=>clean($(`${prefix}${suffix}`)?.value));if(!values.some(Boolean))return'';return values.map((value,index)=>value?(index===0?`<strong>${esc(value)}</strong>`:`<span class="muted">${fields[index][1]}:</span> ${esc(value)}`):'').filter(Boolean).join('<br>');}
  function same(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase()&&clean(a)!=='';}
  function fixCommercialParties(template){
    if(type()!=='commercial_invoice')return;const section=template.querySelector('.pdf-commercial-parties');if(!section)return;const grid=section.querySelector('.pdf-party-grid');if(!grid)return;
    const cards=grid.querySelectorAll('.pdf-party-card');if(!cards.length)return;const seller=cards[0];seller.querySelector('h3')&&(seller.querySelector('h3').textContent=out('出口方','EXPORTER'));
    const buyer=document.createElement('div');buyer.className='pdf-party-card fp-a12-buyer-card';buyer.innerHTML=`<h3>${out('买方（进口方）','BUYER / IMPORTER')}</h3><p>${partyHtml('buyer')}</p>`;
    grid.innerHTML='';grid.append(seller,buyer);section.querySelector('.doc-section')&&(section.querySelector('.doc-section').textContent=out('出口方、买方与收货方','EXPORTER, BUYER & CONSIGNEE'));
    template.querySelector('.fp-a12-commercial-consignee')?.remove();const buyerName=clean($('buyerName')?.value),buyerAddress=clean($('buyerAddress')?.value),consigneeName=clean($('consigneeName')?.value),consigneeAddress=clean($('consigneeAddress')?.value);
    if(partyHtml('consignee')&&!(same(buyerName,consigneeName)&&same(buyerAddress,consigneeAddress))){const extra=document.createElement('section');extra.className='pdf-flow-section fp-a12-commercial-consignee';extra.innerHTML=`<div class="doc-section">${out('最终收货人','CONSIGNEE')}</div><div class="pdf-party-card fp-a12-full-party"><p>${partyHtml('consignee')}</p></div>`;section.insertAdjacentElement('afterend',extra);}
  }
  function rowLabel(row){return clean(row.querySelector('th')?.textContent||row.firstElementChild?.textContent);}
  function pruneShipment(template){
    const category=shippingCategory();if(category==='unknown')return;
    const patterns={
      common:/packages|包裹|箱数|carton|n\.w|g\.w|净重|毛重|cbm|体积|carrier|承运|forwarder|货代|shipment date|发货日|departure|arrival|离港|到港|发运|到达/i,
      sea:/b\s*\/\s*l|提单|container|柜号|seal|封条|vessel|船名|voyage|航次/i,
      air:/awb|air waybill|空运单|airline|航空|flight|航班/i,
      courier:/tracking|追踪|courier|快递|waybill|运单/i,
      rail:/rail|铁路|waybill|运单|train|车次|container|柜号/i,
      road:/cmr|road|truck|公路|卡车|车辆|waybill|运单/i
    };
    const allowed=label=>patterns.common.test(label)||patterns[category].test(label);
    qsa('.pdf-logistics-section table,.pdf-shipment-details table,.pdf-actual-shipment table,.pdf-packing-summary table',template).forEach(table=>{
      qsa('tr',table).forEach(row=>{
        const cells=Array.from(row.children),pairs=[];
        for(let i=0;i<cells.length;i+=2){const th=cells[i],td=cells[i+1];if(!th||!td)continue;let label=clean(th.textContent);
          if(category==='air'&&/b\s*\/\s*l|提单/i.test(label)){label=out('空运单号（AWB）','AIR WAYBILL NO. (AWB)');th.textContent=label;}
          if(category==='courier'&&/tracking|追踪|waybill|运单/i.test(label)){th.textContent=out('快递追踪号','COURIER TRACKING NO.');label=th.textContent;}
          if(allowed(label))pairs.push([th,td]);
        }
        row.innerHTML='';pairs.forEach(([th,td])=>row.append(th,td));if(!pairs.length)row.remove();
      });
      if(!table.querySelector('tr'))table.closest('.pdf-logistics-section,.pdf-shipment-details,.pdf-actual-shipment,.pdf-packing-summary')?.remove();
    });
  }
  function sanitizeDeclaration(template){
    if(type()!=='commercial_invoice')return;const section=template.querySelector('.pdf-commercial-declaration');if(!section)return;section.querySelectorAll('input,button,select,textarea').forEach(node=>node.remove());const text=clean(section.textContent).replace(/单据说明|document notice|声明|declaration/ig,'').trim();if(!text){section.remove();return;}const title=section.querySelector('.doc-section');if(title)title.textContent=out('声明','DECLARATION');
  }
  function normalizeBilingual(template){if(lang()!=='bilingual')return;qsa('.doc-section,h3,th,.pdf-meta-grid b,.pdf-meta-grid small,.pdf-meta-bar b,.pdf-meta-bar small',template).forEach(node=>{const text=clean(node.textContent);const parts=text.split(/\s*\/\s*/);if(parts.length!==2)return;const hasZh=value=>/[\u3400-\u9fff]/.test(value);if(hasZh(parts[0])&&!hasZh(parts[1]))node.textContent=`${parts[1]} / ${parts[0]}`;});}
  function cleanupPreview(template){template.style.removeProperty('border-right');template.style.removeProperty('outline');template.closest('.pdf-page')?.classList.remove('fp-a12-debug-outline');}
  function softenWatermark(root){qsa('.fp-trial-watermark',root).forEach(mark=>{mark.dataset.fpA12Watermark='1';mark.setAttribute('aria-hidden','true');});}
  function fixOutput(options={}){const result=readiness(),root=$('piPaper');if(!root)return result;root.dataset.fpA12Ready=result.ready?'1':'0';const mutatePdf=options.prePagination===true||document.body.dataset.huidiStablePagination!=='1';if(mutatePdf)qsa('.pdf-template',root).forEach(template=>{readinessBanner(template,result);fixCommercialParties(template);pruneShipment(template);sanitizeDeclaration(template);normalizeBilingual(template);cleanupPreview(template);});softenWatermark(root);applyNavReadiness(result);setExportState(result);return result;}

  function normalizeEditor(){
    const quote=$('quoteNo'),label=quote?.closest('label');if(label){const input=quote;const text=type()==='quotation'?'客户参考号':(['proforma_invoice','sales_contract'].includes(type())?'关联报价单号':'报价参考号');Array.from(label.childNodes).filter(node=>node.nodeType===3).forEach(node=>node.textContent='');label.insertBefore(document.createTextNode(text),input);}
    const moq=$('moqControl'),terms=document.querySelector('[data-fp-section="terms"],[data-optional-section="showTerms"]');if(moq){moq.querySelector('input')?.setAttribute('placeholder','例如：500 PCS；多商品可在商品行分别填写');if(type()==='quotation'&&terms&&!terms.contains(moq)){const grid=terms.querySelector('.grid');if(grid)grid.prepend(moq);else terms.appendChild(moq);}moq.hidden=type()!=='quotation';}
    const payment=document.querySelector('[data-fp-section="payment"],[data-optional-section="showPayment"]'),schedule=$('fpA10PaymentScheduleSection');if(payment&&schedule&&payment.previousElementSibling!==schedule){schedule.insertAdjacentElement('afterend',payment);}const ph=payment?.querySelector('h2');if(ph)ph.textContent='收款方式与账户';
  }
  function ensureSplitter(){const workbench=document.querySelector('#piForm>.workbench');if(!workbench||workbench.querySelector('.fp-a12-splitter'))return;const form=workbench.querySelector(':scope>.form-column'),preview=workbench.querySelector(':scope>.preview-shell');if(!form||!preview)return;const splitter=document.createElement('button');splitter.type='button';splitter.className='fp-a12-splitter';splitter.setAttribute('aria-label','拖动调整编辑区和预览区宽度');splitter.title='拖动调整左右区域宽度；双击恢复 50:50';form.insertAdjacentElement('afterend',splitter);splitter.addEventListener('pointerdown',event=>{if(matchMedia('(max-width:1099px)').matches)return;drag={startX:event.clientX,rect:workbench.getBoundingClientRect()};splitter.setPointerCapture?.(event.pointerId);document.body.classList.add('fp-a12-resizing');});splitter.addEventListener('pointermove',event=>{if(!drag)return;const ratio=Math.min(.68,Math.max(.32,(event.clientX-drag.rect.left)/drag.rect.width));setRatio(ratio,false);});splitter.addEventListener('pointerup',()=>{if(!drag)return;drag=null;document.body.classList.remove('fp-a12-resizing');saveRatio();});splitter.addEventListener('dblclick',()=>setRatio(.5,true));let saved=NaN;try{saved=Number(localStorage.getItem('flypigbox_editor_split_ratio'));}catch(_){ }setRatio(Number.isFinite(saved)&&saved>=.32&&saved<=.68?saved:.5,false);}
  function setRatio(ratio,persist){const workbench=document.querySelector('#piForm>.workbench');if(!workbench)return;workbench.style.setProperty('--fp-a12-left',`${(ratio*100).toFixed(2)}%`);workbench.dataset.fpSplitRatio=String(ratio);if(persist)saveRatio();}
  function saveRatio(){const workbench=document.querySelector('#piForm>.workbench'),ratio=Number(workbench?.dataset.fpSplitRatio);if(Number.isFinite(ratio))try{localStorage.setItem('flypigbox_editor_split_ratio',String(ratio));}catch(_){ }}
  function patchPreviewRender(){const app=window.FlypigBOXApp;if(!app?.renderPreview||app.renderPreview.__fpA12)return;const original=app.renderPreview.bind(app);const wrapped=(...args)=>{const value=original(...args);requestAnimationFrame(()=>fixOutput());return value;};wrapped.__fpA12=true;app.renderPreview=wrapped;}
  function schedule(delay=40){clearTimeout(timer);timer=setTimeout(()=>requestAnimationFrame(()=>{patchPreviewRender();normalizeEditor();ensureSplitter();fixOutput();stamp();}),delay);}
  function stamp(){const badge=$('fpLiteVersion');if(badge){badge.textContent=RELEASE;badge.title='正规商业发票与装箱单统一、分栏展开可见性候选版';}document.body.dataset.fpA12='1';document.body.dataset.fpA13='1';}
  const preparePdf=()=>fixOutput({prePagination:true});
  window.FlypigBOXA12=Object.assign(window.FlypigBOXA12||{},{readiness,refresh:()=>schedule(0),setRatio,preparePdf});
  function boot(){if(!$('piForm'))return;patchPreviewRender();document.addEventListener('click',guardExport,true);$('piForm').addEventListener('change',()=>schedule(80));['HUIDI:preview-rendered','HUIDI:document-type-changed','HUIDI:apply-template','HUIDI:trade-scenario-applied'].forEach(name=>document.addEventListener(name,()=>schedule(40)));window.addEventListener('pageshow',()=>schedule(70),{once:true});[50,260,800].forEach(ms=>setTimeout(()=>schedule(0),ms));window.FlypigBOXA12=Object.assign(window.FlypigBOXA12||{},{readiness,refresh:()=>schedule(0),setRatio,preparePdf});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
