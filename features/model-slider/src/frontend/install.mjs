// 专有原生控制器适配与呈现由插件维护；宿主只提供刷新和共用 UI。
export function installModelSlider(signal, { feature, ui, createIcon, requestRefresh, locale, codex, requestAction }, rules, createModelControllerAdapter) {
  const modelSelectorFeature = feature;
  const featureUI = ui, createMarkupIcon = createIcon, queueEnsure = requestRefresh;
  const { favoriteModelId, modelIdentity, formatIdentifier, providerLabel, compactModelLabel, brandForModel, comparableModelLabel, catalogModelFor, resolveModelAlias, modelWithOpenCodexEfforts, nativeGptSortRank, visibleControllerModels } = rules;
  const modelSelectorOriginalToggleLabels = new Map();
  const modelSelectorGenericContainers = new Map();
  const modelSelectorNativeToggleHandlers = new Map();
  const modelSelectorPositionObservers = new Map();
  const modelSelectorMenuSizeFrames = new Map();
  let modelSelectorReturnTimer = null;
  let modelSelectorPendingReturn = false;
  let modelSelectorEffortTransactionTimer = null;
  let modelSelectorPendingOutsideDismiss = false;
  let modelSelectorSuppressOutsidePointerSequence = false;
  const modelSelectorTriggerObservers = new Map();
  let modelSelectorControllerMenu = null;
  let modelSelectorNativeFastIcons = null;
  // 持久化脏标记：仅在图标实际变化时写一次 localStorage。
  let modelSelectorNativeFastIconsDirty = false;
  const modelSelectorFastIconStorageKey = "codex-model-slider:fast-icons:v1";
  const modelSelectorStyle = document.createElement("style");
  modelSelectorStyle.setAttribute("data-codex-model-slider-style", "");
  modelSelectorStyle.textContent = `
    [data-codex-model-slider-menu] { width: 264px !important; min-width: 264px; overflow-x: hidden; }
    [data-codex-model-slider-controller-menu] {
      position: absolute !important;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%) !important;
      z-index: 10;
      padding: 6px;
    }
    [data-codex-model-slider-menu][data-codex-model-slider-overflow] {
      max-height: var(--codex-model-slider-menu-max-height) !important;
      overflow-y: auto;
    }
    [data-codex-model-slider-trigger] [class*="_ModelPickerTriggerModelLabel_"] {
      min-width: 0; max-width: 110px; flex-shrink: 1; overflow: hidden; text-overflow: ellipsis;
    }
    [data-codex-model-slider-trigger] [class*="_ModelPickerTriggerModelText_"] {
      min-width: 0; max-width: 110px; overflow: hidden; text-overflow: ellipsis;
    }
    html[data-codex-model-slider-catalog-ready]
    [data-codex-model-slider-trigger]
    [class*="_ModelPickerTriggerModelText_"]:not([data-codex-model-slider-trigger-label]):has(+ [data-codex-model-slider-trigger-label]) {
      display: none !important;
    }
    [data-codex-model-slider-trigger-label] {
      display: inline-block; min-width: 0; max-width: 110px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* 展示真实模型名/思考强度时：芯片 HUG 内容，长名称不被截断；
       仅 "Select model / Select effort" 占位态沿用原生宽度。 */
    [data-codex-model-slider-trigger]:not([data-codex-model-slider-trigger-placeholder]) [data-codex-model-slider-trigger-label] {
      max-width: none; overflow: visible; text-overflow: clip; flex-shrink: 0;
    }
    [data-codex-model-slider-trigger]:not([data-codex-model-slider-trigger-placeholder]) [class*="_ModelPickerTriggerModelLabel_"] {
      max-width: none; overflow: visible; flex-shrink: 0;
    }
    [data-codex-model-slider-trigger]:not([data-codex-model-slider-trigger-placeholder]) [class*="_ModelPickerTriggerContent_"] {
      max-width: none !important;
    }
    [data-codex-model-slider-trigger][data-codex-model-slider-trigger-placeholder] [class*="_ModelPickerTriggerContent_"] {
      width: 160px; min-width: 160px !important; max-width: 160px;
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
    [data-codex-model-slider-name] { overflow: hidden; color: var(--mcx-color-text-foreground); text-overflow: ellipsis; white-space: nowrap; }
    [data-codex-model-slider-provider] { overflow: hidden; color: var(--mcx-color-text-foreground-tertiary); font-size: 11px; line-height: 14px; text-overflow: ellipsis; white-space: nowrap; }
    [data-codex-model-slider-item] { position: relative; }
    [data-codex-model-slider-item][data-codex-model-slider-selected] { background: var(--mcx-color-token-list-hover-background); }
    [data-codex-model-slider-star] {
      display: grid; width: 24px; height: 24px; flex: 0 0 24px; place-items: center;
      border: 0; border-radius: var(--mcx-radius-md, 6px); padding: 0; background: transparent;
      color: var(--mcx-color-text-foreground-tertiary); cursor: pointer; opacity: 0; pointer-events: none;
    }
    [data-codex-model-slider-item]:hover [data-codex-model-slider-star],
    [data-codex-model-slider-item]:focus-within [data-codex-model-slider-star] { opacity: 1; pointer-events: auto; }
    [data-codex-model-slider-star]:hover, [data-codex-model-slider-star]:focus-visible {
      background: var(--mcx-color-token-list-hover-background); color: var(--mcx-color-text-foreground); outline: none;
    }
    [data-codex-model-slider-star]::after {
      content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 40px; z-index: 1;
    }
    [data-codex-model-slider-star] svg { position: relative; z-index: 2; width: 16px; height: 16px; pointer-events: none; }
    [data-codex-model-slider-divider] {
      height: 0; border-top: 1px solid var(--mcx-color-token-border, var(--mcx-color-border));
      margin: 6px 8px;
    }
    [data-codex-model-slider-generic-menu] {
      overflow-x: hidden;
      transform: translateX(var(--codex-model-slider-menu-center-shift, 0px)) !important;
    }
    [data-codex-model-slider-generic] { box-sizing: border-box; width: 100%; }
    [data-codex-model-slider-fast] { border: 0; background: transparent; cursor: pointer; }
    [data-codex-model-slider-fast]:not(:hover) [data-codex-model-slider-fast-content] { background: transparent; }
    [data-codex-model-slider-fast]:focus-visible { outline: 2px solid var(--mcx-color-border-focus); outline-offset: 1px; }
    [data-codex-model-slider-rail][data-codex-model-slider-fallback] { position: relative; height: 38px; margin: 1px 8px 0; outline: none; cursor: pointer; }
    [data-codex-model-slider-track] { position: absolute; top: 12px; right: 0; left: 0; height: 16px; border-radius: 999px; background: var(--mcx-color-background-control); }
    [data-codex-model-slider-range] { position: absolute; top: 0; bottom: 0; left: 0; width: var(--codex-model-slider-progress); border-radius: inherit; background: var(--mcx-color-text-accent); }
    [data-codex-model-slider-rail][data-max="true"] [data-codex-model-slider-range] { background: var(--mcx-color-chart-purple); }
    [data-codex-model-slider-fallback] [data-codex-model-slider-tick] {
      position: absolute; top: 16px; width: 6px; height: 6px; transform: translate(-50%, -50%); border: 0; border-radius: 50%;
      padding: 0; background: var(--mcx-color-text-foreground-tertiary); pointer-events: none;
    }
    [data-codex-model-slider-fallback] [data-codex-model-slider-tick][data-selected="true"] { background: var(--mcx-color-text-on-accent); }
    [data-codex-model-slider-thumb] {
      position: absolute; top: 7px; left: var(--codex-model-slider-progress); width: 26px; height: 26px;
      transform: translateX(-50%); border: 0.5px solid var(--mcx-color-token-border, var(--mcx-color-border)); border-radius: 50%;
      background: var(--mcx-color-background-elevated-primary-opaque, var(--mcx-color-background-panel)); box-shadow: var(--mcx-shadow-md);
      pointer-events: none;
    }
    [data-codex-model-slider-fallback]:focus-visible [data-codex-model-slider-thumb] { box-shadow: 0 0 0 2px var(--mcx-color-border-focus); }
    @media (prefers-reduced-motion: reduce) {
      [data-codex-model-slider-star] { transition: none; }
    }
  `;

  const nativeModel=createModelControllerAdapter(codex,comparableModelLabel);
  const nativeComposerTrigger=nativeModel.trigger, nativeComposerModelController=nativeModel.read, nativeModelDescriptorForItem=nativeModel.descriptor, setReactControlledMenuOpen=nativeModel.setOpen, invokeNativeMenuItemSelect=nativeModel.selectItem;

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

  function persistNativeFastIcons() {
    if (!modelSelectorNativeFastIcons || !modelSelectorNativeFastIconsDirty) return;
    try {
      const payload = {};
      for (const [state, template] of Object.entries(modelSelectorNativeFastIcons)) {
        payload[state] = template.outerHTML;
      }
      localStorage.setItem(modelSelectorFastIconStorageKey, JSON.stringify(payload));
      modelSelectorNativeFastIconsDirty = false;
    } catch {
      // localStorage 不可用时静默降级，仅本次会话内生效。
    }
  }

  function loadPersistedNativeFastIcons(storageKey) {
    let stored;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      return null;
    }
    let payload;
    try {
      payload = JSON.parse(stored ?? "null");
    } catch {
      return null;
    }
    if (!payload || typeof payload !== "object") return null;
    const icons = {};
    for (const [state, markup] of Object.entries(payload)) {
      if (typeof markup !== "string") continue;
      const container = document.createElement("template");
      container.innerHTML = markup;
      const svg = container.content.querySelector("svg");
      if (svg) icons[state] = svg;
    }
    return Object.keys(icons).length ? icons : null;
  }

  async function loadNativeFastIconFromBundle() {
    // 两个图标均已就绪（持久化或 DOM 克隆）时不再拉取整包 app-initial 资源。
    if (modelSelectorNativeFastIcons?.active && modelSelectorNativeFastIcons?.inactive) return;
    try {
      const definitions=await nativeModel.fastIcons(signal);
      if (!definitions) return;
      if (!modelSelectorNativeFastIcons) {
        modelSelectorNativeFastIcons = {};
      }
      let gained = false;
      const define = (state) => {
        const definition=definitions[state];
        if (modelSelectorNativeFastIcons[state]) return;
        const path = definition?.path;
        if (!path) return;
        const svg = createModelSelectorIcon({
          viewBox: definition.viewBox,
          markup: definition.transform
            ? `<g transform="${definition.transform}"><path d="${path}" fill="currentColor" /></g>`
            : `<path d="${path}" fill="currentColor" />`,
        }, { brand: true });
        if (!svg) return;
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        modelSelectorNativeFastIcons[state] = svg;
        gained = true;
      };
      define("active");
      define("inactive");
      if (gained) {
        modelSelectorNativeFastIconsDirty = true;
        persistNativeFastIcons();
        applyNativeFastIconsToShells();
        queueEnsure();
      }
    } catch {
      // 私有资源移动时保持原生控件不变，等待 DOM 克隆兜底。
    }
  }

  function captureNativeFastIcon() {
    // 原生控件每次只渲染当前状态；状态切换后按控件本身更新缓存。
    const nativeContent = Array.from(document.querySelectorAll('[class*="_FastModeToggleContent_"]'))
      .find((content) => !content.closest("[data-codex-model-slider-generic]"));
    const toggle = nativeContent?.closest('[class*="_FastModeToggle_"]');
    const state = toggle?.getAttribute("data-fast-mode-enabled") === "true" ? "active" : "inactive";
    const svg = nativeContent?.querySelector("svg");
    const current = modelSelectorNativeFastIcons?.[state];
    if (svg && (current?.innerHTML !== svg.innerHTML
      || current.getAttribute("viewBox") !== svg.getAttribute("viewBox")
      || current.getAttribute("width") !== svg.getAttribute("width"))) {
      const template = svg.cloneNode(true);
      template.removeAttribute("id");
      if (!modelSelectorNativeFastIcons) {
        modelSelectorNativeFastIcons = {};
      }
      modelSelectorNativeFastIcons[state] = template;
      modelSelectorNativeFastIconsDirty = true;
    }
    const ready = Boolean(
      modelSelectorNativeFastIcons?.active && modelSelectorNativeFastIcons?.inactive,
    );
    if (ready) {
      persistNativeFastIcons();
      applyNativeFastIconsToShells();
    }
  }

  function applyNativeFastIconsToShells() {
    document.querySelectorAll("[data-codex-model-slider-fast]").forEach((button) => {
      const content = button.querySelector("[data-codex-model-slider-fast-content]");
      if (!content) return;
      const icon = createNativeFastIcon(button.getAttribute("aria-pressed") === "true");
      if (!icon) return;
      const current = content.querySelector("svg");
      if (!current || current.innerHTML !== icon.innerHTML
        || current.getAttribute("viewBox") !== icon.getAttribute("viewBox")
        || current.getAttribute("width") !== icon.getAttribute("width")) {
        content.replaceChildren(icon);
      }
    });
  }

  function createNativeFastIcon(active) {
    // 直接读取已就绪的图标存储（启动时由 bundle/持久化填充，运行期由
    // captureNativeFastIcon 升级为 DOM 克隆），避免再次触发捕获造成递归。
    // 优先克隆当前面板的图标；切换瞬间使用缓存时，也沿用原生图标尺寸。
    const nativeContents = Array.from(document.querySelectorAll('[class*="_FastModeToggleContent_"]'))
      .filter((content) => !content.closest("[data-codex-model-slider-generic]"));
    const nativeContent = nativeContents.find((content) => (
      (content.getAttribute("data-fast-mode-enabled")
        ?? content.closest('[class*="_FastModeToggle_"]')?.getAttribute("data-fast-mode-enabled")) === String(active)
    ));
    const nativeSvg = nativeContent?.querySelector("svg") ?? nativeContents[0]?.querySelector("svg");
    const template = nativeContent?.querySelector("svg")
      ?? modelSelectorNativeFastIcons?.[active ? "active" : "inactive"];
    if (!template) return null;
    const icon = template.cloneNode(true);
    if (nativeSvg) {
      icon.setAttribute("width", nativeSvg.getAttribute("width") ?? "16");
      icon.setAttribute("height", nativeSvg.getAttribute("height") ?? "16");
    }
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  // ========================================================================
  // 模型 identity、目录与菜单增强 — 模型身份解析、品牌/别名、收藏与原生菜单增强
  // ========================================================================

  function modelDisplayLabel(identity, selector) {
    const model = catalogModelFor(identity, selector) ?? nativeCatalogModelFor(identity);
    const source = model?.displayName || model?.slug || identity.backend;
    return formatIdentifier(source.slice(source.lastIndexOf("/") + 1));
  }

  function nativeCatalogModelFor(identity, selector = modelSelectorFeature?.modelSelector) {
    const controller = nativeComposerModelController();
    const models = controller?.models ?? [];
    const exact = models.find((model) => String(model.model ?? "").toLowerCase() === identity.raw.toLowerCase());
    const target = comparableModelLabel(identity.backend);
    const aliases = exact ? [] : models.filter((model) => (
      comparableModelLabel(model.model) === target || comparableModelLabel(model.displayName) === target
    ));
    const model = exact ?? (aliases.length === 1 ? aliases[0] : null);
    if (!model) return null;
    const nativeReasoningLevels = (model.supportedReasoningEfforts ?? []).map((level) => ({
      effort: String(level?.reasoningEffort ?? level?.effort ?? level ?? "").toLowerCase(),
    })).filter((level) => level.effort);
    const supportedReasoningLevels = nativeReasoningLevels;
    const currentReasoningLevel = String(controller?.reasoningEffort ?? "").toLowerCase();
    return {
      slug: String(model.model ?? ""),
      displayName: String(model.displayName ?? model.model ?? ""),
      currentReasoningLevel: nativeReasoningLevels.some(
        (level) => level.effort === currentReasoningLevel,
      ) ? currentReasoningLevel : null,
      currentReasoningLevelVisible: supportedReasoningLevels.some(
        (level) => level.effort === currentReasoningLevel,
      ),
      defaultReasoningLevel: String(model.defaultReasoningEffort ?? "").toLowerCase(),
      supportedReasoningLevels,
    };
  }

  function modelDefinitionFor(identity, selector) {
    return nativeCatalogModelFor(identity) ?? catalogModelFor(identity, selector);
  }

  // 用 OpenCodex 配置声明的真实档位对滑条做精确交集，过滤 catalog 为支持
  // mock 顶档而额外广告的 max/ultra。键匹配顺序：模型自带的
  // opencodex_capability_provenance → catalog 模型 → 菜单原始 identity；
  // 只做过滤不扩展，配置未声明的模型保持 catalog 原样。

  function loadModelFavorites(selector) {
    try {
      const value = JSON.parse(localStorage.getItem(selector.favoriteStorageKey) ?? "[]");
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch {
      return new Set();
    }
  }

  let favoritesWrite = Promise.resolve();
  let favoritesEpoch = 0;
  function saveModelFavorites(selector, favorites) {
    const previous = loadModelFavorites(selector);
    favoritesEpoch++;
    if (requestAction) {
      const add = [...favorites].filter(id => !previous.has(id));
      const remove = [...previous].filter(id => !favorites.has(id));
      favoritesWrite = favoritesWrite.catch(() => {}).then(() => requestAction({ operation: 'change', add, remove }));
      void favoritesWrite.catch(error => console.warn('Model favorites could not be saved for transfer', error));
    }
    try {
      localStorage.setItem(selector.favoriteStorageKey, JSON.stringify(Array.from(favorites)));
    } catch {
      // A disabled localStorage must not break the native picker.
    }
  }

  function nativeModelPickerMenu() {
    return Array.from(document.querySelectorAll('[role="menu"][data-state="open"]')).find(
      (menu) => (
        menu.querySelector("[data-reasoning-slider]")
        && (menu.querySelector("[data-model-picker-view-toggle]") || nativeModelPickerRow(menu))
      ),
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
    const toggle = menu?.querySelector("[data-model-picker-view-toggle]");
    const toggleModelLabel = toggle?.querySelector('[class*="_ViewToggleModelLabel_"]');
    const toggleValues = String(
      toggle?.hasAttribute("data-model-picker-view-toggle")
        ? (toggleModelLabel?.textContent ?? toggle.innerText)
        : "",
    ).split("\n").map((value) => value.trim()).filter(Boolean);
    if (toggleValues.length) return toggleValues[0];
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

  function closeReactControlledMenu(element) {
    return setReactControlledMenuOpen(element, false);
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
      signal: signal,
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
    const trigger = nativeComposerTrigger();
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
    if (!menu.hasAttribute("data-codex-model-slider-controller-menu")) {
      if (!modelSelectorMenuSizeFrames.has(menu)) {
        const frame = requestAnimationFrame(() => {
          modelSelectorMenuSizeFrames.delete(menu);
          sizeModelMenuViewport(menu, selector.maxVisibleItems);
        });
        modelSelectorMenuSizeFrames.set(menu, frame);
      }
      return;
    }
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
    if (modelSelectorControllerMenu?.menu === menu && modelSelectorControllerMenu.animations?.length) return;
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
      button.setAttribute("data-minecodex-tooltip", selector.strings[starred ? "unstar" : "star"].replace("{model}", itemLabel));
    }
    renderEnhancedModelMenu(menu, selector);
  }

  function enhanceModelItem(item, menu, selector, index, {
    rawValue = null,
    selected = null,
    scheduleReturn = true,
    owned = false,
  } = {}) {
    const observedRaw = rawValue ?? modelItemRawValue(item);
    if (!observedRaw) return;
    const observedIdentity = modelIdentity(observedRaw);
    const nativeDescriptor = nativeModelDescriptorForItem(item, observedRaw);
    const catalogModel = catalogModelFor(observedIdentity, selector);
    const raw = favoriteModelId(observedRaw, { authoritative: rawValue !== null, nativeSlug: nativeDescriptor?.slug, catalogSlug: catalogModel?.slug });
    // 先刷新 dataset：React 原地复用菜单节点时，raw/排序/收藏键不能基于过期值。
    item.dataset.codexModelSliderRaw = raw;
    item.dataset.codexModelSliderItem = "";
    item.dataset.codexModelSliderOrder = String(index);
    item.dataset.codexModelSliderIdentitySource = catalogModel ? "catalog" : nativeDescriptor ? "native" : "visible";
    if (item.querySelector("[data-codex-model-slider-row]")) return;
    item.toggleAttribute(
      "data-codex-model-slider-selected",
      selected ?? Boolean(item.querySelector("svg")),
    );
    if (!owned) {
      if (scheduleReturn && !item.hasAttribute("data-codex-model-slider-return-listener")) {
        item.setAttribute("data-codex-model-slider-return-listener", "");
        item.addEventListener("click", scheduleModelSliderReturn);
      }
      return;
    }
    const identity = modelIdentity(raw);
    const display = modelDisplayLabel(identity, selector);
    const provider = providerLabel(identity.provider, selector);
    const brand = brandForModel(identity, selector);
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
    star.setAttribute("data-minecodex-tooltip", selector.strings[starred ? "unstar" : "star"].replace("{model}", display));
    star.append(createModelSelectorIcon(starred ? selector.icons.unstar : selector.icons.star));
    row.append(star);
    item.replaceChildren(row);
    if (scheduleReturn && !item.hasAttribute("data-codex-model-slider-return-listener")) {
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
      if (existing.menu !== menu) {
        existing.resizeObserver.unobserve(existing.menu);
        existing.resizeObserver.observe(menu);
        existing.menu = menu;
      }
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

  function pruneNativeModelToggleHandlers() {
    for (const [toggle, handlers] of modelSelectorNativeToggleHandlers) {
      if (toggle.isConnected) continue;
      toggle.removeEventListener("click", handlers.openModels);
      toggle.removeEventListener("keydown", handlers.onKeyDown);
      modelSelectorNativeToggleHandlers.delete(toggle);
    }
  }

  function restoreGenericModelPicker(container) {
    const original = modelSelectorGenericContainers.get(container);
    if (!original) return;
    original.effectMirror?.disconnect();
    if (container.isConnected) {
      const menu = container.parentElement;
      menu?.querySelector(":scope > [data-codex-model-slider-generic]")?.remove();
      menu?.removeAttribute("data-codex-model-slider-generic-menu");
      menu?.style.removeProperty("--codex-model-slider-menu-center-shift");
      container.style.position = original.position;
      container.style.inset = original.inset;
      container.style.opacity = original.opacity;
      container.style.pointerEvents = original.pointerEvents;
      if (original.ariaHidden == null) container.removeAttribute("aria-hidden");
      else container.setAttribute("aria-hidden", original.ariaHidden);
      container.inert = original.inert;
    }
    modelSelectorGenericContainers.delete(container);
  }

  function pruneGenericModelPickerContainers() {
    for (const container of modelSelectorGenericContainers.keys()) {
      if (!container.isConnected) restoreGenericModelPicker(container);
    }
  }

  function animateControllerModelMenu(record, opening, onFinish) {
    const height = record.menu.getBoundingClientRect().height;
    clearTimeout(record.motionTimer);
    record.animations?.forEach((animation) => animation.cancel());
    record.animations = [];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onFinish();
      return;
    }
    // 原生视图切换：底边保持锚定，高度 320ms，内容 200ms 淡变并位移 10px。
    record.menu.style.overflowY = "hidden";
    const size = record.menu.animate([
      { height: `${opening ? record.sliderHeight : height}px` },
      { height: `${opening ? record.listHeight : record.sliderHeight}px` },
    ], { duration: 320, easing: "cubic-bezier(.19,1,.22,1)", fill: "both" });
    const content = record.content.animate(opening
      ? [{ opacity: 0, translate: "0 10px" }, { opacity: 1, translate: "0 0" }]
      : [{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "0 10px" }],
    { duration: 200, delay: opening ? 40 : 0, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" });
    record.animations.push(size, content);
    if (!opening) {
      record.animations.push(record.menu.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 200, delay: 40, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" }));
    }
    // 后台窗口未必派发动画完成事件，清理按同一时长结束，避免残留菜单。
    record.motionTimer = setTimeout(onFinish, 320);
  }

  function closeControllerModelMenu({ immediate = false } = {}) {
    const record = modelSelectorControllerMenu;
    if (!record) return false;
    if (record.closing && !immediate) return true;
    const placeholder = document.querySelector(
      '[data-codex-intelligence-trigger] [class*="_ModelPickerTriggerPlaceholder_"]',
    );
    if (placeholder?.firstChild && record.placeholderText != null) {
      placeholder.firstChild.nodeValue = record.placeholderText;
    }
    record.button.setAttribute("aria-expanded", "false");
    record.closing = true;
    record.menu.inert = true;
    const finish = () => {
      clearTimeout(record.motionTimer);
      record.animations?.forEach((animation) => animation.cancel());
      record.parentMenu.style.position = record.position;
      record.parentMenu.style.overflow = record.overflow;
      record.menu.remove();
      if (modelSelectorControllerMenu === record) modelSelectorControllerMenu = null;
    };
    if (immediate || !record.parentMenu.isConnected) finish();
    else animateControllerModelMenu(record, false, finish);
    return true;
  }

  function controllerModelReasoningEffort(controller, model) {
    const current = String(controller?.reasoningEffort ?? "").toLowerCase();
    const supported = (model?.supportedReasoningEfforts ?? []).map((entry) => (
      String(entry?.reasoningEffort ?? entry ?? "").toLowerCase()
    )).filter(Boolean);
    return supported.includes(current)
      ? current
      : String(model?.defaultReasoningEffort ?? supported[0] ?? "none").toLowerCase();
  }

  function openControllerModelMenu(parentMenu, modelButton, selector) {
    if (modelSelectorControllerMenu) {
      if (!modelSelectorControllerMenu.closing) {
        closeControllerModelMenu();
        return;
      }
      closeControllerModelMenu({ immediate: true });
    }
    const controller = nativeComposerModelController();
    if (!Array.isArray(controller?.models) || typeof controller.onSelectModel !== "function") return;
    const models = visibleControllerModels(controller);
    if (!models.length) return;

    const menu = document.createElement("div");
    menu.className = parentMenu.className;
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-state", "open");
    menu.setAttribute("data-codex-model-slider-menu", "");
    menu.setAttribute("data-codex-model-slider-controller-menu", "");
    featureUI.surface(menu, "dropdown", { variant: "opaque" });
    // 切换同一个 picker 视图，不重复播放整个 Dropdown 的入场缩放。
    menu.style.animation = "none";
    const content = document.createElement("div");
    content.style.flexShrink = "0";
    menu.append(content);
    models.forEach((model, index) => {
      const item = document.createElement("div");
      item.className = "no-drag outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm text-default group hover:bg-primary-ghost-hover focus:bg-primary-ghost-hover cursor-interaction flex flex-col";
      item.setAttribute("role", "menuitem");
      item.setAttribute("tabindex", "-1");
      enhanceModelItem(item, menu, selector, index, {
        rawValue: String(model.model),
        selected: String(model.model) === String(controller.model),
        scheduleReturn: false,
        owned: true,
      });
      content.append(item);
    });
    menu.addEventListener("click", (event) => {
      const star = event.target.closest?.("[data-codex-model-slider-star]");
      const item = event.target.closest?.("[data-codex-model-slider-item]");
      if (!item) return;
      if (star) {
        const raw = item.dataset.codexModelSliderRaw;
        const label = item.querySelector("[data-codex-model-slider-name]")?.textContent ?? raw;
        toggleModelFavorite(event, menu, selector, raw, label);
        return;
      }
      const currentController = nativeComposerModelController();
      const raw = item.dataset.codexModelSliderRaw;
      const model = currentController?.models?.find((candidate) => String(candidate.model) === raw);
      if (!model || typeof currentController.onSelectModel !== "function") return;
      const reasoningEffort = controllerModelReasoningEffort(currentController, model);
      currentController.onSelectModel(raw, reasoningEffort);
      closeControllerModelMenu();
      queueEnsure();
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeControllerModelMenu();
        modelButton.focus();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      const item = event.target.closest?.("[data-codex-model-slider-item]");
      if (!item) return;
      event.preventDefault();
      item.click();
    });
    renderEnhancedModelMenu(menu, selector);

    const placeholder = document.querySelector(
      '[data-codex-intelligence-trigger] [class*="_ModelPickerTriggerPlaceholder_"]',
    );
    const placeholderText = placeholder?.firstChild?.nodeValue ?? null;
    // 保留产品行为：模型列表打开时 chip 显示 Select model。只能原地更新
    // 同一个文本节点（nodeValue），不能 textContent 替换整个节点，否则
    // React 卸载菜单时 removeChild 找不到旧文本节点会触发错误边界。
    if (placeholder?.firstChild) {
      placeholder.firstChild.nodeValue = locale === "zh-CN" ? "选择模型" : "Select model";
    }

    modelSelectorControllerMenu = {
      menu,
      content,
      parentMenu,
      button: modelButton,
      placeholderText,
      position: parentMenu.style.position,
      overflow: parentMenu.style.overflow,
      sliderHeight: parentMenu.getBoundingClientRect().height,
    };
    parentMenu.style.position = "relative";
    parentMenu.style.overflow = "visible";
    parentMenu.append(menu);
    sizeModelMenuViewport(menu, selector.maxVisibleItems);
    modelButton.setAttribute("aria-expanded", "true");
    (menu.querySelector('[data-codex-model-slider-selected]')
      ?? menu.querySelector('[role="menuitem"]'))?.focus();
    const record = modelSelectorControllerMenu;
    record.listHeight = menu.getBoundingClientRect().height;
    animateControllerModelMenu(record, true, () => {
      if (modelSelectorControllerMenu !== record || record.closing) return;
      record.animations.forEach((animation) => animation.cancel());
      record.animations = [];
      menu.style.overflowY = "auto";
      sizeModelMenuViewport(menu, selector.maxVisibleItems);
    });
  }

  // ========================================================================
  // 原生 effort 子菜单与滑条视觉 — effort 事务、Fast/通用滑条视觉与状态同步
  // ========================================================================

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
    const identity = modelIdentity(nativeModelValue(parentMenu));
    const model = modelDefinitionFor(identity, modelSelectorFeature?.modelSelector);
    if (!model?.supportedReasoningLevels?.some((level) => level.effort === String(effort).toLowerCase())) return;
    const controller = nativeComposerModelController();
    if (typeof controller?.onSelectReasoningEffort === "function") {
      controller.onSelectReasoningEffort(effort);
      if (modelSelectorPendingOutsideDismiss) {
        closeReactControlledMenu(nativeComposerTrigger());
        modelSelectorPendingOutsideDismiss = false;
      }
      queueEnsure();
      return;
    }
    if (typeof controller?.onCommitPower === "function") {
      const normalizedEffort = String(effort).toLowerCase();
      const activeModel = String(controller.model ?? nativeCatalogModelFor(identity)?.slug ?? identity.raw);
      const next = controller.powerSelections?.find((selection) => (
        String(selection?.model ?? "") === activeModel
        && String(selection?.reasoningEffort ?? "").toLowerCase() === normalizedEffort
      ));
      const previous = controller.selectedPowerSelection
        ?? controller.powerSelections?.find((selection) => (
          String(selection?.model ?? "") === activeModel
          && String(selection?.reasoningEffort ?? "").toLowerCase()
            === String(controller.reasoningEffort ?? "").toLowerCase()
        ))
        ?? controller.fallbackPowerSelection;
      if (!next || !previous) return;
      controller.onSelectPower?.(next);
      controller.onCommitPower(next, previous);
      if (modelSelectorPendingOutsideDismiss) {
        closeReactControlledMenu(nativeComposerTrigger());
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
        closeReactControlledMenu(nativeComposerTrigger());
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

  function syncGenericMaximumVisual(rail, effortText, fastButton, maximum) {
    const value = String(maximum);
    rail?.setAttribute("data-highlighted", value);
    rail?.setAttribute("data-max", value);
    effortText?.setAttribute("data-maximum", value);
    fastButton?.setAttribute("data-max-power-selection", value);
    const maxEffects = rail?.querySelector('[class*="_MaxEffects_"]');
    if (maxEffects) {
      maxEffects.style.opacity = maximum ? "1" : "0";
      if (maximum) maxEffects.style.transform = "translateX(0)";
    }
  }

  function neutralizeStaleSliderVisual(rail) {
    for (const selector of [
      "[data-codex-model-slider-native-range]",
      "[data-codex-model-slider-native-thumb]",
      "[data-codex-model-slider-range]",
      "[data-codex-model-slider-thumb]",
    ]) {
      rail.querySelectorAll(selector).forEach((element) => {
        element.style.setProperty("visibility", "hidden");
      });
    }
    rail.querySelectorAll("[data-codex-model-slider-tick]").forEach((tick) => {
      tick.removeAttribute("data-selected");
    });
    rail.removeAttribute("aria-valuenow");
    rail.style.removeProperty("--codex-model-slider-progress");
  }

  function nativeParticleSeed(index, salt) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function syncNativeFastParticles(rail, enabled, entering = false) {
    const track = Array.from(rail.children).find((element) => String(element.className).includes("_Track_"));
    if (!track) return;
    const staticParticles = rail.querySelector('[class*="_ParticleTransition_"]');
    if (staticParticles && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      staticParticles.__codexStaticParticleFade?.cancel();
      staticParticles.style.opacity = enabled ? "0" : "1";
      if (entering) {
        // 动态粒子渐显时，让原有星点在同一时间淡出。
        staticParticles.__codexStaticParticleFade = staticParticles.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 240, easing: "ease-out" },
        );
      }
    }
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
    if (entering) {
      // 首帧沿用关闭 Fast 时的星点，再渐显流动粒子。
      clip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
    }
  }

  function syncGenericFastVisual(shell, enabled, maxPowerSelection, animate = false) {
    const button = shell.querySelector("[data-codex-model-slider-fast]");
    const rail = shell.querySelector("[data-codex-model-slider-rail]");
    if (!button || !rail) return;
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("data-fast-mode-enabled", String(enabled));
    syncGenericMaximumVisual(
      rail,
      shell.querySelector("[data-codex-model-slider-effort-row] [data-maximum]"),
      button,
      maxPowerSelection,
    );
    button.setAttribute("aria-label", enabled
      ? (locale === "zh-CN" ? "关闭 Fast 模式" : "Disable Fast mode")
      : (locale === "zh-CN" ? "开启 Fast 模式" : "Enable Fast mode"));
    const icon = createNativeFastIcon(enabled);
    const content = button.querySelector("[data-codex-model-slider-fast-content]");
    if (icon && content) content.replaceChildren(icon);
    rail.setAttribute("data-fast-mode", String(enabled));
    rail.setAttribute("data-fast-mode-dot-transition", animate ? (enabled ? "entering" : "exiting") : (enabled ? "active" : "inactive"));
    syncNativeFastParticles(rail, enabled, animate && enabled);
    setGenericSliderVisual(rail, Number(rail.getAttribute("aria-valuenow") ?? 0), Number(rail.getAttribute("aria-valuemax") ?? 0) + 1);
    if (animate && enabled) {
      shell.setAttribute("data-codex-model-slider-fast-transitioning", "");
      setTimeout(() => {
        if (!shell.isConnected) return;
        shell.removeAttribute("data-codex-model-slider-fast-transitioning");
        queueEnsure();
      }, 260);
    } else {
      shell.removeAttribute("data-codex-model-slider-fast-transitioning");
    }
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

  function syncClonedPowerEffects(nativeContainer, shell) {
    const source = nativeContainer.querySelector("[data-model-picker-power-slider]");
    const clone = shell.querySelector("[data-codex-model-slider-native-slider]");
    if (!source || !clone) return null;
    const sourceCanvas = source.querySelector("canvas");
    const cloneCanvas = clone.querySelector("canvas");
    let canvasTimer = null;
    let observer = null;
    const disconnect = () => {
      observer?.disconnect();
      if (canvasTimer != null) clearInterval(canvasTimer);
    };
    if (sourceCanvas && cloneCanvas) {
      // 原生 canvas 可能在首次克隆时尚未绘制；持续同步其高光纹理。
      const scratch = document.createElement("canvas");
      const scratchContext = scratch.getContext("2d");
      const cloneContext = cloneCanvas.getContext("2d");
      const copyCanvas = () => {
        if (!source.isConnected || !shell.isConnected) {
          disconnect();
          return;
        }
        if (scratch.width !== sourceCanvas.width || scratch.height !== sourceCanvas.height) {
          scratch.width = sourceCanvas.width;
          scratch.height = sourceCanvas.height;
          cloneCanvas.width = sourceCanvas.width;
          cloneCanvas.height = sourceCanvas.height;
        }
        scratchContext.clearRect(0, 0, scratch.width, scratch.height);
        scratchContext.drawImage(sourceCanvas, 0, 0);
        const y = Math.floor(scratch.height / 2);
        const hasDrawing = [0.25, 0.5, 0.75].some((ratio) => (
          scratchContext.getImageData(Math.floor(scratch.width * ratio), y, 1, 1).data[3] > 0
        ));
        if (!hasDrawing) return;
        cloneContext.clearRect(0, 0, cloneCanvas.width, cloneCanvas.height);
        cloneContext.drawImage(scratch, 0, 0);
      };
      copyCanvas();
      canvasTimer = setInterval(copyCanvas, 80);
    }
    const sourceEffects = source.querySelector('[class*="_MaxEffects_"]');
    const cloneEffects = clone.querySelector('[class*="_MaxEffects_"]');
    if (!sourceEffects || !cloneEffects) return { disconnect };
    const sync = () => {
      if (!source.isConnected || !shell.isConnected) {
        disconnect();
        return;
      }
      const sourceTransition = sourceEffects.querySelector('[class*="_ParticleTransition_"]');
      let cloneTransition = cloneEffects.querySelector('[class*="_ParticleTransition_"]');
      if (!sourceTransition) {
        if (clone.querySelector("[data-fast-mode]")?.getAttribute("data-fast-mode") !== "true") {
          cloneTransition?.remove();
        }
        return;
      }
      const sourceParticles = sourceTransition.querySelectorAll('[class*="_TrackParticle_"]');
      let cloneParticles = cloneTransition?.querySelectorAll('[class*="_TrackParticle_"]');
      if (!cloneTransition || sourceParticles.length !== cloneParticles.length) {
        cloneTransition?.remove();
        cloneTransition = sourceTransition.cloneNode(true);
        cloneEffects.append(cloneTransition);
        cloneParticles = cloneTransition.querySelectorAll('[class*="_TrackParticle_"]');
      }
      cloneTransition.setAttribute("style", sourceTransition.getAttribute("style") ?? "");
      sourceParticles.forEach((particle, index) => {
        const style = particle.getAttribute("style") ?? "";
        if (cloneParticles[index].getAttribute("style") !== style) {
          cloneParticles[index].setAttribute("style", style);
        }
      });
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cloneTransition.style.opacity = clone.querySelector("[data-fast-mode]")?.getAttribute("data-fast-mode") === "true" ? "0" : "1";
      }
    };
    observer = new MutationObserver(sync);
    observer.observe(sourceEffects, { attributes: true, attributeFilter: ["style"], childList: true, subtree: true });
    sync();
    return { disconnect };
  }

  function createGenericModelSlider(parentMenu, selector, identity, model, selectedEffort) {
    const efforts = model.supportedReasoningLevels.map((level) => level.effort);
    const selectedIndex = efforts.indexOf(selectedEffort);
    const selectedEffortVisible = selectedIndex >= 0;
    const classes = Object.fromEntries([
      "Menu",
      "ViewToggle",
      "ViewToggleContent",
      "ViewToggleIcon",
      "ViewToggleModelLabel",
      "ViewToggleEffortLabel",
      "ViewControls",
      "ViewPanel",
      "FastModeToggle",
      "FastModeToggleContent",
      "SimpleView",
    ].map((tokenName) => [tokenName, nativeCssModuleClass(tokenName, parentMenu)]));
    if (Object.values(classes).some((name) => !name)) return null;
    const shell = document.createElement("div");
    shell.setAttribute("data-codex-model-slider-generic", `${identity.raw}:${selectedEffort}`);
    shell.className = classes.Menu;
    const panel = document.createElement("div");
    panel.className = classes.ViewPanel;
    shell.append(panel);
    shell.setAttribute("data-model-picker-view", "simple");
    shell.setAttribute("data-reduced-motion", String(matchMedia("(prefers-reduced-motion: reduce)").matches));
    shell.setAttribute("data-transitions-ready", "false");
    const nativeRow = nativeModelPickerRow(parentMenu);
    const controller = nativeComposerModelController();
    const fastOption = controller?.serviceTierOptions?.find((option) => option?.value === "priority") ?? null;
    const nativeModel = nativeCatalogModelFor(identity);
    const supportsFast = Boolean(fastOption && typeof controller.onSelectServiceTier === "function");
    shell.setAttribute("data-codex-model-slider-has-fast", String(supportsFast));
    const modelButton = document.createElement("div");
    modelButton.className = classes.ViewToggle;
    modelButton.setAttribute("role", "button");
    modelButton.setAttribute("tabindex", "0");
    modelButton.setAttribute("data-codex-model-slider-model-button", "");
    modelButton.setAttribute("aria-label", `Model ${modelDisplayLabel(identity, selector)}`);
    modelButton.setAttribute("aria-haspopup", "menu");
    modelButton.setAttribute("aria-expanded", "false");
    const buttonContent = document.createElement("span");
    buttonContent.className = classes.ViewToggleContent;
    // 上下两行独立计算宽度，长模型名不能撑开强度与箭头。
    buttonContent.style.display = "flex";
    buttonContent.style.flexDirection = "column";
    buttonContent.style.gap = "0";
    const effortRow = document.createElement("span");
    effortRow.setAttribute("data-codex-model-slider-effort-row", "");
    effortRow.style.display = "grid";
    effortRow.style.gridTemplateColumns = "calc(var(--mcx-spacing) * 4) auto calc(var(--mcx-spacing) * 4)";
    effortRow.style.alignItems = "center";
    const buttonLabel = document.createElement("span");
    buttonLabel.className = classes.ViewToggleModelLabel;
    buttonLabel.setAttribute("data-codex-model-slider-model-label", "");
    buttonLabel.textContent = modelDisplayLabel(identity, selector);
    const modelRow = document.createElement("span");
    modelRow.setAttribute("data-codex-model-slider-model-row", "");
    modelRow.style.display = "inline-flex";
    modelRow.style.alignItems = "center";
    modelRow.style.justifyContent = "center";
    modelRow.style.gap = "calc(var(--mcx-spacing) / 2)";
    modelRow.style.minWidth = "0";
    modelRow.style.maxWidth = "100%";
    modelRow.append(buttonLabel);
    const effortText = selectedEffortVisible ? document.createElement("span") : null;
    if (effortText) {
      effortText.className = classes.ViewToggleEffortLabel;
      // 原生标签会跨满整行；收回中列，使上下两行各自居中。
      effortText.style.gridColumn = "2";
      effortText.style.gridRow = "1";
      effortText.textContent = effortLabel(selectedEffort);
      effortText.setAttribute("data-accent", "true");
      effortText.setAttribute("data-effort-only", "false");
      effortText.setAttribute("data-maximum", String(selectedEffort === "ultra"));
    }
    // 0.152.1 起原生头行 aria-label 为 "Select model"，nativeModelPickerRow
    // 不再命中；优先从 view-toggle 行取 chevron，旧结构走原路径兜底。
    const nativeChevron = (
      parentMenu?.querySelector("[data-model-picker-view-toggle] svg")
      ?? nativeRow?.querySelector("svg")
    )?.cloneNode(true);
    if (nativeChevron) {
      nativeChevron.classList.add(classes.ViewToggleIcon);
      nativeChevron.style.gridArea = "auto";
      nativeChevron.style.flexShrink = "0";
      nativeChevron.setAttribute("aria-hidden", "true");
      modelRow.append(nativeChevron);
    }
    if (effortText) effortRow.append(effortText);
    buttonContent.append(effortRow, modelRow);
    modelButton.append(buttonContent);
    const openModels = () => openControllerModelMenu(parentMenu, modelButton, selector);
    modelButton.addEventListener("click", openModels);
    modelButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openModels();
    });

    const viewControls = document.createElement("div");
    viewControls.className = classes.ViewControls;
    // 沿用原生显式模型布局：上方档位，下方模型，两侧放置能力控件。
    viewControls.setAttribute("data-explicit-model", "true");
    viewControls.setAttribute("data-ultra-warning-visible", "false");
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
        const currentIndex = Number(shell.querySelector("[data-codex-model-slider-rail]")?.getAttribute("aria-valuenow"));
        syncGenericFastVisual(shell, nextEnabled, efforts[currentIndex] === "ultra", true);
        controller.onSelectServiceTier?.(nextEnabled ? fastOption.value : null);
        queueEnsure();
      });
      viewControls.append(modelButton, fastButton);
    } else {
      viewControls.append(modelButton);
    }

    const nativeReset = parentMenu.firstElementChild?.querySelector('[class*="_ResetToDefault_"]');
    if (nativeReset) {
      const reset = nativeReset.cloneNode(true);
      reset.setAttribute("role", "button");
      reset.setAttribute("tabindex", "0");
      reset.setAttribute("data-codex-model-slider-reset", "");
      reset.removeAttribute("data-radix-collection-item");
      reset.addEventListener("click", () => {
        const currentReset = parentMenu.firstElementChild?.querySelector('[class*="_ResetToDefault_"]');
        invokeNativeMenuItemSelect(currentReset);
        queueEnsure();
      });
      reset.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        reset.click();
      });
      viewControls.append(reset);
    }

    if (efforts.length < 2) {
      panel.append(viewControls);
      return shell;
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
    rail.setAttribute("aria-valuetext", selectedEffortVisible
      ? effortLabel(selectedEffort)
      : (locale === "zh-CN" ? "当前档位不可用" : "Current effort unavailable"));
    rail.toggleAttribute("data-stale-reasoning-effort", !selectedEffortVisible);
    if (!selectedEffortVisible) {
      rail.setAttribute("aria-disabled", "true");
      rail.removeAttribute("tabindex");
      neutralizeStaleSliderVisual(rail);
      const staleView = document.createElement("div");
      staleView.className = classes.SimpleView;
      staleView.append(nativeSlider ?? rail);
      panel.append(viewControls, staleView);
      return shell;
    }
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
    syncGenericMaximumVisual(
      rail,
      effortText,
      shell.querySelector("[data-codex-model-slider-fast]"),
      selectedEffort === "ultra",
    );

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
    const previewIndex = (index) => {
      pendingIndex = index;
      const effort = efforts[index];
      setGenericSliderVisual(rail, index, efforts.length);
      rail.setAttribute("aria-valuetext", effortLabel(effort));
      if (effortText) {
        effortText.textContent = effortLabel(effort);
      }
      const fastButton = shell.querySelector("[data-codex-model-slider-fast]");
      syncGenericMaximumVisual(rail, effortText, fastButton, effort === "ultra");
    };
    const preview = (clientX) => previewIndex(indexAt(clientX));
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
      previewIndex(selectedIndex);
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
      previewIndex(pendingIndex);
      selectNativeEffort(parentMenu, efforts[pendingIndex]);
    });
    const simpleView = document.createElement("div");
    simpleView.className = classes.SimpleView;
    simpleView.append(nativeSlider ?? rail);
    panel.append(viewControls, simpleView);
    return shell;
  }

  function centerGenericModelPicker(parentMenu) {
    const trigger = nativeComposerTrigger();
    if (!trigger) return;
    const menuRect = parentMenu.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    if (!(menuRect.width > 0 && triggerRect.width > 0)) return;
    const previousShift = Number.parseFloat(
      parentMenu.style.getPropertyValue("--codex-model-slider-menu-center-shift"),
    ) || 0;
    const unshiftedCenter = menuRect.left + (menuRect.width / 2) - previousShift;
    const nextShift = triggerRect.left + (triggerRect.width / 2) - unshiftedCenter;
    parentMenu.style.setProperty("--codex-model-slider-menu-center-shift", `${nextShift}px`);
  }

  // ========================================================================
  // 通用 picker 增强与恢复 — 菜单/触发器增强、布局居中与恢复降级
  // ========================================================================

  function enhanceGenericModelPicker(parentMenu, selector) {
    const identity = modelIdentity(nativeModelValue(parentMenu));
    const model = modelDefinitionFor(identity, selector);
    const displayModel = modelWithOpenCodexEfforts(identity, selector, model);
    const efforts = displayModel?.supportedReasoningLevels ?? [];
    if (!model) return false;
    // 控制器推导的任务内实际 effort 优先，避免子任务/主任务切换后触发器属性滞后；
    // 触发器属性仅在控制器无法解析时作为实时回退，静态目录默认值最后兜底。
    const nativeModel = nativeCatalogModelFor(identity);
    const selectedEffort = nativeModel?.currentReasoningLevel
      ?? nativeComposerTrigger()
        ?.getAttribute("data-selected-reasoning-effort")
      ?? model.defaultReasoningLevel
      ?? efforts[0]?.effort
      ?? "none";
    const effortRank = (value) => {
      const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
      const index = order.indexOf(String(value ?? "").toLowerCase());
      return index < 0 ? -1 : index;
    };
    const visibleEffort = efforts.find((level) => level.effort === selectedEffort)?.effort
      ?? efforts.filter((level) => effortRank(level.effort) <= effortRank(selectedEffort))
        .sort((left, right) => effortRank(right.effort) - effortRank(left.effort))[0]?.effort
      ?? efforts[0]?.effort
      ?? "none";
    const selectedEffortValue = visibleEffort;
    const selectedServiceTier = nativeComposerModelController()?.selectedServiceTier;
    const serviceTierKey = selectedServiceTier?.id ?? selectedServiceTier ?? "standard";
    const selectionMode = nativeComposerModelController()?.selectionMode ?? "";
    const structureKey = `${identity.raw}:${selectedEffortValue}:${selectionMode}:${efforts.map((level) => level.effort).join(",")}`;
    const key = `${structureKey}:${serviceTierKey}`;
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
    if (existing?.getAttribute("data-codex-model-slider-structure-key") === structureKey
      && existing.hasAttribute("data-codex-model-slider-fast-transitioning") && !canUpgradeFallback) {
      centerGenericModelPicker(parentMenu);
      return true;
    }
    const currentFast = existing?.querySelector("[data-codex-model-slider-rail]")?.getAttribute("data-fast-mode");
    const nativeFast = parentMenu.firstElementChild
      ?.querySelector("[data-model-picker-power-slider] [data-fast-mode]")?.getAttribute("data-fast-mode");
    if (existing?.getAttribute("data-codex-model-slider-structure-key") === structureKey
      && currentFast != null && currentFast === nativeFast && !canUpgradeFallback) {
      existing.setAttribute("data-codex-model-slider-generic", key);
      centerGenericModelPicker(parentMenu);
      return true;
    }
    if (existing?.getAttribute("data-codex-model-slider-generic") === key && !canUpgradeFallback) {
      centerGenericModelPicker(parentMenu);
      return true;
    }
    const nativeContainer = parentMenu.firstElementChild;
    if (!nativeContainer) return false;
    const shell = createGenericModelSlider(
      parentMenu,
      selector,
      identity,
      displayModel,
      selectedEffortValue,
    );
    if (!shell) {
      restoreGenericModelPicker(nativeContainer);
      return false;
    }
    modelSelectorGenericContainers.get(nativeContainer)?.effectMirror?.disconnect();
    existing?.remove();
    if (!modelSelectorGenericContainers.has(nativeContainer)) {
      modelSelectorGenericContainers.set(nativeContainer, {
        position: nativeContainer.style.position,
        inset: nativeContainer.style.inset,
        opacity: nativeContainer.style.opacity,
        pointerEvents: nativeContainer.style.pointerEvents,
        ariaHidden: nativeContainer.getAttribute("aria-hidden"),
        inert: nativeContainer.inert,
      });
    }
    parentMenu.setAttribute("data-codex-model-slider-generic-menu", "");
    nativeContainer.style.position = "absolute";
    nativeContainer.style.inset = "0";
    nativeContainer.style.opacity = "0";
    nativeContainer.style.pointerEvents = "none";
    nativeContainer.setAttribute("aria-hidden", "true");
    nativeContainer.inert = true;
    shell.setAttribute("data-codex-model-slider-generic", key);
    shell.setAttribute("data-codex-model-slider-structure-key", structureKey);
    parentMenu.append(shell);
    modelSelectorGenericContainers.get(nativeContainer).effectMirror = syncClonedPowerEffects(nativeContainer, shell);
    centerGenericModelPicker(parentMenu);
    return true;
  }

  function enhanceNativeModelPicker(parentMenu, selector) {
    if (enhanceGenericModelPicker(parentMenu, selector)) return;
    const toggle = parentMenu.querySelector("[data-model-picker-view-toggle]");
    if (toggle && typeof nativeComposerModelController()?.onSelectModel === "function") {
      // 私有 DOM 无法满足 MCX shell 契约时，保留原生菜单作为降级路径。
      const raw = nativeModelValue(parentMenu);
      const textNode = firstVisibleTextNode(toggle);
      if (raw && textNode) {
        if (!modelSelectorOriginalToggleLabels.has(textNode)) {
          modelSelectorOriginalToggleLabels.set(textNode, textNode.textContent);
        }
        const label = compactModelLabel(raw);
        if (textNode.textContent !== label) textNode.textContent = label;
      }
      if (!toggle.hasAttribute("data-codex-model-slider-toggle")) {
        const originalAriaExpanded = toggle.getAttribute("aria-expanded");
        toggle.setAttribute("data-codex-model-slider-toggle", "");
        const openModels = (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          openControllerModelMenu(parentMenu, toggle, selector);
        };
        const onKeyDown = (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          openModels(event);
        };
        toggle.addEventListener("click", openModels);
        toggle.addEventListener("keydown", onKeyDown);
        modelSelectorNativeToggleHandlers.set(toggle, { openModels, onKeyDown, originalAriaExpanded });
      }
      return;
    }
  }

  // 原生 ModelText 重建前的空窗期：立即插回 MCX 标签，避免关盒后芯片
  // 长时间失去模型名。
  function restoreTriggerLabelWithoutNative(trigger, selector) {
    if (trigger.getAttribute("data-state") !== "closed") return;
    if (trigger.querySelector("[data-codex-model-slider-trigger-label]")) return;
    const raw = trigger.getAttribute("data-codex-model-slider-trigger-raw");
    if (!raw) return;
    const anchor = trigger.querySelector('[class*="_ModelPickerTriggerLabel_"]')
      ?? trigger.querySelector('[class*="_ModelPickerTriggerContent_"]');
    if (!anchor) return;
    const displayLabel = document.createElement("span");
    displayLabel.setAttribute("data-codex-model-slider-trigger-label", "");
    displayLabel.textContent = modelDisplayLabel(modelIdentity(raw), selector);
    anchor.prepend(displayLabel);
  }

  function isComposerModelPlaceholder(value) {
    return /^(select\s+(model|effort)|选择\s*(模型|思考强度))$/i.test(String(value ?? "").trim());
  }

  function enhanceComposerModelTrigger(trigger, selector) {
    if (!modelSelectorTriggerObservers.has(trigger)) {
      const observer = new MutationObserver(queueEnsure);
      observer.observe(trigger, { childList: true, subtree: true, characterData: true });
      modelSelectorTriggerObservers.set(trigger, observer);
    }
    const nativeLabels = Array.from(trigger.querySelectorAll(
      '[class*="_ModelPickerTriggerModelText_"]:not([data-codex-model-slider-trigger-label])',
    ));
    if (!nativeLabels.length) {
      trigger.setAttribute("data-codex-model-slider-trigger", "");
      trigger.toggleAttribute(
        "data-codex-model-slider-trigger-placeholder",
        isComposerModelPlaceholder(trigger.innerText),
      );
      restoreTriggerLabelWithoutNative(trigger, selector);
      return;
    }
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
    // 区分占位态（Select model / Select effort）与真实模型态：占位态沿用
    // 原生宽度契约，真实模型态让芯片 HUG 完整名称，避免第三方长名被截断。
    const placeholder = isComposerModelPlaceholder(label);
    trigger.toggleAttribute("data-codex-model-slider-trigger-placeholder", placeholder);
    for (const nativeLabel of nativeLabels) {
      let displayLabel = nativeLabel.nextElementSibling;
      if (!displayLabel?.hasAttribute("data-codex-model-slider-trigger-label")) {
        // 空窗期回插等场景会在别处留下现成的 MCX 标签，优先移动复用，
        // 避免恢复后出现两个可见名称把芯片撑宽。
        displayLabel = trigger.querySelector("[data-codex-model-slider-trigger-label]");
        if (!displayLabel) {
          displayLabel = document.createElement("span");
          displayLabel.className = nativeLabel.className;
          displayLabel.setAttribute("data-codex-model-slider-trigger-label", "");
        }
        nativeLabel.after(displayLabel);
      }
      if (displayLabel.textContent !== label) displayLabel.textContent = label;
    }
    // 原生开合的临时 min-width 钉定与弹层水平居中都基于对 Measurement
    // 探针的测量；把探针文本同步为 MCX 显示标签，原生机制即可测得
    // 真实显示宽度。保留 React 持有的子节点，避免切模型时卸载失败。
    const measurement = trigger.querySelector('[class*="_ModelPickerTriggerMeasurement_"]');
    const measurementText = measurement && firstVisibleTextNode(measurement);
    if (measurementText && measurementText.nodeValue !== label) measurementText.nodeValue = label;
  }

  function ensureModelSelector() {
    const selector = modelSelectorFeature?.modelSelector;
    if (!selector) return;
    if (!nativeComposerModelController()) {
      if (modelSelectorStyle.isConnected) restoreModelSelectorEnhancements();
      return;
    }
    pruneModelSubmenuPositionObservers();
    pruneNativeModelToggleHandlers();
    pruneGenericModelPickerContainers();
    document.documentElement.setAttribute("data-codex-model-slider-catalog-ready", "");
    if (!modelSelectorStyle.isConnected) document.head?.append(modelSelectorStyle);
    // 主会话与 side chat 同时维护标签；菜单动作仍跟随原生打开的按钮。
    const triggers = nativeModel.triggers().filter(trigger => nativeModel.read(trigger));
    for (const [trigger, observer] of modelSelectorTriggerObservers) {
      if (triggers.includes(trigger)) continue;
      observer.disconnect();
      modelSelectorTriggerObservers.delete(trigger);
    }
    for (const trigger of triggers) enhanceComposerModelTrigger(trigger, selector);
    const parentMenu = nativeModelPickerMenu();
    if (modelSelectorControllerMenu && modelSelectorControllerMenu.parentMenu !== parentMenu) {
      closeControllerModelMenu({ immediate: true });
    }
    if (!parentMenu) {
      if (
        modelSelectorPendingReturn
        && !visibleBlockingDialog()
        && nativeModelPickerSubmenus().length === 0
      ) {
        clearTimeout(modelSelectorReturnTimer);
        modelSelectorReturnTimer = null;
        returnToNativeModelSlider();
      }
    } else {
      enhanceNativeModelPicker(parentMenu, selector);
      const submenu = nativeModelSubmenu(parentMenu);
      if (submenu) enhanceNativeModelSubmenu(submenu, selector);
    }
    try {
      // 图标工作与菜单增强解耦：放在最后并隔离异常，任何失败都不影响标签与菜单。
      captureNativeFastIcon();
    } catch (error) {
      console.warn("[codex-personal] fast icon capture failed", error);
    }
  }

  function restoreModelSelectorEnhancements() {
    closeControllerModelMenu({ immediate: true });
    clearTimeout(modelSelectorReturnTimer);
    clearTimeout(modelSelectorEffortTransactionTimer);
    for (const observer of modelSelectorTriggerObservers.values()) observer.disconnect();
    modelSelectorTriggerObservers.clear();
    for (const record of modelSelectorPositionObservers.values()) {
      record.observer.disconnect();
      record.resizeObserver.disconnect();
    }
    modelSelectorPositionObservers.clear();
    for (const frame of modelSelectorMenuSizeFrames.values()) cancelAnimationFrame(frame);
    modelSelectorMenuSizeFrames.clear();
    modelSelectorReturnTimer = null;
    modelSelectorEffortTransactionTimer = null;
    modelSelectorPendingOutsideDismiss = false;
    modelSelectorSuppressOutsidePointerSequence = false;
    modelSelectorPendingReturn = false;
    document.documentElement.removeAttribute("data-codex-model-slider-selecting-effort");
    for (const item of document.querySelectorAll("[data-codex-model-slider-item]")) {
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
    for (const [toggle, handlers] of modelSelectorNativeToggleHandlers) {
      toggle.removeEventListener("click", handlers.openModels);
      toggle.removeEventListener("keydown", handlers.onKeyDown);
      toggle.removeAttribute("data-codex-model-slider-toggle");
      if (handlers.originalAriaExpanded == null) toggle.removeAttribute("aria-expanded");
      else toggle.setAttribute("aria-expanded", handlers.originalAriaExpanded);
    }
    for (const container of modelSelectorGenericContainers.keys()) {
      restoreGenericModelPicker(container);
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
    modelSelectorOriginalToggleLabels.clear();
    modelSelectorNativeToggleHandlers.clear();
  }

  window.addEventListener("keydown", event => {
    const record = modelSelectorControllerMenu;
    if (event.key !== "Escape" || !record) return;
    // 先退出插件模型视图，避免原生 document 监听同时关闭整个 picker。
    event.preventDefault();
    event.stopImmediatePropagation();
    closeControllerModelMenu();
    record.button.focus();
  }, { capture: true, signal });
  document.addEventListener("click", event => {
    if (modelSelectorControllerMenu
      && !modelSelectorControllerMenu.menu.contains(event.target)
      && !modelSelectorControllerMenu.button.contains(event.target)) closeControllerModelMenu();
  }, {capture:true, signal});
  if (modelSelectorFeature && requestAction) {
    const selector = modelSelectorFeature.modelSelector;
    const legacy = [...loadModelFavorites(selector)];
    // 仅首次接入时迁移旧收藏；后续以后端为准，避免取消收藏后被旧窗口恢复。
    favoritesWrite = requestAction({ operation: 'initialize', add: legacy }).then(result => {
      if (signal.aborted) return;
      if (favoritesEpoch === 0) localStorage.setItem(selector.favoriteStorageKey, JSON.stringify(result.favorites));
      queueEnsure();
    });
    void favoritesWrite.catch(error => console.warn('Model favorites transfer store unavailable', error));
  }
  if (modelSelectorFeature) {
    // 启动阶段就解析 Fast 图标：先读持久化的原生克隆，再从 app bundle 静态提取兜底，
    // 避免首次会话必须等用户点开弹窗后 DOM 里才出现图标。
    const persistedIcons = loadPersistedNativeFastIcons(modelSelectorFastIconStorageKey);
    if (persistedIcons) {
      modelSelectorNativeFastIcons = persistedIcons;
    }
    void loadNativeFastIconFromBundle();
  }

  return { selfCheck: () => {
    const result=nativeModel.selfCheck();
    return {...result,scopes:[...(result.scopes ?? []),{name:"model-menu",element:modelSelectorControllerMenu?.menu}]};
  }, ensure: ensureModelSelector, dispose: restoreModelSelectorEnhancements };
}
