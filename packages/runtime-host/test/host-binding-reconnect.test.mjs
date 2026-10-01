import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource, RUNTIME_VERSION } from "../src/codex-injection.mjs";

const source = createInjectionSource([]);

test("same-session reinjection updates the binding before ensuring the UI", () => {
  const calls = [];
  const runtime = {
    version: RUNTIME_VERSION, sessionId: "same-session",
    updateHostBinding: (...args) => calls.push(args),
    ensure: () => calls.push("ensure"),
  };
  const window = { __codexPersonalRuntime: runtime };
  window.top = window;
  const start = source.indexOf("function install(config, installTooltips, installDialogs)");
  const end = source.indexOf("const lifetime =", start);
  const install = vm.runInNewContext(`(${source.slice(start, end)} })`, {
    window, document: { documentElement: {} },
  });
  install({ version: RUNTIME_VERSION, sessionId: "same-session", bindingName: "bridge", bindingToken: "new-token" });
  assert.deepEqual(calls, [["bridge", "new-token"], "ensure"]);
});

test("rotated binding retries blank frames and preserves ready editors", () => {
  const config = { bindingName: "bridge", bindingToken: "old-token" };
  const pageScriptFeatures = [{ pageScript: { config: { bindingName: "bridge", bindingToken: "old-token" } } }];
  const blank = { ready: false, loading: true };
  const editor = { ready: true, draft: "unsaved prompt" };
  const pendingHostActions = new Map([
    ["old-load", { kind: "surface-load" }],
    ["attachment", { kind: "attach-file" }],
  ]);
  const loads = [];
  const start = source.indexOf("function updateHostBinding(");
  const end = source.indexOf("function postSurfaceActive", start);
  const update = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
    config, pendingHostActions, pageScriptFeatures,
    surfaceRecords: new Map([["blank", blank], ["editor", editor]]),
    requestSurfaceLoad(record) {
      assert.equal(record.loading, false);
      loads.push({ record, token: config.bindingToken });
    },
  });
  update("bridge", "new-token");
  assert.equal(pageScriptFeatures[0].pageScript.config.bindingToken, "new-token");
  assert.equal(loads.length, 1);
  assert.equal(loads[0].record, blank);
  assert.equal(loads[0].token, "new-token");
  assert.equal(editor.draft, "unsaved prompt");
  assert.equal(pendingHostActions.has("old-load"), false);
  assert.equal(pendingHostActions.has("attachment"), true);
  update("bridge", "new-token");
  assert.equal(loads.length, 1);
});
