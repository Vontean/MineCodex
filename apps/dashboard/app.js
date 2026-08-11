const locale = navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
document.documentElement.lang = locale;

const copy = {
  en: {
    subtitle: "Personal plugins for Codex",
    connecting: "Connecting…",
    runtimeActive: "Active in Codex",
    runtimeStopped: "Runtime unavailable",
    runtimeNotInjected: "Runtime running — restart Codex to apply plugins",
    plugins: "Plugins",
    pluginsCopy: "Choose which enhancements appear in Codex.",
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
      healthy: "Healthy in Codex",
      failed: "Failed — restart Codex",
      stopped: "Stopped",
      "restart-required": "Restart required — restart Codex",
    },
    loadError: "Couldn’t load MineCodex",
    loadErrorCopy: "Check that the background service is running.",
    retry: "Try again",
    version: "Version",
    installation: "Installation",
    runtimeHost: "RuntimeHost",
    running: "Running",
    stopped: "Stopped",
    checkUpdates: "Check for updates",
    checkingUpdates: "Checking…",
    current: "You’re up to date.",
    updateAvailable: (version) => `MineCodex ${version} is available. Run mcx update in Terminal.`,
    changeFailed: "The plugin setting could not be saved.",
    restartFailed: "MineCodex could not restart Codex. Check the service log and try again.",
    failureDetail: "Health or renderer status could not be confirmed.",
  },
  "zh-CN": {
    subtitle: "为 Codex 准备的个人插件",
    connecting: "正在连接…",
    runtimeActive: "已在 Codex 中生效",
    runtimeStopped: "运行服务不可用",
    runtimeNotInjected: "运行服务已启动——重启 Codex 以应用插件",
    plugins: "插件",
    pluginsCopy: "选择要在 Codex 中启用的增强功能。",
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
      healthy: "Codex 中运行正常",
      failed: "运行失败——请重启 Codex",
      stopped: "已停止",
      "restart-required": "需要重启——请重启 Codex",
    },
    loadError: "无法加载 MineCodex",
    loadErrorCopy: "请检查后台服务是否正在运行。",
    retry: "重试",
    version: "版本",
    installation: "安装位置",
    runtimeHost: "运行服务",
    running: "运行中",
    stopped: "已停止",
    checkUpdates: "检查更新",
    checkingUpdates: "正在检查…",
    current: "当前已是最新版本。",
    updateAvailable: (version) => `发现 MineCodex ${version}，请在终端运行 mcx update。`,
    changeFailed: "插件设置保存失败。",
    restartFailed: "MineCodex 无法重启 Codex。请检查服务日志后重试。",
    failureDetail: "无法确认插件健康状态或 Codex 渲染器状态。",
  },
}[locale];

const elements = {
  subtitle: document.querySelector("#subtitle"),
  runtimeDot: document.querySelector("#runtime-dot"),
  runtimeLabel: document.querySelector("#runtime-label"),
  restartNotice: document.querySelector("#restart-notice"),
  restartTitle: document.querySelector("#restart-title"),
  restartCopy: document.querySelector("#restart-copy"),
  restartButton: document.querySelector("#restart-button"),
  pluginsHeading: document.querySelector("#plugins-heading"),
  pluginsCopy: document.querySelector("#plugins-copy"),
  saveState: document.querySelector("#save-state"),
  pluginList: document.querySelector("#plugin-list"),
  loadError: document.querySelector("#load-error"),
  errorTitle: document.querySelector("#error-title"),
  errorCopy: document.querySelector("#error-copy"),
  retryButton: document.querySelector("#retry-button"),
  versionLabel: document.querySelector("#version-label"),
  versionValue: document.querySelector("#version-value"),
  installLabel: document.querySelector("#install-label"),
  hostLabel: document.querySelector("#host-label"),
  hostValue: document.querySelector("#host-value"),
  updateButton: document.querySelector("#update-button"),
  toast: document.querySelector("#toast"),
};

let state = null;
let toastTimer = null;
const pendingFeatureIds = new Set();

function applyStaticCopy() {
  elements.subtitle.textContent = copy.subtitle;
  elements.runtimeLabel.textContent = copy.connecting;
  elements.restartTitle.textContent = copy.restartTitle;
  elements.restartCopy.textContent = copy.restartCopy;
  elements.restartButton.querySelector(".button-label").textContent = copy.restart;
  elements.pluginsHeading.textContent = copy.plugins;
  elements.pluginsCopy.textContent = copy.pluginsCopy;
  elements.errorTitle.textContent = copy.loadError;
  elements.errorCopy.textContent = copy.loadErrorCopy;
  elements.retryButton.textContent = copy.retry;
  elements.versionLabel.textContent = copy.version;
  elements.installLabel.textContent = copy.installation;
  elements.hostLabel.textContent = copy.runtimeHost;
  elements.updateButton.textContent = copy.checkUpdates;
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
  image.width = 18;
  image.height = 18;
  icon.append(image);

  const pluginCopy = element("div", "plugin-copy");
  const titleLine = element("div", "plugin-title-line");
  const name = element("h3", "plugin-name");
  const version = element("span", "plugin-version");
  titleLine.append(name, version);
  const description = element("p", "plugin-description");
  pluginCopy.append(titleLine, description);

  const control = element("div", "plugin-control");
  const label = element("label", "switch");
  const input = element("input");
  input.type = "checkbox";
  input.name = `feature-${feature.id}`;
  const track = element("span", "switch-track");
  track.setAttribute("aria-hidden", "true");
  label.append(input, track);
  const pluginState = element("span", "plugin-state");
  const dot = element("span", "status-dot");
  dot.setAttribute("aria-hidden", "true");
  const stateLabel = element("span", "plugin-state-label");
  pluginState.append(dot, stateLabel);
  control.append(label, pluginState);
  card.append(icon, pluginCopy, control);
  return card;
}

function updatePluginCard(card, feature) {
  const status = featureState(feature);
  const input = card.querySelector('input[type="checkbox"]');
  const image = card.querySelector(".plugin-icon img");
  const name = card.querySelector(".plugin-name");
  const version = card.querySelector(".plugin-version");
  const description = card.querySelector(".plugin-description");
  const dot = card.querySelector(".plugin-state .status-dot");
  const stateLabel = card.querySelector(".plugin-state-label");
  card.dataset.featureId = feature.id;
  image.src = feature.iconUrl;
  name.textContent = feature.label;
  version.textContent = feature.version;
  description.textContent = feature.description;
  input.checked = Boolean(feature.enabled);
  input.disabled = pendingFeatureIds.has(feature.id);
  input.setAttribute("aria-label", feature.label);
  dot.className = `status-dot ${status.className}`;
  stateLabel.textContent = status.label;
}

function findPluginCard(featureId) {
  return [...elements.pluginList.children].find((child) => child.dataset.featureId === featureId) ?? null;
}

function renderPluginCards(features) {
  for (const child of [...elements.pluginList.children]) {
    if (!child.dataset.featureId) child.remove();
  }
  const featureIds = new Set(features.map(({ id }) => id));
  for (const feature of features) {
    let card = findPluginCard(feature.id);
    if (!card) {
      card = createPluginCard(feature);
      elements.pluginList.append(card);
    }
    updatePluginCard(card, feature);
  }
  for (const card of [...elements.pluginList.children]) {
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
  elements.runtimeDot.className = `status-dot ${active ? "is-active" : "is-warning"}`;
  elements.runtimeLabel.textContent = active
    ? copy.runtimeActive
    : runtimeRunning
      ? copy.runtimeNotInjected
      : copy.runtimeStopped;
  elements.hostValue.textContent = runtimeRunning ? copy.running : copy.stopped;
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
    const response = await fetch("/api/status", { headers: { "Accept-Language": locale } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json();
    elements.pluginList.hidden = false;
    render();
  } catch {
    elements.pluginList.hidden = true;
    elements.loadError.hidden = false;
    elements.runtimeDot.className = "status-dot is-warning";
    elements.runtimeLabel.textContent = copy.runtimeStopped;
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
    const response = await fetch(`/api/features/${encodeURIComponent(featureId)}`, {
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
    const response = await fetch("/api/restart", {
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

elements.updateButton.addEventListener("click", async () => {
  elements.updateButton.disabled = true;
  elements.updateButton.textContent = copy.checkingUpdates;
  try {
    const response = await fetch("/api/update");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const update = await response.json();
    showToast(update.available ? copy.updateAvailable(update.latest) : copy.current);
  } catch {
    showToast(copy.loadErrorCopy);
  } finally {
    elements.updateButton.disabled = false;
    elements.updateButton.textContent = copy.checkUpdates;
  }
});

applyStaticCopy();
void load();
