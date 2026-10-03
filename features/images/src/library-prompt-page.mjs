// 原生 Library 图片详情的提示词增强；Image Gen 由同功能的独立安装器承载。
const PANEL_ID = "minecodex-library-prompt";
const zh = () => (document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("zh");
const label = (en, cn) => zh() ? cn : en;
let mounted = null;
let localImageSource = null;
const libraryApi=createLibraryApi();
let scheduled = false;
let candidate = null;

const libraryViewer=createLibraryViewerAdapter(config.codex,{readViewer:header=>localImageSource?.readViewer(header)});
const libraryImage=libraryViewer.read;
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
  record.panel.hidden = true;

  if (restoreFocus && record.button.isConnected) record.button.focus();
}

function showPrompt(record) {
  record.panel.hidden = false;

  record.close.focus();
}

async function resolvePrompt(file, request) {
  request.signal.throwIfAborted();
  if(file.kind === "local") return config.requestHostAction("local-image-source",{operation:"prompt",id:file.id});
  if(!file.origination_thread_id || !file.origination_message_id)return null;
  const conversation=await libraryApi.conversation(file.origination_thread_id,AbortSignal.any([signal,request.signal,AbortSignal.timeout(25_000)]));
  return promptFromConversation(file,conversation);
}

function unmount() {
  if (!mounted) return;
  closePanel(mounted);
  clearTimeout(mounted.copyTimer);
  mounted.menuItem?.remove();
  mounted.menuCleanup?.();
  mounted.panel.remove();
  mounted = null;
}

function syncMenu(record) {
  const anchor = libraryViewer.promptMenu(record.file);
  if (record.menuItem?.isConnected && record.menuItem.parentElement === anchor?.original.parentElement) return;
  record.menuItem?.remove();
  record.menuCleanup?.();
  record.menuItem = null;
  record.menuCleanup = null;
  if (!anchor) return;
  const {menu,original} = anchor;
  const item = element("div", original.className);
  item.setAttribute("role", "menuitem");
  item.tabIndex = -1;
  item.dataset.minecodexLibraryPrompt = "menuitem";
  const row = original.firstElementChild.cloneNode(true);
  row.querySelector(".truncate").textContent = label("View prompts", "查看提示词");
  // 图标随 Images 注入，不依赖 Prompts 导航入口是否显示。
  const glyph = new DOMParser().parseFromString(promptGlyphSource,"image/svg+xml").documentElement;
  for (const svg of row.querySelectorAll("svg")) {
    const icon = glyph.cloneNode(true);
    icon.setAttribute("width", svg.getAttribute("width"));
    icon.setAttribute("height", svg.getAttribute("height"));
    icon.setAttribute("class", svg.getAttribute("class") ?? "");
    svg.replaceWith(icon);
  }
  item.append(row);
  original.before(item);
  record.menuItem = item;
  const open = event => {
    event.preventDefault();
    event.stopPropagation();
    menu.addEventListener("focusScope.autoFocusOnUnmount", event => {
      event.preventDefault();
      if (mounted?.identity === record.identity) mounted.close.focus();
    }, {once:true});
    // 原生菜单在 document capture 处理 Escape；阻止它再冒泡关闭图片视口。
    const stopEscape = event => event.stopPropagation();
    menu.addEventListener("keydown", stopEscape, {once:true});
    menu.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true,cancelable:true}));
    menu.removeEventListener("keydown", stopEscape);
    setTimeout(() => {
      // 原生关闭菜单可能重建工具栏；把打开意图交给同一图片的新实例。
      if (mounted?.identity === record.identity) showPrompt(mounted);
    }, 0);
  };
  item.addEventListener("click", open);
  item.addEventListener("pointermove", () => item.focus());
  const keyboard = event => {
    if (event.target === item && ["Enter", " "].includes(event.key)) return open(event);
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    // 仅补上未注册到原生 collection 的注入项，其他按键仍交给原生菜单。
    if (index >= 0 && (document.activeElement === item || next === item)) {
      event.preventDefault();event.stopImmediatePropagation();next.focus();
    }
  };
  menu.addEventListener("keydown", keyboard, true);
  record.menuCleanup = () => menu.removeEventListener("keydown", keyboard, true);
}

async function scan() {
  scheduled = false;
  if (signal.aborted) return;
  const header = [...document.querySelectorAll('[data-testid="viewer-header"]')].find(header => header.getBoundingClientRect().width > 0 && libraryImage(header));
  const file = header && libraryImage(header);
  const toolbar = header && libraryViewer.toolbar(header);
  const identity = file && JSON.stringify(file);
  if (candidate?.header === header && candidate?.identity === identity
    && candidate?.zoom === toolbar?.zoom && candidate?.host === toolbar?.host
    && (!mounted || (mounted.button.isConnected && mounted.panel.isConnected))) {
    if (mounted) {syncMenu(mounted);openPendingLocalPrompt();}
    return;
  }
  candidate?.request.abort();
  unmount();
  candidate = null;
  // 等原生图片工具栏就绪再解析；否则早到的结果会把同图后续扫描短路。
  if (!file || !toolbar || (file.kind !== "local" && (!file.origination_thread_id || !file.origination_message_id))) return;
  const next = { header, identity, zoom:toolbar.zoom, host:toolbar.host, request: new AbortController() };
  candidate = next;
  const {host,trigger:button} = toolbar;
  // 对齐当前原生 File info 的实体材质、尺寸和内容区。
  const panel = element("aside", "absolute end-2 bottom-2 z-40 flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-elevated-secondary electron:elevation-prominent text-default select-none");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-label", label("Image prompt", "图片提示词"));
  panel.hidden = true;
  panel.style.setProperty("-webkit-app-region", "no-drag");
  // File info 的 pt-13 与包装层 pt-px 合计；窄视口保留两侧 gutter。
  panel.style.top = "calc(var(--mcx-spacing) * 13 + 1px)";
  panel.style.width = "calc(var(--mcx-spacing) * 74)";
  panel.style.maxWidth = "calc(100% - var(--mcx-spacing) * 4)";
  const heading = element("div", "flex h-11 shrink-0 items-center justify-between gap-2 py-1 ps-4 pe-2");
  const close = element("button", "no-drag cursor-interaction select-none disabled:cursor-default disabled:opacity-40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 flex border gap-1 rounded-full text-default bg-text/5 not-disabled:not-aria-disabled:hover:bg-text/10 border-transparent button-toolbar py-0 text-sm leading-[18px] aspect-square shrink-0 items-center justify-center !px-0");
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
    const text = failed ? label("Try copying again", "重试复制") : copied ? label("Copied", "已复制") : record?.prompt?.kind === "request" ? label("Copy original request", "复制原始请求") : label("Copy prompt", "复制提示词");
    copy.setAttribute("data-minecodex-tooltip", text);
    copy.setAttribute("aria-label", text);
    copy.replaceChildren(copyGlyph(copied));
  }
  actions.append(copy, close);
  const title = element("span", "text-base font-semibold text-default select-none", label("Prompt", "提示词"));
  const titleHeading = element("h2", "min-w-0 flex-1 truncate");
  titleHeading.append(title);
  heading.append(titleHeading, actions);
  const body = element("div", "min-h-0 flex-1 overflow-y-auto px-3 py-4");
  panel.append(heading, body);
  host.append(panel);
  const record = { header, file, identity, button, panel, body, close, copy, prompt: null, state: "loading", request: next.request,
    refreshLocale() {
      if (record.menuItem) record.menuItem.querySelector(".truncate").textContent = label("View prompts", "查看提示词");
      panel.setAttribute("aria-label", label("Image prompt", "图片提示词"));
      close.setAttribute("aria-label", label("Close prompt", "关闭提示词"));
      title.textContent = label("Prompt", "提示词");
      copyFeedback();
      renderBody();
    },
  };
  function renderBody() {
    body.replaceChildren();
    body.setAttribute("aria-busy", String(record.state === "loading"));
    copy.disabled = record.state !== "ready";
    copyFeedback();
    if (record.state === "loading") {
      const skeleton = element("div", "flex flex-col gap-2 px-1");
      skeleton.setAttribute("aria-hidden", "true");
      for (const width of ["100%", "92%", "100%", "68%"]) {
        const line = element("div", "h-3 rounded-full bg-text/5");
        line.style.width = width;
        skeleton.append(line);
      }
      body.append(element("span", "sr-only", label("Loading prompt", "正在加载提示词")), skeleton);
    } else if (record.state === "ready") {
      if (record.prompt.kind === "request") {
        body.append(element("p", "px-1 pb-4 text-sm leading-5 text-secondary", label("The generation prompt is unavailable. The original request is shown below.", "未获取到生成提示词，以下提供用户原始请求。")));
        body.append(element("h3", "px-1 pb-2 text-sm font-semibold text-default", label("Original request", "原始请求")));
      }
      body.append(element("p", "px-1 text-sm leading-5 text-default whitespace-pre-wrap break-words select-text", record.prompt.text));
    } else {
      const message = record.state === "empty" ? label("Native data does not provide the generation prompt for this image", "原生数据未提供这张图片的生成提示词") : label("Could not load the prompt", "提示词加载失败");
      body.append(element("p", "px-1 text-sm leading-5 text-secondary", message));
      if (record.state === "error") {
        const retry = element("button", "mt-3 rounded-full border border-default px-3 py-1 text-sm text-default hover:bg-primary-ghost-hover", label("Try again", "重试"));
        retry.type = "button";
        retry.addEventListener("click", loadPrompt);
        body.append(retry);
      }
    }
  }
  async function loadPrompt() {
    record.state = "loading";
    renderBody();
    try {
      const prompt = await resolvePrompt(file, next.request);
      // 换图或卸载后不写回；关闭面板仍可继续预取。
      if (signal.aborted || candidate !== next || mounted !== record || !header.isConnected) return;
      record.prompt = prompt;
      record.state = prompt?.text ? "ready" : "empty";
    } catch {
      if (signal.aborted || candidate !== next || mounted !== record || next.request.signal.aborted) return;
      record.state = "error";
    }
    renderBody();
  }
  mounted = record;
  renderBody();
  openPendingLocalPrompt();
  copy.addEventListener("click", async () => {
    if (record.state !== "ready") return;
    try {
      await navigator.clipboard.writeText(record.prompt.text);
      if (mounted !== record) return;
      copyFeedback(true);
    } catch {
      if (mounted !== record) return;
      copyFeedback(false, true);
    }
    clearTimeout(record.copyTimer);
    record.copyTimer = setTimeout(() => copyFeedback(), 2000);
  });
  syncMenu(record);
  close.addEventListener("click", () => closePanel(record, true));
  await loadPrompt();
}

function openPendingLocalPrompt(){
  if(mounted?.file.kind!=="local" || localImageSource?.pendingPrompt()!==mounted.file.id)return;
  localImageSource.consumePrompt();showPrompt(mounted);
}
function localPromptRequested(){openPendingLocalPrompt();void scan();}
document.addEventListener("minecodex:image-prompt",localPromptRequested);
const localeObserver = new MutationObserver(() => mounted?.refreshLocale());
localeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["lang"] });
localImageSource = installLocalImageSource(config, signal, createImageSourcesAdapter(config.codex), createNativeImageSource(config.codex, {
  requestHostAction:config.requestHostAction, libraryApi, createCloudImageActions, promptGlyphSource, signal,
}));
config.registerSelfCheck?.(() => {
  const source=localImageSource.selfCheck();
  if (source.state !== "not-applicable") return source;
  const header=document.querySelector('[data-testid="viewer-header"]');
  if (!header || !libraryImage(header)) return source;
  const available=Boolean(mounted?.button.isConnected);
  return {state:available ? "available" : "unknown",reason:available ? null : "image-viewer-mount-pending",
    checks:[{name:"image-viewer-anchor",available:true},{name:"prompt-control",available}],scopes:[{name:"image-viewer",element:header}]};
});
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
let cleaned = false;
const cleanup = () => {if(cleaned)return;cleaned=true;document.removeEventListener("minecodex:image-prompt",localPromptRequested);candidate?.request.abort();candidate=null;observer.disconnect();localeObserver.disconnect();document.removeEventListener("keydown",escape,true);unmount();localImageSource.cleanup();};
signal.addEventListener("abort", cleanup, { once: true });
scan();
return cleanup;
