export function installQuickChatSidebar(signal, config, action, loadIcon = loadQuickChatSidebarIcon) {
  const native = createQuickChatSidebarAdapter(config.codex);
  let mounted = null, disposed = false, scheduled = false, icon = null;
  const style = document.createElement('style');
  style.textContent = `
    [data-mcx-quick-chat-entry-row]{position:relative}
    [data-mcx-quick-chat-entry-row]:hover>.sidebar-item{background-color:var(--color-background-primary-ghost-hover)}
    [data-mcx-quick-chat-entry]{position:absolute;inset-inline-end:var(--padding-row-cell-x,var(--padding-row-x));top:50%;transform:translateY(-50%);opacity:0;pointer-events:none}
    [data-mcx-quick-chat-entry-row]:hover>[data-mcx-quick-chat-entry],
    [data-mcx-quick-chat-entry-row]:focus-within>[data-mcx-quick-chat-entry]{opacity:1;pointer-events:auto}
    @media(hover:none){[data-mcx-quick-chat-entry]{opacity:1;pointer-events:auto}}
  `;
  document.head.append(style);
  function release() {
    mounted?.button.remove();
    mounted?.container.removeAttribute('data-mcx-quick-chat-entry-row');
    mounted = null;
  }
  function sync() {
    if (disposed || signal.aborted) return;
    const entry = native.read();
    if (!entry || !action.available() || !icon) { release(); return; }
    if (mounted?.row !== entry.row || !mounted.button.isConnected) {
      release();
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-mcx-quick-chat-entry','');
      button.className = 'flex size-7 shrink-0 cursor-interaction items-center justify-center rounded-md text-default hover:bg-primary-ghost-hover focus-visible:outline-2 focus-visible:outline-ring';
      const slot = entry.slot.cloneNode(true);
      const svg = icon.createElement(document,entry.svg.getAttribute('class'));
      for (const name of ['width','height']) if (entry.svg.hasAttribute(name)) svg.setAttribute(name,entry.svg.getAttribute(name));
      slot.querySelector('svg').replaceWith(svg);
      button.append(slot);
      button.addEventListener('pointerdown', event => event.stopPropagation(), {signal});
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); action.activate(); }, {signal});
      entry.container.setAttribute('data-mcx-quick-chat-entry-row','');
      entry.container.append(button);
      mounted = {...entry, button};
    }
    const label = (document.documentElement.lang || navigator.language).startsWith('zh') ? '打开快捷聊天' : 'Open Quick Chat';
    if (mounted.button.getAttribute('aria-label') !== label) {
      mounted.button.setAttribute('aria-label',label);
      mounted.button.setAttribute('data-minecodex-tooltip',label);
    }
  }
  function schedule(records) {
    if (disposed || scheduled || !records.some(record => record.target.closest?.('#app-shell-sidebar')
      || record.attributeName === 'lang'
      || [...record.addedNodes ?? [], ...record.removedNodes ?? []].some(node => node.matches?.('#app-shell-sidebar') || node.querySelector?.('#app-shell-sidebar')))) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; sync(); });
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden','lang']});
  void Promise.all([action.ready,loadIcon(signal)]).then(([,value]) => {
    if (disposed || signal.aborted) return;
    icon = value;
    sync();
  }).catch(() => { if (!disposed && !signal.aborted) config.codex.report('quick-chat-sidebar',false,'native-quick-chat-icon-unavailable'); });
  function dispose() { disposed = true; observer.disconnect(); release(); style.remove(); }
  signal.addEventListener('abort',dispose,{once:true});
  return {dispose,sync,status:() => ({applicable:Boolean(native.read()),available:Boolean(mounted?.button.isConnected)})};
}
