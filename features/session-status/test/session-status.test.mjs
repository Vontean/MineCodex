import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { contextUsageExport, createContextUsageAdapter } from "../src/adapters/codex/context-usage.mjs";
import { createCodexEnvironment } from "../../../packages/codex-adapter/src/renderer/environment.mjs";

const featureDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("context discovery follows the host-aware token usage family rather than unrelated selectors", () => {
  const source = 'pii=yH(`tokenUsageInfo`),mii=Ck(Q,(e,{get:t})=>e==null?null:t(pii,{hostId:t(U3,e),threadId:e})),hii=k3(({requests:e})=>e.length);export{pii as WRONG,mii as TM,hii as OTHER};';
  assert.equal(contextUsageExport(source), "TM");
  assert.equal(contextUsageExport(source.replaceAll('`', '"')), "TM");
  assert.equal(contextUsageExport('old=k3(({latestTokenUsageInfo:e})=>e);export{old as OLD};'), "OLD");
  assert.equal(contextUsageExport(source.replace("mii as TM,", "")), null);
  assert.equal(contextUsageExport('export{unrelated as TM};'), null);
});

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

test("unavailable context does not feed rendering back into composer scans", async () => {
  const family = { resolve() { throw new Error("changed atom contract"); } };
  for (const load of [() => new Promise(() => {}), () => Promise.reject(new Error("missing bundle")), async () => family]) {
    const controller = new AbortController(), composer = {};
    let renders = 0, adapter;
    adapter = createContextUsageAdapter(controller.signal, {
      props: () => ({ value: new Map([["app", { token: { __scopeBrand: "AppScope" } }]]) }), report() {},
    }, () => {
      renders++;
      // 模拟重绘文字触发 MutationObserver，再检查同一输入框。
      if (renders < 50) queueMicrotask(() => adapter.connect("old-thread", composer));
    }, load);
    adapter.connect("old-thread", composer);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(renders, 1);
    adapter.connect("old-thread", composer);
    assert.equal(renders, 1);
    controller.abort();
  }
});

test("pending context discovery still subscribes and unchanged atom values do not redraw", async () => {
  let resolveFamily, callback, renders = 0, unsubscribed = 0;
  const node = { token: { __scopeBrand: "AppScope" }, store: {
    get: () => ({ modelContextWindow: 100, last: { totalTokens: 25 } }),
    sub: (_atom, listener) => { callback = listener; return () => { unsubscribed++; }; },
  } };
  const controller = new AbortController();
  const adapter = createContextUsageAdapter(controller.signal, {
    props: () => ({ value: new Map([["app", node]]) }), report() {},
  }, () => { renders++; }, () => new Promise(resolve => { resolveFamily = resolve; }));
  const composer = {};
  adapter.connect("old-thread", composer);
  resolveFamily({ resolve: () => ({ resolve: () => "atom" }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(renders, 2);
  callback(); assert.equal(renders, 2);
  adapter.connect("old-thread", composer); assert.equal(unsubscribed, 0);
  const oldCallback = callback;
  adapter.connect("old-thread", {}); assert.equal(unsubscribed, 1);
  const beforeStaleUpdate = renders;
  oldCallback(); assert.equal(renders, beforeStaleUpdate);
  controller.abort(); assert.equal(unsubscribed, 2);
});


test("only visible thread composers own session status, including after tab moves", async () => {
  const source = await readFile(path.join(featureDir, "src/session-status.mjs"), "utf8");
  const eligible = new Function("config", source.slice(source.indexOf("function isActiveComposer("), source.indexOf("function createInstance(")) + ";return isActiveComposer;")({codex:createCodexEnvironment()});
  let placement = "thread", blocked = false, visible = true;
  const composer = { isConnected: true, checkVisibility: () => visible,
    getAttribute:()=>placement, querySelector:()=>null,
    closest: selector => selector === '[data-codex-composer-root]' ? composer : blocked };
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
