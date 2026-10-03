// 订阅原生额度缓存；不另行轮询，也不复制账号信息到插件服务。
const MARKER = "data-minecodex-usage-meter";
const TIP_ID = "minecodex-usage-tooltip";
const STYLE_ID = "minecodex-usage-style";
let record = null;


let queued = false;
let hoverTimer = null;







const style = document.createElement("style");
style.id = STYLE_ID;
style.textContent = `
[${MARKER}] { position:relative; display:flex; align-items:center; justify-content:center; flex:none; color:var(--mcx-color-text-tertiary); -webkit-app-region:no-drag; }
[${MARKER}] .mcx-usage-ring { display:block; width:24px; height:24px; overflow:visible; }
[${MARKER}] .mcx-usage-number { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:inherit; font-family:var(--mcx-font-sans-default); font-size:calc(var(--mcx-text-xs) * 2 / 3); line-height:1; font-weight:var(--font-weight-medium,500); letter-spacing:0; font-variant-numeric:tabular-nums; pointer-events:none; }
[${MARKER}] [data-window="weekly"] { color:inherit; }
[${MARKER}] [data-window="fiveHour"] { color:var(--mcx-color-text-secondary); }
#${TIP_ID} { width:max-content; max-width:calc(100vw - 16px); }
#${TIP_ID}[hidden] { display:none; }
#${TIP_ID} dl { display:grid; grid-template-columns:auto auto; gap:2px 16px; margin:0; }
#${TIP_ID} dt { text-align:left; }
#${TIP_ID} dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; }
`;
document.head.append(style);

function svgNode(name, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function draw(windows) {
  const svg = svgNode("svg", { viewBox: "0 0 32 32", class: "mcx-usage-ring", "aria-hidden": "true" });
  for (const [key, radius] of [["weekly", 43 / 3], ["fiveHour", 10.5]]) {
    if (windows[key] == null) continue;
    const group = svgNode("g", { "data-window": key, fill: "none", stroke: "currentColor", "stroke-width": 10 / 3 });
    group.append(svgNode("circle", { cx: 16, cy: 16, r: radius, opacity: 0.18 }));
    if (windows[key] > 0) group.append(svgNode("circle", {
      cx: 16, cy: 16, r: radius, pathLength: 100,
      "stroke-dasharray": `${windows[key]} 100`, "stroke-linecap": "round", transform: "rotate(-90 16 16)",
    }));
    svg.append(group);
  }
  const number = document.createElement("span");
  number.className = "mcx-usage-number";
  number.textContent = String(windows.primary);
  number.setAttribute("data-dual", String(windows.fiveHour != null));
  number.setAttribute("data-digits", String(number.textContent.length));
  record.button.replaceChildren(svg, number);
  const list = document.createElement("dl");
  const rows = windows.fiveHour == null ? [] : [["5h Limit", windows.fiveHour]];
  rows.push(["Weekly Limit", windows.weekly]);
  for (const [label, percent] of rows) {
    const term = document.createElement("dt"), value = document.createElement("dd");
    term.textContent = label;
    value.textContent = `${percent}%`;
    list.append(term, value);
  }
  record.tooltip.replaceChildren(list);
  record.button.setAttribute("aria-label", rows.map(([label, percent]) => `${label} ${percent}%`).join(", "));
  record.button.setAttribute("aria-description", "Open Usage settings");
  if (!record.tooltip.hidden) positionTooltip();
}

function positionTooltip() {
  if (!record) return;
  const rect = record.button.getBoundingClientRect();
  const tooltip = record.tooltip;
  // 按物理视口定位，兼容原生 app-shell 的 CSS zoom。
  tooltip.style.left = `${Math.max(8, Math.min(rect.right + 2, window.innerWidth - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(rect.top + (rect.height - tooltip.offsetHeight) / 2, window.innerHeight - tooltip.offsetHeight - 8))}px`;
}

function showTooltip() {
  clearTimeout(hoverTimer);
  if (!record) return;
  record.tooltip.hidden = false;
  record.button.setAttribute("aria-describedby", TIP_ID);
  positionTooltip();
}
function hideTooltip() {
  clearTimeout(hoverTimer);
  if (!record) return;
  record.tooltip.hidden = true;
  record.button.removeAttribute("aria-describedby");
}
function removeControl() {
  hideTooltip();
  record?.button.remove();
  record?.tooltip.remove();
  record = null;
}





function mount(avatar, rail) {
  // 克隆 Avatar 热区的外观，不携带原生账号菜单行为。
  const button = avatar.cloneNode(false);
  for (const attribute of [...button.attributes]) {
    if (attribute.name.startsWith("aria-") || ["id", "title", "data-state", "data-sidebar-destination", "data-testid"].includes(attribute.name)) button.removeAttribute(attribute.name);
  }
  button.setAttribute(MARKER, "");
  const tooltip = document.createElement("div");
  tooltip.id = TIP_ID;
  config.ui.tooltipSurface(tooltip);
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  nativeUsage.anchor(avatar, rail).before(button);
  document.body.append(tooltip);
  record = { button, tooltip, rail, avatar, signature: null };
  button.addEventListener("pointerenter", () => { hoverTimer = setTimeout(showTooltip, 350); });
  button.addEventListener("pointerleave", hideTooltip);
  button.addEventListener("focus", showTooltip);
  button.addEventListener("blur", hideTooltip);
  button.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); hideTooltip(); } });
  button.addEventListener("click", () => {
    hideTooltip();
    nativeUsage.open(rail);
  });
}

function sync() {
  queued = false;
  if (signal.aborted) return;
  const { rail,avatar,windows,available } = nativeUsage.read();
  if (!available) { removeControl(); return; }
  if (record?.avatar !== avatar || !record?.button.isConnected) { removeControl(); mount(avatar, rail); }
  else if (record.button.nextElementSibling !== nativeUsage.anchor(avatar, rail)) nativeUsage.anchor(avatar, rail).before(record.button);
  const signature = JSON.stringify(windows);
  if (record.signature !== signature) { record.signature = signature; draw(windows); }
}
function schedule() {
  if (queued || signal.aborted) return;
  queued = true;
  queueMicrotask(sync);
}
const nativeUsage = createUsageAdapter(signal, config.codex, schedule);
const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
window.addEventListener("resize", positionTooltip);
window.addEventListener("focus", schedule);
const cleanup = () => {
  observer.disconnect();

  window.removeEventListener("resize", positionTooltip);
  window.removeEventListener("focus", schedule);
  removeControl();
  style.remove();
};
signal.addEventListener("abort", cleanup, { once: true });
sync();
config.registerSelfCheck?.(() => {
  const snapshot=nativeUsage.read();
  const available=Boolean(snapshot.available && record?.button.isConnected);
  return {state:available ? "available" : snapshot.applicable === false ? "not-applicable" : !snapshot.anchorAvailable && snapshot.rail ? "unavailable" : "unknown",reason:available ? null : "quota-data-or-anchor-unavailable",
    checks:[{name:"account-anchor",available:Boolean(snapshot.avatar)},{name:"account-quota",available:Boolean(snapshot.windows)},{name:"usage-meter-mount",available:Boolean(record?.button.isConnected)}],
    scopes:[{name:"account",element:snapshot.avatar}]};
});

return cleanup;
