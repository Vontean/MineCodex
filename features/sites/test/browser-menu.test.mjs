import assert from "node:assert/strict";
import test from "node:test";
import { createSitesAdapter } from "../src/adapters/codex/renderer.mjs";

test("browser action binds to its menu tab, reads current URL and excludes unrelated menus", () => {
  const previous = globalThis.document;
  let closed = false;
  const downloads = { textContent: "Downloads" };
  const page = { browserTabId: "tab-b", browserState: { url: "https://example.com/b", title: "B" }, cwd: "/project", isVisible: true };
  const host = { browserTabId: "tab-b", browserHostDisplayName: "Local" };
  const actions = { onOpenDownloads() {}, onOpenChange(open) { closed = !open; } };
  const nodes = [actions, page, host].map(memoizedProps => ({ memoizedProps }));
  nodes.forEach((node, index) => { node.return = nodes[index + 1]; });
  const menu = { isConnected: true, getBoundingClientRect: () => ({ width: 200, height: 300 }), querySelectorAll: () => [downloads] };
  globalThis.document = { querySelectorAll: () => [menu] };
  try {
    const adapter = createSitesAdapter(new AbortController().signal, {account:()=>({read:()=>({planType:"pro"})}), currentFiber: () => nodes[0] });
    assert.deepEqual(adapter.browserMenu().page, { url: "https://example.com/b", title: "B", cwd: "/project" });
    page.browserState.url = "https://example.com/c";
    assert.equal(adapter.browserMenu().page.url, "https://example.com/c");
    adapter.browserMenu().close(); assert.equal(closed, true);
    host.browserHostDisplayName = "Remote";
    assert.equal(adapter.browserMenu().page.cwd, null);
    page.browserState.url = "chrome://downloads";
    assert.equal(adapter.browserMenu(), null);
    page.browserState.url = "https://example.com";
    delete actions.onOpenDownloads;
    assert.equal(adapter.browserMenu(), null);
  } finally { globalThis.document = previous; }
});
