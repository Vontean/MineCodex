import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelControllerAdapter } from '../src/adapters/codex/controller.mjs';

function fixture(props, { depth = 41, legacy = false } = {}) {
  const trigger = { checkVisibility: () => true, getAttribute: () => 'closed' };
  let fiber = { memoizedProps: props, return: null };
  for (let index = 0; index < depth; index++) fiber = { memoizedProps: {}, return: fiber };
  const document = { querySelectorAll: selector => (
    selector === (legacy ? '[data-codex-intelligence-trigger]' : '[data-composer-navigation-target="reasoning"]') ? [trigger] : []
  ) };
  // 工厂在 Renderer 中序列化；用独立 DOM 作用域验证新旧协议，不依赖真实窗口。
  const create = new Function('document', `return (${createModelControllerAdapter});`)(document);
  return create({ currentFiber: () => fiber, report() {} }, value => value);
}

test('rspack controller maps options and selects current-model power through native callback', () => {
  const calls = [];
  const power = { model: 'gpt-6.1-sol', reasoningEffort: 'high', powerSettingIndex: 2 };
  const adapter = fixture({
    modelListConfig: { options: [{ id: power.model, selected: true, onSelect: () => calls.push('option') }] },
    powerSelections: [power], selectedPowerSelection: power,
    onSelectPower: value => calls.push(value),
  });
  const view = adapter.read();
  assert.equal(view.model, power.model);
  assert.equal(view.reasoningEffort, 'high');
  assert.deepEqual(view.models[0].supportedReasoningEfforts, [{ reasoningEffort: 'high' }]);
  view.onSelectModel(power.model, 'high');
  assert.deepEqual(calls, [power]);
});

test('other-model selection uses its native option when current power list has no match', () => {
  const calls = [];
  const adapter = fixture({ modelListConfig: { options: [
    { id: 'current', selected: true, onSelect() {} },
    { id: 'provider/other', onSelect: () => calls.push('other') },
  ] }, powerSelections: [{ model: 'current', reasoningEffort: 'medium' }], onSelectPower: () => calls.push('power') });
  adapter.read().onSelectModel('provider/other', 'high');
  assert.deepEqual(calls, ['other']);
});

test('legacy controller keeps original reasoning callback and trigger', () => {
  const props = { models: [{ model: 'old' }], model: 'old', onSelectReasoningEffort() {} };
  const adapter = fixture(props, { depth: 1, legacy: true });
  assert.equal(adapter.triggers().length, 1);
  assert.equal(adapter.read().models, props.models);
  assert.equal(adapter.read().onSelectReasoningEffort, props.onSelectReasoningEffort);
});

test('Chat controller and incomplete model-list contracts remain unavailable', () => {
  assert.equal(fixture({ selectedModel: 'chat', onModelChange() {} }).read(), null);
  assert.equal(fixture({ modelListConfig: { options: [{ id: 'missing-callback', selected: true }] } }).read(), null);
});
