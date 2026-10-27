const native = createQuickChatAdapter(config.codex);
const shortcut = installQuickChatShortcut(signal, config.codex);
const sidebar = installQuickChatSidebar(signal, config, shortcut);
const instances = new Map();
let scheduled = false, disposed = false;
const text = (en,zh) => (document.documentElement.lang || navigator.language).startsWith('zh') ? zh : en;
const style = document.createElement('style');
style.textContent = `
  [data-mcx-quick-chat-history],[data-mcx-quick-chat-close]{margin-inline-end:8px;flex-shrink:0}
  [data-mcx-quick-chat-history]>svg,[data-mcx-quick-chat-close]>svg{width:16px;height:16px}
  [data-mcx-quick-chat-close]{margin-inline-end:0}
  [data-mcx-quick-chat-minimize]{border-radius:calc(infinity * 1px)}
  /* 单行输入沿用控件中线，消除原生编辑区换行布局留下的底部间距。 */
  [data-mcx-quick-chat-compact] [data-composer-input]:has(>[data-composer-input-layout="single-line"]){margin-block:0;align-self:center}
  [data-mcx-quick-chat-compact] [data-composer-input-layout="single-line"]{margin-block:0;align-self:center}
  [data-mcx-quick-chat-project-rail]{display:none!important}
  /* 隐藏唯一的项目栏时，一并收起原生 rail 的圆角留白与负 margin。 */
  [data-composer-rail]:has(>[data-mcx-quick-chat-project-rail]):not(:has(>:not([data-mcx-quick-chat-project-rail]):not(:empty))){display:none!important}
  [data-floating-chat-surface]>:has(>[data-mcx-quick-chat-history],>[data-mcx-quick-chat-close]){display:flex;align-items:center}
`;
document.head.append(style);
function releaseBackground(instance) {
  if (!instance.background) return;
  instance.background.removeAttribute('data-mcx-ui-surface'); instance.background.removeAttribute('data-mcx-ui-variant');
  instance.background = null;
}
function releaseProjectRail(instance) { instance.projectRail?.removeAttribute('data-mcx-quick-chat-project-rail'); instance.projectRail = null; }
function remove(instance) { instance.surface?.removeAttribute('data-mcx-quick-chat-compact'); releaseBackground(instance); releaseProjectRail(instance); instance.minimize?.removeAttribute('data-mcx-quick-chat-minimize'); instance.unsubscribe(); instance.button?.remove(); instance.tracker.clear(); instance.historyTracker.clear(); }
function sync() {
  if (disposed) return;
  shortcut.sync();
  const snapshots = native.surfaces(), active = new Set();
  for (const snapshot of snapshots) {
    active.add(snapshot.surface);
    let instance = instances.get(snapshot.surface);
    const selected = instance?.historyTracker.selected(snapshot);
    if (!instance || instance.sessionId !== snapshot.sessionId || instance.subscriptionId !== snapshot.subscriptionId) {
      if (instance) remove(instance);
      instance = {surface:snapshot.surface, sessionId:snapshot.sessionId, subscriptionId:snapshot.subscriptionId, tracker:createSubmissionTracker(), historyTracker:createHistoryTracker(), button:null};
      const begin = () => { const current = native.read(snapshot.surface); if (current) instance.tracker.begin(current); };
      instance.unsubscribe = native.subscribe(snapshot, begin);
      instances.set(snapshot.surface, instance);
    }
    if (selected || instance.tracker.accepted(snapshot)) snapshot.expand();
    instance.historyTracker.open(snapshot);
    snapshot.surface.toggleAttribute('data-mcx-quick-chat-compact', !snapshot.expanded);
    if (instance.projectRail !== snapshot.projectRail) {
      releaseProjectRail(instance);
      instance.projectRail = snapshot.projectRail;
      instance.projectRail?.setAttribute('data-mcx-quick-chat-project-rail','');
    }
    if (instance.background !== snapshot.background) {
      releaseBackground(instance);
      if (snapshot.background) {
        instance.background = snapshot.background;
        config.ui.surface(snapshot.background,'floating-panel');
      }
    }
    const minimize = snapshot.minimize;
    if (instance.minimize !== minimize) {
      instance.minimize?.removeAttribute('data-mcx-quick-chat-minimize'); instance.minimize = minimize;
      if (snapshot.standalone) minimize?.setAttribute('data-mcx-quick-chat-minimize','');
    }
    const kind=snapshot.showHistory ? 'history' : snapshot.showClose && shortcut.canClose() ? 'close' : null;
    const anchor=kind==='close' ? snapshot.closeAnchor : minimize;
    if (!minimize || !anchor || !kind) { instance.button?.remove(); instance.button = null; continue; }
    if (!instance.button?.isConnected || instance.button.parentElement !== anchor.parentElement || instance.button.nextElementSibling!==anchor || instance.buttonKind!==kind) {
      instance.button?.remove();
      const button = minimize.cloneNode(false);
      for (const attr of ['id','disabled','aria-disabled','aria-describedby','aria-expanded','title']) button.removeAttribute(attr);
      button.removeAttribute('data-mcx-quick-chat-minimize');
      button.type = 'button';
      button.setAttribute(`data-mcx-quick-chat-${kind}`, '');
      button.innerHTML = config.resources[kind];
      const icon = button.querySelector('svg');
      if (icon) { icon.setAttribute('width','16'); icon.setAttribute('height','16'); icon.setAttribute('aria-hidden','true'); }
      button.addEventListener('pointerdown', event => {event.preventDefault();event.stopPropagation();}, {signal});
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        instance.tracker.clear(); instance.historyTracker.clear();
        const current=native.read(snapshot.surface);
        if (!current || current.sessionId!==instance.sessionId) return;
        if (kind==='history') current.history();
        else if (!shortcut.close(snapshot.surface,current.sessionId)) config.codex.report('quick-chat-close',false,'quick-chat-close-action-unavailable');
      }, {signal});
      anchor.before(button); instance.button = button; instance.buttonKind=kind;
    }
    if (instance.button.className !== minimize.className) instance.button.className = minimize.className;
    const label = kind==='history' ? text('Chat history', '聊天历史') : text('Close Quick Chat', '关闭快捷聊天');
    if (instance.button.getAttribute('aria-label') !== label) {
      instance.button.setAttribute('aria-label',label); instance.button.setAttribute('data-minecodex-tooltip',label);
    }
  }
  for (const [surface, instance] of instances) if (!active.has(surface)) { remove(instance); instances.delete(surface); }
}
function schedule() { if (disposed || scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; sync(); }); }
function begin(event) {
  const snapshot = native.surfaces().find(item => item.surface.contains(event.target));
  if (!snapshot) return;
  if (event.type === 'click' && !event.target.closest('button[type="submit"]')) { instances.get(snapshot.surface)?.tracker.clear(); return; }
  instances.get(snapshot.surface)?.tracker.begin(snapshot);
}
document.addEventListener('click',begin,{capture:true,signal});
document.addEventListener('submit',begin,{capture:true,signal});
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-hidden','inert','hidden','lang']});
sync();
void shortcut.ready.then(schedule);
config.registerSelfCheck?.(() => {
  const snapshots = native.surfaces(), anchors = snapshots.filter(item => item.showHistory || item.showClose);
  const controls = anchors.every(item => instances.get(item.surface)?.button?.isConnected), entry = sidebar.status();
  const applicable = anchors.length > 0 || entry.applicable;
  const available = (!anchors.length || controls) && (!entry.applicable || entry.available);
  return {state:applicable ? available ? 'available' : 'unavailable' : 'not-applicable',
    reason:applicable ? available ? null : 'quick-chat-controls-unavailable' : 'no-classic-quick-chat-floating-controls',
    checks:[...(anchors.length ? [{name:'quick-chat-controls',available:controls}] : []), ...(entry.applicable ? [{name:'quick-chat-sidebar-entry',available:entry.available}] : [])],
    scopes:snapshots.map(item=>({name:'quick-chat',element:item.surface}))};
});
return () => { disposed = true; shortcut.dispose(); sidebar.dispose(); observer.disconnect(); for (const instance of instances.values()) remove(instance); instances.clear(); style.remove(); };
