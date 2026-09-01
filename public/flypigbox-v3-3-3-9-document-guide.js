/* HUIDI V3.3.3.9 — current-document and field-version guide.
   Targeted drawer enhancement only: no MutationObserver, no polling and no preview rebuild loop. */
(()=>{
  'use strict';
  const VERSION='V3.3.5.0';
  const $=id=>document.getElementById(id);
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const FIELD_LABELS={
    showOrigin:'原产国',showCustomerPo:'客户 PO',showQuote:'报价编号',showMoq:'最小起订量（MOQ）',
    showSalesperson:'业务员',showProductImage:'产品图片',showHsCode:'海关编码（HS Code）',
    showDiscount:'折扣',showFreight:'运费与附加费用',showTax:'税费（VAT）',showAmountWords:'金额大写',
    showLogistics:'物流信息',showPayment:'收款账户与付款信息',showTerms:'交易条款',
    showRemarks:'补充备注',showSignature:'签名与公章'
  };

  const GUIDES={
    quotation:{
      label:'报价单',short:'报价阶段',
      purpose:'用于客户下单前确认产品价格、最小起订量、报价有效期、供货条件和预计交期。它是价格与供货条件文件，不是付款凭证或清关文件。',
      defaultFields:['报价编号、日期、有效期和币种','买卖双方基础资料','商品、规格、数量、单位、MOQ、单价和金额','已经确认的运费或附加费用','交期、贸易术语、报价条款与备注'],
      detailedAdds:['原产国、客户 PO 和业务员','产品图片、HS Code','折扣、税费和金额大写','独立物流分栏：承运人、港口、提单号、柜号、ETD/ETA 等','签名与公章'],
      hidden:['收款账户默认不显示：报价单主要用于议价和确认供货条件，不代表正式收款要求。','复杂清关字段默认不显示：未进入发货与申报阶段，避免文件过重。'],
      logistics:'报价单默认版不显示独立物流执行分栏，交期和贸易术语在交易条款中填写；切换精细版后才出现可填写的完整物流分栏。'
    },
    proforma_invoice:{
      label:'形式发票（PI）',short:'订单确认与收款阶段',
      purpose:'用于客户确认订单、付款金额、付款方式、收款账户、贸易术语和交付安排。它通常承接报价单，是收款和订单确认的重要文件。',
      defaultFields:['PI 编号、日期、有效期和币种','买卖双方基础资料','商品、数量、价格、金额和已确认费用','付款方式与收款账户','贸易术语、交期和备注','基础物流：运输方式、箱数和包装类型','签名与公章'],
      detailedAdds:['原产国、客户 PO、关联报价编号和业务员','MOQ、产品图片、HS Code','折扣、税费、金额大写','完整物流追踪：重量、体积、货代、运单、提单、柜号、封条、ETD/ETA','高级收货、通知方、账单和送货地址'],
      hidden:['空的物流和追踪字段自动隐藏：避免把尚未确定的信息输出给客户。','清关申报专用字段不是 PI 默认核心：发货时可在商业发票和装箱单中继续使用。'],
      logistics:'PI 默认版应显示已经填写并开启的基础物流；精细版用于完整运输执行信息。若完全不显示，请检查物流字段开关和是否已有内容。'
    },
    commercial_invoice:{
      label:'商业发票',short:'发货、报关与清关阶段',
      purpose:'用于出口申报、进口清关、货代交接和正式结算核对，强调商品申报价值、原产国、HS Code、运输与港口信息。',
      defaultFields:['商业发票编号、日期和币种','出口方、买方或收货方','商品、数量、单价和申报金额','原产国与 HS Code','核心运输资料：运输方式、箱数、毛重、体积、货代、运单/提单和 ETD/ETA','贸易术语、港口、声明、备注与签章'],
      detailedAdds:['客户 PO 与产品图片','运费、保险费、税费、折扣和金额大写','承运人、提单号、柜号、封条号、ETD/ETA','更多清关、申报和自定义物流字段'],
      hidden:['收款账户默认不显示：商业发票重点是申报和货物价值，不应与收款指令混在一起。','无内容字段自动隐藏：保持报关文件紧凑，降低误读风险。'],
      logistics:'物流与港口是商业发票默认核心；已填写且开启的物流内容应同时进入 PDF 与客户 Excel。'
    },
    packing_list:{
      label:'装箱单',short:'包装、仓库与货代核对阶段',
      purpose:'用于核对装了什么、多少箱、重量、体积、尺寸、唛头和运输包装，供客户、仓库、货代和海关核对。',
      defaultFields:['装箱单编号与日期','发货方与收货方','商品名称、数量和单位','箱数、包装类型、净重、毛重和总体积（CBM）','单箱尺寸、唛头和运输方式','签名与公章'],
      detailedAdds:['客户 PO 与产品图片','箱号、单箱明细和更多包装字段','承运人、提单号、柜号、封条号、ETD/ETA','自定义物流和运输标记'],
      hidden:['单价、金额、小计、折扣、税费永远不显示：装箱单不是财务文件。','付款方式和银行账户永远不显示：避免把付款资料错误交给仓库或货代。'],
      logistics:'包装、重量、体积和物流是装箱单核心字段；空内容会隐藏，但已填写信息应正常输出。'
    },
    sales_contract:{
      label:'销售合同',short:'法律约定与履约阶段',
      purpose:'用于确认买卖双方责任、商品和金额、付款、交付、贸易术语、违约责任及签署内容，是双方履约依据。',
      defaultFields:['合同编号、日期和双方主体','商品、数量、价格和合同金额','付款条款与交付条款','贸易术语、责任约定和备注','签名与公章'],
      detailedAdds:['客户 PO、关联报价编号与业务员','产品图片、折扣、费用、税费和金额大写','物流与交付补充、港口和运输计划','更多合同补充条款与签署资料'],
      hidden:['实时追踪和发货执行字段默认隐藏：合同签署时通常尚未产生，避免把临时信息固化进合同。','精细物流只在复杂订单需要时启用，已填写数据不会因切回默认版而删除。'],
      logistics:'销售合同默认版不显示独立物流执行分栏，只保留稳定交付约定；切换精细版后才出现可填写的物流计划与执行字段。'
    }
  };

  const MODE_ALLOWED={
    quotation:{
      ecommerce:['showProductImage','showQuote','showMoq','showFreight','showTerms','showRemarks'],
      b2b:['showOrigin','showCustomerPo','showQuote','showMoq','showSalesperson','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature']
    },
    proforma_invoice:{
      ecommerce:['showProductImage','showFreight','showLogistics','showPayment','showTerms','showRemarks','showSignature'],
      b2b:['showOrigin','showCustomerPo','showQuote','showMoq','showSalesperson','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature']
    },
    commercial_invoice:{
      ecommerce:['showProductImage','showOrigin','showHsCode','showLogistics','showTerms','showRemarks','showSignature'],
      b2b:['showOrigin','showCustomerPo','showProductImage','showHsCode','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showTerms','showRemarks','showSignature']
    },
    packing_list:{
      ecommerce:['showProductImage','showLogistics','showRemarks','showSignature'],
      b2b:['showCustomerPo','showProductImage','showLogistics','showRemarks','showSignature']
    },
    sales_contract:{
      ecommerce:['showProductImage','showPayment','showTerms','showRemarks','showSignature'],
      b2b:['showCustomerPo','showQuote','showSalesperson','showProductImage','showDiscount','showFreight','showTax','showAmountWords','showLogistics','showPayment','showTerms','showRemarks','showSignature']
    }
  };

  function currentType(){
    const type=new URLSearchParams(location.search).get('type')||clean($('documentType')?.value)||new URLSearchParams(location.search).get('doc')||'proforma_invoice';
    return GUIDES[type]?type:'proforma_invoice';
  }
  function currentMode(){return $('docMode')?.value==='b2b'?'b2b':'ecommerce';}
  function currentModeLabel(){return currentMode()==='b2b'?'精细版':'默认版';}
  function list(items){return `<ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;}
  function activeDisabledFields(type=currentType(),mode=currentMode()){
    const schema=window.FlypigBOXDocumentSchema;
    const allowed=schema?.modeProfile?.(type,mode)?.toggles||MODE_ALLOWED[type]?.[mode]||[];
    return allowed.filter(id=>$(id)&&!$(id).checked).map(id=>FIELD_LABELS[id]||id);
  }

  function ensureGuideButton(root){
    const actions=root?.querySelector('.fp-v3315-drawer-actions');
    if(!actions||actions.querySelector('[data-v3339-guide]'))return;
    const button=document.createElement('button');
    button.type='button';
    button.dataset.v3339Guide='1';
    button.className='fp-v3339-guide-button';
    button.innerHTML='<span>单据与版本说明</span><small>用途、默认版、精细版与隐藏原因</small>';
    actions.prepend(button);
  }

  function ensureGuidePanel(root){
    let panel=$('fpV3339DocumentGuide');
    if(panel)return panel;
    const main=root?.querySelector('.fp-v3315-drawer main');
    if(!main)return null;
    panel=document.createElement('section');
    panel.id='fpV3339DocumentGuide';
    panel.className='fp-v3339-document-guide';
    panel.hidden=true;
    main.appendChild(panel);
    return panel;
  }

  function renderGuide(){
    const root=$('fpV3315ToolsRoot');
    const panel=ensureGuidePanel(root);
    if(!root||!panel)return;
    const type=currentType(),guide=GUIDES[type],mode=currentMode();
    const disabled=activeDisabledFields(type,mode);
    panel.innerHTML=`
      <div class="fp-v3339-guide-head">
        <button type="button" data-v3339-guide-back aria-label="返回更多工具">← 返回</button>
        <div><span>${esc(guide.short)}</span><h3>${esc(guide.label)} · ${currentModeLabel()}</h3></div>
      </div>
      <div class="fp-v3339-guide-purpose"><b>这张单据用于什么？</b><p>${esc(guide.purpose)}</p></div>
      <div class="fp-v3339-guide-grid">
        <article class="fp-v3339-guide-card is-default"><div class="fp-v3339-guide-card-title"><b>默认版</b><span>日常快速做单</span></div>${list(guide.defaultFields)}</article>
        <article class="fp-v3339-guide-card is-detailed"><div class="fp-v3339-guide-card-title"><b>精细版新增</b><span>复杂订单与执行资料</span></div>${list(guide.detailedAdds)}</article>
      </div>
      <article class="fp-v3339-guide-card is-reason"><div class="fp-v3339-guide-card-title"><b>为什么有些字段会隐藏？</b><span>不是删除数据</span></div>${list(guide.hidden)}<p class="fp-v3339-logistics-rule"><b>物流规则：</b>${esc(guide.logistics)}</p></article>
      <article class="fp-v3339-guide-card is-state">
        <div class="fp-v3339-guide-card-title"><b>当前${currentModeLabel()}的字段状态</b><span>${disabled.length?`有 ${disabled.length} 项开关关闭`:'允许字段均已开启'}</span></div>
        ${disabled.length?`<p>以下字段属于当前版本允许范围，但当前开关为关闭：</p><div class="fp-v3339-field-chips">${disabled.map(label=>`<span>${esc(label)}</span>`).join('')}</div>`:'<p>空字段仍会在客户 PDF 和 Excel 中自动隐藏，填写后才输出。</p>'}
      </article>
      <div class="fp-v3339-guide-rules">
        <b>共同规则</b>
        <p>切换默认版或精细版只改变显示与输出，不会删除已填写数据。字段为空时客户文件自动隐藏；字段开关关闭时 PDF 与客户 Excel 同步隐藏；装箱单等不适用字段会强制排除。</p>
      </div>
      <div class="fp-v3339-guide-actions">
        <button type="button" data-v3339-mode="ecommerce" class="${mode==='ecommerce'?'active':''}">使用默认版</button>
        <button type="button" data-v3339-mode="b2b" class="${mode==='b2b'?'active':''}">使用精细版</button>
        <button type="button" data-v3339-open-fields>打开字段设置</button>
      </div>`;
  }

  function setDrawerTitle(title,subtitle){
    const root=$('fpV3315ToolsRoot');
    const heading=$('fpV3315DrawerTitle');
    if(heading)heading.textContent=title;
    const note=root?.querySelector('.fp-v3315-drawer>header span');
    if(note)note.textContent=subtitle;
  }

  function openGuide(){
    const root=$('fpV3315ToolsRoot');
    if(!root)return;
    root.classList.remove('fp-v3320-fields-view');
    const fields=$('fpV3318FieldSettings');if(fields)fields.hidden=true;
    ensureGuideButton(root);renderGuide();
    const panel=$('fpV3339DocumentGuide');if(panel)panel.hidden=false;
    root.classList.add('fp-v3339-guide-view');
    setDrawerTitle('单据与版本说明','了解当前单据用途、默认版与精细版的字段差异及隐藏原因。');
    const drawer=root.querySelector('.fp-v3315-drawer');if(drawer)drawer.scrollTop=0;
  }

  function closeGuide(){
    const root=$('fpV3315ToolsRoot');if(!root)return;
    root.classList.remove('fp-v3339-guide-view');
    const panel=$('fpV3339DocumentGuide');if(panel)panel.hidden=true;
    setDrawerTitle('更多工具','PDF与表格工作簿共用同一份单据数据和设置。');
  }

  function switchMode(mode){
    const target=document.querySelector(`[data-v3315-drawer-mode="${mode}"],[data-v3315-doc-mode="${mode}"],[data-doc-mode="${mode}"]`);
    if(target){target.click();setTimeout(renderGuide,80);return;}
    const select=$('docMode');
    if(select){select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(renderGuide,80);}
  }

  function openFields(){
    closeGuide();
    const button=document.querySelector('#fpV3315ToolsRoot [data-v3315-action="fields"]');
    if(button){button.click();return;}
    document.querySelector('[data-open-field-settings],#fpHeaderFieldSettingsBtn')?.click();
  }

  function enhanceDrawer(){
    const root=$('fpV3315ToolsRoot');if(!root)return false;
    ensureGuideButton(root);ensureGuidePanel(root);updateVersion();
    return true;
  }

  function updateVersion(){}

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-v3339-guide]')){event.preventDefault();openGuide();return;}
    if(event.target.closest('[data-v3339-guide-back]')){event.preventDefault();closeGuide();return;}
    const mode=event.target.closest('[data-v3339-mode]')?.dataset.v3339Mode;
    if(mode){event.preventDefault();switchMode(mode);return;}
    if(event.target.closest('[data-v3339-open-fields]')){event.preventDefault();openFields();return;}
  },true);

  // Window capture runs before the existing document-level more-menu handler.
  window.addEventListener('click',event=>{
    if(event.target.closest?.('#fpLiteMoreMenu>summary'))setTimeout(()=>{enhanceDrawer();if($('fpV3315ToolsRoot')?.classList.contains('fp-v3339-guide-view'))renderGuide();},0);
  },true);

  ['change','input'].forEach(name=>document.addEventListener(name,event=>{
    if(['documentType','docMode',...Object.keys(FIELD_LABELS)].includes(event.target?.id)&&$('fpV3315ToolsRoot')?.classList.contains('fp-v3339-guide-view')){
      setTimeout(renderGuide,name==='input'?120:40);
    }
  },true));
  document.addEventListener('HUIDI:document-type-changed',()=>{if($('fpV3315ToolsRoot')?.classList.contains('fp-v3339-guide-view'))setTimeout(renderGuide,50);});

  function boot(){
    if(!$('piForm'))return;
    updateVersion();
    setTimeout(enhanceDrawer,1100);
    setTimeout(updateVersion,2200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
