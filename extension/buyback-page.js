/* MAIN-world adapter: use the mounted Portal table's own print action, including
 * its permissions, eligibility checks, cart updates, and Dymo printer setup. */
(() => {
  'use strict';
  if (globalThis.__ubifPlusBuybackPage) return;
  globalThis.__ubifPlusBuybackPage = true;
  const handled = new Set();
  const canonical = (value, sku) => {
    const serial = String(value || '');
    if (/^\d{10}$/.test(serial)) return `${sku}-${serial}`;
    if (/^I-\d{10}$/i.test(serial)) return `${sku}-${serial.slice(2)}`;
    if (/^[A-Za-z]-/.test(serial) && serial.slice(2).startsWith(`${sku}-`) && /^\d{10}$/.test(serial.slice(sku.length + 3))) return serial.slice(2);
    return serial;
  };
  function actionsFor(sku, serial) {
    const matches = new Set(), tables = new Set();
    // Table data is the same mapped data Portal uses to render its actions.
    // Never crawl arbitrary React state or infer an action from nearby text.
    for (const node of document.querySelectorAll('table, [role="table"]')) {
      const key = Object.keys(node).find(key => key.startsWith('__reactFiber$'));
      let fiber = key ? node[key] : null, root = fiber;
      while (root?.return) root = root.return;
      if (root?.stateNode?.current && root.stateNode.current !== root) fiber = fiber?.alternate || fiber;
      for (let depth = 0; fiber && depth++ < 40; fiber = fiber.return) {
        const data = fiber.memoizedProps?.data;
        if (!Array.isArray(data) || tables.has(data)) continue;
        tables.add(data);
        for (const row of data) {
          if (canonical(row?.item?.subtext, sku) !== canonical(serial, sku)) continue;
          const action = row.actions?.find(a => a.id === 'print_buyback_label');
          if (action && typeof action.onPress === 'function') matches.add(action);
        }
      }
    }
    return [...matches];
  }
  addEventListener('message', event => {
    const m = event.data;
    if (event.source !== window || m?.source !== 'ubif-plus' || m.type !== 'buyback-print-request') return;
    if (typeof m.id !== 'string' || handled.has(m.id) || !/^\d+$/.test(String(m.order)) || location.pathname !== `/repair/workorder/${m.order}`) return;
    if (typeof m.sku !== 'string' || !m.sku || typeof m.serial !== 'string' || !m.serial) return;
    const actions = actionsFor(m.sku, m.serial);
    if (!actions.length || actions.length === 1 && actions[0].isDisabled) return; // Portal may still be loading.
    handled.add(m.id);
    const reply = (state, message) => window.postMessage({ source: 'ubif-plus', type: 'buyback-print-result', id: m.id, state, message }, '*');
    if (actions.length !== 1) { reply('error', 'More than one matching cart line. Use the work order’s buyback action.'); return; }
    // Consume before invoking: printing/cart writes must never be automatically retried.
    try {
      const pending = actions[0].onPress();
      reply('started', 'Buyback print requested. Check Portal for printer messages.');
      Promise.resolve(pending).catch(() => reply('error', 'Portal could not start buyback printing. Check the work order.'));
    } catch { reply('error', 'Portal could not start buyback printing. Check the work order.'); }
  });
})();
