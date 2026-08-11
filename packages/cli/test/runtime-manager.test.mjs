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
  let terminatedOwned = 0;
  let terminatedNative = 0;
  const platform = {
    terminateOwnedCodex: async () => { terminatedOwned += 1; },
    terminateNativeCodex: async () => { terminatedNative += 1; },
  };
  const manager = new RuntimeManager({ paths, platform, spawnProcess, logger: { error() {} } });
  await manager.start();
  assert.equal(spawnOptions.env.MINECODEX_ENABLED_FEATURES, "model-slider,images");
  assert.equal(spawnOptions.env.MINECODEX_LAUNCH_CODEX, "0");
  assert.deepEqual(manager.status().appliedFeatures, ["model-slider", "images"]);
  await manager.restart();
  assert.equal(terminatedOwned, 1);
  assert.equal(terminatedNative, 1);
  assert.equal(spawnOptions.env.MINECODEX_LAUNCH_CODEX, "1");
  assert.equal(children.length, 2);
  await manager.stop();
});

test("runtime manager propagates the resolved supported user Codex executable", async () => {
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
      codex: async () => ({
        appPath: "/Users/example/Applications/ChatGPT.app",
        executable,
      }),
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
  assert.equal(spawnOptions.env.MINECODEX_CODEX_EXECUTABLE, executable);
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

test("a new Dock launch is adopted once without reopening Codex after the user exits", async (t) => {
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
  const launchIntents = [];
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
    launchIntents.push(options.env.MINECODEX_LAUNCH_CODEX);
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `dock-session-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
    renderer: {
      discovered: launchIntents.at(-1) === "1",
      injectedTargets: launchIntents.at(-1) === "1" ? 1 : 0,
      active: launchIntents.at(-1) === "1",
      runtimeSessionId: `dock-session-${child.pid}`,
    },
    failures: [],
  });

  let nativeProcesses = [{ pid: 801, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  let terminateNativeCalls = 0;
  const platform = {
    snapshotNativeCodexState: async () => ({
      count: nativeProcesses.length,
      processes: [...nativeProcesses],
    }),
    terminateNativeCodex: async () => {
      terminateNativeCalls += 1;
      const count = nativeProcesses.length;
      nativeProcesses = [];
      return count;
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
  assert.deepEqual(launchIntents, ["0"]);

  // A Codex instance that predates the service is a baseline, not a new user launch.
  await manager.reconcileManualCodexLaunch();
  assert.equal(terminateNativeCalls, 0);
  assert.equal(children.length, 1);

  // The user exiting Codex must leave it stopped.
  nativeProcesses = [];
  await manager.reconcileManualCodexLaunch();
  await manager.reconcileManualCodexLaunch();
  assert.equal(terminateNativeCalls, 0);
  assert.equal(children.length, 1);

  // A user-supplied compatible CDP launch is already attachable and must not be replaced.
  nativeProcesses = [{
    pid: 802,
    command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-port=9231",
  }];
  await manager.reconcileManualCodexLaunch();
  assert.equal(terminateNativeCalls, 0);
  assert.equal(children.length, 1);

  // A later Dock launch is explicit user intent and is adopted exactly once.
  nativeProcesses = [{ pid: 803, command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" }];
  await manager.reconcileManualCodexLaunch();
  assert.equal(terminateNativeCalls, 1);
  assert.deepEqual(launchIntents, ["0", "1"]);
  assert.equal(children.length, 2);
  assert.deepEqual(children[0].received, ["SIGTERM"]);
  assert.equal(manager.status().renderer.active, true);

  await manager.reconcileManualCodexLaunch();
  assert.equal(terminateNativeCalls, 1);
  assert.equal(children.length, 2);
});

test("a failed Dock adoption restores an idle RuntimeHost without relaunching Codex", async (t) => {
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
  const launchIntents = [];
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
    launchIntents.push(options.env.MINECODEX_LAUNCH_CODEX);
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
  assert.deepEqual(launchIntents, ["0", "0"]);
  assert.equal(manager.status().running, true);
  assert.equal(manager.status().renderer.active, false);
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
  const launchIntents = [];
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
    launchIntents.push(options.env.MINECODEX_LAUNCH_CODEX);
    return child;
  };
  const readyWaiter = async (_readyPath, child) => ({
    pid: child.pid,
    runtimeSessionId: `dock-monitor-${child.pid}`,
    features: ["notes"],
    plugins: [{ featureId: "notes", state: "ready", owned: true, failure: null }],
    renderer: {
      discovered: launchIntents.at(-1) === "1",
      injectedTargets: launchIntents.at(-1) === "1" ? 1 : 0,
      active: launchIntents.at(-1) === "1",
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
        return count;
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

  assert.deepEqual(launchIntents, ["0", "1"]);
  assert.equal(children.length, 2);
  assert.equal(manager.status().renderer.active, true);
});
