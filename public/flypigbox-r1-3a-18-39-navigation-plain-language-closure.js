/* HUIDI R1.3A.18.39 — navigation, plain-language and visual continuity closure */
(()=>{'use strict';
  const doc=document, VERSION='R1.3A.18.39';
  const $=(s,r=doc)=>r?.querySelector?.(s)||null;
  const $$=(s,r=doc)=>[...(r?.querySelectorAll?.(s)||[])];
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const surface=()=>doc.body?.classList.contains('fp-v3368-workspace')?'workspace':doc.body?.dataset.fpSurface||'';
  doc.documentElement.dataset.fp39='enabled';

  const exactCopy=new Map([
    ['工作台首页','首页'],
    ['智能录入','资料整理'],
    ['智能录入 AI','资料整理'],
    ['AI 翻译','翻译辅助'],
    ['AI翻译','翻译辅助'],
    ['AI 翻译额度','翻译辅助额度'],
    ['AI 工作台（内测）','辅助整理（测试中）'],
    ['AI 商品资料整理','商品资料整理'],
    ['AI 图片优化','图片辅助整理'],
    ['AI 商品文案生成','商品文案辅助'],
    ['AI 批量翻译','批量翻译辅助'],
    ['AI 待处理区','待处理资料'],
    ['AI功能状态','辅助功能状态'],
    ['当前 AI 能力仍在内测，结果需要人工确认。','翻译辅助仍在测试，使用前请核对结果。'],
    ['简单资料先在本机整理','普通资料直接整理'],
    ['本机整理可用','基础整理可用'],
    ['只用本机整理','只用基础整理'],
    ['正在智能整理','正在整理资料'],
    ['智能整理已可用','增强整理可用'],
    ['正在检查智能服务','正在确认可用功能'],
    ['智能处理服务尚未就绪，请先检查服务。','增强整理暂不可用，请稍后再试。'],
    ['只生成待确认结果，需要人工核对','先预览确认，再保存到资料'],
    ['系统只生成待确认结果。','整理结果会先进入预览，确认后再保存。'],
    ['所有结果都不会自动写入正式业务资料。','整理结果会先进入预览，确认后再保存到正式资料。'],
    ['扩展能力','辅助工具'],
    ['配置与资产','设置与资料'],
    ['核心工作','日常工作'],
    ['商品资料库','商品资料'],
    ['品牌中心','品牌资料'],
    ['模板中心','单据模板']
  ]);

  const regexCopy=[
    [/云端账号、AI 翻译、邮件草稿与会员功能/g,'账号同步、翻译辅助、邮件草稿与会员功能'],
    [/AI、邮件和支付未接入时/g,'翻译辅助、邮件和支付未接入时'],
    [/复杂内容才使用已连接的智能服务，所有结果都要人工核对。/g,'复杂内容会自动选择合适的处理方式，保存前仍由你确认。'],
    [/简单资料在本机整理；增强整理等待连接。所有结果都不会自动写入正式业务资料。/g,'普通资料可直接整理；复杂资料会按当前可用能力处理。结果先预览，确认后再保存。'],
    [/本机整理可用，增强整理等待连接/g,'基础整理可用，增强整理暂不可用'],
    [/增强整理等待连接/g,'增强整理暂不可用'],
    [/增强整理需要重新登录/g,'请重新登录后使用增强整理'],
    [/文本、CSV和Excel可立即识别；增强处理等待开放/g,'常见文本和表格可直接整理；复杂资料按可用能力处理'],
    [/当前不会上传内容、调用模型或扣除AI次数。AI功能开放后，仍需先检查账号权限和任务额度，再由用户确认写入客户、商品、业务或单据。/g,'当前内容仅用于本次整理。结果需要你确认后，才会写入客户、商品、业务或单据。'],
    [/AI结果必须人工确认；系统不会自动猜测价格、银行账户、付款条款，也不会自动发送邮件或修改正式单据。/g,'辅助整理结果需要人工确认；系统不会自动猜测价格、银行账户或付款条款，也不会自动发送邮件或修改正式单据。']
  ];

  function replaceTextValue(value){
    let out=value;
    const trimmed=clean(value);
    if(exactCopy.has(trimmed)){
      const before=value.indexOf(trimmed);
      return value.slice(0,before)+exactCopy.get(trimmed)+value.slice(before+trimmed.length);
    }
    regexCopy.forEach(([re,to])=>{out=out.replace(re,to)});
    return out;
  }

  function plainLanguageSweep(root=doc.body){
    if(!root)return;
    const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;
      if(!p||p.closest('script,style,code,pre,textarea,input,select,option,#piPaper,.pdf-page,.pdf-template'))return NodeFilter.FILTER_REJECT;
      if(p.closest('.fp-technical-only,[data-fp-technical]'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const next=replaceTextValue(node.nodeValue||'');if(next!==node.nodeValue)node.nodeValue=next});

    // Common placeholders / values that are visible but not text nodes.
    $$('input[placeholder],textarea[placeholder]',root).forEach(el=>{
      let v=el.getAttribute('placeholder')||'';
      v=v.replace(/智能录入/g,'资料整理').replace(/智能处理/g,'资料整理').replace(/AI\s*/g,'');
      el.setAttribute('placeholder',v);
    });
  }

  function navGroupLabel(group,index){
    if(index===0)return'日常工作';
    if(index===1)return'设置与资料';
    return'辅助工具';
  }
  function activeView(){return doc.body?.dataset.workspaceView||$('.view.active')?.id||'dashboard';}
  function navStorageKey(index){return `HUIDI:nav-group:18.39:${index}`;}
  function ensureNavigation(){
    if(surface()!=='workspace')return;
    const nav=$('#nav');if(!nav)return;
    const groups=$$('.nav-group',nav);
    groups.forEach((group,index)=>{
      let title=$(':scope>.nav-group-title',group);
      if(title)title.textContent=navGroupLabel(group,index);
      if(index===0)return;
      if(!$('.fp39-nav-group-toggle',group)){
        const toggle=doc.createElement('button');
        toggle.type='button';toggle.className='fp39-nav-group-toggle';
        toggle.innerHTML=`<span>${navGroupLabel(group,index)}</span><span aria-hidden="true">⌄</span>`;
        title?.replaceWith(toggle);
        const saved=sessionStorage.getItem(navStorageKey(index));
        const containsActive=Boolean($('[data-view].active',group));
        const defaultCollapsed=index===2;
        group.dataset.fp39Collapsed=String(containsActive?false:(saved===null?defaultCollapsed:saved==='1'));
        toggle.setAttribute('aria-expanded',String(group.dataset.fp39Collapsed!=='true'));
        toggle.addEventListener('click',()=>{
          const collapsed=group.dataset.fp39Collapsed!=='true';
          group.dataset.fp39Collapsed=String(collapsed);
          toggle.setAttribute('aria-expanded',String(!collapsed));
          try{sessionStorage.setItem(navStorageKey(index),collapsed?'1':'0')}catch(_){ }
        });
      }
    });

    const labelMap={dashboard:'首页',deals:'业务中心',orders:'订单中心',customers:'客户中心',products:'商品资料',documents:'单据中心',catalog:'产品目录',brands:'品牌资料',templates:'单据模板',notifications:'通知与协同',recycle:'回收站',mail:'邮件草稿',feishu:'飞书资料',ai:'资料整理'};
    Object.entries(labelMap).forEach(([view,label])=>{const b=$(`[data-view="${view}"]`,nav);if(b){b.textContent=label;b.title=label}});

    // Keep the daily flow in a predictable order even though orders is mounted dynamically.
    const reorder=(group,desired)=>{if(!group)return;const current=$$(':scope>[data-view]',group).map(b=>b.dataset.view);const wanted=desired.filter(view=>$(`[data-view="${view}"]`,nav));if(current.join('|')===wanted.join('|')&&current.length===wanted.length)return;wanted.forEach(view=>{const b=$(`[data-view="${view}"]`,nav);if(b&&b.parentElement!==group)group.appendChild(b);});const now=$$(':scope>[data-view]',group).map(b=>b.dataset.view);if(now.join('|')!==wanted.join('|'))wanted.forEach(view=>{const b=$(`[data-view="${view}"]`,group);if(b&&b!==group.lastElementChild)group.appendChild(b);});};
    const core=groups[0];reorder(core,['dashboard','deals','orders','customers','products','documents','catalog']);
    const settings=groups[1];reorder(settings,['brands','templates','notifications','recycle']);
    const tools=groups[2];reorder(tools,['mail','feishu','ai']);

    // The active module must never be hidden inside a collapsed group.
    groups.slice(1).forEach(group=>{
      if($('[data-view].active',group)){
        group.dataset.fp39Collapsed='false';
        $('.fp39-nav-group-toggle',group)?.setAttribute('aria-expanded','true');
      }
    });
  }

  function smartCaptureCopy(){
    if(surface()!=='workspace')return;
    const view=activeView();
    if(view!=='ai')return;
    const title=$('#page-title');if(title)title.textContent='资料整理';
    const eyebrow=$('#eyebrow');if(eyebrow)eyebrow.textContent='整理客户、商品、询盘和文件中的关键信息。';
    const head=$('.fp-os-task-head');
    if(head){
      const kicker=$('p',head);if(kicker)kicker.textContent='资料整理';
      const h=$('h3',head);if(h)h.textContent='提交资料，先查看结果，再确认保存';
      const s=$('span',head);if(s)s.textContent='普通资料可直接整理；复杂资料会按当前可用能力处理。结果先预览，确认后再保存。';
    }
    $$('.fp-os-task-connection small').forEach(el=>{el.textContent=el.textContent.replace(/ · \d+项功能/g,'')});
    const principle=$('.fp-os-task-options input[readonly]');if(principle)principle.value='先预览确认，再保存到资料';
    const localOption=$('.fp-os-task-options option[value="local"]');if(localOption)localOption.textContent='只用基础整理';
    const serviceOption=$('.fp-os-task-options option[value="service"]');if(serviceOption)serviceOption.textContent=serviceOption.disabled?'增强整理（暂不可用）':'增强整理';
    const safety=$('.fp-os-task-safety');if(safety)safety.textContent='保存前请核对关键字段；相同资料可以继续使用本次整理结果。';
  }

  function notificationCopy(){
    const wizard=$('#fpn-channel-wizard');if(!wizard)return;
    const intro=$('.fpn-modal-head p',wizard);if(intro)intro.textContent='选择你常用的通知群，页面会一步步告诉你在哪里复制机器人地址，并在保存前自动检查。';
    const formatLabel=$('.fpn-format-card span',wizard);if(formatLabel)formatLabel.textContent='机器人地址格式示例';
    $$('.fpn-platform-guide li',wizard).forEach(li=>{li.textContent=li.textContent.replace(/Webhook\s*\/\s*|Webhook\s*地址|Webhook/g,'机器人连接地址')});
    const safe=$('.fpn-note.safe',wizard);if(safe)safe.innerHTML='<b>安全说明：</b>机器人地址会加密保存，页面不会再次显示完整地址。';
  }

  function orderPickerCopy(){
    const dialog=$('#fp-order-picker-dialog');if(!dialog)return;
    const intro=$('header span',dialog);if(intro)intro.textContent='选择一条已确认的询盘，下一步再核对金额、交付日期和条款。';
    const items=$$('.fp-order-picker-item',dialog);
    items.forEach((item,index)=>{
      item.setAttribute('aria-label',`选择第 ${index+1} 条询盘：${clean($('b',item)?.textContent||'未命名询盘')}`);
      const amount=$('em',item);if(amount&&/^USD\s*0(?:\.0+)?$/.test(clean(amount.textContent)))amount.textContent='金额待确认';
      const small=$('small',item);if(small)small.textContent=small.textContent.replace(/new_inquiry/g,'新询盘').replace(/\s*·\s*询盘$/,' · 待确认');
    });
  }

  function publicHomeCopy(){
    if(surface()==='workspace')return;
    const aiCard=[...$$('.proof article')].find(card=>/AI\s*翻译|翻译辅助/.test(clean($('b',card)?.textContent)));
    if(aiCard){const b=$('b',aiCard);if(b)b.textContent='翻译辅助';const p=$('p',aiCard);if(p)p.textContent='需要翻译的说明内容可以辅助整理；公司主体、账号、金额和关键条款仍保留人工核对。';}
    const trust=$('.trust-line');if(trust)trust.textContent='账号同步、翻译辅助、邮件草稿与会员功能以实际可用状态为准；未开通时会明确提示。';
    const cta=$('.pilot p');if(cta&&cta.textContent)cta.textContent=cta.textContent.replace(/减少重复填写，让每一步都更容易跟进与核对。/,'减少重复填写，让客户、报价和单据始终接得上。');
  }

  function technicalResidueGuard(root=doc.body){
    if(!root)return;
    // Only guard ordinary-user surfaces; admin/advanced maintenance keeps its diagnostic wording.
    if(location.pathname.includes('/admin/'))return;
    $$('[data-fp-technical],.fp-technical-only',root).forEach(el=>el.classList.add('fp39-technical-hidden'));
    // Friendly text for any raw backend error that leaks into the normal notification wizard.
    $$('.fpn-note.danger,.notice,.form-error',root).forEach(el=>{
      const t=clean(el.textContent);
      if(/WEBHOOK_HOST_NOT_ALLOWED/.test(t))el.textContent='机器人地址不正确，请重新复制群机器人提供的连接地址。';
      if(/ROBOT_TEST_FAILED/.test(t))el.textContent='机器人已经保存，但测试消息没有送达。请检查机器人是否仍在群里，并重新测试。';
      if(/LOGIN_REQUIRED/.test(t))el.textContent='登录状态已失效，请重新登录后再试。';
    });
  }

  function sync(){
    plainLanguageSweep();ensureNavigation();smartCaptureCopy();notificationCopy();orderPickerCopy();publicHomeCopy();technicalResidueGuard();
    if(doc.body){doc.body.dataset.fpRelease='20260808-r1-3a-18-39';doc.body.dataset.fpVersionLabel=VERSION;}
  }

  let queued=false;
  function queueSync(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync()});}
  function init(){sync();
    doc.addEventListener('click',e=>{
      if(e.target.closest('[data-view], [data-sidecar-action="new-order"], [data-action^="notification-"]'))setTimeout(sync,0);
    },true);
    new MutationObserver(muts=>{if(muts.some(m=>!m.target?.closest?.('#piPaper')&&(m.addedNodes?.length||m.type==='characterData'||m.type==='attributes')))queueSync()}).observe(doc.body||doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','open','hidden','data-workspace-view']});
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
