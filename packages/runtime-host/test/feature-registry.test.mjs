import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverFeatures, loadConfiguredModelCatalog, selectEnabledFeatures } from "../src/feature-registry.mjs";

test("distinguishes an absent feature filter from an explicitly empty filter", () => {
  const features = [{ id: "model-slider" }, { id: "notes" }, { id: "images" }];
  assert.deepEqual(selectEnabledFeatures(features, undefined), features);
  assert.deepEqual(selectEnabledFeatures(features, ""), []);
  assert.deepEqual(selectEnabledFeatures(features, "notes,images").map((feature) => feature.id), ["notes", "images"]);
});

test("does not hide missing resources behind manifest discovery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-missing-resource-"));
  try {
    const featureDir = path.join(root, "Broken");
    await mkdir(featureDir);
    await writeFile(path.join(featureDir, "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "broken",
      label: "Broken",
      surfaceUrl: "http://127.0.0.1:47839",
      icon: { resource: "assets/missing.svg" },
    }));
    await assert.rejects(discoverFeatures(root), /Invalid Broken\/codex-feature\.json.*ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discovers sibling Codex features and orders them by placement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-features-"));
  try {
    await mkdir(path.join(root, "Notes"));
    await mkdir(path.join(root, "Images"));
    await mkdir(path.join(root, "Unrelated"));
    await writeFile(path.join(root, "Notes", "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "notes",
      label: { en: "Notes", "zh-CN": "笔记" },
      surfaceUrl: "http://127.0.0.1:47832",
      placement: { after: "sites", order: 20 },
    }));
    await writeFile(path.join(root, "Images", "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "images",
      label: "Images",
      surfaceUrl: "http://127.0.0.1:47831",
      placement: { after: "sites", order: 10 },
      command: ["node", "src/main.mjs"],
    }));

    const features = await discoverFeatures(root);
    assert.deepEqual(features.map((feature) => feature.id), ["images", "notes"]);
    assert.equal(features[0].surfaceUrl, "http://127.0.0.1:47831/");
    assert.equal(features[0].projectDir, path.join(root, "Images"));
    assert.deepEqual(features[0].command, ["node", "src/main.mjs"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normalizes a conversation toolbar feature, local SVG resource, and registered Host actions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-toolbar-feature-"));
  try {
    const project = path.join(root, "Notes");
    const iconDirectory = path.join(project, "icons");
    await mkdir(iconDirectory, { recursive: true });
    await writeFile(
      path.join(iconDirectory, "notebook-tabs.svg"),
      '<svg viewBox="0 0 32 32"><path d="M4 4h24v24H4z" /></svg>',
    );
    await writeFile(
      path.join(iconDirectory, "list-todo.svg"),
      '<svg viewBox="0 0 24 24"><path d="M13 5h8" /></svg>',
    );
    await writeFile(path.join(project, "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "notes",
      label: { en: "Notes", "zh-CN": "笔记" },
      surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
      healthUrl: "http://127.0.0.1:47832/api/health",
      entry: {
        kind: "conversation-toolbar",
        ariaLabel: { en: "Toggle pinned notes", "zh-CN": "切换固定笔记" },
      },
      pinnedSummary: {
        label: { en: "Pinned Notes", "zh-CN": "固定笔记" },
        surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
        presentation: "responsive-summary",
        overlayLabel: { en: "Toggle notes", "zh-CN": "切换笔记" },
        pinnedLabel: { en: "Toggle pinned notes", "zh-CN": "切换固定笔记" },
      },
      detailTabs: [
        {
          id: "todo",
          label: { en: "Todo", "zh-CN": "待办" },
          surfaceUrl: "http://127.0.0.1:47832/?surface=todo",
          icon: { resource: "icons/list-todo.svg" },
        },
        { id: "notes", label: "Notes", surfaceUrl: "http://127.0.0.1:47832/?surface=notes" },
        { id: "files", label: "Files", surfaceUrl: "http://127.0.0.1:47832/?surface=files" },
      ],
      hostActions: ["insert-text", "attach-file", "open-detail-tab", "open-editor-modal", "resolve-file-paths"],
      icon: { resource: "icons/notebook-tabs.svg" },
    }));

    const [feature] = await discoverFeatures(root);
    assert.equal(feature.entry.kind, "conversation-toolbar");
    assert.equal(feature.entry.ariaLabel, "Toggle pinned notes");
    assert.equal(feature.entry.ariaLabels["zh-CN"], "切换固定笔记");
    assert.equal(feature.label, "Notes");
    assert.equal(feature.labels["zh-CN"], "笔记");
    assert.equal(feature.pinnedSummary.label, "Pinned Notes");
    assert.equal(feature.pinnedSummary.labels["zh-CN"], "固定笔记");
    assert.equal(feature.pinnedSummary.presentation, "responsive-summary");
    assert.equal(feature.pinnedSummary.overlayLabel, "Toggle notes");
    assert.equal(feature.pinnedSummary.overlayLabels["zh-CN"], "切换笔记");
    assert.equal(feature.pinnedSummary.pinnedLabel, "Toggle pinned notes");
    assert.equal(feature.pinnedSummary.pinnedLabels["zh-CN"], "切换固定笔记");
    assert.deepEqual(feature.detailTabs.map((detail) => detail.id), ["todo", "notes", "files"]);
    assert.equal(feature.detailTabs[0].icon.viewBox, "0 0 24 24");
    assert.equal(feature.detailTabs[0].labels["zh-CN"], "待办");
    assert.match(feature.detailTabs[0].icon.markup, /<path d="M13 5h8" \/>/);
    assert.equal(feature.detailTabs[1].icon, null);
    assert.deepEqual(feature.hostActions, [
      "insert-text",
      "attach-file",
      "open-detail-tab",
      "open-editor-modal",
      "resolve-file-paths",
    ]);
    assert.equal(feature.icon.viewBox, "0 0 32 32");
    assert.match(feature.icon.markup, /<path d="M4 4h24v24H4z" \/>/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("normalizes a service-free Composer model selector and its local assets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-model-selector-"));
  try {
    const project = path.join(root, "ModelSlider");
    const icons = path.join(project, "icons");
    await mkdir(icons, { recursive: true });
    for (const name of ["fallback", "star", "unstar", "deepseek"]) {
      await writeFile(
        path.join(icons, `${name}.svg`),
        `<svg viewBox="0 0 24 24"><path data-icon="${name}" /></svg>`,
      );
    }
    await writeFile(path.join(project, "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "model-slider",
      label: { en: "Model Slider", "zh-CN": "模型滑条" },
      entry: { kind: "composer-model-selector" },
      modelSelector: {
        maxVisibleItems: 6,
        favoriteStorageKey: "codex-model-slider:favorites:v1",
        providerAliases: { "OpenCode-Go": "OpenCode Go" },
        strings: {
          star: { en: "Star {model}", "zh-CN": "收藏 {model}" },
          unstar: { en: "Unstar {model}", "zh-CN": "取消收藏 {model}" },
        },
        icons: {
          fallback: { resource: "icons/fallback.svg" },
          star: { resource: "icons/star.svg" },
          unstar: { resource: "icons/unstar.svg" },
        },
        brands: [
          { id: "deepseek", keywords: ["DeepSeek"], icon: { resource: "icons/deepseek.svg" } },
        ],
      },
    }));

    const [feature] = await discoverFeatures(root);
    assert.equal(feature.entry.kind, "composer-model-selector");
    assert.equal(feature.surfaceUrl, null);
    assert.equal(feature.healthUrl, null);
    assert.equal(feature.modelSelector.maxVisibleItems, 6);
    assert.equal(feature.modelSelector.providerAliases["opencode-go"], "OpenCode Go");
    assert.equal(feature.modelSelector.strings.searchPlaceholder, undefined);
    assert.equal(feature.modelSelector.brands[0].keywords[0], "deepseek");
    assert.match(feature.modelSelector.brands[0].icon.markup, /data-icon="deepseek"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loads only model-control metadata from Codex's configured catalog", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-model-catalog-"));
  try {
    const configPath = path.join(root, "config.toml");
    await writeFile(configPath, 'model_catalog_json = "catalog.json"\n');
    await writeFile(path.join(root, "catalog.json"), JSON.stringify({
      models: [{
        slug: "opencode-go/deepseek-v4-flash",
        display_name: "DeepSeek V4 Flash",
        default_reasoning_level: "high",
        supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
        additional_speed_tiers: [],
        ignored_secret_like_field: "not projected",
      }],
    }));
    assert.deepEqual(await loadConfiguredModelCatalog(configPath), [{
      slug: "opencode-go/deepseek-v4-flash",
      displayName: "DeepSeek V4 Flash",
      defaultReasoningLevel: "high",
      supportedReasoningLevels: [
        { effort: "low", description: "" },
        { effort: "high", description: "" },
      ],
      additionalSpeedTiers: [],
      serviceTiers: [],
    }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses native Codex mode when no model catalog is configured", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-native-models-"));
  try {
    const configPath = path.join(root, "config.toml");
    await writeFile(configPath, 'model = "gpt-5.6"\n');
    assert.deepEqual(await loadConfiguredModelCatalog(configPath), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unregistered Host capabilities during feature discovery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-invalid-feature-"));
  try {
    const project = path.join(root, "Notes");
    await mkdir(project);
    await writeFile(path.join(project, "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "notes",
      label: "Notes",
      surfaceUrl: "http://127.0.0.1:47832/",
      hostActions: ["send-message"],
    }));

    await assert.rejects(discoverFeatures(root), /unsupported action/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects non-native pinned Summary presentation contracts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-runtime-invalid-summary-"));
  try {
    const project = path.join(root, "Notes");
    await mkdir(project);
    await writeFile(path.join(project, "codex-feature.json"), JSON.stringify({
      schemaVersion: 1,
      id: "notes",
      label: "Notes",
      surfaceUrl: "http://127.0.0.1:47832/",
      entry: { kind: "conversation-toolbar", ariaLabel: "Toggle pinned notes" },
      pinnedSummary: {
        surfaceUrl: "http://127.0.0.1:47832/?surface=summary",
        presentation: "legacy-fixed",
      },
    }));

    await assert.rejects(discoverFeatures(root), /must be responsive-summary/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
