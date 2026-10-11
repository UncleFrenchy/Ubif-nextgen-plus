/* Main-world adapter for the portal's Arrivals useState query and pagination.
   Contract verified against the public R92.4 check-in/components bundles.
   React still renders rows, performs requests, and owns pagination actions. */
(() => {
  if (globalThis.__ubifPlusArrivalsPage) return;
  globalThis.__ubifPlusArrivalsPage = true;
  const sizes = [10, 25, 50, 100];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function fiberFor(node) {
    const key = Object.keys(node || {}).find(key => key.startsWith('__reactFiber$'));
    let fiber = key ? node[key] : null, root = fiber;
    while (root?.return) root = root.return;
    if (root?.stateNode?.current && root.stateNode.current !== root) fiber = fiber?.alternate;
    return fiber;
  }
  function states(fiber) {
    const result = [];
    for (let hook = fiber.memoizedState, n = 0; hook && n++ < 100; hook = hook.next) {
      if (typeof hook.queue?.dispatch === 'function') result.push(hook);
    }
    return result;
  }
  function adapter() {
    const container = document.querySelector('[data-testid="arrivals-container"]');
    if (!container) return null;
    // Resolve the mounted branch of React's double-buffered tree.
    let fiber = fiberFor(container);
    for (let depth = 0; fiber && depth++ < 40; fiber = fiber.return) {
      const hooks = states(fiber);
      for (let i = 2; i < hooks.length; i++) {
        const query = hooks[i - 2], rows = hooks[i - 1], paging = hooks[i];
        const value = paging.memoizedState;
        if (object(query.memoizedState) && Array.isArray(rows.memoizedState) && object(value) &&
            Object.keys(value).length === 2 && Number.isInteger(value.page) && sizes.includes(value.pageSize)) {
          return { query, paging, container };
        }
      }
    }
    return null;
  }
  function resetControls(container) {
    let fiber = fiberFor(container.querySelector('[data-testid="start-button"]'));
    for (let depth = 0; fiber && depth++ < 30; fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (props && typeof props.onChange === 'function' && Number.isFinite(props.rowCount) && sizes.includes(props.pageSize)) {
        const page = states(fiber).find(hook => Number.isInteger(hook.memoizedState));
        if (page && page.memoizedState !== 1) page.queue.dispatch(1);
        return;
      }
    }
  }
  addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== 'ubif-plus' || data.type !== 'arrivals-page-size' ||
        !sizes.includes(data.pageSize) || !/^\/check-in\/arrivals\/?$/.test(location.pathname)) return;
    let supported = false;
    try {
      const state = adapter();
      if (state) {
        supported = true;
        const size = data.pageSize;
        if (state.paging.memoizedState.pageSize !== size || state.query.memoizedState.pageSize !== size) {
          resetControls(state.container);
          state.query.queue.dispatch(previous => ({ ...previous, page: 1, pageSize: size }));
          state.paging.queue.dispatch(previous => ({ ...previous, page: 1, pageSize: size }));
        }
      }
    } catch (_) { /* leave the native table usable if its contract changes */ }
    window.postMessage({ source: 'ubif-plus', type: 'arrivals-page-size-result', supported }, '*');
  });
})();
