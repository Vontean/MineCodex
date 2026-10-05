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
let composerEditable = null;
let focusedEditable = null;
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
    "No available input in the focused window": "当前窗口没有可用输入框，请先打开聊天并确认 MCX 增强服务已开启。",
    "Input changed before insertion": "输入框已切换，请重新选择提示词。",
    "Enable Prompts in MineCodex first": "请先在 MineCodex 中开启提示词。",
    "Open a chat before using a prompt.": "请先打开一个对话，再使用提示词。",
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
  clearQuickPreview(true);
  quickTabsObserver?.disconnect();
  generation++;
  panel?.remove();
  panel = null;

  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("data-state", "closed");
  if (restoreFocus) button?.focus({ preventScroll: true });
}
let quickCategory = "all";
let quickTabsObserver = null;
let quickPreview = null;
let quickPreviewTimer = null;
let quickExitTimer = null;
function clearQuickPreview(immediate = false, shift = 0) {
  clearTimeout(quickPreviewTimer);
  clearTimeout(quickExitTimer);
  const current = quickPreview;
  if (!current) return;
  current.anchor.removeAttribute("data-preview");
  if (immediate || previewReducedMotion()) {
    current.node.remove();
    quickPreview = null;
    return;
  }
  current.node.style.pointerEvents = "none";
  tweenPreview(current.node, { opacity:0, transform:`translateY(${Math.max(-10, Math.min(10, shift))}px) scale(.98)` }, 150);
  quickExitTimer = setTimeout(() => {
    current.node.remove();
    if (quickPreview === current) quickPreview = null;
  }, 150);
}
function showQuickPreview(item, anchor) {
  clearQuickPreview(true);
  const preview = cardPreview(item);
  if (!preview) return;
  quickPreviewTimer = setTimeout(() => {
    if (!panel || !anchor.isConnected) return;
    const node = element("div", "qp-image-preview");
    config.ui.surface(node, "popover");
    config.ui.mount(node, "floating");
    const image = element("img");
    image.alt = text(`Full image: ${item.summary}`, `完整图片：${item.summary}`);
    const place = () => {
      if (quickPreview?.node !== node || !image.naturalWidth) return;
      const r = anchor.getBoundingClientRect(), p = panel.getBoundingClientRect();
      const right = innerWidth - p.right - 24, left = p.left - 24;
      const available = Math.max(right, left);
      if (available < 96) { clearQuickPreview(true); return; }
      const scale = Math.min(280 / image.naturalWidth, available / image.naturalWidth, 360 / image.naturalHeight, (innerHeight - 24) / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      node.style.left = `${right >= width ? p.right + 12 : p.left - width - 12}px`;
      node.style.top = `${Math.max(12, Math.min(r.top + (r.height - height) / 2, innerHeight - height - 12))}px`;
      node.style.visibility = "visible";
      if (!previewReducedMotion()) node.animate([{opacity:0,transform:"translateX(-4px) scale(.98)"},{opacity:1,transform:"none"}],{duration:180,easing:"cubic-bezier(.22,1,.36,1)"});
    };
    node.append(image);
    quickPreview = {node, anchor};
    anchor.dataset.preview = "true";
    node.addEventListener("pointerenter", () => clearTimeout(quickPreviewTimer));
    node.addEventListener("pointerleave", () => clearQuickPreview());
    image.onload = place;
    image.src = preview.data;
    if (image.complete) place();
  }, 160);
}
function quickCategoryTabs() {
  const bar = element("div", "qp-tabs-bar");
  const tabs = element("div", "qp-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", text("Prompt categories", "提示词分类"));
  const choices = [{id:"all",name:text("All","全部")}, ...categories.filter(c => orderedItems(c.id).length), ...(orderedItems(null).length ? [{id:"other",name:text("Other","其他")}] : [])];
  if (!choices.some(c => c.id === quickCategory)) quickCategory = "all";
  for (const category of choices) {
    const tab = control(category.name, () => { quickCategory = category.id; renderList(); panel.querySelector('[aria-selected="true"]')?.focus({preventScroll:true}); }, "qp-tab");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(category.id === quickCategory));
    tab.setAttribute("aria-controls", "mcx-quick-results");
    tabs.append(tab);
  }
  const arrows = element("div", "qp-tab-arrows");
  const move = direction => tabs.scrollBy({left:direction * Math.max(100,tabs.clientWidth - 90), behavior:previewReducedMotion() ? "instant" : "smooth"});
  const previous = control(text("Previous categories","前面的分类"), () => move(-1), "qp-tab-arrow qp-tab-previous", "chevron");
  const next = control(text("More categories","后面的分类"), () => move(1), "qp-tab-arrow qp-tab-next", "chevron");
  arrows.append(previous,next);
  bar.append(tabs,arrows);
  const update = () => {
    const naturalWidth = [...tabs.children].reduce((width, tab) => width + tab.offsetWidth + 2, -2);
    const overflow = naturalWidth > tabs.clientWidth + 1;
    previous.hidden = !overflow || tabs.scrollLeft <= 1;
    next.hidden = !overflow || tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
    arrows.hidden = !overflow;
    bar.dataset.overflow = String(overflow);
    tabs.style.setProperty("--qp-arrow-space", `${overflow ? 68 : 0}px`);
  };
  tabs.addEventListener("scroll", update, {passive:true});
  tabs.addEventListener("keydown", event => {
    if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...tabs.children], i = buttons.indexOf(document.activeElement);
    const target = buttons[Math.max(0,Math.min(buttons.length-1,i+(event.key === "ArrowRight" ? 1 : -1)))];
    target?.focus();
  });
  quickTabsObserver = new ResizeObserver(update);
  quickTabsObserver.observe(tabs);
  requestAnimationFrame(() => { if (!bar.isConnected) return; update(); const selected=tabs.querySelector('[aria-selected="true"]'); if(selected) tabs.scrollLeft = Math.max(0,selected.offsetLeft-tabs.offsetLeft-tabs.clientWidth+selected.offsetWidth+68); update(); });
  return bar;
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
  clearQuickPreview(true);
  quickTabsObserver?.disconnect();
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
  panel.append(quickCategoryTabs());
  list.id = "mcx-quick-results";
  let lastScroll = 0;
  list.addEventListener("scroll", () => { const delta = lastScroll - list.scrollTop; lastScroll = list.scrollTop; clearQuickPreview(false, delta); }, {passive:true});
  const sections = [
    { id:"recent", name: text("Recently used", "最近使用"), prompts: recent },
    ...categories.map((category) => ({
      id: category.id, name: category.name,
      prompts: orderedItems(category.id),
    })),
    { id:"other", name: text("Other", "其他"), prompts: orderedItems(null) },
  ];
  for (const section of sections.filter((section) => section.prompts.length && (quickCategory === "all" || section.id === quickCategory))) {
    list.append(element("div", "qp-header", section.name));
    for (const item of section.prompts) {
      const row = element("div", "qp-row");
      const insert = control(
        item.summary,
        async () => {
          const current = generation;
          try {
            if (!composerEditable?.isConnected || !config.codex.composer(composerEditable,{purpose:"insertion"}))
              throw new Error("Input changed before insertion");
            window.__codexPersonalRuntime.insertText(item.body, composerEditable);
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
      insert.addEventListener("pointerenter", () => showQuickPreview(item, insert));
      insert.addEventListener("focus", () => showQuickPreview(item, insert));
      insert.addEventListener("pointerleave", () => { clearTimeout(quickPreviewTimer); quickPreviewTimer = setTimeout(() => clearQuickPreview(), 100); });
      insert.addEventListener("blur", () => clearQuickPreview());
      row.append(insert);
      list.append(row);
    }
  }
  if (!list.children.length) list.append(element("div", "qp-empty", text("No prompts yet", "还没有提示词")));
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
function insertionComposer() {
  // 官方 App 获得 iframe 焦点时，保留用户最后操作的同窗口输入框。
  const target = document.activeElement?.tagName === "IFRAME" ? focusedEditable : null;
  return config.codex.composer(target,{purpose:"insertion"});
}
function sync() {
  if (disposed || signal.aborted) return;
  if (config.management) return;
  const nativeComposer = panel ? config.codex.composer(composerEditable,{purpose:"insertion"}) : insertionComposer();
  const add = nativeComposer?.add;
  const card = nativeComposer?.root;
  const thread = nativeComposer?.threadId ?? null;
  if (thread !== composerThread) {
    close();
    composerThread = thread;
  }
  if (add !== addButton || card !== composerRoot || nativeComposer?.editable !== composerEditable) {
    close();
    button?.remove();
    button = null;
    addButton = add;
    composerRoot = card;
  }
  composerEditable = nativeComposer?.editable ?? null;
  insertionBridge?.remember(nativeComposer);
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
let page = null;
let pageGeneration = 0;
let activeCategory = "all";
let pageSort = "manual";
let pageView = "cards";
try { pageView = localStorage.getItem("minecodex.prompts.view") === "list" ? "list" : "cards"; } catch {}
let cardResizeObserver = null;
let searchText = "";
let editor = null;
let pageFocus = null;

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
  if (page) Object.assign(page.style, {inset:"0",borderRadius:"0"});
}
function closePage(restoreFocus = false, restoreNavigation = true) {
  dragState?.cancel();
  closeImagePreview();
  cardResizeObserver?.disconnect();
  pageGeneration++;
  closePagePopup();
  closeEditor(false);
  if (page) config.ui.releasePage(page, { restoreNavigation });
  page?.remove();
  page = null;
  editor = null;
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
  config.ui.page(page, { sidebar:"none", onNavigate:() => closePage(false, false) });
  page.setAttribute("aria-label", text("Prompt", "提示词"));
  document.body.append(page);
  document.documentElement.setAttribute("data-mcx-prompts-open", "");
  positionPage();
  page.append(element("div", "pm-empty", text("Loading…", "加载中…")));
  return loadPage();
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
    viewSwitcher(),
    searchField,
    pageControl(text("New prompt", "新建提示词"), () => editPrompt(), true),
  );
  heading.append(element("h1", "", text("Prompt", "提示词")), actions);
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
  closeImagePreview();
  cardResizeObserver?.disconnect();
  list.replaceChildren();
  list.dataset.view = pageView;
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
    (pageSort === "manual" || pageView === "cards")
      ? groups
          .map((c) => ({
            name: c.name,
            items: pageSort === "manual"
              ? orderedItems(c.id).filter((p) => shown.includes(p))
              : shown.filter((p) => p.categoryId === c.id),
          }))
          .filter((c) => c.items.length)
      : [{ items: shown }];
  for (const section of sections) {
    if (section.name && activeCategory === "all")
      list.append(element("h2", "", section.name));
    if (pageView === "cards") {
      list.append(renderCardSection(section));
      continue;
    }
    for (const item of section.items) {
      const row = element("div", "pm-row");
      row.dataset.promptId = item.id;
      const use = control(text(`Use ${item.summary}`, `使用 ${item.summary}`), () => void usePagePrompt(item, use), "pm-list-use");
      const info = element("div", "pm-info");
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
      use.replaceChildren(categoryIcon(item), info, stats);
      row.append(use, pageIcon(text("Edit prompt", "编辑提示词"), "square-pen", () => editPrompt(item)));
      if (pageSort === "manual" && !query)
        row.append(
          orderControls(item, orderedItems(item.categoryId), false, row),
        );
      list.append(row);
    }
  }
}
function viewSwitcher() {
  const group = element("div", "pm-view-switch");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", text("View", "视图"));
  for (const [value, label] of [["cards", text("Cards", "卡片")], ["list", text("List", "列表")]]) {
    const button = control(label, () => {
      pageView = value;
      try { localStorage.setItem("minecodex.prompts.view", value); } catch {}
      for (const child of group.children) child.setAttribute("aria-pressed", String(child === button));
      renderRows(page.querySelector(".pm-list"));
    }, "pm-view-option", value === "cards" ? "layout-grid" : "list");
    button.setAttribute("aria-pressed", String(pageView === value));
    group.append(button);
  }
  return group;
}
function cardPreview(item) {
  // 当前只有分类语义，占位图不写入用户提示词，也不冒充生成结果。
  const category = categories.find((c) => c.id === item.categoryId);
  if (!/^(生图|图像生成|图片生成|image generation|images?)$/i.test(category?.name?.trim() ?? "")) return null;
  const previews = config.resources.previews ?? [];
  const index = orderedItems(item.categoryId).findIndex((p) => p.id === item.id);
  return previews[index % previews.length] ?? null;
}
async function usePagePrompt(item, trigger) {
  trigger.disabled = true;
  try { await config.insertPrompt(item.id); if (!signal.aborted) await loadPage(); }
  catch (error) { if (!signal.aborted) pageError(error); }
  finally { trigger.disabled = false; }
}
let imagePreview = null;
let imagePreviewAnchor = null;
let imagePreviewTimer = null;
let imagePreviewSpotlight = null;
let imagePreviewExitTimer = null;
const previewReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function tweenPreview(node, target, duration) {
  if (!node) return;
  const computed = getComputedStyle(node);
  const from = { opacity:computed.opacity, transform:computed.transform };
  node.getAnimations().forEach((animation) => animation.cancel());
  node.animate([from, target], { duration, easing:"cubic-bezier(.22,1,.36,1)", fill:"forwards" });
}
function retainImagePreview() {
  clearTimeout(imagePreviewTimer);
  if (imagePreviewExitTimer === null) return;
  clearTimeout(imagePreviewExitTimer);
  imagePreviewExitTimer = null;
  tweenPreview(imagePreview, { opacity:1, transform:"none" }, 180);
  tweenPreview(imagePreviewSpotlight?.overlay, { opacity:1, transform:"none" }, 180);
}
function dismissImagePreview() {
  clearTimeout(imagePreviewTimer);
  if (!imagePreview || previewReducedMotion()) { closeImagePreview(); return; }
  if (imagePreviewExitTimer !== null) return;
  tweenPreview(imagePreview, { opacity:0, transform:"scale(.97)" }, 160);
  tweenPreview(imagePreviewSpotlight?.overlay, { opacity:0, transform:"none" }, 180);
  imagePreviewExitTimer = setTimeout(closeImagePreview, 180);
}
function closeImagePreview() {
  clearTimeout(imagePreviewExitTimer);
  imagePreviewExitTimer = null;
  clearTimeout(imagePreviewTimer);
  imagePreviewAnchor?.removeAttribute("aria-describedby");
  imagePreview?.remove();
  if (imagePreviewSpotlight) {
    const { card, placeholder, layer, overlay, cssText } = imagePreviewSpotlight;
    card.style.cssText = cssText;
    placeholder.replaceWith(card);
    layer.remove();
    overlay.remove();
    imagePreviewSpotlight = null;
  }
  imagePreview = null;
  imagePreviewAnchor = null;
}
function deferImagePreviewClose() {
  if (document.activeElement === imagePreviewAnchor) return;
  clearTimeout(imagePreviewTimer);
  imagePreviewTimer = setTimeout(dismissImagePreview, 100);
}
function showImagePreview(anchor, preview, title) {
  if (imagePreviewAnchor === anchor && imagePreview) {
    retainImagePreview();
    return;
  }
  closeImagePreview();
  imagePreviewAnchor = anchor;
  imagePreviewTimer = setTimeout(() => {
    if (!anchor.isConnected || !page || signal.aborted) return;
    const panel = element("div", "pm-image-preview");
    panel.id = "mcx-prompt-image-preview";
    panel.setAttribute("role", "tooltip");
    config.ui.surface(panel, "popover");
    const image = element("img");
    image.alt = text(`Full image: ${title}`, `完整图片：${title}`);
    const position = () => {
      if (imagePreview !== panel || !image.naturalWidth) return;
      const r = anchor.getBoundingClientRect();
      const scale = Math.min(520 / image.naturalWidth, (innerHeight - 40) / image.naturalHeight, (innerWidth - 40) / image.naturalWidth, 640 / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      const right = r.right + 12;
      const left = r.left - width - 12;
      panel.style.left = `${Math.max(14, Math.min(right + width <= innerWidth - 14 ? right : left >= 14 ? left : r.left + (r.width - width) / 2, innerWidth - width - 14))}px`;
      panel.style.top = `${Math.max(14, Math.min(r.top + (r.height - height) / 2, innerHeight - height - 14))}px`;
      panel.style.transformOrigin = `${Math.max(0, Math.min(width, r.left + r.width / 2 - parseFloat(panel.style.left)))}px ${Math.max(0, Math.min(height, r.top + r.height / 2 - parseFloat(panel.style.top)))}px`;
      panel.style.visibility = "visible";
      if (!panel.dataset.entered && !previewReducedMotion()) {
        panel.animate([{ opacity:0, transform:"scale(.96)" }, { opacity:1, transform:"none" }], { duration:240, easing:"cubic-bezier(.22,1,.36,1)", fill:"forwards" });
      }
      panel.dataset.entered = "true";
    };
    image.addEventListener("load", position, { once: true });
    image.src = preview.data;
    panel.append(image);
    panel.addEventListener("pointerenter", retainImagePreview);
    panel.addEventListener("pointerleave", deferImagePreviewClose);
    imagePreview = panel;
    // 原卡片移入浮层，避开书架的 mask / overflow；占位保持页面不跳动。
    const card = anchor.closest(".pm-card");
    const rect = card.getBoundingClientRect();
    const placeholder = element("div");
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    const overlay = element("div", "pm-preview-overlay");
    config.ui.overlay(overlay);
    config.ui.layer(overlay, "floating");
    overlay.addEventListener("pointerdown", dismissImagePreview);
    const layer = element("div", "pm-preview-spotlight");
    layer.setAttribute(MARKER, "page");
    config.ui.layer(layer, "floating");
    const cssText = card.style.cssText;
    imagePreviewSpotlight = { card, placeholder, layer, overlay, cssText };
    card.replaceWith(placeholder);
    Object.assign(card.style, { position:"absolute", left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, height:`${rect.height}px`, pointerEvents:"auto" });
    layer.append(card);
    document.body.append(overlay, layer);
    if (!previewReducedMotion()) overlay.animate([{ opacity:0 }, { opacity:1 }], { duration:220, easing:"cubic-bezier(.22,1,.36,1)", fill:"forwards" });
    anchor.setAttribute("aria-describedby", panel.id);
    document.body.append(panel);
    position();
  }, 200);
}
window.addEventListener("scroll", closeImagePreview, { capture:true, signal });
window.addEventListener("resize", closeImagePreview, { signal });
window.addEventListener("blur", closeImagePreview, { signal });
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imagePreviewAnchor) {
    event.preventDefault();
    event.stopImmediatePropagation();
    dismissImagePreview();
  }
}, { capture:true, signal });
signal.addEventListener("abort", closeImagePreview, { once:true });
function renderCardSection(section) {
  const shelf = element("div", activeCategory === "all" ? "pm-card-shelf" : "pm-card-grid");
  if (activeCategory === "all") {
    shelf.tabIndex = 0;
    shelf.setAttribute("role", "region");
    shelf.setAttribute("aria-label", section.name);
    const updateEdges = () => {
      shelf.dataset.left = String(shelf.scrollLeft > 3);
      shelf.dataset.right = String(shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 3);
    };
    shelf.addEventListener("scroll", updateEdges, { passive: true });
    cardResizeObserver ??= new ResizeObserver((entries) => {
      for (const { target } of entries) target.dispatchEvent(new Event("scroll"));
    });
    cardResizeObserver.observe(shelf);
    requestAnimationFrame(updateEdges);
  }
  for (const item of section.items) {
    const preview = cardPreview(item);
    const card = element("article", `pm-card${preview ? " pm-card-image" : ""}`);
    card.dataset.promptId = item.id;
    card.addEventListener("pointerenter", () => {
      if (imagePreviewSpotlight?.card === card) retainImagePreview();
    });
    card.addEventListener("pointerleave", () => {
      if (imagePreviewSpotlight?.card === card) deferImagePreviewClose();
    });
    if (preview) {
      const cover = control(text("Edit prompt", "编辑提示词"), () => editPrompt(item), "pm-card-cover");
      const image = element("img");
      image.src = preview.data;
      image.alt = "";
      image.loading = "lazy";
      cover.replaceChildren(image);
      cover.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") showImagePreview(cover, preview, item.summary);
      });
      cover.addEventListener("pointerleave", (event) => {
        if (!card.contains(event.relatedTarget)) deferImagePreviewClose();
      });
      cover.addEventListener("focus", () => showImagePreview(cover, preview, item.summary));
      cover.addEventListener("blur", deferImagePreviewClose);
      cover.addEventListener("click", closeImagePreview);
      card.append(cover);
    }
    const content = control(item.summary, () => editPrompt(item), "pm-card-content");
    content.replaceChildren(categoryIcon(item), element("h3", "pm-card-title", item.summary), element("p", "pm-card-body", item.body));
    const footer = element("div", "pm-card-footer");
    const use = pageControl(text("Use", "使用"), () => void usePagePrompt(item, use));
    use.setAttribute("aria-label", text(`Use ${item.summary}`, `使用 ${item.summary}`));
    footer.append(element("span", "pm-count", text(`${item.useCount} ${item.useCount === 1 ? "call" : "calls"}`, `${item.useCount} 次调用`)), use);
    card.append(content, footer);
    shelf.append(card);
  }
  return shelf;
}
function emptyState(searching) {
  const empty = element("div", "pm-empty-state");
  const art = element("span", "pm-empty-art", searching ? "🔎" : "📖");
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", text("Prompt", "提示词"));
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
    const rect = row.getBoundingClientRect();
    const radius = getComputedStyle(row).borderRadius;
    const dragImage = row.cloneNode(true);
    dragImage.removeAttribute("data-order-group");
    dragImage.removeAttribute("data-order-id");
    dragImage.setAttribute("aria-hidden", "true");
    Object.assign(dragImage.style, { position:"fixed", left:"-10000px", top:"0", width:`${rect.width}px`,
      height:`${rect.height}px`, margin:"0", boxSizing:"border-box", pointerEvents:"none",
      background:"var(--mcx-color-surface)", borderRadius:radius, overflow:"hidden", clipPath:`inset(0 round ${radius})` });
    // 显式裁切拖影，避免浏览器自动截图留下矩形外边界。
    parent.append(dragImage);
    event.dataTransfer.setDragImage(dragImage, event.clientX - rect.left, event.clientY - rect.top);
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
      dragImage.remove();
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
    // 等浏览器截取拖影后再清理替身、隐藏原行。
    requestAnimationFrame(() => {
      dragImage.remove();
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
  closeImagePreview();
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
    pageControl(text("New category", "新建分类"), () => editCategory()),
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
window.addEventListener("resize", positionPage, { signal });

document.addEventListener("focusin", event => {
  if (config.management) return;
  const target = event.target.closest?.('[contenteditable="true"]');
  const focused = target ? config.codex.composer(target,{purpose:"insertion"}) : null;
  if (focused) focusedEditable = focused.editable;
  sync();
}, {signal});

const observer = new MutationObserver(() => {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
});
if (!config.management) observer.observe(document.documentElement, {
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
      !quickPreview?.node.contains(event.target) &&
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
window.addEventListener("resize", () => { clearQuickPreview(true); position(); }, { signal });
window.addEventListener("scroll", position, { signal, capture: true });
const insertionBridge = config.management ? null : installPromptInsertion(signal, {
  codex:config.codex, api, insertText:(body,editable) => window.__codexPersonalRuntime.insertText(body,editable),
});
if (config.management) openPage(); else sync();

config.registerSelfCheck?.(() => {
  const composer=config.codex.composer(null,{purpose:"insertion"});
  const checks=composer ? [{name:"quick-prompts-anchor",available:Boolean(composer.add && button?.isConnected && composerEditable === composer.editable)}] : [];
  const available=checks.every(check=>check.available);
  return {state:composer ? available ? "available" : "unavailable" : "not-applicable",reason:available ? null : "prompts-anchor-unavailable",checks,
    scopes:[{name:"composer",element:composer?.root},{name:"quick-prompts",element:panel}]};
});

return () => {
  disposed = true;

  observer.disconnect();
  close();
  button?.remove();
  closePage();
  style.remove();
};
