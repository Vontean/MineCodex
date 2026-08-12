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
  const isCard = element.classList.contains("rounded-2xl")
    && element.classList.contains("border")
    && element.classList.contains("bg-token-main-surface-primary");
  if (!isCard) return false;
  const titleMatch = /out of Codex and Work usage/i.test(text)
    || /out of Codex messages/i.test(text)
    || /Codex message usage limit reached/i.test(text);
  const actionMatch = /Upgrade to Pro|Add Credits/i.test(text);
  return titleMatch && actionMatch;
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

hideVisibleBanners();
const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      hideVisibleBanners(node);
    }
  }
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

return () => {
  observer.disconnect();
  for (const element of document.querySelectorAll(`[${HIDDEN_MARKER}]`)) {
    element.removeAttribute(HIDDEN_MARKER);
    element.style.display = "";
  }
};
