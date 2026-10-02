// Codex 的公共原生契约只在此解释；返回锚点句柄与内部身份。
export function createCodexEnvironment() {
  const capabilities = new Map();
  function report(name, available, reason = null) {
    capabilities.set(name, { name, available, reason });
  }
  function currentFiber(element) {
    while (element && !Object.getOwnPropertyNames(element).some(key=>key.startsWith("__reactFiber"))) element=element.parentElement;
    const keys = Object.getOwnPropertyNames(element ?? {});
    let fiber = element?.[keys.find(key => key.startsWith("__reactFiber"))];
    const props = element?.[keys.find(key => key.startsWith("__reactProps"))];
    if (props && fiber?.alternate?.memoizedProps === props && fiber.memoizedProps !== props) fiber = fiber.alternate;
    return fiber;
  }
  function props(element, predicate, limit = 200) {
    for (let fiber = currentFiber(element), depth = 0; fiber && depth < limit; fiber = fiber.return, depth++) {
      if (predicate(fiber.memoizedProps ?? {})) return fiber.memoizedProps;
    }
    return null;
  }
  function composer(element = null, {threadOnly=true, purpose="thread"} = {}) {
    const insertion = purpose === "insertion";
    const rootSelector = insertion ? '[data-codex-composer-root], [data-chatgpt-composer]' : '[data-codex-composer-root]';
    const candidates = element ? [element] : [...document.querySelectorAll(insertion
      ? '[data-codex-composer="true"][contenteditable="true"], [data-chatgpt-composer] [data-composer-markdown][contenteditable="true"]'
      : '[data-codex-composer="true"][contenteditable="true"]')];
    if (!element && insertion) candidates.sort((a,b) => Number(Boolean(b.closest(rootSelector)?.contains(document.activeElement))) - Number(Boolean(a.closest(rootSelector)?.contains(document.activeElement))));
    for (const editable of candidates) {
      const root = editable.closest(rootSelector);
      if (!editable.isConnected || !root || (!insertion && threadOnly && root.getAttribute('data-composer-placement') !== 'thread')
        || editable.closest(insertion ? '[hidden], [inert], [aria-hidden="true"]' : '[hidden], [inert], [aria-hidden="true"], [data-floating-chat-surface], [data-right-panel-composer-overlay-content]')
        || !editable.checkVisibility({ visibilityProperty:true })) continue;
      const value = root.getAttribute('data-composer-placement') === 'thread' ? root.querySelector('[data-above-composer-portal]')?.getAttribute('data-above-composer-conversation-id') : null;
      const threadId = value?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
      report("composer", true);
      return { editable, root, body:editable.closest('[data-composer-body]'), threadId,
        add:root.querySelector('[data-composer-navigation-target="add-context"]') };
    }
    report("composer", false, "active-thread-composer-unavailable");
    return null;
  }
  // 状态属于会话外壳；发送时编辑区可能 inert 或重建，不代表离开会话。
  function composerSurface(element = null) {
    const roots = element ? [element.closest('[data-codex-composer-root]')] : document.querySelectorAll('[data-codex-composer-root]');
    for (const root of roots) {
      if (!root?.isConnected || root.getAttribute('data-composer-placement') !== 'thread'
        || root.closest('[hidden], [aria-hidden="true"], [data-floating-chat-surface], [data-right-panel-composer-overlay-content]')
        || !root.checkVisibility({visibilityProperty:true})) continue;
      const value = root.querySelector('[data-above-composer-portal]')?.getAttribute('data-above-composer-conversation-id');
      const threadId = value?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
      return {root,threadId};
    }
    return null;
  }
  function rail() {
    const node = [...document.querySelectorAll('[data-app-navigation-rail]')].find(node => node.getBoundingClientRect().width > 0) ?? null;
    report("navigation-rail", Boolean(node), node ? null : "rail-unavailable");
    return node;
  }
  function railSlot(ownGroup) {
    const node = rail();
    const template = node?.querySelector('[data-sidebar-destination="builtin:projects"]')
      ?? node?.querySelector('[data-sidebar-destination="builtin:library"]');
    const scroll = node?.querySelector('.overflow-y-auto');
    const group = [...(scroll?.children ?? [])].find(child => child !== ownGroup && child.classList.contains('flex-col') && child.classList.contains('shrink-0'));
    return node && template && scroll ? { rail:node, template, scroll, group } : null;
  }
  return { composer, composerSurface, rail, railSlot, currentThreadId:element => composer(element)?.threadId ?? null,
    // 仅供 UI／插件 native Adapter 使用，交互层不读取 React props。
    currentFiber, props, report, diagnostics:() => [...capabilities.values()].map(item => ({...item})) };
}
