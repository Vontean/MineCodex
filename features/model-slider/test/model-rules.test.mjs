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
