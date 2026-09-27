const taskGlyph = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M13.3336 11.4749C13.6234 11.475 13.858 11.7104 13.858 12.0002C13.8579 12.2899 13.6233 12.5255 13.3336 12.5256H6.66663C6.37678 12.5256 6.1414 12.2901 6.14124 12.0002C6.14124 11.7103 6.37668 11.4749 6.66663 11.4749H13.3336Z\" fill=\"currentColor\"/> <path d=\"M3.07874 10.9827C3.50002 10.9827 3.84226 11.3241 3.84241 11.7454C3.84241 12.1667 3.50011 12.509 3.07874 12.509C2.65748 12.5089 2.31604 12.1666 2.31604 11.7454C2.31619 11.3242 2.65758 10.9828 3.07874 10.9827Z\" fill=\"currentColor\"/> <path d=\"M13.3336 7.47485C13.6234 7.47503 13.858 7.7104 13.858 8.00024C13.8579 8.28995 13.6233 8.52546 13.3336 8.52563H6.66663C6.37678 8.52563 6.1414 8.29005 6.14124 8.00024C6.14124 7.71029 6.37668 7.47485 6.66663 7.47485H13.3336Z\" fill=\"currentColor\"/> <path d=\"M3.07874 6.98267C3.50002 6.98267 3.84226 7.32411 3.84241 7.74536C3.84241 8.16674 3.50011 8.50903 3.07874 8.50903C2.65748 8.50888 2.31604 8.16665 2.31604 7.74536C2.31619 7.3242 2.65758 6.98281 3.07874 6.98267Z\" fill=\"currentColor\"/> <path d=\"M13.3336 3.47485C13.6234 3.47503 13.858 3.7104 13.858 4.00024C13.8579 4.28995 13.6233 4.52546 13.3336 4.52563H6.66663C6.37678 4.52563 6.1414 4.29005 6.14124 4.00024C6.14124 3.71029 6.37668 3.47485 6.66663 3.47485H13.3336Z\" fill=\"currentColor\"/> <path d=\"M3.07874 2.98267C3.50002 2.98267 3.84226 3.32411 3.84241 3.74536C3.84241 4.16674 3.50011 4.50903 3.07874 4.50903C2.65748 4.50888 2.31604 4.16665 2.31604 3.74536C2.31619 3.3242 2.65758 2.98281 3.07874 2.98267Z\" fill=\"currentColor\"/></svg>";
const deviceGlyphs = {"local": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M12.6667 2.47461C13.6928 2.47479 14.525 3.30694 14.5251 4.33301V10.1445C15.0248 10.184 15.3787 10.6177 15.3787 11.0928V11.9355C15.3785 12.9036 14.6274 13.7373 13.6433 13.7373H2.34644C1.36254 13.7371 0.611273 12.9035 0.611084 11.9355V11.0928C0.611084 10.6149 0.970003 10.1796 1.47437 10.1445V4.33301C1.47454 3.30702 2.3068 2.47492 3.33276 2.47461H12.6667ZM1.66187 11.9355C1.66205 12.3765 1.99397 12.6863 2.34644 12.6865H13.6433C13.9959 12.6865 14.3287 12.3767 14.3289 11.9355V11.1924H1.66187V11.9355ZM3.33276 3.52539C2.8867 3.5257 2.52532 3.88692 2.52515 4.33301V10.1416H13.4744V4.33301C13.4742 3.88684 13.1129 3.52557 12.6667 3.52539H3.33276Z\" fill=\"currentColor\"/></svg>", "remote": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5005 1.1416C12.4346 1.14184 13.1919 1.89985 13.1919 2.83398V6.55859H13.3335C13.8259 6.55859 14.1917 6.9676 14.1919 7.42969V8.2959C14.1914 9.14015 13.5269 9.85938 12.6665 9.85938H3.3335C2.47306 9.85938 1.80856 9.14015 1.80811 8.2959V7.42969C1.80834 6.9677 2.17428 6.55877 2.6665 6.55859H2.80811V2.83398C2.80811 1.8997 3.56621 1.1416 4.50049 1.1416H11.5005ZM2.85889 8.2959C2.85933 8.59786 3.08989 8.80859 3.3335 8.80859H12.6665C12.9101 8.80859 13.1416 8.59786 13.1421 8.2959V7.60938H2.85889V8.2959ZM4.50049 2.19238C4.14611 2.19238 3.85889 2.4796 3.85889 2.83398V6.55859H12.1421V2.83398C12.1421 2.47975 11.8547 2.19262 11.5005 2.19238H4.50049Z\" fill=\"currentColor\"/> <path d=\"M2.8595 13.4307C3.28863 13.4308 3.63684 13.7788 3.63684 14.208C3.63677 14.6371 3.28859 14.9852 2.8595 14.9854C2.43029 14.9854 2.08222 14.6372 2.08215 14.208C2.08215 13.7788 2.43025 13.4307 2.8595 13.4307Z\" fill=\"currentColor\"/> <path d=\"M5.42981 13.4307C5.859 13.4307 6.20715 13.7788 6.20715 14.208C6.20709 14.6372 5.85896 14.9853 5.42981 14.9854C5.0006 14.9854 4.65253 14.6372 4.65247 14.208C4.65247 13.7788 5.00056 13.4307 5.42981 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 13.4307C8.42937 13.4307 8.77747 13.7788 8.77747 14.208C8.7774 14.6372 8.42933 14.9854 8.00012 14.9854C7.57092 14.9854 7.22284 14.6372 7.22278 14.208C7.22278 13.7788 7.57087 13.4307 8.00012 13.4307Z\" fill=\"currentColor\"/> <path d=\"M10.5704 13.4307C10.9997 13.4307 11.3478 13.7788 11.3478 14.208C11.3477 14.6372 10.9996 14.9854 10.5704 14.9854C10.1414 14.9852 9.79413 14.6371 9.79407 14.208C9.79407 13.7789 10.1414 13.4309 10.5704 13.4307Z\" fill=\"currentColor\"/> <path d=\"M13.1417 13.4307C13.5707 13.4309 13.9181 13.7789 13.9181 14.208C13.918 14.637 13.5707 14.9851 13.1417 14.9854C12.7125 14.9854 12.3644 14.6372 12.3644 14.208C12.3644 13.7788 12.7125 13.4307 13.1417 13.4307Z\" fill=\"currentColor\"/> <path d=\"M8.00012 10.8809C8.42925 10.8809 8.77727 11.2281 8.77747 11.6572C8.77747 12.0865 8.42937 12.4346 8.00012 12.4346C7.57087 12.4346 7.22278 12.0865 7.22278 11.6572C7.22298 11.2281 7.571 10.8809 8.00012 10.8809Z\" fill=\"currentColor\"/></svg>"};
const text = (en, cn) => (document.documentElement.lang || navigator.language || "en").startsWith("zh") ? cn : en;
const projectIcons = new Map();
const folderGlyph = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"20\" height=\"20\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6.94946 2.66821C7.58311 2.66821 8.20067 2.86877 8.71313 3.24146L9.77759 4.01587C10.0627 4.22319 10.4065 4.33521 10.759 4.33521H14.9583C16.6142 4.33521 17.9563 5.67732 17.9563 7.33325V14.3333C17.9563 15.9892 16.6142 17.3313 14.9583 17.3313H5.04126C3.38547 17.3311 2.04321 15.9891 2.04321 14.3333V5.66626C2.04339 4.01058 3.38558 2.66839 5.04126 2.66821H6.94946ZM3.37329 9.83228V14.3333C3.37329 15.2545 4.12001 16.001 5.04126 16.0012H14.9583C15.8796 16.0012 16.6262 15.2546 16.6262 14.3333V9.83228H3.37329ZM5.04126 3.99829C4.12012 3.99847 3.37347 4.74512 3.37329 5.66626V8.5022H16.6262V7.33325C16.6262 6.41186 15.8796 5.66528 14.9583 5.66528H10.759C10.1254 5.66528 9.50784 5.46377 8.99536 5.09106L7.93091 4.31763C7.64576 4.11024 7.30205 3.99829 6.94946 3.99829H5.04126Z\" fill=\"currentColor\"/></svg>";
const marker = "data-minecodex-unread";
const style = document.createElement("style");
style.textContent = `
[data-minecodex-task-title] { pointer-events:auto; -webkit-app-region:no-drag; cursor:pointer; border-radius:var(--radius-lg); min-height:32px; padding-inline:6px; }
[data-minecodex-task-title]:hover { background:var(--color-background-primary-ghost-hover); }
[data-minecodex-task-title]:focus-visible { outline:2px solid var(--color-ring); outline-offset:-2px; }
[data-minecodex-task-badge] { display:inline-flex; flex-shrink:0; align-items:center; gap:4px; color:var(--color-text-secondary); font-family:var(--font-sans-default); font-size:var(--text-xs); font-variant-numeric:tabular-nums; }
[data-minecodex-unread=trigger] { -webkit-app-region:no-drag; }
[${marker}=scrim] { position:fixed; inset:0; z-index:2147482999; background:var(--modal-backdrop-background); -webkit-app-region:no-drag; }
[${marker}=scrim][hidden] { display:none; }
[${marker}=panel] { position:fixed; z-index:2147483000; box-sizing:border-box; width:min(320px,calc(100vw - 16px)); max-height:min(660px,calc(100vh - 64px)); display:flex; flex-direction:column; overflow:hidden; padding:var(--app-menu-gutter,4px); padding-bottom:calc(var(--spacing,4px) * 3); border:1px solid var(--color-border); border-radius:var(--radius-2xl); background:var(--color-token-dropdown-background); color:var(--color-text-primary); box-shadow:var(--shadow-xl-spread); font-family:var(--font-sans-default); font-size:var(--text-sm); }
[${marker}=panel][hidden] { display:none; }
[${marker}=panel] .mcx-thread-list { min-height:0; overflow-y:auto; overscroll-behavior:contain; }
[${marker}=panel] h2 { flex-shrink:0; margin:8px 10px; font-size:var(--text-sm); font-weight:500; color:var(--color-text-secondary); }
[${marker}=panel] [data-unread-row] { display:flex; flex-direction:column; gap:6px; width:100%; padding:10px; box-sizing:border-box; border:0; border-radius:var(--radius-xl); background:transparent; text-align:start; color:var(--color-text-primary); font:inherit; cursor:pointer; }
[${marker}=panel] [data-unread-row][aria-current=page] { background:var(--color-background-primary-ghost-hover); }
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
const scrim = document.createElement("div");
scrim.setAttribute(marker, "scrim");
scrim.setAttribute("aria-hidden", "true");
scrim.hidden = true;
document.body.append(scrim);
scrim.addEventListener("click", () => close(true), { signal });
let trigger = null, badge = null, binding = null, standalone = false;
let activityFrame = null, activityTimer = null;
let currentRow = null;
const recentRows = new Map();
const openedAt = new Map();
const messageUpdates = new Map();
let selectedKey = null;
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
function priorityRows(rows, recent = new Map(), now = Date.now()) {
  const unique = [...new Map(rows.map((row, index) => [row.dataset?.appActionSidebarThreadId || index, row])).values()];
  return unique.filter(row => isPriority(row) || now - (recent.get(row.dataset?.appActionSidebarThreadId) ?? -Infinity) < 3600000)
    .map(row => ({row, time:threadDetails(row).timestamp ?? 0}))
    .sort((a, b) => b.time - a.time).map(item => item.row);
}
function captureCurrentRow() {
  const selected = document.querySelector('#app-shell-sidebar [data-app-action-sidebar-thread-selected="true"]');
  if (selected) {
    currentRow = selected;
    const key = selected.dataset.appActionSidebarThreadId;
    if (key !== selectedKey) {
      selectedKey = key;
      openedAt.set(key, Date.now());
    }
    recentRows.set(key, selected);
  }
  // 当前打开的会话仍属于最近访问集合；其他会话按离开后的时间过期。
  if (selectedKey) openedAt.set(selectedKey, Date.now());
  for (const [key, time] of openedAt) if (Date.now() - time >= 3600000) {
    openedAt.delete(key); recentRows.delete(key);
  }
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
  const key = row.dataset.appActionSidebarThreadId;
  const working = isWorking(row);
  const message = row.querySelector("[data-thread-secondary-title]")?.textContent || "";
  const nativeTime = summary?.recencyAt ?? summary?.updatedAt ?? null;
  const previous = messageUpdates.get(key);
  // 原生流式摘要发生变化时推进时间，不因重绘或打开菜单重置消息时间。
  if (working && (!previous || previous.message !== message || !previous.working)) {
    messageUpdates.set(key, {message, working, time:Math.max(nativeTime || 0, Date.now())});
  } else if (previous) previous.working = working;
  return {
    title:row.dataset.appActionSidebarThreadTitle || row.querySelector("[data-thread-title]")?.textContent || "",
    summary:row.querySelector("[data-thread-secondary-title]")?.textContent || "",
    // 与原生 Thread hover card 相同，优先使用任务 recency 时间。
    timestamp:Math.max(nativeTime || 0, messageUpdates.get(key)?.time || 0) || null,
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
function close(restoreFocus = false) {
  cancelAnimationFrame(activityFrame); clearTimeout(activityTimer);
  activityFrame = null; activityTimer = null;
  panel.hidden = true;
  scrim.hidden = true;
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
  captureCurrentRow();
  const nativeRows = [...document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-thread-row]')];
  const currentKey = currentRow?.dataset.appActionSidebarThreadId;
  if (currentRow && !nativeRows.some(row => row.dataset.appActionSidebarThreadId === currentKey)) nativeRows.unshift(currentRow);
  for (const [key, row] of recentRows) if (!nativeRows.some(item => item.dataset.appActionSidebarThreadId === key)) nativeRows.push(row);
  const rows = priorityRows(nativeRows, openedAt);
  const details = rows.map(row => ({...threadDetails(row), current:row.dataset.appActionSidebarThreadId === currentKey}));
  const next = JSON.stringify([text("Priority", "优先事项"), details, Math.floor(Date.now() / 60000)]);
  if (signature === next) return;
  signature = next;
  panel.replaceChildren();
  panel.setAttribute("aria-label", text("Priority", "优先事项"));
  const heading = document.createElement("h2");
  heading.textContent = text("Priority", "优先事项");
  panel.append(heading);
  const list = document.createElement("div");
  list.className = "mcx-thread-list";
  panel.append(list);
  rows.forEach((row, index) => {
    const item = details[index];
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.unreadRow = "";
    if (item.current) card.setAttribute("aria-current", "page");
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
    card.addEventListener("click", () => { if (!item.current) row.click(); close(); });
    list.append(card);
  });
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "mcx-empty";
    empty.textContent = text("You're all caught up", "暂无未读会话");
    list.append(empty);
  }
}
function open() {
  if (!trigger) return;
  cacheProjectIcons();
  captureCurrentRow();
  const native = activityButton();
  if (!native) return;
  panel.hidden = false;
  scrim.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  renderRows(); position();
  // 先呈现浮层，下一帧之后再更新原生 Activity，避免同步 React 切换阻塞点击反馈。
  if (native.getAttribute("aria-pressed") !== "true") {
    activityFrame = requestAnimationFrame(() => {
      activityFrame = null;
      activityTimer = setTimeout(() => {
        activityTimer = null;
        if (disposed || panel.hidden) return;
        const latest = activityButton();
        if (latest?.getAttribute("aria-pressed") === "false") {
          restoreActivity = true; latest.click();
        }
      }, 0);
    });
  }
}
function visible(element) {
  return element && !element.closest('[aria-hidden="true"], [inert]') && element.checkVisibility();
}
function detachTrigger() {
  binding?.abort(); binding = null;
  if (standalone) trigger?.remove();
  else if (trigger) {
    for (const name of ["data-minecodex-task-title", "data-minecodex-unread", "role", "tabindex", "aria-haspopup", "aria-controls", "aria-expanded", "aria-label"]) trigger.removeAttribute(name);
  }
  badge?.remove(); badge = null; trigger = null;
}
function sync() {
  if (disposed) return;
  cacheProjectIcons();
  captureCurrentRow();
  const sidebarToggle = [...document.querySelectorAll("[data-app-shell-sidebar-trigger]")].find(visible);
  if (!sidebarToggle || sidebarToggle.getAttribute("aria-expanded") !== "false") {
    close(); detachTrigger(); return;
  }
  const title = [...document.querySelectorAll('[data-app-shell-titlebar-slot="main"] [data-app-shell-titlebar-content]')]
    .find(e => visible(e) && !e.querySelector("button, [role=tab], [data-app-shell-tab-row]"));
  const tabs = [...document.querySelectorAll('[data-app-shell-tab-row][role=presentation]')].find(visible);
  const target = title || tabs;
  if (!target) { close(); detachTrigger(); return; }
  const needsStandalone = !title;
  if (!trigger?.isConnected || standalone !== needsStandalone || (title ? trigger !== title : trigger.parentElement !== target)) {
    close(); detachTrigger(); standalone = needsStandalone;
    binding = new AbortController();
    if (title) {
      trigger = title;
      trigger.setAttribute("data-minecodex-task-title", "");
      trigger.setAttribute("role", "button");
      trigger.tabIndex = 0;
    } else {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "no-drag pointer-events-auto flex items-center justify-center gap-1 rounded-lg text-tertiary hover:bg-primary-ghost-hover button-toolbar px-2";
      target.prepend(trigger);
    }
    trigger.setAttribute(marker, "trigger");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    badge = document.createElement("span");
    badge.setAttribute("data-minecodex-task-badge", "");
    badge.innerHTML = taskGlyph;
    trigger.prepend(badge);
    trigger.addEventListener("click", event => { event.stopPropagation(); panel.hidden ? open() : close(); }, {signal:binding.signal});
    trigger.addEventListener("keydown", event => {
      if (["Enter", " ", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "ArrowDown" || panel.hidden) open(); else close();
      }
    }, {signal:binding.signal});
  }
  const label = text("Switch tasks", "切换任务");
  if (trigger.getAttribute("aria-label") !== label) trigger.setAttribute("aria-label", label);
  if (!panel.hidden) { renderRows(); position(); }
}
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; sync(); });
});
observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["aria-expanded", "aria-pressed", "aria-hidden", "data-app-shell-header-layout", "data-app-action-sidebar-thread-selected", "lang"] });
document.addEventListener("pointerdown", event => { if (event.target !== scrim && !trigger?.contains(event.target) && !panel.contains(event.target)) close(); }, { signal });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); close(true); } }, { signal });
window.addEventListener("resize", position, { signal });
const refreshTimer = setInterval(() => { if (!panel.hidden) renderRows(); }, 30000);
sync();
return () => {
  disposed = true; clearInterval(refreshTimer); observer.disconnect(); close(); detachTrigger(); panel.remove(); scrim.remove(); style.remove();
};
