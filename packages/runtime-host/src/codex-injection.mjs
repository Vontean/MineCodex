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

export const RUNTIME_VERSION = 114;
export const HOST_BINDING_NAME = "__codexPersonalHostAction";
export const CSP_BOOTSTRAP_VERSION = 1;
export const CSP_BOOTSTRAP_KEY = "__mineCodexCspBootstrapVersion";
export const CODEX_APP_ORIGIN = "app://-";
export const SURFACE_LOAD_ACTION = "load-surface";
export const SURFACE_FRAME_PREFIX = "minecodex-surface-";
export const LOOPBACK_SURFACE_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
export const RIGHT_PANEL_ROUTE_KINDS = Object.freeze(["home", "local-thread"]);

export const RESPONSIVE_SUMMARY_LAYOUT = Object.freeze({
  contentBaseWidth: 736,
  overlayClearance: 180,
  gutterClearance: 400,
  panelWidth: 300,
  panelInset: 16,
  verticalInset: 12,
  popoverOffset: 8,
  popoverBottomInset: 6,
});

export function responsiveSummaryDisplayMode(mainContentTargetWidth, layout = RESPONSIVE_SUMMARY_LAYOUT) {
  const clearance = (Number(mainContentTargetWidth) - layout.contentBaseWidth) / 2;
  if (clearance < layout.overlayClearance) return "overlay";
  if (clearance < layout.gutterClearance) return "shift";
  return "gutter";
}

export function responsiveSummaryVisibleSurface({ displayMode, isPinned, isPopoverOpen }) {
  if (displayMode !== "overlay" && isPinned) return "inline";
  if (displayMode === "overlay" && isPopoverOpen) return "popover";
  return null;
}

export function responsiveSummaryContentShift({ displayMode, isPinned }, layout = RESPONSIVE_SUMMARY_LAYOUT) {
  return displayMode !== "overlay" && isPinned
    ? -(layout.panelWidth + layout.panelInset) / 2
    : 0;
}

function declaredSurfaceUrls(feature) {
  return new Set([
    feature.surfaceUrl,
    feature.pinnedSummary?.surfaceUrl,
    ...(feature.detailTabs ?? []).map((detail) => detail.surfaceUrl),
  ].filter(Boolean));
}

export function requireDeclaredLoopbackSurface(feature, value) {
  if (typeof value !== "string") {
    throw Object.assign(new Error("Surface URL is not declared by this feature"), {
      code: "SURFACE_URL_NOT_ALLOWED",
    });
  }
  const url = new URL(value);
  const matchesDeclaredDocument = Array.from(declaredSurfaceUrls(feature), (declared) => new URL(declared))
    .some((declared) => (
      declared.origin === url.origin
      && declared.username === url.username
      && declared.password === url.password
      && declared.pathname === url.pathname
      && declared.hash === url.hash
    ));
  if (!matchesDeclaredDocument) {
    throw Object.assign(new Error("Surface URL is not declared by this feature"), {
      code: "SURFACE_URL_NOT_ALLOWED",
    });
  }
  if (url.protocol !== "http:" || !LOOPBACK_SURFACE_HOSTS.has(url.hostname)) {
    throw Object.assign(new Error("Surface URL must use an exact loopback HTTP origin"), {
      code: "SURFACE_URL_NOT_ALLOWED",
    });
  }
  return url;
}

export function pageScriptServiceOrigin(feature) {
  if (!feature.pageScript || !feature.surfaceUrl || !feature.healthUrl) return null;
  const surfaceUrl = new URL(feature.surfaceUrl);
  const healthUrl = new URL(feature.healthUrl);
  if (
    surfaceUrl.origin !== healthUrl.origin
    || surfaceUrl.protocol !== "http:"
    || !LOOPBACK_SURFACE_HOSTS.has(surfaceUrl.hostname)
  ) return null;
  return surfaceUrl.origin;
}

export function findFrameByName(frameTree, frameName) {
  if (frameTree.frame?.name === frameName) return frameTree.frame;
  for (const child of frameTree.childFrames ?? []) {
    const match = findFrameByName(child, frameName);
    if (match) return match;
  }
  return null;
}

export function documentWithBase(html, surfaceUrl) {
  const head = /<head(?:\s[^>]*)?>/i;
  if (!head.test(html)) {
    throw Object.assign(new Error("Surface document has no head element"), {
      code: "SURFACE_DOCUMENT_INVALID",
    });
  }
  return html.replace(head, (match) => `${match}<base href=${JSON.stringify(surfaceUrl)}>`);
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
    const rightPanelRouteKinds = new Set(config.rightPanelRouteKinds);

    const entryMarker = "data-codex-personal-feature";
    const pageSurfaceMarker = "data-codex-personal-surface";
    const pinnedSurfaceMarker = "data-codex-personal-pinned-summary";
    const modalSurfaceMarker = "data-codex-personal-modal";
    const promptPreviewMarker = "data-codex-personal-prompt-preview";
    const nativeLabels = {
      sites: ["sites", "站点"],
      scheduled: ["scheduled", "计划任务"],
      plugins: ["plugins", "插件"],
    };
    const nativeToolbarLabels = {
      summary: ["Toggle summary", "切换摘要"],
      pinnedSummary: ["Toggle pinned summary", "切换固定摘要"],
      bottomPanel: ["Toggle bottom panel", "切换底部面板"],
      sidePanel: ["Toggle side panel", "切换侧边面板"],
      temporaryChat: ["temporary chat", "临时聊天", "临时对话"],
    };

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
    // 配置派生与运行状态 — feature 分类、surface/卡片状态、观察器与计时器
    // ========================================================================

    const features = config.features.map((feature) => ({
      ...feature,
      label: localizedText(feature.label, feature.labels),
      entry: feature.entry ? {
        ...feature.entry,
        ariaLabel: localizedText(feature.entry.ariaLabel, feature.entry.ariaLabels),
      } : { kind: "sidebar" },
      pinnedSummary: feature.pinnedSummary ? {
        ...feature.pinnedSummary,
        label: localizedText(feature.pinnedSummary.label, feature.pinnedSummary.labels),
        overlayLabel: localizedText(feature.pinnedSummary.overlayLabel, feature.pinnedSummary.overlayLabels),
        pinnedLabel: localizedText(feature.pinnedSummary.pinnedLabel, feature.pinnedSummary.pinnedLabels),
      } : null,
      detailTabs: (feature.detailTabs ?? []).map((detail) => ({
        ...detail,
        label: localizedText(detail.label, detail.labels),
      })),
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
    const sidebarFeatures = features.filter((feature) => feature.entry?.kind === "sidebar");
    const toolbarFeatures = features.filter((feature) => feature.entry?.kind === "conversation-toolbar");
    const modelSelectorFeature = features.find(
      (feature) => feature.entry?.kind === "composer-model-selector",
    ) ?? null;
    const pageScriptFeatures = features.filter((feature) => feature.pageScript);
    const pageSurfaces = new Map();
    const pinnedSurfaces = new Map();
    const surfaceRecords = new Map();
    const nativeDetailComponents = new Map();
    const nativeDetailSurfaceKeys = new Map();
    const nativeOpenTabSessions = new Set();
    const summaryStates = new Map();
    let activePageFeatureId = null;
    let activePinnedFeatureId = null;
    let ensureQueued = false;
    let ensureFrame = null;
    let ensureTimer = null;
    let themeQueued = false;
    let suppressedSelections = [];
    let savedComposerRange = null;
    let savedComposerThread = null;
    let currentThread = null;
    let currentSummaryDisplayMode = null;
    let shiftedConversationOwners = [];
    let mainContentObserver = null;
    let toolbarReadiness = null;
    const domObservers = [];
    const pageScriptCleanups = [];
    const pendingHostActions = new Map();
    let activeModalRecordKey = null;
    let activePromptPreview = null;
    let promptPreviewDismissTimer = null;
    let nativeTabCapabilityPromise = null;
    let nativeTabCapability = null;
    let nativeTabCapabilityError = null;
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

    // ========================================================================
    // Toolbar 入口定位与就绪 — 识别原生 Toolbar/Summary 控件并等待其就绪
    // ========================================================================

    function findEntry(featureId) {
      return Array.from(document.querySelectorAll(`[${entryMarker}]`)).find(
        (entry) => entry.getAttribute(entryMarker) === featureId,
      );
    }

    function findNativeEntry(key) {
      const labels = nativeLabels[key] ?? [String(key).toLowerCase()];
      return Array.from(document.querySelectorAll("a, button")).find((element) => (
        labels.includes(element.textContent?.trim().toLowerCase())
      ));
    }

    function findReferenceEntry() {
      return findNativeEntry("plugins");
    }

    function isVisibleToolbarControl(element) {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    }

    function hasNativeToolbarLabel(button, key) {
      const label = String(button?.getAttribute("aria-label") ?? "").trim().toLowerCase();
      return nativeToolbarLabels[key].some((candidate) => (
        key === "temporaryChat"
          ? label.includes(candidate.toLowerCase())
          : label === candidate.toLowerCase()
      ));
    }

    function nativeSummaryButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => (
        (
          hasNativeToolbarLabel(button, "summary")
          || hasNativeToolbarLabel(button, "pinnedSummary")
        )
        && isVisibleToolbarControl(button)
      )) ?? null;
    }

    function nativeBottomPanelButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (!hasNativeToolbarLabel(button, "bottomPanel")) return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
    }

    function nativeSidePanelButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (!hasNativeToolbarLabel(button, "sidePanel")) return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
    }

    function nativeTemporaryChatButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (!hasNativeToolbarLabel(button, "temporaryChat")) return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
    }

    function structuralToolbarAnchor() {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((button) => hasNativeToolbarLabel(button, "temporaryChat"))
        ?? buttons.find((button) => (
          hasNativeToolbarLabel(button, "summary")
          || hasNativeToolbarLabel(button, "pinnedSummary")
        ))
        ?? buttons.find((button) => hasNativeToolbarLabel(button, "bottomPanel"))
        ?? buttons.find((button) => hasNativeToolbarLabel(button, "sidePanel"))
        ?? null;
    }

    function stopToolbarReadiness() {
      if (!toolbarReadiness) return;
      toolbarReadiness.observer.disconnect();
      if (toolbarReadiness.retryTimer != null) clearTimeout(toolbarReadiness.retryTimer);
      if (toolbarReadiness.deadlineTimer != null) clearTimeout(toolbarReadiness.deadlineTimer);
      toolbarReadiness = null;
    }

    function ensureToolbarReadiness(candidate) {
      const thread = threadIdentity();
      if (toolbarReadiness?.candidate === candidate && toolbarReadiness.thread === thread) return;
      stopToolbarReadiness();
      const record = {
        candidate,
        thread,
        attempts: 0,
        retryTimer: null,
        deadlineTimer: null,
        observer: null,
      };
      const wake = () => {
        if (toolbarReadiness !== record) return;
        queueEnsure();
      };
      record.observer = new ResizeObserver(wake);
      record.observer.observe(candidate);
      const header = candidate.closest("header");
      if (header) record.observer.observe(header);
      const retry = () => {
        if (toolbarReadiness !== record || record.attempts >= 8) return;
        record.attempts += 1;
        wake();
        record.retryTimer = setTimeout(retry, 75);
      };
      record.retryTimer = setTimeout(retry, 75);
      record.deadlineTimer = setTimeout(() => {
        if (toolbarReadiness === record) stopToolbarReadiness();
      }, 1_500);
      toolbarReadiness = record;
    }

    function toolbarControlRoot(button) {
      return button?.parentElement?.parentElement ?? button?.parentElement ?? button ?? null;
    }

    function nativeSummaryToolbarGroup(nativeButton) {
      return toolbarControlRoot(nativeButton)?.parentElement ?? null;
    }

    function conversationToolbarHost(nativeButton) {
      const header = nativeButton?.closest("header");
      if (!header) return null;
      return Array.from(header.children).find((child) => {
        if (!(child instanceof HTMLElement) || !isVisibleToolbarControl(child)) return false;
        return Number.parseFloat(getComputedStyle(child).flexGrow) > 0;
      }) ?? null;
    }

    function ensureFallbackSummaryToolbarGroup(nativeButton) {
      const toolbarHost = conversationToolbarHost(nativeButton);
      if (!toolbarHost) return null;
      let group = toolbarHost.querySelector(":scope > [data-codex-personal-summary-toolbar-group]");
      if (!group) {
        group = document.createElement("div");
        group.setAttribute("data-codex-personal-summary-toolbar-group", "fallback");
        // The host toolbar strip is pointer-events:none; without this the
        // fallback entries would be visible but unclickable.
        group.className = "ms-auto flex shrink-0 items-center gap-1.5 pointer-events-auto";
        // Same structure as the native tool group (e.g. the temporary-chat
        // group in Chat mode): an in-flow ms-auto strip inside the flexible
        // header area. It sits at the right edge while the side panel is
        // closed and, when the side panel widens its host container, moves
        // together with the native layout exactly like Chat mode does.
        toolbarHost.append(group);
      }
      return group;
    }

    function toolbarEntryFitsHeader(entryRoot) {
      const header = entryRoot.closest("header");
      if (!header) return true;
      const headerRect = header.getBoundingClientRect();
      const entryRect = entryRoot.getBoundingClientRect();
      if (entryRect.width <= 0 || entryRect.height <= 0) return false;
      return entryRect.right <= headerRect.right + 1 && entryRect.left >= headerRect.left - 1;
    }

    function isNativeSummaryButton(element) {
      if (!(element instanceof Element)) return false;
      const button = element.closest("button");
      return hasNativeToolbarLabel(button, "summary")
        || hasNativeToolbarLabel(button, "pinnedSummary");
    }

    function mainContentViewport() {
      const composer = currentComposer();
      return composer?.closest("main[data-app-shell-main-surface]")
        ?? document.querySelector("main[data-app-shell-main-surface]")
        ?? document.querySelector("[data-app-shell-main-content-layout]")
        ?? document.querySelector("main");
    }

    function visibleRightWorkspacePanels() {
      return Array.from(document.querySelectorAll('[data-app-shell-tab-panel-controller="right"]'))
        .filter((panel) => {
          if (!(panel instanceof HTMLElement) || panel.hidden) return false;
          const style = getComputedStyle(panel);
          const rect = panel.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
        });
    }

    function mainContentTargetGeometry() {
      const viewport = mainContentViewport();
      const rect = viewport?.getBoundingClientRect() ?? {
        left: Math.max(0, sidebarRight()),
        right: innerWidth,
        top: 0,
        bottom: innerHeight,
        width: Math.max(0, innerWidth - sidebarRight()),
      };
      let right = rect.right;
      for (const panel of visibleRightWorkspacePanels()) {
        const panelRect = panel.getBoundingClientRect();
        if (panelRect.left > rect.left && panelRect.left < right) right = panelRect.left;
      }
      return {
        viewport,
        left: rect.left,
        right,
        top: rect.top,
        bottom: rect.bottom,
        width: Math.max(0, right - rect.left),
      };
    }

    function summaryDisplayMode() {
      const layout = config.summaryLayout;
      const clearance = (mainContentTargetGeometry().width - layout.contentBaseWidth) / 2;
      if (clearance < layout.overlayClearance) return "overlay";
      if (clearance < layout.gutterClearance) return "shift";
      return "gutter";
    }

    function summaryState(featureId) {
      let state = summaryStates.get(featureId);
      if (!state) {
        state = { isPinned: false, isPopoverOpen: false };
        summaryStates.set(featureId, state);
      }
      return state;
    }

    function visibleSummarySurface(featureId, displayMode = summaryDisplayMode()) {
      const state = summaryState(featureId);
      if (displayMode !== "overlay" && state.isPinned) return "inline";
      if (displayMode === "overlay" && state.isPopoverOpen) return "popover";
      return null;
    }

    function summaryButtonLabel(feature, displayMode = summaryDisplayMode()) {
      const definition = feature.pinnedSummary ?? {};
      return displayMode === "overlay"
        ? definition.overlayLabel ?? (locale === "zh-CN" ? "切换笔记" : "Toggle notes")
        : definition.pinnedLabel
          ?? feature.entry.ariaLabel
          ?? (locale === "zh-CN" ? "切换固定笔记" : "Toggle pinned notes");
    }

    function reducedMotion() {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    }

    // ========================================================================
    // 通用图标工厂 — feature 入口与插件适配共享的 markup 图标
    // ========================================================================

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

    function createFeatureIcon(feature, className, size = 16) {
      return createMarkupIcon(feature.icon, className, size);
    }



    // ========================================================================
    // Surface 注册与主题桥 — surface 记录、侧栏状态、主题 token 与 Composer 文本
    // ========================================================================

    function surfaceKey(featureId, kind, detailId = "") {
      return `${featureId}:${kind}:${detailId}`;
    }

    function surfaceFrameName(featureId) {
      const nonce = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return `minecodex-surface-${config.sessionId}-${featureId}-${nonce}`;
    }

    function requestSurfaceLoad(record) {
      if (!record || record.loading || typeof globalThis[config.bindingName] !== "function") return false;
      const requestId = crypto.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      record.loading = true;
      record.ready = false;
      record.loadError = null;
      pendingHostActions.set(requestId, { recordKey: record.key, kind: "surface-load" });
      globalThis[config.bindingName](JSON.stringify({
        token: config.bindingToken,
        featureId: record.featureId,
        requestId,
        action: "load-surface",
        payload: {
          frameName: record.frame.name,
          surfaceUrl: record.surfaceUrl,
        },
      }));
      return true;
    }

    function updateHostBinding(bindingName, bindingToken) {
      if (config.bindingName === bindingName && config.bindingToken === bindingToken) return;
      // CDP 重连会轮换 token；保留已有页面和草稿，只重试未就绪的页面。
      config.bindingName = bindingName;
      config.bindingToken = bindingToken;
      for (const feature of pageScriptFeatures) {
        feature.pageScript.config.bindingName = bindingName;
        feature.pageScript.config.bindingToken = bindingToken;
      }
      for (const [requestId, pending] of pendingHostActions) {
        if (pending.kind === "surface-load") pendingHostActions.delete(requestId);
      }
      for (const record of surfaceRecords.values()) {
        if (record.ready) continue;
        record.loading = false;
        requestSurfaceLoad(record);
      }
    }

    function postSurfaceActive(record, active) {
      if (!record || record.kind !== "page") return;
      record.frame.contentWindow?.postMessage({
        type: "codex-personal:surface-active",
        active: Boolean(active),
      }, "/");
    }

    function nativeSidebarTrigger() {
      const triggers = Array.from(document.querySelectorAll(
        'button[data-app-shell-sidebar-trigger="true"]',
      ));
      return triggers.find((button) => isVisibleToolbarControl(button)) ?? triggers[0] ?? null;
    }

    function sidebarState() {
      const trigger = nativeSidebarTrigger();
      const expanded = trigger?.getAttribute("aria-expanded");
      const triggerRect = trigger?.getBoundingClientRect();
      return {
        available: Boolean(trigger),
        open: expanded === null ? sidebarRight() > 0 : expanded === "true",
        label: trigger?.getAttribute("aria-label") ?? "Show sidebar",
        leading: triggerRect?.left ?? 16,
      };
    }

    function postSidebarState(record, state = sidebarState()) {
      if (!record || record.kind !== "page") return;
      record.frame.contentWindow?.postMessage({
        type: "codex-personal:sidebar-state",
        ...state,
      }, "/");
    }

    function registerSurface(key, feature, kind, surfaceUrl, element, frame, detailId = null) {
      const record = {
        key,
        featureId: feature.id,
        kind,
        detailId,
        origin: window.location.origin,
        surfaceUrl,
        element,
        frame,
        ready: false,
        loading: false,
        loadError: null,
        preferredHeight: null,
      };
      surfaceRecords.set(key, record);
      frame.addEventListener("load", () => {
        queueTheme();
        postSurfaceActive(record, activePageFeatureId === record.featureId && !record.element.hidden);
        postSidebarState(record);
      });
      requestSurfaceLoad(record);
      return record;
    }

    function reloadSurfaceIfUnready(key, surfaceUrl) {
      const record = surfaceRecords.get(key);
      if (!record || record.ready || record.surfaceUrl !== surfaceUrl) return false;
      return requestSurfaceLoad(record);
    }

    function removeSurfaceRecord(key) {
      if (activePromptPreview?.recordKey === key) closePromptPreview({ immediate: true });
      surfaceRecords.delete(key);
      pendingHostActions.forEach((pending, requestId) => {
        if (pending.recordKey !== key) return;
        pendingHostActions.delete(requestId);
      });
    }

    const resolvedTheme=featureUI.theme.read;
    resolvedTheme();

    function sendTheme() {
      themeQueued = false;
      const { style, tokens, mode } = resolvedTheme();
      const radiusToken = tokens["--radius-3xl-base"] ?? "20px";
      const radiusBase = Number.parseFloat(radiusToken) || 20;
      const radiusUnit = radiusToken.match(/[a-z%]+$/i)?.[0] ?? "px";
      const radiusScale = Number.parseFloat(tokens["--codex-corner-radius-scale"] ?? "1.25") || 1.25;
      const panelRadius = `${radiusBase * radiusScale}${radiusUnit}`;
      const panelCornerShape = tokens["--codex-corner-shape"] ?? "superellipse(1.5)";
      const dialogRadius = tokens["--radius-3xl"];
      const dialogShadow = `0 0 0 .5px ${tokens["--color-border"]},${tokens["--shadow-lg"]}`;
      const surfaceTokens = {
        ...tokens,
        // 部分 Codex 版本仅提供等价的正文前景 token。
        "--color-token-input-foreground": tokens["--color-token-input-foreground"] ?? tokens["--color-text-foreground"],
        "--codex-summary-section-title-font-size": "14px",
        "--codex-summary-section-title-line-height": "21px",
        "--codex-summary-section-title-font-weight": tokens["--font-weight-normal"] ?? "400",
        "--codex-summary-row-font-size": "16px",
        "--codex-summary-row-line-height": "24px",
        "--codex-summary-label-font-size": tokens["--text-base"] ?? "14px",
        "--codex-summary-label-line-height": tokens["--text-base--line-height"] ?? "1.5",
        "--codex-summary-font-weight": style.fontWeight || "445",
        "--codex-summary-icon-size": "18px",
        "--codex-summary-icon-stroke-width": "1.5px",
        "--codex-summary-panel-radius": panelRadius,
        "--codex-summary-panel-corner-shape": panelCornerShape,
        "--codex-dialog-radius": dialogRadius,
        "--codex-dialog-corner-shape": "round",
        "--codex-dialog-shadow": dialogShadow,
        "--codex-summary-row-radius": tokens["--radius-sm"] ?? "7.5px",
        "--codex-summary-control-radius": tokens["--radius-md"] ?? "10px",
        "--codex-summary-section-title-color": tokens["--color-token-text-tertiary"] ?? "rgba(13,13,13,.484)",
        "--codex-summary-icon-primary": tokens["--color-icon-primary"] ?? tokens["--color-token-foreground"] ?? style.color,
        "--codex-summary-icon-secondary": tokens["--color-icon-secondary"] ?? tokens["--color-token-text-secondary"] ?? style.color,
        "--codex-summary-icon-tertiary": tokens["--color-icon-tertiary"] ?? tokens["--color-token-text-tertiary"] ?? style.color,
      };
      for (const record of surfaceRecords.values()) {
        if (!record.element.isConnected) continue;
        if (record.kind === "pinned") {
          record.element.style.borderRadius = panelRadius;
          record.element.style.setProperty("corner-shape", panelCornerShape);
          record.element.style.boxShadow = tokens["--elevation-prominent"]
            ?? "0 0 0 .5px rgba(13,13,13,.11),0 3px 7.5px rgba(0,0,0,.04),0 0 20px rgba(0,0,0,.05)";
        }
        if (record.kind !== "modal") record.element.style.background = record.kind === "pinned"
          ? tokens["--color-token-dropdown-background"]
            ?? tokens["--color-token-main-surface-primary"]
            ?? style.backgroundColor
          : tokens["--color-token-main-surface-primary"] ?? style.backgroundColor;
        record.frame.contentWindow?.postMessage(
          { type: "codex-personal:theme", theme: mode, mode, locale, tokens: surfaceTokens },
          "/",
        );
      }
    }

    function queueTheme() {
      if (themeQueued) return;
      themeQueued = true;
      queueMicrotask(sendTheme);
    }

    function sidebarRight() {
      const sidebar = document.querySelector("[data-app-action-sidebar-scroll]");
      return sidebar?.getBoundingClientRect().right ?? 0;
    }

    // Windows 版 Codex 在 renderer 顶部渲染横贯全宽的应用菜单条
    // （_ApplicationMenuTopBar），page surface 必须避开该条并以内嵌卡片
    // 形式呈现（左上圆角）。macOS 无此元素，inset 为 0，布局保持不变。
    function applicationMenuTopInset() {
      const menuBar = document.querySelector('[class*="_ApplicationMenuTopBar_"]');
      if (!menuBar?.isConnected) return 0;
      const bottom = menuBar.getBoundingClientRect().bottom;
      return Number.isFinite(bottom) && bottom > 0 ? Math.round(bottom) : 0;
    }

    function updatePageSurfacePositions() {
      const state = sidebarState();
      const left = `${state.open ? Math.max(0, sidebarRight()) : 0}px`;
      const topInset = applicationMenuTopInset();
      const embeddedCard = topInset > 0;
      for (const [featureId, surface] of pageSurfaces) {
        surface.style.left = left;
        surface.style.top = `${topInset}px`;
        surface.style.borderTopLeftRadius = embeddedCard ? "12px" : "";
        surface.style.overflow = embeddedCard ? "hidden" : "";
        postSidebarState(surfaceRecords.get(surfaceKey(featureId, "page")), state);
      }
    }

    function syncAfterNativeSidebarToggle() {
      queueMicrotask(updatePageSurfacePositions);
    }

    function threadIdentity() {
      const selected = document.querySelector('[data-app-action-sidebar-thread-selected="true"]');
      const id = selected?.getAttribute("data-app-action-sidebar-thread-id");
      const project = selected?.closest?.("[data-app-action-sidebar-project-id]")
        ?.getAttribute("data-app-action-sidebar-project-id");
      return `${project ?? ""}:${id ?? ""}:${location.pathname}:${location.search}`;
    }

    function checkThreadChange() {
      const next = threadIdentity();
      if (currentThread === null) {
        currentThread = next;
        return;
      }
      if (next === currentThread) return;
      currentThread = next;
      stopToolbarReadiness();
      savedComposerRange = null;
      savedComposerThread = null;
      hidePinnedSurfaces();
      queueEnsure();
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

    function suppressNativeSelections() {
      const sidebar = document.querySelector("[data-app-action-sidebar-scroll]");
      if (!sidebar) return;
      const alreadySuppressed = new Set(suppressedSelections.map(({ element }) => element));
      const selected = new Set([
        ...sidebar.querySelectorAll('[aria-current="page"]'),
        ...sidebar.querySelectorAll('[data-app-action-sidebar-thread-selected="true"]'),
      ]);
      for (const element of selected) {
        if (element.hasAttribute(entryMarker) || alreadySuppressed.has(element)) continue;
        const selection = {
          element,
          ariaCurrent: element.getAttribute("aria-current"),
          threadSelected: element.getAttribute("data-app-action-sidebar-thread-selected"),
          hadPrimaryGhost: element.classList.contains("bg-primary-ghost-hover"),
          hadHoverPrimaryGhost: element.classList.contains("hover:bg-primary-ghost-hover"),
          hadActiveClass: element.classList.contains("bg-token-list-hover-background"),
          hadHoverClass: element.classList.contains("hover:bg-token-list-hover-background"),
        };
        suppressedSelections.push(selection);
        element.removeAttribute("aria-current");
        element.removeAttribute("data-app-action-sidebar-thread-selected");
        // 原生选中态（灰底）现在由 bg-primary-ghost-hover 承载，需一并移除；
        // 旧 token 类仍保留处理，以便兼容旧主题。
        element.classList.remove("bg-primary-ghost-hover");
        element.classList.remove("bg-token-list-hover-background");
        if (!selection.hadHoverPrimaryGhost) element.classList.add("hover:bg-primary-ghost-hover");
        element.classList.add("hover:bg-token-list-hover-background");
      }
    }

    function restoreNativeSelections() {
      for (const selection of suppressedSelections) {
        const { element } = selection;
        if (!element.isConnected) continue;
        if (selection.ariaCurrent !== null) element.setAttribute("aria-current", selection.ariaCurrent);
        if (selection.threadSelected !== null) {
          element.setAttribute("data-app-action-sidebar-thread-selected", selection.threadSelected);
        }
        element.classList.toggle("bg-primary-ghost-hover", Boolean(selection.hadPrimaryGhost));
        element.classList.toggle("hover:bg-primary-ghost-hover", Boolean(selection.hadHoverPrimaryGhost));
        element.classList.toggle("bg-token-list-hover-background", selection.hadActiveClass);
        element.classList.toggle("hover:bg-token-list-hover-background", selection.hadHoverClass);
      }
      suppressedSelections = [];
    }

    function updateSidebarSelectedState() {
      for (const feature of sidebarFeatures) {
        const entry = findEntry(feature.id);
        if (!entry) continue;
        const selected = feature.id === activePageFeatureId;
        entry.classList.toggle("bg-primary-ghost-hover", selected);
        entry.classList.toggle("bg-token-list-hover-background", selected);
        entry.classList.toggle("hover:bg-token-list-hover-background", !selected);
        if (selected) entry.setAttribute("aria-current", "page");
        else entry.removeAttribute("aria-current");
      }
      if (activePageFeatureId) suppressNativeSelections();
      else restoreNativeSelections();
    }

    function updateToolbarState() {
      const displayMode = summaryDisplayMode();
      for (const feature of toolbarFeatures) {
        const entry = findEntry(feature.id);
        if (!entry) continue;
        const open = visibleSummarySurface(feature.id, displayMode) !== null;
        const label = summaryButtonLabel(feature, displayMode);
        const pressed = String(open);
        const state = open ? "open" : "closed";
        if (entry.getAttribute("aria-label") !== label) entry.setAttribute("aria-label", label);
        if (entry.getAttribute("data-minecodex-tooltip") !== label) entry.setAttribute("data-minecodex-tooltip", label);
        if (entry.getAttribute("aria-pressed") !== pressed) entry.setAttribute("aria-pressed", pressed);
        if (entry.getAttribute("aria-expanded") !== pressed) entry.setAttribute("aria-expanded", pressed);
        if (entry.getAttribute("data-state") !== state) entry.setAttribute("data-state", state);
        entry.setAttribute("data-codex-personal-summary-mode", displayMode);
      }
    }

    // ========================================================================
    // Page/Pinned/Modal surface 与摘要呈现 — 页面/固定/模态 surface 创建、展示与响应式摘要
    // ========================================================================

    function createFrame(featureId, title) {
      const frame = document.createElement("iframe");
      frame.name = surfaceFrameName(featureId);
      frame.src = "about:blank";
      frame.title = title;
      frame.allow = "clipboard-write";
      frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:transparent";
      // 图片页覆盖原生标题栏，避免控件点击被窗口拖拽区域吞掉。
      if (featureId === "images") frame.style.setProperty("-webkit-app-region", "no-drag");
      return frame;
    }

    function createPageSurface(feature) {
      const surface = document.createElement("section");
      surface.setAttribute(pageSurfaceMarker, feature.id);
      featureUI.page(surface, { transparent:true });
      surface.style.cssText = [
        "top:0",
        "right:0",
        "bottom:0",
        "background:transparent",
      ].join(";");
      const frame = createFrame(feature.id, feature.label);
      surface.append(frame);
      document.body.append(surface);
      pageSurfaces.set(feature.id, surface);
      registerSurface(surfaceKey(feature.id, "page"), feature, "page", feature.surfaceUrl, surface, frame);
      return surface;
    }

    function showPageSurface(featureId) {
      const feature = featureById.get(featureId);
      if (!feature) return;
      hidePinnedSurfaces();
      for (const [otherFeatureId, surface] of pageSurfaces) {
        if (otherFeatureId === featureId) continue;
        surface.hidden = true;
        const record = surfaceRecords.get(surfaceKey(otherFeatureId, "page"));
        postSurfaceActive(record, false);
      }
      const existing = pageSurfaces.get(featureId);
      const reusable = existing?.isConnected ? existing : null;
      const surface = reusable ?? createPageSurface(feature);
      if (reusable) reloadSurfaceIfUnready(surfaceKey(feature.id, "page"), feature.surfaceUrl);
      surface.hidden = false;
      activePageFeatureId = featureId;
      const record = surfaceRecords.get(surfaceKey(feature.id, "page"));
      postSurfaceActive(record, true);
      updatePageSurfacePositions();
      updateSidebarSelectedState();
      queueTheme();
    }

    function hidePageSurfaces() {
      for (const [featureId, surface] of pageSurfaces) {
        surface.hidden = true;
        const record = surfaceRecords.get(surfaceKey(featureId, "page"));
        postSurfaceActive(record, false);
      }
      activePageFeatureId = null;
      updateSidebarSelectedState();
    }

    function closeNativeSummary() {
      const toggle = nativeSummaryButton();
      if (!toggle) return;
      if (toggle.getAttribute("aria-expanded") === "true" || toggle.getAttribute("aria-pressed") === "true") {
        toggle.click();
      }
    }

    function restoreThreadContentShift() {
      for (const { element, shift, translate } of shiftedConversationOwners) {
        if (!element.isConnected) continue;
        if (shift.value) {
          element.style.setProperty(
            "--thread-wide-block-inline-shift",
            shift.value,
            shift.priority,
          );
        } else {
          element.style.removeProperty("--thread-wide-block-inline-shift");
        }
        if (translate.value) element.style.setProperty("translate", translate.value, translate.priority);
        else element.style.removeProperty("translate");
        element.removeAttribute("data-codex-personal-summary-shift");
      }
      shiftedConversationOwners = [];
    }

    function applyThreadContentShift(value) {
      if (value === 0) {
        restoreThreadContentShift();
        return;
      }
      const viewport = mainContentViewport();
      const owners = viewport
        ? Array.from(viewport.querySelectorAll('[style*="--thread-wide-block-inline-shift"]'))
        : [];
      if (!owners.length) {
        restoreThreadContentShift();
        return;
      }
      if (
        shiftedConversationOwners.length !== owners.length
        || owners.some((owner, index) => shiftedConversationOwners[index]?.element !== owner)
      ) {
        restoreThreadContentShift();
        shiftedConversationOwners = owners.map((owner) => ({
          element: owner,
          shift: {
            value: owner.style.getPropertyValue("--thread-wide-block-inline-shift"),
            priority: owner.style.getPropertyPriority("--thread-wide-block-inline-shift"),
          },
          translate: {
            value: owner.style.getPropertyValue("translate"),
            priority: owner.style.getPropertyPriority("translate"),
          },
        }));
      }
      for (const owner of owners) {
        owner.style.setProperty(
          "--thread-wide-block-inline-shift",
          `${Number(value)}px`,
          "important",
        );
        owner.style.setProperty("translate", `${Number(value)}px 0`, "important");
        owner.setAttribute("data-codex-personal-summary-shift", String(value));
      }
    }

    function setSummarySurfaceVisible(surface, visible, mode) {
      const wasVisible = surface.dataset.codexPersonalVisible === "true";
      const previousMode = surface.dataset.codexPersonalMode;
      const duration = reducedMotion() ? 0 : 300;
      surface.dataset.codexPersonalVisible = String(visible);
      surface.dataset.codexPersonalMode = mode;
      surface.style.transition = duration
        ? "opacity 180ms ease, transform 300ms cubic-bezier(.2,.8,.2,1)"
        : "none";
      if (!visible) {
        closePromptPreview({ immediate: true });
        surface.style.pointerEvents = "none";
        surface.style.opacity = "0";
        surface.style.transform = mode === "overlay"
          ? "translateY(-4px) scale(.98)"
          : "translateX(100%) scale(.8)";
        const transitionId = `${performance.now()}-${Math.random()}`;
        surface.dataset.codexPersonalTransition = transitionId;
        if (duration === 0) surface.hidden = true;
        else window.setTimeout(() => {
          if (
            surface.dataset.codexPersonalTransition === transitionId
            && surface.dataset.codexPersonalVisible !== "true"
          ) surface.hidden = true;
        }, duration);
        return;
      }

      surface.dataset.codexPersonalTransition = "visible";
      surface.hidden = false;
      surface.style.pointerEvents = "auto";
      if (!wasVisible || previousMode !== mode) {
        surface.style.opacity = "0";
        surface.style.transform = mode === "overlay"
          ? "translateY(-4px) scale(.98)"
          : "translateX(100%) scale(.8)";
        const reveal = () => {
          if (surface.dataset.codexPersonalVisible !== "true") return;
          surface.style.opacity = "1";
          surface.style.transform = "translate(0, 0) scale(1)";
        };
        requestAnimationFrame(reveal);
        window.setTimeout(reveal, 50);
        if (duration) window.setTimeout(() => {
          if (surface.dataset.codexPersonalVisible !== "true") return;
          surface.style.transition = "none";
          surface.style.opacity = "1";
          surface.style.transform = "translate(0, 0) scale(1)";
        }, duration + 50);
      } else {
        surface.style.opacity = "1";
        surface.style.transform = "translate(0, 0) scale(1)";
      }
    }

    function updatePinnedPosition(featureId) {
      const surface = pinnedSurfaces.get(featureId);
      const entry = findEntry(featureId);
      const feature = featureById.get(featureId);
      if (!surface || !entry || !feature) return;
      const layout = config.summaryLayout;
      const displayMode = summaryDisplayMode();
      const visibleSurface = visibleSummarySurface(featureId, displayMode);
      if (!visibleSurface) {
        setSummarySurfaceVisible(surface, false, displayMode);
        if (activePinnedFeatureId === featureId) applyThreadContentShift(0);
        return;
      }

      const target = mainContentTargetGeometry();
      const entryRect = entry.getBoundingClientRect();
      const scrollRect = mainContentViewport()?.querySelector(".thread-scroll-container")
        ?.getBoundingClientRect();
      // The native conversation header is a fixed overlay that starts above the
      // thread scroll container (scroll top is often 0 while the header still
      // occupies the top toolbar strip). Anchor below the header so the pinned
      // surface never covers the toolbar entry used to close it again.
      const header = entry.closest("header");
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const contentTop = Math.max(scrollRect?.top ?? 0, headerBottom);
      const top = displayMode === "overlay"
        ? entryRect.bottom + layout.popoverOffset
        : (contentTop || 46) + layout.verticalInset;
      const right = displayMode === "overlay"
        ? Math.max(layout.popoverOffset, innerWidth - entryRect.right)
        : Math.max(layout.panelInset, innerWidth - target.right + layout.panelInset);
      const bottomInset = displayMode === "overlay"
        ? layout.popoverBottomInset
        : layout.verticalInset;
      const available = Math.max(120, innerHeight - top - bottomInset);
      const record = surfaceRecords.get(surfaceKey(featureId, "pinned"));
      const height = Math.min(record?.preferredHeight ?? 620, available);
      Object.assign(surface.style, {
        top: `${top}px`,
        right: `${right}px`,
        width: `${layout.panelWidth}px`,
        height: `${height}px`,
        maxHeight: `${available}px`,
      });
      surface.setAttribute("data-codex-personal-summary-presentation", displayMode);
      setSummarySurfaceVisible(surface, true, displayMode);

      const shift = displayMode !== "overlay"
        ? -(layout.panelWidth + layout.panelInset) / 2
        : 0;
      applyThreadContentShift(shift);
    }

    function createPinnedSurface(feature) {
      const definition = feature.pinnedSummary;
      const surface = document.createElement("section");
      surface.setAttribute(pinnedSurfaceMarker, feature.id);
      surface.setAttribute("role", "dialog");
      surface.setAttribute("aria-label", definition.label ?? feature.label);
      surface.hidden = true;
      featureUI.page(surface, { transparent:true });
      surface.style.cssText = [
        "overflow:hidden",
        "border-radius:25px",
        "corner-shape:var(--codex-corner-shape,superellipse(1.5))",
        "background:var(--color-token-dropdown-background,var(--color-token-main-surface-primary))",
        "box-shadow:var(--elevation-prominent,0 0 0 .5px rgba(13,13,13,.11),0 3px 7.5px rgba(0,0,0,.04),0 0 20px rgba(0,0,0,.05))",
        "transform-origin:top right",
        "opacity:0",
        "pointer-events:none",
        "will-change:transform,opacity",
      ].join(";");
      const frame = createFrame(feature.id, definition.label ?? feature.label);
      surface.append(frame);
      document.body.append(surface);
      pinnedSurfaces.set(feature.id, surface);
      registerSurface(
        surfaceKey(feature.id, "pinned"),
        feature,
        "pinned",
        definition.surfaceUrl,
        surface,
        frame,
      );
      return surface;
    }

    function closePromptPreview({ immediate = false } = {}) {
      clearTimeout(promptPreviewDismissTimer);
      promptPreviewDismissTimer = null;
      const current = activePromptPreview;
      if (!current) return false;
      activePromptPreview = null;
      const remove = () => current.element.remove();
      if (immediate || reducedMotion()) remove();
      else {
        current.element.style.pointerEvents = "none";
        current.element.style.opacity = "0";
        window.setTimeout(remove, 80);
      }
      return true;
    }

    function requestPromptPreviewClose(record) {
      if (!activePromptPreview || activePromptPreview.recordKey !== record.key) return false;
      clearTimeout(promptPreviewDismissTimer);
      promptPreviewDismissTimer = window.setTimeout(() => {
        if (!activePromptPreview || activePromptPreview.recordKey !== record.key) return;
        if (activePromptPreview.element.matches(":hover")) return;
        closePromptPreview();
      }, 120);
      return true;
    }

    function showPromptPreview(record, payload = {}) {
      if (record.kind !== "pinned" || record.element.hidden) return false;
      const body = String(payload.prompt?.body ?? "");
      if (!body.trim()) return false;
      const title = String(payload.prompt?.title ?? "").trim();
      const surfaceLeft = record.element.offsetLeft;
      const surfaceTop = record.element.offsetTop;
      const anchorTop = Number(payload.anchor?.top);
      if (!Number.isFinite(anchorTop) || record.element.offsetWidth <= 0 || record.element.offsetHeight <= 0) return false;

      closePromptPreview({ immediate: true });
      const preview = document.createElement("aside");
      preview.setAttribute(promptPreviewMarker, record.featureId);
      preview.setAttribute("role", "tooltip");
      preview.setAttribute("aria-label", locale === "zh-CN" ? "提示词预览" : "Prompt preview");
      if (payload.prompt?.id) preview.setAttribute("data-codex-personal-prompt-id", String(payload.prompt.id));
      preview.style.cssText = [
        "position:fixed",
        "z-index:41",
        "box-sizing:border-box",
        "display:flex",
        "flex-direction:column",
        "gap:8px",
        "max-height:min(420px,calc(100vh - 24px))",
        "overflow:hidden",
        "padding:14px 16px 15px",
        "border:.5px solid var(--color-token-border,var(--color-border,rgba(13,13,13,.11)))",
        "border-radius:16px",
        "corner-shape:var(--codex-corner-shape,superellipse(1.5))",
        "color:var(--color-token-foreground,var(--color-text-foreground,#0d0d0d))",
        "background:var(--color-token-dropdown-background,var(--color-token-main-surface-primary,#fff))",
        "box-shadow:var(--elevation-prominent,0 0 0 .5px rgba(13,13,13,.08),0 8px 24px rgba(0,0,0,.10))",
        "font-family:var(--font-sans-default,ui-sans-serif,system-ui,sans-serif)",
        "pointer-events:auto",
        "transition:opacity 80ms ease",
      ].join(";");

      if (title) {
        const heading = document.createElement("strong");
        heading.textContent = title.slice(0, 500);
        heading.style.cssText = [
          "display:-webkit-box",
          "overflow:hidden",
          "-webkit-box-orient:vertical",
          "-webkit-line-clamp:2",
          "font-size:15px",
          "font-weight:550",
          "line-height:21px",
          "overflow-wrap:anywhere",
        ].join(";");
        preview.append(heading);
      }
      const content = document.createElement("div");
      content.textContent = body;
      content.style.cssText = [
        "min-height:0",
        "overflow:auto",
        "padding-right:2px",
        "white-space:pre-wrap",
        "overflow-wrap:anywhere",
        "font-size:14px",
        "font-weight:400",
        "line-height:20px",
      ].join(";");
      preview.append(content);

      const inset = 8;
      const gap = 10;
      const availableLeft = Math.max(160, surfaceLeft - gap - inset);
      const width = Math.min(360, availableLeft);
      preview.style.width = `${width}px`;
      document.body.append(preview);
      const previewRect = preview.getBoundingClientRect();
      const left = Math.max(inset, surfaceLeft - gap - width);
      const desiredTop = surfaceTop + anchorTop - 8;
      const top = Math.min(
        Math.max(12, desiredTop),
        Math.max(12, innerHeight - previewRect.height - 12),
      );
      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
      activePromptPreview = { element: preview, recordKey: record.key };

      preview.addEventListener("pointerenter", () => {
        clearTimeout(promptPreviewDismissTimer);
        promptPreviewDismissTimer = null;
      }, { signal: lifetime.signal });
      preview.addEventListener("pointerleave", () => closePromptPreview(), { signal: lifetime.signal });
      return true;
    }

    function closeModalSurface() {
      if (!activeModalRecordKey) return false;
      const record = surfaceRecords.get(activeModalRecordKey);
      record?.overlay?.remove();
      record?.element?.remove();
      if (record) removeSurfaceRecord(record.key);
      activeModalRecordKey = null;
      return true;
    }

    function openEditorModal(sourceRecord, payload = {}) {
      const feature = featureById.get(sourceRecord.featureId);
      const kind = payload.kind === "todo"
        ? "todo"
        : new Set(["prompt", "note"]).has(payload.kind)
          ? "prompt"
          : null;
      if (!feature || !kind) throw new Error("Editor kind must be prompt or todo");

      closePromptPreview({ immediate: true });
      closeModalSurface();
      const editorUrl = new URL(sourceRecord.surfaceUrl);
      editorUrl.searchParams.set("surface", "editor");
      editorUrl.searchParams.set("kind", kind);
      if (typeof payload.id === "string" && payload.id) editorUrl.searchParams.set("id", payload.id);
      else editorUrl.searchParams.delete("id");

      const overlay = document.createElement("div");
      overlay.setAttribute("data-codex-personal-modal-overlay", feature.id);
      featureUI.overlay(overlay);
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:50",
      ].join(";");

      const dialog = document.createElement("section");
      dialog.setAttribute(modalSurfaceMarker, feature.id);
      featureUI.surface(dialog, "dialog");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", `${payload.id ? "Edit" : "Add"} ${kind}`);
      dialog.setAttribute("tabindex", "-1");
      dialog.style.cssText = [
        "position:fixed",
        "left:50%",
        "top:50%",
        "z-index:51",
        "width:min(420px,92vw)",
        `height:${kind === "prompt" ? "250px" : "198px"}`,
        "max-height:88vh",
        "transform:translate(-50%,-50%)",
        "overflow:hidden",
        "padding:0",
        "outline:none",
      ].join(";");

      const frame = createFrame(feature.id, `${payload.id ? "Edit" : "Add"} ${kind}`);
      dialog.append(frame);
      document.body.append(overlay, dialog);
      const key = surfaceKey(feature.id, "modal");
      const record = registerSurface(key, feature, "modal", editorUrl.href, dialog, frame);
      record.overlay = overlay;
      activeModalRecordKey = key;
      overlay.addEventListener("click", closeModalSurface, { signal: lifetime.signal });
      queueTheme();
      return { opened: true };
    }

    function showPinnedSurface(featureId) {
      const feature = featureById.get(featureId);
      if (!feature?.pinnedSummary) return;
      hidePageSurfaces();
      closeNativeSummary();
      for (const [id, state] of summaryStates) {
        if (id === featureId) continue;
        state.isPinned = false;
        state.isPopoverOpen = false;
        const other = pinnedSurfaces.get(id);
        if (other) setSummarySurfaceVisible(other, false, summaryDisplayMode());
      }
      const existing = pinnedSurfaces.get(featureId);
      const surface = existing ?? createPinnedSurface(feature);
      if (existing) {
        reloadSurfaceIfUnready(
          surfaceKey(feature.id, "pinned"),
          feature.pinnedSummary.surfaceUrl,
        );
      }
      const displayMode = summaryDisplayMode();
      const state = summaryState(featureId);
      if (displayMode === "overlay") state.isPopoverOpen = true;
      else state.isPinned = true;
      activePinnedFeatureId = featureId;
      updateToolbarState();
      updatePinnedPosition(featureId);
      queueTheme();
    }

    function hidePinnedSurfaces() {
      const displayMode = summaryDisplayMode();
      for (const [featureId, state] of summaryStates) {
        state.isPinned = false;
        state.isPopoverOpen = false;
        const surface = pinnedSurfaces.get(featureId);
        if (surface) setSummarySurfaceVisible(surface, false, displayMode);
      }
      activePinnedFeatureId = null;
      restoreThreadContentShift();
      updateToolbarState();
    }

    function togglePinnedSurface(featureId) {
      const feature = featureById.get(featureId);
      if (!feature?.pinnedSummary) return;
      const displayMode = summaryDisplayMode();
      const state = summaryState(featureId);
      const isOpen = visibleSummarySurface(featureId, displayMode) !== null;
      if (!isOpen) {
        showPinnedSurface(featureId);
        return;
      }
      if (displayMode === "overlay") state.isPopoverOpen = false;
      else state.isPinned = false;
      if (!state.isPinned && !state.isPopoverOpen) activePinnedFeatureId = null;
      updatePinnedPosition(featureId);
      if (!activePinnedFeatureId) restoreThreadContentShift();
      updateToolbarState();
    }

    function updateResponsiveSummaryPresentation() {
      const nextMode = summaryDisplayMode();
      if (currentSummaryDisplayMode === "overlay" && nextMode !== "overlay") {
        for (const state of summaryStates.values()) state.isPopoverOpen = false;
      }
      currentSummaryDisplayMode = nextMode;
      for (const feature of toolbarFeatures) updatePinnedPosition(feature.id);
      if (!toolbarFeatures.some((feature) => (
        visibleSummarySurface(feature.id, nextMode) === "inline"
      ))) applyThreadContentShift(0);
      updateToolbarState();
    }

    function ensureMainContentObserver() {
      const viewport = mainContentViewport();
      if (!viewport || mainContentObserver?.target === viewport) return;
      mainContentObserver?.observer.disconnect();
      const observer = new ResizeObserver(() => updateResponsiveSummaryPresentation());
      observer.observe(viewport);
      mainContentObserver = { target: viewport, observer };
    }

    // ========================================================================
    // 原生 Detail Tab capability — React fiber/右侧面板探测、原生详情页签打开与线程跳转
    // ========================================================================


    function reactFiberFor(element) {
      if (!(element instanceof Element)) return null;
      const key = Object.getOwnPropertyNames(element).find((name) => (
        name.startsWith("__reactFiber$")
        || name.startsWith("__reactInternalInstance$")
      ));
      return key ? element[key] : null;
    }

    function currentRightPanelScope() {
      let anchor = document.querySelector('[data-app-shell-tabs="true"]');
      let anchorFiber = reactFiberFor(anchor);
      if (!anchorFiber) {
        for (const element of document.querySelectorAll("body *")) {
          const fiber = reactFiberFor(element);
          if (!fiber) continue;
          anchor = element;
          anchorFiber = fiber;
          break;
        }
      }
      if (!anchorFiber) return null;

      let rootFiber = anchorFiber;
      while (rootFiber.return) rootFiber = rootFiber.return;

      const isRightPanelScope = (value) => (
        value
        && typeof value === "object"
        && typeof value.get === "function"
        && typeof value.set === "function"
        && rightPanelRouteKinds.has(value.value?.routeKind)
        && typeof value.query?.getOrFetch === "function"
      );
      const inspected = new Set();
      const inspect = (value) => {
        if (
          value == null
          || (typeof value !== "object" && typeof value !== "function")
          || inspected.has(value)
        ) return null;
        inspected.add(value);
        if (isRightPanelScope(value)) return value;
        if (isRightPanelScope(value.current)) return value.current;
        return null;
      };

      const stack = [rootFiber];
      let visitedFibers = 0;
      while (stack.length > 0 && visitedFibers < 50_000) {
        const fiber = stack.pop();
        visitedFibers += 1;
        let scope = inspect(fiber.memoizedProps);
        if (!scope && fiber.memoizedProps && typeof fiber.memoizedProps === "object") {
          for (const value of Object.values(fiber.memoizedProps)) {
            scope = inspect(value);
            if (scope) break;
          }
        }

        let hook = fiber.memoizedState;
        let hookIndex = 0;
        while (!scope && hook && typeof hook === "object" && hookIndex < 140) {
          scope = inspect(hook.memoizedState);
          if (!scope && hook.memoizedState && typeof hook.memoizedState === "object") {
            scope = inspect(hook.memoizedState.current);
          }
          hook = hook.next;
          hookIndex += 1;
        }
        if (scope) return scope;
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
      return null;
    }

    async function waitForCurrentRightPanelScope() {
      const deadline = performance.now() + 2_000;
      do {
        const scope = currentRightPanelScope();
        if (scope) return scope;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } while (performance.now() < deadline);
      return null;
    }

    async function waitForNativeTabModuleUrl() {
      return findCodexModule('app-initial',{signal:lifetime.signal,waitForEntry:true});
    }

    async function loadNativeTabCapability() {
      if (nativeTabCapability) return nativeTabCapability;
      if (nativeTabCapabilityPromise) return nativeTabCapabilityPromise;
      nativeTabCapabilityPromise = (async () => {
        try {
          const moduleUrl = await waitForNativeTabModuleUrl();
          if (!moduleUrl) throw new Error("Codex app-initial module was not found");
          const appModule = await import(moduleUrl);
          const controller = Object.values(appModule).find((value) => (
            value
            && typeof value === "object"
            && typeof value.openTab === "function"
            && typeof value.closeTab === "function"
            && typeof value.activateTab === "function"
            && value.panelId === "right"
          ));
          if (!controller) throw new Error("Codex right-panel controller is unavailable");
          if (!controller?.tabById$) throw new Error("Codex native tab capability is incomplete");
          nativeTabCapability = {
            controller,
            moduleAsset: moduleUrl.split("/").pop(),
          };
          nativeTabCapabilityError = null;
          return nativeTabCapability;
        } catch (error) {
          nativeTabCapabilityError = error;
          return null;
        }
      })();
      const capability = await nativeTabCapabilityPromise;
      if (!capability) nativeTabCapabilityPromise = null;
      return capability;
    }

    function nativeReactElement(type, props) {
      return {
        $$typeof: Symbol.for("react.transitional.element"),
        type,
        key: null,
        ref: null,
        props: props ?? {},
      };
    }

    function nativeDetailIcon(feature, detail) {
      const icon = detail.icon ?? feature.icon;
      if (!icon?.markup) return undefined;
      return nativeReactElement("svg", {
        width: 16,
        height: 16,
        viewBox: icon.viewBox ?? "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        className: "icon-xs shrink-0",
        dangerouslySetInnerHTML: { __html: icon.markup },
      });
    }

    function nativeDetailComponent(feature, detail) {
      const detailKey = `${feature.id}:${detail.id}`;
      let Component = nativeDetailComponents.get(detailKey);
      if (Component) return Component;
      const frameName = surfaceFrameName(feature.id);
      Component = function CodexPersonalDetailTab() {
        return nativeReactElement("div", {
          "data-codex-personal-native-detail": detailKey,
          style: {
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
            background: "var(--color-token-main-surface-primary)",
          },
          children: nativeReactElement("iframe", {
            name: frameName,
            src: "about:blank",
            title: detail.label,
            allow: "clipboard-write",
            style: {
              display: "block",
              width: "100%",
              height: "100%",
              border: 0,
              background: "transparent",
            },
          }),
        });
      };
      nativeDetailComponents.set(detailKey, Component);
      return Component;
    }

    function reloadNativeDetailIfUnready(feature, detail) {
      const keys = nativeDetailSurfaceKeys.get(`${feature.id}:${detail.id}`);
      if (!keys) return false;
      let reloaded = false;
      for (const key of keys) {
        if (reloadSurfaceIfUnready(key, detail.surfaceUrl)) reloaded = true;
      }
      return reloaded;
    }

    async function waitForNativeDetailTabElement(detailKey) {
      const deadline = performance.now() + 2_000;
      do {
        const element = document.querySelector(
          `[data-codex-personal-native-detail="${detailKey}"]`,
        );
        const frame = element?.querySelector("iframe");
        if (element && frame) return { element, frame };
        await new Promise((resolve) => setTimeout(resolve, 25));
      } while (performance.now() < deadline);
      return null;
    }

    async function openNativeDetailTab(feature, detail) {
      const capability = await loadNativeTabCapability();
      if (!capability) return null;
      const scope = await waitForCurrentRightPanelScope();
      if (!scope) {
        nativeTabCapabilityError = new Error("The current Codex right-panel scope was not found");
        return null;
      }

      const { controller } = capability;
      const tabId = `${feature.id}-${detail.id}`;
      const detailKey = `${feature.id}:${detail.id}`;
      let session = Array.from(nativeOpenTabSessions).find((candidate) => (
        candidate.scope === scope && candidate.tabId === tabId
      ));
      let focusedExisting = Boolean(session);
      if (!focusedExisting && controller.tabById$) {
        try {
          focusedExisting = scope.get(controller.tabById$, tabId) != null;
        } catch {}
      }
      const isNewSession = !session;
      if (!session) {
        session = { scope, controller, tabId };
        nativeOpenTabSessions.add(session);
      }

      try {
        // 原生 openTab 接收标签描述对象，并在挂载前检查可用性。
        controller.openTab(scope, {
          Component: nativeDetailComponent(feature, detail),
          kind: tabId,
          dropDestinations: ["right"],
          isAvailable: () => true,
        }, {
          id: tabId,
          kind: tabId,
          title: detail.label,
          tooltip: detail.label,
          icon: nativeDetailIcon(feature, detail),
          isClosable: true,
          props: {},
          onClose: () => {
            nativeOpenTabSessions.delete(session);
            const closedKeys = nativeDetailSurfaceKeys.get(detailKey);
            if (closedKeys) {
              for (const key of closedKeys) removeSurfaceRecord(key);
              nativeDetailSurfaceKeys.delete(detailKey);
            }
          },
        });
      } catch (error) {
        if (isNewSession) nativeOpenTabSessions.delete(session);
        nativeTabCapabilityError = error;
        return null;
      }

      if (!nativeDetailSurfaceKeys.has(detailKey)) {
        const mounted = await waitForNativeDetailTabElement(detailKey);
        if (!mounted) {
          if (isNewSession) nativeOpenTabSessions.delete(session);
          if (!focusedExisting) {
            try {
              controller.closeTab(scope, tabId);
            } catch {}
          }
          nativeTabCapabilityError = new Error("Codex native right-panel Tab did not mount");
          return null;
        }
        const instanceId = crypto.randomUUID?.()
          ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const recordKey = surfaceKey(feature.id, "native-detail", `${detail.id}:${instanceId}`);
        registerSurface(recordKey, feature, "detail", detail.surfaceUrl, mounted.element, mounted.frame, detail.id);
        let keys = nativeDetailSurfaceKeys.get(detailKey);
        if (!keys) {
          keys = new Set();
          nativeDetailSurfaceKeys.set(detailKey, keys);
        }
        keys.add(recordKey);
        queueTheme();
      }

      nativeTabCapabilityError = null;
      if (focusedExisting) reloadNativeDetailIfUnready(feature, detail);
      return { tabId, focusedExisting, presentation: "native" };
    }

    function detailTabCapability() {
      return {
        presentation: nativeTabCapability ? "native" : "unavailable",
        moduleAsset: nativeTabCapability?.moduleAsset ?? null,
        error: nativeTabCapabilityError?.message ?? null,
        openNativeTabs: nativeOpenTabSessions.size,
      };
    }

    function closeNativeDetailTabs() {
      for (const keys of Array.from(nativeDetailSurfaceKeys.values())) {
        for (const key of keys) removeSurfaceRecord(key);
      }
      for (const session of Array.from(nativeOpenTabSessions)) {
        try {
          session.controller.closeTab(session.scope, session.tabId);
        } catch {}
      }
      nativeOpenTabSessions.clear();
      nativeDetailComponents.clear();
      nativeDetailSurfaceKeys.clear();
    }

    async function openDetailTab(featureId, detailId) {
      const feature = featureById.get(featureId);
      const detail = feature?.detailTabs?.find((candidate) => candidate.id === detailId);
      if (!feature || !detail) throw new Error("The requested detail Tab is not registered");
      const result = await openNativeDetailTab(feature, detail);
      if (!result) {
        const error = nativeTabCapabilityError
          ?? new Error("Codex native right-panel tabs are unavailable");
        error.code = "NATIVE_TAB_UNAVAILABLE";
        throw error;
      }
      return result;
    }

    function openThread(threadId) {
      const nativeThread = Array.from(
        document.querySelectorAll("[data-app-action-sidebar-thread-id]"),
      ).find((element) => {
        const nativeId = element.getAttribute("data-app-action-sidebar-thread-id");
        return nativeId === threadId || nativeId?.endsWith(`:${threadId}`);
      });

      hidePageSurfaces();
      hidePinnedSurfaces();
      if (nativeThread) {
        nativeThread.click();
        nativeThread.focus({ preventScroll: false });
        return;
      }

      const link = document.createElement("a");
      link.href = `codex://threads/${threadId}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
    }

    // ========================================================================
    // Sidebar/Toolbar 入口与 ensure 调度 — 入口克隆注入、ensure 批处理调度
    // ========================================================================

    function createSidebarEntry(feature, reference) {
      const entry = reference.cloneNode(true);
      entry.setAttribute(entryMarker, feature.id);
      entry.removeAttribute("href");
      entry.removeAttribute("aria-current");
      entry.querySelectorAll("[data-state]").forEach((node) => node.removeAttribute("data-state"));
      const originalIcon = entry.querySelector("svg");
      const featureIcon = createFeatureIcon(feature, originalIcon?.getAttribute("class"));
      if (originalIcon && featureIcon) originalIcon.replaceWith(featureIcon);

      const referenceLabels = nativeLabels.plugins;
      const textLeaf = Array.from(entry.querySelectorAll("*")).find((node) => (
        node.children.length === 0
        && referenceLabels.includes(node.textContent?.trim().toLowerCase())
      ));
      if (textLeaf) textLeaf.textContent = feature.label;
      else entry.setAttribute("aria-label", feature.label);

      entry.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showPageSurface(feature.id);
      });
      return entry;
    }

    function createToolbarEntry(feature, nativeButton) {
      const nativeRoot = toolbarControlRoot(nativeButton);
      const root = nativeRoot.cloneNode(true);
      root.setAttribute("data-codex-personal-toolbar-entry", feature.id);
      root.classList.remove("ms-auto");
      root.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      root.querySelectorAll("[aria-describedby]").forEach((node) => node.removeAttribute("aria-describedby"));
      const button = root.matches("button") ? root : root.querySelector("button");
      if (!button) return null;
      const label = summaryButtonLabel(feature);
      button.setAttribute(entryMarker, feature.id);
      button.removeAttribute("title");
      button.removeAttribute("aria-describedby");
      button.setAttribute("aria-label", label);
      button.setAttribute("data-minecodex-tooltip", label);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("data-state", "closed");
      button.removeAttribute("disabled");
      button.classList.remove(
        "text-token-foreground",
        "bg-token-foreground/5",
        "bg-token-foreground/10",
        "enabled:hover:bg-token-foreground/10",
        "data-[state=open]:bg-token-foreground/10",
        "bg-token-list-hover-background",
      );
      button.classList.add(
        "text-token-text-tertiary",
        "enabled:hover:bg-token-list-hover-background",
        "data-[state=open]:bg-token-list-hover-background",
      );
      const originalIcon = button.querySelector("svg");
      const featureIcon = createFeatureIcon(feature, originalIcon?.getAttribute("class"), 16);
      if (originalIcon && featureIcon) originalIcon.replaceWith(featureIcon);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePinnedSurface(feature.id);
      });
      return button;
    }

    function ensureSidebarEntries() {
      if (!sidebarFeatures.length) return;
      const reference = findReferenceEntry();
      if (!reference) return;
      for (const feature of sidebarFeatures) {
        if (!findEntry(feature.id)) reference.after(createSidebarEntry(feature, reference));
      }
      const cursors = new Map();
      for (const feature of sidebarFeatures) {
        const anchorKey = feature.placement?.after ?? "sites";
        const anchor = cursors.get(anchorKey) ?? findNativeEntry(anchorKey) ?? reference;
        const entry = findEntry(feature.id);
        if (anchor && entry && anchor.nextElementSibling !== entry) anchor.after(entry);
        if (entry) cursors.set(anchorKey, entry);
      }
    }

    function ensureToolbarEntries() {
      if (!toolbarFeatures.length) {
        stopToolbarReadiness();
        return;
      }
      const temporaryChatButton = nativeTemporaryChatButton();
      const summaryButton = nativeSummaryButton();
      const bottomPanelButton = nativeBottomPanelButton();
      const sidePanelButton = nativeSidePanelButton();
      const anchorButton = temporaryChatButton ?? summaryButton ?? bottomPanelButton ?? sidePanelButton;
      if (!anchorButton) {
        const candidate = structuralToolbarAnchor();
        if (candidate) ensureToolbarReadiness(candidate);
        return;
      }
      const anchorRoot = toolbarControlRoot(anchorButton);
      // The bottom/side-panel toggles sit in narrow fixed containers that
      // travel with the native panels. Entries anchored to them must live in
      // the fallback toolbar group, otherwise the Notes entry would be
      // dragged into the panel or push the native toggle out of the header.
      // The Notes entry is only grouped with the native summary button when
      // that button is the anchor.
      const useFallbackAnchor = anchorButton === sidePanelButton || anchorButton === bottomPanelButton;
      const summaryGroup = useFallbackAnchor ? null : nativeSummaryToolbarGroup(anchorButton);
      let targetGroup = summaryGroup ?? ensureFallbackSummaryToolbarGroup(anchorButton);
      if (!targetGroup) {
        ensureToolbarReadiness(anchorButton);
        return;
      }
      let cursor = useFallbackAnchor ? null : anchorRoot;
      for (const feature of toolbarFeatures) {
        const entries = Array.from(document.querySelectorAll(`[${entryMarker}="${feature.id}"]`));
        for (const duplicate of entries.slice(1)) {
          (duplicate.closest("[data-codex-personal-toolbar-entry]") ?? duplicate).remove();
        }
        const entry = entries[0]?.isConnected
          ? entries[0]
          : createToolbarEntry(feature, anchorButton);
        const entryRoot = entry?.closest("[data-codex-personal-toolbar-entry]") ?? entry;
        if (!entryRoot) continue;
        if (cursor) {
          if (cursor.nextElementSibling !== entryRoot) cursor.after(entryRoot);
        } else if (targetGroup.lastElementChild !== entryRoot) {
          targetGroup.append(entryRoot);
        }
        // Narrow native anchor containers (e.g. the Work-mode side-panel
        // button) can push the entry outside the header so it becomes
        // unreachable. Move it into the fallback toolbar group instead.
        if (summaryGroup && !toolbarEntryFitsHeader(entryRoot)) {
          const fallback = ensureFallbackSummaryToolbarGroup(anchorButton);
          if (fallback && fallback !== summaryGroup) {
            fallback.append(entryRoot);
            targetGroup = fallback;
            cursor = null;
          }
        }
        cursor = entryRoot;
      }
      if (summaryGroup) {
        document.querySelectorAll("[data-codex-personal-summary-toolbar-group]").forEach((group) => {
          const used = [...group.querySelectorAll(`[${entryMarker}]`)].some((entry) => entry.isConnected);
          if (!used) group.remove();
        });
      }
      if (toolbarFeatures.every((feature) => findEntry(feature.id)?.isConnected)) {
        stopToolbarReadiness();
      } else {
        ensureToolbarReadiness(anchorButton);
      }
    }

    function ensureEntries() {
      ensureQueued = false;
      ensureFrame = null;
      ensureTimer = null;
      ensureSidebarEntries();
      ensureToolbarEntries();
      modelSlider.ensure();
      checkThreadChange();
      updateSidebarSelectedState();
      updatePageSurfacePositions();
      ensureMainContentObserver();
      updateResponsiveSummaryPresentation();
      const nativeToggle = nativeSummaryButton();
      if (
        activePinnedFeatureId
        && (nativeToggle?.getAttribute("aria-expanded") === "true"
          || nativeToggle?.getAttribute("aria-pressed") === "true")
      ) {
        hidePinnedSurfaces();
      }
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
    // 消息与 host action 路由 — postMessage 路由、host action 分发与结果回送
    // ========================================================================

    function findMessageSurface(event) {
      for (const record of surfaceRecords.values()) {
        // 身份以 event.source（WindowProxy 不可伪造）为准；Windows 上
        // setDocumentContent 的 iframe 消息可能报告 null origin，
        // 因此用已注册 frame 的 WindowProxy 精确匹配来源。
        if (event.source === record.frame.contentWindow) return record;
      }
      return null;
    }

    function respondToSurface(record, requestId, { ok, result = null, error = null }) {
      record.frame.contentWindow?.postMessage({
        type: "codex-personal:host-result",
        feature: record.featureId,
        requestId,
        ok,
        result,
        error,
      }, "/");
    }

    function hostActionFailure(error) {
      return {
        code: typeof error?.code === "string" ? error.code : "HOST_ACTION_FAILED",
        message: error?.message ?? "Host action failed",
      };
    }

    async function handleSurfaceHostAction(record, message) {
      const feature = featureById.get(record.featureId);
      const { requestId, action, payload = {} } = message;
      if (typeof requestId !== "string" || !feature?.hostActions.has(action)) {
        respondToSurface(record, requestId, {
          ok: false,
          error: { code: "ACTION_NOT_ALLOWED", message: "This Host action is not registered" },
        });
        return;
      }
      try {
        if (action === "insert-text") {
          respondToSurface(record, requestId, { ok: true, result: insertComposerText(payload.text) });
          return;
        }
        if (action === "open-detail-tab") {
          respondToSurface(record, requestId, {
            ok: true,
            result: await openDetailTab(feature.id, payload.surface),
          });
          return;
        }
        if (action === "open-editor-modal") {
          respondToSurface(record, requestId, {
            ok: true,
            result: openEditorModal(record, payload),
          });
          return;
        }
        if (action === "open-sidebar") {
          const trigger = nativeSidebarTrigger();
          if (!trigger) throw new Error("The native sidebar control was not found");
          const state = sidebarState();
          if (!state.open) trigger.click();
          queueMicrotask(() => postSidebarState(record, { ...state, open: true }));
          respondToSurface(record, requestId, { ok: true, result: { opened: true } });
          return;
        }
        if (action === "resolve-file-paths") {
          const getPathForFile = window.electronBridge?.getPathForFile;
          if (typeof getPathForFile !== "function") {
            throw new Error("Codex did not expose its File path bridge");
          }
          const files = Array.isArray(payload.files) ? payload.files : [];
          if (!files.length || files.some((file) => !(file instanceof File))) {
            throw new Error("Real dropped File objects are required");
          }
          // Windows 盘符路径（C:\...）不以 / 开头，需同时接受 POSIX 与 Windows 形态。
          const paths = files.map((file) => getPathForFile(file)).filter((value) => (
            typeof value === "string" && (/^[/\\]/.test(value) || /^[a-zA-Z]:[/\\]/.test(value))
          ));
          if (!paths.length) throw new Error("Codex could not resolve the dropped file paths");
          respondToSurface(record, requestId, { ok: true, result: { paths } });
          return;
        }
        if (["attach-file", "create-image-edit-thread", "list-cloud-images", "import-cloud-image"].includes(action)) {
          if (typeof globalThis[config.bindingName] !== "function") {
            throw new Error("The native file bridge is unavailable");
          }
          pendingHostActions.set(requestId, { recordKey: record.key });
          globalThis[config.bindingName](JSON.stringify({
            token: config.bindingToken,
            featureId: feature.id,
            requestId,
            action,
            payload,
          }));
          return;
        }
        throw new Error("Unsupported Host action");
      } catch (error) {
        respondToSurface(record, requestId, {
          ok: false,
          error: hostActionFailure(error),
        });
      }
    }

    function requestPageHostAction(featureId, action, payload) {
      if (!featureById.get(featureId)?.hostActions.has(action)) return Promise.reject(new Error("Host action is not registered"));
      if (typeof globalThis[config.bindingName] !== "function") return Promise.reject(new Error("Host bridge is unavailable"));
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pendingHostActions.delete(requestId);
          reject(new Error("Host request timed out"));
        }, featureId === "minecodex" ? 30_000 : 10_000);
        pendingHostActions.set(requestId, { kind: "page-script", resolve, reject, timer });
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
      if (pending.kind === "page-script") {
        clearTimeout(pending.timer);
        if (response.ok) pending.resolve(response.result);
        else pending.reject(new Error(response.error?.message ?? "Host request failed"));
        return true;
      }
      const record = surfaceRecords.get(pending.recordKey);
      if (!record) return false;
      if (pending.kind === "surface-load") {
        record.loading = false;
        record.loadError = response.ok ? null : response.error;
        return response.ok;
      }
      respondToSurface(record, requestId, response);
      return true;
    }

    document.addEventListener("selectionchange", rememberComposerSelection, { signal: lifetime.signal });
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest?.('[data-app-shell-sidebar-trigger="true"]')) {
          syncAfterNativeSidebarToggle();
        }
        if (isNativeSummaryButton(event.target) && activePinnedFeatureId) hidePinnedSurfaces();
        if (activePinnedFeatureId && summaryDisplayMode() === "overlay") {
          const state = summaryState(activePinnedFeatureId);
          const surface = pinnedSurfaces.get(activePinnedFeatureId);
          const ownEntry = event.target.closest?.(`[${entryMarker}="${activePinnedFeatureId}"]`);
          const rightWorkspaceInteraction = event.target.closest?.(
            '[data-app-shell-tab-strip-controller="right"],'
              + '[data-app-shell-tab-panel-controller="right"]',
          );
          const promptPreviewInteraction = event.target.closest?.(`[${promptPreviewMarker}]`);
          if (
            state.isPopoverOpen
            && !surface?.contains(event.target)
            && !ownEntry
            && !rightWorkspaceInteraction
            && !promptPreviewInteraction
          ) {
            const featureId = activePinnedFeatureId;
            state.isPopoverOpen = false;
            if (!state.isPinned) activePinnedFeatureId = null;
            updatePinnedPosition(featureId);
            updateToolbarState();
          }
        }
        if (!activePageFeatureId) return;
        if (event.target.closest?.(`[${entryMarker}]`)) return;
        if (event.target.closest?.("[data-app-action-sidebar-scroll]")) hidePageSurfaces();
      },
      { capture: true, signal: lifetime.signal },
    );

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (closePromptPreview({ immediate: true })) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (closeModalSurface()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!activePinnedFeatureId || summaryDisplayMode() !== "overlay") return;
      const state = summaryState(activePinnedFeatureId);
      if (!state.isPopoverOpen) return;
      const featureId = activePinnedFeatureId;
      state.isPopoverOpen = false;
      if (!state.isPinned) activePinnedFeatureId = null;
      updatePinnedPosition(featureId);
      updateToolbarState();
    }, { capture: true, signal: lifetime.signal });

    window.addEventListener("message", (event) => {
      const record = findMessageSurface(event);
      if (!record || !event.data || typeof event.data !== "object") return;
      if (event.data.feature && event.data.feature !== record.featureId) return;
      if (event.data.type === "codex-personal:ready") {
        record.ready = true;
        queueTheme();
        postSidebarState(record);
        if (record.kind === "modal") {
          record.frame.focus();
          record.frame.contentWindow?.postMessage({
            type: "codex-personal:focus",
            feature: record.featureId,
          }, "/");
        }
      }
      if (event.data.type === "codex-personal:surface-metrics" && record.kind === "pinned") {
        const preferredHeight = Number(event.data.height);
        if (Number.isFinite(preferredHeight) && preferredHeight > 0) {
          record.preferredHeight = Math.min(2_000, Math.max(80, Math.ceil(preferredHeight)));
          updatePinnedPosition(record.featureId);
        }
      }
      if (event.data.type === "codex-personal:prompt-preview" && record.kind === "pinned") {
        if (event.data.phase === "show") showPromptPreview(record, event.data);
        if (event.data.phase === "hide") requestPromptPreviewClose(record);
      }
      if (event.data.type === "codex-personal:close") {
        if (record.kind === "pinned") hidePinnedSurfaces();
        if (record.kind === "page") hidePageSurfaces();
        if (record.kind === "modal") closeModalSurface();
      }
      if (event.data.type === "codex-personal:open-thread" && event.data.threadId) {
        openThread(event.data.threadId);
      }
      if (event.data.type === "codex-personal:host-action") {
        handleSurfaceHostAction(record, event.data);
      }
    }, { signal: lifetime.signal });

    window.addEventListener("resize", () => {
      closePromptPreview({ immediate: true });
      updatePageSurfacePositions();
      updateResponsiveSummaryPresentation();
    }, { signal: lifetime.signal });
    const ensureObserver = new MutationObserver((mutations) => {
      queueEnsure();
      const sidebarTriggerChanged = mutations.some((mutation) => {
        if (
          mutation.type === "attributes"
          && mutation.target.matches?.('[data-app-shell-sidebar-trigger="true"]')
        ) return true;
        return mutation.type === "childList"
          && [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
            node instanceof Element
            && (
              node.matches?.('[data-app-shell-sidebar-trigger="true"]')
              || node.querySelector?.('[data-app-shell-sidebar-trigger="true"]')
            )
          ));
      });
      if (sidebarTriggerChanged) updatePageSurfacePositions();
    });
    ensureObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-expanded",
        "aria-pressed",
        "data-state",
        "data-app-action-sidebar-thread-selected",
        "data-app-action-sidebar-thread-id",
      ],
    });
    domObservers.push(ensureObserver);
    const themeObserver = new MutationObserver(queueTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    domObservers.push(themeObserver);

    // ========================================================================
    // 运行时 API 与清理 — 对外 runtimeApi、dispose 与全局事件观察器
    // ========================================================================

    const runtimeApi = {
      version: config.version,
      sessionId: config.sessionId,
      updateHostBinding,
      nativeCapabilities: () => codex.diagnostics(),
      selfCheck: () => ({...selfCheck.snapshot(),capabilities:codex.diagnostics()}),
      ensure: queueEnsure,
      show: showPageSurface,
      hide: () => {
        hidePageSurfaces();
        hidePinnedSurfaces();
        closeModalSurface();
      },
      showPinned: showPinnedSurface,
      hidePinned: hidePinnedSurfaces,
      openDetailTab,
      detailTabCapability,
      insertText: insertComposerText,
      resolveHostAction,
      dispose: () => {
        lifetime.abort();
        for (const [id, pending] of pendingHostActions) {
          if (pending.kind !== "page-script") continue;
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
        stopToolbarReadiness();
        mainContentObserver?.observer.disconnect();
        restoreThreadContentShift();
        for (const entry of document.querySelectorAll(`[${entryMarker}]`)) entry.remove();
        for (const root of document.querySelectorAll("[data-codex-personal-toolbar-entry]")) root.remove();
        for (const group of document.querySelectorAll("[data-codex-personal-summary-toolbar-group]")) group.remove();
        for (const surface of pageSurfaces.values()) surface.remove();
        for (const surface of pinnedSurfaces.values()) surface.remove();
        closePromptPreview({ immediate: true });
        closeModalSurface();
        closeNativeDetailTabs();
        modelSlider.dispose();
        surfaceRecords.clear();
        featureUI.theme.dispose();
        if (window.__codexPersonalRuntime === runtimeApi) delete window.__codexPersonalRuntime;
      },
    };
    window.__codexPersonalRuntime = runtimeApi;
    currentThread = threadIdentity();
    currentSummaryDisplayMode = summaryDisplayMode();
    queueEnsure();
  }

  const runtimeFeatures = features.map((feature) => ({
    requiredTokens:tokenRequirements(`${feature.pageScript?.source ?? ""} ${Object.values(feature.pageScript?.resources ?? {}).filter(value => typeof value === "string").join(" ")} ${feature.modelSelector ? createModelSliderInstallerSource() : ""}`,MINECODEX_THEME_BINDINGS),
    id: feature.id,
    label: feature.label,
    labels: feature.labels ?? null,
    surfaceUrl: feature.surfaceUrl,
    icon: feature.icon,
    placement: feature.placement,
    entry: feature.entry ?? { kind: "sidebar" },
    pinnedSummary: feature.pinnedSummary ?? null,
    detailTabs: feature.detailTabs ?? [],
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
    summaryLayout: RESPONSIVE_SUMMARY_LAYOUT,
    rightPanelRouteKinds: RIGHT_PANEL_ROUTE_KINDS,
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
