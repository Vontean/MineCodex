import { findCodexModule } from '../../codex-adapter/src/renderer/modules.mjs';
import { createRendererSelfCheck, tokenRequirements } from "./renderer-self-check.mjs";
import { createCodexEnvironment } from "../../codex-adapter/src/renderer/environment.mjs";
// 注入源生成：createInjectionSource 产出注入到 Codex Renderer 的自包含脚本字符串。
// 该字符串经 CDP 注入后独立执行，因此 install 函数体必须自包含；
// CodexRuntime 与 CDP 客户端在 codex-runtime.mjs / codex-cdp.mjs。

import { createModelSliderInstallerSource } from "../../../features/model-slider/src/injection-source.mjs";
import { createUIInstallerSource } from "../../ui/src/install.mjs";
import { MCP_NAVIGATION_ICONS } from "../../plugin/src/navigation-icons.mjs";
import { randomBytes } from "node:crypto";
import { CODEX_THEME_TOKENS, CODEX_THEME_TOKEN_ALIASES, MINECODEX_THEME_BINDINGS } from "../../ui/src/native/tokens.mjs";


export const RUNTIME_VERSION = 115;
export const HOST_BINDING_NAME = "__codexPersonalHostAction";
export const CSP_BOOTSTRAP_VERSION = 1;
export const CSP_BOOTSTRAP_KEY = "__mineCodexCspBootstrapVersion";
export const CODEX_APP_ORIGIN = "app://-";
const LOOPBACK_SERVICE_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

// 带本机服务的 page-script 只能经 RuntimeHost 访问与 healthUrl 同源的 loopback HTTP 服务。
export function pageScriptServiceOrigin(feature) {
  if (!feature.pageScript || !feature.surfaceUrl || !feature.healthUrl) return null;
  const surfaceUrl = new URL(feature.surfaceUrl);
  const healthUrl = new URL(feature.healthUrl);
  if (
    surfaceUrl.origin !== healthUrl.origin
    || surfaceUrl.protocol !== "http:"
    || !LOOPBACK_SERVICE_HOSTS.has(surfaceUrl.hostname)
  ) return null;
  return surfaceUrl.origin;
}

// createInjectionSource：产出注入 Codex Renderer 的自包含脚本字符串。
// 返回的脚本经 CDP 注入后独立执行（install 函数体必须自包含，不能引用模块外部标识符）。
export function createInjectionSource(features, {
  bindingName = HOST_BINDING_NAME,
  bindingToken = "test-binding-token",
  runtimeSessionId = randomBytes(16).toString("hex"),
} = {}) {
  function install(config, installUI, installModelSliderFeature, createCodexEnvironment, createRendererSelfCheck, findCodexModule) {
    if (window.top !== window) return;
    if (!document.documentElement) {
      // The document bootstrap runs before the root element exists. Defer the
      // whole install until the DOM is ready instead of crashing on a null
      // documentElement (which previously left the runtime permanently absent
      // after a renderer reload).
      document.addEventListener("DOMContentLoaded", () => install(config, installUI, installModelSliderFeature, createCodexEnvironment, createRendererSelfCheck, findCodexModule), { once: true });
      return;
    }
    const currentRuntime = window.__codexPersonalRuntime;
    if (currentRuntime?.version === config.version && currentRuntime?.sessionId === config.sessionId) {
      currentRuntime.updateHostBinding(config.bindingName, config.bindingToken);
      currentRuntime.ensure();
      return;
    }
    currentRuntime?.dispose?.();

    const lifetime = new AbortController();
    const codex = createCodexEnvironment();
    const featureUI = installUI(lifetime.signal, {codex,mcpServer:"minecodex",mcpPluginId:"minecodex@minecodex-local",mcpNavigationIcons:config.mcpNavigationIcons,themeTokens:config.themeTokens,themeTokenAliases:config.themeTokenAliases,themeBindings:config.themeBindings});

    function normalizedLocale(value) {
      return String(value ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
    }

    const locale = normalizedLocale(
      document.documentElement.lang || navigator.languages?.[0] || navigator.language,
    );

    function localizedText(fallback, locales = {}) {
      return locales[locale] ?? locales.en ?? fallback;
    }

    // ========================================================================
    // 配置派生与运行状态
    // ========================================================================

    const features = config.features.map((feature) => ({
      ...feature,
      label: localizedText(feature.label, feature.labels),
      modelSelector: feature.modelSelector ? {
        ...feature.modelSelector,
        strings: Object.fromEntries(Object.entries(feature.modelSelector.strings ?? {}).map(
          ([key, definition]) => [key, localizedText(definition.value, definition.locales)],
        )),
      } : null,
      hostActions: new Set(feature.hostActions ?? []),
    }));
    const selfCheck = createRendererSelfCheck(features, config.sessionId, featureUI.theme);
    const featureById = new Map(features.map((feature) => [feature.id, feature]));
    const modelSelectorFeature = features.find(
      (feature) => feature.entry?.kind === "composer-model-selector",
    ) ?? null;
    const pageScriptFeatures = features.filter((feature) => feature.pageScript);
    let ensureQueued = false;
    let ensureFrame = null;
    let ensureTimer = null;
    let savedComposerRange = null;
    let savedComposerThread = null;
    const domObservers = [];
    const pageScriptCleanups = [];
    const pendingHostActions = new Map();

    function createMarkupIcon(iconDefinition, className, size = 16) {
      if (!iconDefinition?.markup) return null;
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("width", String(size));
      icon.setAttribute("height", String(size));
      icon.setAttribute("viewBox", iconDefinition.viewBox ?? "0 0 24 24");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "1.5");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");
      icon.setAttribute("aria-hidden", "true");
      if (className) icon.setAttribute("class", className);
      icon.innerHTML = iconDefinition.markup;
      return icon;
    }

    let modelSlider = {ensure() {}, dispose() {}};
    try {
      modelSlider = installModelSliderFeature(lifetime.signal, {
        feature: modelSelectorFeature, codex, ui: featureUI, createIcon: createMarkupIcon, requestRefresh: queueEnsure, locale,
        requestAction: payload => requestPageHostAction(modelSelectorFeature.id, "model-favorites", payload),
      });
      if (modelSelectorFeature) {
        selfCheck.register(modelSelectorFeature.id, () => modelSlider.selfCheck());
        selfCheck.installed(modelSelectorFeature.id);
      }
    } catch (error) {
      if (modelSelectorFeature) selfCheck.failed(modelSelectorFeature.id);
      console.warn("[codex-personal] model selector installation failed", error);
    }

    // ========================================================================
    // page-script 特征安装 — 执行各 feature 声明的页面脚本并登记清理
    // ========================================================================

    for (const feature of pageScriptFeatures) {
      const source = feature.pageScript?.source ?? "";
      if (!source.trim()) continue;
      try {
        const installer = new Function(
          "signal",
          "window",
          "document",
          "MutationObserver",
          "config",
          `"use strict";\n${source}`,
        );
        const pageConfig = feature.pageScript.config ??= {};
        pageConfig.ui = featureUI;
        pageConfig.codex = codex;
        pageConfig.registerSelfCheck = probe => selfCheck.register(feature.id, probe);
        pageConfig.requestHostAction = (action, payload) => requestPageHostAction(feature.id, action, payload);
        const cleanup = installer(
          lifetime.signal,
          window,
          document,
          MutationObserver,
          pageConfig,
        );
        if (typeof cleanup === "function") pageScriptCleanups.push(cleanup);
        selfCheck.installed(feature.id);
      } catch (error) {
        selfCheck.failed(feature.id);
        console.warn(`[codex-personal] page-script feature failed: ${feature.id}`, error);
      }
    }

    function updateHostBinding(bindingName, bindingToken) {
      if (config.bindingName === bindingName && config.bindingToken === bindingToken) return;
      // CDP 重连会轮换 token；页面脚本保留原状态，只更新后续请求使用的凭据。
      config.bindingName = bindingName;
      config.bindingToken = bindingToken;
      for (const feature of pageScriptFeatures) {
        feature.pageScript.config.bindingName = bindingName;
        feature.pageScript.config.bindingToken = bindingToken;
      }
    }

    // ========================================================================
    // Composer 文本插入 — 供 Notes 快捷提示词等页面脚本复用
    // ========================================================================

    function threadIdentity() {
      const selected = document.querySelector('[data-app-action-sidebar-thread-selected="true"]');
      const id = selected?.getAttribute("data-app-action-sidebar-thread-id");
      const project = selected?.closest?.("[data-app-action-sidebar-project-id]")
        ?.getAttribute("data-app-action-sidebar-project-id");
      return `${project ?? ""}:${id ?? ""}:${location.pathname}:${location.search}`;
    }

    function currentComposer() {
      return codex.composer(null, { purpose: "insertion" })?.editable ?? null;
    }

    function rememberComposerSelection() {
      const composer = currentComposer();
      const selection = document.getSelection();
      if (!composer || !selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!composer.contains(range.startContainer) || !composer.contains(range.endContainer)) return;
      savedComposerRange = range.cloneRange();
      savedComposerThread = threadIdentity();
    }

    function insertComposerText(text, target = null) {
      if (typeof text !== "string" || !text) throw new Error("Text is required");
      const composer = target ? codex.composer(target, { purpose: "insertion" })?.editable : currentComposer();
      if (!composer) throw new Error("The active Composer was not found");
      const selection = document.getSelection();
      let fallback = true;
      if (
        savedComposerRange
        && savedComposerThread === threadIdentity()
        && savedComposerRange.startContainer?.isConnected
        && composer.contains(savedComposerRange.startContainer)
        && composer.contains(savedComposerRange.endContainer)
      ) {
        selection.removeAllRanges();
        selection.addRange(savedComposerRange);
        fallback = false;
      } else {
        const range = document.createRange();
        range.selectNodeContents(composer);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      composer.focus({ preventScroll: true });
      const existing = composer.innerText.replace(/\n+$/, "");
      const insertedText = fallback && existing ? `\n${text}` : text;
      const inserted = document.execCommand("insertText", false, insertedText);
      if (!inserted) throw new Error("Codex rejected Composer insertion");
      rememberComposerSelection();
      return { mode: "inserted", fallback };
    }

    // ========================================================================
    // 刷新调度 — DOM 变化后合并到下一帧刷新 Model Selector
    // ========================================================================

    function ensureEntries() {
      ensureQueued = false;
      ensureFrame = null;
      ensureTimer = null;
      modelSlider.ensure();
    }

    function flushEnsure() {
      if (!ensureQueued) return;
      if (ensureFrame != null) cancelAnimationFrame(ensureFrame);
      if (ensureTimer != null) clearTimeout(ensureTimer);
      ensureFrame = null;
      ensureTimer = null;
      ensureEntries();
    }

    function queueEnsure() {
      if (ensureQueued) return;
      ensureQueued = true;
      ensureFrame = requestAnimationFrame(flushEnsure);
      ensureTimer = setTimeout(flushEnsure, 50);
    }

    // ========================================================================
    // host action 通道 — page-script 经 CDP binding 请求 RuntimeHost 并接收结果
    // ========================================================================

    function requestPageHostAction(featureId, action, payload) {
      if (!featureById.get(featureId)?.hostActions.has(action)) return Promise.reject(new Error("Host action is not registered"));
      if (typeof globalThis[config.bindingName] !== "function") return Promise.reject(new Error("Host bridge is unavailable"));
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pendingHostActions.delete(requestId);
          reject(new Error("Host request timed out"));
        }, featureId === "minecodex" ? 30_000 : 10_000);
        pendingHostActions.set(requestId, { resolve, reject, timer });
        try {
          globalThis[config.bindingName](JSON.stringify({ token: config.bindingToken, featureId, requestId, action, payload }));
        } catch (error) {
          clearTimeout(timer);
          pendingHostActions.delete(requestId);
          reject(error);
        }
      });
    }

    function resolveHostAction(requestId, response) {
      const pending = pendingHostActions.get(requestId);
      if (!pending) return false;
      pendingHostActions.delete(requestId);
      clearTimeout(pending.timer);
      if (response.ok) pending.resolve(response.result);
      else pending.reject(new Error(response.error?.message ?? "Host request failed"));
      return true;
    }

    document.addEventListener("selectionchange", rememberComposerSelection, { signal: lifetime.signal });
    const ensureObserver = new MutationObserver(queueEnsure);
    ensureObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-pressed", "data-state"],
    });
    domObservers.push(ensureObserver);
    // theme.read 会把原生主题 token 同步到根节点的 --mcx-* 变量，页面脚本依赖它跟随主题。
    let themeQueued = false;
    const syncTheme = () => {
      if (themeQueued) return;
      themeQueued = true;
      queueMicrotask(() => {
        themeQueued = false;
        featureUI.theme.read();
      });
    };
    featureUI.theme.read();
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    domObservers.push(themeObserver);

    // ========================================================================
    // 运行时 API 与清理
    // ========================================================================

    const runtimeApi = {
      version: config.version,
      sessionId: config.sessionId,
      updateHostBinding,
      nativeCapabilities: () => codex.diagnostics(),
      selfCheck: () => ({...selfCheck.snapshot(),capabilities:codex.diagnostics()}),
      ensure: queueEnsure,
      insertText: insertComposerText,
      resolveHostAction,
      dispose: () => {
        lifetime.abort();
        for (const [id, pending] of pendingHostActions) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Runtime disposed"));
          pendingHostActions.delete(id);
        }
        for (const cleanup of pageScriptCleanups.splice(0)) {
          try { cleanup(); } catch (error) {
            console.warn("[codex-personal] page-script cleanup failed", error);
          }
        }
        if (ensureFrame != null) cancelAnimationFrame(ensureFrame);
        if (ensureTimer != null) clearTimeout(ensureTimer);
        for (const observer of domObservers) observer.disconnect();
        modelSlider.dispose();
        featureUI.theme.dispose();
        if (window.__codexPersonalRuntime === runtimeApi) delete window.__codexPersonalRuntime;
      },
    };
    window.__codexPersonalRuntime = runtimeApi;
    queueEnsure();
  }

  const runtimeFeatures = features.map((feature) => ({
    requiredTokens:tokenRequirements(`${feature.pageScript?.source ?? ""} ${Object.values(feature.pageScript?.resources ?? {}).filter(value => typeof value === "string").join(" ")} ${feature.modelSelector ? createModelSliderInstallerSource() : ""}`,MINECODEX_THEME_BINDINGS),
    id: feature.id,
    label: feature.label,
    labels: feature.labels ?? null,
    entry: feature.entry,
    hostActions: feature.hostActions ?? [],
    modelSelector: feature.modelSelector ?? null,
    pageScript: feature.pageScript ? {
      ...feature.pageScript,
      config: {
        resources: feature.pageScript.resources ?? {},
        serviceOrigin: pageScriptServiceOrigin(feature),
        bindingName,
        bindingToken,
        featureId: feature.id,
      },
    } : null,
  }));
  return `(${install.toString()})(${JSON.stringify({
    version: RUNTIME_VERSION,
    sessionId: runtimeSessionId,
    bindingName,
    bindingToken,
    themeTokens: CODEX_THEME_TOKENS,
    themeTokenAliases: CODEX_THEME_TOKEN_ALIASES,
    themeBindings: MINECODEX_THEME_BINDINGS,
    mcpNavigationIcons: MCP_NAVIGATION_ICONS,
    features: runtimeFeatures,
  })}, ${createUIInstallerSource()}, ${createModelSliderInstallerSource()}, ${createCodexEnvironment.toString()}, ${createRendererSelfCheck.toString()}, ${findCodexModule.toString()})`;
}

export function createRuntimeReadyContract({
  pid,
  features = [],
  plugins = [],
  failures = [],
  renderer = {},
  runtimeSessionId,
}) {
  const discovered = Boolean(renderer.discovered);
  const discoveredTargets = Math.max(0, Number(renderer.discoveredTargets) || 0);
  const injectedTargets = Math.max(0, Number(renderer.injectedTargets) || 0);
  const targetFailures = Array.isArray(renderer.targetFailures) ? renderer.targetFailures : [];
  const active = Boolean(renderer.active) && discovered && injectedTargets > 0;
  return {
    pid,
    features: features.map((feature) => typeof feature === "string" ? feature : feature.id),
    failures,
    runtimeSessionId,
    plugins: plugins.map(plugin => {
      const targets=(renderer.targets ?? []).map(target => {
        const result=target.sessionId === runtimeSessionId && active
          ? target.plugins?.find(result => result.featureId === plugin.featureId) : null;
        return {targetId:target.targetId,checkedAt:target.checkedAt ?? null,
          ...(result ?? {state:"unknown",reason:target.reason ?? "self-check-pending",installation:"pending",checks:[],tokens:[]})};
      });
      const states=targets.map(target=>target.state);
      // 未观测的窗口也参与汇总，不能凭一项成功宣称全部窗口可用。
      const missing=Math.max(0,discoveredTargets-targets.length);
      let state=plugin.state;
      const definition=features.find(feature=>typeof feature === "object" && feature.id === plugin.featureId);
      if (definition?.healthUrl && state === "configured") state="launching";
      else if (active && ["configured","ready","injected"].includes(state)) {
        if (states.includes("available")) state=missing || states.some(value=>!["available","not-applicable"].includes(value)) ? "partial" : "injected";
        else if (states.includes("degraded")) state="degraded";
        else if (states.some(value=>["failed","unavailable"].includes(value))) state="unavailable";
        else if (!missing && states.length && states.every(value=>value === "not-applicable")) state="not-applicable";
        else state="checking";
      } else if (state === "injected") state="checking";
      return {featureId:plugin.featureId,state,serviceState:plugin.state,owned:Boolean(plugin.owned),health:plugin.health ?? null,failure:plugin.failure ?? null,targets};
    }),
    renderer: {
      discovered,
      discoveredTargets,
      injectedTargets,
      active,
      healthy: active && targetFailures.length === 0 && injectedTargets === discoveredTargets,
      targetFailures,
      runtimeSessionId: renderer.runtimeSessionId ?? runtimeSessionId,
      targets:renderer.targets ?? [],
      codexBuild:renderer.codexBuild ?? null,
      buildSource:renderer.buildSource ?? null,
    },
  };
}

export function createDocumentBootstrapSource(source) {
  return `window[${JSON.stringify(CSP_BOOTSTRAP_KEY)}] = ${CSP_BOOTSTRAP_VERSION};\n${source}`;
}
