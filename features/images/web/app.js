import { getLocale, setLocale, t, translateDocument } from "./i18n.mjs";

const shell = document.querySelector(".library-shell");
const libraryHeader = document.querySelector(".library-header");
const sidebarOpenButton = document.querySelector(".sidebar-open-button");
const scrollArea = document.querySelector(".library-scroll");
const grid = document.querySelector(".image-grid");
const pageSentinel = document.querySelector(".page-sentinel");
const empty = document.querySelector(".empty-state");
const emptyTitle = empty.querySelector("h2");
const emptyDescription = empty.querySelector("p");
const rescan = document.querySelector(".rescan-button");
const filterButton = document.querySelector(".source-filter-button");
const filterSourceIcon = document.querySelector(".filter-source-icon");
const filterLabel = document.querySelector(".filter-label");
const filterCount = document.querySelector(".filter-count");
const sourceMenu = document.querySelector(".source-menu");
const densityButtonValue = document.querySelector(".density-button-value");
const densitySlider = document.querySelector(".density-slider");
const groupButton = document.querySelector(".group-button");
const drawer = document.querySelector(".detail-drawer");
const drawerImage = drawer.querySelector("img");
const drawerProjectRow = drawer.querySelector(".drawer-project-row");
const drawerProject = drawer.querySelector(".drawer-project");
const drawerTaskLabel = drawer.querySelector(".drawer-task-label");
const drawerThread = drawer.querySelector(".drawer-thread");
const drawerDate = drawer.querySelector(".drawer-date");
const drawerSize = drawer.querySelector(".drawer-size");
const drawerFileSize = drawer.querySelector(".drawer-file-size");
const drawerPrompt = drawer.querySelector(".drawer-prompt");
const promptCopyButton = drawer.querySelector(".prompt-copy-button");
const promptCopyIcon = promptCopyButton.querySelector(".copy-icon");
const promptCheckIcon = promptCopyButton.querySelector(".check-icon");
const sourceAction = drawer.querySelector(".source-action");
const sourceTooltip = drawer.querySelector(".source-tooltip");
const sourceButton = drawer.querySelector(".source-button");
const saveButton = drawer.querySelector(".save-button");
const statusAnnouncer = document.querySelector(".status-announcer");
const root = document.documentElement;
const editor = document.querySelector(".image-editor");
const editorControls = editor.querySelector(".image-editor-controls");
const editorStage = editor.querySelector(".image-editor-stage");
const editActions = editor.querySelector("[data-edit-actions]");
const editModeRoot = editor.querySelector("[data-edit-mode]");
const resizeMenu = editor.querySelector("[data-resize-menu]");
const zoomMenu = editor.querySelector("[data-zoom-menu]");
const zoomTrigger = editor.querySelector("[data-zoom-trigger]");
const zoomTriggerValue = zoomTrigger.querySelector("[data-zoom-value]");
const editMask = editor.querySelector(".image-edit-mask");
const commentLayer = editor.querySelector(".image-comment-layer");
const commentPopover = editor.querySelector(".image-comment-popover");
const brushSlider = editor.querySelector(".image-brush-slider input");

const PAGE_SIZE = 36;
const DENSITY_STORAGE_KEY = "codex-image-host:grid-density";

// Project uses Codex's folder icon. All images and Chat use official Lucide icons.
const SOURCE_ICON_MARKUP = {
  all: [
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>',
    '<circle cx="9" cy="9" r="2"></circle>',
    '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>',
  ].join(""),
  project: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.75488 2.1416C5.30942 2.14164 5.74594 2.23705 6.11816 2.38965C6.48323 2.53934 6.76728 2.73817 7.00391 2.9043L7.02148 2.91699C7.47057 3.23238 7.8162 3.47463 8.55176 3.47461H11.333C12.7194 3.47484 13.8311 4.61217 13.8311 6L13.875 6.38281H13.8594C14.8729 6.38292 15.5982 7.3629 15.3018 8.33203L14.0068 12.5586C13.7703 13.3297 13.0576 13.8563 12.251 13.8564H3.83984C3.4199 13.8564 3.04144 13.7174 2.73828 13.4883L2.67383 13.4346C1.99907 12.9811 1.55577 12.2065 1.55566 11.3311L0.941406 4.66699C0.941406 3.2792 2.05315 2.1419 3.43945 2.1416H4.75488ZM4.7627 7.42969C4.56039 7.42972 4.3807 7.5625 4.32129 7.75586L3.08594 11.7891C2.96123 12.1965 3.18214 12.6072 3.54883 12.7529C3.63476 12.7768 3.74102 12.7958 3.88184 12.8086H12.251C12.5974 12.8085 12.9033 12.5821 13.0049 12.251L14.2998 8.02539C14.3901 7.72947 14.1688 7.42979 13.8594 7.42969H4.7627ZM3.43945 3.19141C2.64724 3.1917 1.99121 3.84481 1.99121 4.66699L2.49316 10.1201L3.32031 7.44922C3.51452 6.81571 4.10008 6.38284 4.7627 6.38281H12.8252L12.7812 6C12.7812 5.22902 12.2045 4.607 11.4795 4.53223L11.333 4.52441H8.55176C8.05756 4.52442 7.64464 4.44062 7.2666 4.2793C6.91453 4.12896 6.6274 3.92345 6.41797 3.77637L6.40039 3.76367C6.16212 3.59639 5.96404 3.46151 5.71973 3.36133C5.54113 3.28812 5.32754 3.2289 5.05176 3.2041L4.75488 3.19141H3.43945Z" fill="currentColor"></path>',
  chat: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path>',
  work: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path>',
};

let facets = { total: 0, chats: 0, works: 0, projects: [] };
let selectedScope = "all";
let groupByThread = false;
let viewContext = "browse";
let activeThreadGroup = null;
let savedBrowseState = null;
let items = [];
let totalItems = 0;
let filteredImageCount = 0;
let pageRequest = null;
let loadGeneration = 0;
let activeImage = null;
let detailRequest = 0;
let masonryTimer = null;
let pendingScrollTop = null;
let appliedHostTokens = new Set();
let densityColumns = null;
let copyFeedbackTimer = null;
let updateCheckTimer = null;
let hostSurfaceActive = true;
let documentVisible = document.visibilityState !== "hidden";
let windowFocused = typeof document.hasFocus !== "function" || document.hasFocus();
let shellIntersecting = true;
let drawerOrigin = null;
let drawerOriginImageId = null;
let drawerOriginThreadId = null;
let groupOrigin = null;
let groupOriginImageId = null;
let groupOriginThreadId = null;
let editMode = null;
let editComments = [];
let editStrokes = [];
let editUndo = [];
let editRedo = [];
let editDrawing = false;
let zoomScale = null;

try {
  const storedDensity = Number.parseInt(localStorage.getItem(DENSITY_STORAGE_KEY) ?? "", 10);
  if (storedDensity >= 2 && storedDensity <= 6) {
    densityColumns = storedDensity;
  }
} catch {
  // Storage may be unavailable in a hardened webview; the current selection still works.
}

function applyHostTheme(payload) {
  if (!payload || !new Set(["light", "dark"]).has(payload.theme)) return;
  if (setLocale(payload.locale ?? navigator.language)) {
    translateDocument(document);
    renderSourceMenu();
    render();
    if (activeImage) showImageDetails(activeImage);
    if (editMode) renderEditMode();
  }
  root.dataset.host = "codex";
  root.dataset.theme = payload.theme;
  root.style.colorScheme = payload.theme;
  for (const name of appliedHostTokens) root.style.removeProperty(name);
  appliedHostTokens = new Set();
  for (const [name, value] of Object.entries(payload.tokens ?? {})) {
    if (!name.startsWith("--") || typeof value !== "string") continue;
    root.style.setProperty(name, value);
    appliedHostTokens.add(name);
  }
  const editorTokens = [
    "--color-surface-tertiary", "--color-surface-elevated-secondary",
    "--color-border-subtle", "--color-background-primary-ghost-hover",
    "--color-chart-blue", "--color-text-inverse",
    "--color-token-main-surface-primary", "--color-token-input-foreground",
    "--color-text-foreground", "--color-text-foreground-tertiary", "--color-text-on-accent",
    "--color-border", "--color-border-focus", "--color-token-list-hover-background",
    "--color-text-accent", "--font-sans-default", "--font-weight-normal", "--text-sm", "--text-sm--line-height",
    "--radius-md", "--radius-xl", "--shadow-md", "--shadow-xl",
  ];
  editorControls.hidden = !editorTokens.every((name) => appliedHostTokens.has(name));
}

function announce(message) {
  if (!statusAnnouncer) return;
  statusAnnouncer.textContent = "";
  requestAnimationFrame(() => {
    statusAnnouncer.textContent = message;
  });
}

function applySidebarState(payload) {
  const available = Boolean(payload?.available);
  const open = Boolean(payload?.open);
  const label = typeof payload?.label === "string" && payload.label.trim()
    ? payload.label.trim()
    : t("Show sidebar");
  const visible = available && !open;
  const leading = Number(payload?.leading);
  sidebarOpenButton.hidden = !visible;
  sidebarOpenButton.setAttribute("aria-label", label);
  sidebarOpenButton.title = label;
  libraryHeader.style.paddingLeft = visible && Number.isFinite(leading)
    ? `${Math.max(8, leading)}px`
    : "";
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type === "codex-personal:theme") applyHostTheme(event.data);
  if (event.data?.type === "codex-personal:sidebar-state") applySidebarState(event.data);
  if (["codex-personal:surface-active", "codex-personal:surface-visibility"].includes(event.data?.type)) {
    setHostSurfaceActive(event.data.active ?? event.data.visible);
  }
});

if (window.parent !== window) {
  window.parent.postMessage({ type: "codex-personal:ready" }, "*");
}

const dateFormatter = { format: (value) => new Intl.DateTimeFormat(getLocale(), {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(value) };

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return t("Original file");
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createSourceIcon(kind) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "source-icon");
  icon.setAttribute("viewBox", kind === "project" ? "0 0 16 16" : "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  if (kind !== "project") {
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.5");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
  }
  icon.innerHTML = SOURCE_ICON_MARKUP[kind];
  return icon;
}

function sourcePresentation(image) {
  if (image.sourceKind === "project") {
    return { kind: "project", label: image.projectName || t("Project") };
  }
  if (image.sourceKind === "work") {
    return { kind: "work", label: image.threadTitle || t("Work") };
  }
  return { kind: "chat", label: image.threadTitle || t("Untitled chat") };
}

function createSourceValue(kind, label, className = "") {
  const value = document.createElement("span");
  value.className = ["source-value", className].filter(Boolean).join(" ");
  const text = document.createElement("span");
  text.textContent = label;
  value.append(createSourceIcon(kind), text);
  return value;
}

function selectedFacet() {
  if (selectedScope === "all") return { label: t("All images"), count: facets.total, kind: "all" };
  if (selectedScope === "chat") return { label: t("Chats"), count: facets.chats, kind: "chat" };
  if (selectedScope === "work") return { label: t("Work"), count: facets.works, kind: "work" };
  const project = facets.projects.find((item) => item.scope === selectedScope);
  return project
    ? { label: project.name, count: project.count, kind: "project" }
    : { label: t("All images"), count: facets.total, kind: "all" };
}

function updateFilterTrigger() {
  const selected = selectedFacet();
  filterSourceIcon.replaceChildren(createSourceIcon(selected.kind));
  filterLabel.textContent = selected.label;
  filterCount.textContent = String(selected.count);
  filterButton.title = t("{source} · {count} images", { source: selected.label, count: selected.count });
}

function createSourceOption({ scope, label, count, kind }) {
  const option = document.createElement("button");
  option.className = "source-option";
  option.type = "button";
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", String(scope === selectedScope));
  option.tabIndex = scope === selectedScope ? 0 : -1;
  option.dataset.scope = scope;

  const icon = document.createElement("span");
  icon.className = "source-option-icon";
  icon.append(createSourceIcon(kind));
  const optionLabel = document.createElement("span");
  optionLabel.className = "source-option-label";
  optionLabel.textContent = label;
  const optionCount = document.createElement("span");
  optionCount.className = "source-option-count";
  optionCount.textContent = String(count);
  option.append(icon, optionLabel, optionCount);
  option.addEventListener("click", () => selectSource(scope));
  return option;
}

function renderSourceMenu() {
  const all = createSourceOption({ scope: "all", label: t("All images"), count: facets.total, kind: "all" });
  const chats = createSourceOption({ scope: "chat", label: t("Chats"), count: facets.chats, kind: "chat" });
  const work = createSourceOption({ scope: "work", label: t("Work"), count: facets.works, kind: "work" });
  const divider = document.createElement("div");
  divider.className = "source-menu-divider";
  divider.setAttribute("role", "separator");
  const projects = facets.projects.map((project) => createSourceOption({
    scope: project.scope,
    label: project.name,
    count: project.count,
    kind: "project",
  }));
  sourceMenu.replaceChildren(all, chats, work, ...(projects.length ? [divider, ...projects] : []));
  updateFilterTrigger();
}

function sourceOptions() {
  return [...sourceMenu.querySelectorAll('[role="option"]')];
}

function setSourceOptionFocus(index, { focus = true } = {}) {
  const options = sourceOptions();
  if (!options.length) return;
  const activeIndex = Math.max(0, Math.min(index, options.length - 1));
  options.forEach((option, optionIndex) => {
    option.tabIndex = optionIndex === activeIndex ? 0 : -1;
    option.setAttribute("aria-selected", String(option.dataset.scope === selectedScope));
  });
  if (focus) options[activeIndex].focus();
}

function moveSourceOption(delta) {
  const options = sourceOptions();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  setSourceOptionFocus((currentIndex + delta + options.length) % options.length);
}

function openSourceMenu({ focusIndex = null } = {}) {
  sourceMenu.hidden = false;
  filterButton.setAttribute("aria-expanded", "true");
  const options = sourceOptions();
  const selectedIndex = options.findIndex((option) => option.dataset.scope === selectedScope);
  setSourceOptionFocus(focusIndex ?? (selectedIndex < 0 ? 0 : selectedIndex));
}

async function loadFacets() {
  const response = await fetch("/api/image-facets");
  if (!response.ok) throw new Error(t("Could not load image sources"));
  facets = await response.json();
  if (
    selectedScope !== "all"
    && selectedScope !== "chat"
    && selectedScope !== "work"
    && !facets.projects.some((project) => project.scope === selectedScope)
  ) {
    selectedScope = "all";
  }
  renderSourceMenu();
}

function recommendedColumnsForWidth(width) {
  if (width < 920) return 2;
  if (width < 1900) return 3;
  if (width < 2500) return 4;
  if (width < 3150) return 5;
  return 6;
}

function applyDensity() {
  if (densityColumns === null) {
    densityColumns = recommendedColumnsForWidth(scrollArea.clientWidth || window.innerWidth);
  }
  grid.style.setProperty("--grid-columns", String(densityColumns));
  densitySlider.value = String(densityColumns);
  densityButtonValue.textContent = String(densityColumns);
  densitySlider.setAttribute("aria-valuetext", `${densityColumns} columns`);
  scheduleMasonry();
}

function closeSourceMenu({ restoreFocus = false } = {}) {
  sourceMenu.hidden = true;
  filterButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) filterButton.focus();
}

function closeToolbarPopups(options = {}) {
  closeSourceMenu(options);
}

function layoutMasonry() {
  masonryTimer = null;
  const styles = getComputedStyle(grid);
  const rowHeight = Number.parseFloat(styles.gridAutoRows);
  if (!rowHeight) return;
  const cards = [...grid.children];
  if (!cards.length) return;

  // Existing spans do not affect the intrinsic card boxes because the grid
  // aligns items to the start. Clearing them here would collapse the 1px row
  // grid and clamp the user's scroll position before the new spans are applied.
  const blockGap = Number.parseFloat(getComputedStyle(cards[0]).marginBottom);
  const spans = cards.map((card) => (
    Math.ceil((card.getBoundingClientRect().height + blockGap) / rowHeight)
  ));
  cards.forEach((card, index) => {
    card.style.gridRowEnd = `span ${spans[index]}`;
  });
  if (pendingScrollTop !== null) {
    scrollArea.scrollTop = pendingScrollTop;
    pendingScrollTop = null;
  }
}

function scheduleMasonry() {
  if (masonryTimer !== null) return;
  masonryTimer = requestAnimationFrame(layoutMasonry);
}

function createCard(image) {
  const button = document.createElement("button");
  button.className = "image-card";
  button.type = "button";
  button.dataset.imageId = image.id;
  const createdAt = dateFormatter.format(new Date(image.createdAt));
  const source = sourcePresentation(image);
  button.setAttribute("aria-label", t("Open image from {source}, created {date}", { source: source.label, date: createdAt }));

  const preview = document.createElement("img");
  preview.src = image.fileUrl;
  preview.alt = image.prompt || t("Generated image");
  preview.loading = "lazy";
  preview.decoding = "async";
  if (image.width && image.height) {
    preview.width = image.width;
    preview.height = image.height;
  }
  preview.addEventListener("load", scheduleMasonry, { once: true });

  const caption = document.createElement("span");
  caption.className = "card-caption";
  const sourceValue = createSourceValue(source.kind, source.label, "card-source");
  const time = document.createElement("span");
  time.className = "card-time";
  time.textContent = createdAt;
  caption.append(sourceValue, time);

  button.append(preview, caption);
  button.addEventListener("click", () => openImage(image, button));
  return button;
}

function createThreadBoard(group) {
  const button = document.createElement("button");
  button.className = "thread-board";
  button.type = "button";
  button.dataset.threadId = group.threadId;
  const sourceLabel = group.sourceKind === "project"
    ? (group.projectName || t("Project"))
    : group.sourceKind === "work" ? t("Work") : t("Chat");
  const threadTitle = group.threadTitle || (
    group.sourceKind === "project" ? t("Untitled task") : group.sourceKind === "work" ? t("Untitled work") : t("Untitled chat")
  );
  button.setAttribute("aria-label", t("Open {title}, {count} images", { title: threadTitle, count: group.imageCount }));

  const preview = document.createElement("span");
  preview.className = "thread-board-preview";
  preview.classList.toggle("is-single", group.previews.length === 1);
  for (const image of group.previews) {
    const thumbnail = document.createElement("img");
    thumbnail.src = image.fileUrl;
    thumbnail.alt = "";
    thumbnail.loading = "lazy";
    thumbnail.decoding = "async";
    if (image.width && image.height) {
      thumbnail.width = image.width;
      thumbnail.height = image.height;
    }
    thumbnail.addEventListener("load", scheduleMasonry, { once: true });
    preview.append(thumbnail);
  }
  const hiddenCount = group.imageCount - group.previews.length;
  if (hiddenCount > 0) {
    const overflow = document.createElement("span");
    overflow.className = "thread-board-overflow";
    overflow.textContent = `+${hiddenCount}`;
    preview.append(overflow);
  }

  const caption = document.createElement("span");
  caption.className = "thread-board-caption";
  caption.append(createSourceValue(
    group.sourceKind === "project" ? "project" : group.sourceKind === "work" ? "work" : "chat",
    sourceLabel,
    "card-source",
  ));
  const title = document.createElement("span");
  title.className = "thread-board-title";
  title.textContent = threadTitle;
  const meta = document.createElement("span");
  meta.className = "thread-board-meta";
  const imageCount = document.createElement("span");
  imageCount.textContent = t(group.imageCount === 1 ? "{count} image" : "{count} images", { count: group.imageCount });
  const updatedAt = document.createElement("span");
  updatedAt.textContent = dateFormatter.format(new Date(group.updatedAt));
  meta.append(imageCount, updatedAt);
  caption.append(title, meta);

  button.append(preview, caption);
  button.addEventListener("click", () => openThreadGroup(group, button));
  return button;
}

function updateEmptyState() {
  empty.hidden = totalItems !== 0;
  if (viewContext === "thread") {
    emptyTitle.textContent = t("No images in this Thread");
    emptyDescription.textContent = t("Return to the library and choose another Thread.");
    return;
  }
  const selected = selectedFacet();
  if (selectedScope === "all") {
    emptyTitle.textContent = t("No images yet");
    emptyDescription.textContent = t("Generate an image in any Task and it will appear here automatically.");
  } else {
    emptyTitle.textContent = t("No images in {source}", { source: selected.label });
    emptyDescription.textContent = t("Choose another source or generate a new image in this Task.");
  }
}

function updateLibrarySummary() {
  updateFilterTrigger();
  updateEmptyState();
  pageSentinel.hidden = items.length >= totalItems;
}

function render() {
  const factory = viewContext === "browse" && groupByThread ? createThreadBoard : createCard;
  grid.replaceChildren(...items.map(factory));
  grid.classList.toggle("is-grouped", viewContext === "browse" && groupByThread);
  updateLibrarySummary();
  if (activeImage) {
    grid.querySelector(`[data-image-id="${activeImage.id}"]`)?.classList.add("is-selected");
  }
  scheduleMasonry();
}

function pageUrl({ offset, limit = PAGE_SIZE } = {}) {
  const parameters = new URLSearchParams({ limit: String(limit), offset: String(offset ?? 0) });
  if (viewContext === "thread") {
    parameters.set("threadId", activeThreadGroup.threadId);
    parameters.set("sort", "asc");
    return `/api/images?${parameters}`;
  }
  parameters.set("source", selectedScope);
  return groupByThread
    ? `/api/image-groups?${parameters}`
    : `/api/images?${parameters}`;
}

async function loadPage({ reset = false, preserveScroll = false } = {}) {
  if (pageRequest && !reset) return pageRequest;
  const generation = reset ? ++loadGeneration : loadGeneration;
  const offset = reset ? 0 : items.length;
  const preservedScrollTop = reset && preserveScroll ? scrollArea.scrollTop : null;
  const request = (async () => {
    const response = await fetch(pageUrl({ offset }));
    if (!response.ok) throw new Error(t("Could not load images"));
    const payload = await response.json();
    if (generation !== loadGeneration) return;

    const nextItems = groupByThread && viewContext === "browse" ? payload.groups : payload.images;
    totalItems = payload.count;
    filteredImageCount = payload.imageCount ?? payload.count;

    if (reset) {
      items = nextItems;
      if (preservedScrollTop === null) scrollArea.scrollTop = 0;
      else pendingScrollTop = preservedScrollTop;
      render();
      return;
    }

    const key = groupByThread && viewContext === "browse" ? "threadId" : "id";
    const existingIds = new Set(items.map((item) => item[key]));
    const uniqueItems = nextItems.filter((item) => !existingIds.has(item[key]));
    items.push(...uniqueItems);
    const factory = groupByThread && viewContext === "browse" ? createThreadBoard : createCard;
    grid.append(...uniqueItems.map(factory));
    updateLibrarySummary();
    scheduleMasonry();
  })();
  pageRequest = request;

  try {
    await request;
  } finally {
    if (pageRequest === request) pageRequest = null;
  }
}

async function selectSource(scope) {
  closeSourceMenu({ restoreFocus: true });
  if (scope === selectedScope) return;
  if (shell.classList.contains("drawer-open")) closeDrawer();
  selectedScope = scope;
  renderSourceMenu();
  await loadPage({ reset: true });
}

async function toggleThreadGrouping() {
  if (viewContext !== "browse") return;
  closeToolbarPopups();
  if (shell.classList.contains("drawer-open")) closeDrawer();
  groupByThread = !groupByThread;
  groupButton.setAttribute("aria-pressed", String(groupByThread));
  await loadPage({ reset: true });
}

async function checkForUpdates() {
  if (!canPollForUpdates()) return;
  const response = await fetch(pageUrl({ offset: 0, limit: 1 }));
  if (!response.ok) throw new Error(t("Could not check for new images"));
  const payload = await response.json();
  const nextItems = groupByThread ? payload.groups : payload.images;
  const nextFirst = nextItems[0];
  const currentFirst = items[0];
  const changed = groupByThread
    ? payload.count !== totalItems
      || payload.imageCount !== filteredImageCount
      || nextFirst?.threadId !== currentFirst?.threadId
      || nextFirst?.updatedAt !== currentFirst?.updatedAt
    : payload.count !== totalItems || nextFirst?.id !== currentFirst?.id;
  if (changed) {
    await Promise.all([loadFacets(), loadPage({ reset: true, preserveScroll: true })]);
  }
}

function canPollForUpdates() {
  return hostSurfaceActive
    && documentVisible
    && windowFocused
    && shellIntersecting
    && viewContext === "browse"
    && !shell.classList.contains("drawer-open");
}

function refreshUpdatePolling({ immediate = false } = {}) {
  clearUpdateCheckTimer();
  if (canPollForUpdates()) scheduleUpdateCheck(immediate ? 0 : 3000);
}

function clearUpdateCheckTimer() {
  if (updateCheckTimer === null) return;
  clearTimeout(updateCheckTimer);
  updateCheckTimer = null;
}

function scheduleUpdateCheck(delay = 3000) {
  clearUpdateCheckTimer();
  if (!canPollForUpdates()) return;
  updateCheckTimer = setTimeout(async () => {
    updateCheckTimer = null;
    if (!canPollForUpdates()) return;
    try {
      await checkForUpdates();
    } catch (error) {
      console.error(error);
    } finally {
      scheduleUpdateCheck();
    }
  }, delay);
}

function setHostSurfaceActive(active) {
  const changed = hostSurfaceActive !== Boolean(active);
  hostSurfaceActive = Boolean(active);
  if (!hostSurfaceActive && editMode === "comment" && !commentPopover.hidden) {
    cancelActiveCommentEditor();
  }
  refreshUpdatePolling({ immediate: changed && hostSurfaceActive });
}

function setDocumentVisible(visible) {
  const changed = documentVisible !== Boolean(visible);
  documentVisible = Boolean(visible);
  refreshUpdatePolling({ immediate: changed && documentVisible });
}

function setWindowFocused(focused) {
  const changed = windowFocused !== Boolean(focused);
  windowFocused = Boolean(focused);
  refreshUpdatePolling({ immediate: changed && windowFocused });
}

function setShellIntersecting(intersecting) {
  const changed = shellIntersecting !== Boolean(intersecting);
  shellIntersecting = Boolean(intersecting);
  refreshUpdatePolling({ immediate: changed && shellIntersecting });
}

function resetCopyFeedback() {
  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
  promptCopyIcon.removeAttribute("hidden");
  promptCheckIcon.setAttribute("hidden", "");
  promptCopyButton.classList.remove("is-copied");
  promptCopyButton.setAttribute("aria-label", t("Copy generation prompt"));
  promptCopyButton.title = t("Copy prompt");
}

function updateSourceAction(image) {
  const archived = Boolean(image.archived);
  const unavailable = archived || !image.sourceUrl;
  sourceButton.disabled = unavailable;
  sourceAction.classList.toggle("is-disabled", unavailable);
  sourceTooltip.hidden = !unavailable;
  if (unavailable) {
    sourceButton.setAttribute("aria-describedby", sourceTooltip.id);
    sourceTooltip.textContent = archived
      ? t("This Thread has been archived and can’t be opened.")
      : t("This ChatGPT conversation cannot be opened from Images.");
    sourceButton.setAttribute("aria-label", archived
      ? t("Open Thread unavailable: this Thread has been archived")
      : t("Open conversation unavailable"));
  } else {
    sourceButton.removeAttribute("aria-describedby");
    sourceButton.removeAttribute("aria-label");
  }
}

async function copyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (copied) return true;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function rememberGroupOrigin(element) {
  const origin = element?.closest?.(".image-card, .thread-board") ?? element;
  if (!origin) return;
  groupOrigin = origin;
  groupOriginImageId = origin.dataset.imageId ?? null;
  groupOriginThreadId = origin.dataset.threadId ?? null;
}

function rememberDrawerOrigin(element) {
  if (viewContext === "thread" && groupOrigin) return;
  const origin = element?.closest?.(".image-card, .thread-board") ?? element;
  if (!origin) return;
  drawerOrigin = origin;
  drawerOriginImageId = origin.dataset.imageId ?? null;
  drawerOriginThreadId = origin.dataset.threadId ?? null;
}

function clearGroupOrigin() {
  groupOrigin = null;
  groupOriginImageId = null;
  groupOriginThreadId = null;
}

function clearDrawerOrigin() {
  drawerOrigin = null;
  drawerOriginImageId = null;
  drawerOriginThreadId = null;
}

function restoreDrawerFocus() {
  const origin = groupOrigin ?? drawerOrigin;
  const originImageId = groupOrigin ? groupOriginImageId : drawerOriginImageId;
  const originThreadId = groupOrigin ? groupOriginThreadId : drawerOriginThreadId;
  if (origin?.isConnected) {
    origin.focus({ preventScroll: true });
    clearGroupOrigin();
    clearDrawerOrigin();
    return;
  }
  const fallback = originImageId
    ? grid.querySelector(`[data-image-id="${originImageId}"]`)
    : originThreadId
      ? grid.querySelector(`[data-thread-id="${originThreadId}"]`)
      : null;
  clearGroupOrigin();
  clearDrawerOrigin();
  fallback?.focus({ preventScroll: true });
}

function detailContextFocusableElements() {
  const visible = (element) => !element.hidden && element.getClientRects().length;
  const imageSelectors = [...grid.querySelectorAll("button.image-card, button.thread-board")].filter(visible);
  const detailControls = [...drawer.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(visible);
  return [...imageSelectors, ...detailControls];
}

function trapDetailContextFocus(event) {
  if (!sourceMenu.hidden || !shell.classList.contains("drawer-open") || event.key !== "Tab") return;
  const focusable = detailContextFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    drawer.focus();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement);
  const baseIndex = currentIndex < 0 ? (event.shiftKey ? 0 : -1) : currentIndex;
  const nextIndex = event.shiftKey
    ? (baseIndex - 1 + focusable.length) % focusable.length
    : (baseIndex + 1) % focusable.length;
  event.preventDefault();
  focusable[nextIndex].focus();
}

function showImageDetails(image) {
  if (activeImage?.id !== image.id) resetImageEditor();
  activeImage = image;
  const isProject = image.sourceKind === "project";
  const isWork = image.sourceKind === "work";
  drawerProjectRow.hidden = !isProject;
  if (isProject) drawerProject.textContent = image.projectName || t("Project");
  drawerTaskLabel.textContent = isProject ? t("Thread") : isWork ? t("Work") : t("Chat");
  drawerThread.textContent = image.threadTitle || (isProject ? t("Untitled task") : isWork ? t("Untitled work") : t("Untitled chat"));
  drawerImage.src = image.fileUrl;
  drawerImage.alt = image.prompt || t("Generated image");
  if (image.width && image.height) {
    drawerImage.width = image.width;
    drawerImage.height = image.height;
  } else {
    drawerImage.removeAttribute("width");
    drawerImage.removeAttribute("height");
  }
  drawerDate.textContent = dateFormatter.format(new Date(image.createdAt));
  drawerSize.textContent = image.width && image.height ? `${image.width} × ${image.height}` : t("Original");
  drawerFileSize.textContent = formatBytes(image.byteLength);
  drawerPrompt.textContent = image.prompt || t("Prompt is not available for this image.");
  drawerPrompt.classList.toggle("is-missing", !image.prompt);
  promptCopyButton.disabled = !image.prompt;
  updateSourceAction(image);
  resetCopyFeedback();
}

async function openImage(image, originatingElement = null) {
  if (originatingElement) rememberDrawerOrigin(originatingElement);
  const request = ++detailRequest;
  showImageDetails(image);
  drawerPrompt.textContent = t("Loading generation prompt…");
  drawerPrompt.classList.add("is-loading");
  drawerPrompt.classList.remove("is-missing");
  promptCopyButton.disabled = true;
  shell.classList.add("drawer-open");
  scheduleMasonry();
  drawer.setAttribute("aria-hidden", "false");
  drawer.inert = false;
  drawer.querySelector(".drawer-close")?.focus({ preventScroll: true });
  grid.querySelectorAll(".is-selected").forEach((card) => card.classList.remove("is-selected"));
  grid.querySelector(`[data-image-id="${image.id}"]`)?.classList.add("is-selected");

  try {
    const response = await fetch(`/api/images/${image.id}`);
    if (!response.ok) throw new Error(t("Could not load image details"));
    const payload = await response.json();
    if (request !== detailRequest) return;
    showImageDetails(payload.image);
  } catch (error) {
    if (request !== detailRequest) return;
    drawerPrompt.textContent = t("Prompt could not be loaded.");
    drawerPrompt.classList.add("is-missing");
    announce(t("Prompt could not be loaded."));
    console.error(error);
  } finally {
    if (request === detailRequest) drawerPrompt.classList.remove("is-loading");
  }
}

async function openThreadGroup(group, originatingElement = null) {
  clearGroupOrigin();
  if (originatingElement) rememberGroupOrigin(originatingElement);
  savedBrowseState = {
    items: items.slice(),
    totalItems,
    filteredImageCount,
    scrollTop: scrollArea.scrollTop,
    nodes: [...grid.children],
  };
  viewContext = "thread";
  activeThreadGroup = group;
  activeImage = null;
  shell.classList.add("thread-context");
  try {
    await loadPage({ reset: true });
    if (items[0]) await openImage(items[0]);
  } catch (error) {
    console.error(error);
    leaveThreadGroup();
  }
}

function leaveThreadGroup() {
  if (viewContext !== "thread") return;
  detailRequest += 1;
  const restore = savedBrowseState;
  viewContext = "browse";
  activeThreadGroup = null;
  savedBrowseState = null;
  activeImage = null;
  shell.classList.remove("drawer-open", "thread-context");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  resetCopyFeedback();
  if (restore) {
    items = restore.items;
    totalItems = restore.totalItems;
    filteredImageCount = restore.filteredImageCount;
    pendingScrollTop = restore.scrollTop;
    grid.replaceChildren(...restore.nodes);
    grid.classList.toggle("is-grouped", groupByThread);
    updateLibrarySummary();
    scheduleMasonry();
    scheduleUpdateCheck(0);
  } else {
    loadPage({ reset: true }).catch(console.error);
  }
  restoreDrawerFocus();
}

function closeDrawer() {
  if (viewContext === "thread") {
    leaveThreadGroup();
    return;
  }
  detailRequest += 1;
  activeImage = null;
  shell.classList.remove("drawer-open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  resetCopyFeedback();
  grid.querySelectorAll(".is-selected").forEach((card) => card.classList.remove("is-selected"));
  scheduleMasonry();
  scheduleUpdateCheck(0);
  restoreDrawerFocus();
}

function openSourceThread(threadId) {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "codex-personal:open-thread", threadId }, "*");
  } else {
    window.location.href = `codex://threads/${threadId}`;
  }
}

filterButton.addEventListener("click", () => {
  if (sourceMenu.hidden) openSourceMenu();
  else closeSourceMenu({ restoreFocus: true });
});

filterButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (sourceMenu.hidden) openSourceMenu();
    else moveSourceOption(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (sourceMenu.hidden) openSourceMenu();
    else moveSourceOption(-1);
  } else if (event.key === "Home") {
    event.preventDefault();
    if (sourceMenu.hidden) openSourceMenu({ focusIndex: 0 });
    else setSourceOptionFocus(0);
  } else if (event.key === "End") {
    event.preventDefault();
    if (sourceMenu.hidden) openSourceMenu({ focusIndex: sourceOptions().length - 1 });
    else setSourceOptionFocus(sourceOptions().length - 1);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (sourceMenu.hidden) openSourceMenu();
  } else if (event.key === "Escape" && !sourceMenu.hidden) {
    event.preventDefault();
    closeSourceMenu({ restoreFocus: true });
  }
});

sourceMenu.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    setTimeout(() => closeSourceMenu(), 0);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSourceOption(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSourceOption(-1);
  } else if (event.key === "Home") {
    event.preventDefault();
    setSourceOptionFocus(0);
  } else if (event.key === "End") {
    event.preventDefault();
    setSourceOptionFocus(sourceOptions().length - 1);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    document.activeElement?.closest?.('[role="option"]')?.click();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeSourceMenu({ restoreFocus: true });
  }
});

densitySlider.addEventListener("input", () => {
  densityColumns = Number.parseInt(densitySlider.value, 10);
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, String(densityColumns));
  } catch {
    // The selected density still applies for the current window.
  }
  applyDensity();
});

groupButton.addEventListener("click", () => toggleThreadGrouping().catch(console.error));
sidebarOpenButton.addEventListener("click", async () => {
  sidebarOpenButton.disabled = true;
  try {
    await requestHostAction("open-sidebar", {});
    applySidebarState({ available: true, open: true, label: sidebarOpenButton.title });
  } catch (error) {
    announce(error.message);
  } finally {
    sidebarOpenButton.disabled = false;
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".source-filter")) closeToolbarPopups();
});

rescan.addEventListener("click", async () => {
  rescan.disabled = true;
  rescan.classList.add("is-loading");
  rescan.setAttribute("aria-busy", "true");
  try {
    await Promise.all([
      (async () => {
        const response = await fetch("/api/rescan", { method: "POST" });
        if (!response.ok) throw new Error(t("Could not refresh images"));
        const result = await response.json();
        announce(result.inProgress ? t("Image refresh is already in progress.") : t("Images refreshed."));
        await loadFacets();
        if (shell.classList.contains("drawer-open") && activeImage) {
          const detailResponse = await fetch(`/api/images/${activeImage.id}`);
          if (detailResponse.ok) {
            const payload = await detailResponse.json();
            activeImage = payload.image;
            updateSourceAction(activeImage);
          }
        } else if (viewContext === "browse") {
          await loadPage({ reset: true, preserveScroll: true });
        }
      })(),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  } catch (error) {
    announce(error.message);
    console.error(error);
  } finally {
    rescan.disabled = false;
    rescan.classList.remove("is-loading");
    rescan.removeAttribute("aria-busy");
  }
});

drawer.querySelector(".drawer-close").addEventListener("click", closeDrawer);
sourceButton.addEventListener("click", () => {
  if (activeImage && !activeImage.archived && activeImage.sourceUrl) openSourceThread(activeImage.threadId);
});

promptCopyButton.addEventListener("click", async () => {
  const prompt = activeImage?.prompt;
  if (!prompt) return;
  if (!(await copyText(prompt))) {
    announce(t("Prompt could not be copied."));
    return;
  }
  resetCopyFeedback();
  promptCopyIcon.setAttribute("hidden", "");
  promptCheckIcon.removeAttribute("hidden");
  promptCopyButton.classList.add("is-copied");
  promptCopyButton.setAttribute("aria-label", t("Prompt copied"));
  promptCopyButton.title = t("Copied");
  announce(t("Prompt copied."));
  copyFeedbackTimer = setTimeout(resetCopyFeedback, 2000);
});

saveButton.addEventListener("click", async () => {
  if (!activeImage) return;
  const imageId = activeImage.id;
  saveButton.disabled = true;
  saveButton.textContent = t("Saving…");
  try {
    const response = await fetch(`/api/images/${imageId}/save-as?locale=${getLocale()}`, { method: "POST" });
    if (!response.ok) throw new Error(t("Could not save image"));
    const result = await response.json();
    if (result.saved) {
      saveButton.textContent = t("Saved");
      announce(t("Image saved."));
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } catch (error) {
    announce(error.message);
    console.error(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = t("Save as");
  }
});

document.addEventListener("keydown", (event) => {
  if (shell.classList.contains("drawer-open")) {
    trapDetailContextFocus(event);
  }
  if (event.key !== "Escape") return;
  if (!resizeMenu.hidden || !zoomMenu.hidden) {
    event.preventDefault();
    closeEditorMenus();
    return;
  }
  if (editMode === "comment" && !commentPopover.hidden) {
    event.preventDefault();
    cancelActiveCommentEditor();
    return;
  }
  if (!sourceMenu.hidden) {
    event.preventDefault();
    closeSourceMenu({ restoreFocus: true });
  } else if (shell.classList.contains("drawer-open")) {
    event.preventDefault();
    closeDrawer();
  }
});

const RESIZE_OPTIONS = [["Square", "1:1"], ["Portrait", "3:4"], ["Story", "9:16"], ["Landscape", "4:3"], ["Widescreen", "16:9"]];
const ZOOM_OPTIONS = [25, 50, 100, 150, 200];
const RATIO_ICON_PATHS = {
  "1:1": "M16.0015 7.33334C16.0015 6.62231 16.0016 6.12897 15.9702 5.74545C15.9472 5.4635 15.9094 5.27399 15.8579 5.13022L15.8022 5.00034C15.6483 4.69823 15.4139 4.4452 15.1265 4.26889L14.9995 4.19858C14.8415 4.11812 14.63 4.0613 14.2544 4.03061C13.8709 3.99929 13.3774 3.99838 12.6665 3.99838H7.3335C6.62246 3.99838 6.12913 3.99928 5.74561 4.03061C5.3699 4.06131 5.1585 4.11807 5.00049 4.19858C4.65524 4.3745 4.37465 4.65509 4.19873 5.00034C4.11822 5.15834 4.06146 5.36975 4.03076 5.74545C3.99943 6.12897 3.99854 6.62231 3.99854 7.33334V12.6664C3.99854 13.3772 3.99945 13.8708 4.03076 14.2542C4.06145 14.6298 4.11827 14.8414 4.19873 14.9994L4.26904 15.1263C4.44535 15.4137 4.69838 15.6482 5.00049 15.8021L5.13037 15.8578C5.27414 15.9092 5.46365 15.947 5.74561 15.9701C6.12912 16.0014 6.62246 16.0013 7.3335 16.0013H12.6665C13.3774 16.0013 13.8709 16.0014 14.2544 15.9701C14.6298 15.9394 14.8415 15.8825 14.9995 15.8021C15.3448 15.6262 15.6263 15.3446 15.8022 14.9994L15.8579 14.8695C15.9093 14.7257 15.9472 14.536 15.9702 14.2542C16.0015 13.8708 16.0015 13.3772 16.0015 12.6664V7.33334ZM17.3315 12.6664C17.3315 13.3554 17.3322 13.9124 17.2954 14.3626C17.2627 14.7636 17.1977 15.1248 17.0532 15.4613L16.9868 15.6039C16.6834 16.1992 16.1993 16.6833 15.604 16.9867C15.2272 17.1786 14.8208 17.2578 14.3628 17.2953C13.9126 17.332 13.3555 17.3314 12.6665 17.3314H7.3335C6.64441 17.3314 6.08745 17.332 5.63721 17.2953C5.23652 17.2625 4.87587 17.1973 4.53955 17.0531L4.39697 16.9867C3.87586 16.7211 3.43936 16.3174 3.13525 15.8216L3.01318 15.6039C2.82122 15.2271 2.74201 14.8206 2.70459 14.3626C2.66782 13.9124 2.66846 13.3553 2.66846 12.6664V7.33334C2.66846 6.64425 2.6678 6.0873 2.70459 5.63706C2.742 5.17926 2.82138 4.77344 3.01318 4.39682C3.31662 3.80129 3.80144 3.31647 4.39697 3.01303C4.77359 2.82123 5.17942 2.74185 5.63721 2.70444C6.08745 2.66765 6.6444 2.66831 7.3335 2.66831H12.6665C13.3555 2.66831 13.9126 2.66767 14.3628 2.70444C14.8208 2.74186 15.2272 2.82106 15.604 3.01303L15.8218 3.1351C16.3176 3.4392 16.7213 3.8757 16.9868 4.39682L17.0532 4.5394C17.1975 4.87572 17.2627 5.23637 17.2954 5.63706C17.3322 6.0873 17.3315 6.64425 17.3315 7.33334V12.6664Z",
  "3:4": "M15.1687 6.5C15.1687 5.78896 15.1678 5.29563 15.1365 4.91211C15.1134 4.6301 15.0756 4.44066 15.0242 4.29688L14.9685 4.16699C14.8145 3.8648 14.5803 3.61186 14.2927 3.43555L14.1667 3.36524C14.0088 3.28475 13.7971 3.22797 13.4216 3.19727C13.0382 3.16594 12.5446 3.16504 11.8337 3.16504H8.16675C7.45571 3.16504 6.96238 3.16593 6.57886 3.19727C6.20315 3.22797 5.99175 3.28473 5.83374 3.36524C5.4885 3.54116 5.2079 3.82175 5.03198 4.16699C4.95147 4.325 4.89472 4.5364 4.86401 4.91211C4.83268 5.29563 4.83179 5.78896 4.83179 6.5V13.5C4.83179 14.211 4.83268 14.7044 4.86401 15.0879C4.89472 15.4636 4.95147 15.675 5.03198 15.833L5.1023 15.959C5.27861 16.2466 5.53148 16.4807 5.83374 16.6348L5.96362 16.6914C6.10737 16.7428 6.297 16.7797 6.57886 16.8027C6.96238 16.8341 7.45571 16.835 8.16675 16.835H11.8337C12.5446 16.835 13.0382 16.8341 13.4216 16.8027C13.7971 16.772 14.0088 16.7153 14.1667 16.6348L14.2927 16.5645C14.5803 16.3881 14.8145 16.1352 14.9685 15.833L15.0242 15.7031C15.0756 15.5593 15.1134 15.3699 15.1365 15.0879C15.1678 14.7044 15.1687 14.211 15.1687 13.5V6.5ZM16.4988 13.5C16.4988 14.1891 16.4985 14.746 16.4617 15.1963C16.4289 15.5969 16.3647 15.9577 16.2205 16.2939L16.1531 16.4365C15.8875 16.9577 15.484 17.3941 14.988 17.6982L14.7703 17.8203C14.3937 18.0122 13.9878 18.0915 13.53 18.1289C13.0799 18.1657 12.5227 18.165 11.8337 18.165H8.16675C7.47766 18.165 6.9207 18.1657 6.47046 18.1289C6.06981 18.0962 5.70909 18.031 5.3728 17.8867L5.23023 17.8203C4.70919 17.5548 4.2726 17.151 3.96851 16.6553L3.84644 16.4365C3.65463 16.0599 3.57525 15.6541 3.53784 15.1963C3.50106 14.746 3.50171 14.1891 3.50171 13.5V6.5C3.50171 5.81091 3.50106 5.25395 3.53784 4.80371C3.57525 4.34592 3.65463 3.94009 3.84644 3.56348C4.14988 2.96794 4.63469 2.48313 5.23023 2.17969C5.60684 1.98788 6.01267 1.90851 6.47046 1.87109C6.9207 1.83431 7.47766 1.83496 8.16675 1.83496H11.8337C12.5227 1.83496 13.0799 1.83431 13.53 1.87109C13.9878 1.90853 14.3937 1.98783 14.7703 2.17969L14.988 2.30176C15.484 2.60587 15.8875 3.04228 16.1531 3.56348L16.2205 3.70606C16.3647 4.0423 16.4289 4.40313 16.4617 4.80371C16.4985 5.25395 16.4988 5.81091 16.4988 6.5V13.5Z",
  "9:16": "M9.16504 2.33154C8.454 2.33154 7.96067 2.33243 7.57715 2.36377C7.29514 2.38681 7.1057 2.4246 6.96191 2.47607L6.83203 2.53174C6.52984 2.68571 6.2769 2.91997 6.10059 3.20752L6.03027 3.3335C5.94979 3.49146 5.89301 3.70311 5.86231 4.07861C5.83098 4.46207 5.83008 4.95564 5.83008 5.6665V14.3335C5.83008 15.0445 5.83097 15.5379 5.86231 15.9214C5.89301 16.2971 5.94977 16.5085 6.03027 16.6665C6.2062 17.0117 6.48679 17.2923 6.83203 17.4683C6.99004 17.5488 7.20144 17.6055 7.57715 17.6362C7.96067 17.6676 8.454 17.6685 9.16504 17.6685L10.835 17.7056C11.546 17.7056 12.0393 17.7047 12.4229 17.6733C12.7986 17.6426 13.01 17.5859 13.168 17.5054L13.2939 17.4351C13.5816 17.2587 13.8157 17.0059 13.9697 16.7036L14.0264 16.5737C14.0778 16.43 14.1147 16.2404 14.1377 15.9585C14.169 15.575 14.1699 15.0816 14.1699 14.3706V5.70361C14.1699 4.99275 14.169 4.49918 14.1377 4.11572C14.107 3.74022 14.0502 3.52857 13.9697 3.3706L13.8994 3.24463C13.7231 2.95708 13.4702 2.72282 13.168 2.56885L13.0381 2.51318C12.8943 2.46171 12.7049 2.42392 12.4229 2.40088C12.0393 2.36954 11.546 2.36865 10.835 2.36865L9.16504 2.33154ZM10.835 1.03857C11.5241 1.03857 12.081 1.0389 12.5312 1.07568C12.9318 1.10842 13.2927 1.1727 13.6289 1.31689L13.7715 1.38428C14.2927 1.64984 14.7291 2.05339 15.0332 2.54932L15.1553 2.76709C15.3471 3.14369 15.4264 3.54956 15.4639 4.00732C15.5006 4.45749 15.5 5.01467 15.5 5.70361V14.3706C15.5 15.0597 15.5007 15.6167 15.4639 16.0669C15.4311 16.4675 15.3659 16.8283 15.2217 17.1646L15.1553 17.3071C14.8898 17.8282 14.4859 18.2648 13.9902 18.5688L13.7715 18.6909C13.3949 18.8827 12.989 18.9621 12.5312 18.9995C12.081 19.0363 11.5241 19.0356 10.835 19.0356L9.16504 18.9985C8.47595 18.9985 7.91899 18.9992 7.46875 18.9624C7.01096 18.925 6.60513 18.8456 6.22852 18.6538C5.63298 18.3504 5.14817 17.8656 4.84473 17.27C4.65292 16.8934 4.57355 16.4876 4.53613 16.0298C4.49935 15.5795 4.5 15.0226 4.5 14.3335V5.6665C4.5 4.97756 4.49935 4.42038 4.53613 3.97021C4.57356 3.51245 4.65287 3.10658 4.84473 2.72998L4.9668 2.51221C5.2709 2.01628 5.70732 1.61273 6.22852 1.34717L6.37109 1.27979C6.70734 1.13559 7.06817 1.07131 7.46875 1.03857C7.91899 1.00179 8.47595 1.00146 9.16504 1.00146L10.835 1.03857Z",
  "4:3": "M16.835 8.16666C16.835 7.45562 16.8341 6.96229 16.8027 6.57877C16.7797 6.29691 16.7428 6.10728 16.6914 5.96353L16.6348 5.83365C16.4807 5.53139 16.2466 5.27852 15.959 5.1022L15.833 5.03189C15.675 4.95138 15.4636 4.89462 15.0879 4.86392C14.7044 4.83259 14.211 4.8317 13.5 4.8317H6.5C5.78896 4.8317 5.29563 4.83259 4.91211 4.86392C4.5364 4.89462 4.325 4.95138 4.16699 5.03189C3.82175 5.20781 3.54116 5.48841 3.36524 5.83365C3.28473 5.99166 3.22797 6.20306 3.19727 6.57877C3.16593 6.96229 3.16504 7.45562 3.16504 8.16666V11.8336C3.16504 12.5445 3.16594 13.0381 3.19727 13.4215C3.22797 13.797 3.28475 14.0087 3.36524 14.1667L3.43555 14.2926C3.61186 14.5802 3.8648 14.8144 4.16699 14.9684L4.29688 15.0241C4.44066 15.0756 4.6301 15.1133 4.91211 15.1364C5.29563 15.1677 5.78896 15.1686 6.5 15.1686H13.5C14.211 15.1686 14.7044 15.1677 15.0879 15.1364C15.4635 15.1057 15.675 15.0489 15.833 14.9684L15.959 14.8971C16.2464 14.7209 16.4808 14.4687 16.6348 14.1667L16.6914 14.0358C16.7427 13.8922 16.7797 13.7028 16.8027 13.4215C16.8341 13.0381 16.835 12.5445 16.835 11.8336V8.16666ZM18.165 11.8336C18.165 12.5226 18.1657 13.0798 18.1289 13.5299C18.0961 13.9306 18.031 14.2913 17.8867 14.6276L17.8203 14.7702C17.5549 15.2911 17.1509 15.7268 16.6553 16.0309L16.4365 16.153C16.0598 16.3449 15.6542 16.4242 15.1963 16.4616C14.746 16.4984 14.1891 16.4987 13.5 16.4987H6.5C5.81091 16.4987 5.25395 16.4984 4.80371 16.4616C4.40313 16.4288 4.0423 16.3646 3.70606 16.2204L3.56348 16.153C3.04228 15.8874 2.60587 15.4839 2.30176 14.9879L2.17969 14.7702C1.98783 14.3936 1.90853 13.9877 1.87109 13.5299C1.83431 13.0798 1.83496 12.5226 1.83496 11.8336V8.16666C1.83496 7.47757 1.83431 6.92061 1.87109 6.47037C1.90851 6.01258 1.98788 5.60675 2.17969 5.23013C2.48313 4.6346 2.96794 4.14978 3.56348 3.84634C3.94009 3.65454 4.34592 3.57516 4.80371 3.53775C5.25395 3.50096 5.81091 3.50162 6.5 3.50162H13.5C14.1891 3.50162 14.746 3.50096 15.1963 3.53775C15.6541 3.57516 16.0599 3.65454 16.4365 3.84634L16.6553 3.96842C17.151 4.27251 17.5548 4.7091 17.8203 5.23013L17.8867 5.37271C18.031 5.709 18.0962 6.06972 18.1289 6.47037C18.1657 6.92061 18.165 7.47756 18.165 8.16666V11.8336Z",
  "16:9": "M17.6685 9C17.6685 8.28896 17.6676 7.79563 17.6362 7.41211C17.6132 7.1301 17.5754 6.94066 17.5239 6.79688L17.4683 6.66699C17.3143 6.3648 17.08 6.11186 16.7925 5.93555L16.6665 5.86524C16.5085 5.78475 16.2969 5.72797 15.9214 5.69727C15.5379 5.66594 15.0444 5.66504 14.3335 5.66504H5.6665C4.95547 5.66504 4.46213 5.66593 4.07861 5.69727C3.70291 5.72797 3.4915 5.78473 3.3335 5.86524C2.98825 6.04116 2.70766 6.32175 2.53174 6.66699C2.45123 6.825 2.39447 7.0364 2.36377 7.41211C2.33244 7.79563 2.33154 8.28896 2.33154 9V11C2.33154 11.711 2.33244 12.2044 2.36377 12.5879C2.39447 12.9636 2.45123 13.175 2.53174 13.333L2.60205 13.459C2.77837 13.7466 3.03124 13.9807 3.3335 14.1348L3.46338 14.1914C3.60713 14.2428 3.79676 14.2797 4.07861 14.3027C4.46213 14.3341 4.95547 14.335 5.6665 14.335H14.3335C15.0444 14.335 15.5379 14.3341 15.9214 14.3027C16.2969 14.272 16.5085 14.2153 16.6665 14.1348L16.7925 14.0645C17.08 13.8881 17.3143 13.6352 17.4683 13.333L17.5239 13.2031C17.5754 13.0593 17.6132 12.8699 17.6362 12.5879C17.6676 12.2044 17.6685 11.711 17.6685 11V9ZM18.9985 11C18.9985 11.6891 18.9982 12.246 18.9614 12.6963C18.9287 13.0969 18.8644 13.4577 18.7202 13.7939L18.6528 13.9365C18.3873 14.4577 17.9837 14.8941 17.4878 15.1982L17.27 15.3203C16.8934 15.5122 16.4876 15.5915 16.0298 15.6289C15.5796 15.6657 15.0224 15.665 14.3335 15.665H5.6665C4.97741 15.665 4.42046 15.6657 3.97022 15.6289C3.56957 15.5962 3.20885 15.531 2.87256 15.3867L2.72998 15.3203C2.20895 15.0548 1.77236 14.651 1.46826 14.1553L1.34619 13.9365C1.15439 13.5599 1.07501 13.1541 1.0376 12.6963C1.00081 12.246 1.00147 11.6891 1.00147 11V9C1.00147 8.31091 1.00081 7.75395 1.0376 7.30371C1.07501 6.84592 1.15439 6.44009 1.34619 6.06348C1.64963 5.46794 2.13445 4.98313 2.72998 4.67969C3.1066 4.48788 3.51242 4.40851 3.97022 4.37109C4.42046 4.33431 4.97741 4.33496 5.6665 4.33496H14.3335C15.0224 4.33496 15.5796 4.33431 16.0298 4.37109C16.4876 4.40853 16.8934 4.48783 17.27 4.67969L17.4878 4.80176C17.9837 5.10587 18.3873 5.54228 18.6528 6.06348L18.7202 6.20606C18.8644 6.5423 18.9287 6.90313 18.9614 7.30371C18.9982 7.75395 18.9985 8.31091 18.9985 9V11Z",
};

function ratioIcon(ratio) {
  return `<svg class="image-ratio-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="${RATIO_ICON_PATHS[ratio]}" /></svg>`;
}

function menuCheck(selected) {
  return `<svg class="image-menu-check${selected ? "" : " is-hidden"}" viewBox="0 0 17 17" aria-hidden="true"><path d="M12.8961 3.64101C13.1297 3.41418 13.4984 3.37523 13.7779 3.56581C14.0571 3.75635 14.1554 4.11331 14.0299 4.41347L13.9615 4.53847L7.71151 13.7045C7.59411 13.8767 7.4063 13.9877 7.19881 14.0072C6.99136 14.0267 6.78564 13.9533 6.63826 13.806L2.88826 10.056C2.6192 9.67407 2.64927 9.30496 2.88826 9.06581C3.12738 8.82669 3.49647 8.79676 3.76815 8.97597L7.03084 12.2182L12.8053 3.74941Z" /></svg>`;
}

function fitZoomScale() {
  if (!drawerImage.naturalWidth || !drawerImage.naturalHeight) return 1;
  const widthScale = drawerImage.clientWidth / drawerImage.naturalWidth;
  const heightScale = drawerImage.clientHeight / drawerImage.naturalHeight;
  return Math.min(widthScale, heightScale);
}

function fitZoomPercent() {
  return Math.max(1, Math.round(fitZoomScale() * 100));
}

function updateZoomLabel() {
  zoomTriggerValue.textContent = `${zoomScale == null ? fitZoomPercent() : Math.round(zoomScale * 100)}%`;
}

function resetImageEditor() {
  editMode = null;
  editComments = [];
  editStrokes = [];
  editUndo = [];
  editRedo = [];
  resetZoom();
  closeEditorMenus();
  editActions.hidden = false;
  editModeRoot.hidden = true;
  editMask.hidden = true;
  commentLayer.hidden = true;
  commentPopover.hidden = true;
  brushSlider.closest(".image-brush-slider").hidden = true;
  renderComments();
}

function resetZoom() {
  zoomScale = null;
  drawerImage.style.transform = "";
  zoomTriggerValue.textContent = `${fitZoomPercent()}%`;
}

function requestHostAction(action, payload) {
  if (window.parent === window) return Promise.reject(new Error(t("Image editing is available inside Codex only.")));
  const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onResult);
      reject(new Error(t("Codex did not respond to the image edit request.")));
    }, 30_000);
    function onResult(event) {
      if (event.source !== window.parent || event.data?.type !== "codex-personal:host-result" || event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", onResult);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error?.message || t("Codex could not start the image edit.")));
    }
    window.addEventListener("message", onResult);
    window.parent.postMessage({ type: "codex-personal:host-action", requestId, action, payload }, "*");
  });
}

function canvasBase64(canvas) {
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

function annotationPng(comments) {
  const canvas = document.createElement("canvas");
  canvas.width = drawerImage.naturalWidth;
  canvas.height = drawerImage.naturalHeight;
  const context = canvas.getContext("2d");
  const radius = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) / 28));
  context.font = `700 ${Math.round(radius * 1.05)}px ui-sans-serif, system-ui`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const [index, comment] of comments.entries()) {
    context.fillStyle = "#111";
    context.beginPath();
    context.arc(comment.x * canvas.width, comment.y * canvas.height, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.fillText(String(index + 1), comment.x * canvas.width, comment.y * canvas.height + 1);
  }
  return canvasBase64(canvas);
}

function committedCommentText(comment) {
  return comment.editingExisting ? comment.originalText : comment.text;
}

function removeMaskPng() {
  const canvas = document.createElement("canvas");
  canvas.width = drawerImage.naturalWidth;
  canvas.height = drawerImage.naturalHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#fff";
  context.lineCap = context.lineJoin = "round";
  for (const stroke of editStrokes) {
    context.lineWidth = Math.min(canvas.width, canvas.height) * stroke.size / 250;
    context.beginPath();
    context.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * canvas.width, point.y * canvas.height);
    context.stroke();
  }
  return canvasBase64(canvas);
}

async function sendImageEdit(kind, detail) {
  if (!activeImage || !drawerImage.naturalWidth) throw new Error(t("The original image is not ready."));
  let auxiliaryPngBase64 = null;
  let prompt;
  if (kind === "comment") {
    const comments = editComments
      .map((comment) => ({ ...comment, text: committedCommentText(comment) }))
      .filter((comment) => comment.text?.trim());
    if (!comments.length) throw new Error(t("Add at least one comment before sending."));
    auxiliaryPngBase64 = annotationPng(comments);
    prompt = `Edit the first attached image according to the numbered comments. The second attachment is a transparent position overlay aligned exactly to the first image.\n${comments.map((comment, index) => `${index + 1}. ${comment.text} (at ${Math.round(comment.x * 100)}% from left, ${Math.round(comment.y * 100)}% from top)`).join("\n")}`;
  } else if (kind === "remove") {
    auxiliaryPngBase64 = removeMaskPng();
    prompt = "Remove the areas marked white in the attached black-and-white mask. Preserve everything outside the mask and fill the removed areas naturally.";
  } else {
    prompt = `Resize and recompose the attached image to the ${detail} aspect ratio. Preserve the subject and visual intent.`;
  }
  const draft = await fetch("/api/image-edit-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageId: activeImage.id, auxiliaryPngBase64 }),
  });
  if (!draft.ok) throw new Error((await draft.json().catch(() => null))?.error || t("Could not prepare the image edit."));
  const { draftId } = await draft.json();
  await requestHostAction("create-image-edit-thread", {
    draftId,
    prompt,
  });
}

function closeEditorMenus() {
  resizeMenu.hidden = true;
  zoomMenu.hidden = true;
  editActions.querySelector('[data-edit-action="resize"]').setAttribute("aria-expanded", "false");
  zoomTrigger.setAttribute("aria-expanded", "false");
}

function setEditMode(next) {
  editMode = next;
  closeEditorMenus();
  editActions.hidden = Boolean(next);
  editModeRoot.hidden = !next;
  editMask.hidden = next !== "remove";
  commentLayer.hidden = next !== "comment";
  brushSlider.closest(".image-brush-slider").hidden = true;
  commentPopover.hidden = true;
  if (next) {
    resetZoom();
  }
  if (!next) {
    editComments = [];
    editStrokes = [];
    editUndo = [];
    editRedo = [];
    repaintMask();
    renderComments();
  }
  renderEditMode();
}

function renderEditMode() {
  editModeRoot.replaceChildren();
  if (!editMode) return;
  const committedComments = editComments.filter((comment) => committedCommentText(comment)?.trim());
  const helper = document.createElement("span");
  helper.textContent = editMode === "comment"
    ? (committedComments.length ? t(committedComments.length === 1 ? "{count} comment" : "{count} comments", { count: committedComments.length }) : t("Click on the image to add comments"))
    : t("Brush over what you want to remove");
  const send = document.createElement("button");
  send.dataset.editSend = "";
  send.textContent = t("Send");
  send.disabled = editMode === "comment" ? committedComments.length === 0 : editStrokes.length === 0;
  send.addEventListener("click", async () => {
    send.disabled = true;
    try {
      await sendImageEdit(editMode);
    } catch (error) {
      announce(error.message);
      send.disabled = editMode === "comment" ? committedComments.length === 0 : editStrokes.length === 0;
    }
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.dataset.editCancel = "";
  cancel.setAttribute("aria-label", t("Cancel"));
  cancel.innerHTML = '<svg viewBox="0 0 21 21" aria-hidden="true"><path d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z" /></svg>';
  cancel.addEventListener("click", () => setEditMode(null));
  editModeRoot.append(helper);
  if (editMode === "remove") {
    const historyVisible = editUndo.length > 0 || editRedo.length > 0;
    const historyIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.998 10.833C15.9978 8.439 14.0571 6.49805 11.663 6.49805H4.9355L7.13374 8.69629L7.2187 8.80078C7.38911 9.05884 7.36084 9.40947 7.13374 9.63672C6.90652 9.86394 6.55592 9.89207 6.2978 9.72168L6.19331 9.63672L2.85932 6.30371C2.5999 6.04411 2.60001 5.62295 2.85932 5.36328L6.19331 2.0293C6.45298 1.76998 6.87414 1.76987 7.13374 2.0293C7.39344 2.289 7.39344 2.711 7.13374 2.9707L4.93647 5.16797H11.663C14.7916 5.16797 17.3279 7.70446 17.3281 10.833C17.3281 13.9617 14.7917 16.498 11.663 16.498H8.33003C7.96276 16.498 7.66499 16.2003 7.66499 15.833C7.66516 15.4659 7.96287 15.168 8.33003 15.168H11.663C14.0572 15.168 15.998 13.2272 15.998 10.833Z" /></svg>';
    const undo = document.createElement("button"); undo.type = "button"; undo.setAttribute("aria-label", t("Undo")); undo.innerHTML = historyIcon;
    undo.disabled = editUndo.length === 0;
    undo.hidden = !historyVisible;
    undo.addEventListener("click", () => { const previous = editUndo.pop(); if (!previous) return; editRedo.push(editStrokes); editStrokes = previous; repaintMask(); renderEditMode(); });
    const redo = document.createElement("button"); redo.type = "button"; redo.setAttribute("aria-label", t("Redo")); redo.innerHTML = historyIcon;
    redo.disabled = editRedo.length === 0;
    redo.hidden = !historyVisible;
    redo.addEventListener("click", () => { const next = editRedo.pop(); if (!next) return; editUndo.push(editStrokes); editStrokes = next; repaintMask(); renderEditMode(); });
    editModeRoot.append(undo, redo);
  }
  editModeRoot.append(send, cancel);
}

function imagePoint(event) {
  const rect = drawerImage.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

function commentEditorPosition({ markerX, markerY, stageWidth, stageHeight, popoverHeight }) {
  const inset = 8;
  const markerGap = 26;
  const popoverWidth = Math.min(294, stageWidth - inset * 2);
  const right = markerX + markerGap;
  const left = right + popoverWidth <= stageWidth - inset
    ? right
    : Math.max(inset, markerX - markerGap - popoverWidth);

  return {
    left,
    top: Math.max(inset, Math.min(stageHeight - popoverHeight - inset, markerY - 22)),
  };
}

function syncEditorOverlay() {
  const stageRect = editorStage.getBoundingClientRect();
  const imageRect = drawerImage.getBoundingClientRect();
  if (!stageRect.width || !imageRect.width) return;
  const bounds = {
    left: `${imageRect.left - stageRect.left}px`,
    top: `${imageRect.top - stageRect.top}px`,
    width: `${imageRect.width}px`,
    height: `${imageRect.height}px`,
  };
  for (const overlay of [editMask, commentLayer]) Object.assign(overlay.style, bounds);
  brushSlider.closest(".image-brush-slider").style.left = `${imageRect.left - stageRect.left + 16}px`;
}

function renderComments() {
  syncEditorOverlay();
  commentLayer.replaceChildren();
  for (const [index, comment] of editComments.entries()) {
    if (comment.editingExisting) continue;
    const marker = document.createElement(comment.draft ? "div" : "button");
    marker.className = "image-comment-marker";
    if (!comment.draft) {
      marker.type = "button";
      marker.setAttribute("aria-label", t("Edit comment {number}", { number: index + 1 }));
      marker.addEventListener("click", () => openCommentEditor(comment));
    }
    marker.style.left = `${comment.x * 100}%`; marker.style.top = `${comment.y * 100}%`;
    marker.innerHTML = `<svg viewBox="0 0 26 25" aria-hidden="true"><path d="M12.6504 0.824799C6.21496 0.824799 0.825466 5.77554 0.825195 12.0885C0.825245 14.2375 1.46183 16.2421 2.55176 17.943L2.02148 20.235L1.99316 20.3756C1.77603 21.655 2.78945 22.7791 4.02832 22.7691L4.0791 22.8209L4.53418 22.7047L7.12305 22.0426C8.77593 22.8778 10.6577 23.3531 12.6504 23.3531C19.086 23.3531 24.4754 18.4014 24.4756 12.0885C24.4753 5.77554 19.0858 0.824799 12.6504 0.824799Z" /></svg><span>${index + 1}</span>`;
    commentLayer.append(marker);
  }
}

function cancelActiveCommentEditor() {
  for (const comment of editComments.filter((entry) => entry.editingExisting)) {
    comment.text = comment.originalText;
    comment.draft = false;
    comment.editingExisting = false;
    delete comment.originalText;
  }
  editComments = editComments.filter((entry) => !entry.draft);
  commentPopover.hidden = true;
  commentPopover.classList.remove("is-existing-comment");
  renderComments();
  renderEditMode();
}

function repaintMask() {
  const context = editMask.getContext("2d");
  if (!context || !drawerImage.naturalWidth) return;
  editMask.width = drawerImage.naturalWidth; editMask.height = drawerImage.naturalHeight;
  context.clearRect(0, 0, editMask.width, editMask.height);
  context.strokeStyle = context.fillStyle = getComputedStyle(root).getPropertyValue("--color-text-accent");
  context.lineCap = context.lineJoin = "round";
  for (const stroke of editStrokes) {
    context.lineWidth = Math.min(editMask.width, editMask.height) * stroke.size / 250;
    context.beginPath(); context.moveTo(stroke.points[0].x * editMask.width, stroke.points[0].y * editMask.height);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * editMask.width, point.y * editMask.height);
    context.stroke();
  }
}

for (const button of editActions.querySelectorAll("[data-edit-action]")) {
  button.addEventListener("click", () => {
    const action = button.dataset.editAction;
    if (action === "resize") {
      resetZoom();
      closeEditorMenus();
      resizeMenu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      return;
    }
    setEditMode(action);
  });
}

for (const [label, ratio] of RESIZE_OPTIONS) {
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `${ratioIcon(ratio)}<span class="image-ratio-label"><span data-i18n="${label}">${t(label)}</span><small>${ratio}</small></span>`;
  button.setAttribute("role", "menuitem");
  button.addEventListener("click", async () => {
    closeEditorMenus();
    try { await sendImageEdit("resize", ratio); } catch (error) { announce(error.message); }
  });
  resizeMenu.append(button);
}

function renderZoomMenu() {
  zoomMenu.replaceChildren();
  for (const value of ZOOM_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.innerHTML = `<span class="image-ratio-label"><span>${value}%</span>${menuCheck(zoomScale === value / 100)}</span>`;
    button.addEventListener("click", () => {
      zoomScale = value / 100;
      drawerImage.style.transform = `scale(${zoomScale / fitZoomScale()})`;
      updateZoomLabel();
      closeEditorMenus();
    });
    zoomMenu.append(button);
  }
  const separator = document.createElement("div");
  separator.className = "image-menu-separator";
  separator.setAttribute("role", "separator");
  const fit = document.createElement("button");
  fit.type = "button";
  fit.setAttribute("role", "menuitem");
  fit.innerHTML = `<span class="image-ratio-label"><span>${t("Zoom to fit")}</span>${menuCheck(zoomScale == null)}</span>`;
  fit.addEventListener("click", () => {
    resetZoom();
    closeEditorMenus();
  });
  zoomMenu.append(separator, fit);
}

zoomTrigger.addEventListener("click", () => {
  const open = zoomMenu.hidden;
  closeEditorMenus();
  if (open) renderZoomMenu();
  zoomMenu.hidden = !open;
  zoomTrigger.setAttribute("aria-expanded", String(open));
});

function openCommentEditor(comment) {
  const isNew = comment.draft && !comment.text;
  if (!isNew) {
    editComments = editComments.filter((entry) => entry === comment || !entry.draft);
  }
  comment.originalText = comment.text;
  comment.draft = true;
  comment.editingExisting = !isNew;
  renderComments();
  syncEditorOverlay();
  const imageRect = drawerImage.getBoundingClientRect();
  const stageRect = editorStage.getBoundingClientRect();
  const markerX = imageRect.left - stageRect.left + comment.x * imageRect.width;
  const markerY = imageRect.top - stageRect.top + comment.y * imageRect.height;
  const popoverPosition = commentEditorPosition({
    markerX,
    markerY,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    popoverHeight: isNew ? 44 : 120,
  });
  commentPopover.replaceChildren();
  commentPopover.style.left = `${popoverPosition.left}px`;
  commentPopover.style.top = `${popoverPosition.top}px`;
  commentPopover.classList.toggle("is-existing-comment", !isNew);
  const finishExistingEdit = ({ restore = false, remove = false } = {}) => {
    if (remove) editComments = editComments.filter((entry) => entry !== comment);
    else {
      if (restore) comment.text = comment.originalText;
      else comment.text = comment.text.trim();
      comment.draft = false;
      comment.editingExisting = false;
      delete comment.originalText;
    }
    commentPopover.hidden = true;
    commentPopover.classList.remove("is-existing-comment");
    renderComments();
    renderEditMode();
  };
  if (!isNew) {
    const textarea = document.createElement("textarea");
    textarea.name = "image-comment-instruction";
    textarea.setAttribute("aria-label", t("Edit comment"));
    textarea.value = comment.text;
    const footer = document.createElement("div");
    footer.className = "image-comment-editor-footer";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-comment-delete";
    remove.setAttribute("aria-label", t("Delete comment"));
    remove.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" /></svg>';
    remove.addEventListener("click", () => finishExistingEdit({ remove: true }));
    const actions = document.createElement("span");
    actions.className = "image-comment-editor-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = t("Cancel");
    cancel.addEventListener("click", () => finishExistingEdit({ restore: true }));
    const save = document.createElement("button");
    save.type = "button";
    save.className = "image-comment-save";
    save.textContent = t("Save");
    save.disabled = !textarea.value.trim();
    save.addEventListener("click", () => { if (!save.disabled) finishExistingEdit(); });
    textarea.addEventListener("input", () => {
      comment.text = textarea.value;
      save.disabled = !textarea.value.trim();
    });
    textarea.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.stopPropagation();
      finishExistingEdit({ restore: true });
    });
    actions.append(cancel, save);
    footer.append(remove, actions);
    commentPopover.append(textarea, footer);
    commentPopover.hidden = false;
    textarea.focus();
    return;
  }
  const input = document.createElement("input");
  input.setAttribute("aria-label", t("Add comment"));
  input.name = "image-comment-instruction";
  input.placeholder = t("Add a comment…");
  input.value = comment.text;
  input.addEventListener("input", () => { comment.text = input.value; });
  input.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      comment.text = text;
      comment.draft = false;
      comment.editingExisting = false;
      delete comment.originalText;
      commentPopover.hidden = true;
      commentPopover.classList.remove("is-existing-comment");
      renderComments();
      renderEditMode();
      return;
    }
    if (keyEvent.key === "Escape") {
      keyEvent.stopPropagation();
      cancelActiveCommentEditor();
    }
  });
  commentPopover.append(input); commentPopover.hidden = false; input.focus();
}

editorStage.addEventListener("click", (event) => {
  if (editMode !== "comment" || event.target !== drawerImage || editComments.some((comment) => comment.draft)) return;
  const point = imagePoint(event); if (!point) return;
  const comment = { ...point, text: "", draft: true };
  editComments.push(comment);
  openCommentEditor(comment);
});
editMask.addEventListener("pointerdown", (event) => {
  if (editMode !== "remove") return;
  const point = imagePoint(event); if (!point) return;
  editMask.setPointerCapture(event.pointerId); editDrawing = true; editUndo.push(editStrokes.map((stroke) => ({ ...stroke, points: stroke.points.slice() }))); editRedo = [];
  editStrokes.push({ size: Number(brushSlider.value), points: [point] }); repaintMask(); renderEditMode();
});
editMask.addEventListener("pointermove", (event) => { if (!editDrawing) return; const point = imagePoint(event); if (!point) return; editStrokes.at(-1)?.points.push(point); repaintMask(); });
editMask.addEventListener("pointerup", () => { editDrawing = false; renderEditMode(); });
document.addEventListener("pointerdown", (event) => {
  if (event.target instanceof Element && event.target.closest('.image-edit-menu, [data-zoom-trigger], [data-edit-action="resize"]')) return;
  closeEditorMenus();
});
drawerImage.addEventListener("load", () => {
  syncEditorOverlay();
  repaintMask();
  renderComments();
  if (zoomScale == null) updateZoomLabel();
});
new ResizeObserver(() => {
  syncEditorOverlay();
  if (zoomScale == null) updateZoomLabel();
}).observe(editorStage);

drawer.inert = true;
applyDensity();
setLocale(navigator.language);
translateDocument(document);
await Promise.all([loadFacets(), loadPage({ reset: true })]);
await new Promise((resolve) => setTimeout(resolve, 0));

new ResizeObserver(() => {
  scheduleMasonry();
}).observe(scrollArea);

new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadPage().catch(console.error);
  },
  { root: scrollArea, rootMargin: "600px 0px" },
).observe(pageSentinel);

document.addEventListener("visibilitychange", () => {
  setDocumentVisible(document.visibilityState !== "hidden");
});
window.addEventListener("focus", () => setWindowFocused(true));
window.addEventListener("blur", () => setWindowFocused(false));
if (typeof IntersectionObserver === "function") {
  new IntersectionObserver((entries) => {
    setShellIntersecting(entries.some((entry) => entry.isIntersecting));
  }).observe(shell);
}
scheduleUpdateCheck();
