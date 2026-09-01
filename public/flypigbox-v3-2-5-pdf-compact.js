/* HUIDI V3.2.5 — compact PDF editor, stable folding, summaries and PDF follow */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const STORAGE_PREFIX='flypigbox_v325_';
let summaryTimer=0, highlightTimer=0, followEnabled=true, originalFocusPreviewTarget=null;

const readStorage=(key,fallback='')=>{try{const value=localStorage.getItem(STORAGE_PREFIX+key);return value===null?fallback:value}catch{return fallback}};
const writeStorage=(key,value)=>{try{localStorage.setItem(STORAGE_PREFIX+key,String(value))}catch{}};
const value=id=>clean($(id)?.value);
const filledCount=ids=>ids.reduce((count,id)=>count+(value(id)?1:0),0);
const visibleProductRows=()=>qsa('#itemList .item-row').filter(row=>clean(row.querySelector('.i-name')?.value||row.querySelector('input')?.value));

function cardByTitle(text){
  return qsa('.form-column>section.card').find(card=>clean(card.querySelector('.section-collapse-head h2,.section-title h2,:scope>h2')?.textContent).includes(text));
}
function setCardOpen(card,open,{scroll=false}={}){
  if(!card)return;
  const body=card.querySelector('.section-collapse-body');
  const toggle=card.querySelector('.section-collapse-toggle');
  if(body)body.hidden=!open;
  card.classList.toggle('is-collapsed',!open);
  if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'收起 ▲':'展开 ▼';}
  if(card.dataset.v751Open!==undefined)card.dataset.v751Open=open?'1':'0';
  if(scroll)card.scrollIntoView({behavior:'smooth',block:'start'});
}
function activateEditorCard(card){
  qsa('.fp-pdf-editor-active').forEach(node=>node.classList.remove('fp-pdf-editor-active'));
  card?.classList.add('fp-pdf-editor-active');
  window.clearTimeout(card?._fpActiveTimer);
  if(card)card._fpActiveTimer=window.setTimeout(()=>card.classList.remove('fp-pdf-editor-active'),1800);
}

function compactBaseCard(){
  const card=document.querySelector('#editorTop>.card:first-child');
  if(!card||card.dataset.fpV325Ready==='1')return;
  card.dataset.fpV325Ready='1';card.classList.add('fp-pdf-base-card');
  const title=card.querySelector(':scope>.section-title');
  if(!title)return;
  const heading=title.querySelector('h2');if(heading)heading.textContent='基础信息';
  const existingActions=title.querySelector('.section-actions');
  const actions=document.createElement('div');actions.className='fp-pdf-base-head-actions';actions.innerHTML='<span class="fp-pdf-completion" id="fpPdfBaseCompletion">0/10</span><button type="button" class="fp-pdf-base-toggle" aria-expanded="true" aria-label="展开或收起基础信息">⌃</button>';
  if(existingActions){existingActions.style.display='flex';existingActions.classList.add('fp-pdf-base-context-actions');actions.prepend(existingActions);}
  title.appendChild(actions);
  const body=document.createElement('div');body.className='fp-pdf-base-body';
  Array.from(card.children).filter(node=>node!==title).forEach(node=>body.appendChild(node));
  card.appendChild(body);
  const hint=body.querySelector(':scope>.hint');
  if(hint){const details=document.createElement('details');details.className='fp-base-help';details.innerHTML='<summary>PDF语言与字段说明</summary>';hint.before(details);details.appendChild(hint);}
  const stored=readStorage('base_open','1');
  const apply=open=>{body.hidden=!open;card.classList.toggle('is-collapsed',!open);const button=actions.querySelector('button');button.setAttribute('aria-expanded',String(open));button.textContent=open?'⌃':'⌄';writeStorage('base_open',open?'1':'0')};
  apply(stored!=='0');
  title.addEventListener('click',event=>{if(event.target.closest('input,select,a'))return;const open=actions.querySelector('button').getAttribute('aria-expanded')!=='true';apply(open)});
}

function compactAiCard(){
  const card=document.querySelector('.form-column>.api-card');
  if(!card)return;
  card.classList.add('fp-compact-ai-card');
  const summary=card.querySelector(':scope>details>summary');
  if(!summary)return;
  summary.textContent='✨ AI翻译与语言状态（可选）';
  const language=()=>({bilingual:'中英双语',zh:'中文',en:'英文'}[$('docLanguage')?.value]||'当前语言');
  summary.dataset.status=`${language()} · 商品与条款保留原文`;
}

function buildSectionNav(){
  if($('fpPdfSectionNav'))return;
  const quick=$('fpQuickSourceBar'),form=document.querySelector('.form-column');if(!form)return;
  const nav=document.createElement('nav');nav.id='fpPdfSectionNav';nav.setAttribute('aria-label','PDF编辑栏目');
  nav.innerHTML=`
    <button type="button" data-pdf-nav="base">基础</button>
    <button type="button" data-pdf-nav="party">买卖双方</button>
    <button type="button" data-pdf-nav="products">商品</button>
    <button type="button" data-pdf-nav="terms">交易条件</button>
    <button type="button" data-pdf-nav="logistics">物流与包装</button>
    <button type="button" data-pdf-nav="payment">收款信息</button>
    <button type="button" data-pdf-nav="signature">签名与公章</button>`;
  if(quick?.parentElement===form)quick.after(nav);else form.prepend(nav);
  const targets={base:()=>document.querySelector('#editorTop>.fp-pdf-base-card'),party:()=>cardByTitle('买卖双方'),products:()=>cardByTitle('商品明细'),terms:()=>cardByTitle('交易条款'),logistics:()=>cardByTitle('物流信息'),payment:()=>cardByTitle('收款账户'),signature:()=>cardByTitle('电子签名')};
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-pdf-nav]');if(!button)return;
    const key=button.dataset.pdfNav,target=targets[key]?.();if(!target)return;
    if(target.classList.contains('collapsible-card'))setCardOpen(target,true);
    if(target.classList.contains('fp-pdf-base-card')){const body=target.querySelector('.fp-pdf-base-body');if(body?.hidden)target.querySelector('.fp-pdf-base-toggle')?.click();}
    if(target.matches('.api-card')){const details=target.querySelector('details');if(details)details.open=true;}
    target.scrollIntoView({behavior:'smooth',block:'start'});activateEditorCard(target);
    qsa('[data-pdf-nav]',nav).forEach(node=>node.classList.toggle('active',node===button));
    const parent=button.closest('details');if(parent)window.setTimeout(()=>{parent.open=false},120);
  });
}

function makeCollapseHeadsClickable(){
  qsa('.form-column>.collapsible-card .section-collapse-head').forEach(head=>{
    if(head.dataset.fpV325Click==='1')return;head.dataset.fpV325Click='1';head.dataset.clickable='1';
    head.addEventListener('click',event=>{
      if(event.target.closest('button,input,select,textarea,a,label'))return;
      head.querySelector('.section-collapse-toggle')?.click();
    });
  });
}

function updateSummaries(){
  const base=$('fpPdfBaseCompletion');
  const baseIds=['docLanguage','currency','invoiceNo','issueDate','validUntil','quoteNo','customerPo','originCountry','moq','salesperson'];
  if(base)base.textContent=`${filledCount(baseIds)}/${baseIds.length}`;
  const party=cardByTitle('买卖双方')?.querySelector('.section-collapse-summary');
  if(party){const buyer=value('buyerName'),seller=value('sellerName');party.textContent=buyer?`${buyer}${seller?' · '+seller:''}`:(seller||'客户与卖方资料未填写');}
  const products=cardByTitle('商品明细')?.querySelector('.section-collapse-summary');
  if(products){const rows=visibleProductRows();const currency=value('currency')||'USD';let total=0;qsa('#itemList .item-row').forEach(row=>{const qty=Number(row.querySelector('.i-qty')?.value||0),price=Number(row.querySelector('.i-price')?.value||0);total+=qty*price});products.textContent=rows.length?`${rows.length}项 · ${currency} ${total.toFixed(2)}`:'尚未添加商品';}
  const logistics=cardByTitle('物流信息')?.querySelector('.section-collapse-summary');
  if(logistics){const ids=['shippingMethod','packageCount','packageType','netWeight','grossWeight','cbm','destinationPort','portOfLoading','etd','eta'];const count=filledCount(ids);logistics.textContent=count?`已填写 ${count} 项物流资料`:'未填写，客户文件不会显示';}
  const payment=cardByTitle('收款账户')?.querySelector('.section-collapse-summary');
  if(payment){const account=value('bankBeneficiary')||value('bankName');payment.textContent=account||'未填写，客户文件不会显示';}
  const terms=cardByTitle('交易条款')?.querySelector('.section-collapse-summary');
  if(terms){const ids=['paymentTerms','tradeTerms','deliveryTime','portOfLoading','estimatedShipment','remarks'];const count=filledCount(ids);terms.textContent=count?`已填写 ${count} 项交易条件`:'未填写条款与备注';}
  const signature=cardByTitle('电子签名')?.querySelector('.section-collapse-summary');
  if(signature){const has=Boolean(document.querySelector('.upload-preview img[src]:not([src=""])'));signature.textContent=has?'已添加签名或公章':'未添加，空白区域不会输出';}
  const ai=document.querySelector('.form-column>.api-card details>summary');if(ai){const lang=({bilingual:'中英双语',zh:'中文',en:'英文'}[$('docLanguage')?.value]||'当前语言');ai.dataset.status=`${lang} · AI翻译${$('translationReviewed')?.checked?'已核对':'可选'}`;}
}
function scheduleSummaries(){window.clearTimeout(summaryTimer);summaryTimer=window.setTimeout(updateSummaries,80)}

const fieldSections={
  docLanguage:'base',currency:'base',originCountry:'base',invoiceNo:'base',issueDate:'base',validUntil:'base',customerPo:'base',quoteNo:'base',moq:'base',salesperson:'base',
  sellerName:'party',sellerContact:'party',sellerPhone:'party',sellerEmail:'party',sellerAddress:'party',sellerTaxId:'party',buyerName:'party',buyerContact:'party',buyerPhone:'party',buyerEmail:'party',buyerWebsite:'party',buyerCountry:'party',buyerCountryCode:'party',buyerAddress:'party',buyerTaxId:'party',
  paymentTerms:'terms',tradeTerms:'terms',deliveryTime:'terms',portOfLoading:'terms',estimatedShipment:'terms',remarks:'terms',
  shippingMethod:'logistics',packageCount:'logistics',packageType:'logistics',netWeight:'logistics',grossWeight:'logistics',cbm:'logistics',destinationPort:'logistics',logisticsCarrier:'logistics',trackingNo:'logistics',blNo:'logistics',containerNo:'logistics',sealNo:'logistics',vesselFlight:'logistics',etd:'logistics',eta:'logistics',packageDimensions:'logistics',shippingMarks:'logistics',
  bankBeneficiary:'payment',bankName:'payment',bankAccount:'payment',bankSwift:'payment',bankAddress:'payment'
};
const sectionHeadings={base:['单据信息','DOCUMENT INFORMATION'],party:['买卖双方','SELLER & BUYER'],products:['报价商品','商品明细','PRODUCT DETAILS'],terms:['交易条款','条款与备注','TERMS'],logistics:['物流信息','LOGISTICS','SHIPPING'],payment:['收款信息','PAYMENT','BANK'],signature:['授权签字','AUTHORIZED SIGNATURE']};
function editorSectionFor(control){
  if(control.closest('#itemList'))return 'products';
  const id=control.id||control.dataset?.bindId||'';return fieldSections[id]||'';
}
function findPdfNode(control,section){
  const root=$('piPaper');if(!root)return null;
  const current=clean(control.value);
  if(current){const matches=qsa('td,th,p,span,div',root).filter(node=>clean(node.textContent).includes(current));matches.sort((a,b)=>clean(a.textContent).length-clean(b.textContent).length);if(matches[0])return matches[0];}
  if(section==='products'){
    const row=control.closest('#itemList .item-row');const index=qsa('#itemList .item-row').indexOf(row);const rows=qsa('table.products tbody tr,#piPaper .products tr',root).filter(node=>node.querySelector('td'));if(index>=0&&rows[index])return rows[index];
  }
  const terms=sectionHeadings[section]||[];
  for(const term of terms){const node=qsa('.doc-section,th,h2,h3,div,p',root).find(candidate=>clean(candidate.textContent).toUpperCase().includes(term.toUpperCase()));if(node)return node;}
  return null;
}
function clearPdfHighlight(){qsa('#piPaper .fp-pdf-field-highlight').forEach(node=>node.classList.remove('fp-pdf-field-highlight'));}
function locatePdfControl(control,{scroll=true}={}){
  if(!followEnabled||!document.body.classList.contains('fp-live-document-mode'))return;
  const section=editorSectionFor(control);if(!section)return;
  const node=findPdfNode(control,section);if(!node)return;
  clearTimeout(highlightTimer);clearPdfHighlight();
  const target=node.closest('td,tr,.doc-section,section')||node;target.classList.add('fp-pdf-field-highlight');
  if(scroll)target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  highlightTimer=window.setTimeout(()=>target.classList.remove('fp-pdf-field-highlight'),1900);
}
function installFollowToggle(){
  followEnabled=false;
  const old=$('fpPdfFollowToggle');if(old)old.remove();
}


function installEvents(){
  const form=$('piForm');if(!form)return;
  form.addEventListener('focusin',event=>{
    const control=event.target.closest('input,select,textarea');if(!control)return;
    const section=editorSectionFor(control);const card=section==='base'?document.querySelector('.fp-pdf-base-card'):section==='products'?cardByTitle('商品明细'):section==='party'?cardByTitle('买卖双方'):section==='terms'?cardByTitle('交易条款'):section==='logistics'?cardByTitle('物流信息'):section==='payment'?cardByTitle('收款账户'):null;
    activateEditorCard(card);
  },true);
  form.addEventListener('input',event=>{if(event.isComposing)return;scheduleSummaries();},true);
  form.addEventListener('change',()=>scheduleSummaries(),true);
}

function boot(){
  if(!$('piForm')||!document.querySelector('.form-column'))return;
  document.body.dataset.fpRelease='v3.3.4.0-preview-navigation-export';
  document.querySelector('.section-fold-toolbar')?.remove();
  compactBaseCard();compactAiCard();buildSectionNav();makeCollapseHeadsClickable();installFollowToggle();installEvents();updateSummaries();
  window.setTimeout(()=>{compactBaseCard();compactAiCard();buildSectionNav();makeCollapseHeadsClickable();updateSummaries()},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.setTimeout(boot,220));else window.setTimeout(boot,220);
})();
