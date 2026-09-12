import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeConfig } from "../src/config.mjs";
import { RuntimeManager } from "../src/runtime-manager.mjs";

const acceptCdpOwner = async () => true;

test("runtime manager starts configured plugins and restarts without broad native termination", async () => {
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
  let terminatedOwned = 0;
  let terminatedNative = 0;
  const platform = {
    terminateOwnedCodex: async () => { terminatedOwned += 1; },
    terminateNativeCodex: async () => { terminatedNative += 1; },
  };
  const manager = new RuntimeManager({ paths, platform, spawnProcess, logger: { error() {} } });
  await manager.start();
  assert.equal(spawnOptions.env.MINECODEX_ENABLED_FEATURES, "model-slider,images,hide-upsell-banner");
  assert.equal(spawnOptions.env.MINECODEX_LAUNCH_CODEX, undefined);
  assert.deepEqual(manager.status().appliedFeatures, ["model-slider", "images", "hide-upsell-banner"]);
  await manager.restart();
  assert.equal(terminatedOwned, 1);
  assert.equal(terminatedNative, 0);
  assert.equal(spawnOptions.env.MINECODEX_LAUNCH_CODEX, undefined);
  assert.equal(children.length, 2);
  await manager.stop();
});

test("runtime manager verifies the resolved Codex installation without passing a foreground launch path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-codex-path-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const executable = "/Users/example/Applications/ChatGPT.app/Contents/MacOS/ChatGPT";
  let spawnOptions;
  let codexCalls = 0;
  const child = new EventEmitter();
  child.pid = 75;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0, null));
  };
  const manager = new RuntimeManager({
    paths,
    platform: {
      codex: async () => {
        codexCalls += 1;
        return {
        appPath: "/Users/example/Applications/ChatGPT.app",
        executable,
        };
      },
    },
    spawnProcess: (_command, _args, options) => {
      spawnOptions = options;
      queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
        pid: child.pid,
        features: ["notes"],
        failures: [],
      })));
      return child;
    },
    logger: { error() {} },
  });

  await manager.start();
  assert.equal(codexCalls, 1);
  assert.equal(spawnOptions.env.MINECODEX_CODEX_EXECUTABLE, undefined);
  await manager.stop();
});

test("concurrent restart requests share one lifecycle operation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-queue-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 100 + children.length;
    child.exitCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: "runtime-session-1",
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-session-1" },
      failures: [],
    })));
    return child;
  };
  let terminateCalls = 0;
  const platform = {
    terminateOwnedCodex: async () => {
      terminateCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 3));
    },
  };
  const manager = new RuntimeManager({ paths, platform, spawnProcess, logger: { error() {} } });
  await manager.start();

  await writeFile(paths.runtimeReadyPath, JSON.stringify({
    pid: children[0].pid,
    runtimeSessionId: "runtime-session-1",
    plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
    renderer: { discovered: false, injectedTargets: 0, active: false, runtimeSessionId: "runtime-session-1" },
    failures: [],
  }));
  const refreshed = await manager.refreshStatus();
  assert.equal(refreshed.renderer.active, false);

  await Promise.all([manager.restart(), manager.restart(), manager.restart()]);

  assert.equal(terminateCalls, 1);
  assert.equal(children.length, 2);
  await manager.stop();
});

test("restart stops the RuntimeHost before terminating owned Codex, then starts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-order-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const events = [];
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 200 + children.length;
    child.exitCode = null;
    child.kill = () => {};
    child.signalReceived = null;
    child.received = [];
    const originalKill = child.kill;
    child.kill = (signal) => {
      child.received.push(signal);
      if (signal === "SIGTERM") {
        setTimeout(() => {
          child.exitCode = 0;
          child.emit("exit", 0, null);
        }, 5);
      }
    };
    child.exit = (code) => {
      child.exitCode = code;
      child.emit("exit", code, null);
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: "runtime-order-session",
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-order-session" },
      failures: [],
    })));
    return child;
  };
  const platform = {
    terminateOwnedCodex: async () => { events.push("terminate-owned"); },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    logger: { error() {} },
    sleep: async (ms) => { await new Promise((resolve) => setTimeout(resolve, ms)); },
    stopTimeoutMs: 200,
  });
  await manager.start();
  await manager.restart();
  assert.deepEqual(children[0].received, ["SIGTERM"]);
  assert.deepEqual(events, ["terminate-owned"]);
  assert.equal(children.length, 2);
  assert.equal(manager.child.pid, 201);
  await manager.stop();
});

test("stopInternal rejects when exact exit is not observed after SIGKILL", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-stuck-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const child = new EventEmitter();
  child.pid = 300;
  child.exitCode = null;
  child.received = [];
  child.kill = (signal) => { child.received.push(signal); };
  const manager = new RuntimeManager({
    paths,
    platform: { terminateOwnedCodex: async () => {} },
    spawnProcess: () => child,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 10,
  });
  manager.child = child;
  manager.ready = { runtimeSessionId: "session" };
  await assert.rejects(manager.stopInternal(), /did not exit after SIGKILL/);
  assert.deepEqual(child.received, ["SIGTERM", "SIGKILL"]);
  assert.equal(manager.child, child);
  assert.equal(manager.status().running, true);
  assert.equal(manager.status().pid, child.pid);
});

test("stopInternal accepts a delayed exit before the SIGKILL deadline", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-delayed-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const child = new EventEmitter();
  child.pid = 400;
  child.exitCode = null;
  child.received = [];
  child.kill = (signal) => {
    child.received.push(signal);
    if (signal === "SIGTERM") {
      setTimeout(() => {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }, 10);
    }
  };
  const manager = new RuntimeManager({
    paths,
    platform: { terminateOwnedCodex: async () => {} },
    spawnProcess: () => child,
    logger: { error() {} },
    sleep: async () => { await new Promise((resolve) => setTimeout(resolve, 1)); },
    stopTimeoutMs: 200,
  });
  manager.child = child;
  await manager.stopInternal();
  assert.deepEqual(child.received, ["SIGTERM"]);
  assert.equal(manager.child, null);
});

test("restart aborts without starting or terminating Codex when RuntimeHost stop is not confirmed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-stop-fail-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  let terminateCalls = 0;
  let startCalls = 0;
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    startCalls += 1;
    const child = new EventEmitter();
    child.pid = 500 + startCalls;
    child.exitCode = null;
    child.received = [];
    child.kill = (signal) => { child.received.push(signal); };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: "runtime-stop-fail-session",
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-stop-fail-session" },
      failures: [],
    })));
    return child;
  };
  const manager = new RuntimeManager({
    paths,
    platform: { terminateOwnedCodex: async () => { terminateCalls += 1; } },
    spawnProcess,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 5,
  });
  await manager.start();
  await assert.rejects(manager.restart(), /did not exit after SIGKILL/);
  assert.equal(terminateCalls, 0);
  assert.equal(startCalls, 1);
  assert.equal(manager.child, children[0]);
  assert.equal(manager.status().running, true);
});

test("a rejected restart clears the in-flight guard so the next restart is not stuck", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-guard-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    const index = children.length;
    child.pid = 600 + index;
    child.exitCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      if (signal === "SIGTERM" && index > 0) {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: "runtime-guard-session",
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-guard-session" },
      failures: [],
    })));
    return child;
  };
  let terminateCalls = 0;
  const manager = new RuntimeManager({
    paths,
    platform: { terminateOwnedCodex: async () => { terminateCalls += 1; } },
    spawnProcess,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 5,
  });
  await manager.start();
  assert.equal(manager.child.pid, 600);
  await assert.rejects(manager.restart(), /did not exit after SIGKILL/);
  assert.equal(terminateCalls, 0);
  assert.equal(manager.restartInFlight, null);
  assert.equal(manager.child.pid, 600);
  assert.equal(manager.status().running, true);
  // A retry may proceed only after the retained child actually exits.
  children[0].exitCode = 0;
  children[0].emit("exit", 0, null);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const restarted = await manager.restart();
  assert.equal(terminateCalls, 1);
  assert.equal(children.length, 2);
  assert.deepEqual(children[0].received, ["SIGTERM", "SIGKILL"]);
  assert.equal(children[1].pid, manager.child.pid);
  assert.equal(restarted.running, true);
  await manager.stop();
});

test("failed stop retains the child and a subsequent start cannot spawn a competitor", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-retain-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    const index = children.length;
    child.pid = 700 + index;
    child.exitCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      if (signal === "SIGTERM" && index > 0) {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: "runtime-retain-session",
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: "runtime-retain-session" },
      failures: [],
    })));
    return child;
  };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    spawnProcess,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 10,
  });
  await manager.start();
  const retained = manager.child;
  await assert.rejects(manager.stop(), /did not exit after SIGKILL/);
  assert.equal(manager.child, retained);
  assert.equal(manager.status().running, true);
  assert.equal(manager.status().pid, retained.pid);
  const status = await manager.start();
  assert.equal(children.length, 1);
  assert.equal(manager.child, retained);
  assert.equal(status.running, true);
  retained.exitCode = 0;
  retained.emit("exit", 0, null);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await manager.start();
  assert.equal(children.length, 2);
  assert.equal(manager.child.pid, children[1].pid);
  await manager.stop();
});

test("signalCode counts as an exact exited state for status and stop", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-signal-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const child = new EventEmitter();
  child.pid = 900;
  child.exitCode = null;
  child.signalCode = "SIGKILL";
  child.received = [];
  child.kill = (signal) => { child.received.push(signal); };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    spawnProcess: () => child,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 10,
  });
  manager.child = child;
  manager.ready = { runtimeSessionId: "signal-session" };
  manager.appliedFeatures = ["notes"];
  assert.equal(manager.status().running, false);
  await manager.stopInternal();
  assert.deepEqual(child.received, []);
  assert.equal(manager.child, null);
  assert.equal(manager.status().running, false);
});

test("startInternal treats a signalCode exit during startup as an exact exit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-startup-signal-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = (_command, _args, _options) => {
    const child = new EventEmitter();
    child.pid = 950 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.received = [];
    child.kill = (signal) => { child.received.push(signal); };
    children.push(child);
    queueMicrotask(() => { child.signalCode = "SIGTERM"; });
    return child;
  };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    spawnProcess,
    logger: { error() {} },
  });
  await assert.rejects(manager.start(), /exited before becoming ready \(SIGTERM\)/);
  assert.equal(manager.child, null);
  assert.deepEqual(children[0].received, []);
});

test("startup failure retains the child when cleanup exit cannot be confirmed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-startup-retain-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  let readyFailures = 1;
  const readyWaiter = async () => {
    if (readyFailures > 0) {
      readyFailures -= 1;
      throw new Error("RuntimeHost did not report ready in time");
    }
    const child = children.at(-1);
    return { pid: child.pid, runtimeSessionId: "startup-retain-session", features: ["notes"], plugins: [], failures: [], renderer: null };
  };
  const spawnProcess = (_command, _args, _options) => {
    const child = new EventEmitter();
    const index = children.length;
    child.pid = 800 + index;
    child.exitCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      if (signal === "SIGTERM" && index > 0) {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }
    };
    children.push(child);
    return child;
  };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 10,
  });
  await assert.rejects(
    manager.start(),
    /did not report ready in time; cleanup also failed: RuntimeHost pid 800 did not exit after SIGKILL/,
  );
  assert.equal(manager.child, children[0]);
  assert.equal(manager.status().running, true);
  assert.deepEqual(children[0].received, ["SIGTERM", "SIGKILL"]);
  await manager.start();
  assert.equal(children.length, 1);
  children[0].exitCode = 0;
  children[0].emit("exit", 0, null);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await manager.start();
  assert.equal(children.length, 2);
  assert.equal(manager.child.pid, children[1].pid);
  await manager.stop();
});

test("startup failure confirms cleanup exit and allows a fresh start", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-startup-clean-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  let readyFailures = 1;
  const readyWaiter = async () => {
    if (readyFailures > 0) {
      readyFailures -= 1;
      throw new Error("RuntimeHost did not report ready in time");
    }
    const child = children.at(-1);
    return { pid: child.pid, runtimeSessionId: "startup-clean-session", features: ["notes"], plugins: [], failures: [], renderer: null };
  };
  const spawnProcess = (_command, _args, _options) => {
    const child = new EventEmitter();
    const index = children.length;
    child.pid = 850 + index;
    child.exitCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      if (signal === "SIGTERM") {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      }
    };
    children.push(child);
    return child;
  };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {} },
    sleep: async () => {},
    stopTimeoutMs: 50,
  });
  const startupError = await manager.start().catch((error) => error);
  assert.match(startupError.message, /did not report ready in time/);
  assert.doesNotMatch(startupError.message, /cleanup also failed/);
  assert.equal(manager.child, null);
  assert.deepEqual(children[0].received, ["SIGTERM"]);
  await manager.start();
  assert.equal(children.length, 2);
  assert.equal(manager.child.pid, children[1].pid);
  await manager.stop();
});

test("a ChatGPT process restored before the service is adopted through the public lifecycle", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-dock-launch-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });

  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 900 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `dock-session-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
    renderer: {
      discovered: children.length > 1,
      injectedTargets: children.length > 1 ? 1 : 0,
      active: children.length > 1,
      runtimeSessionId: `dock-session-${child.pid}`,
    },
    failures: [],
  });

  let nativeProcesses = [{ pid: 801, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  const terminatedPids = [];
  const platform = {
    snapshotNativeCodexState: async () => ({
      count: nativeProcesses.length,
      processes: [...nativeProcesses],
    }),
    terminateNativeCodex: async (pid) => {
      terminatedPids.push(pid);
      const existed = nativeProcesses.some((processInfo) => processInfo.pid === pid);
      nativeProcesses = nativeProcesses.filter((processInfo) => processInfo.pid !== pid);
      return existed ? 1 : 0;
    },
    assertNativeCodexCdp: acceptCdpOwner,
    openNativeCodex: async () => {
      nativeProcesses = [{
        pid: 804,
        command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
      }];
      return nativeProcesses[0];
    },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {}, warn() {} },
    cdpPort: 9231,
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  // 登录恢复可能先启动 ChatGPT；首次扫描也必须增强它。
  await manager.reconcileManualCodexLaunch();
  assert.deepEqual(terminatedPids, [801]);
  assert.equal(children.length, 2);
  assert.equal(manager.status().healthy, true);
  assert.equal(manager.status().codex.owned, true);
  assert.deepEqual(JSON.parse(await readFile(paths.codexPidPath, "utf8")), {
    version: 1,
    pid: 804,
    command: nativeProcesses[0].command,
  });

  // The user exiting Codex must leave it stopped.
  nativeProcesses = [];
  await manager.reconcileManualCodexLaunch();
  await manager.reconcileManualCodexLaunch();
  assert.deepEqual(terminatedPids, [801]);
  assert.equal(children.length, 2);

  // A user-supplied compatible CDP launch is already attachable and must not be replaced.
  nativeProcesses = [{
    pid: 802,
    command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
  }];
  await manager.reconcileManualCodexLaunch();
  assert.deepEqual(terminatedPids, [801]);
  assert.equal(children.length, 3);
  assert.equal(manager.status().healthy, true);
  assert.equal(manager.status().codex.owned, false);

  // A later Dock launch is explicit user intent and is adopted exactly once.
  nativeProcesses = [{ pid: 803, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  await manager.reconcileManualCodexLaunch();
  assert.deepEqual(terminatedPids, [801, 803]);
  assert.equal(children.length, 4);
  assert.deepEqual(children[0].received, ["SIGTERM"]);
  assert.equal(manager.status().renderer.active, true);

  await manager.reconcileManualCodexLaunch();
  assert.deepEqual(terminatedPids, [801, 803]);
  assert.equal(children.length, 4);
});

test("a failed ChatGPT replacement restores an idle RuntimeHost without retrying or relaunching", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-dock-recovery-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });

  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 950 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `dock-recovery-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
    renderer: {
      discovered: false,
      injectedTargets: 0,
      active: false,
      runtimeSessionId: `dock-recovery-${child.pid}`,
    },
    failures: [],
  });
  let nativeProcesses = [];
  const platform = {
    snapshotNativeCodexState: async () => ({
      count: nativeProcesses.length,
      processes: [...nativeProcesses],
    }),
    terminateNativeCodex: async () => {
      throw new Error("native Codex refused to exit");
    },
    assertNativeCodexCdp: acceptCdpOwner,
    openNativeCodex: async () => {
      throw new Error("LaunchServices must not run after failed termination");
    },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {}, warn() {} },
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses = [{ pid: 951, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  await assert.rejects(manager.reconcileManualCodexLaunch(), /native Codex refused to exit/);
  assert.equal(children.length, 2);
  assert.equal(manager.status().running, true);
  assert.equal(manager.status().healthy, false);
  assert.match(manager.status().failures.at(-1).message, /refused to exit/);
});

test("the background monitor automatically adopts a Dock launch", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-dock-monitor-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });

  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 980 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `dock-monitor-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
    renderer: {
      discovered: children.length > 1,
      injectedTargets: children.length > 1 ? 1 : 0,
      active: children.length > 1,
      runtimeSessionId: `dock-monitor-${child.pid}`,
    },
    failures: [],
  });
  let nativeProcesses = [];
  const manager = new RuntimeManager({
    paths,
    platform: {
      snapshotNativeCodexState: async () => ({
        count: nativeProcesses.length,
        processes: [...nativeProcesses],
      }),
      terminateNativeCodex: async () => {
        const count = nativeProcesses.length;
        nativeProcesses = [];
        return count ? 1 : 0;
      },
      assertNativeCodexCdp: acceptCdpOwner,
      openNativeCodex: async () => {
        nativeProcesses = [{
          pid: 982,
          command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
        }];
        return nativeProcesses[0];
      },
    },
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {}, warn() {} },
    manualLaunchPollMs: 2,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses = [{ pid: 981, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  const deadline = Date.now() + 250;
  while (children.length < 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }

  assert.equal(children[1].pid, 981);
  assert.equal(children.length, 2);
  assert.equal(manager.status().renderer.active, true);
  assert.equal(manager.status().codex.owned, true);
});

test("a normal official ChatGPT launch is replaced once through LaunchServices and becomes healthy", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-launchservices-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });

  const children = [];
  const spawnArguments = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 1_100 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.received = [];
    child.kill = (signal) => {
      child.received.push(signal);
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    spawnArguments.push({ args: _args, env: options.env });
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: `launchservices-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "injected", owned: true, health: { ok: true }, failure: null }],
      renderer: {
        discovered: children.length > 1,
        injectedTargets: children.length > 1 ? 1 : 0,
        active: children.length > 1,
        runtimeSessionId: `launchservices-${child.pid}`,
      },
      failures: [],
    })));
    return child;
  };

  let nativeProcesses = [];
  const terminatedPids = [];
  const launchRequests = [];
  let resolveSecondLaunchStarted;
  let releaseSecondLaunch;
  const secondLaunchStarted = new Promise((resolve) => { resolveSecondLaunchStarted = resolve; });
  const platform = {
    snapshotNativeCodexState: async () => ({
      count: nativeProcesses.length,
      processes: [...nativeProcesses],
    }),
    terminateNativeCodex: async (pid) => {
      terminatedPids.push(pid);
      const processInfo = nativeProcesses.find((candidate) => candidate.pid === pid);
      if (!processInfo) return 0;
      nativeProcesses = nativeProcesses.filter((candidate) => candidate.pid !== pid);
      return 1;
    },
    assertNativeCodexCdp: acceptCdpOwner,
    openNativeCodex: async (options) => {
      launchRequests.push(options);
      if (launchRequests.length === 2) {
        resolveSecondLaunchStarted();
        await new Promise((resolve) => { releaseSecondLaunch = resolve; });
      }
      nativeProcesses = [{
        pid: 2_201,
        command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
        verified: true,
      }];
      return nativeProcesses[0];
    },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    waitForReady: async (_readyPath, child) => ({
      pid: child.pid,
      runtimeSessionId: `launchservices-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "injected", owned: true, health: { ok: true }, failure: null }],
      renderer: {
        discovered: children.length > 1,
        injectedTargets: children.length > 1 ? 1 : 0,
        active: children.length > 1,
        runtimeSessionId: `launchservices-${child.pid}`,
      },
      failures: [],
    }),
    logger: { error() {}, warn() {} },
    cdpPort: 9231,
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses = [{
    pid: 2_200,
    command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
    verified: true,
  }];

  await manager.reconcileManualCodexLaunch();

  assert.deepEqual(terminatedPids, [2_200]);
  assert.deepEqual(launchRequests, [{ cdpPort: 9231 }]);
  assert.equal(children.length, 2);
  assert.equal(manager.status().healthy, true);
  assert.equal(manager.status().codex.pid, 2_201);
  assert.equal(manager.status().codex.owned, true);
  assert.equal(spawnArguments[1].env.MINECODEX_LAUNCH_CODEX, undefined);

  const restartPromise = manager.restart();
  await secondLaunchStarted;
  assert.equal(await manager.reconcileManualCodexLaunch(), false);
  releaseSecondLaunch();
  await restartPromise;
  assert.deepEqual(terminatedPids, [2_200, 2_201]);
  assert.deepEqual(launchRequests, [{ cdpPort: 9231 }, { cdpPort: 9231 }]);
  assert.equal(children.length, 3);
  assert.equal(manager.status().healthy, true);
});

test("a compatible loopback CDP ChatGPT launch is adopted without termination or relaunch", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-cdp-adopt-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 3_100 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: `cdp-adopt-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "injected", owned: true, health: { ok: true }, failure: null }],
      renderer: {
        discovered: children.length > 1,
        injectedTargets: children.length > 1 ? 1 : 0,
        active: children.length > 1,
        runtimeSessionId: `cdp-adopt-${child.pid}`,
      },
      failures: [],
    })));
    return child;
  };
  const compatibleProcess = {
    pid: 3_200,
    command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
  };
  let nativeProcesses = [];
  let terminateCalls = 0;
  let launchCalls = 0;
  const manager = new RuntimeManager({
    paths,
    platform: {
      snapshotNativeCodexState: async () => ({ count: nativeProcesses.length, processes: [...nativeProcesses] }),
      terminateNativeCodex: async () => { terminateCalls += 1; return 1; },
      assertNativeCodexCdp: acceptCdpOwner,
      openNativeCodex: async () => { launchCalls += 1; throw new Error("compatible CDP launch must not reopen ChatGPT"); },
    },
    spawnProcess,
    waitForReady: async (_readyPath, child) => ({
      pid: child.pid,
      runtimeSessionId: `cdp-adopt-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "injected", owned: true, health: { ok: true }, failure: null }],
      renderer: {
        discovered: children.length > 1,
        injectedTargets: children.length > 1 ? 1 : 0,
        active: children.length > 1,
        runtimeSessionId: `cdp-adopt-${child.pid}`,
      },
      failures: [],
    }),
    logger: { error() {}, warn() {} },
    cdpPort: 9231,
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses = [compatibleProcess];
  await manager.reconcileManualCodexLaunch();

  assert.equal(terminateCalls, 0);
  assert.equal(launchCalls, 0);
  assert.equal(manager.status().healthy, true);
  assert.deepEqual(manager.status().codex, { pid: compatibleProcess.pid, owned: false, command: compatibleProcess.command });
});

test("multiple new ChatGPT processes fail closed and are not retried as a launch loop", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-multiple-launches-"));
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
  await writeConfig(paths.configPath, { schemaVersion: 1, features: { notes: true } });
  const children = [];
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.pid = 4_100 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      child.exitCode = 0;
      queueMicrotask(() => child.emit("exit", 0, null));
    };
    children.push(child);
    return child;
  };
  let nativeProcesses = [];
  const terminatedPids = [];
  let launchCalls = 0;
  const manager = new RuntimeManager({
    paths,
    platform: {
      snapshotNativeCodexState: async () => ({ count: nativeProcesses.length, processes: [...nativeProcesses] }),
      terminateNativeCodex: async (pid) => { terminatedPids.push(pid); return 1; },
      openNativeCodex: async () => { launchCalls += 1; throw new Error("must not choose between concurrent launches"); },
    },
    spawnProcess,
    waitForReady: async (_readyPath, child) => ({
      pid: child.pid,
      runtimeSessionId: `multiple-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
      renderer: { discovered: false, injectedTargets: 0, active: false, runtimeSessionId: `multiple-${child.pid}` },
      failures: [],
    }),
    logger: { error() {}, warn() {} },
    manualLaunchPollMs: 60_000,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses = [
    { pid: 4_200, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" },
    { pid: 4_201, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" },
  ];
  await manager.reconcileManualCodexLaunch();
  await manager.reconcileManualCodexLaunch();

  assert.deepEqual(terminatedPids, []);
  assert.equal(launchCalls, 0);
  assert.equal(children.length, 1);
  assert.equal(manager.status().healthy, false);
  assert.equal(manager.status().failures.at(-1).code, "MULTIPLE_CHATGPT_LAUNCHES");
});

test("enhances a restored ChatGPT instance even when its process is older than the grace period", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-takeover-gate-"));
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
  const children = [];
  const spawnProcess = (command, args, options) => {
    const child = new EventEmitter();
    child.pid = 4_000 + children.length;
    child.command = command;
    child.args = args;
    child.options = options;
    child.killed = false;
    child.kill = (signal) => {
      child.killed = true;
      child.received = [...(child.received ?? []), signal];
      queueMicrotask(() => child.emit("exit", 0, signal));
      return true;
    };
    children.push(child);
    child.startedMsAgo = args.join(" ").includes("--remote-debugging-port=") ? 0 : null;
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `gate-session-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "injected", owned: true, health: { ok: true }, failure: null }],
    renderer: {
      discovered: children.length > 1,
      injectedTargets: children.length > 1 ? 1 : 0,
      active: children.length > 1,
      runtimeSessionId: `gate-session-${child.pid}`,
    },
    failures: [],
  });
  const startedMsPerPid = new Map();
  const platform = {
    snapshotNativeCodexState: async () => {
      const processes = Array.from(startedMsPerPid.keys()).map((pid) => ({
        pid,
        command: pid >= 5_000
          ? "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT"
          : "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
        verified: true,
      }));
      return { count: processes.length, processes };
    },
    terminateNativeCodex: async (pid) => {
      if (!startedMsPerPid.has(pid)) return 0;
      startedMsPerPid.delete(pid);
      return 1;
    },
    assertNativeCodexCdp: async () => true,
    openNativeCodex: async () => {
      startedMsPerPid.set(5_100, 0);
      return { pid: 5_100, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231", verified: true };
    },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    waitForReady: readyWaiter,
    logger: { error() {}, warn() {} },
    cdpPort: 9231,
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();

  // A freshly woken instance (under the grace period) is still replaced.
  startedMsPerPid.set(5_001, 400);
  await manager.reconcileManualCodexLaunch();
  assert.equal(startedMsPerPid.has(5_001), false, "fresh wake should be replaced");
  assert.equal(startedMsPerPid.has(5_100), true, "replacement CDP instance should be running");

  // A session-restored instance may already be older than the former grace period.
  startedMsPerPid.set(5_002, 120_000);
  await manager.reconcileManualCodexLaunch();
  assert.equal(startedMsPerPid.has(5_002), false, "restored official instance must enter enhancement");
  assert.equal(startedMsPerPid.has(5_100), true, "restored instance should receive a replacement CDP session");
  assert.equal(manager.status().failures.length, 0);
});

test("rolls back the exact LaunchServices PID when attachment proof fails", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-runtime-launch-rollback-"));
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
  const children = [];
  const spawnProcess = (_command, _args, options) => {
    const child = new EventEmitter();
    child.pid = 6_000 + children.length;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = (signal) => {
      child.exitCode = 0;
      child.signalCode = signal;
      queueMicrotask(() => child.emit("exit", 0, signal));
    };
    children.push(child);
    queueMicrotask(() => writeFile(options.env.MINECODEX_RUNTIME_READY_FILE, JSON.stringify({
      pid: child.pid,
      runtimeSessionId: `rollback-${child.pid}`,
      features: ["notes"],
      plugins: [{ featureId: "notes", state: "injected", owned: true, failure: null }],
      renderer: { discovered: true, injectedTargets: 1, active: true, runtimeSessionId: `rollback-${child.pid}` },
      failures: [],
    })));
    return child;
  };
  const nativeProcesses = new Map();
  const terminatedPids = [];
  const rollbackFails = { value: false };
  const command = "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT";
  const cdpCommand = `${command} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231`;
  const platform = {
    snapshotNativeCodexState: async () => ({
      count: nativeProcesses.size,
      processes: [...nativeProcesses.entries()].map(([pid, processCommand]) => ({
        pid,
        command: processCommand,
        verified: true,
      })),
    }),
    terminateNativeCodex: async (pid) => {
      terminatedPids.push(pid);
      if (pid === 6_200 && rollbackFails.value) return 0;
      if (!nativeProcesses.delete(pid)) return 0;
      return 1;
    },
    openNativeCodex: async () => {
      nativeProcesses.set(6_200, cdpCommand);
      return { pid: 6_200, command: cdpCommand, verified: true };
    },
    assertNativeCodexCdp: async (processInfo) => {
      if (processInfo.pid === 6_200) throw new Error("renderer proof failed");
    },
  };
  const manager = new RuntimeManager({
    paths,
    platform,
    spawnProcess,
    logger: { error() {}, warn() {} },
    cdpPort: 9231,
    manualLaunchPollMs: 60_000,
    stopTimeoutMs: 100,
  });
  t.after(() => manager.stop());

  await manager.start();
  nativeProcesses.set(6_100, command);
  await assert.rejects(manager.reconcileManualCodexLaunch(), /renderer proof failed/);

  assert.deepEqual(terminatedPids, [6_100, 6_200]);
  assert.equal(nativeProcesses.has(6_100), false);
  assert.equal(nativeProcesses.has(6_200), false, "failed LaunchServices PID must not leak");
  assert.equal(manager.status().codex, null);

  rollbackFails.value = true;
  nativeProcesses.set(6_300, command);
  await assert.rejects(manager.reconcileManualCodexLaunch(), /ChatGPT launch rollback failed/);
  assert.equal(nativeProcesses.has(6_200), true, "an unrolled-back exact PID must remain retry-visible");
  await assert.rejects(manager.reconcileManualCodexLaunch(), /renderer proof failed/);
  assert.equal(nativeProcesses.has(6_200), true, "retry-visible PID must not be hidden by baseline refresh");
});

test("writes a complete owner marker through a synced temporary file and atomic rename", async () => {
  const calls = [];
  const paths = { codexPidPath: "/tmp/minecodex-owner-marker/codex.pid" };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    fileSystem: {
      open: async (filePath, flags, mode) => {
        calls.push(["open", filePath, flags, mode]);
        return {
          writeFile: async (content) => calls.push(["write", filePath, content]),
          sync: async () => calls.push(["sync", filePath]),
          close: async () => calls.push(["close", filePath]),
        };
      },
      rename: async (from, to) => calls.push(["rename", from, to]),
      unlink: async (filePath) => calls.push(["unlink", filePath]),
    },
  });

  await manager.writeOwnedCodexPid({ pid: 6_300, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-port=9231" });

  assert.equal(calls[0][0], "open");
  assert.match(calls[0][1], /codex\.pid\./);
  assert.deepEqual(calls.slice(1, 3).map(([operation]) => operation), ["write", "sync"]);
  assert.equal(calls[3][0], "close");
  assert.deepEqual(calls[4], ["rename", calls[0][1], paths.codexPidPath]);
});

test("keeps the existing owner marker path untouched when temporary marker writing fails", async () => {
  const calls = [];
  const paths = { codexPidPath: "/tmp/minecodex-owner-marker/codex.pid" };
  const manager = new RuntimeManager({
    paths,
    platform: {},
    fileSystem: {
      open: async (filePath) => {
        calls.push(["open", filePath]);
        return {
          writeFile: async () => { throw new Error("simulated marker write interruption"); },
          close: async () => calls.push(["close", filePath]),
        };
      },
      rename: async (...args) => calls.push(["rename", ...args]),
      unlink: async (filePath) => calls.push(["unlink", filePath]),
    },
  });

  await assert.rejects(
    manager.writeOwnedCodexPid({ pid: 6_301, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }),
    /simulated marker write interruption/,
  );
  assert.deepEqual(calls.map(([operation]) => operation), ["open", "close", "unlink"]);
});

test("runtime manager requests IPC cleanup before terminating a connected runtime", async () => {
  const child = new EventEmitter();
  child.connected = true;
  child.exitCode = null;
  let message;
  child.send = (value, callback) => {
    message = value;
    callback(null);
    queueMicrotask(() => { child.exitCode = 0; child.emit("exit", 0, null); });
  };
  child.kill = () => assert.fail("graceful IPC shutdown must not force-kill the runtime");
  const manager = new RuntimeManager({ paths: {}, sleep: () => new Promise((resolve) => setImmediate(resolve)) });
  assert.equal(await manager.waitForExactExit(child, "SIGTERM", 1000), true);
  assert.deepEqual(message, { type: "minecodex:shutdown" });
});
