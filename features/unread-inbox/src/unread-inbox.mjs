// 原生完整侧栏图标，取自当前 Codex 16px/20px 资源。
const sidebarGlyphs = {"16": "<svg aria-hidden=\"true\" class=\"_Icon_uttcz_1\" focusable=\"false\" height=\"16\" viewBox=\"0 0 16 16\" width=\"16\"><path d=\"M4.66699 4.80859C4.95683 4.80873 5.19238 5.04412 5.19238 5.33398V10.667C5.19238 10.9569 4.95683 11.1923 4.66699 11.1924C4.37704 11.1924 4.1416 10.9569 4.1416 10.667V5.33398C4.1416 5.04403 4.37704 4.80859 4.66699 4.80859Z\" fill=\"currentColor\"></path> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5 2.30762C13.1707 2.30762 14.5254 3.66235 14.5254 5.33301V10.666C14.5254 12.3367 13.1707 13.6914 11.5 13.6914H4.5C2.82934 13.6914 1.47461 12.3367 1.47461 10.666V5.33301C1.47461 3.66235 2.82934 2.30762 4.5 2.30762H11.5ZM4.5 3.3584C3.40924 3.3584 2.52539 4.24225 2.52539 5.33301V10.666C2.52539 11.7568 3.40924 12.6416 4.5 12.6416H11.5C12.5908 12.6416 13.4746 11.7568 13.4746 10.666V5.33301C13.4746 4.24225 12.5908 3.3584 11.5 3.3584H4.5Z\" fill=\"currentColor\"></path></svg>", "20": "<svg aria-hidden=\"true\" class=\"_Icon_uttcz_1\" focusable=\"false\" height=\"20\" viewBox=\"0 0 20 20\" width=\"20\"><path d=\"M5.83301 6.00098C6.20028 6.00098 6.49805 6.29875 6.49805 6.66602V13.333C6.49787 13.7001 6.20017 13.998 5.83301 13.998C5.46596 13.9979 5.16814 13.7 5.16797 13.333V6.66602C5.16797 6.29883 5.46585 6.00111 5.83301 6.00098Z\" fill=\"currentColor\"></path> <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M14.5 2.87695C16.5241 2.87695 18.165 4.51787 18.165 6.54199V13.459C18.1649 15.483 16.524 17.124 14.5 17.124H5.5C3.47598 17.124 1.83514 15.483 1.83496 13.459V6.54199C1.83496 4.51787 3.47588 2.87695 5.5 2.87695H14.5ZM5.5 4.20703C4.21042 4.20703 3.16504 5.25241 3.16504 6.54199V13.459C3.16521 14.7484 4.21052 15.7939 5.5 15.7939H14.5C15.7895 15.7939 16.8348 14.7484 16.835 13.459V6.54199C16.835 5.25241 15.7896 4.20703 14.5 4.20703H5.5Z\" fill=\"currentColor\"></path></svg>"};
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
[data-minecodex-task-badge] { display:inline-flex; flex-shrink:0; align-items:center; gap:4px; color:var(--color-text-secondary); font-family:var(--font-sans-default); font-size:var(--text-xs); font-variant-numeric:tabular-nums; position:relative; }
[data-minecodex-task-badge][data-notification]::after { content:""; position:absolute; width:6px; height:6px; right:-2px; top:-1px; border-radius:50%; background:var(--blue-400,#3A83F7); box-shadow:0 0 0 1.5px var(--color-token-dropdown-background); }
[data-minecodex-task-badge][data-notification=red]::after { background:#FF3B30; }
[data-minecodex-sidebar-original] { display:none !important; }
[data-minecodex-unread=trigger] { -webkit-app-region:no-drag; }
[${marker}=panel] { position:fixed; z-index:2147483000; box-sizing:border-box; width:min(320px,calc(100vw - 16px)); max-height:min(440px,calc(100vh - 64px)); display:flex; flex-direction:column; overflow:hidden; padding:6px 0;  border-radius:16px;  color:var(--color-text-primary);  font-family:var(--font-sans-default); font-size:var(--text-sm); }
[${marker}=panel][hidden] { display:none; }
[${marker}=panel] .mcx-thread-list { min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 6px; scrollbar-width:thin; scrollbar-color:var(--color-border) transparent; }
[${marker}=panel] .mcx-thread-list:hover, [${marker}=panel] .mcx-thread-list:active { scrollbar-color:var(--color-border-strong) transparent; }
[${marker}=panel] h2 { flex-shrink:0; margin:8px 16px; font-size:var(--text-sm); font-weight:500; color:var(--color-text-tertiary); }
[${marker}=panel] [data-unread-row] { display:flex; flex-direction:column; gap:4px; width:100%; padding:10px 12px; box-sizing:border-box; border:0; border-radius:10px; background:transparent; text-align:start; color:var(--color-text-primary); font:inherit; cursor:pointer; }
[${marker}=panel] [data-unread-row][aria-current=page] .mcx-thread-title::before { content:""; display:inline-block; width:5px; height:5px; margin-inline-end:6px; border-radius:50%; background:currentColor; vertical-align:middle; }
[${marker}=panel] [data-unread-row]:hover { background:var(--color-background-primary-ghost-hover); }
[${marker}=panel] [data-unread-row]:focus-visible { outline:2px solid var(--color-ring); outline-offset:-2px; }
[${marker}=panel] .mcx-thread-header { display:flex; align-items:center; gap:8px; width:100%; min-width:0; }
[${marker}=panel] .mcx-thread-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; font-size:13px; line-height:18px; font-weight:500; }
[${marker}=panel] .mcx-device { display:flex; flex-shrink:0; color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-loading { margin-inline-start:auto; flex-shrink:0; display:flex; align-items:center; color:var(--color-text-tertiary); }
[${marker}=panel] time { margin-inline-start:auto; flex-shrink:0; font-size:var(--text-xs); color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-summary { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; line-height:16px; color:var(--color-text-tertiary); }
[${marker}=panel] .mcx-project { display:flex; align-items:center; gap:6px; padding:0; min-width:0; font-size:11px; line-height:16px; color:var(--color-text-tertiary); font-weight:400; }
[${marker}=panel] .mcx-project > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[${marker}=panel] .mcx-project svg, [${marker}=panel] .mcx-project-icon { width:12px; height:12px; flex:none; }
[${marker}=panel] .mcx-project-icon > * { width:12px; height:12px; }
[${marker}=panel] .mcx-attention { margin-inline-start:auto; flex:none; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:999px; padding:2px 10px 2px 8px; font-size:12px; line-height:16px; color:var(--color-chart-blue); background:color-mix(in srgb,var(--color-chart-blue) 15%,transparent); }
[${marker}=panel] .mcx-attention[data-attention="approval"] { color:var(--color-chart-green); background:color-mix(in srgb,var(--color-chart-green) 20%,transparent); }
[${marker}=panel] .mcx-empty { margin:20px 12px; color:var(--color-text-tertiary); }
`;
document.head.append(style);
const panel = document.createElement("div");
panel.setAttribute(marker, "panel");
config.ui.surface(panel);
panel.id = "minecodex-unread-panel";
panel.setAttribute("role", "dialog");
panel.hidden = true;
document.body.append(panel);
let trigger = null, badge = null, binding = null, standalone = false;
let activityFrame = null, activityTimer = null;
let hoverOpenTimer = null, hoverCloseTimer = null;
function cancelHoverTimers() {
  clearTimeout(hoverOpenTimer); clearTimeout(hoverCloseTimer);
}
function scheduleHoverOpen() {
  cancelHoverTimers();
  if (panel.hidden) hoverOpenTimer = setTimeout(open, 150);
}
function scheduleHoverClose() {
  cancelHoverTimers();
  // 留出跨越入口与浮层间隙的时间。
  hoverCloseTimer = setTimeout(() => close(), 250);
}
panel.addEventListener("pointerenter", cancelHoverTimers, { signal });
panel.addEventListener("pointerleave", scheduleHoverClose, { signal });
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
// 缓存数据与原生导航动作，不保留会被 React 卸载的会话 DOM。
function threadRecord(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  let activate = null;
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props?.statusState && typeof props.onClick === "function") { activate = props.onClick; break; }
  }
  return { ...threadDetails(row), key:row.dataset.appActionSidebarThreadId, unread:isUnread(row), activate, spinner:row.querySelector?.('[class~="motion-safe:animate-spin"]')?.outerHTML ?? "" };
}
function notificationColor(records) {
  return records.some(item => item.attention) ? "red" : records.some(item => item.unread) ? "blue" : null;
}
function selectThreads(records, recent, now = Date.now(), currentKey = null) {
  const rank = item => item.attention === "input" ? 0 : item.attention === "approval" ? 1 : item.unread ? 2 : item.working ? 3 : 4;
  return [...new Map(records.map(item => [item.key, item])).values()]
    .filter(item => item.key !== currentKey && (item.attention || item.working || item.unread || now - (recent.get(item.key) ?? -Infinity) < 3600000))
    .sort((a, b) => rank(a) - rank(b) || (b.timestamp ?? 0) - (a.timestamp ?? 0));
}
function captureCurrentRow() {
  const selected = document.querySelector('#app-shell-sidebar [data-app-action-sidebar-thread-selected="true"]');
  const id = document.querySelector('[data-above-composer-conversation-id]')?.getAttribute('data-above-composer-conversation-id');
  selectedKey = selected?.dataset.appActionSidebarThreadId
    ?? [...recentRows.keys()].find(key => id && key.endsWith(":" + id)) ?? null;
  if (selected) recentRows.set(selectedKey, threadRecord(selected));
  if (selectedKey) openedAt.set(selectedKey, Date.now());
  for (const [key, time] of openedAt) if (Date.now() - time >= 3600000) {
    openedAt.delete(key); recentRows.delete(key); messageUpdates.delete(key);
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
function attentionState(row) {
  let fiber = row[Object.keys(row).find(key => key.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    // 复用原生状态契约，不从摘要文案推断待确认状态。
    if (props?.chips?.some(chip => chip.id === "awaiting-approval")) return "approval";
    if (props?.statusPill?.label?.props?.id === "codex.localTaskRow.needsInput") return "input";
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
    attention:attentionState(row),
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
  cancelHoverTimers();
  cancelAnimationFrame(activityFrame); clearTimeout(activityTimer);
  activityFrame = null; activityTimer = null;
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
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(320, innerWidth - 16);
  panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
  panel.style.top = `${rect.bottom + 8}px`;
  panel.style.maxWidth = `${width}px`;
  panel.style.maxHeight = `${Math.max(0, Math.min(440, innerHeight - rect.bottom - 24))}px`;
}
function activityRecords() {
  captureCurrentRow();
  const records = [...document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-thread-row]')].map(threadRecord);
  const mounted = new Set(records.map(item => item.key));
  for (const item of records) if (openedAt.has(item.key)) recentRows.set(item.key, item);
  for (const [key, item] of recentRows) if (!mounted.has(key)) records.push({ ...item, working:false, unread:false, attention:null });
  return selectThreads(records, openedAt, Date.now(), selectedKey);
}
function syncNotification(details) {
  const color = notificationColor(details);
  if (color) { if (badge?.dataset.notification !== color) badge?.setAttribute("data-notification", color); }
  else badge?.removeAttribute("data-notification");
}
function renderRows(details = activityRecords()) {
  syncNotification(details);
  if (!details.length) { close(); return; }
  const next = JSON.stringify([text("Recent activity", "最近活动"), details, Math.floor(Date.now() / 60000)]);
  if (signature === next) return;
  signature = next;
  const scrollTop = panel.querySelector(".mcx-thread-list")?.scrollTop ?? 0;
  const focusedKey = panel.contains(document.activeElement) ? document.activeElement?.dataset.threadKey : null;
  panel.replaceChildren();
  panel.setAttribute("aria-label", text("Recent activity", "最近活动"));
  const heading = document.createElement("h2");
  heading.textContent = text("Recent activity", "最近活动");
  panel.append(heading);
  const list = document.createElement("div");
  list.className = "mcx-thread-list";
  panel.append(list);
  details.forEach(item => {
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.unreadRow = "";
    card.dataset.threadKey = item.key;
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
    device.setAttribute("data-minecodex-tooltip", text("Remote", "远程"));
    device.setAttribute("aria-label", device.title);
    header.append(title);
    if (remote) header.append(device);
    const elapsed = relativeTime(item.timestamp);
    if (item.attention) {
      const label = document.createElement("span");
      label.className = "mcx-attention";
      label.dataset.attention = item.attention;
      label.textContent = item.attention === "approval" ? text("Awaiting approval", "等待批准") : text("Needs input", "需要回复");
      header.append(label);
    } else if (item.working) {
      const loading = document.createElement("span");
      loading.className = "mcx-loading";
      loading.setAttribute("role", "status");
      loading.setAttribute("aria-label", text("Working", "正在工作"));
      // 直接复用当前会话原生 loading，保持动画与 reduced-motion 行为一致。
      loading.innerHTML = item.spinner;
      header.append(loading);
    } else if (elapsed) {
      const time = document.createElement("time");
      time.dateTime = new Date(item.timestamp).toISOString();
      time.textContent = elapsed;
      time.setAttribute("data-minecodex-tooltip", new Date(item.timestamp).toLocaleString());
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
      const icon = document.createElement("span");
      icon.className = "mcx-project-icon";
      const glyph = projectIcons.get(item.project.id)?.cloneNode(true);
      if (glyph) icon.append(glyph);
      else icon.innerHTML = folderGlyph;
      project.append(icon);
      const name = document.createElement("span");
      name.textContent = item.project.name;
      project.append(name);
      card.append(project);
    }
    card.addEventListener("click", () => {
      if (!item.current) {
        const native = [...document.querySelectorAll('#app-shell-sidebar [data-app-action-sidebar-thread-row]')]
          .find(row => row.dataset.appActionSidebarThreadId === item.key);
        const activate = native ? threadRecord(native).activate : item.activate;
        if (!activate) return;
        activate();
      }
      close();
    });
    list.append(card);
  });
  if (!details.length) {
    const empty = document.createElement("p");
    empty.className = "mcx-empty";
    empty.textContent = text("You're all caught up", "暂无未读会话");
    list.append(empty);
  }
  if (focusedKey) [...list.children].find(card => card.dataset.threadKey === focusedKey)?.focus({ preventScroll:true });
  list.scrollTop = scrollTop;
}
function open() {
  if (!trigger) return;
  cacheProjectIcons();
  captureCurrentRow();
  const native = activityButton();
  if (!native) return;
  const details = activityRecords();
  syncNotification(details);
  if (!details.length) return;
  panel.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  renderRows(details); position();
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
const nativeSidebarIcons = new Map();
function restoreSidebarIcons() {
  for (const [original, replacement] of nativeSidebarIcons) {
    original.removeAttribute("data-minecodex-sidebar-original"); replacement.remove();
  }
  nativeSidebarIcons.clear();
}
function syncSidebarIcons(toggle) {
  for (const [original, replacement] of nativeSidebarIcons) {
    if (!original.isConnected || !toggle.contains(original)) {
      original.removeAttribute("data-minecodex-sidebar-original"); replacement.remove(); nativeSidebarIcons.delete(original);
    }
  }
  for (const original of toggle.querySelectorAll('svg:not([data-minecodex-sidebar-replacement])')) {
    if (nativeSidebarIcons.has(original)) continue;
    const glyph = sidebarGlyphs[original.getAttribute("width")];
    if (!glyph) continue;
    const container = document.createElement("span");
    container.innerHTML = glyph;
    const replacement = container.firstElementChild;
    replacement.setAttribute("class", original.getAttribute("class") || "");
    replacement.setAttribute("data-minecodex-sidebar-replacement", "");
    replacement.setAttribute("data-no-autosize", "true");
    // 不移除 React 所有的 SVG，只切换显示并插入独立资源。
    original.setAttribute("data-minecodex-sidebar-original", "");
    original.after(replacement); nativeSidebarIcons.set(original, replacement);
  }
}
function detachTrigger() {
  restoreSidebarIcons();
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
    trigger.addEventListener("click", event => { event.stopPropagation(); if (panel.hidden) open(); }, {signal:binding.signal});
    trigger.addEventListener("pointerenter", scheduleHoverOpen, { signal:binding.signal });
    trigger.addEventListener("pointerleave", scheduleHoverClose, { signal:binding.signal });
    trigger.addEventListener("keydown", event => {
      if (["Enter", " ", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "ArrowDown" || panel.hidden) open(); else close();
      }
    }, {signal:binding.signal});
  }
  syncSidebarIcons(sidebarToggle);
  const details = activityRecords();
  syncNotification(details);
  const label = text("Recent activity", "最近活动");
  if (trigger.getAttribute("aria-label") !== label) trigger.setAttribute("aria-label", label);
  if (!panel.hidden) { renderRows(details); position(); }
}
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; sync(); });
});
observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["aria-expanded", "aria-pressed", "aria-hidden", "data-app-shell-header-layout", "data-app-action-sidebar-thread-selected", "lang"] });
document.addEventListener("pointerdown", event => { if (!trigger?.contains(event.target) && !panel.contains(event.target)) close(); }, { signal });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); close(true); } }, { signal });
window.addEventListener("resize", position, { signal });
const refreshTimer = setInterval(sync, 30000);
sync();
return () => {
  disposed = true; clearInterval(refreshTimer); observer.disconnect(); close(); detachTrigger(); panel.remove(); style.remove();
};
