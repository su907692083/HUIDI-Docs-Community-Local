(()=>{
  'use strict';
  if(window.__FP32_VISUAL_REGRESSION_CLOSURE__)return;
  window.__FP32_VISUAL_REGRESSION_CLOSURE__=true;
  const RELEASE='18.32';
  const qs=(selector,root=document)=>root.querySelector(selector);
  const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const surface=()=>{
    const tagged=clean(document.body?.dataset?.fpSurface);if(tagged)return tagged;
    const path=(location.pathname||'').toLowerCase();
    if(path.includes('/admin/'))return 'admin';
    if(path.includes('catalog-studio'))return 'catalog';
    if(path.endsWith('/editor.html')||path.endsWith('editor.html'))return 'editor';
    if(path.endsWith('/document-start.html')||path.endsWith('document-start.html'))return 'document-start';
    if(path.endsWith('/workspace.html')||path.endsWith('workspace.html'))return 'workspace';
    return 'public';
  };
  const currentWorkspaceView=()=>{
    const data=clean(document.body.dataset.workspaceView);
    if(data)return data.replace(/^view-/,'');
    const activeView=qs('.view.active[id]');if(activeView)return activeView.id;
    const activeNav=qs('[data-view].active');return activeNav?.dataset.view||'dashboard';
  };
  const viewMeta={dashboard:['工作台','查看今天需要处理的业务、商品、单据和跟进事项。'],deals:['业务中心','管理询盘、报价机会、订单确认和后续跟进。'],documents:['单据中心','管理报价单、形式发票、合同、商业发票和装箱单。'],customers:['客户中心','管理客户主体、联系人、负责人和跟进信息。'],products:['商品资料库','维护商品图片、SKU、价格、规格和包装资料。'],catalog:['产品目录','从商品资料生成客户选品目录和目录文件。'],brands:['品牌中心','管理卖方主体、品牌、Logo和对外联系信息。'],templates:['模板中心','管理系统模板、企业模板和常用输出结构。'],notifications:['通知与协同','管理飞书、企微、事件规则和送达记录。'],recycle:['回收站','恢复误删的客户、商品、业务、单据和模板。'],mail:['邮件草稿','准备需要人工确认的客户邮件和单据发送内容。'],ai:['智能录入','从文本、图片和文件中整理可确认的候选字段。'],guide:['使用说明','查看当前工作台功能和操作步骤。']};
  const fallbacks={
    deals:{selector:'#deal-list',title:'暂无业务记录',text:'记录客户需求后，可以继续制作报价、确认订单和安排跟进。',action:'new-deal',label:'记录新询盘'},
    customers:{selector:'#customer-list',title:'暂无客户资料',text:'先新增客户，或导入现有客户表。保存前会保留人工确认。',action:'new-customer',label:'新增客户'},
    products:{selector:'#product-list',title:'暂无商品资料',text:'先新增常用商品，或导入商品表后再制作单据和目录。',action:'new-product',label:'新增商品'},
    documents:{selector:'#document-list',title:'暂无业务单据',text:'可以从客户和商品资料开始创建报价单、形式发票或其他单据。',action:'new-doc',label:'新建单据'},
    brands:{selector:'#brand-list',title:'暂无品牌资料',text:'建立卖方主体后，可以在单据、目录和邮件中重复使用。',action:'new-brand',label:'新增品牌'},
    templates:{selector:'#template-list',title:'模板正在加载',text:'系统正在整理可用模板。长期没有内容时，请刷新或检查账号连接。',action:'open-template-center',label:'打开模板中心'},
    notifications:{selector:'#fp-notification-center-mount',title:'通知中心正在加载',text:'正在读取机器人通道、事件规则和发送记录。',action:'notification-open-wizard',label:'连接机器人'},
    recycle:{selector:'#recycle-list',title:'回收站暂无记录',text:'已删除的客户、商品、业务和单据会在这里显示。',action:'load-recycle',label:'刷新回收站'},
    mail:{selector:'#mail-center-view',title:'邮件草稿正在加载',text:'可以根据客户、单据或目录生成需要人工确认的邮件草稿。',action:'compose-mail',label:'生成草稿'},
    ai:{selector:'#ai-workbench-view',title:'智能录入正在准备',text:'上传资料后，系统会先生成候选字段，确认后才写入正式资料。',action:'ai-beta',label:'开始识别'},
    guide:{selector:'#feature-guide-view',title:'使用说明正在加载',text:'正在整理当前账号可用的功能和操作步骤。'}
  };
  function fallbackMarkup(meta){
    const action=meta.action?`<div class="fp32-empty-actions"><button type="button" class="${meta.action==='new-doc'?'primary':''}" data-action="${meta.action}">${meta.label}</button></div>`:'';
    return `<div class="fp32-fallback-empty" data-fp32-fallback="true"><div><strong>${meta.title}</strong><span>${meta.text}</span>${action}</div></div>`;
  }
  function nodeHasRealContent(node){
    if(!node)return false;
    const children=[...node.children].filter(el=>!el.matches('[data-fp32-fallback]'));
    if(children.length)return true;
    return clean(node.textContent).length>0 && !qs('[data-fp32-fallback]',node);
  }
  function ensureWorkspaceFallbacks(){
    if(surface()!=='workspace')return;
    const view=currentWorkspaceView();
    const meta=fallbacks[view];if(!meta)return;
    const node=qs(meta.selector);if(!node)return;
    const existing=qs(':scope > [data-fp32-fallback]',node);
    if(nodeHasRealContent(node)){existing?.remove();return;}
    if(!existing)node.insertAdjacentHTML('beforeend',fallbackMarkup(meta));
  }
  function removeStaleFallbacks(){
    qsa('[data-fp32-fallback]').forEach(fallback=>{
      const parent=fallback.parentElement;if(!parent)return;
      const real=[...parent.children].some(child=>child!==fallback&&!child.matches('[data-fp32-fallback]'));
      if(real)fallback.remove();
    });
  }
  function updateWorkspaceView(){
    if(surface()!=='workspace')return;
    const view=currentWorkspaceView();document.body.dataset.fpWorkspaceView=view;
    const meta=viewMeta[view];if(meta){const title=qs('#page-title'),desc=qs('#eyebrow');if(title)title.textContent=meta[0];if(desc)desc.textContent=meta[1];}
    setTimeout(ensureWorkspaceFallbacks,700);
  }
  function improveDocumentStart(){
    if(surface()!=='document-start')return;
    const details=qs('.doc-start-more-settings');
    if(details){
      if(innerWidth>=900)details.open=true;
      const kicker=qs('#type-section-kicker',details);if(kicker)kicker.textContent='单据设置';
      const title=qs('#type-section-title',details);if(title)title.textContent='填写编号、有效期、贸易术语、交货期和备注';
    }
    const summary=qs('#start-summary');
    if(summary&&!clean(summary.textContent))summary.innerHTML='<span data-state="ready">单据类型已选择</span><span data-state="wait">客户待选择</span><span data-state="wait">品牌待选择</span><span data-state="ready">语言与币种可调整</span><span data-state="wait">商品待选择</span>';
    const picker=qs('#product-picker');
    if(picker&&!clean(picker.textContent)&&!picker.children.length){
      picker.innerHTML='<div class="fp32-fallback-empty" data-fp32-fallback="true"><div><strong>正在读取商品资料</strong><span>没有商品时，可先返回商品资料库新增或导入；也可以直接进入空白单据。</span><div class="fp32-empty-actions"><a href="./workspace.html#products">打开商品资料库</a></div></div></div>';
    }
  }
  function improveEditor(){
    if(surface()!=='editor')return;
    const paper=qs('#piPaper');
    if(paper&&!paper.hasAttribute('aria-live')){paper.setAttribute('aria-live','polite');paper.setAttribute('aria-label','单据预览');}
    const delivery=qs('#deliveryTime');if(delivery){delivery.setAttribute('title','填写预计交货时间或交期说明');}
    const preview=qs('.preview-shell');if(preview&&!qs('.preview-toolbar',preview)?.getAttribute('aria-label'))qs('.preview-toolbar',preview)?.setAttribute('aria-label','预览工具');
  }
  function improveButtons(root=document){
    qsa('button,a,summary',root).forEach(el=>{
      const text=clean(el.textContent)||clean(el.getAttribute('aria-label'))||clean(el.getAttribute('title'));
      if(text&&!el.title&&text.length<=80)el.title=text;
    });
    qsa('button.close,[data-empty-dialog-close],[data-close-template],.modal-close,.dialog-close',root).forEach(el=>{
      if(!el.getAttribute('aria-label'))el.setAttribute('aria-label','关闭');
      el.setAttribute('type',el.getAttribute('type')||'button');
    });
  }
  function closeFallback(event){
    const close=event.target.closest('[data-empty-dialog-close],[data-close-template],button.close,.modal-close,.dialog-close,[data-fp-close]');
    if(!close)return;
    const dialog=close.closest('dialog');
    if(dialog?.open){event.preventDefault();event.stopPropagation();try{dialog.close();}catch(_){dialog.removeAttribute('open');}document.documentElement.classList.remove('fp30-dialog-open');document.body.classList.remove('fp30-dialog-open');}
  }
  function backdropClose(event){
    const dialog=event.target.closest('dialog[data-close-on-backdrop="true"]');
    if(dialog&&event.target===dialog&&dialog.open){try{dialog.close();}catch(_){dialog.removeAttribute('open');}}
  }
  function upgradeNotificationFallback(){
    if(surface()!=='workspace'||currentWorkspaceView()!=='notifications')return;
    const fallback=qs('#fp-notification-center-mount [data-fp32-fallback]');
    if(!fallback||window.FlypigBOXNotificationWorkspace)return;
    const strong=qs('strong',fallback),span=qs('span',fallback),button=qs('[data-action]',fallback);
    if(strong)strong.textContent='通知模块没有完整启动';
    if(span)span.textContent='当前只是加载占位页。请重新加载通知模块；机器人和后台配置不会被删除。';
    if(button){button.dataset.action='notification-reload-module';button.textContent='重新加载通知模块';}
  }
  function apply(){
    const s=surface();
    document.body.dataset.fpRegressionClosure=RELEASE;
    document.body.dataset.fpSurface=s;
    document.body.dataset.fpRelease='v3.3.6.24-r1.3a.18.32-workspace-visual-interaction-regression-candidate';
    if(s==='workspace'){updateWorkspaceView();setTimeout(upgradeNotificationFallback,1800);}
    if(s==='document-start')improveDocumentStart();
    if(s==='editor')improveEditor();
    improveButtons();removeStaleFallbacks();
  }
  let timer=0;
  const observer=new MutationObserver(records=>{
    if(!records.some(record=>record.addedNodes.length||record.removedNodes.length))return;
    clearTimeout(timer);timer=setTimeout(()=>{removeStaleFallbacks();improveButtons();if(surface()==='workspace'){updateWorkspaceView();upgradeNotificationFallback();}},120);
  });
  document.addEventListener('click',event=>{
    closeFallback(event);backdropClose(event);
    if(event.target.closest('[data-view]'))setTimeout(updateWorkspaceView,30);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const dialogs=qsa('dialog[open]');const dialog=dialogs.at(-1);if(dialog){try{dialog.close();}catch(_){dialog.removeAttribute('open');}}
  },true);
  document.addEventListener('HUIDI:workspace-rendered',()=>setTimeout(()=>{updateWorkspaceView();ensureWorkspaceFallbacks();},80));
  function start(){apply();observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{ensureWorkspaceFallbacks();removeStaleFallbacks();upgradeNotificationFallback();},1200);setTimeout(upgradeNotificationFallback,3200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
