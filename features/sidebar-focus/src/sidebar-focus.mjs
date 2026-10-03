const nativeFocus = createFocusAdapter(config.codex);
const COLLAPSE_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 5 3 3 3-3\" />\n  <path d=\"m15 19 3-3 3 3\" />\n</svg>\n";
const EXPAND_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 8 3-3 3 3\" />\n  <path d=\"m15 16 3 3 3-3\" />\n</svg>\n";


const states = new Map();
let active = false, restoring = false, button, timer, disposed = false;
const text = (en, cn) => (document.documentElement.lang || navigator.language).startsWith("zh") ? cn : en;


function remember(items) {
  for (const item of items) if (!states.has(item.key)) states.set(item.key, item.expanded);
}

function reconcile() {
  if (disposed) return;
  const sidebar = document.querySelector("#app-shell-sidebar");
  const bell = [...(sidebar?.querySelectorAll("button[aria-pressed]") || [])].find(e => /activity|活动|动态/.test(e.getAttribute("aria-label") || ""));
  if (!bell) { button?.remove(); button = null; return; }
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
    while (anchor.parentElement && getComputedStyle(anchor.parentElement).display !== "flex") {
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
  clearTimeout(timer);
  timer = setTimeout(reconcile, 40);
}
document.addEventListener("click", event => {
  if (!active || !event.isTrusted) return;
  if (nativeFocus.isBranchToggle(event.target)) {
    active = false; states.clear(); schedule();
  }
}, { capture:true, signal });
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:[
  "aria-expanded", "aria-pressed", "data-app-action-sidebar-thread-selected",
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
return () => { disposed = true; clearTimeout(timer); observer.disconnect(); button?.remove(); };
