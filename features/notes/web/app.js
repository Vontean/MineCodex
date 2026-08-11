const params = new URLSearchParams(location.search);
const SUPPORTED_LOCALES = new Set(["en", "zh-CN"]);

function normalizeLocale(value) {
  const candidate = String(value ?? "").trim();
  if (candidate.toLowerCase().startsWith("zh")) return "zh-CN";
  return SUPPORTED_LOCALES.has(candidate) ? candidate : "en";
}

const MESSAGES = Object.freeze({
  en: {
    requestFailed: ({ status }) => `Request failed (${status})`,
    temporarilyUnavailable: "CodexNotes is temporarily unavailable",
    unavailable: "CodexNotes is unavailable",
    retry: "Retry",
    hostUnavailable: "Codex host is not connected",
    hostTimeout: "Codex did not respond",
    hostActionFailed: "Host action failed",
    restoreTodo: "Restore Todo",
    completeTodo: "Complete Todo",
    edit: "Edit",
    delete: "Delete",
    editTodo: "Edit Todo",
    newTodo: "New Todo",
    todoText: "Todo text",
    todoPlaceholder: "What do you want to remember?",
    saveTodo: "Save Todo",
    addTodo: "Add Todo",
    cancel: "Cancel",
    editPrompt: "Edit Prompt",
    newPrompt: "New Prompt",
    optionalTitle: "Optional title",
    promptTitle: "Prompt title",
    promptBody: "Prompt body",
    promptPlaceholder: "Write a reusable prompt…",
    savePrompt: "Save Prompt",
    addPrompt: "Add Prompt",
    insertPrompt: "Insert Prompt",
    morePromptActions: "More prompt actions",
    star: "Star",
    unstar: "Unstar",
    showInFolder: "Show in folder",
    attachToChat: "Attach to chat",
    viewAll: "View all",
    todo: "Todo",
    noTodo: "No Todo yet",
    prompts: "Prompts",
    noPrompts: "No prompts yet",
    files: "Files",
    pinFiles: "Pin files",
    noPinnedFiles: "No pinned files",
    active: "Active",
    add: "Add",
    nothingActive: "Nothing active",
    completed: "Completed",
    deleteAll: "Delete all",
    deleteCompletedTitle: "Delete all completed Todo",
    noCompletedTodo: "No completed Todo",
    starred: "Starred",
    noStarredPrompts: "No starred prompts",
    pinnedFiles: "Pinned files",
    loading: "Loading CodexNotes…",
    insertedAtCaret: "Inserted at the Composer caret",
    addedToComposer: "Added to Composer",
    insertedFilePath: "Inserted file path",
    filesPinned: ({ count }) => `${count} file${count === 1 ? "" : "s"} pinned`,
    alreadyPinned: "Already pinned",
    todoEmpty: "Todo text cannot be empty",
    promptEmpty: "Prompt body cannot be empty",
    editorItemMissing: "This item no longer exists.",
    close: "Close",
    invalidRequest: "The request is invalid",
    invalidContentType: "The request must use JSON",
    invalidJson: "The request body is not valid JSON",
    bodyTooLarge: "The request is too large",
    notFound: "The item was not found",
    invalidOrder: "The Todo order is no longer current",
    invalidUse: "The requested action could not be recorded",
    fileUnavailable: "The file is unavailable",
    fileMissing: "The source file no longer exists",
    directoryNotAllowed: "Folders cannot be pinned; choose regular files",
    pathNotAbsolute: "Only absolute paths can be pinned",
    pickerUnavailable: "The system file picker is unavailable",
    pickerFailed: "The system file picker could not be opened",
    revealUnavailable: "Show in folder is unavailable on this platform",
    revealFailed: "The file could not be shown in the system file manager",
    previewUnavailable: "This file does not have an image preview",
    previewTooLarge: "The image is too large to preview",
    internalError: "CodexNotes could not complete the request",
    actionNotAllowed: "This action is not available",
  },
  "zh-CN": {
    requestFailed: ({ status }) => `请求失败（${status}）`,
    temporarilyUnavailable: "CodexNotes 暂时不可用",
    unavailable: "CodexNotes 不可用",
    retry: "重试",
    hostUnavailable: "尚未连接 Codex 宿主",
    hostTimeout: "Codex 未响应",
    hostActionFailed: "宿主操作失败",
    restoreTodo: "恢复待办",
    completeTodo: "完成待办",
    edit: "编辑",
    delete: "删除",
    editTodo: "编辑待办",
    newTodo: "新建待办",
    todoText: "待办内容",
    todoPlaceholder: "你想记住什么？",
    saveTodo: "保存待办",
    addTodo: "添加待办",
    cancel: "取消",
    editPrompt: "编辑提示词",
    newPrompt: "新建提示词",
    optionalTitle: "可选标题",
    promptTitle: "提示词标题",
    promptBody: "提示词正文",
    promptPlaceholder: "编写一条可复用的提示词…",
    savePrompt: "保存提示词",
    addPrompt: "添加提示词",
    insertPrompt: "插入提示词",
    morePromptActions: "更多提示词操作",
    star: "收藏",
    unstar: "取消收藏",
    showInFolder: "在文件夹中显示",
    attachToChat: "添加到对话",
    viewAll: "查看全部",
    todo: "待办",
    noTodo: "暂无待办",
    prompts: "提示词",
    noPrompts: "暂无提示词",
    files: "文件",
    pinFiles: "固定文件",
    noPinnedFiles: "暂无固定文件",
    active: "进行中",
    add: "添加",
    nothingActive: "暂无进行中的待办",
    completed: "已完成",
    deleteAll: "全部删除",
    deleteCompletedTitle: "删除全部已完成待办",
    noCompletedTodo: "暂无已完成待办",
    starred: "已收藏",
    noStarredPrompts: "暂无收藏的提示词",
    pinnedFiles: "已固定文件",
    loading: "正在加载 CodexNotes…",
    insertedAtCaret: "已插入到消息输入框光标处",
    addedToComposer: "已添加到消息输入框",
    insertedFilePath: "已插入文件路径",
    filesPinned: ({ count }) => `已固定 ${count} 个文件`,
    alreadyPinned: "文件已固定",
    todoEmpty: "待办内容不能为空",
    promptEmpty: "提示词正文不能为空",
    editorItemMissing: "该项目已不存在。",
    close: "关闭",
    invalidRequest: "请求无效",
    invalidContentType: "请求必须使用 JSON",
    invalidJson: "请求正文不是有效的 JSON",
    bodyTooLarge: "请求内容过大",
    notFound: "找不到该项目",
    invalidOrder: "待办顺序已发生变化",
    invalidUse: "无法记录这次操作",
    fileUnavailable: "文件不可用",
    fileMissing: "源文件已不存在",
    directoryNotAllowed: "不能固定文件夹，请选择普通文件",
    pathNotAbsolute: "只能固定绝对路径",
    pickerUnavailable: "系统文件选择器不可用",
    pickerFailed: "无法打开系统文件选择器",
    revealUnavailable: "当前平台不支持在文件夹中显示",
    revealFailed: "无法在系统文件管理器中显示该文件",
    previewUnavailable: "该文件没有图片预览",
    previewTooLarge: "图片过大，无法预览",
    internalError: "CodexNotes 无法完成请求",
    actionNotAllowed: "当前操作不可用",
  },
});

let locale = normalizeLocale(params.get("locale") ?? navigator.languages?.[0] ?? navigator.language);
document.documentElement.lang = locale;

function t(key, params = {}) {
  const value = MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? key;
  return typeof value === "function" ? value(params) : value;
}

const ERROR_MESSAGE_KEYS = Object.freeze({
  ACTION_NOT_ALLOWED: "actionNotAllowed",
  BODY_TOO_LARGE: "bodyTooLarge",
  DIRECTORY_NOT_ALLOWED: "directoryNotAllowed",
  EMPTY_BODY: "invalidRequest",
  FILE_MISSING: "fileMissing",
  FILE_UNAVAILABLE: "fileUnavailable",
  HOST_ACTION_FAILED: "hostActionFailed",
  HOST_NOT_ALLOWED: "actionNotAllowed",
  HOST_TIMEOUT: "hostTimeout",
  HOST_UNAVAILABLE: "hostUnavailable",
  INTERNAL_ERROR: "internalError",
  INVALID_BODY: "invalidRequest",
  INVALID_CHANGES: "invalidRequest",
  INVALID_COMPLETED: "invalidRequest",
  INVALID_CONTENT_TYPE: "invalidContentType",
  INVALID_ID: "invalidRequest",
  INVALID_JSON: "invalidJson",
  INVALID_ORDER: "invalidOrder",
  INVALID_PATHS: "invalidRequest",
  INVALID_REQUEST: "invalidRequest",
  INVALID_SURFACE: "invalidRequest",
  INVALID_ORIGIN: "actionNotAllowed",
  INVALID_STAR: "invalidRequest",
  INVALID_TITLE: "invalidRequest",
  INVALID_USE: "invalidUse",
  NOT_FOUND: "notFound",
  ORIGIN_NOT_ALLOWED: "actionNotAllowed",
  PATH_NOT_ABSOLUTE: "pathNotAbsolute",
  PICKER_FAILED: "pickerFailed",
  PICKER_UNAVAILABLE: "pickerUnavailable",
  PREVIEW_TOO_LARGE: "previewTooLarge",
  PREVIEW_UNAVAILABLE: "previewUnavailable",
  REVEAL_FAILED: "revealFailed",
  REVEAL_UNAVAILABLE: "revealUnavailable",
});

function localizedErrorMessage(code, fallback, params = {}) {
  const key = ERROR_MESSAGE_KEYS[code];
  return key ? t(key, params) : fallback;
}

const requestedSurface = params.get("surface") === "notes" ? "prompts" : params.get("surface");
const surface = new Set(["summary", "todo", "prompts", "files", "editor"]).has(requestedSurface)
  ? requestedSurface
  : "summary";
const editorKind = params.get("kind") === "todo" ? "todo" : "prompt";
const editorId = params.get("id") || null;

document.body.dataset.surface = surface;

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const SUMMARY_ITEM_LIMIT = 5;
const PROMPT_PREVIEW_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const DOMAIN_ICON_BY_SURFACE = Object.freeze({
  todo: "list-todo",
  prompt: "message-square-quote",
  prompts: "message-square-quote",
  files: "paperclip",
});
const CODEX_FILE_ICON_BY_EXTENSION = new Map([
  ["ts", "typescript"],
  ["tsx", "react"], ["jsx", "react"],
  ["js", "javascript"], ["mjs", "javascript"], ["cjs", "javascript"], ["hs", "javascript"],
  ["py", "python"],
  ["java", "java"],
  ["rs", "rust"],
  ["php", "php"],
  ["css", "css"], ["scss", "css"], ["less", "css"], ["sass", "css"],
  ["cpp", "cplusplus"], ["cxx", "cplusplus"], ["cc", "cplusplus"], ["c", "cplusplus"],
  ["hpp", "cplusplus"], ["hh", "cplusplus"], ["h", "cplusplus"],
  ["rb", "code"], ["go", "code"], ["kt", "code"], ["swift", "code"], ["m", "code"],
  ["mm", "code"], ["cs", "code"], ["sql", "code"],
  ["json", "json"], ["jsonc", "json"],
  ["md", "document"], ["mdx", "document"], ["markdown", "document"],
  ["mkd", "document"], ["mdown", "document"],
  ["html", "html"], ["htm", "html"],
  ["yaml", "file"], ["yml", "file"],
  ["toml", "toml"],
  ["xml", "document"],
  ["csv", "spreadsheet"], ["tsv", "spreadsheet"], ["xls", "spreadsheet"],
  ["xlsm", "spreadsheet"], ["xlsx", "spreadsheet"],
  ["doc", "artifact-document"], ["docx", "artifact-document"],
  ["ipynb", "notebook"],
  ["ppt", "presentation"], ["pptx", "presentation"],
  ["sh", "shell"], ["bash", "shell"], ["zsh", "shell"], ["fish", "shell"], ["ps1", "shell"],
  ["dockerfile", "terminal"],
  ["env", "document"], ["dotenv", "document"], ["gitignore", "document"], ["lock", "document"],
  ["png", "image"], ["jpg", "image"], ["jpeg", "image"], ["gif", "image"],
  ["webp", "image"], ["bmp", "image"], ["svg", "image"], ["ico", "image"],
  ["build", "build"], ["bazel", "build"], ["bzl", "build"], ["ninja", "build"],
  ["gradle", "build"], ["mk", "build"], ["makefile", "build"],
  ["sha", "hashes"], ["sha1", "hashes"], ["sha256", "hashes"],
  ["md5", "hashes"], ["checksum", "hashes"], ["sum", "hashes"],
  ["pdf", "pdf"],
  ["zip", "folder"], ["gz", "folder"], ["tgz", "folder"], ["tar", "folder"],
]);
const CODEX_COLOR_FILE_ICONS = new Set(["artifact-document", "pdf", "presentation", "spreadsheet"]);
const ui = {
  state: null,
  todoById: new Map(),
  promptById: new Map(),
  fileById: new Map(),
  loading: true,
  error: null,
  editingTodo: null,
  editingPrompt: null,
  editorInitialized: false,
  draggingTodo: null,
  todoDropTarget: null,
  todoDragPreview: null,
  promptPreviewId: null,
  requestId: 0,
  hostRequests: new Map(),
  hostOrigin: null,
  refreshPromise: null,
  pendingRevision: 0,
  refreshShouldReportErrors: false,
  eventSource: null,
  eventReconnectTimer: null,
  editorMissing: false,
  editorSubmitting: false,
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function setLocale(value) {
  const next = normalizeLocale(value);
  if (next === locale) return;
  locale = next;
  document.documentElement.lang = locale;
  if (ui.state) render();
}

function postToHost(message) {
  window.parent.postMessage(message, ui.hostOrigin ?? "*");
}

function indexState(state) {
  ui.todoById = new Map(
    [...state.todos.active, ...state.todos.completed].map((item) => [item.id, item]),
  );
  ui.promptById = new Map(state.prompts.map((item) => [item.id, item]));
  ui.fileById = new Map(state.files.map((item) => [item.id, item]));
}

function showToast(message, tone = "neutral") {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers ?? {}) }
      : options.headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const fallback = payload?.error?.message ?? t("requestFailed", { status: response.status });
    const error = new Error(localizedErrorMessage(payload?.error?.code, fallback, payload?.error?.details));
    error.code = payload?.error?.code;
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function syncEditorMissingState() {
  if (surface !== "editor" || !ui.editorInitialized) return false;
  const draft = editorKind === "todo" ? ui.editingTodo : ui.editingPrompt;
  if (!draft?.id) return false;
  const exists = editorKind === "todo" ? ui.todoById.has(draft.id) : ui.promptById.has(draft.id);
  const nextMissing = !exists;
  const changed = ui.editorMissing !== nextMissing;
  ui.editorMissing = nextMissing;
  return changed;
}

function stateRequest() {
  const query = `surface=${encodeURIComponent(surface)}`;
  if (surface === "editor") {
    return `/api/state?${query}&kind=${encodeURIComponent(editorKind)}&id=${encodeURIComponent(editorId ?? "")}`;
  }
  return `/api/state?${query}`;
}

function changeAffectsSurface(change) {
  if (!change?.reason) return true;
  if (Array.isArray(change.surfaces)) {
    const target = surface === "editor" ? `editor:${editorKind}` : surface;
    if (change.surfaces.includes(target)) return true;
  }
  const domain = String(change.reason).split(":", 1)[0];
  if (surface === "summary") return ["todo", "prompt", "file", "files"].includes(domain);
  if (surface === "editor") return domain === editorKind;
  return domain === (surface === "prompts" ? "prompt" : surface);
}

async function performRefresh() {
  const previousRevision = ui.state?.revision ?? -1;
  const hadState = Boolean(ui.state);
  const hadError = Boolean(ui.error);
  try {
    const next = await api(stateRequest());
    const stateChanged = !ui.state || next.revision > ui.state.revision;
    if (stateChanged) {
      ui.state = next;
      indexState(next);
    }
    ui.error = null;
    ui.loading = false;
    const editorMissingChanged = stateChanged ? syncEditorMissingState() : false;
    if (!hadState || hadError || (stateChanged && (surface !== "editor" || editorMissingChanged))) render();
    return ui.state;
  } catch (error) {
    ui.error = t("temporarilyUnavailable");
    ui.loading = false;
    if (ui.refreshShouldReportErrors) showToast(error.message, "danger");
    if (!hadState || !hadError) render();
    return ui.state;
  } finally {
    ui.refreshShouldReportErrors = false;
    const shouldRetry = ui.pendingRevision > Math.max(previousRevision, ui.state?.revision ?? -1);
    ui.refreshPromise = null;
    if (shouldRetry) queueMicrotask(() => refreshState({ quiet: true }));
  }
}

function refreshState({ quiet = false, revision = 0 } = {}) {
  ui.pendingRevision = Math.max(ui.pendingRevision, Number(revision) || 0);
  if (!quiet) ui.refreshShouldReportErrors = true;
  if (!ui.refreshPromise) ui.refreshPromise = performRefresh();
  return ui.refreshPromise;
}

function connectEvents() {
  clearTimeout(ui.eventReconnectTimer);
  ui.eventReconnectTimer = null;
  ui.eventSource?.close();
  const events = new EventSource("/api/events");
  ui.eventSource = events;
  const handleRevision = (event) => {
    let change;
    try {
      change = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!ui.state || change.revision > ui.state.revision) {
      if (!changeAffectsSurface(change)) {
        ui.pendingRevision = Math.max(ui.pendingRevision, change.revision);
        return;
      }
      refreshState({ quiet: true, revision: change.revision });
    }
  };
  events.addEventListener("ready", handleRevision);
  events.addEventListener("change", (event) => {
    handleRevision(event);
  });
  events.onerror = () => {
    events.close();
    if (ui.eventSource === events) ui.eventSource = null;
    if (!ui.eventReconnectTimer) ui.eventReconnectTimer = setTimeout(connectEvents, 1200);
  };
}

function hostRequest(action, payload = {}, timeoutMs = 8000) {
  if (window.parent === window) {
    return Promise.reject(Object.assign(new Error(t("hostUnavailable")), { code: "HOST_UNAVAILABLE" }));
  }
  const requestId = `codexnotes-${Date.now()}-${++ui.requestId}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ui.hostRequests.delete(requestId);
      reject(Object.assign(new Error(t("hostTimeout")), { code: "HOST_TIMEOUT" }));
    }, timeoutMs);
    ui.hostRequests.set(requestId, { resolve, reject, timeout });
    postToHost({
      type: "codex-personal:host-action",
      feature: "notes",
      surface,
      requestId,
      action,
      payload,
    });
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (ui.hostOrigin && event.origin !== ui.hostOrigin) return;
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (!ui.hostOrigin && event.origin && event.origin !== "null") ui.hostOrigin = event.origin;
  if (message.type === "codex-personal:theme") {
    if (message.locale) setLocale(message.locale);
    const tokens = message.tokens ?? message.theme?.tokens ?? {};
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value === "string" && (name.startsWith("--") || name.startsWith("codex-"))) {
        document.documentElement.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
      }
    }
    if (message.theme?.mode || message.mode) {
      document.documentElement.dataset.theme = message.theme?.mode ?? message.mode;
    }
    reportSummaryMetrics();
    return;
  }
  if (message.type === "codex-personal:focus") {
    requestAnimationFrame(() => app.querySelector("[autofocus]")?.focus());
    return;
  }
  if (message.type !== "codex-personal:host-result" || message.feature !== "notes") return;
  const request = ui.hostRequests.get(message.requestId);
  if (!request) return;
  clearTimeout(request.timeout);
  ui.hostRequests.delete(message.requestId);
  if (message.ok) request.resolve(message.result ?? {});
  else request.reject(Object.assign(new Error(localizedErrorMessage(
    message.error?.code,
    message.error?.message ?? t("hostActionFailed"),
  )), {
    code: message.error?.code ?? "HOST_ACTION_FAILED",
  }));
});

function iconMarkup(name, className = "") {
  return `<span class="icon icon-${name}${className ? ` ${className}` : ""}" aria-hidden="true"></span>`;
}

function domainIconName(key) {
  return DOMAIN_ICON_BY_SURFACE[key] ?? "attachment";
}

function iconName(action) {
  if (action.startsWith("add-")) return action === "add-file" ? "attachment" : "plus";
  if (action.startsWith("delete-")) return "trash-2";
  return {
    "edit-prompt": "edit-pencil",
    "edit-todo": "edit-pencil",
    more: "ellipsis",
    "reveal-file": "external-link",
  }[action] ?? null;
}

function codexFileIconKind(file) {
  const rawPath = String(file.path || file.name || "").toLowerCase();
  if (/[\\/]$/.test(rawPath)) return "folder";
  const name = rawPath.split(/[\\/]/).at(-1) || "";
  if (name === "skill.md") return "skill";
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1)
    : dot === 0 && name.length > 1
      ? name.slice(1)
      : dot === -1
        ? name
        : null;
  const extensionKind = extension ? CODEX_FILE_ICON_BY_EXTENSION.get(extension) : null;
  if (extensionKind) return extensionKind;
  const mimeType = String(file.mimeType || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "document";
  if (mimeType.startsWith("application/pdf")) return "pdf";
  if (mimeType.startsWith("application/zip") || mimeType.startsWith("application/gzip")) return "folder";
  return "file";
}

function fileIconMarkup(kind) {
  if (CODEX_COLOR_FILE_ICONS.has(kind)) {
    return `<img class="file-kind is-color" src="/icons/file-${kind}.svg" alt="" aria-hidden="true">`;
  }
  return iconMarkup(`file-${kind}`, "file-kind");
}

function actionButton(action, label, { quiet = false, title = label } = {}) {
  const icon = quiet ? iconName(action) : null;
  return `<button class="${quiet ? "quiet-button" : "text-button"}" type="button" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(label)}">${icon ? iconMarkup(icon) : escapeHtml(label)}</button>`;
}

function todoRow(todo, { completed = false, draggable = true } = {}) {
  const toggleLabel = completed ? t("restoreTodo") : t("completeTodo");
  return `<li class="row todo-row${completed ? " is-completed" : ""}" data-id="${escapeHtml(todo.id)}" ${draggable && !completed ? 'draggable="true"' : ""}>
    ${draggable && !completed ? '<span class="todo-drop-indicator" aria-hidden="true" role="presentation"></span>' : ""}
    <label class="check-control" title="${escapeHtml(toggleLabel)}">
      <input type="checkbox" data-action="toggle-todo" data-id="${escapeHtml(todo.id)}" aria-label="${escapeHtml(toggleLabel)}" ${completed ? "checked" : ""}>
      <span class="todo-check-icon" aria-hidden="true"></span>
    </label>
    <span class="row-primary todo-label">${escapeHtml(todo.body)}</span>
    <div class="row-actions">
      ${actionButton("edit-todo", t("edit"), { quiet: true })}
      ${actionButton("delete-todo", t("delete"), { quiet: true })}
    </div>
  </li>`;
}

function initializeEditor() {
  if (surface !== "editor" || ui.editorInitialized) return;
  ui.editorInitialized = true;
  if (editorKind === "todo") {
    const todo = ui.todoById.get(editorId);
    ui.editorMissing = Boolean(editorId && !todo);
    ui.editingTodo = {
      id: todo?.id ?? editorId,
      body: todo?.body ?? "",
    };
    return;
  }
  const prompt = ui.promptById.get(editorId);
  ui.editorMissing = Boolean(editorId && !prompt);
  ui.editingPrompt = {
    id: prompt?.id ?? editorId,
    title: prompt?.title ?? "",
    body: prompt?.body ?? "",
  };
}

function modalCommand(label, { action = null, submit = false, shortcut = "", disabled = false } = {}) {
  const behavior = submit
    ? 'type="submit"'
    : `type="button" data-action="${action}"`;
  return `<button ${behavior} class="modal-command${submit ? " is-default" : ""}"${disabled ? " disabled" : ""}>
    <span>${escapeHtml(label)}</span>
    ${shortcut ? `<kbd>${escapeHtml(shortcut)}</kbd>` : ""}
  </button>`;
}

function modalEditorTitle(kind, label) {
  return `<header class="modal-editor-title">
    ${iconMarkup(domainIconName(kind), "modal-editor-title-icon")}
    <span>${escapeHtml(label)}</span>
  </header>`;
}

function syncEditorSubmitState(form) {
  const submit = form?.querySelector('button[type="submit"]');
  const body = form?.elements.namedItem("body");
  if (submit) submit.disabled = !body?.value.trim();
}

function renderEditor() {
  initializeEditor();
  if (ui.editorMissing) {
    return `<main class="editor-modal-shell" data-editor-shell>
      <div class="modal-editor" role="alert">
        ${modalEditorTitle(editorKind, editorKind === "todo" ? t("editTodo") : t("editPrompt"))}
        <div class="status-state is-error"><p>${escapeHtml(t("editorItemMissing"))}</p></div>
        <div class="modal-actions">${modalCommand(t("close"), { action: "close-editor", shortcut: "esc" })}</div>
      </div>
    </main>`;
  }
  if (editorKind === "todo") {
    const draft = ui.editingTodo;
    const editing = Boolean(draft?.id);
    return `<main class="editor-modal-shell" data-editor-shell>
      <form class="modal-editor" data-form="save-todo">
        ${modalEditorTitle("todo", editing ? t("editTodo") : t("newTodo"))}
        <div class="modal-editor-fields is-todo">
          <textarea name="body" aria-label="${escapeHtml(t("todoText"))}" placeholder="${escapeHtml(t("todoPlaceholder"))}" autofocus>${escapeHtml(draft?.body)}</textarea>
        </div>
        <div class="modal-actions">
          ${modalCommand(editing ? t("saveTodo") : t("addTodo"), { submit: true, shortcut: "⌘↩", disabled: !draft?.body.trim() })}
          ${modalCommand(t("cancel"), { action: "close-editor", shortcut: "esc" })}
        </div>
      </form>
    </main>`;
  }
  const draft = ui.editingPrompt;
  const editing = Boolean(draft?.id);
  return `<main class="editor-modal-shell" data-editor-shell>
    <form class="modal-editor" data-form="save-prompt">
      ${modalEditorTitle("prompt", editing ? t("editPrompt") : t("newPrompt"))}
      <div class="modal-editor-fields is-prompt">
        <input name="title" value="${escapeHtml(draft?.title)}" placeholder="${escapeHtml(t("optionalTitle"))}" aria-label="${escapeHtml(t("promptTitle"))}" autocomplete="off">
        <textarea name="body" aria-label="${escapeHtml(t("promptBody"))}" placeholder="${escapeHtml(t("promptPlaceholder"))}" autofocus>${escapeHtml(draft?.body)}</textarea>
      </div>
      <div class="modal-actions">
        ${modalCommand(editing ? t("savePrompt") : t("addPrompt"), { submit: true, shortcut: "⌘↩", disabled: !draft?.body.trim() })}
        ${modalCommand(t("cancel"), { action: "close-editor", shortcut: "esc" })}
      </div>
    </form>
  </main>`;
}

function promptLeading(prompt) {
  return `<span class="summary-leading prompt-star-leading${prompt.starred ? " is-starred" : " is-placeholder"}" aria-hidden="true">
    ${prompt.starred ? iconMarkup("star", "star-mark") : ""}
  </span>`;
}

function promptRow(prompt, { showLeading = true } = {}) {
  return `<li class="row prompt-row" data-id="${escapeHtml(prompt.id)}">
    ${showLeading ? promptLeading(prompt) : ""}
    <button type="button" class="row-primary prompt-label" data-action="insert-prompt" data-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t("insertPrompt"))}">
      <span>${escapeHtml(prompt.summary)}</span>
    </button>
    <div class="row-actions">
      ${actionButton("edit-prompt", t("edit"), { quiet: true })}
      <details class="row-menu">
        <summary class="quiet-button" aria-label="${escapeHtml(t("morePromptActions"))}" title="${escapeHtml(t("morePromptActions"))}">${iconMarkup("ellipsis")}</summary>
        <div class="menu-popover">
          <button type="button" class="menu-item" data-action="toggle-prompt-star" data-id="${escapeHtml(prompt.id)}">
            ${iconMarkup(prompt.starred ? "star-off" : "star", "menu-item-icon")}
            <span>${prompt.starred ? t("unstar") : t("star")}</span>
          </button>
          <button type="button" class="menu-item" data-action="delete-prompt" data-id="${escapeHtml(prompt.id)}">
            ${iconMarkup("trash-2", "menu-item-icon")}
            <span>${escapeHtml(t("delete"))}</span>
          </button>
        </div>
      </details>
    </div>
  </li>`;
}

function fileLeading(file) {
  const kind = codexFileIconKind(file);
  const fallback = fileIconMarkup(kind);
  if (kind !== "image") {
    return `<span class="summary-leading file-leading">${fallback}</span>`;
  }
  return `<span class="summary-leading file-leading has-thumbnail">
    <img class="file-thumbnail" src="/api/files/${encodeURIComponent(file.id)}/preview" alt="" loading="lazy" data-file-thumbnail>
    <span class="file-thumbnail-fallback">${fallback}</span>
  </span>`;
}

function fileRow(file) {
  return `<li class="row file-row" data-id="${escapeHtml(file.id)}" title="${escapeHtml(file.path)}">
    ${fileLeading(file)}
    <button type="button" class="row-primary file-label" data-action="add-file" data-id="${escapeHtml(file.id)}" title="${escapeHtml(t("attachToChat"))}">${escapeHtml(file.name)}</button>
    <div class="row-actions">
      ${actionButton("reveal-file", t("showInFolder"), { quiet: true })}
      ${actionButton("delete-file", t("delete"), { quiet: true })}
    </div>
  </li>`;
}

function emptyRow(label) {
  return `<li class="empty-row">${escapeHtml(label)}</li>`;
}

function summarySection({ key, title, items, addLabel, rows, emptyLabel, totalCount = items.length }) {
  const visible = items.slice(0, SUMMARY_ITEM_LIMIT);
  const summaryCounts = ui.state?.counts;
  const inferredCount = key === "todo"
    ? (summaryCounts ? summaryCounts.todos.active + summaryCounts.todos.completed : items.length)
    : (summaryCounts?.[key] ?? items.length);
  const hasOverflow = totalCount > SUMMARY_ITEM_LIMIT || inferredCount > SUMMARY_ITEM_LIMIT;
  return `<section class="summary-section" data-section="${key}">
    <header class="section-header">
      <span>${title}</span>
      ${actionButton(`add-${key}`, addLabel, { quiet: true, title: addLabel })}
    </header>
    <ul class="flat-list">${visible.length ? visible.map(rows).join("") : emptyRow(emptyLabel)}</ul>
    ${hasOverflow ? `<button type="button" class="view-all" data-action="view-all" data-surface="${key === "todo" ? "todo" : key}">
      ${iconMarkup(domainIconName(key), "view-all-icon")}
      <span class="view-all-label">${escapeHtml(t("viewAll"))}</span>
    </button>` : ""}
  </section>`;
}

function renderSummary() {
  const active = ui.state.todos.active;
  const completed = ui.state.todos.completed;
  const prompts = ui.state.prompts;
  const files = ui.state.files;
  const counts = ui.state.counts ?? {
    todos: { active: active.length, completed: completed.length },
    prompts: prompts.length,
    files: files.length,
  };
  const visibleTodos = active.length >= SUMMARY_ITEM_LIMIT
    ? active.slice(0, SUMMARY_ITEM_LIMIT)
    : [...active, ...completed.slice(0, SUMMARY_ITEM_LIMIT - active.length)];
  return `<div class="summary-shell" data-summary-shell>
    <div class="summary-scroll" data-summary-scroll>
      ${summarySection({
        key: "todo",
        title: t("todo"),
        items: visibleTodos,
        totalCount: active.length + completed.length,
        addLabel: t("addTodo"),
        rows: (item) => todoRow(item, {
          completed: Boolean(item.completedAt),
          draggable: !item.completedAt,
        }),
        emptyLabel: t("noTodo"),
      })}
      ${summarySection({ key: "prompts", title: t("prompts"), items: prompts, addLabel: t("addPrompt"), rows: promptRow, emptyLabel: t("noPrompts") })}
      ${summarySection({ key: "files", title: t("files"), items: files, addLabel: t("pinFiles"), rows: fileRow, emptyLabel: t("noPinnedFiles") })}
    </div>
  </div>`;
}

function pageActionButton(action, label, icon, title = label) {
  return `<button type="button" class="page-action" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
    ${iconMarkup(icon, "page-action-icon")}
    <span>${escapeHtml(label)}</span>
  </button>`;
}

function pageSectionTitle(title, count, action = "") {
  return `<div class="page-section-title">
    <div class="page-section-heading"><h2>${title}</h2><span class="page-section-count">${count}</span></div>
    ${action}
  </div>`;
}

function renderTodoPage() {
  const { active, completed } = ui.state.todos;
  return `<div class="full-shell todo-page">
    <section class="page-section">
      ${pageSectionTitle(t("active"), active.length, pageActionButton("add-todo", t("add"), "plus"))}
      <ul class="flat-list full-list">${active.length ? active.map((item) => todoRow(item)).join("") : emptyRow(t("nothingActive"))}</ul>
    </section>
    <section class="page-section completed-section">
      ${pageSectionTitle(
        t("completed"),
        completed.length,
        completed.length ? pageActionButton("clear-completed", t("deleteAll"), "trash-2", t("deleteCompletedTitle")) : "",
      )}
      <ul class="flat-list full-list">${completed.length ? completed.map((item) => todoRow(item, { completed: true, draggable: false })).join("") : emptyRow(t("noCompletedTodo"))}</ul>
    </section>
  </div>`;
}

function renderPromptsPage() {
  const starred = ui.state.prompts.filter((prompt) => prompt.starred);
  const prompts = ui.state.prompts.filter((prompt) => !prompt.starred);
  return `<div class="full-shell prompts-page">
    <div class="prompts-page-actions">
      ${pageActionButton("add-prompts", t("add"), "plus")}
    </div>
    <section class="page-section">
      ${pageSectionTitle(t("starred"), starred.length)}
      <ul class="flat-list full-list full-prompt-list">${starred.length ? starred.map((prompt) => promptRow(prompt, { showLeading: false })).join("") : emptyRow(t("noStarredPrompts"))}</ul>
    </section>
    <section class="page-section">
      ${pageSectionTitle(t("prompts"), prompts.length)}
      <ul class="flat-list full-list full-prompt-list">${prompts.length ? prompts.map((prompt) => promptRow(prompt, { showLeading: false })).join("") : emptyRow(t("noPrompts"))}</ul>
    </section>
  </div>`;
}

function renderFilesPage() {
  return `<div class="full-shell files-page" data-file-drop-zone>
    <section class="page-section">
      ${pageSectionTitle(t("pinnedFiles"), ui.state.files.length, pageActionButton("add-files", t("add"), "plus", t("pinFiles")))}
      <ul class="flat-list full-list">${ui.state.files.length ? ui.state.files.map(fileRow).join("") : emptyRow(t("noPinnedFiles"))}</ul>
    </section>
  </div>`;
}

function syncPromptRowDensity() {
  if (surface !== "prompts") return;
  cancelAnimationFrame(syncPromptRowDensity.frame);
  syncPromptRowDensity.frame = requestAnimationFrame(() => {
    const measurements = [...app.querySelectorAll(".prompt-row")].map((row) => {
      const label = row.querySelector(".prompt-label");
      if (!label) return null;
      const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
      return { row, multiline: label.getBoundingClientRect().height > lineHeight * 1.5 };
    }).filter(Boolean);
    for (const { row, multiline } of measurements) row.classList.toggle("is-multiline", multiline);
  });
}

function render() {
  if (ui.loading && !ui.state) {
    app.innerHTML = `<div class="status-state"><span class="spinner"></span><p>${escapeHtml(t("loading"))}</p></div>`;
    return;
  }
  if (!ui.state) {
    app.innerHTML = `<div class="status-state is-error"><p>${escapeHtml(ui.error ?? t("unavailable"))}</p><button type="button" class="text-button" data-action="retry">${escapeHtml(t("retry"))}</button></div>`;
    return;
  }
  if (surface === "summary") app.innerHTML = renderSummary();
  else if (surface === "todo") app.innerHTML = renderTodoPage();
  else if (surface === "prompts") app.innerHTML = renderPromptsPage();
  else if (surface === "files") app.innerHTML = renderFilesPage();
  else app.innerHTML = renderEditor();
  syncPromptRowDensity();
  requestAnimationFrame(() => {
    app.querySelector("[autofocus]")?.focus();
    reportSummaryMetrics();
  });
}

function reportSummaryMetrics() {
  if (surface !== "summary" || window.parent === window) return;
  cancelAnimationFrame(reportSummaryMetrics.frame);
  clearTimeout(reportSummaryMetrics.timeout);
  const publish = () => {
    cancelAnimationFrame(reportSummaryMetrics.frame);
    clearTimeout(reportSummaryMetrics.timeout);
    reportSummaryMetrics.frame = null;
    reportSummaryMetrics.timeout = null;
    const shell = app.querySelector("[data-summary-shell]");
    const scroll = app.querySelector("[data-summary-scroll]");
    if (!shell || !scroll) return;
    const shellStyle = getComputedStyle(shell);
    const chrome = Number.parseFloat(shellStyle.paddingTop) + Number.parseFloat(shellStyle.paddingBottom);
    const height = Math.ceil(scroll.scrollHeight + (Number.isFinite(chrome) ? chrome : 0));
    postToHost({
      type: "codex-personal:surface-metrics",
      feature: "notes",
      surface,
      height,
    });
  };
  reportSummaryMetrics.frame = requestAnimationFrame(publish);
  reportSummaryMetrics.timeout = setTimeout(publish, 50);
}

async function mutate(path, options, successMessage = null) {
  try {
    const result = await api(path, options);
    await refreshState({ quiet: true, revision: result?.revision });
    if (successMessage) showToast(successMessage, "success");
    return true;
  } catch (error) {
    showToast(error.message, "danger");
    await refreshState({ quiet: true });
    if (surface !== "editor" && ui.state) render();
    return false;
  }
}

async function openEditorModal(kind, id = null) {
  if (window.parent === window) {
    const url = new URL(location.href);
    url.searchParams.set("surface", "editor");
    url.searchParams.set("kind", kind);
    if (id) url.searchParams.set("id", id);
    else url.searchParams.delete("id");
    window.open(url, "codexnotes-editor", `popup,width=420,height=${kind === "prompt" ? 250 : 198}`);
    return;
  }
  await hostRequest("open-editor-modal", { kind, id });
}

function closeEditor() {
  if (window.parent !== window) {
    postToHost({ type: "codex-personal:close", feature: "notes", surface });
  } else {
    window.close();
  }
}

async function insertPrompt(id) {
  const prompt = ui.promptById.get(id);
  if (!prompt) return;
  try {
    await hostRequest("insert-text", { text: prompt.body });
    await api(`/api/prompts/${encodeURIComponent(id)}/use`, {
      method: "POST",
      body: JSON.stringify({ action: "insert", success: true }),
    });
    await refreshState({ quiet: true });
    showToast(t("insertedAtCaret"), "success");
  } catch (error) {
    showToast(error.message, "danger");
  }
}

function closeOpenPromptMenus(except = null) {
  for (const menu of app.querySelectorAll(".row-menu[open]")) {
    if (menu !== except) menu.open = false;
  }
}

function dismissPromptMenus({ releaseFocus = false } = {}) {
  const focusedMenu = document.activeElement?.closest?.(".row-menu");
  closeOpenPromptMenus();
  if (releaseFocus && focusedMenu && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function postPromptPreview(phase, prompt = null, row = null) {
  if (surface !== "summary" || window.parent === window) return;
  const message = {
    type: "codex-personal:prompt-preview",
    feature: "notes",
    phase,
  };
  if (phase === "show" && prompt && row) {
    const rect = row.getBoundingClientRect();
    message.prompt = {
      id: prompt.id,
      title: prompt.title,
      body: prompt.body,
    };
    message.anchor = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }
  postToHost(message);
}

function hidePromptPreview() {
  if (!ui.promptPreviewId) return;
  ui.promptPreviewId = null;
  postPromptPreview("hide");
}

function showPromptPreviewForRow(row) {
  if (
    surface !== "summary"
    || window.parent === window
    || !window.matchMedia(PROMPT_PREVIEW_POINTER_QUERY).matches
  ) return;
  const id = row?.dataset.id;
  if (!id || ui.promptPreviewId === id) return;
  if (!row.isConnected) return;
  const prompt = ui.promptById.get(id);
  if (!prompt) return;
  hidePromptPreview();
  ui.promptPreviewId = id;
  postPromptPreview("show", prompt, row);
}

function pointerTargetsPromptMenu(event, row) {
  const directMenu = event.target.closest?.(".row-menu");
  if (directMenu && row.contains(directMenu)) return true;
  const trigger = row.querySelector(".row-menu > summary");
  if (!trigger) return false;
  const rect = trigger.getBoundingClientRect();
  return event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom;
}

async function useFile(id) {
  const file = ui.fileById.get(id);
  if (!file) return;
  try {
    const result = await hostRequest("attach-file", { path: file.path, name: file.name }, 12_000);
    const mode = result.mode === "insert-path" ? "insert-path" : "attach";
    await api(`/api/files/${encodeURIComponent(id)}/use`, {
      method: "POST",
      body: JSON.stringify({ action: mode, success: true }),
    });
    await refreshState({ quiet: true });
    showToast(mode === "attach" ? t("addedToComposer") : t("insertedFilePath"), "success");
  } catch (error) {
    if (error.status === 410 || error.code === "FILE_MISSING") await refreshState({ quiet: true });
    showToast(error.message, "danger");
  }
}

async function pickFiles() {
  try {
    const result = await api("/api/files/pick", { method: "POST", body: "{}" });
    await refreshState({ quiet: true });
    if (result.cancelled) return;
    if (result.rejected?.length) {
      showToast(localizedErrorMessage(result.rejected[0].code, result.rejected[0].message), "danger");
    } else if (result.added?.length) showToast(t("filesPinned", { count: result.added.length }), "success");
    else if (result.existing?.length) showToast(t("alreadyPinned"));
  } catch (error) {
    showToast(error.message, "danger");
  }
}

async function pinDroppedFiles(files) {
  let paths = Array.from(files)
    .map((file) => file.path ?? file.absolutePath ?? "")
    .filter((filePath) => filePath.startsWith("/"));
  if (paths.length === 0) {
    try {
      const result = await hostRequest("resolve-file-paths", { files: Array.from(files) });
      paths = result.paths ?? [];
    } catch (error) {
      showToast(error.message, "danger");
      return;
    }
  }
  try {
    const result = await api("/api/files", {
      method: "POST",
      body: JSON.stringify({ paths }),
    });
    await refreshState({ quiet: true });
    if (result.rejected?.length) {
      showToast(localizedErrorMessage(result.rejected[0].code, result.rejected[0].message), "danger");
    } else showToast(t("filesPinned", { count: result.added.length }), "success");
  } catch (error) {
    showToast(error.message, "danger");
  }
}

document.addEventListener("pointerdown", (event) => {
  if (surface === "summary" && !event.target.closest?.(".row-menu")) dismissPromptMenus();
}, true);

app.addEventListener("click", async (event) => {
  hidePromptPreview();
  if (!event.target.closest(".row-menu")) dismissPromptMenus();
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action } = target.dataset;
  const id = target.dataset.id ?? target.closest("[data-id]")?.dataset.id;

  if (action === "retry") return refreshState();
  if (action === "add-todo") {
    try { await openEditorModal("todo"); } catch (error) { showToast(error.message, "danger"); }
    return;
  }
  if (action === "edit-todo") {
    try { await openEditorModal("todo", id); } catch (error) { showToast(error.message, "danger"); }
    return;
  }
  if (action === "delete-todo") {
    await mutate(`/api/todos/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  if (action === "clear-completed") {
    await mutate("/api/todos/completed", { method: "DELETE" });
    return;
  }
  if (action === "add-prompts") {
    try { await openEditorModal("prompt"); } catch (error) { showToast(error.message, "danger"); }
    return;
  }
  if (action === "edit-prompt") {
    try { await openEditorModal("prompt", id); } catch (error) { showToast(error.message, "danger"); }
    return;
  }
  if (action === "close-editor") { closeEditor(); return; }
  if (action === "insert-prompt") { await insertPrompt(id); return; }
  if (action === "toggle-prompt-star") {
    const prompt = ui.promptById.get(id);
    if (prompt) await mutate(`/api/prompts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ starred: !prompt.starred }) });
    return;
  }
  if (action === "delete-prompt") {
    await mutate(`/api/prompts/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  if (action === "add-files") { await pickFiles(); return; }
  if (action === "add-file") { await useFile(id); return; }
  if (action === "reveal-file") {
    try {
      await api(`/api/files/${encodeURIComponent(id)}/reveal`, { method: "POST" });
    } catch (error) {
      showToast(error.message, "danger");
    }
    return;
  }
  if (action === "delete-file") {
    await mutate(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  if (action === "view-all") {
    if (window.parent === window) window.open(`/?surface=${target.dataset.surface}`, "_blank", "noopener");
    else hostRequest("open-detail-tab", { surface: target.dataset.surface }).catch((error) => showToast(error.message, "danger"));
  }
});

app.addEventListener("toggle", (event) => {
  const menu = event.target.closest?.(".row-menu");
  if (!menu) return;
  if (menu.open) {
    hidePromptPreview();
    closeOpenPromptMenus(menu);
  }
}, true);

app.addEventListener("pointerover", (event) => {
  const row = event.target.closest?.(".prompt-row");
  if (!row) return;
  if (pointerTargetsPromptMenu(event, row)) {
    hidePromptPreview();
    return;
  }
  showPromptPreviewForRow(row);
});

app.addEventListener("pointerout", (event) => {
  const row = event.target.closest?.(".prompt-row");
  if (!row) return;
  const next = event.relatedTarget;
  if (next instanceof Node && row.contains(next)) return;
  hidePromptPreview();
});

app.addEventListener("scroll", hidePromptPreview, true);

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.dataset.action !== "toggle-todo") return;
  await mutate(`/api/todos/${encodeURIComponent(target.dataset.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: target.checked }),
  });
});

app.addEventListener("error", (event) => {
  const thumbnail = event.target.closest?.("[data-file-thumbnail]");
  if (!thumbnail) return;
  thumbnail.closest(".file-leading")?.classList.add("is-fallback");
}, true);

app.addEventListener("input", (event) => {
  const editorForm = event.target.closest('[data-form="save-prompt"], [data-form="save-todo"]');
  if (event.target.closest('[data-form="save-prompt"]') && ui.editingPrompt) {
    ui.editingPrompt[event.target.name] = event.target.value;
  }
  if (event.target.closest('[data-form="save-todo"]') && ui.editingTodo) {
    ui.editingTodo.body = event.target.value;
  }
  syncEditorSubmitState(editorForm);
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (ui.editorSubmitting || ui.editorMissing) return;
  const form = event.target;
  ui.editorSubmitting = true;
  form.setAttribute("aria-busy", "true");
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (form.dataset.form === "save-todo") {
    if (!ui.editingTodo?.body.trim()) {
      ui.editorSubmitting = false;
      form.removeAttribute("aria-busy");
      syncEditorSubmitState(form);
      return showToast(t("todoEmpty"), "danger");
    }
    const body = JSON.stringify({ body: ui.editingTodo.body });
    const saved = ui.editingTodo.id
      ? await mutate(`/api/todos/${encodeURIComponent(ui.editingTodo.id)}`, { method: "PATCH", body })
      : await mutate("/api/todos", { method: "POST", body });
    ui.editorSubmitting = false;
    form.removeAttribute("aria-busy");
    if (saved) closeEditor();
    else syncEditorSubmitState(form);
    return;
  }
  if (form.dataset.form === "save-prompt") {
    if (!ui.editingPrompt?.body.trim()) {
      ui.editorSubmitting = false;
      form.removeAttribute("aria-busy");
      syncEditorSubmitState(form);
      return showToast(t("promptEmpty"), "danger");
    }
    const draft = { title: ui.editingPrompt.title, body: ui.editingPrompt.body };
    let saved;
    if (ui.editingPrompt.id) {
      saved = await mutate(`/api/prompts/${encodeURIComponent(ui.editingPrompt.id)}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
    } else {
      saved = await mutate("/api/prompts", { method: "POST", body: JSON.stringify(draft) });
    }
    ui.editorSubmitting = false;
    form.removeAttribute("aria-busy");
    if (saved) {
      ui.editingPrompt = null;
      if (surface === "editor") closeEditor();
      else render();
    } else syncEditorSubmitState(form);
    return;
  }
  ui.editorSubmitting = false;
  form.removeAttribute("aria-busy");
});

function clearTodoDropTarget() {
  ui.todoDropTarget = null;
  const row = app.querySelector(".todo-row[data-drop-position]");
  if (row) delete row.dataset.dropPosition;
}

function setTodoDropTarget(row, position) {
  if (ui.todoDropTarget?.id === row.dataset.id && ui.todoDropTarget.position === position) return;
  const previous = app.querySelector(".todo-row[data-drop-position]");
  if (previous && previous !== row) delete previous.dataset.dropPosition;
  ui.todoDropTarget = { id: row.dataset.id, position };
  row.dataset.dropPosition = position;
}

function todoDropPosition(event, row) {
  const rect = row.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function dragLeavesApp(event) {
  if (event.relatedTarget instanceof Node && app.contains(event.relatedTarget)) return false;
  const rect = app.getBoundingClientRect();
  return event.clientX <= rect.left
    || event.clientX >= rect.right
    || event.clientY <= rect.top
    || event.clientY >= rect.bottom;
}

function clearTodoDragPreview() {
  ui.todoDragPreview?.remove();
  ui.todoDragPreview = null;
}

function moveTodoDragPreview(event) {
  const preview = ui.todoDragPreview;
  if (!preview || (event.clientX === 0 && event.clientY === 0)) return;
  const offsetX = Number(preview.dataset.dragOffsetX);
  const offsetY = Number(preview.dataset.dragOffsetY);
  preview.style.left = `${event.clientX - offsetX}px`;
  preview.style.top = `${event.clientY - offsetY}px`;
}

function setTodoDragPreview(row, event) {
  if (typeof event.dataTransfer?.setDragImage !== "function") return;
  clearTodoDragPreview();
  const rect = row.getBoundingClientRect();
  const preview = document.createElement("div");
  const content = row.cloneNode(true);
  const width = rect.width;
  preview.className = "todo-drag-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.inert = true;
  preview.style.setProperty("--todo-drag-preview-width", `${width}px`);
  preview.style.left = `${rect.left}px`;
  preview.style.top = `${rect.top}px`;
  preview.dataset.dragOffsetX = String(event.clientX - rect.left);
  preview.dataset.dragOffsetY = String(event.clientY - rect.top);
  content.classList.add("todo-drag-preview-content");
  content.removeAttribute("data-id");
  content.removeAttribute("draggable");
  content.removeAttribute("data-drop-position");
  content.querySelector(".todo-drop-indicator")?.remove();
  content.querySelector(".row-actions")?.remove();
  preview.append(content);
  document.body.append(preview);
  ui.todoDragPreview = preview;
  const dragImage = document.createElement("canvas");
  dragImage.width = 1;
  dragImage.height = 1;
  document.body.append(dragImage);
  try {
    event.dataTransfer.setDragImage(dragImage, 0, 0);
  } catch {
    dragImage.remove();
    clearTodoDragPreview();
    return;
  }
  requestAnimationFrame(() => dragImage.remove());
  setTimeout(() => dragImage.remove(), 100);
}

function clearTodoDraggingState() {
  clearTodoDragPreview();
  app.querySelector(".todo-row.is-dragging")?.classList.remove("is-dragging");
  ui.draggingTodo = null;
}

function reorderedTodoIds(ids, draggedId, targetId, position) {
  if (!ids.includes(draggedId) || !ids.includes(targetId) || draggedId === targetId) return ids;
  const reordered = ids.filter((id) => id !== draggedId);
  const targetIndex = reordered.indexOf(targetId);
  const insertAt = targetIndex + (position === "after" ? 1 : 0);
  reordered.splice(insertAt, 0, draggedId);
  return reordered;
}

app.addEventListener("dragstart", (event) => {
  const row = event.target.closest('.todo-row[draggable="true"]');
  if (!row) return;
  clearTodoDropTarget();
  clearTodoDraggingState();
  setTodoDragPreview(row, event);
  ui.draggingTodo = row.dataset.id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.id);
  row.classList.add("is-dragging");
});

app.addEventListener("dragend", () => {
  clearTodoDraggingState();
  clearTodoDropTarget();
});

app.addEventListener("drag", (event) => {
  if (ui.draggingTodo) moveTodoDragPreview(event);
});

app.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    document.body.classList.add("is-file-dragging");
    return;
  }
  if (!ui.draggingTodo) return;
  moveTodoDragPreview(event);
  const target = event.target.closest('.todo-row[draggable="true"]');
  if (!target || target.dataset.id === ui.draggingTodo) {
    clearTodoDropTarget();
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  setTodoDropTarget(target, todoDropPosition(event, target));
});

app.addEventListener("dragleave", (event) => {
  if (!dragLeavesApp(event)) return;
  document.body.classList.remove("is-file-dragging");
  clearTodoDropTarget();
});

app.addEventListener("drop", async (event) => {
  document.body.classList.remove("is-file-dragging");
  if (event.dataTransfer?.files?.length) {
    event.preventDefault();
    clearTodoDropTarget();
    await pinDroppedFiles(event.dataTransfer.files);
    return;
  }
  const target = event.target.closest('.todo-row[draggable="true"]');
  const draggedId = ui.draggingTodo;
  const position = target?.dataset.dropPosition ?? ui.todoDropTarget?.position;
  const targetId = target?.dataset.id;
  if (!draggedId || !targetId || targetId === draggedId || !["before", "after"].includes(position)) return;
  event.preventDefault();
  clearTodoDropTarget();
  clearTodoDraggingState();
  const currentIds = ui.state.todos.active.map((item) => item.id);
  const ids = reorderedTodoIds(currentIds, draggedId, targetId, position);
  if (ids.every((id, index) => id === currentIds[index])) return;
  await mutate("/api/todos/reorder", { method: "POST", body: JSON.stringify({ ids }) });
});

document.addEventListener("keydown", (event) => {
  if (surface === "summary" && event.key === "Escape") {
    const menu = app.querySelector(".row-menu[open]");
    if (menu) {
      event.preventDefault();
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    return;
  }
  if (surface !== "editor") return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeEditor();
    return;
  }
  if (event.key === "Enter" && event.metaKey) {
    event.preventDefault();
    const form = app.querySelector("form");
    const submit = form?.querySelector('button[type="submit"]');
    if (!submit?.disabled) form?.requestSubmit(submit);
    return;
  }
  if (event.key === "Tab") {
    const focusable = [...app.querySelectorAll("input, textarea, button")]
      .filter((element) => !element.disabled && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

if (surface === "summary") {
  window.addEventListener("resize", () => {
    hidePromptPreview();
    reportSummaryMetrics();
  });
  window.addEventListener("blur", () => {
    hidePromptPreview();
    dismissPromptMenus({ releaseFocus: true });
  });
} else if (surface === "prompts") {
  window.addEventListener("resize", syncPromptRowDensity);
}
document.fonts?.ready.then(() => {
  syncPromptRowDensity();
  reportSummaryMetrics();
});

postToHost({ type: "codex-personal:ready", feature: "notes", surface });
refreshState();
connectEvents();
