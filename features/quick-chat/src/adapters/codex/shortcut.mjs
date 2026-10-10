// 通过原生能力检查与已有会话分支定位打开动作，不依赖构建哈希或压缩名称。
export function quickChatOpenExport(source) {
  const match = source.match(/function ([\w$]+)\(([\w$]+),[\w$]+=\{\}\)\{if\(!\2\.get\([\w$]+,\{name:[`"']chatgpt\.quick-chat[`"']\}\)\.isCapable\)return;let [\w$]+=\2\.get\([\w$]+\),[\w$]+=\2\.get\([\w$]+\);if\(/);
  if (!match) throw new Error('quick-chat-open-contract-unavailable');
  const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = source.slice(source.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${escaped} as ([\\w$]+)(?:,|\\})`))?.[1];
  if (!name) throw new Error('quick-chat-open-export-unavailable');
  return name;
}

export function installQuickChatShortcut(signal, codex, discover = null) {
  let bindings = null, disposed = false;
  function activateExisting() {
    // 原生恢复按钮同时恢复 presentation、取消最小化并聚焦输入框。
    for (const button of document.querySelectorAll('button')) {
      if (!button.checkVisibility({visibilityProperty:true})) continue;
      const floating = codex.props(button, p => p.unifiedDocking === true && typeof p.onMinimizedChange === 'function' && typeof p.onPresentationChange === 'function');
      if (!floating?.isMinimized || floating.isHidden) continue;
      const restore = codex.props(button, p => p.uniform === true && p.size === 'composer' && typeof p.onClick === 'function'
        && typeof p.onPointerEnter === 'function' && typeof p.onPointerDown === 'function' && typeof p.onKeyDown === 'function');
      if (!restore) continue;
      button.click();
      return true;
    }
    for (const surface of document.querySelectorAll('[data-floating-chat-surface]')) {
      if (surface.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      const floating = codex.props(surface, p => p.unifiedDocking === true && typeof p.onMinimizedChange === 'function' && typeof p.onPresentationChange === 'function');
      if (!floating || floating.isMinimized || floating.isHidden) continue;
      const editable = surface.querySelector('[data-chatgpt-composer] [contenteditable="true"]');
      if (!editable?.checkVisibility({visibilityProperty:true})) continue;
      editable.focus({preventScroll:true});
      return true;
    }
    return false;
  }
  function context() {
    for (const button of document.querySelectorAll('button[aria-haspopup="menu"]')) {
      if (!button.checkVisibility({visibilityProperty:true})) continue;
      const mode = codex.props(button, p => typeof p.onModeSelect === 'function' && typeof p.mode === 'string', 80)?.mode;
      if (mode !== 'codex') continue;
      for (let fiber = codex.currentFiber(button), depth = 0; fiber && depth++ < 200; fiber = fiber.return) {
        const values = [];
        for (let hook = fiber.memoizedState, n = 0; hook && n++ < 150; hook = hook.next) values.push(hook.memoizedState?.current);
        for (const row of fiber.updateQueue?.memoCache?.data ?? []) values.push(...row);
        const scope = values.find(v => typeof v?.get === 'function' && typeof v.set === 'function' && v.scope?.__scopeBrand === 'AppScope');
        if (scope) return scope;
      }
    }
    return null;
  }
  async function load() {
    const url = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(e => e.href || e.src).find(url => /\/app-initial-[^/]+\.js(?:$|\?)/.test(url));
    if (!url) throw new Error('quick-chat-module-unavailable');
    const source = await (await fetch(url, {signal})).text();
    const module = await import(url);
    const commands = Object.values(module).find(v => Array.isArray(v) && v.some(c => c?.id === 'temporaryChat') && v.some(c => c?.id === 'newTask'));
    if (!commands) throw new Error('quick-chat-command-catalog-unavailable');
    if (commands.some(c => c.id === 'quickChat')) return {native:true};
    const open = module[quickChatOpenExport(source)];
    if (typeof open !== 'function') throw new Error('quick-chat-open-action-unavailable');
    return {native:false, open};
  }
  const ready = (discover ?? load)().then(value => {
    if (disposed || signal.aborted) return;
    bindings = value;
    codex.report('quick-chat-shortcut', true);
  }).catch(() => { if (!disposed && !signal.aborted) codex.report('quick-chat-shortcut', false, 'native-shortcut-contract-unavailable'); });
  function keydown(event) {
    if (disposed || signal.aborted || bindings?.native || event.defaultPrevented || event.repeat || event.isComposing
      || !event.metaKey || !event.altKey || event.ctrlKey || event.shiftKey || event.code !== 'KeyN') return;
    if (!activateExisting()) {
      const scope = bindings && context();
      if (!scope) return;
      bindings.open(scope);
    }
    event.preventDefault();
    event.stopPropagation();
  }
  document.addEventListener('keydown', keydown, {signal});
  function dispose() { disposed = true; document.removeEventListener('keydown', keydown); bindings = null; }
  signal.addEventListener('abort', dispose, {once:true});
  return {ready, dispose};
}
