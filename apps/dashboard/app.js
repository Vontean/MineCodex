import {diagnosticReport} from "./assets/diagnostics.js";
import {dashboardFetch} from "./transport.js";
let savedLocale;
try { savedLocale = localStorage.getItem("minecodex-language"); } catch { /* 存储不可用时跟随浏览器语言。 */ }
const locale = ["en", "zh-CN"].includes(savedLocale) ? savedLocale
  : navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
document.documentElement.lang = locale;

const copy = {
  en: {
    connecting: "Connecting…",
    runtimeActive: "Active in Codex",
    runtimeStopped: "Runtime unavailable",
    runtimeNotInjected: "Runtime running — restart Codex to apply plugins",
    plugins: "Your extensions",
    restartTitle: "Restart Codex to apply changes",
    restartCopy: "Your plugin choices are saved. Restart when you are ready.",
    restart: "Restart Codex",
    restarting: "Restarting…",
    saved: "Saved",
    saving: "Saving…",
    states: {
      saved: "Saved — restart Codex to apply",
      configured: "Configured — starting in Codex…",
      launching: "Launching in Codex…",
      injected: "Active in Codex",
      healthy: "Active in Codex",
      checking: "Checking compatibility…",
      partial: "Available in some windows",
      degraded: "Appearance needs an update",
      unavailable: "Temporarily unavailable — check for updates",
      "not-applicable": "Not needed on this page",
      failed: "Couldn’t start — try again",
      stopped: "Stopped",
      "restart-required": "Restart required — restart Codex",
    },
    loadError: "Couldn’t load MineCodex",
    loadErrorCopy: "Check that the background service is running.",
    retry: "Try again",
    version: "Version",
    darkAppearance: "Dark appearance",
    lightAppearance: "Light appearance",
    updateFailed: "Couldn’t check for updates. Please try again.",
    copyDiagnostics: "Copy diagnostics",
    diagnosticsCopied: "Diagnostics copied",
    diagnosticsFailed: "Couldn’t copy diagnostics. Please try again.",
    checkUpdates: "Check for updates",
    checkingUpdates: "Checking…",
    current: "You’re up to date.",
    updateAvailable: (version) => `MineCodex ${version} is available. Run mcx update in Terminal.`,
    changeFailed: "The plugin setting could not be saved.",
    restartFailed: "MineCodex could not restart Codex. Please try again or copy diagnostics.",
    failureDetail: "This extension could not be confirmed. Copy diagnostics to help investigate.",
  },
  "zh-CN": {
    connecting: "正在连接…",
    runtimeActive: "已在 Codex 中生效",
    runtimeStopped: "运行服务不可用",
    runtimeNotInjected: "运行服务已启动——重启 Codex 以应用插件",
    plugins: "功能扩展",
    restartTitle: "重启 Codex 以应用更改",
    restartCopy: "插件选择已经保存，可以在准备好后统一重启。",
    restart: "重启 Codex",
    restarting: "正在重启…",
    saved: "已保存",
    saving: "正在保存…",
    states: {
      saved: "已保存——重启 Codex 后应用",
      configured: "已配置——正在 Codex 中启动…",
      launching: "正在 Codex 中启动…",
      injected: "已在 Codex 中生效",
      healthy: "已在 Codex 中生效",
      checking: "正在自检…",
      partial: "部分窗口可用",
      degraded: "外观适配需要更新",
      unavailable: "暂不可用——请检查更新",
      "not-applicable": "当前页面不适用",
      failed: "暂时无法启动——请重试",
      stopped: "已停止",
      "restart-required": "需要重启——请重启 Codex",
    },
    loadError: "无法加载 MineCodex",
    loadErrorCopy: "请检查后台服务是否正在运行。",
    retry: "重试",
    version: "版本",
    darkAppearance: "深色外观",
    lightAppearance: "浅色外观",
    updateFailed: "暂时无法检查更新，请稍后重试。",
    copyDiagnostics: "复制诊断信息",
    diagnosticsCopied: "诊断信息已复制",
    diagnosticsFailed: "暂时无法复制诊断信息，请重试。",
    checkUpdates: "检查更新",
    checkingUpdates: "正在检查…",
    current: "当前已是最新版本。",
    updateAvailable: (version) => `发现 MineCodex ${version}，请在终端运行 mcx update。`,
    changeFailed: "插件设置保存失败。",
    restartFailed: "MineCodex 无法重启 Codex。请重试或复制诊断信息协助排查。",
    failureDetail: "暂时无法确认这项功能的状态，可复制诊断信息协助排查。",
  },
}[locale];

const elements = {
  runtimeDot: document.querySelector("#runtime-dot"),
  runtimeLabel: document.querySelector("#runtime-label"),
  restartNotice: document.querySelector("#restart-notice"),
  restartTitle: document.querySelector("#restart-title"),
  restartCopy: document.querySelector("#restart-copy"),
  restartButton: document.querySelector("#restart-button"),
  pluginsHeading: document.querySelector("#plugins-heading"),
  saveState: document.querySelector("#save-state"),
  pluginList: document.querySelector("#plugin-list"),
  loadError: document.querySelector("#load-error"),
  errorTitle: document.querySelector("#error-title"),
  errorCopy: document.querySelector("#error-copy"),
  retryButton: document.querySelector("#retry-button"),
  versionLabel: document.querySelector("#version-label"),
  versionValue: document.querySelector("#version-value"),
  languageToggle: document.querySelector(".language-toggle"),
  languageButtons: [...document.querySelectorAll("[data-language-choice]")],
  themeToggle: document.querySelector(".theme-toggle"),
  themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
  updateResult: document.querySelector("#update-result"),
  updateButton: document.querySelector("#update-button"),
  diagnosticsButton: document.querySelector("#diagnostics-button"),
  toast: document.querySelector("#toast"),
};

let state = null;
let toastTimer = null;
const pendingFeatureIds = new Set();

function applyStaticCopy() {
  elements.languageToggle.setAttribute("aria-label", locale === "zh-CN" ? "语言" : "Language");
  for (const button of elements.languageButtons) button.setAttribute("aria-pressed", String(button.dataset.languageChoice === locale));
  elements.runtimeLabel.textContent = copy.connecting;
  elements.restartTitle.textContent = copy.restartTitle;
  elements.restartCopy.textContent = copy.restartCopy;
  elements.restartButton.querySelector(".button-label").textContent = copy.restart;
  elements.pluginsHeading.textContent = copy.plugins;
  elements.errorTitle.textContent = copy.loadError;
  elements.errorCopy.textContent = copy.loadErrorCopy;
  elements.retryButton.textContent = copy.retry;
  elements.versionLabel.textContent = copy.version;
  elements.diagnosticsButton.textContent = copy.copyDiagnostics;
  elements.updateButton.querySelector(".button-label").textContent = copy.checkUpdates;
}

function featureState(feature) {
  const stateName = feature.state
    ?? (feature.failure ? "failed" : feature.healthy ? "healthy" : feature.injected ? "injected" : feature.applied ? "launching" : feature.enabled ? "restart-required" : "stopped");
  const label = copy.states[stateName] ?? copy.states.stopped;
  const className = {
    healthy: "is-active",
    injected: "is-active",
    configured: "is-warning",
    failed: "is-failed",
    launching: "is-warning",
    "restart-required": "is-warning",
    saved: "is-warning",
    stopped: "is-stopped",
  }[stateName] ?? "is-warning";
  return {
    label: feature.failure?.message && stateName === "failed" ? `${label}: ${copy.failureDetail}` : label,
    className,
  };
}

function element(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function createPluginCard(feature) {
  const card = element("article", "plugin-card");
  card.dataset.featureId = feature.id;

  const icon = element("div", "plugin-icon");
  icon.setAttribute("aria-hidden", "true");
  const image = element("img");
  image.alt = "";
  image.width = 24;
  image.height = 24;
  icon.append(image);

  const pluginCopy = element("div", "plugin-copy");
  const titleLine = element("div", "plugin-title-line");
  const name = element("h3", "plugin-name");
  titleLine.append(name);
  const description = element("p", "plugin-description");
  pluginCopy.append(titleLine, description);

  const heading = element("div", "plugin-topline");
  const label = element("label", "switch");
  const input = element("input");
  input.type = "checkbox";
  input.name = `feature-${feature.id}`;
  input.setAttribute("role", "switch");
  input.setAttribute("aria-describedby", `description-${feature.id} state-${feature.id}`);
  description.id = `description-${feature.id}`;
  const track = element("span", "switch-track");
  track.setAttribute("aria-hidden", "true");
  label.append(input, track);
  const pluginState = element("span", "plugin-state");
  const dot = element("span", "status-dot");
  dot.setAttribute("aria-hidden", "true");
  const stateLabel = element("span", "plugin-state-label");
  stateLabel.id = `state-${feature.id}`;
  pluginState.append(dot, stateLabel);
  heading.append(icon, label);
  card.append(heading, pluginCopy, pluginState);
  return card;
}

function updatePluginCard(card, feature) {
  for (const button of elements.languageButtons) button.disabled = pendingFeatureIds.size > 0;
  const status = featureState(feature);
  const input = card.querySelector('input[type="checkbox"]');
  const image = card.querySelector(".plugin-icon img");
  const name = card.querySelector(".plugin-name");
  const description = card.querySelector(".plugin-description");
  const dot = card.querySelector(".plugin-state .status-dot");
  const stateLabel = card.querySelector(".plugin-state-label");
  card.dataset.featureId = feature.id;
  image.src = feature.iconUrl.startsWith("data:") ? feature.iconUrl : `${feature.iconUrl}?v=resource-1`;
  name.textContent = feature.label;
  description.textContent = feature.description;
  input.checked = Boolean(feature.enabled);
  input.disabled = pendingFeatureIds.has(feature.id);
  input.setAttribute("aria-label", feature.label);
  dot.className = `status-dot ${status.className}`;
  stateLabel.textContent = status.label;
}

function findPluginCard(featureId) {
  return [...elements.pluginList.querySelectorAll("[data-feature-id]")].find((child) => child.dataset.featureId === featureId) ?? null;
}

function renderPluginCards(features) {
  // Task 暂停接入，旧版服务返回的卡片也不展示。
  features = features.filter(feature => feature.id !== "unread-inbox");
  for (const child of [...elements.pluginList.children]) {
    if (!child.dataset.featureId) child.remove();
  }
  const featureIds = new Set(features.map(({ id }) => id));
  for (const feature of features) {
    let card = findPluginCard(feature.id);
    if (!card) {
      card = createPluginCard(feature);
    }
    elements.pluginList.append(card);
    updatePluginCard(card, feature);
  }
  for (const card of [...elements.pluginList.querySelectorAll("[data-feature-id]")]) {
    if (card.dataset.featureId && !featureIds.has(card.dataset.featureId)) card.remove();
  }
  elements.pluginList.setAttribute("aria-busy", "false");
}

function renderRuntime() {
  const runtimeRunning = Boolean(state?.runtime?.running);
  const renderer = state?.renderer;
  const rendererCurrent = Boolean(
    renderer?.discovered
      && renderer.runtimeSessionId
      && renderer.runtimeSessionId === state?.runtime?.runtimeSessionId
      && renderer.active
      && Number(renderer.injectedTargets) > 0,
  );
  const active = runtimeRunning && rendererCurrent;
  elements.runtimeLabel.closest(".overview").hidden = active;
  elements.runtimeDot.className = `status-dot ${active ? "is-active" : "is-warning"}`;
  elements.runtimeLabel.textContent = active
    ? copy.runtimeActive
    : runtimeRunning
      ? copy.runtimeNotInjected
      : copy.runtimeStopped;
  elements.versionValue.textContent = state?.version ?? "—";
  elements.restartNotice.hidden = !state?.pendingRestart;
}

function render() {
  renderRuntime();
  renderPluginCards(state?.features ?? []);
}

function captureFocus(featureId) {
  const active = document.activeElement;
  const card = active?.closest?.("[data-feature-id]");
  if (!card || card.dataset.featureId !== featureId) return null;
  return { featureId, input: active.matches?.('input[type="checkbox"]') };
}

function restoreFocus(focus) {
  if (!focus?.input) return;
  const card = findPluginCard(focus.featureId);
  card?.querySelector('input[type="checkbox"]')?.focus();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 4200);
}

function replaceFeatureInState(featureId, patch) {
  state.features = state.features.map((feature) => feature.id === featureId ? { ...feature, ...patch } : feature);
}

async function load() {
  elements.loadError.hidden = true;
  try {
    const response = await dashboardFetch("/api/status", { headers: { "Accept-Language": locale } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const fresh = await response.json();
    if (pendingFeatureIds.size && state) fresh.features = fresh.features.map(feature =>
      pendingFeatureIds.has(feature.id) ? state.features.find(previous=>previous.id === feature.id) ?? feature : feature);
    state = fresh;
    elements.pluginList.hidden = false;
    render();
  } catch {
    elements.pluginList.hidden = true;
    elements.loadError.hidden = false;
    elements.runtimeDot.className = "status-dot is-warning";
    elements.runtimeLabel.textContent = copy.runtimeStopped;
    elements.runtimeLabel.closest(".overview").hidden = true;
  }
}

elements.pluginList.addEventListener("change", async (event) => {
  const input = event.target.closest('input[type="checkbox"]');
  const card = input?.closest("[data-feature-id]");
  if (!input || !card || !state) return;
  const featureId = card.dataset.featureId;
  const previousFeature = { ...state.features.find((feature) => feature.id === featureId) };
  const focus = captureFocus(featureId);
  pendingFeatureIds.add(featureId);
  replaceFeatureInState(featureId, { enabled: input.checked, state: "saved" });
  updatePluginCard(card, state.features.find((feature) => feature.id === featureId));
  elements.saveState.textContent = copy.saving;
  try {
    const response = await dashboardFetch(`/api/features/${encodeURIComponent(featureId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify({ enabled: input.checked }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const changedFeature = result.features?.find((feature) => feature.id === featureId);
    if (changedFeature) replaceFeatureInState(featureId, changedFeature);
    state.pendingRestart = result.pendingRestart;
    pendingFeatureIds.delete(featureId);
    const updatedFeature = changedFeature ?? state.features.find((feature) => feature.id === featureId);
    if (updatedFeature) updatePluginCard(card, updatedFeature);
    renderRuntime();
    restoreFocus(focus);
    elements.saveState.textContent = pendingFeatureIds.size ? copy.saving : copy.saved;
  } catch {
    pendingFeatureIds.delete(featureId);
    replaceFeatureInState(featureId, previousFeature);
    updatePluginCard(card, previousFeature);
    elements.saveState.textContent = pendingFeatureIds.size ? copy.saving : "";
    restoreFocus(focus);
    showToast(copy.changeFailed);
  }
});

elements.restartButton.addEventListener("click", async () => {
  elements.restartButton.disabled = true;
  elements.restartButton.querySelector(".button-label").textContent = copy.restarting;
  try {
    const response = await dashboardFetch("/api/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: "{}",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await load();
  } catch {
    showToast(copy.restartFailed);
  } finally {
    elements.restartButton.disabled = false;
    elements.restartButton.querySelector(".button-label").textContent = copy.restart;
  }
});

elements.retryButton.addEventListener("click", () => {
  elements.pluginList.hidden = false;
  void load();
});

elements.diagnosticsButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(diagnosticReport(state),null,2));
    showToast(copy.diagnosticsCopied);
  } catch { showToast(copy.diagnosticsFailed); }
});

// 页面可见时更新自检结果；保留正在保存的卡片和键盘焦点。
setInterval(() => { if (!document.hidden && !pendingFeatureIds.size) void load(); }, 5000);

elements.updateButton.addEventListener("click", async () => {
  elements.updateButton.disabled = true;
  elements.updateButton.querySelector(".button-label").textContent = copy.checkingUpdates;
  elements.updateResult.hidden = true;
  try {
    const response = await dashboardFetch("/api/update");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const update = await response.json();
    elements.updateResult.textContent = update.available ? copy.updateAvailable(update.latest) : copy.current;
    elements.updateResult.hidden = false;
  } catch {
    elements.updateResult.textContent = copy.updateFailed;
    elements.updateResult.hidden = false;
  } finally {
    elements.updateButton.disabled = false;
    elements.updateButton.querySelector(".button-label").textContent = copy.checkUpdates;
  }
});

const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let selectedTheme = null;
if (!window.minecodexMcpApp) {
  try { selectedTheme = localStorage.getItem("minecodex-appearance"); } catch { /* 存储不可用时仍允许本次切换。 */ }
}
function applyTheme() {
  const hostDark = window.minecodexHostTheme ? window.minecodexHostTheme === "dark" : systemTheme.matches;
  const dark = selectedTheme === "dark" || (selectedTheme !== "light" && hostDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-label", locale === "zh-CN" ? "外观" : "Appearance");
  for (const button of elements.themeButtons) {
    button.setAttribute("aria-label", button.dataset.themeChoice === "light" ? copy.lightAppearance : copy.darkAppearance);
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === (dark ? "dark" : "light")));
  }
}
elements.themeToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-choice]");
  if (!button) return;
  selectedTheme = button.dataset.themeChoice;
  if (!window.minecodexMcpApp) {
    try { localStorage.setItem("minecodex-appearance", selectedTheme); } catch { /* 保留内存中的选择。 */ }
  }
  applyTheme();
});
elements.languageToggle.addEventListener("click", (event) => {
  const button = event.target.closest("[data-language-choice]");
  if (!button || pendingFeatureIds.size || elements.restartButton.disabled) return;
  const choice = button.dataset.languageChoice;
  if (choice === locale) return;
  try { localStorage.setItem("minecodex-language", choice); } catch { return; }
  // 重载后以同一语言请求卡片内容，不影响功能配置与外观选择。
  location.reload();
});
systemTheme.addEventListener("change", applyTheme);
window.addEventListener("minecodex-host-theme", () => {
  selectedTheme = null;
  applyTheme();
});
document.addEventListener("keydown", () => { document.documentElement.dataset.input = "keyboard"; });
document.addEventListener("pointerdown", () => { document.documentElement.dataset.input = "pointer"; });
applyStaticCopy();
applyTheme();
void load();
