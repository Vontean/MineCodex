// 订阅原生额度缓存；不另行轮询，也不复制账号信息到插件服务。
const MARKER = "data-minecodex-usage-meter";
const TIP_ID = "minecodex-usage-tooltip";
const STYLE_ID = "minecodex-usage-style";
let record = null;
let client = null;
let unsubscribe = null;
let queued = false;
let hoverTimer = null;

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
  const key = Object.keys(rail).find(key => key.startsWith("__reactFiber$"));
  let fiber = key ? rail[key] : null;
  const result = { auth: null, client: null, router: null };
  for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (!props) continue;
    for (const value of [props.auth, props.value]) {
      if (!result.auth && value && typeof value === "object" && "authMethod" in value && "userId" in value && "accountId" in value) result.auth = value;
    }
    for (const value of [props.queryClient, props.client, props.value]) {
      if (!result.client && typeof value?.getQueryCache === "function" && typeof value?.getQueryData === "function") result.client = value;
    }
    const router = props.router ?? props.value?.router;
    if (!result.router && typeof router?.navigate === "function") result.router = router;
    if (result.auth && result.client && result.router) break;
  }
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

const style = document.createElement("style");
style.id = STYLE_ID;
style.textContent = `
[${MARKER}] { position:relative; display:flex; align-items:center; justify-content:center; flex:none; color:var(--color-text-tertiary); -webkit-app-region:no-drag; }
[${MARKER}] .mcx-usage-ring { display:block; width:24px; height:24px; overflow:visible; }
[${MARKER}] .mcx-usage-number { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:inherit; font-family:var(--font-sans-default); font-size:calc(var(--text-xs) * 2 / 3); line-height:1; font-weight:var(--font-weight-medium,500); letter-spacing:0; font-variant-numeric:tabular-nums; pointer-events:none; }
[${MARKER}] [data-window="weekly"] { color:inherit; }
[${MARKER}] [data-window="fiveHour"] { color:var(--color-text-secondary); }
#${TIP_ID} { position:fixed; z-index:2147483000; width:max-content; max-width:calc(100vw - 16px); pointer-events:none; user-select:none; padding:5px 12px; border:1px solid var(--color-border-tooltip); border-radius:var(--radius-2xl); background:var(--color-background-tooltip); color:var(--color-text-tooltip); box-shadow:var(--shadow-tooltip); font-family:var(--font-sans-default); font-size:var(--text-sm); line-height:18px; font-weight:var(--tooltip-compact-font-weight); letter-spacing:var(--tracking-tooltip); }
#${TIP_ID}[hidden] { display:none; }
#${TIP_ID} dl { display:grid; grid-template-columns:auto auto; gap:2px 16px; margin:0; }
#${TIP_ID} dt { text-align:left; }
#${TIP_ID} dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; }
`;
document.head.append(style);

function svgNode(name, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function draw(windows) {
  const svg = svgNode("svg", { viewBox: "0 0 32 32", class: "mcx-usage-ring", "aria-hidden": "true" });
  for (const [key, radius] of [["weekly", 43 / 3], ["fiveHour", 10.5]]) {
    if (windows[key] == null) continue;
    const group = svgNode("g", { "data-window": key, fill: "none", stroke: "currentColor", "stroke-width": 10 / 3 });
    group.append(svgNode("circle", { cx: 16, cy: 16, r: radius, opacity: 0.18 }));
    if (windows[key] > 0) group.append(svgNode("circle", {
      cx: 16, cy: 16, r: radius, pathLength: 100,
      "stroke-dasharray": `${windows[key]} 100`, "stroke-linecap": "round", transform: "rotate(-90 16 16)",
    }));
    svg.append(group);
  }
  const number = document.createElement("span");
  number.className = "mcx-usage-number";
  number.textContent = String(windows.primary);
  number.setAttribute("data-dual", String(windows.fiveHour != null));
  number.setAttribute("data-digits", String(number.textContent.length));
  record.button.replaceChildren(svg, number);
  const list = document.createElement("dl");
  const rows = windows.fiveHour == null ? [] : [["5h Limit", windows.fiveHour]];
  rows.push(["Weekly Limit", windows.weekly]);
  for (const [label, percent] of rows) {
    const term = document.createElement("dt"), value = document.createElement("dd");
    term.textContent = label;
    value.textContent = `${percent}%`;
    list.append(term, value);
  }
  record.tooltip.replaceChildren(list);
  record.button.setAttribute("aria-label", rows.map(([label, percent]) => `${label} ${percent}%`).join(", "));
  record.button.setAttribute("aria-description", "Open Usage settings");
  if (!record.tooltip.hidden) positionTooltip();
}

function positionTooltip() {
  if (!record) return;
  const rect = record.button.getBoundingClientRect();
  const tooltip = record.tooltip;
  // 按物理视口定位，兼容原生 app-shell 的 CSS zoom。
  tooltip.style.left = `${Math.max(8, Math.min(rect.right + 2, window.innerWidth - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(rect.top + (rect.height - tooltip.offsetHeight) / 2, window.innerHeight - tooltip.offsetHeight - 8))}px`;
}

function showTooltip() {
  clearTimeout(hoverTimer);
  if (!record) return;
  record.tooltip.hidden = false;
  record.button.setAttribute("aria-describedby", TIP_ID);
  positionTooltip();
}
function hideTooltip() {
  clearTimeout(hoverTimer);
  if (!record) return;
  record.tooltip.hidden = true;
  record.button.removeAttribute("aria-describedby");
}
function removeControl() {
  hideTooltip();
  record?.button.remove();
  record?.tooltip.remove();
  record = null;
}

function findAvatar(rail) {
  const buttons = [...(rail?.querySelectorAll("button") ?? [])];
  return buttons.find(button => /\b(account|profile|avatar|user)\b|账户|帐户|个人资料|头像/i.test(button.getAttribute("aria-label") ?? ""))
    ?? buttons.find(button => button.matches('[data-sidebar-destination="builtin:account"]'))
    ?? buttons.findLast(button => button.querySelector('img[alt], img[src], [data-avatar]'))
    ?? null;
}

function avatarAnchor(avatar) {
  return avatar.parentElement?.classList.contains("contents") ? avatar.parentElement : avatar;
}

function mount(avatar, rail) {
  // 克隆 Avatar 热区的外观，不携带原生账号菜单行为。
  const button = avatar.cloneNode(false);
  for (const attribute of [...button.attributes]) {
    if (attribute.name.startsWith("aria-") || ["id", "title", "data-state", "data-sidebar-destination", "data-testid"].includes(attribute.name)) button.removeAttribute(attribute.name);
  }
  button.setAttribute(MARKER, "");
  const tooltip = document.createElement("div");
  tooltip.id = TIP_ID;
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  avatarAnchor(avatar).before(button);
  document.body.append(tooltip);
  record = { button, tooltip, rail, avatar, signature: null };
  button.addEventListener("pointerenter", () => { hoverTimer = setTimeout(showTooltip, 350); });
  button.addEventListener("pointerleave", hideTooltip);
  button.addEventListener("focus", showTooltip);
  button.addEventListener("blur", hideTooltip);
  button.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); hideTooltip(); } });
  button.addEventListener("click", () => {
    hideTooltip();
    const { router } = nativeContext(rail);
    router?.navigate("/settings/usage?tab=overview", { state: router.state?.location?.state });
  });
}

function sync() {
  queued = false;
  if (signal.aborted) return;
  const rail = [...document.querySelectorAll('nav[data-app-navigation-rail="true"]')].find(rail => rail.getBoundingClientRect().width > 0);
  const avatar = findAvatar(rail);
  const context = rail ? nativeContext(rail) : {};
  if (client !== context.client) {
    unsubscribe?.();
    client = context.client;
    unsubscribe = client?.getQueryCache().subscribe(event => {
      if (event.query?.queryKey?.[0] === "rate-limit-status") schedule();
    });
  }
  const windows = currentWindows(context);
  if (!avatar || !context.router || !windows) { removeControl(); return; }
  if (record?.avatar !== avatar || !record?.button.isConnected) { removeControl(); mount(avatar, rail); }
  else if (record.button.nextElementSibling !== avatarAnchor(avatar)) avatarAnchor(avatar).before(record.button);
  const signature = JSON.stringify(windows);
  if (record.signature !== signature) { record.signature = signature; draw(windows); }
}
function schedule() {
  if (queued || signal.aborted) return;
  queued = true;
  queueMicrotask(sync);
}
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
window.addEventListener("resize", positionTooltip);
window.addEventListener("focus", schedule);
const cleanup = () => {
  observer.disconnect();
  unsubscribe?.();
  window.removeEventListener("resize", positionTooltip);
  window.removeEventListener("focus", schedule);
  removeControl();
  style.remove();
};
signal.addEventListener("abort", cleanup, { once: true });
sync();
return cleanup;
