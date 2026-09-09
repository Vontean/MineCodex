import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource } from "../src/codex-injection.mjs";

const source = createInjectionSource([]);
const start = source.indexOf("function currentReactFiber(element) {");
const end = source.indexOf("function nativeCatalogModelFor", start);
function inspect(triggers) {
  return vm.runInNewContext(`(() => { ${source.slice(start, end)}
    return { trigger: nativeComposerTrigger(), controller: nativeComposerModelController() };
  })()`, { document: { querySelectorAll: () => triggers } });
}
function trigger(props, { visible = true, open = false, parent = null } = {}) {
  return {
    checkVisibility: () => visible,
    getAttribute: () => open ? "open" : "closed",
    __reactFiber$fixture: { memoizedProps: props, return: parent },
  };
}
const taskController = () => ({ models: [], onSelectReasoningEffort() {}, onSelectModel() {} });

test("Codex and Work preserve their native task controller contract", () => {
  const props = taskController();
  assert.equal(inspect([trigger(props)]).controller, props);
});

test("Chat and Temporary Chat stop before any ancestor task controller", () => {
  const props = { models: { versionOptions: [] }, selectedModel: {}, onModelChange() {} };
  const parent = { memoizedProps: taskController(), return: null };
  assert.equal(inspect([trigger(props, { parent })]).controller, null);
});

test("ignores a hidden preloaded Chat composer and follows the open task picker", () => {
  const hidden = trigger({ selectedModel: {}, onModelChange() {} }, { visible: false, open: true });
  const props = taskController();
  const visible = trigger(props);
  assert.equal(inspect([hidden, visible]).controller, props);
  const active = trigger(taskController(), { open: true });
  assert.equal(inspect([visible, active]).trigger, active);
});

test("missing composer does not enable enhancement", () => {
  assert.equal(inspect([]).controller, null);
});
