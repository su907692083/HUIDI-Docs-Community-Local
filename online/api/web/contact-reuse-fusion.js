(()=>{'use strict';
if(window.HUIDIContactReuseFusion)return;

const $=s=>document.querySelector(s);
const clean=v=>String(v??'').trim();
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state={
  lead:{requestSeq:0,lastQuery:''},
  customer:{requestSeq:0,lastQuery:''},
};

const contexts={
  lead:{
    key:'lead',
    rootId:'huidiContactReuseLead',
    name:'#dContact',
    role:'#dRole',
    email:'#dEmail',
    phone:'',
    anchor:el=>el?.closest('.drawer-grid'),
    company:()=>clean($('#dCompany')?.textContent),
    summary:'复用已确认联系人',
    note:'只带入到当前潜在客户；仍需点击“保存资料”确认，不会自动发邮件。',
    savedLabel:'保存资料',
  },
  customer:{
    key:'customer',
    rootId:'huidiContactReuseCustomer',
    name:'#hbCustomerContact',
    role:'',
    email:'#hbCustomerEmail',
    phone:'#hbCustomerPhone',
    anchor:el=>el?.closest('.hb-grid'),
    company:()=>clean($('#hbCustomerCompany')?.value),
    summary:'复用已确认联系人',
    note:'只带入到当前正式客户；仍需点击“保存客户资料”确认，不会自动发邮件。',
    savedLabel:'保存客户资料',
  },
};

async function api(url){
  const r=await fetch(url,{headers:{Accept:'application/json'}});
  let payload=null;
  try{payload=await r.json()}catch(_){payload={detail:await r.text().catch(()=>r.statusText)}}
  if(!r.ok)throw new Error(payload?.detail||r.statusText);
  return payload;
}

function css(){
  if($('#huidiContactReuseCss'))return;
  const s=document.createElement('style');
  s.id='huidiContactReuseCss';
  s.textContent=`
.huidi-contact-reuse{margin-top:8px;border:1px solid #e2e8ef;border-radius:9px;background:#fbfcfe}
.huidi-contact-reuse>summary{list-style:none;display:flex;align-items:center;gap:7px;padding:7px 9px;font-size:9px;font-weight:850;color:#42617f;cursor:pointer}
.huidi-contact-reuse>summary::-webkit-details-marker{display:none}
.huidi-contact-reuse>summary:after{content:'⌄';margin-left:auto;font-size:11px}
.huidi-contact-reuse[open]>summary:after{transform:rotate(180deg)}
.huidi-contact-body{padding:0 8px 8px}
.huidi-contact-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
.huidi-contact-search input{height:31px;border:1px solid #d8e2ed;border-radius:8px;background:#fff;padding:0 8px;font-size:9px}
.huidi-contact-search button{height:31px;border:1px solid #d8e2ed;border-radius:8px;background:#fff;padding:0 9px;font-size:9px;font-weight:850;color:#3c5875;cursor:pointer}
.huidi-contact-results{display:grid;gap:5px;margin-top:6px;max-height:156px;overflow:auto;scrollbar-width:thin}
.huidi-contact-option{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid #e4e9ef;border-radius:8px;background:#fff;padding:7px 8px}
.huidi-contact-option b{display:block;font-size:9px;color:#334e68;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.huidi-contact-option span{display:block;margin-top:2px;font-size:8px;color:#75869a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.huidi-contact-option button{border:1px solid #bdd0ea;background:#edf4ff;color:#175cae;border-radius:7px;padding:5px 7px;font-size:8px;font-weight:850;cursor:pointer}
.huidi-contact-source{display:inline-flex!important;width:auto!important;margin-left:5px!important;padding:1px 4px;border-radius:999px;background:#eef3f8;color:#61758b!important;font-size:7px!important;vertical-align:1px}
.huidi-contact-empty{padding:7px 2px;font-size:8px;color:#8b98a8}
.huidi-contact-note{margin-top:6px;font-size:8px;color:#8a98a8}
.huidi-contact-used{color:#31704a!important}
`;
  document.head.appendChild(s);
}

function rootFor(key){return document.getElementById(contexts[key]?.rootId||'')}
function queryNode(key){return rootFor(key)?.querySelector('[data-huidi-contact-query]')||null}
function resultNode(key){return rootFor(key)?.querySelector('[data-huidi-contact-results]')||null}
function noteNode(key){return rootFor(key)?.querySelector('[data-huidi-contact-note]')||null}

function mountContext(key){
  const def=contexts[key];
  if(!def||rootFor(key))return rootFor(key);
  const contact=$(def.name);
  const anchor=def.anchor(contact);
  if(!contact||!anchor)return null;
  css();
  const details=document.createElement('details');
  details.id=def.rootId;
  details.className='huidi-contact-reuse';
  details.dataset.huidiContactContext=key;
  details.innerHTML=`<summary>${esc(def.summary)} <span style="font-weight:600;color:#8b98a8">不用重复填写联系人资料</span></summary><div class="huidi-contact-body"><div class="huidi-contact-search"><input data-huidi-contact-query placeholder="搜索公司、姓名、职位或邮箱"><button type="button" data-huidi-contact-search>搜索</button></div><div data-huidi-contact-results class="huidi-contact-results"><div class="huidi-contact-empty">打开后可搜索已经确认过的联系人。</div></div><div data-huidi-contact-note class="huidi-contact-note">${esc(def.note)}</div></div>`;
  anchor.insertAdjacentElement('afterend',details);
  details.addEventListener('toggle',()=>{if(details.open)loadDefault(key)});
  details.querySelector('[data-huidi-contact-search]').addEventListener('click',()=>search(key,queryNode(key)?.value||''));
  details.querySelector('[data-huidi-contact-query]').addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.isComposing){e.preventDefault();search(key,e.currentTarget.value)}
  });
  return details;
}

function mount(){
  return {lead:mountContext('lead'),customer:mountContext('customer')};
}

function defaultQuery(key){return clean(contexts[key]?.company?.())}

async function loadDefault(key){
  const input=queryNode(key);
  if(!input)return;
  const q=defaultQuery(key);
  if(!clean(input.value))input.value=q;
  if(q!==state[key].lastQuery||!resultNode(key)?.querySelector('[data-huidi-contact-use]')){
    await search(key,input.value);
  }
}

async function search(key,value){
  const box=resultNode(key);
  if(!box||!state[key])return;
  const q=clean(value);
  const seq=++state[key].requestSeq;
  state[key].lastQuery=q;
  box.innerHTML='<div class="huidi-contact-empty">正在读取已确认联系人…</div>';
  try{
    const out=await api(`/api/contacts?page=1&page_size=50&include_formal=true&q=${encodeURIComponent(q)}`);
    if(seq!==state[key].requestSeq)return;
    render(key,Array.isArray(out?.items)?out.items:[],box,q);
  }catch(e){
    if(seq!==state[key].requestSeq)return;
    const message=window.HUIDIPlainLanguage?.message?.(e?.message||e)||e?.message||e;
    box.innerHTML=`<div class="huidi-contact-empty">${esc(message)}</div>`;
  }
}

function render(key,rows,box,q){
  if(!rows.length){
    box.innerHTML=`<div class="huidi-contact-empty">${q?'没有找到匹配联系人。可换姓名、公司或邮箱搜索。':'还没有已确认联系人。'}</div>`;
    return;
  }
  box.innerHTML=rows.slice(0,20).map(row=>{
    const payload=encodeURIComponent(JSON.stringify({
      contact_name:clean(row.contact_name),
      contact_role:clean(row.contact_role),
      contact_email:clean(row.contact_email),
      phone:clean(row.phone),
      company_name:clean(row.company_name),
      source_kind:clean(row.source_kind||'lead'),
    }));
    const line=[row.contact_name,row.contact_role,row.contact_email,row.phone].filter(Boolean).join(' · ');
    const source=row.source_kind==='customer'?'正式客户':'潜在客户';
    return `<div class="huidi-contact-option"><div><b>${esc(row.company_name||'已确认联系人')}<span class="huidi-contact-source">${esc(source)}</span></b><span>${esc(line||'联系人资料待补')}</span></div><button type="button" data-huidi-contact-context="${esc(key)}" data-huidi-contact-use="${payload}">带入</button></div>`;
  }).join('');
}

function setField(selector,value){
  if(!selector)return;
  const el=$(selector);
  if(!el)return;
  el.value=clean(value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

function apply(key,row,button){
  const def=contexts[key];
  if(!def||!row)return;
  setField(def.name,row.contact_name);
  setField(def.role,row.contact_role);
  setField(def.email,row.contact_email);
  setField(def.phone,row.phone);
  const note=noteNode(key);
  if(note){
    note.classList.add('huidi-contact-used');
    note.textContent=`已带入${row.company_name?' '+row.company_name+' 的':''}联系人资料。请核对后点击“${def.savedLabel}”确认。`;
  }
  if(button){
    const old=button.textContent;
    button.textContent='已带入';
    button.disabled=true;
    setTimeout(()=>{button.textContent=old;button.disabled=false},900);
  }
}

function scheduleMount(key='all'){
  for(const delay of [0,80,250,700,1200])setTimeout(()=>{
    if(key==='all'||key==='lead')mountContext('lead');
    if(key==='all'||key==='customer')mountContext('customer');
    for(const k of key==='all'?['lead','customer']:[key]){
      const details=rootFor(k);
      if(details?.open)loadDefault(k);
    }
  },delay);
}

function bind(){
  document.addEventListener('click',e=>{
    const use=e.target.closest('[data-huidi-contact-use]');
    if(use){
      let row=null;
      try{row=JSON.parse(decodeURIComponent(use.dataset.huidiContactUse||''))}catch(_){return}
      apply(use.dataset.huidiContactContext||'lead',row,use);
      return;
    }
    if(e.target.closest('[data-open],[data-contact-lead],[data-note-action]'))scheduleMount('lead');
    if(e.target.closest('[data-customer-id],[data-open-customer],[data-save-customer]'))scheduleMount('customer');
    if(e.target.closest('#findContact'))setTimeout(()=>{
      state.lead.lastQuery='';
      if(rootFor('lead')?.open)loadDefault('lead');
    },1100);
  },true);
  window.addEventListener('huidi-lead-opened',()=>scheduleMount('lead'));
  window.addEventListener('huidi-business-customer-opened',()=>scheduleMount('customer'));
}

function boot(){mount();bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIContactReuseFusion=Object.freeze({mount,mountContext,search,apply});
})();
