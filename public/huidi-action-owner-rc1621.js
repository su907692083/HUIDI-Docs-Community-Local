/* HUIDI Docs Community Local RC16.21 — Single Interaction Owner. */
(()=>{
  'use strict';
  const VERSION='HUIDI-DOCS-COMMUNITY-LOCAL-1.2.0-RC16.21-ACTION-OWNER';
  const html=document.documentElement;
  let checkBusy=false, checkToken=0, lastIssues=[];
  let modeTimer=0, modeTarget='', modeCommitting=false, modeSeq=0;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status=(m,t='')=>{try{window.FlypigBOXApp?.setStatus?.(m,t)}catch(_){}};

  function ensureDrawerOpen(){
    const root=$('#fpV3315ToolsRoot');
    if(root && !root.hidden && root.classList.contains('show')) return true;
    const summary=$('#fpLiteMoreMenu>summary');
    if(summary){summary.click();return true;}
    return false;
  }
  function activateAssist(){
    try{window.HUIDILocalRC15?.ensureHub?.();}catch(_){ }
    const hub=$('#huidiRc15MoreHub');if(!hub)return false;
    const tab=$('[data-rc15-tab="assist"]',hub);
    if(tab && !tab.classList.contains('active'))tab.click();
    return true;
  }
  function normalizeDrawerCopy(){
    try{window.HUIDILocalRC15?.ensureHub?.();}catch(_){ }
    const hub=$('#huidiRc15MoreHub');if(!hub)return;
    const meta=$('[data-rc15-action="metadata"]',hub);
    if(meta){const s=meta.querySelector('span'),sm=meta.querySelector('small');if(s)s.textContent='保存单据';if(sm)sm.textContent='可修改保存名称与内部备注；顶部“保存单据”使用同一流程';}
    const templateTitle=$('.huidi-rc15-template-card>header b',hub);
    if(templateTitle)templateTitle.textContent='常用资料模板';
    const templateNote=$('.huidi-rc15-template-card>p',hub);
    if(templateNote)templateNote.textContent='复用卖方、买方、收款、物流、条款或签章资料；这里不是 PDF 模板/样式。';
    const assistHeader=$('[data-rc15-panel="assist"] .huidi-rc15-card>header div',hub);
    if(assistHeader){const b=assistHeader.querySelector('b'),s=assistHeader.querySelector('span');if(b)b.textContent='单据辅助';if(s)s.textContent='检查建议、保存设置和签章等辅助操作';}
  }
  function save(){
    normalizeDrawerCopy();
    const smart=window.FlypigBOXSmartSave;
    if(smart?.openSettings){smart.openSettings();return true;}
    const button=$('#saveAllBtn');
    if(button){button.click();return true;}
    status('保存组件还在加载，请稍后再试。','error');return false;
  }
  function normalizeCheckResult(result){
    const blockers=Array.isArray(result?.blockers)?result.blockers:[];
    const warnings=Array.isArray(result?.warnings)?result.warnings:[];
    return [
      ...blockers.map(x=>({...x,__tone:'suggest'})),
      ...warnings.map(x=>({...x,__tone:'review'}))
    ];
  }
  function renderCheckCard(result){
    normalizeDrawerCopy();
    const hub=$('#huidiRc15MoreHub');if(!hub)return false;
    const panel=$('[data-rc15-panel="assist"]',hub);if(!panel)return false;
    let card=$('#huidiRc1621CheckCard',hub);
    if(!card){card=document.createElement('section');card.id='huidiRc1621CheckCard';card.className='huidi-rc15-card huidi-rc1621-check-card';panel.prepend(card);}
    lastIssues=normalizeCheckResult(result);
    const suggest=lastIssues.filter(x=>x.__tone==='suggest').length;
    const review=lastIssues.filter(x=>x.__tone==='review').length;
    const list=lastIssues.slice(0,14).map((issue,index)=>`<button type="button" class="huidi-rc1621-check-row is-${issue.__tone}" data-rc1621-issue="${index}"><span><b>${issue.__tone==='suggest'?'建议补充':'建议核对'}</b>${esc(issue.message||issue.reason||issue.label||issue.path||'请人工核对')}</span><em>定位</em></button>`).join('');
    card.innerHTML=`<header><div><b>检查建议</b><span>仅供辅助，不限制 PDF / Excel / CSV 导出</span></div><button type="button" data-rc1621-rerun-check>重新检查</button></header><div class="huidi-rc1621-check-summary"><span>建议补充 ${suggest}</span><span>建议核对 ${review}</span></div><div class="huidi-rc1621-check-list">${list||'<div class="huidi-rc1621-check-ok">当前没有明显问题；正式发送前仍建议人工核对客户、金额和交付信息。</div>'}</div><p>检查结果不会改变单据，也不会阻止导出。点击任一建议可直接定位到对应字段。</p>`;
    return true;
  }
  function openCheckResult(result){
    ensureDrawerOpen();
    const show=()=>{if(!activateAssist()){setTimeout(show,45);return;}renderCheckCard(result);};
    setTimeout(show,45);
  }
  function runCheckNow(token){
    if(token!==checkToken)return;
    let result=null;
    try{
      result=window.FlypigBOXFormalOutputGate?.check?.('pdf')||null;
      if(!result){
        const r=window.FlypigBOXA12?.readiness?.();
        result={blockers:r?.blocks||[],warnings:r?.warnings||[],ready:Boolean(r?.ready)};
      }
    }catch(error){
      console.warn('RC16.21 advisory check failed',error);
      result={blockers:[],warnings:[{message:'检查组件暂未完成，请稍后重试；不影响导出。',path:'document'}]};
    }
    if(token!==checkToken)return;
    checkBusy=false;
    const button=$('#huidiLocalCheckHeader');if(button){button.disabled=false;button.removeAttribute('aria-busy');button.textContent='检查';}
    openCheckResult(result);
    const issues=normalizeCheckResult(result);
    status(issues.length?`检查完成：共 ${issues.length} 项建议，可在右侧“单据辅助”中定位修改；不影响导出。`:'检查完成：当前没有明显问题；仍建议发送前人工核对。',issues.length?'':'ok');
  }
  function check(){
    if(checkBusy){status('正在检查当前单据，请稍候。','');return false;}
    checkBusy=true;const token=++checkToken;
    const button=$('#huidiLocalCheckHeader');if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='检查中…';}
    status('正在进行辅助检查；不会影响保存或导出。','');
    const runner=()=>runCheckNow(token);
    if('requestIdleCallback' in window)requestIdleCallback(runner,{timeout:450});else setTimeout(runner,30);
    return true;
  }
  function locateIssue(index){
    const issue=lastIssues[Number(index)];if(!issue)return;
    $('#fpV3315ToolsRoot [data-v3315-close]')?.click();
    setTimeout(()=>{
      const ok=window.HUIDIIssueNavigator?.locate?.(issue);
      if(!ok)window.FlypigBOXFormalOutputGate?.focusIssue?.(issue);
    },190);
  }

  function modeFromTarget(target){
    return target?.dataset?.v3350Mode||target?.dataset?.v3321Mode||target?.dataset?.docMode||target?.dataset?.v3315DocMode||target?.dataset?.v3315DrawerMode||'';
  }
  function modeButton(mode){return document.querySelector(`[data-doc-mode="${mode}"]`);}
  function commitMode(mode,seq){
    if(seq!==modeSeq)return;
    const safe=mode==='b2b'?'b2b':'ecommerce';const canonical=modeButton(safe);if(!canonical)return;
    modeCommitting=true;html.dataset.huidiModeTransition='1';html.dataset.huidiModeTarget=safe;
    try{canonical.click();}catch(error){console.warn('RC16.21 mode commit failed',error);}
    modeCommitting=false;
    setTimeout(()=>{
      if(seq!==modeSeq)return;
      html.dataset.huidiModeTransition='0';delete html.dataset.huidiModeTarget;
      try{window.FlypigBOXApp?.renderPreview?.({allowDuringMode:true});}catch(_){ }
      document.dispatchEvent(new CustomEvent('HUIDI:mode-transition-committed',{detail:{mode:safe,sequence:seq}}));
    },180);
  }
  function requestMode(mode){
    modeTarget=mode==='b2b'?'b2b':'ecommerce';const seq=++modeSeq;
    clearTimeout(modeTimer);modeTimer=setTimeout(()=>commitMode(modeTarget,seq),85);
    return true;
  }

  function normalizeToolbar(){
    const saveBtn=$('#fpV3321SaveHeader');if(saveBtn){saveBtn.textContent='保存单据';saveBtn.title='保存当前单据；可在保存前修改名称与内部备注';}
    const checkBtn=$('#huidiLocalCheckHeader');if(checkBtn){checkBtn.textContent='检查';checkBtn.title='辅助检查并定位问题；不会限制导出';}
    const template=$('#fpV3321TemplateHeader');if(template){template.textContent='PDF模板/样式';template.title='调整客户文件的 PDF 视觉模板与品牌样式';}
  }
  function loadEditorReturn(){
    if(window.HUIDIEditorReturn||document.querySelector('script[data-huidi-editor-return]'))return;
    const script=document.createElement('script');script.src='./huidi-editor-return-v1.js?v=HUIDI-CLOSURE-V1';script.defer=true;script.dataset.huidiEditorReturn='1';document.head.appendChild(script);
  }
  function intercept(event){
    const target=event.target;
    if(!target?.closest)return;
    const saveTarget=target.closest('#fpV3321SaveHeader,[data-rc15-action="metadata"],[data-fp-save-document]');
    if(saveTarget){event.preventDefault();event.stopImmediatePropagation();save();return;}
    const checkTarget=target.closest('#huidiLocalCheckHeader,[data-fp-check-document],[data-fp-check],[data-fp-qf-bottom="check"]');
    if(checkTarget){event.preventDefault();event.stopImmediatePropagation();check();return;}
    const issue=target.closest('[data-rc1621-issue]');if(issue){event.preventDefault();event.stopImmediatePropagation();locateIssue(issue.dataset.rc1621Issue);return;}
    if(target.closest('[data-rc1621-rerun-check]')){event.preventDefault();event.stopImmediatePropagation();check();return;}
    const modeTargetEl=target.closest('#fpV3321ModeHeader [data-v3350-mode],[data-doc-mode],[data-v3315-doc-mode],[data-v3315-drawer-mode]');
    if(modeTargetEl&&!modeCommitting){const mode=modeFromTarget(modeTargetEl);if(mode){event.preventDefault();event.stopImmediatePropagation();requestMode(mode);return;}}
  }
  window.addEventListener('click',intercept,true);
  document.addEventListener('HUIDI:document-type-changed',()=>{checkToken++;checkBusy=false;lastIssues=[];setTimeout(()=>{normalizeToolbar();normalizeDrawerCopy();},80);});
  document.addEventListener('HUIDI:formal-validation',()=>{ /* result only; never auto-open or block */ });
  function boot(){loadEditorReturn();normalizeToolbar();normalizeDrawerCopy();[160,500,1100].forEach(ms=>setTimeout(()=>{normalizeToolbar();normalizeDrawerCopy();},ms));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.HUIDIActionOwner=Object.freeze({version:VERSION,save,check,requestMode,normalizeToolbar,normalizeDrawerCopy,loadEditorReturn});
  html.dataset.huidiActionOwner='rc16.21';
})();
