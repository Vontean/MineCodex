const deviceGlyphs = {"local": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M12.6667 2.47461C13.6928 2.47479 14.525 3.30694 14.5251 4.33301V10.1445C15.0248 10.184 15.3787 10.6177 15.3787 11.0928V11.9355C15.3785 12.9036 14.6274 13.7373 13.6433 13.7373H2.34644C1.36254 13.7371 0.611273 12.9035 0.611084 11.9355V11.0928C0.611084 10.6149 0.970003 10.1796 1.47437 10.1445V4.33301C1.47454 3.30702 2.3068 2.47492 3.33276 2.47461H12.6667ZM1.66187 11.9355C1.66205 12.3765 1.99397 12.6863 2.34644 12.6865H13.6433C13.9959 12.6865 14.3287 12.3767 14.3289 11.9355V11.1924H1.66187V11.9355ZM3.33276 3.52539C2.8867 3.5257 2.52532 3.88692 2.52515 4.33301V10.1416H13.4744V4.33301C13.4742 3.88684 13.1129 3.52557 12.6667 3.52539H3.33276Z\" fill=\"currentColor\"/></svg>", "remote": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5005 1.1416C12.4346 1.14184 13.1919 1.89985 13.1919 2.83398V6.55859H13.3335C13.8259 6.55859 14.1917 6.9676 14.1919 7.42969V8.2959C14.1914 9.14015 13.5269 9.85938 12.6665 9.85938H3.3335C2.47306 9.85938 1.80856 9.14015 1.80811 8.2959V7.42969C1.80834 6.9677 2.17428 6.55877 2.6665 6.55859H2.80811V2.83398C2.80811 1.8997 3.56621 1.1416 4.50049 1.1416H11.5005ZM2.85889 8.2959C2.85933 8.59786 3.08989 8.80859 3.3335 8.80859H12.6665C12.9101 8.80859 13.1416 8.59786 13.1421 8.2959V7.60938H2.85889V8.2959ZM4.50049 2.19238C4.14611 2.19238 3.85889 2.4796 3.85889 2.83398V6.55859H12.1421V2.83398C12.1421 2.47975 11.8547 2.19262 11.5005 2.19238H4.50049Z\" fill=\"currentColor\"/> <path d=\"M2.8595 13.4307C3.28863 13.4308 3.63684 13.7788 3.63684 14.208C3.63677 14.6371 3.28859 14.9852 2.8595 14.9854C2.43029 14.9854 2.08222 14.6372 2.08215 14.208C2.08215 13.7788 2.43025 13.4307 2.8595 13.4307Z\" fill=\"currentColor\"/> <path d=\"M5.42981 13.4307C5.859 13.4307 6.20715 13.7788 6.20715 14.208C6.20709 14.6372 5.85896 14.9853 5.42981 14.9854C5.0006 14.9854 4.65253 14.6372 4.65247 14.208C4.65247 13.7788 5.00056 13.4307 5.42981 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 13.4307C8.42937 13.4307 8.77747 13.7788 8.77747 14.208C8.7774 14.6372 8.42933 14.9854 8.00012 14.9854C7.57092 14.9854 7.22284 14.6372 7.22278 14.208C7.22278 13.7788 7.57087 13.4307 8.00012 13.4307Z\" fill=\"currentColor\"/> <path d=\"M10.5704 13.4307C10.9997 13.4307 11.3478 13.7788 11.3478 14.208C11.3477 14.6372 10.9996 14.9854 10.5704 14.9854C10.1414 14.9852 9.79413 14.6371 9.79407 14.208C9.79407 13.7789 10.1414 13.4309 10.5704 13.4307Z\" fill=\"currentColor\"/> <path d=\"M13.1417 13.4307C13.5707 13.4309 13.9181 13.7789 13.9181 14.208C13.918 14.637 13.5707 14.9851 13.1417 14.9854C12.7125 14.9854 12.3644 14.6372 12.3644 14.208C12.3644 13.7788 12.7125 13.4307 13.1417 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 10.8809C8.42925 10.8809 8.77727 11.2281 8.77747 11.6572C8.77747 12.0865 8.42937 12.4346 8.00012 12.4346C7.57087 12.4346 7.22278 12.0865 7.22278 11.6572C7.22298 11.2281 7.571 10.8809 8.00012 10.8809Z\" fill=\"currentColor\"/></svg>"};
const text = (en, cn) => (document.documentElement.lang || navigator.language || "en").startsWith("zh") ? cn : en;
const sidebarGlyphs = {"16": "<path d=\"M4.66699 4.80859C4.95683 4.80873 5.19238 5.04412 5.19238 5.33398V10.667C5.19238 10.9569 4.95683 11.1923 4.66699 11.1924C4.37704 11.1924 4.1416 10.9569 4.1416 10.667V5.33398C4.1416 5.04403 4.37704 4.80859 4.66699 4.80859Z\" fill=\"currentColor\"/> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5 2.30762C13.1707 2.30762 14.5254 3.66235 14.5254 5.33301V10.666C14.5254 12.3367 13.1707 13.6914 11.5 13.6914H4.5C2.82934 13.6914 1.47461 12.3367 1.47461 10.666V5.33301C1.47461 3.66235 2.82934 2.30762 4.5 2.30762H11.5ZM4.5 3.3584C3.40924 3.3584 2.52539 4.24225 2.52539 5.33301V10.666C2.52539 11.7568 3.40924 12.6416 4.5 12.6416H11.5C12.5908 12.6416 13.4746 11.7568 13.4746 10.666V5.33301C13.4746 4.24225 12.5908 3.3584 11.5 3.3584H4.5Z\" fill=\"currentColor\"/>", "20": "<path d=\"M5.83301 6.00098C6.20028 6.00098 6.49805 6.29875 6.49805 6.66602V13.333C6.49787 13.7001 6.20017 13.998 5.83301 13.998C5.46596 13.9979 5.16814 13.7 5.16797 13.333V6.66602C5.16797 6.29883 5.46585 6.00111 5.83301 6.00098Z\" fill=\"currentColor\"/> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M14.5 2.87695C16.5241 2.87695 18.165 4.51787 18.165 6.54199V13.459C18.1649 15.483 16.524 17.124 14.5 17.124H5.5C3.47598 17.124 1.83514 15.483 1.83496 13.459V6.54199C1.83496 4.51787 3.47588 2.87695 5.5 2.87695H14.5ZM5.5 4.20703C4.21042 4.20703 3.16504 5.25241 3.16504 6.54199V13.459C3.16521 14.7484 4.21052 15.7939 5.5 15.7939H14.5C15.7895 15.7939 16.8348 14.7484 16.835 13.459V6.54199C16.835 5.25241 15.7896 4.20703 14.5 4.20703H5.5Z\" fill=\"currentColor\"/>"};
const projectIcons = new Map();
const folderGlyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6.94946 2.66821C7.58311 2.66821 8.20067 2.86877 8.71313 3.24146L9.77759 4.01587C10.0627 4.22319 10.4065 4.33521 10.759 4.33521H14.9583C16.6142 4.33521 17.9563 5.67732 17.9563 7.33325V14.3333C17.9563 15.9892 16.6142 17.3313 14.9583 17.3313H5.04126C3.38547 17.3311 2.04321 15.9891 2.04321 14.3333V5.66626C2.04339 4.01058 3.38558 2.66839 5.04126 2.66821H6.94946ZM3.37329 9.83228V14.3333C3.37329 15.2545 4.12001 16.001 5.04126 16.0012H14.9583C15.8796 16.0012 16.6262 15.2546 16.6262 14.3333V9.83228H3.37329ZM5.04126 3.99829C4.12012 3.99847 3.37347 4.74512 3.37329 5.66626V8.5022H16.6262V7.33325C16.6262 6.41186 15.8796 5.66528 14.9583 5.66528H10.759C10.1254 5.66528 9.50784 5.46377 8.99536 5.09106L7.93091 4.31763C7.64576 4.11024 7.30205 3.99829 6.94946 3.99829H5.04126Z\" fill=\"currentColor\"/></svg>";
const marker = "data-minecodex-unread";
const style = document.createElement("style");
style.textContent = `
header:has([data-minecodex-unread=trigger]) [data-app-shell-titlebar-slot=main] { padding-inline-start:calc(var(--spacing) * 8.5); }
[data-minecodex-unread-dot] svg:not([data-minecodex-clean-sidebar]) { display:none; }
[${marker}=panel] { position:fixed; z-index:2147483000; box-sizing:border-box; width:min(320px,calc(100vw - 16px)); max-height:min(480px,calc(100vh - 64px)); overflow:auto; padding:var(--app-menu-gutter,4px); border:1px solid var(--color-border); border-radius:var(--radius-2xl); background:var(--color-token-dropdown-background); color:var(--color-text-primary); box-shadow:var(--shadow-xl-spread); font-family:var(--font-sans-default); font-size:var(--text-sm); }
[${marker}=panel][hidden] { display:none; }
[${marker}=panel] h2 { margin:8px 10px; font-size:var(--text-sm); font-weight:500; color:var(--color-text-secondary); }
[${marker}=panel] [data-unread-row] { display:flex; flex-direction:column; gap:6px; width:100%; padding:10px; box-sizing:border-box; border:0; border-radius:var(--radius-xl); background:transparent; text-align:start; color:var(--color-text-primary); font:inherit; cursor:pointer; }
[${marker}=panel] [data-unread-row]:hover { background:var(--color-background-primary-ghost-hover); }
[${marker}=panel] [data-unread-row]:focus-visible { outline:2px solid var(--color-ring); outline-offset:-2px; }
[${marker}=panel] .mcx-thread-header { display:flex; align-items:center; gap:8px; width:100%; min-width:0; }
[${marker}=panel] .mcx-thread-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; font-weight:500; }
[${marker}=panel] .mcx-device { display:flex; flex-shrink:0; color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-loading { margin-inline-start:auto; flex-shrink:0; display:flex; align-items:center; color:var(--color-text-tertiary); }
[${marker}=panel] time { margin-inline-start:auto; flex-shrink:0; font-size:var(--text-xs); color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-summary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; white-space:normal; overflow-wrap:anywhere; font-size:var(--text-xs); line-height:var(--text-xs--line-height,1.4); color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-project { display:flex; align-items:center; gap:6px; padding:0; min-width:0; font-size:var(--text-xs); color:var(--color-text-secondary); font-weight:500; }
[${marker}=panel] .mcx-project > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
function isWorking(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const status = fiber.memoizedProps?.statusState;
    if (status?.type) return status.type === "loading";
  }
  return false;
}
function isPriority(row) { return isUnread(row) || isWorking(row); }
function priorityRows(rows) {
  // 稳定排序：工作中优先，同类沿用原生顺序。
  return rows.filter(isPriority).sort((a, b) => Number(isWorking(b)) - Number(isWorking(a)));
}
function projectForRow(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const group = fiber.memoizedProps?.secondaryContent?.props?.projectGroup;
    if (group?.projectId) return { id:group.projectId, name:group.label };
  }
  return null;
}
function threadDetails(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  let summary, hostConfig;
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    summary ||= fiber.memoizedProps?.threadSummary;
    hostConfig ||= fiber.memoizedProps?.hoverCardHostConfig;
  }
  const hostId = summary?.hostId || row.dataset.appActionSidebarThreadHostId || "local";
  return {
    title:row.dataset.appActionSidebarThreadTitle || row.querySelector("[data-thread-title]")?.textContent || "",
    summary:row.querySelector("[data-thread-secondary-title]")?.textContent || "",
    // 与原生 Thread hover card 相同，优先使用任务 recency 时间。
    timestamp:summary?.recencyAt ?? summary?.updatedAt ?? null,
    hostId, hostName:hostConfig?.display_name || hostId,
    project:projectForRow(row),
    working:isWorking(row),
  };
}
function relativeTime(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return text("Just now", "刚刚");
  const units = seconds < 3600 ? [60, "m", "分钟"] : seconds < 86400 ? [3600, "h", "小时"] : [86400, "d", "天"];
  const value = Math.floor(seconds / units[0]);
  return text(value + units[1], value + units[2] + "前");
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
  const rows = priorityRows([...document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-thread-row]')]);
  const details = rows.map(threadDetails);
  const next = JSON.stringify([text("Priority", "优先事项"), details, Math.floor(Date.now() / 60000)]);
  if (signature === next) return;
  signature = next;
  panel.replaceChildren();
  panel.setAttribute("aria-label", text("Priority", "优先事项"));
  const heading = document.createElement("h2");
  heading.textContent = text("Priority", "优先事项");
  panel.append(heading);
  rows.forEach((row, index) => {
    const item = details[index];
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.unreadRow = "";
    const header = document.createElement("span");
    header.className = "mcx-thread-header";
    const title = document.createElement("span");
    title.className = "mcx-thread-title";
    title.textContent = item.title;
    const device = document.createElement("span");
    device.className = "mcx-device";
    const remote = item.hostId !== "local";
    device.innerHTML = deviceGlyphs[remote ? "remote" : "local"];
    device.title = remote ? item.hostName : text("This computer", "本机");
    device.setAttribute("aria-label", device.title);
    header.append(title, device);
    const elapsed = relativeTime(item.timestamp);
    if (item.working) {
      const loading = document.createElement("span");
      loading.className = "mcx-loading";
      loading.setAttribute("role", "status");
      loading.setAttribute("aria-label", text("Working", "正在工作"));
      // 直接复用当前会话原生 loading，保持动画与 reduced-motion 行为一致。
      const spinner = row.querySelector('[class~="motion-safe:animate-spin"]');
      if (spinner) loading.append(spinner.cloneNode(true));
      header.append(loading);
    } else if (elapsed) {
      const time = document.createElement("time");
      time.dateTime = new Date(item.timestamp).toISOString();
      time.textContent = elapsed;
      time.title = new Date(item.timestamp).toLocaleString();
      header.append(time);
    }
    card.append(header);
    if (item.summary) {
      const summary = document.createElement("span");
      summary.className = "mcx-summary";
      summary.textContent = item.summary;
      card.append(summary);
    }
    if (item.project) {
      const project = document.createElement("span");
      project.className = "mcx-project";
      const glyph = projectIcons.get(item.project.id)?.cloneNode(true);
      if (glyph) project.append(glyph);
      else project.innerHTML = folderGlyph;
      const name = document.createElement("span");
      name.textContent = item.project.name;
      project.append(name);
      card.append(project);
    }
    card.addEventListener("click", () => { row.click(); close(); });
    panel.append(card);
  });
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
  trigger.setAttribute("aria-label", text("Priority", "优先事项"));
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
const refreshTimer = setInterval(() => { if (!panel.hidden) renderRows(); }, 30000);
sync();
return () => {
  disposed = true; clearInterval(refreshTimer); observer.disconnect(); close(); trigger?.remove(); panel.remove(); style.remove();
  restoreSidebarIcon();
};
