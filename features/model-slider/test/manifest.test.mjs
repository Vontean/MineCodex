import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(root, "codex-feature.json"), "utf8"));

test("registers a service-free Composer model selector", () => {
  assert.equal(manifest.entry.kind, "composer-model-selector");
  assert.equal(manifest.surfaceUrl, undefined);
  assert.equal(manifest.command, undefined);
  assert.equal(manifest.modelSelector.maxVisibleItems, 6);
  assert.equal(manifest.modelSelector.favoriteStorageKey, "codex-model-slider:favorites:v1");
});

test("keeps provider identity and brand identity separate", () => {
  assert.equal(manifest.modelSelector.providerAliases["opencode-go"], "OpenCode Go");
  const deepseek = manifest.modelSelector.brands.find((brand) => brand.id === "deepseek");
  assert.deepEqual(deepseek.keywords, ["deepseek"]);
  assert.equal(deepseek.icon.resource, "assets/providers/deepseek.svg");
});

test("ships every configured SVG resource and localized selector copy", async () => {
  const resources = [
    ...Object.values(manifest.modelSelector.icons).map((icon) => icon.resource),
    ...manifest.modelSelector.brands.map((brand) => brand.icon.resource),
  ];
  await Promise.all(resources.map((resource) => access(path.join(root, resource))));
  assert.equal(manifest.modelSelector.strings.searchPlaceholder, undefined);
  assert.equal(manifest.modelSelector.strings.unstar.en, "Unstar {model}");
});
