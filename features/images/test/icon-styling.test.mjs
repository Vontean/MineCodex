import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses Codex's 1px visual weight for all 24px outline icons", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /icon\.setAttribute\("stroke-width", "1\.5"\)/);
  assert.doesNotMatch(app, /icon\.setAttribute\("stroke-width", "2"\)/);
  assert.match(styles, /\.lucide\s*\{[^}]*stroke-width:\s*1\.5;/s);
  assert.doesNotMatch(styles, /\.lucide\s*\{[^}]*stroke-width:\s*2;/s);
});

test("legacy gallery retains its sidebar control without registering a native sidebar entry", async () => {
  const [html, app, styles, manifestSource, runtime] = await Promise.all([
    readFile(new URL("../web/index.html", import.meta.url), "utf8"),
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../codex-feature.json", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/runtime-host/src/codex-injection.mjs", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.match(html, /class="icon-button sidebar-open-button"[^>]*hidden/);
  assert.match(html, /class="sidebar-toggle-icon" viewBox="0 0 20 20"/);
  assert.match(app, /codex-personal:sidebar-state/);
  assert.match(app, /libraryHeader\.style\.paddingLeft/);
  assert.match(app, /requestHostAction\("open-sidebar", \{\}\)/);
  assert.match(styles, /\.sidebar-open-button\[hidden\] \{ display: none; \}/);
  assert.match(styles, /\.sidebar-toggle-icon \{[^}]*width: 16px;[^}]*height: 16px;/s);
  assert.equal(manifest.entry.kind, "page-script");
  assert.deepEqual(manifest.hostActions, ["local-image-source"]);
  assert.match(runtime, /button\[data-app-shell-sidebar-trigger="true"\]/);
  assert.match(runtime, /if \(action === "open-sidebar"\)/);
  assert.match(runtime, /type: "codex-personal:sidebar-state"/);
});
