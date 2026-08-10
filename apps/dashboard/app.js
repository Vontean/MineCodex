const locale = navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
document.documentElement.lang = locale;

const copy = {
  en: {
    subtitle: "Personal plugins for Codex",
    connecting: "Connecting…",
    runtimeActive: "Runtime active",
    runtimeStopped: "Runtime unavailable",
    plugins: "Plugins",
    pluginsCopy: "Choose which enhancements appear in Codex.",
    restartTitle: "Restart Codex to apply changes",
    restartCopy: "Your plugin choices are saved. Restart when you are ready.",
    restart: "Restart Codex",
    restarting: "Restarting…",
    saved: "Saved",
    saving: "Saving…",
    active: "Active in Codex",
    starting: "Starting",
    restartRequired: "Restart required",
    off: "Off",
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
    restartFailed: "MineCodex could not restart Codex.",
  },
  "zh-CN": {
    subtitle: "为 Codex 准备的个人插件",
    connecting: "正在连接…",
    runtimeActive: "运行正常",
    runtimeStopped: "运行服务不可用",
    plugins: "插件",
    pluginsCopy: "选择要在 Codex 中启用的增强功能。",
    restartTitle: "重启 Codex 以应用更改",
    restartCopy: "插件选择已经保存，可以在准备好后统一重启。",
    restart: "重启 Codex",
    restarting: "正在重启…",
    saved: "已保存",
    saving: "正在保存…",
    active: "已在 Codex 中启用",
    starting: "正在启动",
    restartRequired: "需要重启",
    off: "已关闭",
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
    restartFailed: "MineCodex 无法重启 Codex。",
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function featureState(feature) {
  if (!feature.enabled) return { label: copy.off, className: "" };
  if (feature.healthy) return { label: copy.active, className: "is-active" };
  if (feature.applied) return { label: copy.starting, className: "is-warning" };
  return { label: copy.restartRequired, className: "is-warning" };
}

function render() {
  const runtimeRunning = Boolean(state?.runtime?.running);
  elements.runtimeDot.className = `status-dot ${runtimeRunning ? "is-active" : "is-warning"}`;
  elements.runtimeLabel.textContent = runtimeRunning ? copy.runtimeActive : copy.runtimeStopped;
  elements.hostValue.textContent = runtimeRunning ? copy.running : copy.stopped;
  elements.versionValue.textContent = state?.version ?? "—";
  elements.restartNotice.hidden = !state?.pendingRestart;
  elements.pluginList.innerHTML = (state?.features ?? []).map((feature) => {
    const status = featureState(feature);
    return `<article class="plugin-card" data-feature-id="${escapeHtml(feature.id)}">
      <div class="plugin-icon" aria-hidden="true"><img src="${escapeHtml(feature.iconUrl)}" alt=""></div>
      <div class="plugin-copy">
        <div class="plugin-title-line">
          <h3 class="plugin-name">${escapeHtml(feature.label)}</h3>
          <span class="plugin-version">${escapeHtml(feature.version)}</span>
        </div>
        <p class="plugin-description">${escapeHtml(feature.description)}</p>
      </div>
      <div class="plugin-control">
        <label class="switch">
          <input type="checkbox" ${feature.enabled ? "checked" : ""} aria-label="${escapeHtml(feature.label)}">
          <span class="switch-track" aria-hidden="true"></span>
        </label>
        <span class="plugin-state"><span class="status-dot ${status.className}" aria-hidden="true"></span>${escapeHtml(status.label)}</span>
      </div>
    </article>`;
  }).join("");
  elements.pluginList.setAttribute("aria-busy", "false");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 4200);
}

async function load() {
  elements.loadError.hidden = true;
  try {
    const response = await fetch("/api/status", { headers: { "Accept-Language": locale } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json();
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
  if (!input || !card) return;
  input.disabled = true;
  elements.saveState.textContent = copy.saving;
  try {
    const response = await fetch(`/api/features/${encodeURIComponent(card.dataset.featureId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify({ enabled: input.checked }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    state.features = result.features;
    state.pendingRestart = result.pendingRestart;
    render();
    elements.saveState.textContent = copy.saved;
  } catch {
    input.checked = !input.checked;
    input.disabled = false;
    elements.saveState.textContent = "";
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
