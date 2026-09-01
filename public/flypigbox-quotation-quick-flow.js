/* HUIDI V3.3.6.24-R1.3A.18.23.4 — original header restoration with compact quotation helpers retained. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.23.4-ORIGINAL-HEADER-RESTORATION.1';
  if(window.FlypigBOXQuotationQuickFlow?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const MODE_KEY='flypigbox_quotation_quick_mode_v1';
  const ADVANCED_KEY='flypigbox_quotation_advanced_open_v1';
  const LAYOUT_KEY='flypigbox_quotation_pdf_density_v1';
  const DEFAULTS_KEY='flypigbox_quotation_defaults_v1';
  const field=id=>document.getElementById(id);
  const value=id=>String(field(id)?.value||'').trim();
  const setValue=(id,next,{onlyEmpty=true}={})=>{const el=field(id);if(!el||next==null||next==='')return false;if(onlyEmpty&&String(el.value||'').trim())return false;el.value=String(next);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;};
  const docType=()=>value('documentType')||window.FlypigBOXApp?.getDocumentType?.()||'';
  const isQuotation=()=>docType()==='quotation';
  const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const writeJSON=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}};
  const notify=(message,type='ok')=>window.FlypigBOXApp?.setStatus?.(message,type);
  let quickMode=localStorage.getItem(MODE_KEY)!=='full';
  let advanced=localStorage.getItem(ADVANCED_KEY)==='1';
  let onePage=localStorage.getItem(LAYOUT_KEY)!=='standard';
  let refreshTimer=0;

  const targets={basic:()=>$('.top-workspace>.card:first-child'),customer:()=>findCard('买卖双方'),products:()=>findCard('商品明细'),terms:()=>findCard('交易条款'),preview:()=>$('#previewShell')};
  function findCard(title){return $$('.form-column>section.card').find(card=>(card.querySelector('h2')?.textContent||'').includes(title))||null;}
  function scrollTarget(key){const target=targets[key]?.();if(!target)return;target.scrollIntoView({behavior:'smooth',block:'start'});setActiveStep(key);}
  function setActiveStep(key){$$('[data-fp-qf-step]').forEach(btn=>btn.classList.toggle('active',btn.dataset.fpQfStep===key));}
  function ensureShell(){
    // R1.3A.18.23.4: the user explicitly chose the original editor header.
    // Remove any previously injected quick-flow header and never recreate it.
    const shell=$('#fpQuotationQuickFlow');
    if(shell)shell.remove();
    return null;
  }
  function ensureBottom(){
    let bar=$('#fpQuotationBottomActions');if(bar)return bar;
    bar=document.createElement('div');bar.id='fpQuotationBottomActions';bar.className='fp-qf-bottom';
    bar.innerHTML='<span class="fp-qf-save-state" data-fp-qf-save-state>当前内容尚未保存</span><button type="button" data-fp-qf-bottom="save">保存草稿</button><button type="button" data-fp-qf-bottom="check">检查资料</button><button class="primary" type="button" data-fp-qf-bottom="export">导出PDF</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click',event=>{const action=event.target.closest('[data-fp-qf-bottom]')?.dataset.fpQfBottom;if(!action)return;if(action==='save')return field('saveAllBtn')?.click();if(action==='check'){const check=document.querySelector('[data-fp-check-document],[data-fp-check]');if(check)return check.click();return field('exportPdfBtn')?.click();}if(action==='export')return field('exportPdfBtn')?.click();});
    return bar;
  }
  function ensureDefaults(){
    const basic=$('.top-workspace>.card:first-child');if(!basic||$('#fpQuotationDefaults'))return;
    const panel=document.createElement('div');panel.id='fpQuotationDefaults';panel.className='fp-qf-defaults';panel.innerHTML='<b>常用报价条件</b><span data-fp-qf-default-state>还没有保存企业常用值</span><button type="button" data-fp-qf-default="apply">填充空白字段</button><button type="button" data-fp-qf-default="save">保存当前为常用</button><button type="button" data-fp-qf-layout-toggle>优先一页</button>';
    basic.appendChild(panel);
    panel.addEventListener('click',event=>{const action=event.target.closest('[data-fp-qf-default]')?.dataset.fpQfDefault;if(action==='save')return saveDefaults();if(action==='apply')return applyDefaults(false);if(event.target.closest('[data-fp-qf-layout-toggle]')){onePage=!onePage;localStorage.setItem(LAYOUT_KEY,onePage?'one-page':'standard');syncPreviewDensity(true);}});
  }
  function saveDefaults(){
    const issue=value('issueDate'),valid=value('validUntil');let validityDays=30;
    if(issue&&valid){const diff=Math.round((new Date(`${valid}T00:00:00`)-new Date(`${issue}T00:00:00`))/86400000);if(Number.isFinite(diff)&&diff>0&&diff<366)validityDays=diff;}
    const data={currency:value('currency'),originCountry:value('originCountry'),paymentTerms:value('paymentTerms'),tradeTerms:value('tradeTerms'),deliveryTime:value('deliveryTime'),portOfLoading:value('portOfLoading'),shippingMethod:value('shippingMethod'),validityDays,updatedAt:Date.now()};
    if(!writeJSON(DEFAULTS_KEY,data))return notify('当前浏览器无法保存常用报价条件。','error');
    updateDefaultsState();notify('已保存常用报价条件。以后只会填充空白字段，不会覆盖当前内容。','ok');
  }
  function applyDefaults(silent=true){
    const data=readJSON(DEFAULTS_KEY,null);if(!data){if(!silent)notify('还没有保存常用报价条件。','error');return 0;}
    let count=0;['currency','originCountry','paymentTerms','tradeTerms','deliveryTime','portOfLoading','shippingMethod'].forEach(id=>{if(setValue(id,data[id]))count++;});
    const issue=value('issueDate');if(issue&&!value('validUntil')&&data.validityDays){const date=new Date(`${issue}T00:00:00`);date.setDate(date.getDate()+Number(data.validityDays||30));if(setValue('validUntil',date.toISOString().slice(0,10)))count++;}
    window.FlypigBOXApp?.renderPreview?.();if(!silent)notify(count?`已填充 ${count} 个空白字段。`:'当前字段已有内容，没有覆盖。','ok');return count;
  }
  function updateDefaultsState(){const data=readJSON(DEFAULTS_KEY,null),node=$('[data-fp-qf-default-state]');if(node)node.textContent=data?`已保存 · ${data.currency||'币种未设'} · 有效期 ${data.validityDays||30} 天`:'还没有保存企业常用值';const button=$('[data-fp-qf-layout-toggle]');if(button)button.textContent=onePage?'优先一页：开':'优先一页：关';}
  function openBatchProducts(){
    const switchBtn=$('[data-editor-view="table"]')||$('[data-primary-mode="table"]');if(switchBtn){switchBtn.click();setTimeout(()=>{const importBtn=$('[data-context-action="products"], [data-table-context="products"]')||$$('button').find(btn=>(btn.textContent||'').includes('导入商品'));importBtn?.click();},240);notify('已切换到表格工作台，可粘贴或批量导入商品。','ok');return;}
    field('fpLiteImportBtn')?.click();
  }
  function rowIsMeaningful(row){
    const guard=window.FlypigBOXEmptyItemGuard;
    if(guard?.meaningfulItem&&guard?.rowSnapshot)return guard.meaningfulItem(guard.rowSnapshot(row));
    const text=['.i-sku','.i-name','.i-spec','.i-hs','.i-moq','.i-carton-no','.i-package-desc','.i-dimensions','.i-item-marks'].some(selector=>valueFrom(row.querySelector(selector)));
    const numeric=['.i-price','.i-net-weight','.i-gross-weight','.i-cbm'].some(selector=>Number(row.querySelector(selector)?.value||0)>0);
    const qty=Number(row.querySelector('.i-qty')?.value||0),unit=valueFrom(row.querySelector('.i-unit')).toUpperCase();
    return Boolean(text||row.dataset.image||numeric||(qty>0&&Math.abs(qty-1)>.000001)||(unit&&unit!=='PCS'));
  }
  function meaningfulRows(){return $$('.item-row').filter(rowIsMeaningful);}
  function enhanceItems(){
    $$('.item-row').forEach(row=>{
      if(!row.querySelector('.fp-item-more')){const btn=document.createElement('button');btn.type='button';btn.className='fp-item-more';btn.textContent='更多';btn.addEventListener('click',()=>{row.classList.toggle('fp-item-expanded');btn.textContent=row.classList.contains('fp-item-expanded')?'收起':'更多';});row.appendChild(btn);}
      if(!row.querySelector('.fp-item-amount')){const amount=document.createElement('div');amount.className='fp-item-amount';amount.innerHTML='<small>本行金额</small><b>0.00</b>';row.appendChild(amount);}
      updateRowAmount(row);
    });
    ensureItemSummary();
  }
  function updateRowAmount(row){const qty=Number(row.querySelector('.i-qty')?.value||0),price=Number(row.querySelector('.i-price')?.value||0),cur=value('currency')||'USD';const box=row.querySelector('.fp-item-amount b'),next=`${cur} ${(qty*price).toFixed(2)}`;if(box&&box.textContent!==next)box.textContent=next;}
  function ensureItemSummary(){const list=field('itemList');if(!list)return;let node=$('#fpQuotationItemSummary');if(!node){node=document.createElement('div');node.id='fpQuotationItemSummary';node.className='fp-qf-item-summary';list.insertAdjacentElement('afterend',node);}const rows=meaningfulRows(),cur=value('currency')||'USD';let qty=0,total=0;rows.forEach(row=>{const q=Number(row.querySelector('.i-qty')?.value||0),p=Number(row.querySelector('.i-price')?.value||0);qty+=q;total+=q*p;});node.innerHTML=`<span>${rows.length} 个商品 · 数量 ${qty.toFixed(2)}</span><b>${cur} ${total.toFixed(2)}</b>`;}
  function removeAdvice(label){label?.querySelector('.fp-field-advice')?.remove();label?.classList.remove('fp-qf-field-warn','fp-qf-field-ok');}
  function advice(el,message,type='warn'){const label=el?.closest('label');if(!label)return;removeAdvice(label);if(!message)return;const note=document.createElement('small');note.className=`fp-field-advice ${type}`;note.textContent=message;label.appendChild(note);label.classList.add(type==='warn'?'fp-qf-field-warn':'fp-qf-field-ok');}
  function genericTest(v){return /^(?:test|测试|样品|sample|demo|\d{1,5}|222+|333+|123+|abc)$/i.test(String(v||'').trim());}
  function validateFields(){
    let warnings=0;
    const emailIds=['sellerEmail','buyerEmail'];emailIds.forEach(id=>{const el=field(id),v=value(id);if(!el)return;if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){advice(el,'邮箱格式可能不完整，请核对。');warnings++;}else removeAdvice(el.closest('label'));});
    ['sellerPhone','buyerPhone'].forEach(id=>{const el=field(id),v=value(id);if(!el)return;const digits=v.replace(/\D/g,'');if(v&&digits.length<7){advice(el,'电话号码过短，请确认国家区号和号码。');warnings++;}else removeAdvice(el.closest('label'));});
    const code=field('buyerCountryCode'),cv=value('buyerCountryCode');if(code&&cv&&!/^[A-Za-z]{2,3}$/.test(cv)){advice(code,'国家代码建议使用2位ISO代码，例如 US、DE。');warnings++;}else removeAdvice(code?.closest('label'));
    ['sellerName','buyerName','buyerContact','invoiceNo','quoteNo','deliveryTime'].forEach(id=>{const el=field(id),v=value(id);if(!el)return;if(v&&genericTest(v)){advice(el,'当前内容像测试值，正式发送前建议替换。');warnings++;}else removeAdvice(el.closest('label'));});
    const trade=field('tradeTerms'),tv=value('tradeTerms');if(trade&&tv){const hasRule=/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i.test(tv),hasPlace=/[A-Za-z\u4e00-\u9fff]{3,}/.test(tv.replace(/Incoterms®?\s*2020/ig,''));if(!hasRule||!hasPlace){advice(trade,'请填写贸易术语和真实地点，例如 FOB Ningbo, China。');warnings++;}else removeAdvice(trade.closest('label'));}
    let itemIndex=0;$$('.item-row').forEach(row=>{const name=row.querySelector('.i-name'),qty=row.querySelector('.i-qty'),price=row.querySelector('.i-price');if(!rowIsMeaningful(row)){removeAdvice(name?.closest('label'));removeAdvice(qty?.closest('label'));removeAdvice(price?.closest('label'));return;}itemIndex++;if(!valueFrom(name)||genericTest(valueFrom(name))){advice(name,`第 ${itemIndex} 行商品名称需要核对。`);warnings++;}else removeAdvice(name?.closest('label'));if(Number(qty?.value||0)<=0){advice(qty,'数量应大于0。');warnings++;}else removeAdvice(qty?.closest('label'));if(Number(price?.value||0)<=0){advice(price,'单价应大于0。');warnings++;}else removeAdvice(price?.closest('label'));});
    return warnings;
  }
  function valueFrom(el){return String(el?.value||'').trim();}
  function filledBasic(){return Boolean(value('currency')&&value('issueDate')&&value('validUntil')&&(value('invoiceNo')||value('quoteNo')));}
  function filledCustomer(){return Boolean(value('sellerName')&&value('buyerName')&&(value('buyerContact')||value('buyerEmail')||value('buyerPhone')));}
  function filledProducts(){return meaningfulRows().some(row=>valueFrom(row.querySelector('.i-name'))&&Number(row.querySelector('.i-qty')?.value||0)>0&&Number(row.querySelector('.i-price')?.value||0)>0);}
  function filledTerms(){return Boolean(value('paymentTerms')&&value('tradeTerms')&&value('deliveryTime'));}
  function previewReady(){return $$('#piPaper .pdf-page').length>0||Boolean($('#piPaper .pdf-template'))}
  function refreshStatus(){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{
      if(!isQuotation())return syncMode();
      enhanceItems();const softWarnings=validateFields();const states={basic:filledBasic(),customer:filledCustomer(),products:filledProducts(),terms:filledTerms(),preview:previewReady()};
      let done=0;Object.entries(states).forEach(([key,ok])=>{const btn=$(`[data-fp-qf-step="${key}"]`);btn?.classList.toggle('done',ok);if(ok)done++;});
      let formal=null;try{formal=window.FlypigBOXFormalOutputGate?.check?.('pdf')||null;}catch(_){formal=null;}
      const blockers=formal?.blockers?.length||0,formalWarnings=formal?.warnings?.length||0,productCount=meaningfulRows().length;const shell=$('#fpQuotationQuickFlow');shell?.classList.toggle('fp-qf-formal-blocked',blockers>0);
      const productsBtn=$('[data-fp-qf-step="products"]');if(productsBtn){productsBtn.classList.toggle('warn',Boolean(blockers||softWarnings));productsBtn.dataset.warnings='';let meta=productsBtn.querySelector('.fp-qf-step-meta');if(!meta){meta=document.createElement('span');meta.className='fp-qf-step-meta';productsBtn.appendChild(meta);}meta.textContent=`${productCount}项`;}
      const summary=$('[data-fp-qf-summary]');if(summary){const formalText=blockers?`正式检查：还有 ${blockers} 项必须补充`:formalWarnings?`正式检查：还有 ${formalWarnings} 项建议核对`:'正式检查：关键内容已通过';const extra=softWarnings&&softWarnings!==formalWarnings?` · 填写提醒 ${softWarnings} 项`:'';summary.innerHTML=`<b>填写步骤 ${done}/5</b> · ${formalText}${extra}`;}
      const progress=$('.fp-qf-progress i');if(progress)progress.style.width=`${done/5*100}%`;
      const saveState=$('[data-fp-qf-save-state]');if(saveState){const source=field('fpLiteSaveState')?.textContent||'';saveState.textContent=source||'修改后请保存';}
      updateDefaultsState();syncPreviewDensity(false);
    },100);
  }
  function syncPreviewDensity(announce){const paper=field('piPaper');if(!paper)return;const next=isQuotation()&&quickMode&&onePage;const changed=paper.classList.contains('fp-quotation-one-page')!==next;paper.classList.toggle('fp-quotation-one-page',next);const node=$('[data-fp-qf-layout]');if(node)node.textContent=onePage?'少量内容优先一页':'标准分页';if(changed)window.FlypigBOXApp?.renderPreview?.();if(announce)notify(onePage?'已启用少量报价优先一页排版。':'已恢复标准分页。','ok');}
  function setMode(nextQuick){
    const input=field('docMode');
    if(input){
      input.value=nextQuick?'ecommerce':'b2b';
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    quickMode=Boolean(nextQuick);
    syncMode();
  }
  function syncMode(){
    const quotation=isQuotation();
    // Reuse the original header's 快速报价 / 完整报价 mode as the only mode source.
    quickMode=quotation ? value('docMode')!=='b2b' : false;
    document.body.classList.toggle('fp-quotation-quick-mode',quotation&&quickMode);
    document.body.classList.toggle('fp-qf-show-advanced',false);
    ensureShell();
    const bottom=ensureBottom();if(bottom)bottom.hidden=!quotation;
    // Never hide or rewrite any original header control/version badge in this patch.
    ensureDefaults();enhanceItems();syncPreviewDensity(false);refreshStatus();
  }
  function installObserver(){
    document.addEventListener('input',event=>{if(event.target.closest('#piForm')){const row=event.target.closest('.item-row');if(row)updateRowAmount(row);ensureItemSummary();refreshStatus();}},true);
    document.addEventListener('change',event=>{if(!event.target.closest('#piForm'))return;if(event.target.id==='docMode'||event.target.id==='documentType')syncMode();else refreshStatus();},true);
    document.addEventListener('HUIDI:document-type-changed',()=>setTimeout(syncMode,60));
    document.addEventListener('HUIDI:preview-rendered',()=>setTimeout(refreshStatus,0));
    const list=field('itemList');if(list)new MutationObserver(()=>{enhanceItems();refreshStatus();}).observe(list,{childList:true,subtree:true});
  }
  function boot(){if(!field('piForm'))return;ensureShell();ensureBottom();ensureDefaults();applyDefaults(true);syncMode();installObserver();[300,900,1800,3200].forEach(ms=>setTimeout(syncMode,ms));window.FlypigBOXQuotationQuickFlow={version:VERSION,setMode,refresh:refreshStatus,applyDefaults,saveDefaults,meaningfulRows,originalHeaderOnly:true};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
