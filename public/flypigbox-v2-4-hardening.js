(()=>{
  'use strict';
  const PUBLIC_MODE_KEY='flypigbox_public_computer_mode_v1';
  const SENSITIVE_EXACT=new Set([
    'flypigbox_b2b_defaults_v1','flypigbox_b2b_customers_v1','flypigbox_b2b_api_profiles_v1',
    'flypigbox_b2b_histories_v1','flypigbox_b2b_templates_v1','flypigbox_b2b_content_library_v1',
    'flypigbox_b2b_payment_templates_v1','flypigbox_b2b_autosave_v1','flypigbox_b2b_signature_profiles_v1',
    'flypigbox_b2b_email_prefs_v1','flypigbox_mail_drafts_v1','flypigbox_mail_templates_v1',
    'flypigbox_catalog_studio_profile_v11_6','flypigbox_catalog_studio_theme_v11_6','HUIDI.v9.branding',
    'flypigbox_verified_bank_fingerprint_v1'
  ]);
  const SENSITIVE_PREFIXES=['flypigbox_b2b_','flypigbox_mail_drafts','flypigbox_catalog_studio_profile'];
  const SESSION_KEYS=['flypigbox_document_context','flypigbox_open_document_id','flypigbox_pending_document_type','flypigbox_catalog_product_ids_v1'];
  const LOCAL_SAVE_IDS=new Set(['saveDraftBtn','saveTemplateBtn','saveDefaultsBtn','savePaymentTemplateBtn','saveAssetProfileBtn','saveProfile','saveTheme']);
  const $=(s,r=document)=>r.querySelector(s);

  function isSensitiveKey(key){return SENSITIVE_EXACT.has(key)||SENSITIVE_PREFIXES.some(prefix=>String(key).startsWith(prefix));}
  function clearSensitiveLocalData(){
    let removed=0;
    try{
      Object.keys(localStorage).forEach(key=>{if(isSensitiveKey(key)){localStorage.removeItem(key);removed++;}});
      SESSION_KEYS.forEach(key=>sessionStorage.removeItem(key));
    }catch(error){console.warn('HUIDI local data clear failed',error);}
    return removed;
  }
  function publicMode(){return sessionStorage.getItem(PUBLIC_MODE_KEY)==='1';}
  function setPublicMode(enabled){
    if(enabled)sessionStorage.setItem(PUBLIC_MODE_KEY,'1');else sessionStorage.removeItem(PUBLIC_MODE_KEY);
    document.documentElement.dataset.fpPublicComputer=enabled?'1':'0';
    syncPrivacyUi();
  }
  function syncPrivacyUi(){
    const enabled=publicMode();
    document.querySelectorAll('[data-fp-public-mode-state]').forEach(el=>el.textContent=enabled?'已开启':'未开启');
    document.querySelectorAll('[data-fp-public-mode-toggle]').forEach(el=>{if('checked' in el)el.checked=enabled;});
    const button=$('#fpPrivacyButton');if(button)button.dataset.active=enabled?'1':'0';
  }
  function closeDialog(){const d=$('#fpPrivacyDialog');if(d?.open)d.close();}
  function openDialog(){
    let d=$('#fpPrivacyDialog');
    if(!d){
      d=document.createElement('dialog');
      d.id='fpPrivacyDialog';d.className='fp-privacy-dialog';
      d.innerHTML=`<div class="fp-privacy-card"><button class="fp-privacy-close" type="button" aria-label="关闭">×</button><p class="eyebrow">本机数据与公共电脑</p><h2>保护客户、银行账户与签章资料</h2><p>单据草稿、客户、收款模板、邮件草稿和签章可能保存在当前浏览器。公共电脑模式会在关闭页面或退出登录时清除这些本机敏感资料，并阻止继续保存本机模板。</p><label class="fp-public-toggle"><input type="checkbox" data-fp-public-mode-toggle><span><b>公共电脑模式</b><small>只对当前浏览器标签会话生效，不影响云端资料。</small></span></label><div class="fp-privacy-state">当前状态：<b data-fp-public-mode-state></b></div><div class="fp-privacy-actions"><button type="button" class="btn secondary" data-fp-clear-sensitive>立即清除本机敏感资料</button><button type="button" class="btn primary" data-fp-close-privacy>完成</button></div><p class="fp-privacy-note">不会删除 Supabase 登录会话、设备标识或云端记录。需要删除云端数据时，请使用“数据删除”页面中的申请方式。</p></div>`;
      document.body.appendChild(d);
      d.addEventListener('click',event=>{if(event.target===d)closeDialog();});
      d.querySelector('.fp-privacy-close').addEventListener('click',closeDialog);
      d.querySelector('[data-fp-close-privacy]').addEventListener('click',closeDialog);
      d.querySelector('[data-fp-public-mode-toggle]').addEventListener('change',event=>setPublicMode(event.target.checked));
      d.querySelector('[data-fp-clear-sensitive]').addEventListener('click',()=>{
        const yes=window.confirm('确认清除当前浏览器中的本机草稿、客户、收款模板、邮件草稿和签章资料？云端记录不会被删除。');
        if(!yes)return;
        const removed=clearSensitiveLocalData();
        alert(`已清除 ${removed} 项本机敏感存储。建议刷新页面后继续。`);
      });
    }
    syncPrivacyUi();d.showModal();
  }
  function injectPrivacyButton(){
    if($('#fpPrivacyButton')||!document.body)return;
    const b=document.createElement('button');b.id='fpPrivacyButton';b.type='button';b.className='fp-privacy-button';b.innerHTML='<span>🔒</span><b>本机隐私</b>';b.addEventListener('click',openDialog);document.body.appendChild(b);syncPrivacyUi();
  }
  function dependencyWarning(){
    const missing=[];
    if(document.querySelector('script[src*="supabase"]')&&!window.supabase)missing.push('登录 / 云端组件');
    if(location.pathname.includes('catalog-studio')&&!window.XLSX&&!window.FlypigBOXXlsxLite?.readFile)missing.push('Excel 读取组件');
    if((location.pathname.includes('catalog-studio')||location.pathname.endsWith('/editor.html'))&&!window.html2canvas)missing.push('PDF 渲染组件');
    if((location.pathname.includes('catalog-studio')||location.pathname.endsWith('/editor.html'))&&!window.jspdf)missing.push('PDF 生成组件');
    if(!missing.length)return;
    const bar=document.createElement('div');bar.className='fp-dependency-warning';bar.textContent=`本地组件未准备完成：${missing.join('、')}。请确认完整解压了源码开放包后刷新页面；本地版不会把缺少组件伪装成成功。`;document.body.prepend(bar);
  }
  function syncContractClauseBuilder(){
    const builder=$('#contractClauseBuilder'),type=$('#documentType');
    if(!builder||!type)return;
    const active=type.value==='sales_contract';
    builder.classList.toggle('is-hidden',!active);
    builder.setAttribute('aria-hidden',active?'false':'true');
  }
  function languageFontCheck(){
    const select=$('#docLanguage');if(!select||!document.fonts)return;
    const check=()=>{
      const value=select.value;
      const risky={ar:['اختبار','Arabic'],th:['ทดสอบ','Thai'],ja:['テスト','Japanese'],ko:['테스트','Korean'],ru:['Проверка','Cyrillic']}[value];
      let note=$('#fpFontCoverageNote');
      if(!risky){note?.remove();return;}
      if(!note){note=document.createElement('p');note.id='fpFontCoverageNote';note.className='fp-font-warning';select.closest('label')?.appendChild(note);}
      note.textContent=`${risky[1]} 输出会使用当前设备系统字体。正式导出前请放大检查字形、换行和分页；不同电脑的字体环境可能不同。`;
    };
    select.addEventListener('change',check);check();
  }

  document.addEventListener('click',event=>{
    const target=event.target.closest('button,[data-account-action]');
    if(!target)return;
    if(publicMode()&&LOCAL_SAVE_IDS.has(target.id)){
      event.preventDefault();event.stopImmediatePropagation();
      alert('公共电脑模式已阻止保存本机草稿、模板或敏感资料。需要保存时请关闭公共电脑模式，或使用账号云端备份。');return;
    }
    const signout=target.matches('[data-account-action="signout"],#memberSignOutBtn,#memberLogoutBtn');
    if(signout){
      const clear=publicMode()||window.confirm('退出登录时是否同时清除本机草稿、客户、收款模板、邮件草稿和签章资料？\n\n确定：清除本机敏感资料并退出\n取消：仅退出登录');
      if(clear)clearSensitiveLocalData();
    }
  },true);
  window.addEventListener('pagehide',()=>{if(publicMode())clearSensitiveLocalData();});
  window.addEventListener('beforeunload',()=>{if(publicMode())clearSensitiveLocalData();});
  document.addEventListener('DOMContentLoaded',()=>{const dataPage=/workspace|editor|catalog-studio|document-start/i.test(location.pathname);if(dataPage)injectPrivacyButton();dependencyWarning();languageFontCheck();syncContractClauseBuilder();$('#documentType')?.addEventListener('change',syncContractClauseBuilder);syncPrivacyUi();});
  window.FlypigBOXPrivacy={clearSensitiveLocalData,setPublicMode,isPublicMode:publicMode,open:openDialog};
})();
