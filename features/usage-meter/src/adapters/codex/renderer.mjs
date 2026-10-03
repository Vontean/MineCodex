export function createUsageAdapter(signal, codex, invalidate) {
  let client=null,unsubscribe=null;
function remainingWindows(data) {
  const windows = [data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window];
  const remaining = seconds => {
    const window = windows.find(window => window?.limit_window_seconds === seconds);
    return typeof window?.used_percent === "number" && Number.isFinite(window.used_percent)
      ? Math.round(Math.max(0, Math.min(100, 100 - window.used_percent))) : null;
  };
  const weekly = remaining(604800), fiveHour = remaining(18000);
  return weekly == null ? null : { weekly, fiveHour, primary: fiveHour ?? weekly };
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
  if (auth?.isLoading || !auth?.userId || !auth?.accountId || !["chatgpt", "chatgptAuthTokens"].includes(auth.authMethod)) return null;
  const data = client?.getQueryData(["rate-limit-status"]);
  // 账号与缓存必须同时一致；旧账号的最后一次响应不能留在导航栏。
  if (!data || data.user_id !== auth.userId || data.account_id !== auth.accountId) return null;
  return remainingWindows(data);
}
function findAvatar(rail) {
  const buttons = [...(rail?.querySelectorAll("button") ?? [])];
  return buttons.find(button => /\b(account|profile|avatar|user)\b|账户|帐户|个人资料|头像/i.test(button.getAttribute("aria-label") ?? ""))
    ?? buttons.find(button => button.matches('[data-sidebar-destination="builtin:account"]'))
    ?? buttons.findLast(button => button.querySelector('img[alt], img[src], [data-avatar]'))
    ?? null;
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
    const windows=currentWindows(context), avatar=findAvatar(rail);
    const available=Boolean(avatar && context.router && windows);
    codex.report("usage-meter",available,available ? null : "account-quota-or-anchor-unavailable");
    return { rail,avatar,windows,available,anchorAvailable:Boolean(avatar && context.router),
      applicable:context.auth?.isLoading ? null : context.auth ? ["chatgpt","chatgptAuthTokens"].includes(context.auth.authMethod) : null };
  }
  function open(rail) { const {router}=nativeContext(rail); return router?.navigate("/settings/usage?tab=overview",{state:router.state?.location?.state}); }
  signal.addEventListener("abort",()=>unsubscribe?.(),{once:true});
  return { read,open,anchor:avatarAnchor };
}
