import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContextUsageAdapter } from "../src/adapters/codex/context-usage.mjs";

const nativeSource = 'const make=()=>null,derive=()=>({resolve:()=>({resolve:()=>"atom"})});const selector=make(`tokenUsageInfo`),family=derive();export{family as CONTEXT};';

for (const scenario of [
  { name: "follows entry to app-main when app-initial is not preloaded", entry: true, initial: nativeSource, chosen: "initial" },
  { name: "terminates cyclic entry references without context exports", entry: true, cycle: true, initial: "export const unrelated=true;" },
  { name: "prefers app-initial over app-shared", initial: nativeSource, shared: nativeSource, chosen: "initial" },
  { name: "supports the legacy app-shared bundle", shared: nativeSource, chosen: "shared" },
  { name: "falls back when app-initial has no context export", initial: "export const unrelated=true;", shared: nativeSource, chosen: "shared" },
  { name: "reports unavailable when exports are missing", initial: "export const unrelated=true;" },
  { name: "reports unavailable when bundles are missing" },
]) {
  test(`native context discovery ${scenario.name}`, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "minecodex-context-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
    const urls = {}, nodes = [];
    for (const kind of ["shared", "initial"]) {
      if (!scenario[kind]) continue;
      const file = path.join(directory, `app-${kind}-fixture.js`);
      await writeFile(file, scenario[kind]);
      urls[kind] = pathToFileURL(file).href;
      if (!scenario.entry) nodes.push(kind === "initial" ? { src: urls[kind] } : { href: urls[kind] });
    }
    if (scenario.entry) {
      const main = path.join(directory, "app-main-fixture.js");
      await writeFile(main, 'import "./app-initial-fixture.js";' + (scenario.cycle ? 'import "./app-main-fixture.js";' : ''));
      const entry = path.join(directory, "index-fixture.js");
      await writeFile(entry, 'const boot=()=>import(`./app-main-fixture.js`);');
      nodes.push({src:pathToFileURL(entry).href});
      urls.entry=pathToFileURL(entry).href;urls.main=pathToFileURL(main).href;
    }
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { configurable: true, value: {
      querySelectorAll(selector) {
        assert.equal(selector, "link[rel=modulepreload],script[src]");
        return nodes;
      },
    } });
    t.after(() => {
      if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
      else delete globalThis.document;
    });
    const fetched = [];
    t.mock.method(globalThis, "fetch", async url => {
      fetched.push(url);
      return { text: () => readFile(fileURLToPath(url), "utf8") };
    });
    let usage = { modelContextWindow: 100, last: { totalTokens: 75 } }, listener, disposed = false;
    const node = { token: { __scopeBrand: "AppScope" }, store: {
      get: () => usage,
      sub: (_atom, callback) => { listener = callback; return () => { disposed = true; }; },
    } };
    const controller = new AbortController();
    t.after(() => controller.abort());
    let finish, timer;
    const ready = new Promise(resolve => { finish = resolve; });
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("context discovery timed out")), 3000); });
    t.after(() => clearTimeout(timer));
    const published = [];
    const adapter = createContextUsageAdapter(controller.signal, {
      props: (_element, predicate) => {
        const props = { value: new Map([["app", node]]) };
        assert.equal(predicate(props), true);
        return props;
      },
      report: (...value) => finish(value),
    }, value => published.push(value));
    adapter.connect("fixture-thread", {});
    const report = await Promise.race([ready, timeout]);
    if (scenario.chosen) {
      assert.deepEqual(report, ["context-usage", true]);
      assert.equal(fetched.at(-1), urls[scenario.chosen]);
      if (scenario.chosen === "initial") assert.deepEqual(fetched, scenario.entry ? [urls.entry,urls.main,urls.initial] : [urls.initial]);
      assert.equal(published.at(-1).contextPercent, 75);
      usage = { modelContextWindow: 100, last: { totalTokens: 50 } };
      listener(); assert.equal(published.at(-1).contextPercent, 50);
      usage = { modelContextWindow: null, last: { totalTokens: 50 } };
      listener(); assert.equal(published.at(-1).contextPercent, null);
      controller.abort(); assert.equal(disposed, true);
    } else {
      assert.deepEqual(report, ["context-usage", false, "context-capability-unavailable"]);
      assert.equal(published.at(-1).contextPercent, null);
    }
  });
}
