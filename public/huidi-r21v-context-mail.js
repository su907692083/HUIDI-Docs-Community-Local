/* R21V — context fact repair + mailbox owner cleanup */
(()=>{'use strict';
if(window.HUIDIR21V)return;
window.HUIDIR21V=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clean=v=>String(v??'').trim();
const COUNTRY=[
 ['AU',['澳大利亚','Australia']],['US',['美国','United States','USA']],['GB',['英国','United Kingdom','UK']],
 ['DE',['德国','Germany']],['FR',['法国','France']],['NL',['荷兰','Netherlands']],['IT',['意大利','Italy']],
 ['ES',['西班牙','Spain']],['CA',['加拿大','Canada']],['AE',['阿联酋','United Arab Emirates','UAE']],
 ['SA',['沙特','Saudi Arabia']],['JP',['日本','Japan']],['KR',['韩国','South Korea','Korea']],['VN',['越南','Vietnam']],
 ['IN',['印度','India']],['SG',['新加坡','Singapore']],['MY',['马来西亚','Malaysia']],['TH',['泰国','Thailand']],
 ['ID',['印度尼西亚','Indonesia']],['BR',['巴西','Brazil']],['MX',['墨西哥','Mexico']]
];
function countryHit(value){const v=clean(value).toLowerCase();if(!v)return null;for(const [code,names] of COUNTRY){if(code.toLowerCase()===v||names.some(x=>x.toLowerCase()===v))return{code,label:names[0],aliases:names}}return null}

function repairTaskDialog(){
 const d=$('.htf-dialog[open],.htf-dialog:modal');if(!d)return;
 const products=$$('[data-htf-set="product"]',d);
 if(products.length===1&&!products[0].classList.contains('active')){
   const foot=$('.htf-footer',d);
   if(/还缺[:：]?\s*产品/.test(clean(foot?.textContent))){products[0].click();return}
 }
 const input=$('#htfMarketInput',d),foot=$('.htf-footer',d);
 if(input){
   const hit=countryHit(input.value);
   if(hit){
     const chips=$$('[data-htf-set="market"]',d);
     const selected=chips.find(b=>b.classList.contains('active'));
     if(!selected){
       const target=chips.find(b=>{
         const val=clean(b.dataset.value),lab=clean(b.dataset.label),txt=clean(b.textContent);
         return val===hit.code||val===hit.label||lab===hit.label||txt===hit.label||hit.aliases.includes(val)||hit.aliases.includes(lab)||hit.aliases.includes(txt);
       });
       if(target){target.click();return}
     }
   }
 }
 if(foot&&!/还缺/.test(clean(foot.textContent))){
   const go=$('[data-htf-go]',foot);if(go)go.disabled=false;
 }
}

function mailPane(){
 const view=$('#view-mail');if(!view)return'';
 return $(':scope > .fv2-panes > .fv2-pane.active',view)?.dataset?.fv2Pane||'';
}
function hideContextNoise(){
 const bar=$('.htf-context');if(!bar)return;
 const view=document.body.dataset.huidiView||location.hash.replace(/^#/,'');
 const pane=mailPane();
 bar.hidden=view==='mail'&&['base','inbox','sent','mailbox','queue','sequences'].includes(pane);
}
function repairMail(){
 const view=$('#view-mail');if(!view)return;
 const pane=mailPane();
 const setup=$('.hcwr-mail-setup',view);
 if(setup)setup.hidden=pane!=='mailbox';
 const main=$('#huidiServiceMain',view);
 if(main){main.style.width='100%';main.style.maxWidth=pane==='mailbox'?'980px':'none'}
 const zeroText=/共\s*0\s*条|暂时没有邮件记录|还没有邮件记录|当前没有待发送邮件/;
 $$('div,section',view).forEach(el=>{
   if(el.children.length>12)return;
   const t=clean(el.textContent);
   if(zeroText.test(t)&&!el.closest('.htf-context'))el.classList.add('r21v-mail-zero');
 });
 const zero=zeroText.test(clean($(':scope > .fv2-panes > .fv2-pane.active',view)?.textContent));
 if(zero){
   $$('button',view).forEach(b=>{if(/^(上一页|下一页)$/.test(clean(b.textContent)))b.classList.add('r21v-hide-zero-pagination')});
 }
 const sq=$('#sqBack.sq-page-surface',view);
 if(sq){
   const z=/共\s*0\s*条|当前没有自动跟进中的客户|当前没有自动跟进中/.test(clean(sq.textContent));
   sq.classList.toggle('r21v-sequence-zero',z);
   if(z)$$('button',sq).forEach(b=>{if(/^(上一页|下一页)$/.test(clean(b.textContent)))b.classList.add('r21v-hide-zero-pagination')});
 }
}
function tagSemanticFields(){
 const map={
  hfCountry:'country',hsTradeCountry:'country',hsTariffDest:'country',hsTariffOrigin:'country',hsShipOrigin:'country',hsShipDest:'country',fv2Country:'country',
  hsFxBase:'currency',hsFxQuote:'currency',fv2BankCurrency:'currency',hbCurrency:'currency',
  hfHsCode:'hs',hsTariffCode:'hs',hsShipDate:'date',hsShipContainer:'container',hfBuyerType:'buyer',hsMapBuyer:'buyer'
 };
 for(const [id,kind] of Object.entries(map)){const el=$('#'+CSS.escape(id));if(el)el.dataset.r21vKind=kind}
}
function refresh(){repairTaskDialog();hideContextNoise();repairMail();tagSemanticFields()}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-fv2-tab],.nav-btn,[data-htf-task],[data-htf-set],[data-mail-folder]'))setTimeout(refresh,30);
},true);
window.addEventListener('HUIDI:community-online-view',()=>setTimeout(refresh,25));
window.addEventListener('HUIDI:fusion-pane-rendered',()=>setTimeout(refresh,25));
let timer=0;
const mo=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,40)});
function boot(){refresh();mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','open','hidden']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HUIDIR21V=Object.freeze({version:'1.0.0',refresh});
})();