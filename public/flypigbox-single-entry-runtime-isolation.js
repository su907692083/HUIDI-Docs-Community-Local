/* HUIDI V3.3.6.24-R1.3A.18.19.1 — single smart entry runtime isolation. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.19.1-SINGLE-ENTRY-RUNTIME-ISOLATION.1';
  if(window.FlypigBOXSingleEntryRuntimeIsolation?.version===VERSION)return;

  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const LEGACY_SELECTORS=[
    '#ai-workbench-view',
    '#fp-a17-engine-center',
    '#fp-a18-job-center',
    '#fp-one-click-task-center',
    '#fp-task-resume',
    '.ai-pending-center-v33612',
    '.ai-connection-strip-v33612',
    '.ai-capability-grid-v2'
  ];
  const REDIRECT_SELECTOR=[
    '[data-fp-ai-open-center]',
    '[data-fp-ai-widget-open]',
    '[data-fp-one-click]',
    '[data-fp-resume-task]',
    '.fp-ai-launcher',
    '#fp-a17-engine-center button',
    '#fp-a18-job-center button'
  ].join(',');
  const PUBLIC_ID_PATTERN=/\b(?:cache|local|task)[-_:]+([a-z0-9][a-z0-9._-]{1,})/gi;
  const EXCLUDED_TEXT_PARENTS=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','OPTION','PRE','CODE']);
  let launcherPointer=null;
  let scheduled=false;
  const pendingRoots=new Set();

  function hideNode(node){
    if(!node)return;
    if(!node.hidden)node.hidden=true;
    if(node.getAttribute('aria-hidden')!=='true')node.setAttribute('aria-hidden','true');
    if('inert' in node&&!node.inert)node.inert=true;
    if(node.dataset.fpbLegacySurface!=='hidden')node.dataset.fpbLegacySurface='hidden';
  }

  function isolateLegacySurface(root=document){
    const aiRoot=$('#ai-workbench-view');
    hideNode(aiRoot);
    for(const selector of LEGACY_SELECTORS.slice(1)){
      $$(selector,root).forEach(hideNode);
    }
    const host=$('#fp-smart-processing-panel-host');
    if(host){
      host.hidden=false;
      host.removeAttribute('aria-hidden');
      if('inert' in host)host.inert=false;
    }
  }

  function cleanPublicText(value){
    return String(value??'').replace(PUBLIC_ID_PATTERN,'$1');
  }

  function sanitizeTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||EXCLUDED_TEXT_PARENTS.has(parent.tagName))return;
    if(parent.closest('#ai-workbench-view,[data-fpb-legacy-surface="hidden"]'))return;
    const original=node.nodeValue||'';
    const cleaned=cleanPublicText(original);
    if(cleaned!==original)node.nodeValue=cleaned;
  }

  function sanitizeAttributes(root=document){
    const nodes=[];
    if(root.nodeType===Node.ELEMENT_NODE)nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll('[title],[aria-label]'));
    nodes.forEach(node=>{
      for(const name of ['title','aria-label']){
        if(!node.hasAttribute?.(name))continue;
        const original=node.getAttribute(name)||'';
        const cleaned=cleanPublicText(original);
        if(cleaned!==original)node.setAttribute(name,cleaned);
      }
    });
  }

  function sanitizePublicSurface(root=document){
    const scope=root.nodeType===Node.DOCUMENT_NODE?document.body:root;
    if(!scope)return;
    if(scope.nodeType===Node.TEXT_NODE){sanitizeTextNode(scope);return;}
    if(scope.nodeType===Node.ELEMENT_NODE&&!scope.closest('#ai-workbench-view')){
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      nodes.forEach(sanitizeTextNode);
      sanitizeAttributes(scope);
    }
  }

  function switchToSmartView(){
    const aiButton=$('[data-view="ai"]');
    if(aiButton&&document.body?.dataset?.workspaceView!=='ai')aiButton.click();
    document.body.dataset.workspaceView='ai';
    const aiSection=$('#ai');
    if(aiSection&&!aiSection.classList.contains('active')){
      $$('.view.active').forEach(node=>node.classList.remove('active'));
      aiSection.classList.add('active');
    }
  }

  function transferPendingText(){
    const target=$('#fp-os-task-form [name="os_task_text"]');
    if(!target||String(target.value||'').trim())return target;
    let text='';
    try{text=sessionStorage.getItem('flypigbox_ai_pending_text_v1')||'';}catch(_){text='';}
    if(!text)text=$('#fp-ai-pending-input')?.value||$('#fp-ai-center-pending')?.value||'';
    if(text){
      target.value=text;
      target.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return target;
  }

  function openPrimaryEntry({focus=true}={}){
    switchToSmartView();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      isolateLegacySurface();
      const panel=$('#fp-founder-os-task-panel');
      const target=transferPendingText()||$('#fp-os-task-form [name="os_task_text"]');
      (panel||$('#fp-smart-processing-panel-host'))?.scrollIntoView?.({behavior:'smooth',block:'start'});
      if(focus)target?.focus?.({preventScroll:true});
    }));
  }

  function schedule(root=document.body){
    if(root)pendingRoots.add(root);
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      isolateLegacySurface();
      const roots=Array.from(pendingRoots);
      pendingRoots.clear();
      roots.forEach(sanitizePublicSurface);
    });
  }

  function bind(){
    window.addEventListener('pointerdown',event=>{
      if(!event.target.closest?.('.fp-ai-launcher'))return;
      launcherPointer={x:event.clientX,y:event.clientY,moved:false};
    },true);
    window.addEventListener('pointermove',event=>{
      if(!launcherPointer)return;
      if(Math.hypot(event.clientX-launcherPointer.x,event.clientY-launcherPointer.y)>7)launcherPointer.moved=true;
    },true);
    window.addEventListener('pointerup',()=>{
      if(!launcherPointer)return;
      setTimeout(()=>{launcherPointer=null;},0);
    },true);
    window.addEventListener('click',event=>{
      const trigger=event.target.closest?.(REDIRECT_SELECTOR);
      if(!trigger||trigger.closest('#fp-founder-os-task-panel'))return;
      if(trigger.matches('.fp-ai-launcher')&&launcherPointer?.moved)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPrimaryEntry();
    },true);
  }

  function observe(){
    const observer=new MutationObserver(mutations=>{
      let legacyChanged=false;
      for(const mutation of mutations){
        const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
        if(target?.closest?.('#fp-founder-os-task-panel'))continue;
        if(target?.closest?.('#ai-workbench-view')){
          legacyChanged=true;
          continue;
        }
        for(const node of mutation.addedNodes||[]){
          if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.TEXT_NODE)continue;
          const parent=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
          if(parent?.closest?.('#fp-founder-os-task-panel,#ai-workbench-view'))continue;
          schedule(node);
        }
      }
      if(legacyChanged)schedule(null);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    return observer;
  }

  function boot(){
    document.documentElement.dataset.fpbSingleEntryRuntime='true';
    isolateLegacySurface();
    sanitizePublicSurface(document.body);
    bind();
    const observer=observe();
    window.FlypigBOXSingleEntryRuntimeIsolation=Object.freeze({
      version:VERSION,
      open:openPrimaryEntry,
      isolate:isolateLegacySurface,
      sanitize:sanitizePublicSurface,
      observer
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
