const COLLAPSE_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 5 3 3 3-3\" />\n  <path d=\"m15 19 3-3 3 3\" />\n</svg>\n";
const EXPAND_GLYPH = "<svg aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"16\"\n  height=\"16\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 5h8\" />\n  <path d=\"M3 12h8\" />\n  <path d=\"M3 19h8\" />\n  <path d=\"m15 8 3-3 3 3\" />\n  <path d=\"m15 16 3 3 3-3\" />\n</svg>\n";
const sectionSelector = "[data-app-action-sidebar-section]";
const projectSelector = "[data-app-action-sidebar-project-row]";
const states = new Map();
const tip = document.createElement("div");
tip.id = "minecodex-focus-tooltip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
const style = document.createElement("style");
style.textContent = `#minecodex-focus-tooltip {position:fixed;z-index:2147483000;pointer-events:none;padding:5px 12px;border:1px solid var(--color-border-tooltip);border-radius:var(--radius-2xl);background:var(--color-background-tooltip);color:var(--color-text-tooltip);box-shadow:var(--shadow-tooltip);font-family:var(--font-sans-default);font-size:var(--text-sm);line-height:18px;font-weight:var(--tooltip-compact-font-weight);letter-spacing:var(--tracking-tooltip);}`;
document.head.append(style);
document.body.append(tip);
function showTip() {
  if (!button) return;
  tip.hidden = false;
  const rect = button.getBoundingClientRect();
  tip.style.left = Math.max(8, rect.x + rect.width / 2 - tip.offsetWidth / 2) + "px";
  tip.style.top = rect.bottom + 8 + "px";
}
function hideTip() { tip.hidden = true; }
let active = false, restoring = false, button, timer, disposed = false;
const text = (en, cn) => (document.documentElement.lang || navigator.language).startsWith("zh") ? cn : en;
function props(element, predicate) {
  let fiber = element?.[Object.keys(element).find(key => key.startsWith("__reactFiber"))];
  for (let i = 0; fiber && i < 30; i++, fiber = fiber.return) {
    if (predicate(fiber.memoizedProps || {})) return fiber.memoizedProps;
  }
  return {};
}
function branches() {
  return [...document.querySelectorAll("#app-shell-sidebar " + sectionSelector)].map(element => {
    const native = props(element, p => !!p.sectionKey);
    const data = props(element, p => Array.isArray(p.section?.threadKeys)).section;
    return { element, key:"section:" + native.sectionKey, data, expanded:element.dataset.appActionSidebarSectionCollapsed === "false",
      toggle:() => native.onCollapsedChange?.(element.dataset.appActionSidebarSectionCollapsed === "false") };
  }).concat([...document.querySelectorAll("#app-shell-sidebar " + projectSelector)].map(element => ({
    element, key:"project:" + element.dataset.appActionSidebarProjectId,
    data:props(element, p => !!p.group?.projectId).group,
    expanded:element.getAttribute("aria-expanded") === "true",
    toggle:() => element.click(),
  })));
}
function remember(items) {
  for (const item of items) if (!states.has(item.key)) states.set(item.key, item.expanded);
}
function target(items) {
  const selected = document.querySelector('#app-shell-sidebar [data-app-action-sidebar-thread-selected="true"]');
  const id = document.querySelector("[data-above-composer-conversation-id]")?.dataset.aboveComposerConversationId;
  const key = selected?.dataset.appActionSidebarThreadId || (id ? "local:" + id : null);
  const activeProject = items.map(b => props(b.element, p => p.activeProjectId != null).activeProjectId).find(Boolean);
  const project = items.find(b => b.key.startsWith("project:") && (b.data?.threadKeys?.includes(key) || b.data?.projectId === activeProject));
  const section = items.find(b => b.key.startsWith("section:") && (b.data?.threadKeys?.includes(key) || (activeProject && b.data?.itemKeys?.includes("codex:project:" + activeProject))))
    || items.find(b => b.key.startsWith("section:") && (selected && b.element.contains(selected) || project && b.element.contains(project.element)));
  return section ? { section, project } : null;
}
function reconcile() {
  if (disposed) return;
  const sidebar = document.querySelector("#app-shell-sidebar");
  const bell = [...(sidebar?.querySelectorAll("button[aria-pressed]") || [])].find(e => /activity|活动|动态/.test(e.getAttribute("aria-label") || ""));
  if (!bell) { button?.remove(); button = null; hideTip(); return; }
  if (!button?.isConnected) {
    button = bell.cloneNode(false);
    button.removeAttribute("id");
    button.setAttribute("data-minecodex-focus", "");
    // 复用原生内层容器，由其负责图标在热区内居中。
    const inner = bell.firstElementChild.cloneNode(false);
    inner.innerHTML = COLLAPSE_GLYPH;
    button.replaceChildren(inner);
    button.setAttribute("aria-describedby", tip.id);
    button.addEventListener("pointerenter", showTip, { signal });
    button.addEventListener("pointerleave", hideTip, { signal });
    button.addEventListener("focus", showTip, { signal });
    button.addEventListener("blur", hideTip, { signal });
    button.addEventListener("click", () => {
      hideTip();
      if (active) { active = false; restoring = true; }
      else { states.clear(); remember(branches()); active = true; }
      schedule();
    }, { signal });
    // 作为原生按钮组的独立子项，继承组内 gap，不放进铃铛的 Tooltip 包装层。
    let anchor = bell;
    while (anchor.parentElement && getComputedStyle(anchor.parentElement).display !== "flex") {
      anchor = anchor.parentElement;
    }
    anchor.after(button);
  }
  const label = active ? text("Exit focus", "退出聚焦") : text("Focus current task", "聚焦当前任务");
  if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
  if (tip.textContent !== label) tip.textContent = label;
  const pressed = String(active);
  if (button.getAttribute("aria-pressed") !== pressed) {
    button.setAttribute("aria-pressed", pressed);
    button.firstElementChild.innerHTML = active ? EXPAND_GLYPH : COLLAPSE_GLYPH;
  }
  button.setAttribute("data-color", "secondary");
  button.setAttribute("data-variant", "ghost");
  const items = branches(), path = target(items);
  const activityActive = bell.getAttribute("aria-pressed") === "true";
  button.disabled = activityActive || (!active && !restoring && !path);
  if (activityActive) { hideTip(); return; }
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
  if (event.target.closest("[data-app-action-sidebar-section-toggle], " + projectSelector)) {
    active = false; states.clear(); schedule();
  }
}, { capture:true, signal });
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:[
  "aria-expanded", "aria-pressed", "data-app-action-sidebar-thread-selected",
  "data-app-action-sidebar-section-collapsed", "data-above-composer-conversation-id", "lang"
] });
reconcile();
return () => { disposed = true; clearTimeout(timer); observer.disconnect(); button?.remove(); tip.remove(); style.remove(); };
