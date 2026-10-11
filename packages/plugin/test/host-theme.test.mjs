import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("dashboard preserves host theme on partial context updates", async () => {
  const source = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("function syncHost("), source.indexOf('app.addEventListener("hostcontextchanged"'));
  const events = [];
  const window = { dispatchEvent: event => events.push(event.type) };
  const context = vm.createContext({ window, Event });
  vm.runInContext(handler, context);
  context.syncHost({ theme: "dark" });
  context.syncHost({ containerDimensions: { width: 600 } });
  assert.equal(window.minecodexHostTheme, "dark");
  assert.deepEqual(events, ["minecodex-host-theme"]);
  context.syncHost({ theme: "light" });
  assert.equal(window.minecodexHostTheme, "light");
  assert.equal(events.length, 2);
});

test("official dashboard follows host changes after manual selection and ignores browser preference", async () => {
  const source = await readFile(new URL("../../../apps/dashboard/app.js", import.meta.url), "utf8");
  const listeners = new Map(), handlers = new Map(), saved = [];
  const window = {minecodexMcpApp:{},minecodexHostTheme:"dark",addEventListener:(name,fn)=>listeners.set(name,fn)};
  const document = {documentElement:{dataset:{}}};
  const elements = {themeToggle:{setAttribute(){},addEventListener:(name,fn)=>handlers.set(name,fn)},themeButtons:[]};
  const context = vm.createContext({previews:{close(){}},window,document,elements,locale:"en",copy:{},
    matchMedia:()=>({matches:false}),localStorage:{getItem:()=>"light",setItem:(...args)=>saved.push(args)}});
  const start = source.indexOf('const systemTheme = matchMedia(');
  const end = source.indexOf('elements.languageToggle.addEventListener(',start);
  vm.runInContext(source.slice(start,end),context);
  const listenerStart = source.indexOf('window.addEventListener("minecodex-host-theme"');
  const listenerEnd = source.indexOf('document.addEventListener("keydown"',listenerStart);
  vm.runInContext(source.slice(listenerStart,listenerEnd),context);
  vm.runInContext('applyTheme()',context);
  assert.equal(document.documentElement.dataset.theme,"dark");
  handlers.get("click")({target:{closest:()=>({dataset:{themeChoice:"light"}})}});
  assert.equal(document.documentElement.dataset.theme,"light");
  window.minecodexHostTheme="dark";
  listeners.get("minecodex-host-theme")();
  assert.equal(document.documentElement.dataset.theme,"dark");
  assert.deepEqual(saved,[]);
});
