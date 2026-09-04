(()=>{'use strict';
if(!window.HUIDI_LOCAL_ONLY?.localOnly)return;
const $=s=>document.querySelector(s);
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}};
const K={customers:'huidi_local_customers_v1',products:'huidi_local_products_v1',deals:'huidi_local_deals_v2'};
const clean=v=>String(v??'').trim();
const pick=(row,keys)=>{for(const key of keys){const v=clean(row?.[key]);if(v)return v}return''};
const toast=(message,type='ok')=>{const host=$('#toastWrap');if(!host)return alert(message);const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;host.appendChild(el);setTimeout(()=>el.remove(),4200)};
const toB64=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value))));
async function api(path,{method='GET',body}={}){
  const res=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({ok:false,message:`HTTP ${res.status}`}));
  if(!res.ok||data?.ok===false)throw new Error(data?.message||data?.error||`HTTP ${res.status}`);
  return data;
}
function statusEls(){return{pill:$('#feishuStatusPill'),text:$('#feishuStatusText'),meta:$('#feishuStatusMeta'),sync:$('#feishuSyncBtn'),test:$('#feishuTestBtn'),open:$('#feishuOpenBtn')}}
function renderOffline(){const e=statusEls();if(e.pill){e.pill.className='pill orange';e.pill.textContent='当前离线'}if(e.text)e.text.textContent='联网后才会连接飞书；本地 JSON 备份与恢复不受影响。';if(e.meta)e.meta.textContent='飞书是协作副本，不替代完整本地备份。';if(e.sync)e.sync.disabled=true;if(e.test)e.test.disabled=true;if(e.open)e.open.disabled=true;}
function renderStatus(s={}){if(!navigator.onLine)return renderOffline();const e=statusEls();const configured=Boolean(s.configured);if(e.pill){e.pill.className=`pill ${configured?'green':'orange'}`;e.pill.textContent=configured?'已配置':'在线 · 未配置'}if(e.text)e.text.textContent=configured?(s.last_sync_at?`最近同步：${new Date(s.last_sync_at).toLocaleString()}。`:'飞书已配置，可以测试连接或同步协作快照。'):'填写你自己的飞书自建应用 App ID / App Secret 后即可使用。';const meta=[];if(s.app_id_masked)meta.push(`应用 ${s.app_id_masked}`);if(s.document_id)meta.push(`文档 ${s.document_id}`);if(e.meta)e.meta.textContent=meta.join(' · ')||'只在你主动点击时由本机服务连接飞书开放平台。';if(e.sync)e.sync.disabled=!configured;if(e.test)e.test.disabled=!configured;if(e.open){e.open.disabled=!s.document_url;e.open.dataset.url=s.document_url||'';}}
async function refreshStatus(){if(!navigator.onLine)return renderOffline();try{renderStatus(await api('/api/feishu/status'))}catch(err){const e=statusEls();if(e.pill){e.pill.className='pill red';e.pill.textContent='本机服务未就绪'}if(e.text)e.text.textContent=err.message;if(e.sync)e.sync.disabled=true;if(e.test)e.test.disabled=true;}}
function compactCustomer(row){return{company:pick(row,['company','companyName','name','customerName']),contact:pick(row,['contact','contactName','person']),country:pick(row,['country','region']),updated_at:pick(row,['updated_at','updatedAt','created_at','createdAt'])}}
function compactProduct(row){return{sku:pick(row,['sku','code','productCode']),name:pick(row,['name','productName','title']),spec:pick(row,['spec','specification','model']),category:pick(row,['category','categoryName']),price:pick(row,['price','unitPrice']),currency:pick(row,['currency'])||'USD'}}
function compactDeal(row){return{title:pick(row,['title','name','dealName','inquiryNo']),customer:pick(row,['customerName','customer','company']),stage:pick(row,['stage','status']),amount:pick(row,['amount','expectedAmount','value']),next:pick(row,['nextAction','nextStep','nextFollowUp']),updated_at:pick(row,['updated_at','updatedAt','created_at','createdAt'])}}
async function buildSnapshot(){
  const documents=window.HUIDILocalDB?.readIndex?.()||[];
  const customers=read(K.customers),products=read(K.products),deals=read(K.deals);
  return{
    format:'HUIDI_FEISHU_COLLAB_SNAPSHOT_V1',
    generated_at:new Date().toISOString(),
    privacy_note:'Collaboration snapshot only. No images, signatures, stamps, bank accounts, browser backup payload or App Secret are included.',
    counts:{customers:customers.length,products:products.length,deals:deals.length,documents:documents.length},
    documents:documents.slice(0,80).map(row=>({type:row.document_type||row.summary?.document_type||'',no:row.document_no||row.summary?.document_no||'',customer:row.customer_name||row.summary?.customer_name||'',updated_at:row.updated_at||''})),
    customers:customers.slice(0,50).map(compactCustomer),
    products:products.slice(0,80).map(compactProduct),
    deals:deals.slice(0,50).map(compactDeal)
  };
}
function openConfig(status={}){const dialog=$('#appDialog');if(!dialog)return;dialog.innerHTML=`<div class="modal"><div class="modal-head"><div><h3>飞书连接与数据权限</h3><p>可选在线能力。凭证只保存在这个软件目录的私有配置文件中，不写入浏览器备份，也不会打包进公开源码。</p></div><button class="close" type="button" data-feishu-close>×</button></div><div class="form-grid"><div class="field"><label>App ID</label><input class="input" id="feishuAppId" autocomplete="off" value="${status.app_id||''}" placeholder="cli_xxxxxxxxxx"></div><div class="field"><label>App Secret</label><input class="input" id="feishuAppSecret" type="password" autocomplete="new-password" placeholder="${status.configured?'留空表示保持现有 Secret':'填写自建应用 App Secret'}"></div><div class="field"><label>飞书企业域名（可选）</label><input class="input" id="feishuTenantDomain" value="${status.tenant_domain||''}" placeholder="example.feishu.cn"></div><div class="field"><label>目标文件夹 Token（可选）</label><input class="input" id="feishuFolderToken" value="${status.folder_token||''}" placeholder="fldcn...；留空则使用应用可创建的位置"></div><div class="field full"><label>已有文档 ID（可选）</label><input class="input" id="feishuDocumentId" value="${status.document_id||''}" placeholder="留空：首次同步自动创建；填写：后续快照追加到该文档"></div></div><div class="feishu-security-note"><b>需要的飞书权限</b><span>建议在飞书开放平台为你自己的自建应用开启所需的云空间、电子表格、多维表格以及文档读写权限。HUIDI 只能访问该应用实际获准访问的文件；如果指定文件夹，还需要把目标文件夹授权给该应用。</span></div><div class="modal-foot"><button class="btn" type="button" data-feishu-close>取消</button><button class="btn primary" type="button" id="feishuSaveConfig">保存配置</button></div></div>`;dialog.showModal();dialog.querySelectorAll('[data-feishu-close]').forEach(b=>b.onclick=()=>dialog.close());$('#feishuSaveConfig').onclick=async()=>{const body={app_id:clean($('#feishuAppId')?.value),app_secret:clean($('#feishuAppSecret')?.value),tenant_domain:clean($('#feishuTenantDomain')?.value),folder_token:clean($('#feishuFolderToken')?.value),document_id:clean($('#feishuDocumentId')?.value)};try{await api('/api/feishu/config',{method:'POST',body});dialog.close();toast('飞书本地配置已保存。');await refreshStatus()}catch(err){toast(`保存失败：${err.message}`,'error')}};}
async function configure(){let s={};try{s=await api('/api/feishu/status')}catch(_){}openConfig(s)}
async function testConnection(){if(!navigator.onLine)return renderOffline();const b=$('#feishuTestBtn');if(b){b.disabled=true;b.textContent='检测中…'}try{const r=await api('/api/feishu/test',{method:'POST'});toast(r.message||'飞书连接正常。');await refreshStatus()}catch(err){toast(`飞书连接失败：${err.message}`,'error')}finally{if(b){b.textContent='测试连接';b.disabled=false}}}
async function sync(){if(!navigator.onLine)return renderOffline();const b=$('#feishuSyncBtn');if(b){b.disabled=true;b.textContent='同步中…'}try{const snapshot=await buildSnapshot();const r=await api('/api/feishu/sync',{method:'POST',body:{snapshot_b64:toB64(snapshot)}});toast(`飞书同步完成：${r.blocks_written||0} 个内容块。`);await refreshStatus()}catch(err){toast(`飞书同步失败：${err.message}`,'error')}finally{if(b){b.textContent='同步协作快照';b.disabled=false}}}
window.addEventListener('click',e=>{const b=e.target.closest?.('[data-feishu-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.feishuAction;if(a==='config')configure();if(a==='test')testConnection();if(a==='sync')sync();if(a==='open'&&b.dataset.url)window.open(b.dataset.url,'_blank','noopener,noreferrer')},true);
window.addEventListener('online',refreshStatus);window.addEventListener('offline',renderOffline);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshStatus,{once:true});else refreshStatus();
})();
