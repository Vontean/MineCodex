// 原生页面壳由路由决定；借用 Projects 的无上下文侧栏壳，不改侧栏展开偏好。
export function createNativePageAdapter(codex) {
  function standalone({ onNavigate } = {}) {
    const rail = codex.rail();
    const scope = codex.props(rail, props => Boolean((props.router ?? props.value?.router)?.navigate));
    const router = scope?.router ?? scope?.value?.router;
    const origin = router?.state?.location;
    if (!origin) throw new Error("The native page navigation was not found");
    if (onNavigate && typeof router.subscribe !== "function") throw new Error("The native page navigation subscription was not found");
    const target = "/projects";
    const changed = origin.pathname !== target;
    if (changed) void router.navigate(target, { replace:true, state:origin.state });
    let released = false;
    let unsubscribe = null;
    let shell = router.state.location.pathname === target ? router.state.location : null;
    const lease = {
      release({ restoreNavigation=true } = {}) {
        if (released) return;
        released = true;
        unsubscribe?.();
        if (changed && restoreNavigation && router.state.location.pathname === target)
          void router.navigate(origin, { replace:true, state:origin.state });
      },
    };
    if (onNavigate) unsubscribe = router.subscribe(state => {
      if (released || (state.navigation?.state && state.navigation.state !== "idle")) return;
      const location = state.location;
      // 等待借用页面壳的首次提交；hover 和 loader 通知不代表用户离开。
      if (!shell && location === origin) return;
      if (!shell && location.pathname === target) { shell = location; return; }
      if (location === shell) return;
      lease.release({ restoreNavigation:false });
      onNavigate();
    });
    return lease;
  }
  return { standalone };
}
