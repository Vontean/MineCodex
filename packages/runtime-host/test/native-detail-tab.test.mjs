import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource } from "../src/codex-injection.mjs";

const source = createInjectionSource([]);
const start = source.indexOf("async function openNativeDetailTab(feature, detail)");
const end = source.indexOf("function detailTabCapability()", start);

test("opens and refocuses a detail tab with the native tab type contract", async () => {
  const tabs = new Map();
  const keys = new Map();
  const sessions = new Set();
  const Component = () => null;
  const scope = { get: (_, id) => tabs.get(id) };
  const controller = {
    tabById$: {},
    openTab(actualScope, type, options) {
      assert.equal(actualScope, scope);
      // 当前 Codex 在创建标签前直接调用此方法，并从描述对象取组件。
      assert.equal(type.isAvailable(scope, options.props), true);
      assert.equal(type.Component, Component);
      assert.equal(type.kind, "notes-prompts");
      assert.deepEqual(Array.from(type.dropDestinations), ["right"]);
      tabs.set(options.id, options);
    },
  };
  const open = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
    loadNativeTabCapability: async () => ({ controller }),
    waitForCurrentRightPanelScope: async () => scope,
    nativeOpenTabSessions: sessions,
    nativeDetailSurfaceKeys: keys,
    nativeDetailComponent: () => Component,
    nativeDetailIcon: () => undefined,
    waitForNativeDetailTabElement: async () => ({ element: {}, frame: {} }),
    crypto: { randomUUID: () => "fixture" },
    surfaceKey: (...parts) => parts.join(":"),
    registerSurface() {}, removeSurfaceRecord() {}, queueTheme() {},
    reloadNativeDetailIfUnready() {}, nativeTabCapabilityError: null,
  });
  const feature = { id: "notes" };
  const detail = { id: "prompts", label: "Prompts", surfaceUrl: "http://127.0.0.1:47832/?surface=prompts" };
  assert.equal((await open(feature, detail))?.presentation, "native");
  assert.equal((await open(feature, detail))?.focusedExisting, true);
  assert.equal(tabs.size, 1);
  assert.equal(sessions.size, 1);
  tabs.get("notes-prompts").onClose();
  assert.equal(sessions.size, 0);
  assert.equal(keys.size, 0);
});
