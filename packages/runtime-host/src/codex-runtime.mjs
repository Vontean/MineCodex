import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const RUNTIME_VERSION = 99;
const HOST_BINDING_NAME = "__codexPersonalHostAction";
const CSP_BOOTSTRAP_VERSION = 1;
const CSP_BOOTSTRAP_KEY = "__mineCodexCspBootstrapVersion";
const CODEX_APP_ORIGIN = "app://-";
const SURFACE_LOAD_ACTION = "load-surface";
const SURFACE_FRAME_PREFIX = "minecodex-surface-";
const LOOPBACK_SURFACE_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const RIGHT_PANEL_ROUTE_KINDS = Object.freeze(["home", "local-thread"]);

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
  return displayMode === "shift" && isPinned
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

function requireDeclaredLoopbackSurface(feature, value) {
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

function findFrameByName(frameTree, frameName) {
  if (frameTree.frame?.name === frameName) return frameTree.frame;
  for (const child of frameTree.childFrames ?? []) {
    const match = findFrameByName(child, frameName);
    if (match) return match;
  }
  return null;
}

function documentWithBase(html, surfaceUrl) {
  const head = /<head(?:\s[^>]*)?>/i;
  if (!head.test(html)) {
    throw Object.assign(new Error("Surface document has no head element"), {
      code: "SURFACE_DOCUMENT_INVALID",
    });
  }
  return html.replace(head, (match) => `${match}<base href=${JSON.stringify(surfaceUrl)}>`);
}

export function createInjectionSource(features, {
  bindingName = HOST_BINDING_NAME,
  bindingToken = "test-binding-token",
  runtimeSessionId = randomBytes(16).toString("hex"),
} = {}) {
  function install(config) {
    if (window.top !== window) return;
    if (!document.documentElement) {
      // The document bootstrap runs before the root element exists. Defer the
      // whole install until the DOM is ready instead of crashing on a null
      // documentElement (which previously left the runtime permanently absent
      // after a renderer reload).
      document.addEventListener("DOMContentLoaded", () => install(config), { once: true });
      return;
    }
    const currentRuntime = window.__codexPersonalRuntime;
    if (currentRuntime?.version === config.version && currentRuntime?.sessionId === config.sessionId) {
      currentRuntime.ensure();
      return;
    }
    currentRuntime?.dispose?.();

    const lifetime = new AbortController();
    const rightPanelRouteKinds = new Set(config.rightPanelRouteKinds);

    const entryMarker = "data-codex-personal-feature";
    const pageSurfaceMarker = "data-codex-personal-surface";
    const pinnedSurfaceMarker = "data-codex-personal-pinned-summary";
    const modalSurfaceMarker = "data-codex-personal-modal";
    const promptPreviewMarker = "data-codex-personal-prompt-preview";
    const threadShiftStyle = document.createElement("style");
    threadShiftStyle.setAttribute("data-codex-personal-summary-shift-style", "");
    threadShiftStyle.textContent = "[data-codex-personal-summary-shift] { transform: none !important; --thread-wide-block-inline-shift: 0px !important; }";
    const nativeLabels = {
      sites: ["sites", "站点"],
      scheduled: ["scheduled", "计划任务"],
      plugins: ["plugins", "插件"],
    };
    const themeTokenNames = [
      "--codex-base-accent",
      "--codex-base-ink",
      "--codex-base-surface",
      "--codex-corner-radius-scale",
      "--codex-corner-shape",
      "--spacing",
      "--radius-3xl-base",
      "--elevation-prominent",
      "--elevation-stroke",
      "--color-token-main-surface-primary",
      "--color-token-dropdown-background",
      "--color-token-foreground",
      "--color-token-text-secondary",
      "--color-token-text-tertiary",
      "--color-token-border",
      "--color-token-focus-border",
      "--color-token-conversation-summary-trailing",
      "--color-token-bg-primary",
      "--color-token-bg-secondary",
      "--color-token-bg-tertiary",
      "--color-background-elevated-primary-opaque",
      "--color-background-panel",
      "--color-background-control",
      "--color-background-primary-solid",
      "--color-text-primary-solid",
      "--color-background-button-primary",
      "--color-background-button-primary-hover",
      "--color-background-button-secondary",
      "--color-background-button-secondary-hover",
      "--color-background-button-tertiary-hover",
      "--color-text-button-tertiary",
      "--color-token-button-background",
      "--color-token-button-foreground",
      "--color-text-foreground",
      "--color-text-foreground-secondary",
      "--color-text-foreground-tertiary",
      "--color-text-on-accent",
      "--color-text-button-primary",
      "--color-text-accent",
      "--color-token-text-link-foreground",
      "--color-border",
      "--color-border-heavy",
      "--color-border-focus",
      "--color-token-scrollbar-slider-background",
      "--color-token-scrollbar-slider-hover-background",
      "--color-token-scrollbar-slider-active-background",
      "--color-icon-primary",
      "--color-icon-secondary",
      "--color-icon-tertiary",
      "--color-token-list-hover-background",
      "--color-token-input-background",
      "--color-token-input-border",
      "--color-token-input-foreground",
      "--color-token-input-placeholder-foreground",
      "--font-sans-default",
      "--font-weight-normal",
      "--vscode-font-weight",
      "--default-mono-font-family",
      "--text-heading-lg",
      "--text-heading-md",
      "--text-base",
      "--text-base--line-height",
      "--text-sm",
      "--text-sm--line-height",
      "--text-xs",
      "--spacing-token-button-composer",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--shadow-md",
      "--shadow-lg",
      "--shadow-xl",
    ];
    function normalizedLocale(value) {
      return String(value ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
    }

    const locale = normalizedLocale(
      document.documentElement.lang || navigator.languages?.[0] || navigator.language,
    );

    function localizedText(fallback, locales = {}) {
      return locales[locale] ?? locales.en ?? fallback;
    }

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
    const featureById = new Map(features.map((feature) => [feature.id, feature]));
    const sidebarFeatures = features.filter((feature) => feature.entry?.kind === "sidebar");
    const toolbarFeatures = features.filter((feature) => feature.entry?.kind === "conversation-toolbar");
    const modelSelectorFeature = features.find(
      (feature) => feature.entry?.kind === "composer-model-selector",
    ) ?? null;
    const pageScriptFeatures = features.filter((feature) => feature.entry?.kind === "page-script");
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
    let shiftedThreadContent = null;
    let shiftedThreadOriginal = null;
    let mainContentObserver = null;
    const domObservers = [];
    const pageScriptCleanups = [];
    const pendingHostActions = new Map();
    let activeModalRecordKey = null;
    let activePromptPreview = null;
    let promptPreviewDismissTimer = null;
    let nativeTabCapabilityPromise = null;
    let nativeTabCapability = null;
    let nativeTabCapabilityError = null;
    const modelSelectorOriginalItems = new Map();
    const modelSelectorOriginalToggleLabels = new Map();
    const modelSelectorGenericContainers = new Map();
    const modelSelectorPositionObservers = new Map();
    const modelSelectorMenuSizeFrames = new Map();
    let modelSelectorReturnTimer = null;
    let modelSelectorPendingReturn = false;
    let modelSelectorEffortTransactionTimer = null;
    let modelSelectorPendingOutsideDismiss = false;
    let modelSelectorSuppressOutsidePointerSequence = false;
    let modelSelectorTriggerObserver = null;
    let modelSelectorObservedTrigger = null;
    let modelSelectorNativeFastIcons = null;
    const modelSelectorStyle = document.createElement("style");
    modelSelectorStyle.setAttribute("data-codex-model-slider-style", "");
    modelSelectorStyle.textContent = `
      [data-codex-model-slider-menu] { width: 264px !important; min-width: 264px; overflow-x: hidden; }
      [data-codex-model-slider-menu][data-codex-model-slider-overflow] {
        max-height: var(--codex-model-slider-menu-max-height) !important;
        overflow-y: auto;
      }
      [data-codex-model-slider-trigger] [class*="_ModelPickerTriggerModelLabel_"] {
        max-width: none; flex-shrink: 0; overflow: visible; text-overflow: clip;
      }
      [data-codex-model-slider-trigger] [class*="_ModelPickerTriggerModelText_"] {
        overflow: visible; text-overflow: clip;
      }
      html[data-codex-model-slider-catalog-ready]
      [data-codex-intelligence-trigger]
      [class*="_ModelPickerTriggerModelText_"]:not([data-codex-model-slider-trigger-label]) {
        display: none !important;
      }
      [data-codex-model-slider-trigger-label] {
        display: inline; overflow: visible; text-overflow: clip; white-space: nowrap;
      }
      [data-codex-model-slider-trigger] [class*="_ModelPickerTriggerEffortLabel_"] {
        display: inline-flex; align-items: center; align-self: center;
      }
      html[data-codex-model-slider-selecting-effort] [role="menu"][data-state="open"]:not(:has([data-reasoning-slider])) {
        visibility: hidden !important; opacity: 0 !important; animation: none !important; pointer-events: none !important;
      }
      [data-codex-model-slider-row] { display: flex; width: 100%; min-width: 0; align-items: center; gap: 10px; }
      [data-codex-model-slider-brand] { display: grid; width: 18px; height: 18px; flex: 0 0 18px; place-items: center; }
      [data-codex-model-slider-brand] svg { width: 16px; height: 16px; display: block; }
      [data-codex-model-slider-copy] { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 1px; }
      [data-codex-model-slider-name] { overflow: hidden; color: var(--color-text-foreground); text-overflow: ellipsis; white-space: nowrap; }
      [data-codex-model-slider-provider] { overflow: hidden; color: var(--color-text-foreground-tertiary); font-size: 11px; line-height: 14px; text-overflow: ellipsis; white-space: nowrap; }
      [data-codex-model-slider-item] { position: relative; }
      [data-codex-model-slider-item][data-codex-model-slider-selected] { background: var(--color-token-list-hover-background); }
      [data-codex-model-slider-star] {
        display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center;
        border: 0; border-radius: var(--radius-md, 6px); padding: 0; background: transparent;
        color: var(--color-text-foreground-tertiary); cursor: pointer; opacity: 0; pointer-events: none;
      }
      [data-codex-model-slider-item]:hover [data-codex-model-slider-star],
      [data-codex-model-slider-item]:focus-within [data-codex-model-slider-star] { opacity: 1; pointer-events: auto; }
      [data-codex-model-slider-star]:hover, [data-codex-model-slider-star]:focus-visible {
        background: var(--color-token-list-hover-background); color: var(--color-text-foreground); outline: none;
      }
      [data-codex-model-slider-star]::after {
        content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 40px; z-index: 1;
      }
      [data-codex-model-slider-star] svg { position: relative; z-index: 2; width: 16px; height: 16px; pointer-events: none; }
      [data-codex-model-slider-divider] { height: 0.5px; margin: 4px 8px; background: var(--color-token-border, var(--color-border)); }
      [data-codex-model-slider-generic-menu] { overflow-x: hidden; }
      [data-codex-model-slider-generic] { box-sizing: border-box; width: 100%; }
      [data-codex-model-slider-fast] { margin-left: auto; border: 0; background: transparent; cursor: pointer; }
      [data-codex-model-slider-fast]:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 1px; }
      [data-codex-model-slider-rail][data-codex-model-slider-fallback] { position: relative; height: 38px; margin: 1px 8px 0; outline: none; cursor: pointer; }
      [data-codex-model-slider-track] { position: absolute; top: 12px; right: 0; left: 0; height: 16px; border-radius: 999px; background: var(--color-background-control); }
      [data-codex-model-slider-range] { position: absolute; top: 0; bottom: 0; left: 0; width: var(--codex-model-slider-progress); border-radius: inherit; background: var(--color-text-accent); }
      [data-codex-model-slider-fallback] [data-codex-model-slider-tick] {
        position: absolute; top: 16px; width: 6px; height: 6px; transform: translate(-50%, -50%); border: 0; border-radius: 50%;
        padding: 0; background: var(--color-text-foreground-tertiary); pointer-events: none;
      }
      [data-codex-model-slider-fallback] [data-codex-model-slider-tick][data-selected="true"] { background: var(--color-text-on-accent); }
      [data-codex-model-slider-thumb] {
        position: absolute; top: 7px; left: var(--codex-model-slider-progress); width: 26px; height: 26px;
        transform: translateX(-50%); border: 0.5px solid var(--color-token-border, var(--color-border)); border-radius: 50%;
        background: var(--color-background-elevated-primary-opaque, var(--color-background-panel)); box-shadow: var(--shadow-md);
        pointer-events: none;
      }
      [data-codex-model-slider-fallback]:focus-visible [data-codex-model-slider-thumb] { box-shadow: 0 0 0 2px var(--color-border-focus); }
      @media (prefers-reduced-motion: reduce) {
        [data-codex-model-slider-star] { transition: none; }
      }
    `;

    if (modelSelectorFeature) {
      document.documentElement.setAttribute("data-codex-model-slider-catalog-ready", "");
      document.documentElement.append(modelSelectorStyle);
    }

    for (const feature of pageScriptFeatures) {
      const source = feature.pageScript?.source ?? "";
      if (!source.trim()) continue;
      try {
        const installer = new Function(
          "signal",
          "window",
          "document",
          "MutationObserver",
          `"use strict";\n${source}`,
        );
        const cleanup = installer(lifetime.signal, window, document, MutationObserver);
        if (typeof cleanup === "function") pageScriptCleanups.push(cleanup);
      } catch (error) {
        console.warn(`[codex-personal] page-script feature failed: ${feature.id}`, error);
      }
    }

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

    function nativeSummaryButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => (
        (
          button.getAttribute("aria-label") === "Toggle summary"
          || button.getAttribute("aria-label") === "Toggle pinned summary"
        )
        && isVisibleToolbarControl(button)
      )) ?? null;
    }

    function nativeBottomPanelButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (button.getAttribute("aria-label") !== "Toggle bottom panel") return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
    }

    function nativeSidePanelButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (button.getAttribute("aria-label") !== "Toggle side panel") return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
    }

    function nativeTemporaryChatButton() {
      return Array.from(document.querySelectorAll("button")).find((button) => {
        if (!/temporary chat/i.test(button.getAttribute("aria-label") ?? "")) return false;
        return isVisibleToolbarControl(button);
      }) ?? null;
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
      return button?.getAttribute("aria-label") === "Toggle summary"
        || button?.getAttribute("aria-label") === "Toggle pinned summary";
    }

    function mainContentViewport() {
      return document.querySelector("[data-app-shell-main-content-layout]")
        ?? document.querySelector("main[data-app-shell-main-surface]")
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

    function createModelSelectorIcon(definition, { brand = false } = {}) {
      const icon = createMarkupIcon(definition, "", 16);
      if (!icon) return null;
      if (brand) {
        icon.setAttribute("fill", "currentColor");
        icon.removeAttribute("stroke");
        icon.removeAttribute("stroke-width");
        icon.removeAttribute("stroke-linecap");
        icon.removeAttribute("stroke-linejoin");
      }
      return icon;
    }

    function nativeCssModuleClass(tokenName, root = document) {
      const pattern = new RegExp(`^_${tokenName}_[A-Za-z0-9_-]+$`);
      const live = Array.from(root.querySelectorAll(`[class*="_${tokenName}_"]`))
        .flatMap((element) => Array.from(element.classList))
        .find((name) => pattern.test(name));
      if (live) return live;
      const selectorPattern = new RegExp(`\\.(_${tokenName}_[A-Za-z0-9_-]+)`);
      const find = (rules) => {
        for (const rule of rules ?? []) {
          const match = String(rule.selectorText ?? "").match(selectorPattern);
          if (match?.[1]) return match[1];
          try {
            const nested = find(rule.cssRules);
            if (nested) return nested;
          } catch {
            // Ignore inaccessible nested rules and continue with Codex's readable sheets.
          }
        }
        return null;
      };
      for (const sheet of document.styleSheets) {
        try {
          const match = find(sheet.cssRules);
          if (match) return match;
        } catch {
          // Ignore cross-origin stylesheets.
        }
      }
      return null;
    }

    function captureNativeFastIcon() {
      const capture = (state, pathPrefix) => {
        if (modelSelectorNativeFastIcons?.[state]) return;
        const path = Array.from(document.querySelectorAll("svg path")).find(
          (candidate) => candidate.getAttribute("d")?.startsWith(pathPrefix),
        );
        const svg = path?.closest("svg");
        if (!svg) return;
        const template = svg.cloneNode(true);
        template.removeAttribute("id");
        template.removeAttribute("width");
        template.removeAttribute("height");
        if (!modelSelectorNativeFastIcons) modelSelectorNativeFastIcons = {};
        modelSelectorNativeFastIcons[state] = template;
      };
      capture("active", "M11.9125 21.4125");
      capture("inactive", "M7.38 16.2207");
      return modelSelectorNativeFastIcons;
    }

    function createNativeFastIcon(active) {
      const template = captureNativeFastIcon()?.[active ? "active" : "inactive"];
      if (!template) return null;
      const icon = template.cloneNode(true);
      icon.setAttribute("aria-hidden", "true");
      const iconClass = nativeCssModuleClass("FastModeIcon");
      if (iconClass && !icon.classList.contains(iconClass)) icon.classList.add(iconClass);
      return icon;
    }

    function modelIdentity(rawValue) {
      const raw = String(rawValue ?? "").trim();
      const slash = raw.indexOf("/");
      return {
        raw,
        provider: slash > 0 ? raw.slice(0, slash).trim() : "",
        backend: slash > 0 ? raw.slice(slash + 1).trim() : raw,
      };
    }

    function formatIdentifier(value) {
      const raw = String(value ?? "").trim();
      if (!raw) return "";
      if (/\s/.test(raw) && !raw.includes("/") && !raw.includes("_") && !raw.includes("-")) return raw;
      const canonical = new Map([
        ["ai", "AI"], ["api", "API"], ["chatglm", "ChatGLM"], ["claude", "Claude"],
        ["codex", "Codex"], ["deepseek", "DeepSeek"], ["gemini", "Gemini"], ["gemma", "Gemma"],
        ["glm", "GLM"], ["gpt", "GPT"], ["grok", "Grok"], ["kimi", "Kimi"],
        ["minimax", "MiniMax"], ["mimo", "MiMo"], ["moonshot", "Moonshot"], ["qwen", "Qwen"],
        ["qwq", "QwQ"], ["xai", "xAI"], ["xiaomi", "Xiaomi"], ["zhipu", "Zhipu"],
      ]);
      return raw
        .replace(/[_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
          const lower = token.toLowerCase();
          if (canonical.has(lower)) return canonical.get(lower);
          if (/^v\d/i.test(token)) return `V${token.slice(1)}`;
          if (/^o\d/i.test(token)) return token.toUpperCase();
          return token.charAt(0).toUpperCase() + token.slice(1);
        })
        .join(" ");
    }

    function providerLabel(provider, selector) {
      if (!provider) return "";
      return selector.providerAliases?.[provider.toLowerCase()] ?? formatIdentifier(provider);
    }

    function modelDisplayLabel(identity, selector) {
      const model = catalogModelFor(identity, selector) ?? nativeCatalogModelFor(identity);
      const source = model?.displayName || model?.slug || identity.backend;
      return formatIdentifier(modelIdentity(source).backend);
    }

    function brandForModel(identity, selector) {
      const haystack = `${identity.backend} ${identity.raw}`.toLowerCase();
      return selector.brands?.find((brand) => (
        brand.keywords.some((keyword) => haystack.includes(keyword))
      )) ?? null;
    }

    function comparableModelLabel(value) {
      return formatIdentifier(modelIdentity(value).backend)
        .toLowerCase()
        .replace(/^gpt\s+/, "")
        .trim();
    }

    function nativeComposerModelController() {
      const trigger = document.querySelector("[data-codex-intelligence-trigger]");
      const fiberKey = Object.getOwnPropertyNames(trigger ?? {}).find((key) => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? trigger[fiberKey] : null;
      for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (Array.isArray(props?.models) && typeof props.onSelectReasoningEffort === "function") return props;
        if (
          props?.models
          && typeof props.models === "object"
          && !Array.isArray(props.models)
          && typeof props.onModelChange === "function"
          && props.selectedModel
        ) {
          return chatComposerModelController(props);
        }
      }
      return null;
    }

    function chatComposerModelController(props) {
      const selected = props.selectedModel ?? {};
      if (!Array.isArray(props.models?.versionOptions) || !selected.versionId) return null;
      const version = props.models.versionOptions.find(
        (candidate) => String(candidate.id ?? "") === String(selected.versionId ?? ""),
      );
      if (!version) return null;
      const options = Array.isArray(version?.options) ? version.options : [];
      const effortFor = (option) => String(option?.title ?? option?.lane ?? "").toLowerCase();
      const efforts = options.map(effortFor).filter(Boolean);
      const selectedOption = options.find(
        (option) => String(option.thinkingEffort ?? "") === String(selected.thinkingEffort ?? ""),
      );
      const selectedEffort = selectedOption ? effortFor(selectedOption) : (efforts[0] ?? "instant");
      const models = [{
        model: String(selected.slug ?? ""),
        displayName: String(version?.label ?? selected.slug ?? ""),
        defaultReasoningEffort: selectedEffort,
        supportedReasoningEfforts: efforts.map((effort) => ({ reasoningEffort: effort })),
      }];
      return {
        models,
        onSelectReasoningEffort(effort) {
          const target = options.find((option) => effortFor(option) === String(effort).toLowerCase());
          if (!target) return;
          const next = { ...selected, slug: String(target.slug ?? selected.slug ?? "") };
          if (target.thinkingEffort) next.thinkingEffort = target.thinkingEffort;
          else delete next.thinkingEffort;
          props.onModelChange(next);
        },
      };
    }

    function nativeCatalogModelFor(identity) {
      const models = nativeComposerModelController()?.models ?? [];
      const exact = models.find((model) => String(model.model ?? "").toLowerCase() === identity.raw.toLowerCase());
      const target = comparableModelLabel(identity.backend);
      const aliases = exact ? [] : models.filter((model) => (
        comparableModelLabel(model.model) === target || comparableModelLabel(model.displayName) === target
      ));
      const model = exact ?? (aliases.length === 1 ? aliases[0] : null);
      if (!model) return null;
      return {
        slug: String(model.model ?? ""),
        displayName: String(model.displayName ?? model.model ?? ""),
        defaultReasoningLevel: String(model.defaultReasoningEffort ?? ""),
        supportedReasoningLevels: (model.supportedReasoningEfforts ?? []).map((level) => ({
          effort: String(level?.reasoningEffort ?? level?.effort ?? level ?? ""),
        })).filter((level) => level.effort),
      };
    }

    function modelDefinitionFor(identity, selector) {
      return nativeCatalogModelFor(identity) ?? catalogModelFor(identity, selector);
    }

    function nativeModelDescriptorForItem(item, observedRaw) {
      const target = comparableModelLabel(observedRaw);
      if (!target) return null;
      const fiberKey = Object.getOwnPropertyNames(item).find((key) => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? item[fiberKey] : null;
      for (let depth = 0; fiber && depth < 35; depth += 1, fiber = fiber.return) {
        if (!Array.isArray(fiber.memoizedProps)) continue;
        const matches = fiber.memoizedProps.map((element) => {
          const props = element?.props?.children?.props;
          const slug = String(props?.model ?? element?.key ?? "").trim();
          const displayName = String(props?.displayName ?? "").trim();
          return slug && (
            comparableModelLabel(slug) === target || comparableModelLabel(displayName) === target
          ) ? { slug, displayName } : null;
        }).filter(Boolean);
        if (matches.length === 1) return matches[0];
      }
      return null;
    }

    function catalogModelFor(identity, selector) {
      const raw = identity.raw.toLowerCase();
      const backend = identity.backend.toLowerCase();
      const exact = selector.models?.find((model) => (
        model.slug.toLowerCase() === raw
        || model.slug.toLowerCase() === backend
        || model.displayName.toLowerCase() === raw
      )) ?? null;
      if (exact) return exact;
      const target = comparableModelLabel(identity.backend);
      if (!target) return null;
      const aliases = (selector.models ?? []).filter((model) => (
        comparableModelLabel(model.slug) === target || comparableModelLabel(model.displayName) === target
      ));
      return resolveModelAlias(aliases, identity);
    }

    function resolveModelAlias(aliases, identity) {
      if (aliases.length === 1) return aliases[0];
      if (aliases.length < 2 || identity.provider) return null;
      const native = aliases.find((model) => !model.slug.includes("/"));
      const thirdParty = aliases.find((model) => model.slug.includes("/"));
      if (!native || !thirdParty) return null;
      if (!modelIdentity(native.slug).backend.toLowerCase().startsWith("gpt")) return null;
      const nativeLabel = formatIdentifier(
        modelIdentity(String(native.displayName ?? native.slug)).backend,
      ).toLowerCase();
      return formatIdentifier(identity.backend).toLowerCase() === nativeLabel ? native : thirdParty;
    }

    function loadModelFavorites(selector) {
      try {
        const value = JSON.parse(localStorage.getItem(selector.favoriteStorageKey) ?? "[]");
        return new Set(Array.isArray(value) ? value.map(String) : []);
      } catch {
        return new Set();
      }
    }

    function saveModelFavorites(selector, favorites) {
      try {
        localStorage.setItem(selector.favoriteStorageKey, JSON.stringify(Array.from(favorites)));
      } catch {
        // A disabled localStorage must not break the native picker.
      }
    }

    function nativeModelPickerMenu() {
      return Array.from(document.querySelectorAll('[role="menu"][data-state="open"]')).find(
        (menu) => menu.querySelector("[data-reasoning-slider]") && nativeModelPickerRow(menu),
      ) ?? null;
    }

    function nativeModelPickerRow(menu) {
      const rows = Array.from(menu?.querySelectorAll('[role="menuitem"]') ?? []);
      return rows.find((row) => (
        row.getAttribute("aria-haspopup") === "menu"
        && !row.hasAttribute("data-model-picker-view-toggle")
      )) ?? rows.find((row) => {
        const aria = String(row.getAttribute("aria-label") ?? "").trim();
        const firstLine = String(row.innerText ?? "").split("\n", 1)[0].trim();
        return /^model(?:\s|$)/i.test(aria) || /^model$/i.test(firstLine);
      }) ?? null;
    }

    function nativeModelValue(menu) {
      const row = nativeModelPickerRow(menu);
      const values = String(row?.innerText ?? "").split("\n").map((value) => value.trim()).filter(Boolean);
      if (values.length > 1) return values.at(-1);
      const aria = String(row?.getAttribute("aria-label") ?? "").trim();
      return aria.replace(/^\S+\s+/, "").trim();
    }

    function firstVisibleTextNode(element) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent.trim() && !node.parentElement?.closest("svg")) return node;
        node = walker.nextNode();
      }
      return null;
    }

    function modelMenuItems(menu) {
      return Array.from(menu?.querySelectorAll(
        ':scope [role="menuitemradio"], :scope [role="menuitemcheckbox"], :scope [role="menuitem"]',
      ) ?? []).filter((item) => item.closest('[role="menu"]') === menu && !item.hasAttribute("aria-haspopup"));
    }

    function nativeMenuItemLabel(item) {
      return Array.from(item?.querySelectorAll("span") ?? [])
        .map((span) => String(span.textContent ?? "").trim())
        .find(Boolean) ?? String(item?.textContent ?? "").trim();
    }

    function nativeModelSubmenu(parentMenu) {
      if (nativeModelPickerRow(parentMenu)?.getAttribute("aria-expanded") !== "true") return null;
      return Array.from(document.querySelectorAll('[role="menu"][data-state="open"]')).find((menu) => (
        !menu.querySelector("[data-reasoning-slider]") && modelMenuItems(menu).length > 1
      )) ?? null;
    }

    function isNativeEffortSubmenu(menu) {
      const effortLabels = new Set([
        "none", "minimal", "light", "low", "medium", "high", "extra high", "max", "ultra",
      ]);
      if (!menu || menu.querySelector("[data-reasoning-slider]")) return false;
      const labels = modelMenuItems(menu).map((item) => (
        nativeMenuItemLabel(item).toLowerCase()
      )).filter(Boolean);
      return labels.length > 1 && labels.every((label) => effortLabels.has(label));
    }

    function nativeEffortSubmenu() {
      return Array.from(document.querySelectorAll('[role="menu"][data-state="open"]'))
        .find((menu) => isNativeEffortSubmenu(menu)) ?? null;
    }

    function nativeModelPickerSubmenus() {
      return Array.from(document.querySelectorAll('[role="menu"][data-state="open"]')).filter((menu) => {
        if (menu.querySelector("[data-reasoning-slider]")) return false;
        if (menu.hasAttribute("data-codex-model-slider-menu")) return true;
        return isNativeEffortSubmenu(menu);
      });
    }

    function setReactControlledMenuOpen(element, open) {
      if (!element) return false;
      const fiberKey = Object.getOwnPropertyNames(element).find((key) => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? element[fiberKey] : null;
      for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (typeof props?.open === "boolean" && props.open !== open && typeof props.onOpenChange === "function") {
          props.onOpenChange(open);
          return true;
        }
      }
      return false;
    }

    function closeReactControlledMenu(element) {
      return setReactControlledMenuOpen(element, false);
    }

    function invokeNativeMenuItemSelect(item) {
      if (!item) return false;
      const fiberKey = Object.getOwnPropertyNames(item).find((key) => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? item[fiberKey] : null;
      for (let depth = 0; fiber && depth < 24; depth += 1, fiber = fiber.return) {
        const onSelect = fiber.memoizedProps?.onSelect;
        if (typeof onSelect !== "function") continue;
        onSelect({ preventDefault() {}, defaultPrevented: false });
        return true;
      }
      return false;
    }

    function closeNativeModelPickerSubmenus() {
      const submenus = nativeModelPickerSubmenus();
      const parentMenu = nativeModelPickerMenu();
      const expandedRows = Array.from(
        parentMenu?.querySelectorAll('[role="menuitem"][aria-haspopup="menu"][aria-expanded="true"]') ?? [],
      );
      let controlledMenuClosed = false;
      for (const row of expandedRows) {
        controlledMenuClosed = closeReactControlledMenu(row) || controlledMenuClosed;
      }
      for (const submenu of submenus.reverse()) {
        if (controlledMenuClosed || closeReactControlledMenu(submenu)) continue;
        submenu.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }));
      }
      return submenus.length > 0;
    }

    function endNativeEffortTransaction() {
      clearTimeout(modelSelectorEffortTransactionTimer);
      modelSelectorEffortTransactionTimer = null;
      modelSelectorPendingOutsideDismiss = false;
      document.documentElement.removeAttribute("data-codex-model-slider-selecting-effort");
    }

    function beginNativeEffortTransaction() {
      clearTimeout(modelSelectorEffortTransactionTimer);
      document.documentElement.setAttribute("data-codex-model-slider-selecting-effort", "");
      modelSelectorEffortTransactionTimer = setTimeout(() => {
        closeNativeModelPickerSubmenus();
        endNativeEffortTransaction();
      }, 2_000);
    }

    function deferNativeEffortOutsideDismiss(event) {
      const insideMenu = event.target.closest?.('[role="menu"]');
      if (insideMenu) return;
      if (event.type === "pointerdown" && modelSelectorEffortTransactionTimer != null) {
        modelSelectorPendingOutsideDismiss = true;
        modelSelectorSuppressOutsidePointerSequence = true;
      }
      if (!modelSelectorSuppressOutsidePointerSequence) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.type === "click") modelSelectorSuppressOutsidePointerSequence = false;
    }

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      document.addEventListener(type, deferNativeEffortOutsideDismiss, {
        capture: true,
        signal: lifetime.signal,
      });
    }

    function modelItemRawValue(item) {
      if (item.dataset.codexModelSliderRaw) return item.dataset.codexModelSliderRaw;
      return String(item.innerText ?? "").split("\n").map((value) => value.trim()).filter(Boolean).join(" ");
    }

    function visibleBlockingDialog() {
      return Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) => {
        const rect = dialog.getBoundingClientRect();
        const style = getComputedStyle(dialog);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
    }

    function dispatchPointerClick(element) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const init = {
        bubbles: true,
        cancelable: true,
        view: window,
        pointerType: "mouse",
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      for (const type of [
        "pointermove", "pointerover", "mouseover", "mousemove",
        "pointerdown", "mousedown", "pointerup", "mouseup", "click",
      ]) {
        const EventType = type.startsWith("pointer") ? PointerEvent : MouseEvent;
        const pressed = type === "pointerdown" || type === "mousedown";
        element.dispatchEvent(new EventType(type, {
          ...init,
          buttons: pressed ? 1 : 0,
          detail: type === "click" ? 1 : 0,
        }));
      }
    }

    function returnToNativeModelSlider(attempt = 0) {
      if (visibleBlockingDialog()) {
        closeNativeModelPickerSubmenus();
        setTimeout(endNativeEffortTransaction, 120);
        return;
      }
      if (closeNativeModelPickerSubmenus()) {
        setTimeout(() => returnToNativeModelSlider(attempt), 100);
        return;
      }
      let parentMenu = nativeModelPickerMenu();
      if (parentMenu) {
        const toggle = parentMenu.querySelector("[data-model-picker-view-toggle]");
        if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
        setTimeout(() => {
          if (!nativeModelPickerMenu() && attempt < 3) {
            returnToNativeModelSlider(attempt + 1);
            return;
          }
          modelSelectorPendingReturn = false;
          if (nativeModelPickerSubmenus().length === 0) endNativeEffortTransaction();
          queueEnsure();
        }, 140);
        return;
      }
      const trigger = document.querySelector("[data-codex-intelligence-trigger]");
      if (!trigger) return;
      dispatchPointerClick(trigger);
      setTimeout(() => {
        if (!nativeModelPickerMenu() && attempt < 3) {
          returnToNativeModelSlider(attempt + 1);
          return;
        }
        modelSelectorPendingReturn = false;
        if (nativeModelPickerSubmenus().length === 0) endNativeEffortTransaction();
        queueEnsure();
      }, 140);
    }

    function scheduleModelSliderReturn() {
      modelSelectorPendingReturn = true;
      clearTimeout(modelSelectorReturnTimer);
      modelSelectorReturnTimer = setTimeout(() => {
        modelSelectorReturnTimer = null;
        returnToNativeModelSlider();
      }, 260);
    }

    function nativeGptSortRank(rawValue) {
      const known = new Map([
        ["gpt-5.6-sol", 1], ["gpt-5.6-terra", 2], ["gpt-5.6-luna", 3],
        ["gpt-5.5", 4], ["gpt-5.4", 5], ["gpt-5.4-mini", 6], ["gpt-5.3-codex-spark", 7],
      ]);
      const raw = String(rawValue ?? "").trim();
      const knownRank = known.get(raw);
      if (knownRank != null) return { official: true, rank: knownRank };
      const identity = modelIdentity(raw);
      return identity.provider ? null : { official: true, rank: 100 };
    }

    function compareEnhancedModelItems(a, b, favorites) {
      const favA = Number(favorites.has(a.dataset.codexModelSliderRaw));
      const favB = Number(favorites.has(b.dataset.codexModelSliderRaw));
      if (favA !== favB) return favB - favA;
      const rankA = nativeGptSortRank(a.dataset.codexModelSliderRaw);
      const rankB = nativeGptSortRank(b.dataset.codexModelSliderRaw);
      if (Boolean(rankA) !== Boolean(rankB)) return rankA ? -1 : 1;
      if (rankA && rankB) return rankA.rank - rankB.rank;
      return 0;
    }

    function renderEnhancedModelMenu(menu, selector) {
      const items = modelMenuItems(menu).filter((item) => item.dataset.codexModelSliderRaw);
      if (!items.length) return;
      const favorites = loadModelFavorites(selector);
      items.forEach((item) => { item.style.display = ""; });
      const starred = items.filter((item) => favorites.has(item.dataset.codexModelSliderRaw));
      const ordinary = items.filter((item) => !favorites.has(item.dataset.codexModelSliderRaw));
      const desired = items.slice().sort((a, b) => compareEnhancedModelItems(a, b, favorites));
      const parent = items[0].parentElement;
      if (!parent || !desired.every((item) => item.parentElement === parent)) return;
      const current = Array.from(parent.children).filter((child) => child.hasAttribute?.("data-codex-model-slider-item"));
      if (desired.some((item, index) => current[index] !== item)) desired.forEach((item) => parent.append(item));

      let divider = parent.querySelector(":scope > [data-codex-model-slider-divider]");
      if (starred.length && ordinary.length) {
        if (!divider) {
          divider = document.createElement("div");
          divider.setAttribute("data-codex-model-slider-divider", "");
          divider.setAttribute("role", "separator");
        }
        const firstOrdinary = desired.find((item) => !favorites.has(item.dataset.codexModelSliderRaw));
        if (firstOrdinary && divider.nextElementSibling !== firstOrdinary) {
          parent.insertBefore(divider, firstOrdinary);
        }
      } else {
        divider?.remove();
      }

      if (!modelSelectorMenuSizeFrames.has(menu)) {
        const frame = requestAnimationFrame(() => {
          modelSelectorMenuSizeFrames.delete(menu);
          sizeModelMenuViewport(menu, selector.maxVisibleItems);
        });
        modelSelectorMenuSizeFrames.set(menu, frame);
      }
    }

    function sizeModelMenuViewport(menu, maxVisibleItems) {
      if (!menu.isConnected) return;
      const items = modelMenuItems(menu).filter((item) => item.dataset.codexModelSliderRaw);
      if (items.length <= maxVisibleItems) {
        menu.removeAttribute("data-codex-model-slider-overflow");
        menu.style.removeProperty("--codex-model-slider-menu-max-height");
        menu.style.removeProperty("max-height");
        return;
      }
      const lastVisibleItem = items[maxVisibleItems - 1];
      const menuRect = menu.getBoundingClientRect();
      const itemRect = lastVisibleItem.getBoundingClientRect();
      const paddingBottom = Number.parseFloat(getComputedStyle(menu).paddingBottom) || 0;
      const maxHeight = Math.ceil(itemRect.bottom - menuRect.top + menu.scrollTop + paddingBottom);
      menu.setAttribute("data-codex-model-slider-overflow", "");
      menu.style.setProperty("--codex-model-slider-menu-max-height", `${maxHeight}px`);
      menu.style.overflowY = "auto";
      positionModelSubmenu(menu);
    }

    function toggleModelFavorite(event, menu, selector, raw, label) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const favorites = loadModelFavorites(selector);
      if (favorites.has(raw)) favorites.delete(raw);
      else favorites.add(raw);
      saveModelFavorites(selector, favorites);
      for (const item of modelMenuItems(menu)) {
        if (!item.dataset.codexModelSliderRaw) continue;
        const starred = favorites.has(item.dataset.codexModelSliderRaw);
        const button = item.querySelector("[data-codex-model-slider-star]");
        if (!button) continue;
        button.replaceChildren(createModelSelectorIcon(starred ? selector.icons.unstar : selector.icons.star));
        const itemLabel = item.querySelector("[data-codex-model-slider-name]")?.textContent ?? label;
        button.setAttribute("aria-label", selector.strings[starred ? "unstar" : "star"].replace("{model}", itemLabel));
        button.setAttribute("title", selector.strings[starred ? "unstar" : "star"].replace("{model}", itemLabel));
      }
      renderEnhancedModelMenu(menu, selector);
    }

    function enhanceModelItem(item, menu, selector, index) {
      if (item.querySelector("[data-codex-model-slider-row]")) return;
      const observedRaw = modelItemRawValue(item);
      if (!observedRaw) return;
      if (!modelSelectorOriginalItems.has(item)) modelSelectorOriginalItems.set(item, item.innerHTML);
      const observedIdentity = modelIdentity(observedRaw);
      const nativeDescriptor = nativeModelDescriptorForItem(item, observedRaw);
      const catalogModel = catalogModelFor(observedIdentity, selector);
      const raw = catalogModel?.slug ?? nativeDescriptor?.slug ?? observedRaw;
      item.dataset.codexModelSliderRaw = raw;
      item.dataset.codexModelSliderItem = "";
      item.dataset.codexModelSliderOrder = String(index);
      item.dataset.codexModelSliderIdentitySource = catalogModel ? "catalog" : nativeDescriptor ? "native" : "visible";

      const identity = modelIdentity(raw);
      const display = modelDisplayLabel(identity, selector);
      const provider = providerLabel(identity.provider, selector);
      const brand = brandForModel(identity, selector);
      item.toggleAttribute("data-codex-model-slider-selected", Boolean(item.querySelector("svg")));
      const favorites = loadModelFavorites(selector);
      const starred = favorites.has(raw);
      const row = document.createElement("span");
      row.setAttribute("data-codex-model-slider-row", "");
      const brandRoot = document.createElement("span");
      brandRoot.setAttribute("data-codex-model-slider-brand", brand?.id ?? "fallback");
      brandRoot.append(createModelSelectorIcon(brand?.icon ?? selector.icons.fallback, { brand: Boolean(brand) }));
      const copy = document.createElement("span");
      copy.setAttribute("data-codex-model-slider-copy", "");
      const name = document.createElement("span");
      name.setAttribute("data-codex-model-slider-name", "");
      name.textContent = display;
      copy.append(name);
      if (provider) {
        const secondary = document.createElement("span");
        secondary.setAttribute("data-codex-model-slider-provider", "");
        secondary.textContent = provider;
        copy.append(secondary);
      }
      row.append(brandRoot, copy);
      const star = document.createElement("button");
      star.type = "button";
      star.setAttribute("data-codex-model-slider-star", starred ? "unstar" : "star");
      star.setAttribute("aria-label", selector.strings[starred ? "unstar" : "star"].replace("{model}", display));
      star.setAttribute("title", selector.strings[starred ? "unstar" : "star"].replace("{model}", display));
      star.append(createModelSelectorIcon(starred ? selector.icons.unstar : selector.icons.star));
      row.append(star);
      item.replaceChildren(row);
      if (!item.hasAttribute("data-codex-model-slider-return-listener")) {
        item.setAttribute("data-codex-model-slider-return-listener", "");
        item.addEventListener("click", (event) => {
          if (!event.target.closest?.("[data-codex-model-slider-star]")) scheduleModelSliderReturn();
        });
      }
    }

    function enhanceNativeModelSubmenu(menu, selector) {
      menu.setAttribute("data-codex-model-slider-menu", "");
      observeModelSubmenuPosition(menu);
      positionModelSubmenu(menu);
      const items = modelMenuItems(menu);
      items.forEach((item, index) => enhanceModelItem(item, menu, selector, index));
      if (!menu.hasAttribute("data-codex-model-slider-events")) {
        menu.setAttribute("data-codex-model-slider-events", "");
        menu.addEventListener("click", (event) => {
          const star = event.target.closest?.("[data-codex-model-slider-star]");
          if (star) {
            const item = star.closest("[data-codex-model-slider-item]");
            const raw = item?.dataset.codexModelSliderRaw;
            if (!raw) return;
            const label = item.querySelector("[data-codex-model-slider-name]")?.textContent ?? raw;
            toggleModelFavorite(event, menu, selector, raw, label);
            event.stopImmediatePropagation();
            return;
          }
          if (event.target.closest?.("[data-codex-model-slider-item]")) scheduleModelSliderReturn();
        }, { capture: true });
        menu.addEventListener("pointerdown", (event) => {
          const star = event.target.closest?.("[data-codex-model-slider-star]");
          if (star) {
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
          }
          if (event.target.closest?.("[data-codex-model-slider-item]")) scheduleModelSliderReturn();
        }, { capture: true });
        for (const type of ["mousedown", "pointerup", "mouseup"]) {
          menu.addEventListener(type, (event) => {
            if (!event.target.closest?.("[data-codex-model-slider-star]")) return;
            event.stopPropagation();
            event.stopImmediatePropagation();
          }, { capture: true });
        }
      }
      renderEnhancedModelMenu(menu, selector);
      if (!menu.hasAttribute("data-codex-model-slider-positioned")) menu.style.visibility = "hidden";
      positionModelSubmenu(menu);
    }

    function positionModelSubmenu(menu) {
      const trigger = document.getElementById(menu?.getAttribute("aria-labelledby") ?? "");
      const parentMenu = trigger?.closest('[role="menu"]') ?? nativeModelPickerMenu();
      const wrapper = menu?.parentElement;
      if (
        !parentMenu?.hasAttribute("data-codex-model-slider-generic-menu")
        || !wrapper?.hasAttribute("data-radix-popper-content-wrapper")
      ) return;
      const parentRect = parentMenu.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      if (!(parentRect.width > 0 && wrapperRect.width > 0 && wrapperRect.height > 0)) return;
      const inset = 8;
      const left = Math.min(
        innerWidth - wrapperRect.width - inset,
        Math.max(inset, parentRect.right - wrapperRect.width),
      );
      const top = Math.min(
        innerHeight - wrapperRect.height - inset,
        Math.max(inset, parentRect.bottom - wrapperRect.height),
      );
      const transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      if (wrapper.style.transform !== transform) wrapper.style.transform = transform;
      if (wrapper.style.getPropertyValue("--radix-popper-transform-origin") !== "100% 100%") {
        wrapper.style.setProperty("--radix-popper-transform-origin", "100% 100%");
      }
      const record = modelSelectorPositionObservers.get(wrapper);
      if (record) record.lastAppliedStyle = wrapper.getAttribute("style") ?? "";
      requestAnimationFrame(() => {
        if (!menu.isConnected) return;
        const positionedRect = wrapper.getBoundingClientRect();
        if (
          Math.abs(positionedRect.right - parentRect.right) <= 2
          && Math.abs(positionedRect.bottom - parentRect.bottom) <= 2
        ) {
          menu.setAttribute("data-codex-model-slider-positioned", "");
          menu.style.removeProperty("visibility");
        }
      });
    }

    function observeModelSubmenuPosition(menu) {
      const wrapper = menu?.parentElement;
      if (!wrapper?.hasAttribute("data-radix-popper-content-wrapper")) return;
      const existing = modelSelectorPositionObservers.get(wrapper);
      if (existing) {
        existing.menu = menu;
        return;
      }
      const record = {
        menu,
        queued: false,
        observer: null,
        resizeObserver: null,
        lastAppliedStyle: null,
      };
      const schedule = (mutations = []) => {
        if (
          mutations.length
          && wrapper.getAttribute("style") === record.lastAppliedStyle
        ) return;
        if (record.queued) return;
        record.queued = true;
        requestAnimationFrame(() => {
          record.queued = false;
          if (record.menu.isConnected) positionModelSubmenu(record.menu);
        });
      };
      record.observer = new MutationObserver(schedule);
      record.observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
      record.resizeObserver = new ResizeObserver(schedule);
      record.resizeObserver.observe(menu);
      const trigger = document.getElementById(menu.getAttribute("aria-labelledby") ?? "");
      const parentMenu = trigger?.closest('[role="menu"]');
      if (parentMenu) record.resizeObserver.observe(parentMenu);
      modelSelectorPositionObservers.set(wrapper, record);
    }

    function pruneModelSubmenuPositionObservers() {
      for (const [wrapper, record] of modelSelectorPositionObservers) {
        if (wrapper.isConnected) continue;
        record.observer.disconnect();
        record.resizeObserver.disconnect();
        modelSelectorPositionObservers.delete(wrapper);
      }
    }

    function openNativeModelSubmenu(parentMenu) {
      let attempts = 0;
      const open = () => {
        attempts += 1;
        const currentMenu = nativeModelPickerMenu() ?? parentMenu;
        const row = nativeModelPickerRow(currentMenu);
        if (row) {
          setReactControlledMenuOpen(row, true);
          setTimeout(queueEnsure, 0);
          return;
        }
        if (attempts < 12) requestAnimationFrame(open);
      };
      setTimeout(open, 80);
    }

    function nativeEffortRow(parentMenu) {
      return Array.from(parentMenu?.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]') ?? [])
        .filter((row) => !row.hasAttribute("data-model-picker-view-toggle"))[1] ?? null;
    }

    function effortLabel(effort) {
      return new Map([
        ["none", "None"], ["minimal", "Minimal"], ["low", "Light"], ["medium", "Medium"],
        ["high", "High"], ["xhigh", "Extra High"], ["max", "Max"], ["ultra", "Ultra"],
      ]).get(String(effort).toLowerCase()) ?? formatIdentifier(effort);
    }

    function selectNativeEffort(parentMenu, effort) {
      const controller = nativeComposerModelController();
      if (typeof controller?.onSelectReasoningEffort === "function") {
        controller.onSelectReasoningEffort(effort);
        if (modelSelectorPendingOutsideDismiss) {
          closeReactControlledMenu(document.querySelector("[data-codex-intelligence-trigger]"));
          modelSelectorPendingOutsideDismiss = false;
        }
        queueEnsure();
        return;
      }
      const row = nativeEffortRow(parentMenu);
      if (!row) return;
      beginNativeEffortTransaction();
      if (!setReactControlledMenuOpen(row, true)) {
        endNativeEffortTransaction();
        return;
      }
      let observer = null;
      let selectionTimer = null;
      const select = () => {
        const submenu = nativeEffortSubmenu();
        const desired = effortLabel(effort).toLowerCase();
        const item = modelMenuItems(submenu).find((candidate) => (
          nativeMenuItemLabel(candidate).toLowerCase() === desired
        ));
        if (!item) return;
        observer?.disconnect();
        clearTimeout(selectionTimer);
        const dismissAfterCommit = modelSelectorPendingOutsideDismiss;
        if (!invokeNativeMenuItemSelect(item)) {
          endNativeEffortTransaction();
          queueEnsure();
          return;
        }
        if (dismissAfterCommit) {
          closeReactControlledMenu(item);
          closeReactControlledMenu(document.querySelector("[data-codex-intelligence-trigger]"));
          modelSelectorPendingReturn = false;
          endNativeEffortTransaction();
          return;
        }
        scheduleModelSliderReturn();
      };
      observer = new MutationObserver(select);
      observer.observe(document.body, { childList: true, subtree: true });
      selectionTimer = setTimeout(() => {
        observer.disconnect();
        endNativeEffortTransaction();
        queueEnsure();
      }, 1_500);
      select();
    }

    function setGenericSliderVisual(rail, index, count) {
      const progress = count <= 1 ? 0 : (index / (count - 1)) * 100;
      const nativeRange = rail.querySelector("[data-codex-model-slider-native-range]");
      const nativeThumb = rail.querySelector("[data-codex-model-slider-native-thumb]");
      if (nativeRange && nativeThumb) {
        const thumbRadius = 13;
        const correction = thumbRadius - (progress / 50) * thumbRadius;
        const segment = count <= 1 ? 100 : 100 / (count - 1);
        const edgeScale = Math.min(progress / segment, (100 - progress) / segment, 1);
        const edgeCorrection = correction * Math.max(0, edgeScale);
        nativeRange.style.transform = `translateX(calc(${progress - 100}% + ${edgeCorrection}px))`;
        nativeThumb.style.left = `calc(${progress}% + ${correction}px)`;
        const particleClip = rail.querySelector('[class*="_FastParticleClip_"]');
        if (particleClip) particleClip.style.clipPath = `inset(0 calc(${100 - progress}% - ${edgeCorrection}px) 0 0)`;
      }
      rail.style.setProperty("--codex-model-slider-progress", `${progress}%`);
      rail.querySelectorAll("[data-codex-model-slider-tick]").forEach((tick, tickIndex) => {
        tick.setAttribute("data-selected", String(tickIndex <= index));
      });
      rail.setAttribute("aria-valuenow", String(index));
    }

    function nativeParticleSeed(index, salt) {
      const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    }

    function syncNativeFastParticles(rail, enabled) {
      const track = Array.from(rail.children).find((element) => String(element.className).includes("_Track_"));
      if (!track) return;
      track.querySelectorAll('[class*="_FastParticleClip_"]').forEach((element) => element.remove());
      if (!enabled || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const clipClass = nativeCssModuleClass("FastParticleClip");
      const particlesClass = nativeCssModuleClass("FastTrackParticles");
      const pathClass = nativeCssModuleClass("FastTrackParticlePath");
      const particleClass = nativeCssModuleClass("TrackParticle");
      if (!clipClass || !particlesClass || !pathClass || !particleClass) return;
      const clip = document.createElement("span");
      clip.className = clipClass;
      clip.setAttribute("aria-hidden", "true");
      clip.style.opacity = "1";
      const particles = document.createElement("span");
      particles.className = particlesClass;
      particles.setAttribute("aria-hidden", "true");
      particles.setAttribute("data-animation-active", "true");
      const travelDuration = 1.9;
      const stagger = travelDuration / 14;
      const valueMax = Number(rail.getAttribute("aria-valuemax") ?? 0);
      const valueNow = Number(rail.getAttribute("aria-valuenow") ?? 0);
      const initialStartPercent = valueMax > 0 ? (valueNow / valueMax) * 100 : 0;
      const remainingTravel = 1 - Math.min(Math.max(initialStartPercent, 0), 100) / 100;
      particles.append(...Array.from({ length: 14 }, (_, index) => {
        const speed = 1 + (nativeParticleSeed(index, 21) - 0.5) * 0.4;
        const duration = travelDuration / speed;
        const path = document.createElement("span");
        path.className = pathClass;
        path.style.animationDelay = `${index * stagger - duration * remainingTravel}s`;
        path.style.animationDuration = `${duration}s`;
        path.style.top = `${12 + nativeParticleSeed(index, 23) * 76}%`;
        const particle = document.createElement("span");
        particle.className = particleClass;
        particle.style.opacity = String(0.4 + nativeParticleSeed(index, 11) * 0.6);
        particle.style.transform = `translate(-50%, -50%) scale(${0.5 + nativeParticleSeed(index, 12) * 0.45})`;
        path.append(particle);
        return path;
      }));
      clip.append(particles);
      const tickRail = Array.from(track.children).find((element) => String(element.className).includes("_TickRail_"));
      track.insertBefore(clip, tickRail ?? null);
    }

    function syncGenericFastVisual(shell, enabled, maxPowerSelection, animate = false) {
      const button = shell.querySelector("[data-codex-model-slider-fast]");
      const rail = shell.querySelector("[data-codex-model-slider-rail]");
      if (!button || !rail) return;
      button.setAttribute("aria-pressed", String(enabled));
      button.setAttribute("data-fast-mode-enabled", String(enabled));
      button.setAttribute("data-max-power-selection", String(maxPowerSelection));
      button.setAttribute("aria-label", enabled
        ? (locale === "zh-CN" ? "关闭 Fast 模式" : "Disable Fast mode")
        : (locale === "zh-CN" ? "开启 Fast 模式" : "Enable Fast mode"));
      const icon = createNativeFastIcon(enabled);
      const content = button.querySelector("[data-codex-model-slider-fast-content]");
      if (icon && content) content.replaceChildren(icon);
      rail.setAttribute("data-fast-mode", String(enabled));
      rail.setAttribute("data-fast-mode-dot-transition", animate ? (enabled ? "entering" : "exiting") : (enabled ? "active" : "inactive"));
      syncNativeFastParticles(rail, enabled);
      setGenericSliderVisual(rail, Number(rail.getAttribute("aria-valuenow") ?? 0), Number(rail.getAttribute("aria-valuemax") ?? 0) + 1);
      if (animate) {
        setTimeout(() => {
          if (rail.isConnected && rail.getAttribute("data-fast-mode") === String(enabled)) {
            rail.setAttribute("data-fast-mode-dot-transition", enabled ? "active" : "inactive");
          }
        }, enabled ? 1_200 : 350);
      }
    }

    function cloneNativePowerSlider(parentMenu, count, fastEnabled) {
      const template = parentMenu.firstElementChild?.querySelector("[data-model-picker-power-slider]");
      if (!template) return null;
      const clone = template.cloneNode(true);
      clone.setAttribute("data-codex-model-slider-native-slider", "");
      clone.removeAttribute("data-keyboard-focused");
      const root = clone.firstElementChild;
      if (!root) return null;
      const nativeInput = clone.querySelector('[role="slider"]');
      nativeInput?.removeAttribute("role");
      nativeInput?.removeAttribute("tabindex");
      nativeInput?.removeAttribute("aria-valuemin");
      nativeInput?.removeAttribute("aria-valuemax");
      nativeInput?.removeAttribute("aria-valuenow");
      root.setAttribute("role", "slider");
      root.removeAttribute("aria-hidden");
      root.removeAttribute("data-disabled");
      root.removeAttribute("disabled");
      root.setAttribute("tabindex", "0");
      root.setAttribute("aria-valuemax", String(Math.max(0, count - 1)));
      root.setAttribute("data-fast-mode", String(fastEnabled));
      root.setAttribute("data-fast-mode-dot-transition", fastEnabled ? "active" : "inactive");
      root.setAttribute("data-max", "false");
      root.setAttribute("data-endpoint-labels-visible", "false");
      const range = Array.from(root.querySelectorAll("span")).find((element) => (
        String(element.className).includes("_Range_")
      ));
      const thumbScale = Array.from(root.querySelectorAll("span")).find((element) => (
        String(element.className).includes("_ThumbScale_")
      ));
      const tickRail = Array.from(root.querySelectorAll("div")).find((element) => (
        String(element.className).includes("_TickRail_")
      ));
      const tickTemplate = tickRail?.querySelector("span");
      if (!range || !thumbScale || !tickRail || !tickTemplate) return null;
      range.setAttribute("data-codex-model-slider-native-range", "");
      thumbScale.setAttribute("data-codex-model-slider-native-thumb", "");
      tickRail.replaceChildren(...Array.from({ length: count }, (_, index) => {
        const tick = tickTemplate.cloneNode(true);
        tick.setAttribute("data-codex-model-slider-tick", "");
        const progress = count <= 1 ? 0 : (index / (count - 1)) * 100;
        const correction = 13 - (progress / 50) * 13;
        tick.style.left = `calc(${progress}% + ${correction}px)`;
        return tick;
      }));
      syncNativeFastParticles(root, fastEnabled);
      return clone;
    }

    function createGenericModelSlider(parentMenu, selector, identity, model, selectedEffort) {
      const efforts = model.supportedReasoningLevels.map((level) => level.effort);
      const selectedIndex = Math.max(0, efforts.indexOf(selectedEffort));
      const classes = Object.fromEntries([
        "Menu",
        "ViewToggle",
        "ViewToggleContent",
        "ViewToggleIcon",
        "ViewControls",
        "FastModeToggle",
        "FastModeToggleContent",
        "SimpleView",
      ].map((tokenName) => [tokenName, nativeCssModuleClass(tokenName, parentMenu)]));
      if (Object.values(classes).some((name) => !name)) return null;
      const shell = document.createElement("div");
      shell.setAttribute("data-codex-model-slider-generic", `${identity.raw}:${selectedEffort}`);
      shell.className = classes.Menu;
      shell.setAttribute("data-view", "simple");
      shell.setAttribute("data-reduced-motion", String(matchMedia("(prefers-reduced-motion: reduce)").matches));
      shell.setAttribute("data-transitions-ready", "false");
      const nativeRow = nativeModelPickerRow(parentMenu);
      const modelButton = document.createElement("div");
      modelButton.className = classes.ViewToggle;
      modelButton.setAttribute("role", "button");
      modelButton.setAttribute("tabindex", "0");
      modelButton.setAttribute("data-codex-model-slider-model-button", "");
      modelButton.setAttribute("aria-label", `Model ${modelDisplayLabel(identity, selector)}`);
      const buttonContent = document.createElement("span");
      buttonContent.className = classes.ViewToggleContent;
      const buttonLabel = document.createElement("span");
      buttonLabel.textContent = modelDisplayLabel(identity, selector);
      const nativeChevron = nativeRow?.querySelector("svg")?.cloneNode(true);
      if (nativeChevron) {
        nativeChevron.className.baseVal = classes.ViewToggleIcon;
        nativeChevron.setAttribute("aria-hidden", "true");
        buttonContent.append(buttonLabel, nativeChevron);
      } else {
        buttonContent.append(buttonLabel);
      }
      modelButton.append(buttonContent);
      const openModels = () => openNativeModelSubmenu(parentMenu);
      modelButton.addEventListener("click", openModels);
      modelButton.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openModels();
      });

      const viewControls = document.createElement("div");
      viewControls.className = classes.ViewControls;
      viewControls.setAttribute("data-expanded", "false");
      viewControls.setAttribute("data-ultra-warning-visible", "false");
      const controller = nativeComposerModelController();
      const fastOption = controller?.serviceTierOptions?.find((option) => option?.value === "priority") ?? null;
      const nativeModel = nativeCatalogModelFor(identity);
      const supportsFast = Boolean(nativeModel?.slug.toLowerCase().startsWith("gpt-") && fastOption);
      const fastEnabled = Boolean(
        supportsFast && (
          controller.selectedServiceTier?.id === (fastOption.tier?.id ?? "priority")
          || controller.selectedServiceTier === fastOption.value
        ),
      );
      if (supportsFast) {
        const fastButton = document.createElement("button");
        fastButton.type = "button";
        fastButton.className = classes.FastModeToggle;
        fastButton.setAttribute("data-codex-model-slider-fast", "");
        fastButton.setAttribute("aria-pressed", String(fastEnabled));
        fastButton.setAttribute("data-fast-mode-enabled", String(fastEnabled));
        fastButton.setAttribute("data-max-power-selection", String(selectedEffort === "ultra"));
        fastButton.setAttribute("data-visible", "true");
        fastButton.setAttribute("aria-label", fastEnabled
          ? (locale === "zh-CN" ? "关闭 Fast 模式" : "Disable Fast mode")
          : (locale === "zh-CN" ? "开启 Fast 模式" : "Enable Fast mode"));
        const fastIcon = createNativeFastIcon(fastEnabled);
        const fastContent = document.createElement("span");
        fastContent.className = classes.FastModeToggleContent;
        fastContent.setAttribute("data-codex-model-slider-fast-content", "");
        if (fastIcon) fastContent.append(fastIcon);
        fastButton.append(fastContent);
        fastButton.addEventListener("click", () => {
          const nextEnabled = fastButton.getAttribute("aria-pressed") !== "true";
          syncGenericFastVisual(shell, nextEnabled, selectedEffort === "ultra", true);
          controller.onSelectServiceTier?.(nextEnabled ? fastOption.value : null);
          queueEnsure();
        });
        viewControls.append(modelButton, fastButton);
      } else {
        viewControls.append(modelButton);
      }

      const nativeSlider = cloneNativePowerSlider(parentMenu, efforts.length, fastEnabled);
      const rail = nativeSlider?.querySelector('[role="slider"]') ?? document.createElement("div");
      rail.setAttribute("data-codex-model-slider-rail", "");
      if (!nativeSlider) rail.setAttribute("data-codex-model-slider-fallback", "");
      rail.setAttribute("role", "slider");
      rail.setAttribute("tabindex", "0");
      rail.setAttribute("aria-label", locale === "zh-CN" ? "推理强度" : "Reasoning effort");
      rail.setAttribute("aria-valuemin", "0");
      rail.setAttribute("aria-valuemax", String(efforts.length - 1));
      rail.setAttribute("aria-valuetext", effortLabel(efforts[selectedIndex]));
      if (!nativeSlider) {
        const track = document.createElement("div");
        track.setAttribute("data-codex-model-slider-track", "");
        const range = document.createElement("div");
        range.setAttribute("data-codex-model-slider-range", "");
        track.append(range);
        efforts.forEach((_effort, index) => {
          const tick = document.createElement("span");
          tick.setAttribute("data-codex-model-slider-tick", "");
          tick.style.left = `${efforts.length <= 1 ? 0 : (index / (efforts.length - 1)) * 100}%`;
          track.append(tick);
        });
        const thumb = document.createElement("span");
        thumb.setAttribute("data-codex-model-slider-thumb", "");
        rail.append(track, thumb);
      }
      setGenericSliderVisual(rail, selectedIndex, efforts.length);
      syncNativeFastParticles(rail, fastEnabled);
      setGenericSliderVisual(rail, selectedIndex, efforts.length);

      let pendingIndex = selectedIndex;
      let dragging = false;
      let dragRect = null;
      let previewFrame = null;
      let pendingClientX = null;
      const indexAt = (clientX) => {
        const rect = dragRect ?? rail.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
        return Math.round(ratio * (efforts.length - 1));
      };
      const preview = (clientX) => {
        pendingIndex = indexAt(clientX);
        setGenericSliderVisual(rail, pendingIndex, efforts.length);
        rail.setAttribute("aria-valuetext", effortLabel(efforts[pendingIndex]));
      };
      rail.addEventListener("pointerdown", (event) => {
        dragging = true;
        dragRect = rail.getBoundingClientRect();
        rail.setPointerCapture?.(event.pointerId);
        preview(event.clientX);
      });
      rail.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        pendingClientX = event.clientX;
        if (previewFrame != null) return;
        previewFrame = requestAnimationFrame(() => {
          previewFrame = null;
          if (dragging && pendingClientX != null) preview(pendingClientX);
        });
      });
      rail.addEventListener("pointerup", (event) => {
        if (!dragging) return;
        dragging = false;
        if (previewFrame != null) cancelAnimationFrame(previewFrame);
        previewFrame = null;
        pendingClientX = null;
        preview(event.clientX);
        dragRect = null;
        selectNativeEffort(parentMenu, efforts[pendingIndex]);
      });
      rail.addEventListener("pointercancel", () => {
        dragging = false;
        if (previewFrame != null) cancelAnimationFrame(previewFrame);
        previewFrame = null;
        pendingClientX = null;
        dragRect = null;
      });
      rail.addEventListener("keydown", (event) => {
        if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") pendingIndex = 0;
        else if (event.key === "End") pendingIndex = efforts.length - 1;
        else pendingIndex = Math.min(
          efforts.length - 1,
          Math.max(0, pendingIndex + (event.key === "ArrowRight" ? 1 : -1)),
        );
        setGenericSliderVisual(rail, pendingIndex, efforts.length);
        rail.setAttribute("aria-valuetext", effortLabel(efforts[pendingIndex]));
        selectNativeEffort(parentMenu, efforts[pendingIndex]);
      });
      const simpleView = document.createElement("div");
      simpleView.className = classes.SimpleView;
      simpleView.append(nativeSlider ?? rail);
      shell.append(viewControls, simpleView);
      return shell;
    }

    function enhanceGenericModelPicker(parentMenu, selector) {
      const identity = modelIdentity(nativeModelValue(parentMenu));
      const model = modelDefinitionFor(identity, selector);
      const efforts = model?.supportedReasoningLevels ?? [];
      if (!model || efforts.length < 2) return false;
      // 控制器推导的任务内实际 effort 优先，避免子任务/主任务切换后触发器属性滞后；
      // 触发器属性仅在控制器无法解析时作为实时回退，静态目录默认值最后兜底。
      const nativeModel = nativeCatalogModelFor(identity);
      const selectedEffort = nativeModel?.defaultReasoningLevel
        ?? document.querySelector("[data-codex-intelligence-trigger]")
          ?.getAttribute("data-selected-reasoning-effort")
        ?? model.defaultReasoningLevel
        ?? efforts[0].effort;
      const selectedServiceTier = nativeComposerModelController()?.selectedServiceTier;
      const serviceTierKey = selectedServiceTier?.id ?? selectedServiceTier ?? "standard";
      const key = `${identity.raw}:${selectedEffort}:${serviceTierKey}:${efforts.map((level) => level.effort).join(",")}`;
      const existing = parentMenu.querySelector(":scope > [data-codex-model-slider-generic]");
      const nativeTemplateReady = Boolean(
        parentMenu.firstElementChild
          ?.querySelector("[data-model-picker-power-slider] [class*='_TickRail_'] > span"),
      );
      const templateWaitCount = Number(parentMenu.getAttribute("data-codex-model-slider-template-wait") ?? 0);
      if (nativeModel?.slug.toLowerCase().startsWith("gpt-") && !nativeTemplateReady && templateWaitCount < 3) {
        parentMenu.setAttribute("data-codex-model-slider-template-wait", String(templateWaitCount + 1));
        parentMenu.style.visibility = "hidden";
        requestAnimationFrame(queueEnsure);
        return true;
      }
      parentMenu.removeAttribute("data-codex-model-slider-template-wait");
      parentMenu.style.removeProperty("visibility");
      const canUpgradeFallback = Boolean(
        existing?.querySelector("[data-codex-model-slider-fallback]") && nativeTemplateReady,
      );
      if (existing?.getAttribute("data-codex-model-slider-generic") === key && !canUpgradeFallback) return true;
      existing?.remove();
      const nativeContainer = parentMenu.firstElementChild;
      if (!nativeContainer) return false;
      const shell = createGenericModelSlider(parentMenu, selector, identity, model, selectedEffort);
      if (!shell) return false;
      if (!modelSelectorGenericContainers.has(nativeContainer)) {
        modelSelectorGenericContainers.set(nativeContainer, nativeContainer.style.display);
      }
      parentMenu.setAttribute("data-codex-model-slider-generic-menu", "");
      nativeContainer.style.display = "none";
      shell.setAttribute("data-codex-model-slider-generic", key);
      parentMenu.append(shell);
      return true;
    }

    function enhanceNativeModelPicker(parentMenu, selector) {
      if (enhanceGenericModelPicker(parentMenu, selector)) return;
      const toggle = parentMenu.querySelector("[data-model-picker-view-toggle]");
      if (!toggle) {
        enhanceGenericModelPicker(parentMenu, selector);
        return;
      }
      parentMenu.querySelector(":scope > [data-codex-model-slider-generic]")?.remove();
      parentMenu.removeAttribute("data-codex-model-slider-generic-menu");
      const nativeContainer = parentMenu.firstElementChild;
      if (nativeContainer && modelSelectorGenericContainers.has(nativeContainer)) {
        nativeContainer.style.display = modelSelectorGenericContainers.get(nativeContainer);
        modelSelectorGenericContainers.delete(nativeContainer);
      }
      const raw = nativeModelValue(parentMenu);
      const textNode = firstVisibleTextNode(toggle);
      if (raw && textNode) {
        if (!modelSelectorOriginalToggleLabels.has(textNode)) {
          modelSelectorOriginalToggleLabels.set(textNode, textNode.textContent);
        }
        const label = modelDisplayLabel(modelIdentity(raw), selector);
        if (textNode.textContent !== label) textNode.textContent = label;
      }
      if (!toggle.hasAttribute("data-codex-model-slider-toggle")) {
        toggle.setAttribute("data-codex-model-slider-toggle", "");
        toggle.addEventListener("click", () => openNativeModelSubmenu(parentMenu));
      }
    }

    function enhanceComposerModelTrigger(selector) {
      const trigger = document.querySelector("[data-codex-intelligence-trigger]");
      if (!trigger) return;
      if (modelSelectorObservedTrigger !== trigger) {
        modelSelectorTriggerObserver?.disconnect();
        modelSelectorObservedTrigger = trigger;
        modelSelectorTriggerObserver = new MutationObserver(queueEnsure);
        modelSelectorTriggerObserver.observe(trigger, { childList: true, subtree: true, characterData: true });
      }
      const nativeLabels = Array.from(trigger.querySelectorAll(
        '[class*="_ModelPickerTriggerModelText_"]:not([data-codex-model-slider-trigger-label])',
      ));
      if (!nativeLabels.length) return;
      const visibleValue = String(nativeLabels.at(-1)?.textContent ?? "").trim();
      const previousRaw = trigger.getAttribute("data-codex-model-slider-trigger-raw") ?? "";
      const previousLabel = previousRaw
        ? modelDisplayLabel(modelIdentity(previousRaw), selector)
        : "";
      const raw = !previousRaw || visibleValue !== previousLabel ? visibleValue : previousRaw;
      if (!raw) return;
      const label = modelDisplayLabel(modelIdentity(raw), selector);
      trigger.setAttribute("data-codex-model-slider-trigger", "");
      trigger.setAttribute("data-codex-model-slider-trigger-raw", raw);
      for (const nativeLabel of nativeLabels) {
        let displayLabel = nativeLabel.nextElementSibling;
        if (!displayLabel?.hasAttribute("data-codex-model-slider-trigger-label")) {
          displayLabel = document.createElement("span");
          displayLabel.className = nativeLabel.className;
          displayLabel.setAttribute("data-codex-model-slider-trigger-label", "");
          nativeLabel.after(displayLabel);
        }
        if (displayLabel.textContent !== label) displayLabel.textContent = label;
      }
    }

    function ensureModelSelector() {
      const selector = modelSelectorFeature?.modelSelector;
      if (!selector) return;
      captureNativeFastIcon();
      pruneModelSubmenuPositionObservers();
      if (!modelSelectorStyle.isConnected) document.head?.append(modelSelectorStyle);
      enhanceComposerModelTrigger(selector);
      const parentMenu = nativeModelPickerMenu();
      if (!parentMenu) {
        if (modelSelectorPendingReturn && !visibleBlockingDialog() && modelSelectorReturnTimer == null) {
          modelSelectorReturnTimer = setTimeout(() => {
            modelSelectorReturnTimer = null;
            returnToNativeModelSlider();
          }, 80);
        }
        return;
      }
      enhanceNativeModelPicker(parentMenu, selector);
      const submenu = nativeModelSubmenu(parentMenu);
      if (submenu) enhanceNativeModelSubmenu(submenu, selector);
    }

    function restoreModelSelectorEnhancements() {
      clearTimeout(modelSelectorReturnTimer);
      clearTimeout(modelSelectorEffortTransactionTimer);
      modelSelectorTriggerObserver?.disconnect();
      for (const record of modelSelectorPositionObservers.values()) {
        record.observer.disconnect();
        record.resizeObserver.disconnect();
      }
      modelSelectorPositionObservers.clear();
      for (const frame of modelSelectorMenuSizeFrames.values()) cancelAnimationFrame(frame);
      modelSelectorMenuSizeFrames.clear();
      modelSelectorTriggerObserver = null;
      modelSelectorObservedTrigger = null;
      modelSelectorReturnTimer = null;
      modelSelectorEffortTransactionTimer = null;
      modelSelectorPendingOutsideDismiss = false;
      modelSelectorSuppressOutsidePointerSequence = false;
      modelSelectorPendingReturn = false;
      document.documentElement.removeAttribute("data-codex-model-slider-selecting-effort");
      for (const [item, html] of modelSelectorOriginalItems) {
        if (!item.isConnected) continue;
        item.innerHTML = html;
        item.style.removeProperty("display");
        for (const name of [
          "data-codex-model-slider-raw",
          "data-codex-model-slider-item",
          "data-codex-model-slider-order",
          "data-codex-model-slider-identity-source",
          "data-codex-model-slider-return-listener",
        ]) item.removeAttribute(name);
      }
      for (const [node, value] of modelSelectorOriginalToggleLabels) {
        if (node.isConnected) node.textContent = value;
      }
      for (const [container, display] of modelSelectorGenericContainers) {
        if (container.isConnected) container.style.display = display;
      }
      document.querySelectorAll("[data-codex-model-slider-divider]")
        .forEach((element) => element.remove());
      document.querySelectorAll("[data-codex-model-slider-generic]").forEach((element) => element.remove());
      document.querySelectorAll("[data-codex-model-slider-generic-menu]")
        .forEach((element) => element.removeAttribute("data-codex-model-slider-generic-menu"));
      document.querySelectorAll("[data-codex-model-slider-menu]")
        .forEach((element) => element.removeAttribute("data-codex-model-slider-menu"));
      document.querySelectorAll("[data-codex-model-slider-trigger]").forEach((element) => {
        element.removeAttribute("data-codex-model-slider-trigger");
        element.removeAttribute("data-codex-model-slider-trigger-raw");
      });
      document.querySelectorAll("[data-codex-model-slider-trigger-label]").forEach((element) => element.remove());
      document.documentElement.removeAttribute("data-codex-model-slider-catalog-ready");
      modelSelectorStyle.remove();
      modelSelectorOriginalItems.clear();
      modelSelectorOriginalToggleLabels.clear();
      modelSelectorGenericContainers.clear();
    }

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

    function postSurfaceActive(record, active) {
      if (!record || record.kind !== "page") return;
      record.frame.contentWindow?.postMessage({
        type: "codex-personal:surface-active",
        active: Boolean(active),
      }, record.origin);
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

    function resolvedTheme() {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      const tokens = Object.fromEntries(
        themeTokenNames
          .map((name) => [name, style.getPropertyValue(name).trim()])
          .filter(([, value]) => value),
      );
      const mode = root.classList.contains("electron-dark") || style.colorScheme === "dark"
        ? "dark"
        : "light";
      return { root, style, tokens, mode };
    }

    function sendTheme() {
      themeQueued = false;
      const { style, tokens, mode } = resolvedTheme();
      const radiusToken = tokens["--radius-3xl-base"] ?? "20px";
      const radiusBase = Number.parseFloat(radiusToken) || 20;
      const radiusUnit = radiusToken.match(/[a-z%]+$/i)?.[0] ?? "px";
      const radiusScale = Number.parseFloat(tokens["--codex-corner-radius-scale"] ?? "1.25") || 1.25;
      const panelRadius = `${radiusBase * radiusScale}${radiusUnit}`;
      const panelCornerShape = tokens["--codex-corner-shape"] ?? "superellipse(1.5)";
      const dialogRadius = tokens["--radius-2xl"] ?? "20px";
      const dialogShadow = "0 16px 32px -8px rgba(0,0,0,.19)";
      const surfaceTokens = {
        ...tokens,
        "--codex-summary-section-title-font-size": "14px",
        "--codex-summary-section-title-line-height": "21px",
        "--codex-summary-section-title-font-weight": tokens["--font-weight-normal"] ?? "400",
        "--codex-summary-row-font-size": "16px",
        "--codex-summary-row-line-height": "24px",
        "--codex-summary-label-font-size": tokens["--text-base"] ?? "14px",
        "--codex-summary-label-line-height": tokens["--text-base--line-height"] ?? "1.5",
        "--codex-summary-font-weight": tokens["--vscode-font-weight"] ?? (style.fontWeight || "445"),
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
        if (record.kind === "modal") {
          record.element.style.borderRadius = dialogRadius;
          record.element.style.setProperty("corner-shape", "round");
          record.element.style.boxShadow = dialogShadow;
        }
        record.element.style.background = new Set(["pinned", "modal"]).has(record.kind)
          ? tokens["--color-token-dropdown-background"]
            ?? tokens["--color-token-main-surface-primary"]
            ?? style.backgroundColor
          : tokens["--color-token-main-surface-primary"] ?? style.backgroundColor;
        record.frame.contentWindow?.postMessage(
          { type: "codex-personal:theme", theme: mode, mode, locale, tokens: surfaceTokens },
          record.origin,
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

    function updatePageSurfacePositions() {
      const left = `${Math.max(0, sidebarRight())}px`;
      for (const surface of pageSurfaces.values()) surface.style.left = left;
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
      savedComposerRange = null;
      savedComposerThread = null;
      hidePinnedSurfaces();
    }

    function currentComposer() {
      const marked = document.querySelector('[data-codex-composer="true"][contenteditable="true"]');
      if (marked) return marked;
      return Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"]'))
        .find((element) => isVisibleToolbarControl(element)) ?? null;
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

    function insertComposerText(text) {
      if (typeof text !== "string" || !text) throw new Error("Text is required");
      const composer = currentComposer();
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
        suppressedSelections.push({
          element,
          ariaCurrent: element.getAttribute("aria-current"),
          threadSelected: element.getAttribute("data-app-action-sidebar-thread-selected"),
          hadActiveClass: element.classList.contains("bg-token-list-hover-background"),
          hadHoverClass: element.classList.contains("hover:bg-token-list-hover-background"),
        });
        element.removeAttribute("aria-current");
        element.removeAttribute("data-app-action-sidebar-thread-selected");
        element.classList.remove("bg-token-list-hover-background");
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
        if (entry.getAttribute("title") !== label) entry.setAttribute("title", label);
        if (entry.getAttribute("aria-pressed") !== pressed) entry.setAttribute("aria-pressed", pressed);
        if (entry.getAttribute("aria-expanded") !== pressed) entry.setAttribute("aria-expanded", pressed);
        if (entry.getAttribute("data-state") !== state) entry.setAttribute("data-state", state);
        entry.setAttribute("data-codex-personal-summary-mode", displayMode);
      }
    }

    function createFrame(featureId, title) {
      const frame = document.createElement("iframe");
      frame.name = surfaceFrameName(featureId);
      frame.src = "about:blank";
      frame.title = title;
      frame.allow = "clipboard-write";
      frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:transparent";
      return frame;
    }

    function createPageSurface(feature) {
      const surface = document.createElement("section");
      surface.setAttribute(pageSurfaceMarker, feature.id);
      surface.style.cssText = [
        "position:fixed",
        "top:0",
        "right:0",
        "bottom:0",
        "z-index:40",
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
      const surface = existing ?? createPageSurface(feature);
      if (existing) reloadSurfaceIfUnready(surfaceKey(feature.id, "page"), feature.surfaceUrl);
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

    function threadScrollContent() {
      const scrollContainer = mainContentViewport()?.querySelector(".thread-scroll-container");
      return scrollContainer?.firstElementChild instanceof HTMLElement
        ? scrollContainer.firstElementChild
        : null;
    }

    function restoreThreadContentShift() {
      if (!shiftedThreadContent || !shiftedThreadOriginal) return;
      const { element, position, left, transition } = shiftedThreadOriginal;
      if (element.isConnected) {
        element.style.setProperty("position", position.value, position.priority);
        element.style.setProperty("left", left.value, left.priority);
        element.style.setProperty("transition", transition.value, transition.priority);
        element.removeAttribute("data-codex-personal-summary-shift");
      }
      shiftedThreadContent = null;
      shiftedThreadOriginal = null;
    }

    function applyThreadContentShift(value) {
      if (value === 0) {
        restoreThreadContentShift();
        return;
      }
      if (!threadShiftStyle.isConnected) {
        (document.head ?? document.documentElement)?.append(threadShiftStyle);
      }
      const content = threadScrollContent();
      if (!content) {
        restoreThreadContentShift();
        return;
      }
      if (shiftedThreadContent !== content) {
        restoreThreadContentShift();
        shiftedThreadContent = content;
        shiftedThreadOriginal = {
          element: content,
          position: {
            value: content.style.getPropertyValue("position"),
            priority: content.style.getPropertyPriority("position"),
          },
          left: {
            value: content.style.getPropertyValue("left"),
            priority: content.style.getPropertyPriority("left"),
          },
          transition: {
            value: content.style.getPropertyValue("transition"),
            priority: content.style.getPropertyPriority("transition"),
          },
        };
      }
      const duration = reducedMotion() ? 0 : 300;
      content.style.setProperty("transition", duration
        ? "left 300ms cubic-bezier(.2,.8,.2,1)"
        : "none", "important");
      content.style.setProperty("position", "relative", "important");
      content.style.setProperty("left", `${value}px`, "important");
      content.setAttribute("data-codex-personal-summary-shift", String(value));
      if (duration) window.setTimeout(() => {
        if (content.getAttribute("data-codex-personal-summary-shift") !== String(value)) return;
        content.style.setProperty("transition", "none", "important");
        content.style.setProperty("left", `${value}px`, "important");
      }, duration + 50);
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

      const shift = displayMode === "shift"
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
      surface.style.cssText = [
        "position:fixed",
        "z-index:40",
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
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:50",
        "background:rgba(0,0,0,.133)",
      ].join(";");

      const dialog = document.createElement("section");
      dialog.setAttribute(modalSurfaceMarker, feature.id);
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
        "border:1px solid transparent",
        "border-radius:20px",
        "corner-shape:round",
        "background:var(--color-token-dropdown-background,var(--color-token-main-surface-primary))",
        "box-shadow:0 16px 32px -8px rgba(0,0,0,.19)",
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

    function nativeTabModuleUrl() {
      return Array.from(document.querySelectorAll('link[rel="modulepreload"]'))
        .map((link) => link.href)
        .find((url) => /\/assets\/app-initial-[^/]+\.js(?:\?|$)/.test(url)) ?? null;
    }

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
      const deadline = performance.now() + 2_000;
      do {
        const moduleUrl = nativeTabModuleUrl();
        if (moduleUrl) return moduleUrl;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } while (performance.now() < deadline);
      return null;
    }

    async function loadNativeTabCapability() {
      if (nativeTabCapability) return nativeTabCapability;
      if (nativeTabCapabilityPromise) return nativeTabCapabilityPromise;
      nativeTabCapabilityPromise = (async () => {
        try {
          const moduleUrl = await waitForNativeTabModuleUrl();
          if (!moduleUrl) throw new Error("Codex app-initial modulepreload was not found");
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
        controller.openTab(scope, nativeDetailComponent(feature, detail), {
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
      if (!result) throw nativeTabCapabilityError
        ?? new Error("Codex native right-panel tabs are unavailable");
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
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
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
      const featureIcon = createFeatureIcon(feature, originalIcon?.getAttribute("class"), 20);
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
      if (!toolbarFeatures.length) return;
      const temporaryChatButton = nativeTemporaryChatButton();
      const summaryButton = nativeSummaryButton();
      const bottomPanelButton = nativeBottomPanelButton();
      const sidePanelButton = nativeSidePanelButton();
      const anchorButton = temporaryChatButton ?? summaryButton ?? bottomPanelButton ?? sidePanelButton;
      if (!anchorButton) return;
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
      if (!targetGroup) return;
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
    }

    function ensureEntries() {
      ensureQueued = false;
      ensureFrame = null;
      ensureTimer = null;
      ensureSidebarEntries();
      ensureToolbarEntries();
      ensureModelSelector();
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

    function findMessageSurface(event) {
      for (const record of surfaceRecords.values()) {
        if (event.origin === record.origin && event.source === record.frame.contentWindow) return record;
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
      }, record.origin);
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
        if (action === "resolve-file-paths") {
          const getPathForFile = window.electronBridge?.getPathForFile;
          if (typeof getPathForFile !== "function") {
            throw new Error("Codex did not expose its File path bridge");
          }
          const files = Array.isArray(payload.files) ? payload.files : [];
          if (!files.length || files.some((file) => !(file instanceof File))) {
            throw new Error("Real dropped File objects are required");
          }
          const paths = files.map((file) => getPathForFile(file)).filter((value) => (
            typeof value === "string" && value.startsWith("/")
          ));
          if (!paths.length) throw new Error("Codex could not resolve the dropped file paths");
          respondToSurface(record, requestId, { ok: true, result: { paths } });
          return;
        }
        if (action === "attach-file") {
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
          error: { code: "HOST_ACTION_FAILED", message: error.message },
        });
      }
    }

    function resolveHostAction(requestId, response) {
      const pending = pendingHostActions.get(requestId);
      if (!pending) return false;
      pendingHostActions.delete(requestId);
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
        if (record.kind === "modal") {
          record.frame.focus();
          record.frame.contentWindow?.postMessage({
            type: "codex-personal:focus",
            feature: record.featureId,
          }, record.origin);
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
    const ensureObserver = new MutationObserver(queueEnsure);
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
      attributeFilter: ["class", "style"],
    });
    domObservers.push(themeObserver);

    const runtimeApi = {
      version: config.version,
      sessionId: config.sessionId,
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
        for (const cleanup of pageScriptCleanups.splice(0)) {
          try { cleanup(); } catch (error) {
            console.warn("[codex-personal] page-script cleanup failed", error);
          }
        }
        if (ensureFrame != null) cancelAnimationFrame(ensureFrame);
        if (ensureTimer != null) clearTimeout(ensureTimer);
        for (const observer of domObservers) observer.disconnect();
        mainContentObserver?.observer.disconnect();
        restoreThreadContentShift();
        threadShiftStyle.remove();
        for (const root of document.querySelectorAll("[data-codex-personal-toolbar-entry]")) root.remove();
        for (const group of document.querySelectorAll("[data-codex-personal-summary-toolbar-group]")) group.remove();
        for (const surface of pageSurfaces.values()) surface.remove();
        for (const surface of pinnedSurfaces.values()) surface.remove();
        closePromptPreview({ immediate: true });
        closeModalSurface();
        closeNativeDetailTabs();
        restoreModelSelectorEnhancements();
        surfaceRecords.clear();
        if (window.__codexPersonalRuntime === runtimeApi) delete window.__codexPersonalRuntime;
      },
    };
    window.__codexPersonalRuntime = runtimeApi;
    currentThread = threadIdentity();
    currentSummaryDisplayMode = summaryDisplayMode();
    queueEnsure();
  }

  const runtimeFeatures = features.map((feature) => ({
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
    pageScript: feature.pageScript ?? null,
  }));
  return `(${install.toString()})(${JSON.stringify({
    version: RUNTIME_VERSION,
    sessionId: runtimeSessionId,
    bindingName,
    bindingToken,
    summaryLayout: RESPONSIVE_SUMMARY_LAYOUT,
    rightPanelRouteKinds: RIGHT_PANEL_ROUTE_KINDS,
    features: runtimeFeatures,
  })})`;
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
  const injectedTargets = Math.max(0, Number(renderer.injectedTargets) || 0);
  const active = Boolean(renderer.active) && discovered && injectedTargets > 0;
  return {
    pid,
    features: features.map((feature) => typeof feature === "string" ? feature : feature.id),
    failures,
    runtimeSessionId,
    plugins: plugins.map((plugin) => ({
      featureId: plugin.featureId,
      state: active && (plugin.state === "configured" || plugin.state === "ready")
        ? "injected"
        : plugin.state,
      owned: Boolean(plugin.owned),
      health: plugin.health ?? null,
      failure: plugin.failure ?? null,
    })),
    renderer: {
      discovered,
      injectedTargets,
      active,
      runtimeSessionId: renderer.runtimeSessionId ?? runtimeSessionId,
    },
  };
}

function createDocumentBootstrapSource(source) {
  return `window[${JSON.stringify(CSP_BOOTSTRAP_KEY)}] = ${CSP_BOOTSTRAP_VERSION};\n${source}`;
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const eventWaiters = new Map();
  const eventListeners = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) {
      for (const listener of eventListeners.get(message.method) ?? []) listener(message.params);
      const waiters = eventWaiters.get(message.method) ?? [];
      eventWaiters.delete(message.method);
      for (const waiter of waiters) waiter.resolve(message.params);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    const error = new Error("CDP WebSocket closed");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    for (const waiters of eventWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error);
    }
    eventWaiters.clear();
    eventListeners.clear();
  });

  return {
    socket,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, listener) {
      const listeners = eventListeners.get(method) ?? new Set();
      listeners.add(listener);
      eventListeners.set(method, listeners);
      return () => listeners.delete(listener);
    },
    waitFor(method, timeoutMs) {
      return new Promise((resolve, reject) => {
        const waiters = eventWaiters.get(method) ?? [];
        const waiter = {
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject,
        };
        const timeout = setTimeout(() => {
          const remaining = (eventWaiters.get(method) ?? []).filter((item) => item !== waiter);
          if (remaining.length) eventWaiters.set(method, remaining);
          else eventWaiters.delete(method);
          reject(new Error(`Timed out waiting for CDP event ${method}`));
        }, timeoutMs);
        waiters.push(waiter);
        eventWaiters.set(method, waiters);
      });
    },
  };
}

async function waitForExpression(client, expression, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await client.send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.result?.value) return;
    } catch {
      // Reloading briefly destroys the previous execution context.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for renderer state: ${expression}`);
}

function evaluationValue(result) {
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

function requireCdpWebSocketUrl(version, expectedCdpPort) {
  const value = typeof version?.webSocketDebuggerUrl === "string"
    ? version.webSocketDebuggerUrl.trim()
    : "";
  if (!value) {
    throw new Error("Codex CDP /json/version is missing webSocketDebuggerUrl");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Codex CDP webSocketDebuggerUrl is invalid");
  }
  if (!new Set(["ws:", "wss:"]).has(parsed.protocol) || !parsed.host) {
    throw new Error("Codex CDP webSocketDebuggerUrl must use ws: or wss:");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
    throw new Error("Codex CDP webSocketDebuggerUrl must use a loopback host");
  }
  const configuredPort = Number(expectedCdpPort);
  const effectivePort = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === "wss:" ? 443 : 80;
  if (!Number.isInteger(configuredPort) || effectivePort !== configuredPort) {
    throw new Error(`Codex CDP webSocketDebuggerUrl must use configured CDP port ${expectedCdpPort}`);
  }
  return value;
}

function processChildHasExited(child) {
  return child && (
    (child.exitCode !== null && child.exitCode !== undefined)
    || (child.signalCode !== null && child.signalCode !== undefined)
  );
}

function waitForProcessChildExit(child, timeoutMs) {
  if (processChildHasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener?.("exit", onExit);
      resolve(exited || processChildHasExited(child));
    };
    const onExit = () => finish(true);
    child.once?.("exit", onExit);
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export class CodexRuntime {
  constructor({
    features,
    profileDir,
    appPath = "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
    cdpPort = 9231,
    logger = console,
    fetchImpl = globalThis.fetch,
    launchApplication = null,
    connectClient = connect,
    sleep = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    availabilityTimeoutMs = 20_000,
    availabilityPollMs = 500,
    monitorIntervalMs = 2_000,
    surfaceLoadTimeoutMs = 5_000,
    surfaceFramePollMs = 25,
    featureInstanceId = null,
    runtimeSessionId = randomBytes(16).toString("hex"),
    onStatusChange = null,
    onManagedCodexPidChange = null,
  }) {
    this.features = features;
    this.profileDir = profileDir;
    this.appPath = appPath;
    this.cdpPort = cdpPort;
    this.logger = logger;
    this.fetchImpl = fetchImpl;
    this.launchApplication = launchApplication;
    this.connectClient = connectClient;
    this.sleep = sleep;
    this.availabilityTimeoutMs = availabilityTimeoutMs;
    this.availabilityPollMs = availabilityPollMs;
    this.monitorIntervalMs = monitorIntervalMs;
    this.surfaceLoadTimeoutMs = surfaceLoadTimeoutMs;
    this.surfaceFramePollMs = surfaceFramePollMs;
    this.featureInstanceId = featureInstanceId;
    this.runtimeSessionId = runtimeSessionId;
    this.onStatusChange = onStatusChange;
    this.onManagedCodexPidChange = onManagedCodexPidChange;
    this.injectedTargets = new Set();
    this.clients = new Map();
    this.scriptIds = new Map();
    this.bindingTokens = new Map();
    this.hostActionChains = new Map();
    this.refreshPromise = null;
    this.stopping = false;
    this.monitorPromise = null;
    this.browserClient = null;
    this.targetRefreshQueued = false;
    this.appPid = null;
    this.managedCodexChild = null;
    this.monitorTimer = null;
    this.monitorWake = null;
    this.stopPromise = null;
    this.pidChangePromise = Promise.resolve();
    this.pidChangeQueue = null;
    this.rendererDiscovered = false;
    this.lastRendererStatus = null;
  }

  async start({ launchCodex = false } = {}) {
    this.stopping = false;
    await mkdir(this.profileDir, { recursive: true });
    const available = await this.isAvailable();
    if (!available && launchCodex) {
      const child = this.launchManagedCodex();
      try {
        await this.waitUntilAvailable();
      } catch (error) {
        if (this.managedCodexChild === child && !processChildHasExited(child)) {
          child.kill?.("SIGTERM");
          const exited = await waitForProcessChildExit(child, 500);
          if (!exited && !processChildHasExited(child)) {
            child.kill?.("SIGKILL");
            await waitForProcessChildExit(child, 500);
          }
        }
        throw error;
      }
    }

    if (available || launchCodex) {
      await this.startTargetDiscovery();
      await this.refresh();
    } else {
      this.notifyStatusChange();
    }
    await this.flushManagedCodexPidChange();
    this.monitorPromise = this.monitor();
  }

  getRendererStatus() {
    const injectedTargets = this.injectedTargets.size;
    return {
      discovered: this.rendererDiscovered,
      injectedTargets,
      active: !this.stopping && this.rendererDiscovered && injectedTargets > 0,
      runtimeSessionId: this.runtimeSessionId,
    };
  }

  notifyStatusChange() {
    const status = this.getRendererStatus();
    const previous = this.lastRendererStatus;
    if (
      previous
      && previous.discovered === status.discovered
      && previous.injectedTargets === status.injectedTargets
      && previous.active === status.active
      && previous.runtimeSessionId === status.runtimeSessionId
    ) return;
    this.lastRendererStatus = status;
    try {
      this.onStatusChange?.(status);
    } catch (error) {
      this.logger.warn?.("Runtime status update failed", error.message);
    }
  }

  notifyManagedCodexPidChange(pid) {
    const invoke = () => {
      try {
        return this.onManagedCodexPidChange?.(pid);
      } catch (error) {
        this.logger.warn?.("Managed Codex PID update failed", error.message);
        return null;
      }
    };
    const next = this.pidChangeQueue
      ? this.pidChangeQueue.catch(() => {}).then(invoke)
      : invoke();
    const tracked = Promise.resolve(next).catch((error) => {
      this.logger.warn?.("Managed Codex PID update failed", error.message);
    });
    const settled = tracked.finally(() => {
      if (this.pidChangeQueue === settled) this.pidChangeQueue = null;
    });
    this.pidChangeQueue = settled;
    this.pidChangePromise = settled;
  }

  async flushManagedCodexPidChange() {
    await this.pidChangePromise;
  }

  clearRendererState() {
    for (const client of this.clients.values()) client.socket.close();
    this.clients.clear();
    this.scriptIds.clear();
    this.bindingTokens.clear();
    this.hostActionChains.clear();
    this.injectedTargets.clear();
    this.rendererDiscovered = false;
    this.browserClient?.socket.close();
    this.browserClient = null;
    this.notifyStatusChange();
  }

  markCodexUnavailable(error) {
    this.clearRendererState();
    return error;
  }

  launchManagedCodex() {
    if (typeof this.launchApplication !== "function") {
      throw new Error("CodexRuntime requires an explicit application launcher for isolated tests.");
    }
    const child = this.launchApplication({
      appPath: this.appPath,
      args: [
        `--user-data-dir=${this.profileDir}`,
        "--remote-debugging-address=127.0.0.1",
        `--remote-debugging-port=${this.cdpPort}`,
        `--remote-allow-origins=http://127.0.0.1:${this.cdpPort}`,
        "--no-first-run",
      ],
    });
    this.managedCodexChild = child;
    this.appPid = child.pid ?? null;
    this.notifyManagedCodexPidChange(this.appPid);
    let handled = false;
    const onExit = () => {
      if (handled) return;
      handled = true;
      if (this.managedCodexChild !== child) return;
      this.managedCodexChild = null;
      this.appPid = null;
      this.notifyManagedCodexPidChange(null);
      if (this.stopping) return;
      this.clearRendererState();
    };
    child.once?.("exit", onExit);
    child.once?.("error", (error) => {
      this.logger.warn?.("Managed Codex exited before CDP became available", error.message);
      onExit();
    });
    child.unref?.();
    return child;
  }

  queueTargetRefresh() {
    if (this.targetRefreshQueued || this.stopping) return;
    this.targetRefreshQueued = true;
    queueMicrotask(() => {
      this.targetRefreshQueued = false;
      if (this.stopping) return;
      this.refresh().catch((error) => {
        this.logger.warn?.("Waiting for Codex renderer", error.message);
      });
    });
  }

  async startTargetDiscovery() {
    const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`);
    if (!response?.ok) {
      throw new Error(`Codex CDP version returned HTTP ${response?.status ?? "error"}`);
    }
    const version = await response.json();
    const webSocketDebuggerUrl = requireCdpWebSocketUrl(version, this.cdpPort);
    let client;
    try {
      client = await this.connectClient(webSocketDebuggerUrl);
      for (const method of [
        "Target.targetCreated",
        "Target.targetInfoChanged",
        "Target.targetDestroyed",
      ]) {
        client.on(method, () => this.queueTargetRefresh());
      }
      await client.send("Target.setDiscoverTargets", { discover: true });
      this.browserClient = client;
    } catch (error) {
      client?.socket.close();
      if (this.browserClient === client) this.browserClient = null;
      this.logger.warn?.("CDP target discovery unavailable; using /json/list polling", error.message);
    }
  }

  refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = this.refreshTargets()
      .catch((error) => {
        if (!this.rendererDiscovered) this.notifyStatusChange();
        throw error;
      })
      .finally(() => {
        if (this.refreshPromise === refresh) this.refreshPromise = null;
      });
    this.refreshPromise = refresh;
    return refresh;
  }

  async monitor() {
    while (!this.stopping) {
      await new Promise((resolve) => {
        this.monitorWake = () => {
          this.monitorWake = null;
          if (this.monitorTimer) clearTimeout(this.monitorTimer);
          this.monitorTimer = null;
          resolve();
        };
        this.monitorTimer = setTimeout(() => {
          this.monitorTimer = null;
          this.monitorWake = null;
          resolve();
        }, this.monitorIntervalMs);
      });
      if (this.stopping) break;
      try {
        await this.refresh();
      } catch (error) {
        this.logger.warn?.("Waiting for Codex renderer", error.message);
      }
    }
  }

  async isAvailable() {
    try {
      const response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/version`);
      if (!response?.ok) return false;
      requireCdpWebSocketUrl(await response.json(), this.cdpPort);
      return true;
    } catch {
      return false;
    }
  }

  async waitUntilAvailable() {
    const deadline = Date.now() + this.availabilityTimeoutMs;
    while (Date.now() < deadline) {
      if (this.stopping) throw new Error("RuntimeHost is stopping");
      if (await this.isAvailable()) return;
      await this.sleep(this.availabilityPollMs);
    }
    throw new Error(`Codex CDP did not become available on port ${this.cdpPort}`);
  }

  enqueueHostAction(targetId, operation) {
    const previous = this.hostActionChains.get(targetId) ?? Promise.resolve();
    const next = previous.then(operation, operation).finally(() => {
      if (this.hostActionChains.get(targetId) === next) this.hostActionChains.delete(targetId);
    });
    this.hostActionChains.set(targetId, next);
    return next;
  }

  async resolveHostAction(client, requestId, response) {
    const expression = `window.__codexPersonalRuntime?.resolveHostAction(${JSON.stringify(
      requestId,
    )}, ${JSON.stringify(response)})`;
    await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  }

  async attachFileToComposer(client, filePath, requestId) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
      throw new Error("An absolute file path is required");
    }
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Only regular files can be attached");
    const fileName = path.basename(filePath);
    const marker = `codex-personal-${requestId}`;

    try {
      evaluationValue(await client.send("Runtime.evaluate", {
        expression: `(() => {
          document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove());
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.dataset.codexPersonalFileInput = ${JSON.stringify(marker)};
          input.style.display = "none";
          document.body.append(input);
          return true;
        })()`,
        returnByValue: true,
      }));
      const { root } = await client.send("DOM.getDocument", { depth: 0 });
      const { nodeId } = await client.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: `[data-codex-personal-file-input="${marker}"]`,
      });
      if (!nodeId) throw new Error("The temporary file bridge could not be resolved");
      await client.send("DOM.setFileInputFiles", { files: [filePath], nodeId });

      const attachment = evaluationValue(await client.send("Runtime.evaluate", {
        expression: `(async () => {
          const marker = ${JSON.stringify(marker)};
          const fileName = ${JSON.stringify(fileName)};
          const input = Array.from(document.querySelectorAll('[data-codex-personal-file-input]'))
            .find((candidate) => candidate.dataset.codexPersonalFileInput === marker);
          const composer = document.querySelector('[data-codex-composer="true"][contenteditable="true"]');
          if (!input?.files?.length || !composer) return { attached: false, reason: "Composer unavailable" };
          const transfer = new DataTransfer();
          for (const file of input.files) transfer.items.add(file);
          for (const type of ["dragenter", "dragover", "drop"]) {
            composer.dispatchEvent(new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              dataTransfer: transfer,
            }));
          }
          await new Promise((resolve) => setTimeout(resolve, 850));
          const attached = Boolean(document.querySelector(
            'button[aria-label=' + JSON.stringify('Remove ' + fileName) + ']'
          ));
          return { attached, reason: attached ? null : "Native attachment chip was not observed" };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      }));

      if (attachment?.attached) return { mode: "attach", name: fileName };
      const fallback = evaluationValue(await client.send("Runtime.evaluate", {
        expression: `window.__codexPersonalRuntime?.insertText(${JSON.stringify(filePath)})`,
        returnByValue: true,
      }));
      if (!fallback) throw new Error(attachment?.reason ?? "File attachment failed");
      return { mode: "insert-path", path: filePath, fallback: true };
    } finally {
      await client.send("Runtime.evaluate", {
        expression: `document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove())`,
      }).catch(() => {});
    }
  }

  async fetchSurfaceResource(url, label) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.surfaceLoadTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        cache: "no-store",
        headers: { origin: CODEX_APP_ORIGIN },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw Object.assign(new Error(`${label} timed out`), { code: "SURFACE_LOAD_TIMEOUT" });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async verifiedSurfaceDocument(feature, surfaceUrl) {
    requireDeclaredLoopbackSurface(feature, surfaceUrl);
    if (!this.featureInstanceId || !feature.healthUrl) {
      throw Object.assign(new Error("Surface service identity is unavailable"), {
        code: "SURFACE_IDENTITY_UNAVAILABLE",
      });
    }
    const healthResponse = await this.fetchSurfaceResource(feature.healthUrl, "Surface health check");
    if (!healthResponse?.ok) {
      throw Object.assign(new Error(`Surface health returned HTTP ${healthResponse?.status ?? "error"}`), {
        code: "SURFACE_HEALTH_FAILED",
      });
    }
    let health;
    try {
      health = await healthResponse.json();
    } catch {
      throw Object.assign(new Error("Surface health returned invalid JSON"), {
        code: "SURFACE_HEALTH_FAILED",
      });
    }
    if (
      health?.ok !== true
      || health.service !== feature.id
      || health.protocolVersion !== 1
      || health.instanceId !== this.featureInstanceId
    ) {
      throw Object.assign(new Error("Surface service identity does not match this RuntimeHost"), {
        code: "SURFACE_IDENTITY_MISMATCH",
      });
    }

    const response = await this.fetchSurfaceResource(surfaceUrl, "Surface document request");
    if (!response?.ok) {
      throw Object.assign(new Error(`Surface document returned HTTP ${response?.status ?? "error"}`), {
        code: "SURFACE_DOCUMENT_FAILED",
      });
    }
    const contentType = String(response.headers?.get?.("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) {
      throw Object.assign(new Error("Surface document must be HTML"), {
        code: "SURFACE_DOCUMENT_INVALID",
      });
    }
    return documentWithBase(await response.text(), surfaceUrl);
  }

  async loadSurfaceIntoFrame(client, feature, payload = {}) {
    const frameName = payload.frameName;
    if (
      typeof frameName !== "string"
      || !frameName.startsWith(SURFACE_FRAME_PREFIX)
      || frameName.length > 256
    ) {
      throw Object.assign(new Error("Surface frame identity is invalid"), {
        code: "SURFACE_FRAME_INVALID",
      });
    }
    const surfaceUrl = payload.surfaceUrl;
    const html = await this.verifiedSurfaceDocument(feature, surfaceUrl);
    const deadline = Date.now() + this.surfaceLoadTimeoutMs;
    let frame = null;
    while (!frame && Date.now() < deadline) {
      const { frameTree } = await client.send("Page.getFrameTree");
      frame = findFrameByName(frameTree, frameName);
      if (!frame) await this.sleep(this.surfaceFramePollMs);
    }
    if (!frame) {
      throw Object.assign(new Error("Surface frame was not discovered"), {
        code: "SURFACE_FRAME_NOT_FOUND",
      });
    }
    if (frame.url !== "about:blank") {
      throw Object.assign(new Error("Surface frame must remain at about:blank before loading"), {
        code: "SURFACE_FRAME_INVALID",
      });
    }
    await client.send("Page.setDocumentContent", { frameId: frame.id, html });
    return { loaded: true };
  }

  async handleBindingCalled(targetId, client, params) {
    if (params.name !== HOST_BINDING_NAME) return;
    let request;
    try {
      request = JSON.parse(params.payload);
    } catch {
      return;
    }
    if (request.token !== this.bindingTokens.get(targetId) || typeof request.requestId !== "string") return;
    const feature = this.features.find((candidate) => candidate.id === request.featureId);
    if (feature && request.action === SURFACE_LOAD_ACTION) {
      try {
        const result = await this.loadSurfaceIntoFrame(client, feature, request.payload);
        await this.resolveHostAction(client, request.requestId, { ok: true, result });
      } catch (error) {
        await this.resolveHostAction(client, request.requestId, {
          ok: false,
          error: { code: error.code ?? "SURFACE_LOAD_FAILED", message: error.message },
        });
      }
      return;
    }
    if (!feature?.hostActions?.includes(request.action)) {
      await this.resolveHostAction(client, request.requestId, {
        ok: false,
        error: { code: "ACTION_NOT_ALLOWED", message: "Host action is not registered" },
      });
      return;
    }
    try {
      if (request.action !== "attach-file") throw new Error("Unsupported native Host action");
      const result = await this.attachFileToComposer(client, request.payload?.path, request.requestId);
      await this.resolveHostAction(client, request.requestId, { ok: true, result });
    } catch (error) {
      await this.resolveHostAction(client, request.requestId, {
        ok: false,
        error: { code: error.code ?? "ATTACH_FAILED", message: error.message },
      });
    }
  }

  async refreshTargets() {
    let response;
    try {
      response = await this.fetchImpl(`http://127.0.0.1:${this.cdpPort}/json/list`);
    } catch (error) {
      throw this.markCodexUnavailable(error);
    }
    if (!response?.ok) {
      throw this.markCodexUnavailable(
        new Error(`Codex target list returned HTTP ${response?.status ?? "error"}`),
      );
    }
    let targets;
    try {
      targets = await response.json();
    } catch (error) {
      throw this.markCodexUnavailable(error);
    }
    if (!Array.isArray(targets)) {
      throw this.markCodexUnavailable(new Error("Codex target list was not an array"));
    }
    const liveRendererIds = new Set(
      targets
        .filter((target) => target.type === "page" && target.url === "app://-/index.html")
        .map((target) => target.id),
    );
    let removedTarget = false;
    for (const id of this.injectedTargets) {
      if (liveRendererIds.has(id)) continue;
      removedTarget = true;
      this.clients.get(id)?.socket.close();
      this.clients.delete(id);
      this.scriptIds.delete(id);
      this.bindingTokens.delete(id);
      this.hostActionChains.delete(id);
      this.injectedTargets.delete(id);
    }
    const rendererDiscovered = liveRendererIds.size > 0;
    const rendererChanged = rendererDiscovered !== this.rendererDiscovered;
    this.rendererDiscovered = rendererDiscovered;
    if (removedTarget || rendererChanged) this.notifyStatusChange();

    for (const target of targets) {
      if (target.type !== "page" || target.url !== "app://-/index.html" || this.injectedTargets.has(target.id)) {
        continue;
      }
      const client = await this.connectClient(target.webSocketDebuggerUrl);
      try {
        await Promise.all([
          client.send("Page.enable"),
          client.send("Runtime.enable"),
          client.send("DOM.enable"),
        ]);
        await client.send("Page.setBypassCSP", { enabled: true });
        await client.send("Runtime.removeBinding", { name: HOST_BINDING_NAME }).catch(() => {});
        await client.send("Runtime.addBinding", { name: HOST_BINDING_NAME });
        const bindingToken = randomBytes(24).toString("hex");
        this.bindingTokens.set(target.id, bindingToken);
        client.on?.("Runtime.bindingCalled", (params) => {
          this.enqueueHostAction(target.id, () => this.handleBindingCalled(target.id, client, params))
            .catch((error) => this.logger.warn?.("Codex Host action failed", error.message));
        });
        const source = createInjectionSource(this.features, {
          bindingToken,
          runtimeSessionId: this.runtimeSessionId,
        });
        const script = await client.send("Page.addScriptToEvaluateOnNewDocument", {
          source: createDocumentBootstrapSource(source),
        });
        await waitForExpression(
          client,
          `document.readyState === "interactive" || document.readyState === "complete"`,
        );
        await client.send("Page.setBypassCSP", { enabled: true });
        await client.send("Runtime.evaluate", { expression: source, awaitPromise: true });
        await waitForExpression(
          client,
          `window.__codexPersonalRuntime?.version === ${RUNTIME_VERSION}`
            + ` && window.__codexPersonalRuntime?.sessionId === ${JSON.stringify(this.runtimeSessionId)}`,
        );
        this.clients.set(target.id, client);
        this.scriptIds.set(target.id, script.identifier);
        this.injectedTargets.add(target.id);
        this.notifyStatusChange();
      } catch (error) {
        this.bindingTokens.delete(target.id);
        client.socket.close();
        throw error;
      }
    }
  }

  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = (async () => {
      this.stopping = true;
      this.targetRefreshQueued = false;
      this.monitorWake?.();
      await this.monitorPromise?.catch(() => {});
      await Promise.all(Array.from(this.clients, async ([targetId, client]) => {
        const identifier = this.scriptIds.get(targetId);
        await client.send("Runtime.evaluate", {
          expression: "window.__codexPersonalRuntime?.dispose?.()",
          awaitPromise: true,
          returnByValue: true,
        }).catch(() => {});
        if (identifier) {
          await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier }).catch(() => {});
        }
        await client.send("Runtime.removeBinding", { name: HOST_BINDING_NAME }).catch(() => {});
        client.socket.close();
      }));
      this.browserClient?.socket.close();
      this.browserClient = null;
      this.clients.clear();
      this.scriptIds.clear();
      this.bindingTokens.clear();
      this.hostActionChains.clear();
      this.injectedTargets.clear();
      this.rendererDiscovered = false;
      this.notifyStatusChange();
      this.monitorPromise = null;
    })();
    return this.stopPromise;
  }
}
