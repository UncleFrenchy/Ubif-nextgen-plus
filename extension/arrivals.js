/* Arrivals page-size preference, independent of column customization. */
(() => {
  if (globalThis.__ubifPlusArrivals) return;
  globalThis.__ubifPlusArrivals = true;
  const KEY = 'ubif-plus.arrivals.page-size.v1';
  const sizes = [10, 25, 50, 100];
  const S = globalThis.UBIFPlusSettings;
  let enabled = true;
  let size = 10, ready = false, control = null, status = null;
  function request(pageSize = size) {
    window.postMessage({ source: 'ubif-plus', type: 'arrivals-page-size', pageSize }, '*');
  }
  function placement(container) {
    const scope = container.closest('main') || document;
    const add = [...scope.querySelectorAll('button')].find(button =>
      !button.closest('[role="dialog"]') && /^(add new)$/i.test(button.textContent.trim()));
    if (add) return { host: add.parentElement, anchor: add, native: add, toolbar: true };
    // With no actions toolbar, share the existing pagination footer instead.
    const first = container.querySelector('[data-testid="start-button"]');
    const last = container.querySelector('[data-testid="end-button"]');
    let footer = first?.parentElement;
    while (footer && footer !== container && (!footer.contains(last) || !/\d/.test(footer.textContent))) footer = footer.parentElement;
    return footer && footer !== container ? { host: footer, native: first, toolbar: false } : null;
  }
  const css = document.createElement('style');
  css.id = 'ubif-plus-arrivals-pagination-style';
  css.textContent = `
    [data-ubif-page-size-toolbar]{display:flex!important;align-items:center;gap:12px;flex-wrap:wrap;}
    #ubif-plus-arrivals-pagination{display:inline-flex;align-items:center;flex:0 0 auto;margin:0;font:inherit;color:var(--aui-on-surface);}
    #ubif-plus-arrivals-pagination select{font:inherit;color:inherit;background:var(--aui-surface);border:1px solid var(--aui-outline-soft,#bdbdbd);border-radius:9999px;height:var(--ubif-page-size-height,36px);padding:0 32px 0 14px;cursor:pointer;}
    #ubif-plus-arrivals-pagination select:hover{background:var(--aui-sub-surface);}
    #ubif-plus-arrivals-pagination select:focus-visible{outline:2px solid var(--aui-primary);outline-offset:2px;}
    #ubif-plus-arrivals-pagination select:disabled{cursor:default;opacity:.55;}
    #ubif-plus-arrivals-pagination [role="status"]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}
  `;
  let toolbar = null;
  function refresh() {
    const container = /^\/check-in\/arrivals\/?$/.test(location.pathname) && document.querySelector('[data-testid="arrivals-container"]');
    const target = container && placement(container);
    if (!ready || !enabled || !container || !target) {
      control?.remove(); control = null;
      toolbar?.removeAttribute('data-ubif-page-size-toolbar'); toolbar = null;
      if (ready && !enabled && container) request(10);
      return;
    }
    if (!css.isConnected) document.head.append(css);
    if (toolbar !== (target.toolbar ? target.host : null)) {
      toolbar?.removeAttribute('data-ubif-page-size-toolbar');
      toolbar = target.toolbar ? target.host : null;
      toolbar?.setAttribute('data-ubif-page-size-toolbar', '');
    }
    if (!control) {
      control = document.createElement('div');
      control.id = 'ubif-plus-arrivals-pagination';
      const label = document.createElement('label');
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Arrivals rows per page');
      for (const value of sizes) {
        const option = document.createElement('option');
        option.value = String(value); option.textContent = `${value} per page`; select.append(option);
      }
      select.value = String(size);
      select.addEventListener('change', () => {
        size = Number(select.value);
        if (S) {
          S.set({ arrivalsPageSize: size }).catch(() => {
            if (status) status.textContent = 'Page size could not be saved.';
          });
        } else try {
          chrome.storage.local.set({ [KEY]: size }, () => {
            if (chrome.runtime.lastError) status.textContent = 'Page size could not be saved.';
          });
        } catch (_) { status.textContent = 'Page size could not be saved.'; }
        request();
      });
      status = document.createElement('span');
      status.id = 'ubif-plus-arrivals-pagination-status';
      status.setAttribute('role', 'status');
      select.setAttribute('aria-describedby', status.id);
      label.append(select); control.append(label, status);
    }
    if (control.parentElement !== target.host) {
      if (target.anchor) target.anchor.after(control);
      else target.host.prepend(control);
    }
    const height = target.native?.getBoundingClientRect().height;
    const nativeHeight = height > 0 ? `${height}px` : '36px';
    if (control.style.getPropertyValue('--ubif-page-size-height') !== nativeHeight) control.style.setProperty('--ubif-page-size-height', nativeHeight);
    request();
  }
  addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== 'ubif-plus' || data.type !== 'arrivals-page-size-result' || !control) return;
    control.querySelector('select').disabled = !data.supported;
    control.querySelector('select').title = data.supported ? 'Arrivals rows per page' : 'Page size is unavailable for this portal layout.';
    if (!data.supported) status.textContent = 'Page size is unavailable for this portal layout.';
    else if (status.textContent.includes('unavailable')) status.textContent = '';
  });
  function apply(settings) {
    enabled = settings.arrivalsPagination !== false;
    size = sizes.includes(settings.arrivalsPageSize) ? settings.arrivalsPageSize : 10;
    if (control) control.querySelector('select').value = String(size);
    ready = true; refresh();
  }
  if (S) {
    S.subscribe(apply);
    S.get().then(apply, () => apply(S.defaults));
  } else try {
    chrome.storage.local.get([KEY], values => {
      if (!chrome.runtime.lastError && sizes.includes(values?.[KEY])) size = values[KEY];
      ready = true; refresh();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      size = sizes.includes(changes[KEY].newValue) ? changes[KEY].newValue : 10;
      if (control) control.querySelector('select').value = String(size);
      refresh();
    });
  } catch (_) { ready = true; }
  let timer = setInterval(refresh, 500);
  addEventListener('pagehide', () => { clearInterval(timer); timer = null; });
  addEventListener('pageshow', () => { if (!timer) timer = setInterval(refresh, 500); refresh(); });
})();
