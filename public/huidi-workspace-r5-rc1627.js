/* HUIDI Docs Community Local RC16.27 — Single Shell Boot + Runtime Composition Guard
   Final owner after R1/R2/R3/R4. No MutationObserver. */
(()=>{
'use strict';
const VERSION='1.2.0-RC16.27';
const VIEWS=['home','deals','customers','products','documents','catalog','brands','templates','mail','feishu','backup','recycle','help'];
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
function feishuMarkup(){return `<span class="icon-tile"><svg class="ui-icon"><use href="./assets/brand/huidi-local-icons.svg#i-catalog"></use></svg></span><span class="nav-copy"><b>飞书资料</b><small>读取表格直接复用</small></span><span class="status-dot online">联网</span>`}
function switchView(view){
 document.body.dataset.huidiView=view;
 document.body.classList.toggle('huidi-workspace-compact',!['home','deals'].includes(view));
 $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));
 $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const more=$('.workspace-r2-more');if(more)more.open=['catalog','brands','templates','mail','feishu','backup','recycle','help'].includes(view);
 window.scrollTo({top:0,behavior:'auto'});
}
function preferredNavWrap(side){return $('.workspace-nav-groups.workspace-r2-nav',side)||$$('.workspace-nav-groups',side).at(-1)||null}
function ensureFeishu(side,wrap){
 let buttons=$$('.nav-btn[data-view="feishu"]',side),b=buttons[0];
 if(!b){b=document.createElement('button');b.type='button';b.className='nav-btn workspace-r5-recovered';b.dataset.view='feishu';b.title='读取飞书表格直接复用';b.innerHTML=feishuMarkup()}
 buttons.slice(1).forEach(x=>x.remove());
 const more=$('.workspace-r2-more-body',wrap||side);if(!more)return b;
 const groups=$$('.workspace-nav-group',more);const host=groups.find(g=>clean($('.workspace-nav-group-title',g)?.textContent)==='经营资料')||groups[1]||groups[0];const nav=$('.nav',host);
 if(nav&&!nav.contains(b))nav.appendChild(b);
 b.hidden=false;b.removeAttribute('aria-hidden');b.style.removeProperty('display');if(!b.dataset.r5Bound){b.dataset.r5Bound='1';b.addEventListener('click',e=>{e.preventDefault();switchView('feishu')})}
 return b;
}
function pruneLegacyShell(){
 const side=$('.sidebar');if(!side)return;
 const wrap=preferredNavWrap(side);
 $$('.workspace-nav-groups',side).forEach(x=>{if(x!==wrap)x.remove()});
 $$('.sidebar>.nav-section-title,.sidebar>nav.nav',document).forEach(x=>x.remove());
 $('.workspace-r2-quick',side)?.remove();
 $('.version',side)?.remove();
 if(wrap)ensureFeishu(side,wrap);
}
function dedupeNavigation(){
 const side=$('.sidebar');if(!side)return;
 const wrap=preferredNavWrap(side)||side;
 for(const view of VIEWS){
  const all=$$(`.nav-btn[data-view="${view}"]`,side);if(all.length<=1)continue;
  const keep=all.find(x=>wrap.contains(x))||all[0];all.forEach(x=>{if(x!==keep)x.remove()});
 }
}
function markFeishuDialog(){
 const dlg=$('#appDialog');if(!dlg?.open)return;const modal=$('.modal',dlg);if(!modal)return;
 if($('.feishu-security-note',modal)||clean($('.modal-head h3',modal)?.textContent).includes('飞书连接'))modal.classList.add('workspace-r5-feishu-config');
}
function audit(){
 const side=$('.sidebar');const wrap=side&&preferredNavWrap(side);const missing=VIEWS.filter(v=>{const b=$(`.nav-btn[data-view="${v}"]`,wrap||side||document);return !$(`#view-${v}`)||!b||b.hidden||b.getAttribute('aria-hidden')==='true'});
 const duplicates=VIEWS.filter(v=>$$( `.nav-btn[data-view="${v}"]`,side||document).length!==1);
 const legacy=side?$$(':scope>.nav-section-title,:scope>nav.nav,:scope>.workspace-nav-groups:not(.workspace-r2-nav)',side).length:1;
 const ok=!missing.length&&!duplicates.length&&!legacy;
 document.body.dataset.workspaceR5Audit=ok?'pass':'fail';
 document.body.dataset.workspaceR5Missing=missing.join(',');
 document.body.dataset.workspaceR5Duplicates=duplicates.join(',');
 document.body.dataset.workspaceR5Legacy=String(legacy);
 return ok;
}
function finalizeComposition(){pruneLegacyShell();dedupeNavigation();markFeishuDialog();audit()}
function reveal(){
 finalizeComposition();
 document.documentElement.classList.remove('workspace-preboot');
 document.body.classList.remove('workspace-booting');
 document.body.classList.add('workspace-ready');
 document.body.dataset.workspaceRelease=VERSION;
}
function boot(){
 document.body.classList.add('workspace-r5');
 finalizeComposition();
 // All earlier DOMContentLoaded owners are registered before this file. Two frames guarantee their final style/layout is painted only after R5's guard.
 requestAnimationFrame(()=>requestAnimationFrame(reveal));
 document.addEventListener('click',e=>{
  const nav=e.target.closest('.nav-btn');if(nav)setTimeout(finalizeComposition,0);
  const f=e.target.closest('[data-feishu-action="config"]');if(f)setTimeout(markFeishuDialog,0);
  const a=e.target.closest('[data-action]')?.dataset.action||'';if(a)setTimeout(()=>{markFeishuDialog();audit()},20);
 });
 document.addEventListener('close',e=>{if(e.target?.id==='appDialog')document.body.classList.remove('workspace-dialog-open')},true);
 window.addEventListener('HUIDI:local-data-change',()=>setTimeout(audit,30));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
