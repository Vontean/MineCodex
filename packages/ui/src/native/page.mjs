// 原生页面壳由路由决定；借用 Projects 的无上下文侧栏壳，不改侧栏展开偏好。
export function createNativePageAdapter(codex) {
  function standalone() {
    const rail = codex.rail();
    const scope = codex.props(rail, props => Boolean((props.router ?? props.value?.router)?.navigate));
    const router = scope?.router ?? scope?.value?.router;
    const origin = router?.state?.location;
    if (!origin) throw new Error("The native page navigation was not found");
    const target = "/projects";
    const changed = origin.pathname !== target;
    if (changed) void router.navigate(target, { replace:true, state:origin.state });
    let released = false;
    return {
      release({ restoreNavigation=true } = {}) {
        if (released) return;
        released = true;
        if (changed && restoreNavigation && router.state.location.pathname === target)
          void router.navigate(origin, { replace:true, state:origin.state });
      },
    };
  }
  return { standalone };
}
