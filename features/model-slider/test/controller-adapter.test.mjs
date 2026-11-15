import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelControllerAdapter } from '../src/adapters/codex/controller.mjs';

function fixture(props, { depth = 41, legacy = false, nativeRegistry } = {}) {
  const trigger = { checkVisibility: () => true, getAttribute: () => 'closed' };
  let fiber = { memoizedProps: props, return: null };
  for (let index = 0; index < depth; index++) fiber = { memoizedProps: {}, return: fiber };
  const document = { querySelectorAll: selector => (
    selector === (legacy ? '[data-codex-intelligence-trigger]' : '[data-composer-navigation-target="reasoning"]') ? [trigger] : []
  ) };
  // 工厂在 Renderer 中序列化；用独立 DOM 作用域验证新旧协议，不依赖真实窗口。
  const create = new Function('document', `return (${createModelControllerAdapter});`)(document);
  return create({ currentFiber: () => fiber, report() {} }, value => value, nativeRegistry);
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

test('Fast icons come from the registered native toggle module contract', async () => {
  const reports = [];
  const source = 'FastModeToggle d:`M11.9125 21.4125 active` d:`M9.80999 17.8302 inactive`';
  const adapter = fixture({}, { nativeRegistry: async () => ({ entries: [{ source }] }) });
  const result = await adapter.fastIcons();
  assert.deepEqual(result, {
    active: { path: 'M11.9125 21.4125 active', viewBox: '0 0 24 24', width: 24, height: 24 },
    inactive: { path: 'M9.80999 17.8302 inactive', viewBox: '0 0 20 20', width: 20, height: 20 },
  });
});

test('Fast icon discovery reports an unavailable contract without inventing an icon', async () => {
  const adapter = fixture({}, { nativeRegistry: async () => ({ entries: [{ source: 'FastModeToggle' }] }) });
  assert.equal(await adapter.fastIcons(), null);
});
