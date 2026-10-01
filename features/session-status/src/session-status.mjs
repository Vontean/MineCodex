// page-script：数据由 Runtime Host 单向传入，页面只负责展示。
const MARKER = "data-minecodex-session-status";
const STYLE_ID = "minecodex-session-status-style";
const copyByLocale = { "zh-CN": {
  turns: "回合", steps: "步", speed: "TPS", cache: "缓存", cacheDetail: "缓存命中",
  statistics: "会话统计", usage: "Token 用量", context: "上下文详情", total: "总量",
  firstToken: "平均首字延迟", input: "输入", cached: "缓存输入", output: "输出",
  sum: "合计", capacity: "窗口容量", contextShare: "上下文占用", compactions: "压缩次数",
  instructions: "指令", messages: "消息", toolHistory: "工具交互", other: "未分类",
  speedHelp: "关于 TPS", speedInfo: "GPT 等模型不公开完整思考过程及逐 Token 生成时间。这里的 TPS 是基于可观测事件估算的体感响应速度，仅供参考，不代表模型真实的 Token 生成速度。",
}, en: {
  turns: "turns", steps: "steps", speed: "TPS", cache: "Cache", cacheDetail: "Cache hit",
  statistics: "Session stats", usage: "Token usage", context: "Context", total: "Total",
  firstToken: "Avg first token", input: "Input", cached: "Cached input", output: "Output",
  sum: "Sum", capacity: "Window size", contextShare: "Context used", compactions: "Compactions",
  instructions: "Instructions", messages: "Messages", toolHistory: "Tool activity", other: "Unclassified",
  speedHelp: "About TPS", speedInfo: "Models such as GPT do not expose their full reasoning process or per-token generation timing. This TPS estimate reflects perceived response speed based on observable events, rather than the model’s actual token generation speed.",
} };
function selectedCopy() {
  const language = document.documentElement.lang || navigator.languages?.[0] || navigator.language || "en";
  return String(language).toLowerCase().startsWith("zh") ? copyByLocale["zh-CN"] : copyByLocale.en;
}

// 图标来自 Lucide Static 与 Phosphor Icons；许可见 vendor/。
const icons = {
  // Lucide info，使用官方 SVG 路径。
  info: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  statistics: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  usage: '<svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>',
};

document.getElementById(STYLE_ID)?.remove();
const style = document.createElement("style");
style.id = STYLE_ID;
style.textContent = `
  [${MARKER}] { box-sizing:border-box; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:0 4px; margin:0 auto; padding-top:2px; max-width:100%; min-height:24px; min-width:0; font-family:var(--font-sans-default,inherit); font-size:var(--text-xs,12px); line-height:16px; font-variant-numeric:tabular-nums; color:var(--color-text-tertiary); }
  [${MARKER}][hidden] { display:none; }
  [data-minecodex-session-reveal] { display:grid; grid-template-rows:0fr; opacity:0; transition:grid-template-rows 200ms ease,opacity 160ms ease; }
  [data-minecodex-session-reveal][data-expanded] { grid-template-rows:1fr; opacity:1; }
  @starting-style { [data-minecodex-session-reveal][data-expanded] { grid-template-rows:0fr; opacity:0; } }
  [data-minecodex-session-reveal][data-expanded]:not([hidden]) { margin-top:-4px; }
  [data-minecodex-session-reveal] > div { min-height:0; overflow:hidden; }
  [data-minecodex-session-reveal]:not([data-expanded]) { pointer-events:none; }
  [data-minecodex-session-reveal][hidden] { display:none; }
  /* 仅展开状态行时缩减原生底部留白；收起或卸载后自动恢复。 */
  .bottom-0.pb-4:has([data-minecodex-session-reveal][data-expanded]:not([hidden])) { padding-bottom:4px; }
  [data-minecodex-context-trigger] { display:inline-flex; align-items:center; justify-content:center; flex:none; width:24px; height:var(--height-token-button-composer,28px); padding:0; border:0; border-radius:var(--radius-full); background:transparent; color:var(--color-text-tertiary); cursor:pointer; }
  [data-minecodex-context-trigger][hidden] { display:none; }
  [data-context-progress] { transition:stroke-dashoffset 120ms ease-out; }
  [data-minecodex-context-trigger]:hover { background:var(--color-background-primary-ghost-hover); }
  [data-minecodex-context-trigger]:focus-visible { outline:2px solid var(--color-ring); }
  [data-minecodex-context-trigger] svg { width:12px; height:12px; }
  [data-minecodex-native-context] { display:none !important; }
  [data-minecodex-context-tooltip] { position:fixed; z-index:2147483000; pointer-events:none; width:max-content; padding:5px 12px; border:1px solid var(--color-border-tooltip); border-radius:var(--radius-2xl); background:var(--color-background-tooltip); color:var(--color-text-tooltip); box-shadow:var(--shadow-tooltip); font-family:var(--font-sans-default); font-size:var(--text-sm); line-height:18px; font-weight:var(--tooltip-compact-font-weight); letter-spacing:var(--tracking-tooltip); text-align:center; white-space:pre-line; }
  @media (prefers-reduced-motion:reduce) { [data-minecodex-session-reveal], [data-context-progress] { transition:none; } }
  [${MARKER}] button { box-sizing:border-box; display:inline-flex; align-items:center; gap:6px; height:22px; color:inherit; font:inherit; border:0; border-radius:var(--radius-xl,12px); background:transparent; padding:3px 6px; cursor:pointer; white-space:nowrap; }
  [${MARKER}] svg, [data-minecodex-session-status-panel] h3 svg { width:14px; height:14px; flex:none; stroke-width:1.75; }
  [${MARKER}] [data-kind="context"] svg, [data-minecodex-session-status-panel] h3 .context-ring { width:12px; height:12px; stroke-width:2; }
  [${MARKER}] button:hover, [${MARKER}] button[aria-expanded="true"] { background:var(--color-token-list-hover-background); }
  [${MARKER}] button:focus-visible { outline:2px solid var(--input-outline-border-color-focus); outline-offset:1px; }
  [data-minecodex-session-status-panel] { --mcx-purple:var(--app-block-accent-purple,light-dark(#8952ee,#7849d1)); --mcx-blue:var(--app-block-accent-blue,light-dark(#3a83f7,#2c67c5)); --mcx-green:var(--app-block-accent-green,light-dark(#53b559,#48a04c)); box-sizing:border-box; position:fixed; z-index:2147483000; min-width:260px; max-width:min(360px,calc(100vw - 24px)); padding:16px;  border-radius:var(--radius-xl,14px);  color:var(--color-text-primary); font-family:var(--font-sans-default,inherit); font-size:13px;  }
  [data-minecodex-session-status-panel] h3 { display:flex; align-items:center; gap:8px; margin:0 0 12px; padding:0 0 10px; border-bottom:1px solid var(--color-border-subtle); font-size:14px; font-weight:600; }
  [data-minecodex-session-status-panel] dl { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 20px; margin:0; }
  [data-minecodex-session-status-panel] dt { color:var(--color-text-tertiary); }
  [data-minecodex-session-status-panel] .tps-label { display:flex; align-items:center; gap:6px; }
  [data-minecodex-session-status-panel] .tps-info { display:inline-flex; align-items:center; padding:0; border:0; background:transparent; color:inherit; cursor:help; }
  [data-minecodex-session-status-panel] .tps-info svg { width:12px; height:12px; }
  [data-minecodex-session-status-panel] .tps-info:focus-visible { outline:2px solid var(--color-ring); outline-offset:2px; border-radius:var(--radius-full); }
  [data-minecodex-session-status-panel] dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  [data-minecodex-session-status-panel] .context-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; }
  [data-minecodex-session-status-panel] .context-head span:first-child { color:var(--color-text-tertiary); }
  [data-minecodex-session-status-panel] .context-bar, [data-minecodex-session-status-panel] .mix-bar { display:flex; height:6px; overflow:hidden; border-radius:var(--radius-xl); background:var(--color-token-border-default); }
  [data-minecodex-session-status-panel] .context-bar { margin-bottom:14px; }
  [data-minecodex-session-status-panel] .mix-bar { grid-column:1 / -1; margin:0 0 3px; }
  [data-minecodex-session-status-panel] .context-bar span, [data-minecodex-session-status-panel] .mix-bar span { display:block; flex:none; height:100%; }
  [data-minecodex-session-status-panel] .context-bar [data-segment="instructions"] { background:var(--mcx-purple); }
  [data-minecodex-session-status-panel] .context-bar [data-segment="messages"], [data-minecodex-session-status-panel] .context-bar [data-segment="overall"] { background:var(--mcx-blue); }
  [data-minecodex-session-status-panel] .context-bar [data-segment="tools"] { background:var(--mcx-green); }
  [data-minecodex-session-status-panel] .context-bar [data-segment="other"] { background:var(--color-text-tertiary); opacity:.4; }
  [data-minecodex-session-status-panel] .mix-bar [data-tone="purple"], [data-minecodex-session-status-panel] dt[data-tone="purple"]::before { background:var(--mcx-purple); }
  [data-minecodex-session-status-panel] .mix-bar [data-tone="blue"], [data-minecodex-session-status-panel] dt[data-tone="blue"]::before { background:var(--mcx-blue); }
  [data-minecodex-session-status-panel] .mix-bar [data-tone="green"], [data-minecodex-session-status-panel] dt[data-tone="green"]::before { background:var(--mcx-green); }
  [data-minecodex-session-status-panel] .detail-divider { grid-column:1 / -1; margin-top:4px; border-top:1px solid var(--color-border-subtle); }
  [data-minecodex-session-status-panel] dt[data-tone] { display:flex; align-items:center; gap:7px; }
  [data-minecodex-session-status-panel] dt[data-tone]::before { content:""; flex:none; width:7px; height:7px; border-radius:2px; }
`;
document.head.append(style);

const instances = new Map();
const expansionKey = "minecodex:session-status:expanded";
let globalExpanded = localStorage.getItem(expansionKey) !== "false";
let instanceSequence = 0;
function setGlobalExpanded(value) {
  globalExpanded = value;
  localStorage.setItem(expansionKey, String(value));
  for (const instance of instances.values()) instance.setExpanded(value);
}
window.addEventListener("storage", (event) => {
  if (event.key !== expansionKey) return;
  globalExpanded = event.newValue !== "false";
  for (const instance of instances.values()) instance.setExpanded(globalExpanded);
}, { signal });
// Codex 会把离屏输入框搬到 Quick Chat 浮层；节点仍连接不代表当前页面是聊天。
function isActiveComposer(composer) {
  const card = composer.closest('[data-codex-composer-root]');
  return Boolean(composer.isConnected
    && card?.getAttribute('data-composer-placement') === 'thread'
    && !composer.closest('[hidden], [inert], [aria-hidden="true"], [data-floating-chat-surface], [data-right-panel-composer-overlay-content]')
    && composer.checkVisibility({ visibilityProperty: true }));
}
function createInstance(composerElement) {
let copy = selectedCopy();
const controller = new AbortController();
const signal = controller.signal;
const instanceId = ++instanceSequence;
const root = document.createElement("div");
root.setAttribute(MARKER, "");
root.hidden = true;
function createContextRing() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("context-ring");
  for (const opacity of ["0.16", "1"]) {
    const circle = document.createElementNS(namespace, "circle");
    for (const [name, value] of Object.entries({ cx: "6", cy: "6", r: "5", fill: "none", stroke: "currentColor", "stroke-width": "2", opacity })) {
      circle.setAttribute(name, value);
    }
    if (opacity === "1") {
      circle.setAttribute("pathLength", "100");
      circle.setAttribute("stroke-dasharray", "100");
      circle.setAttribute("stroke-dashoffset", "100");
      circle.setAttribute("stroke-linecap", "round");
      circle.setAttribute("transform", "rotate(-90 6 6)");
      circle.dataset.contextProgress = "";
    }
    svg.append(circle);
  }
  return svg;
}
const reveal = document.createElement("div");
reveal.dataset.minecodexSessionReveal = "";
const clip = document.createElement("div");
clip.append(root);
reveal.append(clip);
root.id = `minecodex-session-details-${instanceId}`;
const trigger = document.createElement("button");
trigger.type = "button";
trigger.dataset.minecodexContextTrigger = "";
trigger.setAttribute("aria-controls", root.id);
trigger.append(createContextRing());
const tooltip = document.createElement("div");
tooltip.id = `minecodex-context-tooltip-${instanceId}`;
tooltip.dataset.minecodexContextTooltip = "";
tooltip.setAttribute("role", "tooltip");
tooltip.hidden = true;
document.body.append(tooltip);
let expanded = globalExpanded;
let collapseTimer = null;
let collapsing = false;
const nativeIndicators = new Set();
function setExpanded(value) {
  clearTimeout(collapseTimer);
  collapsing = expanded && !value && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  expanded = value;
  if (collapsing) collapseTimer = setTimeout(() => {
    collapsing = false;
    syncVisibility(findComposer());
  }, 200);
  reveal.toggleAttribute("data-expanded", expanded);
  clip.inert = !expanded;
  trigger.setAttribute("aria-expanded", String(expanded));
  tooltip.hidden = true;
  if (expanded) reveal.hidden = false;
  syncVisibility(findComposer());
  if (!expanded) closePanel();
}
trigger.addEventListener("click", () => setGlobalExpanded(!expanded), { signal });
function hideTooltip() { tooltip.hidden = true; trigger.removeAttribute("aria-describedby"); }
function showContextTooltip() {
  const value = snapshot;
  const percent = value?.contextPercent;
  const zh = copy === copyByLocale["zh-CN"];
  const status = percent == null ? "—" : percent >= 50
    ? (zh ? `已占用 ${percent}%` : `${percent}% full`)
    : (zh ? `已使用 ${percent}%（剩余 ${100 - percent}%）` : `${percent}% used (${100 - percent}% left)`);
  const tokens = value?.contextWindow == null ? "" : `${zh ? "已使用 " : ""}${Math.round(value.contextUsedTokens / 1000)}k / ${Math.round(value.contextWindow / 1000)}k ${zh ? "Token" : "tokens used"}`;
  tooltip.replaceChildren();
  for (const [text, muted] of [[zh ? "上下文窗口：" : "Context window:", true], [status, percent >= 50], [tokens, false]]) {
    if (!text) continue;
    const line = document.createElement("div");
    line.textContent = text;
    if (muted) line.style.opacity = "0.6";
    tooltip.append(line);
  }
  tooltip.hidden = false;
  trigger.setAttribute("aria-describedby", tooltip.id);
  const rect = trigger.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, rect.left + (rect.width - tooltip.offsetWidth) / 2))}px`;
  tooltip.style.top = `${rect.top - tooltip.offsetHeight - 4}px`;
}
trigger.addEventListener("pointerenter", showContextTooltip, { signal });
trigger.addEventListener("focus", showContextTooltip, { signal });
trigger.addEventListener("pointerleave", hideTooltip, { signal });
trigger.addEventListener("blur", hideTooltip, { signal });
const buttons = ["statistics", "usage", "context"].map((kind) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.kind = kind;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  if (kind === "context") button.append(createContextRing());
  else button.insertAdjacentHTML("beforeend", icons[kind]);
  const label = document.createElement("span");
  label.className = "status-label";
  button.append(label);
  root.append(button);
  return button;
});
const collapse = document.createElement("button");
collapse.type = "button";
// Lucide chevron-up，与状态栏其余线性图标保持相同笔画。
collapse.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
collapse.addEventListener("click", () => { setGlobalExpanded(false); trigger.focus(); hideTooltip(); }, { signal });
root.append(collapse);
let snapshot = null;
// 统计刷新会重建浮窗，复用图标节点以保留 tooltip 的悬浮锚点。
const tpsInfo = document.createElement("button");
tpsInfo.type = "button";
tpsInfo.className = "tps-info";
tpsInfo.innerHTML = icons.info;
let panel = null;
let openKind = null;
let rescanQueued = false;
let activeThreadId = null;
let refreshTimer = null;
let refreshSequence = 0;
let disposed = false;
let lastRevision = 0;

function cachePercent(value) {
  const percent = value?.inputTokens > 0 && value.cachedInputTokens != null
    ? value.cachedInputTokens / value.inputTokens * 100 : value?.cacheHitPercent;
  return percent == null ? "—" : `${percent > 99 ? percent.toFixed(1) : Math.round(percent)}%`;
}
function number(value) { return value == null ? "—" : new Intl.NumberFormat().format(value); }
function compact(value) {
  if (value == null) return "—";
  if (value < 1000) return number(value);
  const millions = value >= 999_950;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / (millions ? 1e6 : 1e3))}${millions ? "M" : "K"}`;
}
function tokenValue(value) { return value == null ? "—" : compact(value); }
function sectionValue(value) { return `~${compact(value)}`; }
function contextBarSegments(value) {
  const windowSize = value.contextWindow;
  const used = Math.min(windowSize, Math.max(0, value.contextUsedTokens ?? 0));
  if (!(windowSize > 0) || used === 0) return [];
  if (!value.contextSections) return [["overall", used]];
  const known = [
    ["instructions", Math.max(0, value.contextSections.instructions ?? 0)],
    ["messages", Math.max(0, value.contextSections.messages ?? 0)],
    ["tools", Math.max(0, value.contextSections.toolHistory ?? 0)],
  ];
  const estimatedTotal = known.reduce((sum, [, amount]) => sum + amount, 0);
  const scale = estimatedTotal > used ? used / estimatedTotal : 1;
  const segments = known.map(([kind, amount]) => [kind, amount * scale]);
  if (estimatedTotal < used) segments.push(["other", used - estimatedTotal]);
  return segments.filter(([, amount]) => amount > 0);
}
function duration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}
function row(dl, label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  dl.append(dt, dd);
  return dt;
}
function divider(dl) {
  const line = document.createElement("div");
  line.className = "detail-divider";
  dl.append(line);
}
function appendMixBar(dl, title, parts) {
  const visible = parts.filter(([, , amount]) => Number.isFinite(amount) && amount > 0);
  const total = visible.reduce((sum, [, , amount]) => sum + amount, 0);
  if (total === 0) return;
  const bar = document.createElement("div");
  bar.className = "mix-bar";
  bar.setAttribute("role", "img");
  const percent = (amount) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(amount / total * 100);
  bar.setAttribute("aria-label", `${title}: ${visible.map(([, name, amount]) => `${name} ${percent(amount)}%`).join(", ")}`);
  for (const [tone, name, amount] of visible) {
    const segment = document.createElement("span");
    segment.dataset.tone = tone;
    segment.style.width = `${amount / total * 100}%`;
    segment.setAttribute("data-minecodex-tooltip", `${name} ${percent(amount)}%`);
    bar.append(segment);
  }
  dl.append(bar);
}
function closePanel() {
  panel?.remove();
  panel = null;
  openKind = null;
  for (const button of buttons) button.setAttribute("aria-expanded", "false");
}
function showPanel(kind) {
  closePanel();
  if (!snapshot) return;
  const anchor = buttons.find((button) => button.dataset.kind === kind);
  if (!anchor) return;
  openKind = kind;
  anchor.setAttribute("aria-expanded", "true");
  panel = document.createElement("div");
  panel.dataset.minecodexSessionStatusPanel = kind;
  config.ui.surface(panel);
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", copy[kind]);
  const heading = document.createElement("h3");
  heading.textContent = copy[kind];
  heading.prepend(anchor.querySelector("svg").cloneNode(true));
  const dl = document.createElement("dl");
  panel.append(heading, dl);
  if (kind === "statistics") {
    row(dl, copy.turns, number(snapshot.turns));
    row(dl, copy.steps, number(snapshot.steps));
    row(dl, copy.firstToken, duration(snapshot.averageFirstTokenMs));
    const speedLabel = row(dl, copy.speed, snapshot.observedTps == null ? "—" : `${number(snapshot.observedTps)} tok/s`);
    speedLabel.className = "tps-label";
    tpsInfo.setAttribute("aria-label", copy.speedHelp);
    tpsInfo.setAttribute("data-minecodex-tooltip", copy.speedInfo);
    speedLabel.append(tpsInfo);
  } else if (kind === "usage") {
    row(dl, copy.total, tokenValue(snapshot.totalTokens));
    const otherInput = snapshot.inputTokens == null || snapshot.cachedInputTokens == null
      ? null : Math.max(0, snapshot.inputTokens - snapshot.cachedInputTokens);
    appendMixBar(dl, copy.total, [
      ["purple", copy.output, snapshot.outputTokens],
      ["blue", copy.input, otherInput],
      ["green", copy.cached, snapshot.cachedInputTokens],
    ]);
    row(dl, copy.output, tokenValue(snapshot.outputTokens)).dataset.tone = "purple";
    row(dl, copy.input, tokenValue(otherInput)).dataset.tone = "blue";
    row(dl, copy.cached, tokenValue(snapshot.cachedInputTokens)).dataset.tone = "green";
    divider(dl);
    row(dl, copy.cacheDetail, cachePercent(snapshot));
  } else {
    if (snapshot.contextPercent != null) {
      const head = document.createElement("div");
      head.className = "context-head";
      const label = document.createElement("span");
      label.textContent = copy.contextShare;
      const value = document.createElement("span");
      value.textContent = `${snapshot.contextPercent}%`;
      head.append(label, value);
      const bar = document.createElement("div");
      bar.className = "context-bar";
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${copy.contextShare} ${snapshot.contextPercent}%`);
      for (const [kind, amount] of contextBarSegments(snapshot)) {
        const segment = document.createElement("span");
        segment.dataset.segment = kind;
        segment.style.width = `${amount / snapshot.contextWindow * 100}%`;
        segment.setAttribute("data-minecodex-tooltip", copy[kind === "tools" ? "toolHistory" : kind]);
        bar.append(segment);
      }
      panel.insertBefore(head, dl);
      panel.insertBefore(bar, dl);
    }
    if (snapshot.contextSections) {
      const sections = [
        ["instructions", copy.instructions, snapshot.contextSections.instructions],
        ["messages", copy.messages, snapshot.contextSections.messages],
        ["tools", copy.toolHistory, snapshot.contextSections.toolHistory],
      ].filter(([, , value]) => value > 0);
      if (sections.length) {
        for (const [section, label, value] of sections) {
          row(dl, label, sectionValue(value)).dataset.tone = section === "instructions" ? "purple" : section === "tools" ? "green" : "blue";
        }
        divider(dl);
      }
    }
    row(dl, copy.sum, tokenValue(snapshot.contextUsedTokens));
    row(dl, copy.capacity, tokenValue(snapshot.contextWindow));
    row(dl, copy.compactions, number(snapshot.compactions));
  }
  document.body.append(panel);
  const anchorRect = anchor.getBoundingClientRect();
  const width = panel.getBoundingClientRect().width;
  const height = panel.getBoundingClientRect().height;
  panel.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, anchorRect.left + anchorRect.width / 2 - width / 2))}px`;
  panel.style.top = `${Math.max(12, anchorRect.top - height - 8)}px`;
}

function findComposer() {
  return isActiveComposer(composerElement) ? composerElement : null;
}
function currentThreadId(composer) {
  if (!composer) return null;
  const card = composer.closest('[data-codex-composer-root]');
  const portal = card?.querySelector('[data-above-composer-portal]');
  // 只认 Codex 输入框绑定的会话；侧栏和 URL 在切换模式时可能仍指向旧会话。
  if (card?.getAttribute('data-composer-placement') !== 'thread') return null;
  const value = portal?.getAttribute('data-above-composer-conversation-id');
  return value?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}
// 与原生 Context 指示器订阅同一会话状态；不以日志百分比覆盖它。
const emptyNativeContext = () => ({ contextUsedTokens: null, contextWindow: null, contextPercent: null });
let nativeContext = emptyNativeContext();
let nativeContextFamily = null;
let nativeContextSubscription = null;
let nativeContextThread = null;
function findNativeScope(element) {
  let fiber;
  for (let node = element; node && !fiber; node = node.parentElement) {
    fiber = node[Object.keys(node).find((key) => key.startsWith("__reactFiber"))];
  }
  for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return) {
    const chain = fiber.memoizedProps?.value;
    if (!(chain instanceof Map)) continue;
    for (const node of chain.values()) {
      if (node?.token?.__scopeBrand === "AppScope" && typeof node.store?.sub === "function") {
        return { node, chain };
      }
    }
  }
  return null;
}
function contextFromNativeUsage(usage) {
  const windowSize = usage?.modelContextWindow;
  const total = usage?.last?.totalTokens;
  if (!Number.isFinite(windowSize) || windowSize <= 0 || !Number.isFinite(total) || total < 0) {
    return emptyNativeContext();
  }
  const used = Math.min(total, windowSize);
  return { contextUsedTokens: used, contextWindow: windowSize, contextPercent: Math.round(used / windowSize * 100) };
}
function syncNativeContext(composer) {
  if (nativeContextThread === activeThreadId && nativeContextSubscription) return;
  nativeContextSubscription?.();
  nativeContextSubscription = null;
  nativeContextThread = null;
  nativeContext = emptyNativeContext();
  if (!activeThreadId || !nativeContextFamily) return;
  const scope = findNativeScope(composer);
  if (!scope) return;
  try {
    const threadId = activeThreadId;
    const descriptor = nativeContextFamily.resolve(scope.node, scope.chain, threadId);
    const atom = descriptor.resolve(scope.node, scope.chain);
    const update = () => {
      if (disposed || activeThreadId !== threadId) return;
      nativeContext = contextFromNativeUsage(scope.node.store.get(atom));
      render();
    };
    nativeContextThread = threadId;
    nativeContextSubscription = scope.node.store.sub(atom, update);
    update();
  } catch {
    nativeContextThread = null;
  }
}
async function loadNativeContextFamily() {
  try {
    const url = [...document.querySelectorAll("link[rel=modulepreload]")].map((link) => link.href)
      .find((name) => /\/app-shared-[^/]+\.js(?:$|\?)/.test(name));
    if (!url) return;
    const source = await (await fetch(url, { signal })).text();
    // 从当前构建解析导出，避免依赖每次更新都会变化的压缩符号或资源哈希。
    const local = source.match(/([\w$]+)=[\w$]+\(\(\{latestTokenUsageInfo:/)?.[1];
    if (!local) return;
    const exported = [...source.matchAll(/([\w$]+) as ([\w$]+)/g)]
      .find((match) => match[1] === local)?.[2];
    if (!exported) return;
    const module = await import(url);
    if (signal.aborted || disposed) return;
    nativeContextFamily = module[exported];
    syncNativeContext(findComposer());
  } catch { /* 原生接口不可用时保留占位，不显示过期的日志百分比。 */ }
}
function requestRefresh() {
  if (!activeThreadId || signal.aborted) return;
  if (typeof window[config.bindingName] === "function") {
    window[config.bindingName](JSON.stringify({
      token: config.bindingToken,
      featureId: config.featureId,
      requestId: `session-status:${++refreshSequence}`,
      action: "refresh-session-status",
    }));
  }
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!activeThreadId || signal.aborted) return;
  const waiting = snapshot?.turns == null || (snapshot.turns === 0 && snapshot.totalTokens == null);
  const delay = waiting ? Math.max(500, snapshot?.retryAfterMs ?? 500) : snapshot?.isRunning ? 500 : 0;
  if (!delay) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    requestRefresh();
    scheduleRefresh();
  }, delay);
}
function syncVisibility(composer) {
  const threadId = currentThreadId(composer);
  root.hidden = !threadId || snapshot?.threadId !== threadId;
  // 收起时退出布局，避免空 grid 仍触发原生 flex gap。
  reveal.hidden = root.hidden || (!expanded && !collapsing);
  trigger.hidden = root.hidden || expanded;
  if (root.hidden) { closePanel(); hideTooltip(); }
}
function ensurePosition() {
  if (disposed || signal.aborted) return;
  const composer = findComposer();
  const threadId = currentThreadId(composer);
  if (threadId !== activeThreadId) {
    activeThreadId = threadId;
    nativeContext = emptyNativeContext();
    // 会话建立后先展示占位，不让日志落盘速度决定状态栏是否出现。
    snapshot = threadId ? { threadId } : null;
    closePanel();
    render();
    requestRefresh();
    scheduleRefresh();
  }
  syncNativeContext(composer);
  if (!composer) { reveal.remove(); trigger.remove(); closePanel(); return; }
  const form = composer.closest("form");
  const card = composer.closest("[data-codex-composer-root]") ?? form ?? composer.parentElement?.parentElement;
  if (!card?.parentElement) return;
  const model = card.querySelector('[data-composer-navigation-target="reasoning"]');
  // 沿模型按钮的包装层找到横向控制组，不依赖本地化文案。
  let anchor = model;
  while (anchor?.parentElement && !anchor.parentElement.classList.contains("items-center")) anchor = anchor.parentElement;
  if (anchor && trigger.nextElementSibling !== anchor) anchor.before(trigger);
  for (const indicator of nativeIndicators) {
    if (!threadId || !indicator.isConnected) {
      indicator.removeAttribute("data-minecodex-native-context");
      nativeIndicators.delete(indicator);
    }
  }
  for (const indicator of threadId ? card.querySelectorAll('[role="img"][aria-label]') : []) {
    if (!indicator.querySelector('svg circle')) continue;
    indicator.setAttribute("data-minecodex-native-context", "");
    nativeIndicators.add(indicator);
  }
  if (reveal.previousElementSibling !== card || reveal.parentElement !== card.parentElement) {
    card.after(reveal);
    closePanel();
  }
  syncVisibility(composer);
}
function render() {
  if (snapshot) snapshot = { ...snapshot, ...nativeContext };
  syncVisibility(findComposer());
  if (root.hidden) return;
  trigger.querySelector("[data-context-progress]").setAttribute("stroke-dashoffset", String(100 - (snapshot.contextPercent ?? 0)));
  trigger.setAttribute("aria-label", `${copy.context}: ${snapshot.contextPercent == null ? "—" : `${snapshot.contextPercent}%`}`);
  collapse.setAttribute("aria-label", copy === copyByLocale["zh-CN"] ? "收起会话状态" : "Collapse session status");
  if (!tooltip.hidden) showContextTooltip();
  buttons[0].querySelector(".status-label").textContent = `${number(snapshot.turns)} ${copy.turns} ${number(snapshot.steps)} ${copy.steps} · ${snapshot.observedTps == null ? "—" : number(snapshot.observedTps)} tok/s`;
  buttons[1].querySelector(".status-label").textContent = `${compact(snapshot.totalTokens)} · ${copy.cache} ${cachePercent(snapshot)}`;
  buttons[2].querySelector(".status-label").textContent = snapshot.contextPercent == null ? "—" : `${snapshot.contextPercent}%`;
  buttons[2].querySelector("[data-context-progress]").setAttribute("stroke-dashoffset", String(100 - (snapshot.contextPercent ?? 0)));
  buttons[2].setAttribute("aria-label", `${copy.context}: ${snapshot.contextPercent == null ? "—" : `${snapshot.contextPercent}%`}`);
  for (const ring of [trigger, buttons[2]]) ring.querySelector("[data-context-progress]").setAttribute("opacity", snapshot.contextPercent > 0 ? "1" : "0");
  if (openKind) showPanel(openKind);
}
for (const button of buttons) button.addEventListener("click", () => {
  const kind = button.dataset.kind;
  if (openKind === kind) closePanel();
  else showPanel(kind);
}, { signal });
document.addEventListener("pointerdown", (event) => {
  if (panel && !panel.contains(event.target) && !root.contains(event.target)) closePanel();
}, { signal });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanel();
}, { signal });
const observer = new MutationObserver(() => {
  if (rescanQueued) return;
  rescanQueued = true;
  queueMicrotask(() => { rescanQueued = false; ensurePosition(); });
});
observer.observe(document.documentElement, {
  childList: true, subtree: true, attributes: true,
  attributeFilter: ["data-above-composer-conversation-id", "data-composer-placement"],
});
const localeObserver = new MutationObserver(() => {
  const nextCopy = selectedCopy();
  if (nextCopy === copy) return;
  copy = nextCopy;
  render();
});
localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
setExpanded(globalExpanded);
ensurePosition();
void loadNativeContextFamily();
const receiver = {
  update(value, revision) {
    ensurePosition();
    // 切换会话期间的迟到快照不得覆盖新会话，也不清除其占位。
    if (!activeThreadId || value?.threadId !== activeThreadId) return;
    if (Number.isSafeInteger(revision)) {
      if (revision <= lastRevision) return;
      lastRevision = revision;
    }
    snapshot = value;
    render();
    scheduleRefresh();
  },
};
return { update: receiver.update, setExpanded, dispose() {
  controller.abort();
  disposed = true;
  nativeContextSubscription?.();
  clearTimeout(refreshTimer);
  clearTimeout(collapseTimer);
  observer.disconnect();
  localeObserver.disconnect();
  closePanel();
  reveal.remove();
  trigger.remove();
  tooltip.remove();
  for (const indicator of nativeIndicators) indicator.removeAttribute("data-minecodex-native-context");
} };
}
function syncInstances() {
  for (const [composer, instance] of instances) {
    if (!isActiveComposer(composer)) { instance.dispose(); instances.delete(composer); }
  }
  for (const composer of document.querySelectorAll('[data-codex-composer="true"][contenteditable="true"]')) {
    if (isActiveComposer(composer) && !instances.has(composer)) instances.set(composer, createInstance(composer));
  }
}
const previous = window.__minecodexSessionStatus;
const receiver = { update(value, revision) {
  syncInstances();
  for (const instance of instances.values()) instance.update(value, revision);
} };
window.__minecodexSessionStatus = receiver;
const instanceObserver = new MutationObserver(syncInstances);
instanceObserver.observe(document.documentElement, {
  childList:true, subtree:true, attributes:true,
  attributeFilter:["class", "style", "hidden", "inert", "aria-hidden", "data-composer-placement"],
});
syncInstances();
return () => {
  instanceObserver.disconnect();
  for (const instance of instances.values()) instance.dispose();
  instances.clear();
  style.remove();
  if (window.__minecodexSessionStatus === receiver) window.__minecodexSessionStatus = previous;
};
