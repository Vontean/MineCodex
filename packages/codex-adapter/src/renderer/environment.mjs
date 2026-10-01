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
  function composer(element = null, {threadOnly=true} = {}) {
    const candidates = element ? [element] : document.querySelectorAll('[data-codex-composer="true"][contenteditable="true"]');
    for (const editable of candidates) {
      const root = editable.closest('[data-codex-composer-root]');
      if (!editable.isConnected || !root || (threadOnly && root.getAttribute('data-composer-placement') !== 'thread')
        || editable.closest('[hidden], [inert], [aria-hidden="true"], [data-floating-chat-surface], [data-right-panel-composer-overlay-content]')
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
  return { composer, rail, railSlot, currentThreadId:element => composer(element)?.threadId ?? null,
    // 仅供 UI／插件 native Adapter 使用，交互层不读取 React props。
    currentFiber, props, report, diagnostics:() => [...capabilities.values()].map(item => ({...item})) };
}
