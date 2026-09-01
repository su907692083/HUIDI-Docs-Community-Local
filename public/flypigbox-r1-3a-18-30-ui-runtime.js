(()=>{
  'use strict';
  if(window.__FP30_UI_RUNTIME__) return;
  window.__FP30_UI_RUNTIME__=true;
  const VERSION='R1.3A.18.33';
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const visible=el=>!!(el&&el.isConnected&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden');
  const layerSelector='dialog,[role="dialog"],.modal,.dialog,.overlay,[class*="modal-overlay"],[class*="dialog-overlay"],[class*="wizard-overlay"]';
  function layers(){return qsa(layerSelector).filter(visible)}
  function unlock(){
    if(layers().length) return;
    document.documentElement.classList.remove('fp30-dialog-open');
    document.body?.classList.remove('fp30-dialog-open','workspace-dialog-open','modal-open','dialog-open','no-scroll','is-locked');
    if(document.body){document.body.style.removeProperty('top');document.body.style.removeProperty('overflow');document.body.style.removeProperty('padding-right');}
  }
  function closeLayer(layer){
    if(!layer) return false;
    try{ if(layer.tagName==='DIALOG'&&layer.open){layer.close();} }
    catch(_){ layer.removeAttribute('open'); }
    layer.classList.remove('show','open','is-open','active','visible');
    layer.setAttribute('aria-hidden','true');
    if(layer.dataset.removeOnClose==='true') layer.remove();
    setTimeout(unlock,0);
    return true;
  }
  function topLayer(){return layers().sort((a,b)=>(parseInt(getComputedStyle(a).zIndex)||0)-(parseInt(getComputedStyle(b).zIndex)||0)).pop()}
  function toast(message,type=''){
    let el=qs('#fp30-global-toast');
    if(!el){el=document.createElement('div');el.id='fp30-global-toast';el.className='fp30-toast';el.setAttribute('role','status');document.body.append(el);}
    el.textContent=String(message||'');el.className=`fp30-toast ${type}`.trim();requestAnimationFrame(()=>el.classList.add('show'));
    clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2800);
  }
  function setBusy(button,busy=true,label='处理中…'){
    if(!button) return;
    if(busy){button.dataset.fp30OriginalText=button.textContent;button.disabled=true;button.classList.add('is-busy');button.textContent=label;}
    else{button.disabled=false;button.classList.remove('is-busy');if(button.dataset.fp30OriginalText){button.textContent=button.dataset.fp30OriginalText;delete button.dataset.fp30OriginalText;}}
  }
  const exactTerms=new Map([
    ['PLATFORM NOTIFICATIONS','平台通知'],['FEATURE · ADVANTAGE · BENEFIT','功能价值'],['FEATURE • ADVANTAGE • BENEFIT','功能价值'],
    ['Factory Execution','生产执行'],['CONFIDENTIAL','内部资料'],['Runtime','运行服务'],['Gateway','连接服务']
  ]);
  const replacements=[
    [/\bWebhook\b/g,'机器人连接地址'],[/\bApp Secret\b/g,'应用密钥'],[/\bToken\b/g,'登录凭据'],[/\bEdge Function\b/g,'云端服务'],
    [/\bSupabase\b/g,'云端数据服务'],[/\bJSON\b/g,'数据文件'],[/\bAPI Key\b/g,'智能服务密钥'],[/\bAPI\b/g,'智能服务']
  ];
  function plainText(root=document){
    const scopes=root===document?qsa('main,dialog,[role="dialog"],.el-dialog,.el-drawer,.app-shell,.site-header'): [root];
    for(const scope of scopes){
      if(!scope||scope.dataset?.fp30PlainDone==='1') continue;
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){
        const p=node.parentElement;if(!p||p.closest('script,style,code,pre,textarea,[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){let text=node.nodeValue;const trim=text.trim();if(exactTerms.has(trim)) text=text.replace(trim,exactTerms.get(trim));
        for(const [re,to] of replacements) text=text.replace(re,to);node.nodeValue=text;}
      qsa('input[placeholder],textarea[placeholder]',scope).forEach(el=>{let v=el.getAttribute('placeholder')||'';for(const [re,to] of replacements)v=v.replace(re,to);el.setAttribute('placeholder',v)});
    }
  }

  function aiCapsule(){
    const widget=qs('#fp-ai-widget');if(!widget)return;
    const enabled=window.__FLYPIGBOX_AI_ENTRY_ENABLED__===true;
    widget.hidden=!enabled;
    widget.setAttribute('aria-hidden',enabled?'false':'true');
    widget.style.display=enabled?'':'none';
    if(!enabled)return;
    widget.removeAttribute('data-position');widget.removeAttribute('data-panel-direction');
    widget.style.removeProperty('left');widget.style.removeProperty('right');widget.style.removeProperty('top');widget.style.removeProperty('bottom');
    const launcher=qs('.fp-ai-launcher',widget);if(launcher&&!qs('.fp30-ai-label',launcher)){
      const label=document.createElement('span');label.className='fp30-ai-label';label.textContent='AI秘书';launcher.insertBefore(label,qs('.fp-ai-dot',launcher));
      launcher.setAttribute('aria-label','打开或收起 AI 秘书');launcher.title='AI秘书';
    }
    const panel=qs('.fp-ai-panel',widget),head=qs('.fp-ai-head',widget);
    if(panel&&head&&!qs('.fp30-ai-mode-switch',panel)){
      const connected=launcher?.classList.contains('is-connected');
      const mode=(()=>{try{return sessionStorage.getItem('flypigbox_ai_mode')||'default'}catch(_){return'default'}})();
      const switcher=document.createElement('div');switcher.className='fp30-ai-mode-switch';
      switcher.innerHTML=`<button type="button" data-fp30-ai-mode="default">默认模式</button><button type="button" data-fp30-ai-mode="smart" ${connected?'':'disabled'}>${connected?'智能模式':'智能模式 · 待连接'}</button>`;
      head.after(switcher);
      const setMode=value=>{const next=value==='smart'&&connected?'smart':'default';qsa('[data-fp30-ai-mode]',switcher).forEach(b=>b.classList.toggle('active',b.dataset.fp30AiMode===next));try{sessionStorage.setItem('flypigbox_ai_mode',next)}catch(_){};widget.dataset.aiMode=next;document.dispatchEvent(new CustomEvent('HUIDI:ai-mode-change',{detail:{mode:next}}));};
      switcher.addEventListener('click',e=>{const b=e.target.closest('[data-fp30-ai-mode]');if(b&&!b.disabled)setMode(b.dataset.fp30AiMode)});setMode(mode);
    }
  }

  function polish(root=document){
    qsa(layerSelector,root).forEach(layer=>{if(layer.dataset.fp30Polished)return;layer.dataset.fp30Polished='1';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');});
    qsa('.close,.modal-close,.dialog-close,.fp-v8-close,[data-action^="close-"]',root).forEach(btn=>{if(!btn.getAttribute('aria-label'))btn.setAttribute('aria-label','关闭');if(!btn.title)btn.title='关闭';});
    plainText(root);
    aiCapsule();
  }
  document.addEventListener('click',event=>{
    const close=event.target.closest('.close,.modal-close,.dialog-close,.fp-v8-close,[data-fp-close],[data-action="cancel"],[data-action^="close-"],[data-apn-action="close-modal"]');
    if(close){const layer=close.closest(layerSelector);if(layer){window.setTimeout(()=>{if(visible(layer))closeLayer(layer)},20);return;}}
    const layer=event.target.matches?.(layerSelector)?event.target:null;
    if(layer&&event.target===layer&&(layer.dataset.closeOnBackdrop!=='false')){window.setTimeout(()=>{if(visible(layer))closeLayer(layer)},20);}
  });
  document.addEventListener('keyup',event=>{if(event.key==='Escape'){const layer=topLayer();if(layer)window.setTimeout(()=>{if(visible(layer))closeLayer(layer)},20);}});
  let timer=0;const observer=new MutationObserver(records=>{if(!records.some(r=>r.addedNodes.length||r.removedNodes.length))return;clearTimeout(timer);timer=setTimeout(()=>{polish(document);unlock();},90)});
  const start=()=>{document.body?.setAttribute('data-fp-ui-closure',VERSION);polish(document);observer.observe(document.body,{childList:true,subtree:true});setInterval(unlock,1800);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.FlypigBOXUI30={version:VERSION,closeLayer,toast,setBusy,polish,unlock};
})();
