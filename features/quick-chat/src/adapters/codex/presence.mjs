export function createQuickChatExitAdapter(codex) {
  const completed = new WeakSet();
  const selector = '.fixed.inset-0.zoom-adjusted-viewport.pointer-events-auto';
  function currentLayer(layer) {
    const attached = codex.currentFiber(layer);
    let host = attached;
    while (host?.return) host = host.return;
    const current = host?.stateNode?.current;
    if (!current) return attached;
    // Host props 可原样复用，DOM 上的 Fiber 因此可能仍指向上一棵树。
    const pending = [current];
    let visited = 0;
    while (pending.length && visited++ < 10000) {
      const fiber = pending.pop();
      if (fiber.stateNode === layer) return fiber;
      for (let child = fiber.child; child; child = child.sibling) pending.push(child);
    }
    return null;
  }
  function presence(fiber) {
    for (let dependency = fiber.dependencies?.firstContext; dependency; dependency = dependency.next) {
      const context = dependency.memoizedValue;
      if (context?.isPresent === false && typeof context.register === 'function' && typeof context.onExitComplete === 'function') return context;
    }
    return null;
  }
  function completion(fiber) {
    const props = fiber.memoizedProps;
    if (props?.propagate !== true || fiber.child || typeof fiber.type !== 'function') return null;
    const source = Function.prototype.toString.call(fiber.type);
    if (!source.includes('presenceAffectsLayout:') || !source.includes('propagate:') || !source.includes('.useState)')) return null;
    const context = presence(fiber);
    if (!context) return null;
    for (let hook = fiber.memoizedState, count = 0; hook && count < 40; hook = hook.next, count++) {
      const value = hook.memoizedState;
      if (!Array.isArray(value) || typeof value[0] !== 'function') continue;
      const deps = value[1];
      if (!Array.isArray(deps) || deps.length !== 3 || typeof deps[0] !== 'string' || deps[1] !== context.onExitComplete || deps[2] !== true) continue;
      // 仅补齐仍未完成的 usePresence 登记，不绕过父层或其他子动画。
      for (let parent = fiber.return, depth = 0; parent && depth < 40; parent = parent.return, depth++) {
        if (parent.memoizedProps?.value !== context) continue;
        for (let owner = parent.return, level = 0; owner && level < 5; owner = owner.return, level++) {
          for (let state = owner.memoizedState, n = 0; state && n < 20; state = state.next, n++) {
            const map = state.memoizedState?.current;
            if (map instanceof Map && map.get(deps[0]) === false) return value[0];
          }
        }
        return null;
      }
    }
    return null;
  }
  function repair(layer) {
    if (!layer.isConnected) return 0;
    let root = currentLayer(layer);
    for (let depth = 0; root && depth < 40; root = root.return, depth++) {
      if (typeof root.memoizedProps?.isPresent === 'boolean' && typeof root.memoizedProps?.onExitComplete === 'function') break;
    }
    if (!root || root.memoizedProps.isPresent !== false) return 0;
    const pending = [root];
    const completions = [];
    let quickChat = false, count = 0, visited = 0;
    while (pending.length && visited++ < 1000) {
      const fiber = pending.pop(), finish = completion(fiber);
      if (fiber.memoizedProps?.name === 'QuickChatWindow') quickChat = true;
      if (finish && !completed.has(finish)) completions.push(finish);
      for (let child = fiber.child; child; child = child.sibling) pending.push(child);
    }
    if (!quickChat || pending.length) return 0;
    for (const finish of completions) { completed.add(finish); finish(); count++; }
    return count;
  }
  return { selector, repair, reconcile:() => [...document.querySelectorAll(selector)].reduce((count, layer) => count + repair(layer), 0) };
}
