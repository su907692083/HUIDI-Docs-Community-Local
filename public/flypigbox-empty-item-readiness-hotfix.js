/* HUIDI V3.3.6.24-R1.3A.18.23.3 — empty item cleanup, shared readiness and issue navigation hotfix. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.23.3-EMPTY-ITEM-READINESS.1';
  if(window.FlypigBOXEmptyItemGuard?.version===VERSION)return;
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const docNames={quotation:'报价单',proforma_invoice:'形式发票',commercial_invoice:'商业发票',sales_contract:'销售合同',packing_list:'装箱单'};
  const currentDocName=()=>docNames[document.getElementById('documentType')?.value]||'当前单据';
  const textKeys=['sku','name','spec','hs','moq','cartonNo','packageDescription','dimensions','shippingMarks','image','origin','productCode','itemNo'];
  const numericKeys=['price','netWeight','grossWeight','cbm','cartons','subtotal','amount'];
  let patchTimer=0;

  function meaningfulItem(item){
    if(!item||typeof item!=='object')return false;
    if(textKeys.some(key=>clean(item[key])))return true;
    if(numericKeys.some(key=>num(item[key])>0))return true;
    const qty=num(item.qty);
    if(qty>0&&Math.abs(qty-1)>0.000001)return true;
    const unit=clean(item.unit).toUpperCase();
    return Boolean(unit&&unit!=='PCS');
  }
  function rowSnapshot(row){
    return{
      itemKey:row?.dataset?.itemKey||'',
      sku:row?.querySelector('.i-sku')?.value,
      name:row?.querySelector('.i-name')?.value,
      spec:row?.querySelector('.i-spec')?.value,
      hs:row?.querySelector('.i-hs')?.value,
      unit:row?.querySelector('.i-unit')?.value,
      qty:row?.querySelector('.i-qty')?.value,
      moq:row?.querySelector('.i-moq')?.value,
      price:row?.querySelector('.i-price')?.value,
      cartonNo:row?.querySelector('.i-carton-no')?.value,
      packageDescription:row?.querySelector('.i-package-desc')?.value,
      netWeight:row?.querySelector('.i-net-weight')?.value,
      grossWeight:row?.querySelector('.i-gross-weight')?.value,
      cbm:row?.querySelector('.i-cbm')?.value,
      dimensions:row?.querySelector('.i-dimensions')?.value,
      shippingMarks:row?.querySelector('.i-item-marks')?.value,
      image:row?.dataset?.image||''
    };
  }
  function blankRows(){return $$('.item-row').filter(row=>!meaningfulItem(rowSnapshot(row)));}
  function removableBlankCount(){const rows=$$('.item-row'),blanks=rows.filter(row=>!meaningfulItem(rowSnapshot(row)));return Math.max(0,blanks.length-(blanks.length===rows.length?1:0));}
  function cleanup({announce=false,render=true}={}){
    const rows=$$('.item-row');
    if(!rows.length)return 0;
    const blanks=rows.filter(row=>!meaningfulItem(rowSnapshot(row)));
    const meaningfulCount=rows.length-blanks.length;
    const removable=meaningfulCount>0?blanks:blanks.slice(1);
    removable.forEach(row=>row.remove());
    if(removable.length){
      if(render)window.FlypigBOXApp?.renderPreview?.();
      document.dispatchEvent(new CustomEvent('HUIDI:empty-item-rows-cleaned',{detail:{count:removable.length}}));
      if(announce)window.FlypigBOXApp?.setStatus?.(`已清理 ${removable.length} 条完全空白的商品行。`,'ok');
    }else if(announce){window.FlypigBOXApp?.setStatus?.('当前没有需要清理的空白商品行。','ok');}
    return removable.length;
  }
  function filteredPayload(payload){
    if(!payload||typeof payload!=='object')return payload;
    const items=Array.isArray(payload.items)?payload.items.filter(meaningfulItem):[];
    return{...payload,items};
  }
  function wrapApp(){
    const app=window.FlypigBOXApp;
    if(!app||app.__fpEmptyItemWrapped)return false;
    const original=typeof app.formState==='function'?app.formState.bind(app):null;
    if(original){app.formState=(...args)=>filteredPayload(original(...args));}
    app.cleanupEmptyItemRows=cleanup;
    app.isMeaningfulItem=meaningfulItem;
    app.meaningfulItemRows=()=>$$('.item-row').filter(row=>meaningfulItem(rowSnapshot(row)));
    app.__fpEmptyItemWrapped=VERSION;
    return true;
  }
  function wrapRules(){
    const rules=window.FlypigBOXRulePacks;
    if(!rules||rules.__fpEmptyItemWrapped)return false;
    const original=typeof rules.validate==='function'?rules.validate.bind(rules):null;
    if(!original)return false;
    const wrapped={...rules,validate:(payload,type,options)=>original(filteredPayload(payload),type,options),__fpEmptyItemWrapped:VERSION};
    if(typeof rules.outputAllowed==='function')wrapped.outputAllowed=(payload,type,output)=>wrapped.validate(payload,type,{formal:true,output});
    window.FlypigBOXRulePacks=Object.freeze(wrapped);
    return true;
  }
  function focusPath(path){
    const value=clean(path);
    let target=null;
    const fieldMatch=value.match(/^fields\.([A-Za-z0-9_-]+)$/);
    const itemMatch=value.match(/^items\.(\d+)\.([A-Za-z0-9_-]+)$/);
    if(fieldMatch)target=document.getElementById(fieldMatch[1]);
    if(itemMatch){
      const row=$$('.item-row').filter(row=>meaningfulItem(rowSnapshot(row)))[Number(itemMatch[1])];
      const map={name:'.i-name',sku:'.i-sku',spec:'.i-spec',qty:'.i-qty',unit:'.i-unit',price:'.i-price',hs:'.i-hs',netWeight:'.i-net-weight',grossWeight:'.i-gross-weight',cbm:'.i-cbm'};
      target=row?.querySelector(map[itemMatch[2]]||'.i-name')||row;
    }
    if(!target&&value==='items')target=document.getElementById('itemList')||$('.item-row');
    if(!target)return false;
    const itemRow=target.closest?.('.item-row');
    if(itemRow&&target.offsetParent===null){itemRow.classList.add('fp-item-expanded');const more=itemRow.querySelector('.fp-item-more');if(more)more.textContent='收起';}
    if(target.offsetParent===null){const advanced=document.querySelector('[data-fp-qf-action="advanced"]');if(advanced&&advanced.textContent.includes('更多'))advanced.click();}
    target.closest?.('.card')?.classList.add('fp-issue-focus-card');
    setTimeout(()=>{target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>{target.focus?.({preventScroll:true});target.classList?.add('fp-issue-focus');setTimeout(()=>{target.classList?.remove('fp-issue-focus');target.closest?.('.card')?.classList.remove('fp-issue-focus-card');},1800);},260);},80);
    return true;
  }
  function patchReadinessBanner(){
    const banner=document.getElementById('fpA12PreviewReadiness');
    const readiness=window.FlypigBOXA12?.readiness?.();
    if(!banner||!readiness||readiness.ready)return;
    const first=readiness.blocks?.[0];
    const list=(readiness.blocks||[]).slice(0,5).map(item=>item.text).filter(Boolean);
    const blankCount=removableBlankCount();
    banner.innerHTML=`<strong>这张${currentDocName()}还有内容需要补充</strong><span>${list.map((text,index)=>`<button type="button" data-fp-readiness-issue="${index}">${escapeHtml(text)}</button>`).join('')}${readiness.blocks.length>5?`<em>另有 ${readiness.blocks.length-5} 项</em>`:''}</span><div class="fp-readiness-actions">${blankCount?`<button type="button" data-fp-clean-empty>清理 ${blankCount} 条空白商品行</button>`:''}${first?'<button type="button" data-fp-first-issue>查看第一个问题</button>':''}</div><small>这些内容仅供检查建议；可定位补充，也可按当前版本直接导出</small>`;
    banner.dataset.fpFirstIssuePath=first?.path||first?.target||'';
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function schedulePatch(delay=150){clearTimeout(patchTimer);patchTimer=setTimeout(patchReadinessBanner,delay);}
  function boot(){
    wrapApp();wrapRules();
    setTimeout(()=>{cleanup({announce:false,render:true});wrapApp();wrapRules();schedulePatch(80);},180);
    [650,1400,2600].forEach(ms=>setTimeout(()=>{wrapApp();wrapRules();schedulePatch(60);},ms));
    window.addEventListener('click',event=>{
      const target=event.target.closest?.('#exportPdfBtn,#headerExportPdfBtn,#saveAllBtn,[data-fp-save-document],[data-fp-check-document],[data-fp-qf-bottom="save"],[data-fp-qf-bottom="check"],[data-fp-qf-bottom="export"],[data-fp-qf-action="export"]');
      if(target)cleanup({announce:false,render:true});
    },true);
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-clean-empty]')){event.preventDefault();cleanup({announce:true,render:true});schedulePatch(120);return;}
      if(event.target.closest('[data-fp-first-issue]')){const banner=event.target.closest('#fpA12PreviewReadiness');const result=window.FlypigBOXFormalOutputGate?.check?.('pdf');const issue=result?.blockers?.[0]||{path:banner?.dataset.fpFirstIssuePath||'items'};if(!window.HUIDIIssueNavigator?.locate?.(issue))focusPath(issue.path||'items');return;}
      const issueButton=event.target.closest('[data-fp-readiness-issue]');if(issueButton){const result=window.FlypigBOXFormalOutputGate?.check?.('pdf');const index=Number(issueButton.dataset.fpReadinessIssue||0);const issue=result?.blockers?.[index]||result?.blockers?.[0]||{path:'items'};if(!window.HUIDIIssueNavigator?.locate?.(issue))focusPath(issue.path||'items');}
    });
    document.addEventListener('HUIDI:preview-rendered',()=>schedulePatch(150));
    document.addEventListener('HUIDI:formal-validation',()=>schedulePatch(90));
    document.getElementById('piForm')?.addEventListener('input',()=>schedulePatch(190),true);
    document.getElementById('piForm')?.addEventListener('change',()=>schedulePatch(170),true);
    window.FlypigBOXEmptyItemGuard=Object.freeze({version:VERSION,meaningfulItem,rowSnapshot,blankRows,removableBlankCount,cleanup,filteredPayload,focusPath});
    document.documentElement.dataset.fpbEmptyItemGuard=VERSION;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
