import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectoryRefreshLoop } from '../src/refresh.mjs';

function fixture(scan) {
  const timers = new Map(), results = [];
  let next = 0, visible = true;
  const loop = createDirectoryRefreshLoop({ scan, onResult: (view, failed) => results.push([view.key, failed]),
    isVisible: () => visible,
    schedule: (callback, delay) => { timers.set(++next, { callback, delay }); return next; },
    cancel: id => timers.delete(id),
  });
  return { loop, timers, results, hide: () => { visible = false; loop.pause(); },
    async tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); await timer.callback(); } };
}

test('refresh is serial across cycles, bounded to four requests and reports failures without stopping', async () => {
  let inFlight = 0, maximum = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const view = { key: 'workspace', current: () => true,
    queries: Array.from({ length: 9 }, (_, index) => ({ async refresh() {
      maximum = Math.max(maximum, ++inFlight); await gate; inFlight--;
      if (index === 4) throw Error('offline');
    } })) };
  const f = fixture(() => [view]);
  f.loop.request(); const tick = f.tick(); f.loop.request();
  assert.equal(f.timers.size, 0);
  release(); await tick;
  assert.equal(maximum, 4); assert.deepEqual(f.results, [['workspace', true]]);
  assert.equal([...f.timers.values()][0].delay, 1000);
  view.queries = [{ refresh: async () => {} }]; await f.tick();
  assert.deepEqual(f.results.at(-1), ['workspace', false]);
  f.loop.dispose(); assert.equal(f.timers.size, 0);
});

test('hiding or disposing during a batch prevents further reads and stale UI results', async () => {
  for (const action of ['hide', 'dispose']) {
    let release, reads = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const view = { key: 'workspace', current: () => true,
      queries: Array.from({ length: 8 }, () => ({ refresh: async () => { reads++; await gate; } })) };
    const f = fixture(() => [view]); f.loop.request(); const tick = f.tick();
    if (action === 'hide') f.hide(); else f.loop.dispose();
    release(); await tick;
    assert.equal(reads, 4); assert.deepEqual(f.results, []); assert.equal(f.timers.size, 0);
  }
});

test('no visible Files means no background timer; switching workspace discards old results', async () => {
  const empty = fixture(() => []); empty.loop.request(); await empty.tick(); assert.equal(empty.timers.size, 0);
  let release, current = true;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(() => [{ key: 'old', current: () => current, queries: [{ refresh: () => gate }] }]);
  f.loop.request(); const tick = f.tick(); current = false; release(); await tick;
  assert.deepEqual(f.results, []); f.loop.dispose();
});
