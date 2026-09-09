(()=>{
'use strict';
const online=window.HUIDI_COMMUNITY_ONLINE;
if(!online?.enabled||window.HUIDICommunityOnlineIntelligenceV2)return;
const $=(s,r=document)=>r.querySelector(s);
const loaders=new Map();
const defs={
  plain:['plain-language.js','HUIDIPlainLanguage'],
  intelligence:['customer-intelligence.js','HUIDICustomerIntelligence'],
  worldMap:['world-intelligence-map.js','HUIDIWorldIntelligenceMap'],
  worldCountry:['world-country-interaction.js','HUIDIWorldCountryInteraction']
};
function load(key){if(loaders.has(key))return loaders.get(key);const [file,global]=defs[key];if(window[global])return Promise.resolve(window[global]);const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`/assets/${file}`;s.dataset.fv2IntelModule=file;s.onload=()=>window[global]?resolve(window[global]):reject(new Error(`${file} 未初始化`));s.onerror=()=>reject(new Error(`${file} 加载失败`));document.head.appendChild(s)});loaders.set(key,p);return p}
function empty(text){return `<div class="fv2-empty">${String(text||'')}</div>`}
function makeTab(key,label){const b=document.createElement('button');b.className='fv2-tab';b.dataset.fv2Tab=key;b.dataset.fv2View='online-intel';b.textContent=label;return b}
function makePane(key){const p=document.createElement('section');p.className='fv2-pane';p.dataset.fv2Pane=key;p.dataset.fv2View='online-intel';p.innerHTML=empty('首次打开时读取真实市场数据。');return p}
function activateVisual(key){const view=$('#view-online-intel');if(!view)return null;view.querySelectorAll(':scope > .fv2-tabs .fv2-tab').forEach(b=>b.classList.toggle('active',b.dataset.fv2Tab===key));view.querySelectorAll(':scope > .fv2-panes > .fv2-pane').forEach(p=>p.classList.toggle('active',p.dataset.fv2Pane===key));return view.querySelector(`:scope > .fv2-panes > [data-fv2-pane="${key}"]`)}
async function mountCustomerIntel(pane){window.HUIDICustomerIntelligence?.unmount?.();pane.innerHTML='';pane.classList.add('fv2-mounted');await load('plain').catch(()=>null);const intel=await load('intelligence');await intel.mount(pane)}
function installMapRouting(pane){if(pane.dataset.fv2MapRouting==='1')return;pane.dataset.fv2MapRouting='1';pane.addEventListener('click',e=>{const find=e.target.closest('[data-wi-find]'),lead=e.target.closest('[data-wi-lead]');if(!find&&!lead)return;e.preventDefault();e.stopImmediatePropagation();const nav=$('.nav-btn[data-view="online-find"]');nav?.click();if(find){setTimeout(()=>{const base=$('#view-online-find [data-fv2-tab="base"]');base?.click();const country=$('#hfCountry');if(country)country.value=find.dataset.wiFind||'';$('#hfKeyword')?.focus()},30);return}if(lead){setTimeout(()=>{const pool=$('#view-online-find [data-fv2-tab="pool"]');pool?.click();setTimeout(()=>{const row=$(`[data-fv2-lead="${CSS.escape(String(lead.dataset.wiLead||''))}"]`);row?.scrollIntoView({block:'center',behavior:'smooth'})},350)},30)}},true)}
async function mountWorldMap(pane){window.HUIDICustomerIntelligence?.unmount?.();pane.innerHTML='';pane.classList.add('fv2-mounted');installMapRouting(pane);await load('plain').catch(()=>null);const intel=await load('intelligence');await intel.mount(pane,{autoload:false});const country=await load('worldCountry');const map=await load('worldMap');await map.open();setTimeout(()=>country.enhance?.(),80)}
async function open(key){return window.HUIDICommunityOnlineFullV2.openTab('online-intel',key)}
function install(){const view=$('#view-online-intel'),bar=view?.querySelector(':scope > .fv2-tabs'),panes=view?.querySelector(':scope > .fv2-panes');if(!bar||!panes||bar.dataset.fv2IntelProjects==='1')return false;bar.dataset.fv2IntelProjects='1';const live=bar.querySelector('[data-fv2-tab="live"]');const world=makeTab('world-map','互动地图'),customer=makeTab('customer-intel','客户情报');if(live){live.insertAdjacentElement('afterend',customer);live.insertAdjacentElement('afterend',world)}else bar.append(world,customer);panes.append(makePane('world-map'),makePane('customer-intel'));window.HUIDICommunityOnlineFullV2.registerPane('online-intel','world-map',mountWorldMap);window.HUIDICommunityOnlineFullV2.registerPane('online-intel','customer-intel',mountCustomerIntel);return true}
function boot(){if(!install())setTimeout(install,120);setTimeout(install,360)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDICommunityOnlineIntelligenceV2=Object.freeze({version:'2.0.1',install,open,mountWorldMap,mountCustomerIntel});
})();
