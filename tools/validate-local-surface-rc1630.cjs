const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[LOCAL-SURFACE] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[LOCAL-SURFACE] PASS:',m);

const editor=read('public/editor.html');
const mode=read('public/community-local-mode.js');
const css=read('public/community-local-mode.css');
const catalog=read('public/catalog-studio/index.html');
const engineIntegration=read('public/flypigbox-v3-3-6-24-r1-3a-17-engine-integration.js');
const documentLinkage=read('public/flypigbox-v3-3-6-24-r1-3a-18-document-linkage.js');
const localEditor=read('public/huidi-local-editor-rc15.js');
const quickResult=read('public/flypigbox-quick-result.js');
const schema=read('public/flypigbox-document-schema.js');
const syncCore=read('public/flypigbox-v3-3-5-0-sync-core.js');
const toolbarCss=read('public/huidi-toolbar-owner-rc1617.css');
const documentStart=read('public/document-start.html');
const localBridge=read('public/huidi-local-editor-bridge-v120.js');
const localStability=read('public/huidi-local-stability-rc165.js');
const actionOwner=read('public/huidi-action-owner-rc1621.js');
const chineseFirst=read('public/flypigbox-v3-3-1-9-chinese-first.js');
const quotationQuickFlow=read('public/flypigbox-quotation-quick-flow.js');
const localCss=read('public/huidi-local-rc5.css');
const tableView=read('public/flypigbox-editor-table-view.js');
const tableOutput=read('public/flypigbox-editor-table-output.js');

const hiddenIds=[
  'memberAuthBtn','memberSignOutBtn','membershipPlansBtn',
  'cloudSaveBtn','cloudHistoryBtn','openLaunchPlans','launchPlansBtn',
  'fp-ai-widget','fp-assistant41-launcher'
];

const checks=[
  ['strict local edition flag',mode.includes("localOnly:true,strictNetwork:true")],
  ['production runtime config blanked',mode.includes("window.FLYPIGBOX_SUPABASE={url:'',publishableKey:'',runtimeConfigFunction:''}")],
  ['cross-origin fetch blocked',mode.includes("HUIDI_LOCAL_ONLY_NETWORK_BLOCKED")&&mode.includes("window.fetch=(input,init)=>sameOrigin(input)")],
  ['online-only ids hidden by runtime',hiddenIds.every(id=>mode.includes("'"+id+"'"))],
  ['online-only controls hidden by CSS',css.includes('.huidi-community-local .api-card')&&css.includes('#cloudSaveBtn')&&!css.includes('.huidi-community-local #translateAllBtn')],
  ['Local translation controls are not runtime-hidden',!mode.includes("'headerTranslateBtn','translateAllBtn'")&&!mode.includes("'translateAllBtn','fp-ai-widget'")],
  ['low-frequency toolbar controls move to More',css.includes('#huidiLocalCheckHeader')&&css.includes('#fpV3321FieldsHeader')&&css.includes('#fpV3325LayoutHeader')&&localEditor.includes('data-rc15-action="fields"')&&localEditor.includes('data-rc15-action="layout"')],
  ['trade toolbar keeps low-frequency mode template and sync out of sight',toolbarCss.includes('#huidiMasterSyncHeader')&&toolbarCss.includes('#fpV3321TemplateHeader')&&toolbarCss.includes('#fpV3321ModeHeader:not([data-fp-a13-formal])')],
  ['workspace naming matches user tasks',quickResult.includes('>表单填写</button>')&&quickResult.includes('>表格填写</button>')&&!quickResult.includes('>PDF 单据</button>')&&!quickResult.includes('>表格工作台</button>')],
  ['field density choices live in More',quickResult.includes('data-lite-action="mode-common"')&&quickResult.includes('data-lite-action="mode-full"')&&quickResult.includes('常用字段')&&quickResult.includes('完整字段')],
  ['quotation mode copy no longer says quick/full quotation',schema.includes("label:'常用字段'")&&schema.includes("label:'完整字段'")&&!schema.includes("label:'快速报价'")&&!schema.includes("label:'完整报价'")],
  ['quotation buyer company is advisory',syncCore.includes("if(t==='quotation')add(warnings,'buyer'")&&syncCore.includes("else add(blocks,'buyer'")],
  ['unfinished seller/payment placeholders removed',!editor.includes('正式卖方电话待配置')&&!editor.includes('正式卖方邮箱待配置')&&!editor.includes('正式收款服务推荐与客服配置待接入')],
  ['mirrored validity dates are hidden business facts',schema.includes("MIRRORED_CANONICAL_FIELDS=new Set(['quotationValidUntil','proformaValidUntil','packingDate'])")&&schema.includes('data-fp-mirrored-canonical="1"')],
  ['new-document flow can search customers and products',documentStart.includes('id="customerSearch"')&&documentStart.includes('id="productSearch"')&&documentStart.includes('function filterStartChoices()')],
  ['new-document flow can copy a previous document safely',documentStart.includes('id="historyDoc"')&&documentStart.includes("K.histories")&&documentStart.includes("sessionStorage.setItem('huidi_local_chain_state_v1'")&&documentStart.includes("'invoiceNo','revisionNo','quotationVersion'")],
  ['history copy resets old business identifiers',documentStart.includes("'customerOrderNo','internalOrderNo','relatedQuotationNo','relatedPiNo','relatedContractNo','relatedCommercialInvoiceNo','relatedPackingListNo'")&&documentStart.includes('f.issueDate=iso(today)')],
  ['next-step conversion explains automatic carry-over',localBridge.includes('自动沿用客户、商品、数量、价格和条款，只补下一单所需资料')],
  ['product rows support customer item and per-line customs data',editor.includes('i-customer-item-no')&&editor.includes('i-customs-desc')&&editor.includes('i-origin-country')&&editor.includes('客户货号 / 清关信息（按需）')],
  ['trade product fields stay optional instead of cluttering quick entry',editor.includes("row.classList.toggle('hide-trade-extra',!showTradeExtra)")&&editor.includes("getDocumentType()==='commercial_invoice'")],
  ['packing assistant calculates cartons and totals',editor.includes('function openPackingAssistant()')&&editor.includes('Math.ceil(qty/per)')&&editor.includes("set('packageCount',String(totalCartons))")&&editor.includes('parsePackingDimensions')],
  ['quotation supports optional non-destructive price breaks',localEditor.includes('function openTierPricing()')&&localEditor.includes('正式金额仍按当前单价计算')&&editor.includes("tierPricing.hidden=getDocumentType()!=='quotation'")&&editor.includes('i-price-breaks')],
  ['price breaks do not replace current qty or unit price',localEditor.includes("row.querySelector('.i-price-breaks').value=JSON.stringify(breaks)")&&!localEditor.includes("row.querySelector('.i-price').value=breaks")&&!localEditor.includes("row.querySelector('.i-qty').value=breaks")],
  ['quotation PDF can show price breaks',editor.includes('pdf-product-price-breaks')&&editor.includes("documentType==='quotation'&&Array.isArray(item.priceBreaks)")],
  ['customer workbook can show price breaks',tableOutput.includes("key:'priceBreaks'")&&tableOutput.includes('阶梯报价 / Price Breaks')&&tableOutput.includes("if (key === 'priceBreaks')")],
  ['table mode exposes new trade product columns',tableView.includes("key:'customerItemNo'")&&tableView.includes("key:'customsDescription'")&&tableView.includes("key:'originCountry'")],
  ['Excel output carries new trade product columns',tableOutput.includes("key:'customerItemNo'")&&tableOutput.includes("key:'customsDescription'")&&tableOutput.includes("key:'originCountry'")],
  ['new-document wording uses trade-friendly entity names',documentStart.includes('<label>关联业务</label>')&&documentStart.includes('<label>卖方主体</label>')],
  ['visible high-frequency actions have explicit owners',
    quickResult.includes("if(primary)setMode(primary,true)")&&quickResult.includes("if(event.target.id==='fpLiteImportBtn')openImport()")&&
    editor.includes("$('packingAssistantBtn')?.addEventListener('click',openPackingAssistant)")&&editor.includes("$('addItemBtn').addEventListener('click'")&&
    editor.includes("$('verifyCustomerBtn').addEventListener('click',openCustomerVerifier)")&&editor.includes("$('openMapsBtn').addEventListener('click',openMaps)")&&
    localBridge.includes('bindGlobalExportCapture()')&&localBridge.includes("data-local-next")&&
    quickResult.includes('id="fpLiteMoreMenu"')&&localEditor.includes('ensureHub()')],
  ['tier pricing click is single-owned and array-safe',localEditor.includes("const rows=$('.item-row').filter")&&localEditor.includes('openTierPricing')&&actionOwner.includes("target.closest('#tierPricingBtn')")&&actionOwner.includes('window.HUIDILocalRC15?.openTierPricing?.()')],
  ['quotation supplement button stays directly clickable',quotationQuickFlow.includes("btn.textContent='补充'")&&quotationQuickFlow.includes("btn.addEventListener('click'")&&quotationQuickFlow.includes("findCard('商品与金额')||findCard('商品明细')")],
  ['Chinese-first editor labels are operator-friendly',chineseFirst.includes("docLanguage:{label:'客户文件语言'}")&&chineseFirst.includes("buyerName:{label:'客户公司'}")&&chineseFirst.includes("tradeTerms:{label:'贸易术语（FOB / CIF 等）'}")&&chineseFirst.includes("['.i-sku','货号'")],
  ['unit selectors show Chinese meaning without changing codes',chineseFirst.includes("PCS:'PCS 件'")&&chineseFirst.includes("CTN:'CTN 箱'")&&editor.includes('<option value="PCS">PCS 件</option>')],
  ['standard PI does not expose packing assistant',editor.includes("packingAssistant.hidden=!(getDocumentType()==='packing_list'||isDetailedDocMode())")],
  ['Local readiness reminder is compact',syncCore.includes('还差 ${result.blocks.length} 项')&&syncCore.includes('>去补充</button>')&&localCss.includes('grid-template-columns:auto minmax(0,1fr) auto!important')],
  ['Local top chrome hides low-frequency payment shortcut',localCss.includes('#huidiLocalPaymentHeader{display:none!important}')&&localCss.includes('#fpV3325DocSelect>span{display:none!important}')],
  ['Local save and next-step wording is concise',localBridge.includes("?'待保存':'已保存'")&&localBridge.includes('<summary>生成下一单</summary>')&&actionOwner.includes("saveBtn.textContent='保存'")&&localStability.includes("badge.textContent='待保存'")],
  ['quiet toolbar keeps compact action spacing',css.includes('#fpLiteToolbar .fp-lite-toolbar-actions{gap:4px!important}')],
  ['Local browser networking remains same-origin only',mode.includes("window.fetch=(input,init)=>sameOrigin(input)")],
  ['generic editor launch copy',editor.includes('id="launchStartBtn" type="button">开始制作</button>')&&!editor.includes('id="launchStartBtn" type="button">开始制作 PI</button>')],
  ['generic document intro copy',editor.includes('把多语言外贸单据、客户资料与交易条款，放进一个可控工作台')],
  ['local save success has no cloud setup warning',editor.includes('建议定期导出完整备份。')&&!editor.includes('已保存到本机：${title}。云端同步尚未配置。')],
  ['local save button restores local label',editor.includes("window.HUIDI_LOCAL_ONLY?.localOnly ? '保存到本机' : '💾 一键保存'")],
  ['dead Local assistant is not loaded by editor or catalog',!editor.includes('flypigbox-r1-3a-18-41-assistant.js')&&!editor.includes('flypigbox-r1-3a-18-41-assistant.css')&&!catalog.includes('flypigbox-r1-3a-18-41-assistant.js')&&!catalog.includes('flypigbox-r1-3a-18-41-assistant.css')],
  ['dead account presentation layer is not loaded by Local editor',!editor.includes('flypigbox-v3-3-4-2-prelaunch-account.js')&&!editor.includes('flypigbox-v3-3-4-2-prelaunch-account.css')],
  ['legacy local-preview observer is not loaded by Local editor',!editor.includes('flypigbox-v3-3-6-3-local-guest-ui.js')&&!editor.includes('flypigbox-v3-3-6-3-local-guest-ui.css')],
  ['hidden cloud job center is not loaded by Local editor',!editor.includes('flypigbox-v3-3-6-24-r1-3a-18-job-center.js')],
  ['notification-only realtime bridge is not loaded by Local editor',!editor.includes('flypigbox-r1-3a-18-28-realtime-event-bridge.js')],
  ['engine duplicate polling disabled in Local mode',engineIntegration.includes("if(!window.HUIDI_LOCAL_ONLY?.localOnly)setInterval(refresh,2500);refresh();")],
  ['document-linkage duplicate polling disabled in Local mode',documentLinkage.includes("if(!window.HUIDI_LOCAL_ONLY?.localOnly)setInterval(()=>{ensureButton();ensureWorkbenchCard();},2500)")]
];

for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[LOCAL-SURFACE] OK');
