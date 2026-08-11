import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  discoverFeatures,
  loadConfiguredModelCatalog,
  selectEnabledFeatures,
  startFeatureProcesses,
  validateFeatureHealth,
} from "../src/feature-registry.mjs";

function serviceFeature(id, command = ["/usr/bin/false", id]) {
  return {
    id,
    label: id,
    surfaceUrl: `http://127.0.0.1:47${id === "notes" ? "832" : "831"}/`,
    healthUrl: `http://127.0.0.1:47${id === "notes" ? "832" : "831"}/api/health`,
    command,
    projectDir: "/tmp",
  };
}

function fakeChild(pid, { exitsOnTerm = true } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.kills = [];
  child.unref = () => {};
  child.kill = (signal) => {
    child.kills.push(signal);
    if (signal === "SIGTERM" && exitsOnTerm) {
      queueMicrotask(() => {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      });
    }
    if (signal === "SIGKILL") {
      queueMicrotask(() => {
        child.signalCode = "SIGKILL";
        child.emit("exit", null, "SIGKILL");
      });
    }
    return true;
  };
  return child;
}

async function waitFor(predicate, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail("Timed out waiting for the feature lifecycle transition");
}

test("distinguishes an absent feature filter from an explicitly empty filter", () => {
  const features = [{ id: "model-slider" }, { id: "notes" }, { id: "images" }];
  assert.deepEqual(selectEnabledFeatures(features, undefined), features);
  assert.deepEqual(selectEnabledFeatures(features, ""), []);
  assert.deepEqual(selectEnabledFeatures(features, "notes,images").map((feature) => feature.id), ["notes", "images"]);
});

test("keeps service-free model-slider configured until the current renderer is injected", async () => {
  const supervisor = await startFeatureProcesses([{
    id: "model-slider",
    label: "Model Slider",
    surfaceUrl: null,
  }], { instanceId: "runtime-instance-model", logger: { log() {}, warn() {} } });

  assert.equal(supervisor.plugins[0].state, "configured");
  assert.equal(supervisor.getStatuses({ rendererActive: false })[0].state, "configured");
  assert.equal(supervisor.getStatuses({ rendererActive: true })[0].state, "injected");
  await supervisor.stop();
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

test("rejects a foreign 2xx health service instead of accepting reachability", async () => {
  const child = fakeChild(9101);
  const supervisor = await startFeatureProcesses([serviceFeature("notes")], {
    instanceId: "runtime-instance-1",
    healthTimeoutMs: 30,
    startupTimeoutMs: 40,
    spawnProcess: () => child,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { ok: true, service: "foreign-service", protocolVersion: 1, instanceId: "foreign" };
      },
    }),
    logger: { log() {}, warn() {} },
  });

  assert.equal(supervisor.plugins[0].state, "failed");
  assert.equal(supervisor.plugins[0].failure.code, "HEALTH_IDENTITY_MISMATCH");
  assert.equal(supervisor.plugins[0].owned, true);
  assert.deepEqual(child.kills, ["SIGTERM"]);
  assert.equal(child.exitCode, 0);
  await supervisor.stop();
  assert.deepEqual(child.kills, ["SIGTERM"]);
});

test("requires protocol version 1 and the current feature instance", () => {
  assert.equal(
    validateFeatureHealth(
      { service: "notes", protocolVersion: 2, instanceId: "runtime-instance-1" },
      "notes",
      "runtime-instance-1",
    ).failure.code,
    "HEALTH_PROTOCOL_MISMATCH",
  );
  assert.equal(
    validateFeatureHealth(
      { service: "notes", protocolVersion: 1, instanceId: "stale-instance" },
      "notes",
      "runtime-instance-1",
    ).failure.code,
    "HEALTH_INSTANCE_MISMATCH",
  );
});

test("bounds a hung health endpoint and starts a healthy sibling independently", async () => {
  const slowChild = fakeChild(9102);
  const healthyChild = fakeChild(9103);
  const children = [];
  const attempts = new Map();
  const startedAt = Date.now();
  const supervisor = await startFeatureProcesses([
    serviceFeature("notes"),
    serviceFeature("images"),
  ], {
    instanceId: "runtime-instance-2",
    healthTimeoutMs: 25,
    startupTimeoutMs: 60,
    pollIntervalMs: 5,
    spawnProcess(command, args, options) {
      children.push({ command, args, options });
      return args[0] === "notes" ? slowChild : healthyChild;
    },
    fetchImpl(url, { signal }) {
      if (url.includes("47832")) {
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
        });
      }
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve({
        ok: true,
        async json() {
          return { service: "images", protocolVersion: 1, instanceId: "runtime-instance-2" };
        },
      });
    },
    logger: { log() {}, warn() {} },
  });

  assert.ok(Date.now() - startedAt < 500);
  assert.equal(supervisor.plugins.find((plugin) => plugin.featureId === "notes").state, "failed");
  assert.equal(supervisor.plugins.find((plugin) => plugin.featureId === "notes").failure.code, "HEALTH_TIMEOUT");
  assert.equal(supervisor.plugins.find((plugin) => plugin.featureId === "images").state, "ready");
  assert.equal(children.length, 2);
  assert.equal(children[0].options.env.MINECODEX_FEATURE_INSTANCE_ID, "runtime-instance-2");
  assert.equal(children[1].options.env.MINECODEX_FEATURE_INSTANCE_ID, "runtime-instance-2");
  await supervisor.stop();
});

test("waits for exact owned child exit and escalates only after the bounded timeout", async () => {
  const stubbornChild = fakeChild(9104, { exitsOnTerm: false });
  const supervisor = await startFeatureProcesses([serviceFeature("notes")], {
    instanceId: "runtime-instance-3",
    healthTimeoutMs: 20,
    startupTimeoutMs: 25,
    stopTimeoutMs: 20,
    killTimeoutMs: 20,
    spawnProcess: () => stubbornChild,
    fetchImpl: async () => {
      throw new Error("offline");
    },
    logger: { log() {}, warn() {} },
  });

  await supervisor.stop();
  assert.deepEqual(stubbornChild.kills, ["SIGTERM", "SIGKILL"]);
  assert.equal(supervisor.plugins[0].state, "failed");
});

test("a restart owns a new child instead of reusing a dying child", async () => {
  const firstChild = fakeChild(9105, { exitsOnTerm: false });
  const secondChild = fakeChild(9106);
  let spawnCount = 0;
  const options = {
    instanceId: "runtime-instance-4",
    healthTimeoutMs: 20,
    startupTimeoutMs: 25,
    spawnProcess: () => (++spawnCount === 1 ? firstChild : secondChild),
    fetchImpl: async () => {
      throw new Error("offline");
    },
    stopTimeoutMs: 20,
    killTimeoutMs: 20,
    logger: { log() {}, warn() {} },
  };
  const first = await startFeatureProcesses([serviceFeature("notes")], options);
  const second = await startFeatureProcesses([serviceFeature("notes")], options);

  assert.equal(spawnCount, 2);
  assert.equal(first.plugins[0].owned, true);
  assert.equal(second.plugins[0].owned, true);
  assert.notEqual(first.plugins[0].child, second.plugins[0].child);
  await first.stop();
  await second.stop();
});

test("surfaces a bounded shutdown failure when an owned child never confirms exit", async () => {
  const child = new EventEmitter();
  child.pid = 9107;
  child.exitCode = null;
  child.signalCode = null;
  child.kills = [];
  child.unref = () => {};
  child.kill = (signal) => {
    child.kills.push(signal);
    return true;
  };
  const supervisor = await startFeatureProcesses([serviceFeature("notes")], {
    instanceId: "runtime-instance-5",
    healthTimeoutMs: 10,
    startupTimeoutMs: 20,
    stopTimeoutMs: 10,
    killTimeoutMs: 10,
    spawnProcess: () => child,
    fetchImpl: async () => {
      throw new Error("offline");
    },
    logger: { log() {}, warn() {} },
  });

  assert.equal(supervisor.plugins[0].state, "failed");
  assert.deepEqual(child.kills, ["SIGTERM", "SIGKILL"]);
  assert.equal(supervisor.plugins[0].failure.cleanup.code, "FEATURE_CHILD_SHUTDOWN_TIMEOUT");
  await assert.rejects(supervisor.stop(), /FEATURE_CHILD_SHUTDOWN_TIMEOUT/);
  assert.equal(supervisor.plugins[0].state, "failed");
});

test("marks ready owned features failed when their child later exits or errors", async () => {
  const children = new Map([
    ["notes", fakeChild(9201)],
    ["images", fakeChild(9202)],
  ]);
  const attempts = new Map();
  const statusChanges = [];
  const supervisor = await startFeatureProcesses([
    serviceFeature("notes"),
    serviceFeature("images"),
  ], {
    instanceId: "runtime-instance-post-ready",
    spawnProcess(command, args) {
      return children.get(args[0]);
    },
    fetchImpl: async (url) => {
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) throw new Error("offline");
      const featureId = url.includes("47832") ? "notes" : "images";
      return {
        ok: true,
        async json() {
          return {
            service: featureId,
            protocolVersion: 1,
            instanceId: "runtime-instance-post-ready",
          };
        },
      };
    },
    onStatusChange: () => statusChanges.push("changed"),
    logger: { log() {}, warn() {} },
  });

  assert.deepEqual(supervisor.plugins.map((plugin) => plugin.state), ["ready", "ready"]);
  assert.ok(supervisor.plugins.every((plugin) => plugin.health));

  const notesChild = children.get("notes");
  notesChild.exitCode = 23;
  notesChild.emit("exit", 23, null);
  children.get("images").emit("error", new Error("runtime pipe broke"));

  const notes = supervisor.plugins.find((plugin) => plugin.featureId === "notes");
  const images = supervisor.plugins.find((plugin) => plugin.featureId === "images");
  assert.equal(notes.state, "failed");
  assert.equal(notes.health, null);
  assert.equal(notes.failure.code, "CHILD_EXITED");
  assert.equal(notes.failure.phase, "runtime");
  assert.match(notes.failure.message, /23/);
  assert.equal(images.state, "failed");
  assert.equal(images.health, null);
  assert.equal(images.failure.code, "CHILD_ERROR");
  assert.equal(images.failure.phase, "runtime");
  assert.match(images.failure.message, /runtime pipe broke/);
  assert.ok(statusChanges.length >= 4);
  await supervisor.stop();
});

test("returns deferred supervisors before slow feature health settles and emits status changes", async () => {
  let releaseHealth;
  const statusChanges = [];
  const startPromise = startFeatureProcesses([
    { id: "model-slider", label: "Model Slider", surfaceUrl: null },
    serviceFeature("notes"),
  ], {
    instanceId: "runtime-instance-deferred",
    deferredStart: true,
    fetchImpl: () => new Promise((resolve) => {
      releaseHealth = () => resolve({
        ok: true,
        async json() {
          return {
            service: "notes",
            protocolVersion: 1,
            instanceId: "runtime-instance-deferred",
          };
        },
      });
    }),
    onStatusChange: () => statusChanges.push("changed"),
    logger: { log() {}, warn() {} },
  });
  const immediate = await Promise.race([
    startPromise.then((supervisor) => ({ supervisor })),
    new Promise((resolve) => setTimeout(() => resolve(null), 20)),
  ]);
  const initialStates = immediate?.supervisor.plugins.map((plugin) => plugin.state);
  releaseHealth?.();
  const supervisor = await startPromise;

  assert.ok(immediate, "deferred start should return before the slow health response");
  assert.deepEqual(initialStates, ["configured", "launching"]);
  await supervisor.waitForStartup();
  assert.deepEqual(supervisor.plugins.map((plugin) => plugin.state), ["configured", "ready"]);
  assert.ok(statusChanges.length >= 1);
  await supervisor.stop();
});

test("stops safely during deferred owned-child startup without reporting an intentional exit", async () => {
  const child = fakeChild(9203);
  let healthAttempt = 0;
  const statusChanges = [];
  const startPromise = startFeatureProcesses([serviceFeature("notes")], {
    instanceId: "runtime-instance-stop-deferred",
    deferredStart: true,
    healthTimeoutMs: 150,
    startupTimeoutMs: 200,
    stopTimeoutMs: 30,
    killTimeoutMs: 30,
    spawnProcess: () => child,
    fetchImpl(url, { signal }) {
      healthAttempt += 1;
      if (healthAttempt === 1) return Promise.reject(new Error("offline"));
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }, { once: true });
      });
    },
    onStatusChange: () => statusChanges.push("changed"),
    logger: { log() {}, warn() {} },
  });
  const immediate = await Promise.race([
    startPromise.then((supervisor) => ({ supervisor })),
    new Promise((resolve) => setTimeout(() => resolve(null), 20)),
  ]);
  const supervisor = await startPromise;

  assert.ok(immediate, "deferred start should expose the supervisor while startup is in flight");
  await waitFor(() => supervisor.plugins[0].owned);
  await supervisor.stop();
  await supervisor.waitForStartup();
  assert.deepEqual(child.kills, ["SIGTERM"]);
  assert.equal(supervisor.plugins[0].state, "stopped");
  assert.equal(supervisor.plugins[0].health, null);
  assert.equal(supervisor.plugins[0].failure, null);
  assert.ok(statusChanges.length >= 1);
});
