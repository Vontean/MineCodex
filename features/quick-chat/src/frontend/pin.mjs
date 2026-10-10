export function installQuickChatPin(signal, config) {
  const native = createQuickChatPinAdapter(config.codex), instances = new Map();
  const style = document.createElement('style');
  // 保留原生可交互子元素的 pointer-events-auto，仅让透明背景穿透。
  style.textContent = '[data-mcx-quick-chat-pinned-layer]{pointer-events:none!important}';
  document.head.append(style);
  const text = (en,zh) => (document.documentElement.lang || navigator.language).startsWith('zh') ? zh : en;
  function render(instance) {
    if (instance.pinned) instance.layer.setAttribute('data-mcx-quick-chat-pinned-layer','');
    else instance.layer.removeAttribute('data-mcx-quick-chat-pinned-layer');
    const button = instance.button;
    if (!button) return;
    button.setAttribute('aria-pressed',String(instance.pinned));
    const label = instance.pinned ? text('Unpin chat','取消固定聊天') : text('Pin chat','固定聊天');
    button.setAttribute('aria-label',label); button.setAttribute('data-minecodex-tooltip',label);
    button.querySelector('svg path:last-child')?.setAttribute('fill',instance.pinned ? 'currentColor' : 'none');
  }
  function release(instance) { instance.layer.removeAttribute('data-mcx-quick-chat-pinned-layer'); instance.button?.remove(); }
  function sync() {
    const live = new Set();
    for (const snapshot of native.surfaces()) {
      live.add(snapshot.sessionId);
      let instance = instances.get(snapshot.sessionId);
      if (!instance) { instance={pinned:false,layer:snapshot.layer,button:null}; instances.set(snapshot.sessionId,instance); }
      if (instance.layer !== snapshot.layer) { release(instance); instance.layer=snapshot.layer; instance.button=null; }
      if (snapshot.minimized || snapshot.history) instance.pinned=false;
      if (instance.pinned && !snapshot.minimized && !snapshot.expanded && !snapshot.history) snapshot.expand();
      if (!snapshot.showPin) { instance.button?.remove(); instance.button=null; render(instance); continue; }
      const anchor = snapshot.anchor;
      if (!instance.button?.isConnected || instance.button.parentElement !== anchor.parentElement) {
        instance.button?.remove();
        const button = document.createElement('button');
        button.type='button'; button.setAttribute('data-mcx-quick-chat-pin',''); button.innerHTML=config.resources.pin;
        const icon=button.querySelector('svg'), original=anchor.querySelector('svg');
        for (const attr of ['width','height','class']) if (original?.hasAttribute(attr)) icon?.setAttribute(attr,original.getAttribute(attr));
        icon?.setAttribute('aria-hidden','true');
        button.addEventListener('pointerdown',event=>event.stopPropagation(),{signal});
        button.addEventListener('click',event=>{event.stopPropagation();instance.pinned=!instance.pinned;render(instance);},{signal});
        anchor.before(button); instance.button=button;
      }
      if (instance.button.className !== anchor.className) instance.button.className=anchor.className;
      render(instance);
    }
    for (const [id,instance] of instances) if (!live.has(id)) { release(instance); instances.delete(id); }
  }
  function escape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || event.isComposing) return;
    for (const instance of instances.values()) if (instance.layer.contains(event.target)) { instance.pinned=false; render(instance); }
  }
  document.addEventListener('keydown',escape,{capture:true,signal});
  function dispose() { document.removeEventListener('keydown',escape,true); for (const instance of instances.values()) release(instance); instances.clear(); style.remove(); }
  function status() { const applicable=native.surfaces().some(snapshot=>snapshot.showPin); return {applicable,available:applicable && [...instances.values()].some(instance=>instance.button?.isConnected)}; }
  return {sync,dispose,status};
}
