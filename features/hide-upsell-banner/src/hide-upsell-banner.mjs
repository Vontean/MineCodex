// page-script feature body.
// Injected by CodexRuntimeHost into the Codex renderer through
// `new Function("signal", "window", "document", "MutationObserver", source)`,
// so this file is a function body: it runs once with those bindings in scope
// and may return a cleanup function. It hides the "You're out of Codex and
// Work usage" upsell banner that the desktop app renders above the composer
// when the account rate-limit snapshot marks the plan as exhausted. It never
// touches the rate-limit query path: `account/rateLimits/read` and the
// app-server JSON-RPC traffic stay intact.
const HIDDEN_MARKER = "data-codex-upsell-banner-hidden";
const hiddenBanners = new Map();
let disposed = false;

function isUpsellBanner(element) {
  if (!(element instanceof window.HTMLElement)) return false;
  const text = (element.textContent ?? "").trim();
  if (!text) return false;
  const title = (
    element.querySelector("h1, h2, h3, [role='heading']")?.textContent
    ?? text.split("\n", 1)[0]
  ).trim();
  return /out of Codex(?: and Work)? usage/i.test(title)
    || /out of Codex messages/i.test(title)
    || /Codex (?:message )?usage limit reached/i.test(title)
    || /Codex.*(?:用量|使用量|使用额度|额度|消息).*(?:用完|用尽|耗尽|已达|达到.*上限|上限)/i.test(title)
    || /(?:已达到|达到|已用完|已用尽|耗尽).{0,20}Codex.{0,20}(?:用量|使用量|额度|消息|上限)/i.test(title)
    // 通用标题须同时具有原生用量横幅的关闭语义，不能仅按耗尽文案隐藏通知。
    || (/^you['’]re out of usage[.!]?$/i.test(title)
      && [...element.querySelectorAll("button[aria-label]")].some(button =>
        /^(?:Dismiss usage banner|不再显示用量横幅|關閉用量橫幅|關閉用量橫額)$/i.test(button.getAttribute("aria-label") ?? "")));
}

function hideBanner(element) {
  if (!hiddenBanners.has(element)) hiddenBanners.set(element, {
    display:element.style.getPropertyValue("display"), priority:element.style.getPropertyPriority("display"),
  });
  if (!element.hasAttribute(HIDDEN_MARKER)) element.setAttribute(HIDDEN_MARKER, "");
  // 标记不代表样式仍有效；只在需要时写入，避免 observer 自触发循环。
  if (element.style.display !== "none") element.style.display = "none";
}

function restoreBanner(element) {
  const original = hiddenBanners.get(element);
  element.removeAttribute(HIDDEN_MARKER);
  if (element.style.display === "none") {
    if (original.display) element.style.setProperty("display", original.display, original.priority);
    else element.style.removeProperty("display");
  }
  hiddenBanners.delete(element);
}

function hideVisibleBanners(root = document) {
  for (const element of hiddenBanners.keys()) if (!element.isConnected || !isUpsellBanner(element)) restoreBanner(element);
  if (root.matches?.("aside") && isUpsellBanner(root)) hideBanner(root);
  for (const element of root.querySelectorAll("aside")) {
    if (isUpsellBanner(element)) hideBanner(element);
  }
}

let rescanQueued = false;
function rescanBanners() {
  // React can render the banner in stages: an empty <aside> shell first, then
  // text and style updates on the same element. A childList-only observer
  // misses those later mutations, so every mutation triggers a full rescan
  // instead of only inspecting freshly added nodes.
  if (rescanQueued) return;
  rescanQueued = true;
  queueMicrotask(() => {
    rescanQueued = false;
    if (!disposed) hideVisibleBanners(document);
  });
}

hideVisibleBanners();
const observer = new MutationObserver(() => {
  rescanBanners();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class", "hidden", "aria-label"],
  characterData: true,
});

config.registerSelfCheck?.(() => ({state:hiddenBanners.size ? "available" : "not-applicable",reason:hiddenBanners.size ? null : "no-usage-banner",
  checks:[...hiddenBanners.keys()].filter(node=>node.isConnected).map(()=>({name:"usage-banner-hidden",available:true}))}));
return () => {
  disposed = true;
  observer.disconnect();
  for (const element of hiddenBanners.keys()) restoreBanner(element);
};
