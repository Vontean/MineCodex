import assert from "node:assert/strict";
import test from "node:test";
import { createModelRules } from "../src/domain/model-rules.mjs";

// 同时验证导入与独立序列化，避免领域规则依赖安装闭包。
for (const [environment, rules] of [
  ["module", createModelRules()],
  ["renderer source", new Function(`return (${createModelRules.toString()})();`)()],
]) {
  test(`${environment}: aliases preserve provider identity and avoid ambiguous routes`, () => {
    const identity = rules.modelIdentity("packyapi/openai/gpt-6-sol");
    assert.equal(identity.provider, "packyapi");
    assert.equal(identity.backend, "openai/gpt-6-sol");
    assert.equal(rules.compactModelLabel(identity.raw), "GPT 6 Sol");
    const selector = {models:[
      {slug:"gpt-6-sol", displayName:"GPT 6 Sol"},
      {slug:"provider/gpt-6-sol", displayName:"GPT 6 Sol"},
    ]};
    assert.equal(rules.catalogModelFor(rules.modelIdentity("GPT 6 Sol"), selector).slug, "gpt-6-sol");
    assert.equal(rules.catalogModelFor(rules.modelIdentity("other/GPT 6 Sol"), selector), null);
  });
  test(`${environment}: duplicate routes hide only when they have no distinct effort or current selection`, () => {
    const models = [
      {model:"gpt-6-sol"},
      {model:"alias/gpt-6-sol"},
      {model:"distinct/gpt-6-sol",supportedReasoningEfforts:["high"]},
      {model:"hidden",hidden:true},
    ];
    assert.deepEqual(rules.visibleControllerModels({models,model:"gpt-6-sol"}).map(m=>m.model), ["gpt-6-sol","distinct/gpt-6-sol"]);
    assert.ok(rules.visibleControllerModels({models,model:"alias/gpt-6-sol"}).some(m=>m.model==="alias/gpt-6-sol"));
  });
  test(`${environment}: configured efforts intersect the catalog without inventing levels`, () => {
    const model = {supportedReasoningLevels:[{effort:"high"},{effort:"max"}]};
    const identity = rules.modelIdentity("provider/model");
    const filtered = rules.modelWithOpenCodexEfforts(identity, {openCodexRealEfforts:{"provider/model":["high","ultra"]}}, model);
    assert.deepEqual(filtered.supportedReasoningLevels, [{effort:"high"}]);
    assert.equal(model.supportedReasoningLevels.length, 2);
    assert.equal(rules.modelWithOpenCodexEfforts(identity, {}, model), model);
  });
}

test('portable favorites keep provider identity and never remap an authoritative model by display name', () => {
  const { favoriteModelId } = createModelRules();
  const saved = new Set(['provider-a/shared-model', 'native-model', 'missing-model']);
  const localModels = ['provider-b/shared-model', 'native-model'];
  const active = localModels.filter(id => saved.has(favoriteModelId(id, { authoritative: true, catalogSlug: 'provider-a/shared-model' })));
  assert.deepEqual(active, ['native-model']);
  assert.equal(favoriteModelId('provider-b/shared-model', { catalogSlug: 'provider-a/shared-model' }), 'provider-b/shared-model');
  localModels.push('missing-model');
  assert.deepEqual(localModels.filter(id => saved.has(favoriteModelId(id, { authoritative: true }))), ['native-model', 'missing-model']);
  assert.equal(saved.size, 3);
});

for (const [environment, rules] of [
  ['module', createModelRules()],
  ['renderer source', new Function(`return (${createModelRules.toString()})();`)()],
]) {
  const selector = { brands: [
    { id: 'openai', keywords: ['gpt', 'openai'] },
    { id: 'anthropic', keywords: ['claude'] },
    { id: 'gemini', keywords: ['gemini'] },
    { id: 'deepseek', keywords: ['deepseek'] },
    { id: 'hunyuan', keywords: ['tencent', 'hunyuan', 'opencode-go/hy3'] },
  ] };
  test(`${environment}: GPT tiers outrank numeric versions and future versions need no allowlist`, () => {
    const ids = ['gpt-6-luna', 'gpt-5.5', 'gpt-6.1-sol', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-5.6-luna', 'gpt-6.10-sol'];
    assert.deepEqual(ids.sort((a,b) => rules.compareModelIds(a,b,selector)), [
      'gpt-6-astra', 'gpt-6.10-sol', 'gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.5',
    ]);
    assert.ok(rules.compareModelIds('route/gpt-5.6-sol', 'gpt-6-luna', selector) < 0);
    assert.equal(rules.compareModelIds('claude/gpt-6-sol', 'gpt-6-sol', selector), 0);
  });
  test(`${environment}: third-party versions compare numerically within each manufacturer`, () => {
    for (const ids of [
      ['route/claude-opus-4-6-thinking', 'route/claude-haiku-5-5', 'route/claude-opus-4-10'],
      ['route/gemini-3.1-pro', 'route/gemini-3.8-flash', 'other/gemini-3.10-flash'],
      ['route/deepseek-v4.1-flash', 'route/deepseek-v5', 'route/deepseek-v4.2'],
    ]) {
      const expected = ids[0].includes('gemini') ? [ids[2], ids[1], ids[0]] : [ids[1], ids[2], ids[0]];
      assert.deepEqual(ids.slice().sort((a,b) => rules.compareModelIds(a,b,selector)), expected);
    }
    assert.equal(rules.compareModelIds('gemini/claude-4.6', 'other/claude-4-6', selector), 0);
    assert.ok(rules.compareModelIds('gemini/hy3-preview', 'other/hy2', selector) < 0);
    assert.ok(rules.compareModelIds('claude/gemini-3.1-pro', 'route/gemini-3.8-flash', selector) > 0);
  });
}

test('favorites and ordinary models each follow manufacturer, tier and version order', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/frontend/install.mjs', import.meta.url), 'utf8');
  const compare = new Function('compareModelIds', source.slice(source.indexOf('  function compareEnhancedModelItems('), source.indexOf('  function renderEnhancedModelMenu(')) + ';return compareEnhancedModelItems;')(createModelRules().compareModelIds);
  const selector = {brands:[{id:'anthropic',keywords:['claude']},{id:'gemini',keywords:['gemini']}]};
  const favorites = new Set(['gpt-6-luna','gpt-5.6-sol','a/claude-4.6','b/claude-5.5']);
  const ids = ['a/claude-4.6','gpt-6-luna','gpt-6.1-sol','b/claude-5.5','b/gemini-3.1','a/gemini-3.8','gpt-5.6-sol','gpt-6-astra'];
  const items = ids.map(id => ({dataset:{codexModelSliderRaw:id}}));
  assert.deepEqual(items.sort((a,b)=>compare(a,b,favorites,selector)).map(item=>item.dataset.codexModelSliderRaw), [
    'gpt-5.6-sol','gpt-6-luna','b/claude-5.5','a/claude-4.6',
    'gpt-6-astra','gpt-6.1-sol','a/gemini-3.8','b/gemini-3.1',
  ]);
});
