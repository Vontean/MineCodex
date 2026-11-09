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
  SESSION_STATUS_THREAD_ID_EXPRESSION,
  createInjectionSource,
  pageScriptServiceOrigin,
} from "../src/codex-runtime.mjs";
import { createManagedPidFileWriter } from "../src/pid-file.mjs";
import { HOST_BINDING_NAME } from "../src/codex-injection.mjs";

function rendererTransportStatus(runtime) {
  const { targets, ...transport } = runtime.getRendererStatus();
  assert.ok(Array.isArray(targets));
  return transport;
}

test("authenticates immediate status requests, coalesces reads, and invalidates timed-out connections", async () => {
  const runtime = new CodexRuntime({ features: [{ id: "session-status" }], profileDir: "/tmp/mcx-status-request", logger: { warn() {} } });
  const threadId = "11111111-2222-4333-8444-555555555555";
  let resolveRead;
  let reads = 0;
  let fail = false;
  const updates = [];
  runtime.sessionStatusReader = {
    read() { reads++; return new Promise((resolve) => { resolveRead = resolve; }); },
    retryAfterMs() { return 500; },
  };
  const client = {
    socket: { readyState: 1, close() { this.readyState = 3; } },
    async send(method, params, options) {
      assert.equal(options.timeoutMs, 3000);
      if (fail) throw new Error("CDP request timed out");
      if (params.expression === SESSION_STATUS_THREAD_ID_EXPRESSION) return { result: { value: [threadId] } };
      updates.push(params.expression);
      return {};
    },
  };
  runtime.clients.set("target", client);
  runtime.injectedTargets.add("target");
  runtime.bindingTokens.set("target", "secret");
  const request = (token) => runtime.handleBindingCalled("target", client, {
    name: HOST_BINDING_NAME,
    payload: JSON.stringify({ token, featureId: "session-status", requestId: "refresh", action: "refresh-session-status" }),
  });
  await request("wrong");
  assert.equal(reads, 0);
  const first = request("secret");
  const second = request("secret");
  await Promise.resolve();
  assert.equal(reads, 1);
  resolveRead(null);
  await Promise.all([first, second]);
  assert.equal(updates.length, 1);
  assert.match(updates[0], /"retryAfterMs":500/);
  fail = true;
  await request("secret");
  assert.equal(client.socket.readyState, 3);
  assert.equal(runtime.injectedTargets.has("target"), false);
  assert.equal(runtime.sessionStatusUpdates.size, 0);
});

test("session status reads composer-bound threads only", () => {
  const threadId = "01a0db9f-71af-74d2-9189-17dfb57c096e";
  const read = ({ portalId, placement = "thread", selectedId = null, portalPresent = true, codexComposer = true }) => {
    const portal = portalPresent ? { getAttribute: () => portalId } : null;
    const card = {
      querySelector: () => portal,
      getAttribute: () => placement,
      isConnected:true, checkVisibility:()=>true,
      closest:selector=>selector === '[data-codex-composer-root]' ? card : null,
    };
    const document = {
      querySelectorAll(selector) {
        if (selector.includes("data-codex-composer-root")) return codexComposer ? [card] : [];
        if (selector.includes("data-app-action-sidebar-thread-selected")) {
          return selectedId ? { getAttribute: () => selectedId } : null;
        }
        return null;
      },
    };
    return Array.from(vm.runInNewContext(SESSION_STATUS_THREAD_ID_EXPRESSION, {
      document,
      location: { pathname: "/index.html", search: "", hash: "" },
    }));
  };

  assert.deepEqual(read({ portalId: threadId }), [threadId]);
  assert.deepEqual(read({ portalId: null, placement: "home", selectedId: `local:${threadId}` }), []);
  assert.deepEqual(read({ portalPresent: false, selectedId: `local:${threadId}` }), []);
  assert.deepEqual(read({ portalId: threadId, codexComposer: false, selectedId: `local:${threadId}` }), []);
});

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

async function executeModelSliderInjection({
  controllerProps,
  features = [modelSliderFeatureFixture()],
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
      this.dataset = {};
      this.isConnected = true;
      this.hidden = false;
      this.outerHTML = `<${tagName}></${tagName}>`;
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
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
      const alternatives = selector.match(/^:is\((.+)\)$/);
      if (alternatives) {
        return alternatives[1].split(/,\s*/).some((part) => this.matches(part));
      }
      const classContains = selector.match(/^\[class\*="([^"]+)"\]$/);
      if (classContains) return String(this.className ?? this.getAttribute("class") ?? "").includes(classContains[1]);
      if (selector === '[style*="--thread-wide-block-inline-shift"]') {
        return Boolean(this.style.getPropertyValue("--thread-wide-block-inline-shift"));
      }
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
  trigger.checkVisibility = () => true;
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
  const footerOwner = new FixtureElement("div");
  footerOwner.setAttribute("data-thread-scroll-footer", "true");
  scrollContainer.append(scrollContent);
  scrollContainer.firstElementChild = scrollContent;
  conversation.append(composer);
  footerOwner.append(conversation);
  mainContent.append(scrollContainer, footerOwner);
  mainContent.querySelector = (selector) => (
    selector === ".thread-scroll-container" ? scrollContainer : mainContent.querySelectorAll(selector)[0] ?? null
  );
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
      if (selector === '[data-codex-composer="true"][contenteditable="true"]') return composer;
      if (selector === "[data-app-shell-main-content-layout]") return mainContentLayout;
      if (selector === "main[data-app-shell-main-surface]") return mainContent;
      return selector === 'link[href*="/assets/app-initial-"][href$=".js"]' ? sourceLink : null;
    },
    querySelectorAll(selector) {
      if (selector === 'link[rel="modulepreload"],script[src]') return [sourceLink];
      if (selector === "[data-codex-intelligence-trigger]") return [trigger];
      return [documentElement, mainContentLayout]
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
      states: Object.keys(modelSelectorNativeFastIcons ?? {}),
      dirty: modelSelectorNativeFastIconsDirty,
    });
    window.__selectNativeEffortProbe = (raw, effort) => {
      const menu = document.createElement("div");
      const row = document.createElement("div");
      row.setAttribute("role", "menuitem");
      row.setAttribute("aria-haspopup", "menu");
      row.innerText = "Model\\n" + raw;
      menu.querySelectorAll = () => [row];
      selectNativeEffort(menu, effort);
    };
    window.__staleVisualProbe = () => {
      const rail = document.createElement("div");
      const nativeRange = document.createElement("span");
      nativeRange.setAttribute("data-codex-model-slider-native-range", "");
      nativeRange.style.setProperty("left", "calc(25% + 6.5px)");
      const nativeThumb = document.createElement("span");
      nativeThumb.setAttribute("data-codex-model-slider-native-thumb", "");
      nativeThumb.style.setProperty("left", "calc(25% + 6.5px)");
      const fallbackRange = document.createElement("span");
      fallbackRange.setAttribute("data-codex-model-slider-range", "");
      const fallbackThumb = document.createElement("span");
      fallbackThumb.setAttribute("data-codex-model-slider-thumb", "");
      const tick = document.createElement("span");
      tick.setAttribute("data-codex-model-slider-tick", "");
      tick.setAttribute("data-selected", "true");
      rail.append(nativeRange, nativeThumb, fallbackRange, fallbackThumb, tick);
      rail.setAttribute("aria-valuenow", "1");
      rail.style.setProperty("--codex-model-slider-progress", "25%");
      neutralizeStaleSliderVisual(rail);
      return {
        nativeRangeVisibility: nativeRange.style.getPropertyValue("visibility"),
        nativeThumbVisibility: nativeThumb.style.getPropertyValue("visibility"),
        fallbackRangeVisibility: fallbackRange.style.getPropertyValue("visibility"),
        fallbackThumbVisibility: fallbackThumb.style.getPropertyValue("visibility"),
        selectedTick: tick.getAttribute("data-selected"),
        ariaValueNow: rail.getAttribute("aria-valuenow"),
        progress: rail.style.getPropertyValue("--codex-model-slider-progress"),
        nativeThumbLeft: nativeThumb.style.getPropertyValue("left"),
      };
    };
    window.__maximumVisualProbe = () => {
      const rail = document.createElement("div");
      const maxEffects = document.createElement("span");
      maxEffects.className = "_MaxEffects_test";
      maxEffects.style.opacity = "0";
      rail.append(maxEffects);
      const effortText = document.createElement("span");
      const fastButton = document.createElement("button");
      syncGenericMaximumVisual(rail, effortText, fastButton, true);
      const maximum = {
        highlighted: rail.getAttribute("data-highlighted"),
        max: rail.getAttribute("data-max"),
        effectsOpacity: maxEffects.style.opacity,
        effectsTransform: maxEffects.style.transform,
        effortMaximum: effortText.getAttribute("data-maximum"),
        fastMaximum: fastButton.getAttribute("data-max-power-selection"),
      };
      syncGenericMaximumVisual(rail, effortText, fastButton, false);
      return {
        maximum,
        regular: {
          highlighted: rail.getAttribute("data-highlighted"),
          max: rail.getAttribute("data-max"),
          effectsOpacity: maxEffects.style.opacity,
          effortMaximum: effortText.getAttribute("data-maximum"),
          fastMaximum: fastButton.getAttribute("data-max-power-selection"),
        },
      };
    };
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
        selectedIndex: efforts.findIndex((level) => level.effort === selectedEffort),
        efforts: efforts.map((level) => level.effort),
      };
    };
    window.__modelSliderDisplayProbe = (raw, models) => modelDisplayLabel(
      modelIdentity(raw),
      { ...modelSelectorFeature.modelSelector, models },
    );
    window.__modelWithOpenCodexEffortsProbe = (raw) => {
      const identity = modelIdentity(raw);
      const model = modelDefinitionFor(identity, modelSelectorFeature.modelSelector);
      const display = modelWithOpenCodexEfforts(identity, modelSelectorFeature.modelSelector, model);
      return (display?.supportedReasoningLevels ?? []).map((level) => level.effort);
    };
    window.__modelSliderCompactLabelProbe = (raw) => compactModelLabel(raw);
    window.__visibleControllerModelsProbe = (models, selected) => visibleControllerModels({
      models,
      model: selected,
    }).map((model) => model.model);
    void loadNativeFastIconFromBundle();`,
  );
  const context = {
    AbortController,
    URL,
    Element: FixtureElement,
    HTMLElement: FixtureElement,
    File: class FixtureFile {},
    MutationObserver: class FixtureMutationObserver {
      observe() {}
      disconnect() {}
    },
    ResizeObserver: class FixtureResizeObserver {
      constructor(callback) { this.callback = callback; }
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
      return { ok:true, async text() { return ""; } };
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
    updateHostBinding: (name, token) => window.__codexPersonalRuntime.updateHostBinding(name, token),
    pageScriptBinding: () => window.__pageScriptBindingProbe?.(),
    displayLabel: (raw, models = []) => window.__modelSliderDisplayProbe?.(raw, models) ?? null,
    compactLabel: (raw) => window.__modelSliderCompactLabelProbe?.(raw) ?? null,
    visibleControllerModels: (models, selected) => window.__visibleControllerModelsProbe?.(models, selected) ?? null,
    effortProbe: (raw) => {
      const value = window.__modelSliderEffortProbe?.(raw);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    realEffortProbe: (raw) => window.__modelWithOpenCodexEffortsProbe?.(raw) ?? null,
    selectNativeEffort: (raw, effort) => window.__selectNativeEffortProbe?.(raw, effort),
    staleVisual: () => {
      const value = window.__staleVisualProbe?.();
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    maximumVisual: () => {
      const value = window.__maximumVisualProbe?.();
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    fetchCalls,
    probe: probe ? JSON.parse(JSON.stringify(probe)) : null,
    runtimeInstalled: Boolean(window.__codexPersonalRuntime),
  };
}

test("rotates existing page-script binding credentials on renderer reconnect", async () => {
  const fixture = await executeModelSliderInjection({
    features: [{
      id: "session-status", label: "Session Status", labels: { en: "Session Status" },
      entry: { kind: "page-script" },
      pageScript: { source: "window.__pageScriptBindingProbe = () => ({ name: config.bindingName, token: config.bindingToken });" },
    }],
  });
  fixture.updateHostBinding("new-binding", "new-token");
  assert.equal(fixture.pageScriptBinding().name, "new-binding");
  assert.equal(fixture.pageScriptBinding().token, "new-token");
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
    assert.ok(result.fetchCalls > 0, scenario.name);
  }
});

test("main defers feature startup publication and leaves foreground ChatGPT launching to the CLI adapter", async () => {
  const source = await readFile(new URL("../src/main.mjs", import.meta.url), "utf8");

  assert.match(source, /deferredStart: true/);
  assert.match(source, /onStatusChange: requestReadyFileRefresh/);
  assert.match(source, /let runtimeReady = false/);
  assert.match(source, /await runtime\.start\(\);\s*runtimeReady = true;\s*await writeReadyFile\(\)/);
  assert.doesNotMatch(source, /MINECODEX_CODEX_EXECUTABLE|MINECODEX_LAUNCH_CODEX|launchCodex/);
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
  // 26.1029 起原生模型按钮改用 composer 导航锚点，旧属性作为首选回退。
  assert.match(source, /data-composer-navigation-target="reasoning"/);
  assert.match(source, /data-model-picker-view-toggle/);
  assert.match(source, /function modelIdentity\(rawValue\)/);
  assert.match(source, /function modelDisplayLabel\(identity, selector\)/);
  assert.match(source, /featureUI.surface\(menu, "dropdown", \{ variant: "opaque" \}\)/);
  assert.match(source, /data-mcx-ui-surface=popover/);
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
  assert.match(source, /const raw = favoriteModelId\(observedRaw, \{ authoritative: rawValue !== null/);
  assert.match(source, /item\.dataset\.codexModelSliderIdentitySource = catalogModel \? "catalog" : nativeDescriptor \? "native" : "visible"/);
  // Reused menu rows must refresh dataset before the row-exists shortcut.
  assert.match(source, /item\.dataset\.codexModelSliderIdentitySource = catalogModel \? "catalog" : nativeDescriptor \? "native" : "visible";\s+if \(item\.querySelector\("\[data-codex-model-slider-row\]"\)\) return;/);
  assert.doesNotMatch(source, /if \(item\.querySelector\("\[data-codex-model-slider-row\]"\)\) return;\s+const observedRaw = modelItemRawValue\(item\);/);
  assert.match(source, /function captureNativeFastIcon\(\)/);
  assert.match(source, /template\.cloneNode\(true\)/);
  // Regression guard: icon building reads the ready store only and must not re-enter capture.
  assert.match(source, new RegExp(String.raw`modelSelectorNativeFastIcons\?\.\[active \? \"active\" : \"inactive\"\]`));
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
  // P2c guard: Fast 图标直接从原生控件获取，并在状态切换后更新缓存。
  assert.match(source, /const nativeContent = Array\.from\(document\.querySelectorAll\(':is\(\[class\*="_FastModeToggleContent_"\], \[class\*="FastModeToggleContent-"\]\)'\)\)/);
  assert.match(source, /const state = toggle\?\.getAttribute\("data-fast-mode-enabled"\) === "true" \? "active" : "inactive"/);
  assert.match(source, /function loadNativeFastIconFromBundle\(\)/);
  assert.match(source, /modelSelectorFastIconStorageKey = "codex-model-slider:fast-icons:v1"/);
  assert.match(source, /function persistNativeFastIcons\(\)/);
  assert.match(source, /function loadPersistedNativeFastIcons\(storageKey\)/);
  assert.match(source, /function applyNativeFastIconsToShells\(\)/);
  assert.match(source, /modelSelectorNativeFastIcons\[state\] = template/);
  assert.match(source, /width: 264px !important; min-width: 264px/);
  assert.match(source, /data-codex-model-slider-item\]\[data-codex-model-slider-selected\].*color-token-list-hover-background/);
  assert.match(source, /data-codex-model-slider-star\]::after \{/);
  assert.match(source, /top: 0; right: 0; bottom: 0; width: 40px/);
  assert.match(source, /data-codex-model-slider-star\] svg \{ position: relative; z-index: 2;.*pointer-events: none/);
  assert.match(source, /selected \?\? Boolean\(item\.querySelector\("svg"\)\)/);
  assert.doesNotMatch(source, /data-codex-model-slider-check/);
  assert.doesNotMatch(source, /star\.addEventListener\("click"/);
  assert.match(source, /menu\.addEventListener\("click", \(event\) => \{/);
  assert.match(source, /toggleModelFavorite\(event, menu, selector, raw, label\)/);
  assert.match(source, /for \(const type of \["mousedown", "pointerup", "mouseup"\]\)/);
  assert.match(source, /function sizeModelMenuViewport\(menu, maxVisibleItems\)/);
  assert.match(source, /const lastVisibleItem = items\[maxVisibleItems - 1\]/);
  assert.match(source, /const starred = visible\.filter/);
  assert.match(source, /const ordinary = visible\.filter/);
  assert.match(
    source,
    /if \(visibleBlockingDialog\(\)\) \{[\s\S]*?closeNativeModelPickerSubmenus\(\);[\s\S]*?return;?[\s\S]*?\}/,
  );
  assert.match(source, /function closeNativeModelPickerSubmenus\(\)/);
  assert.match(source, /function enhanceComposerModelTrigger\(trigger, selector\)/);
  assert.match(source, /for \(const trigger of triggers\) enhanceComposerModelTrigger\(trigger, selector\)/);
  assert.match(source, /:has\(\+ \[data-codex-model-slider-trigger-label\]\)/);
  assert.match(source, /data-codex-model-slider-trigger/);
  assert.match(source, /max-width: 110px/);
  assert.match(source, /overflow: hidden; text-overflow: ellipsis/);
  assert.match(source, /data-codex-model-slider-selecting-effort/);
  assert.match(source, /function nativeCssModuleClass\(tokenName, root = document\)/);
  for (const tokenName of ["ViewControls", "ViewToggleContent", "ViewToggleIcon", "SimpleView"]) {
    assert.match(source, new RegExp(`"${tokenName}"`));
  }
  assert.match(source, /nativeCssModuleClass\(tokenName, parentMenu\)/);
  assert.match(source, /if \(Object\.values\(classes\)\.some\(\(name\) => !name\)\) return null/);
  assert.match(source, /if \(!shell\) \{\s*restoreGenericModelPicker\(nativeContainer\);\s*return false;/);
  assert.doesNotMatch(source, /_1ryrb_/);
  assert.match(source, /const canUpgradeFallback = Boolean/);
  assert.match(source, /if \(efforts\.length < 2\) \{\s*panel\.append\(viewControls\);\s*return shell;/);
  assert.doesNotMatch(source, /if \(!model \|\| efforts\.length < 2\) return false/);
  assert.match(source, /observer\.observe\(trigger, \{ childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: \["data-state"\] \}\)/);
  assert.match(
    source,
    /modelSelectorPendingReturn[\s\S]*?nativeModelPickerSubmenus\(\)\.length === 0[\s\S]*?clearTimeout\(modelSelectorReturnTimer\)[\s\S]*?returnToNativeModelSlider\(\)/,
  );
  assert.match(source, /characterData: true/);
  assert.match(source, /ensureFrame = requestAnimationFrame\(flushEnsure\)/);
  assert.match(source, /ensureTimer = setTimeout\(flushEnsure, 50\)/);
  assert.match(source, /previewFrame = requestAnimationFrame/);
  assert.match(source, /dragRect = rail\.getBoundingClientRect\(\)/);
  assert.match(
    source,
    /beginNativeEffortTransaction\(\);[\s\S]*?setReactControlledMenuOpen\(row, true\)/,
  );
  assert.match(source, /function setReactControlledMenuOpen\(element, open\)/);
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
    /const dismissAfterCommit = modelSelectorPendingOutsideDismiss;[\s\S]*?invokeNativeMenuItemSelect\(item\)[\s\S]*?closeReactControlledMenu\(item\)[\s\S]*?nativeComposerTrigger/,
  );
  assert.doesNotMatch(
    source,
    /if \(item\) \{[\s\S]*?setTimeout\([\s\S]*?dispatchPointerClick\(currentItem\)/,
  );
  assert.match(source, /restoreModelSelectorEnhancements\(\)/);
  assert.match(source, /data-codex-model-slider-catalog-ready/);
  assert.match(source, /data-codex-model-slider-trigger-label/);
  assert.match(source, /"favoriteStorageKey":"codex-model-slider:favorites:v1"/);
});

test("shows only the final model-id segment while preserving provider identity", async () => {
  const feature = modelSliderFeatureFixture();
  const models = [
    {
      slug: "command-code/z-ai-glm-5.3-flash",
      displayName: "commandcode-auth/z-ai/glm-5.3-flash",
      supportedReasoningLevels: [],
    },
    {
      slug: "command-code/Qwen-Qwen3.8-Flash",
      displayName: "commandcode-auth/Qwen/Qwen3.8-Flash",
      supportedReasoningLevels: [],
    },
  ];
  const result = await executeModelSliderInjection({ features: [feature] });

  assert.equal(result.displayLabel("command-code/z-ai/glm-5.3-flash", models), "GLM 5.3 Flash");
  assert.equal(result.displayLabel("command-code/Qwen/Qwen3.8-Flash", models), "Qwen3.8 Flash");
  assert.equal(result.compactLabel("command-code/z-ai/glm-5.3-flash"), "GLM 5.3 Flash");
  assert.equal(result.compactLabel("5.6 Terra"), "5.6 Terra");
});

test("keeps the generic model menu on the Composer controller lifecycle", () => {
  const source = createInjectionSource([modelSliderFeatureFixture()]);

  assert.match(source, /function openControllerModelMenu\(parentMenu, modelButton, selector\)/);
  assert.match(source, /currentController\.onSelectModel\(raw, reasoningEffort\)/);
  assert.match(source, /search\.focus\(\{ preventScroll: true \}\)/);
});

test("hides effortless OCX aliases of native GPT models while retaining distinct routes", async () => {
  const result = await executeModelSliderInjection();
  const models = [
    { model: "gpt-6-astra", supportedReasoningEfforts: ["high"] },
    { model: "command-code/gpt-6-astra", supportedReasoningEfforts: [] },
    { model: "gpt-6-sol", supportedReasoningEfforts: ["high"] },
    { model: "command-code/gpt-6-sol", supportedReasoningEfforts: [] },
    { model: "openrouter/gpt-6-sol", supportedReasoningEfforts: ["high"] },
    { model: "command-code/other-model", supportedReasoningEfforts: [] },
  ];
  assert.deepEqual(result.visibleControllerModels(models, "gpt-6-sol"), [
    "gpt-6-astra", "gpt-6-sol", "openrouter/gpt-6-sol", "command-code/other-model",
  ]);
  assert.deepEqual(result.visibleControllerModels(models, "command-code/gpt-6-astra"), [
    "gpt-6-astra", "command-code/gpt-6-astra", "gpt-6-sol",
    "openrouter/gpt-6-sol", "command-code/other-model",
  ]);
});

test("rebuilds the upgraded native Slider and routes its compact model entry to MCX", () => {
  const source = createInjectionSource([modelSliderFeatureFixture()]);

  assert.match(
    source,
    /menu\.querySelector\("\[data-reasoning-slider\]"\)[\s\S]*?menu\.querySelector\("\[data-model-picker-view-toggle\]"\)/,
  );
  assert.match(
    source,
    /function nativeModelValue\(menu\)[\s\S]*?_ViewToggleModelLabel_[\s\S]*?toggleModelLabel\?\.textContent \?\? toggle\.innerText[\s\S]*?toggleValues\[0\]/,
  );
  assert.match(
    source,
    /function enhanceNativeModelPicker\(parentMenu, selector\) \{\s*if \(enhanceGenericModelPicker\(parentMenu, selector\)\) return;/,
  );
  assert.match(source, /const label = compactModelLabel\(raw\)/);
  assert.match(source, /openControllerModelMenu\(parentMenu, toggle, selector\)/);
  assert.match(source, /if \(event\.key !== "Enter" && event\.key !== " "\) return;/);
  assert.match(source, /function pruneNativeModelToggleHandlers\(\)/);
  assert.match(source, /if \(enhanceGenericModelPicker\(parentMenu, selector\)\) return;/);
  assert.match(source, /currentController\.onSelectModel\(raw, reasoningEffort\)/);
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

test("preserves native reasoning ladders verbatim", async () => {
  const controller = {
    models: [
      { model: "opencode-go/hy3", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map((effort) => ({ reasoningEffort: effort })) },
      { model: "opencode-go/muse-spark-1.2-contributor", supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map((effort) => ({ reasoningEffort: effort })) },
      { model: "other-provider/hy3", supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "max" }] },
      { model: "opencode-go/muse-spark-similar", supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "max" }] },
    ],
    reasoningEffort: "high",
    onSelectReasoningEffort() {},
  };
  const feature = modelSliderFeatureFixture();
  const result = await executeModelSliderInjection({ controllerProps: controller, features: [feature] });
  assert.deepEqual(result.effortProbe("opencode-go/hy3").efforts, ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(result.effortProbe("opencode-go/muse-spark-1.2-contributor").efforts, ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(result.effortProbe("other-provider/hy3").efforts, ["low", "max"]);
  assert.deepEqual(result.effortProbe("opencode-go/muse-spark-similar").efforts, ["low", "max"]);
});


test("neutralizes stale rail geometry instead of leaving a valid-looking thumb", async () => {
  const result = await executeModelSliderInjection({
    controllerProps: {
      models: [{
        model: "opencode-go/muse-spark-1.2-contributor",
        supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max"].map(
          (effort) => ({ reasoningEffort: effort }),
        ),
      }],
      reasoningEffort: "max",
      onSelectReasoningEffort() {},
    },
  });
  assert.deepEqual(result.staleVisual(), {
    nativeRangeVisibility: "hidden",
    nativeThumbVisibility: "hidden",
    fallbackRangeVisibility: "hidden",
    fallbackThumbVisibility: "hidden",
    selectedTick: null,
    ariaValueNow: null,
    progress: "",
    nativeThumbLeft: "calc(25% + 6.5px)",
  });
  const source = createInjectionSource([modelSliderFeatureFixture()]);
  assert.match(source, /neutralizeStaleSliderVisual\(rail\);/);
  assert.match(source, /setGenericSliderVisual\(rail, selectedIndex, efforts\.length\);/);
});

test("synchronizes the native maximum highlight with effort previews", async () => {
  const result = await executeModelSliderInjection({
    controllerProps: {
      models: [{
        model: "gpt-5.6-sol",
        supportedReasoningEfforts: ["low", "medium", "high", "max", "ultra"].map(
          (reasoningEffort, powerSettingIndex) => ({ reasoningEffort, powerSettingIndex }),
        ),
      }],
      reasoningEffort: "ultra",
      onSelectReasoningEffort() {},
    },
  });
  assert.deepEqual(result.maximumVisual(), {
    maximum: { highlighted: "true", max: "true", effectsOpacity: "1", effectsTransform: "translateX(0)", effortMaximum: "true", fastMaximum: "true" },
    regular: { highlighted: "false", max: "false", effectsOpacity: "0", effortMaximum: "false", fastMaximum: "false" },
  });
});

test("forwards native ladder effort selections to the controller", async () => {
  const selections = [];
  const controller = {
    models: [{ model: "opencode-go/hy3", supportedReasoningEfforts: ["low", "medium", "high", "max"].map((effort) => ({ reasoningEffort: effort })) }],
    reasoningEffort: "medium",
    onSelectReasoningEffort(effort) { selections.push(effort); },
  };
  const feature = modelSliderFeatureFixture();
  const result = await executeModelSliderInjection({ controllerProps: controller, features: [feature] });
  result.selectNativeEffort("opencode-go/hy3", "high");
  result.selectNativeEffort("opencode-go/hy3", "max");
  assert.deepEqual(selections, ["high", "max"]);
});

test("commits native ladder effort selections through the power controller", async () => {
  const selections = [];
  const commits = [];
  const powerSelections = ["low", "medium", "high", "max"].map((reasoningEffort, powerSettingIndex) => ({
    id: `opencode-go/hy3:${reasoningEffort}`,
    model: "opencode-go/hy3",
    reasoningEffort,
    powerSettingIndex,
  }));
  const controller = {
    models: [{
      model: "opencode-go/hy3",
      displayName: "Hy 3",
      supportedReasoningEfforts: powerSelections.map(({ reasoningEffort }) => ({ reasoningEffort })),
    }],
    model: "opencode-go/hy3",
    reasoningEffort: "medium",
    powerSelections,
    selectedPowerSelection: powerSelections[1],
    onSelectPower(next) { selections.push(next); },
    onCommitPower(next, previous) { commits.push({ next, previous }); },
  };
  const feature = modelSliderFeatureFixture();
  const result = await executeModelSliderInjection({ controllerProps: controller, features: [feature] });
  result.selectNativeEffort("Hy 3", "high");
  assert.deepEqual(selections, [powerSelections[2]]);
  assert.deepEqual(commits, [{ next: powerSelections[2], previous: powerSelections[1] }]);
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
    /const nativeModel = nativeCatalogModelFor\(identity\);\r?\n\s*const selectedEffort = nativeModel\?\.currentReasoningLevel[\s\S]*?getAttribute\("data-selected-reasoning-effort"\)/,
  );
  assert.match(
    source,
    /nativeModel\?\.currentReasoningLevel\s*\?\?[\s\S]*?\?\? model\.defaultReasoningLevel\s*\?\? efforts\[0\]\?\.effort/,
  );
  assert.match(source, /const currentReasoningLevel = String\(controller\?\.reasoningEffort \?\? ""\)\.toLowerCase\(\)/);
  // 已解析 effort 决定最终滑杆索引：max 落在最右档。
  assert.match(source, /const selectedIndex = efforts\.indexOf\(selectedEffort\)/);
  // 任务切换时按可控状态重建：结构 key 包含已解析 effort。
  assert.match(source, /const structureKey = `\$\{identity\.raw\}:\$\{selectedEffortValue\}:/);
  assert.match(source, /const key = `\$\{structureKey\}:\$\{serviceTierKey\}`/);
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
    /data-codex-model-slider-trigger\] \[class\*="ModelPickerTriggerEffortLabel"\]\s*\{[\s\S]*?display: inline-flex; align-items: center; align-self: center;/,
  );
});

test("keeps the model-panel chevron beside the model name", () => {
  const source = createInjectionSource([modelSliderFeatureFixture()]);
  assert.match(source, /effortText\.style\.gridColumn = "2";/);
  assert.match(source, /effortText\.style\.gridRow = "1";/);
  assert.match(source, /modelRow\.append\(buttonLabel\);/);
  assert.match(source, /modelRow\.append\(nativeChevron\);/);
  assert.match(source, /buttonContent\.append\(effortRow, modelRow\);/);
});

test("rebuilds the upgraded native slider from the selected model capabilities", () => {
  const source = createInjectionSource([modelSliderFeatureFixture()]);

  // 新版原生 powerSelections 会混入其他模型的档位；必须先进入 MCX 的单模型 shell。
  assert.match(
    source,
    /function enhanceNativeModelPicker\(parentMenu, selector\) \{\s*if \(enhanceGenericModelPicker\(parentMenu, selector\)\) return;/,
  );
});

test("distinguishes placeholder from real model label, hugging real names", () => {
  const source = createInjectionSource([modelSliderFeatureFixture()]);

  // 占位态（Select model / Select effort）沿用原生 110px 上限省略规则。
  assert.match(
    source,
    /data-codex-model-slider-trigger-label\] \{[\s\S]*?max-width: 110px;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/,
  );
  // 真实模型态：芯片 HUG 完整名称，长名称不被 110px 截断；effort 不收缩。
  assert.match(
    source,
    /:not\(\[data-codex-model-slider-trigger-placeholder\]\) \[data-codex-model-slider-trigger-label\] \{\s*max-width: none; overflow: visible; text-overflow: clip; flex-shrink: 0;/,
  );
  assert.match(
    source,
    /:not\(\[data-codex-model-slider-trigger-placeholder\]\) \[class\*="ModelPickerTriggerModelLabel"\] \{\s*max-width: none; overflow: visible; flex-shrink: 0;/,
  );
  assert.match(
    source,
    /data-codex-model-slider-trigger-placeholder\] \[class\*="ModelPickerTriggerContent"\] \{\s*width: 160px; min-width: 160px !important; max-width: 160px;/,
  );
  assert.ok(source.includes("select\\s+(model|effort)"));
  assert.match(
    source,
    /placeholderNode\.nodeValue = locale === "zh-CN" \? "选择模型" : "Select model"/,
  );
  assert.match(source, /placeholderNode\.nodeValue = record\.placeholderText/);
  // 原生 _ModelPickerTriggerPlaceholder_ 由 React 持有：必须原地更新同一个文本
  // 节点（nodeValue，允许嵌套 span），绝不能 textContent 替换整个节点，否则 React
  // 卸载菜单时 removeChild 找不到旧文本节点会触发错误边界。
  assert.doesNotMatch(source, /placeholder\.textContent\s*=/);
  assert.match(source, /data-codex-model-slider-trigger-placeholder/);
  assert.match(source, /function restoreTriggerLabelWithoutNative\(trigger, selector\)/);
  // Measurement 属于原生占位文案，不能再被 MCX 模型名覆盖。
  assert.doesNotMatch(source, /measurementText\.nodeValue\s*=/);
  assert.doesNotMatch(source, /measurement\.textContent\s*=/);
  // 0.152.1 的 _ModelPickerTriggerModelLabel_ 是名称行容器而非名称本身，
  // 绝不能对它做隐藏或标签匹配，否则整行名称连 MCX 标签一起消失。
  assert.doesNotMatch(
    source,
    /\[class\*="_ModelPickerTriggerModelLabel_"\]:not\(\[data-codex-model-slider-trigger-label\]\) \{/,
  );
  // 复用原生显式模型布局，不再用自定义单行居中样式覆盖原生结构。
  assert.match(source, /viewControls\.setAttribute\("data-explicit-model", "true"\)/);
  assert.match(source, /data-codex-model-slider-reset/);
  assert.match(source, /data-codex-model-slider-controller-menu[\s\S]*?transform: translateX\(-50%\) !important;/);
  assert.doesNotMatch(
    source,
    /data-codex-model-slider-trigger\]\[data-state="closed"\] \[class\*="_ModelPickerTriggerContent_"\]/,
  );
  // 由原生 ViewPanel 和显式模型状态决定排版与留白。
  assert.match(source, /panel\.className = classes\.ViewPanel/);
  // 只解析原生语义类名；稳定 data 属性承载蓝色与 Ultra 紫色状态。
  assert.match(source, /"ViewToggleModelLabel",\s*"ViewToggleEffortLabel"/);
  assert.match(source, /buttonLabel\.setAttribute\("data-codex-model-slider-model-label", ""\)/);
  assert.match(source, /effortText\.setAttribute\("data-accent", "true"\)/);
  assert.match(source, /effortText\.setAttribute\("data-maximum", String\(selectedEffort === "ultra"\)\)/);
  assert.doesNotMatch(source, /_ViewToggleEffortLabel_[a-z0-9]+_/i);
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
  assert.equal(rendererTransportStatus(runtime).active, false);
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
    await waitFor(() => rendererTransportStatus(runtime).active === false, 500);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(spawnCount, 0);
    assert.equal(runtime.appPid, null);
    assert.equal(rendererTransportStatus(runtime).active, false);
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
    assert.equal(rendererTransportStatus(runtime).active, false);
    targetListHealthy = true;
  } finally {
    await runtime.stop();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("reconnects a closed renderer and publishes the first turn before token usage arrives", async () => {
  const threadId = "11111111-2222-4333-8444-555555555555";
  const updates = [];
  let connections = 0;
  const clients = [];
  const runtime = new CodexRuntime({
    features: [],
    profileDir: "/tmp/mcx-reconnect-test",
    fetchImpl: async () => cdpResponse([{
      id: "current", type: "page", url: "app://-/index.html", webSocketDebuggerUrl: "ws://fixture",
    }]),
    connectClient: async () => {
      connections++;
      const client = {
        socket: { readyState: 1, close() { this.readyState = 3; } },
        async send(method, params = {}) {
          if (method === "Page.addScriptToEvaluateOnNewDocument") return { identifier: "script" };
          if (params.expression === SESSION_STATUS_THREAD_ID_EXPRESSION) return { result: { value: [threadId] } };
          if (params.expression?.startsWith("window.__minecodexSessionStatus?.update(")) updates.push(params.expression);
          return { result: { value: true } };
        },
      };
      clients.push(client);
      return client;
    },
  });
  runtime.sessionStatusReader = { async read(id) { return { threadId: id, turns: 1, totalTokens: null }; } };
  try {
    await runtime.refresh();
    clients[0].socket.close();
    await runtime.refresh();
    assert.equal(connections, 2);
    assert.equal(runtime.clients.get("current"), clients[1]);
    assert.equal(updates.length, 2);
    assert.match(updates[1], /"turns":1,"totalTokens":null/);
    assert.equal(rendererTransportStatus(runtime).healthy, true);
  } finally {
    await runtime.stop();
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
  assert.equal(rendererTransportStatus(runtime).active, true);
  assert.equal(calls.includes("Page.reload"), false);
  assert.match(injectedSource, /__mineCodexCspBootstrapVersion/);
  assert.match(injectedSource, /"sessionId":"runtime-session-current"/);
  targets = [{ id: "target-current", type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://target" }];
  await runtime.refreshTargets();
  assert.deepEqual(rendererTransportStatus(runtime), {
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
  assert.deepEqual(rendererTransportStatus(runtime), {
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

  assert.equal(rendererTransportStatus(runtime).active, true);
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
  assert.deepEqual(rendererTransportStatus(runtime), {
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
  assert.deepEqual(rendererTransportStatus(runtime).targetFailures, []);
  assert.equal(rendererTransportStatus(runtime).healthy, true);
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
  assert.deepEqual(rendererTransportStatus(runtime), {
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
    assert.deepEqual(rendererTransportStatus(runtime), {
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
  assert.deepEqual(rendererTransportStatus(runtime), {
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
  assert.equal(contract.plugins.find((plugin) => plugin.featureId === "model-slider").state, "checking");
  assert.equal(contract.plugins.find((plugin) => plugin.featureId === "notes").state, "checking");
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


test("filters OpenCodex mock tiers to configured real efforts", async () => {
  const controller = {
    models: [{
      model: "command-code/Qwen-Qwen3.8-Flash",
      displayName: "commandcode-auth/Qwen-Qwen3.8-Flash",
      supportedReasoningEfforts: ["low", "medium", "xhigh", "max", "ultra"].map(
        (effort) => ({ reasoningEffort: effort }),
      ),
    }],
    reasoningEffort: "xhigh",
    onSelectReasoningEffort() {},
  };
  const feature = modelSliderFeatureFixture();
  feature.modelSelector.openCodexRealEfforts = {
    "command-code/qwen/qwen3.8-flash": ["low", "medium", "xhigh"],
  };
  feature.modelSelector.models = [{
    slug: "command-code/Qwen-Qwen3.8-Flash",
    displayName: "commandcode-auth/Qwen-Qwen3.8-Flash",
    opencodex_capability_provenance: {
      provider: "command-code",
      model_id: "Qwen/Qwen3.8-Flash",
    },
  }];
  const result = await executeModelSliderInjection({ controllerProps: controller, features: [feature] });
  assert.deepEqual(result.realEffortProbe("commandcode-auth/Qwen-Qwen3.8-Flash"), ["low", "medium", "xhigh"]);
});

test("Quick Prompts bridge permits only declared prompt routes on the registered service", async () => {
  const calls = [];
  const replies = [];
  const runtime = new CodexRuntime({
    features: [{ id: "notes", hostActions: ["quick-prompts"], pageScript: {},
      surfaceUrl: "http://127.0.0.1:47832/", healthUrl: "http://127.0.0.1:47832/api/health" }],
    profileDir: "/tmp/mcx-prompts-bridge",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method });
      return { ok: true, status: 200, json: async () => ({ prompts: [] }) };
    },
  });
  runtime.bindingTokens.set("renderer", "expected");
  runtime.resolveHostAction = async (_client, _id, response) => replies.push(response);
  const request = (route, method, token = "expected") => runtime.handleBindingCalled("renderer", {}, {
    name: HOST_BINDING_NAME, payload: JSON.stringify({
      featureId: "notes", action: "quick-prompts", requestId: "request", token, payload: { route, method },
    }),
  });
  await request("/api/state", "GET", "wrong");
  assert.equal(calls.length, 0);
  await request("/api/state", "GET");
  assert.deepEqual(calls, [{ url: "http://127.0.0.1:47832/api/state", method: "GET" }]);
  for (const route of ["/api/files", "/api/todos", "https://example.com/api/state", "/api/prompts/../files"]) {
    await request(route, "POST");
    assert.equal(replies.at(-1).ok, false);
  }
  assert.equal(calls.length, 1);
});

test("session status discovers main and side chat IDs without duplicates", () => {
  const main='12345678-1234-1234-1234-123456789abc',side='abcdef12-1234-1234-1234-123456789abc';
  const cards = [main, side, main, null].map(id => {
    const card={isConnected:true,checkVisibility:()=>true,
      closest: selector => selector === '[data-codex-composer-root]' ? card : null,
      getAttribute: () => "thread",querySelector: () => ({getAttribute:()=>id})};
    return card;
  });
  const ids = vm.runInNewContext(SESSION_STATUS_THREAD_ID_EXPRESSION, {
    document: { querySelectorAll: () => cards },
  });
  assert.deepEqual(Array.from(ids), [main, side]);
});

test("local image source requests require the enabled Images declaration and binding token", async () => {
  const runtime=new CodexRuntime({features:[{id:"images",hostActions:["local-image-source"]}],profileDir:"/tmp/mcx-local-image-test"});
  let reads=0;const responses=[];
  runtime.localImageSource={action:async payload=>{reads++;assert.equal(payload.id,"exact");return {text:"recorded",kind:"generation"};}};
  runtime.resolveHostAction=async (_client,_id,response)=>responses.push(response);
  runtime.bindingTokens.set("target","expected");
  const send=(token,featureId="images")=>runtime.handleBindingCalled("target",{}, {name:HOST_BINDING_NAME,payload:JSON.stringify({token,featureId,requestId:"request",action:"local-image-source",payload:{operation:"prompt",id:"exact"}})});
  await send("wrong");assert.equal(reads,0);
  await send("expected","disabled");assert.equal(reads,0);assert.equal(responses[0].error.code,"ACTION_NOT_ALLOWED");
  await send("expected");assert.equal(reads,1);assert.deepEqual(responses[1],{ok:true,result:{text:"recorded",kind:"generation"}});
});

test('model favorite writes require the enabled feature allowlist and binding token', async () => {
  const runtime = new CodexRuntime({features:[{id:'model-slider',hostActions:['model-favorites']}],profileDir:'/tmp/mcx-favorites-test'});
  let writes = 0;
  const responses = [];
  runtime.modelFavorites = { action: payload => { writes++; assert.deepEqual(payload.add,['provider/model']); return {favorites:['provider/model']}; } };
  runtime.resolveHostAction = async (_client,_id,response) => responses.push(response);
  runtime.bindingTokens.set('target','expected');
  const send = (token,featureId='model-slider') => runtime.handleBindingCalled('target',{}, {name:HOST_BINDING_NAME,payload:JSON.stringify({token,featureId,requestId:'request',action:'model-favorites',payload:{operation:'change',add:['provider/model']}})});
  await send('wrong'); assert.equal(writes,0);
  await send('expected','notes'); assert.equal(writes,0);
  await send('expected'); assert.equal(writes,1); assert.equal(responses.at(-1).ok,true);
});
