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
