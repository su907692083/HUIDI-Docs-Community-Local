(()=>{
  'use strict';
  if(window.__FP30_WORKSPACE_CLOSURE__)return;
  window.__FP30_WORKSPACE_CLOSURE__=true;
  const UI=()=>window.FlypigBOXUI30;
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??'').trim();
  const modules={
    dashboard:{title:'工作台',desc:'查看待处理、最近工作和常用入口。',status:'汇总客户、商品、业务和单据进度。',next:'优先处理待办，再继续最近工作。',action:'new-deal',label:'记录新询盘'},
    deals:{title:'业务中心',desc:'管理询盘、报价机会、订单确认和后续跟进。',status:'业务记录与客户、商品和单据保持关联。',next:'先补负责人和下一步，再制作报价或确认订单。',action:'new-deal',label:'记录新询盘'},
    customers:{title:'客户中心',desc:'管理客户主体、联系人、邮箱、负责人和跟进信息。',status:'保存前会保留原资料，不会因名称相同自动覆盖。',next:'优先补齐邮箱、国家和负责人。',action:'new-customer',label:'新增客户'},
    products:{title:'商品资料库',desc:'维护SKU、图片、价格、规格和包装资料。',status:'缺图或缺少普通字段会提示，但不会阻断建档。',next:'先整理常用商品，再用于报价和产品目录。',action:'new-product',label:'新增商品'},
    catalog:{title:'产品目录',desc:'从商品资料生成客户选品目录和目录文件。',status:'目录与商品主资料保持引用，导出前可以继续核对。',next:'选择商品、客户和语言后生成目录。',view:'products',label:'选择商品'},
    documents:{title:'单据中心',desc:'管理报价单、形式发票、合同、商业发票和装箱单。',status:'缺少普通字段时提示风险，用户确认后仍可导出。',next:'先检查待完善单据，再新建正式文件。',action:'new-doc',label:'新建单据'},
    brands:{title:'品牌中心',desc:'管理卖方主体、品牌、Logo和对外联系信息。',status:'品牌资料会用于单据、目录和邮件署名。',next:'至少建立一个常用对外主体。',action:'new-brand',label:'新增品牌'},
    templates:{title:'模板中心',desc:'管理系统模板、私有模板和导入字段对应。',status:'模板只控制显示和复用，不会覆盖业务主资料。',next:'先复制系统模板，再按企业习惯调整。',action:'open-template-center',label:'打开模板'},
    notifications:{title:'通知与协同',desc:'管理飞书、企微、角色、事件规则和送达记录。',status:'机器人消息用于提醒，正式资料仍保存在工作台。',next:'先连接机器人，再用演示事件验证。',action:'notification-open-wizard',label:'连接机器人'},
    recycle:{title:'回收站',desc:'恢复误删的客户、商品、业务、单据和模板。',status:'恢复不会自动覆盖已有同名资料。',next:'核对对象和删除时间后再恢复。',action:'load-recycle',label:'刷新回收站'},
    mail:{title:'邮件草稿',desc:'根据客户、单据或目录准备可审核的邮件内容。',status:'当前负责生成草稿，不会未经确认自动发送。',next:'选择客户和业务场景，生成后人工核对。',action:'compose-mail',label:'生成草稿'},
    ai:{title:'智能录入',desc:'识别客户、商品、询盘和文件中的候选字段。',status:'识别结果先进入候选状态，不会直接覆盖正式资料。',next:'上传资料后逐项确认，再保存到对应模块。',action:'ai-beta',label:'开始识别'}
  };
  function currentView(){return document.body.dataset.workspaceView||qs('.view.active')?.id||'dashboard'}
  function countFor(view){
    const selectors={deals:'#deal-list>*',customers:'#customer-list>*',products:'#product-list>*',documents:'#document-list>*',brands:'#brand-list>*',recycle:'#recycle-list>*'};
    const sel=selectors[view];if(!sel)return '';
    const count=qsa(sel).filter(el=>!el.classList.contains('empty')).length;return count?`当前显示 ${count} 条记录`:'当前暂无可显示记录';
  }
  function guide(view){
    const root=qs(`#${view}.view`);const meta=modules[view];if(!root||!meta||view==='dashboard')return;
    let bar=qs(':scope > .fp30-module-guide',root);
    if(!bar){bar=document.createElement('section');bar.className='fp30-module-guide';root.prepend(bar);}
    const action=meta.action?`data-action="${meta.action}"`:`data-view="${meta.view}"`;
    bar.innerHTML=`<div><small>本页用途</small><b>${meta.desc}</b><span>${meta.status}</span></div><div><small>当前状态</small><b>${countFor(view)||'已进入当前模块'}</b><span>数据变化会保留操作记录。</span></div><div><small>建议下一步</small><b>${meta.next}</b><button type="button" ${action}>${meta.label} →</button></div>`;
  }
  function topbar(view){const meta=modules[view];if(!meta)return;const title=qs('#page-title'),eyebrow=qs('#eyebrow');if(title)title.textContent=meta.title;if(eyebrow)eyebrow.textContent=meta.desc;}
  function normalizeActions(){
    qsa('.section-head .actions').forEach(group=>{const buttons=qsa('button,a',group).filter(el=>!el.hidden);let primarySeen=false;buttons.forEach(btn=>{if(btn.classList.contains('primary')){if(primarySeen){btn.classList.remove('primary');btn.classList.add('secondary')}primarySeen=true;}})});
    qsa('.topbar-actions .btn').forEach((btn,index)=>{if(index>2)btn.classList.add('fp30-desktop-only')});
  }
  function enhanceEmpty(view){
    const actionMap={deals:['记录新询盘','new-deal'],customers:['新增客户','new-customer'],products:['新增商品','new-product'],documents:['新建单据','new-doc'],brands:['新增品牌','new-brand'],mail:['生成邮件草稿','compose-mail'],notifications:['连接机器人','notification-open-wizard'],recycle:['刷新记录','load-recycle']};
    const pair=actionMap[view];if(!pair)return;
    qsa(`#${view} .empty`).forEach(empty=>{if(qs('button,a',empty)||qs('.fp30-empty-action',empty))return;const wrap=document.createElement('div');wrap.className='fp30-empty-action';wrap.innerHTML=`<button type="button" data-action="${pair[1]}">${pair[0]}</button>`;empty.append(wrap);});
  }
  function cleanupTechnical(){
    qsa('[data-engine-debug],.engine-debug,.runtime-debug,.api-advanced-note').forEach(el=>el.classList.add('fp-technical-only'));
    const brand=qs('.brand small');if(brand&&/B2B|Trade|Workspace/i.test(brand.textContent))brand.textContent='外贸业务协同';
  }
  function apply(){const view=currentView();document.body.dataset.fpWorkspaceClosure='18.30';topbar(view);guide(view);normalizeActions();enhanceEmpty(view);cleanupTechnical();UI()?.polish?.(document);}
  document.addEventListener('click',event=>{if(event.target.closest('[data-view],[data-action]'))setTimeout(apply,40)},true);
  document.addEventListener('HUIDI:workspace-rendered',()=>setTimeout(apply,0));
  window.addEventListener('hashchange',()=>setTimeout(apply,30));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
