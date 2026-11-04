import test from 'node:test';
import assert from 'node:assert/strict';
import {codexModuleRegistry} from '../src/renderer/modules.mjs';

function fixture(context) {
  const previous=globalThis.document;context.after(()=>{globalThis.document=previous;});
  globalThis.document={querySelectorAll:()=>[{src:'app://-/assets/entry.js'}]};
  const native={render(){}};
  const runtime=()=>{throw Error('Unrelated module must not execute');};
  const factory=Function('return function owner(e,t,r){var $=r("dependency");return $.view;}')();
  runtime.m={owner:factory,dependency(){throw Error('Cached factory must not execute');},unloaded(){}};
  runtime.c={owner:{exports:{action(){}}},dependency:{exports:{view:native}}};
  const options={read:async()=> 'export{runtime as __webpack_require__};',load:async()=>({__webpack_require__:runtime})};
  return {runtime,native,options};
}

test('registry reads native cached exports and resolves dollar-prefixed dependency bindings without running factories',async context=>{
  const f=fixture(context),registry=await codexModuleRegistry(f.options);
  const owner=registry.module(source=>source.includes('$.view'),'view owner');
  assert.equal(registry.binding(owner,'$.view'),f.native);
  assert.equal(registry.value(owner,value=>typeof value==='function','action'),f.runtime.c.owner.exports.action);
  assert.throws(()=>registry.exports({id:'unloaded'}),/not-loaded/);
  assert.throws(()=>registry.binding(owner,'$.missing'),/export-unavailable/);
});

test('ambiguous roles fail closed and legacy ESM entries return no registry',async context=>{
  const f=fixture(context);f.runtime.m.duplicate=f.runtime.m.owner;
  const registry=await codexModuleRegistry(f.options);
  assert.throws(()=>registry.module(source=>source.includes('$.view'),'view'),/contract changed/);
  assert.equal(await codexModuleRegistry({...f.options,read:async()=> 'export{ordinary};',load:async()=>{throw Error('Do not import unrelated script');}}),null);
});

test('lazy loading follows only the native declaration for the requested named component',async context=>{
  const f=fixture(context),loaded=[];
  f.runtime.m.owner=Function('return function owner(e,t,r){return r.e(37).then(r.bind(r,"dialog")).then(e=>({default:e.NamedDialog}));}')();
  f.runtime.e=async id=>loaded.push(id);
  const Dialog=()=>{};
  f.runtime.m.dialog=function dialog(){};
  const runtime=id=>{assert.equal(id,'dialog');return {NamedDialog:Dialog};};
  Object.assign(runtime,f.runtime);
  const registry=await codexModuleRegistry({...f.options,load:async()=>({__webpack_require__:runtime})});
  const owner=registry.module(source=>source.includes('NamedDialog'),'dialog owner');
  assert.throws(()=>registry.binding(owner,'missing.value'),/binding-unavailable/);
  await assert.rejects(registry.lazy(owner,'DifferentDialog'),/lazy-contract/);
  const result=await registry.lazy(owner,'NamedDialog');
  assert.equal(result.id,'dialog');assert.deepEqual(loaded,[37]);
});
