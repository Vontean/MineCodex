export function createUsageAdapter(signal, codex, invalidate) {
  let client=null,unsubscribe=null;
function remainingWindows(data, updatedAt) {
  const windows = [data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window];
  const remaining = seconds => {
    const window = windows.find(window => window?.limit_window_seconds === seconds);
    return typeof window?.used_percent === "number" && Number.isFinite(window.used_percent)
      ? Math.round(Math.max(0, Math.min(100, 100 - window.used_percent))) : null;
  };
  const weekly = remaining(604800), fiveHour = remaining(18000);
  const resetAt = seconds => {
    const window = windows.find(window => window?.limit_window_seconds === seconds);
    if (typeof window?.reset_at === "number" && Number.isFinite(window.reset_at) && window.reset_at > 0) return window.reset_at * 1000;
    // 相对秒数绑定缓存更新时间，不能随着每次读取顺延。
    if (typeof window?.reset_after_seconds === "number" && Number.isFinite(window.reset_after_seconds) && window.reset_after_seconds >= 0 && Number.isFinite(updatedAt) && updatedAt > 0) return updatedAt + window.reset_after_seconds * 1000;
    return null;
  };
  return weekly == null ? null : { weekly, fiveHour, primary: fiveHour ?? weekly,
    resetAt: { weekly: resetAt(604800), fiveHour: fiveHour == null ? null : resetAt(18000) } };
}
function nativeContext(rail) {
  const result = { auth:null,client:null,router:null };
  codex.props(rail, props => {
    for (const value of [props.auth,props.value]) if (!result.auth && value && typeof value === "object" && "authMethod" in value && "userId" in value && "accountId" in value) result.auth=value;
    for (const value of [props.queryClient,props.client,props.value]) if (!result.client && typeof value?.getQueryCache === "function" && typeof value?.getQueryData === "function") result.client=value;
    const router=props.router ?? props.value?.router;
    if (!result.router && typeof router?.navigate === "function") result.router=router;
    return Boolean(result.auth && result.client && result.router);
  });
  return result;
}
function currentWindows(context) {
  const { auth, client } = context;
  if (auth?.isLoading || !auth?.userId || !auth?.accountId || !["chatgpt", "chatgptAuthTokens"].includes(auth.authMethod)) return {windows:null,reason:"account-unavailable"};
  // 只依赖查询族；Codex 可在键尾增加身份或宿主范围。响应身份才是归属依据。
  const queries = client?.getQueryCache().findAll({queryKey:["rate-limit-status"]}) ?? [];
  const current = queries.filter(query => query.state.data?.user_id === auth.userId
    && query.state.data?.account_id === auth.accountId)
    .sort((a,b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0))[0];
  if (!current) return {windows:null,reason:queries.some(query => query.state.data)
    ? "current-account-quota-unavailable" : "quota-cache-pending"};
  const windows=remainingWindows(current.state.data,current.state.dataUpdatedAt);
  return {windows,reason:windows ? null : "quota-window-contract-unavailable"};
}
function findAvatar(rail) {
  const buttons = [...(rail?.querySelectorAll("button") ?? [])];
  return buttons.find(button => /\b(account|profile|avatar|user)\b|账户|帐户|个人资料|头像/i.test(button.getAttribute("aria-label") ?? ""))
    ?? buttons.find(button => button.matches('[data-sidebar-destination="builtin:account"]'))
    ?? buttons.findLast(button => button.querySelector('img[alt], img[src], [data-avatar]'))
    ?? null;
}
function findUsage(rail) {
  // 原生图表的轨道 token 是语义锚点，避免依赖构建生成的 class 或界面语言。
  return [...(rail?.querySelectorAll("button") ?? [])].find(button =>
    !button.hasAttribute?.("data-minecodex-usage-meter") &&
    (button.querySelector?.('[stroke="var(--color-usage-meter-track)"]') ||
      /^(Usage|用量|使用量|使用情况|使用情況)$/.test(button.getAttribute("aria-label") ?? ""))) ?? null;
}
function avatarAnchor(avatar, rail) {
  // 头像内部是横向行；在最近的原生纵向容器中插入独立一项。
  let anchor = avatar;
  while (anchor.parentElement !== rail && !anchor.parentElement.classList.contains("flex-col")) {
    anchor = anchor.parentElement;
  }
  return anchor;
}
  function read() {
    const rail=codex.rail(), context=rail ? nativeContext(rail) : {};
    if (client !== context.client) {
      unsubscribe?.(); client=context.client;
      unsubscribe=client?.getQueryCache().subscribe(event=>{ if (event.query?.queryKey?.[0] === "rate-limit-status") invalidate(); });
    }
    const {windows,reason:quotaReason}=currentWindows(context), avatar=findAvatar(rail), usage=findUsage(rail);
    const available=Boolean((usage || avatar) && context.router && windows);
    const reason=available ? null : !rail ? "rail-unavailable" : !(usage || avatar)
      ? "usage-anchor-unavailable" : !context.router ? "usage-navigation-unavailable" : quotaReason;
    codex.report("usage-meter",available,reason);
    return { rail,avatar,usage,windows,available,reason,anchorAvailable:Boolean((usage || avatar) && context.router),
      applicable:context.auth?.isLoading ? null : context.auth ? ["chatgpt","chatgptAuthTokens"].includes(context.auth.authMethod) : null };
  }
  function open(rail) { const {router}=nativeContext(rail); return router?.navigate("/settings/usage?tab=overview",{state:router.state?.location?.state}); }
  signal.addEventListener("abort",()=>unsubscribe?.(),{once:true});
  return { read,open,anchor:avatarAnchor,
    conceal: usage => usage?.setAttribute("data-minecodex-native-usage", ""),
    reveal: usage => usage?.removeAttribute("data-minecodex-native-usage") };

}
