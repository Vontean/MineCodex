// 仅增强原生 Library 图片详情；不创建第二个图库或侧栏入口。
const PANEL_ID = "minecodex-library-prompt";
const zh = () => (document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("zh");
const label = (en, cn) => zh() ? cn : en;
let mounted = null;
let apiPromise = null;
let scheduled = false;
let candidate = null;

function libraryImage(header) {
  const key = Object.keys(header).find(key => key.startsWith("__reactFiber$"));
  let fiber = key ? header[key] : null;
  let selected = null;
  for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
    const file = fiber.memoizedProps?.file;
    if (!file || !/^libfile_[\w-]+$/.test(file.id ?? "") || !file.mime_type?.startsWith("image/")) continue;
    if (selected && selected.id !== file.id) break;
    selected = file;
    if (file.origination_thread_id && file.origination_message_id) break;
  }
  if (!selected) return null;
  // 只保留关联字段，签名下载地址和图片数据不进入插件。
  return Object.fromEntries(["id", "file_id", "current_version_number", "origination_thread_id", "origination_message_id"].map(key => [key, selected[key]]));
}

async function nativeApi() {
  if (!apiPromise) apiPromise = (async () => {
    const initialUrl = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
      .map(element => element.href || element.src).find(url => /\/app-initial-[^/]+\.js/.test(url));
    if (!initialUrl) throw new Error("Library API unavailable");
    const initialSource = await (await fetch(initialUrl, { signal })).text();
    const metadataAsset = initialSource.match(/library-file-metadata-[\w-]+\.js/)?.[0];
    if (!metadataAsset) throw new Error("Library metadata unavailable");
    const metadataUrl = new URL(metadataAsset, initialUrl).href;
    const source = await (await fetch(metadataUrl, { signal })).text();
    const apiLocal = source.match(/([\w$]+)\.safePost\(`\/files\/library`/)?.[1];
    const imports = [...source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g)]
      .find(match => match[1].split(",").some(binding => binding.trim().split(/\s+as\s+/).at(-1) === apiLocal));
    const apiExport = imports?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)).find(parts => parts.at(-1) === apiLocal)?.[0];
    const initLocal = source.match(/function ([\w$]+)\(\)\{return\(\1=/)?.[1];
    const exports = source.match(/export\{([^}]+)\}/)?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)) ?? [];
    const initExport = exports.find(parts => parts[0] === initLocal)?.at(-1);
    const metadata = await import(metadataUrl);
    if (typeof metadata[initExport] !== "function" || !apiExport) throw new Error("Library API contract changed");
    metadata[initExport]();
    const api = (await import(new URL(imports[2], metadataUrl).href))[apiExport];
    if (typeof api?.safeGet !== "function") throw new Error("Library API unavailable");
    return api;
  })().catch(error => { apiPromise = null; throw error; });
  return apiPromise;
}

function promptFromConversation(file, conversation) {
  const node = conversation.mapping?.[file.origination_message_id];
  const part = node?.message?.content?.parts?.find(part => part && typeof part === "object"
    && part.content_type === "image_asset_pointer"
    && [file.file_id, `sediment://${file.file_id}`].includes(part.asset_pointer));
  if (!part || !["assistant", "tool"].includes(node.message.author?.role)
    || !(part.metadata?.generation?.gen_id || part.metadata?.dalle?.gen_id)) return null;
  const prompt = part.metadata?.dalle?.prompt;
  if (typeof prompt === "string" && prompt.trim()) return { text: prompt, kind: "generation" };
  let ancestor = conversation.mapping[node.parent];
  const visited = new Set();
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    if (ancestor.message?.author?.role === "user") {
      const text = ancestor.message.content?.parts?.filter(part => typeof part === "string").join("\n");
      return text?.trim() ? { text, kind: "request" } : null;
    }
    ancestor = conversation.mapping[ancestor.parent];
  }
  return null;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 复用旧 Images 的 Lucide copy/check 图形，统一为 16px 图标按钮。
function copyGlyph(copied = false) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, value);
  svg.innerHTML = copied
    ? '<path d="m20 6-11 11-5-5"></path>'
    : '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>';
  return svg;
}

function closePanel(record, restoreFocus = false) {
  record.request?.abort();
  record.request = null;
  record.panel.hidden = true;
  record.button.setAttribute("aria-expanded", "false");
  if (restoreFocus && record.button.isConnected) record.button.focus();
}

function showPrompt(record) {
  record.panel.hidden = false;
  record.button.setAttribute("aria-expanded", "true");
  record.close.focus();
}

async function resolvePrompt(file, request) {
  if (!file.origination_thread_id || !file.origination_message_id) return null;
  const api = await nativeApi();
  request.signal.throwIfAborted();
  const conversation = await api.safeGet("/conversation/{conversation_id}", {
    parameters: { path: { conversation_id: file.origination_thread_id } },
    signal: AbortSignal.any([signal, request.signal, AbortSignal.timeout(25_000)]),
  });
  return promptFromConversation(file, conversation);
}

function unmount() {
  if (!mounted) return;
  closePanel(mounted);
  clearTimeout(mounted.copyTimer);
  mounted.button.remove();
  mounted.panel.remove();
  mounted = null;
}

async function scan() {
  scheduled = false;
  if (signal.aborted) return;
  const header = [...document.querySelectorAll('[data-testid="viewer-header"]')].find(header => header.getBoundingClientRect().width > 0 && libraryImage(header));
  const file = header && libraryImage(header);
  const identity = file && JSON.stringify(file);
  if (candidate?.header === header && candidate?.identity === identity
    && (!mounted || (mounted.button.isConnected && mounted.panel.isConnected))) return;
  candidate?.request.abort();
  unmount();
  candidate = null;
  if (!file) return;
  const next = { header, identity, request: new AbortController() };
  candidate = next;
  let prompt;
  try { prompt = await resolvePrompt(file, next.request); }
  catch { return; }
  // 异步结果只能写回当前图片；没有提示词时不展示入口。
  if (!prompt || signal.aborted || candidate !== next || !header.isConnected) return;
  // 缩放项在图片详情中是百分比菜单；沿用它的胶囊类，不固定构建 hash。
  const zoom = [...header.querySelectorAll('button[aria-haspopup="menu"]')].find(button => /^\d+(?:\.\d+)?%$/.test(button.textContent.trim()));
  const group = zoom?.parentElement?.parentElement;
  const host = header.closest('[role="presentation"]');
  if (!zoom || !group || !host) return;
  const capsuleClass = zoom.className.split(/\s+/).filter(name => !/^_(?:dropdown|zoom)_/.test(name)).join(" ");
  const button = element("button", capsuleClass, label("Prompt", "提示词"));
  button.type = "button";
  button.dataset.minecodexLibraryPrompt = "trigger";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", PANEL_ID);
  button.style.width = "max-content";
  button.style.minWidth = "0";
  button.style.flex = "0 0 auto";
  button.style.paddingInline = "calc(var(--spacing) * 3)";
  group.prepend(button);
  // 对齐原生 Library Version history 的面板、标题和内容区 token。
  const panel = element("aside", "absolute inset-x-2 top-toolbar bottom-2 z-30 ms-auto mt-2 flex max-w-75 flex-col overflow-hidden rounded-2xl border border-default bg-surface shadow-lg select-none");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-label", label("Image prompt", "图片提示词"));
  panel.hidden = true;
  panel.style.setProperty("-webkit-app-region", "no-drag");
  panel.style.paddingBottom = "calc(var(--spacing) * 3)";
  const heading = element("div", "flex items-center justify-between py-2 ps-4 pe-2");
  const close = element("button", "flex size-8 shrink-0 items-center justify-center rounded-full text-default hover:bg-primary-ghost-hover focus-visible:outline-ring");
  close.type = "button";
  close.setAttribute("aria-label", label("Close prompt", "关闭提示词"));
  // 直接复用原生关闭图标，避免手绘近似图形。
  const nativeClose = [...header.querySelectorAll("button")].at(-1)?.querySelector("svg");
  if (nativeClose) close.append(nativeClose.cloneNode(true));
  else close.textContent = "×";
  const actions = element("div", "flex items-center gap-1");
  const copy = element("button", close.className);
  copy.type = "button";
  function copyFeedback(copied = false, failed = false) {
    const text = failed ? label("Try copying again", "重试复制") : copied ? label("Copied", "已复制") : label("Copy prompt", "复制提示词");
    copy.title = text;
    copy.setAttribute("aria-label", text);
    copy.replaceChildren(copyGlyph(copied));
  }
  copyFeedback();
  actions.append(copy, close);
  heading.append(element("span", "text-base font-semibold text-default", label("Prompt", "提示词")), actions);
  const body = element("div", "min-h-0 flex-1 overflow-y-auto px-3");
  body.style.paddingTop = "var(--spacing)";
  body.append(
    element("p", "px-1 text-sm leading-5 text-default whitespace-pre-wrap break-words select-text", prompt.text),
  );
  panel.append(heading, body);
  host.append(panel);
  const record = { header, file, identity, button, panel, body, close, request: null,
    refreshLocale() {
      button.textContent = label("Prompt", "提示词");
      panel.setAttribute("aria-label", label("Image prompt", "图片提示词"));
      close.setAttribute("aria-label", label("Close prompt", "关闭提示词"));
      heading.firstElementChild.textContent = label("Prompt", "提示词");
      copyFeedback();
    },
  };
  mounted = record;
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
      if (mounted !== record) return;
      copyFeedback(true);
    } catch {
      if (mounted !== record) return;
      copyFeedback(false, true);
    }
    clearTimeout(record.copyTimer);
    record.copyTimer = setTimeout(() => copyFeedback(), 2000);
  });
  button.addEventListener("click", () => panel.hidden ? showPrompt(record) : closePanel(record));
  close.addEventListener("click", () => closePanel(record, true));
}

const localeObserver = new MutationObserver(() => mounted?.refreshLocale());
localeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(scan);
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "data-state", "inert"] });
function escape(event) {
  if (event.key !== "Escape" || !mounted || mounted.panel.hidden) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closePanel(mounted, true);
}
document.addEventListener("keydown", escape, true);
const cleanup = () => { candidate?.request.abort(); candidate = null; observer.disconnect(); localeObserver.disconnect(); document.removeEventListener("keydown", escape, true); unmount(); };
signal.addEventListener("abort", cleanup, { once: true });
scan();
return cleanup;
