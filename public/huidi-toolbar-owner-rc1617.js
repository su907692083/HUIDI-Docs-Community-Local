/* HUIDI Docs Community Local RC16.20 — Single Toolbar Owner + interaction-safe geometry. */
(()=>{
  'use strict';
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.20-TOOLBAR-OWNER';
  const ORDER=[
    '#fpLiteImportBtn','.fp-primary-workspace-switch','#fpV3325DocSelect','#fpV3321SaveHeader',
    '#huidiMasterSyncHeader','#huidiLocalCheckHeader','#fpV3321TemplateHeader','#fpV3321ModeHeader',
    '#huidiLocalPaymentHeader','#fpV3321FieldsHeader','#fpV3325LayoutHeader','#fpLiteExportMenu',
    '#huidiLocalNextHeader','#fpV3325ClearHeader','#fpLiteMoreMenu','#huidiLocalStateBadge'
  ];
  let actions=null,observer=null,reconciling=false;
  const find=s=>document.querySelector(s);
  const idx=node=>ORDER.findIndex(s=>node?.matches?.(s));
  function place(node){
    if(!actions||!node)return false;const i=idx(node);if(i<0)return false;
    let next=null;
    for(let n=i+1;n<ORDER.length;n++){
      const candidate=find(ORDER[n]);
      if(candidate&&candidate!==node&&candidate.parentNode===actions){next=candidate;break;}
    }
    if(node.parentNode!==actions){actions.insertBefore(node,next);return true;}
    if(next&&node.nextElementSibling!==next){actions.insertBefore(node,next);return true;}
    if(!next&&[...actions.children].some(sib=>sib!==node&&idx(sib)>i)){actions.appendChild(node);return true;}
    return false;
  }
  function signature(){return ORDER.map(s=>find(s)?.id||find(s)?.className||'-').join('|');}
  function closePeerMenus(opened=null){
    ['#fpLiteExportMenu','#huidiMasterSyncHeader','#huidiLocalNextHeader'].forEach(sel=>{
      const d=find(sel);if(d&&d!==opened&&d.open)d.open=false;
    });
  }
  function bindMenu(details){
    if(!details||details.dataset.huidiToolbarMenuBound==='1')return;
    details.dataset.huidiToolbarMenuBound='1';
    details.addEventListener('toggle',()=>{if(details.open)closePeerMenus(details);});
  }
  function bindMenus(){['#fpLiteExportMenu','#huidiMasterSyncHeader','#huidiLocalNextHeader'].forEach(s=>bindMenu(find(s)));}
  function reconcile(){
    if(reconciling)return false;
    actions=find('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return false;
    reconciling=true;observer?.disconnect?.();
    try{
      ORDER.forEach(s=>{const node=find(s);if(node)place(node);});
      actions.dataset.huidiToolbarOwner='rc1617';
      actions.dataset.huidiToolbarSignature=signature();
      find('#fpLiteToolbar')?.setAttribute('data-huidi-toolbar-stable','1');
      bindMenus();
    }finally{
      reconciling=false;observer?.observe?.(actions,{childList:true,subtree:false});
    }
    return true;
  }
  function lock(){
    actions=find('#fpLiteToolbar .fp-lite-toolbar-actions');if(!actions)return false;
    if(!observer){observer=new MutationObserver(records=>{
      if(reconciling)return;const added=[];
      for(const r of records)for(const n of r.addedNodes||[])if(n?.nodeType===1)added.push(n);
      if(!added.length)return;
      requestAnimationFrame(()=>{for(const n of added)place(n);actions.dataset.huidiToolbarSignature=signature();bindMenus();});
    });}
    return reconcile();
  }
  function boot(){let tries=0;const run=()=>{tries++;if(lock())return;if(tries<80)setTimeout(run,40)};run();}
  document.addEventListener('HUIDI:document-type-changed',()=>{closePeerMenus();});
  window.addEventListener('blur',()=>closePeerMenus());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.HUIDIToolbarOwner=Object.freeze({version:VERSION,order:ORDER.slice(),lock,reconcile,place,closePeerMenus,isLocked:()=>Boolean(find('#fpLiteToolbar .fp-lite-toolbar-actions')?.dataset.huidiToolbarOwner==='rc1617')});
})();
