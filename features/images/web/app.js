const shell = document.querySelector(".library-shell");
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
const editorStage = editor.querySelector(".image-editor-stage");
const editActions = editor.querySelector("[data-edit-actions]");
const editModeRoot = editor.querySelector("[data-edit-mode]");
const resizeMenu = editor.querySelector("[data-resize-menu]");
const zoomMenu = editor.querySelector("[data-zoom-menu]");
const zoomTrigger = editor.querySelector("[data-zoom-trigger]");
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
    "--color-token-bg-tertiary", "--color-background-elevated-primary-opaque",
    "--color-token-main-surface-primary", "--color-token-input-foreground",
    "--color-text-foreground", "--color-text-foreground-tertiary", "--color-text-on-accent",
    "--color-border", "--color-border-focus", "--color-token-list-hover-background",
    "--color-text-accent", "--font-sans-default", "--font-weight-normal", "--text-sm", "--text-sm--line-height",
    "--radius-md", "--radius-xl", "--shadow-md", "--shadow-xl", "--elevation-stroke",
  ];
  editor.hidden = !editorTokens.every((name) => appliedHostTokens.has(name));
}

function announce(message) {
  if (!statusAnnouncer) return;
  statusAnnouncer.textContent = "";
  requestAnimationFrame(() => {
    statusAnnouncer.textContent = message;
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type === "codex-personal:theme") applyHostTheme(event.data);
  if (["codex-personal:surface-active", "codex-personal:surface-visibility"].includes(event.data?.type)) {
    setHostSurfaceActive(event.data.active ?? event.data.visible);
  }
});

if (window.parent !== window) {
  window.parent.postMessage({ type: "codex-personal:ready" }, "*");
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Original file";
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
    return { kind: "project", label: image.projectName || "Project" };
  }
  if (image.sourceKind === "work") {
    return { kind: "work", label: image.threadTitle || "Work" };
  }
  return { kind: "chat", label: image.threadTitle || "Untitled chat" };
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
  if (selectedScope === "all") return { label: "All images", count: facets.total, kind: "all" };
  if (selectedScope === "chat") return { label: "Chats", count: facets.chats, kind: "chat" };
  if (selectedScope === "work") return { label: "Work", count: facets.works, kind: "work" };
  const project = facets.projects.find((item) => item.scope === selectedScope);
  return project
    ? { label: project.name, count: project.count, kind: "project" }
    : { label: "All images", count: facets.total, kind: "all" };
}

function updateFilterTrigger() {
  const selected = selectedFacet();
  filterSourceIcon.replaceChildren(createSourceIcon(selected.kind));
  filterLabel.textContent = selected.label;
  filterCount.textContent = String(selected.count);
  filterButton.title = `${selected.label} · ${selected.count} images`;
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
  const all = createSourceOption({ scope: "all", label: "All images", count: facets.total, kind: "all" });
  const chats = createSourceOption({ scope: "chat", label: "Chats", count: facets.chats, kind: "chat" });
  const work = createSourceOption({ scope: "work", label: "Work", count: facets.works, kind: "work" });
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
  if (!response.ok) throw new Error("Could not load image sources");
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
  button.setAttribute("aria-label", `Open image from ${source.label}, created ${createdAt}`);

  const preview = document.createElement("img");
  preview.src = image.fileUrl;
  preview.alt = image.prompt || "Generated image";
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
    ? (group.projectName || "Project")
    : group.sourceKind === "work" ? "Work" : "Chat";
  const threadTitle = group.threadTitle || (
    group.sourceKind === "project" ? "Untitled task" : group.sourceKind === "work" ? "Untitled work" : "Untitled chat"
  );
  button.setAttribute("aria-label", `Open ${threadTitle}, ${group.imageCount} images`);

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
  imageCount.textContent = `${group.imageCount} ${group.imageCount === 1 ? "image" : "images"}`;
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
    emptyTitle.textContent = "No images in this Thread";
    emptyDescription.textContent = "Return to the library and choose another Thread.";
    return;
  }
  const selected = selectedFacet();
  if (selectedScope === "all") {
    emptyTitle.textContent = "No images yet";
    emptyDescription.textContent = "Generate an image in any Task and it will appear here automatically.";
  } else {
    emptyTitle.textContent = `No images in ${selected.label}`;
    emptyDescription.textContent = "Choose another source or generate a new image in this Task.";
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
    if (!response.ok) throw new Error("Could not load images");
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
  if (!response.ok) throw new Error("Could not check for new images");
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
  promptCopyButton.setAttribute("aria-label", "Copy generation prompt");
  promptCopyButton.title = "Copy prompt";
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
      ? "This Thread has been archived and can’t be opened."
      : "This ChatGPT conversation cannot be opened from Images.";
    sourceButton.setAttribute("aria-label", archived
      ? "Open Thread unavailable: this Thread has been archived"
      : "Open conversation unavailable");
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
  if (isProject) drawerProject.textContent = image.projectName || "Project";
  drawerTaskLabel.textContent = isProject ? "Thread" : isWork ? "Work" : "Chat";
  drawerThread.textContent = image.threadTitle || (isProject ? "Untitled task" : isWork ? "Untitled work" : "Untitled chat");
  drawerImage.src = image.fileUrl;
  drawerImage.alt = image.prompt || "Generated image";
  if (image.width && image.height) {
    drawerImage.width = image.width;
    drawerImage.height = image.height;
  } else {
    drawerImage.removeAttribute("width");
    drawerImage.removeAttribute("height");
  }
  drawerDate.textContent = dateFormatter.format(new Date(image.createdAt));
  drawerSize.textContent = image.width && image.height ? `${image.width} × ${image.height}` : "Original";
  drawerFileSize.textContent = formatBytes(image.byteLength);
  drawerPrompt.textContent = image.prompt || "Prompt is not available for this image.";
  drawerPrompt.classList.toggle("is-missing", !image.prompt);
  promptCopyButton.disabled = !image.prompt;
  updateSourceAction(image);
  resetCopyFeedback();
}

async function openImage(image, originatingElement = null) {
  if (originatingElement) rememberDrawerOrigin(originatingElement);
  const request = ++detailRequest;
  showImageDetails(image);
  drawerPrompt.textContent = "Loading generation prompt…";
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
    if (!response.ok) throw new Error("Could not load image details");
    const payload = await response.json();
    if (request !== detailRequest) return;
    showImageDetails(payload.image);
  } catch (error) {
    if (request !== detailRequest) return;
    drawerPrompt.textContent = "Prompt could not be loaded.";
    drawerPrompt.classList.add("is-missing");
    announce("Prompt could not be loaded.");
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
        if (!response.ok) throw new Error("Could not refresh images");
        const result = await response.json();
        announce(result.inProgress ? "Image refresh is already in progress." : "Images refreshed.");
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
    announce("Prompt could not be copied.");
    return;
  }
  resetCopyFeedback();
  promptCopyIcon.setAttribute("hidden", "");
  promptCheckIcon.removeAttribute("hidden");
  promptCopyButton.classList.add("is-copied");
  promptCopyButton.setAttribute("aria-label", "Prompt copied");
  promptCopyButton.title = "Copied";
  announce("Prompt copied.");
  copyFeedbackTimer = setTimeout(resetCopyFeedback, 2000);
});

saveButton.addEventListener("click", async () => {
  if (!activeImage) return;
  const imageId = activeImage.id;
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  try {
    const response = await fetch(`/api/images/${imageId}/save-as`, { method: "POST" });
    if (!response.ok) throw new Error("Could not save image");
    const result = await response.json();
    if (result.saved) {
      saveButton.textContent = "Saved";
      announce("Image saved.");
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } catch (error) {
    announce(error.message);
    console.error(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save as";
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
    commentPopover.hidden = true;
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
}

function resetZoom() {
  zoomScale = null;
  drawerImage.style.transform = "";
  zoomTrigger.textContent = "Fit";
}

function requestHostAction(action, payload) {
  if (window.parent === window) return Promise.reject(new Error("Image editing is available inside Codex only."));
  const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onResult);
      reject(new Error("Codex did not respond to the image edit request."));
    }, 30_000);
    function onResult(event) {
      if (event.source !== window.parent || event.data?.type !== "codex-personal:host-result" || event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", onResult);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error?.message || "Codex could not start the image edit."));
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
  context.drawImage(drawerImage, 0, 0);
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
  if (!activeImage || !drawerImage.naturalWidth) throw new Error("The original image is not ready.");
  let auxiliaryPngBase64 = null;
  let prompt;
  if (kind === "comment") {
    const comments = editComments.filter((comment) => comment.text);
    if (!comments.length) throw new Error("Add at least one comment before sending.");
    auxiliaryPngBase64 = annotationPng(comments);
    prompt = `Edit the attached image according to the numbered comments. The second attachment is an annotated visual reference.\n${comments.map((comment, index) => `${index + 1}. ${comment.text}`).join("\n")}`;
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
  if (!draft.ok) throw new Error((await draft.json().catch(() => null))?.error || "Could not prepare the image edit.");
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
  brushSlider.closest(".image-brush-slider").hidden = next !== "remove";
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
  }
  renderEditMode();
}

function renderEditMode() {
  editModeRoot.replaceChildren();
  if (!editMode) return;
  const helper = document.createElement("span");
  helper.textContent = editMode === "comment" ? "Click on the image to add comments" : "Brush over what you want to remove";
  const send = document.createElement("button");
  send.textContent = "Send";
  send.disabled = editMode === "comment" ? !editComments.some((comment) => comment.text) : editStrokes.length === 0;
  send.addEventListener("click", async () => {
    send.disabled = true;
    try {
      await sendImageEdit(editMode);
    } catch (error) {
      announce(error.message);
      send.disabled = editMode === "comment" ? !editComments.some((comment) => comment.text) : editStrokes.length === 0;
    }
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.setAttribute("aria-label", "Cancel");
  cancel.textContent = "×";
  cancel.addEventListener("click", () => setEditMode(null));
  editModeRoot.append(helper);
  if (editMode === "remove") {
    const undo = document.createElement("button"); undo.type = "button"; undo.setAttribute("aria-label", "Undo"); undo.textContent = "↶";
    undo.disabled = editUndo.length === 0;
    undo.addEventListener("click", () => { const previous = editUndo.pop(); if (!previous) return; editRedo.push(editStrokes); editStrokes = previous; repaintMask(); renderEditMode(); });
    const redo = document.createElement("button"); redo.type = "button"; redo.setAttribute("aria-label", "Redo"); redo.textContent = "↷";
    redo.disabled = editRedo.length === 0;
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
    const marker = document.createElement("span");
    marker.className = "image-comment-marker";
    marker.style.left = `${comment.x * 100}%`; marker.style.top = `${comment.y * 100}%`;
    marker.textContent = String(index + 1);
    commentLayer.append(marker);
  }
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
  button.innerHTML = `<span class="image-ratio-icon" data-ratio="${ratio}" aria-hidden="true"></span><span>${label}<small>${ratio}</small></span>`;
  button.setAttribute("role", "menuitem");
  button.addEventListener("click", async () => {
    closeEditorMenus();
    try { await sendImageEdit("resize", ratio); } catch (error) { announce(error.message); }
  });
  resizeMenu.append(button);
}
for (const value of ZOOM_OPTIONS) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = `${value}%`; button.setAttribute("role", "menuitem");
  button.addEventListener("click", () => { zoomScale = value / 100; drawerImage.style.transform = `scale(${zoomScale})`; zoomTrigger.textContent = `${value}%`; closeEditorMenus(); });
  zoomMenu.append(button);
}
const fit = document.createElement("button"); fit.type = "button"; fit.textContent = "Zoom to fit"; fit.setAttribute("role", "menuitem");
fit.addEventListener("click", () => { zoomScale = null; drawerImage.style.transform = ""; zoomTrigger.textContent = "Fit"; closeEditorMenus(); });
zoomMenu.append(fit);
zoomTrigger.addEventListener("click", () => { const open = zoomMenu.hidden; closeEditorMenus(); zoomMenu.hidden = !open; zoomTrigger.setAttribute("aria-expanded", String(open)); });

editorStage.addEventListener("click", (event) => {
  if (editMode !== "comment" || event.target !== drawerImage) return;
  const point = imagePoint(event); if (!point) return;
  const comment = { ...point, text: "" }; editComments.push(comment); renderComments();
  syncEditorOverlay();
  const imageRect = drawerImage.getBoundingClientRect();
  const stageRect = editorStage.getBoundingClientRect();
  commentPopover.replaceChildren();
  commentPopover.style.left = `${imageRect.left - stageRect.left + point.x * imageRect.width}px`;
  commentPopover.style.top = `${imageRect.top - stageRect.top + point.y * imageRect.height}px`;
  const input = document.createElement("input"); input.placeholder = "Add a comment…";
  input.addEventListener("input", () => { comment.text = input.value.trim(); renderEditMode(); });
  input.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key !== "Escape") return;
    keyEvent.stopPropagation();
    commentPopover.hidden = true;
    input.blur();
  });
  commentPopover.append(input); commentPopover.hidden = false; input.focus();
});
editMask.addEventListener("pointerdown", (event) => {
  if (editMode !== "remove") return;
  const point = imagePoint(event); if (!point) return;
  editMask.setPointerCapture(event.pointerId); editDrawing = true; editUndo.push(editStrokes.map((stroke) => ({ ...stroke, points: stroke.points.slice() }))); editRedo = [];
  editStrokes.push({ size: Number(brushSlider.value), points: [point] }); repaintMask(); renderEditMode();
});
editMask.addEventListener("pointermove", (event) => { if (!editDrawing) return; const point = imagePoint(event); if (!point) return; editStrokes.at(-1)?.points.push(point); repaintMask(); });
editMask.addEventListener("pointerup", () => { editDrawing = false; });
document.addEventListener("pointerdown", (event) => { if (!editor.contains(event.target)) closeEditorMenus(); });
drawerImage.addEventListener("load", () => { syncEditorOverlay(); repaintMask(); renderComments(); });
new ResizeObserver(syncEditorOverlay).observe(editorStage);

drawer.inert = true;
applyDensity();
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
