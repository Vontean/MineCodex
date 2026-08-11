import assert from "node:assert/strict";
import { createServer } from "node:net";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeConfig } from "../src/config.mjs";
import { createControlServer } from "../src/control-server.mjs";
import { PACKAGE_ROOT } from "../src/paths.mjs";
import { runCli } from "../src/commands.mjs";

test("help exposes the stable MineCodex command surface", async () => {
  const output = [];
  await runCli(["--help"], { output: (line) => output.push(line) });
  assert.match(output.join("\n"), /mcx install/);
  assert.match(output.join("\n"), /uninstall \[--purge\]/);
  assert.match(output.join("\n"), /status \[--json\]/);
  assert.match(output.join("\n"), /restart/);
});

test("purge removes only explicit MineCodex-owned roots", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "minecodex-purge-"));
  const supportDir = path.join(homeDir, "Library", "Application Support", "MineCodex");
  const notesDataDir = path.join(homeDir, "Library", "Application Support", "CodexNotes");
  const imagesDataDir = path.join(homeDir, ".codex-image-host");
  const generatedRoot = path.join(homeDir, ".codex", "generated_images");
  for (const target of [supportDir, notesDataDir, imagesDataDir, generatedRoot]) {
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "keep-check"), "data");
  }
  const paths = { homeDir, supportDir, notesDataDir, imagesDataDir, codexPidPath: path.join(supportDir, "codex.pid") };
  const calls = [];
  const platform = {
    assertInstallSupported() {},
    terminateOwnedCodex: async () => false,
    removeService: async () => calls.push("remove-service"),
  };
  await runCli(["uninstall", "--purge"], { paths, platform, output() {} });
  assert.deepEqual(calls, ["remove-service"]);
  await assert.rejects(readFile(path.join(supportDir, "keep-check")), /ENOENT/);
  await assert.rejects(readFile(path.join(notesDataDir, "keep-check")), /ENOENT/);
  await assert.rejects(readFile(path.join(imagesDataDir, "keep-check")), /ENOENT/);
  assert.equal(await readFile(path.join(generatedRoot, "keep-check"), "utf8"), "data");
});

test("a control-port collision fails before a service PID or RuntimeHost child is created", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "minecodex-port-"));
  const supportDir = path.join(homeDir, "support");
  const blocker = createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const previousPort = process.env.MINECODEX_CONTROL_PORT;
  process.env.MINECODEX_CONTROL_PORT = String(blocker.address().port);
  const paths = {
    homeDir,
    supportDir,
    configPath: path.join(supportDir, "config.json"),
    tokenPath: path.join(supportDir, "control-token"),
    pidPath: path.join(supportDir, "service.pid"),
    dashboardDir: path.join(homeDir, "dashboard"),
    featuresRoot: path.join(homeDir, "features"),
  };
  try {
    await assert.rejects(runCli(["serve"], { paths, platform: {}, logger: { error() {}, log() {} } }), /EADDRINUSE/);
    await assert.rejects(access(paths.pidPath), /ENOENT/);
  } finally {
    if (previousPort === undefined) delete process.env.MINECODEX_CONTROL_PORT;
    else process.env.MINECODEX_CONTROL_PORT = previousPort;
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("install leaves native Codex untouched and restores the prior service when readiness fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-install-rollback-"));
  const paths = {
    homeDir: root,
    supportDir: path.join(root, "support"),
    configPath: path.join(root, "support", "config.json"),
    tokenPath: path.join(root, "support", "control-token"),
    launchAgentPath: path.join(root, "LaunchAgents", "minecodex.plist"),
    serviceErrorLogPath: path.join(root, "runtime-error.log"),
  };
  const events = [];
  const snapshot = { plist: { exists: true, content: "previous plist" }, running: true };
  const platform = {
    assertInstallSupported() { events.push("platform"); },
    assertCodexInstalled: async () => { events.push("codex-check"); },
    snapshotServiceState: async () => { events.push("snapshot-service"); return snapshot; },
    snapshotNativeCodexState: async () => { events.push("snapshot-native"); return { count: 1 }; },
    terminateNativeCodex: async () => { events.push("terminate-native"); return 1; },
    installService: async () => { events.push("install-service"); },
    restoreServiceState: async (previous) => { events.push(["restore-service", previous]); },
    restoreNativeCodexState: async (previous) => { events.push(["restore-native", previous]); },
  };

  await assert.rejects(runCli(["install"], {
    paths,
    platform,
    cliPath: "/tmp/mcx.mjs",
    output() {},
    serviceProbe: {
      waitForService: async () => false,
      waitForManagedReady: async () => null,
    },
  }), /did not become ready/);

  assert.deepEqual(events.map((event) => Array.isArray(event) ? event[0] : event), [
    "platform",
    "codex-check",
    "snapshot-service",
    "install-service",
    "restore-service",
  ]);
  assert.deepEqual(events.at(-1)[1], snapshot);
});

test("successful install does not restart Codex without explicit confirmation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-install-user-choice-"));
  const paths = {
    homeDir: root,
    supportDir: path.join(root, "support"),
    configPath: path.join(root, "support", "config.json"),
    tokenPath: path.join(root, "support", "control-token"),
    launchAgentPath: path.join(root, "LaunchAgents", "minecodex.plist"),
    serviceErrorLogPath: path.join(root, "runtime-error.log"),
  };
  const events = [];
  const output = [];
  const platform = {
    assertInstallSupported() {},
    assertCodexInstalled: async () => {},
    snapshotServiceState: async () => ({ running: false }),
    snapshotNativeCodexState: async () => { events.push("snapshot-native"); return { count: 1 }; },
    terminateNativeCodex: async () => { events.push("terminate-native"); return 1; },
    installService: async () => { events.push("install-service"); },
  };

  await runCli(["install"], {
    paths,
    platform,
    output: (line) => output.push(line),
    confirmRestart: async () => false,
    serviceProbe: {
      waitForService: async () => true,
      waitForManagedReady: async () => ({ runtime: { running: true } }),
    },
  });

  assert.deepEqual(events, ["install-service"]);
  assert.match(output.join("\n"), /enabled the next time Codex restarts/i);
  assert.match(output.join("\n"), /mcx restart/);
});

test("successful install restarts Codex only after explicit confirmation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-install-confirmed-restart-"));
  const paths = {
    homeDir: root,
    supportDir: path.join(root, "support"),
    configPath: path.join(root, "support", "config.json"),
    tokenPath: path.join(root, "support", "control-token"),
    launchAgentPath: path.join(root, "LaunchAgents", "minecodex.plist"),
    serviceErrorLogPath: path.join(root, "runtime-error.log"),
  };
  const events = [];
  const output = [];
  await runCli(["install"], {
    paths,
    platform: {
      assertInstallSupported() {},
      assertCodexInstalled: async () => {},
      snapshotServiceState: async () => ({ running: false }),
      installService: async () => { events.push("install-service"); },
    },
    output: (line) => output.push(line),
    confirmRestart: async () => { events.push("confirm-restart"); return true; },
    fetchImpl: async (url) => {
      events.push(new URL(url).pathname);
      return { ok: true };
    },
    serviceProbe: {
      waitForService: async () => true,
      waitForManagedReady: async () => ({ runtime: { running: true } }),
    },
  });

  assert.deepEqual(events, ["install-service", "confirm-restart", "/api/restart"]);
  assert.match(output.join("\n"), /will be enabled the next time Codex restarts/i);
  assert.match(output.join("\n"), /restarted/i);
});

test("mcx install rejects an unsupported Node before touching the platform seam", async () => {
  let touched = false;
  await assert.rejects(runCli(["install"], {
    nodeVersion: "22.4.9",
    platform: {
      assertInstallSupported() { touched = true; },
      assertCodexInstalled: async () => { touched = true; },
    },
    paths: { configPath: "/tmp/unused/config.json", tokenPath: "/tmp/unused/token" },
  }), /Node\.js 22\.5\.0 or newer/);
  assert.equal(touched, false);
});

test("update rolls back the package and leaves a previously stopped service stopped", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-update-rollback-"));
  const paths = {
    homeDir: root,
    supportDir: path.join(root, "support"),
    launchAgentPath: path.join(root, "LaunchAgents", "minecodex.plist"),
    packageRoot: root,
  };
  await mkdir(path.dirname(paths.launchAgentPath), { recursive: true });
  await writeFile(paths.launchAgentPath, "old plist");
  const calls = [];
  const previous = { plist: { exists: true, content: "old plist" }, running: false };
  const platform = {
    assertInstallSupported() {},
    snapshotServiceState: async () => previous,
    stopService: async () => { calls.push("stop-service"); },
    restoreServiceState: async (snapshot) => { calls.push(["restore-service", snapshot]); },
    installService: async () => { calls.push("install-service"); },
  };
  const npm = {
    viewLatestVersion: async () => "9.9.9",
    createRollbackArchive: async () => { calls.push("pack"); return "/tmp/minecodex-old.tgz"; },
    installGlobal: async (spec) => {
      calls.push(["install", spec]);
      if (spec === "minecodex@latest") throw new Error("registry install failed");
    },
    cleanup: async () => { calls.push("cleanup"); },
  };
  const serviceProbe = {
    waitForService: async () => false,
    waitForManagedReady: async () => null,
  };

  await assert.rejects(runCli(["update"], { paths, platform, npm, cliPath: "/tmp/mcx.mjs", output() {}, serviceProbe }), /previous MineCodex version was restored/);
  assert.deepEqual(calls, [
    "pack",
    ["install", "minecodex@latest"],
    ["install", "/tmp/minecodex-old.tgz"],
    ["restore-service", previous],
    "cleanup",
  ]);
});

test("update rollback surfaces a readiness failure after restoring the previous service", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-update-rollback-ready-"));
  const launchAgentPath = path.join(root, "LaunchAgents", "minecodex.plist");
  await mkdir(path.dirname(launchAgentPath), { recursive: true });
  await writeFile(launchAgentPath, "old plist");
  const paths = { homeDir: root, packageRoot: root, launchAgentPath };
  const calls = [];
  const previous = { plist: { exists: true, content: "old plist" }, running: true };
  const platform = {
    assertInstallSupported() {},
    snapshotServiceState: async () => previous,
    stopService: async () => { calls.push("stop-service"); },
    assertServiceStopped: async () => { calls.push("assert-stopped"); },
    installService: async ({ start }) => { calls.push(["install-service", start]); },
    restoreServiceState: async (snapshot) => { calls.push(["restore-service", snapshot]); },
  };
  const npm = {
    viewLatestVersion: async () => "9.9.9",
    createRollbackArchive: async () => "/tmp/minecodex-old-ready.tgz",
    installGlobal: async (spec) => {
      calls.push(["install", spec]);
      if (spec === "minecodex@latest") throw new Error("registry install failed");
    },
    cleanup: async () => { calls.push("cleanup"); },
  };
  let readyCalls = 0;
  const readyResults = [true, false];
  const serviceProbe = {
    waitForService: async () => { readyCalls += 1; return readyResults[readyCalls - 1]; },
    waitForManagedReady: async () => { readyCalls += 1; return readyResults[readyCalls - 1]; },
  };

  await assert.rejects(runCli(["update"], {
    paths,
    platform,
    npm,
    cliPath: "/tmp/mcx.mjs",
    output() {},
    serviceProbe,
  }), /Rolled-back MineCodex service did not become ready/);
  assert.deepEqual(calls, [
    "stop-service",
    "assert-stopped",
    ["install", "minecodex@latest"],
    ["install", "/tmp/minecodex-old-ready.tgz"],
    ["restore-service", previous],
    "cleanup",
  ]);
  assert.equal(readyCalls, 2);
});

test("update rollback keeps a previously stopped service stopped", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-update-rollback-stopped-"));
  const launchAgentPath = path.join(root, "LaunchAgents", "minecodex.plist");
  await mkdir(path.dirname(launchAgentPath), { recursive: true });
  await writeFile(launchAgentPath, "old plist");
  const paths = { homeDir: root, packageRoot: root, launchAgentPath };
  const calls = [];
  const previous = { plist: { exists: true, content: "old plist" }, running: false };
  const platform = {
    assertInstallSupported() {},
    snapshotServiceState: async () => previous,
    installService: async ({ start }) => { calls.push(["install-service", start]); },
    restoreServiceState: async (snapshot) => { calls.push(["restore-service", snapshot]); },
    assertServiceStopped: async () => { calls.push("assert-stopped"); },
  };
  const npm = {
    viewLatestVersion: async () => "9.9.9",
    createRollbackArchive: async () => "/tmp/minecodex-old-stopped.tgz",
    installGlobal: async (spec) => {
      calls.push(["install", spec]);
      if (spec === "minecodex@latest") throw new Error("registry install failed");
    },
    cleanup: async () => { calls.push("cleanup"); },
  };

  await assert.rejects(runCli(["update"], {
    paths,
    platform,
    npm,
    cliPath: "/tmp/mcx.mjs",
    output() {},
    serviceProbe: { waitForService: async () => false },
  }), /previous MineCodex version was restored/);
  assert.deepEqual(calls, [
    ["install", "minecodex@latest"],
    ["install", "/tmp/minecodex-old-stopped.tgz"],
    ["restore-service", previous],
    "assert-stopped",
    "cleanup",
  ]);
});

test("successful update restores a previously running service and waits for managed readiness", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-update-running-"));
  const launchAgentPath = path.join(root, "LaunchAgents", "minecodex.plist");
  await mkdir(path.dirname(launchAgentPath), { recursive: true });
  await writeFile(launchAgentPath, "old plist");
  const paths = { homeDir: root, packageRoot: root, launchAgentPath };
  const calls = [];
  const platform = {
    assertInstallSupported() {},
    snapshotServiceState: async () => ({ plist: { exists: true, content: "old plist" }, running: true }),
    stopService: async () => { calls.push("stop-service"); },
    assertServiceStopped: async () => { calls.push("assert-stopped"); },
    installService: async ({ start }) => { calls.push(["install-service", start]); },
  };
  const npm = {
    viewLatestVersion: async () => "9.9.9",
    createRollbackArchive: async () => "/tmp/minecodex-old-running.tgz",
    installGlobal: async (spec) => { calls.push(["install", spec]); },
    cleanup: async () => { calls.push("cleanup"); },
  };

  await runCli(["update"], {
    paths,
    platform,
    npm,
    cliPath: "/tmp/mcx.mjs",
    output() {},
    serviceProbe: {
      waitForService: async () => true,
      waitForManagedReady: async () => ({ runtime: { running: true } }),
    },
  });
  assert.deepEqual(calls, [
    "stop-service",
    "assert-stopped",
    ["install", "minecodex@latest"],
    ["install-service", true],
    "cleanup",
  ]);
});

test("uninstall does not purge when managed Codex shutdown fails and restores service state", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "minecodex-uninstall-rollback-"));
  const supportDir = path.join(homeDir, "Library", "Application Support", "MineCodex");
  const notesDataDir = path.join(homeDir, "Library", "Application Support", "CodexNotes");
  const imagesDataDir = path.join(homeDir, ".codex-image-host");
  for (const target of [supportDir, notesDataDir, imagesDataDir]) {
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "keep-check"), "data");
  }
  const paths = { homeDir, supportDir, notesDataDir, imagesDataDir };
  const calls = [];
  const previous = { plist: { exists: true, content: "running plist" }, running: true };
  const platform = {
    assertInstallSupported() {},
    snapshotServiceState: async () => previous,
    removeService: async () => { calls.push("remove-service"); },
    terminateOwnedCodex: async () => { calls.push("terminate-owned"); throw new Error("managed Codex did not exit"); },
    restoreServiceState: async (snapshot) => { calls.push(["restore-service", snapshot]); },
  };

  await assert.rejects(runCli(["uninstall", "--purge"], { paths, platform, output() {} }), /managed Codex did not exit/);
  assert.deepEqual(calls, ["remove-service", "terminate-owned", ["restore-service", previous]]);
  assert.equal(await readFile(path.join(supportDir, "keep-check"), "utf8"), "data");
  assert.equal(await readFile(path.join(notesDataDir, "keep-check"), "utf8"), "data");
  assert.equal(await readFile(path.join(imagesDataDir, "keep-check"), "utf8"), "data");
});

test("mcx open starts an installed stopped service and uses a fresh exchange URL each time", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-open-exchange-"));
  const tokenPath = path.join(root, "control-token");
  await writeFile(tokenPath, "long-lived-secret\n", { mode: 0o600 });
  const configPath = path.join(root, "config.json");
  await writeConfig(configPath, { schemaVersion: 1, features: {} });
  const control = await createControlServer({
    paths: {
      packageRoot: PACKAGE_ROOT,
      configPath,
      featuresRoot: path.join(PACKAGE_ROOT, "features"),
      dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
    },
    token: "long-lived-secret",
    runtimeManager: { status: () => ({ running: true, appliedFeatures: [], plugins: [] }) },
    port: 0,
    logger: { error() {} },
  });
  const previousPort = process.env.MINECODEX_CONTROL_PORT;
  process.env.MINECODEX_CONTROL_PORT = String(control.port);
  const opened = [];
  const launchAgentPath = path.join(root, "LaunchAgents", "minecodex.plist");
  await mkdir(path.dirname(launchAgentPath), { recursive: true });
  await writeFile(launchAgentPath, "plist");
  const openPaths = { tokenPath, launchAgentPath };
  let startServiceCalls = 0;
  let startedWith = null;
  const platform = {
    startService: async (paths) => { startServiceCalls += 1; startedWith = paths; },
    openBrowser: async (url) => opened.push(url),
  };
  const serviceResults = [false, true, true];
  try {
    await runCli(["open"], {
      paths: openPaths,
      platform,
      serviceProbe: { waitForService: async () => serviceResults.shift() },
    });
    await runCli(["open"], {
      paths: openPaths,
      platform,
      serviceProbe: { waitForService: async () => serviceResults.shift() },
    });
    assert.equal(startServiceCalls, 1);
    assert.equal(startedWith, openPaths);
    assert.equal(opened.length, 2);
    assert.notEqual(opened[0], opened[1]);
    for (const url of opened) {
      assert.match(url, /\/auth\?exchange=/);
      assert.doesNotMatch(url, /long-lived-secret|[?&]token=/);
    }
    assert.deepEqual(serviceResults, []);
  } finally {
    if (previousPort === undefined) delete process.env.MINECODEX_CONTROL_PORT;
    else process.env.MINECODEX_CONTROL_PORT = previousPort;
    await control.close();
  }
});
