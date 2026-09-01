/* HUIDI V3.3.6.23 — Smart Capture UX Convergence.
   Turns the AI workbench into one focused capture flow and converts the
   dense review dialog into a staged, progressive review experience. */
(()=>{'use strict';
  const VERSION='V3.3.6.23';
  if(window.FlypigBOXSmartCaptureUX?.version===VERSION)return;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const clean=v=>String(v??'').trim();
  const LANGUAGES={auto:'自动识别',en:'英文',zh:'中文',bilingual:'中英双语',es:'西班牙语',fr:'法语',de:'德语',pt:'葡萄牙语',it:'意大利语',ja:'日语',ko:'韩语',ru:'俄语',ar:'阿拉伯语'};
  const DOC_TYPES={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'};
  let centerObserver=null,dialogObserver=null,centerRaf=0,dialogRaf=0,decorating=false;

  function api(){return window.FlypigBOXSmartCapture||null;}
  function gateway(){return window.FlypigBOXAIClient?.getState?.()||null;}
  function toast(message,error=false){window.FlypigBOXWorkspaceAPI?.toast?.(message,error);if(!window.FlypigBOXWorkspaceAPI?.toast)console[error?'error':'log'](message);}
  function statusSnapshot(){
    const snap=gateway();
    if(snap?.phase==='ready')return{label:'AI识别可用',kind:'online',detail:'复杂询盘将优先使用AI网关识别'};
    if(snap?.phase==='running')return{label:'正在AI识别',kind:'running',detail:snap.message||'正在处理资料'};
    return{label:'本地识别可用',kind:'local',detail:'AI未连接时自动使用本地规则'};
  }
  function currentState(){return api()?.getState?.()||{};}
  function sourceLabel(state){
    if(state.sourceName)return `已读取：${state.sourceName}`;
    if(clean(state.sourceText))return `已保存草稿 · ${clean(state.sourceText).length} 字符`;
    return '支持 TXT、CSV、TSV、XLSX；也可直接拖入文件';
  }
  function centerMarkup(state){
    const status=statusSnapshot();
    return `<div class="fp-sc23-shell">
      <header class="fp-sc23-hero">
        <div class="fp-sc23-hero-copy"><p>SMART CAPTURE</p><h2>把资料放进来，核对后直接入库和生成单据</h2><span>客户信息、商品资料、邮件询盘和旧单据统一识别。系统先分类，你只需要检查、保存和生成。</span></div>
        <div class="fp-sc23-status" data-kind="${status.kind}"><i></i><div><b data-fp-sc23-status>${status.label}</b><small data-fp-sc23-status-detail>${status.detail}</small></div></div>
      </header>
      <div class="fp-sc23-layout">
        <form id="fp-smart-capture-form" class="fp-sc23-composer">
          <div class="fp-sc23-composer-head"><div><b>输入资料</b><span>邮件、WhatsApp、客户资料、商品表、报价单或 PI 内容都可以</span></div><button type="button" class="fp-sc23-paste" data-fp-sc23-paste>从剪贴板粘贴</button></div>
          <label class="fp-sc23-input-wrap"><span class="sr-only">原始资料</span><textarea name="input" data-fp-sc-input placeholder="例如：客户公司、联系人、产品、型号、数量、价格、币种、交期、付款条件、目的地……">${esc(state.sourceText||'')}</textarea><small>系统不会自动覆盖已有资料，所有识别结果都会先进入核对。</small></label>
          <div class="fp-sc23-tools">
            <label class="fp-sc23-dropzone" data-fp-sc23-dropzone><input type="file" data-fp-sc-file accept=".txt,.csv,.tsv,.xlsx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"><span>拖入文件或点击选择</span><small data-fp-sc-file-label>${esc(sourceLabel(state))}</small></label>
            <label class="fp-sc23-language"><span>单据输出语言</span><select name="language">${Object.entries(LANGUAGES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select><small>识别语言与输出语言分开处理</small></label>
          </div>
          <div class="fp-sc23-actions"><button type="button" class="btn ghost" data-fp-sc-clear>清空</button><button type="submit" class="btn primary" data-fp-sc-recognize><span>识别并核对</span><small>不会直接写入正式单据</small></button></div>
        </form>
        <aside class="fp-sc23-side">
          <div class="fp-sc23-auto"><b>系统会自动完成</b><ol><li><i>1</i><span><strong>识别语言和资料类型</strong><small>支持单一语言和多语言混合内容</small></span></li><li><i>2</i><span><strong>拆分客户、商品和业务</strong><small>匹配已有资料并提示冲突</small></span></li><li><i>3</i><span><strong>保存到对应资料库</strong><small>保留创建、修改时间和真实关联ID</small></span></li><li><i>4</i><span><strong>生成需要的单据</strong><small>先预览核对，再保存版本和导出</small></span></li></ol></div>
          <details class="fp-sc23-boundary"><summary>使用边界与数据安全</summary><p>AI或本地识别只生成候选字段，不会自动发送邮件、猜测银行账户或静默覆盖已有记录。</p></details>
        </aside>
      </div>
      <details class="fp-sc23-more"><summary><span>还能处理什么？</span><small>展开查看支持范围</small></summary><div><article><b>客户与询盘</b><span>识别公司、联系人、邮箱、国家、语言和需求。</span></article><article><b>商品与表格</b><span>识别SKU、规格、数量、价格、MOQ和HS Code。</span></article><article><b>五类外贸单据</b><span>报价单、PI、商业发票、装箱单和销售合同。</span></article><article><b>多语言输出</b><span>原文保留，可生成英文、中文、双语或指定语言。</span></article></div></details>
    </div>`;
  }

  function syncCenterStatus(){
    const center=$('#fp-smart-capture-center');if(!center)return;
    const status=statusSnapshot();
    const badge=$('.fp-sc23-status',center);if(badge)badge.dataset.kind=status.kind;
    const label=$('[data-fp-sc23-status]',center);if(label)label.textContent=status.label;
    const detail=$('[data-fp-sc23-status-detail]',center);if(detail)detail.textContent=status.detail;
  }
  function enhanceCenter(){
    const host=$('#ai-workbench-view');const center=$('#fp-smart-capture-center',host);if(!host||!center)return;
    if(center.dataset.fpSc23!==VERSION){
      const state=currentState();center.className='center-section-v2 fp-sc-center fp-sc23-center';center.innerHTML=centerMarkup(state);center.dataset.fpSc23=VERSION;
      const select=$('select[name="language"]',center);if(select)select.value='auto';
    }
    host.classList.add('fp-sc23-ai-view');
    const legacy=$('.ai-workbench-v33612',host);if(legacy)legacy.setAttribute('aria-hidden','true');
    const live=$('#fp-ai-live-center',host);if(live){live.hidden=true;live.setAttribute('aria-hidden','true');}
    const oneClick=$('#fp-one-click-task-center',host);if(oneClick){oneClick.hidden=true;oneClick.setAttribute('aria-hidden','true');}
    syncCenterStatus();
  }

  function setActiveReviewTab(dialog,name){
    const valid=['customer','products','deal','document'];const active=valid.includes(name)?name:'customer';dialog.dataset.fpSc23Tab=active;
    $$('[data-fp-sc23-tab]',dialog).forEach(button=>{const on=button.dataset.fpSc23Tab===active;button.classList.toggle('active',on);button.setAttribute('aria-selected',String(on));});
    $$('[data-fp-sc23-panel]',dialog).forEach(panel=>{panel.hidden=panel.dataset.fpSc23Panel!==active;});
    const order=valid.indexOf(active);const prev=$('[data-fp-sc23-prev]',dialog),next=$('[data-fp-sc23-next]',dialog);if(prev)prev.disabled=order<=0;if(next){next.disabled=order>=valid.length-1;next.textContent=order>=valid.length-1?'已到最后一步':'下一步';}
  }
  function compactText(value,max=34){const text=clean(value);return text.length>max?`${text.slice(0,max)}…`:text;}
  function resultSummary(){
    const result=currentState().result||{};const customer=result.customer||{},products=Array.isArray(result.products)?result.products:[],doc=result.document||{};
    return{customer:customer.company_name||customer.contact_name||'未识别客户',products:products.length,document:DOC_TYPES[doc.type]||'报价单',missing:Array.isArray(result.missing)?result.missing.length:0,language:LANGUAGES[result.source?.detected_language]||result.source?.detected_language||'自动'};
  }
  function updateReviewOverview(dialog){
    const summary=resultSummary();const overview=$('[data-fp-sc23-overview]',dialog);if(!overview)return;
    const html=`<article><small>识别客户</small><b>${esc(compactText(summary.customer))}</b></article><article><small>商品数量</small><b>${summary.products} 项</b></article><article><small>建议单据</small><b>${esc(summary.document)}</b></article><article class="${summary.missing?'warn':''}"><small>待补字段</small><b>${summary.missing} 项</b></article>`;
    if(overview.innerHTML!==html)overview.innerHTML=html;
  }
  function decorateProducts(dialog){
    $$('[data-fp-sc-product]',dialog).forEach((article,index)=>{
      if(article.dataset.fpSc23Product==='1')return;article.dataset.fpSc23Product='1';
      const head=$('.fp-sc-product-head',article),grid=$('.fp-sc-grid',article);if(!head||!grid)return;
      const name=$('[name^="product_name_"]',article)?.value||'未命名商品';const sku=$('[name^="product_sku_"]',article)?.value||'';const qty=$('[name^="product_qty_"]',article)?.value||'';const unit=$('[name^="product_unit_"]',article)?.value||'';
      const summary=document.createElement('div');summary.className='fp-sc23-product-summary';summary.innerHTML=`<span><b>${esc(name)}</b><small>${esc([sku,qty?`${qty} ${unit}`:''].filter(Boolean).join(' · ')||'等待补充商品信息')}</small></span><button type="button" data-fp-sc23-product-toggle>${index===0?'收起':'展开编辑'}</button>`;head.prepend(summary);
      if(index>0)article.classList.add('is-collapsed');
    });
  }
  function decorateReview(){
    const dialog=$('#fp-smart-capture-review');if(!dialog||decorating)return;const body=$('.fp-sc-review-body',dialog);if(!body)return;
    decorating=true;
    try{
      dialog.classList.add('fp-sc23-review-dialog');
      const form=$('#fp-smart-capture-review-form',dialog);if(form)form.classList.add('fp-sc23-review-form');const eyebrow=$('header p',dialog),title=$('header h2',dialog),subtitle=$('header span',dialog);if(eyebrow)eyebrow.textContent='V3.3.6.23 智能资料核对';if(title)title.textContent='分步核对并确认保存';if(subtitle)subtitle.textContent='按客户、商品、业务和单据逐步检查，最后再保存或生成。';
      const source=$('[data-fp-sc-source-summary]',dialog);
      if(source&&!$('[data-fp-sc23-overview]',dialog)){
        source.insertAdjacentHTML('afterend','<div class="fp-sc23-review-overview" data-fp-sc23-overview></div><nav class="fp-sc23-review-tabs" role="tablist"><button type="button" data-fp-sc23-tab="customer">1 客户资料</button><button type="button" data-fp-sc23-tab="products">2 商品资料</button><button type="button" data-fp-sc23-tab="deal">3 业务归档</button><button type="button" data-fp-sc23-tab="document">4 单据与检查</button></nav>');
      }
      const sections=$$('.fp-sc-review-body>section',dialog);const names=['customer','products','deal','document'];sections.slice(0,4).forEach((section,index)=>{section.dataset.fpSc23Panel=names[index];section.setAttribute('role','tabpanel');});
      const alerts=$('.fp-sc-alerts',dialog),documentPanel=$('[data-fp-sc23-panel="document"]',dialog);if(alerts&&documentPanel&&alerts.parentElement!==documentPanel)documentPanel.appendChild(alerts);
      const footer=$('footer',dialog);if(footer&&!$('[data-fp-sc23-prev]',footer))footer.insertAdjacentHTML('afterbegin','<div class="fp-sc23-review-nav"><button type="button" class="btn ghost" data-fp-sc23-prev>上一步</button><button type="button" class="btn secondary" data-fp-sc23-next>下一步</button></div>');
      const result=currentState().result||{};const fingerprint=`${result.source?.received_at||''}:${clean(result.source?.original_text).length}:${Array.isArray(result.products)?result.products.length:0}`;if(dialog.dataset.fpSc23Fingerprint!==fingerprint){dialog.dataset.fpSc23Fingerprint=fingerprint;dialog.dataset.fpSc23Tab='customer';}updateReviewOverview(dialog);decorateProducts(dialog);setActiveReviewTab(dialog,dialog.dataset.fpSc23Tab||'customer');
    }finally{decorating=false;}
  }

  async function pasteClipboard(){
    const input=$('[data-fp-sc-input]');if(!input)return;
    try{const text=await navigator.clipboard.readText();if(!clean(text))throw new Error('剪贴板为空');input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();toast('已从剪贴板粘贴资料。');}
    catch(_){input.focus();toast('浏览器未允许读取剪贴板，请直接在输入框粘贴。',true);}
  }
  function handleDrop(event){
    const zone=event.target.closest('[data-fp-sc23-dropzone]');if(!zone)return;event.preventDefault();zone.classList.remove('is-dragover');const file=event.dataTransfer?.files?.[0];if(!file)return;
    const input=$('[data-fp-sc-file]',zone);if(!input)return;
    try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){toast('拖入文件失败，请点击选择文件。',true);}
  }
  function bind(){
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-sc23-paste]'))return pasteClipboard();
      const tab=event.target.closest('[data-fp-sc23-tab]');if(tab)return setActiveReviewTab($('#fp-smart-capture-review'),tab.dataset.fpSc23Tab);
      const toggle=event.target.closest('[data-fp-sc23-product-toggle]');if(toggle){const card=toggle.closest('[data-fp-sc-product]');if(!card)return;card.classList.toggle('is-collapsed');toggle.textContent=card.classList.contains('is-collapsed')?'展开编辑':'收起';return;}
      if(event.target.closest('[data-fp-sc23-prev]')){const dialog=$('#fp-smart-capture-review'),order=['customer','products','deal','document'],index=order.indexOf(dialog?.dataset.fpSc23Tab||'customer');return setActiveReviewTab(dialog,order[Math.max(0,index-1)]);}
      if(event.target.closest('[data-fp-sc23-next]')){const dialog=$('#fp-smart-capture-review'),order=['customer','products','deal','document'],index=order.indexOf(dialog?.dataset.fpSc23Tab||'customer');return setActiveReviewTab(dialog,order[Math.min(order.length-1,index+1)]);}
    },true);
    document.addEventListener('dragover',event=>{const zone=event.target.closest('[data-fp-sc23-dropzone]');if(!zone)return;event.preventDefault();zone.classList.add('is-dragover');},true);
    document.addEventListener('dragleave',event=>{event.target.closest('[data-fp-sc23-dropzone]')?.classList.remove('is-dragover');},true);
    document.addEventListener('drop',handleDrop,true);
    document.addEventListener('change',event=>{if(event.target.matches('[data-fp-sc-file]')){setTimeout(()=>{const label=$('[data-fp-sc-file-label]');const state=currentState();if(label)label.textContent=sourceLabel(state);},80);}},true);
    document.addEventListener('input',event=>{if(event.target.matches('[data-fp-sc-product] input')){const card=event.target.closest('[data-fp-sc-product]'),summary=$('.fp-sc23-product-summary',card);if(!summary)return;const name=$('[name^="product_name_"]',card)?.value||'未命名商品',sku=$('[name^="product_sku_"]',card)?.value||'',qty=$('[name^="product_qty_"]',card)?.value||'',unit=$('[name^="product_unit_"]',card)?.value||'';$('b',summary).textContent=name;$('small',summary).textContent=[sku,qty?`${qty} ${unit}`:''].filter(Boolean).join(' · ')||'等待补充商品信息';}},true);
    document.addEventListener('HUIDI:ai-gateway-state',syncCenterStatus);
  }
  function observe(){
    const ai=$('#ai-workbench-view');if(ai&&!centerObserver){centerObserver=new MutationObserver(()=>{cancelAnimationFrame(centerRaf);centerRaf=requestAnimationFrame(enhanceCenter);});centerObserver.observe(ai,{childList:true,subtree:true});}
    const dialog=$('#fp-smart-capture-review');if(dialog&&!dialogObserver){dialogObserver=new MutationObserver(()=>{if(decorating)return;cancelAnimationFrame(dialogRaf);dialogRaf=requestAnimationFrame(decorateReview);});dialogObserver.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});}
  }
  function boot(){enhanceCenter();decorateReview();bind();observe();setInterval(syncCenterStatus,4000);}
  window.FlypigBOXSmartCaptureUX=Object.freeze({version:VERSION,enhanceCenter,decorateReview,setActiveReviewTab});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
