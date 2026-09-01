(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const context = () => { try { return JSON.parse(sessionStorage.getItem('flypigbox_document_context') || '{}'); } catch { return {}; } };
  const typeLabel = type => ({ quotation:'报价单', proforma_invoice:'形式发票（PI）', commercial_invoice:'商业发票', sales_contract:'销售合同', packing_list:'装箱单' }[type] || '业务文件');

  function showChecklist(items) {
    let modal = $('#fp-v4-check-modal');
    if (!modal) {
      modal = document.createElement('dialog'); modal.id = 'fp-v4-check-modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="inner"><h3>导出前核对</h3><p>核对结果不会自动修改你的单据。请确认客户、金额、收款、条款、物流和日期。</p><div class="list">${items.map(item => `• ${safe(item)}`).join('<br>')}</div><footer><button data-fpv4-close>返回修改</button><button class="primary" data-fpv4-close>我已核对</button></footer></div>`;
    modal.querySelectorAll('[data-fpv4-close]').forEach(button => button.addEventListener('click', () => modal.close()));
    modal.showModal();
  }

  function buildChecklist() {
    const app = window.FlypigBOXApp;
    const form = app?.formState?.(true) || {};
    const f = form.fields || {};
    const items = Array.isArray(form.items) ? form.items : [];
    const type = f.documentType || new URLSearchParams(location.search).get('type')||new URLSearchParams(location.search).get('doc') || 'proforma_invoice';
    const result = [];
    if (!String(f.sellerName || '').trim()) result.push('卖方公司名称尚未填写。');
    if (!String(f.buyerName || '').trim()) result.push('买方公司或客户名称尚未填写。');
    if (!String(f.currency || '').trim()) result.push('尚未设置结算币种。');
    if (!items.length) result.push('尚未添加商品明细。');
    if (items.some(item => !String(item.name || '').trim() || !(Number(item.qty) > 0))) result.push('部分商品缺少名称或有效数量。');
    if (type === 'quotation' && !String(f.validUntil || '').trim()) result.push('报价单尚未填写有效期。');
    if (['proforma_invoice', 'sales_contract'].includes(type) && !String(f.paymentTerms || '').trim()) result.push('付款条款尚未填写。');
    if (type === 'proforma_invoice' && !String(f.bankBeneficiary || '').trim()) result.push('PI 尚未填写收款人或付款资料。');
    if (type === 'commercial_invoice' && !String(f.originCountry || '').trim()) result.push('商业发票尚未填写原产国。');
    if (type === 'packing_list' && !(Number(f.packageCount) > 0)) result.push('装箱单尚未填写总箱数。');
    if (String(f.tradeTerms || '').trim() && !String(f.portOfLoading || '').trim() && ['FOB','CIF','CFR'].includes(String(f.tradeTerms).trim().toUpperCase())) result.push('当前贸易术语通常需要核对装运港。');
    if (!result.length) result.push('当前文件的基础信息完整。仍请人工核对主体名称、金额、账号、地址、HS Code、条款和日期。');
    return result;
  }

  function addBusinessContext() {
    const ctx = context();
    $('#fp-v4-business-context')?.remove();
    const anchor = $('#editorTop');
    if (!anchor) return;
    const customer = ctx.customer?.company_name || ctx.customer?.name || '';
    const brand = ctx.brand?.company_name || '';
    const deal = ctx.deal?.title || '';
    const type = new URLSearchParams(location.search).get('type')||new URLSearchParams(location.search).get('doc') || ctx.starter_fields?.documentType || 'proforma_invoice';
    const bar = document.createElement('section'); bar.id = 'fp-v4-business-context';
    bar.innerHTML = `<div><b>${safe(typeLabel(type))}</b>${deal ? `　所属业务：<strong>${safe(deal)}</strong>` : '　未关联业务'}${customer ? `　客户：<strong>${safe(customer)}</strong>` : ''}${brand ? `　品牌：<strong>${safe(brand)}</strong>` : ''}</div><div class="fp-context-actions"><button type="button" data-fpv4-check>导出前核对</button><button type="button" data-fpv4-workspace>返回业务工作台</button></div>`;
    anchor.parentNode?.insertBefore(bar, anchor);
    $('[data-fpv4-check]', bar)?.addEventListener('click', () => showChecklist(buildChecklist()));
    $('[data-fpv4-workspace]', bar)?.addEventListener('click', () => location.href = './workspace.html');
  }

  function refineCopy() {
    $('.payment-promo')?.remove();
    const save = $('#saveAllBtn'); if (save) { save.textContent = '保存当前草稿'; save.title = '保存当前单据；云端状态以实际账号配置为准。'; }
    const clear = $('#clearDocumentBtn'); if (clear) { clear.textContent = '清空本单据'; clear.title = '仅清空当前单据的填写内容，不影响客户、商品、品牌或模板。'; }
    const payment = $('#saveDefaultsBtn'); if (payment) payment.textContent = '保存收款资料';
    const note = $('#pdfExportNote'); if (note) note.textContent = '导出前请核对客户、金额、收款、条款、物流和日期。';
    const hint = $('.payment-template-bar + .subhint'); if (hint) hint.textContent = '收款人、账号、SWIFT、付款链接和平台账号保持原样，不参与翻译。确认填写后，收款资料才会显示在预览与 PDF 中。';
    const topExport = $('#headerExportPdfBtn');
    if (topExport && !$('#fp-v4-header-check')) { const button = document.createElement('button'); button.id = 'fp-v4-header-check'; button.className = 'btn secondary'; button.type = 'button'; button.textContent = '导出前核对'; button.addEventListener('click', () => showChecklist(buildChecklist())); topExport.parentNode?.insertBefore(button, topExport); }
  }

  function boot(attempt = 0) {
    refineCopy(); addBusinessContext();
    if (!window.FlypigBOXApp && attempt < 30) setTimeout(() => boot(attempt + 1), 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 200)); else setTimeout(boot, 200);
})();
