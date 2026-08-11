import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNodeSupported,
  buildLaunchAgent,
  CODEX_EXECUTABLE,
  isExactCodexProcess,
  MacPlatformAdapter,
  resolveCodexInstallation,
  SERVICE_LABEL,
} from "../src/platform.mjs";

test("launch agent uses the exact installed Node and CLI paths without touching the app bundle", () => {
  const plist = buildLaunchAgent({
    nodePath: "/Users/example/a&b/node",
    cliPath: "/Users/example/minecodex/packages/cli/bin/mcx.mjs",
    paths: {
      serviceLogPath: "/Users/example/Library/Logs/MineCodex/runtime.log",
      serviceErrorLogPath: "/Users/example/Library/Logs/MineCodex/runtime-error.log",
    },
  });
  assert.match(plist, new RegExp(`<string>${SERVICE_LABEL}</string>`));
  assert.match(plist, /a&amp;b\/node/);
  assert.match(plist, /<string>serve<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.doesNotMatch(plist, /ChatGPT\.app|Dock|Info\.plist/);
});

test("install validates Node 22.5 and resolves only supported system or user Codex paths", async () => {
  assert.throws(() => assertNodeSupported("22.4.9"), /Node\.js 22\.5\.0 or newer/);
  assert.doesNotThrow(() => assertNodeSupported("22.5.0"));
  assert.doesNotThrow(() => assertNodeSupported("23.0.0"));

  const installation = await resolveCodexInstallation({
    homeDir: "/Users/example",
    fileExists: async (filePath) => filePath === "/Users/example/Applications/ChatGPT.app/Contents/Info.plist",
  });
  assert.deepEqual(installation, {
    appPath: "/Users/example/Applications/ChatGPT.app",
    executable: "/Users/example/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
  });
});

test("Codex process matching requires the exact executable and managed profile identity", () => {
  const installation = {
    appPath: "/Applications/ChatGPT.app",
    executable: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
  };
  assert.equal(isExactCodexProcess(
    "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --user-data-dir=/tmp/minecodex-profile",
    installation,
  ), true);
  assert.equal(isExactCodexProcess(
    "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT-helper --user-data-dir=/tmp/minecodex-profile",
    installation,
  ), false);
});

test("MacPlatformAdapter snapshots and restores launchd state through injected fakes", async () => {
  const launchAgentPath = "/tmp/minecodex-platform-fake/agent.plist";
  const files = new Map([[launchAgentPath, "previous plist"]]);
  const calls = [];
  let loaded = true;
  const fileSystem = {
    mkdir: async () => {},
    readFile: async (filePath) => {
      if (!files.has(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return files.get(filePath);
    },
    stat: async () => ({ mode: 0o600 }),
    writeFile: async (filePath, content) => { files.set(filePath, content); },
    unlink: async (filePath) => {
      if (!files.delete(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
  };
  const execFile = async (_file, args) => {
    calls.push(args);
    if (args[0] === "print" && !loaded) throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
    if (args[0] === "bootout") {
      if (!loaded) throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
      loaded = false;
    }
    if (args[0] === "bootstrap") loaded = true;
    if (args[0] === "kickstart") loaded = true;
    return { stdout: "" };
  };
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile,
    fileSystem,
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
  });
  const paths = {
    launchAgentPath,
    logsDir: "/tmp/minecodex-platform-fake/logs",
    serviceLogPath: "/tmp/minecodex-platform-fake/runtime.log",
    serviceErrorLogPath: "/tmp/minecodex-platform-fake/runtime-error.log",
  };
  const snapshot = await adapter.snapshotServiceState(paths);
  await adapter.installService({ cliPath: "/tmp/mcx.mjs", paths, start: false });
  assert.equal(loaded, false);
  assert.notEqual(files.get(launchAgentPath), "previous plist");
  await adapter.restoreServiceState(snapshot, { paths });
  assert.equal(loaded, true);
  assert.equal(files.get(launchAgentPath), "previous plist");
  assert.ok(calls.some(([command]) => command === "bootstrap"));
  assert.ok(calls.every((args) => args.at(-1) !== "/Applications/ChatGPT.app"));
});

test("MacPlatformAdapter bootstraps an absent installed job before kickstarting its exact target", async () => {
  const launchAgentPath = "/Users/example/Library/LaunchAgents/com.vontean.minecodex.plist";
  const calls = [];
  let loaded = false;
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (args[0] === "print" && !loaded) {
        throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
      }
      if (args[0] === "bootstrap") loaded = true;
      if (args[0] === "kickstart" && !loaded) {
        throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
      }
      return { stdout: "" };
    },
  });

  await adapter.startService({ launchAgentPath });

  assert.deepEqual(calls, [
    ["/bin/launchctl", ["print", `gui/501/${SERVICE_LABEL}`]],
    ["/bin/launchctl", ["bootstrap", "gui/501", launchAgentPath]],
    ["/bin/launchctl", ["kickstart", "-k", `gui/501/${SERVICE_LABEL}`]],
  ]);
});

test("MacPlatformAdapter only kickstarts the exact target when the job is already loaded", async () => {
  const calls = [];
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile: async (file, args) => { calls.push([file, args]); return { stdout: "" }; },
  });

  await adapter.startService({
    launchAgentPath: "/Users/example/Library/LaunchAgents/com.vontean.minecodex.plist",
  });

  assert.deepEqual(calls, [
    ["/bin/launchctl", ["print", `gui/501/${SERVICE_LABEL}`]],
    ["/bin/launchctl", ["kickstart", "-k", `gui/501/${SERVICE_LABEL}`]],
  ]);
});
