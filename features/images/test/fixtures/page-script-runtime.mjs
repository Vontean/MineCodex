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

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail("page-script fixture did not settle");
}

export async function runPageScriptFixture({ source, serviceOrigin, role = "assistant", bytes }) {
  const image = generatedImage({ role });
  const activeTab = {
    textContent: "Chat",
    getAttribute(name) {
      return name === "aria-label" ? "Chat" : null;
    },
  };
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      if (selector === "img") return [image];
      if (selector === '[aria-selected="true"], [data-state="active"]') return [activeTab];
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
  const window = {
    location: new URL("https://chatgpt.com/chat/fixture-conversation"),
    btoa(value) {
      return Buffer.from(value, "binary").toString("base64");
    },
    async fetch(url, options) {
      calls.push({ url: String(url), options });
      if (calls.length === 1) {
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
    { serviceOrigin },
  );
  if (role) await waitFor(() => calls.length === 2);
  else await new Promise((resolve) => setTimeout(resolve, 10));
  return {
    calls,
    cleanup() {
      cleanup?.();
      controller.abort();
    },
    observers,
  };
}
