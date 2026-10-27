const reads = new AbortController();
const adapter = createDirectoryRefreshAdapter(config.codex, reads.signal);
const failures = new Map();
let views = [], frame = null;
const isVisible = () => !signal.aborted && document.visibilityState === 'visible';
const loop = createDirectoryRefreshLoop({
  scan() {
    views = adapter.scan();
    for (const [key, item] of failures) if (!views.some(view => view.key === key && view.anchor === item.anchor)) {
      item.button.remove(); failures.delete(key);
    }
    return views;
  },
  isVisible,
  onResult(view, failed) {
    if (!failed) { failures.get(view.key)?.button.remove(); failures.delete(view.key); return; }
    if (!view.boundary) return;
    let button = failures.get(view.key)?.button;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.setAttribute('data-mcx-directory-refresh-retry', '');
      button.className = 'cursor-interaction rounded-md border border-default bg-surface px-2 py-1 text-sm text-secondary';
      button.textContent = config.locale === 'zh-CN' ? '目录尚未同步 · 重试' : 'Directory not synced · Retry';
      button.addEventListener('click', () => { loop.pause(); loop.request(); });
      button.style.position = 'fixed'; button.style.zIndex = '1';
      view.boundary.append(button); failures.set(view.key, { anchor: view.anchor, button });
    }
    // 提示放在列表底部，不把全高目录向下挤，也不改变原生容器的定位规则。
    const bounds = view.boundary.getBoundingClientRect();
    button.style.left = `${bounds.left + 8}px`; button.style.maxWidth = `${Math.max(0, bounds.width - 16)}px`;
    button.style.top = `${Math.max(bounds.top + 8, bounds.bottom - button.offsetHeight - 8)}px`;
  },
});
function reconcile() {
  frame = null;
  if (isVisible()) loop.request(); else loop.pause();
}
const observer = new MutationObserver(records => {
  if (records.every(record => record.target.closest?.('[data-mcx-directory-refresh-retry],.cm-content'))) return;
  if (frame === null) frame = requestAnimationFrame(reconcile);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'class', 'style'] });
document.addEventListener('visibilitychange', reconcile);
config.registerSelfCheck?.(() => {
  const current = adapter.scan();
  return {
    state: !current.length ? 'not-applicable' : current.every(view => view.available && view.queries.length && !failures.has(view.key)) ? 'available' : 'unavailable',
    checks: current.map(view => ({ name: 'native-directory-query', available: view.available && view.queries.length > 0 && !failures.has(view.key) })),
  };
});
function dispose() {
  reads.abort(); loop.dispose(); observer.disconnect(); document.removeEventListener('visibilitychange', reconcile);
  if (frame !== null) cancelAnimationFrame(frame);
  for (const item of failures.values()) item.button.remove(); failures.clear(); views = [];
}
signal.addEventListener('abort', dispose, { once: true });
reconcile();
return dispose;
