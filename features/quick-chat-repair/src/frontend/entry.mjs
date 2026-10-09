const native = createQuickChatExitAdapter(config.codex);
let scheduled = false, disposed = false;
function schedule() {
  if (scheduled || disposed) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; if (!disposed) native.reconcile(); });
}
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['style']});
schedule();
config.registerSelfCheck?.(() => ({state:'available', checks:[{name:'native-exit-observer', available:!disposed}], scopes:[]}));
return () => { disposed = true; observer.disconnect(); };
