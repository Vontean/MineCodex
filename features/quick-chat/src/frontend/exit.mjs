export function installQuickChatExitRepair(signal, native) {
  let scheduled = false, disposed = false;
  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; if (!disposed) native.reconcile(); });
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['style']});
  schedule();
  function dispose() { disposed = true; observer.disconnect(); }
  signal.addEventListener('abort',dispose,{once:true});
  return {dispose,status:()=>!disposed};
}
