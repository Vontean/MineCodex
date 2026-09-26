import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const featureDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("session status is a declarative page script with valid renderer syntax", async () => {
  const manifest = JSON.parse(await readFile(path.join(featureDir, "codex-feature.json"), "utf8"));
  assert.equal(manifest.id, "session-status");
  assert.equal(manifest.entry.kind, "page-script");
  const source = await readFile(path.join(featureDir, manifest.entry.script), "utf8");
  assert.doesNotThrow(() => new Function("signal", "window", "document", "MutationObserver", "config", source));
});
