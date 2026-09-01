(() => {
  'use strict';

  const VERSION = 'R1.3A.18.38';
  const doc = document;
  const root = doc.documentElement;
  root.dataset.fp38 = 'enabled';

  const surface = (() => {
    const p = location.pathname.toLowerCase();
    if (p.includes('/admin/')) return 'admin';
    if (p.includes('/catalog-studio/')) return 'catalog';
    if (p.includes('/assets/')) return 'assets';
    if (p.endsWith('/editor.html') || p.includes('editor.html')) return 'editor';
    if (p.endsWith('/document-start.html') || p.includes('document-start.html')) return 'document-start';
    if (p.endsWith('/workspace.html') || p.includes('workspace.html')) return 'workspace';
    return 'public';
  })();
  if (doc.body) doc.body.dataset.fpSurface = surface;

  const qs = (s, c = doc) => c.querySelector(s);
  const qsa = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
    if ('inert' in el) el.inert = !!hidden;
    if (hidden) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  }

  function hideAIFrontEnd(scope = doc) {
    const selectors = [
      '.fp-ai-capsule', '.fp-ai-widget', '.fp-ai-float', '.fp-ai-assistant-fab',
      '#fp-ai-capsule', '#fp-ai-widget', '#fp-ai-launcher', '#fp-ai-float',
      '[data-fp-ai-launcher]', '[data-ai-launcher]', '[data-ai-capsule]',
      '.ai-placeholder-v1', '.founder-os-task-panel', '.founder-os-float',
      '.fpb-ai-capsule', '.fpb-ai-fab', '.fpb-ai-dock'
    ];
    selectors.forEach((selector) => qsa(selector, scope).forEach((el) => {
      setHidden(el, true);
      el.dataset.fp38AiHidden = 'true';
    }));
  }

  function compactWorkspaceHome() {
    if (surface !== 'workspace') return;
    const home = qs('#workspace-home-v1');
    const dashboard = qs('#dashboard');
    if (!home || !dashboard) return;

    const quickCopy = qs('.home-quick-start .home-section-head > span', home);
    if (quickCopy && /6\s*个/.test(quickCopy.textContent || '')) {
      quickCopy.textContent = '4 个常用动作，首页只保留高频起点，更多能力放到对应模块继续处理。';
    }

    // Hide duplicated overview/module/mail blocks from the home canvas; capabilities remain in their dedicated modules.
    qsa('.home-section-v1', home).forEach((section) => {
      const label = section.getAttribute('aria-label') || '';
      if (/业务概览|核心功能模块/.test(label) || section.id === 'mail-center') {
        section.dataset.fp38Redundant = 'true';
      }
    });
    const ai = qs('.ai-placeholder-v1', home);
    if (ai) ai.dataset.fp38Redundant = 'true';

    // Mail is a dedicated workspace module now; home buttons should open it instead of scrolling to a hidden duplicate section.
    qsa('[data-action="scroll-mail-center"]', home).forEach((button) => {
      button.removeAttribute('data-action');
      button.dataset.view = 'mail';
      if ((button.textContent || '').trim() === '邮件草稿') button.title = '打开邮件草稿';
    });

    // Reuse the real metrics/priorities/flow inside the actual home shell instead of showing two home systems.
    const status = qs('.dashboard-status', dashboard);
    const metrics = qs('.metric-grid', dashboard);
    const boards = qs('.dashboard-grid', dashboard);
    const flow = qs('.workflow-panel', dashboard);
    const quick = qs('.home-quick-start', home);
    const footer = qs('.workspace-footer-v1', home);
    const guest = qs('#home-guest-card', home);

    if (metrics && !home.contains(metrics)) {
      (guest || qs('.home-hero-v1', home))?.insertAdjacentElement('afterend', metrics);
    }
    if (boards && !home.contains(boards)) {
      metrics?.insertAdjacentElement('afterend', boards);
    }
    if (quick && flow && !home.contains(flow)) {
      quick.insertAdjacentElement('afterend', flow);
    }
    if (status && !home.contains(status)) {
      flow?.insertAdjacentElement('afterend', status);
    }

    let more = qs('.fp38-home-more', home);
    if (!more) {
      more = doc.createElement('section');
      more.className = 'fp38-home-more';
      more.setAttribute('aria-label', '更多常用工具');
      more.innerHTML = `
        <div><b>更多常用工具</b><span>需要时再进入，不在首页重复堆大卡片。</span></div>
        <nav>
          <button class="btn ghost" type="button" data-view="mail">邮件草稿</button>
          <button class="btn ghost" type="button" data-view="catalog">产品目录</button>
          <button class="btn ghost" type="button" data-view="templates">模板中心</button>
          <button class="btn ghost" type="button" data-view="notifications">通知与协同</button>
        </nav>`;
      (status || flow || quick)?.insertAdjacentElement('afterend', more);
    }
    if (footer) home.appendChild(footer);

    // Remove duplicate support calls while keeping a single clear support entry.
    const supportButtons = qsa('.workspace-footer-v1 [data-action="open-support"]', home);
    supportButtons.forEach((button, index) => {
      if (index > 0) button.dataset.fp38DuplicateSupport = 'true';
    });
  }

  function customerFilterEnhance() {
    if (surface !== 'workspace') return;
    const drawer = qs('#customer-filter-drawer');
    const toggle = qs('[data-action="toggle-customer-filter"]');
    const reset = qs('[data-action="reset-customer-filter"]');
    if (!drawer || !toggle) return;

    toggle.setAttribute('aria-controls', drawer.id);
    const badge = doc.createElement('span');
    badge.className = 'fp38-filter-count';
    badge.hidden = true;
    toggle.appendChild(badge);

    const sync = () => {
      const open = !drawer.hidden;
      toggle.setAttribute('aria-expanded', String(open));
      const count = qsa('select', drawer).filter((el) => el.value).length;
      badge.textContent = String(count);
      badge.hidden = count === 0;
      toggle.classList.toggle('has-active-filter', count > 0);
      toggle.title = count ? `已设置 ${count} 个筛选条件` : '展开客户筛选';
      if ('inert' in drawer) drawer.inert = drawer.hidden;
    };
    qsa('select', drawer).forEach((el) => el.addEventListener('change', sync));
    toggle.addEventListener('click', () => setTimeout(sync, 0));
    reset?.addEventListener('click', () => setTimeout(sync, 0));
    sync();

    doc.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-view]');
      if (viewButton && viewButton.dataset.view !== 'customers' && !drawer.hidden) {
        drawer.hidden = true;
        sync();
      }
    }, true);
  }

  function detailsEnhance() {
    const details = qsa('details');
    details.forEach((el) => {
      const summary = qs(':scope > summary', el);
      if (!summary) return;
      summary.setAttribute('role', 'button');
      summary.setAttribute('aria-expanded', String(el.open));
      el.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(el.open)));
    });

    // Menus should behave like menus: only one open and clicking elsewhere closes it.
    doc.addEventListener('click', (event) => {
      qsa('details[open]').forEach((el) => {
        if (!el.contains(event.target) && (el.id === 'saveMenu' || el.classList.contains('account-menu') || el.classList.contains('action-menu'))) {
          el.open = false;
        }
      });
    });

    if (surface === 'editor') {
      const optional = details.filter((el) => {
        if (el.id === 'saveMenu') return false;
        if (el.classList.contains('action-menu')) return false;
        const text = qs('summary', el)?.textContent || '';
        return /设置|高级|更多|导入|粘贴|折扣|金额|工厂|贸易|翻译|收货|买方|产品|字段/.test(text);
      });
      if (optional.length >= 3 && !qs('.fp38-details-tools')) {
        const first = optional[0];
        const bar = doc.createElement('div');
        bar.className = 'fp38-details-tools';
        bar.innerHTML = '<span>可选设置</span><div><button type="button" data-fp38-details="open">展开全部</button><button type="button" data-fp38-details="close">收起全部</button></div>';
        first.parentNode.insertBefore(bar, first);
        bar.addEventListener('click', (event) => {
          const action = event.target.closest('[data-fp38-details]')?.dataset.fp38Details;
          if (!action) return;
          optional.forEach((el) => { el.open = action === 'open'; });
        });
      }
    }
  }

  const dialogState = new WeakMap();
  function dialogCloseCandidate(dialog) {
    return qs('[data-fp-close], [data-dialog-close], [data-account-close], [data-action^="close-"], .fpn-close, .modal-close, .dialog-close, button[aria-label*="关闭"], button[title*="关闭"]', dialog);
  }
  function requestDialogClose(dialog) {
    const close = dialogCloseCandidate(dialog);
    if (close) close.click();
    else if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  function enhanceDialog(dialog) {
    if (!dialog || dialog.dataset.fp38Enhanced === 'true') return;
    dialog.dataset.fp38Enhanced = 'true';
    dialog.setAttribute('role', dialog.getAttribute('role') || 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const close = dialogCloseCandidate(dialog);
    if (close && !close.getAttribute('aria-label')) close.setAttribute('aria-label', '关闭窗口');
    if (close && !close.title) close.title = '关闭窗口';

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      requestDialogClose(dialog);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) requestDialogClose(dialog);
    });

    const sync = () => {
      const open = dialog.open || dialog.hasAttribute('open');
      if (open) {
        if (!dialogState.has(dialog)) dialogState.set(dialog, doc.activeElement);
        doc.body?.classList.add('fp38-dialog-open');
        setTimeout(() => {
          const target = dialogCloseCandidate(dialog) || qs('input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex="-1"])', dialog);
          try { target?.focus({ preventScroll: true }); } catch (_) {}
        }, 0);
      } else {
        if (!qsa('dialog[open]').length) doc.body?.classList.remove('fp38-dialog-open');
        const prior = dialogState.get(dialog);
        if (prior?.isConnected) {
          try { prior.focus({ preventScroll: true }); } catch (_) {}
        }
        dialogState.delete(dialog);
      }
    };
    new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    sync();
  }

  function drawersEnhance(scope = doc) {
    const selectors = [
      '.drawer', '[class*="-drawer"]', '[data-drawer]', '[data-fp-drawer]',
      '#customer-filter-drawer', '.el-drawer'
    ];
    const all = new Set();
    selectors.forEach((s) => qsa(s, scope).forEach((el) => all.add(el)));
    all.forEach((drawer) => {
      if (drawer.dataset.fp38Drawer === 'true') return;
      drawer.dataset.fp38Drawer = 'true';
      const sync = () => {
        const hidden = drawer.hidden || drawer.getAttribute('aria-hidden') === 'true' || drawer.classList.contains('is-hidden');
        if ('inert' in drawer) drawer.inert = hidden;
        drawer.classList.toggle('fp38-drawer-hidden', hidden);
      };
      new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class', 'style'] });
      sync();
    });
  }

  function improveCloseControls(scope = doc) {
    qsa('button', scope).forEach((button) => {
      const text = (button.textContent || '').trim();
      const cls = String(button.className || '');
      const isClose = text === '×' || text === '✕' || /(^|\s)(close|modal-close|dialog-close|fpn-close)(\s|$)/.test(cls) || button.dataset.fpClose != null;
      if (isClose) {
        if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', '关闭窗口');
        if (!button.title) button.title = '关闭窗口';
        if (!button.getAttribute('type')) button.type = 'button';
      }
    });
  }

  function observeDynamicUI() {
    let queued = false;
    const run = async () => {
      if (queued) return;
      queued = true;
      await nextFrame();
      queued = false;
      qsa('dialog').forEach(enhanceDialog);
      drawersEnhance();
      improveCloseControls();
      hideAIFrontEnd();
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes?.length || m.type === 'attributes')) run();
    });
    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    run();
  }

  function setReleaseMarker() {
    if (!doc.body) return;
    doc.body.dataset.fpRelease = '20260808-r1-3a-18-38';
    doc.body.dataset.fpVersionLabel = VERSION;
  }

  function init() {
    setReleaseMarker();
    compactWorkspaceHome();
    customerFilterEnhance();
    detailsEnhance();
    qsa('dialog').forEach(enhanceDialog);
    drawersEnhance();
    improveCloseControls();
    hideAIFrontEnd();
    observeDynamicUI();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
