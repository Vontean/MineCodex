const ICONS = config.resources.icons;
const MARKER = "data-minecodex-quick-prompts";
const zh = () => (document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("zh");
const text = (en, cn) => (zh() ? cn : en);
const style = document.createElement("style");
style.textContent = config.resources.styles;
document.head.append(style);
let button = null;
let addButton = null;
let composerRoot = null;
let composerThread = null;
let panel = null;
let items = [];
let generation = 0;
let syncQueued = false;
let disposed = false;
let categories = [];
let nativeIcons = {};
let nativeEmojis = [];

const appearanceLabels = {"bar-chart": "柱状图", "book": "书籍", "brain": "大脑", "currency-dollar": "美元", "customize": "自定义", "dumbbell": "哑铃", "edit": "编辑", "flask": "烧瓶", "folder": "文件夹", "function": "函数", "globe": "地球", "graduation-cap": "学士帽", "heart": "爱心", "kettlebell": "壶铃", "logs": "笔记", "lotus": "莲花", "music": "音乐", "palette": "调色盘", "paw": "爪印", "plant": "植物", "popcorn": "爆米花", "scale": "天平", "stethoscope": "听诊器", "terminal": "终端", "wrench": "扳手", "writing": "写作", "blue": "蓝色", "green": "绿色", "orange": "橙色", "pink": "粉色", "purple": "紫色", "red": "红色", "yellow": "黄色", "black": "中性色"};
function appearanceLabel(key) {
  return text(key.replaceAll("-", " "), appearanceLabels[key] ?? key);
}
function errorMessage(error) {
  const messages = {
    "Category was not found": "未找到该分类",
    "Prompt was not found": "未找到该提示词",
    "Choose one emoji or leave it empty": "请选择一个 Emoji，或留空以继承分类图标",
    "Invalid sort order": "排序无效，请重试",
    "Invalid order": "排序无效，请重试",
    "Invalid category": "分类无效，请重试",
    "Items changed; refresh and try again": "条目已发生变化，请刷新后重试",
  };
  return text(error.message || "Something went wrong. Please try again.", messages[error.message] ?? "操作失败，请重试。");
}

// DOM 与图标工具
function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}
function icon(name) {
  return new DOMParser()
    .parseFromString(ICONS[name], "image/svg+xml")
    .documentElement.cloneNode(true);
}
function control(label, handler, className = "qp-command", iconName = null) {
  const node = element("button", className, iconName ? null : label);
  node.type = "button";
  node.setAttribute("aria-label", label);
  if (iconName) {
    node.append(icon(iconName));
    node.setAttribute("data-minecodex-tooltip", label);
  }
  node.addEventListener("click", handler);
  return node;
}
async function api(route, { method = "GET", body } = {}) {
  return config.requestHostAction("quick-prompts", { route, method, body });
}
function showError(error) {
  if (!panel) return;
  panel.querySelector(".qp-error")?.remove();
  const message = element("div", "qp-error", errorMessage(error));
  message.setAttribute("role", "alert");
  panel.append(message);
}
function position() {
  if (!panel || !composerRoot?.isConnected) return;
  config.ui.composerMenu(panel, addButton);
}
function close(restoreFocus = false) {
  generation++;
  panel?.remove();
  panel = null;

  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("data-state", "closed");
  if (restoreFocus) button?.focus({ preventScroll: true });
}
// 输入框 Popover：只浏览与插入
async function loadList() {
  const current = ++generation;

  panel.replaceChildren();

  panel.append(element("div", "qp-empty", text("Loading…", "加载中…")));
  try {
    const state = await api("/api/state");
    if (!panel || current !== generation) return;
    items = state.prompts;
    categories = state.categories;
    nativeIcons = state.icons;
    nativeEmojis = state.emojis ?? [];
    renderList();
  } catch (error) {
    if (panel && current === generation) {
      panel.querySelector(".qp-empty")?.remove();
      showError(error);
      panel.append(control(text("Retry", "重试"), loadList));
    }
  }
}
const COLORS = {
  black: ["var(--mcx-color-text-secondary)", "var(--mcx-color-text-secondary)"],
  blue: ["#0285ff", "#339cff"],
  green: ["#04b84c", "#40c977"],
  orange: ["#fb6a22", "#ff8549"],
  pink: ["#ff66ad", "#ff8cc1"],
  purple: ["#924ff7", "#ad7bf9"],
  red: ["#fa423e", "#ff6764"],
  yellow: ["#ffc300", "#ffd240"],
};
function categoryIcon(item) {
  const node = element("span", "qp-symbol");
  if (item.emoji) {
    node.textContent = item.emoji;
    return node;
  }
  const category = categories.find((entry) => entry.id === item.categoryId);
  const svg = new DOMParser().parseFromString(
    nativeIcons[category?.icon ?? "book"] ?? ICONS.prompt,
    "image/svg+xml",
  ).documentElement;
  node.append(svg.cloneNode(true));
  const colors = COLORS[category?.color ?? "black"] ?? COLORS.black;
  node.style.setProperty("--prompt-icon-light", colors[0]);
  node.style.setProperty("--prompt-icon-dark", colors[1]);
  return node;
}
function orderedItems(categoryId) {
  return items
    .filter((item) => item.categoryId === categoryId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
function renderList() {
  panel.replaceChildren();
  const list = element("div", "qp-scroll");
  if (!items.length)
    list.append(
      element("div", "qp-empty", text("No prompts yet", "还没有提示词")),
    );
  const recent = items
    .filter((item) => item.useCount > 0)
    .sort((a, b) => b.calledAt - a.calledAt || a.id.localeCompare(b.id))
    .slice(0, 3);
  const sections = [
    { name: text("Recently used", "最近使用"), prompts: recent },
    ...categories.map((category) => ({
      name: category.name,
      prompts: orderedItems(category.id),
    })),
    { name: text("Other", "其他"), prompts: orderedItems(null) },
  ];
  for (const section of sections.filter((section) => section.prompts.length)) {
    list.append(element("div", "qp-header", section.name));
    for (const item of section.prompts) {
      const row = element("div", "qp-row");
      const insert = control(
        item.summary,
        async () => {
          const current = generation;
          try {
            window.__codexPersonalRuntime.insertText(item.body);
            // 插入同步成功后再记一次调用；失败和单纯浏览不计数。
            close();
            await api(`/api/prompts/${encodeURIComponent(item.id)}/use`, {
              method: "POST",
              body: { action: "insert", success: true },
            });
          } catch (error) {
            if (generation === current) showError(error);
            else console.warn("[Prompts] Usage could not be saved", error);
          }
        },
        "qp-select",
      );
      insert.replaceChildren(
        categoryIcon(item),
        element("span", "qp-title", item.summary),
      );
      if (item.title)
        insert.append(
          element("span", "qp-preview", item.body.replace(/\s+/g, " ")),
        );
      row.append(insert);
      list.append(row);
    }
  }
  panel.append(list);
  position();
}
function open() {
  if (panel) {
    close(true);
    return;
  }
  if (addButton.getAttribute("aria-expanded") === "true") addButton.click();
  panel = element("div");
  panel.setAttribute(MARKER, "panel");
  config.ui.surface(panel, "composer-menu");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", text("Quick Prompts", "快捷提示词"));
  document.body.append(panel);
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("data-state", "open");
  position();
  void loadList();
}
function isOpenComposerMenu(node) {
  return node.getAttribute("aria-expanded") === "true"
    && node.checkVisibility({ visibilityProperty: true })
    && (node.getAttribute("data-composer-navigation-target") === "add-context"
      || node.getAttribute("aria-haspopup") === "menu");
}
function sync() {
  if (disposed || signal.aborted) return;
  syncNavigation();
  const nativeComposer = config.codex.composer(null,{threadOnly:false});
  const add = nativeComposer?.add;
  const card = nativeComposer?.root;
  const thread = nativeComposer?.threadId ?? null;
  if (thread !== composerThread) {
    close();
    composerThread = thread;
  }
  if (add !== addButton || card !== composerRoot) {
    close();
    button?.remove();
    button = null;
    addButton = add;
    composerRoot = card;
  }
  if (!add) return;
  if (
    panel &&
    [...card.querySelectorAll("button")].some(isOpenComposerMenu)
  )
    close();
  if (!button) {
    button = add.cloneNode(false);
    button.removeAttribute("title");
    button.removeAttribute("aria-describedby");
    button.removeAttribute("id");
    button.removeAttribute("data-composer-navigation-target");
    button.setAttribute(MARKER, "button");
    button.setAttribute("aria-label", text("Quick Prompts", "快捷提示词"));
    button.setAttribute("data-minecodex-tooltip", text("Quick Prompts", "快捷提示词"));
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("data-state", "closed");
    // 保留 Add 的紧凑与常规图标容器，以同一规则响应窗口尺寸。
    for (const child of add.children) {
      const slot = child.cloneNode(true);
      for (const svg of slot.querySelectorAll("svg")) {
        const replacement = icon("prompt");
        for (const attr of [
          "class",
          "width",
          "height",
          "aria-hidden",
          "focusable",
        ]) {
          if (svg.hasAttribute(attr))
            replacement.setAttribute(attr, svg.getAttribute(attr));
        }
        svg.replaceWith(replacement);
      }
      button.append(slot);
    }
    button.addEventListener("click", open);
    add.after(button);
  }
  if (button.className !== add.className) button.className = add.className;
  position();
}
// 页面与快捷调用面板共享数据；所有编辑只存在于页面。
// 管理页面与编辑弹窗
let navButton = null;
let ownNavGroup = null;
let page = null;
let pageGeneration = 0;
let activeCategory = "all";
let pageSort = "manual";
let searchText = "";
let editor = null;
let pageFocus = null;
const hiddenSurfaces = new Map();
let navigationRail = null;

function pageControl(label, handler, primary = false, tone = "secondary") {
  return config.ui.action(control(label, handler, `pm-command${primary ? " pm-primary" : ""}`), primary ? "primary" : tone);
}
function pageError(error) {
  if (!page) return;
  page.querySelector(".pm-error")?.remove();
  const message = element("div", "pm-error", errorMessage(error));
  message.setAttribute("role", "alert");
  (editor ?? page.querySelector(".pm-wrap") ?? page).append(message);
}
function positionPage() {
  if (!page) return;
  const rail = config.codex.rail();
  if (!rail) {
    closePage();
    return;
  }
  const rect = rail.getBoundingClientRect();
  page.style.left = `${rect.right}px`;
  page.style.top = `${rect.top}px`;
  page.style.right = "4px";
  page.style.bottom = "4px";
}
function syncNavigationSelection() {
  navigationRail?.select(Boolean(page));
}
function restoreNavigationSelection() {
  navigationRail?.select(false);
}
function closePage(restoreFocus = false) {
  dragState?.cancel();
  pageGeneration++;
  closePagePopup();
  closeEditor(false);
  page?.remove();
  page = null;
  restoreNavigationSelection();
  editor = null;
  for (const [surface, inert] of hiddenSurfaces) surface.inert = inert;
  hiddenSurfaces.clear();
  navButton?.removeAttribute("data-selected");
  navButton?.removeAttribute("aria-current");
  document.documentElement.removeAttribute("data-mcx-prompts-open");
  if (restoreFocus && pageFocus?.isConnected)
    pageFocus.focus({ preventScroll: true });
}
async function loadPage() {
  const current = ++pageGeneration;
  try {
    const state = await api("/api/state");
    if (!page || current !== pageGeneration) return;
    items = state.prompts;
    categories = state.categories;
    nativeIcons = state.icons;
    nativeEmojis = state.emojis ?? [];
    renderPage();
  } catch (error) {
    if (current === pageGeneration) pageError(error);
  }
}
function openPage() {
  close();
  if (page) return;
  pageFocus = document.activeElement;
  page = element("section");
  page.setAttribute(MARKER, "page");
  config.ui.page(page);
  page.setAttribute("aria-label", text("Prompts", "提示词"));
  document.body.append(page);
  // 只隔离主内容的焦点，保留导航栏与原生窗口控件。
  for (const surface of document.querySelectorAll(
    '[class*="_PageSurface_"], [class*="_Workspace_"]',
  )) {
    hiddenSurfaces.set(surface, surface.inert);
    surface.inert = true;
  }
  document.documentElement.setAttribute("data-mcx-prompts-open", "");
  navButton?.setAttribute("data-selected", "");
  navButton?.setAttribute("aria-current", "page");
  syncNavigationSelection();
  positionPage();
  page.append(element("div", "pm-empty", text("Loading…", "加载中…")));
  void loadPage();
}
let pagePopup = null;
let popupTrigger = null;
function pageIcon(label, name, handler) {
  const button = control(label, handler, "pm-icon", name);
  button.setAttribute("data-minecodex-tooltip", label);
  return button;
}
function closePagePopup(restoreFocus = false) {
  pagePopup?.remove();
  pagePopup = null;
  popupTrigger?.setAttribute("aria-expanded", "false");
  if (restoreFocus && popupTrigger?.isConnected)
    popupTrigger.focus({ preventScroll: true });
  popupTrigger = null;
}
function makePagePopup(trigger, className, role, matchTriggerWidth = false) {
  if (popupTrigger === trigger) {
    closePagePopup(true);
    return null;
  }
  closePagePopup();
  popupTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  pagePopup = element("div", `pm-popup ${className}`);
  config.ui.surface(pagePopup, "dropdown");
  pagePopup.setAttribute("role", role);
  pagePopup.setAttribute("aria-label", trigger.getAttribute("aria-label"));
  (editorLayer ?? page).append(pagePopup);
  const r = trigger.getBoundingClientRect();
  if (matchTriggerWidth) {
    pagePopup.style.boxSizing = "border-box";
    pagePopup.style.width = `${r.width}px`;
  }
  const width = pagePopup.getBoundingClientRect().width;
  pagePopup.style.top = `${r.bottom + 6}px`;
  pagePopup.style.left = `${Math.max(8, Math.min(r.right - width, innerWidth - width - 8))}px`;
  return pagePopup;
}
function makeSearchField() {
  const container = element("div", "pm-search-inline");
  const input = element("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = text("Search prompts", "搜索提示词");
  input.setAttribute("aria-label", input.placeholder);
  input.value = searchText;
  const update = () => {
    searchText = input.value;
    renderRows(page.querySelector(".pm-list"));
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      input.value = "";
      update();
    }
  });
  container.append(icon("search"), input);
  return container;
}
function openSort(trigger) {
  const popup = makePagePopup(trigger, "", "menu");
  if (!popup) return;
  for (const [value, label] of [
    ["manual", text("Manual order", "手动排序")],
    ["usage", text("Most used", "调用次数")],
    ["recent", text("Recently used", "最近调用")],
  ]) {
    const choice = control(
      label,
      () => {
        pageSort = value;
        closePagePopup(true);
        renderRows(page.querySelector(".pm-list"));
      },
      "",
    );
    choice.setAttribute("role", "menuitemradio");
    choice.setAttribute("aria-checked", String(value === pageSort));
    if (value === pageSort) choice.append(icon("check"));
    popup.append(choice);
  }
  popup.querySelector("[aria-checked=true]")?.focus();
}
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      pagePopup &&
      !pagePopup.contains(event.target) &&
      !popupTrigger?.contains(event.target)
    )
      closePagePopup();
  },
  { signal },
);
document.addEventListener(
  "keydown",
  (event) => {
    if (!pagePopup) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePagePopup(true);
    } else if (
      pagePopup.getAttribute("role") === "menu" &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const options = [...pagePopup.querySelectorAll("button")],
        index = options.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
      options[next]?.focus();
    }
  },
  { signal, capture: true },
);
document.addEventListener(
  "focusin",
  (event) => {
    if (
      pagePopup &&
      !pagePopup.contains(event.target) &&
      !popupTrigger?.contains(event.target)
    )
      closePagePopup();
  },
  { signal },
);
window.addEventListener("resize", () => closePagePopup(), { signal });

function renderPage() {
  if (!page) return;
  closeEditor(false);
  closePagePopup();
  editor = null;
  page.replaceChildren();
  const wrap = element("div", "pm-wrap");
  const heading = element("div", "pm-heading");
  const actions = element("div", "pm-header-actions");
  const searchField = makeSearchField();
  const sortButton = pageIcon(
    text("Sort prompts", "提示词排序"),
    "arrow-down-wide-narrow",
    () => openSort(sortButton),
  );
  sortButton.setAttribute("aria-haspopup", "menu");
  actions.append(
    sortButton,
    pageIcon(text("Edit categories", "编辑分类"), "settings", manageCategories),
    searchField,
    pageControl(text("New prompt", "新建提示词"), () => editPrompt(), true),
  );
  heading.append(element("h1", "", text("Prompts", "提示词")), actions);
  const tabs = element("div", "pm-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", text("Categories", "分类"));
  const choices = [
    { id: "all", name: "All" },
    ...categories,
    { id: "uncategorized", name: text("Other", "其他") },
  ];
  if (!choices.some((c) => c.id === activeCategory)) activeCategory = "all";
  choices.forEach((category) => {
    const tab = control(
      category.name,
      () => {
        activeCategory = category.id;
        renderPage();
      },
      "pm-tab",
    );
    if (category.id !== "all")
      tab.prepend(categoryIcon({ categoryId: category.id === "uncategorized" ? null : category.id }));
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(activeCategory === category.id));
    tab.tabIndex = activeCategory === category.id ? 0 : -1;
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const index = choices.indexOf(category);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? choices.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + choices.length) %
              choices.length;
      activeCategory = choices[next].id;
      renderPage();
      page.querySelector("[aria-selected=true]")?.focus();
    });
    tabs.append(tab);
  });
  const tabRow = element("div", "pm-tab-row");
  tabRow.append(tabs);
  const list = element("div", "pm-list");
  wrap.append(heading, tabRow, list);
  page.append(wrap);
  renderRows(list);
}
function renderRows(list) {
  list.replaceChildren();
  const query = searchText.trim().toLocaleLowerCase();
  const groups = [...categories, { id: null, name: text("Other", "其他") }];
  let shown = items.filter(
    (item) =>
      (activeCategory === "all" ||
        item.categoryId ===
          (activeCategory === "uncategorized" ? null : activeCategory)) &&
      (!query ||
        `${item.title}\n${item.body}`.toLocaleLowerCase().includes(query)),
  );
  if (!shown.length) {
    list.append(emptyState(Boolean(query)));
    return;
  }
  if (pageSort === "usage")
    shown.sort(
      (a, b) =>
        b.useCount - a.useCount || (b.calledAt ?? 0) - (a.calledAt ?? 0),
    );
  if (pageSort === "recent")
    shown.sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  const sections =
    pageSort === "manual"
      ? groups
          .map((c) => ({
            name: c.name,
            items: orderedItems(c.id).filter((p) => shown.includes(p)),
          }))
          .filter((c) => c.items.length)
      : [{ items: shown }];
  for (const section of sections) {
    if (section.name && activeCategory === "all")
      list.append(element("h2", "", section.name));
    for (const item of section.items) {
      const row = element("div", "pm-row");
      row.dataset.promptId = item.id;
      const info = control(item.summary, () => editPrompt(item), "pm-info");
      info.replaceChildren(
        element("div", "pm-title", item.summary),
        element("div", "pm-preview", item.body.replace(/\s+/g, " ")),
      );
      const stats = element("div", "pm-stats");
      stats.append(
        element(
          "div",
          "pm-count",
          pageSort === "recent"
            ? item.calledAt == null
              ? text("Never used", "尚未调用")
              : new Intl.DateTimeFormat(zh() ? "zh-CN" : "en", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                }).format(new Date(item.calledAt))
            : text(`${item.useCount} ${item.useCount === 1 ? "call" : "calls"}`, `${item.useCount} 次调用`),
        ),
      );
      row.append(categoryIcon(item), info, stats);
      if (pageSort === "manual" && !query)
        row.append(
          orderControls(item, orderedItems(item.categoryId), false, row),
        );
      list.append(row);
    }
  }
}
function emptyState(searching) {
  const empty = element("div", "pm-empty-state");
  const art = element("span", "pm-empty-art", searching ? "🔎" : "📖");
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", text("Prompts", "提示词"));
  empty.append(
    art,
    element(
      "div",
      "pm-empty-title",
      searching
        ? text("No prompts found", "未找到提示词")
        : text("No prompts yet", "暂无提示词"),
    ),
    element(
      "div",
      "pm-empty-description",
      searching
        ? text("Try a different search.", "试试其他关键词。")
        : text(
            "Save a prompt to use it again in any chat.",
            "收藏提示词，在任意对话中快速调用。",
          ),
    ),
  );
  if (!searching)
    empty.append(
      pageControl(text("New prompt", "新建提示词"), () => editPrompt(), true),
    );
  return empty;
}
let dragState = null;
function orderControls(item, ordered, isCategory, row) {
  const handle = pageIcon(
    text("Drag to reorder", "拖拽排序"),
    "drag",
    () => {},
  );
  handle.classList.add("pm-drag");
  handle.setAttribute("data-minecodex-tooltip", text(
    "Drag to reorder · Alt + ↑ / ↓",
    "拖拽排序 · Alt + ↑ / ↓",
  ));
  row.dataset.orderId = item.id;
  const group = isCategory ? "categories" : `prompts:${item.categoryId ?? ""}`;
  row.dataset.orderGroup = group;
  async function save(ids) {
    try {
      await api("/api/reorder", {
        method: "POST",
        body: {
          ids,
          categoryId: item.categoryId ?? null,
          categories: isCategory,
        },
      });
      await loadPage();
      if (isCategory && page) manageCategories();
    } catch (error) {
      pageError(error);
    }
  }
  // 原生拖影跟随指针，占位块负责布局；仅同组条目参与让位。
  handle.addEventListener("pointerdown", () => { row.draggable = true; });
  handle.addEventListener("pointerup", () => { row.draggable = false; });
  row.addEventListener("dragstart", (event) => {
    if (dragState) return;
    const parent = row.parentElement;
    const siblings = [...parent.children].filter(node => node.dataset.orderGroup === group);
    const originalNext = row.nextSibling;
    const placeholder = element("div", "pm-drop-placeholder");
    placeholder.style.height = `${row.getBoundingClientRect().height}px`;
    placeholder.setAttribute("aria-hidden", "true");
    const lifetime = new AbortController();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations = new Map();
    let started = false;
    let finished = false;
    const duration = reduced ? 0 : 180;
    function movePlaceholder(before) {
      if (placeholder.nextSibling === before || before === placeholder) return;
      const positions = new Map(siblings.filter(node => node !== row).map(node => [node, node.getBoundingClientRect().top]));
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
      parent.insertBefore(placeholder, before);
      for (const [node, top] of positions) {
        const delta = top - node.getBoundingClientRect().top;
        if (delta && duration) animations.set(node, node.animate([
          { transform: `translateY(${delta}px)` }, { transform: "translateY(0)" },
        ], { duration, easing: "cubic-bezier(.2,.8,.2,1)" }));
      }
    }
    function finish(commit) {
      if (finished) return;
      finished = true;
      lifetime.abort();
      dragState = null;
      row.draggable = false;
      if (!started) return;
      if (!commit) movePlaceholder(originalNext);
      parent.insertBefore(row, placeholder);
      row.classList.remove("pm-dragging");
      placeholder.remove();
      const ids = [...parent.children].filter(node => node.dataset.orderGroup === group).map(node => node.dataset.orderId);
      const landing = row.animate([{ opacity: .45 }, { opacity: 1 }], { duration: reduced ? 0 : 140, easing: "ease-out" });
      if (commit && ids.some((id, index) => id !== ordered[index].id)) {
        void landing.finished.catch(() => {}).then(() => save(ids));
      }
    }
    dragState = { cancel: () => finish(false) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    // 等浏览器截取拖影后再隐藏原行，避免拖影变成空白。
    requestAnimationFrame(() => {
      if (finished || !row.isConnected) return;
      row.before(placeholder);
      row.classList.add("pm-dragging");
      started = true;
    });
    parent.addEventListener("dragover", event => {
      if (!started) return;
      const target = event.target.closest("[data-order-group], .pm-drop-placeholder");
      if (target !== placeholder && (!siblings.includes(target) || target === row)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (target === placeholder) return;
      // 使用布局位置判断插入点，不受让位动画的 transform 影响。
      const rect = target.getBoundingClientRect();
      const transform = getComputedStyle(target).transform;
      const translateY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      const after = event.clientY > rect.top - translateY + rect.height / 2;
      movePlaceholder(after ? target.nextSibling : target);
    }, { signal: lifetime.signal });
    parent.addEventListener("drop", event => {
      const target = event.target.closest("[data-order-group], .pm-drop-placeholder");
      if (target !== placeholder && !siblings.includes(target)) return;
      event.preventDefault();
      finish(true);
    }, { signal: lifetime.signal });
    row.addEventListener("dragend", () => finish(false), { once: true, signal: lifetime.signal });
    signal.addEventListener("abort", () => finish(false), { once: true, signal: lifetime.signal });
  });
  handle.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const ids = ordered.map((x) => x.id),
      from = ids.indexOf(item.id),
      to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void save(ids);
  });
  return handle;
}
function field(label, input) {
  const node = element("label", "pm-field", label);
  node.append(input);
  return node;
}
let editorLayer = null;
let editorReturnFocus = null;
let editorFocusCleanup = null;
function closeEditor(restoreFocus = true) {
  dragState?.cancel();
  closePagePopup();
  editorFocusCleanup?.();
  editorFocusCleanup = null;
  editorLayer?.remove();
  editorLayer = null;
  editor = null;
  const wrap = page?.querySelector(".pm-wrap");
  if (wrap) wrap.inert = false;
  if (restoreFocus && editorReturnFocus?.isConnected)
    editorReturnFocus.focus({ preventScroll: true });
}
function editorShell(title, back = null) {
  closePagePopup();
  if (!editorLayer) {
    editorReturnFocus = document.activeElement;
    editorLayer = element("div", "pm-modal-layer");
    editorLayer.setAttribute(MARKER, "modal");
    config.ui.overlay(editorLayer);
    // 弹窗遮罩覆盖整个窗口，避免受页面与侧栏的层级约束。
    config.ui.mount(editorLayer, "modal");
    editorFocusCleanup = config.ui.trapFocus(() => editor, { onClose:()=>closeEditor(), isBlocked:()=>Boolean(pagePopup) });
    page.querySelector(".pm-wrap").inert = true;
  }
  editorLayer.replaceChildren();
  editor = element("div", "pm-editor");
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "true");
  editor.setAttribute("aria-label", title);
  editor.tabIndex = -1;
  const heading = config.ui.heading(editor, {
    title, closeLabel:text("Close", "关闭"), onClose:()=>closeEditor(),
    back:back ? pageIcon(text("Back", "返回"), "back", back) : null,
  });
  heading.classList.add("pm-modal-heading");
  editorLayer.append(editor);
  editor.focus();
  return editor;
}
function editPrompt(item = null) {
  const target = editorShell(
    item ? text("Edit prompt", "编辑提示词") : text("New prompt", "新建提示词"),
  );
  target.classList.add("pm-prompt-editor");
  const form = element("form", "pm-form");
  const title = element("input");
  title.value = item?.title ?? "";
  title.maxLength = 200;
  const category = {
    value:
      item?.categoryId ??
      (categories.some((c) => c.id === activeCategory) ? activeCategory : ""),
  };
  const emoji = { value: item?.emoji ?? "" };
  const categoryButton = control(
    "",
    () => {
      const popup = makePagePopup(categoryButton, "pm-category-menu", "menu", true);
      if (!popup) return;
      for (const c of [
        ...categories,
        { id: "", name: text("Other", "其他") },
      ]) {
        const choice = control(
          c.name,
          () => {
            category.value = c.id;
            refreshAppearance();
            closePagePopup(true);
          },
          "",
        );
        choice.replaceChildren(
          categoryIcon({ categoryId: c.id || null }),
          element("span", "pm-option-label", c.name),
        );
        choice.setAttribute("role", "menuitemradio");
        choice.setAttribute("aria-checked", String(category.value === c.id));
        if (category.value === c.id) choice.append(icon("check"));
        popup.append(choice);
      }
      popup.querySelector("[aria-checked=true]")?.focus();
    },
    "pm-select",
  );
  categoryButton.setAttribute("aria-haspopup", "menu");
  const emojiButton = control(
    text("Choose icon", "选择图标"),
    () => openEmojiPicker(emojiButton, emoji, refreshAppearance),
    "pm-emoji-trigger",
  );
  emojiButton.setAttribute("aria-haspopup", "dialog");
  function refreshAppearance() {
    const c = categories.find((c) => c.id === category.value);
    categoryButton.replaceChildren(
      categoryIcon({ categoryId: category.value || null }),
      element("span", "pm-option-label", c?.name ?? text("Other", "其他")),
      icon("chevron"),
    );
    categoryButton.setAttribute(
      "aria-label",
      text("Category: ", "分类：") + (c?.name ?? text("Other", "其他")),
    );
    emojiButton.replaceChildren(
      categoryIcon({ categoryId: category.value || null, emoji: emoji.value }),
    );
    emojiButton.setAttribute("data-minecodex-tooltip", text("Choose icon", "选择图标"));
  }
  refreshAppearance();
  const body = element("textarea");
  body.value = item?.body ?? "";
  body.required = true;
  const titleControl = element("div", "pm-title-control");
  titleControl.setAttribute("role", "group");
  titleControl.setAttribute("aria-label", text("Prompt title and icon", "提示词标题与图标"));
  title.setAttribute("aria-label", text("Title", "标题"));
  title.placeholder = text("Title", "标题");
  titleControl.append(emojiButton, title);
  form.append(
    titleControl,
    field(text("Category", "分类"), categoryButton),
    field(text("Prompt", "提示词"), body),
  );
  const footer = config.ui.footer(element("div", "pm-footer"));
  if (item) {
    const remove = pageControl(text("Delete", "删除"), async () => {
      if (remove.dataset.confirm !== "true") {
        remove.dataset.confirm = "true";
        remove.textContent = text("Confirm delete", "确认删除");
        return;
      }
      remove.disabled = true;
      try {
        await api(`/api/prompts/${item.id}`, { method: "DELETE" });
        if (editor === target) await loadPage();
      } catch (error) {
        remove.disabled = false;
        pageError(error);
      }
    });
    config.ui.action(remove, "danger");
    remove.style.marginRight = "auto";
    footer.append(remove);
  }
  const save = pageControl(text("Save", "保存"), () => {}, true);
  save.type = "submit";
  footer.append(pageControl(text("Cancel", "取消"), renderPage, false, "ghost"), save);
  form.append(footer);
  target.append(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (save.disabled || !body.value.trim()) return;
    save.disabled = true;
    try {
      await api(item ? `/api/prompts/${item.id}` : "/api/prompts", {
        method: item ? "PATCH" : "POST",
        body: {
          title: title.value,
          body: body.value,
          categoryId: category.value || null,
          emoji: emoji.value.trim(),
        },
      });
      if (editor === target) await loadPage();
    } catch (error) {
      if (editor === target) {
        save.disabled = false;
        pageError(error);
      }
    }
  });
  title.focus();
}
function openEmojiPicker(trigger, selected, refresh) {
  const popup = makePagePopup(trigger, "pm-symbol-picker", "dialog");
  if (!popup) return;
  const search = element("input");
  search.placeholder = text("Search emoji", "搜索 Emoji");
  search.setAttribute("aria-label", search.placeholder);
  const grid = element("div", "pm-emoji-grid");
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", text("Emojis", "Emoji"));
  const render = () => {
    grid.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    for (const item of nativeEmojis.filter(
      (e) => !query || e[0].includes(query) || e[1].includes(query),
    )) {
      const choice = control(
        item[1],
        () => {
          selected.value = item[0];
          refresh();
          closePagePopup(true);
        },
        "pm-emoji-choice",
      );
      choice.textContent = item[0];
      choice.setAttribute("aria-pressed", String(selected.value === item[0]));
      grid.append(choice);
    }
    if (!grid.children.length)
      grid.append(
        element(
          "div",
          "pm-empty-description",
          text("No emoji found", "未找到 Emoji"),
        ),
      );
  };
  search.addEventListener("input", render);
  const reset = control(
    text("Use category icon", "使用分类图标"),
    () => {
      selected.value = "";
      refresh();
      closePagePopup(true);
    },
    "pm-command",
  );
  popup.append(search, grid, reset);
  render();
  search.focus();
  const r = popup.getBoundingClientRect();
  popup.style.left = `${Math.max(8, Math.min(trigger.getBoundingClientRect().left, innerWidth - r.width - 8))}px`;
  if (r.bottom > innerHeight - 16)
    popup.style.top = `${Math.max(16, innerHeight - r.height - 16)}px`;
  popup.addEventListener("keydown", (event) => {
    const choices = [...grid.querySelectorAll("button")],
      index = choices.indexOf(document.activeElement);
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[
        event.key
      ];
      choices[Math.max(0, Math.min(choices.length - 1, index + step))]?.focus();
    }
    if (event.key === "Tab") {
      const buttons = [search, ...choices, reset],
        i = buttons.indexOf(document.activeElement);
      if (event.shiftKey && i === 0) {
        event.preventDefault();
        reset.focus();
      } else if (!event.shiftKey && i === buttons.length - 1) {
        event.preventDefault();
        search.focus();
      }
    }
  });
}
function manageCategories() {
  const target = editorShell(text("Categories", "分类"));
  const footer = config.ui.footer(element("div", "pm-footer"));
  footer.append(
    pageControl(text("New category", "新建分类"), () => editCategory(), true),
  );
  for (const category of categories) {
    const row = element("div", "pm-row");
    row.append(
      categoryIcon({ categoryId: category.id }),
      control(category.name, () => editCategory(category), "pm-info"),
      orderControls(category, categories, true, row),
    );
    target.append(row);
  }
  target.append(footer);
}
function editCategory(category = null) {
  const target = editorShell(
    category
      ? text("Edit category", "编辑分类")
      : text("New category", "新建分类"),
    manageCategories,
  );
  const form = element("form", "pm-form");
  const name = element("input");
  name.value = category?.name ?? "";
  name.required = true;
  name.maxLength = 60;
  let selectedIcon = category?.icon ?? "book",
    selectedColor = category?.color ?? "black";
  const icons = element("div", "pm-grid");
  icons.setAttribute("aria-label", text("Category icon", "分类图标"));
  function refreshChoices() {
    icons.replaceChildren();
    for (const key of Object.keys(nativeIcons)) {
      const btn = control(
        key,
        () => {
          selectedIcon = key;
          refreshChoices();
        },
        "pm-choice",
      );
      const svg = new DOMParser().parseFromString(
        nativeIcons[key],
        "image/svg+xml",
      ).documentElement;
      btn.replaceChildren(svg);
      btn.setAttribute("aria-pressed", String(key === selectedIcon));
      btn.setAttribute("data-minecodex-tooltip", appearanceLabel(key));
      btn.setAttribute("aria-label", appearanceLabel(key));
      icons.append(btn);
    }
  }
  refreshChoices();
  const colors = element("div", "pm-grid");
  for (const key of Object.keys(COLORS)) {
    const btn = control(
      key,
      () => {
        selectedColor = key;
        for (const child of colors.children)
          child.setAttribute("aria-pressed", String(child === btn));
      },
      "pm-choice",
    );
    const swatch = element("span", "qp-symbol");
    swatch.style.setProperty("--prompt-icon-light", COLORS[key][0]);
    swatch.style.setProperty("--prompt-icon-dark", COLORS[key][1]);
    swatch.append(element("span", "pm-swatch"));
    btn.replaceChildren(swatch);
    btn.setAttribute("aria-pressed", String(key === selectedColor));
    btn.setAttribute("data-minecodex-tooltip", appearanceLabel(key));
      btn.setAttribute("aria-label", appearanceLabel(key));
    colors.append(btn);
  }
  form.append(
    field(text("Name", "名称"), name),
    element("div", "", text("Icon", "图标")),
    icons,
    element("div", "", text("Color", "颜色")),
    colors,
  );
  const footer = config.ui.footer(element("div", "pm-footer"));
  if (category) {
    const remove = pageControl(text("Delete", "删除"), () => {
      const count = items.filter(
        (item) => item.categoryId === category.id,
      ).length;
      const destroy = async (button) => {
        button.disabled = true;
        try {
          await api(`/api/categories/${category.id}`, { method: "DELETE" });
          await loadPage();
          if (page) manageCategories();
        } catch (error) {
          button.disabled = false;
          pageError(error);
        }
      };
      if (!count) {
        void destroy(remove);
        return;
      }
      const confirmation = editorShell(text("Delete category?", "删除分类？"));
      confirmation.append(
        element(
          "p",
          "pm-confirm-description",
          text(
            `${count} prompts will move to Other. Their content and call counts will be kept.`,
            `${count} 条提示词将移到 Other，内容和调用次数都会保留。`,
          ),
        ),
      );
      const actions = config.ui.footer(element("div", "pm-footer"));
      const confirm = pageControl(
        text("Delete", "删除"),
        () => void destroy(confirm),
      );
      config.ui.action(confirm, "danger");
      actions.append(
        pageControl(text("Cancel", "取消"), () => editCategory(category), false, "ghost"),
        confirm,
      );
      confirmation.append(actions);
    });
    config.ui.action(remove, "danger");
    remove.style.marginRight = "auto";
    footer.append(remove);
  }
  const save = pageControl(text("Save", "保存"), () => {}, true);
  save.type = "submit";
  footer.append(pageControl(text("Cancel", "取消"), manageCategories, false, "ghost"), save);
  form.append(footer);
  target.append(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    try {
      await api(
        category ? `/api/categories/${category.id}` : "/api/categories",
        {
          method: category ? "PATCH" : "POST",
          body: { name: name.value, icon: selectedIcon, color: selectedColor },
        },
      );
      if (editor === target) {
        await loadPage();
        if (page) manageCategories();
      }
    } catch (error) {
      if (editor === target) {
        save.disabled = false;
        pageError(error);
      }
    }
  });
  name.focus();
}
// 原生导航挂载与卸载
function syncNavigation() {
  const rail = config.codex.rail();
  if (!rail) {
    navButton?.remove();
    navButton = null;
    if (page) closePage();
    return;
  }
  const slot = config.codex.railSlot(ownNavGroup);
  if (!slot) return;
  const { template:source, scroll } = slot;
  let group = slot.group;
  if (!group) {
    if (!ownNavGroup) {
      ownNavGroup = element("div", "flex shrink-0 flex-col items-center gap-2");
      ownNavGroup.setAttribute(MARKER, "nav-group");
    }
    if (ownNavGroup.parentElement !== scroll) scroll.append(ownNavGroup);
    group = ownNavGroup;
  }
  if (!navButton?.isConnected) {
    navigationRail?.restore();
    navButton = source.cloneNode(false);
    navButton.removeAttribute("id");
    navButton.removeAttribute("title");
    navButton.removeAttribute("aria-describedby");
    navButton.removeAttribute("data-sidebar-destination");
    navButton.removeAttribute("data-selected");
    navButton.removeAttribute("aria-current");
    navButton.removeAttribute("data-suppress-active-style");
    navButton.setAttribute(MARKER, "nav");
    navButton.setAttribute("aria-label", text("Prompts", "提示词"));
    navButton.setAttribute("data-minecodex-tooltip", text("Prompts", "提示词"));
    const inner = element("span", source.firstElementChild?.className ?? "");
    const glyph = icon("prompt-nav");
    glyph.setAttribute("aria-hidden", "true");
    inner.append(glyph, element("span", "sr-only", text("Prompts", "提示词")));
    navButton.append(inner);
    navigationRail = config.ui.navigationRail(navButton, {
      defaultIcon:glyph, selectedIcon:icon("prompt-nav-selected"),
    });
    navButton.addEventListener("click", openPage);
  }
  if (navButton.parentElement !== group || navButton !== group.lastElementChild)
    group.append(navButton);
  if (group !== ownNavGroup) ownNavGroup?.remove();
  syncNavigationSelection();
  positionPage();
}
document.addEventListener(
  "click",
  (event) => {
    if (
      page &&
      event.target.closest("[data-app-navigation-rail] button") &&
      !navButton?.contains(event.target)
    )
      closePage();
  },
  { signal, capture: true },
);
window.addEventListener("popstate", () => closePage(), { signal });
window.addEventListener("resize", positionPage, { signal });

const observer = new MutationObserver(() => {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [
    "data-composer-placement",
    "data-above-composer-conversation-id",
    "aria-expanded",
    "data-selected",
    "aria-current",
    "class",
    "hidden",
    "inert",
    "aria-hidden",
  ],
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      panel &&
      !panel.contains(event.target) &&
      !button?.contains(event.target)
    )
      close();
  },
  { signal },
);
document.addEventListener(
  "keydown",
  (event) => {
    if (!panel) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const choices = [...panel.querySelectorAll(".qp-select")];
      const current = choices.indexOf(document.activeElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % choices.length
          : (current <= 0 ? choices.length : current) - 1;
      choices[next]?.focus();
    }
  },
  { signal, capture: true },
);
window.addEventListener("resize", position, { signal });
window.addEventListener("scroll", position, { signal, capture: true });
sync();
return () => {
  disposed = true;
  observer.disconnect();
  close();
  button?.remove();
  closePage();
  navButton?.remove();
  ownNavGroup?.remove();
  style.remove();
};
