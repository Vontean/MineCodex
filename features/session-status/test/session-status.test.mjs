import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const featureDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("session status is a declarative page script with valid renderer syntax", async () => {
  const manifest = JSON.parse(await readFile(path.join(featureDir, "codex-feature.json"), "utf8"));
  assert.equal(manifest.id, "session-status");
  assert.equal(manifest.entry.kind, "page-script");
  const source = await readFile(path.join(featureDir, manifest.entry.script), "utf8");
  assert.doesNotThrow(() => new Function("signal", "window", "document", "MutationObserver", "config", source));
});

test("native context subscription updates immediately, clears missing data, and detaches on thread switch", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const start = source.indexOf("const emptyNativeContext");
  const end = source.indexOf("function requestRefresh()");
  let callback;
  let current = { modelContextWindow: 258400, last: { totalTokens: 225043 } };
  let disposedSubscriptions = 0;
  let renders = 0;
  const node = {
    token: { __scopeBrand: "AppScope" },
    store: {
      get: () => current,
      sub: (_atom, listener) => {
        callback = listener;
        return () => { disposedSubscriptions++; callback = null; };
      },
    },
  };
  const parent = { __reactFiberFixture: { memoizedProps: { value: new Map([["app", node]]) } } };
  const composer = { parentElement: parent };
  const family = { resolve: (_node, _chain, threadId) => ({ resolve: () => threadId }) };
  const harness = new Function("render", `
    let activeThreadId = "one", disposed = false;
    ${source.slice(start, end)}
    return {
      connect(family, composer) { nativeContextFamily = family; syncNativeContext(composer); },
      switchThread(id, composer) { activeThreadId = id; syncNativeContext(composer); },
      read() { return nativeContext; },
    };
  `)(() => renders++);
  harness.connect(family, composer);
  assert.equal(harness.read().contextPercent, 87);
  current = { modelContextWindow: 258400, last: { totalTokens: 15971 } };
  callback();
  assert.equal(harness.read().contextPercent, 6);
  assert.equal(renders, 2);
  const oldCallback = callback;
  current = null;
  harness.switchThread("two", composer);
  assert.equal(disposedSubscriptions, 1);
  assert.equal(harness.read().contextPercent, null);
  const before = renders;
  oldCallback();
  assert.equal(renders, before);
  harness.switchThread(null, null);
  assert.equal(disposedSubscriptions, 2);
});

test("cache hit retains precision above 99 percent from raw token counts", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const format = new Function(`${source.slice(source.indexOf("function cachePercent("), source.indexOf("function number("))}; return cachePercent;`)();
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 994, cacheHitPercent: 99 }), "99.4%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 990 }), "99%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 991 }), "99.1%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 1000 }), "100.0%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 956 }), "96%");
  assert.equal(format({}), "—");
});
