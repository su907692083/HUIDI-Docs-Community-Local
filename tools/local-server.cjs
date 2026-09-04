const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),url=require('url');
const projectRoot=path.resolve(__dirname,'..'),root=path.resolve(projectRoot,'public'),port=Number(process.env.HUIDI_PORT||8765),host='127.0.0.1';
const configDir=path.join(projectRoot,'config'),feishuConfigPath=path.join(configDir,'feishu.local.json');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pdf':'application/pdf','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const clean=v=>String(v??'').trim(),now=()=>new Date().toISOString();
function json(res,status,payload){const data=Buffer.from(JSON.stringify(payload),'utf8');res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)}
function readBody(req,limit=2*1024*1024){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('请求内容过大'));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject)})}
function readConfig(){try{return JSON.parse(fs.readFileSync(feishuConfigPath,'utf8'))||{}}catch(_){return{}}}
function saveConfig(next){fs.mkdirSync(configDir,{recursive:true});const safe={app_id:clean(next.app_id),app_secret:clean(next.app_secret),tenant_domain:clean(next.tenant_domain).replace(/^https?:\/\//i,'').replace(/\/+$/,''),folder_token:clean(next.folder_token),document_id:clean(next.document_id),last_sync_at:clean(next.last_sync_at),last_document_url:clean(next.last_document_url)};fs.writeFileSync(feishuConfigPath,JSON.stringify(safe,null,2),{encoding:'utf8',mode:0o600});return safe}
function maskedAppId(v){const s=clean(v);if(!s)return'';if(s.length<=8)return s.slice(0,3)+'***';return s.slice(0,6)+'…'+s.slice(-4)}
function documentUrl(cfg){if(cfg.last_document_url)return cfg.last_document_url;if(cfg.tenant_domain&&cfg.document_id)return `https://${cfg.tenant_domain}/docx/${cfg.document_id}`;return''}
function publicStatus(cfg=readConfig()){return{ok:true,configured:Boolean(cfg.app_id&&cfg.app_secret),app_id:cfg.app_id||'',app_id_masked:maskedAppId(cfg.app_id),tenant_domain:cfg.tenant_domain||'',folder_token:cfg.folder_token||'',document_id:cfg.document_id||'',document_url:documentUrl(cfg),last_sync_at:cfg.last_sync_at||''}}
function feishuRequest(method,apiPath,body,token){return new Promise((resolve,reject)=>{const data=body==null?null:Buffer.from(JSON.stringify(body),'utf8');const headers={'Accept':'application/json'};if(data){headers['Content-Type']='application/json; charset=utf-8';headers['Content-Length']=data.length}if(token)headers.Authorization=`Bearer ${token}`;const req=https.request({hostname:'open.feishu.cn',port:443,path:apiPath,method,headers,timeout:15000},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');let parsed={};try{parsed=JSON.parse(raw||'{}')}catch(_){return reject(new Error(`飞书返回了无法识别的内容（HTTP ${res.statusCode}）`))}if(res.statusCode<200||res.statusCode>=300)return reject(new Error(parsed.msg||parsed.message||`飞书 HTTP ${res.statusCode}`));if(typeof parsed.code==='number'&&parsed.code!==0)return reject(new Error(`${parsed.msg||'飞书接口失败'}（code ${parsed.code}）`));resolve(parsed)})});req.on('timeout',()=>req.destroy(new Error('连接飞书超时')));req.on('error',reject);if(data)req.write(data);req.end()})}
async function tenantToken(cfg){if(!cfg.app_id||!cfg.app_secret)throw new Error('请先配置飞书 App ID 和 App Secret');const r=await feishuRequest('POST','/open-apis/auth/v3/tenant_access_token/internal',{app_id:cfg.app_id,app_secret:cfg.app_secret});if(!r.tenant_access_token)throw new Error('飞书未返回 tenant_access_token，请检查应用凭证和发布状态');return r.tenant_access_token}
function scalar(v){if(v==null)return'';if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return String(v);if(Array.isArray(v))return v.map(scalar).filter(Boolean).join(' / ');if(typeof v==='object'){if(v.text!=null)return scalar(v.text);if(v.name!=null)return scalar(v.name);if(v.link!=null)return scalar(v.link);return Object.values(v).map(scalar).filter(Boolean).join(' / ')}return''}
function parseFeishuSource(input={}){
  const explicitType=clean(input.type),explicitToken=clean(input.token),title=clean(input.title),raw=clean(input.url);
  if(explicitType&&explicitToken)return{kind:/bitable|base/i.test(explicitType)?'bitable':'sheet',token:explicitToken,title,url:raw||'',sheet_id:clean(input.sheet_id),table_id:clean(input.table_id)};
  if(!raw)throw new Error('请粘贴飞书电子表格或多维表格链接');let u;try{u=new URL(raw)}catch(_){throw new Error('飞书链接格式无法识别')}
  const seg=u.pathname.split('/').filter(Boolean),idxSheet=seg.findIndex(x=>x==='sheets'),idxBase=seg.findIndex(x=>x==='base'||x==='bitable');
  if(idxSheet>=0&&seg[idxSheet+1])return{kind:'sheet',token:seg[idxSheet+1],sheet_id:clean(u.searchParams.get('sheet')||u.searchParams.get('sheet_id')),title,url:raw};
  if(idxBase>=0&&seg[idxBase+1])return{kind:'bitable',token:seg[idxBase+1],table_id:clean(u.searchParams.get('table')||u.searchParams.get('table_id')),title,url:raw};
  if(seg.includes('wiki'))throw new Error('当前是知识库 Wiki 链接。请在飞书中打开源电子表格/多维表格后复制原表链接再读取。');
  throw new Error('当前只支持飞书电子表格 Sheets 和多维表格 Bitable 链接');
}
function typeLabel(t){return({sheet:'电子表格',bitable:'多维表格',folder:'文件夹',docx:'文档',doc:'文档'})[clean(t)]||clean(t)||'文件'}
async function listFeishuFiles(cfg,token,folder){const q=new URLSearchParams();if(folder)q.set('folder_token',folder);q.set('page_size','50');const r=await feishuRequest('GET',`/open-apis/drive/v1/files?${q.toString()}`,null,token);const items=r?.data?.files||r?.data?.items||[];return items.map(x=>{const type=clean(x.type||x.file_type),tok=clean(x.token||x.file_token);return{token:tok,name:clean(x.name||x.title),type,type_label:typeLabel(type),modified_time:clean(x.modified_time||x.modified_at||x.edit_time),url:clean(x.url),reusable:['sheet','bitable'].includes(type)}})}
async function inspectSheet(src,token){const meta=await feishuRequest('GET',`/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(src.token)}/sheets/query`,null,token),sheets=meta?.data?.sheets||[];let sh=null;if(src.sheet_id)sh=sheets.find(x=>clean(x.sheet_id||x.sheetId)===src.sheet_id);if(!sh)sh=sheets[0];if(!sh)throw new Error('这张电子表格没有可读取的工作表');const sheetId=clean(sh.sheet_id||sh.sheetId),title=clean(src.title||sh.title||meta?.data?.spreadsheet?.title||'飞书电子表格');const range=encodeURIComponent(`${sheetId}!A1:AZ1000`);const values=await feishuRequest('GET',`/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(src.token)}/values/${range}`,null,token),matrix=values?.data?.valueRange?.values||values?.data?.value_range?.values||[];const head=(matrix[0]||[]).map((x,i)=>clean(scalar(x))||`列${i+1}`);const seen={};const columns=head.map((x,i)=>{let n=x;if(seen[n])n=`${n}_${i+1}`;seen[n]=1;return n});const rows=matrix.slice(1).filter(r=>Array.isArray(r)&&r.some(v=>clean(scalar(v)))).map(r=>Object.fromEntries(columns.map((c,i)=>[c,scalar(r[i])])));return{source:{...src,title,sheet_id:sheetId,sheet_title:clean(sh.title),kind:'sheet'},columns,rows:rows.slice(0,980)}}
async function inspectBitable(src,token){let tables=[];if(!src.table_id){const tr=await feishuRequest('GET',`/open-apis/bitable/v1/apps/${encodeURIComponent(src.token)}/tables?page_size=100`,null,token);tables=tr?.data?.items||[];}let tableId=src.table_id||clean(tables[0]?.table_id);if(!tableId)throw new Error('这张多维表格没有可读取的数据表');let table=tables.find(x=>clean(x.table_id)===tableId)||{};let items=[],pageToken='';for(let i=0;i<10;i++){const q=new URLSearchParams({page_size:'100'});if(pageToken)q.set('page_token',pageToken);const rr=await feishuRequest('GET',`/open-apis/bitable/v1/apps/${encodeURIComponent(src.token)}/tables/${encodeURIComponent(tableId)}/records?${q.toString()}`,null,token);items=items.concat(rr?.data?.items||[]);if(!rr?.data?.has_more||!rr?.data?.page_token)break;pageToken=rr.data.page_token}const colSet=new Set();items.forEach(r=>Object.keys(r.fields||{}).forEach(k=>colSet.add(k)));const columns=Array.from(colSet);const rows=items.map(r=>{const o={};columns.forEach(c=>o[c]=scalar(r.fields?.[c]));o.__record_id=clean(r.record_id);return o});return{source:{...src,kind:'bitable',table_id:tableId,title:clean(src.title||table.name||'飞书多维表格')},columns,rows}}
async function inspectFeishuSource(cfg,input){const token=await tenantToken(cfg),src=parseFeishuSource(input);return src.kind==='bitable'?inspectBitable(src,token):inspectSheet(src,token)}
async function createDoc(cfg,token){const body={title:'HUIDI Docs · 业务协作快照'};if(cfg.folder_token)body.folder_token=cfg.folder_token;const r=await feishuRequest('POST','/open-apis/docx/v1/documents',body,token);const id=r?.data?.document?.document_id||r?.data?.document_id||'';if(!id)throw new Error('飞书文档创建成功但未返回 document_id');return id}
const trType=t=>({quotation:'报价单',proforma_invoice:'形式发票 PI',sales_contract:'销售合同',commercial_invoice:'商业发票 CI',packing_list:'装箱单 PL'})[clean(t)]||clean(t)||'单据';
const line=v=>clean(v).replace(/[\r\n]+/g,' ').slice(0,420);
function listText(rows,formatter,empty='暂无记录'){if(!Array.isArray(rows)||!rows.length)return empty;return rows.map((r,i)=>`${i+1}. ${formatter(r)}`).join('\n').slice(0,9000)}
function textBlock(content){return{block_type:2,text:{elements:[{text_run:{content:String(content||'')}}]}}}
function heading2(content){return{block_type:4,heading2:{elements:[{text_run:{content:String(content||'')}}]}}}
function buildBlocks(snapshot){const c=snapshot.counts||{},stamp=new Date(snapshot.generated_at||Date.now()).toLocaleString('zh-CN',{hour12:false});return[
  heading2(`同步快照 · ${stamp}`),
  textBlock('HUIDI Docs Community Local 在线协作副本。完整 JSON 本地备份仍是恢复与换电脑迁移的唯一完整备份；本快照不包含图片、签名、公章、银行账号或应用密钥。'),
  heading2('业务概览'),
  textBlock(`客户 ${Number(c.customers||0)} · 商品 ${Number(c.products||0)} · 询盘/订单 ${Number(c.deals||0)} · 本地单据 ${Number(c.documents||0)}`),
  heading2('最近单据'),
  textBlock(listText(snapshot.documents,r=>[trType(r.type),line(r.no)||'未编号',line(r.customer)||'未填客户',line(r.updated_at)].filter(Boolean).join(' · '))),
  heading2('客户摘要'),
  textBlock(listText(snapshot.customers,r=>[line(r.company)||'未命名客户',line(r.contact),line(r.country)].filter(Boolean).join(' · '))),
  heading2('商品摘要'),
  textBlock(listText(snapshot.products,r=>[line(r.sku)||'无 SKU',line(r.name)||'未命名商品',line(r.spec),[line(r.currency),line(r.price)].filter(Boolean).join(' ')].filter(Boolean).join(' · '))),
  heading2('询盘 / 订单摘要'),
  textBlock(listText(snapshot.deals,r=>[line(r.title)||'未命名业务',line(r.customer),line(r.stage),line(r.amount),line(r.next)].filter(Boolean).join(' · ')))
]}
async function appendBlocks(docId,blocks,token){let written=0;for(let i=0;i<blocks.length;i+=20){const batch=blocks.slice(i,i+20);await feishuRequest('POST',`/open-apis/docx/v1/documents/${encodeURIComponent(docId)}/blocks/${encodeURIComponent(docId)}/children?document_revision_id=-1`,{children:batch},token);written+=batch.length}return written}
async function handleApi(req,res,p){try{
  if(req.method==='GET'&&p==='/api/feishu/status')return json(res,200,publicStatus());
  if(req.method==='POST'&&p==='/api/feishu/config'){
    const incoming=JSON.parse(await readBody(req)||'{}'),current=readConfig();
    const next={...current,app_id:clean(incoming.app_id)||current.app_id||'',app_secret:clean(incoming.app_secret)||current.app_secret||'',tenant_domain:clean(incoming.tenant_domain),folder_token:clean(incoming.folder_token),document_id:clean(incoming.document_id)};
    if(!next.app_id)throw new Error('App ID 不能为空');if(!next.app_secret)throw new Error('App Secret 不能为空');saveConfig(next);return json(res,200,{...publicStatus(next),message:'飞书本地配置已保存'});
  }
  if(req.method==='POST'&&p==='/api/feishu/test'){const cfg=readConfig();await tenantToken(cfg);return json(res,200,{ok:true,message:'飞书凭证有效，已成功获取 tenant_access_token。'});}
  if(req.method==='POST'&&p==='/api/feishu/source/list'){const incoming=JSON.parse(await readBody(req)||'{}'),cfg=readConfig(),token=await tenantToken(cfg),folder=clean(incoming.folder_token)||clean(cfg.folder_token);if(!folder)throw new Error('请填写飞书文件夹 Token，或先在“配置飞书”中保存默认文件夹');const items=await listFeishuFiles(cfg,token,folder);return json(res,200,{ok:true,folder_token:folder,items});}
  if(req.method==='POST'&&p==='/api/feishu/source/inspect'){const incoming=JSON.parse(await readBody(req)||'{}'),cfg=readConfig(),result=await inspectFeishuSource(cfg,incoming);return json(res,200,{ok:true,...result});}
  if(req.method==='POST'&&p==='/api/feishu/sync'){
    const incoming=JSON.parse(await readBody(req)||'{}');if(!incoming.snapshot_b64)throw new Error('同步数据为空');let snapshot;try{snapshot=JSON.parse(Buffer.from(incoming.snapshot_b64,'base64').toString('utf8'))}catch(_){throw new Error('同步数据解析失败')}
    const cfg=readConfig(),token=await tenantToken(cfg);let docId=cfg.document_id;if(!docId)docId=await createDoc(cfg,token);const blocks=buildBlocks(snapshot),written=await appendBlocks(docId,blocks,token);const saved=saveConfig({...cfg,document_id:docId,last_sync_at:now(),last_document_url:cfg.tenant_domain?`https://${cfg.tenant_domain}/docx/${docId}`:''});return json(res,200,{ok:true,document_id:docId,document_url:documentUrl(saved),synced_at:saved.last_sync_at,blocks_written:written});
  }
  return json(res,404,{ok:false,message:'API not found'});
}catch(err){return json(res,500,{ok:false,message:String(err?.message||err)})}}
const server=http.createServer(async(req,res)=>{const parsed=url.parse(req.url),p=decodeURIComponent(parsed.pathname||'/');if(p.startsWith('/api/feishu/'))return handleApi(req,res,p);let pathname=p;if(pathname==='/')pathname='/index.html';let f=path.resolve(root,'.'+pathname);if(!f.startsWith(root)){res.writeHead(403);return res.end('Forbidden')}fs.stat(f,(err,st)=>{if(!err&&st.isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,data)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found')}res.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)})})});
const cp=require('child_process');
const basePort=port,maxPort=basePort+10;
function listenWithFallback(candidate){
  const onError=err=>{
    if(err&&err.code==='EADDRINUSE'&&candidate<maxPort){server.removeListener('error',onError);server.removeAllListeners('listening');return listenWithFallback(candidate+1)}
    console.error('HUIDI local server failed:',err&&err.message||err);process.exitCode=1;
  };
  server.once('error',onError);
  server.listen(candidate,host,()=>{
    server.removeListener('error',onError);
    const localUrl=`http://${host}:${candidate}/`;
    console.log(`HUIDI Docs Community Local 1.2.0 RC16.29 已启动：${localUrl}`);
    if(candidate!==basePort)console.log(`端口 ${basePort} 已占用，已自动切换到 ${candidate}。`);
    console.log('本地业务默认离线；飞书协作仅在你主动点击同步时由本机服务联网。');
    if(process.platform==='win32')try{cp.exec(`start "" "${localUrl}"`)}catch(_){}
  });
}
listenWithFallback(basePort);
