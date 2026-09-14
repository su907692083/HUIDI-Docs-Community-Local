/* Input assistance only. Existing fields and save owners remain authoritative. */
(() => {
'use strict';
if (!window.HUIDI_COMMUNITY_ONLINE?.enabled || window.HUIDIQuickChoices) return;
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const popular='US GB DE FR AU CA AE SA JP KR VN IN SG MY TH ID BR MX NL IT ES CN'.split(' ');
const aliases={US:'USA 美国 美利坚',GB:'UK 英国 大不列颠',AE:'UAE 阿联酋',SA:'沙特',CN:'中国 大陆 中国大陆 PRC',HK:'香港 中国香港',MO:'澳门 中国澳门',TW:'台湾 中国台湾',KR:'韩国 South Korea',TR:'Turkey 土耳其',VN:'Viet Nam 越南',ID:'印尼',AU:'澳洲 澳大利亚',NZ:'纽西兰 新西兰',CZ:'捷克 Czech Republic',RU:'俄国 俄罗斯',DE:'Deutschland 德国'};
const norm=v=>String(v??'').trim().normalize('NFKC').toLowerCase();
const names={};for (const locale of ['zh-CN','en']) { try { names[locale]=new Intl.DisplayNames([locale],{type:'region'}); } catch (_) {} }
const countries=codes.map(code=>{const en=names.en?.of(code)||code,zh=names['zh-CN']?.of(code)||en;return {value:en,code,label:`${zh} / ${en}`,hint:code,search:norm(`${zh} ${en} ${code} ${aliases[code]||''}`)};});
countries.sort((a,b)=>{const pa=popular.indexOf(a.code),pb=popular.indexOf(b.code);return (pa<0?999:pa)-(pb<0?999:pb)||a.label.localeCompare(b.label,'zh-CN');});
const make=(value,label)=>({value,label:label||value,search:norm(`${value} ${label||''}`)});
const currencies=[['USD','美元'],['EUR','欧元'],['GBP','英镑'],['CNY','人民币'],['JPY','日元'],['HKD','港币'],['AUD','澳元'],['CAD','加元'],['SGD','新加坡元'],['AED','阿联酋迪拉姆'],['CHF','瑞士法郎'],['NZD','新西兰元'],['KRW','韩元'],['THB','泰铢'],['INR','印度卢比'],['MYR','马来西亚林吉特']].map(([v,l])=>make(v,`${v} · ${l}`));
const units=[['PCS','件'],['SET','套'],['PAIR','双 / 对'],['CTN','箱'],['BOX','盒'],['KG','千克'],['MT','吨'],['M','米'],['ROLL','卷'],['DOZ','打']].map(([v,l])=>make(v,`${v} · ${l}`));
const countryIds=new Set(['hfCountry','fv2Country','ciCountry','hsCompanyCountry','hsIntelCountry','hsTradeCountry','hsTariffDest','hufCountry','csCountry','hsbCountry','hbCustomerCountry','hbAddressCountry','country']);
const currencyIds=new Set(['fv2BankCurrency','csBankCurrency','hbCurrency']);
function kindOf(input) {
 if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly || !['text','search'].includes(input.type)) return '';
 if (input.dataset.huidiChoice) return input.dataset.huidiChoice;
 const key=input.dataset.f||input.name||input.dataset.pbf||'';
 if (countryIds.has(input.id)||['country','country_of_origin'].includes(key)) return 'country';
 if (key==='country_code') return 'country-code';
 if (currencyIds.has(input.id)||key==='currency') return 'currency';
 if (['unit','pricing_unit'].includes(key)) return 'unit';
 if (input.id==='hfKeyword'||input.id==='hsMapKeyword') return 'product';
 return '';
}
function optionsFor(kind) {
 if (kind==='country') return countries;
 if (kind==='country-code') return countries.map(x=>({...x,value:x.code}));
 if (kind==='currency') return currencies;
 if (kind==='unit') return units;
 if (kind==='product') {
  const rows=window.HUIDILocalCore?.repositories?.products?.list?.()||[];
  return rows.filter(x=>x.name).map(x=>({...make(x.name,x.name),hint:x.sku||'',search:norm(`${x.name} ${x.sku||''} ${x.category||''}`)}));
 }
 return [];
}
const recent=new Map();
function filtered(kind,query) {
 const q=norm(query),found=optionsFor(kind).filter(x=>!q||x.search.includes(q));
 const recentValues=recent.get(kind)||[];
 return found.sort((a,b)=>{const exact=(norm(a.value)===q||norm(a.code)===q)?-1:0,other=(norm(b.value)===q||norm(b.code)===q)?-1:0;return exact-other||(recentValues.includes(a.value)?-1:0)-(recentValues.includes(b.value)?-1:0);});
}
let active=null,menu=null,items=[],index=-1,changing=false;
function style() {
 if (document.getElementById('huidi-quick-choice-style')) return;
 const el=document.createElement('style');el.id='huidi-quick-choice-style';el.textContent=`
 .hqc-input{background-image:linear-gradient(45deg,transparent 50%,#64748b 50%),linear-gradient(135deg,#64748b 50%,transparent 50%)!important;background-position:calc(100% - 16px) 50%,calc(100% - 12px) 50%!important;background-size:4px 4px!important;background-repeat:no-repeat!important;padding-right:30px!important;min-width:0}
 .hqc-menu{position:fixed;inset:auto;margin:0;padding:5px;box-sizing:border-box;z-index:2147482000;max-height:310px;overflow:auto;overscroll-behavior:contain;background:var(--panel,#fff);color:var(--text,#243750);border:1px solid var(--line,#ccd8e5);border-radius:9px;box-shadow:0 10px 30px #142c4f26;font:13px/1.5 system-ui,'Microsoft YaHei',sans-serif}
 .hqc-menu[hidden]{display:none!important}.hqc-menu [role=option]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;min-height:35px;box-sizing:border-box;border-radius:5px;cursor:pointer;white-space:normal}
 .hqc-menu [role=option][aria-selected=true],.hqc-menu [role=option]:hover{background:#eaf2ff;color:#155bba}.hqc-menu [role=option] small{font-size:11px;color:#627389;flex-shrink:0}.hqc-help{padding:7px 10px;color:var(--muted,#68788b);font-size:12px;border-top:1px solid var(--line,#e7ecf2)}
 `;document.head.append(el);
}
function close() {
 if(active){active.setAttribute('aria-expanded','false');active.removeAttribute('aria-activedescendant');}
 if(menu){if(menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;}
 active=null;items=[];index=-1;
}
function position() {
 if(!active?.isConnected||!active.getClientRects().length){close();return;}
 const r=active.getBoundingClientRect(),width=Math.min(Math.max(r.width,290),innerWidth-20);
 menu.style.width=`${width}px`;menu.style.left=`${Math.max(10,Math.min(r.left,innerWidth-width-10))}px`;
 const h=Math.min(menu.scrollHeight,310),below=innerHeight-r.bottom-10,above=r.top-10;
 const up=below<h&&above>below;menu.style.maxHeight=`${Math.max(70,Math.min(310,up?above:below))}px`;
 menu.style.top=`${up?Math.max(10,r.top-Math.min(h,above)-4):r.bottom+4}px`;
}
function setIndex(next) {
 index=next;[...menu.querySelectorAll('[role=option]')].forEach((el,i)=>el.setAttribute('aria-selected',String(i===index)));
 const selected=menu.querySelector(`[data-hqc-index="${index}"]`);
 if(selected){active.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});}else active?.removeAttribute('aria-activedescendant');
}
function choose(i) {
 const row=items[i],input=active;if(!row||!input)return;
 const kind=kindOf(input);recent.set(kind,[row.value,...(recent.get(kind)||[]).filter(x=>x!==row.value)].slice(0,6));
 input.value=row.value;input.title=row.label;close();changing=true;
 input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));changing=false;
 input.focus({preventScroll:true});input.setSelectionRange?.(input.value.length,input.value.length);
}
function open(input,all=false) {
 const kind=kindOf(input);if(!kind)return;
 style();if(active&&active!==input)close();active=input;
 if(!menu){menu=document.createElement('div');menu.id='huidi-choice-list';menu.className='hqc-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label','快捷选择');if(typeof menu.showPopover==='function')menu.setAttribute('popover','manual');menu.addEventListener('pointerdown',e=>{const item=e.target.closest('[data-hqc-index]');if(item){e.preventDefault();choose(Number(item.dataset.hqcIndex));}});}
 const parent=input.closest('dialog[open]')||document.body;
 if(menu.parentElement!==parent){if(menu.matches(':popover-open'))menu.hidePopover();parent.append(menu);}
 input.classList.add('hqc-input');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',menu.id);input.setAttribute('aria-expanded','true');input.autocomplete='off';
 if(!input.getAttribute('aria-label')&&!input.labels?.length){const label=input.closest('.field,.fv2-field,.hs-field')?.querySelector('label')?.textContent;input.setAttribute('aria-label',label||input.placeholder||'快捷选择');}
 const found=filtered(kind,all?'':input.value);items=found.slice(0,30);index=-1;menu.replaceChildren();
 items.forEach((row,i)=>{const el=document.createElement('div');el.id=`huidi-choice-option-${i}`;el.dataset.hqcIndex=String(i);el.setAttribute('role','option');el.setAttribute('aria-selected','false');const text=document.createElement('span');text.textContent=row.label;el.append(text);if(row.hint){const hint=document.createElement('small');hint.textContent=row.hint;el.append(hint);}menu.append(el);});
 const help=document.createElement('div');help.className='hqc-help';help.textContent=found.length?`${found.length} 个匹配 · ↑↓ 选择，回车确认；也可自由填写`:'没有匹配项，保留当前输入继续填写即可';menu.append(help);
 menu.hidden=false;if(menu.hasAttribute('popover')&&!menu.matches(':popover-open'))menu.showPopover();position();
}
// Delegation also covers late-mounted forms, without DOM polling or mutation observers.
document.addEventListener('focusin',e=>{if(kindOf(e.target))open(e.target);else if(active&&!menu?.contains(e.target))close();},true);
document.addEventListener('click',e=>{if(kindOf(e.target)&&!active)open(e.target,true);},true);
document.addEventListener('input',e=>{if(!changing&&!e.isComposing&&kindOf(e.target))open(e.target);},true);
document.addEventListener('compositionend',e=>{if(kindOf(e.target))open(e.target);},true);
document.addEventListener('pointerdown',e=>{if(active&&e.target!==active&&!menu?.contains(e.target))close();},true);
window.addEventListener('keydown',e=>{
 if(e.isComposing||e.keyCode===229)return;
 if(!active&&kindOf(e.target)&&['ArrowDown','ArrowUp'].includes(e.key))open(e.target,true);
 if(!active||e.target!==active)return;
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();if(items.length)setIndex(index<0?(e.key==='ArrowDown'?0:items.length-1):(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length);}
 else if(e.key==='Enter'&&index>=0){e.preventDefault();e.stopImmediatePropagation();choose(index);}
 else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
 else if(e.key==='Tab'){if(index>=0)choose(index);else close();}
},true);
window.addEventListener('resize',()=>{if(active)position();});
document.addEventListener('scroll',e=>{if(active&&!menu?.contains(e.target))position();},true);
window.addEventListener('HUIDI:community-online-view',close);
window.HUIDIQuickChoices=Object.freeze({version:'1.0.0',close,optionsFor,filtered});
})();
