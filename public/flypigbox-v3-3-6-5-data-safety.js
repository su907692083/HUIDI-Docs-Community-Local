/* HUIDI V3.3.6.5 — 数据安全、完整备份与业务资料索引融合 */
(()=>{
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const cfg=window.FLYPIGBOX_SUPABASE||{};
  const isLocal=location.protocol==='file:'||new URLSearchParams(location.search).get('localPreview')==='1';
  let client=null;
  try{
    if(!isLocal&&cfg.url&&cfg.publishableKey&&window.supabase?.createClient){
      client=window.supabase.createClient(String(cfg.url).replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    }
  }catch(error){console.warn('HUIDI data safety client unavailable',error);}

  const TABLES=[
    ['customer_records','客户资料'],['product_records','商品资料'],['brand_profiles','品牌资料'],['documents','业务单据'],
    ['business_deals','业务记录'],['deal_products','业务商品'],['deal_activities','沟通与资料索引'],
    ['payment_milestones','回款节点'],['shipment_milestones','交付节点'],['document_versions','单据版本'],
    ['workspace_templates','私有模板']
  ];
  const TRANSIENT_KEYS=['flypigbox_document_context','flypigbox_pending_document_type','flypigbox_open_document_id','flypigbox_catalog_product_transfer','flypigbox_open_import_on_load'];
  const OWNER_KEY='flypigbox_active_account_owner_v1';
  const ATTACH_PREFIX='FPATTACH:';
  let currentDealId='';

  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function clean(value){return String(value??'').trim();}
  function fmtTime(value){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('zh-CN',{hour12:false});}
  function download(filename,data,type='application/json;charset=utf-8'){
    const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function safeLocalKeys(storage){
    const out={};
    for(let i=0;i<storage.length;i+=1){
      const key=storage.key(i)||'';
      if(!/^(flypigbox_|fp_)/i.test(key))continue;
      if(/auth|token|password|secret|session/i.test(key))continue;
      try{out[key]=storage.getItem(key);}catch{}
    }
    return out;
  }
  async function user(){if(!client)return null;try{const {data}=await client.auth.getUser();return data?.user||null;}catch{return null;}}
  function statusText(message,kind=''){
    const node=$('#account-export-status');if(!node)return;node.textContent=message;node.dataset.kind=kind;
  }
  function classifyError(error){
    const code=clean(error?.code);const message=clean(error?.message||error);
    if(code==='42P01'||/does not exist|not found|不存在/i.test(message))return {label:'尚未部署',tone:'warn',detail:'线上数据库还没有对应业务表。'};
    if(code==='42501'||/permission|policy|row-level|RLS|权限/i.test(message))return {label:'权限受限',tone:'warn',detail:'当前账号无权读取该数据。'};
    if(/fetch|network|网络/i.test(message))return {label:'连接失败',tone:'bad',detail:'当前网络无法连接云端。'};
    return {label:'读取失败',tone:'bad',detail:message||'未知错误'};
  }
  function ensureDataPanel(){
    const dialog=$('#account-data-dialog .dialog');if(!dialog)return null;
    let panel=$('#fp-data-health-panel',dialog);
    if(!panel){
      panel=document.createElement('section');panel.id='fp-data-health-panel';panel.className='fp-data-health-panel';
      panel.innerHTML=`<div class="fp-data-health-head"><div><b>数据状态与安全备份</b><span>前端检查只确认当前账号能否读取自己的数据，不代替服务端 RLS 审计。</span></div><button type="button" class="btn secondary" data-fp-data-check>检查云端状态</button></div><div id="fp-data-account-summary" class="fp-data-account-summary"></div><div id="fp-data-health-grid" class="fp-data-health-grid"><article><b>等待检查</b><span>打开本窗口后可检查当前账号的数据表和记录数量。</span></article></div>`;
      const grid=$('.account-export-grid',dialog);dialog.insertBefore(panel,grid||dialog.querySelector('footer'));
    }
    const footer=dialog.querySelector('footer');
    if(footer&&!$('[data-fp-export-all]',footer)){
      const all=document.createElement('button');all.type='button';all.className='btn primary';all.dataset.fpExportAll='1';all.textContent='下载完整云端备份';
      const local=document.createElement('button');local.type='button';local.className='btn secondary';local.dataset.fpExportLocal='1';local.textContent='下载本机设置备份';
      footer.insertBefore(local,footer.firstChild);footer.insertBefore(all,footer.firstChild);
    }
    return panel;
  }
  async function countTable(table,userId){
    try{
      const {count,error}=await client.from(table).select('id',{count:'exact',head:true}).eq('user_id',userId);
      if(error)return {table,error};return {table,count:Number(count||0)};
    }catch(error){return {table,error};}
  }
  async function checkDataHealth(){
    const panel=ensureDataPanel();if(!panel)return;
    const summary=$('#fp-data-account-summary',panel);const grid=$('#fp-data-health-grid',panel);
    if(isLocal||!client){
      summary.innerHTML='<b>本地预览模式</b><span>本地文件不能读取云端客户、商品和业务数据；可下载本机设置备份。</span>';
      grid.innerHTML='<article class="warn"><b>云端检查不可用</b><span>请在线上域名登录后检查。</span></article>';return;
    }
    const current=await user();
    if(!current){summary.innerHTML='<b>当前身份：游客</b><span>登录后才能检查和导出自己的云端资料。</span>';grid.innerHTML='<article class="warn"><b>请先登录</b><span>未登录状态不会读取任何业务数据。</span></article>';return;}
    summary.innerHTML=`<b>${esc(current.email||'已登录账号')}</b><span>当前检查全部限制为 user_id=${esc(String(current.id).slice(0,8))}…；这里只验证当前账号读取，不宣称跨账号 RLS 已完成。</span>`;
    grid.innerHTML='<article><b>正在检查…</b><span>请稍候。</span></article>';
    const results=await Promise.all(TABLES.map(([table])=>countTable(table,current.id)));
    grid.innerHTML=results.map(result=>{
      const label=TABLES.find(([table])=>table===result.table)?.[1]||result.table;
      if(result.error){const info=classifyError(result.error);return `<article class="${info.tone}"><b>${esc(label)} · ${esc(info.label)}</b><span>${esc(info.detail)}</span></article>`;}
      return `<article class="ok"><b>${esc(label)} · ${result.count} 条</b><span>当前账号可以读取。</span></article>`;
    }).join('');
    const ok=results.filter(item=>!item.error).length;statusText(`云端检查完成：${ok}/${TABLES.length} 个数据表可读取。`,'ok');
  }
  async function exportAllCloud(){
    if(isLocal||!client){statusText('当前为本地预览模式，无法导出云端数据。','error');return;}
    const current=await user();if(!current){statusText('请先登录后再导出完整备份。','error');return;}
    statusText('正在读取当前账号的完整业务资料…');
    const data={meta:{product:'HUIDI',version:'V3.3.6.5',exported_at:new Date().toISOString(),account_email:current.email||'',account_id:current.id,scope:'仅当前账号 user_id 数据'},tables:{},errors:{}};
    for(const [table,label] of TABLES){
      try{
        const {data:rows,error}=await client.from(table).select('*').eq('user_id',current.id);
        if(error)data.errors[table]={label,message:error.message||String(error),code:error.code||''};else data.tables[table]=rows||[];
      }catch(error){data.errors[table]={label,message:error?.message||String(error)};}
    }
    const date=new Date().toISOString().slice(0,10);download(`HUIDI_当前账号完整备份_${date}.json`,JSON.stringify(data,null,2));
    statusText(`完整备份已下载：${Object.keys(data.tables).length} 个数据表成功，${Object.keys(data.errors).length} 个表未导出。`,'ok');
  }
  function exportLocalSettings(){
    const data={meta:{product:'HUIDI',version:'V3.3.6.5',exported_at:new Date().toISOString(),note:'仅包含 HUIDI 本机设置和临时数据，不包含登录令牌。'},localStorage:safeLocalKeys(localStorage),sessionStorage:safeLocalKeys(sessionStorage)};
    const date=new Date().toISOString().slice(0,10);download(`HUIDI_本机设置备份_${date}.json`,JSON.stringify(data,null,2));statusText('本机设置备份已下载；文件不包含登录令牌。','ok');
  }
  function clearTransientContext(){
    let removed=0;
    TRANSIENT_KEYS.forEach(key=>{try{if(sessionStorage.getItem(key)!==null){sessionStorage.removeItem(key);removed+=1;}}catch{}});
    try{
      for(let i=sessionStorage.length-1;i>=0;i-=1){const key=sessionStorage.key(i)||'';if(/^flypigbox_(pending|open_|document_context|catalog_product_transfer)/i.test(key)){sessionStorage.removeItem(key);removed+=1;}}
    }catch{}
    return removed;
  }
  async function guardAccountContext(){
    if(isLocal||!client)return;
    const current=await user();const next=current?.id||'';let previous='';try{previous=localStorage.getItem(OWNER_KEY)||'';}catch{}
    if(previous&&previous!==next){const removed=clearTransientContext();const notice=$('#notice');if(notice){notice.textContent=`检测到账号已切换，已清理 ${removed} 项上一账号的临时编辑上下文；云端数据未被删除。`;notice.classList.add('show');setTimeout(()=>notice.classList.remove('show'),7000);}}
    try{if(next)localStorage.setItem(OWNER_KEY,next);else localStorage.removeItem(OWNER_KEY);}catch{}
  }

  function encodeAttachment(payload){return ATTACH_PREFIX+JSON.stringify(payload);}
  function decodeAttachment(summary){
    const raw=clean(summary);if(!raw.startsWith(ATTACH_PREFIX))return {title:raw};
    try{return JSON.parse(raw.slice(ATTACH_PREFIX.length));}catch{return {title:raw.slice(ATTACH_PREFIX.length)};}
  }
  function attachmentCategoryLabel(value){return ({inquiry:'客户与询盘',external:'对外单据',payment:'付款凭证',production:'生产资料',inspection:'验货与包装',logistics:'物流与发货',other:'其他资料'})[value]||value||'其他资料';}
  async function renderAttachmentList(dealId,section){
    const list=$('.fp-attachment-list',section);if(!list)return;
    if(isLocal||!client){list.innerHTML='<div class="fp-attachment-empty"><b>本地预览不读取云端资料索引</b><span>请进入线上版登录后使用。</span></div>';return;}
    const current=await user();if(!current){list.innerHTML='<div class="fp-attachment-empty"><b>请先登录</b><span>登录后可保存当前业务的资料名称和链接。</span></div>';return;}
    list.innerHTML='<div class="fp-attachment-empty"><span>正在读取资料索引…</span></div>';
    const {data,error}=await client.from('deal_activities').select('*').eq('user_id',current.id).eq('deal_id',dealId).eq('activity_type','attachment').order('created_at',{ascending:false});
    if(error){const info=classifyError(error);list.innerHTML=`<div class="fp-attachment-empty"><b>${esc(info.label)}</b><span>${esc(info.detail)}</span></div>`;return;}
    const rows=data||[];
    list.innerHTML=rows.length?rows.map(row=>{const item=decodeAttachment(row.summary);const category=attachmentCategoryLabel(item.category||row.channel?.replace(/^业务资料·/,''));return `<article><div><b>${esc(item.title||'未命名资料')}</b><small>${esc(category)} · ${esc(fmtTime(row.created_at))}</small>${item.note?`<span>${esc(item.note)}</span>`:''}</div><div class="fp-attachment-actions">${item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener">打开链接</a>`:''}<button type="button" data-fp-delete-attachment="${esc(row.id)}" data-deal-id="${esc(dealId)}">删除索引</button></div></article>`;}).join(''):'<div class="fp-attachment-empty"><b>还没有资料索引</b><span>可以记录付款水单、验货报告、物流文件或云盘链接；这里不会上传文件内容。</span></div>';
  }
  function inferDealId(root){return clean(currentDealId||root.querySelector('[data-add-payment]')?.dataset.addPayment||root.querySelector('[data-add-shipment]')?.dataset.addShipment||root.querySelector('[data-add-activity]')?.dataset.addActivity);}
  function mountAttachmentSection(){
    const content=$('#detail-content');if(!content||$('.fp-deal-attachments',content))return;
    const label=clean(content.querySelector('header p')?.textContent);if(label!=='业务记录')return;
    const dealId=inferDealId(content);if(!dealId)return;currentDealId=dealId;
    const grid=$('.detail-grid',content);if(!grid)return;
    const section=document.createElement('section');section.className='detail-section detail-wide fp-deal-attachments';section.dataset.dealId=dealId;
    section.innerHTML=`<div class="fp-attachment-heading"><div><h3>业务资料索引</h3><p>融合在当前业务中，保存资料名称和在线链接，不上传文件内容。可填写 OSS、网盘、邮箱附件或内部文件名。</p></div><span>云端索引</span></div><div class="fp-attachment-list"></div><form class="mini-form fp-attachment-form"><div class="detail-grid"><select name="category"><option value="inquiry">客户与询盘</option><option value="external">对外单据</option><option value="payment">付款凭证</option><option value="production">生产资料</option><option value="inspection">验货与包装</option><option value="logistics">物流与发货</option><option value="other">其他资料</option></select><input name="title" placeholder="资料名称，例如：30% 定金水单" required></div><input name="url" type="url" placeholder="在线链接（可选，例如 OSS / 网盘 / 邮箱附件链接）"><input name="note" placeholder="内部备注（可选）"><button class="btn secondary" type="submit">添加资料索引</button></form>`;
    const fileSection=[...grid.children].find(node=>/关联文件与版本关系/.test(node.querySelector('h3')?.textContent||''));grid.insertBefore(section,fileSection||null);
    renderAttachmentList(dealId,section);
  }
  async function saveAttachment(form){
    const section=form.closest('.fp-deal-attachments');const dealId=clean(section?.dataset.dealId);if(!dealId)return;
    if(isLocal||!client){alert('本地预览模式不能保存云端资料索引。');return;}
    const current=await user();if(!current){alert('请先登录后再保存资料索引。');return;}
    const fd=new FormData(form);const title=clean(fd.get('title'));const url=clean(fd.get('url'));const note=clean(fd.get('note'));const category=clean(fd.get('category'))||'other';
    if(!title){alert('请填写资料名称。');return;}
    if(url){try{new URL(url);}catch{alert('在线链接格式不正确，请填写完整 http 或 https 地址。');return;}}
    const payload={user_id:current.id,deal_id:dealId,activity_type:'attachment',channel:`业务资料·${attachmentCategoryLabel(category)}`,summary:encodeAttachment({category,title,url,note})};
    const {error}=await client.from('deal_activities').insert(payload);if(error){alert(`保存失败：${error.message||error}`);return;}form.reset();await renderAttachmentList(dealId,section);
  }
  async function deleteAttachment(id,dealId){
    if(!confirm('只删除这条资料索引，不会删除链接指向的原文件。确定继续吗？'))return;
    const current=await user();if(!current||!client)return;
    const {error}=await client.from('deal_activities').delete().eq('id',id).eq('user_id',current.id).eq('activity_type','attachment');if(error){alert(`删除失败：${error.message||error}`);return;}
    const section=$(`.fp-deal-attachments[data-deal-id="${CSS.escape(dealId)}"]`);if(section)await renderAttachmentList(dealId,section);
  }

  function install(){
    ensureDataPanel();
    document.addEventListener('click',event=>{
      const dataAction=event.target.closest('[data-account-action="data"]');if(dataAction)setTimeout(checkDataHealth,30);
      if(event.target.closest('[data-fp-data-check]'))checkDataHealth();
      if(event.target.closest('[data-fp-export-all]'))exportAllCloud();
      if(event.target.closest('[data-fp-export-local]'))exportLocalSettings();
      const openDeal=event.target.closest('[data-open-deal],[data-check-deal],[data-fp-global-kind="deal"]');if(openDeal)currentDealId=clean(openDeal.dataset.openDeal||openDeal.dataset.checkDeal||openDeal.dataset.fpGlobalId);
      const deleteButton=event.target.closest('[data-fp-delete-attachment]');if(deleteButton)deleteAttachment(deleteButton.dataset.fpDeleteAttachment,deleteButton.dataset.dealId);
    },true);
    document.addEventListener('submit',event=>{const form=event.target.closest('.fp-attachment-form');if(!form)return;event.preventDefault();saveAttachment(form);});
    const content=$('#detail-content');if(content){new MutationObserver(()=>setTimeout(mountAttachmentSection,0)).observe(content,{childList:true,subtree:true});}
    guardAccountContext();
    if(client)client.auth.onAuthStateChange(()=>setTimeout(guardAccountContext,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.FlypigBOXDataSafety={checkDataHealth,exportAllCloud,exportLocalSettings};
})();
