// page-script：数据由 Runtime Host 单向传入，页面只负责展示。
const MARKER = "data-minecodex-session-status";
const STYLE_ID = "minecodex-session-status-style";
const copy = document.documentElement.lang.toLowerCase().startsWith("zh") ? {
  turns: "回合", steps: "步", speed: "观测速度", tokens: "tok", cache: "缓存命中",
  statistics: "会话统计", usage: "Token 用量", context: "上下文详情", total: "总量",
  modelTime: "观测输出用时", toolTime: "工具用时", firstToken: "平均首 token 时间",
  speedSamples: "有效速度样本", approximate: "根据可见输出事件估算，包含模型报告的输出 token。",
  uncached: "未缓存输入", cached: "缓存输入", cacheWrite: "缓存写入", output: "输出",
  recentInput: "最近一次请求输入", capacity: "模型窗口", contextShare: "最近请求占用", unknown: "Codex 未提供系统提示词、工具定义和消息的可靠拆分。",
} : {
  turns: "turns", steps: "steps", speed: "Observed speed", tokens: "tok", cache: "Cache hit",
  statistics: "Session statistics", usage: "Token usage", context: "Context details", total: "Total",
  modelTime: "Observed output time", toolTime: "Tool time", firstToken: "Avg first-token time",
  speedSamples: "Timed samples", approximate: "Estimated from visible output events and model-reported output tokens.",
  uncached: "Uncached input", cached: "Cached input", cacheWrite: "Cache write", output: "Output",
  recentInput: "Latest request input", capacity: "Model window", contextShare: "Latest request share", unknown: "Codex does not provide a reliable system, tools and messages breakdown.",
};

document.getElementById(STYLE_ID)?.remove();
const style = document.createElement("style");
style.id = STYLE_ID;
style.textContent = `
  [${MARKER}] { box-sizing:border-box; display:flex; flex-wrap:wrap; justify-content:center; gap:4px 12px; margin:4px auto 0; max-width:100%; min-width:0; font-family:var(--font-sans-default,inherit); font-size:var(--text-xs,12px); color:var(--color-text-tertiary); }
  [${MARKER}][hidden] { display:none; }
  [${MARKER}] button { color:inherit; font:inherit; border:0; border-radius:var(--radius-xl,12px); background:transparent; padding:3px 8px; cursor:pointer; white-space:nowrap; }
  [${MARKER}] button:hover, [${MARKER}] button[aria-expanded="true"] { background:var(--color-token-list-hover-background); }
  [${MARKER}] button:focus-visible { outline:2px solid var(--input-outline-border-color-focus); outline-offset:1px; }
  [data-minecodex-session-status-panel] { box-sizing:border-box; position:fixed; z-index:2147483000; min-width:260px; max-width:min(360px,calc(100vw - 24px)); padding:16px; border:1px solid var(--color-border-subtle); border-radius:var(--radius-xl,14px); background:var(--color-token-dropdown-background); color:var(--color-text-primary); font-family:var(--font-sans-default,inherit); font-size:13px; box-shadow:var(--shadow-lg,0 8px 28px rgba(0,0,0,.12)); }
  [data-minecodex-session-status-panel] h3 { margin:0 0 12px; padding:0 0 10px; border-bottom:1px solid var(--color-border-subtle); font-size:14px; font-weight:600; }
  [data-minecodex-session-status-panel] dl { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 20px; margin:0; }
  [data-minecodex-session-status-panel] dt { color:var(--color-text-tertiary); }
  [data-minecodex-session-status-panel] dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  [data-minecodex-session-status-panel] p { margin:12px 0 0; color:var(--color-text-tertiary); line-height:1.45; }
  [data-minecodex-session-status-panel] .context-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:8px; }
  [data-minecodex-session-status-panel] .context-head span:first-child { color:var(--color-text-tertiary); }
  [data-minecodex-session-status-panel] .context-bar { height:4px; margin-bottom:14px; overflow:hidden; border-radius:var(--radius-xl); background:var(--color-token-border-default); }
  [data-minecodex-session-status-panel] .context-bar span { display:block; height:100%; background:var(--color-text-info); }
`;
document.head.append(style);

const root = document.createElement("div");
root.setAttribute(MARKER, "");
root.hidden = true;
const buttons = ["statistics", "usage", "context"].map((kind) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.kind = kind;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
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
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value / (value < 1e6 ? 1e3 : 1e6))}${value < 1e6 ? "K" : "M"}`;
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
  const dl = document.createElement("dl");
  panel.append(heading, dl);
  if (kind === "statistics") {
    row(dl, copy.turns, number(snapshot.turns));
    row(dl, copy.steps, number(snapshot.steps));
    row(dl, copy.modelTime, duration(snapshot.observedModelMs));
    row(dl, copy.toolTime, duration(snapshot.toolMs));
    row(dl, copy.firstToken, duration(snapshot.averageFirstTokenMs));
    row(dl, copy.speed, snapshot.observedTps == null ? "—" : `~${number(snapshot.observedTps)} tok/s`);
    row(dl, copy.speedSamples, number(snapshot.speedSamples));
    const note = document.createElement("p");
    note.textContent = copy.approximate;
    panel.append(note);
  } else if (kind === "usage") {
    row(dl, copy.total, `${number(snapshot.totalTokens)} tok`);
    row(dl, copy.cache, snapshot.cacheHitPercent == null ? "—" : `${snapshot.cacheHitPercent}%`);
    row(dl, copy.uncached, `${number(snapshot.uncachedInputTokens)} tok`);
    row(dl, copy.cached, `${number(snapshot.cachedInputTokens)} tok`);
    row(dl, copy.cacheWrite, `${number(snapshot.cacheWriteInputTokens)} tok`);
    row(dl, copy.output, `${number(snapshot.outputTokens)} tok`);
  } else {
    if (snapshot.contextPercent != null) {
      const head = document.createElement("div");
      head.className = "context-head";
      const label = document.createElement("span");
      label.textContent = copy.contextShare;
      const value = document.createElement("span");
      value.textContent = `≈${snapshot.contextPercent}%`;
      head.append(label, value);
      const bar = document.createElement("div");
      bar.className = "context-bar";
      const fill = document.createElement("span");
      fill.style.width = `${snapshot.contextPercent}%`;
      bar.append(fill);
      panel.insertBefore(head, dl);
      panel.insertBefore(bar, dl);
    }
    row(dl, copy.recentInput, `${number(snapshot.contextUsedTokens)} tok`);
    row(dl, copy.capacity, `${number(snapshot.contextWindow)} tok`);
    const note = document.createElement("p");
    note.textContent = copy.unknown;
    panel.append(note);
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
  buttons[0].textContent = `${number(snapshot.turns)} ${copy.turns}  ${number(snapshot.steps)} ${copy.steps} · ${snapshot.observedTps == null ? "—" : `~${number(snapshot.observedTps)}`} tok/s`;
  buttons[1].textContent = `${compact(snapshot.totalTokens)} ${copy.tokens} · ${copy.cache} ${snapshot.cacheHitPercent == null ? "—" : `${snapshot.cacheHitPercent}%`}`;
  buttons[2].textContent = copy.context;
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
  closePanel();
  root.remove();
  style.remove();
  if (window.__minecodexSessionStatus === receiver) window.__minecodexSessionStatus = previous;
};
