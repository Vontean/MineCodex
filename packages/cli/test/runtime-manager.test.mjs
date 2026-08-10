import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeConfig } from "../src/config.mjs";
import { RuntimeManager } from "../src/runtime-manager.mjs";

test("runtime manager starts only configured plugins and restarts the owned Codex process", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-"));
  const paths = {
    packageRoot: root,
    supportDir: path.join(root, "support"),
    configPath: path.join(root, "support", "config.json"),
    runtimeEntry: path.join(root, "runtime.mjs"),
    featuresRoot: path.join(root, "features"),
    profileDir: path.join(root, "profile"),
    imagesDataDir: path.join(root, "images"),
    notesDataDir: path.join(root, "notes"),
    codexPidPath: path.join(root, "codex.pid"),
    runtimeReadyPath: path.join(root, "runtime-ready.json"),
  };
  await writeConfig(paths.configPath, {
    schemaVersion: 1,
    features: { "model-slider": true, notes: false, images: true },
  });
  let spawnOptions;
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    spawnOptions = options;
    const child = new EventEmitter();
    child.pid = 42 + children.length;
    child.exitCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      features: options.env.MINECODEX_ENABLED_FEATURES.split(",").filter(Boolean),
      failures: [],
    })));
    return child;
  };
  let terminated = 0;
  const platform = { terminateOwnedCodex: async () => { terminated += 1; } };
  const manager = new RuntimeManager({ paths, platform, spawnProcess, logger: { error() {} } });
  await manager.start();
  assert.equal(spawnOptions.env.MINECODEX_ENABLED_FEATURES, "model-slider,images");
  assert.deepEqual(manager.status().appliedFeatures, ["model-slider", "images"]);
  await manager.restart();
  assert.equal(terminated, 1);
  assert.equal(children.length, 2);
  await manager.stop();
});
