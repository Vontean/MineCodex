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
  const start = source.indexOf("function install(config, installUI, installModelSliderFeature, createCodexEnvironment, createRendererSelfCheck, findCodexModule)");
  const end = source.indexOf("const lifetime =", start);
  const install = vm.runInNewContext(`(${source.slice(start, end)} })`, {
    window, document: { documentElement: {} },
  });
  install({ version: RUNTIME_VERSION, sessionId: "same-session", bindingName: "bridge", bindingToken: "new-token" });
  assert.deepEqual(calls, [["bridge", "new-token"], "ensure"]);
});

test("rotated binding updates page-script credentials", () => {
  const config = { bindingName: "bridge", bindingToken: "old-token" };
  const pageScriptFeatures = [{ pageScript: { config: { bindingName: "bridge", bindingToken: "old-token" } } }];
  const start = source.indexOf("function updateHostBinding(");
  const end = source.indexOf("// ====", start);
  const update = vm.runInNewContext(`(${source.slice(start, end).trim()})`, { config, pageScriptFeatures });
  update("next-bridge", "new-token");
  assert.deepEqual(config, { bindingName: "next-bridge", bindingToken: "new-token" });
  assert.deepEqual(pageScriptFeatures[0].pageScript.config, { bindingName: "next-bridge", bindingToken: "new-token" });
});
