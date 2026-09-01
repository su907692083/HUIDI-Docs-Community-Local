(() => {
  'use strict';

  const VERSION = 'R1.3A.18.24.2';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  let applying = false;

  const EXACT_TEXT = new Map([
    ['ORDER CENTER', ''],
    ['MY FEISHU DATA', ''],
    ['VIP未开通', '暂未连接'],
    ['免费体验版，未开通飞书同步', '暂未连接飞书'],
    ['飞书授权没有响应', '暂未连接飞书'],
    ['智能服务可用', '增强整理可用'],
    ['检查服务', '刷新状态'],
    ['开始智能处理', '开始整理'],
    ['尚未开始智能处理', '尚未开始整理'],
    ['Ultimate Vault', '高级模板库'],
    ['VIP 行业知识库', '行业资料库'],
    ['PDF 样式与品牌 · VIP', '高级PDF样式与品牌'],
    ['已与单据编辑器同步', '可在单据编辑器中使用'],
    ['加入业务', '用于开单'],
    ['0 份文件', '0 份单据'],
    ['还没有业务文件。', '还没有单据。'],
    ['暂无业务文件。', '暂无单据。'],
    ['开始制作目录', '制作新目录'],
    ['上传产品表制作', '导入产品表制作'],
    ['从商品资料库选择', '从商品资料库制作']
  ]);

  const COUNTRY_NAMES = new Map([
    ['US', 'United States'], ['USA', 'United States'], ['CN', 'China'], ['GB', 'United Kingdom'],
    ['UK', 'United Kingdom'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['JP', 'Japan'],
    ['KR', 'South Korea'], ['AU', 'Australia'], ['CA', 'Canada'], ['AE', 'United Arab Emirates']
  ]);

  function replaceExactText(root = document) {
    $$('p,small,span,b,strong,h2,h3,h4,button,summary,em', root).forEach(node => {
      if (node.children.length) return;
      const text = clean(node.textContent);
      if (!text) return;
      if (EXACT_TEXT.has(text)) {
        const next = EXACT_TEXT.get(text);
        if (!next) node.hidden = true;
        else node.textContent = next;
      }
      if (/^智能服务可用(?:\s*·\s*\d+项增强功能)?$/.test(text)) node.textContent = '增强整理可用';
      if (/^浏览器导出可用[；;].*等待连接$/.test(text)) node.hidden = true;
    });
  }

  function routeKey(node) {
    if (!node) return '';
    if (node.dataset?.action) return `action:${node.dataset.action}`;
    if (node.dataset?.view) return `view:${node.dataset.view}`;
    if (node.dataset?.sidecarAction) return `sidecar:${node.dataset.sidecarAction}`;
    if (node.matches?.('a[href]')) return `href:${node.getAttribute('href')}`;
    const text = clean(node.textContent);
    if (!text || ['查看', '更多', '取消', '保存', '编辑', '详情'].includes(text)) return '';
    return `text:${text}`;
  }

  function dedupeViewActions() {
    const active = $('.view.active');
    if (!active) return;
    const seen = new Set();
    $$('.topbar-actions [data-action],.topbar-actions [data-view],.topbar-actions [data-sidecar-action],.topbar-actions a[href]').forEach(node => {
      const key = routeKey(node); if (key) seen.add(key);
    });
    const candidates = $$([
      '.fp-xm-journey-actions > *',
      '.section-head .actions > *',
      '[data-fp-empty-state] button',
      '[data-fp-empty-state] a',
      '.empty-actions button',
      '.empty-actions a',
      '.fp-sidecar-empty button',
      '.fp-internal-catalog-summary button',
      '.fp-internal-catalog-summary a',
      '.fp-internal-mail-summary button'
    ].join(','), active);
    candidates.forEach(node => {
      const key = routeKey(node);
      if (!key) return;
      if (seen.has(key)) {
        node.hidden = true;
        node.dataset.fpCleanupHidden = '1';
      } else seen.add(key);
    });
    $$('.fp-xm-journey-actions', active).forEach(box => {
      box.hidden = ![...box.children].some(node => !node.hidden);
    });
  }

  function normalizeBulkPanels() {
    $('#fp-customer-batch-bar')?.setAttribute('hidden', '');
    $$('.fp-internal-bulk-toolbar').forEach(toolbar => {
      const count = toolbar.querySelector('[data-internal-selected-count]');
      const selected = toolbar.classList.contains('has-selection');
      const kind = toolbar.dataset.internalBulkToolbar || '';
      toolbar.dataset.selection = selected ? 'active' : 'empty';
      if (count && !selected) {
        const labels = { customer: '尚未选择客户', deal: '尚未选择业务', document: '尚未选择单据', product: '尚未选择商品' };
        const next = labels[kind] || '尚未选择资料';
        if (clean(count.textContent) !== next) count.textContent = next;
      }
    });
  }

  function externalInlineActionsAllowed() {
    return Boolean(window.FlypigBOXFeishuBusinessWorkspace?.getStatus?.()?.connected);
  }

  function removeUnavailableExternalActions(root = document) {
    if (externalInlineActionsAllowed()) return;
    $$('[data-sidecar-action="sync-feishu"]', root).forEach(node => node.remove());
  }

  function normalizeCustomerRows() {
    $$('#customer-list .table-row').forEach(row => {
      const legacy = row.querySelector('[data-fp-customer-check]');
      const duplicate = row.querySelector(':scope > .fp-internal-row-select');
      if (legacy) {
        const id = legacy.dataset.fpCustomerCheck || row.querySelector('[data-open-customer]')?.dataset.openCustomer || '';
        legacy.dataset.internalSelect = 'customer';
        legacy.dataset.id = String(id);
        duplicate?.remove();
        row.classList.remove('fp-internal-selectable-row');
      }

      const first = row.firstElementChild;
      const stageCell = row.children[3];
      const firstSmall = first?.querySelector(':scope > small');
      const stageBadge = stageCell?.querySelector('.badge');
      if (firstSmall && stageBadge && clean(firstSmall.textContent) === clean(stageBadge.textContent)) firstSmall.remove();

      const actions = row.querySelector('.row-actions');
      if (actions) actions.setAttribute('aria-label', '客户操作');
    });
  }

  function closeRowMenus(except = null) {
    $$('.fp-row-more-actions[open]').forEach(details => {
      if (details !== except) details.removeAttribute('open');
    });
  }

  function positionRowMenu(details) {
    if (!details?.open) return;
    const summary = details.querySelector('summary');
    const menu = details.querySelector(':scope > div');
    if (!summary || !menu) return;
    const rect = summary.getBoundingClientRect();
    const width = Math.max(150, menu.offsetWidth || 150);
    const estimatedHeight = Math.max(90, menu.offsetHeight || 90);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - 12) top = Math.max(12, rect.top - estimatedHeight - 6);
    details.style.setProperty('--fp-menu-left', `${Math.round(left)}px`);
    details.style.setProperty('--fp-menu-top', `${Math.round(top)}px`);
  }

  function compactRowActions() {
    $$('.row-actions,.card-actions,.fp-order-actions').forEach(container => {
      if (container.dataset.fpActionsCompacted === '1') return;
      const direct = [...container.children].filter(node => node.matches?.('button,a'));
      if (direct.length < 3 || direct.some(node => clean(node.textContent) === '更多')) return;
      const preferred = direct.find(node => /查看|详情|编辑/.test(clean(node.textContent))) || direct[0];
      const rest = direct.filter(node => node !== preferred);
      if (!rest.length) return;
      const details = document.createElement('details');
      details.className = 'fp-row-more-actions';
      details.innerHTML = '<summary aria-haspopup="menu">更多</summary><div role="menu"></div>';
      const box = details.querySelector('div');
      rest.forEach(node => box.appendChild(node));
      container.appendChild(details);
      container.dataset.fpActionsCompacted = '1';
    });
  }

  function normalizeCustomerFilters() {
    const button = $('[data-action="toggle-customer-filter"]');
    const drawer = $('#customer-filter-drawer');
    if (!button || !drawer) return;
    const wanted = drawer.hidden ? '更多筛选' : '收起筛选';
    if (clean(button.textContent) !== wanted) button.textContent = wanted;
    if (!drawer.dataset.fpCleanupReady) {
      drawer.hidden = true;
      drawer.dataset.fpCleanupReady = '1';
      if (clean(button.textContent) !== '更多筛选') button.textContent = '更多筛选';
      button.addEventListener('click', () => setTimeout(() => { const next = drawer.hidden ? '更多筛选' : '收起筛选'; if (clean(button.textContent) !== next) button.textContent = next; }, 0));
    }
  }

  function normalizeDashboard() {
    const duplicated = $('#overview-incomplete-products')?.closest('article');
    if (duplicated && $('#fp-internal-quality-panel')) duplicated.hidden = true;
  }

  function normalizeOrderCenter() {
    const root = $('#fp-order-center');
    if (!root) return;
    $$('.fp-sidecar-hero p', root).forEach(node => { if (clean(node.textContent) === 'ORDER CENTER') node.hidden = true; });
    $$('.fp-sidecar-hero h2', root).forEach(node => { if (clean(node.textContent) === '订单中心') node.textContent = '订单执行概览'; });
    $$('.fp-sidecar-card strong', root).forEach(node => { if (clean(node.textContent) === '—') node.textContent = '暂无订单'; });
  }

  function normalizeProductCards() {
    $$('#product-list .product-status-line').forEach(line => {
      const seen = new Set();
      [...line.children].forEach(node => {
        const text = clean(node.textContent).replace('待补图', '缺少图片').replace('图片缺失', '缺少图片');
        if (['缺少图片', '缺少价格'].includes(text)) {
          node.textContent = text;
          if (seen.has(text)) node.remove(); else seen.add(text);
        }
      });
    });
  }

  function normalizeCountryCodes() {
    $$('#customer-list .table-row').forEach(row => {
      $$('b,span,small', row).forEach(node => {
        if (node.children.length) return;
        const text = clean(node.textContent);
        if (COUNTRY_NAMES.has(text)) node.textContent = COUNTRY_NAMES.get(text);
      });
    });
  }

  function addTemplatePreviews() {
    $$('#templates .template-unified-grid > button').forEach((button, index) => {
      if (button.querySelector('.fp-template-mini-preview')) return;
      const preview = document.createElement('span');
      preview.className = `fp-template-mini-preview variant-${(index % 3) + 1}`;
      preview.setAttribute('aria-hidden', 'true');
      preview.innerHTML = '<i></i><i></i><i></i><i></i>';
      button.prepend(preview);
    });
  }

  function normalizeFeishuPage() {
    const root = $('#fp-feishu-center') || $('#feishu-workspace-center');
    if (!root) return;
    $$('p', root).forEach(node => { if (['MY FEISHU DATA'].includes(clean(node.textContent))) node.hidden = true; });
    $$('button', root).forEach(node => { if (clean(node.textContent) === '检查服务') node.textContent = '刷新状态'; });
    $$('em,small,span,h3,b', root).forEach(node => {
      if (node.children.length) return;
      const text = clean(node.textContent);
      if (/VIP未开通|免费体验版，未开通飞书同步|飞书授权没有响应/.test(text)) node.textContent = '暂未连接飞书';
    });
  }

  function normalizeAIPage() {
    const root = $('#ai');
    if (!root) return;
    $('[data-os-panel-connect]', root)?.setAttribute('hidden', '');
    $('[data-os-panel-sample]', root)?.setAttribute('hidden', '');
    $$('.fp-os-task-type', root).forEach(label => {
      const input = label.querySelector('input');
      if (input?.disabled) label.classList.add('is-waiting');
    });
    const badge = $('.fp-os-task-connection small', root);
    if (badge && /智能服务|增强功能|未配置|未启用|未开通|尚未检查/.test(clean(badge.textContent))) badge.textContent = '增强整理等待连接';
    $$('#nav button,[data-view="ai"] .nav-badge', document).forEach(node => {
      if (clean(node.textContent) === 'AI') node.hidden = true;
    });
  }

  function normalizeEmptyStates() {
    $$('.empty,.fp-xm-empty,.fp-sidecar-empty').forEach(node => node.classList.add('fp-compact-empty'));
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      document.body.classList.add('fp-internal-page-cleanup');
      $('#fp-xm-status-legend')?.remove();
      $('#fpRuntimeWorkspaceStatus')?.remove();
      replaceExactText();
      normalizeBulkPanels();
      normalizeCustomerFilters();
      normalizeDashboard();
      normalizeOrderCenter();
      normalizeProductCards();
      normalizeCountryCodes();
      removeUnavailableExternalActions();
      normalizeCustomerRows();
      normalizeFeishuPage();
      normalizeAIPage();
      normalizeEmptyStates();
      addTemplatePreviews();
      compactRowActions();
      $$('.fp-row-more-actions[open]').forEach(positionRowMenu);
      dedupeViewActions();
    } finally { applying = false; }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(apply, 70);
  });

  function start() {
    observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    document.addEventListener('HUIDI:workspace-rendered', apply);
    document.addEventListener('toggle', event => {
      const details = event.target.closest?.('.fp-row-more-actions');
      if (!details) return;
      if (details.open) {
        closeRowMenus(details);
        requestAnimationFrame(() => positionRowMenu(details));
      }
    }, true);
    document.addEventListener('click', event => {
      if (!event.target.closest('.fp-row-more-actions')) closeRowMenus();
      setTimeout(apply, 30);
    });
    document.addEventListener('change', () => setTimeout(apply, 30));
    window.addEventListener('scroll', () => closeRowMenus(), true);
    window.addEventListener('resize', () => closeRowMenus());
    apply();
    window.FlypigBOXInternalPageCleanup = Object.freeze({ version: VERSION, apply });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
