const adapter = createFileNavigationAdapter(config.codex);
const mounted = new Map();
const style = document.createElement('style');
style.setAttribute('data-mcx-file-navigation-style', ''); style.textContent = config.resources.styles;
document.head.append(style);
let frame = null, disposed = false;
function reconcile() {
  frame = null;
  if (disposed) return;
  const views = adapter.scan(), active = new Set(views.map(view => view.nav));
  for (const [nav, item] of mounted) if (!active.has(nav)) { item.session.dispose(); mounted.delete(nav); }
  for (const view of views) {
    const existing = mounted.get(view.nav);
    if (existing?.key === view.key) continue;
    existing?.session.dispose();
    mounted.set(view.nav, { key: view.key, session: installFileNavigation(view, config.ui, config.locale) });
  }
}
const observer = new MutationObserver(records => {
  if (records.every(record => record.target.closest?.('.mcx-file-navigation-popover,.mcx-file-navigation-trigger,.cm-content'))) return;
  if (frame === null && !disposed) frame = requestAnimationFrame(reconcile);
});
signal.addEventListener('abort', disposeFileNavigation, { once: true });
observer.observe(document.body, { childList: true, subtree: true }); reconcile();
config.registerSelfCheck?.(() => ({
  state: mounted.size ? [...mounted.values()].every(item => item.session.available()) ? 'available' : 'unavailable' : 'not-applicable',
  checks: [...mounted.values()].map(item => ({ name: 'file-navigation-trigger', available: item.session.available() })),
  scopes: [...mounted.keys()].map(nav => ({ name: 'file-navigation', element: nav.parentElement })),
}));
function disposeFileNavigation() {
  disposed = true; observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame);
  for (const item of mounted.values()) item.session.dispose(); mounted.clear(); style.remove();
}
return disposeFileNavigation;
