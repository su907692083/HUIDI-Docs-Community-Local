(() => {
  'use strict';
  const VERSION = 'V3.3.6.24-R1.3A.18.24.1-CROSS-MODULE-CLEANUP';
  if (window.FlypigBOXCrossModuleExperience?.version === VERSION) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const LAST_KEY = 'flypigbox_cross_module_last_action_v1';
  const PAGE_KEY = 'flypigbox_cross_module_last_page_v1';
  const VIEW_LABELS = {
    dashboard: '工作台首页', deals: '业务中心', orders: '订单中心', customers: '客户中心',
    products: '商品资料库', catalog: '产品目录', documents: '单据中心', brands: '品牌中心',
    templates: '模板中心', recycle: '回收站', mail: '邮件草稿', feishu: '飞书资料', ai: '智能录入', guide: '使用说明'
  };
  const MODULES = {
    deals: {
      title: '从询盘继续推进', copy: '先确认客户和商品，再推进报价、订单、回款和交付。',
      actions: [
        { label: '记录新询盘', action: 'new-deal', primary: true },
        { label: '确认订单', sidecar: 'new-order' },
        { label: '新建单据', action: 'new-doc' },
        { label: '查看客户', view: 'customers' }
      ]
    },
    orders: {
      title: '让订单成为后续工作的中心', copy: '从已确认询盘建立订单，再关联单据、回款和交付。',
      actions: [
        { label: '从询盘确认订单', sidecar: 'new-order', primary: true },
        { label: '返回业务中心', view: 'deals' },
        { label: '查看单据', view: 'documents' }
      ]
    },
    customers: {
      title: '客户资料准备好后继续业务', copy: '新增或导入客户后，可以直接记录询盘、创建报价或准备邮件。',
      actions: [
        { label: '新增客户', action: 'new-customer', primary: true },
        { label: '导入客户', action: 'import-customers' },
        { label: '记录询盘', action: 'new-deal' },
        { label: '生成邮件草稿', action: 'open-email' }
      ]
    },
    products: {
      title: '商品资料准备好后立即使用', copy: '新增或导入商品后，可以进入报价、产品目录或继续补图片和规格。',
      actions: [
        { label: '添加商品', action: 'new-product', primary: true },
        { label: '导入商品表', action: 'import-products' },
        { label: '制作产品目录', href: './catalog-studio/index.html' },
        { label: '新建单据', action: 'new-doc' }
      ]
    },
    catalog: {
      title: '从商品库快速制作客户目录', copy: '选择商品、客户、价格策略和版式，再进入目录制作页面确认。',
      actions: [
        { label: '开始制作目录', href: './catalog-studio/index.html', primary: true },
        { label: '查看商品资料', view: 'products' },
        { label: '准备目录邮件', view: 'mail' }
      ]
    },
    documents: {
      title: '单据保存后继续下一步', copy: '从同一业务继续创建PI、合同、CI或PL，并保留人工确认。',
      actions: [
        { label: '新建单据', action: 'new-doc', primary: true },
        { label: '查看草稿', action: 'show-doc-drafts' },
        { label: '返回订单', view: 'orders' },
        { label: '准备发送邮件', view: 'mail' }
      ]
    },
    brands: {
      title: '统一卖方身份与正式文件资料', copy: '先维护公司、品牌、收款和联系资料，再用于模板、单据和产品目录。',
      actions: [
        { label: '新增品牌资料', action: 'new-brand', primary: true },
        { label: '管理模板', view: 'templates' },
        { label: '新建单据', action: 'new-doc' }
      ]
    },
    templates: {
      title: '模板只负责版式和允许显示的字段', copy: '先确认品牌和字段规则，再用模板创建单据；历史单据不会被自动覆盖。',
      actions: [
        { label: '新建单据', action: 'new-doc', primary: true },
        { label: '查看品牌资料', view: 'brands' },
        { label: '查看单据中心', view: 'documents' }
      ]
    },
    recycle: {
      title: '恢复前先检查引用关系', copy: '回收站只处理已删除资料；被单据或业务引用的资料应谨慎恢复或保留。',
      actions: [
        { label: '刷新回收站', action: 'load-recycle', primary: true },
        { label: '查看客户', view: 'customers' },
        { label: '查看商品', view: 'products' }
      ]
    },
    mail: {
      title: '先准备草稿，再到常用邮箱发送', copy: '客户、单据和产品目录可以用于准备邮件；外部发送状态仍需人工确认。',
      actions: [
        { label: '生成邮件草稿', action: 'compose-mail', primary: true },
        { label: '选择客户', view: 'customers' },
        { label: '查看单据', view: 'documents' },
        { label: '查看产品目录', view: 'catalog' }
      ]
    },
    feishu: {
      title: '飞书是协作副本，不替代正式业务资料', copy: '连接后可查看索引和归档状态；未连接时不影响网页端客户、商品和单据。',
      actions: [
        { label: '检查飞书连接', sidecar: 'refresh-feishu', primary: true },
        { label: '重新授权', sidecar: 'connect-feishu' },
        { label: '查看客户', view: 'customers' },
        { label: '查看单据', view: 'documents' }
      ]
    },
    ai: {
      title: '普通资料直接整理', copy: '复杂内容会自动选择合适的处理方式，保存前仍由你确认。',
      actions: [
        { label: '开始新的处理', selector: '#fp-smart-processing-panel-host textarea', primary: true },
        { label: '查看客户', view: 'customers' },
        { label: '查看商品', view: 'products' },
        { label: '新建单据', action: 'new-doc' }
      ]
    }
  };
  const EMPTY = {
    'deal-list': ['还没有业务记录', '先记录一条询盘，再继续报价和跟进。', { label: '记录新询盘', action: 'new-deal' }],
    'document-list': ['还没有单据', '从客户、商品或业务开始创建第一张单据。', { label: '新建单据', action: 'new-doc' }],
    'customer-list': ['还没有客户资料', '可以手工新增，也可以导入自己的Excel表格。', { label: '导入客户', action: 'import-customers' }],
    'product-list': ['还没有商品资料', '可以手工添加，也可以导入供应商或自己整理的商品表。', { label: '导入商品表', action: 'import-products' }],
    'brand-list': ['还没有品牌资料', '先维护公司、联系和收款资料，后续单据可直接复用。', { label: '新增品牌资料', action: 'new-brand' }],
    'recycle-list': ['回收站为空', '当前没有可恢复的客户、商品、业务或单据。', { label: '刷新', action: 'load-recycle' }]
  };

  function safeRead(key, fallback = null) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function safeWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function pageType() {
    if (document.body.classList.contains('doc-start-page')) return 'document_start';
    if (document.body.classList.contains('editor-premium-page')) return 'editor';
    if (/catalog-studio/i.test(location.pathname)) return 'catalog';
    if ($('#nav') && $('.app-shell')) return 'workspace';
    return 'other';
  }
  function makeButton(item) {
    const el = item.href ? document.createElement('a') : document.createElement('button');
    if (item.href) el.href = item.href; else el.type = 'button';
    el.className = item.primary ? 'fp-xm-primary' : 'fp-xm-secondary';
    el.textContent = item.label;
    if (item.view) el.dataset.view = item.view;
    if (item.action) el.dataset.action = item.action;
    if (item.sidecar) el.dataset.sidecarAction = item.sidecar;
    if (item.selector) el.dataset.fpFocus = item.selector;
    return el;
  }
  function remember(label, detail = {}) {
    const data = { label: clean(label) || '继续处理', at: Date.now(), path: location.pathname, ...detail };
    safeWrite(LAST_KEY, data);
  }
  function recordClick(event) {
    const target = event.target.closest('[data-view],[data-action],[data-sidecar-action],a[href]');
    if (!target || target.closest('[data-fp-no-remember]')) return;
    const label = clean(target.textContent) || clean(target.getAttribute('aria-label'));
    if (!label) return;
    const detail = {};
    if (target.dataset.view) detail.view = target.dataset.view;
    if (target.dataset.action) detail.action = target.dataset.action;
    if (target.dataset.sidecarAction) detail.sidecar = target.dataset.sidecarAction;
    if (target.tagName === 'A') detail.href = target.getAttribute('href');
    remember(label, detail);
  }
  function clickRoute(route) {
    if (!route) return;
    if (route.href) { location.href = route.href; return; }
    if (route.view) { document.querySelector(`[data-view="${CSS.escape(route.view)}"]`)?.click(); return; }
    if (route.action) { document.querySelector(`[data-action="${CSS.escape(route.action)}"]`)?.click(); return; }
    if (route.sidecar) { document.querySelector(`[data-sidecar-action="${CSS.escape(route.sidecar)}"]`)?.click(); }
  }

  function mountWorkspaceJourney(view) {
    const section = document.getElementById(view);
    const cfg = MODULES[view];
    if (!section || !cfg || section.querySelector(':scope > .fp-xm-journey')) return;
    const bar = document.createElement('section');
    bar.className = 'fp-xm-journey';
    bar.dataset.fpModule = view;
    bar.innerHTML = `<div class="fp-xm-journey-copy"><small>当前板块建议</small><b>${cfg.title}</b><span>${cfg.copy}</span></div><div class="fp-xm-journey-actions"></div>`;
    const actions = $('.fp-xm-journey-actions', bar);
    const routeKey = item => item.action ? `action:${item.action}` : item.view ? `view:${item.view}` : item.sidecar ? `sidecar:${item.sidecar}` : item.href ? `href:${item.href}` : item.selector ? `focus:${item.selector}` : `label:${item.label}`;
    const existing = new Set(Array.from(document.querySelectorAll('.topbar-actions [data-action],.topbar-actions [data-view],.topbar-actions [data-sidecar-action],.topbar-actions a[href]')).map(node => node.dataset.action ? `action:${node.dataset.action}` : node.dataset.view ? `view:${node.dataset.view}` : node.dataset.sidecarAction ? `sidecar:${node.dataset.sidecarAction}` : node.getAttribute('href') ? `href:${node.getAttribute('href')}` : ''));
    cfg.actions.filter(item => !existing.has(routeKey(item))).slice(0, 2).forEach(item => actions.appendChild(makeButton(item)));
    if (!actions.children.length) actions.remove();
    const head = section.querySelector(':scope > .section-head');
    if (head) head.insertAdjacentElement('afterend', bar); else section.prepend(bar);
  }
  function mountAllWorkspaceJourneys() { Object.keys(MODULES).forEach(mountWorkspaceJourney); }
  function mountContinueCard() {
    const home = $('.home-quick-start');
    if (!home || $('#fp-xm-continue-card')) return;
    const last = safeRead(LAST_KEY, null);
    const card = document.createElement('article');
    card.id = 'fp-xm-continue-card';
    card.className = 'fp-xm-continue-card';
    if (!last || Date.now() - Number(last.at || 0) > 14 * 86400000) {
      card.innerHTML = '<div><small>继续工作</small><b>从客户、商品或单据开始</b><span>系统会记住你最近使用的板块，下次可以快速返回。</span></div><div><button type="button" class="fp-xm-primary" data-view="customers">查看客户</button><button type="button" class="fp-xm-secondary" data-view="products">查看商品</button></div>';
    } else {
      card.innerHTML = `<div><small>继续上次操作</small><b>${clean(last.label)}</b><span>${new Date(last.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div><div><button type="button" class="fp-xm-primary" data-fp-resume>继续处理</button><button type="button" class="fp-xm-secondary" data-fp-clear-last>清除记录</button></div>`;
      $('[data-fp-resume]', card)?.addEventListener('click', () => clickRoute(last));
      $('[data-fp-clear-last]', card)?.addEventListener('click', () => { localStorage.removeItem(LAST_KEY); card.remove(); mountContinueCard(); });
    }
    const head = $('.home-section-head', home);
    if (head) head.insertAdjacentElement('afterend', card); else home.prepend(card);
  }
  function emptyHasRealContent(root) {
    if (!root) return true;
    const nodes = Array.from(root.children).filter(node => !node.matches?.('[data-fp-empty-state]'));
    if (!nodes.length) return false;
    return nodes.some(node => clean(node.textContent) || node.querySelector?.('img,button,a,input'));
  }
  function decorateEmptyStates() {
    Object.entries(EMPTY).forEach(([id, meta]) => {
      const root = document.getElementById(id); if (!root) return;
      const current = root.querySelector(':scope > [data-fp-empty-state]');
      if (emptyHasRealContent(root)) { current?.remove(); return; }
      if (current) return;
      const [title, copy, action] = meta;
      const state = document.createElement('div');
      state.dataset.fpEmptyState = id;
      state.className = 'fp-xm-empty';
      state.innerHTML = `<span aria-hidden="true">＋</span><b>${title}</b><p>${copy}</p>`;
      state.appendChild(makeButton({ ...action, primary: true }));
      root.appendChild(state);
    });
  }
  function mountMobileNav() {
    if ($('#fp-xm-mobile-nav')) return;
    const nav = document.createElement('nav');
    nav.id = 'fp-xm-mobile-nav';
    nav.className = 'fp-xm-mobile-nav';
    nav.setAttribute('aria-label', '手机快捷导航');
    [['dashboard','首页'],['customers','客户'],['products','商品'],['documents','单据'],['ai','智能录入']].forEach(([view,label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.view = view; button.textContent = label; nav.appendChild(button);
    });
    document.body.appendChild(nav);
  }
  function updateMobileNav() {
    const active = document.body.dataset.workspaceView || $('.view.active')?.id || 'dashboard';
    $$('#fp-xm-mobile-nav [data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === active));
  }
  function mountWorkspaceStatusLegend() {
    $('#fp-xm-status-legend')?.remove();
  }
  function normalizeStatusLanguage() {
    $$('em,small,span,b').forEach(node => {
      if (node.children.length) return;
      const t = clean(node.textContent);
      if (['待配置','等待连接','尚未连接','未开通'].includes(t)) node.classList.add('fp-xm-status-wait');
      if (['可用','服务可用','连接正常','已连接'].includes(t)) node.classList.add('fp-xm-status-ready');
      if (/失败|错误|无权限/.test(t) && t.length < 30) node.classList.add('fp-xm-status-error');
    });
  }
  function mountWorkspace() {
    mountAllWorkspaceJourneys(); mountContinueCard(); mountMobileNav(); mountWorkspaceStatusLegend(); decorateEmptyStates(); updateMobileNav(); normalizeStatusLanguage();
  }

  function mountDocStart() {
    const header = $('.doc-start-topbar'); if (!header || $('#fp-xm-doc-start')) return;
    const bar = document.createElement('section');
    bar.id = 'fp-xm-doc-start'; bar.className = 'fp-xm-page-journey fp-xm-doc-start';
    bar.innerHTML = '<div class="fp-xm-page-steps"><span class="active">1 选择单据</span><span>2 选择客户和品牌</span><span>3 选择商品</span><span>4 进入编辑器</span></div><div class="fp-xm-page-summary"><b>资料准备 1/4</b><span>可以先进入编辑器，未填写内容会继续保留为空。</span></div><a href="./workspace.html?view=documents">返回单据中心</a>';
    header.insertAdjacentElement('afterend', bar);
    const update = () => {
      const customer = clean($('#customer-select')?.value);
      const brand = clean($('#brand-select')?.value);
      const products = $$('#product-picker .product.selected').length;
      let score = 1 + (customer ? 1 : 0) + (brand ? 1 : 0) + (products ? 1 : 0);
      const b = $('.fp-xm-page-summary b', bar); const s = $('.fp-xm-page-summary span', bar);
      if (b) b.textContent = `资料准备 ${score}/4`;
      if (s) s.textContent = products ? `已选择 ${products} 个商品，可进入编辑器继续核对。` : '商品可以稍后补充，也可以直接进入空白单据。';
      $$('.fp-xm-page-steps span', bar).forEach((step, i) => step.classList.toggle('active', i < score));
    };
    document.addEventListener('change', update); document.addEventListener('click', () => setTimeout(update, 30)); update();
  }

  function showFormalCheck() {
    const gate = window.FlypigBOXFormalOutputGate;
    if (!gate?.check) { document.getElementById('headerExportPdfBtn')?.click(); return; }
    let result;
    try { result = gate.check('pdf') || {}; } catch (_) { document.getElementById('headerExportPdfBtn')?.click(); return; }
    let dialog = $('#fp-xm-formal-dialog');
    if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'fp-xm-formal-dialog'; dialog.className = 'fp-xm-check-dialog'; document.body.appendChild(dialog); }
    const normalizeIssue = item => typeof item === 'string' ? { message: item } : (item && typeof item === 'object' ? item : { message: clean(item) });
    const blockers = Array.isArray(result.blockers) ? result.blockers.map(normalizeIssue) : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings.map(normalizeIssue) : [];
    dialog.innerHTML = `<section><header><div><small>正式输出前检查</small><h2>${blockers.length ? '还有资料需要补充' : warnings.length ? '可以输出，建议再核对' : '基础检查通过'}</h2></div><button type="button" data-fp-close-check>×</button></header><div class="fp-xm-check-counts"><span class="${blockers.length?'is-error':'is-ok'}">必须处理 ${blockers.length}</span><span class="${warnings.length?'is-warn':'is-ok'}">建议核对 ${warnings.length}</span></div><div class="fp-xm-check-list">${[...blockers.map(x => ({...x,tone:'error'})),...warnings.map(x => ({...x,tone:'warn'}))].map(x => `<p class="is-${x.tone}"><b>${clean(x.label || x.field || '资料')}</b><span>${clean(x.message || x.reason || '')}</span></p>`).join('') || '<p class="is-ok"><b>可以继续</b><span>请确认客户、数量、价格、条款和收款资料无误。</span></p>'}</div><footer><button type="button" data-fp-close-check>返回编辑</button><button type="button" class="primary" data-fp-open-output ${blockers.length?'disabled':''}>正式文件操作</button></footer></section>`;
    $$('[data-fp-close-check]', dialog).forEach(btn => btn.addEventListener('click', () => dialog.close()));
    $('[data-fp-open-output]', dialog)?.addEventListener('click', () => { dialog.close(); $('#headerExportPdfBtn')?.click(); });
    dialog.showModal();
  }
  function mountEditor() {
    const header = $('.site-header'); if (!header || $('#fp-xm-editor')) return;
    const bar = document.createElement('section');
    bar.id = 'fp-xm-editor'; bar.className = 'fp-xm-page-journey fp-xm-editor';
    bar.innerHTML = '<div class="fp-xm-page-steps"><span class="active">1 资料</span><span class="active">2 编辑</span><span>3 检查</span><span>4 输出</span></div><div class="fp-xm-editor-state"><b>当前单据</b><span data-fp-editor-state>等待编辑</span></div><div class="fp-xm-editor-actions"><a href="./workspace.html?view=documents">返回单据中心</a><button type="button" data-fp-check-document>检查资料</button><button type="button" class="primary" data-fp-save-document>保存单据</button></div>';
    header.insertAdjacentElement('afterend', bar);
    const state = $('[data-fp-editor-state]', bar);
    const setState = (text, tone='') => { if (!state) return; state.textContent = text; state.dataset.tone = tone; };
    $('#piForm')?.addEventListener('input', () => setState('有未保存修改', 'warn'), true);
    $('[data-fp-save-document]', bar)?.addEventListener('click', () => { setState('正在保存，请留意页面提示', 'wait'); $('#saveAllBtn')?.click(); });
    $('[data-fp-check-document]', bar)?.addEventListener('click', showFormalCheck);
    document.addEventListener('HUIDI:document-saved', () => { setState('已保存到工作台', 'ready'); $$('.fp-xm-page-steps span', bar).forEach((step,i)=>step.classList.toggle('active',i<3)); });
    $('#headerExportPdfBtn')?.addEventListener('click', () => $$('.fp-xm-page-steps span', bar).forEach(step => step.classList.add('active')));
  }

  function catalogProductCount() {
    const text = clean($('#excelChip')?.textContent);
    const match = text.match(/(\d+)\s*个/); if (match) return Number(match[1]);
    return $$('.product-row').length;
  }
  function mountCatalog() {
    const header = $('header.topbar, header.site-header, .topbar'); if (!header || $('#fp-xm-catalog')) return;
    const bar = document.createElement('section');
    bar.id = 'fp-xm-catalog'; bar.className = 'fp-xm-page-journey fp-xm-catalog';
    bar.innerHTML = '<div class="fp-xm-page-steps"><span class="active">1 选择商品</span><span>2 整理资料</span><span>3 检查预览</span><span>4 保存与导出</span></div><div class="fp-xm-page-summary"><b>尚未导入商品</b><span>可以从商品资料库选择，也可以上传Excel产品表。</span></div><div class="fp-xm-editor-actions"><a href="../workspace.html?view=products">商品资料库</a><a href="../workspace.html?view=catalog">目录中心</a><button type="button" class="primary" data-fp-save-catalog>保存目录项目</button></div>';
    header.insertAdjacentElement('afterend', bar);
    const update = () => {
      const count = catalogProductCount(); const b = $('.fp-xm-page-summary b', bar); const s = $('.fp-xm-page-summary span', bar);
      const nextTitle = count ? `已准备 ${count} 个商品` : '尚未导入商品';
      const nextCopy = count ? '继续核对图片、价格、规格和客户可见内容。' : '可以从商品资料库选择，也可以上传Excel产品表。';
      if (b && b.textContent !== nextTitle) b.textContent = nextTitle;
      if (s && s.textContent !== nextCopy) s.textContent = nextCopy;
      $$('.fp-xm-page-steps span', bar).forEach((step,i)=>step.classList.toggle('active', i < (count ? 3 : 1)));
    };
    $('[data-fp-save-catalog]', bar)?.addEventListener('click', () => $('#saveCatalogProject')?.click());
    document.addEventListener('HUIDI:catalog-saved', () => $$('.fp-xm-page-steps span', bar).forEach(step => step.classList.add('active')));
    document.addEventListener('change', () => setTimeout(update, 30)); document.addEventListener('click', () => setTimeout(update, 60));
    new MutationObserver(() => update()).observe(document.body, { childList: true, subtree: true }); update();
  }

  function handleGlobalClick(event) {
    const focus = event.target.closest('[data-fp-focus]');
    if (focus) { const target = document.querySelector(focus.dataset.fpFocus); target?.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>target?.focus(),250); }
  }
  function handleShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      const search = $('#global-search, #product-search, #customer-search, input[type="search"]');
      if (search) { event.preventDefault(); search.focus(); search.select?.(); }
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      const dialog = $('dialog[open]'); const primary = dialog?.querySelector('button.primary:not(:disabled),.btn.primary:not(:disabled)');
      if (primary) { event.preventDefault(); primary.click(); }
    }
  }
  function restoreRoute() {
    if (pageType() !== 'workspace') return;
    const params = new URLSearchParams(location.search);
    const view = params.get('view') || (location.hash.startsWith('#view=') ? location.hash.slice(6) : '');
    const action = params.get('action');
    if (view && VIEW_LABELS[view]) setTimeout(() => document.querySelector(`[data-view="${CSS.escape(view)}"]`)?.click(), 650);
    if (action) setTimeout(() => document.querySelector(`[data-action="${CSS.escape(action)}"]`)?.click(), 950);
  }
  function boot() {
    const type = pageType();
    safeWrite(PAGE_KEY, { type, path: location.pathname, at: Date.now() });
    document.addEventListener('click', recordClick, true);
    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('keydown', handleShortcuts);
    if (type === 'workspace') { mountWorkspace(); restoreRoute(); }
    if (type === 'document_start') mountDocStart();
    if (type === 'editor') mountEditor();
    if (type === 'catalog') mountCatalog();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return; queued = true;
      setTimeout(() => { queued = false; if (pageType() === 'workspace') mountWorkspace(); else normalizeStatusLanguage(); }, 160);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  window.FlypigBOXCrossModuleExperience = Object.freeze({ version: VERSION, mountWorkspace, mountDocStart, mountEditor, mountCatalog, remember });
})();
