(()=>{'use strict';
if(window.HUIDIWorldCountryInteraction)return;
const GEOJSON_URL='https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson';
const $=s=>document.querySelector(s);
const clean=v=>String(v??'').trim();
let overview=null,geojson=null,loading=null,enhanceTimer=0,selected='';
const REGION_VIEWS={
  '全部':'0 8 1000 475',
  '北美':'8 48 360 235',
  '拉美':'190 225 270 260',
  '欧洲':'435 52 190 155',
  '中东':'525 130 185 145',
  '非洲':'420 155 245 275',
  '亚太':'590 55 395 365'
};
function css(){if($('#wiCountryCss'))return;const s=document.createElement('style');s.id='wiCountryCss';s.textContent=`
.wi-country-stage{position:relative;width:100%;height:100%;min-height:430px;overflow:hidden;background:linear-gradient(180deg,#edf5fb,#f7fafc)}
.wi-country-svg{display:block;width:100%;height:100%;min-height:430px;touch-action:manipulation;outline:none}
.wi-country-base{fill:#e4eaf0;stroke:#fff;stroke-width:.7;vector-effect:non-scaling-stroke;pointer-events:none}
.wi-country-market{fill:#c8d9ed;stroke:#fff;stroke-width:1;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill .12s ease,stroke .12s ease,opacity .12s ease;outline:none}
.wi-country-market:hover,.wi-country-market:focus-visible{fill:#76a9e8;stroke:#2e67a8;stroke-width:1.6}
.wi-country-market.selected{fill:#2f72c8;stroke:#174c8d;stroke-width:1.8}
.wi-country-market.dim{opacity:.22}
.wi-country-label{font:700 9px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#284967;pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:2.5px;stroke-linejoin:round}
.wi-country-bubble{position:absolute;z-index:4;pointer-events:none;min-width:155px;max-width:220px;padding:9px 10px;border:1px solid #d8e3ef;border-radius:10px;background:rgba(255,255,255,.97);box-shadow:0 9px 28px rgba(32,57,85,.17);color:#36506b;font-size:9px;line-height:1.5;transform:translate(12px,12px);display:none}
.wi-country-bubble.open{display:block}
.wi-country-bubble b{display:block;color:#223f60;font-size:11px;margin-bottom:3px}
.wi-country-bubble span{display:block;color:#73849a}
.wi-country-bubble em{display:block;font-style:normal;color:#245fa9;font-weight:800;margin-top:4px}
.wi-country-help{position:absolute;left:10px;bottom:9px;z-index:3;padding:6px 8px;border:1px solid rgba(207,220,234,.95);border-radius:8px;background:rgba(255,255,255,.9);color:#6d8095;font-size:8.5px;pointer-events:none}
@media(max-width:700px){.wi-country-bubble{max-width:180px}.wi-country-help{display:none}}
`;document.head.appendChild(s)}
async function api(url){const r=await fetch(url);if(!r.ok)throw new Error(await r.text()||r.statusText);return r.json()}
function project(coord){const lon=Number(coord?.[0]||0),lat=Number(coord?.[1]||0);return[(lon+180)/360*1000,(90-lat)/180*500]}
function ringPath(ring){let d='',prev=null,open=false;for(const coord of ring||[]){const [x,y]=project(coord);const jump=prev&&Math.abs(x-prev[0])>480;if(!open||jump){d+=`M${x.toFixed(2)},${y.toFixed(2)}`;open=true}else d+=`L${x.toFixed(2)},${y.toFixed(2)}`;prev=[x,y]}return d+(open?'Z':'')}
function geometryPath(g){if(!g)return'';if(g.type==='Polygon')return(g.coordinates||[]).map(ringPath).join('');if(g.type==='MultiPolygon')return(g.coordinates||[]).flatMap(p=>p.map(ringPath)).join('');return''}
function codeOf(feature){const p=feature?.properties||{};for(const key of ['ISO_A2_EH','ISO_A2','WB_A2']){const v=clean(p[key]).toUpperCase();if(v&&v!=='-99')return v}return''}
function normalizeName(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'')}
function nameOf(feature){const p=feature?.properties||{};return clean(p.ADMIN||p.NAME_EN||p.NAME||p.SOVEREIGNT)}
function marketMaps(){const byCode=new Map(),byName=new Map();for(const m of overview?.markets||[]){byCode.set(clean(m.id).toUpperCase(),m);for(const v of [m.query,m.name])byName.set(normalizeName(v),m)}return{byCode,byName}}
function marketFor(feature,maps){const code=codeOf(feature);if(code&&maps.byCode.has(code))return maps.byCode.get(code);const name=normalizeName(nameOf(feature));if(maps.byName.has(name))return maps.byName.get(name);const aliases={unitedstatesofamerica:'US',southkorea:'KR',republicofkorea:'KR',czechia:'CZ',turkiye:'TR',unitedkingdom:'GB'};const id=aliases[name];return id?maps.byCode.get(id):null}
function counts(m){return{lead:Number(m?.lead_count||0),contact:Number(m?.contact_count||0),customer:Number(m?.customer_count||0),deal:Number(m?.deal_count||0)}}
function total(m){const c=counts(m);return c.lead+c.customer+c.deal}
function bubbleText(m){const c=counts(m);const business=total(m);return `<b>${m.name}</b><span>${m.region} · 潜在客户 ${c.lead} · 联系人 ${c.contact}</span><span>正式客户 ${c.customer} · 询盘 ${c.deal}</span><em>${business?'点击查看当地动态和现有业务':'暂无业务记录 · 点击查看当地动态'}</em>`}
function bubbleMove(e,bubble,stage){const r=stage.getBoundingClientRect(),w=bubble.offsetWidth||180,h=bubble.offsetHeight||76;let x=e.clientX-r.left,y=e.clientY-r.top;if(x+w+28>r.width)x-=w+24;if(y+h+28>r.height)y-=h+24;bubble.style.left=Math.max(4,x)+'px';bubble.style.top=Math.max(4,y)+'px'}
function activeRegion(){return clean(document.querySelector('[data-wi-region].active')?.dataset.wiRegion)||'全部'}
function applyRegion(svg){const region=activeRegion();svg.setAttribute('viewBox',REGION_VIEWS[region]||REGION_VIEWS['全部']);svg.querySelectorAll('[data-market-id]').forEach(el=>{const m=(overview?.markets||[]).find(x=>x.id===el.dataset.marketId);el.classList.toggle('dim',region!=='全部'&&m?.region!==region)})}
function select(id){selected=id;document.querySelectorAll('.wi-country-market').forEach(el=>el.classList.toggle('selected',el.dataset.marketId===id));window.HUIDIWorldIntelligenceMap?.selectMarket?.(id,true)}
function labelFor(m){const [x,y]=project([m.lng,m.lat]);const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',x.toFixed(2));t.setAttribute('y',y.toFixed(2));t.setAttribute('class','wi-country-label');t.textContent=total(m)?`${m.name} ${total(m)}`:m.name;return t}
async function loadData(){if(overview&&geojson)return;if(loading)return loading;loading=Promise.all([api('/api/intel/world'),fetch(GEOJSON_URL,{mode:'cors'}).then(r=>{if(!r.ok)throw new Error('country geometry unavailable');return r.json()})]).then(([o,g])=>{overview=o;geojson=g});try{await loading}finally{loading=null}}
async function enhance(){const box=$('#wiMap');if(!box||box.dataset.wiCountryReady==='1'||!window.HUIDIWorldIntelligenceMap)return;try{await loadData()}catch(_){return}if(!document.body.contains(box)||box.dataset.wiCountryReady==='1')return;css();const replacement=box.cloneNode(false);replacement.dataset.wiCountryReady='1';replacement.innerHTML='';box.replaceWith(replacement);const stage=document.createElement('div');stage.className='wi-country-stage';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','wi-country-svg');svg.setAttribute('viewBox',REGION_VIEWS['全部']);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('role','img');svg.setAttribute('aria-label','全球市场地图。鼠标滑过国家查看摘要，点击国家查看详情。');svg.setAttribute('tabindex','0');const bubble=document.createElement('div');bubble.className='wi-country-bubble';bubble.setAttribute('aria-hidden','true');const help=document.createElement('div');help.className='wi-country-help';help.textContent='鼠标滑过国家查看摘要 · 点击国家查看新闻、客户与询盘';stage.append(svg,bubble,help);replacement.append(stage);const maps=marketMaps();const frag=document.createDocumentFragment(),labels=[];for(const f of geojson?.features||[]){const d=geometryPath(f.geometry);if(!d)continue;const m=marketFor(f,maps);const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('fill-rule','evenodd');if(!m){p.setAttribute('class','wi-country-base');frag.appendChild(p);continue}p.setAttribute('class','wi-country-market'+(selected===m.id?' selected':''));p.dataset.marketId=m.id;p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',`${m.name}，点击查看市场详情`);p.addEventListener('pointerenter',e=>{bubble.innerHTML=bubbleText(m);bubble.classList.add('open');bubbleMove(e,bubble,stage)});p.addEventListener('pointermove',e=>bubbleMove(e,bubble,stage));p.addEventListener('pointerleave',()=>bubble.classList.remove('open'));p.addEventListener('focus',()=>{bubble.innerHTML=bubbleText(m);bubble.style.left='12px';bubble.style.top='12px';bubble.classList.add('open')});p.addEventListener('blur',()=>bubble.classList.remove('open'));p.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();bubble.classList.remove('open');select(m.id)});p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(m.id)}});frag.appendChild(p);labels.push(m)}svg.appendChild(frag);for(const m of labels)svg.appendChild(labelFor(m));applyRegion(svg)}
function schedule(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,180)}
function bind(){document.addEventListener('click',e=>{if(e.target.closest('[data-wi-open]'))schedule();if(e.target.closest('[data-wi-region]'))setTimeout(()=>{const svg=$('.wi-country-svg');if(svg)applyRegion(svg)},30)},true);const mo=new MutationObserver(()=>{if($('#wiMap')?.dataset.wiCountryReady!=='1')schedule()});mo.observe(document.body,{childList:true,subtree:true});schedule()}
function boot(){css();bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIWorldCountryInteraction=Object.freeze({enhance,select});
})();