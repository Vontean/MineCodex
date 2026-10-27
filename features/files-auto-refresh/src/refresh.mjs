export function createDirectoryRefreshLoop({ scan, onResult, isVisible, schedule = setTimeout, cancel = clearTimeout, interval = 1000 }) {
  let timer = null, running = false, disposed = false;
  async function tick() {
    timer = null;
    if (disposed || !isVisible()) return;
    running = true;
    let views = [];
    try {
      views = scan();
      for (const view of views) {
        let failed = false;
        // 限制并发；刷新只触达原生已订阅目录，不扫描未知子目录。
        for (let index = 0; index < view.queries.length; index += 4) {
          if (disposed || !isVisible() || !view.current()) break;
          const results = await Promise.allSettled(view.queries.slice(index, index + 4).map(query => query.refresh()));
          failed ||= results.some(result => result.status === 'rejected');
        }
        if (!disposed && isVisible() && view.current()) onResult(view, failed);
      }
    } finally {
      running = false;
      if (!disposed && isVisible() && views.length) timer = schedule(tick, interval);
    }
  }
  return {
    request() {
      if (!disposed && !running && timer === null && isVisible()) timer = schedule(tick, 0);
    },
    pause() { if (timer !== null) cancel(timer); timer = null; },
    dispose() { disposed = true; if (timer !== null) cancel(timer); timer = null; },
  };
}
