(() => {
  'use strict';
  if (window.FlypigBOXInquiryHistory?.version === '18.47') return;
  const core = window.FlypigBOXInquiryHistoryCore;
  const api = () => window.FlypigBOXWorkspaceAPI;
  const clean = v => String(v ?? '').trim();
  const esc = v => clean(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = value => { if (!value) return '时间未记录'; const d = new Date(value); return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleString('zh-CN',{hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); };
  const styleId='fp47-inquiry-history-style';
  const editDialogId='fp47-inquiry-edit-dialog';
  const revisionDialogId='fp47-inquiry-revision-dialog';
  let activeDealId='';
  let activeFilter='all';
  let cachedRevisions=[];

  function installStyle(){
    if(document.getElementById(styleId))return;
    const s=document.createElement('style');s.id=styleId;s.textContent=`
      [data-fp47-history]{border:1px solid #e3eaf3;border-radius:14px;background:#fff;overflow:hidden}
      .fp47-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:16px 16px 12px;border-bottom:1px solid #edf1f6}.fp47-head h3{margin:0 0 4px}.fp47-head p{margin:0;color:#7b889a;font-size:12px}.fp47-count{white-space:nowrap;font-weight:700;color:#47566c}
      .fp47-filters{display:flex;gap:7px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #edf1f6}.fp47-filters button{border:1px solid #dfe6ef;background:#fff;border-radius:999px;padding:6px 11px;cursor:pointer;color:#536176}.fp47-filters button.active{background:#edf3ff;border-color:#9db8ff;color:#245eea;font-weight:700}
      .fp47-list{max-height:460px;overflow:auto;padding:4px 16px 12px}.fp47-item{position:relative;padding:14px 10px 14px 20px;border-bottom:1px solid #eef2f7}.fp47-item:last-child{border-bottom:0}.fp47-item:before{content:"";position:absolute;left:2px;top:20px;width:8px;height:8px;border-radius:50%;background:#8aa7d7}.fp47-item.customer:before{background:#27a36a}.fp47-item.internal:before{background:#9a7bd3}.fp47-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:#7d8a9c}.fp47-kind{font-weight:700;color:#42516a}.fp47-item.customer .fp47-kind{color:#158355}.fp47-summary{font-size:14px;line-height:1.65;color:#1d2a3c;margin:6px 0;white-space:pre-wrap}.fp47-next{font-size:12px;color:#596a80;background:#f6f8fb;border-radius:8px;padding:7px 9px;margin-top:7px}.fp47-actions{display:flex;gap:8px;margin-top:8px}.fp47-actions button{border:0;background:transparent;padding:0;color:#2c67da;cursor:pointer;font-size:12px}.fp47-edited{font-size:11px;color:#8b96a6}.fp47-empty{padding:28px;text-align:center;color:#7f8b9b}
      .fp47-form{padding:14px 16px 16px;border-top:1px solid #edf1f6;background:#fbfcfe}.fp47-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fp47-form select,.fp47-form input,.fp47-form textarea,.fp47-edit-form input,.fp47-edit-form textarea{box-sizing:border-box;width:100%;border:1px solid #dce4ef;border-radius:9px;background:#fff;padding:9px 10px;font:inherit}.fp47-form textarea{min-height:88px;resize:vertical;margin:10px 0}.fp47-form footer{display:flex;justify-content:flex-end;margin-top:10px}.fp47-primary{border:0!important;background:#2667e8!important;color:#fff!important;border-radius:9px!important;padding:9px 15px!important;cursor:pointer}.fp47-secondary{border:1px solid #dce4ef!important;background:#fff!important;color:#4e5f75!important;border-radius:9px!important;padding:8px 12px!important;cursor:pointer}
      #${editDialogId},#${revisionDialogId}{border:0;border-radius:16px;padding:0;width:min(620px,calc(100vw - 32px));box-shadow:0 26px 90px #16243d35}#${editDialogId}::backdrop,#${revisionDialogId}::backdrop{background:#18243b80}.fp47-edit-form{padding:18px}.fp47-edit-form header{display:flex;justify-content:space-between;gap:14px;align-items:start;margin-bottom:14px}.fp47-edit-form h3{margin:0}.fp47-edit-form p{margin:5px 0 0;color:#7b8898;font-size:12px}.fp47-edit-form label{display:block;margin:10px 0;color:#526176;font-size:12px}.fp47-edit-form textarea{min-height:110px;resize:vertical}.fp47-edit-form footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
      @media(max-width:760px){.fp47-grid{grid-template-columns:1fr}.fp47-head{display:block}.fp47-count{margin-top:8px}.fp47-list{max-height:380px}}
    `;document.head.appendChild(s);
  }
  function state(){return api()?.getState?.()||{};}
  function client(){return api()?.getClient?.()||null;}
  function toast(msg,bad=false){try{return api()?.toast?.(msg,bad)}catch{} if(bad)console.warn(msg);}
  function deal(dealId){return (state().deals||[]).find(x=>String(x.id)===String(dealId))||null;}
  function activities(dealId){return (state().activities||[]).filter(x=>String(x.deal_id)===String(dealId)&&x.activity_type!=='attachment');}
  async function revisions(dealId){
    const sb=client();if(!sb)return [];
    const {data,error}=await sb.from('deal_activity_revisions').select('*').eq('deal_id',dealId).order('created_at',{ascending:true});
    if(error){console.warn('HUIDI inquiry revision read failed',error);return [];}return data||[];
  }
  function findExistingSection(){
    const detail=document.querySelector('#detail-content');if(!detail)return null;
    return [...detail.querySelectorAll('section')].find(section=>/沟通与跟进|跟进时间线/.test(section.querySelector('h3')?.textContent||''))||null;
  }
  function rowClass(row){return row.party==='customer'||row.record_type==='reply'?'customer':row.party==='internal'||row.record_type==='note'?'internal':'self';}
  function itemHtml(row){
    const next=clean(row.display_next_action||row.next_action),nextAt=clean(row.display_next_action_at||row.next_action_at);
    return `<article class="fp47-item ${rowClass(row)}" data-fp47-activity="${esc(row.id)}"><div class="fp47-meta"><span class="fp47-kind">${esc(core.partyLabel(row))}</span><span>${esc(row.channel||'未注明渠道')}</span><span>${fmt(row.occurred_at||row.created_at)}</span>${row.edited?`<span class="fp47-edited">已编辑 · ${row.revision_count}次</span>`:''}</div><div class="fp47-summary">${esc(row.display_summary||row.summary)}</div>${next||nextAt?`<div class="fp47-next">下一步：${esc(next||'待补充')}${nextAt?` · ${esc(nextAt)}`:''}</div>`:''}<div class="fp47-actions"><button type="button" data-fp47-edit="${esc(row.id)}">编辑并保留原记录</button>${row.edited?`<button type="button" data-fp47-revisions="${esc(row.id)}">查看修改痕迹</button>`:''}</div></article>`;
  }
  function panelHtml(dealId,timeline){
    const rows=core.filterTimeline(timeline,activeFilter);
    const filters=[['all','全部'],['customer','客户回复'],['followup','我方跟进'],['internal','内部记录']];
    return `<div data-fp47-history="${esc(dealId)}"><div class="fp47-head"><div><h3>完整跟进时间线</h3><p>每次记录都会保留。修改只新增修订痕迹，不覆盖原始沟通。</p></div><span class="fp47-count">共 ${timeline.length} 条</span></div><div class="fp47-filters">${filters.map(([k,l])=>`<button type="button" data-fp47-filter="${k}" class="${activeFilter===k?'active':''}">${l}</button>`).join('')}</div><div class="fp47-list">${rows.length?rows.map(itemHtml).join(''):'<div class="fp47-empty">当前筛选下暂无跟进记录。</div>'}</div><form class="fp47-form" data-fp47-add="${esc(dealId)}"><div class="fp47-grid"><select name="party"><option value="self">我方跟进</option><option value="customer">客户回复</option><option value="internal">内部记录</option></select><select name="channel"><option value="WhatsApp">WhatsApp</option><option value="邮件">邮件</option><option value="平台询盘">平台询盘</option><option value="电话">电话</option><option value="会议">会议</option><option value="展会">展会</option><option value="内部记录">内部记录</option></select></div><textarea name="summary" placeholder="记录客户回复、已经确认的事项、报价反馈或内部判断" required></textarea><div class="fp47-grid"><input name="next_action" placeholder="下一步动作，例如：发送修改后的报价"><input name="next_action_at" type="date"></div><footer><button class="fp47-primary" type="submit">追加本次跟进</button></footer></form></div>`;
  }
  async function enhance(dealId){
    if(!core||!api()||!dealId)return false;
    const target=findExistingSection();if(!target)return false;
    activeDealId=String(dealId);cachedRevisions=await revisions(activeDealId);
    const timeline=core.buildTimeline(activities(activeDealId),cachedRevisions);
    target.innerHTML=panelHtml(activeDealId,timeline);
    target.classList.add('detail-wide');
    return true;
  }
  function schedule(dealId){
    if(!dealId)return;[70,180,360,700].forEach(ms=>setTimeout(()=>{if(!document.querySelector(`[data-fp47-history="${CSS.escape(String(dealId))}"]`))enhance(dealId)},ms));
  }
  async function saveActivity(form){
    const sb=client(),st=state(),dealId=form.dataset.fp47Add,d=deal(dealId);if(!sb||!st.user||!d)return toast('当前账号状态未准备好，请刷新后再试。',true);
    const fd=new FormData(form),summary=clean(fd.get('summary'));if(!summary)return toast('请填写本次跟进内容。',true);
    const party=clean(fd.get('party'))||'self',recordType=party==='customer'?'reply':party==='internal'?'note':'followup',nextAction=clean(fd.get('next_action')),nextAt=clean(fd.get('next_action_at'))||null;
    const payload={user_id:st.user.id,deal_id:dealId,customer_id:d.customer_id||null,activity_type:'note',record_type:recordType,party,is_internal:party==='internal',channel:clean(fd.get('channel'))||(party==='internal'?'内部记录':'邮件'),summary,occurred_at:new Date().toISOString(),next_action:nextAction||null,next_action_at:nextAt};
    const {error}=await sb.from('deal_activities').insert(payload);if(error)return toast(error.message||'保存跟进记录失败。',true);
    if(nextAt){
      const tasks=[sb.from('business_deals').update({next_action:nextAction||summary,next_action_at:nextAt}).eq('id',dealId).eq('user_id',st.user.id)];
      if(d.customer_id)tasks.push(sb.from('customer_records').update({next_follow_up_at:nextAt}).eq('id',d.customer_id).eq('user_id',st.user.id));
      const results=await Promise.all(tasks);results.forEach(x=>{if(x?.error)console.warn('Follow-up next action sync failed',x.error)});
    }
    toast('本次跟进已追加到历史时间线。');form.reset();await api()?.refresh?.();schedule(dealId);
  }
  function ensureEditDialog(){
    let d=document.getElementById(editDialogId);if(d)return d;
    d=document.createElement('dialog');d.id=editDialogId;d.innerHTML=`<form method="dialog" class="fp47-edit-form" data-fp47-edit-form><header><div><h3>修正跟进记录</h3><p>原始记录不会被覆盖。本次修改会作为新的修订痕迹保存。</p></div><button class="fp47-secondary" type="button" data-fp47-edit-close>×</button></header><input type="hidden" name="activity_id"><label>跟进内容<textarea name="summary" required></textarea></label><label>下一步动作<input name="next_action"></label><label>下次日期<input name="next_action_at" type="date"></label><label>修改原因<input name="edit_reason" placeholder="例如：补充客户确认内容"></label><footer><button class="fp47-secondary" type="button" data-fp47-edit-close>取消</button><button class="fp47-primary" type="submit">保存修订</button></footer></form>`;document.body.appendChild(d);return d;
  }
  function ensureRevisionDialog(){
    let d=document.getElementById(revisionDialogId);if(d)return d;
    d=document.createElement('dialog');d.id=revisionDialogId;document.body.appendChild(d);return d;
  }
  function currentTimeline(){return core.buildTimeline(activities(activeDealId),cachedRevisions);}
  function openEdit(activityId){
    const row=currentTimeline().find(x=>String(x.id)===String(activityId));if(!row)return;
    const d=ensureEditDialog(),f=d.querySelector('form');f.elements.activity_id.value=row.id;f.elements.summary.value=row.display_summary||row.summary||'';f.elements.next_action.value=row.display_next_action||row.next_action||'';f.elements.next_action_at.value=clean(row.display_next_action_at||row.next_action_at).slice(0,10);f.elements.edit_reason.value='';d.showModal?.();if(!d.open)d.setAttribute('open','');
  }
  async function saveRevision(form){
    const st=state(),sb=client(),activityId=form.elements.activity_id.value,row=currentTimeline().find(x=>String(x.id)===String(activityId));if(!st.user||!sb||!row)return;
    const payload=core.createRevisionPayload({userId:st.user.id,dealId:activeDealId,activity:row,next:{summary:form.elements.summary.value,next_action:form.elements.next_action.value,next_action_at:form.elements.next_action_at.value,edit_reason:form.elements.edit_reason.value}});
    const {error}=await sb.from('deal_activity_revisions').insert(payload);if(error)return toast(error.message||'保存修订失败。',true);
    if(payload.next_action_at){
      const d=deal(activeDealId),tasks=[sb.from('business_deals').update({next_action:payload.next_action||payload.summary,next_action_at:payload.next_action_at}).eq('id',activeDealId).eq('user_id',st.user.id)];
      if(d?.customer_id)tasks.push(sb.from('customer_records').update({next_follow_up_at:payload.next_action_at}).eq('id',d.customer_id).eq('user_id',st.user.id));
      await Promise.all(tasks);
    }
    ensureEditDialog().close?.();toast('已保存修订，原始跟进记录仍然保留。');cachedRevisions=await revisions(activeDealId);await enhance(activeDealId);
  }
  function showRevisions(activityId){
    const rows=cachedRevisions.filter(x=>String(x.activity_id)===String(activityId)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(!rows.length)return toast('这条记录还没有修改痕迹。');
    const text=rows.map((x,i)=>`第 ${rows.length-i} 次修订 · ${fmt(x.created_at)}\n${clean(x.summary)}${x.edit_reason?`\n原因：${clean(x.edit_reason)}`:''}`).join('\n\n');
    const d=ensureRevisionDialog();d.innerHTML=`<div class="fp47-edit-form"><header><div><h3>修改痕迹</h3><p>所有修订按时间保留，原始记录不会被删除。</p></div><button class="fp47-secondary" type="button" data-fp47-edit-close>×</button></header><pre style="white-space:pre-wrap;line-height:1.65;color:#35445a;background:#f7f9fc;padding:12px;border-radius:10px">${esc(text)}</pre><footer><button class="fp47-primary" type="button" data-fp47-edit-close>关闭</button></footer></div>`;d.showModal?.();if(!d.open)d.setAttribute('open','');
  }
  async function getAiContext(dealId){const d=deal(dealId);if(!d)return '';const rev=String(dealId)===activeDealId?cachedRevisions:await revisions(dealId);return core.buildAiTimelineContext(d,core.buildTimeline(activities(dealId),rev),{maxItems:50});}
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-open-deal],[data-check-deal],[data-fp-global-kind="deal"],[data-fp47-filter],[data-fp47-edit],[data-fp47-revisions],[data-fp47-edit-close]');if(!target)return;
    if(target.dataset.fp47Filter){activeFilter=target.dataset.fp47Filter;return enhance(activeDealId);}
    if(target.dataset.fp47Edit)return openEdit(target.dataset.fp47Edit);
    if(target.dataset.fp47Revisions)return showRevisions(target.dataset.fp47Revisions);
    if(target.hasAttribute('data-fp47-edit-close'))return target.closest('dialog')?.close?.();
    const id=target.dataset.openDeal||target.dataset.checkDeal||(target.dataset.fpGlobalKind==='deal'?target.dataset.fpGlobalId:'');if(id)schedule(id);
  },true);
  document.addEventListener('submit',event=>{
    const form=event.target;if(form.matches?.('[data-fp47-add]')){event.preventDefault();event.stopPropagation();saveActivity(form);return;}
    if(form.matches?.('[data-fp47-edit-form]')){event.preventDefault();saveRevision(form);return;}
    if(form.matches?.('[data-add-activity]')){const id=form.dataset.addActivity;if(id)setTimeout(()=>schedule(id),350);}
  },true);
  installStyle();ensureEditDialog();
  window.FlypigBOXInquiryHistory=Object.freeze({version:'18.47',enhanceDeal:enhance,getDealContext:getAiContext,buildTimelineForDeal:async dealId=>core.buildTimeline(activities(dealId),await revisions(dealId))});
  document.dispatchEvent(new CustomEvent('HUIDI:inquiry-history-ready',{detail:{version:'18.47'}}));
})();
