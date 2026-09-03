/* HUIDI Docs Community Local RC16.17 — Single Toolbar Owner. */
(()=>{
  'use strict';
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.17-TOOLBAR-OWNER';
  const ORDER=[
    '#fpLiteImportBtn',
    '.fp-primary-workspace-switch',
    '#fpV3325DocSelect',
    '#fpV3321SaveHeader',
    '#huidiMasterSyncHeader',
    '#huidiLocalCheckHeader',
    '#fpV3321TemplateHeader',
    '#fpV3321ModeHeader',
    '#huidiLocalPaymentHeader',
    '#fpV3321FieldsHeader',
    '#fpV3325LayoutHeader',
    '#fpLiteExportMenu',
    '#huidiLocalNextHeader',
    '#fpV3325ClearHeader',
    '#fpLiteMoreMenu',
    '#huidiLocalStateBadge'
  ];
  let actions=null, observer=null, reconciling=false;
  const find=selector=>document.querySelector(selector);
  function indexOf(node){return ORDER.findIndex(selector=>node?.matches?.(selector));}
  function place(node){
    if(!actions||!node)return false;
    const idx=indexOf(node);if(idx<0)return false;
    let next=null;
    for(let i=idx+1;i<ORDER.length;i++){
      const candidate=find(ORDER[i]);
      if(candidate&&candidate!==node&&candidate.parentNode===actions){next=candidate;break;}
    }
    if(node.parentNode!==actions){actions.insertBefore(node,next);return true;}
    if(next&&node.nextElementSibling!==next){actions.insertBefore(node,next);return true;}
    if(!next){
      const later=[...actions.children].some(sib=>sib!==node&&indexOf(sib)>idx);
      if(later){actions.appendChild(node);return true;}
    }
    return false;
  }
  function signature(){return ORDER.map(selector=>find(selector)?.id||find(selector)?.className||'-').join('|');}
  function reconcile(){
    if(reconciling)return false;
    actions=document.querySelector('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return false;
    reconciling=true;observer?.disconnect?.();
    try{
      ORDER.forEach(selector=>{const node=find(selector);if(node)place(node);});
      actions.dataset.huidiToolbarOwner='rc1617';
      actions.dataset.huidiToolbarSignature=signature();
      document.getElementById('fpLiteToolbar')?.setAttribute('data-huidi-toolbar-stable','1');
    }finally{
      reconciling=false;
      observer?.observe?.(actions,{childList:true});
    }
    return true;
  }
  function lock(){
    actions=document.querySelector('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return false;
    if(!observer){observer=new MutationObserver(records=>{
      if(reconciling)return;
      const added=[];
      for(const record of records)for(const node of record.addedNodes||[])if(node?.nodeType===1)added.push(node);
      if(!added.length)return;
      requestAnimationFrame(()=>{for(const node of added)place(node);actions.dataset.huidiToolbarSignature=signature();});
    });}
    reconcile();return true;
  }
  function boot(){
    let tries=0;const run=()=>{tries++;if(lock())return;if(tries<80)setTimeout(run,40)};run();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.HUIDIToolbarOwner=Object.freeze({version:VERSION,order:ORDER.slice(),lock,reconcile,place,isLocked:()=>Boolean(document.querySelector('#fpLiteToolbar .fp-lite-toolbar-actions')?.dataset.huidiToolbarOwner==='rc1617')});
})();
