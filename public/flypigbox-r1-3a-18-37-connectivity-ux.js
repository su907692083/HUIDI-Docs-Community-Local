(() => {
  'use strict';
  const VERSION = 'R1.3A.18.37';
  if (window.FlypigBOXConnectivityUX?.version === VERSION) return;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const VIEW_LABELS = {
    dashboard:'工作台', deals:'业务中心', orders:'订单中心', customers:'客户中心', products:'商品资料库',
    catalog:'产品目录', documents:'单据中心', brands:'品牌中心', templates:'模板中心', notifications:'通知与协同',
    recycle:'回收站', mail:'邮件草稿', ai:'智能录入', feishu:'飞书资料', guide:'使用说明'
  };
  const RELATED = {
    dashboard:[['deals','处理询盘'],['documents','新建/查看单据'],['orders','查看订单']],
    customers:[['deals','从客户继续业务'],['mail','写客户邮件']],
    products:[['deals','加入业务'],['catalog','制作产品目录']],
    deals:[['orders','确认/查看订单'],['documents','制作单据'],['mail','写跟进邮件']],
    orders:[['documents','关联单据'],['deals','查看原业务'],['notifications','通知设置']],
    documents:[['deals','查看关联业务'],['mail','准备发送邮件']],
    catalog:[['products','继续整理商品'],['mail','准备目录邮件']],
    brands:[['templates','配置模板'],['documents','进入单据']],
    templates:[['brands','检查品牌资料'],['documents','进入单据']],
    notifications:[['orders','查看订单'],['deals','查看业务']],
    recycle:[['customers','客户中心'],['products','商品资料库']],
    mail:[['customers','选择客户'],['documents','查看单据']],
    ai:[['customers','客户中心'],['deals','业务中心'],['documents','单据中心']],
    feishu:[['customers','客户资料'],['orders','订单资料'],['products','商品资料']]
  };
  let historyLock = false;
  let lastDialogTrigger = null;
  const productModeKey = 'HUIDI.product.display.mode.v1';

  function currentView() {
    return document.body?.dataset.workspaceView || $('.view.active')?.id || 'dashboard';
  }
  function updateTitle(view) {
    const label = VIEW_LABELS[view] || '工作台';
    document.title = `${label} · HUIDI`;
  }
  function syncUrl(view, mode = 'push') {
    if (!location.pathname.endsWith('/workspace.html') && !location.pathname.endsWith('workspace.html')) return;
    if (!VIEW_LABELS[view] || view === 'guide') return;
    const url = new URL(location.href);
    if (url.searchParams.get('view') === view) { updateTitle(view); return; }
    url.searchParams.set('view', view);
    url.searchParams.delete('record');
    url.hash = '';
    history[mode === 'replace' ? 'replaceState' : 'pushState']({ fpView: view }, '', url);
    updateTitle(view);
  }
  function activateRoute(view) {
    if (!VIEW_LABELS[view]) return false;
    const button = $(`#nav [data-view="${CSS.escape(view)}"], [data-view="${CSS.escape(view)}"]`);
    if (!button) return false;
    historyLock = true;
    button.click();
    setTimeout(() => { historyLock = false; updateTitle(view); }, 0);
    return true;
  }
  function installRouting() {
    if (!location.pathname.endsWith('workspace.html')) return;
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-view]');
      if (!target || historyLock) return;
      const view = target.dataset.view;
      if (!VIEW_LABELS[view] || view === 'guide') return;
      setTimeout(() => syncUrl(view, 'push'), 0);
    }, true);
    window.addEventListener('popstate', () => {
      const view = new URL(location.href).searchParams.get('view') || 'dashboard';
      if (!activateRoute(view)) setTimeout(() => activateRoute(view), 250);
    });
    const initial = new URL(location.href).searchParams.get('view');
    if (initial && VIEW_LABELS[initial]) {
      if (!activateRoute(initial)) {
        [250, 700, 1300].forEach(delay => setTimeout(() => activateRoute(initial), delay));
      }
    } else {
      syncUrl(currentView(), 'replace');
    }
    new MutationObserver(() => updateTitle(currentView())).observe(document.body, {attributes:true, attributeFilter:['data-workspace-view']});
  }

  function relatedFlow(view) {
    const items = RELATED[view] || [];
    if (!items.length) return '';
    return `<div class="fp37-related-copy"><small>继续处理</small><b>${VIEW_LABELS[view] || '当前模块'}完成后，可以直接去下一步，不用返回首页。</b></div><div class="fp37-related-actions">${items.map(([target,label]) => `<button type="button" data-view="${target}">${label}</button>`).join('')}</div>`;
  }
  function mountRelatedFlow() {
    if (!location.pathname.endsWith('workspace.html')) return;
    $$('.view').forEach(section => {
      if (section.id === 'guide') return;
      let bar = $('.fp37-related-flow', section);
      if (!bar) {
        bar = document.createElement('aside');
        bar.className = 'fp37-related-flow';
        bar.dataset.fp37For = section.id;
        section.appendChild(bar);
      }
      bar.innerHTML = relatedFlow(section.id);
    });
  }

  function normalizeProductMode(mode) { return mode === 'card' ? 'card' : 'list'; }
  function getProductMode() {
    try { return normalizeProductMode(localStorage.getItem(productModeKey)); } catch (_) { return 'list'; }
  }
  function applyProductMode(mode, persist = true) {
    mode = normalizeProductMode(mode);
    const list = $('#product-list');
    if (!list) return;
    list.classList.toggle('fp37-product-card-mode', mode === 'card');
    list.dataset.displayMode = mode;
    $$('.fp37-display-toggle button').forEach(btn => {
      const active = btn.dataset.productDisplay === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (persist) { try { localStorage.setItem(productModeKey, mode); } catch (_) {} }
  }
  function ensureProductToggle() {
    const root = $('#products');
    if (!root) return;
    const summary = $('.product-library-summary-v33610', root) || $('.product-library-controls', root);
    if (!summary || $('.fp37-display-toggle', summary)) { applyProductMode(getProductMode(), false); return; }
    const toggle = document.createElement('div');
    toggle.className = 'fp37-display-toggle';
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', '商品显示方式');
    toggle.innerHTML = '<span>显示</span><button type="button" data-product-display="list">列表</button><button type="button" data-product-display="card">卡片</button>';
    summary.appendChild(toggle);
    applyProductMode(getProductMode(), false);
  }

  function normalizeButtons() {
    $$('form button:not([type])').forEach(button => {
      if (button.dataset.action || button.dataset.view || button.dataset.sidecarAction || button.classList.contains('close')) button.type = 'button';
    });
  }
  function removePermanentNewBadge() {
    $$('#nav .fp-sidecar-nav-mark').forEach(mark => mark.remove());
    $$('[data-sidecar-home="orders"] > em').forEach(mark => { if (/新功能/.test(mark.textContent || '')) mark.remove(); });
  }
  function installDialogFocusReturn() {
    document.addEventListener('click', event => {
      const trigger = event.target.closest('button,a,[role="button"]');
      if (trigger && !trigger.closest('dialog')) lastDialogTrigger = trigger;
    }, true);
    document.addEventListener('close', event => {
      if (!(event.target instanceof HTMLDialogElement)) return;
      const target = lastDialogTrigger;
      if (target?.isConnected && !target.disabled && target.offsetParent !== null) setTimeout(() => target.focus({preventScroll:true}), 0);
    }, true);
  }
  function installProductModeClicks() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-product-display]');
      if (!button) return;
      applyProductMode(button.dataset.productDisplay);
    });
  }
  function repairUi() {
    mountRelatedFlow();
    ensureProductToggle();
    normalizeButtons();
    removePermanentNewBadge();
  }
  function start() {
    document.documentElement.dataset.fp37 = 'enabled';
    installRouting();
    installDialogFocusReturn();
    installProductModeClicks();
    repairUi();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; repairUi(); });
    });
    observer.observe(document.body, {subtree:true, childList:true});
    window.addEventListener('storage', event => { if (event.key === productModeKey) applyProductMode(event.newValue, false); });
  }
  window.FlypigBOXConnectivityUX = Object.freeze({version:VERSION, repair:repairUi, activateRoute, applyProductMode});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
