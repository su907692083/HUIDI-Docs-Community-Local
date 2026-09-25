/* HUIDI Docs Community Local RC16.28 — Table-first Interaction Closure
   Final interaction-density owner after R1-R5. Explicit event hooks only; no PDF/editor ownership. */
(()=>{
'use strict';
const VERSION='1.2.0-RC16.28';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
function field(dlg,key){return $(`[data-f="${key}"]`,dlg)?.closest('.field')||null}
function hasVal(f){const el=$('[data-f]',f);return !!clean(el?.value)}
function details(title,tip,fields,cls=''){
 const d=document.createElement('details'); d.className=`workspace-r6-section ${cls}`.trim();
 d.innerHTML=`<summary><span><b>${title}</b><small>${tip}</small></span><i>⌄</i></summary><div class="workspace-r6-section-grid"></div>`;
 const g=$('.workspace-r6-section-grid',d); fields.filter(Boolean).forEach(f=>g.appendChild(f)); return d;
}
function grid(fields,cls='workspace-r6-form-grid'){
 const g=document.createElement('div');g.className=cls;fields.filter(Boolean).forEach(f=>g.appendChild(f));return g;
}
function insertBeforeFoot(form,node){form.insertBefore(node,$('.modal-foot',form)||null)}
function closeSections(root){$$('details.workspace-r3-form-section,details.workspace-r6-section',root).forEach(d=>d.open=false)}
function compactCustomer(dlg){
 const modal=$('.workspace-r3-customer-modal,.modal',dlg),form=$('#dataForm',dlg);if(!form||modal?.dataset.r6==='customer')return;
 modal.dataset.r6='customer';modal.classList.add('workspace-r6-modal','workspace-r6-customer');
 const note=$('.workspace-r3-form-note',form);if(note){note.innerHTML='<b>常用资料</b><span>公司名、联系人和联系方式先保存；税务和收货资料需要时再补。</span>'}
 const paste=$('.workspace-r3-smart-paste',dlg);if(paste){paste.classList.add('workspace-r6-quick-strip');const s=$('summary span',paste);if(s)s.textContent='粘贴客户资料自动识别'}
 closeSections(dlg);
 $$('.workspace-r3-form-section',dlg).forEach(ds=>{const n=$$('.field',ds).filter(hasVal).length;const sm=$('summary span',ds);if(sm&&n)sm.textContent=`${sm.textContent.split(' · ')[0]} · 已填写 ${n} 项`});
}
function compactProduct(dlg){
 const modal=$('.workspace-r3-product-modal,.modal',dlg),form=$('#dataForm',dlg);if(!form||modal?.dataset.r6==='product')return;
 modal.dataset.r6='product';modal.classList.add('workspace-r6-modal','workspace-r6-product');closeSections(dlg);
 const note=$('.workspace-r3-form-note',form);if(note)note.innerHTML='<b>先录能报价的资料</b><span>名称、型号、规格、价格、单位和 MOQ 先保存；报关、包装、来源按需展开。</span>';
}
function dealStageMode(dlg){
 const st=$('[data-f="stage"]',dlg)?.value||'new_inquiry';
 const order=['pi_confirmed','order_confirmed','production','inspection','booking','shipped','completed'].includes(st);
 const ship=['inspection','booking','shipped','completed'].includes(st);
 const o=$('.workspace-r6-order',dlg),s=$('.workspace-r6-shipping',dlg);if(o)o.hidden=!order;if(s)s.hidden=!ship;
}
function compactDeal(dlg){
 const form=$('#dataForm',dlg),modal=$('.modal',dlg);if(!form||!modal||modal.dataset.r6==='deal')return;
 const title=clean($('.modal-head h3',dlg)?.textContent);if(!/询盘|业务/.test(title))return;
 modal.dataset.r6='deal';modal.classList.add('workspace-r6-modal','workspace-r6-deal');
 const old=$('.form-grid',form);if(!old)return;
 const common=['title','customer_id','stage','currency','estimated_amount','probability','next_action','next_action_at','requirements'].map(k=>field(dlg,k));
 const products=field(dlg,'product_ids')||$('.field:has([data-product-choice])',dlg);const notes=field(dlg,'notes');
 const purchase=field(dlg,'purchase_cycle');
 const order=['payment_status','received_amount','production_status'].map(k=>field(dlg,k));
 const shipping=['inspection_date','booking_status','etd','eta'].map(k=>field(dlg,k));
 const sheet=grid(common);sheet.classList.add('workspace-r6-deal-grid');form.insertBefore(sheet,old);
 if(products){products.classList.add('workspace-r6-related-products');insertBeforeFoot(form,products)}
 if(purchase)insertBeforeFoot(form,details('更多业务资料','预计采购周期等低频资料',[purchase],'workspace-r6-more'));
 const od=details('订单执行资料','收款、生产；确认订单后使用',order,'workspace-r6-order');insertBeforeFoot(form,od);
 const sd=details('出运资料','验货、订舱、ETD / ETA；进入出运阶段后使用',shipping,'workspace-r6-shipping');insertBeforeFoot(form,sd);
 if(notes){notes.classList.add('workspace-r6-notes');insertBeforeFoot(form,notes)}
 old.remove();
 const req=field(dlg,'requirements');if(req)req.classList.add('workspace-r6-full');
 const stage=$('[data-f="stage"]',dlg);if(stage&&!stage.dataset.r6){stage.dataset.r6='1';stage.addEventListener('change',()=>dealStageMode(dlg))}
 dealStageMode(dlg);
}
function collapseActions(scope){
 $$('#dealRows tr,#customerRows tr,#productRows tr',scope||document).forEach(tr=>{
  const box=$('.row-actions',tr);if(!box||box.dataset.r6)return;const buttons=$$('button[data-action]',box);if(buttons.length<2)return;box.dataset.r6='1';
  const primary=buttons.find(b=>b.classList.contains('primary'))||buttons[0];const extra=buttons.filter(b=>b!==primary);const more=document.createElement('details');more.className='workspace-r6-row-more';more.innerHTML='<summary aria-label="更多操作">•••</summary><div class="workspace-r6-row-menu"></div>';
  const menu=$('.workspace-r6-row-menu',more);extra.forEach(b=>{b.classList.remove('primary','danger','small');menu.appendChild(b)});box.innerHTML='';box.appendChild(primary);box.appendChild(more);
 });
 $$('#docRows tr').forEach(tr=>{const box=$('.workspace-r4-doc-actions',tr);if(!box||box.dataset.r6)return;box.dataset.r6='1';const btns=$$('button',box);if(btns.length<2)return;const next=btns.find(b=>b.classList.contains('primary'));const open=btns.find(b=>b!==next);if(next){next.textContent='继续下一步';box.innerHTML='';box.appendChild(next);if(open){const more=document.createElement('details');more.className='workspace-r6-row-more';more.innerHTML='<summary aria-label="更多操作">•••</summary><div class="workspace-r6-row-menu"></div>';$('.workspace-r6-row-menu',more).appendChild(open);box.appendChild(more)}}});
}
function ensureOnlineProductEntry(){
 const search=$('#productSearch');if(!search)return;
 const bar=search.closest('.filterbar')||search.parentElement;if(!bar||$('[data-r6-online-product-entry]',bar))return;
 const btn=document.createElement('button');btn.type='button';btn.className='btn';btn.dataset.r6OnlineProductEntry='1';btn.textContent='用于 Online 开发客户';btn.title='选择本机商品，并显式交给 HUIDI Online Product Brain 使用';
 btn.addEventListener('click',()=>{location.href='./product-online-handoff.html'});
 bar.appendChild(btn);
}
function loadNotificationCenter(){if(window.HUIDINotifications||document.querySelector('script[data-huidi-notification-center]'))return;const s=document.createElement('script');s.src='./huidi-notification-center-v1.js?v=HUIDI-ONLINE-V0.1.4';s.defer=true;s.dataset.huidiNotificationCenter='1';document.head.appendChild(s)}
function loadWorkspaceClosure(){if(window.HUIDIWorkspaceClosure||document.querySelector('script[data-huidi-workspace-closure]'))return;const s=document.createElement('script');s.src='./huidi-workspace-closure-v1.js?v=HUIDI-CLOSURE-V1';s.defer=true;s.dataset.huidiWorkspaceClosure='1';document.head.appendChild(s)}
function loadStage2Closure(){if(window.HUIDIWorkspaceStage2Closure||document.querySelector('script[data-huidi-stage2-closure]'))return;const s=document.createElement('script');s.src='./huidi-workspace-stage2-closure-v1.js?v=HUIDI-STAGE2-V1';s.defer=true;s.dataset.huidiStage2Closure='1';document.head.appendChild(s)}
function cleanFeishuCount(){const b=$('.nav-btn[data-view="feishu"]');if(!b)return;const c=$('.workspace-nav-count',b);if(c&&(!clean(c.textContent)||clean(c.textContent)==='undefined')){c.textContent='';c.hidden=true}}
function tuneTitles(){const v=document.body.dataset.huidiView||'';const map={deals:['询盘 / 订单','像表格一样管理客户需求、报价进度和下一步动作。'],customers:['客户','常用资料优先，税务和收货信息需要时再展开。'],products:['商品','图片、SKU、规格、价格、MOQ 集中管理；需要开发客户时，可把选定商品显式交给 Online Product Brain。'],documents:['单据','按业务进度查看和继续报价、PI、合同、CI 与装箱。'],catalog:['产品目录','直接从商品库勾选、排序并制作客户目录。']};const x=map[v];if(x){$('#pageTitle').textContent=x[0];$('#pageDesc').textContent=x[1]}}
function refresh(){cleanFeishuCount();collapseActions();ensureOnlineProductEntry();tuneTitles()}
function enhanceDialog(){const dlg=$('#appDialog');if(!dlg?.open)return;const title=clean($('.modal-head h3',dlg)?.textContent);if(/客户/.test(title))compactCustomer(dlg);else if(/商品/.test(title))compactProduct(dlg);else if(/询盘|业务/.test(title))compactDeal(dlg)}
function boot(){document.body.classList.add('workspace-r6');document.body.dataset.workspaceRelease=VERSION;loadNotificationCenter();loadWorkspaceClosure();loadStage2Closure();refresh();document.addEventListener('click',e=>{if(e.target.closest('[data-action],.nav-btn'))setTimeout(()=>{enhanceDialog();refresh()},20);const sm=e.target.closest('.workspace-r6-row-more summary');if(sm){$$('.workspace-r6-row-more[open]').forEach(x=>{if(x!==sm.parentElement)x.open=false})}});document.addEventListener('close',e=>{if(e.target?.id==='appDialog')refresh()},true);window.addEventListener('HUIDI:local-data-change',()=>setTimeout(refresh,40));setTimeout(refresh,120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();