const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const script = name => fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
function boot() {
  const dom = new JSDOM('<main><div id="actions"><button>Add new</button></div><section data-testid="arrivals-container"><button data-testid="start-button">First</button><table></table></section></main>', {
    url: 'https://portal.ubreakifix.net/check-in/arrivals', runScripts: 'outside-only'
  });
  const w = dom.window, calls = [];
  const hook = (value, name) => {
    const h = { memoizedState: value, queue: { dispatch(update) {
      h.memoizedState = typeof update === 'function' ? update(h.memoizedState) : update;
      calls.push(name);
    } }, next: null }; return h;
  };
  const query = hook({ page: 4, arrivalTypeId: 2, searchTerm: 'phone', sortWithAppointmentDate: 'ASC' }, 'query');
  const rows = hook([], 'rows'), paging = hook({ page: 4, pageSize: 10 }, 'paging'), current = hook(4, 'control');
  query.next = rows; rows.next = paging;
  const component = { memoizedState: query };
  w.document.querySelector('section').__reactFiber$fixture = { return: component };
  w.document.querySelector('[data-testid="start-button"]').__reactFiber$fixture = { return: {
    memoizedProps: { onChange() {}, rowCount: 120, pageSize: 10 }, memoizedState: current
  } };
  w.chrome = { runtime: {}, storage: { local: { get(keys, cb) { cb({}); }, set(values, cb) { cb(); } }, onChanged: { addListener() {} } } };
  w.eval(script('arrivals-page.js')); w.eval(script('arrivals.js'));
  const send = data => w.dispatchEvent(new w.MessageEvent('message', { source: w, data: { source: 'ubif-plus', ...data } }));
  return { dom, w, query, paging, current, calls, send };
}
test('page size resets all page state and retains search, filter and sort', t => {
  const b = boot(); t.after(() => b.dom.window.close());
  b.send({ type: 'arrivals-page-size', pageSize: 100 });
  assert.equal(JSON.stringify(b.query.memoizedState), JSON.stringify({ page: 1, arrivalTypeId: 2, searchTerm: 'phone', sortWithAppointmentDate: 'ASC', pageSize: 100 }));
  assert.equal(b.paging.memoizedState.pageSize, 100);
  assert.equal(b.paging.memoizedState.page, 1); assert.equal(b.current.memoizedState, 1);
  const count = b.calls.length;
  b.send({ type: 'arrivals-page-size', pageSize: 100 });
  assert.equal(b.calls.length, count, 'unchanged state does not refetch');
  b.query.memoizedState = { page: 1, arrivalTypeId: 3 };
  b.send({ type: 'arrivals-page-size', pageSize: 100 });
  assert.equal(b.query.memoizedState.arrivalTypeId, 3);
  assert.equal(b.query.memoizedState.pageSize, 100, 'filter reset retains selected size');
});
test('unsupported sizes and other routes do not dispatch portal state', t => {
  const b = boot(); t.after(() => b.dom.window.close());
  b.send({ type: 'arrivals-page-size', pageSize: 1000 });
  b.w.history.pushState({}, '', '/repair/workorders');
  b.send({ type: 'arrivals-page-size', pageSize: 100 });
  assert.deepEqual(b.calls, []);
});
test('selector offers sizes through 100 and reports unsupported portal layouts', t => {
  const b = boot(); t.after(() => b.dom.window.close());
  const select = b.w.document.querySelector('#ubif-plus-arrivals-pagination select');
  assert.deepEqual([...select.options].map(o => o.value), ['10', '25', '50', '100']);
  assert.equal(select.closest('#ubif-plus-arrivals-pagination').parentElement.id, 'actions');
  assert.equal(select.options[3].textContent, '100 per page');
  b.send({ type: 'arrivals-page-size-result', supported: false });
  assert.equal(select.disabled, true);
  assert.match(b.w.document.querySelector('[role="status"]').textContent, /unavailable/);
});
test('mounted React branch is used when the host fiber points at the old root', t => {
  const b = boot(); t.after(() => b.dom.window.close());
  const host = b.w.document.querySelector('section').__reactFiber$fixture;
  const stale = { stateNode: { current: {} } };
  host.return = stale; host.alternate = { return: { memoizedState: b.query } };
  b.send({ type: 'arrivals-page-size', pageSize: 50 });
  assert.equal(b.query.memoizedState.pageSize, 50);
});
