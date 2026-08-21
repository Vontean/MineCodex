import assert from "node:assert/strict";

function generatedImage({ role = "assistant" } = {}) {
  const attributes = new Map([
    ["data-image-prompt", "A fixture image"],
    ["data-created-at", "2026-08-21T00:00:00.000Z"],
  ]);
  return {
    currentSrc: "https://chatgpt.com/backend-api/generated/image-1",
    src: "",
    dataset: { imageId: "fixture-image-1" },
    matches(selector) {
      return selector === "[data-image-generation-result]";
    },
    closest(selector) {
      if (selector === '[data-message-author-role="assistant"], [data-message-author-role="tool"]') {
        return role ? { getAttribute: () => role } : null;
      }
      if (selector === "[data-image-generation-result]") return this;
      return null;
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
  };
}

function currentGeneratedImage() {
  const imageRecord = {
    id: "file_fixture-generated-image",
    src: "sediment://file_fixture-generated-image",
    width: 1,
    height: 1,
  };
  const image = {
    currentSrc: "blob:app://-/fixture-generated-image",
    src: "",
    complete: true,
    naturalWidth: 1,
    naturalHeight: 1,
    dataset: {},
    matches() { return false; },
    getAttribute() { return null; },
  };
  const preview = {};
  const gallery = {
    __reactFiber$fixture: {
      return: {
        pendingProps: {
          conversationId: "conversation-current",
          images: [imageRecord],
        },
      },
    },
    querySelectorAll(selector) {
      return selector === '[data-testid="generated-image-preview"] img' ? [image] : [];
    },
  };
  image.closest = (selector) => selector === '[data-testid="generated-image-preview"]' ? preview : null;
  preview.closest = (selector) => selector === '[data-testid="generated-image-gallery"]' ? gallery : null;
  return image;
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail("page-script fixture did not settle");
}

export async function runPageScriptFixture({
  source,
  serviceOrigin,
  role = "assistant",
  bytes,
  currentContract = false,
  currentSurface = "Chat",
  blobFetchFails = false,
  hostBridge = false,
}) {
  const image = currentContract ? currentGeneratedImage() : generatedImage({ role });
  const activeTab = {
    textContent: "Chat",
    getAttribute(name) {
      return name === "aria-label" ? "Chat" : null;
    },
  };
  const document = {
    documentElement: {},
    createElement(name) {
      assert.equal(name, "canvas");
      return {
        getContext(type) {
          assert.equal(type, "2d");
          return { drawImage() {} };
        },
        toBlob(callback, mimeType) {
          callback(new Blob([bytes], { type: mimeType }));
        },
      };
    },
    querySelector(selector) {
      if (selector === '[role="button"][aria-current="page"]' && currentContract) {
        return { textContent: `Fixture conversation ${currentSurface}` };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "img") return [image];
      if (selector === '[aria-selected="true"], [data-state="active"]') return currentContract ? [] : [activeTab];
      return [];
    },
  };
  const observers = [];
  class FixtureMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }

    observe() {}

    disconnect() {
      this.disconnected = true;
    }
  }
  const calls = [];
  const hostCalls = [];
  const window = {
    location: new URL("https://chatgpt.com/chat/fixture-conversation"),
    btoa(value) {
      return Buffer.from(value, "binary").toString("base64");
    },
    async fetch(url, options) {
      calls.push({ url: String(url), options });
      if (calls.length === 1) {
        if (blobFetchFails) throw new TypeError("Failed to fetch");
        return {
          ok: true,
          status: 200,
          headers: {
            get(name) {
              if (name.toLowerCase() === "content-type") return "image/png; charset=binary";
              if (name.toLowerCase() === "content-length") return String(bytes.byteLength);
              return null;
            },
          },
          async arrayBuffer() {
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          },
        };
      }
      return { ok: true, status: 201 };
    },
  };
  window.__fixtureHostAction = (payload) => hostCalls.push(JSON.parse(payload));
  const controller = new AbortController();
  const installer = new Function(
    "signal",
    "window",
    "document",
    "MutationObserver",
    "config",
    `"use strict";\n${source}`,
  );
  const cleanup = installer(
    controller.signal,
    window,
    document,
    FixtureMutationObserver,
    {
      serviceOrigin,
      ...(hostBridge ? {
        bindingName: "__fixtureHostAction",
        bindingToken: "fixture-token",
        featureId: "images",
      } : {}),
    },
  );
  if (hostBridge) await waitFor(() => calls.length === 1 && hostCalls.length === 1);
  else if (role || currentContract) await waitFor(() => calls.length === 2);
  else await new Promise((resolve) => setTimeout(resolve, 10));
  return {
    calls,
    hostCalls,
    cleanup() {
      cleanup?.();
      controller.abort();
    },
    observers,
  };
}
