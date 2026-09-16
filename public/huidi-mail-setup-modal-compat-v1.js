/* HUIDI Mail Setup Modal Compatibility V1
   Keeps the retired mailbox-manager modal id reserved while the beginner-first
   mailbox setup owns the interaction, preventing legacy and new managers from
   opening as overlapping surfaces. */
(()=>{
'use strict';
if(window.HUIDIMailSetupModalCompatibility)return;
let scheduled=false;
function clear(){document.querySelector('#mgModalBack[data-hms-compat="1"]')?.remove()}
function sync(){
 scheduled=false;
 const active=document.querySelector('#hmsBack.open');
 if(!active){clear();return}
 const existing=document.getElementById('mgModalBack');
 if(existing&&!existing.dataset.hmsCompat)return;
 const node=existing||document.createElement('div');
 if(!existing){
  node.id='mgModalBack';node.dataset.hmsCompat='1';node.setAttribute('aria-hidden','true');
  node.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1';
  document.body.appendChild(node)
 }
 node.classList.add('open');
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(sync,0);setTimeout(sync,60);setTimeout(sync,180)}
window.addEventListener('click',e=>{if(e.target?.closest?.('[data-other-mail],[data-huf-other-mail],#mgManage'))schedule();if(e.target?.closest?.('.hms-close'))setTimeout(clear,0)},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('#hmsBack.open'))setTimeout(clear,0)},true);
window.HUIDIMailSetupModalCompatibility=Object.freeze({version:'1.1.0',sync,clear});
})();

/* HUIDI Mail Onboarding Assist V1
   Adds domestic-provider guidance, safe official links and email-domain hints
   over the existing mailbox owners. It never stores credentials or creates a
   second mailbox, message, queue, send or sync owner. */
(()=>{
'use strict';
if(window.HUIDIMailOnboardingAssist)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PROVIDERS={
 gmail:{label:'Gmail',home:'https://mail.google.com/',signup:'https://accounts.google.com/signup',help:'https://support.google.com/mail/'},
 outlook:{label:'Outlook',home:'https://outlook.live.com/',signup:'https://signup.live.com/',help:'https://support.microsoft.com/outlook'},
 qq:{label:'QQ 邮箱',home:'https://mail.qq.com/',help:'https://service.mail.qq.com/'},
 exmail:{label:'腾讯企业邮箱',home:'https://exmail.qq.com/',help:'https://service.exmail.qq.com/'},
 n163:{label:'网易 163 邮箱',home:'https://mail.163.com/',help:'https://help.mail.163.com/'},
 n126:{label:'网易 126 邮箱',home:'https://mail.126.com/',help:'https://help.mail.163.com/'},
 aliyun:{label:'阿里企业邮箱',home:'https://qiye.aliyun.com/',help:'https://help.aliyun.com/zh/alibaba-mail/'},
 aliyun_foreign:{label:'阿里外贸邮',home:'https://qiye.aliyun.com/',help:'https://help.aliyun.com/zh/alibaba-mail/'},
 zoho:{label:'Zoho 个人邮箱',home:'https://www.zoho.com.cn/mail/',help:'https://www.zoho.com.cn/mail/help/zoho-smtp.html'},
 zoho_org:{label:'Zoho 企业邮箱',home:'https://www.zoho.com.cn/mail/',help:'https://www.zoho.com.cn/mail/help/zoho-smtp.html'}
};
const DOMAINS={
 'gmail.com':'gmail','googlemail.com':'gmail',
 'outlook.com':'outlook','hotmail.com':'outlook','live.com':'outlook','msn.com':'outlook',
 'qq.com':'qq','vip.qq.com':'qq','foxmail.com':'qq',
 '163.com':'n163','126.com':'n126','yeah.net':'n163',
 'zoho.com':'zoho','zohomail.com':'zoho'
};
let scheduled=false,inputTimer=0;
function css(){
 if($('#hmoCss'))return;
 const style=document.createElement('style');style.id='hmoCss';style.textContent=`
.hmo-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.hmo-links a{font-size:8.5px;font-weight:800;color:#2869be;text-decoration:none}.hmo-links a:hover{text-decoration:underline}.hmo-capability{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:9px 0}.hmo-capability>div{border:1px solid #e0e7ef;border-radius:9px;background:#fff;padding:8px 9px}.hmo-capability b{display:block;font-size:9px;color:#354d69}.hmo-capability span{display:block;margin-top:3px;font-size:8px;line-height:1.5;color:#728196}.hmo-provider-help{margin-top:6px}.hmo-oauth-tip{display:none;margin-top:5px;border:1px solid #b9d4f7;background:#f1f7ff;border-radius:8px;padding:7px 8px;font-size:8.5px;line-height:1.5;color:#315f96}.hmo-oauth-tip.show{display:block}.hmo-oauth-tip button{margin-left:6px;border:0;background:transparent;color:#1769ff;font:inherit;font-weight:900;cursor:pointer;padding:0}@media(max-width:760px){.hmo-capability{grid-template-columns:1fr}}
`;document.head.appendChild(style)
}
function safeLinks(key){
 const p=PROVIDERS[key];if(!p)return'';
 return `<div class="hmo-links" data-hmo-provider-links><a href="${esc(p.home)}" target="_blank" rel="noopener noreferrer">打开${esc(p.label)}官网</a>${p.signup?`<a href="${esc(p.signup)}" target="_blank" rel="noopener noreferrer">注册新邮箱</a>`:''}<a href="${esc(p.help)}" target="_blank" rel="noopener noreferrer">查看官方帮助</a></div>`
}
function cardBy(title){return $$('#hmsBack .hms-card').find(card=>clean($('b',card)?.textContent).includes(title))}
function enhanceCards(){
 const gmail=cardBy('Gmail'),outlook=cardBy('Outlook');
 if(gmail&&!$('[data-hmo-card="gmail"]',gmail)){const n=document.createElement('div');n.dataset.hmoCard='gmail';n.innerHTML=safeLinks('gmail');gmail.appendChild(n)}
 if(outlook&&!$('[data-hmo-card="outlook"]',outlook)){const n=document.createElement('div');n.dataset.hmoCard='outlook';n.innerHTML=safeLinks('outlook');outlook.appendChild(n)}
}
function addOption(select,value,label,before='custom'){
 if(!select||select.querySelector(`option[value="${value}"]`))return;
 const option=document.createElement('option');option.value=value;option.textContent=label;
 const anchor=select.querySelector(`option[value="${before}"]`);if(anchor)select.insertBefore(option,anchor);else select.appendChild(option)
}
function field(selector,value){const node=$(selector);if(node)node.value=String(value)}
function selectedKey(){return $('[data-hms-preset]')?.value||'qq'}
function updateProviderHelp(){
 const host=$('[data-hms-hint]');if(!host)return;
 let links=$('[data-hmo-provider-links]',host.parentElement);
 if(!links){host.insertAdjacentHTML('afterend','<div class="hmo-provider-help" data-hmo-provider-links></div>');links=$('[data-hmo-provider-links]',host.parentElement)}
 const key=selectedKey();links.outerHTML=safeLinks(key)||'<div class="hmo-provider-help" data-hmo-provider-links></div>'
}
function applyExtendedPreset(){
 const key=selectedKey(),hint=$('[data-hms-hint]');
 if(key==='zoho_org'){
  field('[data-hms-host]','smtppro.zoho.com');field('[data-hms-port]',465);field('[data-hms-security]','ssl');
  if(hint)hint.textContent='适用于使用自有域名的 Zoho 企业邮箱；启用两步验证后请使用应用专用密码。'
 }else if(key==='aliyun_foreign'){
  field('[data-hms-host]','smtp.alibaba.com');field('[data-hms-port]',465);field('[data-hms-security]','ssl');
  if(hint)hint.textContent='适用于阿里外贸邮；请在邮箱后台启用客户端访问并使用授权码或安全密码。'
 }
 updateProviderHelp()
}
function oauthTip(email){
 const domain=clean(email).toLowerCase().split('@').pop()||'',provider=DOMAINS[domain];
 const tip=$('[data-hmo-oauth-tip]');if(!tip)return provider;
 if(provider==='gmail'||provider==='outlook'){
  const label=provider==='gmail'?'Gmail':'Outlook';tip.classList.add('show');tip.innerHTML=`检测到 ${label} 地址。建议使用上方一键授权，这样才能自动收信、同步回复并安全续期。<button type="button" data-hmo-use-oauth="${provider}">改用一键连接 ${label}</button>`
 }else{tip.classList.remove('show');tip.textContent=''}
 return provider
}
function detectEmail(){
 const input=$('[data-hms-email]'),select=$('[data-hms-preset]');if(!input||!select)return;
 const provider=oauthTip(input.value);if(!provider||provider==='gmail'||provider==='outlook')return;
 if(select.value!==provider){select.value=provider;select.dispatchEvent(new Event('change',{bubbles:true}))}else applyExtendedPreset()
}
function enhanceCompanyPanel(){
 const panel=$('[data-hms-company]');if(!panel)return;
 const select=$('[data-hms-preset]');
 addOption(select,'aliyun_foreign','阿里外贸邮');addOption(select,'zoho_org','Zoho 企业邮箱（自有域名）');
 const zoho=select?.querySelector('option[value="zoho"]');if(zoho)zoho.textContent='Zoho 个人邮箱';
 const email=$('[data-hms-email]');if(email&&!$('[data-hmo-oauth-tip]',email.parentElement)){email.insertAdjacentHTML('afterend','<div class="hmo-oauth-tip" data-hmo-oauth-tip></div>')}
 if(!$('[data-hmo-capability]',panel)){
  const actions=$('.hms-actions',panel);actions?.insertAdjacentHTML('beforebegin',`<div class="hmo-capability" data-hmo-capability><div><b>Gmail / Outlook</b><span>一键授权后可收信、发信、同步回复和自动刷新授权。</span></div><div><b>企业邮箱 / 其他邮箱</b><span>当前通过 SMTP 安全发信；自动收件仍建议使用 Gmail 或 Outlook。</span></div><div><b>系统通知邮箱</b><span>注册验证、找回密码属于平台通知邮箱，与业务邮箱分开配置。</span></div></div>`)
 }
 applyExtendedPreset();detectEmail()
}
function enhance(){css();enhanceCards();enhanceCompanyPanel();scheduled=false}
function schedule(){if(scheduled)return;scheduled=true;[0,50,160,360,700].forEach(ms=>setTimeout(enhance,ms))}
document.addEventListener('input',e=>{if(!e.target?.matches?.('[data-hms-email]'))return;clearTimeout(inputTimer);inputTimer=setTimeout(detectEmail,180)},true);
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-hms-preset]'))setTimeout(applyExtendedPreset,0)},true);
document.addEventListener('click',e=>{
 const oauth=e.target?.closest?.('[data-hmo-use-oauth]');if(oauth){e.preventDefault();const provider=oauth.dataset.hmoUseOauth;document.querySelector(`[data-hms-owner-connect="${provider}"]`)?.click();return}
 if(e.target?.closest?.('[data-other-mail],[data-huf-other-mail],#mgManage,[data-hms-show-company]'))schedule()
},true);
window.addEventListener('HUIDI:mail-accounts-changed',schedule);window.addEventListener('HUIDI:fusion-pane-rendered',schedule);window.addEventListener('HUIDI:community-online-view',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.HUIDIMailOnboardingAssist=Object.freeze({version:'1.0.0',schedule,detectEmail,applyExtendedPreset});
})();
