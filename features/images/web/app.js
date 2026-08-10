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
const root = document.documentElement;

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
};

let facets = { total: 0, chats: 0, projects: [] };
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
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (event.data?.type === "codex-personal:theme") applyHostTheme(event.data);
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
  const divider = document.createElement("div");
  divider.className = "source-menu-divider";
  divider.setAttribute("role", "separator");
  const projects = facets.projects.map((project) => createSourceOption({
    scope: project.scope,
    label: project.name,
    count: project.count,
    kind: "project",
  }));
  sourceMenu.replaceChildren(all, chats, ...(projects.length ? [divider, ...projects] : []));
  updateFilterTrigger();
}

async function loadFacets() {
  const response = await fetch("/api/image-facets");
  if (!response.ok) throw new Error("Could not load image sources");
  facets = await response.json();
  if (
    selectedScope !== "all"
    && selectedScope !== "chat"
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

function closeSourceMenu() {
  sourceMenu.hidden = true;
  filterButton.setAttribute("aria-expanded", "false");
}

function closeToolbarPopups() {
  closeSourceMenu();
}

function layoutMasonry() {
  masonryTimer = null;
  const styles = getComputedStyle(grid);
  const rowHeight = Number.parseFloat(styles.gridAutoRows);
  if (!rowHeight) return;
  const cards = [...grid.children];
  if (!cards.length) return;

  // Keep DOM writes and geometry reads in separate batches so the browser only
  // needs to resolve layout once, even for a full page of boards.
  for (const card of cards) card.style.gridRowEnd = "auto";
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
  button.addEventListener("click", () => openImage(image));
  return button;
}

function createThreadBoard(group) {
  const button = document.createElement("button");
  button.className = "thread-board";
  button.type = "button";
  button.dataset.threadId = group.threadId;
  const sourceLabel = group.sourceKind === "project" ? (group.projectName || "Project") : "Chat";
  const threadTitle = group.threadTitle || (group.sourceKind === "project" ? "Untitled task" : "Untitled chat");
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
  caption.append(createSourceValue(group.sourceKind === "project" ? "project" : "chat", sourceLabel, "card-source"));
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
  button.addEventListener("click", () => openThreadGroup(group));
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
  closeSourceMenu();
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
  if (viewContext === "thread" || shell.classList.contains("drawer-open")) return;
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
  sourceButton.disabled = archived;
  sourceAction.classList.toggle("is-disabled", archived);
  sourceTooltip.hidden = !archived;
  if (archived) {
    sourceButton.setAttribute("aria-describedby", sourceTooltip.id);
    sourceButton.setAttribute("aria-label", "Open Thread unavailable: this Thread has been archived");
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

function showImageDetails(image) {
  activeImage = image;
  const isProject = image.sourceKind === "project";
  drawerProjectRow.hidden = !isProject;
  if (isProject) drawerProject.textContent = image.projectName || "Project";
  drawerTaskLabel.textContent = isProject ? "Thread" : "Chat";
  drawerThread.textContent = image.threadTitle || (isProject ? "Untitled task" : "Untitled chat");
  drawerImage.src = image.fileUrl;
  drawerImage.alt = image.prompt || "Generated image";
  drawerDate.textContent = dateFormatter.format(new Date(image.createdAt));
  drawerSize.textContent = image.width && image.height ? `${image.width} × ${image.height}` : "Original";
  drawerFileSize.textContent = formatBytes(image.byteLength);
  drawerPrompt.textContent = image.prompt || "Prompt is not available for this image.";
  drawerPrompt.classList.toggle("is-missing", !image.prompt);
  promptCopyButton.disabled = !image.prompt;
  updateSourceAction(image);
  resetCopyFeedback();
}

async function openImage(image) {
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
    console.error(error);
  } finally {
    if (request === detailRequest) drawerPrompt.classList.remove("is-loading");
  }
}

async function openThreadGroup(group) {
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
  } else {
    loadPage({ reset: true }).catch(console.error);
  }
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
}

function openSourceThread(threadId) {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "codex-personal:open-thread", threadId }, "*");
  } else {
    window.location.href = `codex://threads/${threadId}`;
  }
}

filterButton.addEventListener("click", () => {
  const opening = sourceMenu.hidden;
  sourceMenu.hidden = !opening;
  filterButton.setAttribute("aria-expanded", String(opening));
  if (opening) sourceMenu.querySelector('[aria-selected="true"]')?.focus();
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
  } finally {
    rescan.disabled = false;
    rescan.classList.remove("is-loading");
    rescan.removeAttribute("aria-busy");
  }
});

drawer.querySelector(".drawer-close").addEventListener("click", closeDrawer);
sourceButton.addEventListener("click", () => {
  if (activeImage && !activeImage.archived) openSourceThread(activeImage.threadId);
});

promptCopyButton.addEventListener("click", async () => {
  const prompt = activeImage?.prompt;
  if (!prompt || !(await copyText(prompt))) return;
  resetCopyFeedback();
  promptCopyIcon.setAttribute("hidden", "");
  promptCheckIcon.removeAttribute("hidden");
  promptCopyButton.classList.add("is-copied");
  promptCopyButton.setAttribute("aria-label", "Prompt copied");
  promptCopyButton.title = "Copied";
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
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } catch (error) {
    console.error(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save as";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!sourceMenu.hidden) {
    closeToolbarPopups();
  } else if (shell.classList.contains("drawer-open")) {
    closeDrawer();
  }
});

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

setInterval(() => checkForUpdates().catch(console.error), 3000);
