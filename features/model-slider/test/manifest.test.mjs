import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(root, "codex-feature.json"), "utf8"));
const readme = await readFile(path.join(root, "DEVELOPMENT.md"), "utf8");
const product = await readFile(path.join(root, "PRODUCT.md"), "utf8");

test("registers a service-free Composer model selector", () => {
  assert.equal(manifest.entry.kind, "composer-model-selector");
  assert.equal(manifest.surfaceUrl, undefined);
  assert.equal(manifest.command, undefined);
  assert.equal(manifest.modelSelector.maxVisibleItems, 6);
  assert.equal(manifest.modelSelector.favoriteStorageKey, "codex-model-slider:favorites:v1");
  assert.equal(manifest.modelSelector.reasoningEffortOverrides, undefined);
});

test("keeps provider identity and brand identity separate", () => {
  assert.equal(manifest.modelSelector.providerAliases["opencode-go"], "OpenCode Go");
  const deepseek = manifest.modelSelector.brands.find((brand) => brand.id === "deepseek");
  assert.deepEqual(deepseek.keywords, ["deepseek"]);
  assert.equal(deepseek.icon.resource, "assets/providers/deepseek.svg");
  assert.equal(manifest.modelSelector.providerAliases["meta"], "Meta");
  const muse = manifest.modelSelector.brands.find((brand) => brand.id === "muse");
  assert.deepEqual(muse.keywords, ["muse", "muse-spark"]);
  assert.equal(muse.icon.resource, "assets/providers/muse.svg");
});

test("maps Tencent and OpenCode Go HY models to Hunyuan without broad HY matching", () => {
  const identity = (raw) => {
    const slash = raw.indexOf("/");
    return {
      raw,
      backend: slash > 0 ? raw.slice(slash + 1) : raw,
    };
  };
  const brandForModel = (raw) => {
    const model = identity(raw);
    const haystack = `${model.backend} ${model.raw}`.toLowerCase();
    return manifest.modelSelector.brands.find((brand) => (
      brand.keywords.some((keyword) => haystack.includes(keyword))
    ))?.id ?? null;
  };

  assert.equal(brandForModel("opencode-go/hy3"), "hunyuan");
  assert.equal(brandForModel("opencode-go/hunyuan-3"), "hunyuan");
  assert.equal(brandForModel("tencent/model-3"), "hunyuan");
  assert.equal(brandForModel("tencent/hy-3"), "hunyuan");
  assert.equal(brandForModel("tencent/hunyuan-3"), "hunyuan");
  assert.equal(brandForModel("other-provider/hy3"), null);
  assert.equal(brandForModel("opencode-go/hyphen-3"), null);
  assert.ok(!manifest.modelSelector.brands
    .find((brand) => brand.id === "hunyuan")
    .keywords.includes("hy"));
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

test("does not advertise the removed model search feature", () => {
  assert.doesNotMatch(manifest.description.en, /\bsearch\b/i);
  assert.doesNotMatch(manifest.description["zh-CN"], /搜索/);
  assert.doesNotMatch(readme, /模型超过 12 个时显示搜索/);
  assert.doesNotMatch(product, /conditional search/i);
});
