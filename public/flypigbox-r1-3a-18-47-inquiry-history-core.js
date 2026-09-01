(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FlypigBOXInquiryHistoryCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clean=v=>String(v??'').trim();
  const ts=v=>{const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0};
  function latestRevisionMap(revisions=[]){
    const map=new Map();
    for(const row of revisions||[]){
      const key=clean(row.activity_id); if(!key)continue;
      const prev=map.get(key); if(!prev||ts(row.created_at)>=ts(prev.created_at))map.set(key,row);
    }
    return map;
  }
  function revisionCountMap(revisions=[]){
    const map=new Map();
    for(const row of revisions||[]){const key=clean(row.activity_id);if(key)map.set(key,(map.get(key)||0)+1)}
    return map;
  }
  function buildTimeline(activities=[],revisions=[]){
    const latest=latestRevisionMap(revisions),counts=revisionCountMap(revisions);
    return (activities||[]).map(row=>{
      const rev=latest.get(clean(row.id));
      return {
        ...row,
        original_summary:clean(row.summary),
        display_summary:clean(rev?.summary)||clean(row.summary),
        display_next_action:clean(rev?.next_action)||clean(row.next_action),
        display_next_action_at:clean(rev?.next_action_at)||clean(row.next_action_at),
        party:clean(row.party)||((clean(row.record_type)==='reply')?'customer':(clean(row.channel)==='内部记录'?'internal':'self')),
        record_type:clean(row.record_type)||((clean(row.channel)==='内部记录')?'note':'followup'),
        edited:Boolean(rev),
        revision_count:counts.get(clean(row.id))||0,
        latest_revision:rev||null
      };
    }).sort((a,b)=>ts(b.occurred_at||b.created_at)-ts(a.occurred_at||a.created_at));
  }
  function createRevisionPayload({userId,dealId,activity,next}={}){
    if(!activity?.id)throw new Error('缺少原跟进记录');
    return {
      user_id:clean(userId),deal_id:clean(dealId),activity_id:clean(activity.id),
      previous_summary:clean(activity.display_summary||activity.summary),summary:clean(next?.summary),
      previous_next_action:clean(activity.display_next_action||activity.next_action),next_action:clean(next?.next_action),
      previous_next_action_at:clean(activity.display_next_action_at||activity.next_action_at)||null,next_action_at:clean(next?.next_action_at)||null,
      edit_reason:clean(next?.edit_reason)
    };
  }
  function filterTimeline(rows=[],mode='all'){
    if(mode==='all')return [...rows];
    if(mode==='customer')return rows.filter(x=>clean(x.party)==='customer'||clean(x.record_type)==='reply');
    if(mode==='followup')return rows.filter(x=>clean(x.party)==='self'&&clean(x.record_type)!=='reply');
    if(mode==='internal')return rows.filter(x=>clean(x.party)==='internal'||clean(x.record_type)==='note');
    return [...rows];
  }
  function partyLabel(row={}){
    const party=clean(row.party),type=clean(row.record_type);
    if(party==='customer'||type==='reply')return '客户回复';
    if(party==='internal'||type==='note')return '内部记录';
    if(type==='document')return '单据动作';
    if(type==='status')return '状态变化';
    return '我方跟进';
  }
  function buildAiTimelineContext(deal={},timeline=[],{maxItems=50}={}){
    const rows=[...(timeline||[])].sort((a,b)=>ts(a.occurred_at||a.created_at)-ts(b.occurred_at||b.created_at)).slice(-Math.max(1,maxItems));
    const head=[`询盘/业务：${clean(deal.title)||'未命名'}`,`阶段：${clean(deal.stage)||'未设置'}`,clean(deal.requirements)&&`需求：${clean(deal.requirements)}`].filter(Boolean);
    const body=rows.map(row=>{
      const when=clean(row.occurred_at||row.created_at).replace('T',' ').slice(0,16)||'时间未记录';
      const next=clean(row.display_next_action||row.next_action);
      const nextAt=clean(row.display_next_action_at||row.next_action_at);
      return `[${when}] ${partyLabel(row)} · ${clean(row.channel)||'未注明渠道'}：${clean(row.display_summary||row.summary)}${next?`｜下一步：${next}${nextAt?`（${nextAt}）`:''}`:''}`;
    });
    return [...head,'跟进时间线：',...(body.length?body:['暂无跟进记录'])].join('\n');
  }
  return {buildTimeline,createRevisionPayload,filterTimeline,buildAiTimelineContext,partyLabel};
});
