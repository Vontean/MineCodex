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

function isUpsellBanner(element) {
  if (!(element instanceof window.HTMLElement)) return false;
  const text = (element.innerText ?? "").trim();
  if (!text) return false;
  const title = (
    element.querySelector("h1, h2, h3, [role='heading']")?.innerText
    ?? text.split("\n", 1)[0]
  ).trim();
  return /out of Codex(?: and Work)? usage/i.test(title)
    || /out of Codex messages/i.test(title)
    || /Codex (?:message )?usage limit reached/i.test(title)
    || /Codex.*(?:用量|使用量|使用额度|额度|消息).*(?:用完|用尽|耗尽|已达|达到.*上限|上限)/i.test(title)
    || /(?:已达到|达到|已用完|已用尽|耗尽).{0,20}Codex.{0,20}(?:用量|使用量|额度|消息|上限)/i.test(title);
}

function hideBanner(element) {
  if (element.hasAttribute(HIDDEN_MARKER)) return;
  element.setAttribute(HIDDEN_MARKER, "");
  element.style.display = "none";
}

function hideVisibleBanners(root = document) {
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
    hideVisibleBanners(document);
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
  attributeFilter: ["style", "class", "hidden"],
  characterData: true,
});

return () => {
  observer.disconnect();
  for (const element of document.querySelectorAll(`[${HIDDEN_MARKER}]`)) {
    element.removeAttribute(HIDDEN_MARKER);
    element.style.display = "";
  }
};
