import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CodexRuntime,
  RESPONSIVE_SUMMARY_LAYOUT,
  createInjectionSource,
  responsiveSummaryContentShift,
  responsiveSummaryDisplayMode,
  responsiveSummaryVisibleSurface,
} from "../src/codex-runtime.mjs";

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
  assert.equal(responsiveSummaryContentShift({ displayMode: "gutter", isPinned: true }), 0);
});

test("releases thread content to native Summary when a personal panel needs no shift", () => {
  const source = createInjectionSource([]);

  assert.match(
    source,
    /function applyThreadContentShift\(value\) \{[\s\S]*?if \(value === 0\) \{[\s\S]*?restoreThreadContentShift\(\)[\s\S]*?return;?[\s\S]*?\}/s,
  );
});

test("keeps personal Summary shifts separate from Codex's native transform", () => {
  const source = createInjectionSource([]);

  assert.doesNotMatch(
    source,
    /content\.style\.setProperty\("(?:transform|--thread-wide-block-inline-shift)"/,
  );
  assert.doesNotMatch(
    source,
    /element\.style\.setProperty\("(?:transform|--thread-wide-block-inline-shift)"/,
  );
  assert.match(
    source,
    /threadShiftStyle\.textContent = "\[data-codex-personal-summary-shift\] \{ transform: none !important; --thread-wide-block-inline-shift: 0px !important; \}"/,
  );
  assert.match(source, /threadShiftStyle\.remove\(\)/);
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
  assert.match(source, /return aliases\.length === 1 \? aliases\[0\] : null/);
  assert.match(source, /function nativeModelDescriptorForItem\(item, observedRaw\)/);
  assert.match(source, /const raw = nativeDescriptor\?\.slug \?\? catalogModel\?\.slug \?\? observedRaw/);
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
  assert.match(source, /_ViewControls_1ryrb_12/);
  assert.match(source, /_ViewToggleContent_1ryrb_334/);
  assert.match(source, /_ViewToggleIcon_1ryrb_85/);
  assert.match(source, /_SimpleView_1ryrb_50/);
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
  assert.match(source, /function normalizedLocale\(value\)/);
  assert.match(source, /function localizedText\(fallback, locales = \{\}\)/);
  assert.match(source, /label: localizedText\(feature\.label, feature\.labels\)/);
  assert.match(source, /label: localizedText\(detail\.label, detail\.labels\)/);
  assert.match(source, /\{ type: "codex-personal:theme", theme: mode, mode, locale, tokens: surfaceTokens \}/);
  assert.match(source, /data-codex-personal-pinned-summary/);
  assert.match(source, /data-codex-personal-summary-presentation/);
  assert.match(source, /data-codex-personal-tab-host/);
  assert.match(source, /Toggle summary/);
  assert.match(source, /Toggle pinned summary/);
  assert.match(source, /function nativeBottomPanelButton\(\)/);
  assert.match(source, /button\.getAttribute\("aria-label"\) !== "Toggle bottom panel"/);
  assert.match(source, /function nativeSummaryToolbarGroup\(nativeButton\)/);
  assert.match(source, /function ensureFallbackSummaryToolbarGroup\(nativeButton\)/);
  assert.match(source, /data-codex-personal-summary-toolbar-group/);
  assert.match(source, /group\.className = "ms-auto flex shrink-0 items-center gap-1\.5"/);
  assert.match(source, /function ensureToolbarEntries\(\)[\s\S]*?const summaryButton = nativeSummaryButton\(\)/s);
  assert.match(source, /const targetGroup = summaryGroup \?\? fallbackGroup/);
  assert.match(source, /if \(cursor\.nextElementSibling !== entryRoot\) cursor\.after\(entryRoot\)/);
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
  assert.match(source, /host\.setAttribute\("aria-label", locale === "zh-CN" \? "CodexNotes 工作区标签页" : "CodexNotes workspace tabs"\)/);
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

test("prefers Codex native Task tabs and keeps the custom tab host as fallback", () => {
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
  assert.match(source, /const controller = appModule\.Gtt\("right"\)/);
  assert.match(source, /const jsx = appModule\.hkt\(\)/);
  assert.match(source, /const React = appModule\.Skt\(\)/);
  assert.match(source, /value\.value\?\.routeKind === "local-thread"/);
  assert.match(source, /function nativeDetailComponent\(feature, detail, capability\)/);
  assert.match(source, /function nativeDetailIcon\(feature, detail, jsx\)/);
  assert.match(source, /const icon = detail\.icon \?\? feature\.icon/);
  assert.match(source, /icon: nativeDetailIcon\(feature, detail, jsx\)/);
  assert.match(source, /createMarkupIcon\(detail\.icon \?\? feature\.icon, "icon-xs", 16\)/);
  assert.match(source, /React\.useLayoutEffect\(\(\) => \{/);
  assert.match(source, /registerSurface\(recordKey, feature, "detail", detail\.surfaceUrl, element, frame, detail\.id\)/);
  assert.match(source, /controller\.openTab\(scope, nativeDetailComponent\(feature, detail, capability\)/);
  assert.match(source, /id: tabId,[\s\S]*?isClosable: true,[\s\S]*?onClose:/s);
  assert.match(source, /presentation: "native"/);
  assert.match(source, /function openFallbackDetailTab\(feature, detail\)/);
  assert.match(source, /presentation: "fallback"/);
  assert.match(
    source,
    /return await openNativeDetailTab\(feature, detail\)[\s\S]*?\?\? openFallbackDetailTab\(feature, detail\)/s,
  );
  assert.match(source, /result: await openDetailTab\(feature\.id, payload\.surface\)/);
  assert.match(source, /detailTabCapability/);
  assert.match(source, /closeNativeDetailTabs\(\)/);
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
