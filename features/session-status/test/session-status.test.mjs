import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createContextUsageAdapter } from "../src/adapters/codex/context-usage.mjs";
import { createCodexEnvironment } from "../../../packages/codex-adapter/src/renderer/environment.mjs";

const featureDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("session status is a declarative page script with valid renderer syntax", async () => {
  const manifest = JSON.parse(await readFile(path.join(featureDir, "codex-feature.json"), "utf8"));
  assert.equal(manifest.id, "session-status");
  assert.equal(manifest.entry.kind, "page-script");
  const source = await readFile(path.join(featureDir, manifest.entry.script), "utf8");
  assert.doesNotThrow(() => new Function("signal", "window", "document", "MutationObserver", "config", source));
});

test("native context subscription updates immediately, clears missing data, and detaches on thread switch", async () => {
  let callback, current = { modelContextWindow:258400,last:{totalTokens:225043} }, disposedSubscriptions=0, renders=0, value;
  const node={token:{__scopeBrand:"AppScope"},store:{get:()=>current,sub:(_atom,listener)=>{callback=listener;return ()=>{disposedSubscriptions++;callback=null;};}}};
  const family={resolve:(_node,_chain,id)=>({resolve:()=>id})};
  const controller=new AbortController();
  const adapter=createContextUsageAdapter(controller.signal,{props:()=>({value:new Map([["app",node]])}),report(){}},next=>{value=next;renders++;},async()=>family);
  await new Promise(resolve=>setImmediate(resolve));
  const composer={};
  adapter.connect("one",composer);
  const harness={read:()=>value,switchThread:(id,element)=>adapter.connect(id,element)};
  assert.equal(harness.read().contextPercent, 87);
  current = { modelContextWindow: 258400, last: { totalTokens: 15971 } };
  callback();
  assert.equal(harness.read().contextPercent, 6);
  assert.ok(renders >= 2);
  const oldCallback = callback;
  current = null;
  harness.switchThread("two", composer);
  assert.equal(disposedSubscriptions, 1);
  assert.equal(harness.read().contextPercent, null);
  const before = renders;
  oldCallback();
  assert.equal(renders, before);
  harness.switchThread(null, null);
  assert.equal(disposedSubscriptions, 2);
});

test("cache hit retains precision above 99 percent from raw token counts", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const format = new Function(`${source.slice(source.indexOf("function cachePercent("), source.indexOf("function number("))}; return cachePercent;`)();
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 994, cacheHitPercent: 99 }), "99.4%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 990 }), "99%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 991 }), "99.1%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 1000 }), "100.0%");
  assert.equal(format({ inputTokens: 1000, cachedInputTokens: 956 }), "96%");
  assert.equal(format({}), "—");
});


test("only visible thread composers own session status, including after tab moves", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const eligible = new Function("config", source.slice(source.indexOf("function isActiveComposer("), source.indexOf("function createInstance(")) + ";return isActiveComposer;")({codex:createCodexEnvironment()});
  let placement = "thread", blocked = false, visible = true;
  const composer = { isConnected: true, checkVisibility: () => visible,
    closest: selector => selector === '[data-codex-composer-root]' ? { getAttribute: () => placement, querySelector:()=>null } : blocked };
  assert.equal(eligible(composer), true);
  blocked = true; // 全屏标签页切到浮动 Quick Chat，或祖先隐藏。
  assert.equal(eligible(composer), false);
  blocked = false; visible = false;
  assert.equal(eligible(composer), false);
  visible = true; placement = "home";
  assert.equal(eligible(composer), false);
  placement = "thread";
  assert.equal(eligible(composer), true);
  composer.isConnected = false;
  assert.equal(eligible(composer), false);
});

test("moving a composer offscreen disposes only its instance and restores it on return", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const main = {active:true}, side = {active:true};
  let created=0, disposed=0;
  const instances=new Map();
  const sync=new Function('instances','document','isActiveComposer','createInstance',
    source.slice(source.indexOf('function syncInstances('),source.indexOf('const previous = window.__minecodexSessionStatus'))+';return syncInstances;')(
      instances,{querySelectorAll:()=>[main,side]},composer=>composer.active,()=>{created++;return {dispose(){disposed++;}};});
  sync();assert.equal(instances.size,2);
  main.active=false;sync();assert.equal(instances.size,1);assert.equal(disposed,1);assert.ok(instances.has(side));
  sync();assert.equal(disposed,1);
  main.active=true;sync();assert.equal(instances.size,2);assert.equal(created,3);
});
