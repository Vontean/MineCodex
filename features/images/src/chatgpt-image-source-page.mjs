const MAX_BYTES = 32 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MARKER_SELECTORS = [
  "[data-image-generation-result]",
  "[data-generated-image]",
  '[data-testid="image-generation-result"]',
  '[data-testid="generated-image"]',
  '[data-testid="image-generation"]',
];

function importUrl() {
  try {
    const origin = new URL(config?.serviceOrigin);
    if (
      origin.protocol !== "http:"
      || !LOOPBACK_HOSTS.has(origin.hostname)
      || origin.username
      || origin.password
    ) return null;
    return new URL("/api/import-generated-image", origin.origin).href;
  } catch {
    return null;
  }
}

const IMPORT_URL = importUrl();
if (!IMPORT_URL) return () => {};

function sendImport(payload) {
  if (
    typeof config?.bindingName === "string"
    && typeof config?.bindingToken === "string"
    && typeof config?.featureId === "string"
    && typeof window[config.bindingName] === "function"
  ) {
    window[config.bindingName](JSON.stringify({
      token: config.bindingToken,
      featureId: config.featureId,
      requestId: `${payload.itemId}:${Date.now()}`,
      action: "import-generated-image",
      payload,
    }));
    return Promise.resolve();
  }
  return window.fetch(IMPORT_URL, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  }).then((result) => {
    if (!result.ok) throw new Error(`Images import returned ${result.status}`);
  });
}

function sourceKind() {
  const selectedConversation = document.querySelector?.('[role="button"][aria-current="page"]');
  const selectedLabel = selectedConversation?.textContent?.trim() ?? "";
  if (/work$/i.test(selectedLabel)) return "work";
  if (/chat$/i.test(selectedLabel)) return "chat";
  const active = Array.from(document.querySelectorAll('[aria-selected="true"], [data-state="active"]'))
    .map((element) => `${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`)
    .join(" ");
  const context = `${window.location.pathname} ${active}`.toLowerCase();
  if (/\bwork\b/.test(context)) return "work";
  if (/\bchat\b/.test(context)) return "chat";
  return null;
}

function selectedConversationTitle() {
  const label = document.querySelector?.('[role="button"][aria-current="page"]')?.textContent?.trim() ?? "";
  return label.replace(/(?:chat|work)$/i, "").trim() || null;
}

function generatedGalleryMetadata(element) {
  const preview = element.closest?.('[data-testid="generated-image-preview"]');
  const gallery = preview?.closest?.('[data-testid="generated-image-gallery"]');
  if (!gallery) return null;

  const previews = Array.from(gallery.querySelectorAll?.('[data-testid="generated-image-preview"] img') ?? []);
  const imageIndex = previews.indexOf(element);
  if (imageIndex < 0) return null;

  const fiberKey = Object.getOwnPropertyNames(gallery).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? gallery[fiberKey] : null;
  for (let depth = 0; fiber && depth < 8; depth += 1, fiber = fiber.return) {
    for (const props of [fiber.pendingProps, fiber.memoizedProps]) {
      if (!props || !Array.isArray(props.images) || typeof props.conversationId !== "string") continue;
      const image = props.images[imageIndex];
      const itemId = typeof image?.id === "string" ? image.id : null;
      if (!itemId || typeof image.src !== "string" || !image.src.startsWith("sediment://file_")) return null;
      return {
        itemId,
        conversationId: props.conversationId,
        conversationTitle: selectedConversationTitle(),
      };
    }
  }
  return null;
}

function closestValue(element, attribute) {
  return element.closest?.(`[${attribute}]`)?.getAttribute(attribute)?.trim() || null;
}

function descriptor(element) {
  const source = element.currentSrc || element.src || "";
  let protocol;
  try { protocol = new URL(source, window.location.href).protocol.slice(0, -1); } catch { protocol = null; }
  const gallery = generatedGalleryMetadata(element);
  if (gallery && new Set(["https", "blob", "data"]).has(protocol)) {
    return {
      source,
      ...gallery,
      sourceKind: sourceKind(),
      prompt: null,
      createdAt: null,
    };
  }
  const marker = MARKER_SELECTORS.some((selector) => element.matches?.(selector) || element.closest?.(selector));
  const assistant = Boolean(element.closest?.('[data-message-author-role="assistant"], [data-message-author-role="tool"]'));
  const itemId = element.dataset.imageId
    || element.dataset.itemId
    || closestValue(element, "data-image-id")
    || closestValue(element, "data-item-id")
    || closestValue(element, "data-message-id");
  if (!marker || !assistant || !itemId || itemId.length > 256 || /[\\/\u0000]/.test(itemId)) return null;
  if (!new Set(["https", "blob", "data"]).has(protocol)) return null;
  return {
    source,
    itemId,
    sourceKind: sourceKind(),
    conversationId: closestValue(element, "data-conversation-id"),
    conversationTitle: closestValue(element, "data-conversation-title"),
    prompt: element.getAttribute("data-image-prompt") || null,
    createdAt: element.getAttribute("data-created-at") || null,
  };
}

function base64(bytes) {
  let output = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(output);
}

async function imagePayload(image, element, signal) {
  try {
    const response = await window.fetch(image.source, {
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) throw new Error(`generated image fetch returned ${response.status}`);
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || null;
    if (!mimeType) throw new Error("generated image response has no Content-Type");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("generated image exceeds the import limit");
    return { mimeType, bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch (error) {
    if (!image.source.startsWith("blob:") || !element?.complete || !element.naturalWidth) throw error;
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    canvas.getContext("2d").drawImage(element, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw error;
    return { mimeType: "image/png", bytes: new Uint8Array(await blob.arrayBuffer()) };
  }
}

async function importImage(image, element, signal) {
  const { mimeType, bytes } = await imagePayload(image, element, signal);
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("generated image exceeds the import limit");
  const payload = {
    ...image,
    mimeType,
    bytesBase64: base64(bytes),
  };
  delete payload.source;
  await sendImport(payload);
}

const seen = new Set();
const inFlight = new Set();
const scan = () => {
  if (!sourceKind()) return;
  for (const element of document.querySelectorAll("img")) {
    const image = descriptor(element);
    if (!image || !image.sourceKind || seen.has(image.itemId) || inFlight.has(image.itemId)) continue;
    inFlight.add(image.itemId);
    void importImage(image, element, signal)
      .then(() => seen.add(image.itemId))
      .catch(() => {})
      .finally(() => inFlight.delete(image.itemId));
  }
};

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset", "data-image-id", "data-item-id"] });
scan();
signal.addEventListener("abort", () => observer.disconnect(), { once: true });
return () => observer.disconnect();
