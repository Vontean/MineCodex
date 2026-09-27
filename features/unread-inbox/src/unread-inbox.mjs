const text = (en, cn) => (document.documentElement.lang || navigator.language || "en").startsWith("zh") ? cn : en;
const sidebarGlyphs = {"16": "<path d=\"M4.66699 4.80859C4.95683 4.80873 5.19238 5.04412 5.19238 5.33398V10.667C5.19238 10.9569 4.95683 11.1923 4.66699 11.1924C4.37704 11.1924 4.1416 10.9569 4.1416 10.667V5.33398C4.1416 5.04403 4.37704 4.80859 4.66699 4.80859Z\" fill=\"currentColor\"/> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5 2.30762C13.1707 2.30762 14.5254 3.66235 14.5254 5.33301V10.666C14.5254 12.3367 13.1707 13.6914 11.5 13.6914H4.5C2.82934 13.6914 1.47461 12.3367 1.47461 10.666V5.33301C1.47461 3.66235 2.82934 2.30762 4.5 2.30762H11.5ZM4.5 3.3584C3.40924 3.3584 2.52539 4.24225 2.52539 5.33301V10.666C2.52539 11.7568 3.40924 12.6416 4.5 12.6416H11.5C12.5908 12.6416 13.4746 11.7568 13.4746 10.666V5.33301C13.4746 4.24225 12.5908 3.3584 11.5 3.3584H4.5Z\" fill=\"currentColor\"/>", "20": "<path d=\"M5.83301 6.00098C6.20028 6.00098 6.49805 6.29875 6.49805 6.66602V13.333C6.49787 13.7001 6.20017 13.998 5.83301 13.998C5.46596 13.9979 5.16814 13.7 5.16797 13.333V6.66602C5.16797 6.29883 5.46585 6.00111 5.83301 6.00098Z\" fill=\"currentColor\"/> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M14.5 2.87695C16.5241 2.87695 18.165 4.51787 18.165 6.54199V13.459C18.1649 15.483 16.524 17.124 14.5 17.124H5.5C3.47598 17.124 1.83514 15.483 1.83496 13.459V6.54199C1.83496 4.51787 3.47588 2.87695 5.5 2.87695H14.5ZM5.5 4.20703C4.21042 4.20703 3.16504 5.25241 3.16504 6.54199V13.459C3.16521 14.7484 4.21052 15.7939 5.5 15.7939H14.5C15.7895 15.7939 16.8348 14.7484 16.835 13.459V6.54199C16.835 5.25241 15.7896 4.20703 14.5 4.20703H5.5Z\" fill=\"currentColor\"/>"};
const projectIcons = new Map();
const folderGlyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6.94946 2.66821C7.58311 2.66821 8.20067 2.86877 8.71313 3.24146L9.77759 4.01587C10.0627 4.22319 10.4065 4.33521 10.759 4.33521H14.9583C16.6142 4.33521 17.9563 5.67732 17.9563 7.33325V14.3333C17.9563 15.9892 16.6142 17.3313 14.9583 17.3313H5.04126C3.38547 17.3311 2.04321 15.9891 2.04321 14.3333V5.66626C2.04339 4.01058 3.38558 2.66839 5.04126 2.66821H6.94946ZM3.37329 9.83228V14.3333C3.37329 15.2545 4.12001 16.001 5.04126 16.0012H14.9583C15.8796 16.0012 16.6262 15.2546 16.6262 14.3333V9.83228H3.37329ZM5.04126 3.99829C4.12012 3.99847 3.37347 4.74512 3.37329 5.66626V8.5022H16.6262V7.33325C16.6262 6.41186 15.8796 5.66528 14.9583 5.66528H10.759C10.1254 5.66528 9.50784 5.46377 8.99536 5.09106L7.93091 4.31763C7.64576 4.11024 7.30205 3.99829 6.94946 3.99829H5.04126Z\" fill=\"currentColor\"/></svg>";
const marker = "data-minecodex-unread";
const style = document.createElement("style");
style.textContent = `
header:has([data-minecodex-unread=trigger]) [data-app-shell-titlebar-slot=main] { padding-inline-start:calc(var(--spacing) * 8.5); }
[data-minecodex-unread-dot] svg:not([data-minecodex-clean-sidebar]) { display:none; }
[${marker}=panel] { position:fixed; z-index:2147483000; box-sizing:border-box; width:min(360px,calc(100vw - 16px)); max-height:min(480px,calc(100vh - 64px)); overflow:auto; padding:var(--app-menu-gutter,4px); border:1px solid var(--color-border); border-radius:var(--radius-2xl); background:var(--color-token-dropdown-background); color:var(--color-text-primary); box-shadow:var(--shadow-xl-spread); font-family:var(--font-sans-default); font-size:var(--text-sm); }
[${marker}=panel][hidden] { display:none; }
[${marker}=panel] h2 { margin:8px 10px; font-size:var(--text-sm); font-weight:500; color:var(--color-text-secondary); }
[${marker}=panel] [data-unread-row] { border-radius:var(--radius-xl); }
[${marker}=panel] .mcx-project { display:flex; align-items:center; gap:6px; padding:10px 10px 4px; color:var(--color-text-secondary); font-weight:500; }
[${marker}=panel] .mcx-project svg { width:16px; height:16px; }
[${marker}=panel] .mcx-empty { margin:20px 12px; color:var(--color-text-tertiary); }
`;
document.head.append(style);
const panel = document.createElement("div");
panel.setAttribute(marker, "panel");
panel.id = "minecodex-unread-panel";
panel.setAttribute("role", "dialog");
panel.hidden = true;
document.body.append(panel);
let trigger = null, sidebarToggle = null, openTimer = null, closeTimer = null;
let restoreActivity = false, signature = "", queued = false, disposed = false;
function activityButton() {
  return [...document.querySelectorAll('#app-shell-sidebar button[aria-pressed]')].find(e => /activity|活动|动态/.test(e.getAttribute("aria-label") || ""));
}
function isUnread(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    if (typeof fiber.memoizedProps?.isUnread === "boolean") return fiber.memoizedProps.isUnread;
  }
  return false;
}
function projectForRow(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const group = fiber.memoizedProps?.secondaryContent?.props?.projectGroup;
    if (group?.projectId) return { id:group.projectId, name:group.label };
  }
  return null;
}
function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const project = projectForRow(row);
    const key = project?.id ?? "";
    if (!groups.has(key)) groups.set(key, { project, rows:[] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}
function cacheProjectIcons() {
  for (const row of document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-project-row]')) {
    const glyph = row.querySelector("span.relative.inline-flex");
    if (glyph) projectIcons.set(row.dataset.appActionSidebarProjectId, glyph.cloneNode(true));
  }
}
function restoreSidebarIcon() {
  sidebarToggle?.removeAttribute("data-minecodex-unread-dot");
  for (const glyph of sidebarToggle?.querySelectorAll("[data-minecodex-clean-sidebar]") ?? []) glyph.remove();
}
function replaceSidebarIcon() {
  for (const svg of sidebarToggle.querySelectorAll("svg:not([data-minecodex-clean-sidebar])")) {
    if (svg.parentElement.querySelector("[data-minecodex-clean-sidebar]")) continue;
    const clean = svg.cloneNode(false);
    clean.setAttribute("data-minecodex-clean-sidebar", "");
    clean.innerHTML = sidebarGlyphs[svg.getAttribute("width")] ?? sidebarGlyphs[16];
    svg.after(clean);
  }
  if (!sidebarToggle.hasAttribute("data-minecodex-unread-dot")) sidebarToggle.setAttribute("data-minecodex-unread-dot", "");
}
function close(restoreFocus = false) {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  panel.hidden = true;
  if (trigger?.getAttribute("aria-expanded") !== "false") trigger?.setAttribute("aria-expanded", "false");
  if (restoreActivity) {
    restoreActivity = false;
    const native = activityButton();
    if (native?.getAttribute("aria-pressed") === "true") native.click();
  }
  if (restoreFocus) trigger?.focus();
}
function position() {
  if (!trigger) return;
  const rail = document.querySelector("[data-app-navigation-rail]")?.getBoundingClientRect();
  const header = trigger.closest("header")?.getBoundingClientRect();
  panel.style.left = `${(rail?.right ?? 0) + 16}px`;
  panel.style.top = `${(header?.bottom ?? 44) + 16}px`;
  panel.style.maxWidth = `${innerWidth - (rail?.right ?? 0) - 32}px`;
}
function renderRows() {
  const rows = [...document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-thread-row]')].filter(isUnread);
  const next = text("Unread chats", "未读会话") + rows.map(row => row.dataset.appActionSidebarThreadId + row.textContent).join("|");
  if (signature === next) return;
  signature = next;
  panel.replaceChildren();
  panel.setAttribute("aria-label", text("Unread chats", "未读会话"));
  const heading = document.createElement("h2");
  heading.textContent = text("Unread chats", "未读会话");
  panel.append(heading);
  for (const group of groupRows(rows)) {
    if (group.project) {
      const heading = document.createElement("div");
      heading.className = "mcx-project";
      const glyph = projectIcons.get(group.project.id)?.cloneNode(true);
      if (glyph) heading.append(glyph);
      else heading.innerHTML = folderGlyph;
      const name = document.createElement("span");
      name.textContent = group.project.name;
      heading.append(name);
      panel.append(heading);
    }
    for (const row of group.rows) {
    const clone = row.cloneNode(true);
    // 保留原生信息排版，不复制菜单、归档等独立操作或原生身份标记。
    for (const button of clone.querySelectorAll("button")) button.remove();
    for (const node of [clone, ...clone.querySelectorAll("*")]) {
      for (const attr of [...node.attributes]) {
        if (attr.name === "id" || attr.name === "aria-describedby" || attr.name.startsWith("data-app-action")) node.removeAttribute(attr.name);
      }
    }
    if (group.project) {
      const title = clone.querySelector("[data-thread-title]");
      // 原生项目后缀挪到组标题，摘要与状态标记仍保留。
      const suffix = title?.nextElementSibling;
      if (suffix?.textContent === group.project.name) suffix.remove();
    }
    clone.dataset.unreadRow = "";
    clone.addEventListener("click", () => { row.click(); close(); });
    clone.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clone.click(); }
    });
    panel.append(clone);
    }
  }
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "mcx-empty";
    empty.textContent = text("You're all caught up", "暂无未读会话");
    panel.append(empty);
  }
}
function open() {
  clearTimeout(closeTimer);
  if (!trigger || sidebarToggle?.getAttribute("aria-expanded") !== "false") return;
  cacheProjectIcons();
  const native = activityButton();
  if (!native) return;
  panel.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  if (native.getAttribute("aria-pressed") !== "true") { restoreActivity = true; native.click(); }
  renderRows(); position();
}
function scheduleClose() { clearTimeout(openTimer); closeTimer = setTimeout(() => close(), 180); }
panel.addEventListener("pointerenter", () => clearTimeout(closeTimer), { signal });
panel.addEventListener("pointerleave", scheduleClose, { signal });
function sync() {
  if (disposed) return;
  cacheProjectIcons();
  const toggle = [...document.querySelectorAll('[data-app-shell-sidebar-trigger="true"]')].find(e => {
    const r = e.getBoundingClientRect();
    return e.checkVisibility() && !e.closest("[inert]") && e.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  const native = activityButton();
  if (!toggle || toggle.getAttribute("aria-expanded") !== "false" || !native) {
    close(); trigger?.remove(); trigger = null;
    restoreSidebarIcon(); sidebarToggle = null;
    return;
  }
  if (sidebarToggle !== toggle) {
    close(); trigger?.remove();
    restoreSidebarIcon();
    sidebarToggle = toggle;
    trigger = native.cloneNode(false);
    trigger.removeAttribute("aria-pressed");
    trigger.setAttribute(marker, "trigger");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("pointerenter", () => { clearTimeout(closeTimer); openTimer = setTimeout(open, 120); }, { signal });
    trigger.addEventListener("pointerleave", scheduleClose, { signal });
    trigger.addEventListener("click", () => panel.hidden ? open() : close(), { signal });
    trigger.addEventListener("keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); panel.querySelector('[data-unread-row]')?.focus(); } }, { signal });
    (toggle.parentElement.classList.contains("contents") ? toggle.parentElement : toggle).after(trigger);
  }
  const markup = native.innerHTML;
  if (trigger.innerHTML !== markup) trigger.innerHTML = markup;
  trigger.setAttribute("data-color", "secondary");
  trigger.setAttribute("data-variant", "ghost");
  trigger.setAttribute("aria-label", text("Unread chats", "未读会话"));
  replaceSidebarIcon();
  if (!panel.hidden) { renderRows(); position(); }
}
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; sync(); });
});
observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["aria-expanded", "aria-pressed", "lang"] });
document.addEventListener("pointerdown", event => { if (!trigger?.contains(event.target) && !panel.contains(event.target)) close(); }, { signal });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); close(true); } }, { signal });
window.addEventListener("resize", position, { signal });
sync();
return () => {
  disposed = true; observer.disconnect(); close(); trigger?.remove(); panel.remove(); style.remove();
  restoreSidebarIcon();
};
