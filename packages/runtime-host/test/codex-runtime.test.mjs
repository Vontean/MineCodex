import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  CodexRuntime,
  RESPONSIVE_SUMMARY_LAYOUT,
  createInjectionSource,
  pageScriptServiceOrigin,
  responsiveSummaryContentShift,
  responsiveSummaryDisplayMode,
  responsiveSummaryVisibleSurface,
} from "../src/codex-runtime.mjs";
import { createManagedPidFileWriter } from "../src/pid-file.mjs";

function modelSliderFeatureFixture() {
  const icon = { viewBox: "0 0 24 24", markup: "<path></path>" };
  return {
    id: "model-slider",
    label: "Model Slider",
    labels: { en: "Model Slider", "zh-CN": "模型滑杆" },
    surfaceUrl: null,
    entry: {
      kind: "composer-model-selector",
      ariaLabel: "Model Slider",
      ariaLabels: { en: "Model Slider", "zh-CN": "模型滑杆" },
    },
    modelSelector: {
      maxVisibleItems: 6,
      favoriteStorageKey: "codex-model-slider:favorites:v1",
      providerAliases: {},
      strings: {
        star: { value: "Star {model}", locales: { en: "Star {model}", "zh-CN": "收藏 {model}" } },
        unstar: { value: "Unstar {model}", locales: { en: "Unstar {model}", "zh-CN": "取消收藏 {model}" } },
      },
      icons: { fallback: icon, star: icon, unstar: icon },
      brands: [],
    },
    hostActions: [],
  };
}

function notesFeatureFixture() {
  return {
    id: "notes",
    label: "Notes",
    labels: { en: "Notes", "zh-CN": "笔记" },
    surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
    icon: { viewBox: "0 0 24 24", markup: "<path></path>" },
    entry: {
      kind: "conversation-toolbar",
      ariaLabel: "Toggle pinned notes",
      ariaLabels: { en: "Toggle pinned notes", "zh-CN": "切换固定笔记" },
    },
    pinnedSummary: {
      surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
      label: "Notes",
      labels: { en: "Notes", "zh-CN": "笔记" },
    },
    hostActions: [],
  };
}

async function executeModelSliderInjection({
  controllerProps,
  features = [modelSliderFeatureFixture()],
  mainContentShift,
  storageValue,
  exposeLocalStorage = true,
  triggerEffort,
} = {}) {
  class FixtureElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.parentElement = null;
      this._rect = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
      const styleProperties = new Map();
      this.style = {
        setProperty(name, value, priority = "") {
          styleProperties.set(name, { value: String(value), priority: String(priority) });
        },
        removeProperty(name) {
          const previous = styleProperties.get(name)?.value ?? "";
          styleProperties.delete(name);
          return previous;
        },
        getPropertyValue(name) { return styleProperties.get(name)?.value ?? ""; },
        getPropertyPriority(name) { return styleProperties.get(name)?.priority ?? ""; },
      };
      this.classList = {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; },
      };
      this.isConnected = true;
      this.hidden = false;
      this.outerHTML = `<${tagName}></${tagName}>`;
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    toggleAttribute(name, force) {
      if (force) this.setAttribute(name, "");
      else this.removeAttribute(name);
    }
    append(...children) {
      for (const child of children) {
        child.parentElement = this;
        this.children.push(child);
      }
    }
    appendChild(child) { this.append(child); return child; }
    matches(selector) {
      if (selector === this.tagName.toLowerCase()) return true;
      const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (!attribute) return false;
      return this.attributes.has(attribute[1])
        && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    }
    closest(selector) {
      if (selector === "header" && this._header) return this._header;
      for (let node = this; node; node = node.parentElement) {
        if (node.matches(selector)) return node;
      }
      return null;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    cloneNode(deep = false) {
      const clone = new FixtureElement(this.tagName.toLowerCase());
      clone.outerHTML = this.outerHTML;
      clone._rect = { ...this._rect };
      for (const [name, value] of this.attributes) clone.setAttribute(name, value);
      if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
      return clone;
    }
    remove() {
      this.isConnected = false;
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      }
      this.parentElement = null;
    }
    after(element) {
      if (!this.parentElement) return;
      const index = this.parentElement.children.indexOf(this);
      element.parentElement = this.parentElement;
      this.parentElement.children.splice(index + 1, 0, element);
    }
    addEventListener() {}
    getBoundingClientRect() { return this._rect; }
    setRect(rect) { this._rect = { ...this._rect, ...rect }; }
    get lastElementChild() { return this.children.at(-1) ?? null; }
    get nextElementSibling() {
      if (!this.parentElement) return null;
      return this.parentElement.children[this.parentElement.children.indexOf(this) + 1] ?? null;
    }
  }

  class FixtureTemplate extends FixtureElement {
    set innerHTML(value) {
      this.markup = String(value);
    }

    get content() {
      return {
        querySelector: (selector) => {
          if (selector !== "svg" || !this.markup?.includes("<svg")) return null;
          const svg = new FixtureElement("svg");
          svg.outerHTML = this.markup;
          return svg;
        },
      };
    }
  }

  let fetchCalls = 0;
  const sourceLink = { href: "app://-/assets/app-initial-fixture.js" };
  const trigger = new FixtureElement("button");
  if (triggerEffort) trigger.setAttribute("data-selected-reasoning-effort", triggerEffort);
  if (controllerProps) {
    trigger.__reactFiber$fixture = { memoizedProps: controllerProps, return: null };
  }
  const mainContentLayout = new FixtureElement("div");
  mainContentLayout.setAttribute("data-app-shell-main-content-layout", "true");
  const mainContent = new FixtureElement("main");
  mainContent.setAttribute("data-app-shell-main-surface", "true");
  mainContentLayout.append(mainContent);
  const scrollContainer = new FixtureElement("div");
  scrollContainer.setAttribute("class", "thread-scroll-container");
  const scrollContent = new FixtureElement("div");
  const conversation = new FixtureElement("section");
  conversation.setAttribute("data-conversation-column", "true");
  const composer = new FixtureElement("div");
  composer.setAttribute("data-codex-composer", "true");
  composer.setAttribute("contenteditable", "true");
  composer.setAttribute("role", "textbox");
  scrollContainer.firstElementChild = scrollContent;
  conversation.append(composer);
  mainContent.append(scrollContainer, conversation);
  mainContent.querySelector = (selector) => (
    selector === ".thread-scroll-container" ? scrollContainer : mainContent.querySelectorAll(selector)[0] ?? null
  );
  if (mainContentShift) {
    mainContent.style.setProperty(
      "--thread-wide-block-inline-shift",
      mainContentShift.value,
      mainContentShift.priority,
    );
  }
  let activeMainSurface = mainContent;
  let activeComposer = composer;
  const header = new FixtureElement("header");
  header.setRect({ left: 0, right: 1000, width: 1000, height: 48, bottom: 48 });
  const toolbarHost = new FixtureElement("div");
  toolbarHost._computedStyle = { display: "flex", visibility: "visible", flexGrow: "1" };
  toolbarHost.setRect({ left: 0, right: 1000, width: 1000, height: 48, bottom: 48 });
  header.append(toolbarHost);
  const toolbarAnchor = new FixtureElement("button");
  toolbarAnchor.setAttribute("aria-label", "Toggle bottom panel");
  toolbarAnchor._header = header;
  const documentElement = new FixtureElement("html");
  documentElement.lang = "en";
  const document = {
    documentElement,
    head: new FixtureElement("head"),
    body: new FixtureElement("body"),
    styleSheets: [],
    createElement(tagName) {
      return tagName === "template" ? new FixtureTemplate(tagName) : new FixtureElement(tagName);
    },
    createElementNS(_namespace, tagName) { return new FixtureElement(tagName); },
    querySelector(selector) {
      if (selector === "[data-codex-intelligence-trigger]") return trigger;
      if (selector === '[data-codex-composer="true"][contenteditable="true"]') return activeComposer;
      if (selector === "[data-app-shell-main-content-layout]") return mainContentLayout;
      if (selector === "main[data-app-shell-main-surface]") return activeMainSurface;
      return selector === 'link[href*="/assets/app-initial-"][href$=".js"]' ? sourceLink : null;
    },
    querySelectorAll(selector) {
      if (selector === "button") {
        return [toolbarAnchor, ...header.querySelectorAll("button")];
      }
      return [documentElement, mainContentLayout, header, toolbarAnchor]
        .flatMap((root) => [
          ...(root.matches(selector) ? [root] : []),
          ...root.querySelectorAll(selector),
        ]);
    },
    getElementById() { return null; },
    addEventListener() {},
    getSelection() { return null; },
  };
  const window = {
    document,
    location: { origin: "app://-", pathname: "/", search: "" },
    addEventListener() {},
    matchMedia() { return { matches: false }; },
    setTimeout() { return 2; },
  };
  window.top = window;
  const storage = {
    getItem(key) {
      assert.equal(key, "codex-model-slider:fast-icons:v1");
      return storageValue ?? null;
    },
    setItem() {},
  };
  const source = createInjectionSource(features, {
    runtimeSessionId: "fast-icon-fixture",
  }).replace(
    "void loadNativeFastIconFromBundle();",
    `window.__fastIconProbe = () => ({
      sources: { ...modelSelectorNativeFastIconSources },
      states: Object.keys(modelSelectorNativeFastIcons ?? {}),
      dirty: modelSelectorNativeFastIconsDirty,
    });
    window.__modelSliderEffortProbe = (raw) => {
      const identity = modelIdentity(raw);
      const model = modelDefinitionFor(identity, modelSelectorFeature.modelSelector);
      const efforts = model?.supportedReasoningLevels ?? [];
      const nativeModel = nativeCatalogModelFor(identity);
      const selectedEffort = nativeModel?.currentReasoningLevel
        ?? document.querySelector("[data-codex-intelligence-trigger]")
          ?.getAttribute("data-selected-reasoning-effort")
        ?? model?.defaultReasoningLevel
        ?? efforts[0]?.effort;
      return {
        current: nativeModel?.currentReasoningLevel ?? null,
        default: nativeModel?.defaultReasoningLevel ?? null,
        selectedEffort,
        selectedIndex: Math.max(0, efforts.findIndex((level) => level.effort === selectedEffort)),
        efforts: efforts.map((level) => level.effort),
      };
    };
    window.__summaryShiftProbe = {
      apply: applyThreadContentShift,
      restore: restoreThreadContentShift,
    };
    void loadNativeFastIconFromBundle();`,
  ).replace(
    "const runtimeApi = {",
    `window.__toolbarProbe = {
      active: () => Boolean(toolbarReadiness),
      ensure: ensureToolbarEntries,
      hostActionFailure: (error) => typeof hostActionFailure === "function"
        ? hostActionFailure(error)
        : null,
      flush: flushEnsure,
    };
    const runtimeApi = {`,
  );
  const resizeCallbacks = [];
  const context = {
    AbortController,
    Element: FixtureElement,
    HTMLElement: FixtureElement,
    File: class FixtureFile {},
    MutationObserver: class FixtureMutationObserver {
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class FixtureResizeObserver {
      constructor(callback) { this.callback = callback; resizeCallbacks.push(callback); }
      observe() {}
      disconnect() {}
    },
    NodeFilter: { SHOW_TEXT: 4 },
    cancelAnimationFrame() {},
    clearTimeout() {},
    console,
    document,
    fetch: async () => {
      fetchCalls += 1;
      return { async text() { return ""; } };
    },
    getComputedStyle(element) {
      return {
        display: "block",
        visibility: "visible",
        flexGrow: "0",
        getPropertyValue() { return ""; },
        ...(element?._computedStyle ?? {}),
      };
    },
    innerHeight: 900,
    innerWidth: 1200,
    location: window.location,
    navigator: { language: "en", languages: ["en"] },
    queueMicrotask,
    requestAnimationFrame() { return 1; },
    setTimeout() { return 2; },
    window,
  };
  if (exposeLocalStorage) context.localStorage = storage;
  vm.runInNewContext(source, context);
  await Promise.resolve();
  await Promise.resolve();
  const probe = window.__fastIconProbe?.();
  return {
    effortProbe: (raw) => {
      const value = window.__modelSliderEffortProbe?.(raw);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    fetchCalls,
    summaryShift: {
      apply: (value) => window.__summaryShiftProbe.apply(value),
      restore: () => window.__summaryShiftProbe.restore(),
      snapshot: () => ({
        owner: {
          value: mainContent.style.getPropertyValue("--thread-wide-block-inline-shift"),
          priority: mainContent.style.getPropertyPriority("--thread-wide-block-inline-shift"),
          marker: mainContent.getAttribute("data-codex-personal-summary-shift"),
        },
        layout: {
          value: mainContentLayout.style.getPropertyValue("--thread-wide-block-inline-shift"),
          marker: mainContentLayout.getAttribute("data-codex-personal-summary-shift"),
        },
        scrollContent: {
          left: scrollContent.style.getPropertyValue("left"),
          position: scrollContent.style.getPropertyValue("position"),
          marker: scrollContent.getAttribute("data-codex-personal-summary-shift"),
        },
      }),
      replaceOwner: () => {
        activeMainSurface = new FixtureElement("main");
        activeMainSurface.setAttribute("data-app-shell-main-surface", "true");
        activeComposer = new FixtureElement("div");
        activeComposer.setAttribute("data-codex-composer", "true");
        activeComposer.setAttribute("contenteditable", "true");
        activeComposer.setAttribute("role", "textbox");
        activeMainSurface.append(activeComposer);
      },
    },
    toolbarReadiness: {
      active: () => window.__toolbarProbe.active(),
      dispose: () => window.__codexPersonalRuntime.dispose(),
      flush: () => window.__toolbarProbe.flush(),
      resizeAnchor: (rect) => {
        toolbarAnchor.setRect(rect);
        for (const callback of resizeCallbacks) callback();
      },
      entryCount: () => document.querySelectorAll('[data-codex-personal-feature="notes"]').length,
    },
    hostActionFailure: (error) => {
      const value = window.__toolbarProbe.hostActionFailure(error);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    probe: probe ? JSON.parse(JSON.stringify(probe)) : null,
    runtimeInstalled: Boolean(window.__codexPersonalRuntime),
  };
}

test("matches Codex Summary responsive thresholds and content-shift behavior", () => {
  assert.equal(responsiveSummaryDisplayMode(1095), "overlay");
  assert.equal(responsiveSummaryDisplayMode(1096), "shift");
  assert.equal(responsiveSummaryDisplayMode(1535), "shift");
  assert.equal(responsiveSummaryDisplayMode(1536), "gutter");

  assert.equal(responsiveSummaryVisibleSurface({ displayMode: "overlay", isPinned: false, isPopoverOpen: true }), "popover");
  assert.equal(responsiveSummaryVisibleSurface({ displayMode: "overlay", isPinned: true, isPopoverOpen: false }), null);
  assert.equal(responsiveSummaryVisibleSurface({ displayMode: "shift", isPinned: true, isPopoverOpen: false }), "inline");
  assert.equal(responsiveSummaryVisibleSurface({ displayMode: "gutter", isPinned: false, isPopoverOpen: true }), null);

  assert.equal(
    responsiveSummaryContentShift({ displayMode: "shift", isPinned: true }),
    -(RESPONSIVE_SUMMARY_LAYOUT.panelWidth + RESPONSIVE_SUMMARY_LAYOUT.panelInset) / 2,
  );
  assert.equal(responsiveSummaryContentShift({ displayMode: "overlay", isPinned: true }), 0);
  assert.equal(
    responsiveSummaryContentShift({ displayMode: "gutter", isPinned: true }),
    -(RESPONSIVE_SUMMARY_LAYOUT.panelWidth + RESPONSIVE_SUMMARY_LAYOUT.panelInset) / 2,
  );
});

test("only grants page scripts their declared loopback service origin", () => {
  assert.equal(pageScriptServiceOrigin({
    pageScript: { source: "return () => {};" },
    surfaceUrl: "http://127.0.0.1:49123/",
    healthUrl: "http://127.0.0.1:49123/api/health",
  }), "http://127.0.0.1:49123");
  assert.equal(pageScriptServiceOrigin({
    pageScript: { source: "return () => {};" },
    surfaceUrl: "https://example.test/",
    healthUrl: "https://example.test/api/health",
  }), null);
  assert.equal(pageScriptServiceOrigin({
    pageScript: { source: "return () => {};" },
    surfaceUrl: "http://127.0.0.1:49123/",
    healthUrl: "http://127.0.0.1:49124/api/health",
  }), null);
});

test("restores persisted Fast icons before the bundle fallback runs", async () => {
  const storageValue = JSON.stringify({
    active: '<svg data-state="active"><path></path></svg>',
    inactive: '<svg data-state="inactive"><path></path></svg>',
  });

  const result = await executeModelSliderInjection({ storageValue });

  assert.equal(result.runtimeInstalled, true);
  assert.deepEqual(result.probe.states.sort(), ["active", "inactive"]);
  assert.deepEqual(result.probe.sources, { active: "persisted", inactive: "persisted" });
  assert.equal(result.probe.dirty, false);
  assert.equal(result.fetchCalls, 0);
});

test("keeps Model Slider available when persisted Fast icons cannot be read", async () => {
  const scenarios = [
    { name: "missing", options: {} },
    { name: "malformed", options: { storageValue: "{" } },
    { name: "unavailable", options: { exposeLocalStorage: false } },
  ];

  for (const scenario of scenarios) {
    const result = await executeModelSliderInjection(scenario.options);
    assert.equal(result.runtimeInstalled, true, scenario.name);
    assert.equal(result.fetchCalls, 1, scenario.name);
  }
});

test("releases thread content to native Summary when a personal panel needs no shift", () => {
  const source = createInjectionSource([]);

  assert.match(
    source,
    /function applyThreadContentShift\(value\) \{[\s\S]*?if \(value === 0\) \{[\s\S]*?restoreThreadContentShift\(\)[\s\S]*?return;?[\s\S]*?\}/s,
  );
});

test("shifts and restores the shared conversation column through the native Summary variable", async () => {
  const result = await executeModelSliderInjection({
    mainContentShift: { value: "23px", priority: "important" },
  });

  result.summaryShift.apply(-158);
  assert.deepEqual(result.summaryShift.snapshot(), {
    owner: { value: "158px", priority: "important", marker: "-158" },
    layout: { value: "", marker: null },
    scrollContent: { left: "", position: "", marker: null },
  });

  result.summaryShift.apply(-120);
  assert.deepEqual(result.summaryShift.snapshot().owner, {
    value: "120px",
    priority: "important",
    marker: "-120",
  });

  result.summaryShift.restore();
  assert.deepEqual(result.summaryShift.snapshot(), {
    owner: { value: "23px", priority: "important", marker: null },
    layout: { value: "", marker: null },
    scrollContent: { left: "", position: "", marker: null },
  });

  const emptyOriginal = await executeModelSliderInjection();
  emptyOriginal.summaryShift.apply(-158);
  emptyOriginal.summaryShift.restore();
  assert.deepEqual(emptyOriginal.summaryShift.snapshot().owner, {
    value: "",
    priority: "",
    marker: null,
  });
});

test("uses the native Summary variable without an isolated scroll-child offset", () => {
  const source = createInjectionSource([]);

  assert.match(source, /const owner = mainContentViewport\(\)/);
  assert.match(source, /owner\.style\.setProperty\(\s*"--thread-wide-block-inline-shift"/);
  assert.match(source, /getPropertyPriority\("--thread-wide-block-inline-shift"\)/);
  assert.match(source, /element\.style\.removeProperty\("--thread-wide-block-inline-shift"\)/);
  assert.doesNotMatch(source, /threadShiftStyle/);
  assert.doesNotMatch(source, /style\.setProperty\("(?:position|left)"/);
});

test("moves the live-like Composer owner, restores on owner replacement, and disposes cleanly", async () => {
  const result = await executeModelSliderInjection({
    mainContentShift: { value: "11px", priority: "important" },
  });

  result.summaryShift.apply(-158);
  assert.equal(result.summaryShift.snapshot().owner.marker, "-158");
  assert.equal(result.summaryShift.snapshot().layout.marker, null);

  result.summaryShift.replaceOwner();
  result.summaryShift.apply(-158);
  assert.deepEqual(result.summaryShift.snapshot().owner, {
    value: "11px",
    priority: "important",
    marker: null,
  });

  result.summaryShift.apply(-120);
  result.toolbarReadiness.dispose();
  assert.deepEqual(result.summaryShift.snapshot().owner, {
    value: "11px",
    priority: "important",
    marker: null,
  });
});

test("renders 24px outline feature icons at Codex's 1px visual weight", () => {
  const source = createInjectionSource([{
    id: "images",
    label: "Images",
    surfaceUrl: "http://127.0.0.1:47831/",
    icon: { viewBox: "0 0 24 24", markup: "<path></path>" },
    placement: { after: "sites", order: 10 },
  }]);

  assert.match(source, /icon\.setAttribute\("stroke-width", "1\.5"\)/);
  assert.doesNotMatch(source, /icon\.setAttribute\("stroke-width", "2"\)/);
});

test("posts page-surface activity on show, hide, and iframe load", () => {
  const source = createInjectionSource([{
    id: "images",
    label: "Images",
    surfaceUrl: "http://127.0.0.1:47831/",
    entry: { kind: "sidebar" },
    placement: { after: "sites", order: 10 },
    hostActions: [],
  }]);

  assert.match(
    source,
    /function postSurfaceActive\(record, active\)[\s\S]*?type: "codex-personal:surface-active",[\s\S]*?active: Boolean\(active\)/,
  );
  assert.match(
    source,
    /frame\.addEventListener\("load", \(\) => \{[\s\S]*?postSurfaceActive\(record, activePageFeatureId === record\.featureId && !record\.element\.hidden\)/,
  );
  assert.match(source, /function showPageSurface[\s\S]*?postSurfaceActive\(record, true\)/);
  assert.match(source, /function hidePageSurfaces[\s\S]*?postSurfaceActive\(record, false\)/);
});

test("main defers feature startup publication and leaves foreground ChatGPT launching to the CLI adapter", async () => {
  const source = await readFile(new URL("../src/main.mjs", import.meta.url), "utf8");

  assert.match(source, /deferredStart: true/);
  assert.match(source, /onStatusChange: requestReadyFileRefresh/);
  assert.match(source, /let runtimeReady = false/);
  assert.match(source, /await runtime\.start\(\);\s*runtimeReady = true;\s*await writeReadyFile\(\)/);
  assert.doesNotMatch(source, /MINECODEX_CODEX_EXECUTABLE|MINECODEX_LAUNCH_CODEX|launchCodex/);
  assert.match(source, /featureInstanceId,/);
});

test("emits a fail-closed native Composer model selector Adapter", () => {
  const icon = { viewBox: "0 0 24 24", markup: "<path></path>" };
  const source = createInjectionSource([{
    id: "model-slider",
    label: "Model Slider",
    surfaceUrl: null,
    entry: { kind: "composer-model-selector", ariaLabel: "Model Slider" },
    modelSelector: {
      maxVisibleItems: 6,
      favoriteStorageKey: "codex-model-slider:favorites:v1",
      providerAliases: { "opencode-go": "OpenCode Go" },
      strings: {
        star: { value: "Star {model}", locales: { en: "Star {model}", "zh-CN": "收藏 {model}" } },
        unstar: { value: "Unstar {model}", locales: { en: "Unstar {model}", "zh-CN": "取消收藏 {model}" } },
      },
      icons: { fallback: icon, star: icon, unstar: icon },
      brands: [{ id: "deepseek", keywords: ["deepseek"], icon }],
    },
    hostActions: [],
  }]);

  assert.match(source, /data-codex-intelligence-trigger/);
  assert.match(source, /data-model-picker-view-toggle/);
  assert.match(source, /function modelIdentity\(rawValue\)/);
  assert.match(source, /function modelDisplayLabel\(identity, selector\)/);
  assert.match(source, /catalogModelFor\(identity, selector\) \?\? nativeCatalogModelFor\(identity\)/);
  assert.match(source, /const label = modelDisplayLabel\(modelIdentity\(raw\), selector\)/);
  assert.match(source, /function enhanceNativeModelSubmenu\(menu, selector\)/);
  assert.match(source, /function positionModelSubmenu\(menu\)/);
  assert.match(source, /document\.getElementById\(menu\?\.getAttribute\("aria-labelledby"\)/);
  assert.match(source, /function observeModelSubmenuPosition\(menu\)/);
  assert.match(source, /wrapper\.getAttribute\("style"\) === record\.lastAppliedStyle/);
  assert.match(source, /parentRect\.right - wrapperRect\.width/);
  assert.match(source, /icon\.setAttribute\("fill", "currentColor"\)/);
  assert.match(source, /return resolveModelAlias\(aliases, identity\)/);
  assert.match(source, /function resolveModelAlias\(aliases, identity\)/);
  assert.match(source, /function nativeModelDescriptorForItem\(item, observedRaw\)/);
  assert.match(source, /const raw = catalogModel\?\.slug \?\? nativeDescriptor\?\.slug \?\? observedRaw/);
  assert.match(source, /item\.dataset\.codexModelSliderIdentitySource = catalogModel \? "catalog" : nativeDescriptor \? "native" : "visible"/);
  // Reused menu rows must refresh dataset before the row-exists shortcut.
  assert.match(source, /item\.dataset\.codexModelSliderIdentitySource = catalogModel \? "catalog" : nativeDescriptor \? "native" : "visible";\s+if \(item\.querySelector\("\[data-codex-model-slider-row\]"\)\) return;/);
  assert.doesNotMatch(source, /if \(item\.querySelector\("\[data-codex-model-slider-row\]"\)\) return;\s+const observedRaw = modelItemRawValue\(item\);/);
  assert.match(source, /function captureNativeFastIcon\(\)/);
  assert.match(source, /template\.cloneNode\(true\)/);
  // Regression guard: icon building reads the ready store only and must not re-enter capture.
  assert.match(source, new RegExp(String.raw`const template = modelSelectorNativeFastIcons\?\.\[active \? \"active\" : \"inactive\"\]`));
  assert.doesNotMatch(source, new RegExp(String.raw`const template = captureNativeFastIcon\(\)\?\.\[active`));
  // Fast icons must be known at startup: bundle extraction + localStorage persist; DOM clone is an upgrade path.
  // P1 guard: Fast-icon capture must run after menu enhancement and be exception-isolated.
  assert.doesNotMatch(source, /if \(!selector\) return;\s+captureNativeFastIcon\(\);/);
  assert.doesNotMatch(source, /captureNativeFastIcon\(\);\s+pruneModelSubmenuPositionObservers\(\);/);
  assert.match(source, /} catch \(error\) \{\s+console\.warn\("\[codex-personal\] fast icon capture failed", error\);/);
  // P2a guard: the app-bundle fetch short-circuits once both icons are already ready.
  assert.match(source, /if \(modelSelectorNativeFastIcons\?\.active && modelSelectorNativeFastIcons\?\.inactive\) return;/);
  // P2b guard: localStorage persist is dirty-flagged instead of running every ensure.
  assert.match(source, /if \(!modelSelectorNativeFastIcons \|\| !modelSelectorNativeFastIconsDirty\) return;/);
  assert.match(source, /modelSelectorNativeFastIconsDirty = true;/);
  // P2c guard: the full-page SVG scan is gated to Fast-control visibility transitions.
  // Sidebar selection must use the native selected class bg-primary-ghost-hover:
  // highlight the active MineCodex entry with it and strip it from native items.
  assert.match(source, /entry\.classList\.toggle\(\"bg-primary-ghost-hover", selected\);/);
  assert.match(source, /element\.classList\.remove\(\"bg-primary-ghost-hover"\);/);
  assert.match(source, /classList\.toggle\(\"bg-primary-ghost-hover", Boolean\(selection\.hadPrimaryGhost\)\);/);
  assert.match(source, /const justBecameVisible = visible && !modelSelectorFastControlVisible;/);
  assert.match(source, /if \(visible && justBecameVisible\) \{/);
  assert.match(source, /function loadNativeFastIconFromBundle\(\)/);
  assert.match(source, /modelSelectorFastIconStorageKey = "codex-model-slider:fast-icons:v1"/);
  assert.match(source, /function persistNativeFastIcons\(\)/);
  assert.match(source, /function loadPersistedNativeFastIcons\(storageKey\)/);
  assert.match(source, /function applyNativeFastIconsToShells\(\)/);
  assert.match(source, /modelSelectorNativeFastIconSources\[state\] = "dom"/);
  assert.match(source, /modelSelectorNativeFastIcons\[state\] = template/);
  assert.match(source, /function chatComposerModelController\(props\)/);
  assert.match(source, /if \(!Array\.isArray\(props\.models\?\.versionOptions\) \|\| !selected\.versionId\) return null/);
  assert.match(source, /props\.models\.versionOptions\.find/);
  assert.match(source, /if \(!version\) return null/);
  assert.match(source, /const effortFor = \(option\) => String\(option\?\.title \?\? option\?\.lane \?\? ""\)\.toLowerCase\(\)/);
  assert.match(source, /const selectedOption = options\.find/);
  assert.match(source, /const selectedEffort = selectedOption \? effortFor\(selectedOption\) : \(efforts\[0\] \?\? "instant"\)/);
  assert.match(source, /onSelectReasoningEffort\(effort\)/);
  assert.match(source, /props\.onModelChange\(next\)/);
  assert.match(source, /if \(target\.thinkingEffort\) next\.thinkingEffort = target\.thinkingEffort;\s*else delete next\.thinkingEffort/);
  assert.match(source, /width: 264px !important; min-width: 264px/);
  assert.match(source, /data-codex-model-slider-item\]\[data-codex-model-slider-selected\].*color-token-list-hover-background/);
  assert.match(source, /data-codex-model-slider-star\]::after \{/);
  assert.match(source, /top: 0; right: 0; bottom: 0; width: 40px/);
  assert.match(source, /data-codex-model-slider-star\] svg \{ position: relative; z-index: 2;.*pointer-events: none/);
  assert.match(source, /item\.toggleAttribute\("data-codex-model-slider-selected", Boolean\(item\.querySelector\("svg"\)\)\)/);
  assert.doesNotMatch(source, /data-codex-model-slider-check/);
  assert.doesNotMatch(source, /star\.addEventListener\("click"/);
  assert.match(source, /menu\.addEventListener\("click", \(event\) => \{/);
  assert.match(source, /toggleModelFavorite\(event, menu, selector, raw, label\)/);
  assert.match(source, /for \(const type of \["mousedown", "pointerup", "mouseup"\]\)/);
  assert.doesNotMatch(source, /menu\.addEventListener\("pointerdown"[\s\S]*toggleModelFavorite/);
  assert.match(source, /function sizeModelMenuViewport\(menu, maxVisibleItems\)/);
  assert.match(source, /const lastVisibleItem = items\[maxVisibleItems - 1\]/);
  assert.doesNotMatch(source, /data-codex-model-slider-title/);
  assert.doesNotMatch(source, /ensureModelMenuTitle/);
  assert.doesNotMatch(source, /ensureModelSearch/);
  assert.match(source, /const starred = items\.filter/);
  assert.match(source, /const ordinary = items\.filter/);
  assert.match(
    source,
    /if \(visibleBlockingDialog\(\)\) \{[\s\S]*?closeNativeModelPickerSubmenus\(\);[\s\S]*?return;?[\s\S]*?\}/,
  );
  assert.match(source, /function closeNativeModelPickerSubmenus\(\)/);
  assert.match(source, /function enhanceComposerModelTrigger\(selector\)/);
  assert.match(source, /data-codex-model-slider-trigger/);
  assert.match(source, /max-width: none/);
  assert.match(source, /data-codex-model-slider-selecting-effort/);
  assert.match(source, /function nativeCssModuleClass\(tokenName, root = document\)/);
  for (const tokenName of ["ViewControls", "ViewToggleContent", "ViewToggleIcon", "SimpleView"]) {
    assert.match(source, new RegExp(`"${tokenName}"`));
  }
  assert.match(source, /nativeCssModuleClass\(tokenName, parentMenu\)/);
  assert.match(source, /if \(Object\.values\(classes\)\.some\(\(name\) => !name\)\) return null/);
  assert.match(source, /const shell = createGenericModelSlider[\s\S]*?if \(!shell\) return false/);
  assert.doesNotMatch(source, /_1ryrb_/);
  assert.match(source, /const canUpgradeFallback = Boolean/);
  assert.match(source, /characterData: true/);
  assert.match(source, /ensureFrame = requestAnimationFrame\(flushEnsure\)/);
  assert.match(source, /ensureTimer = setTimeout\(flushEnsure, 50\)/);
  assert.doesNotMatch(source, /queueMicrotask\(ensureEntries\)/);
  assert.match(source, /previewFrame = requestAnimationFrame/);
  assert.match(source, /dragRect = rail\.getBoundingClientRect\(\)/);
  assert.match(
    source,
    /beginNativeEffortTransaction\(\);[\s\S]*?setReactControlledMenuOpen\(row, true\)/,
  );
  assert.match(source, /function setReactControlledMenuOpen\(element, open\)/);
  assert.doesNotMatch(source, /function openNativeModelSubmenu[\s\S]*?dispatchPointerClick\(row\)/);
  assert.match(source, /function isNativeEffortSubmenu\(menu\)/);
  assert.match(source, /function invokeNativeMenuItemSelect\(item\)/);
  assert.match(source, /observer = new MutationObserver\(select\)/);
  assert.match(
    source,
    /const submenu = nativeEffortSubmenu\(\);[\s\S]*?invokeNativeMenuItemSelect\(item\)[\s\S]*?scheduleModelSliderReturn\(\)/,
  );
  assert.match(source, /function deferNativeEffortOutsideDismiss\(event\)/);
  assert.match(
    source,
    /if \(event\.type === "pointerdown" && modelSelectorEffortTransactionTimer != null\)[\s\S]*?modelSelectorPendingOutsideDismiss = true/,
  );
  assert.match(
    source,
    /const dismissAfterCommit = modelSelectorPendingOutsideDismiss;[\s\S]*?invokeNativeMenuItemSelect\(item\)[\s\S]*?closeReactControlledMenu\(item\)[\s\S]*?data-codex-intelligence-trigger/,
  );
  assert.doesNotMatch(
    source,
    /if \(item\) \{[\s\S]*?setTimeout\([\s\S]*?dispatchPointerClick\(currentItem\)/,
  );
  assert.match(source, /restoreModelSelectorEnhancements\(\)/);
  assert.match(source, /data-codex-model-slider-catalog-ready/);
  assert.match(source, /data-codex-model-slider-trigger-label/);
  assert.doesNotMatch(source, /select-model-effort/);
  assert.match(source, /"favoriteStorageKey":"codex-model-slider:favorites:v1"/);
  assert.doesNotMatch(source, /"zh-CN":"搜索模型"/);
  assert.doesNotMatch(source, /model_catalog_json/);
});
test("maps current controller effort separately from the model default", async () => {
  const controller = {
    models: [{
      model: "gpt-5.6-sol",
      displayName: "GPT 5.6 Sol",
      defaultReasoningEffort: "low",
      supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map(
        (reasoningEffort) => ({ reasoningEffort }),
      ),
    }],
    reasoningEffort: "max",
    onSelectReasoningEffort() {},
  };
  const result = await executeModelSliderInjection({
    controllerProps: controller,
    triggerEffort: "medium",
  });

  assert.deepEqual(result.effortProbe("gpt-5.6-sol"), {
    current: "max",
    default: "low",
    selectedEffort: "max",
    selectedIndex: 4,
    efforts: ["low", "medium", "high", "xhigh", "max"],
  });
});

test("recomputes Model Slider effort when the active Composer controller changes", async () => {
  const controller = {
    models: [{
      model: "deepseek-v4",
      displayName: "DeepSeek V4",
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: ["medium", "high", "max"].map(
        (reasoningEffort) => ({ reasoningEffort }),
      ),
    }],
    reasoningEffort: "max",
    onSelectReasoningEffort() {},
  };
  const result = await executeModelSliderInjection({
    controllerProps: controller,
    triggerEffort: "medium",
  });

  assert.equal(result.effortProbe("deepseek-v4").selectedEffort, "max");
  assert.equal(result.effortProbe("deepseek-v4").selectedIndex, 2);
  controller.reasoningEffort = "high";
  assert.equal(result.effortProbe("deepseek-v4").selectedEffort, "high");
  assert.equal(result.effortProbe("deepseek-v4").selectedIndex, 1);
});

test("resolves Model Slider effort from the native controller before the trigger DOM attribute", () => {
  const icon = { viewBox: "0 0 24 24", markup: "<path></path>" };
  const source = createInjectionSource([{
    id: "model-slider",
    label: "Model Slider",
    surfaceUrl: null,
    entry: { kind: "composer-model-selector", ariaLabel: "Model Slider" },
    modelSelector: {
      maxVisibleItems: 6,
      favoriteStorageKey: "codex-model-slider:favorites:v1",
      providerAliases: { "opencode-go": "OpenCode Go" },
      strings: {
        star: { value: "Star {model}", locales: { en: "Star {model}", "zh-CN": "收藏 {model}" } },
        unstar: { value: "Unstar {model}", locales: { en: "Unstar {model}", "zh-CN": "取消收藏 {model}" } },
      },
      icons: { fallback: icon, star: icon, unstar: icon },
      brands: [{ id: "deepseek", keywords: ["deepseek"], icon }],
    },
    hostActions: [],
  }]);

  // 子任务触发器属性（medium）滞后于控制器推导状态（max）时，控制器值必须优先。
  assert.match(
    source,
    /const nativeModel = nativeCatalogModelFor\(identity\);\n\s*const selectedEffort = nativeModel\?\.currentReasoningLevel[\s\S]*?getAttribute\("data-selected-reasoning-effort"\)/,
  );
  assert.match(
    source,
    /nativeModel\?\.currentReasoningLevel\s*\?\?[\s\S]*?\?\? model\.defaultReasoningLevel\s*\?\? efforts\[0\]\.effort/,
  );
  assert.match(source, /const currentReasoningLevel = String\(controller\?\.reasoningEffort \?\? ""\)\.toLowerCase\(\)/);
  // 已解析 effort 决定最终滑杆索引：max 落在最右档。
  assert.match(source, /const selectedIndex = Math\.max\(0, efforts\.indexOf\(selectedEffort\)\)/);
  // 任务切换时按可控状态重建：key 包含已解析 effort，key 变化即重建菜单。
  assert.match(source, /const key = `\$\{identity\.raw\}:\$\{selectedEffort\}:/);
  assert.match(source, /existing\?\.getAttribute\("data-codex-model-slider-generic"\) === key/);
});

test("normalizes Composer trigger effort-label alignment under Model Slider", () => {
  const icon = { viewBox: "0 0 24 24", markup: "<path></path>" };
  const source = createInjectionSource([{
    id: "model-slider",
    label: "Model Slider",
    surfaceUrl: null,
    entry: { kind: "composer-model-selector", ariaLabel: "Model Slider" },
    modelSelector: {
      maxVisibleItems: 6,
      favoriteStorageKey: "codex-model-slider:favorites:v1",
      providerAliases: {},
      strings: {
        star: { value: "Star {model}", locales: { en: "Star {model}", "zh-CN": "收藏 {model}" } },
        unstar: { value: "Unstar {model}", locales: { en: "Unstar {model}", "zh-CN": "取消收藏 {model}" } },
      },
      icons: { fallback: icon, star: icon, unstar: icon },
      brands: [],
    },
    hostActions: [],
  }]);

  // 隐藏原生模型文本后，effort 标签仍需与 flex 居中的 chevron 垂直对齐。
  assert.match(
    source,
    /data-codex-model-slider-trigger\] \[class\*="_ModelPickerTriggerEffortLabel_"\]\s*\{[\s\S]*?display: inline-flex; align-items: center; align-self: center;/,
  );
});

test("attaches Notes after a zero-size toolbar anchor becomes layout-ready", async () => {
  const result = await executeModelSliderInjection({ features: [notesFeatureFixture()] });

  result.toolbarReadiness.flush();
  assert.equal(result.toolbarReadiness.entryCount(), 0);
  assert.equal(result.toolbarReadiness.active(), true);
  result.toolbarReadiness.resizeAnchor({
    left: 900,
    right: 932,
    top: 8,
    bottom: 40,
    width: 32,
    height: 32,
  });
  result.toolbarReadiness.flush();

  assert.equal(result.toolbarReadiness.entryCount(), 1);
  assert.equal(result.toolbarReadiness.active(), false);

  const disposed = await executeModelSliderInjection({ features: [notesFeatureFixture()] });
  disposed.toolbarReadiness.flush();
  assert.equal(disposed.toolbarReadiness.active(), true);
  disposed.toolbarReadiness.dispose();
  assert.equal(disposed.toolbarReadiness.active(), false);
});

test("emits an isolated conversation-toolbar Adapter with strict Surface and Host-action boundaries", () => {
  const source = createInjectionSource([{
    id: "notes",
    label: "Notes",
    labels: { en: "Notes", "zh-CN": "笔记" },
    surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
    icon: { viewBox: "0 0 24 24", markup: "<path></path>" },
    placement: { order: 20 },
    entry: {
      kind: "conversation-toolbar",
      ariaLabel: "Toggle pinned notes",
      ariaLabels: { en: "Toggle pinned notes", "zh-CN": "切换固定笔记" },
    },
    pinnedSummary: {
      label: "Pinned Notes",
      labels: { en: "Pinned Notes", "zh-CN": "固定笔记" },
      surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
      presentation: "responsive-summary",
      overlayLabel: "Toggle notes",
      overlayLabels: { en: "Toggle notes", "zh-CN": "切换笔记" },
      pinnedLabel: "Toggle pinned notes",
      pinnedLabels: { en: "Toggle pinned notes", "zh-CN": "切换固定笔记" },
    },
    detailTabs: [
      {
        id: "todo",
        label: "Todo",
        labels: { en: "Todo", "zh-CN": "待办" },
        surfaceUrl: "http://127.0.0.1:47832/?surface=todo",
      },
    ],
    hostActions: ["insert-text", "attach-file", "open-detail-tab", "open-editor-modal", "resolve-file-paths"],
  }], {
    bindingName: "__testHostAction",
    bindingToken: "unique-test-token",
  });

  assert.match(source, /if \(window\.top !== window\) return/);
  assert.match(source, /event\.origin === record\.origin && event\.source === record\.frame\.contentWindow/);
  assert.match(source, /feature\?\.hostActions\.has\(action\)/);
  assert.match(source, /"bindingName":"__testHostAction"/);
  assert.match(source, /"bindingToken":"unique-test-token"/);
  assert.match(source, /"ariaLabel":"Toggle pinned notes"/);
  assert.match(source, /"zh-CN":"切换固定笔记"/);
  assert.match(source, /"zh-CN":"待办"/);
  assert.match(source, /"hostActions":\["insert-text","attach-file","open-detail-tab","open-editor-modal","resolve-file-paths"\]/);
  assert.match(source, /function surfaceFrameName\(featureId\)/);
  assert.match(source, /frame\.name = surfaceFrameName\(featureId\)/);
  assert.match(source, /frame\.src = "about:blank"/);
  assert.match(source, /action: "load-surface"/);
  assert.doesNotMatch(source, /frame\.src = surfaceUrl/);
  assert.match(source, /function normalizedLocale\(value\)/);
  assert.match(source, /function localizedText\(fallback, locales = \{\}\)/);
  assert.match(source, /label: localizedText\(feature\.label, feature\.labels\)/);
  assert.match(source, /label: localizedText\(detail\.label, detail\.labels\)/);
  assert.match(source, /\{ type: "codex-personal:theme", theme: mode, mode, locale, tokens: surfaceTokens \}/);
  assert.match(source, /data-codex-personal-pinned-summary/);
  assert.match(source, /data-codex-personal-summary-presentation/);
  assert.doesNotMatch(source, /data-codex-personal-tab-host/);
  assert.match(source, /Toggle summary/);
  assert.match(source, /Toggle pinned summary/);
  assert.match(source, /function nativeBottomPanelButton\(\)/);
  assert.match(source, /button\.getAttribute\("aria-label"\) !== "Toggle bottom panel"/);
  assert.match(source, /function nativeSidePanelButton\(\)/);
  assert.match(source, /button\.getAttribute\("aria-label"\) !== "Toggle side panel"/);
  assert.match(source, /function nativeTemporaryChatButton\(\)/);
  assert.match(source, /\/temporary chat\/i\.test\(button\.getAttribute\("aria-label"\)/);
  assert.match(source, /function nativeSummaryToolbarGroup\(nativeButton\)/);
  assert.match(source, /function conversationToolbarHost\(nativeButton\)/);
  assert.match(source, /function ensureFallbackSummaryToolbarGroup\(nativeButton\)/);
  assert.match(source, /data-codex-personal-summary-toolbar-group/);
  assert.match(source, /group\.className = "ms-auto flex shrink-0 items-center gap-1\.5 pointer-events-auto"/);
  assert.match(source, /toolbarHost\.append\(group\)/);
  assert.match(source, /function ensureToolbarEntries\(\)[\s\S]*?const summaryButton = nativeSummaryButton\(\)/s);
  assert.match(source, /const anchorButton = temporaryChatButton \?\? summaryButton \?\? bottomPanelButton \?\? sidePanelButton/);
  assert.match(source, /function structuralToolbarAnchor\(\)/);
  assert.match(source, /function ensureToolbarReadiness\(candidate\)/);
  assert.match(source, /record\.attempts >= 8/);
  assert.match(source, /}, 1_500\)/);
  assert.match(source, /record\.observer = new ResizeObserver\(wake\)/);
  assert.match(source, /if \(candidate\) ensureToolbarReadiness\(candidate\)/);
  assert.match(source, /stopToolbarReadiness\(\)/);
  assert.match(source, /const useFallbackAnchor = anchorButton === sidePanelButton \|\| anchorButton === bottomPanelButton/);
  assert.match(source, /const summaryGroup = useFallbackAnchor \? null : nativeSummaryToolbarGroup\(anchorButton\)/);
  assert.match(source, /let targetGroup = summaryGroup \?\? ensureFallbackSummaryToolbarGroup\(anchorButton\)/);
  assert.match(source, /if \(cursor\.nextElementSibling !== entryRoot\) cursor\.after\(entryRoot\)/);
  assert.match(source, /const header = entry\.closest\("header"\)/);
  assert.match(source, /const contentTop = Math\.max\(scrollRect\?\.top \?\? 0, headerBottom\)/);
  assert.match(source, /function toolbarEntryFitsHeader\(entryRoot\)/);
  assert.match(source, /entryRect\.right <= headerRect\.right \+ 1/);
  assert.match(source, /if \(summaryGroup && !toolbarEntryFitsHeader\(entryRoot\)\)/);
  assert.match(source, /fallback\.append\(entryRoot\)/);
  assert.doesNotMatch(source, /bottomPanelToolbarOverride/);
  assert.doesNotMatch(source, /syncBottomPanelToolbarWidth/);
  assert.doesNotMatch(source, /toolbarShell\.style\.(?:width|minWidth)/);
  assert.match(source, /codex-personal:surface-metrics/);
  assert.match(source, /--codex-summary-section-title-font-size/);
  assert.match(source, /--codex-summary-section-title-font-weight/);
  assert.match(source, /--codex-summary-row-font-size/);
  assert.match(source, /--text-base--line-height/);
  assert.match(source, /--text-sm--line-height/);
  assert.match(source, /--color-token-text-link-foreground/);
  assert.match(source, /--codex-summary-label-font-size/);
  assert.match(source, /--codex-summary-label-line-height/);
  assert.match(source, /--codex-summary-icon-size/);
  assert.match(source, /--codex-summary-icon-stroke-width/);
  assert.match(source, /--codex-summary-panel-radius/);
  assert.match(source, /--codex-summary-panel-corner-shape/);
  assert.match(source, /--codex-dialog-radius/);
  assert.match(source, /--codex-dialog-corner-shape/);
  assert.match(source, /--codex-dialog-shadow/);
  assert.match(source, /data-codex-personal-modal/);
  assert.match(source, /function openEditorModal/);
  assert.match(source, /new Set\(\["prompt", "note"\]\)\.has\(payload\.kind\)/);
  assert.match(source, /Editor kind must be prompt or todo/);
  assert.match(source, /"border-radius:25px"/);
  assert.match(source, /"corner-shape:var\(--codex-corner-shape,superellipse\(1\.5\)\)"/);
  assert.match(source, /"border-radius:20px"/);
  assert.match(source, /"corner-shape:round"/);
  assert.match(source, /"box-shadow:0 16px 32px -8px rgba\(0,0,0,\.19\)"/);
  assert.match(source, /"left:50%"/);
  assert.match(source, /"top:50%"/);
  assert.match(source, /"width:min\(420px,92vw\)"/);
  assert.match(source, /"background:rgba\(0,0,0,\.133\)"/);
  assert.match(source, /data-codex-personal-prompt-preview/);
  assert.match(source, /function showPromptPreview\(record, payload = \{\}\)/);
  assert.match(source, /preview\.setAttribute\("role", "tooltip"\)/);
  assert.match(source, /preview\.setAttribute\("aria-label", locale === "zh-CN" \? "提示词预览" : "Prompt preview"\)/);
  assert.match(source, /const title = String\(payload\.prompt\?\.title \?\? ""\)\.trim\(\)/);
  assert.match(source, /if \(title\) \{[\s\S]*?preview\.append\(heading\)/s);
  assert.doesNotMatch(source, /\.trim\(\) \|\| "Prompt"/);
  assert.match(source, /content\.textContent = body/);
  assert.doesNotMatch(source, /body\.slice\(/);
  assert.match(source, /"max-height:min\(420px,calc\(100vh - 24px\)\)"/);
  assert.match(source, /"border-radius:16px"/);
  assert.match(source, /"corner-shape:var\(--codex-corner-shape,superellipse\(1\.5\)\)"/);
  assert.match(source, /"background:var\(--color-token-dropdown-background/);
  assert.match(source, /"box-shadow:var\(--elevation-prominent/);
  assert.match(source, /const surfaceLeft = record\.element\.offsetLeft/);
  assert.match(source, /const surfaceTop = record\.element\.offsetTop/);
  assert.match(source, /surfaceLeft - gap - width/);
  assert.match(source, /surfaceTop \+ anchorTop - 8/);
  assert.match(source, /function requestPromptPreviewClose\(record\)[\s\S]*?\}, 120\)/s);
  assert.match(source, /preview\.addEventListener\("pointerenter"/);
  assert.match(source, /preview\.addEventListener\("pointerleave"/);
  assert.doesNotMatch(source, /"transition:opacity 120ms ease"/);
  assert.match(source, /"transition:opacity 80ms ease"/);
  assert.match(source, /current\.element\.style\.pointerEvents = "none"/);
  assert.match(source, /event\.data\.type === "codex-personal:prompt-preview"/);
  assert.match(source, /--color-token-input-background/);
  assert.match(source, /--color-token-input-border/);
  assert.match(source, /--color-token-button-background/);
  assert.match(source, /--color-text-button-tertiary/);
  assert.match(source, /--spacing-token-button-composer/);
  assert.match(source, /"overlayLabel":"Toggle notes"/);
  assert.match(source, /"pinnedLabel":"Toggle pinned notes"/);
  assert.match(source, /button\.classList\.remove\([\s\S]*?"bg-token-foreground\/5"[\s\S]*?"bg-token-foreground\/10"[\s\S]*?\)/);
  assert.match(source, /button\.classList\.add\([\s\S]*?"text-token-text-tertiary"[\s\S]*?"enabled:hover:bg-token-list-hover-background"[\s\S]*?"data-\[state=open\]:bg-token-list-hover-background"[\s\S]*?\)/);
  assert.match(source, /reloadSurfaceIfUnready/);
  assert.match(source, /record\.ready = true/);
});

test("opens detail views only in Codex native right-panel tabs", () => {
  const source = createInjectionSource([{
    id: "notes",
    label: "Notes",
    surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
    icon: { viewBox: "0 0 24 24", markup: "<path></path>" },
    entry: { kind: "conversation-toolbar", ariaLabel: "Toggle pinned notes" },
    pinnedSummary: {
      surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
      presentation: "responsive-summary",
    },
    detailTabs: [
      {
        id: "prompts",
        label: "Prompts",
        surfaceUrl: "http://127.0.0.1:47832/?surface=prompts",
        icon: { viewBox: "0 0 24 24", markup: '<path data-icon="prompts"></path>' },
      },
    ],
    hostActions: ["open-detail-tab"],
  }]);

  assert.match(source, /function nativeTabModuleUrl\(\)/);
  assert.match(source, /async function loadNativeTabCapability\(\)/);
  assert.match(source, /const rightPanelRouteKinds = new Set\(config\.rightPanelRouteKinds\)/);
  assert.match(source, /async function waitForCurrentRightPanelScope\(\)/);
  assert.match(source, /Object\.values\(appModule\)\.find/);
  assert.match(source, /typeof value\.openTab === "function"/);
  assert.match(source, /value\.panelId === "right"/);
  assert.doesNotMatch(source, /nativeJsxRuntime/);
  assert.doesNotMatch(source, /appModule\.Gtt/);
  assert.doesNotMatch(source, /appModule\.hkt/);
  assert.doesNotMatch(source, /appModule\.Skt/);
  assert.doesNotMatch(source, /React\.useLayoutEffect/);
  assert.doesNotMatch(source, /React\.useRef/);
  assert.match(source, /!controller\?\.tabById\$/);
  assert.match(source, /rightPanelRouteKinds\.has\(value\.value\?\.routeKind\)/);
  assert.match(source, /"rightPanelRouteKinds":\["home","local-thread"\]/);
  assert.doesNotMatch(source, /value\.value\?\.routeKind === "local-thread"/);
  assert.match(source, /function nativeDetailComponent\(feature, detail\)/);
  assert.match(source, /function nativeDetailIcon\(feature, detail\)/);
  assert.match(source, /const icon = detail\.icon \?\? feature\.icon/);
  assert.match(source, /icon: nativeDetailIcon\(feature, detail\)/);
  assert.match(source, /function nativeReactElement\(type, props\)/);
  assert.match(source, /Symbol\.for\("react\.transitional\.element"\)/);
  assert.match(source, /data-codex-personal-native-detail="\$\{detailKey\}"/);
  assert.match(source, /registerSurface\(recordKey, feature, "detail", detail\.surfaceUrl, mounted\.element, mounted\.frame, detail\.id\)/);
  assert.match(source, /controller\.openTab\(scope, nativeDetailComponent\(feature, detail\)/);
  assert.match(source, /async function waitForNativeDetailTabElement\(detailKey\)/);
  assert.match(source, /scope\.get\(controller\.tabById\$, tabId\) != null/);
  assert.match(source, /nativeDetailSurfaceKeys\.has\(detailKey\)/);
  assert.match(source, /id: tabId,[\s\S]*?isClosable: true,[\s\S]*?onClose:/s);
  assert.match(source, /presentation: "native"/);
  assert.doesNotMatch(source, /function openFallbackDetailTab\(feature, detail\)/);
  assert.doesNotMatch(source, /presentation: "fallback"/);
  assert.doesNotMatch(source, /data-codex-personal-tab-host/);
  assert.match(source, /const result = await openNativeDetailTab\(feature, detail\)/);
  assert.match(source, /error\.code = "NATIVE_TAB_UNAVAILABLE"/);
  assert.match(source, /error: hostActionFailure\(error\)/);
  assert.match(source, /result: await openDetailTab\(feature\.id, payload\.surface\)/);
  assert.match(source, /detailTabCapability/);
  assert.match(source, /closeNativeDetailTabs\(\)/);
});

test("preserves the native Tab capability reason across the Host-action surface", async () => {
  const result = await executeModelSliderInjection({ features: [notesFeatureFixture()] });

  assert.deepEqual(result.hostActionFailure(Object.assign(
    new Error("Codex right-panel controller is unavailable"),
    { code: "NATIVE_TAB_UNAVAILABLE" },
  )), {
    code: "NATIVE_TAB_UNAVAILABLE",
    message: "Codex right-panel controller is unavailable",
  });
});

test("ignores native Host bindings with the wrong target token", async () => {
  const runtime = new CodexRuntime({
    features: [{ id: "notes", hostActions: ["attach-file"] }],
    profileDir: "/tmp/codex-runtime-test-profile",
  });
  runtime.bindingTokens.set("renderer", "expected-token");
  let nativeCalls = 0;
  runtime.attachFileToComposer = async () => {
    nativeCalls += 1;
    return { mode: "attach" };
  };
  const client = { send: async () => ({ result: { value: true } }) };

  await runtime.handleBindingCalled("renderer", client, {
    name: "__codexPersonalHostAction",
    payload: JSON.stringify({
      token: "foreign-token",
      featureId: "notes",
      requestId: "request-1",
      action: "attach-file",
      payload: { path: "/tmp/file.txt" },
    }),
  });

  assert.equal(nativeCalls, 0);
});

test("loads only declared loopback Surface documents and same-document query variants into named blank frames", async () => {
  const calls = [];
  let documentHtml = "";
  const runtime = new CodexRuntime({
    features: [{
      id: "images",
      surfaceUrl: "http://127.0.0.1:47831/",
      healthUrl: "http://127.0.0.1:47831/api/health",
      hostActions: [],
      detailTabs: [],
      pinnedSummary: null,
    }],
    featureInstanceId: "surface-instance",
    profileDir: "/tmp/codex-runtime-surface-profile",
    fetchImpl: async (url) => {
      if (url === "http://127.0.0.1:47831/api/health") {
        return new Response(JSON.stringify({
          ok: true,
          service: "images",
          protocolVersion: 1,
          instanceId: "surface-instance",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "http://127.0.0.1:47831/") {
        return new Response("<!doctype html><html><head></head><body>Images</body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url === "http://127.0.0.1:47831/?surface=editor&kind=todo") {
        return new Response("<!doctype html><html><head></head><body>Todo editor</body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });
  runtime.bindingTokens.set("renderer", "surface-token");
  const client = {
    async send(method, params = {}) {
      calls.push(method);
      if (method === "Page.getFrameTree") {
        return {
          frameTree: {
            frame: { id: "root", url: "app://-/index.html" },
            childFrames: [{
              frame: {
                id: "surface-frame",
                parentId: "root",
                name: "minecodex-surface-images",
                url: "about:blank",
              },
            }],
          },
        };
      }
      if (method === "Page.setDocumentContent") {
        assert.equal(params.frameId, "surface-frame");
        documentHtml = params.html;
      }
      return { result: { value: true } };
    },
  };

  await runtime.handleBindingCalled("renderer", client, {
    name: "__codexPersonalHostAction",
    payload: JSON.stringify({
      token: "surface-token",
      featureId: "images",
      requestId: "surface-request",
      action: "load-surface",
      payload: {
        frameName: "minecodex-surface-images",
        surfaceUrl: "http://127.0.0.1:47831/",
      },
    }),
  });

  assert.equal(calls.includes("Page.setDocumentContent"), true);
  assert.match(documentHtml, /<base href="http:\/\/127\.0\.0\.1:47831\/">/);
  assert.match(documentHtml, />Images</);

  documentHtml = "";
  await runtime.handleBindingCalled("renderer", client, {
    name: "__codexPersonalHostAction",
    payload: JSON.stringify({
      token: "surface-token",
      featureId: "images",
      requestId: "editor-surface-request",
      action: "load-surface",
      payload: {
        frameName: "minecodex-surface-images",
        surfaceUrl: "http://127.0.0.1:47831/?surface=editor&kind=todo",
      },
    }),
  });
  assert.match(documentHtml, /<base href="http:\/\/127\.0\.0\.1:47831\/\?surface=editor&kind=todo">/);
  assert.match(documentHtml, />Todo editor</);

  documentHtml = "";
  await runtime.handleBindingCalled("renderer", client, {
    name: "__codexPersonalHostAction",
    payload: JSON.stringify({
      token: "surface-token",
      featureId: "images",
      requestId: "foreign-surface-request",
      action: "load-surface",
      payload: {
        frameName: "minecodex-surface-images",
        surfaceUrl: "http://127.0.0.1:49999/",
      },
    }),
  });
  assert.equal(documentHtml, "");

  await runtime.handleBindingCalled("renderer", client, {
    name: "__codexPersonalHostAction",
    payload: JSON.stringify({
      token: "surface-token",
      featureId: "images",
      requestId: "foreign-path-surface-request",
      action: "load-surface",
      payload: {
        frameName: "minecodex-surface-images",
        surfaceUrl: "http://127.0.0.1:47831/admin?surface=editor",
      },
    }),
  });
  assert.equal(documentHtml, "");
});

test("derives editor documents from the canonical Surface URL instead of the blank transport frame", () => {
  const source = createInjectionSource([{
    id: "notes",
    label: "Notes",
    surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
    entry: { kind: "conversation-toolbar" },
    hostActions: ["open-editor-modal"],
    detailTabs: [],
  }]);

  assert.match(source, /const editorUrl = new URL\(sourceRecord\.surfaceUrl\)/);
  assert.doesNotMatch(source, /const editorUrl = new URL\(sourceRecord\.frame\.src\)/);
});

test("reports path insertion truthfully when a native attachment chip is not observed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-attach-fallback-"));
  const filePath = path.join(directory, "handoff.md");
  await writeFile(filePath, "handoff");
  try {
    const runtime = new CodexRuntime({
      features: [],
      profileDir: "/tmp/codex-runtime-test-profile",
    });
    let asyncAttachmentChecks = 0;
    let fallbackInsertions = 0;
    const client = {
      async send(method, params = {}) {
        if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
        if (method === "DOM.querySelector") return { nodeId: 2 };
        if (method === "DOM.setFileInputFiles") return {};
        if (method !== "Runtime.evaluate") return {};
        if (params.expression?.includes("Native attachment chip was not observed")) {
          asyncAttachmentChecks += 1;
          return { result: { value: { attached: false, reason: "Native attachment chip was not observed" } } };
        }
        if (params.expression?.includes("window.__codexPersonalRuntime?.insertText")) {
          fallbackInsertions += 1;
          return { result: { value: { mode: "inserted", fallback: false } } };
        }
        return { result: { value: true } };
      },
    };

    const result = await runtime.attachFileToComposer(client, filePath, "request-fallback");
    assert.deepEqual(result, { mode: "insert-path", path: filePath, fallback: true });
    assert.equal(asyncAttachmentChecks, 1);
    assert.equal(fallbackInsertions, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serializes refresh work so polling cannot overlap injection", async () => {
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-test-profile",
  });
  let calls = 0;
  let finishRefresh;
  runtime.refreshTargets = () => {
    calls += 1;
    return new Promise((resolve) => { finishRefresh = resolve; });
  };

  const first = runtime.refresh();
  const second = runtime.refresh();
  assert.equal(calls, 1);
  assert.equal(first, second);

  finishRefresh();
  await first;
  const third = runtime.refresh();
  assert.equal(calls, 2);
  finishRefresh();
  await third;
});

test("subscribes to CDP target changes so new App renderers are injected without polling delay", () => {
  const source = CodexRuntime.prototype.startTargetDiscovery.toString();

  assert.match(source, /Target\.setDiscoverTargets/);
  assert.match(source, /Target\.targetCreated/);
  assert.match(source, /Target\.targetInfoChanged/);
  assert.match(source, /Target\.targetDestroyed/);
  assert.match(source, /queueTargetRefresh\(\)/);
});

test("falls back to target-list polling when a valid CDP websocket cannot connect", async () => {
  const warnings = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-discovery-polling-profile",
    cdpPort: 9244,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { webSocketDebuggerUrl: "ws://localhost:9244/devtools/browser/unreachable" };
      },
    }),
    connectClient: async () => {
      throw new Error("websocket refused");
    },
    logger: {
      log() {},
      warn(...args) {
        warnings.push(args.join(" "));
      },
    },
  });

  await assert.doesNotReject(runtime.startTargetDiscovery());
  assert.equal(runtime.browserClient, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /using \/json\/list polling.*websocket refused/);
});

test("closes a partial CDP client when target discovery setup falls back to polling", async () => {
  let closed = 0;
  const warnings = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-discovery-send-profile",
    cdpPort: 9245,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { webSocketDebuggerUrl: "wss://[::1]:9245/devtools/browser/partial" };
      },
    }),
    connectClient: async () => ({
      socket: {
        close() {
          closed += 1;
        },
      },
      on() {},
      async send(method) {
        assert.equal(method, "Target.setDiscoverTargets");
        throw new Error("discovery command failed");
      },
    }),
    logger: {
      log() {},
      warn(...args) {
        warnings.push(args.join(" "));
      },
    },
  });

  await assert.doesNotReject(runtime.startTargetDiscovery());
  assert.equal(closed, 1);
  assert.equal(runtime.browserClient, null);
  assert.match(warnings[0], /using \/json\/list polling.*discovery command failed/);
});

test("accepts only loopback CDP websocket identity on the configured port", async () => {
  let versionPayload = { webSocketDebuggerUrl: "ws://example.com:9246/devtools/browser/foreign" };
  const connectedUrls = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-loopback-identity-profile",
    cdpPort: 9246,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return versionPayload;
      },
    }),
    connectClient: async (url) => {
      connectedUrls.push(url);
      return browserClient();
    },
    logger: { log() {}, warn() {} },
  });

  assert.equal(await runtime.isAvailable(), false);
  await assert.rejects(runtime.startTargetDiscovery(), /loopback/);

  versionPayload = { webSocketDebuggerUrl: "ws://127.0.0.1:9999/devtools/browser/wrong-port" };
  assert.equal(await runtime.isAvailable(), false);
  await assert.rejects(runtime.startTargetDiscovery(), /configured CDP port 9246/);

  for (const webSocketDebuggerUrl of [
    "ws://127.0.0.1:9246/devtools/browser/ipv4",
    "ws://localhost:9246/devtools/browser/localhost",
    "wss://[::1]:9246/devtools/browser/ipv6",
  ]) {
    versionPayload = { webSocketDebuggerUrl };
    assert.equal(await runtime.isAvailable(), true);
  }
  await runtime.startTargetDiscovery();
  assert.deepEqual(connectedUrls, ["wss://[::1]:9246/devtools/browser/ipv6"]);
  await runtime.stop();
});

test("uses a RuntimeHost session nonce to replace a same-version document runtime", () => {
  const source = createInjectionSource([], {
    bindingToken: "new-binding-token",
    runtimeSessionId: "runtime-session-new",
  });

  assert.match(source, /sessionId === config\.sessionId/);
  assert.match(source, /currentRuntime\?\.dispose\?\.\(\)/);
  assert.match(source, /sessionId: config\.sessionId/);
  assert.match(source, /"sessionId":"runtime-session-new"/);
  assert.doesNotMatch(source, /if \(window\.\__codexPersonalRuntime\?\.version === config\.version\)/);
});

function cdpResponse(jsonValue, ok = true) {
  return {
    ok,
    async json() {
      return jsonValue;
    },
  };
}

function browserClient() {
  return {
    socket: { close() {} },
    on() {
      return () => {};
    },
    async send() {
      return {};
    },
  };
}

async function waitFor(predicate, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail("Timed out waiting for the lifecycle transition");
}

test("starts idle without a foreground application launcher", async () => {
  let spawnCount = 0;
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-user-controlled-profile",
    cdpPort: 9247,
    fetchImpl: async () => cdpResponse({}, false),
    launchApplication: () => {
      spawnCount += 1;
      throw new Error("background startup must not launch Codex");
    },
    monitorIntervalMs: 10_000,
    logger: { log() {}, warn() {} },
  });

  await runtime.start();
  assert.equal(spawnCount, 0);
  assert.equal(runtime.getRendererStatus().active, false);
  await runtime.stop();
});

test("leaves a managed Codex child stopped after the user exits", async () => {
  let available = false;
  let spawnCount = 0;
  const children = [];
  const statuses = [];
  const pidChanges = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-recovery-profile",
    appPath: "/definitely/not-a-real-codex",
    cdpPort: 9239,
    fetchImpl: async (url) => {
      if (url.endsWith("/json/version")) {
        return cdpResponse({
          webSocketDebuggerUrl: "ws://127.0.0.1:9239/devtools/browser/recovery",
        }, available);
      }
      if (url.endsWith("/json/list")) return cdpResponse([]);
      throw new Error(`Unexpected URL ${url}`);
    },
    launchApplication: () => {
      const child = new EventEmitter();
      child.pid = 9200 + spawnCount;
      child.exitCode = null;
      child.unref = () => {};
      child.kill = () => true;
      spawnCount += 1;
      available = true;
      children.push(child);
      return child;
    },
    connectClient: async () => browserClient(),
    sleep: async () => {},
    availabilityTimeoutMs: 100,
    availabilityPollMs: 1,
    onStatusChange: (status) => statuses.push(status),
    onManagedCodexPidChange: (pid) => pidChanges.push(pid),
    logger: { log() {}, warn() {} },
  });

  runtime.launchManagedCodex();
  assert.equal(spawnCount, 1);
  assert.deepEqual(pidChanges, [9200]);
  available = false;
  children[0].exitCode = 0;
  children[0].emit("exit", 0, null);
  await waitFor(() => statuses.some((status) => status.active === false));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(spawnCount, 1);
  assert.equal(runtime.appPid, null);
  assert.deepEqual(pidChanges, [9200, null]);
  await runtime.stop();
});

test("rejects stale 2xx version payloads and launches once after explicit user intent", async () => {
  let versionPayload = {};
  let spawnCount = 0;
  const discoveryUrls = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-version-identity-profile",
    appPath: "/definitely/not-a-real-codex",
    cdpPort: 9243,
    fetchImpl: async (url) => {
      if (url.endsWith("/json/version")) return cdpResponse(versionPayload);
      if (url.endsWith("/json/list")) return cdpResponse([]);
      throw new Error(`Unexpected URL ${url}`);
    },
    launchApplication: () => {
      const child = new EventEmitter();
      child.pid = 9260;
      child.exitCode = null;
      child.signalCode = null;
      child.unref = () => {};
      child.kill = () => true;
      spawnCount += 1;
      versionPayload = {
        webSocketDebuggerUrl: "ws://127.0.0.1:9243/devtools/browser/managed",
      };
      return child;
    },
    connectClient: async (url) => {
      discoveryUrls.push(url);
      return browserClient();
    },
    availabilityTimeoutMs: 100,
    availabilityPollMs: 1,
    monitorIntervalMs: 10_000,
    logger: { log() {}, warn() {} },
  });

  assert.equal(await runtime.isAvailable(), false);
  await assert.rejects(runtime.startTargetDiscovery(), /webSocketDebuggerUrl/);
  versionPayload = { webSocketDebuggerUrl: "http://not-a-websocket" };
  assert.equal(await runtime.isAvailable(), false);
  await assert.rejects(runtime.startTargetDiscovery(), /webSocketDebuggerUrl/);
  versionPayload = {};

  await runtime.start({ launchCodex: true });
  assert.equal(spawnCount, 1);
  assert.equal(await runtime.isAvailable(), true);
  assert.deepEqual(discoveryUrls, ["ws://127.0.0.1:9243/devtools/browser/managed"]);
  await runtime.stop();
});

test("does not relaunch Codex when an attached CDP endpoint exits", async () => {
  let cdpAvailable = true;
  let spawnCount = 0;
  const children = [];
  const discoveryUrls = [];
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/json/version") {
      response.statusCode = cdpAvailable ? 200 : 503;
      response.end(JSON.stringify({
        webSocketDebuggerUrl: spawnCount
          ? `ws://127.0.0.1:${cdpPort}/devtools/browser/recovered`
          : `ws://localhost:${cdpPort}/devtools/browser/existing`,
      }));
      return;
    }
    if (request.url === "/json/list") {
      response.statusCode = cdpAvailable ? 200 : 503;
      response.end(JSON.stringify([]));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({}));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const cdpPort = server.address().port;
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-existing-cdp-profile",
    appPath: "/definitely/not-a-real-codex",
    cdpPort,
    monitorIntervalMs: 10,
    availabilityTimeoutMs: 100,
    availabilityPollMs: 1,
    spawnProcess: () => {
      const child = new EventEmitter();
      child.pid = 9250 + spawnCount;
      child.exitCode = null;
      child.signalCode = null;
      child.unref = () => {};
      child.kill = () => true;
      spawnCount += 1;
      children.push(child);
      return child;
    },
    connectClient: async (url) => {
      discoveryUrls.push(url);
      return browserClient();
    },
    logger: { log() {}, warn() {} },
  });

  try {
    await runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(spawnCount, 0);
    assert.deepEqual(discoveryUrls, [`ws://localhost:${cdpPort}/devtools/browser/existing`]);

    cdpAvailable = false;
    await waitFor(() => runtime.getRendererStatus().active === false, 500);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(spawnCount, 0);
    assert.equal(runtime.appPid, null);
    assert.equal(runtime.getRendererStatus().active, false);
    assert.deepEqual(discoveryUrls, [`ws://localhost:${cdpPort}/devtools/browser/existing`]);
  } finally {
    await runtime.stop();
    await new Promise((resolve) => server.close(resolve));
    for (const child of children) child.exitCode = 0;
  }
});

test("reconciles an available CDP without relaunching during a target-list outage", async () => {
  let targetListHealthy = true;
  let spawnCount = 0;
  let targetListCalls = 0;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/json/version") {
      response.statusCode = 200;
      response.end(JSON.stringify({
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/browser/available`,
      }));
      return;
    }
    if (request.url === "/json/list") {
      targetListCalls += 1;
      response.statusCode = targetListHealthy ? 200 : 503;
      response.end(JSON.stringify(targetListHealthy ? [] : {}));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({}));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-cdp-still-available-profile",
    cdpPort: server.address().port,
    monitorIntervalMs: 10,
    spawnProcess: () => {
      spawnCount += 1;
      throw new Error("relaunch must not happen while /json/version remains available");
    },
    connectClient: async () => browserClient(),
    logger: { log() {}, warn() {} },
  });

  try {
    await runtime.start();
    targetListHealthy = false;
    await waitFor(() => targetListCalls >= 2, 500);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(spawnCount, 0);
    assert.equal(runtime.getRendererStatus().active, false);
    targetListHealthy = true;
  } finally {
    await runtime.stop();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("replaces the current page runtime without reloading the Codex page", async () => {
  const calls = [];
  const statuses = [];
  let targets = [{ id: "target-current", type: "page", url: "app://-/index.html", webSocketDebuggerUrl: "ws://target" }];
  let injectedSource = "";
  const client = {
    socket: { close() {} },
    on() {
      return () => {};
    },
    async send(method, params = {}) {
      calls.push(method);
      if (method === "Page.addScriptToEvaluateOnNewDocument") {
        injectedSource = params.source;
        return { identifier: "script-current" };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("__mineCodexCspBootstrapVersion")) {
        return { result: { value: true } };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("document.readyState")) {
        return { result: { value: true } };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("sessionId ===")) {
        return { result: { value: true } };
      }
      return {};
    },
  };
  const runtime = new CodexRuntime({
    features: [{ id: "notes", hostActions: [] }],
    profileDir: "/tmp/codex-runtime-stale-profile",
    cdpPort: 9240,
    runtimeSessionId: "runtime-session-current",
    onStatusChange: (status) => statuses.push(status),
    fetchImpl: async (url) => {
      if (url.endsWith("/json/list")) {
        return cdpResponse(targets);
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    connectClient: async () => client,
    logger: { log() {}, warn() {} },
  });

  await runtime.refreshTargets();
  assert.equal(runtime.getRendererStatus().active, true);
  assert.equal(calls.includes("Page.reload"), false);
  assert.match(injectedSource, /__mineCodexCspBootstrapVersion/);
  assert.match(injectedSource, /"sessionId":"runtime-session-current"/);
  targets = [{ id: "target-current", type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://target" }];
  await runtime.refreshTargets();
  assert.deepEqual(runtime.getRendererStatus(), {
    discovered: false,
    discoveredTargets: 0,
    injectedTargets: 0,
    active: false,
    healthy: false,
    targetFailures: [],
    runtimeSessionId: "runtime-session-current",
  });
  targets = [];
  await runtime.refreshTargets();
  assert.deepEqual(runtime.getRendererStatus(), {
    discovered: false,
    discoveredTargets: 0,
    injectedTargets: 0,
    active: false,
    healthy: false,
    targetFailures: [],
    runtimeSessionId: "runtime-session-current",
  });
  assert.equal(statuses.at(-1).active, false);
});

test("bootstraps the current Codex document without reloading it", async () => {
  const calls = [];
  let bootstrapped = false;
  let injectedSource = "";
  const client = {
    socket: { close() {} },
    on() {
      return () => {};
    },
    async send(method, params = {}) {
      calls.push(method);
      if (method === "Page.addScriptToEvaluateOnNewDocument") {
        injectedSource = params.source;
        return { identifier: "script-bootstrap" };
      }
      if (method === "Page.reload") {
        throw new Error("RuntimeHost must not reload the Codex application document");
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("window.__mineCodexCspBootstrapVersion =")) {
        bootstrapped = true;
        return { result: { value: true } };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("__mineCodexCspBootstrapVersion")) {
        return { result: { value: bootstrapped } };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("document.readyState")) {
        return { result: { value: true } };
      }
      if (method === "Runtime.evaluate" && params.expression?.includes("sessionId ===")) {
        return { result: { value: true } };
      }
      return {};
    },
  };
  const runtime = new CodexRuntime({
    features: [{ id: "images", hostActions: [] }, { id: "notes", hostActions: [] }],
    profileDir: "/tmp/codex-runtime-bootstrap-profile",
    cdpPort: 9247,
    runtimeSessionId: "runtime-session-bootstrap",
    fetchImpl: async (url) => {
      if (url.endsWith("/json/list")) {
        return cdpResponse([{
          id: "target-bootstrap",
          type: "page",
          url: "app://-/index.html",
          webSocketDebuggerUrl: "ws://target-bootstrap",
        }]);
      }
      throw new Error(`Unexpected URL ${url}`);
    },
    connectClient: async () => client,
    logger: { log() {}, warn() {} },
  });

  await runtime.refreshTargets();

  assert.equal(runtime.getRendererStatus().active, true);
  assert.equal(calls.includes("Page.reload"), false);
  assert.equal(calls.includes("waitFor:Page.loadEventFired"), false);
  assert.ok(calls.indexOf("Page.setBypassCSP") < calls.indexOf("Page.addScriptToEvaluateOnNewDocument"));
  assert.ok(calls.indexOf("Page.addScriptToEvaluateOnNewDocument") < calls.lastIndexOf("Runtime.evaluate"));
  assert.match(injectedSource, /__mineCodexCspBootstrapVersion/);
  assert.match(injectedSource, /"sessionId":"runtime-session-bootstrap"/);

  await runtime.refreshTargets();
  assert.equal(calls.includes("Page.reload"), false);
  await runtime.stop();
});

test("isolates renderer injection failures and retries only the failed target", async () => {
  const closed = [];
  let failTargetB = true;
  const targets = ["target-a", "target-b"].map((id) => ({
    id,
    type: "page",
    url: "app://-/index.html",
    webSocketDebuggerUrl: `ws://${id}`,
  }));
  const runtime = new CodexRuntime({
    features: [{ id: "notes", hostActions: [] }],
    profileDir: "/tmp/codex-runtime-target-isolation-profile",
    cdpPort: 9250,
    runtimeSessionId: "runtime-session-target-isolation",
    fetchImpl: async () => cdpResponse(targets),
    connectClient: async (url) => {
      const targetId = url.slice("ws://".length);
      return {
        socket: { close() { closed.push(targetId); } },
        on() { return () => {}; },
        async send(method, params = {}) {
          if (method === "Page.addScriptToEvaluateOnNewDocument") {
            return { identifier: `script-${targetId}` };
          }
          if (
            targetId === "target-b"
            && failTargetB
            && method === "Runtime.evaluate"
            && params.expression?.includes("function install")
          ) {
            throw new Error("Execution context was destroyed");
          }
          if (method === "Runtime.evaluate") return { result: { value: true } };
          return {};
        },
      };
    },
    logger: { log() {}, warn() {} },
  });

  await runtime.refreshTargets();
  assert.equal(runtime.injectedTargets.has("target-a"), true);
  assert.equal(runtime.injectedTargets.has("target-b"), false);
  assert.deepEqual(closed, ["target-b"]);
  assert.deepEqual(runtime.getRendererStatus(), {
    discovered: true,
    discoveredTargets: 2,
    injectedTargets: 1,
    active: true,
    healthy: false,
    targetFailures: [{
      targetId: "target-b",
      attempts: 1,
      state: "retrying",
      lastFailure: "Execution context was destroyed",
    }],
    runtimeSessionId: "runtime-session-target-isolation",
  });

  failTargetB = false;
  runtime.targetFailures.get("target-b").nextRetryAt = 0;
  await runtime.refreshTargets();
  assert.equal(runtime.injectedTargets.size, 2);
  assert.equal(closed.includes("target-a"), false);
  assert.deepEqual(runtime.getRendererStatus().targetFailures, []);
  assert.equal(runtime.getRendererStatus().healthy, true);
});

test("clears injected target state when the current target list disappears", async () => {
  const closed = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-stale-target-profile",
    cdpPort: 9241,
    fetchImpl: async () => {
      throw new Error("CDP target list unavailable");
    },
    logger: { log() {}, warn() {} },
  });
  runtime.rendererDiscovered = true;
  runtime.injectedTargets.add("target-stale");
  runtime.clients.set("target-stale", {
    socket: {
      close() {
        closed.push("target-stale");
      },
    },
  });
  runtime.scriptIds.set("target-stale", "script-stale");
  runtime.bindingTokens.set("target-stale", "binding-stale");

  await assert.rejects(runtime.refreshTargets(), /CDP target list unavailable/);
  assert.deepEqual(runtime.getRendererStatus(), {
    discovered: false,
    discoveredTargets: 0,
    injectedTargets: 0,
    active: false,
    healthy: false,
    targetFailures: [],
    runtimeSessionId: runtime.runtimeSessionId,
  });
  assert.deepEqual(closed, ["target-stale"]);
  assert.equal(runtime.clients.size, 0);
  assert.equal(runtime.injectedTargets.size, 0);
});

test("clears stale renderer state for non-OK and invalid target-list responses", async () => {
  for (const scenario of [
    {
      name: "non-OK",
      response: { ok: false, status: 503, async json() { return []; } },
      error: /HTTP 503/,
    },
    {
      name: "invalid-list",
      response: { ok: true, async json() { return { targets: [] }; } },
      error: /not an array/,
    },
  ]) {
    const closed = [];
    const runtime = new CodexRuntime({
      features: [],
      profileDir: `/tmp/codex-runtime-stale-${scenario.name}-profile`,
      cdpPort: 9242,
      fetchImpl: async () => scenario.response,
      logger: { log() {}, warn() {} },
    });
    runtime.rendererDiscovered = true;
    runtime.injectedTargets.add("target-stale");
    runtime.clients.set("target-stale", {
      socket: {
        close() {
          closed.push("target-stale");
        },
      },
    });

    await assert.rejects(runtime.refreshTargets(), scenario.error);
    assert.deepEqual(runtime.getRendererStatus(), {
      discovered: false,
      discoveredTargets: 0,
      injectedTargets: 0,
      active: false,
      healthy: false,
      targetFailures: [],
      runtimeSessionId: runtime.runtimeSessionId,
    });
    assert.deepEqual(closed, ["target-stale"]);
    assert.equal(runtime.clients.size, 0);
    assert.equal(runtime.injectedTargets.size, 0);
  }
});

test("writes and clears managed Codex PID identity through an atomic file seam", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-pid-file-"));
  const filePath = path.join(directory, "codex.pid");
  try {
    const writePid = createManagedPidFileWriter(filePath);
    await writePid(9251);
    assert.equal(await readFile(filePath, "utf8"), "9251\n");
    await writePid(null);
    await assert.rejects(readFile(filePath), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serializes asynchronous managed Codex PID updates across launch boundaries", async () => {
  const events = [];
  let releaseFirst;
  const firstUpdate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-pid-queue-profile",
    onManagedCodexPidChange: async (pid) => {
      events.push(`start:${pid}`);
      if (pid === 9252) await firstUpdate;
      events.push(`done:${pid}`);
    },
  });

  runtime.notifyManagedCodexPidChange(9252);
  runtime.notifyManagedCodexPidChange(null);
  assert.deepEqual(events, ["start:9252"]);

  releaseFirst();
  await runtime.flushManagedCodexPidChange();
  assert.deepEqual(events, [
    "start:9252",
    "done:9252",
    "start:null",
    "done:null",
  ]);
});

test("reports renderer absence as inactive and reconciles service-free plugins only after injection", async () => {
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-status-profile",
  });
  assert.deepEqual(runtime.getRendererStatus(), {
    discovered: false,
    discoveredTargets: 0,
    injectedTargets: 0,
    active: false,
    healthy: false,
    targetFailures: [],
    runtimeSessionId: runtime.runtimeSessionId,
  });

  const { createRuntimeReadyContract } = await import("../src/codex-runtime.mjs");
  const contract = createRuntimeReadyContract({
    pid: 1,
    features: [{ id: "model-slider" }, { id: "notes" }],
    plugins: [
      { featureId: "model-slider", state: "configured", owned: false, health: null, failure: null },
      { featureId: "notes", state: "ready", owned: true, health: null, failure: null },
      { featureId: "images", state: "failed", owned: true, health: null, failure: { code: "DOWN" } },
    ],
    failures: [{ featureId: "images", message: "down" }],
    renderer: {
      discovered: true,
      discoveredTargets: 2,
      injectedTargets: 1,
      active: true,
      targetFailures: [{
        targetId: "renderer-b",
        attempts: 1,
        state: "retrying",
        lastFailure: "Execution context was destroyed",
      }],
    },
    runtimeSessionId: "runtime-session-contract",
  });
  assert.equal(contract.plugins.find((plugin) => plugin.featureId === "model-slider").state, "injected");
  assert.equal(contract.plugins.find((plugin) => plugin.featureId === "notes").state, "injected");
  assert.equal(contract.plugins.find((plugin) => plugin.featureId === "images").state, "failed");
  assert.equal(contract.renderer.active, true);
  assert.equal(contract.renderer.healthy, false);
  assert.equal(contract.renderer.discoveredTargets, 2);
  assert.equal(contract.renderer.targetFailures.length, 1);

  const inactiveContract = createRuntimeReadyContract({
    pid: 1,
    features: [{ id: "model-slider" }],
    plugins: [{ featureId: "model-slider", state: "configured", owned: false }],
    renderer: { discovered: false, injectedTargets: 0, active: true },
    runtimeSessionId: "runtime-session-contract",
  });
  assert.equal(inactiveContract.renderer.active, false);
  assert.equal(inactiveContract.plugins[0].state, "configured");
});

test("disposes the current document before removing future scripts and closing CDP", async () => {
  const calls = [];
  const client = {
    socket: {
      close() {
        calls.push("socket.close");
      },
    },
    async send(method) {
      calls.push(method);
      return {};
    },
  };
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/codex-runtime-shutdown-profile",
  });
  runtime.clients.set("target-1", client);
  runtime.scriptIds.set("target-1", "script-1");
  runtime.bindingTokens.set("target-1", "binding-1");
  runtime.injectedTargets.add("target-1");
  runtime.rendererTargetIds.add("target-1");
  runtime.targetFailures.set("target-failed", {
    attempts: 1,
    lastFailure: "context destroyed",
    nextRetryAt: Date.now() + 250,
  });

  await runtime.stop();
  assert.deepEqual(calls, [
    "Runtime.evaluate",
    "Page.removeScriptToEvaluateOnNewDocument",
    "Runtime.removeBinding",
    "socket.close",
  ]);
  assert.equal(runtime.rendererTargetIds.size, 0);
  assert.equal(runtime.targetFailures.size, 0);
});
