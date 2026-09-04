/* HUIDI V3.3.6.24 — Smart Capture Operational UX.
   Guarantees that the capture center renders, restores the AI-access card,
   and turns recognition/review into one visible, testable workflow. */
(()=>{'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.19.2',RECENT_KEY='flypigbox_smart_capture_recent_v2';
  if(window.FlypigBOXSmartCaptureUX?.version===VERSION)return;
  const $=(s,r=document)=>r?.querySelector?.(s)||null,$$=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
  const clean=v=>String(v??'').trim(),esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const LANGUAGES={auto:'自动识别',es:'Español',pt:'Português (Brasil)',de:'Deutsch',fr:'Français',it:'Italiano',ru:'Русский',ar:'العربية',ja:'日本語',ko:'한국어',tr:'Türkçe',nl:'Nederlands',pl:'Polski',vi:'Tiếng Việt',id:'Bahasa Indonesia',th:'ไทย',bilingual:'中英双语',zh:'中文',en:'English'};
  const DOC_TYPES={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'};
  const SAMPLE=`Buyer Company: Northstar Trading GmbH\nContact: Anna Keller\nEmail: anna@northstar.example\nWhatsApp: +49 151 23456789\nCountry: Germany\n\nProduct: Stainless Steel Bottle\nSKU: SB-750\nSpecification: 750ml, matte black\nQuantity: 500 PCS\nUnit Price: USD 6.80\nMOQ: 300 PCS\nIncoterm: FOB Ningbo\nDelivery Time: 25 days after deposit\nPayment Terms: 30% T/T deposit, 70% before shipment\nPlease prepare an English quotation.`;
  let hostObserver=null,bodyObserver=null,reviewObserver=null,centerTimer=0,decorating=false,lastRecorded='';

  function api(){return window.FlypigBOXSmartCapture||null;}
  function gateway(){return window.FlypigBOXAIClient?.getState?.()||null;}
  function localPreview(){return Boolean(window.FlypigBOXEnvironment?.isLocalPreview||location.protocol==='file:'||new URLSearchParams(location.search).get('localPreview')==='1');}
  function currentState(){return api()?.getState?.()||{};}
  function toast(message,error=false){window.FlypigBOXWorkspaceAPI?.toast?.(message,error);if(!window.FlypigBOXWorkspaceAPI?.toast)console[error?'error':'log'](message);}
  function readRecent(){try{const rows=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(rows)?rows.slice(0,5):[];}catch(_){return[];}}
  function writeRecent(row){try{const rows=readRecent().filter(x=>x.id!==row.id);rows.unshift(row);localStorage.setItem(RECENT_KEY,JSON.stringify(rows.slice(0,5)));}catch(_){}}
  function formatTime(value){const d=new Date(value||Date.now());return Number.isNaN(d.getTime())?'刚刚':new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);}
  function statusSnapshot(){const snap=gateway();if(snap?.phase==='ready')return{kind:'online',label:'增强整理可用',detail:'复杂资料会自动使用增强整理',ai:true};if(snap?.phase==='running')return{kind:'running',label:'正在整理资料',detail:snap.message||'正在整理资料',ai:true};if(snap?.phase==='checking')return{kind:'checking',label:'正在确认可用功能',detail:snap.message||'正在确认账号能力',ai:false};return{kind:'local',label:'基础整理可用',detail:'常见文本和表格可直接整理；复杂资料按可用能力处理',ai:false};}
  function sourceLabel(state){if(state.sourceName)return`已读取：${state.sourceName}`;if(clean(state.sourceText))return`已保存草稿 · ${clean(state.sourceText).length} 字符`;return'支持 TXT、CSV、TSV、XLSX；也可直接拖入文件';}
  function recentMarkup(){const rows=readRecent();if(!rows.length)return'<p class="fp-sc24-empty">完成一次识别后，这里会显示最近记录。</p>';return rows.map(row=>`<button type="button" class="fp-sc24-recent-item" data-fp-sc24-recent-id="${esc(row.id)}"><span><b>${esc(row.title||'未命名资料')}</b><small>${esc(row.source||'粘贴文本')} · ${esc(formatTime(row.at))}</small></span><em>${row.products||0} 个商品</em></button>`).join('');}
  function centerMarkup(state){const status=statusSnapshot();return`<div class="fp-sc24-shell">
    <header class="fp-sc24-hero"><div><p>智能录入</p><h2>把客户、商品、询盘或旧单据放进来</h2><span>先识别和拆分，再由你核对；确认后才能归档或生成单据。</span></div><div class="fp-sc24-status" data-kind="${status.kind}"><i></i><span><b data-fp-sc24-status>${status.label}</b><small data-fp-sc24-status-detail>${status.detail}</small></span></div></header>
    <div class="fp-sc24-grid"><form id="fp-smart-capture-form" class="fp-sc24-composer">
      <div class="fp-sc24-form-head"><div><b>1. 输入或上传资料</b><span>适用于邮件、WhatsApp、客户资料、商品表、报价单、PI等内容</span></div><div><button type="button" data-fp-sc24-sample>使用示例</button><button type="button" data-fp-sc24-paste>粘贴剪贴板</button></div></div>
      <label class="fp-sc24-textarea"><textarea name="input" data-fp-sc-input placeholder="粘贴客户公司、联系人、产品、型号、数量、价格、币种、交期、付款条件、目的地等资料……">${esc(state.sourceText||'')}</textarea><small>不会自动覆盖客户库、商品库或正式单据；识别结果必须人工确认。</small></label>
      <div class="fp-sc24-tools"><label class="fp-sc24-drop" data-fp-sc24-drop><input type="file" data-fp-sc-file accept=".txt,.csv,.tsv,.xlsx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><b>拖入文件或点击选择</b><small data-fp-sc-file-label>${esc(sourceLabel(state))}</small></label><label class="fp-sc24-language"><span>单据输出语言</span><select name="language">${Object.entries(LANGUAGES).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select><small>原文和输出语言分开保存</small></label></div>
      <div class="fp-sc24-actions"><button type="button" class="btn ghost" data-fp-sc-clear>清空</button><button type="submit" class="btn primary" data-fp-sc-recognize><b>识别并核对</b><small>立即进入人工核对</small></button></div>
    </form><aside class="fp-sc24-side">
      <section class="fp-sc24-ready"><h3>当前真正可用</h3><ul><li><i>✓</i><span><b>文本与表格识别</b><small>TXT、CSV、TSV、XLSX</small></span></li><li><i>✓</i><span><b>分类核对</b><small>客户、商品、业务、单据字段</small></span></li><li><i>✓</i><span><b>单据带入</b><small>报价单、PI、发票、装箱单、合同</small></span></li><li><i>✓</i><span><b>错误值保护</b><small>未知数量和价格保持空白</small></span></li></ul></section>
      <section class="fp-sc24-recent"><div><h3>最近识别</h3><small>仅显示本浏览器最近记录</small></div><div data-fp-sc24-recent>${recentMarkup()}</div></section>
    </aside></div>
    <section class="fp-sc24-ai-access" data-kind="${status.ai?'online':'waiting'}"><div class="fp-sc24-ai-icon">智</div><div><p>增强处理</p><h3>${status.ai?'账号已开放增强处理':'等待开放申请'}</h3><span>${status.ai?'可处理复杂表格、混合语言、非标准询盘和语义翻译；结果仍需人工核对。':'基础结构识别已经可用。复杂多语言、非标准表格和精准翻译需要相应服务与账号权限，当前没有伪装成已开通。'}</span></div><div class="fp-sc24-ai-actions"><button type="button" class="btn ghost" data-fp-sc24-recheck>重新检查</button>${status.ai?'':'<button type="button" class="btn secondary" data-fp-sc24-apply>申请增强处理</button>'}</div></section>
    <details class="fp-sc24-boundary"><summary>识别、保存和导出的边界</summary><div><span>识别：生成候选字段</span><span>核对：用户可见并修改全部字段</span><span>保存：登录后写入对应资料库并记录时间</span><span>生成：进入现有单据编辑器预览后再保存导出</span></div></details>
  </div>`;}

  function normalizeNav(){const button=$('#nav [data-view="ai"]');if(!button)return;const em=$('em',button);let text=[...button.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(!text){text=document.createTextNode('');button.insertBefore(text,button.firstChild);}const wanted=`智能录入${em?' ':''}`;if(text.nodeValue!==wanted)text.nodeValue=wanted;button.title='智能识别客户、商品、询盘和单据资料';}
  function ensureCenter(){
    const center=$('#fp-smart-capture-center');
    if(center){center.hidden=true;center.setAttribute('aria-hidden','true');}
    const taskPanel=$('#fp-founder-os-task-panel');
    return taskPanel||null;
  }
  function syncStatus(){}
  function refreshRecent(){const root=$('[data-fp-sc24-recent]');if(root)root.innerHTML=recentMarkup();}
  function recordResult(){const result=currentState().result;if(!result?.source?.received_at||result.source.received_at===lastRecorded)return;lastRecorded=result.source.received_at;const customer=result.customer||{},products=Array.isArray(result.products)?result.products:[];writeRecent({id:result.source.received_at,title:customer.company_name||customer.contact_name||result.source.name||DOC_TYPES[result.document?.type]||'识别资料',source:result.source.name||'粘贴文本',products:products.length,at:result.source.received_at});refreshRecent();}

  const normalizeName=value=>clean(value).toLowerCase().replace(/[\s\-_./\\()（）]+/g,'');
  const genericName=value=>/^(?:产品|商品|货物|item|product|待确认商品|未命名商品|订单|正式单据|订单或正式单据|单据|客户资料|商品资料|业务资料)$/i.test(clean(value).replace(/^[、,，;；:：\-\s]+/,''));
  function similarity(a,b){
    a=normalizeName(a);b=normalizeName(b);
    if(!a||!b)return 0;
    if(a===b)return 1;
    if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);
    const grams=text=>{const set=new Set();for(let i=0;i<text.length-1;i++)set.add(text.slice(i,i+2));return set;};
    const x=grams(a),y=grams(b),both=[...x].filter(v=>y.has(v)).length;
    return both/Math.max(1,new Set([...x,...y]).size);
  }
  function workspaceData(){return window.FlypigBOXWorkspaceAPI?.getState?.()||{};}
  function bestCustomerMatch(candidate){
    const rows=workspaceData().customers||[];
    const email=clean(candidate.email).toLowerCase();
    const phone=clean(candidate.phone).replace(/\D/g,'');
    const company=clean(candidate.company_name);
    let best=null,score=0;
    rows.forEach(row=>{
      let current=0;
      if(email&&clean(row.email).toLowerCase()===email)current=1;
      else if(phone&&clean(row.phone).replace(/\D/g,'')===phone)current=1;
      else current=similarity(company,row.company_name||row.name);
      if(current>score){score=current;best=row;}
    });
    return score>=.82?{row:best,score}:null;
  }
  function bestProductMatch(candidate){
    if(genericName(candidate.name))return null;
    const rows=workspaceData().products||[];
    const sku=clean(candidate.sku).toLowerCase(),name=clean(candidate.name);
    let best=null,score=0;
    rows.forEach(row=>{
      let current=0;
      if(sku&&clean(row.sku).toLowerCase()===sku)current=1;
      else current=similarity(name,row.name);
      if(current>score){score=current;best=row;}
    });
    return score>=.86?{row:best,score}:null;
  }
  function addMatchBadge(select,label){
    const host=select?.closest('label');if(!host)return;
    let badge=host.querySelector('.fp-sc24-match-badge');
    if(!badge){badge=document.createElement('small');badge.className='fp-sc24-match-badge';host.appendChild(badge);}
    badge.textContent=label;
  }
  function autoMatch(dialog){
    const result=currentState().result||{};
    const customerMatch=bestCustomerMatch(result.customer||{});
    const customerSelect=$('[name="customer_existing_id"]',dialog);
    if(customerMatch&&customerSelect&&[...customerSelect.options].some(o=>String(o.value)===String(customerMatch.row.id))){
      customerSelect.value=customerMatch.row.id;
      const mode=$('[name="customer_mode"]',dialog);if(mode)mode.value='fill_empty';
      addMatchBadge(customerSelect,'已匹配已有客户');
    }
    (result.products||[]).forEach((product,index)=>{
      const match=bestProductMatch(product);
      const select=$(`[name="product_existing_${index}"]`,dialog);
      if(match&&select&&[...select.options].some(o=>String(o.value)===String(match.row.id))){
        select.value=match.row.id;
        const mode=$(`[name="product_mode_${index}"]`,dialog);if(mode)mode.value='fill_empty';
        addMatchBadge(select,'已匹配已有商品');
      }
    });
  }
  function reviewFacts(dialog){
    const result=currentState().result||{},form=$('#fp-smart-capture-review-form'),review=api()?.reviewFromForm?.(form)||result;
    const customer=review.customer||{},products=review.products||[],doc=review.document||{};
    const readiness=api()?.readiness?.(review)||{recognized:0,total:5,score:0,blocking:[],recommended:[]};
    const confirmed=[],check=[],missing=[...readiness.blocking];
    if(customer.company_name||customer.contact_name)confirmed.push(`客户：${customer.company_name||customer.contact_name}`);
    products.forEach((product,index)=>{
      const prefix=products.length>1?`商品${index+1}`:'商品';
      if(product.name&&!genericName(product.name))confirmed.push(`${prefix}：${product.name}`);
      if(product.quantity!==null&&product.quantity!==undefined)confirmed.push(`${prefix}数量：${product.quantity} ${product.unit||''}`.trim());
      if(doc.type==='packing_list'){}
      else if(product.suggested_price!==null&&product.suggested_price!==undefined)confirmed.push(`${prefix}单价：${product.suggested_price} ${product.currency||''}`.trim());
    });
    const total=products.reduce((sum,p)=>{
      if(p.quantity===null||p.quantity===undefined||p.suggested_price===null||p.suggested_price===undefined)return sum;
      return sum+Number(p.quantity)*Number(p.suggested_price);
    },0);
    if(total>0)confirmed.push(`预计金额：${Number(total.toFixed(4))} ${doc.fields?.currency||customer.currency||products[0]?.currency||'USD'}`);
    confirmed.push(`建议单据：${DOC_TYPES[doc.type]||'报价单'}`);
    readiness.recommended.forEach(row=>check.push(`${row}可后续补充`));
    products.forEach((product,index)=>{
      const prefix=products.length>1?`商品${index+1}`:'商品';
      if(!product.existingId&&product.name&&!genericName(product.name))check.push(`${prefix}尚未关联商品库`);
    });
    return{
      confirmed:[...new Set(confirmed)],
      check:[...new Set(check)],
      missing:[...new Set(missing)],
      readiness
    };
  }
  function quickList(title,kind,rows){
    return`<article data-kind="${kind}"><header><b>${title}</b><em>${rows.length}</em></header>${rows.length?`<ul>${rows.map(row=>`<li>${esc(row)}</li>`).join('')}</ul>`:'<p>暂无</p>'}</article>`;
  }
  function optionRows(rows,valueLabel){
    return`<option value="">请选择</option>${rows.map(row=>`<option value="${esc(row.id)}">${esc(valueLabel(row))}</option>`).join('')}`;
  }
  function quickFillMarkup(dialog){
    const form=$('#fp-smart-capture-review-form'),review=api()?.reviewFromForm?.(form)||{},data=workspaceData();
    const customer=review.customer||{},product=review.products?.[0]||{};
    return`<div class="fp-sc24-quick-fill"><div class="fp-sc24-quick-fill-title"><b>快捷补资料</b><span>可直接选择已有资料，或输入本次名称。</span></div><div class="fp-sc24-quick-fill-grid">
      <label><span>从客户库选择</span><select data-fp-sc24-quick-customer>${optionRows(data.customers||[],row=>row.company_name||row.name||row.contact_name||'未命名客户')}</select></label>
      <label><span>本次客户名称</span><input data-fp-sc24-quick-customer-name value="${esc(customer.company_name||customer.contact_name||'')}" placeholder="输入客户公司或联系人"></label>
      <label><span>从商品库选择</span><select data-fp-sc24-quick-product>${optionRows(data.products||[],row=>`${row.name||'未命名商品'}${row.sku?` · ${row.sku}`:''}`)}</select></label>
      <label><span>本次商品名称</span><input data-fp-sc24-quick-product-name value="${esc(genericName(product.name)?'':(product.name||''))}" placeholder="输入真实商品名称"></label>
    </div></div>`;
  }
  function updateQuickReview(dialog){
    const root=$('[data-fp-sc24-quick]',dialog);if(!root)return;
    autoMatch(dialog);
    const facts=reviewFacts(dialog);
    root.innerHTML=`<div class="fp-sc24-quick-head"><div><p>极速核对</p><h3>只处理会影响开单的内容</h3><span>缺少的关键内容可以先在草稿中继续补充；建议项不影响预览。</span></div><button type="button" data-fp-sc24-open-issues>${facts.missing.length?'查看缺少资料':'查看建议补充项'}</button></div>
      <div class="fp-sc24-readiness"><b>关键内容 ${facts.readiness.recognized}/${facts.readiness.total}</b><span>开单完整度 ${facts.readiness.score}%</span></div>
      <div class="fp-sc24-quick-grid">
        ${quickList('已确认','confirmed',facts.confirmed)}
        ${quickList('建议补充','check',facts.check)}
        ${quickList('缺少资料','missing',facts.missing)}
      </div>
      ${quickFillMarkup(dialog)}
      <div class="fp-sc24-quick-actions">
        <button type="button" class="btn secondary" data-fp-sc24-show-all>查看全部字段</button>
      </div>`;
    dialog.dataset.fpSc24CriticalMissing=String(facts.missing.length);
  }


  function setActiveReviewTab(dialog,name){if(!dialog)return;const order=['quick','customer','products','deal','document'],active=order.includes(name)?name:'quick';dialog.dataset.fpSc24Tab=active;$$('[data-fp-sc24-tab]',dialog).forEach(b=>{const on=b.dataset.fpSc24Tab===active;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});$$('[data-fp-sc24-panel]',dialog).forEach(p=>p.hidden=p.dataset.fpSc24Panel!==active);const i=order.indexOf(active),prev=$('[data-fp-sc24-prev]',dialog),next=$('[data-fp-sc24-next]',dialog);if(prev)prev.disabled=i===0;if(next){next.disabled=i===order.length-1;next.textContent=i===order.length-1?'已到最后一步':'下一步';}}
  function compact(value,max=28){const t=clean(value);return t.length>max?`${t.slice(0,max)}…`:t;}
  function updateOverview(dialog){const result=currentState().result||{},c=result.customer||{},p=Array.isArray(result.products)?result.products:[],realProductCount=p.filter(item=>(clean(item?.name)&&!genericName(item.name))||clean(item?.sku)).length,ready=api()?.readiness?.(api()?.reviewFromForm?.($('#fp-smart-capture-review-form'))||result)||{score:0,blocking:[]};const root=$('[data-fp-sc24-overview]',dialog);if(!root)return;root.innerHTML=`<article><small>客户</small><b>${esc(compact(c.company_name||c.contact_name||'未识别'))}</b></article><article><small>商品</small><b>${realProductCount?`${realProductCount} 项`:'待补'}</b></article><article><small>建议单据</small><b>${esc(DOC_TYPES[result.document?.type]||'报价单')}</b></article><article class="${ready.blocking.length?'warn':''}"><small>开单完整度 / 核心缺失</small><b>${ready.score}% · ${ready.blocking.length} 项</b></article>`;}
  function decorateProducts(dialog){$$('[data-fp-sc-product]',dialog).forEach((article,index)=>{if(article.dataset.fpSc24Product==='1')return;article.dataset.fpSc24Product='1';const head=$('.fp-sc-product-head',article),grid=$('.fp-sc-grid',article);if(!head||!grid)return;const rawName=$('[name^="product_name_"]',article)?.value||'',name=genericName(rawName)?'待补商品名称':rawName,sku=$('[name^="product_sku_"]',article)?.value||'',qty=$('[name^="product_qty_"]',article)?.value||'',unit=$('[name^="product_unit_"]',article)?.value||'';const summary=document.createElement('div');summary.className='fp-sc24-product-summary';summary.innerHTML=`<span><b>${esc(name)}</b><small>${esc([sku,qty?`${qty} ${unit}`:''].filter(Boolean).join(' · ')||'等待补充')}</small></span><button type="button" data-fp-sc24-product-toggle>${index===0?'收起':'展开编辑'}</button>`;head.prepend(summary);if(index>0)article.classList.add('is-collapsed');});}
  function decorateReview(){const dialog=$('#fp-smart-capture-review');if(!dialog||decorating)return;const body=$('.fp-sc-review-body',dialog);if(!body)return;decorating=true;try{dialog.classList.add('fp-sc24-review-dialog');const eyebrow=$('header p',dialog),title=$('header h2',dialog),sub=$('header span',dialog);if(eyebrow)eyebrow.textContent='智能资料核对';if(title)title.textContent='分步核对、归档并生成';if(sub)sub.textContent='先确认客户和商品，再决定是否保存业务与生成单据。';const source=$('[data-fp-sc-source-summary]',dialog);if(source&&!$('[data-fp-sc24-overview]',dialog)){source.insertAdjacentHTML('afterend','<div class="fp-sc24-review-overview" data-fp-sc24-overview></div><nav class="fp-sc24-review-tabs" role="tablist"><button type="button" data-fp-sc24-tab="quick">极速核对</button><button type="button" data-fp-sc24-tab="customer">客户资料</button><button type="button" data-fp-sc24-tab="products">商品资料</button><button type="button" data-fp-sc24-tab="deal">业务归档</button><button type="button" data-fp-sc24-tab="document">单据与检查</button></nav>');}
      const originalSections=$$('.fp-sc-review-body>section',dialog).filter(section=>!section.matches('[data-fp-sc24-quick]'));
      ['customer','products','deal','document'].forEach((name,i)=>{if(originalSections[i])originalSections[i].dataset.fpSc24Panel=name;});
      let quick=$('[data-fp-sc24-quick]',dialog);
      if(!quick){
        quick=document.createElement('section');
        quick.className='fp-sc24-quick-review';
        quick.dataset.fpSc24Quick='1';
        quick.dataset.fpSc24Panel='quick';
        $('.fp-sc24-review-tabs',dialog)?.insertAdjacentElement('afterend',quick);
      }
      updateOverview(dialog);decorateProducts(dialog);updateQuickReview(dialog);const result=currentState().result||{},c=result.customer||{},hasCustomer=Boolean(c.company_name||c.contact_name||c.email||c.phone);const customerSection=originalSections[0];if(customerSection){customerSection.classList.toggle('fp-sc24-no-customer',!hasCustomer);if(!hasCustomer&&!$('.fp-sc24-customer-alert',customerSection)){customerSection.insertAdjacentHTML('afterbegin','<div class="fp-sc24-customer-alert">该资料没有识别到明确买方信息。系统已避免把单据编号或卖方资料误填成客户；可手动补充，或取消“保存客户资料”。</div>');const save=$('[name="save_customer"]',customerSection);if(save)save.checked=false;}}
      const footer=$('footer',dialog);if(footer&&!$('[data-fp-sc24-prev]',footer)){footer.insertAdjacentHTML('afterbegin','<div class="fp-sc24-review-nav"><button type="button" class="btn ghost" data-fp-sc24-prev>上一步</button><button type="button" class="btn secondary" data-fp-sc24-next>下一步</button></div>');}
      if(localPreview()){const saveOnly=$('[data-fp-sc-save-only]',dialog),generate=$('[data-fp-sc-save-generate]',dialog);if(saveOnly){saveOnly.textContent='保存资料（需登录）';saveOnly.title='本地预览不能写入云端资料库';}if(generate)generate.textContent='本地预览生成单据';if(source&&!$('.fp-sc24-preview-note',dialog))source.insertAdjacentHTML('afterend','<div class="fp-sc24-preview-note">当前是本地预览：可以完成识别、核对并带入单据编辑器；客户、商品和业务需要在线登录后保存。</div>');}
      const preview=$('[data-fp-sc-preview-draft]',dialog);if(preview)preview.textContent='预览单据草稿';setActiveReviewTab(dialog,dialog.dataset.fpSc24Tab||'quick');recordResult();}finally{decorating=false;}}

  async function pasteClipboard(){const input=$('[data-fp-sc-input]');if(!input)return;try{const text=await navigator.clipboard.readText();if(!clean(text))throw new Error();input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();toast('已从剪贴板粘贴。');}catch(_){input.focus();toast('浏览器未允许读取剪贴板，请直接粘贴。',true);}}
  function useSample(){const input=$('[data-fp-sc-input]');if(!input)return;input.value=SAMPLE;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();toast('已填入可测试的英文询盘示例。');}
  function applyAI(){const dialog=$('#support-service-dialog');if(dialog){if(window.FlypigBOXWorkspaceAPI?.openWorkspaceDialog)window.FlypigBOXWorkspaceAPI.openWorkspaceDialog(dialog);else dialog.showModal();return;}document.querySelector('[data-action="open-support"]')?.click();}
  function handleDrop(event){const zone=event.target.closest('[data-fp-sc24-drop]');if(!zone)return;event.preventDefault();zone.classList.remove('is-dragover');const file=event.dataTransfer?.files?.[0],input=$('[data-fp-sc-file]',zone);if(!file||!input)return;try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){toast('拖入失败，请点击选择文件。',true);}}
  function setFormValue(name,value){
    const input=$(`[name="${name}"]`,$('#fp-smart-capture-review-form'));if(!input)return;
    input.value=value??'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function applyQuickCustomer(id){
    const row=(workspaceData().customers||[]).find(item=>String(item.id)===String(id));if(!row)return;
    setFormValue('customer_existing_id',row.id);setFormValue('customer_mode','fill_empty');
    setFormValue('company_name',row.company_name||row.name||'');setFormValue('contact_name',row.contact_name||'');
    setFormValue('email',row.email||'');setFormValue('phone',row.phone||'');setFormValue('country',row.country||'');
    setFormValue('address',row.address||'');setFormValue('customer_currency',row.currency||'USD');
  }
  function applyQuickProduct(id){
    const row=(workspaceData().products||[]).find(item=>String(item.id)===String(id));if(!row)return;
    setFormValue('product_existing_0',row.id);setFormValue('product_mode_0','fill_empty');
    setFormValue('product_name_0',row.name||'');setFormValue('product_sku_0',row.sku||'');
    setFormValue('product_spec_0',row.specification||'');setFormValue('product_unit_0',row.pricing_unit||row.unit||'PCS');
    if(row.suggested_price!==null&&row.suggested_price!==undefined)setFormValue('product_price_0',row.suggested_price);
    setFormValue('product_currency_0',row.currency||'USD');
  }
  function bind(){document.addEventListener('click',event=>{if(event.target.closest('[data-fp-sc24-paste]'))return pasteClipboard();if(event.target.closest('[data-fp-sc24-sample]'))return useSample();if(event.target.closest('[data-fp-sc24-recheck]')){window.FlypigBOXAIClient?.refresh?.();toast('正在重新检查增强整理。');return;}if(event.target.closest('[data-fp-sc24-apply]'))return applyAI();
      if(event.target.closest('[data-fp-sc24-show-all]'))return setActiveReviewTab($('#fp-smart-capture-review'),'customer');
      if(event.target.closest('[data-fp-sc24-open-issues]')){
        const dialog=$('#fp-smart-capture-review'),facts=reviewFacts(dialog);
        if(facts.missing.some(row=>/商品|数量|单价|SKU/.test(row)))return setActiveReviewTab(dialog,'products');
        if(facts.missing.some(row=>/客户/.test(row)))return setActiveReviewTab(dialog,'customer');
        return setActiveReviewTab(dialog,'document');
      }
      const tab=event.target.closest('[data-fp-sc24-tab]');if(tab)return setActiveReviewTab($('#fp-smart-capture-review'),tab.dataset.fpSc24Tab);const toggle=event.target.closest('[data-fp-sc24-product-toggle]');if(toggle){const card=toggle.closest('[data-fp-sc-product]');card?.classList.toggle('is-collapsed');toggle.textContent=card?.classList.contains('is-collapsed')?'展开编辑':'收起';return;}if(event.target.closest('[data-fp-sc24-prev]')){const d=$('#fp-smart-capture-review'),order=['quick','customer','products','deal','document'],i=order.indexOf(d?.dataset.fpSc24Tab||'quick');return setActiveReviewTab(d,order[Math.max(0,i-1)]);}if(event.target.closest('[data-fp-sc24-next]')){const d=$('#fp-smart-capture-review'),order=['quick','customer','products','deal','document'],i=order.indexOf(d?.dataset.fpSc24Tab||'quick');return setActiveReviewTab(d,order[Math.min(order.length-1,i+1)]);}},true);
    document.addEventListener('dragover',e=>{const z=e.target.closest('[data-fp-sc24-drop]');if(!z)return;e.preventDefault();z.classList.add('is-dragover');},true);document.addEventListener('dragleave',e=>e.target.closest('[data-fp-sc24-drop]')?.classList.remove('is-dragover'),true);document.addEventListener('drop',handleDrop,true);
    document.addEventListener('change',event=>{
      if(event.target.matches('[data-fp-sc-file]'))setTimeout(()=>{const l=$('[data-fp-sc-file-label]');if(l)l.textContent=sourceLabel(currentState());},120);
      if(event.target.matches('[data-fp-sc24-quick-customer]')){applyQuickCustomer(event.target.value);setTimeout(()=>updateQuickReview($('#fp-smart-capture-review')),60);}
      if(event.target.matches('[data-fp-sc24-quick-product]')){applyQuickProduct(event.target.value);setTimeout(()=>updateQuickReview($('#fp-smart-capture-review')),60);}
    },true);
    document.addEventListener('input',event=>{
      if(event.target.matches('[data-fp-sc24-quick-customer-name]'))setFormValue('company_name',event.target.value);
      if(event.target.matches('[data-fp-sc24-quick-product-name]'))setFormValue('product_name_0',event.target.value);
      if(event.target.closest('#fp-smart-capture-review-form'))setTimeout(()=>{updateQuickReview($('#fp-smart-capture-review'));updateOverview($('#fp-smart-capture-review'));},80);if(event.target.matches('[data-fp-sc-product] input')){const card=event.target.closest('[data-fp-sc-product]'),summary=$('.fp-sc24-product-summary',card);if(!summary)return;const name=$('[name^="product_name_"]',card)?.value||'未命名商品',sku=$('[name^="product_sku_"]',card)?.value||'',qty=$('[name^="product_qty_"]',card)?.value||'',unit=$('[name^="product_unit_"]',card)?.value||'';$('b',summary).textContent=name;$('small',summary).textContent=[sku,qty?`${qty} ${unit}`:''].filter(Boolean).join(' · ')||'等待补充';}},true);
    document.addEventListener('HUIDI:ai-gateway-state',syncStatus);}
  function observe(){const host=$('#ai-workbench-view');if(host&&!hostObserver){hostObserver=new MutationObserver(()=>{cancelAnimationFrame(centerTimer);centerTimer=requestAnimationFrame(()=>ensureCenter());});hostObserver.observe(host,{childList:true,subtree:true});}if(!bodyObserver){bodyObserver=new MutationObserver(()=>{normalizeNav();if(!$('#fp-smart-capture-center')&&$('#ai-workbench-view'))ensureCenter();});bodyObserver.observe(document.body,{childList:true,subtree:true,characterData:true});}const dialog=$('#fp-smart-capture-review');if(dialog&&!reviewObserver){reviewObserver=new MutationObserver(()=>{if(!decorating)requestAnimationFrame(decorateReview);});reviewObserver.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});}}
  function boot(){normalizeNav();ensureCenter(true);decorateReview();bind();observe();setInterval(()=>{normalizeNav();ensureCenter();syncStatus();if(!reviewObserver&&$('#fp-smart-capture-review'))observe();},1500);}
  window.FlypigBOXSmartCaptureUX=Object.freeze({version:VERSION,ensureCenter,decorateReview,setActiveReviewTab});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
