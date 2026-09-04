/* HUIDI V5.1 — authoritative document-language and document-type synchronisation. */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const TYPE={
    quotation:{label:'报价单',preview:'QUOTATION',description:'用于给客户确认产品、价格、MOQ、交期和报价有效期。'},
    proforma_invoice:{label:'形式发票（PI）',titleLabel:'形式发票',preview:'PROFORMA INVOICE',description:'用于客户确认订单、付款金额、收款信息和交易条款。'},
    commercial_invoice:{label:'商业发票',preview:'COMMERCIAL INVOICE',description:'用于正式出货、清关和财务记录。'},
    sales_contract:{label:'销售合同',preview:'SALES CONTRACT',description:'用于确认双方责任、付款、交付和争议条款。'},
    packing_list:{label:'装箱单',preview:'PACKING LIST',description:'用于说明包装、箱数、重量、体积和唛头。'}
  };
  const LANG={
    bilingual:'中英双语',zh:'中文',en:'English',es:'Español',pt:'Português (Brasil)',de:'Deutsch',fr:'Français',it:'Italiano',ru:'Русский',ar:'العربية',ja:'日本語',ko:'한국어',tr:'Türkçe',nl:'Nederlands',pl:'Polski',vi:'Tiếng Việt',id:'Bahasa Indonesia',th:'ไทย'
  };
  const DOCUMENT_TITLES={
    proforma_invoice:{en:'PROFORMA INVOICE',zh:'形式发票',es:'FACTURA PROFORMA',pt:'FATURA PROFORMA',de:'PROFORMARECHNUNG',fr:'FACTURE PRO FORMA',it:'FATTURA PROFORMA',ru:'СЧЕТ-ПРОФОРМА',ar:'فاتورة أولية',ja:'仮送り状',ko:'견적송장',tr:'PROFORMA FATURA',nl:'PROFORMAFACTUUR',pl:'FAKTURA PROFORMA',vi:'HÓA ĐƠN CHIẾU LỆ',id:'FAKTUR PROFORMA',th:'ใบแจ้งหนี้ล่วงหน้า'},
    quotation:{en:'QUOTATION',zh:'报价单',es:'COTIZACIÓN',pt:'COTAÇÃO',de:'ANGEBOT',fr:'DEVIS',it:'PREVENTIVO',ru:'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',ar:'عرض سعر',ja:'見積書',ko:'견적서',tr:'TEKLİF',nl:'OFFERTE',pl:'OFERTA',vi:'BÁO GIÁ',id:'PENAWARAN',th:'ใบเสนอราคา'},
    commercial_invoice:{en:'COMMERCIAL INVOICE',zh:'商业发票',es:'FACTURA COMERCIAL',pt:'FATURA COMERCIAL',de:'HANDELSRECHNUNG',fr:'FACTURE COMMERCIALE',it:'FATTURA COMMERCIALE',ru:'КОММЕРЧЕСКИЙ ИНВОЙС',ar:'فاتورة تجارية',ja:'商業送り状',ko:'상업송장',tr:'TİCARİ FATURA',nl:'HANDELSFACTUUR',pl:'FAKTURA HANDLOWA',vi:'HÓA ĐƠN THƯƠNG MẠI',id:'FAKTUR KOMERSIAL',th:'ใบกำกับสินค้าพาณิชย์'},
    sales_contract:{en:'SALES CONTRACT',zh:'销售合同',es:'CONTRATO DE COMPRAVENTA',pt:'CONTRATO DE COMPRA E VENDA',de:'KAUFVERTRAG',fr:'CONTRAT DE VENTE',it:'CONTRATTO DI VENDITA',ru:'ДОГОВОР КУПЛИ-ПРОДАЖИ',ar:'عقد بيع',ja:'売買契約書',ko:'매매계약서',tr:'SATIŞ SÖZLEŞMESİ',nl:'KOOPOVEREENKOMST',pl:'UMOWA SPRZEDAŻY',vi:'HỢP ĐỒNG MUA BÁN',id:'KONTRAK PENJUALAN',th:'สัญญาซื้อขาย'},
    packing_list:{en:'PACKING LIST',zh:'装箱单',es:'LISTA DE EMPAQUE',pt:'LISTA DE EMBALAGEM',de:'PACKLISTE',fr:'LISTE DE COLISAGE',it:'LISTA DI IMBALLAGGIO',ru:'УПАКОВОЧНЫЙ ЛИСТ',ar:'قائمة التعبئة',ja:'梱包明細書',ko:'포장 명세서',tr:'PAKETLEME LİSTESİ',nl:'PAKLIJST',pl:'LISTA PAKOWA',vi:'PHIẾU ĐÓNG GÓI',id:'DAFTAR KEMASAN',th:'รายการบรรจุภัณฑ์'}
  };
  const CORE_TRANSLATABLE=[
    ['paymentTerms','付款条款'],['deliveryTime','交期'],['portOfLoading','装运港说明'],['destinationPort','目的港说明'],['remarks','补充备注'],['sellerAddress','卖方地址'],['buyerAddress','买方地址'],['buyerCountry','买方国家'],['originCountry','原产国'],['shippingMethod','运输方式'],['packageType','包装方式'],['shippingMarks','唛头 / 物流说明'],['bankAddress','银行地址']
  ];
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim().toUpperCase();
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const isCjk=v=>/[\u3400-\u9fff]/.test(String(v||''));
  const isLatin=v=>/[A-Za-z]/.test(String(v||''));
  const allLanguageOptions=()=>Object.entries(LANG).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  const exportState=window.FlypigBOXPdfExportState||(window.FlypigBOXPdfExportState={allowCurrentPdfExport:false,approvedOnce:false,unifiedPreflight:true});
  exportState.unifiedPreflight=true;
  const DOCUMENT_FOCUS={
    quotation:{
      title:'报价单核对重点',
      intent:'先确认报价编号、价格、有效期、MOQ / 包装、交期和贸易术语。',
    },
    proforma_invoice:{
      title:'PI 核对重点',
      intent:'用于客户确认订单和付款，请重点核对金额、收款信息、交期和签字确认。',
    },
    commercial_invoice:{
      title:'商业发票核对重点',
      intent:'用于出货、清关和财务记录，请重点核对进出口方、HS Code、原产国和申报金额。',
    },
    packing_list:{
      title:'装箱单核对重点',
      intent:'重点不是价格，而是箱数、重量、体积、唛头和商品描述是否适合物流与清关。',
    },
    sales_contract:{
      title:'销售合同核对重点',
      intent:'确认双方主体、产品范围、付款、交付、质保、责任和争议处理，避免写成长篇法律模板。',
    }
  };
  let enhancingPreview=false;
  let enhancementScheduled=false;
  let applyingDocumentEnhancements=false;
  let pendingDocumentEnhancements=false;
  function getType(){const value=$('#documentType')?.value;return TYPE[value]?value:'proforma_invoice';}
  function getLang(){const value=$('#docLanguage')?.value;return Object.prototype.hasOwnProperty.call(LANG,value)?value:'bilingual';}
  function docDescription(type=getType()){return TYPE[type]?.description||'用于整理客户确认所需的单据信息。';}
  function routeDocumentType(){
    try{
      const value=new URLSearchParams(window.location.search).get('type')||new URLSearchParams(window.location.search).get('doc')||new URLSearchParams(window.location.hash.replace(/^#/,'')).get('doc');
      return TYPE[value]?value:'';
    }catch(_){return '';}
  }
  function fieldValue(id,fallback='待填写'){
    const value=$('#'+id)?.value?.trim();
    return value||fallback;
  }
  function compact(value,max=88){
    const text=String(value||'').replace(/\s+/g,' ').trim();
    return text.length>max?`${text.slice(0,max-1)}…`:text;
  }
  function hasBankInfo(){
    return ['bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress'].some(id=>String($('#'+id)?.value||'').trim());
  }
  function itemCountText(){
    const count=document.querySelectorAll('.item-row').length||0;
    return count?`${count} 行商品明细`:'待添加商品';
  }
  function focusRows(type=getType()){
    const docNo=fieldValue('invoiceNo');
    const date=fieldValue('issueDate');
    const valid=fieldValue('validUntil');
    const currency=fieldValue('currency','USD');
    const incoterms=fieldValue('tradeTerms','待填写 Incoterms');
    const payment=fieldValue('paymentTerms','待填写付款条款');
    const delivery=fieldValue('deliveryTime','待填写交期');
    const moq=fieldValue('moq','待填写 MOQ');
    const packaging=fieldValue('packageType','待填写包装方式');
    const seller=fieldValue('sellerName','待填写卖方');
    const buyer=fieldValue('buyerName','待填写买方');
    const origin=fieldValue('originCountry','待填写原产国');
    const shipping=fieldValue('shippingMethod','待填写运输方式');
    const carton=fieldValue('packageCount','待填写箱数');
    const nw=fieldValue('netWeight','待填写净重');
    const gw=fieldValue('grossWeight','待填写毛重');
    const cbm=fieldValue('cbm','待填写 CBM');
    const marks=fieldValue('shippingMarks','待填写唛头');
    if(type==='quotation')return [
      ['Quotation No.',docNo],['Quotation Date',date],['Valid Until',valid],['Currency / Incoterms',`${currency} / ${incoterms}`],['Payment Terms',payment],['Lead Time',delivery],['MOQ / Packaging',`${moq} / ${packaging}`],['Total Amount','请核对商品小计、附加费用和总计']
    ];
    if(type==='commercial_invoice')return [
      ['Invoice No.',docNo],['Invoice Date',date],['Exporter / Importer',`${seller} / ${buyer}`],['HS Code','需要清关时请在商品行开启并填写 HS Code'],['Country of Origin',origin],['Shipping Method',shipping],['Declared Value','金额表作为申报金额依据，请人工核对']
    ];
    if(type==='packing_list')return [
      ['Packing List No.',docNo],['Packing Date',date],['Carton Count',carton],['N.W. / G.W.',`${nw} KG / ${gw} KG`],['Package Size / CBM',`${packaging} / ${cbm} m³`],['Shipping Mark',marks],['Price Display','装箱单默认不突出价格，重点核对包装和物流数据']
    ];
    if(type==='sales_contract')return [
      ['Contract No.',docNo],['Buyer / Seller',`${buyer} / ${seller}`],['Product Scope',itemCountText()],['Payment Terms',payment],['Delivery Terms',`${incoterms} · ${delivery}`],['Warranty / Liability',fieldValue('remarks','可在备注中补充质保、责任和争议处理')],['Signature','建议保留双方确认签字 / 盖章区']
    ];
    return [
      ['PI No.',docNo],['PI Date',date],['Seller / Buyer',`${seller} / ${buyer}`],['Payment Amount','请核对商品明细、费用和总金额'],['Payment Terms',payment],['Bank Info',hasBankInfo()?'已填写收款信息，请逐项核对':'Bank details to be confirmed by seller. Do not use unverified payment information.'],['Delivery Time',delivery],['Signature / Confirmation','建议保留签字 / 盖章确认区']
    ];
  }
  function statusEl(){return $('#fp-editor-status');}
  function pdfComponentsReady(){return typeof window.html2canvas==='function'&&window.jspdf&&typeof window.jspdf.jsPDF==='function';}
  function allowCurrentExport(){return exportState.allowCurrentPdfExport===true;}
  function feeTranslationWarnings(){try{return typeof window.FlypigBOXFeeTranslationIssues==='function'?window.FlypigBOXFeeTranslationIssues():[];}catch(_){return [];}}
  function reviewWarnings(){
    const reviewed=$('#translationReviewed');
    return reviewed&&!reviewed.checked?['尚未勾选 翻译内容人工核对提示；导出前请人工复核译文、金额、账户与客户信息。']:[];
  }
  function exportWarnings(result=verify()){
    return [...result.issues.map(item=>`业务内容待翻译：${item}`),...feeTranslationWarnings().map(item=>`费用说明待翻译：${item}`),...reviewWarnings()];
  }
  function scrollToTranslateArea(){
    const target=$('#translateAllBtn')||$('#headerTranslateBtn')||$('.api-card')||$('#translationReviewed');
    target?.scrollIntoView?.({behavior:'smooth',block:'center'});
    try{window.FlypigBOXApp?.setStatus?.('已定位到翻译辅助区域。翻译暂不可用时，仍可返回导出核对并选择“继续导出当前版本”。','');}catch(_){ }
  }
  function triggerCurrentPdfExport(){
    exportState.allowCurrentPdfExport=true;
    exportState.approvedOnce=true;
    const button=$('#exportPdfBtn')||$('#headerExportPdfBtn');
    if(button)button.click();
    window.setTimeout(()=>{exportState.allowCurrentPdfExport=false;},1200);
  }
  function sourceState(){try{return window.FlypigBOXApp?.formState?.(false)||{};}catch(_){return {};}}
  function hasTargetVersion(key,value,target){
    const record=sourceState()?.translationVersions?.[key];
    return Boolean(record && String(record.source||'').trim()===String(value||'').trim() && String(record?.variants?.[target]||'').trim());
  }
  function alreadySafeForTarget(value,target){
    const text=String(value||'').trim();
    if(!text || target==='zh')return true;
    if(target==='en')return isLatin(text)&&!isCjk(text);
    return false;
  }
  function translationIssues(){
    const language=getLang();
    if(language==='zh')return [];
    const target=language==='bilingual'?'en':language;
    const missing=[];
    CORE_TRANSLATABLE.forEach(([id,label])=>{
      const value=$('#'+id)?.value?.trim()||'';
      if(!value)return;
      if(hasTargetVersion(id,value,target)||alreadySafeForTarget(value,target))return;
      missing.push(label);
    });
    document.querySelectorAll('.item-row').forEach((row,index)=>{
      const itemKey=row.dataset.itemKey||'';
      [['.i-name','商品名称','name'],['.i-spec','商品规格','spec']].forEach(([selector,label,part])=>{
        const value=$(selector,row)?.value?.trim()||'';
        const key=`item:${itemKey}:${part}`;
        if(!value || hasTargetVersion(key,value,target)||alreadySafeForTarget(value,target))return;
        missing.push(`第 ${index+1} 行${label}`);
      });
    });
    return [...new Set(missing)];
  }
  function verify(){
    const type=getType(), target=TYPE[type]?.preview||'';
    const title=clean($('.doc-hero h2')?.textContent);
    // A localized title is valid when it was rendered by the document engine for the requested type.
    const paper=$('#piPaper');
    const paperType=paper?.dataset?.fpDocumentKind||paper?.dataset?.fpDocumentType||'';
    const typeOk=paperType===type && !!title;
    const issues=translationIssues();
    return {typeOk,issues,title,target,type,language:getLang()};
  }
  function statusText(result){
    const lang=LANG[result.language]||result.language;
    if(!result.typeOk)return {klass:'warn',text:`预览待同步：当前单据为${TYPE[result.type].label}，请等待版式重新渲染。`};
    if(result.issues.length){
      const visible=result.issues.slice(0,3).join('、');
      const rest=result.issues.length>3?`等 ${result.issues.length} 项`:'';
      return {klass:'warn',text:`${lang}待生成：${visible}${rest}。可先使用翻译辅助或人工补齐；也可在核对弹窗中继续导出当前版本。`};
    }
    return {klass:'ok',text:`PDF 预览已同步 · ${TYPE[result.type].label} · ${lang}`};
  }
  function renderStatus(){
    const result=verify(),el=statusEl();
    const desc=$('#fp-document-desc');
    if(desc)desc.textContent=docDescription(result.type);
    if(!el)return result;
    const next=statusText(result);
    el.textContent=next.text;el.className='state '+next.klass;
    return result;
  }
  function syncBrandingDocumentType(){/* RC16.12: PDF style is independent from document type. */}
  function forcePaperDocumentType(type=getType()){
    const paper=$('#piPaper');
    if(!paper)return;
    const safe=TYPE[type]?type:'proforma_invoice';
    if(paper.dataset.fpDocumentType!==safe)paper.dataset.fpDocumentType=safe;
    if(paper.dataset.fpDocumentKind!==safe)paper.dataset.fpDocumentKind=safe;
    const title=$('.doc-hero h2',paper);
    const expected=TYPE[safe]?.preview||'PROFORMA INVOICE';
    const zhTitle=TYPE[safe]?.titleLabel||TYPE[safe]?.label||expected;
    if(title){
      const lang=getLang();
      const localized=DOCUMENT_TITLES[safe]?.[lang]||expected;
      const wanted=lang==='bilingual'?`${expected} / ${zhTitle}`:localized;
      if(clean(title.textContent||'')===clean(wanted))return;
      title.textContent=wanted;
    }
  }
  function syncBridgeContext(){
    const bridge=$('#fp-doc-context');
    if(!bridge)return;
    const type=getType();
    const label=$('b',bridge);
    const nextLabel=TYPE[type].label;
    if(label&&label.textContent!==nextLabel)label.textContent=nextLabel;
    const back=$('a',bridge);
    if(back){
      if(back.textContent!=='返回单据中心')back.textContent='返回单据中心';
      if(back.getAttribute('href')!=='./workspace.html?view=documents')back.setAttribute('href','./workspace.html?view=documents');
    }
  }
  function renderDocumentFocusCard(){
    const context=$('.fp-editor-context');
    if(!context)return;
    let card=$('#fp-document-focus');
    if(!card){
      card=document.createElement('section');
      card.id='fp-document-focus';
      card.className='fp-document-focus';
      context.insertAdjacentElement('afterend',card);
    }
    const type=getType();
    const config=DOCUMENT_FOCUS[type]||DOCUMENT_FOCUS.proforma_invoice;
    const rows=focusRows(type).slice(0,8);
    const html=`<div class="fp-document-focus-copy"><p class="eyebrow">Document focus</p><h3>${escapeHTML(config.title)}</h3><p>${escapeHTML(config.intent)}</p></div><div class="fp-document-focus-grid">${rows.map(([label,value])=>`<span><b>${escapeHTML(label)}</b><em>${escapeHTML(compact(value,72))}</em></span>`).join('')}</div>`;
    const signature=JSON.stringify([type,config.title,config.intent,rows]);
    if(card.dataset.fpFocusSig===signature)return;
    card.dataset.fpFocusSig=signature;
    card.innerHTML=html;
  }
  function normalizePdfProductMedia(paper){
    paper.querySelectorAll('.products .no-image').forEach(node=>{
      if(node.textContent.trim()!=='待补图 / No image')node.textContent='待补图 / No image';
    });
    paper.querySelectorAll('.products img.img').forEach(img=>{
      if(img.complete&&img.naturalWidth===0){
        const holder=document.createElement('span');
        holder.className='fp-pdf-image-placeholder';
        holder.textContent='\u56fe\u7247\u52a0\u8f7d\u5931\u8d25';
        img.replaceWith(holder);
        return;
      }
      if(img.dataset.fpImageGuard==='1')return;
      img.dataset.fpImageGuard='1';
      img.addEventListener('error',()=>{
        const holder=document.createElement('span');
        holder.className='fp-pdf-image-placeholder';
        holder.textContent='图片加载失败';
        img.replaceWith(holder);
      },{once:true});
    });
  }
  function removePdfDocumentSummary(paper){
    if(!paper)return;
    paper.querySelectorAll('.fp-pdf-doc-summary').forEach(node=>node.remove());
  }
  function renderPdfDocumentSummary(){
    const paper=$('#piPaper');
    if(!paper)return;
    const type=getType();
    syncBrandingDocumentType(type);
    forcePaperDocumentType(type);
    enhancingPreview=true;
    try{
      if(paper.dataset.fpDocumentType!==type)paper.dataset.fpDocumentType=type;
      if(paper.dataset.fpDocumentKind!==type)paper.dataset.fpDocumentKind=type;
      removePdfDocumentSummary(paper);
      normalizePdfProductMedia(paper);
      window.FlypigBOXDocumentGate?.syncPreviewWatermark?.();
    }finally{
      window.setTimeout(()=>{enhancingPreview=false;},0);
    }
  }
  function applyDocumentEnhancements(){
    if(applyingDocumentEnhancements){pendingDocumentEnhancements=true;return;}
    applyingDocumentEnhancements=true;
    try{
      renderDocumentFocusCard();
      renderPdfDocumentSummary();
    }finally{
      applyingDocumentEnhancements=false;
      if(pendingDocumentEnhancements){
        pendingDocumentEnhancements=false;
        scheduleDocumentEnhancements();
      }
    }
  }
  function scheduleDocumentEnhancements(){
    if(enhancementScheduled)return;
    enhancementScheduled=true;
    requestAnimationFrame(()=>{enhancementScheduled=false;applyDocumentEnhancements();});
  }
  function renderNow(){
    try{window.FlypigBOXApp?.renderPreview?.();}catch(_){ }
    requestAnimationFrame(()=>{syncBridgeContext();renderStatus();applyDocumentEnhancements();});
  }
  function setDocumentLanguage(value,{announce=true}={}){
    const language=Object.prototype.hasOwnProperty.call(LANG,value)?value:'bilingual';
    const field=$('#docLanguage');
    if(!field)return;
    const changed=field.value!==language;
    field.value=language;
    const top=$('#fp-language-select');
    if(top)top.value=language;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    field.dispatchEvent(new Event('change',{bubbles:true}));
    renderNow();
    if(announce && changed){
      const issues=translationIssues();
      const languageName=LANG[language];
      const message=issues.length
        ? `已切换为${languageName}。PDF 固定字段已切换；${issues.length} 项业务内容仍需翻译或人工确认。`
        : `已切换为${languageName}，PDF 预览已按当前语言更新。`;
      try{window.FlypigBOXApp?.setStatus?.(message,issues.length?'':'ok');}catch(_){ }
    }
  }
  function setDocumentType(value,{announce=true}={}){
    const type=TYPE[value]?value:'proforma_invoice';
    const field=$('#documentType');
    if(field)field.value=type;
    syncBrandingDocumentType(type);
    try{window.FlypigBOXApp?.applyDocumentProfile?.(type,{silent:!announce});}catch(_){ }
    try{const url=new URL(location.href);url.searchParams.set('doc',type);history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash||'#editorTop'}`);}catch(_){ }
    syncControls();
    renderNow();
    try{document.dispatchEvent(new CustomEvent('HUIDI:document-type-changed',{detail:{type,label:TYPE[type].label}}));}catch(_){ }
    if(announce)try{window.FlypigBOXApp?.setStatus?.(`已切换为“${TYPE[type].label}”标准格式；页面标题、表格预览、PDF 和导出将使用同一类型。`,'ok');}catch(_){ }
  }
  function makeBaseLanguageMirror(){
    const field=$('#docLanguage');
    const wrap=field?.closest('label[data-fp-language-control]');
    if(!field||!wrap)return;
    field.disabled=false;
    field.title='这里可以直接切换 PDF 输出语言，并会同步页面顶部快捷栏。';
    if(!$('#fp-language-mirror-note',wrap)){
      const note=document.createElement('span');note.id='fp-language-mirror-note';note.className='fp-language-mirror-note';note.textContent='与页面顶部快捷栏同步；切换后会刷新 PDF 预览。';
      wrap.appendChild(note);
    }
  }
  function contextBar(){
    if($('.fp-editor-context'))return;
    const bar=document.createElement('section');
    bar.className='fp-editor-context';
    bar.innerHTML=`<div class="fp-context-actions"><button type="button" class="fp-back fp-main-action" data-fp-back>返回单据中心</button><button type="button" class="fp-secondary fp-main-action" data-fp-save>保存草稿</button><button type="button" class="fp-secondary fp-main-action" data-fp-export>定位正式文件操作</button></div><span id="fp-document-desc" class="fp-document-desc">${docDescription()}</span><details class="fp-more-tools"><summary>更多工具</summary><div class="fp-more-tools-panel"><span class="fp-current-document-chip" id="fp-current-document-chip">当前单据：${TYPE[getType()].label} · ${LANG[getLang()]}</span><button type="button" class="fp-secondary" data-fp-translate>翻译辅助</button><button type="button" class="fp-secondary" data-fp-template>模板中心</button><button type="button" class="fp-secondary" data-fp-paper>PDF版式</button><button type="button" class="fp-secondary" data-fp-rules>数据与使用规则</button><button type="button" class="fp-secondary" data-fp-advanced>字段显示设置</button><button type="button" class="fp-secondary" data-fp-check>导出前核对</button><div class="fp-more-tools-divider" aria-hidden="true"></div><button type="button" class="fp-secondary fp-danger-tool" data-fp-clear>清空当前单据</button></div></details><span id="fp-editor-status" class="state">正在检查预览…</span>`;
    $('.site-header')?.insertAdjacentElement('afterend',bar);
    bar.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-back]'))location.href='./workspace.html?view=documents';
      if(event.target.closest('[data-fp-save]'))$('#saveDraftBtn')?.click();
      if(event.target.closest('[data-fp-export]'))($('#headerExportPdfBtn')||$('#exportPdfBtn'))?.click();
      if(event.target.closest('[data-fp-translate]'))$('#headerTranslateBtn,#translateAllBtn')?.click();
      if(event.target.closest('[data-fp-template]')){
        if(window.FlypigBOXTemplateCenter?.open){
          window.FlypigBOXTemplateCenter.open({tab:'public',category:'style'});
          try{window.FlypigBOXApp?.setStatus?.('模板中心已打开，并已筛选到 PDF 样式模板。样式只影响预览和导出视觉。','ok');}catch(_){ }
        }
        else if($('#flypigboxTemplateMount button')){
          $('#flypigboxTemplateMount button').click();
          try{window.FlypigBOXApp?.setStatus?.('模板中心已打开。可浏览公开示范模板，登录后可使用私有模板。','ok');}catch(_){ }
        }
        else try{window.FlypigBOXApp?.setStatus?.('模板中心正在加载，请稍候后重试。','');}catch(_){ }
      }
      if(event.target.closest('[data-fp-rules]'))($('#launchUseRulesBtn')||$('#footerUseRulesBtn'))?.click();
      if(event.target.closest('[data-fp-advanced]')){$('.doc-mode-card')?.classList.toggle('fp-advanced-open');$('.doc-mode-card')?.scrollIntoView({behavior:'smooth',block:'start'});}
      if(event.target.closest('[data-fp-paper]'))window.FlypigBOXApp?.openPaperLayoutDialog?.();
      if(event.target.closest('[data-fp-check]'))openCheckDialog();
      if(event.target.closest('[data-fp-clear]')){window.FlypigBOXApp?.clearCurrentDocument?.()||$('#clearDocumentBtn')?.click();}
    });
  }
  function openCheckDialog(){
    const result=verify(),lang=LANG[result.language]||result.language;
    const tradeResult=window.FlypigBOXTradeFactory?.evaluateReadiness?.()||{blockers:[],warnings:[],passes:[]};
    const formalResult=window.FlypigBOXFormalOutputGate?.check?.('pdf')||{blockers:[],warnings:[]};
    const issueKey=item=>`${String(item?.label||item?.field||'').trim()}|${String(item?.message||item?.reason||'').trim()}`;
    const uniqueIssues=items=>{const seen=new Set();return items.filter(item=>{const key=issueKey(item);if(seen.has(key))return false;seen.add(key);return true;});};
    const blockers=uniqueIssues([...(Array.isArray(tradeResult.blockers)?tradeResult.blockers:[]),...(Array.isArray(formalResult.blockers)?formalResult.blockers:[])]);
    const tradeWarnings=Array.isArray(tradeResult.warnings)?tradeResult.warnings:[];
    const formalWarnings=Array.isArray(formalResult.warnings)?formalResult.warnings:[];
    const warnings=[...new Set([...exportWarnings(result),...tradeWarnings.map(item=>`${item.label||'业务复核'}：${item.message||item.reason||''}`),...formalWarnings.map(item=>`${item.label||item.field||'正式输出复核'}：${item.message||item.reason||''}`)].filter(Boolean))];
    const languageLine=result.language==='zh'
      ? '✓ 当前为中文输出'
      : result.issues.length?`⚠ ${lang}译文待补齐：${result.issues.slice(0,5).join('、')}${result.issues.length>5?' 等':''}（可继续导出当前版本）`:`✓ ${lang}内容检查通过`;
    const itemCheckLine=result.type==='packing_list'?'✓ 已添加商品明细（请核对箱号、数量、包装、重量与体积）':'✓ 已添加商品明细（请核对数量与金额）';
    const list=[result.typeOk?'✓ 单据类型、字段显示与 PDF 预览已一致':'⚠ 单据类型与 PDF 预览尚未同步，请确认当前预览内容',$('#translationReviewed')?.checked?'✓ 已勾选 翻译内容人工核对提示':'⚠ 尚未勾选 翻译内容人工核对提示',languageLine,$('#buyerName')?.value?.trim()?'✓ 已填写买方信息':'△ 买方信息待确认',$('#itemList input')?itemCheckLine:'△ 商品明细待确认',$('#paymentTerms')?.value?.trim()?'✓ 已填写付款条款':'△ 付款条款待确认'];
    let dialog=$('#fp-check-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='fp-check-dialog';dialog.className='fp-insert-dialog';document.body.appendChild(dialog);}
    const hasWarning=!result.typeOk||warnings.length||blockers.length;
    const blockerList=blockers.length?`<div class="fp-export-blocker-note"><b>还有 ${blockers.length} 项建议补充：</b><ul>${blockers.slice(0,8).map(item=>`<li>${escapeHTML(item.label||'建议项')}：${escapeHTML(item.message||'请返回完善')}</li>`).join('')}</ul></div>`:'';
    const warningList=warnings.length?`<ul class="fp-export-warning-list">${warnings.slice(0,8).map(item=>`<li>${item}</li>`).join('')}${warnings.length>8?`<li>另有 ${warnings.length-8} 项待确认内容。</li>`:''}</ul>`:'';
    dialog.innerHTML=`<div class="inner"><header><div><p class="eyebrow">导出 PDF</p><h2>导出前确认</h2></div><button class="close" data-close-check>×</button></header><div class="fp-status-note ${hasWarning?'warn':'ok'}">请确认价格、数量、客户信息、收款信息和条款已核对。未翻译内容不会阻止导出，但正式发送前建议自行检查。</div>${blockerList}${warningList}<ul>${list.map(item=>`<li>${item}</li>`).join('')}</ul><div class="fp-clause-actions fp-export-actions"><button class="replace" data-export-current>仍然导出当前版本</button><button class="append" data-open-translate>返回检查</button><button class="copy" data-close-check>取消</button></div></div>`;
    dialog.showModal();
    dialog.onclick=event=>{
      if(event.target.closest('[data-close-check]'))dialog.close();
      if(event.target.closest('[data-open-translate]')){dialog.close();scrollToTranslateArea();}
      if(event.target.closest('[data-export-current]')){dialog.close();triggerCurrentPdfExport();}
    };
  }
  window.FlypigBOXOpenExportCheck=openCheckDialog;
  function clausesDialog(){let dialog=$('#fp-clause-dialog');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='fp-clause-dialog';dialog.className='fp-insert-dialog';document.body.appendChild(dialog);return dialog;}
  function showClauseInsert(){
    const dialog=clausesDialog();
    const clauses=[
      {name:'30% 定金 / 70% 发货前付清',text:'中文：30% T/T 定金，70% 余款于发货前付清。\nEnglish: 30% T/T deposit in advance, 70% balance before shipment.'},
      {name:'100% T/T 预付款',text:'中文：100% T/T 预付款后安排生产与发货。\nEnglish: 100% T/T payment in advance before production and shipment.'},
      {name:'信用证付款',text:'中文：付款方式：不可撤销信用证，具体条款由双方确认。\nEnglish: Payment by irrevocable L/C, subject to both parties’ confirmation.'}
    ];
    dialog.innerHTML=`<div class="inner"><header><div><p class="eyebrow">插入常用条款</p><h2>选择后将写入当前字段</h2></div><button class="close" data-close-clause>×</button></header><div class="fp-clause-target">即将写入：交易条款 → 付款方式 / 付款条款</div><p>不会自动保存到条款库，也不会改动其他字段。请在写入后继续核对。</p><div class="fp-clause-list">${clauses.map((item,index)=>`<article class="fp-clause-card"><h3>${item.name}</h3><p>${item.text}</p><div class="fp-clause-actions"><button class="replace" data-clause="${index}" data-mode="replace">替换当前内容</button><button class="append" data-clause="${index}" data-mode="append">追加到当前内容末尾</button><button class="copy" data-clause="${index}" data-mode="copy">仅复制</button></div></article>`).join('')}</div></div>`;
    dialog.showModal();
    dialog.addEventListener('click',async event=>{
      if(event.target.closest('[data-close-clause]'))return dialog.close();
      const button=event.target.closest('[data-clause]');if(!button)return;
      const text=clauses[Number(button.dataset.clause)].text.replace(/^中文：/,'').replace(/\nEnglish:/,'\n');
      const target=$('#paymentTerms');
      if(button.dataset.mode==='copy'){try{await navigator.clipboard.writeText(text);}catch(_){ }return;}
      if(target){target.value=button.dataset.mode==='append'&&target.value.trim()?`${target.value.trim()}\n${text}`:text;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));renderNow();}
      dialog.close();
    });
  }
  function simplifyPayment(){
    const section=$('[data-optional-section="showPayment"]');if(!section)return;
    const heading=$('.section-title h2',section);if(heading)heading.textContent='收款方式与账户';
    const open=$('#openPaymentTemplatesBtn');if(open)open.textContent='管理收款账户';
    const save=$('#savePaymentTemplateBtn');if(save)save.remove();
    const promo=$('.payment-promo',section);if(promo)promo.remove();
    const note=$('.section-translation-note',section);if(note)note.textContent='当前收款方式会在导出前核对通过后显示到单据；收款人、账号、SWIFT 与支付链接保持原样，不参与自动翻译。付款条款请在下方“交易条款”中填写。';
  }
  function simplifyTerms(){
    const button=$('#openCopyLibraryTermsBtn');if(!button)return;
    button.textContent='＋ 插入常用条款';
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();showClauseInsert();},true);
  }
  function simplifyHeader(){
    const history=$('#openHistoryBtn');
    if(history){history.textContent='单据中心';history.title='返回单据中心';history.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();location.href='./workspace.html?view=documents';},true);}
    const clear=$('#clearDocumentBtn');
    if(clear){let menu=$('#fp-more-menu');if(!menu){menu=document.createElement('details');menu.id='fp-more-menu';menu.className='action-menu';menu.innerHTML='<summary class="btn secondary">更多 ···</summary><div class="action-dropdown"></div>';$('#headerTranslateBtn')?.insertAdjacentElement('afterend',menu);}$('.action-dropdown',menu)?.appendChild(clear);clear.style.display='inline-flex';clear.textContent='清空当前单据';}
  }
  function syncControls(){
    const desc=$('#fp-document-desc');
    if(desc)desc.textContent=docDescription();
    const chip=$('#fp-current-document-chip');
    if(chip)chip.textContent=`当前单据：${TYPE[getType()].label} · ${LANG[getLang()]}`;
    const liteTitle=$('#fpLiteTitle');if(liteTitle)liteTitle.textContent=TYPE[getType()].label;
    syncBridgeContext();renderStatus();scheduleDocumentEnhancements();
  }
  function attachGuard(){
    document.addEventListener('click',event=>{
      const button=event.target.closest('#exportPdfBtn');if(!button)return;
      // Community Local RC9: the formal output gate is the single owner of export preflight.
      if(window.HUIDI_LOCAL_ONLY?.localOnly&&window.FlypigBOXPdfExportState?.unifiedPreflight===true)return;
      if(!pdfComponentsReady()){
        event.preventDefault();event.stopImmediatePropagation();
        if(window.FlypigBOXApp?.showPdfExportHelp)window.FlypigBOXApp.showPdfExportHelp('html2canvas 或 jsPDF 未加载');
        else window.FlypigBOXApp?.setStatus?.('PDF 导出组件未加载，请刷新页面或检查网络后重试。','error');
        return;
      }
      if(allowCurrentExport())return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openCheckDialog();
    },true);
    exportState.unifiedPreflightReady=true;
    $('#documentType')?.addEventListener('change',()=>{const type=getType();try{const url=new URL(location.href);url.searchParams.set('doc',type);history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash||'#editorTop'}`);}catch(_){ }syncControls();renderNow();try{document.dispatchEvent(new CustomEvent('HUIDI:document-type-changed',{detail:{type,label:TYPE[type].label}}));}catch(_){ }});
    $('#docLanguage')?.addEventListener('change',()=>{syncControls();});
    ['paymentTerms','deliveryTime','portOfLoading','destinationPort','remarks','sellerName','buyerName','sellerAddress','buyerAddress','buyerCountry','originCountry','moq','shippingMethod','packageCount','packageType','netWeight','grossWeight','cbm','logisticsCarrier','trackingNo','blNo','containerNo','sealNo','vesselFlight','etd','eta','packageDimensions','shippingMarks','logisticsExtraRowsJson','bankBeneficiary','bankName','bankAccount','bankSwift','bankAddress','currency','tradeTerms','invoiceNo','issueDate','validUntil'].forEach(id=>$('#'+id)?.addEventListener('input',()=>requestAnimationFrame(()=>{renderStatus();scheduleDocumentEnhancements();})));
    $('#logisticsExtraList')?.addEventListener('input',()=>requestAnimationFrame(()=>{renderStatus();scheduleDocumentEnhancements();}));
    $('#itemList')?.addEventListener('input',()=>requestAnimationFrame(()=>{renderStatus();scheduleDocumentEnhancements();}));
  }
  function observePreviewEnhancements(){
    // Preview enhancements are now driven by explicit renderPreview hooks and form events.
    // Observing #piPaper caused our own summary insertion to schedule another render loop.
    observePreviewEnhancements.disabled=true;
  }
  function emitPreviewRendered(){
    try{document.dispatchEvent(new CustomEvent('HUIDI:preview-rendered',{detail:{type:getType()}}));}catch(_){ }
  }
  function hookPreviewRender(){
    const app=window.FlypigBOXApp;
    if(!app||app.__fpPreviewEnhancementHooked||typeof app.renderPreview!=='function')return;
    const native=app.renderPreview.bind(app);
    app.renderPreview=(...args)=>{
      const result=native(...args);
      requestAnimationFrame(()=>{
        syncBridgeContext();
        renderStatus();
        scheduleDocumentEnhancements();
      });
      return result;
    };
    app.__fpPreviewEnhancementHooked=true;
  }
  function hookBrandingDecorate(){
    const branding=window.FlypigBOXBranding;
    if(!branding||branding.__fpEditorEnhancementHooked||typeof branding.decorate!=='function')return;
    const native=branding.decorate.bind(branding);
    branding.decorate=(...args)=>{
      const result=native(...args);
      forcePaperDocumentType(getType());
      scheduleDocumentEnhancements();
      return result;
    };
    branding.__fpEditorEnhancementHooked=true;
  }
  function pulseEnhancements(){
    let count=0;
    const timer=window.setInterval(()=>{
      hookBrandingDecorate();
      scheduleDocumentEnhancements();
      count+=1;
      if(count>=14)window.clearInterval(timer);
    },300);
  }
  function watchBridge(){
    if(watchBridge.observer)return;
    let pending=false;
    const observer=new MutationObserver(()=>{
      if(pending)return;
      pending=true;
      requestAnimationFrame(()=>{pending=false;syncBridgeContext();});
    });
    watchBridge.observer=observer;
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function boot(retry=0){
    if(!window.FlypigBOXApp?.renderPreview){if(retry<90)setTimeout(()=>boot(retry+1),100);return;}
    contextBar();makeBaseLanguageMirror();simplifyHeader();simplifyPayment();simplifyTerms();attachGuard();watchBridge();observePreviewEnhancements();hookPreviewRender();hookBrandingDecorate();renderNow();
    const routedType=routeDocumentType();
    if(routedType&&routedType!==getType())setDocumentType(routedType,{announce:false});
    pulseEnhancements();
    setTimeout(()=>{syncControls();renderNow();},700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot(),500));else setTimeout(()=>boot(),500);
})();

/* HUIDI V5.2 — single language state, member-AI-only UI, and structured fee items. */
(()=>{
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const LANGUAGE=Object.freeze({
    bilingual:'中英双语',zh:'中文',en:'English',es:'Español',pt:'Português (Brasil)',de:'Deutsch',fr:'Français',it:'Italiano',ru:'Русский',ar:'العربية',ja:'日本語',ko:'한국어',tr:'Türkçe',nl:'Nederlands',pl:'Polski',vi:'Tiếng Việt',id:'Bahasa Indonesia',th:'ไทย'
  });
  const FEE_TYPES=Object.freeze({
    freight:'运费', insurance:'保险费', sample:'样品费', mould:'模具费', packing:'包装费', inspection:'验货费', certification:'认证费', bank:'银行手续费', platform:'平台服务费', tax:'税费 / VAT', discount:'折扣', other:'其他费用'
  });
  const exportState=window.FlypigBOXPdfExportState||(window.FlypigBOXPdfExportState={allowCurrentPdfExport:false,approvedOnce:false,unifiedPreflight:true});
  exportState.unifiedPreflight=true;
  let patching=false;
  let pendingRefresh=false;

  const escapeHTML=(value)=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
  const toNumber=(value)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:0;
  };
  const uid=()=>`fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const currentLanguage=()=>{
    const value=$('#docLanguage')?.value;
    return Object.hasOwn(LANGUAGE,value)?value:'bilingual';
  };
  const targetLanguage=()=>currentLanguage()==='bilingual'?'en':currentLanguage();
  const isCjk=(value)=>/[\u3400-\u9fff]/.test(String(value||''));
  const isLatin=(value)=>/[A-Za-z]/.test(String(value||''));
  const sourceState=()=>{
    try{return window.FlypigBOXApp?.formState?.(false)||{};}catch(_){return {};}
  };
  const currency=()=>$('#currency')?.value||'USD';
  const formatMoney=(amount)=>{
    const n=Math.round((Number(amount)||0)*100)/100;
    try{return new Intl.NumberFormat('en-US',{style:'currency',currency:currency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}catch(_){return `${currency()} ${n.toFixed(2)}`;}
  };
  const dispatch=(element,type='input')=>element?.dispatchEvent(new Event(type,{bubbles:true}));

  function defaultFee(type='freight'){
    return {id:uid(),type,label:FEE_TYPES[type]||FEE_TYPES.other,mode:'amount',value:0,includeTotal:true,showPdf:true,note:'',internalNote:''};
  }
  function getFeeStore(){return $('#fpFeeItemsJson');}
  function parseFeeItems(){
    const input=getFeeStore();
    if(!input)return [];
    try{
      const parsed=JSON.parse(input.value||'[]');
      return Array.isArray(parsed)?parsed.filter(item=>item&&typeof item==='object').map(item=>({
        id:String(item.id||uid()),type:Object.hasOwn(FEE_TYPES,item.type)?item.type:'other',label:String(item.label??FEE_TYPES[item.type]??FEE_TYPES.other),mode:item.mode==='percent'?'percent':'amount',value:Math.max(0,toNumber(item.value)),includeTotal:item.includeTotal!==false,showPdf:item.showPdf!==false,note:String(item.note||''),internalNote:String(item.internalNote||'')
      })):[];
    }catch(_){return [];}
  }
  function migrateLegacyFees(){
    const existing=parseFeeItems();
    if(existing.length)return existing;
    const rows=[];
    const extra=toNumber($('#extraFeeAmount')?.value);
    const tax=toNumber($('#taxAmount')?.value);
    const discount=toNumber($('#discountValue')?.value);
    const discountMode=$('#discountType')?.value==='percent'?'percent':'amount';
    if(extra>0)rows.push({...defaultFee('freight'),label:$('#extraFeeName')?.value?.trim()||FEE_TYPES.freight,value:extra});
    if(tax>0)rows.push({...defaultFee('tax'),value:tax});
    if(discount>0)rows.push({...defaultFee('discount'),mode:discountMode,value:discount});
    return rows;
  }
  function setFeeItems(items,{sync=true,render=true}={}){
    const input=getFeeStore();
    if(!input)return;
    input.value=JSON.stringify(items);
    if(sync)syncLegacyFeeFields(items);
    if(render)renderFeeComposer();
    scheduleRefresh();
  }
  function ensureFeeState(){
    const input=getFeeStore();
    if(!input)return;
    let items=parseFeeItems();
    if(!items.length){items=migrateLegacyFees();input.value=JSON.stringify(items);}
  }
  function productSubtotal(){
    return $$('.item-row').reduce((sum,row)=>{
      const name=String($('.i-name',row)?.value||'').trim();
      const qty=toNumber($('.i-qty',row)?.value);
      const price=toNumber($('.i-price',row)?.value);
      return name&&qty>0&&price>0?sum+qty*price:sum;
    },0);
  }
  function feeAmount(item,subtotal=productSubtotal()){
    return item.mode==='percent'?subtotal*Math.max(0,toNumber(item.value))/100:Math.max(0,toNumber(item.value));
  }
  function feeTotals(items=parseFeeItems(),subtotal=productSubtotal()){
    const totals={subtotal,positive:0,tax:0,discount:0,total:subtotal,excluded:[]};
    for(const item of items){
      const amount=feeAmount(item,subtotal);
      if(!amount)continue;
      if(!item.includeTotal){totals.excluded.push({...item,amount});continue;}
      if(item.type==='discount')totals.discount+=amount;
      else if(item.type==='tax')totals.tax+=amount;
      else totals.positive+=amount;
    }
    totals.total=Math.max(0,subtotal+totals.positive+totals.tax-totals.discount);
    return totals;
  }
  function setValueIfChanged(id,value){
    const field=$('#'+id);
    if(!field)return;
    const normalized=String(value);
    if(field.value===normalized)return;
    field.value=normalized;
    dispatch(field,'input');
    dispatch(field,'change');
  }
  function setCheckedIfChanged(id,value){
    const field=$('#'+id);
    if(field?.disabled)return;
    if(!field||field.checked===Boolean(value))return;
    field.checked=Boolean(value);
    dispatch(field,'change');
  }
  function feeVisibilityToggleId(type){
    if(type==='discount')return 'showDiscount';
    if(type==='tax')return 'showTax';
    return 'showFreight';
  }
  function feeVisibleInCurrentDocument(type){
    const field=$('#'+feeVisibilityToggleId(type));
    return Boolean(field&&!field.disabled&&field.checked);
  }
  function syncLegacyFeeFields(items=parseFeeItems()){
    const t=feeTotals(items);
    const visible=items.filter(item=>item.showPdf&&feeAmount(item)>0);
    const positiveVisible=visible.some(item=>!['tax','discount'].includes(item.type));
    const taxVisible=visible.some(item=>item.type==='tax');
    const discountVisible=visible.some(item=>item.type==='discount');
    setValueIfChanged('extraFeeName',visible.find(item=>!['tax','discount'].includes(item.type))?.label||FEE_TYPES.other);
    setValueIfChanged('extraFeeAmount',t.positive.toFixed(2));
    setValueIfChanged('taxAmount',t.tax.toFixed(2));
    setValueIfChanged('discountType','amount');
    setValueIfChanged('discountValue',t.discount.toFixed(2));
    setCheckedIfChanged('showFreight',positiveVisible);
    setCheckedIfChanged('showTax',taxVisible);
    setCheckedIfChanged('showDiscount',discountVisible);
  }
  function getTranslation(key,source){
    const state=sourceState();
    const record=state.translationVersions?.[key];
    const target=targetLanguage();
    const translated=String(record?.source===String(source||'').trim()?record?.variants?.[target]||'':'').trim();
    if(!translated)return '';
    return currentLanguage()==='bilingual'&&translated!==source?`${source}\n${translated}`:translated;
  }
  function feeDisplayText(item,field='label'){
    const source=String(item[field]||'').trim();
    if(!source)return '';
    const key=`fee:${item.id}:${field}`;
    return getTranslation(key,source)||source;
  }
  function canUseSourceWithoutTranslation(source){
    const language=currentLanguage();
    const text=String(source||'').trim();
    if(!text||language==='zh')return true;
    if(targetLanguage()==='en')return isLatin(text)&&!isCjk(text);
    return false;
  }
  function feeTranslationIssues(){
    const language=currentLanguage();
    if(language==='zh')return [];
    const state=sourceState();
    const missing=[];
    parseFeeItems().forEach((item,index)=>{
      [['label','费用名称'],['note','客户可见说明']].forEach(([field,label])=>{
        const source=String(item[field]||'').trim();
        if(!source||canUseSourceWithoutTranslation(source))return;
        const record=state.translationVersions?.[`fee:${item.id}:${field}`];
        const translated=String(record?.source===source?record?.variants?.[targetLanguage()]||'':'').trim();
        if(!translated)missing.push(`第 ${index+1} 项${label}`);
      });
    });
    return missing;
  }
  window.FlypigBOXFeeTranslationIssues=feeTranslationIssues;
  function collectTranslationFields(){
    const fields=[];
    parseFeeItems().forEach(item=>{
      [['label','费用名称'],['note','客户可见说明']].forEach(([field])=>{
        const text=String(item[field]||'').trim();
        if(!text)return;
        fields.push({id:`fee__${item.id}__${field}`,key:`fee:${item.id}:${field}`,text});
      });
    });
    return fields;
  }
  window.FlypigBOXFees={collectTranslationFields,items:()=>parseFeeItems(),totals:()=>feeTotals()};

  function feeRow(item,index){
    const categories=Object.entries(FEE_TYPES).map(([value,label])=>`<option value="${value}" ${item.type===value?'selected':''}>${escapeHTML(label)}</option>`).join('');
    return `<article class="fp-fee-row" data-fee-id="${escapeHTML(item.id)}">
      <div class="fp-fee-row-head"><strong>费用 ${index+1}</strong><button type="button" class="fp-fee-remove" data-fp-fee-remove="${escapeHTML(item.id)}">移除</button></div>
      <div class="fp-fee-grid">
        <label>类型<select data-fp-fee-field="type">${categories}</select></label>
        <label>客户可见名称<input data-fp-fee-field="label" value="${escapeHTML(item.label)}" placeholder="例如：海运费"></label>
        <label>计费方式<select data-fp-fee-field="mode"><option value="amount" ${item.mode==='amount'?'selected':''}>固定金额</option><option value="percent" ${item.mode==='percent'?'selected':''}>按商品小计比例</option></select></label>
        <label>${item.mode==='percent'?'比例（%）':'金额'}<input data-fp-fee-field="value" type="number" min="0" step="0.01" value="${escapeHTML(item.value)}"></label>
        <label class="fp-fee-check"><input data-fp-fee-field="includeTotal" type="checkbox" ${item.includeTotal?'checked':''}> 计入单据总额</label>
        <label class="fp-fee-check"><input data-fp-fee-field="showPdf" type="checkbox" ${item.showPdf?'checked':''}> 显示在 PDF</label>
        <label class="span-2">客户可见说明（可选）<input data-fp-fee-field="note" value="${escapeHTML(item.note)}" placeholder="例如：海运费用以最终订舱确认金额为准"></label>
        <label class="span-2">内部备注（不进入 PDF）<input data-fp-fee-field="internalNote" value="${escapeHTML(item.internalNote)}" placeholder="例如：供应商报价、核算依据或审批备注"></label>
      </div>
      <p class="fp-fee-row-total">本项金额：<b>${formatMoney(feeAmount(item))}</b>${item.includeTotal?'，已计入总额':'，不计入总额'}${item.showPdf?'，会显示在 PDF':'，仅内部保留'}。</p>
    </article>`;
  }
  function composerTemplate(items){
    const totals=feeTotals(items);
    return `<section class="fp-fee-composer" id="fp-fee-composer">
      <div class="fp-fee-title"><div><p class="eyebrow">金额与费用</p><h3>附加费用与折扣</h3><p>费用、税费和折扣逐项记录；每项可选择是否计入总额、是否显示在 PDF。装箱单默认不显示金额与费用。</p></div><button type="button" class="btn secondary" id="fp-add-fee">＋ 添加费用</button></div>
      <div class="fp-fee-summary"><span>商品小计 <b>${formatMoney(totals.subtotal)}</b></span><span>附加费用 <b>${formatMoney(totals.positive)}</b></span><span>税费 <b>${formatMoney(totals.tax)}</b></span><span>折扣 <b>- ${formatMoney(totals.discount)}</b></span><span class="grand">预计总额 <b>${formatMoney(totals.total)}</b></span></div>
      <div class="fp-fee-list">${items.length?items.map(feeRow).join(''):'<p class="fp-fee-empty">暂无附加费用。需要时点击“添加费用”。</p>'}</div>
      <p class="fp-fee-footnote">金额、币种、商品小计和总额由同一数据计算。对外 PDF 只显示勾选“显示在 PDF”的项目；未勾选“计入单据总额”的项目会标为参考项，不会改变总额。</p>
    </section>`;
  }
  function renderFeeComposer(){
    const host=$('#fp-fee-composer-host');
    if(!host)return;
    const before=$('#fp-fee-composer');
    if(before)before.remove();
    host.insertAdjacentHTML('beforeend',composerTemplate(parseFeeItems()));
  }
  function ensureComposer(){
    ['extraFeeName','extraFeeAmount','taxAmount'].forEach(id=>$('#'+id)?.closest('label')?.classList.add('fp-legacy-fee-field'));
    $('#discountControl')?.classList.add('fp-legacy-fee-field');
    if(!$('#fp-fee-composer-host')){
      const legacy=$('.summary-inputs');
      if(!legacy)return;
      const host=document.createElement('div');
      host.id='fp-fee-composer-host';
      legacy.insertAdjacentElement('afterend',host);
    }
    ensureFeeState();
    syncLegacyFeeFields(parseFeeItems());
    renderFeeComposer();
  }
  function updateFeeFromRow(row,{render=true}={}){
    const id=row?.dataset.feeId;
    if(!id)return;
    const items=parseFeeItems();
    const index=items.findIndex(item=>item.id===id);
    if(index<0)return;
    const item=items[index];
    $$('[data-fp-fee-field]',row).forEach(input=>{
      const field=input.dataset.fpFeeField;
      item[field]=input.type==='checkbox'?input.checked:input.value;
    });
    item.type=Object.hasOwn(FEE_TYPES,item.type)?item.type:'other';
    if(!String(item.label||'').trim())item.label=FEE_TYPES[item.type];
    item.mode=item.mode==='percent'?'percent':'amount';
    item.value=Math.max(0,toNumber(item.value));
    setFeeItems(items,{render});
  }
  function attachFeeEvents(){
    document.addEventListener('click',event=>{
      if(event.target.closest('#fp-add-fee')){
        const items=parseFeeItems();items.push(defaultFee('freight'));setFeeItems(items);return;
      }
      const remove=event.target.closest('[data-fp-fee-remove]');
      if(remove){const id=remove.dataset.fpFeeRemove;setFeeItems(parseFeeItems().filter(item=>item.id!==id));}
    });
    document.addEventListener('input',event=>{
      const field=event.target.closest('[data-fp-fee-field]');if(field)updateFeeFromRow(field.closest('.fp-fee-row'),{render:false});
    });
    document.addEventListener('change',event=>{
      const field=event.target.closest('[data-fp-fee-field]');if(field)updateFeeFromRow(field.closest('.fp-fee-row'),{render:true});
    });
  }
  function fixedPdfLabel(key){
    const labels={
      subtotal:{zh:'商品小计',en:'Subtotal'},
      total:{zh:'总计',en:'TOTAL AMOUNT'},
      excluded:{zh:'参考费用',en:'Not included in total'}
    };
    const item=labels[key]||labels.subtotal;
    const lang=currentLanguage();
    const i18n=window.HUIDIDocI18n;
    if(i18n?.text)return i18n.text(item.zh,item.en,lang);
    if(lang==='zh')return item.zh;
    if(lang==='bilingual')return `${item.zh} / ${item.en}`;
    return item.en;
  }

  function renderFeeRowsInPdf(){
    // RC16.11: editor.html owns the canonical fee rows before pagination.
    // Never reshape the money table after pagination has already been measured.
    if(document.body.dataset.huidiStablePagination==='1')return;
    if(patching)return;
    const paper=$('#piPaper');
    const type=$('#documentType')?.value||'proforma_invoice';
    const moneyTable=$('.money-table',paper);
    if(!paper||type==='packing_list'||!moneyTable)return;
    const items=parseFeeItems();
    const subtotal=productSubtotal();
    const visible=items.filter(item=>feeVisibleInCurrentDocument(item.type)&&item.showPdf&&feeAmount(item,subtotal)>0);
    const totals=feeTotals(visible,subtotal);
    if(totals.subtotal<=0&&visible.length===0){
      moneyTable.remove();
      $$('.fp-pdf-fee-excluded',paper).forEach(node=>node.remove());
      return;
    }
    if(totals.subtotal<=0){
      moneyTable.remove();
      $$('.fp-pdf-fee-excluded',paper).forEach(node=>node.remove());
      return;
    }
    const rows=[`<tr><th>${fixedPdfLabel('subtotal')}:</th><td>${formatMoney(totals.subtotal)}</td></tr>`];
    visible.filter(item=>item.includeTotal).forEach(item=>{
      const amount=feeAmount(item,totals.subtotal);
      const negative=item.type==='discount';
      const name=feeDisplayText(item,'label');
      const note=feeDisplayText(item,'note');
      const mode=item.mode==='percent'?` (${Number(item.value)||0}%)`:'';
      rows.push(`<tr class="fp-pdf-fee-row ${negative?'is-discount':''}"><th>${escapeHTML(name).replace(/\n/g,'<br>')}${mode}${note?`<small>${escapeHTML(note).replace(/\n/g,'<br>')}</small>`:''}</th><td>${negative?'- ':''}${formatMoney(amount)}</td></tr>`);
    });
    rows.push(`<tr class="total"><th>${fixedPdfLabel('total')}:</th><td style="color:#be2637">${formatMoney(totals.total)}</td></tr>`);
    const rowsHtml=rows.join('');
    const excludedSignature=visible.filter(item=>!item.includeTotal).map(item=>`${feeDisplayText(item,'label')}::${formatMoney(feeAmount(item,totals.subtotal))}`).join('|');
    const signature=JSON.stringify([type,rowsHtml,excludedSignature]);
    if(moneyTable.dataset.fpFeeSig===signature)return;
    patching=true;
    const tbody=$('tbody',moneyTable);
    if(tbody)tbody.innerHTML=rows.join('');
    $$('.fp-pdf-fee-excluded',paper).forEach(node=>node.remove());
    const excluded=visible.filter(item=>!item.includeTotal);
    if(excluded.length){
      const note=document.createElement('p');
      note.className='fp-pdf-fee-excluded';
      note.innerHTML=`<b>${fixedPdfLabel('excluded')}:</b> ${excluded.map(item=>`${escapeHTML(feeDisplayText(item,'label'))} ${formatMoney(feeAmount(item,totals.subtotal))}`).join(' · ')}`;
      moneyTable.insertAdjacentElement('afterend',note);
    }
    moneyTable.dataset.fpFeeSig=signature;
    patching=false;
  }
  function coreTranslationIssues(){
    const language=currentLanguage();
    if(language==='zh')return [];
    const state=sourceState();
    const staticFields=[
      ['paymentTerms','付款条款'],['deliveryTime','交期'],['portOfLoading','装运港说明'],['destinationPort','目的港说明'],['remarks','补充备注'],['sellerAddress','卖方地址'],['buyerAddress','收货地址'],['buyerCountry','客户国家'],['originCountry','原产国'],['shippingMethod','运输方式'],['packageType','包装方式'],['shippingMarks','唛头 / 物流说明'],['bankAddress','银行地址']
    ];
    const issues=[];
    const has=(key,text)=>{
      const source=String(text||'').trim();if(!source||canUseSourceWithoutTranslation(source))return;
      const rec=state.translationVersions?.[key];
      const done=String(rec?.source===source?rec?.variants?.[targetLanguage()]||'':'').trim();
      if(!done)issues.push(key);
    };
    staticFields.forEach(([id,label])=>has(label,$('#'+id)?.value));
    $$('.item-row').forEach((row,index)=>{
      const itemKey=row.dataset.itemKey||'';
      has(`第 ${index+1} 行商品名称`,$('.i-name',row)?.value);
      has(`第 ${index+1} 行商品规格`,$('.i-spec',row)?.value);
    });
    return issues;
  }
  function translationSummary(){
    const issues=[...coreTranslationIssues(),...feeTranslationIssues()];
    return {issues,total:issues.length,language:currentLanguage()};
  }
  function updateTranslationDashboard(){
    const dash=$('#fp-translation-dashboard');
    const top=$('#fp-editor-status');
    const summary=translationSummary();
    const name=LANGUAGE[summary.language]||summary.language;
    const line=summary.total?`${name}待生成 / 待确认：${summary.issues.slice(0,3).join('、')}${summary.total>3?` 等 ${summary.total} 项`:''}`:`PDF 预览已同步 · ${name}`;
    if(dash){
      dash.innerHTML=`<div class="fp-translation-state ${summary.total?'warn':'ok'}"><strong>${summary.total?`还有 ${summary.total} 项内容待翻译`:'语言、表单与 PDF 已同步'}</strong><span>${summary.total?'点击“生成 / 更新翻译”后，AI 会按当前单据输出语言处理可翻译内容。':'固定字段、业务文本与 PDF 预览当前使用同一个单据语言状态。'}</span></div><div class="fp-translation-actions"><button type="button" class="btn warning" data-fp-run-member-ai>生成 / 更新翻译</button><button type="button" class="btn secondary" data-fp-translation-status>查看翻译范围</button></div>`;
    }
    if(top){top.textContent=line;top.className=`state ${summary.total?'warn':'ok'}`;}
  }
  function openTranslationStatus(){
    const summary=translationSummary();
    let dialog=$('#fp-language-status-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='fp-language-status-dialog';dialog.className='fp-insert-dialog';document.body.appendChild(dialog);}
    const list=summary.total?summary.issues.map(issue=>`<li>${escapeHTML(issue)}</li>`).join(''):'<li>当前没有待翻译的客户可见内容。</li>';
    dialog.innerHTML=`<div class="inner"><header><div><p class="eyebrow">翻译范围</p><h2>${escapeHTML(LANGUAGE[summary.language]||summary.language)}输出检查</h2></div><button class="close" data-fp-close-language-status>×</button></header><p>会翻译：商品名称与规格、付款条款、交期、物流说明、备注、客户可见的附加费用名称和说明。</p><p>保持原样：公司名称、联系人、品牌、SKU、型号、HS Code、数量、金额、币种、银行账号、SWIFT、支付链接、订单编号。</p><ul>${list}</ul><div class="fp-clause-actions"><button class="replace" data-fp-run-member-ai>生成 / 更新翻译</button><button class="append" data-fp-close-language-status>继续编辑</button></div></div>`;
    dialog.showModal();
  }
  function runMemberAi(){
    const mode=$('#translationMode');if(mode)mode.value='hosted';
    const native=$('#translateAllBtn');
    if(!native){window.FlypigBOXApp?.setStatus?.('翻译辅助入口未加载，请刷新页面后重试。','error');return;}
    native.click();
    let count=0;const timer=setInterval(()=>{updateTranslationDashboard();renderFeeRowsInPdf();if(++count>90)clearInterval(timer);},500);
  }
  function lockToMemberAi(){
    const detail=$('.api-card details');
    const summary=$('.api-card details summary');
    if(summary)summary.textContent='翻译与语言状态';
    const mode=$('#translationMode');if(mode)mode.value='hosted';
    const own=$('#useOwnApi');if(own){own.checked=false;own.disabled=true;}
    $('#ownApiSettings')?.classList.add('is-hidden');
    $('.own-api-toggle')?.setAttribute('aria-hidden','true');
    if(detail&&!$('#fp-translation-dashboard')){
      const dashboard=document.createElement('div');dashboard.id='fp-translation-dashboard';dashboard.className='fp-translation-dashboard';
      $('#hostedAiPanel')?.insertAdjacentElement('afterend',dashboard);
    }
    const hosted=$('#hostedAiPanel');
    if(hosted){hosted.innerHTML='<strong>HUIDI 翻译辅助</strong><p>单据语言是唯一控制源。选择一种语言后，翻译结果、表单译文、PDF 预览和导出前核对都跟随该语言；高级连接设置默认隐藏。</p>';}
    updateTranslationDashboard();
  }
  function attachLanguageEvents(){
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-run-member-ai]')){event.preventDefault();$('#fp-language-status-dialog')?.close();runMemberAi();}
      if(event.target.closest('[data-fp-translation-status]')){event.preventDefault();openTranslationStatus();}
      if(event.target.closest('[data-fp-close-language-status]'))$('#fp-language-status-dialog')?.close();
    });
    ['docLanguage','documentType'].forEach(id=>$('#'+id)?.addEventListener('change',()=>scheduleRefresh()));
    $('#piForm')?.addEventListener('input',()=>scheduleRefresh());
    $('#piForm')?.addEventListener('change',()=>scheduleRefresh());
    ['#exportPdfBtn'].forEach(selector=>$(selector)?.addEventListener('click',event=>{
      const pdfReady=typeof window.html2canvas==='function'&&window.jspdf&&typeof window.jspdf.jsPDF==='function';
      if(!pdfReady){
        event.preventDefault();event.stopImmediatePropagation();
        if(window.FlypigBOXApp?.showPdfExportHelp)window.FlypigBOXApp.showPdfExportHelp('html2canvas 或 jsPDF 未加载');
        else window.FlypigBOXApp?.setStatus?.('PDF 导出组件未加载，请刷新页面或检查网络后重试。','error');
        return;
      }
      if(exportState.allowCurrentPdfExport===true)return;
      if(window.HUIDI_LOCAL_ONLY?.localOnly && window.FlypigBOXPdfExportState?.unifiedPreflight===true)return;
      const issues=feeTranslationIssues();
      if(!issues.length)return;
      event.preventDefault();event.stopImmediatePropagation();
      window.FlypigBOXApp?.setStatus?.(`存在 ${issues.length} 项费用说明待翻译。你可以先去翻译，也可以在核对弹窗中继续导出当前版本。`,'');
      if(typeof window.FlypigBOXOpenExportCheck==='function')window.FlypigBOXOpenExportCheck();
      else openTranslationStatus();
    },true));
  }
  function scheduleRefresh(){
    if(pendingRefresh)return;
    pendingRefresh=true;
    requestAnimationFrame(()=>{pendingRefresh=false;renderFeeRowsInPdf();updateTranslationDashboard();});
  }
  function observePreview(){
    if(observePreview.bound)return;
    document.addEventListener('HUIDI:preview-rendered',()=>{if(!patching)scheduleRefresh();});
    observePreview.bound=true;
  }
  function clearFeesAfterDocumentClear(){
    $('#clearDocumentBtn')?.addEventListener('click',()=>setTimeout(()=>setFeeItems([]),0));
    document.addEventListener('HUIDI:current-document-cleared',()=>setFeeItems([]));
  }
  function boot(attempt=0){
    if(!window.FlypigBOXApp?.renderPreview||!$('#piForm')){if(attempt<100)setTimeout(()=>boot(attempt+1),100);return;}
    ensureComposer();
    $('#piForm')?.dispatchEvent(new Event('change',{bubbles:true}));
    attachFeeEvents();lockToMemberAi();attachLanguageEvents();observePreview();clearFeesAfterDocumentClear();scheduleRefresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot(),650));else setTimeout(()=>boot(),650);
})();

/* HUIDI V3.3.6.24-R1.3A.4 — print parity and module-safe pagination post processor */
(()=>{'use strict';
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const ATOMIC_SECTIONS=[
    '.pdf-contract-terms',
    '.pdf-terms-section',
    '.pdf-payment-section',
    '.pdf-logistics-section',
    '.pdf-commercial-declaration',
    '.pdf-packing-summary'
  ];
  let reflowing=false;

  function visible(node){
    if(!node||node.hidden||node.classList?.contains('is-hidden'))return false;
    const style=window.getComputedStyle?.(node);
    return !(style&&(style.display==='none'||style.visibility==='hidden'));
  }
  function templateOf(page){return page?.querySelector?.(':scope > .pdf-page-body > .pdf-template')||page?.querySelector?.('.pdf-template')||null;}
  function bodyOf(page){return page?.querySelector?.(':scope > .pdf-page-body')||page?.querySelector?.('.pdf-page-body')||null;}
  function usedHeight(body){
    if(!body)return 0;
    const rect=body.getBoundingClientRect();
    const template=body.querySelector(':scope > .pdf-template');
    if(!template)return 0;
    let bottom=0;
    [template,...template.querySelectorAll('*')].forEach(node=>{
      if(!visible(node))return;
      const next=node.getBoundingClientRect?.();
      if(next&&(next.width||next.height))bottom=Math.max(bottom,next.bottom-rect.top);
    });
    return Math.max(0,bottom,template.scrollHeight||0,template.offsetHeight||0);
  }
  function overflows(body,tolerance=1){
    if(!body)return false;
    const reserve=Math.max(36,Math.round((body.clientHeight||0)*.035));
    return usedHeight(body)>Math.max(0,(body.clientHeight||0)-reserve)+tolerance;
  }
  function brandOnly(node){return Boolean(node?.matches?.('[data-fp-brand-logo],[data-fp-brand-header],[data-fp-brand-footer]'))}
  function templateHasContent(template){
    return qsa(':scope > *',template).some(node=>{
      if(brandOnly(node)||!visible(node))return false;
      return Boolean(node.textContent?.trim()||node.querySelector?.('img,table'));
    });
  }
  function copyPageShell(reference,templateClass){
    const page=document.createElement(reference?.tagName?.toLowerCase?.()||'section');
    page.className=reference?.className||'pdf-page';
    const body=document.createElement('div');body.className='pdf-page-body';
    const template=document.createElement('div');template.className=templateClass||'pdf-template';
    body.appendChild(template);page.appendChild(body);
    return {page,body,template};
  }
  function fitsBlank(shell,reference,templateClass,node){
    const probe=copyPageShell(reference,templateClass);
    probe.page.style.visibility='hidden';
    probe.page.style.pointerEvents='none';
    probe.template.appendChild(node.cloneNode(true));
    shell.appendChild(probe.page);
    const fits=!overflows(probe.body);
    probe.page.remove();
    return fits;
  }
  function mergeAtomicFragments(shell,reference,templateClass){
    ATOMIC_SECTIONS.forEach(selector=>{
      const fragments=qsa(selector,shell);
      if(fragments.length<2)return;
      const combined=fragments[0].cloneNode(true);
      const targetBody=combined.querySelector('tbody');
      if(!targetBody)return;
      fragments.slice(1).forEach(fragment=>{
        qsa('tbody > tr',fragment).forEach(row=>targetBody.appendChild(row.cloneNode(true)));
      });
      qsa('.doc-section',combined).forEach(title=>delete title.dataset.continued);
      if(!fitsBlank(shell,reference,templateClass,combined))return;
      fragments[0].replaceWith(combined);
      fragments.slice(1).forEach(fragment=>fragment.remove());
    });
  }
  function markEmptyBrandChrome(paper){
    qsa('[data-fp-brand-header],[data-fp-brand-footer]',paper).forEach(node=>{
      const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
      const empty=!text||text==='公司页头'||text==='品牌中心页脚';
      node.dataset.fpEmptyBrand=empty?'1':'0';
    });
  }
  function setSimpleContractDensity(paper,shell){
    const type=paper.dataset.fpDocumentType||paper.dataset.fpDocumentKind||document.getElementById('documentType')?.value||'';
    const mode=paper.dataset.fpPaperMode||'';
    const products=qsa('.pdf-contract-goods tbody tr',shell).length;
    const terms=qsa('.pdf-contract-terms tbody tr,.pdf-terms-section tbody tr',shell).length;
    const payments=qsa('.pdf-payment-section tbody tr',shell).length;
    const logistics=qsa('.pdf-logistics-section tbody tr',shell).length;
    const simple=type==='sales_contract'&&mode==='portrait'&&products>0&&products<=3&&terms<=5&&payments<=5&&logistics<=4;
    paper.classList.toggle('fp-simple-contract',simple);
  }
  function reorderContractTotals(nodes,paper){
    const type=paper.dataset.fpDocumentType||paper.dataset.fpDocumentKind||document.getElementById('documentType')?.value||'';
    if(type!=='sales_contract')return nodes;
    const result=[...nodes];
    const money=result.find(node=>node.matches?.('.pdf-contract-total,.money-table'));
    if(!money)return result;
    const amountWords=result.find(node=>node.matches?.('.pdf-amount-words'));
    const moving=[money,...(amountWords&&amountWords!==money?[amountWords]:[])];
    moving.forEach(node=>{const index=result.indexOf(node);if(index>=0)result.splice(index,1);});
    let goodsIndex=-1;
    result.forEach((node,index)=>{if(node.matches?.('.pdf-contract-goods-section'))goodsIndex=index;});
    if(goodsIndex<0){moving.forEach(node=>result.push(node));return result;}
    result.splice(goodsIndex+1,0,...moving);
    return result;
  }
  function rebuildPages(paper,shell){
    const originalPages=qsa(':scope > .pdf-page',shell);
    if(!originalPages.length)return;
    const reference=originalPages[0];
    const templateClass=templateOf(reference)?.className||'pdf-template';
    mergeAtomicFragments(shell,reference,templateClass);
    setSimpleContractDensity(paper,shell);

    let chunks=[];
    qsa(':scope > .pdf-page',shell).forEach(page=>{
      const template=templateOf(page);
      if(template)chunks.push(...qsa(':scope > *',template));
    });
    chunks=reorderContractTotals(chunks,paper);
    chunks.forEach(node=>node.remove());
    shell.innerHTML='';

    let pageNo=0,current=null;
    const newPage=()=>{
      pageNo+=1;
      current=copyPageShell(reference,templateClass);
      current.page.dataset.pageNo=String(pageNo);
      shell.appendChild(current.page);
      return current;
    };
    newPage();
    chunks.forEach(chunk=>{
      current.template.appendChild(chunk);
      if(brandOnly(chunk)||!overflows(current.body))return;
      chunk.remove();
      if(templateHasContent(current.template))newPage();
      current.template.appendChild(chunk);
    });

    qsa(':scope > .pdf-page',shell).forEach(page=>{if(!templateHasContent(templateOf(page)))page.remove();});
    const pages=qsa(':scope > .pdf-page',shell);
    pages.forEach((page,index)=>{
      page.dataset.pageNo=String(index+1);
      page.dataset.pageTotal=String(pages.length);
      const body=bodyOf(page);
      page.dataset.fpContentHeight=String(Math.round(usedHeight(body)));
      page.dataset.fpUsableHeight=String(Math.round(body?.clientHeight||0));
      page.dataset.fpUtilization=String(Math.round((usedHeight(body)/Math.max(1,body?.clientHeight||1))*100));
    });
    shell.dataset.paginated='1';
    validate(shell);
  }
  function validate(shell){
    const previous=window.__fpLastPaginationReport||{};
    const pages=qsa(':scope > .pdf-page',shell);
    const actualRows=qsa('table tbody tr',shell).length;
    const expectedRows=Number.isFinite(Number(previous.expectedRows))?Number(previous.expectedRows):actualRows;
    const overflowPages=[];
    pages.forEach((page,index)=>{if(overflows(bodyOf(page),1))overflowPages.push(index+1);});
    const selectors={
      logistics:'.pdf-logistics-section',payment:'.pdf-payment-section',terms:'.pdf-terms-section,.pdf-contract-terms',
      signature:'.signature-zone,.pdf-contract-signatures',products:'.pdf-products-section,.pdf-packing-goods,.products'
    };
    const missingModules=Array.isArray(previous.missingModules)?previous.missingModules.filter(key=>!shell.querySelector(selectors[key]||'.__never__')):[];
    const report={valid:overflowPages.length===0&&actualRows===expectedRows&&missingModules.length===0,expectedRows,actualRows,overflowPages,missingModules,pageCount:pages.length};
    shell.dataset.fpPaginationValid=report.valid?'1':'0';
    shell.dataset.fpPaginationReport=JSON.stringify(report);
    window.__fpLastPaginationReport=report;
  }
  function applyClosure(){
    if(reflowing)return;
    const paper=document.getElementById('piPaper');
    const shell=paper?.querySelector(':scope > .pdf-document');
    if(!paper||!shell||!shell.querySelector('.pdf-page'))return;
    reflowing=true;
    try{
      markEmptyBrandChrome(paper);
      // RC16.9: editor.html paginateCurrentPreview() is the single pagination authority.
      // Rebuilding an already-paginated document here used a different reserve and
      // treated previously split table fragments as atomic chunks, which could turn
      // a stable 2-page preview into 4-6 pages after mode/style/type switches.
      if(window.HUIDILayoutPolicy?.version==='1.2.0-RC16.10'||document.body.dataset.huidiStablePagination==='1'){
        paper.dataset.fpR13a4='validation-only';
        return;
      }
      rebuildPages(paper,shell);
      paper.dataset.fpR13a4='1';
    }catch(error){
      console.error('HUIDI R1.3A.4 pagination closure failed',error);
    }finally{reflowing=false;}
  }
  function install(){
    document.addEventListener('HUIDI:preview-rendered',applyClosure);
    document.addEventListener('HUIDI:document-type-changed',()=>setTimeout(applyClosure,0));
    applyClosure();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1250));
  else setTimeout(install,1250);
})();

/* HUIDI V3.3.6.24-R1.3A.6 — document layout governance markers.
   Explicit preview/type/mode events only; no observer or timer loop. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').trim();
  function snapshot(){try{return window.FlypigBOXApp?.formState?.(false)||{fields:{},items:[]}}catch(_){return{fields:{},items:[]}}}
  function meaningfulItems(state){return(state.items||[]).filter(item=>clean(item?.name||item?.sku||item?.spec)||Number(item?.qty)>0||Number(item?.price)>0||clean(item?.cartonNo));}
  function recommendedPaper(type,mode,count,imageOn,columns){
    if(type==='packing_list')return'landscape';
    if(type==='sales_contract')return count>12?'landscape':'portrait';
    if(count>=10||columns>=11||(imageOn&&count>=6))return'landscape';
    return window.FlypigBOXDocumentSchema?.paperRecommendation?.(type,mode)||'portrait';
  }
  function syncLayoutGovernance(){
    const paper=$('piPaper');if(!paper)return;
    const state=snapshot(),fields=state.fields||{},type=fields.documentType||$('documentType')?.value||'proforma_invoice',mode=fields.docMode||$('docMode')?.value||'ecommerce';
    const items=meaningfulItems(state),count=items.length,schema=window.FlypigBOXDocumentSchema,columns=schema?.modeProfile?.(type,mode)?.productColumns?.length||0;
    const imageOn=Boolean(fields.showProductImage||$('showProductImage')?.checked)&&Boolean(schema?.toggleAllowed?.('showProductImage',type,mode));
    const recommendation=recommendedPaper(type,mode,count,imageOn,columns),current=fields.paperOrientation||$('paperOrientation')?.value||'auto';
    paper.dataset.fpR13a6='1';paper.dataset.fpDocumentType=type;paper.dataset.fpDocumentMode=mode;paper.dataset.fpItemCount=String(count);paper.dataset.fpProductColumns=String(columns);paper.dataset.fpRecommendedPaper=recommendation;paper.dataset.fpSelectedPaper=current;
    paper.classList.toggle('fp-r13a6-dense-items',count>=7);
    paper.classList.toggle('fp-r13a6-very-dense-items',count>=12);
    paper.classList.toggle('fp-r13a6-product-images',imageOn);
    paper.classList.toggle('fp-r13a6-portrait-recommended',recommendation==='portrait');
    paper.classList.toggle('fp-r13a6-landscape-recommended',recommendation==='landscape');
    document.body.dataset.fpRecommendedPaper=recommendation;
    document.body.dataset.fpDocumentType=type;
    document.body.dataset.fpDocumentMode=mode;
  }
  function install(){
    ['HUIDI:preview-rendered','HUIDI:document-type-changed','HUIDI:trade-scenario-applied','HUIDI:apply-template'].forEach(name=>document.addEventListener(name,syncLayoutGovernance));
    $('piForm')?.addEventListener('change',event=>{if(['documentType','docMode','paperOrientation','showProductImage'].includes(event.target?.id)||event.target?.closest?.('.item-row'))syncLayoutGovernance();},true);
    syncLayoutGovernance();
    window.FlypigBOXDocumentGovernance=Object.freeze({sync:syncLayoutGovernance,recommendedPaper:()=>document.body.dataset.fpRecommendedPaper||'portrait'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
