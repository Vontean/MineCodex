import test from 'node:test';
import assert from 'node:assert/strict';
import {findCodexModule} from '../src/renderer/modules.mjs';

function fixture(t,nodes,sources) {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:()=>nodes}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
  const reads=[];
  return {reads,read:async url=>{reads.push(url);assert.ok(url in sources,`unexpected module read: ${url}`);return sources[url];}};
}
const url=name=>`file:///assets/${name}-fixture.js`;
test('module discovery follows actual entry references without preloads and skips unrelated chunks',async t=>{
  const io=fixture(t,[{src:url('index')}],{
    [url('index')]:'const boot=()=>import(`./app-main-fixture.js`);import "./unrelated-fixture.js";',
    [url('app-main')]:'import{init}from"./app-initial-fixture.js";',
    [url('app-initial')]:'const lazy=()=>import("./review-file-source-breadcrumb-fixture.js");',
  });
  assert.equal(await findCodexModule('review-file-source-breadcrumb',io),url('review-file-source-breadcrumb'));
  assert.deepEqual(io.reads,[url('index'),url('app-main'),url('app-initial')]);
});
test('module discovery preserves direct preloads without fetching source',async t=>{
  const io=fixture(t,[{href:url('app-initial')}],{});
  assert.equal(await findCodexModule('app-initial',io),url('app-initial'));
  assert.deepEqual(io.reads,[]);
});
test('all mode collects distinct role candidates and terminates cycles',async t=>{
  const io=fixture(t,[{src:url('index')},{href:url('dist')}],{
    [url('index')]:'import "./app-main-fixture.js";',
    [url('app-main')]:'import "./index-fixture.js";import "./dist-fixture.js";import "./dist-other.js";',
  });
  assert.deepEqual(await findCodexModule('dist',{...io,all:true}),[url('dist'),'file:///assets/dist-other.js']);
  assert.equal(await findCodexModule('missing',io),null);
});
test('failed lookup is not retained when entry references change',async t=>{
  const sources={[url('index')]:''},io=fixture(t,[{src:url('index')}],sources);
  assert.equal(await findCodexModule('app-initial',io),null);
  sources[url('index')]='import "./app-initial-fixture.js";';
  assert.equal(await findCodexModule('app-initial',io),url('app-initial'));
});
test('serialized discovery has no Node import closure and abort cancels reads',async t=>{
  const io=fixture(t,[{src:url('index')}],{[url('index')]:'import "./app-main-fixture.js";'});
  const serialized=new Function(`return (${findCodexModule.toString()})`)();
  const controller=new AbortController();
  await assert.rejects(serialized('app-initial',{read:async url=>{controller.abort();return io.read(url);},signal:controller.signal}),{name:'AbortError'});
  assert.deepEqual(io.reads,[url('index')]);
});

test('feature-owned traversal follows dotted wrapper names without scanning other pages',async t=>{
  const io=fixture(t,[{src:url('app-initial')}],{
    [url('app-initial')]:'import "./text-file-editor-tab-content.electron-wrapper.js";import "./page-unrelated.js";',
    'file:///assets/text-file-editor-tab-content.electron-wrapper.js':'import "./text-file-editor-extensions-current.js";',
  });
  assert.equal(await findCodexModule('text-file-editor-extensions',{...io,via:['text-file-editor-tab-content.electron']}),'file:///assets/text-file-editor-extensions-current.js');
  assert.equal(io.reads.length,2);
});

import {codexModuleStyles} from '../src/renderer/modules.mjs';
test('CSS discovery uses only the target lazy import dependencies, including pure hashes',()=>{
  const source='const table={};table.f=["./abcd1234.css","./other.css","./module.js"];load(()=>import("./content-current.js"),__vite__mapDeps([0,2,0]),import.meta.url);load(()=>import("./other-current.js"),__vite__mapDeps([1]),import.meta.url)';
  assert.deepEqual(codexModuleStyles(source,url('app-initial'),'file:///assets/content-current.js'),['file:///assets/abcd1234.css']);
  assert.deepEqual(codexModuleStyles(source,url('app-initial'),'file:///assets/missing.js'),[]);
  assert.throws(()=>codexModuleStyles(source.replace('[0,2,0]','[99]'),url('app-initial'),'file:///assets/content-current.js'),/style-dependency/);
});
