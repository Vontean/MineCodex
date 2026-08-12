import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(root, "codex-feature.json"), "utf8"));
const source = await readFile(path.join(root, manifest.entry.script), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");

test("registers a service-free page-script feature", () => {
  assert.equal(manifest.entry.kind, "page-script");
  assert.equal(manifest.surfaceUrl, undefined);
  assert.equal(manifest.command, undefined);
  assert.equal(manifest.entry.script, "src/hide-upsell-banner.mjs");
  assert.equal(manifest.icon.viewBox, "0 0 24 24");
  assert.match(manifest.icon.markup, /<rect/);
});

test("ships the injected script and keeps the rate-limit query path untouched", async () => {
  await access(path.join(root, manifest.entry.script));
  assert.match(source, /account\/rateLimits\/read/);
  assert.match(source, /out of Codex and Work usage/i);
  assert.match(readme, /不拦截、不篡改额度查询接口/);
});

test("script body matches the runtime-host page-script contract", () => {
  assert.match(source, /new Function\("signal", "window", "document", "MutationObserver"/);
  assert.match(source, /^return \(\) =>/m);
  assert.match(source, /observer\.disconnect\(\)/);
});
