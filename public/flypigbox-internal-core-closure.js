(() => {
  'use strict';

  const VERSION = 'R1.3A.18.24.2';
  const selected = {
    customer: new Set(),
    deal: new Set(),
    document: new Set()
  };
  let applying = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const today = () => new Date().toISOString().slice(0, 10);
  const api = () => window.FlypigBOXWorkspaceAPI || null;
  const state = () => api()?.getState?.() || null;
  const client = () => api()?.getClient?.() || window.FlypigBOXSupabaseClient || null;
  const toast = (message, error = false) => api()?.toast?.(message, error);

  const CUSTOMER_STAGES = {
    lead: '潜在线索', new_inquiry: '新询盘', qualified: '已确认需求', quoted: '已报价', negotiating: '谈判中', sample: '样品中', pi_contract: 'PI / 合同确认', paid: '已收款', production: '生产中', shipped: '已发货', repeat: '复购客户', dormant: '沉默客户', lost: '已流失'
  };
  const DEAL_STAGES = {
    new_inquiry: '新询盘', qualifying: '需求确认', quoted: '已报价', negotiating: '谈判中', sample: '样品 / 打样', pi_contract: 'PI / 合同确认', deposit_due: '等待定金', production: '生产中', shipment: '待出运', completed: '已完成', lost: '已失单'
  };
  const DOC_STATUS = { draft: '草稿', sent: '已发出', viewed: '已查看', confirmed: '已确认', paid: '已付款', void: '已作废', expired: '已过期' };
  const LANGUAGES = { en: '英文', zh: '中文', bilingual: '中英双语', es: '西班牙语', fr: '法语', ar: '阿拉伯语', pt: '葡萄牙语', de: '德语', ja: '日语', ko: '韩语' };
  const CURRENCIES = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'AED', 'SAR', 'CAD', 'AUD'];

  function optionHtml(items, emptyLabel) {
    const entries = Array.isArray(items) ? items.map(item => [item, item]) : Object.entries(items);
    return `<option value="">${esc(emptyLabel)}</option>${entries.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}`;
  }

  function currentUser() {
    return state()?.user || null;
  }

  function activeIds(kind) {
    if (kind === 'product') {
      return $$('[data-product-select]:checked').map(input => String(input.dataset.productSelect || '')).filter(Boolean);
    }
    return [...selected[kind]];
  }

  function updateCount(kind) {
    const node = $(`[data-internal-selected-count="${kind}"]`);
    if (node) { const count = activeIds(kind).length; node.textContent = count ? `${count} 项已选` : '未选择'; }
    const toolbar = $(`[data-internal-bulk-toolbar="${kind}"]`);
    if (toolbar) toolbar.classList.toggle('has-selection', activeIds(kind).length > 0);
  }

  function rowIdentity(kind, row) {
    if (kind === 'customer') return row.querySelector('[data-open-customer]')?.dataset.openCustomer || '';
    if (kind === 'deal') return row.dataset.dealRow || '';
    if (kind === 'document') return row.querySelector('[data-open-doc]')?.dataset.openDoc || '';
    return '';
  }

  function visibleRows(kind) {
    const selectors = {
      customer: '#customer-list .table-row',
      deal: '#deal-list [data-deal-row]',
      document: '#document-list .table-row'
    };
    return $$(selectors[kind] || '').map(row => ({ row, id: rowIdentity(kind, row) })).filter(item => item.id);
  }

  function installRowSelectors(kind) {
    visibleRows(kind).forEach(({ row, id }) => {
      if (kind === 'customer') {
        const legacy = row.querySelector('[data-fp-customer-check]');
        if (!legacy) return;
        legacy.dataset.internalSelect = 'customer';
        legacy.dataset.id = String(id);
        if (legacy.checked) selected.customer.add(String(id));
        else selected.customer.delete(String(id));
        row.dataset.fpCustomerId = String(id);
        return;
      }
      if (row.querySelector(`[data-internal-select="${kind}"]`)) return;
      const label = document.createElement('label');
      label.className = 'fp-internal-row-select';
      label.title = '选择这条资料进行批量整理';
      label.innerHTML = `<input type="checkbox" data-internal-select="${kind}" data-id="${esc(id)}" ${selected[kind].has(String(id)) ? 'checked' : ''}><span>选择</span>`;
      row.prepend(label);
      row.classList.add('fp-internal-selectable-row');
    });
    updateCount(kind);
  }

  function toolbarBase(kind, extra) {
    const labels = { customer: '客户', deal: '业务', document: '单据', product: '商品' };
    return `<section class="fp-internal-bulk-toolbar" data-internal-bulk-toolbar="${kind}">
      <div class="fp-internal-bulk-heading"><div><b>${labels[kind]}批量整理</b><span data-internal-selected-count="${kind}">0 项已选</span></div><div class="fp-internal-bulk-select-actions"><button type="button" data-internal-action="select-visible" data-kind="${kind}">选择当前结果</button><button type="button" data-internal-action="clear-selection" data-kind="${kind}">取消选择</button></div></div>
      ${extra}
    </section>`;
  }

  function customerToolbar() {
    return toolbarBase('customer', `<div class="fp-internal-bulk-fields">
      <label>业务阶段<select data-internal-field="customer-stage">${optionHtml(CUSTOMER_STAGES, '保持不变')}</select></label>
      <label>下次跟进<input type="date" data-internal-field="customer-followup"></label>
      <label>常用语言<select data-internal-field="customer-language">${optionHtml(LANGUAGES, '保持不变')}</select></label>
      <label>默认币种<select data-internal-field="customer-currency">${optionHtml(CURRENCIES, '保持不变')}</select></label>
      <button type="button" class="primary" data-internal-action="apply-customer">应用到所选客户</button>
      <button type="button" data-internal-action="batch-mail">生成邮件草稿</button>
      <button type="button" class="danger" data-internal-action="recycle" data-kind="customer">移入回收站</button>
    </div>`);
  }

  function dealToolbar() {
    return toolbarBase('deal', `<div class="fp-internal-bulk-fields">
      <label>业务阶段<select data-internal-field="deal-stage">${optionHtml(DEAL_STAGES, '保持不变')}</select></label>
      <label>下一步日期<input type="date" data-internal-field="deal-next-date"></label>
      <label class="wide">下一步动作<input data-internal-field="deal-next-action" placeholder="保持为空则不修改"></label>
      <button type="button" class="primary" data-internal-action="apply-deal">应用到所选业务</button>
      <button type="button" data-internal-action="complete-deal">标记已完成</button>
      <button type="button" class="danger" data-internal-action="recycle" data-kind="deal">移入回收站</button>
    </div>`);
  }

  function documentToolbar() {
    return toolbarBase('document', `<div class="fp-internal-bulk-fields">
      <label>单据状态<select data-internal-field="document-status">${optionHtml(DOC_STATUS, '保持不变')}</select></label>
      <button type="button" class="primary" data-internal-action="apply-document">更新所选状态</button>
      <button type="button" data-internal-action="export-documents">导出所选清单</button>
      <button type="button" class="danger" data-internal-action="recycle" data-kind="document">移入回收站</button>
    </div>`);
  }

  function productToolbar() {
    return toolbarBase('product', `<div class="fp-internal-bulk-fields">
      <label>商品分类<input data-internal-field="product-category" placeholder="保持为空则不修改"></label>
      <label>产品小类<input data-internal-field="product-subcategory" placeholder="保持为空则不修改"></label>
      <label>币种<select data-internal-field="product-currency">${optionHtml(CURRENCIES, '保持不变')}</select></label>
      <label>计价单位<input data-internal-field="product-unit" placeholder="例如：件 / PCS"></label>
      <button type="button" class="primary" data-internal-action="apply-product">应用到所选商品</button>
    </div>`);
  }

  function ensureToolbar(kind, sectionSelector, targetSelector, html) {
    const section = $(sectionSelector);
    const target = $(targetSelector, section || document);
    if (!section || !target || section.querySelector(`[data-internal-bulk-toolbar="${kind}"]`)) return;
    target.insertAdjacentHTML('beforebegin', html);
  }

  function installBulkToolbars() {
    ensureToolbar('customer', '#customers', '.table-wrap', customerToolbar());
    ensureToolbar('deal', '#deals', '#deal-list', dealToolbar());
    ensureToolbar('document', '#documents', '#doc-summary', documentToolbar());
    ensureToolbar('product', '#products', '#product-list', productToolbar());
    installRowSelectors('customer');
    installRowSelectors('deal');
    installRowSelectors('document');
    updateCount('product');
  }

  function completenessCounts(data) {
    const customers = data.customers || [];
    const products = data.products || [];
    const deals = data.deals || [];
    const docs = data.docs || [];
    const incompleteCustomers = customers.filter(row => {
      const identity = clean(row.company_name || row.name || row.contact_name);
      const contact = clean(row.email || row.phone || row.contact_name);
      return !identity || !contact || !clean(row.country);
    }).length;
    const incompleteProducts = products.filter(row => !clean(row.name) || !clean(row.sku) || !(Number(row.suggested_price) > 0) || !clean(row.specification) || !clean(row.image_url || row.primary_image_url || row.main_image_url)).length;
    const overdueDeals = deals.filter(row => !['completed', 'lost'].includes(row.stage) && (!row.next_action_at || String(row.next_action_at).slice(0, 10) <= today())).length;
    const draftDocuments = docs.filter(row => !row.status || row.status === 'draft').length;
    return { incompleteCustomers, incompleteProducts, overdueDeals, draftDocuments };
  }

  function installDashboardQuality() {
    const dashboard = $('#dashboard');
    const grid = dashboard?.querySelector('.dashboard-grid');
    if (!dashboard || !grid) return;
    let panel = $('#fp-internal-quality-panel');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'fp-internal-quality-panel';
      panel.className = 'panel fp-internal-quality-panel';
      grid.insertAdjacentElement('afterend', panel);
    }
    const counts = completenessCounts(state() || {});
    const html = `<div class="panel-head"><div><p>资料与流程检查</p><h2>需要整理的内容</h2></div></div>
      <div class="fp-internal-quality-grid">
        <button type="button" data-internal-jump="customers"><small>客户资料待补</small><b>${counts.incompleteCustomers}</b><span>公司、联系人、国家或联系方式</span></button>
        <button type="button" data-internal-jump="products"><small>商品资料待补</small><b>${counts.incompleteProducts}</b><span>SKU、图片、价格、规格等</span></button>
        <button type="button" data-internal-jump="deals"><small>业务待安排</small><b>${counts.overdueDeals}</b><span>逾期或尚未安排下一步</span></button>
        <button type="button" data-internal-jump="documents"><small>单据草稿</small><b>${counts.draftDocuments}</b><span>继续检查、保存或导出</span></button>
      </div>`;
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  function installOrderExecutionFilter() {
    const quick = $('#deals .quick-filters');
    if (!quick || quick.querySelector('[data-deal-quick="order"]')) return;
    const all = quick.querySelector('[data-deal-quick="all"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dealQuick = 'order';
    button.textContent = '订单执行';
    quick.insertBefore(button, all || null);
  }

  function installTemplateManager() {
    const section = $('#templates');
    const mount = $('#template-list');
    if (!section || !mount) return;
    let panel = $('#fp-internal-template-manager');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'fp-internal-template-manager';
      panel.className = 'fp-internal-template-manager';
      mount.insertAdjacentElement('afterend', panel);
    }
    const templates = (state()?.templates || []).filter(row => !row.deleted_at).slice().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    const html = `<div class="fp-internal-template-head"><div><b>我的常用模板</b><span>可直接编辑、复制或移入回收站，不影响公开模板。</span></div><button type="button" data-internal-action="new-template">新增私有模板</button></div>
      <div class="fp-internal-template-list">${templates.length ? templates.map(row => `<article><div><b>${esc(row.title || '未命名模板')}</b><small>${esc(row.kind || '业务模板')} · ${esc(row.description || '暂无使用说明')}</small></div><div><button type="button" data-internal-action="edit-template" data-id="${esc(row.id)}">编辑</button><button type="button" data-internal-action="duplicate-template" data-id="${esc(row.id)}">复制</button><button type="button" class="danger" data-internal-action="recycle-template" data-id="${esc(row.id)}">回收站</button></div></article>`).join('') : '<div class="fp-internal-empty">还没有私有模板，可以先新增一个常用报价、PI、邮件或跟进模板。</div>'}</div>`;
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  function installCatalogSummary() {
    const root = $('#catalog-center-view');
    if (!root) return;
    const projects = state()?.catalogProjects || [];
    let panel = $('#fp-internal-catalog-summary');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'fp-internal-catalog-summary';
      panel.className = 'fp-internal-catalog-summary';
      root.prepend(panel);
    }
    const html = `<div><b>目录制作准备</b><span>当前保存 ${projects.length} 个目录项目。商品资料完善后，可直接进入目录制作。</span></div><div><button type="button" data-internal-jump="products">整理商品资料</button></div>`;
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  function installBrandSummary() {
    const section = $('#brands');
    const list = $('#brand-list');
    if (!section || !list) return;
    let panel = $('#fp-internal-brand-summary');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'fp-internal-brand-summary';
      panel.className = 'fp-internal-brand-summary';
      list.insertAdjacentElement('beforebegin', panel);
    }
    const brands = state()?.brands || [];
    const incomplete = brands.filter(row => !clean(row.company_name_en) || !clean(row.email) || !clean(row.address) || !clean(row.website)).length;
    const defaults = brands.filter(row => row.is_default).length;
    const html = `<div><b>出单主体检查</b><span>共 ${brands.length} 个品牌档案 · ${incomplete} 个资料待补 · ${defaults || 0} 个默认品牌</span></div>`;
    if (panel.innerHTML !== html) panel.innerHTML = html;
  }

  function installMailDraftSummary() {
    const root = $('#mail-center-view');
    if (!root || $('#fp-internal-mail-summary')) return;
    const panel = document.createElement('section');
    panel.id = 'fp-internal-mail-summary';
    panel.className = 'fp-internal-mail-summary';
    panel.innerHTML = `<div><b>邮件草稿只保存在工作台</b><span>可以先整理主题、正文、客户和品牌署名；真正发送仍由你在邮箱中确认。</span></div>`;
    root.prepend(panel);
  }

  function syncSelectionState() {
    const data = state() || {};
    const available = {
      customer: new Set((data.customers || []).map(row => String(row.id))),
      deal: new Set((data.deals || []).map(row => String(row.id))),
      document: new Set((data.docs || []).map(row => String(row.id)))
    };
    Object.entries(available).forEach(([kind, ids]) => {
      [...selected[kind]].forEach(id => { if (!ids.has(String(id))) selected[kind].delete(String(id)); });
    });
  }

  function installAll() {
    if (applying) return;
    applying = true;
    try {
      syncSelectionState();
      installBulkToolbars();
      installDashboardQuality();
      installOrderExecutionFilter();
      installTemplateManager();
      installCatalogSummary();
      installBrandSummary();
      installMailDraftSummary();
    } finally {
      applying = false;
    }
  }

  async function updateRows(table, ids, patch, successMessage) {
    const sb = client();
    const user = currentUser();
    if (!sb || !user || !ids.length) { toast('请先登录后再批量整理。', true); return false; }
    const { error } = await sb.from(table).update(patch).in('id', ids).eq('user_id', user.id);
    if (error) { toast(error.message || '批量更新失败，请稍后重试。', true); return false; }
    toast(successMessage);
    await api()?.refresh?.();
    installAll();
    return true;
  }

  function selectedOrWarn(kind) {
    const ids = activeIds(kind);
    if (!ids.length) toast('请先选择需要整理的资料。', true);
    return ids;
  }

  function collectPatch(definitions) {
    const patch = {};
    definitions.forEach(([selector, key, transform]) => {
      const value = clean($(selector)?.value);
      if (value) patch[key] = transform ? transform(value) : value;
    });
    return patch;
  }

  async function applyCustomer() {
    const ids = selectedOrWarn('customer'); if (!ids.length) return;
    const patch = collectPatch([
      ['[data-internal-field="customer-stage"]', 'customer_stage'],
      ['[data-internal-field="customer-followup"]', 'next_follow_up_at'],
      ['[data-internal-field="customer-language"]', 'preferred_language'],
      ['[data-internal-field="customer-currency"]', 'currency']
    ]);
    if (!Object.keys(patch).length) return toast('请选择至少一项需要修改的客户资料。', true);
    if (!confirm(`确定更新 ${ids.length} 个客户的所选字段吗？未选择的字段不会改变。`)) return;
    if (await updateRows('customer_records', ids, patch, `已更新 ${ids.length} 个客户。`)) { selected.customer.clear(); installAll(); }
  }

  async function applyDeal(forceCompleted = false) {
    const ids = selectedOrWarn('deal'); if (!ids.length) return;
    const patch = forceCompleted ? { stage: 'completed' } : collectPatch([
      ['[data-internal-field="deal-stage"]', 'stage'],
      ['[data-internal-field="deal-next-date"]', 'next_action_at'],
      ['[data-internal-field="deal-next-action"]', 'next_action']
    ]);
    if (!Object.keys(patch).length) return toast('请选择业务阶段、日期或填写下一步动作。', true);
    if (!confirm(`确定更新 ${ids.length} 笔业务吗？`)) return;
    if (await updateRows('business_deals', ids, patch, `已更新 ${ids.length} 笔业务。`)) { selected.deal.clear(); installAll(); }
  }

  async function applyDocument() {
    const ids = selectedOrWarn('document'); if (!ids.length) return;
    const status = clean($('[data-internal-field="document-status"]')?.value);
    if (!status) return toast('请选择需要设置的单据状态。', true);
    if (!confirm(`确定将 ${ids.length} 份单据更新为“${DOC_STATUS[status] || status}”吗？`)) return;
    if (await updateRows('documents', ids, { status }, `已更新 ${ids.length} 份单据状态。`)) { selected.document.clear(); installAll(); }
  }

  async function applyProduct() {
    const ids = selectedOrWarn('product'); if (!ids.length) return;
    const patch = collectPatch([
      ['[data-internal-field="product-category"]', 'category'],
      ['[data-internal-field="product-subcategory"]', 'subcategory'],
      ['[data-internal-field="product-currency"]', 'currency'],
      ['[data-internal-field="product-unit"]', 'pricing_unit']
    ]);
    if (!Object.keys(patch).length) return toast('请填写至少一项需要修改的商品字段。', true);
    if (!confirm(`确定更新 ${ids.length} 个商品的所选字段吗？未填写的字段不会改变。`)) return;
    await updateRows('product_records', ids, patch, `已更新 ${ids.length} 个商品。`);
  }

  async function recycle(kind) {
    const ids = selectedOrWarn(kind); if (!ids.length) return;
    const tables = { customer: 'customer_records', deal: 'business_deals', document: 'documents' };
    if (!tables[kind]) return;
    if (!confirm(`确定将所选 ${ids.length} 条资料移入回收站吗？之后仍可恢复。`)) return;
    if (await updateRows(tables[kind], ids, { deleted_at: new Date().toISOString() }, `已将 ${ids.length} 条资料移入回收站。`)) { selected[kind].clear(); installAll(); }
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportDocuments() {
    const ids = selectedOrWarn('document'); if (!ids.length) return;
    const rows = (state()?.docs || []).filter(row => ids.includes(String(row.id)));
    const lines = [['单据名称', '单据类型', '单据编号', '客户', '状态', '最后更新']];
    rows.forEach(row => {
      const payload = row.payload || {};
      const fields = payload.fields || {};
      lines.push([
        row.title || fields.documentTitle || '',
        row.document_type || fields.documentType || '',
        row.document_no || row.doc_no || fields.documentNo || '',
        row.customer_name || fields.buyerCompany || '',
        DOC_STATUS[row.status] || row.status || '草稿',
        row.updated_at || ''
      ]);
    });
    const blob = new Blob(['\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `HUIDI_单据清单_${today()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
    toast(`已导出 ${rows.length} 份单据清单。`);
  }

  async function duplicateTemplate(id) {
    const template = (state()?.templates || []).find(row => String(row.id) === String(id));
    const sb = client(); const user = currentUser();
    if (!template || !sb || !user) return toast('未找到模板或当前未登录。', true);
    const payload = {
      user_id: user.id,
      title: `${template.title || '未命名模板'} 副本`,
      kind: template.kind || 'quotation',
      scope: 'private',
      description: template.description || '',
      payload: template.payload || {}
    };
    const { error } = await sb.from('workspace_templates').insert(payload);
    if (error) return toast(error.message || '复制模板失败。', true);
    toast('已复制模板。');
    await api()?.refresh?.();
  }

  async function recycleTemplate(id) {
    if (!confirm('确定将这个私有模板移入回收站吗？')) return;
    await updateRows('workspace_templates', [id], { deleted_at: new Date().toISOString() }, '模板已移入回收站。');
  }

  function selectVisible(kind) {
    if (kind === 'product') {
      const existing = $('#product-list [data-action="select-visible-products"]');
      if (existing) existing.click();
      return setTimeout(() => updateCount(kind), 0);
    }
    visibleRows(kind).forEach(({ id, row }) => {
      selected[kind].add(String(id));
      const input = row.querySelector(`[data-internal-select="${kind}"]`);
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    updateCount(kind);
  }

  function clearSelection(kind) {
    if (kind === 'product') {
      const existing = $('#product-list [data-action="clear-product-selection"]');
      if (existing) existing.click();
      return setTimeout(() => updateCount(kind), 0);
    }
    selected[kind].clear();
    $$(`[data-internal-select="${kind}"]`).forEach(input => {
      if (!input.checked) return;
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    updateCount(kind);
  }

  document.addEventListener('change', event => {
    const input = event.target.closest('[data-internal-select]');
    if (input) {
      const kind = input.dataset.internalSelect;
      const id = String(input.dataset.id || '');
      if (input.checked) selected[kind]?.add(id); else selected[kind]?.delete(id);
      updateCount(kind);
      return;
    }
    if (event.target.matches('[data-product-select]')) updateCount('product');
  });

  document.addEventListener('click', async event => {
    const jump = event.target.closest('[data-internal-jump]');
    if (jump) {
      const view = jump.dataset.internalJump;
      api()?.handleNav?.(view);
      if (view === 'customers') document.querySelector('[data-customer-quick="incomplete"]')?.click();
      if (view === 'products') document.querySelector('[data-action="product-quick"][data-product-quick="all"]')?.click();
      return;
    }
    const actionNode = event.target.closest('[data-internal-action]');
    if (!actionNode) return;
    const action = actionNode.dataset.internalAction;
    const kind = actionNode.dataset.kind;
    if (action === 'select-visible') return selectVisible(kind);
    if (action === 'clear-selection') return clearSelection(kind);
    if (action === 'apply-customer') return applyCustomer();
    if (action === 'batch-mail') { const legacy = document.querySelector('[data-fp-batch-mail]'); return legacy ? legacy.click() : toast('邮件草稿功能尚未准备完成，请稍后重试。', true); }
    if (action === 'apply-deal') return applyDeal(false);
    if (action === 'complete-deal') return applyDeal(true);
    if (action === 'apply-document') return applyDocument();
    if (action === 'apply-product') return applyProduct();
    if (action === 'recycle') return recycle(kind);
    if (action === 'export-documents') return exportDocuments();
    if (action === 'new-template') return api()?.openRecord?.('template');
    if (action === 'edit-template') {
      const row = (state()?.templates || []).find(item => String(item.id) === String(actionNode.dataset.id));
      return row ? api()?.openRecord?.('template', row) : toast('未找到模板。', true);
    }
    if (action === 'duplicate-template') return duplicateTemplate(actionNode.dataset.id);
    if (action === 'recycle-template') return recycleTemplate(actionNode.dataset.id);
  });

  document.addEventListener('HUIDI:workspace-rendered', installAll);
  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(installAll, 80);
  });

  function start() {
    if (!api()) return setTimeout(start, 80);
    observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    installAll();
    window.FlypigBOXInternalCoreClosure = Object.freeze({ version: VERSION, installAll, selected });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
