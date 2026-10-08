const native = createQuickChatAdapter(config.codex);
const instances = new Map();
let scheduled = false, disposed = false;
const text = (en,zh) => (document.documentElement.lang || navigator.language).startsWith('zh') ? zh : en;
const style = document.createElement('style');
style.textContent = `
  [data-mcx-quick-chat-history]{margin-inline-end:8px;flex-shrink:0}
  [data-mcx-quick-chat-history]>svg{width:16px;height:16px}
  [data-mcx-quick-chat-minimize]{border-radius:calc(infinity * 1px)}
  [data-mcx-quick-chat-project-rail]{display:none!important}
  /* 隐藏唯一的项目栏时，一并收起原生 rail 的圆角留白与负 margin。 */
  [data-composer-rail]:has(>[data-mcx-quick-chat-project-rail]):not(:has(>:not([data-mcx-quick-chat-project-rail]):not(:empty))){display:none!important}
  [data-floating-chat-surface]>:has(>[data-mcx-quick-chat-history]){display:flex;align-items:center}
`;
document.head.append(style);
function releaseBackground(instance) {
  if (!instance.background) return;
  instance.background.removeAttribute('data-mcx-ui-surface'); instance.background.removeAttribute('data-mcx-ui-variant');
  instance.background = null;
}
function releaseProjectRail(instance) { instance.projectRail?.removeAttribute('data-mcx-quick-chat-project-rail'); instance.projectRail = null; }
function remove(instance) { releaseBackground(instance); releaseProjectRail(instance); instance.minimize?.removeAttribute('data-mcx-quick-chat-minimize'); instance.unsubscribe(); instance.button?.remove(); instance.tracker.clear(); instance.historyTracker.clear(); }
function sync() {
  if (disposed) return;
  const snapshots = native.surfaces(), active = new Set();
  for (const snapshot of snapshots) {
    active.add(snapshot.surface);
    let instance = instances.get(snapshot.surface);
    const selected = instance?.historyTracker.selected(snapshot);
    if (!instance || instance.sessionId !== snapshot.sessionId || instance.emitter !== snapshot.emitter) {
      if (instance) remove(instance);
      instance = {sessionId:snapshot.sessionId, emitter:snapshot.emitter, tracker:createSubmissionTracker(), historyTracker:createHistoryTracker(), button:null};
      const begin = () => { const current = native.read(snapshot.surface); if (current) instance.tracker.begin(current); };
      instance.unsubscribe = native.subscribe(snapshot, begin);
      instances.set(snapshot.surface, instance);
    }
    if (selected || instance.tracker.accepted(snapshot)) snapshot.expand();
    instance.historyTracker.open(snapshot);
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
      minimize?.setAttribute('data-mcx-quick-chat-minimize','');
    }
    if (!minimize || !snapshot.showHistory) { instance.button?.remove(); instance.button = null; continue; }
    if (!instance.button?.isConnected || instance.button.parentElement !== minimize.parentElement) {
      instance.button?.remove();
      const button = minimize.cloneNode(false);
      for (const attr of ['id','disabled','aria-disabled','aria-describedby','aria-expanded','title']) button.removeAttribute(attr);
      button.removeAttribute('data-mcx-quick-chat-minimize');
      button.type = 'button';
      button.setAttribute('data-mcx-quick-chat-history', '');
      button.innerHTML = config.resources.history;
      const icon = button.querySelector('svg');
      if (icon) { icon.setAttribute('width','16'); icon.setAttribute('height','16'); icon.setAttribute('aria-hidden','true'); }
      button.addEventListener('pointerdown', event => event.preventDefault(), {signal});
      button.addEventListener('click', () => { instance.tracker.clear(); native.read(snapshot.surface)?.history(); }, {signal});
      minimize.before(button); instance.button = button;
    }
    if (instance.button.className !== minimize.className) instance.button.className = minimize.className;
    const label = text('Chat history', '聊天历史');
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
config.registerSelfCheck?.(() => {
  const snapshots = native.surfaces(), anchors = snapshots.filter(item => item.showHistory), available = anchors.some(item => instances.get(item.surface)?.button?.isConnected);
  return {state:anchors.length ? available ? 'available' : 'unavailable' : 'not-applicable',
    reason:anchors.length ? available ? null : 'quick-chat-history-anchor-unavailable' : 'no-classic-quick-chat-floating-controls',
    checks:[{name:'quick-chat-history',available}],scopes:snapshots.map(item=>({name:'quick-chat',element:item.surface}))};
});
return () => { disposed = true; observer.disconnect(); for (const instance of instances.values()) remove(instance); instances.clear(); style.remove(); };
