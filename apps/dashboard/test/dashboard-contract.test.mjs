import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Dashboard has a per-card DOM update seam and all truthful runtime states", async () => {
  const app = await readFile(path.join(dashboardRoot, "app.js"), "utf8");
  const html = await readFile(path.join(dashboardRoot, "index.html"), "utf8");
  const styles = await readFile(path.join(dashboardRoot, "styles.css"), "utf8");

  assert.match(app, /function updatePluginCard\(/);
  assert.match(app, /document\.activeElement/);
  assert.match(app, /pendingFeatureIds/);
  assert.match(app, /updatePluginCard\(card/);
  assert.match(app, /updatePluginCard\(card, previousFeature\)/);
  assert.match(app, /saved|launching|injected|healthy|failed|stopped|restart-required/);
  assert.match(app, /injected: "Active in Codex"/);
  assert.match(app, /injected: "已在 Codex 中生效"/);
  assert.doesNotMatch(app, /Injected in Codex|已注入 Codex/);
  assert.doesNotMatch(app, /pluginList\.innerHTML/);
  assert.doesNotMatch(app, /state\.features = result\.features/);
  assert.match(app, /data-feature-id/);
  assert.match(html, /id="plugin-list"/);
  assert.match(styles, /\.status-dot\.is-failed/);
});
