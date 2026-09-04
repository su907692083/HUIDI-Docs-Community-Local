/* HUIDI Docs Community Local RC16.25 — Workspace Usability + Apple-like UI Closure
   Explicit DOM composition only. No MutationObserver and no editor/PDF runtime ownership. */
(()=>{
'use strict';
const VERSION='1.2.0-RC16.25';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
function closeR3Menus(except){$$('.workspace-r3-create,.workspace-r3-overflow').forEach(x=>{if(x!==except)x.open=false})}
function buildCreate(){
 const side=$('.sidebar');if(!side)return;
 $('.workspace-r2-quick',side)?.remove();
 if($('.workspace-r3-create',side))return;
 const d=document.createElement('details');d.className='workspace-r3-create';d.innerHTML=`<summary>＋ 新建</summary><div class="workspace-r3-create-menu"><button data-action="new-deal">询盘 / 订单</button><button data-action="new-customer">客户</button><button data-action="new-product">商品</button><button data-action="new-doc">报价 / 单据</button></div>`;
 const search=$('.workspace-r2-search',side);if(search)side.insertBefore(d,search);else $('.brand',side)?.insertAdjacentElement('afterend',d);
}
function flowLine(){
 if($('.workspace-r3-flowline'))return;const main=$('.main'),bar=$('.topbar');if(!main||!bar)return;
 const f=document.createElement('div');f.className='workspace-r3-flowline';f.innerHTML='<span class="active">客户 / 询盘</span><span>商品</span><span>报价</span><span>PI / 合同</span><span>CI / 装箱</span><span>出运</span>';
 bar.insertAdjacentElement('afterend',f);
}
function homeTopActions(){const box=$('.top-actions');if(!box)return;box.innerHTML='<button class="btn primary" data-action="new-deal">＋ 新询盘</button><button class="btn" data-action="new-doc">做报价 / 单据</button>'}
function makeOverflow(view,primaryAction,extras=[]){
 const sec=$(`#view-${view}`),actions=$('.section-actions',sec);if(!actions||actions.dataset.r3)return;actions.dataset.r3='1';
 const all=Array.from(actions.children);const primary=all.find(x=>x.matches?.(`[data-action="${primaryAction}"]`));
 if(primary){all.forEach(x=>x.remove());actions.appendChild(primary)}
 const moved=[];all.forEach(x=>{if(x!==primary)moved.push(x)});
 for(const sel of extras){const x=$(sel,sec);if(x&&!moved.includes(x)){x.remove();moved.push(x)}}
 if(!moved.length)return;
 const d=document.createElement('details');d.className='workspace-r3-overflow';d.innerHTML='<summary class="btn" aria-label="更多操作">•••</summary><div class="workspace-r3-overflow-menu"></div>';
 const menu=$('.workspace-r3-overflow-menu',d);moved.forEach(x=>menu.appendChild(x));actions.appendChild(d);
}
function compactActions(){
 makeOverflow('deals','new-deal',['.filterbar [data-action="export-deals"]']);
 makeOverflow('customers','new-customer');
 makeOverflow('products','new-product');
 makeOverflow('catalog','open-catalog');
 makeOverflow('documents','new-doc');
 makeOverflow('brands','new-brand');
 makeOverflow('templates','new-template');
 makeOverflow('mail','new-mail');
}
function moveFeishuCollab(){
 const panel=$('#view-backup .feishu-online-panel'),host=$('#view-feishu');if(!panel||!host||$('.workspace-r3-feishu-collab',host))return;
 const d=document.createElement('details');d.className='workspace-r3-feishu-collab';d.innerHTML='<summary><span>协作快照（可选）</span><small>把本地业务摘要同步到飞书文档</small></summary>';d.appendChild(panel);host.appendChild(d);
 const backupHead=$('#view-backup .section-head p');if(backupHead)backupHead.textContent='完整 JSON 用于真正恢复和换电脑；CSV 用于整理和迁移。飞书数据源与协作功能已统一放到“飞书资料”。';
}
function fieldByKey(dlg,key){return $(`[data-f="${key}"]`,dlg)?.closest('.field')||null}
function hasValue(field){const el=$('[data-f]',field);return !!clean(el?.value)}
function section(title,tip,fields,open=false){
 const d=document.createElement('details');d.className='workspace-r3-form-section';d.open=open;d.innerHTML=`<summary><b>${title}</b><span>${tip}</span></summary><div class="workspace-r3-advanced-grid"></div>`;const g=$('.workspace-r3-advanced-grid',d);fields.filter(Boolean).forEach(x=>g.appendChild(x));return d;
}
function basicGrid(form,fields){const g=document.createElement('div');g.className='workspace-r3-basic-grid';fields.filter(Boolean).forEach(x=>g.appendChild(x));const foot=$('.modal-foot',form);form.insertBefore(g,foot||null);return g}
function formNote(form,title,desc){if($('.workspace-r3-form-note',form))return;const n=document.createElement('div');n.className='workspace-r3-form-note';n.innerHTML=`<b>${title}</b><span>${desc}</span>`;form.insertBefore(n,form.firstChild)}
function smartPaste(dlg){const p=$('.modal>.panel',dlg);if(!p||$('.workspace-r3-smart-paste',dlg))return;const text=$('textarea',p),act=$('.row-actions',p);if(!text)return;const d=document.createElement('details');d.className='workspace-r3-smart-paste';d.innerHTML='<summary><span>粘贴客户资料自动识别</span><small>邮件签名 / 名片 / WhatsApp</small></summary><div class="workspace-r3-smart-paste-body"></div>';const b=$('.workspace-r3-smart-paste-body',d);b.appendChild(text);if(act)b.appendChild(act);p.replaceWith(d)}
function enhanceCustomer(dlg){
 const modal=$('.modal',dlg),form=$('#dataForm',dlg);if(!modal||!form||modal.dataset.r3)return;modal.dataset.r3='customer';modal.classList.add('workspace-r3-customer-modal');
 smartPaste(dlg);formNote(form,'先填常用资料','公司名 + 联系方式就可以先保存，税务/收货资料需要时再补。');
 const basic=['company','contact','email','phone','country','currency','source','followup_date'].map(k=>fieldByKey(dlg,k));basicGrid(form,basic);
 const contact=['website','preferred_language','tags','address','notes'].map(k=>fieldByKey(dlg,k));
 const tax=['country_code','registration_no','tax_id','vat','eori'].map(k=>fieldByKey(dlg,k));
 const shipping=['bill_to','ship_to','consignee_name','consignee_contact','consignee_phone','consignee_email','consignee_address','notify_name','notify_contact','notify_phone','notify_email','notify_address','destination_port'].map(k=>fieldByKey(dlg,k));
 const foot=$('.modal-foot',form);[[contact,'更多客户资料','网站、标签、地址和内部备注'],[tax,'税务与注册资料','Tax ID / VAT / EORI 等'],[shipping,'收货与通知资料','Bill To / Ship To / Consignee / Notify Party']].forEach(([arr,t,tip])=>{const ds=section(t,tip,arr,arr.some(hasValue));form.insertBefore(ds,foot)});
}
function relabelProduct(dlg){const labels={carton_size:'外箱尺寸（长 × 宽 × 高 cm）',qty_per_carton:'装箱数（pcs/carton）',net_weight:'箱净重 N.W.（kg）',gross_weight:'箱毛重 G.W.（kg）',cbm:'每箱体积 CBM',dimensions:'其他包装尺寸（可选）'};Object.entries(labels).forEach(([k,v])=>{const f=fieldByKey(dlg,k),l=$('label',f);if(l)l.textContent=v});const x=$('[data-f="carton_size"]',dlg);if(x&&!x.placeholder)x.placeholder='例如 52 × 36 × 25'}
function bindCbm(dlg){const size=$('[data-f="carton_size"]',dlg),cbm=$('[data-f="cbm"]',dlg);if(!size||!cbm||size.dataset.r3)return;size.dataset.r3='1';size.addEventListener('change',()=>{if(clean(cbm.value))return;const nums=String(size.value||'').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];if(nums.length>=3&&nums.slice(0,3).every(n=>n>0)){cbm.value=(nums[0]*nums[1]*nums[2]/1000000).toFixed(4);cbm.dispatchEvent(new Event('change',{bubbles:true}))}})}
function enhanceProduct(dlg){
 const modal=$('.modal',dlg),form=$('#dataForm',dlg);if(!modal||!form||modal.dataset.r3)return;modal.dataset.r3='product';modal.classList.add('workspace-r3-product-modal');formNote(form,'先录能报价的资料','名称、型号、规格、价格等先保存；包装、报关和来源资料按需展开。');relabelProduct(dlg);
 const basic=['name','sku','spec','price','currency','unit','moq','hs_code'].map(k=>fieldByKey(dlg,k));basicGrid(form,basic);
 const customs=['customs_description','country_of_origin','supplier_name'].map(k=>fieldByKey(dlg,k));
 const pack=['package_type','carton_size','qty_per_carton','net_weight','gross_weight','cbm','dimensions','shipping_marks'].map(k=>fieldByKey(dlg,k));
 const more=['source_url','video_url','notes'].map(k=>fieldByKey(dlg,k));const foot=$('.modal-foot',form);
 [[customs,'报关与供应资料','申报品名、原产国、供应商'],[pack,'包装与物流','外箱、装箱数、重量和 CBM'],[more,'来源与内部资料','来源链接、视频和备注']].forEach(([arr,t,tip])=>{const ds=section(t,tip,arr,arr.some(hasValue));form.insertBefore(ds,foot)});bindCbm(dlg)
}
function enhanceOpenDialog(action){if(!['new-customer','customer-edit','new-product','product-edit'].includes(action))return;setTimeout(()=>{const dlg=$('#appDialog');if(!dlg?.open)return;const title=clean($('.modal-head h3',dlg)?.textContent);if(title.includes('客户'))enhanceCustomer(dlg);else if(title.includes('商品'))enhanceProduct(dlg)},0)}
function pageTitles(){
 const map={customers:['客户','客户资料保存一次，后续报价和单据直接调用。'],products:['商品','常用报价资料优先，包装与报关信息按需补充。'],backup:['备份','换电脑、清缓存或重装前，导出一份完整 JSON。'],feishu:['飞书资料','读取飞书表格，映射后复用到客户、商品和单据。']};
 const v=document.body.dataset.huidiView||'home',x=map[v];if(x){$('#pageTitle').textContent=x[0];$('#pageDesc').textContent=x[1]}
}
function boot(){
 document.body.classList.add('workspace-r3');document.body.dataset.workspaceRelease=VERSION;buildCreate();homeTopActions();flowLine();compactActions();moveFeishuCollab();pageTitles();
 document.addEventListener('click',e=>{const act=e.target.closest('[data-action]')?.dataset.action||'';enhanceOpenDialog(act);const details=e.target.closest('.workspace-r3-create,.workspace-r3-overflow');if(details)closeR3Menus(details);else if(!e.target.closest('.workspace-r3-create-menu,.workspace-r3-overflow-menu'))closeR3Menus();const nav=e.target.closest('.nav-btn');if(nav)setTimeout(pageTitles,0)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeR3Menus()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
