import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createInjectionSource } from "../src/codex-injection.mjs";

import { createModelControllerAdapter } from "../../../features/model-slider/src/adapters/codex/controller.mjs";
import { createCodexEnvironment } from "../../codex-adapter/src/renderer/environment.mjs";
function inspect(triggers) {
  const adapter=vm.runInNewContext(`(${createModelControllerAdapter.toString()})(({...(${createCodexEnvironment.toString()})()}),x=>x)`,{document:{querySelectorAll:()=>triggers}});
  return {trigger:adapter.trigger(),controller:adapter.read()};
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
  assert.equal(inspect([trigger(props)]).controller.onSelectModel, props.onSelectModel);
});

test("Codex and Work accept the power-selection controller contract", () => {
  const selectedPowerSelection = {
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
  };
  const powerProps = {
    powerSelections: [selectedPowerSelection],
    selectedPowerSelection,
    onSelectPower() {},
    onCommitPower() {},
  };
  const props = {
    models: [{ model: "gpt-5.6-sol" }],
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
    onCommitPower() {},
    onSelectModel() {},
  };
  const parent = { memoizedProps: props, return: null };
  const controller = inspect([trigger(powerProps, { parent })]).controller;
  assert.equal(controller.model, props.model);
  assert.equal(controller.selectedPowerSelection, selectedPowerSelection);
  assert.equal(controller.onSelectPower, powerProps.onSelectPower);
  assert.equal(controller.onCommitPower, powerProps.onCommitPower);
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
  assert.equal(inspect([hidden, visible]).controller.onSelectModel, props.onSelectModel);
  const active = trigger(taskController(), { open: true });
  assert.equal(inspect([visible, active]).trigger, active);
});

test("missing composer does not enable enhancement", () => {
  assert.equal(inspect([]).controller, null);
});
