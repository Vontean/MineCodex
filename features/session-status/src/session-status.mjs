// page-script：数据由 Runtime Host 单向传入，页面只负责展示。
const MARKER = "data-minecodex-session-status";
const STYLE_ID = "minecodex-session-status-style";
const copyByLocale = { "zh-CN": {
  turns: "回合", steps: "步", speed: "TPS", cache: "缓存", cacheDetail: "缓存命中",
  statistics: "会话统计", usage: "Token 用量", context: "上下文详情", total: "总量",
  firstToken: "平均首字延迟", input: "输入", cached: "缓存输入", output: "输出",
  sum: "合计", capacity: "窗口容量", contextShare: "上下文占用", compactions: "压缩次数",
  instructions: "指令", messages: "消息", toolHistory: "工具交互", other: "未分类",
}, en: {
  turns: "turns", steps: "steps", speed: "TPS", cache: "Cache", cacheDetail: "Cache hit",
  statistics: "Session stats", usage: "Token usage", context: "Context", total: "Total",
  firstToken: "Avg first token", input: "Input", cached: "Cached input", output: "Output",
  sum: "Sum", capacity: "Window size", contextShare: "Context used", compactions: "Compactions",
  instructions: "Instructions", messages: "Messages", toolHistory: "Tool activity", other: "Unclassified",
} };
function selectedCopy() {
  const language = document.documentElement.lang || navigator.languages?.[0] || navigator.language || "en";
  return String(language).toLowerCase().startsWith("zh") ? copyByLocale["zh-CN"] : copyByLocale.en;
}
let copy = selectedCopy();

// 图标来自 Lucide Static 与 Phosphor Icons；许可见 vendor/。
const icons = {
  statistics: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  usage: '<svg aria-hidden="true" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z"/></svg>',
};

document.getElementById(STYLE_ID)?.remove();
const style = document.createElement("style");
style.id = STYLE_ID;
style.textContent = `
  [${MARKER}] { box-sizing:border-box; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:0 12px; margin:-2px auto -6px; padding-top:2px; max-width:100%; min-height:24px; min-width:0; font-family:var(--font-sans-default,inherit); font-size:var(--text-xs,12px); line-height:16px; font-variant-numeric:tabular-nums; color:var(--color-text-tertiary); }
  [${MARKER}][hidden] { display:none; }
  [${MARKER}] button { box-sizing:border-box; display:inline-flex; align-items:center; gap:5px; height:22px; color:inherit; font:inherit; border:0; border-radius:var(--radius-xl,12px); background:transparent; padding:3px 7px; cursor:pointer; white-space:nowrap; }
  [${MARKER}] svg, [data-minecodex-session-status-panel] h3 svg { width:14px; height:14px; flex:none; stroke-width:1.75; }
  [${MARKER}] [data-kind="context"] svg, [data-minecodex-session-status-panel] h3 .context-ring { width:12px; height:12px; stroke-width:2; }
  [${MARKER}] button:hover, [${MARKER}] button[aria-expanded="true"] { background:var(--color-token-list-hover-background); }
  [${MARKER}] button:focus-visible { outline:2px solid var(--input-outline-border-color-focus); outline-offset:1px; }
  [data-minecodex-session-status-panel] { --mcx-purple:var(--app-block-accent-purple,light-dark(#8952ee,#7849d1)); --mcx-blue:var(--app-block-accent-blue,light-dark(#3a83f7,#2c67c5)); --mcx-green:var(--app-block-accent-green,light-dark(#53b559,#48a04c)); box-sizing:border-box; position:fixed; z-index:2147483000; min-width:260px; max-width:min(360px,calc(100vw - 24px)); padding:16px; border:1px solid var(--color-border-subtle); border-radius:var(--radius-xl,14px); background:var(--color-token-dropdown-background); color:var(--color-text-primary); font-family:var(--font-sans-default,inherit); font-size:13px; box-shadow:var(--shadow-lg,0 8px 28px rgba(0,0,0,.12)); }
  [data-minecodex-session-status-panel] h3 { display:flex; align-items:center; gap:8px; margin:0 0 12px; padding:0 0 10px; border-bottom:1px solid var(--color-border-subtle); font-size:14px; font-weight:600; }
  [data-minecodex-session-status-panel] dl { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 20px; margin:0; }
  [data-minecodex-session-status-panel] dt { color:var(--color-text-tertiary); }
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
let snapshot = null;
let panel = null;
let openKind = null;
let rescanQueued = false;

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
    segment.title = `${name} ${percent(amount)}%`;
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
    row(dl, copy.speed, snapshot.observedTps == null ? "—" : `${number(snapshot.observedTps)} tok/s`);
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
    row(dl, copy.cacheDetail, snapshot.cacheHitPercent == null ? "—" : `${snapshot.cacheHitPercent}%`);
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
        segment.title = copy[kind === "tools" ? "toolHistory" : kind];
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
  return document.querySelector('[data-codex-composer="true"][contenteditable="true"]')
    ?? document.querySelector('[contenteditable="true"][role="textbox"]');
}
function ensurePosition() {
  const composer = findComposer();
  if (!composer) { root.remove(); closePanel(); return; }
  const form = composer.closest("form");
  const card = composer.closest("[data-codex-composer-root]") ?? form ?? composer.parentElement?.parentElement;
  if (!card?.parentElement) return;
  if (root.previousElementSibling !== card || root.parentElement !== card.parentElement) {
    card.after(root);
    closePanel();
  }
}
function render() {
  root.hidden = !snapshot || (snapshot.turns === 0 && snapshot.totalTokens == null);
  if (root.hidden) { closePanel(); return; }
  buttons[0].querySelector(".status-label").textContent = `${number(snapshot.turns)} ${copy.turns} ${number(snapshot.steps)} ${copy.steps} · ${snapshot.observedTps == null ? "—" : number(snapshot.observedTps)} tok/s`;
  buttons[1].querySelector(".status-label").textContent = `${compact(snapshot.totalTokens)} · ${copy.cache} ${snapshot.cacheHitPercent == null ? "—" : `${snapshot.cacheHitPercent}%`}`;
  buttons[2].querySelector(".status-label").textContent = snapshot.contextPercent == null ? "—" : `${snapshot.contextPercent}%`;
  buttons[2].querySelector("[data-context-progress]").setAttribute("stroke-dashoffset", String(100 - (snapshot.contextPercent ?? 0)));
  buttons[2].setAttribute("aria-label", `${copy.context}: ${snapshot.contextPercent == null ? "—" : `${snapshot.contextPercent}%`}`);
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
observer.observe(document.documentElement, { childList: true, subtree: true });
const localeObserver = new MutationObserver(() => {
  const nextCopy = selectedCopy();
  if (nextCopy === copy) return;
  copy = nextCopy;
  render();
});
localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
ensurePosition();
const previous = window.__minecodexSessionStatus;
const receiver = {
  update(value) {
    snapshot = value;
    ensurePosition();
    render();
  },
};
window.__minecodexSessionStatus = receiver;
return () => {
  observer.disconnect();
  localeObserver.disconnect();
  closePanel();
  root.remove();
  style.remove();
  if (window.__minecodexSessionStatus === receiver) window.__minecodexSessionStatus = previous;
};
