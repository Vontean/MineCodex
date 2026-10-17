const nativeFocus = createFocusAdapter(config.codex);
const COLLAPSE_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 5 3 3 3-3\" />\n  <path d=\"m15 19 3-3 3 3\" />\n</svg>\n";
const EXPAND_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 8 3-3 3 3\" />\n  <path d=\"m15 16 3 3 3-3\" />\n</svg>\n";


const states = new Map();
const layouts = new Map();
let active = false, restoring = false, button, currentBell, currentMode, timer = null, disposed = false;
const text = (en, cn) => (document.documentElement.lang || navigator.language).startsWith("zh") ? cn : en;


function remember(items) {
  for (const item of items) if (!states.has(item.key)) states.set(item.key, item.expanded);
}

function reconcile() {
  if (disposed) return;
  const sidebar = document.querySelector("#app-shell-sidebar");
  const bell = nativeFocus.activity();
  if (!bell) { button?.remove(); button = null; return; }
  const mode = nativeFocus.mode(bell);
  if (currentMode && currentMode !== mode) {
    // 两种模式分别保留恢复快照，不能把旧页面布局应用到新页面。
    layouts.set(currentMode, {active, restoring, states:new Map(states)});
    const saved = layouts.get(mode);
    button?.remove(); button = null;
    active = saved?.active ?? false; restoring = saved?.restoring ?? false;
    states.clear();
    for (const [key, expanded] of saved?.states ?? []) states.set(key, expanded);
  }
  if (currentBell !== bell) { button?.remove(); button = null; }
  currentBell = bell;
  currentMode = mode;
  if (!button?.isConnected) {
    button = bell.cloneNode(false);
    button.removeAttribute("id");
    button.setAttribute("data-minecodex-focus", "");
    // 复用原生内层容器，由其负责图标在热区内居中。
    const inner = bell.firstElementChild.cloneNode(false);
    inner.innerHTML = COLLAPSE_GLYPH;
    button.replaceChildren(inner);
    button.removeAttribute("title");
    button.removeAttribute("aria-describedby");
    button.addEventListener("click", () => {
      if (active) { active = false; restoring = true; }
      else { states.clear(); remember(nativeFocus.branches()); active = true; }
      schedule();
    }, { signal });
    // 作为原生按钮组的独立子项，继承组内 gap，不放进铃铛的 Tooltip 包装层。
    let anchor = bell;
    while (anchor.parentElement && anchor.parentElement !== sidebar) {
      const layout = getComputedStyle(anchor.parentElement);
      // 跳过零间距的通知包装层，接入真正带原生 gap 的按钮组。
      if (["flex", "inline-flex"].includes(layout.display) && Number.parseFloat(layout.columnGap) > 0) break;
      anchor = anchor.parentElement;
    }
    anchor.after(button);
  }
  const label = active ? text("Restore layout", "恢复布局") : text("Focus current task", "聚焦当前任务");
  if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
  button.setAttribute("data-minecodex-tooltip", label);
  const pressed = String(active);
  if (button.getAttribute("aria-pressed") !== pressed) {
    button.setAttribute("aria-pressed", pressed);
    button.firstElementChild.innerHTML = active ? EXPAND_GLYPH : COLLAPSE_GLYPH;
  }
  // 图标表达下一步操作；保持中性按钮，不显示持续模式的选中底色。
  button.setAttribute("data-color", "secondary");
  button.setAttribute("data-variant", "ghost");
  const items = nativeFocus.branches(), path = nativeFocus.target(items);
  const activityActive = bell.getAttribute("aria-pressed") === "true";
  button.disabled = activityActive || (!active && !restoring && !path);
  if (activityActive) return;
  if (restoring) {
    // 先恢复已挂载的子分支，再恢复分类，避免父节点收起后子节点消失。
    const change = items.filter(b => b.key.startsWith("project:")).concat(items.filter(b => b.key.startsWith("section:")))
      .find(b => states.has(b.key) && states.get(b.key) !== b.expanded);
    if (change) { change.toggle(); schedule(); }
    else { restoring = false; states.clear(); }
    return;
  }
  if (!active || !path) return;
  remember(items);
  // 一次只触发一个原生更新；等待 React 挂载新分支后重新计算路径。
  const change = items.find(b => b === path.section && !b.expanded)
    || items.find(b => b.key.startsWith("project:") && b.expanded !== (path.section.element.contains(b.element) ? b === path.project : states.get(b.key)))
    || items.find(b => b.key.startsWith("section:") && b.expanded !== (b === path.section));
  if (change) { change.toggle(); schedule(); }
}
function schedule() {
  if (disposed || timer !== null) return;
  timer = requestAnimationFrame(() => { timer = null; reconcile(); });
}
document.addEventListener("click", event => {
  if (!active || !event.isTrusted) return;
  if (nativeFocus.isBranchToggle(event.target)) {
    active = false; states.clear(); schedule();
  }
}, { capture:true, signal });
const observer = new MutationObserver(records => {
  // 流式回复等侧栏外更新不应推迟或重复触发布局整理。
  if (records.some(record =>
    record.target.closest?.("#app-shell-sidebar")
    || record.type === "attributes" && ["data-above-composer-conversation-id", "lang"].includes(record.attributeName)
    || [...record.addedNodes ?? [], ...record.removedNodes ?? []].some(node =>
      node.matches?.("#app-shell-sidebar") || node.querySelector?.("#app-shell-sidebar"))
  )) schedule();
});
observer.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:[
  "aria-expanded", "aria-pressed", "aria-current", "style", "class", "data-app-action-sidebar-thread-selected",
  "data-app-action-sidebar-section-collapsed", "data-above-composer-conversation-id", "lang"
] });
reconcile();
config.registerSelfCheck?.(() => {
  const sidebar=document.querySelector("#app-shell-sidebar");
  if (!sidebar) return {state:"unknown",reason:"sidebar-anchor-unavailable"};
  if (!sidebar.checkVisibility({visibilityProperty:true})) return {state:"not-applicable",reason:"sidebar-hidden"};
  const available=Boolean(button?.isConnected);
  return {state:available ? "available" : "unavailable",reason:available ? null : "sidebar-focus-anchor-unavailable",
    checks:[{name:"sidebar-focus-anchor",available}],scopes:[{name:"sidebar",element:sidebar}]};
});
return () => { disposed = true; cancelAnimationFrame(timer); observer.disconnect(); button?.remove(); };
