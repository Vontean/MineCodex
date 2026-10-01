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
