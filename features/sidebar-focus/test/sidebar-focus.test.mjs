import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFocusAdapter } from "../src/adapters/codex/renderer.mjs";
const source = readFileSync(new URL("../src/sidebar-focus.mjs", import.meta.url), "utf8");
test("focus resolves hidden custom sections and preserves original branch state", () => {
  const prefix = "const states = new Map();\n" + source.slice(source.indexOf("function remember("), source.indexOf("function reconcile("));
  const section = {key:"section:custom:a",data:{threadKeys:["local:t"]},element:{contains:()=>false}};
  const project = {key:"project:p",data:{threadKeys:["local:t"]},element:{}};
  // 当前线程在折叠分类中，不能依赖其 DOM 行存在。
  const document = {querySelector:s=>s.includes("conversation-id") ? {dataset:{aboveComposerConversationId:"t"}} : null};
  const scoped = new Function("document", prefix + "; return {remember,states};")(document);
  globalThis.document=document;
  const adapter=createFocusAdapter({currentThreadId:()=>"t",props:()=>null});
  assert.deepEqual(adapter.target([section,project]),{section,project});
  scoped.remember([{key:"a",expanded:true}]);
  scoped.remember([{key:"a",expanded:false},{key:"b",expanded:false}]);
  assert.deepEqual([...scoped.states],[["a",true],["b",false]]);
  assert.equal(adapter.target([]),null);
  delete globalThis.document;
});
test("page script compiles with runtime cleanup contract",()=>assert.doesNotThrow(()=>new Function("signal",source)));


test("continuous changes cannot postpone a scheduled focus update", () => {
  const frames=new Map();let id=0,runs=0;
  const scheduling=source.slice(source.indexOf("function schedule()"),source.indexOf('document.addEventListener("click"'));
  const control=new Function("requestAnimationFrame","reconcile",`let disposed=false,timer=null;${scheduling};return {schedule,dispose:()=>disposed=true};`)(callback=>{frames.set(++id,callback);return id;},()=>runs++);
  for(let i=0;i<266;i++)control.schedule();
  assert.equal(frames.size,1);
  const callback=frames.get(1);frames.delete(1);callback();
  assert.equal(runs,1);
  control.schedule();assert.equal(frames.size,1);
  control.dispose();frames.clear();control.schedule();assert.equal(frames.size,0);
});

test("focus ignores conversation output but follows sidebar and thread changes", () => {
  let callback,runs=0;
  const block=source.slice(source.indexOf("const observer = new MutationObserver"),source.indexOf("observer.observe"));
  new Function("MutationObserver","schedule",block)(class {constructor(fn){callback=fn;}},()=>runs++);
  callback([{type:"childList",target:{closest:()=>null},addedNodes:[],removedNodes:[]}]);
  assert.equal(runs,0);
  callback([{type:"childList",target:{closest:()=>({})},addedNodes:[],removedNodes:[]}]);
  callback([{type:"attributes",attributeName:"data-above-composer-conversation-id",target:{closest:()=>null}}]);
  callback([{type:"childList",target:{closest:()=>null},addedNodes:[{matches:()=>true}],removedNodes:[]}]);
  assert.equal(runs,3);
});
