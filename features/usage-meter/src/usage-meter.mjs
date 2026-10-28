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
[${MARKER}] { position:relative; display:flex; align-items:center; justify-content:center; flex:none; color:var(--mcx-color-usage-meter-fill,var(--mcx-color-text-tertiary)); -webkit-app-region:no-drag; }
[data-minecodex-native-usage] { display:none !important; }
[${MARKER}] .mcx-usage-ring { display:block; width:24px; height:24px; overflow:visible; }
[${MARKER}] .mcx-usage-number { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--mcx-color-usage-meter-fill,var(--mcx-color-text-tertiary)); font-family:var(--mcx-font-sans-default); font-size:calc(var(--mcx-text-xs) * 2 / 3); line-height:1; font-weight:var(--font-weight-medium,500); letter-spacing:0; font-variant-numeric:tabular-nums; pointer-events:none; }
#${TIP_ID} { width:max-content; max-width:calc(100vw - 16px); }
#${TIP_ID}[hidden] { display:none; }
#${TIP_ID} dl { display:grid; grid-template-columns:auto auto; gap:2px 16px; margin:0; }
#${TIP_ID} dt { text-align:left; }
#${TIP_ID} dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; }
#${TIP_ID} .mcx-usage-group { display:grid; grid-template-columns:subgrid; grid-column:1 / -1; gap:2px 16px; }
#${TIP_ID} .mcx-usage-group + .mcx-usage-group { border-top:1px solid color-mix(in srgb,var(--mcx-color-border-subtle) 50%,transparent); margin-top:calc(var(--mcx-spacing) * 1); padding-top:calc(var(--mcx-spacing) * 1); }
`;
document.head.append(style);

function svgNode(name, attributes) {
  if (name === "path" || name === "circle") attributes = { ...attributes, "vector-effect": "non-scaling-stroke" };
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function quotaArc(start, end, clockwise) {
  const radius = 44 / 3;
  const point = angle => {
    const radians = (angle - 90) * Math.PI / 180;
    return [16 + radius * Math.cos(radians), 16 + radius * Math.sin(radians)];
  };
  const from = point(start), to = point(end);
  return `M ${from[0]} ${from[1]} A ${radius} ${radius} 0 ${Math.abs(end - start) > 180 ? 1 : 0} ${clockwise ? 1 : 0} ${to[0]} ${to[1]}`;
}

function draw(windows) {
  record.windows = windows;
  const svg = svgNode("svg", { viewBox: "0 0 32 32", class: "mcx-usage-ring", "aria-hidden": "true" });
  if (windows.fiveHour != null) {
    // 左下、右下各留 24° 圆头中心间距；两段都从左下切口扣减。
    for (const [key, start, end, clockwise] of [["fiveHour", 237, 483, true], ["weekly", 213, 147, false]]) {
      const group = svgNode("g", { "data-window": key, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round" });
      group.append(svgNode("path", { d: quotaArc(start, end, clockwise), stroke: "var(--mcx-color-usage-meter-track,color-mix(in srgb,currentColor 18%,transparent))" }));
      if (windows[key] > 0) {
        const remainingStart = start + (end - start) * (1 - windows[key] / 100);
        group.append(svgNode("path", { d: quotaArc(remainingStart, end, clockwise) }));
      }
      svg.append(group);
    }
  } else {
    const key = "weekly", radius = 44 / 3;
    const group = svgNode("g", { "data-window": key, fill: "none", stroke: "currentColor", "stroke-width": 2 });
    group.append(svgNode("circle", { cx: 16, cy: 16, r: radius, stroke: "var(--mcx-color-usage-meter-track,color-mix(in srgb,currentColor 18%,transparent))" }));
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
  const rows = windows.fiveHour == null ? [] : [["5h Limit", windows.fiveHour, windows.resetAt?.fiveHour]];
  rows.push(["Weekly Limit", windows.weekly, windows.resetAt?.weekly]);
  for (const [label, percent, resetAt] of rows) {
    const group = document.createElement("div");
    group.className = "mcx-usage-group";
    const term = document.createElement("dt"), value = document.createElement("dd");
    term.textContent = label;
    value.textContent = `${percent}%`;
    group.append(term, value);
    const date = new Date(resetAt);
    if (resetAt != null && Number.isFinite(date.getTime())) {
      const resetTerm = document.createElement("dt"), resetValue = document.createElement("dd");
      resetTerm.textContent = "Reset in";
      const pad = value => String(value).padStart(2, "0");
      resetValue.textContent = `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      group.append(resetTerm, resetValue);
    }
    list.append(group);
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
  draw(record.windows);
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
  nativeUsage.reveal(record?.usage);
  record?.button.remove();
  record?.tooltip.remove();
  record = null;
}





function mount(avatar, rail, usage) {
  // 复用原生 Usage 热区；旧版宿主才使用 Avatar 模板。
  const button = (usage || avatar).cloneNode(false);
  for (const attribute of [...button.attributes]) {
    if (attribute.name.startsWith("aria-") || ["id", "title", "data-state", "data-sidebar-destination", "data-testid", "data-minecodex-native-usage"].includes(attribute.name)) button.removeAttribute(attribute.name);
  }
  button.setAttribute(MARKER, "");
  config.ui.theme.bindScope(button, ["--color-usage-meter-fill", "--color-usage-meter-track"]);
  const tooltip = document.createElement("div");
  tooltip.id = TIP_ID;
  config.ui.tooltipSurface(tooltip);
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  (usage || nativeUsage.anchor(avatar, rail)).before(button);
  nativeUsage.conceal(usage);
  document.body.append(tooltip);
  record = { button, tooltip, rail, avatar, usage, signature: null };
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
  const { rail,avatar,usage,windows,available } = nativeUsage.read();
  if (!available) { removeControl(); return; }
  if (record?.avatar !== avatar || record?.usage !== usage || !record?.button.isConnected) { removeControl(); mount(avatar, rail, usage); }
  else if (record.button.nextElementSibling !== (usage || nativeUsage.anchor(avatar, rail))) (usage || nativeUsage.anchor(avatar, rail)).before(record.button);
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
    checks:[{name:"usage-anchor",available:Boolean(snapshot.usage || snapshot.avatar)},{name:"account-quota",available:Boolean(snapshot.windows)},{name:"usage-meter-mount",available:Boolean(record?.button.isConnected)}],
    scopes:[{name:"account",element:snapshot.usage || snapshot.avatar}]};
});

return cleanup;
