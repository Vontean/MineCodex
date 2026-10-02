import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertNodeSupported,
  buildServiceRuntimeConfig,
  CODEX_BUNDLE_IDENTIFIER,
  CODEX_EXECUTABLE,
  isExactCodexProcess,
  LEGACY_SERVICE_LABEL,
  MacPlatformAdapter,
  resolveCodexInstallation,
  SERVICE_LABEL,
  verifyCodexInstallation,
} from "../src/platform.mjs";
import { resolvePaths } from "../src/paths.mjs";

test("MineCodex owns the background item while runtime config keeps exact Node and CLI paths", async () => {
  const paths = resolvePaths({ homeDir: "/Users/example" });
  const configuration = buildServiceRuntimeConfig({
    nodePath: "/Users/example/a&b/node",
    cliPath: "/Users/example/minecodex/packages/cli/bin/mcx.mjs",
    paths,
  });
  assert.match(configuration, /a&amp;b\/node/);
  assert.match(configuration, /packages\/cli\/bin\/mcx\.mjs/);
  assert.doesNotMatch(configuration, /ProgramArguments|BundleProgram/);

  const [infoPlist, launchAgent] = await Promise.all([
    readFile(`${paths.serviceBundleSource}/Contents/Info.plist`, "utf8"),
    readFile(`${paths.serviceBundleSource}/Contents/Library/LaunchAgents/${SERVICE_LABEL}.plist`, "utf8"),
  ]);
  assert.match(infoPlist, /<key>CFBundleIconFile<\/key>\s*<string>MineCodex\.icns<\/string>/);
  const serviceIcon = await readFile(`${paths.serviceBundleSource}/Contents/Resources/MineCodex.icns`);
  assert.equal(serviceIcon.subarray(0, 4).toString(), "icns");
  assert.equal(serviceIcon.readUInt32BE(4), serviceIcon.length);
  assert.match(infoPlist, /<key>CFBundleDisplayName<\/key>\s*<string>MineCodex<\/string>/);
  assert.match(launchAgent, /<key>BundleProgram<\/key>\s*<string>Contents\/Resources\/MineCodexServiceHost<\/string>/);
  assert.doesNotMatch(launchAgent, /Node\.js|ProgramArguments/);
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", paths.serviceBundleSource]);
  assert.match(execFileSync("/usr/bin/lipo", ["-archs", paths.serviceManagerPath.replace(paths.serviceAppPath, paths.serviceBundleSource)], { encoding: "utf8" }), /arm64/);
  assert.match(execFileSync("/usr/bin/lipo", ["-archs", `${paths.serviceBundleSource}/Contents/Resources/MineCodexServiceHost`], { encoding: "utf8" }), /x86_64/);
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
  const currentTarget = `gui/501/${SERVICE_LABEL}`;
  const legacyTarget = `gui/501/${LEGACY_SERVICE_LABEL}`;
  let loadedTarget = legacyTarget;
  const fileSystem = {
    mkdir: async () => {},
    readFile: async (filePath) => {
      if (!files.has(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return files.get(filePath);
    },
    stat: async (filePath) => {
      if (!files.has(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return { mode: 0o600 };
    },
    writeFile: async (filePath, content) => { files.set(filePath, content); },
    unlink: async (filePath) => {
      if (!files.delete(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    rm: async (target) => {
      for (const filePath of [...files.keys()]) {
        if (filePath === target || filePath.startsWith(`${target}/`)) files.delete(filePath);
      }
    },
    rename: async (from, to) => {
      for (const [filePath, content] of [...files.entries()]) {
        if (filePath === from || filePath.startsWith(`${from}/`)) {
          files.delete(filePath);
          files.set(`${to}${filePath.slice(from.length)}`, content);
        }
      }
    },
  };
  const execFile = async (file, args) => {
    calls.push([file, args]);
    if (file === "/usr/bin/ditto") {
      files.set(`${args[1]}/Contents/MacOS/MineCodexServiceManager`, "manager");
    }
    if (file.endsWith("MineCodexServiceManager") && args[0] === "status") return { stdout: "status=not-registered\n" };
    if (file.endsWith("MineCodexServiceManager") && args[0] === "register") return { stdout: "status=enabled\n" };
    if (args[0] === "print" && args[1] !== loadedTarget) {
      throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
    }
    if (args[0] === "bootout") {
      if (args[1] !== loadedTarget) throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
      loadedTarget = null;
    }
    if (args[0] === "bootstrap") loadedTarget = legacyTarget;
    if (args[0] === "kickstart") loadedTarget = args.at(-1);
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
    serviceDir: "/tmp/minecodex-platform-fake/service",
    serviceAppPath: "/tmp/minecodex-platform-fake/service/MineCodex.app",
    serviceManagerPath: "/tmp/minecodex-platform-fake/service/MineCodex.app/Contents/MacOS/MineCodexServiceManager",
    serviceBundleSource: "/tmp/package/MineCodex.app",
    serviceRuntimeConfigPath: "/tmp/minecodex-platform-fake/service-runtime.plist",
    logsDir: "/tmp/minecodex-platform-fake/logs",
    serviceLogPath: "/tmp/minecodex-platform-fake/runtime.log",
    serviceErrorLogPath: "/tmp/minecodex-platform-fake/runtime-error.log",
  };
  const snapshot = await adapter.snapshotServiceState(paths);
  assert.equal(snapshot.running, true);
  assert.deepEqual(calls.slice(-2), [
    ["/bin/launchctl", ["print", currentTarget]],
    ["/bin/launchctl", ["print", legacyTarget]],
  ]);
  await adapter.installService({ cliPath: "/tmp/mcx.mjs", paths, start: false });
  assert.equal(loadedTarget, null);
  assert.equal(files.has(launchAgentPath), false);
  assert.equal(files.has(paths.serviceManagerPath), true);
  assert.equal(files.has(paths.serviceRuntimeConfigPath), true);
  assert.equal(files.has(`${paths.serviceRuntimeConfigPath}.installing`), false);
  await adapter.restoreServiceState(snapshot, { paths });
  assert.equal(loadedTarget, legacyTarget);
  assert.equal(files.get(launchAgentPath), "previous plist");
  assert.ok(calls.some(([, [command]]) => command === "bootstrap"));
  assert.ok(calls.every(([, args]) => args.at(-1) !== "/Applications/ChatGPT.app"));
});

test("MacPlatformAdapter registers an installed MineCodex app service before kickstarting its exact target", async () => {
  const serviceManagerPath = "/Users/example/Library/Application Support/MineCodex/service/MineCodex.app/Contents/MacOS/MineCodexServiceManager";
  const calls = [];
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (file === serviceManagerPath && args[0] === "status") return { stdout: "status=not-registered\n" };
      if (file === serviceManagerPath && args[0] === "register") return { stdout: "status=enabled\n" };
      return { stdout: "" };
    },
    fileSystem: { stat: async () => ({ mode: 0o755 }) },
  });

  await adapter.startService({ serviceManagerPath });

  assert.deepEqual(calls, [
    [serviceManagerPath, ["status"]],
    [serviceManagerPath, ["register"]],
    ["/bin/launchctl", ["kickstart", "-k", `gui/501/${SERVICE_LABEL}`]],
  ]);
});

test("MacPlatformAdapter only kickstarts the exact target when the job is already loaded", async () => {
  const calls = [];
  const serviceManagerPath = "/Users/example/Library/Application Support/MineCodex/service/MineCodex.app/Contents/MacOS/MineCodexServiceManager";
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile: async (file, args) => {
      calls.push([file, args]);
      return { stdout: file === serviceManagerPath ? "status=enabled\n" : "" };
    },
    fileSystem: { stat: async () => ({ mode: 0o755 }) },
  });

  await adapter.startService({ serviceManagerPath });

  assert.deepEqual(calls, [
    [serviceManagerPath, ["status"]],
    ["/bin/launchctl", ["kickstart", "-k", `gui/501/${SERVICE_LABEL}`]],
  ]);
});

test("MacPlatformAdapter refuses broad service removal targets before touching launchd", async () => {
  let touched = false;
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    execFile: async () => { touched = true; return { stdout: "" }; },
  });

  await assert.rejects(adapter.removeService({
    serviceDir: "/",
    serviceAppPath: "/MineCodex.app",
  }), /unsafe MineCodex service path/);
  assert.equal(touched, false);
});

test("MacPlatformAdapter verifies the official bundle and OpenAI signing identity", async () => {
  const calls = [];
  const installation = await verifyCodexInstallation({
    installation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (file === "/usr/bin/plutil") return { stdout: `${CODEX_BUNDLE_IDENTIFIER}\n` };
      if (args[0] === "-dv") return { stderr: "Identifier=com.openai.codex\nAuthority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)\nTeamIdentifier=2DC432GLL2\n" };
      return { stdout: "", stderr: "" };
    },
  });

  assert.equal(installation.bundleIdentifier, CODEX_BUNDLE_IDENTIFIER);
  assert.match(installation.signingIdentity, /OpenAI/);
  assert.equal(installation.verified, true);
  assert.equal(calls.length, 3);

  await assert.rejects(verifyCodexInstallation({
    installation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async (file) => file === "/usr/bin/plutil"
      ? { stdout: "com.example.substituted\n" }
      : { stdout: "", stderr: "" },
  }), /non-official ChatGPT bundle/);

  await assert.rejects(verifyCodexInstallation({
    installation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async (file, args) => {
      if (file === "/usr/bin/plutil") return { stdout: `${CODEX_BUNDLE_IDENTIFIER}\n` };
      if (args[0] === "-dv") return { stderr: "Identifier=com.openai.codex\nAuthority=Developer ID Application: OpenAI Lookalike\nTeamIdentifier=ATTACKER123\n" };
      return { stdout: "", stderr: "" };
    },
  }), /unexpected signing identity/);
});

test("MacPlatformAdapter revalidates the official app when its installation fingerprint changes", async () => {
  let generation = 1;
  let signatureChecks = 0;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    fileSystem: {
      readFile: async () => "present",
      stat: async (filePath) => ({ ino: filePath.length, size: 100, mtimeMs: generation }),
    },
    execFile: async (file, args) => {
      if (file === "/usr/bin/plutil") return { stdout: `${CODEX_BUNDLE_IDENTIFIER}\n` };
      if (file === "/usr/bin/codesign") {
        signatureChecks += 1;
        if (args[0] === "-dv") return { stderr: "Identifier=com.openai.codex\nAuthority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)\nTeamIdentifier=2DC432GLL2\n" };
      }
      return { stdout: "", stderr: "" };
    },
  });

  await adapter.assertCodexInstalled();
  await adapter.codex();
  assert.equal(signatureChecks, 2);
  generation += 1;
  await adapter.codex();
  assert.equal(signatureChecks, 4);
});

test("MacPlatformAdapter opens a new official ChatGPT instance through LaunchServices without a profile override", async () => {
  const calls = [];
  let opened = false;
  const existing = `4100 ${CODEX_EXECUTABLE} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231\n`;
  const launched = `4201 ${CODEX_EXECUTABLE} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231 --no-first-run\n`;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async (file, args) => {
      calls.push([file, args]);
      if (file === "/usr/bin/open") { opened = true; return { stdout: "" }; }
      if (file === "/usr/sbin/lsof") return { stdout: "p4201\nn127.0.0.1:9231\n" };
      return { stdout: existing + (opened ? launched : "") };
    },
    sleep: async () => {},
  });

  const processInfo = await adapter.openNativeCodex({ cdpPort: 9231 });

  assert.equal(processInfo.pid, 4201);
  assert.equal(processInfo.verified, true);
  assert.deepEqual(calls.find(([file]) => file === "/usr/bin/open"), ["/usr/bin/open", [
    "-n",
    "-a",
    "/Applications/ChatGPT.app",
    "--args",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9231",
      "--remote-allow-origins=http://127.0.0.1:9231",
    ]]);
  assert.equal(calls.some(([, args]) => args.includes("--user-data-dir=/tmp/minecodex-profile")), false);
});

test("MacPlatformAdapter rejects a CDP listener that is not owned by the verified ChatGPT PID", async () => {
  const command = `${CODEX_EXECUTABLE} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231`;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async () => ({ stdout: "p9999\nn127.0.0.1:9231\n" }),
  });

  await assert.rejects(adapter.assertNativeCodexCdp({
    pid: 4201,
    command,
    verified: true,
  }, 9231), /does not own loopback CDP port/);
});

test("MacPlatformAdapter terminates only the exact verified native ChatGPT PID", async () => {
  const killed = [];
  let alive = true;
  let helperAlive = true;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    execFile: async (file, args) => file === "/bin/ps"
      ? { stdout: args.includes("pid=,ppid=,command=")
        ? `4202 1 ${CODEX_EXECUTABLE}\n4204 4202 ${CODEX_EXECUTABLE} --type=renderer\n`
        : (alive ? `4202 ${CODEX_EXECUTABLE}\n` : "") }
      : { stdout: "" },
    processApi: {
      kill(pid, signal) {
        killed.push([pid, signal]);
        if (signal === "SIGTERM") alive = false;
        if (signal === 0 && pid === 4202 && !alive) throw Object.assign(new Error("gone"), { code: "ESRCH" });
        if (signal === 0 && pid === 4204 && !helperAlive) throw Object.assign(new Error("gone"), { code: "ESRCH" });
      },
    },
    sleep: async () => { helperAlive = false; },
  });

  assert.equal(await adapter.terminateNativeCodex(4202, CODEX_EXECUTABLE), 1);
  assert.deepEqual(killed, [[4202, "SIGTERM"], [4202, 0], [4204, 0], [4204, 0]]);
  await assert.rejects(adapter.terminateNativeCodex(), /exact ChatGPT PID/);
  assert.equal(await adapter.terminateNativeCodex(4206, CODEX_EXECUTABLE), 0);
  assert.deepEqual(killed, [[4202, "SIGTERM"], [4202, 0], [4204, 0], [4204, 0]]);

  const unverifiedAdapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE, verified: false },
    execFile: async (file) => file === "/bin/ps"
      ? { stdout: `4203 ${CODEX_EXECUTABLE}\n` }
      : { stdout: "" },
    processApi: { kill() { throw new Error("unverified process must not be killed"); } },
  });
  assert.equal(await unverifiedAdapter.terminateNativeCodex(4203, CODEX_EXECUTABLE), 0);
});

test("MacPlatformAdapter can remove a MineCodex-owned LaunchServices session without touching an unowned profile", async () => {
  const command = `${CODEX_EXECUTABLE} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231`;
  const files = new Map([["/tmp/minecodex-owned.pid", `${JSON.stringify({ version: 1, pid: 4300, command })}\n`]]);
  const killed = [];
  let alive = true;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    fileSystem: {
      readFile: async (filePath) => {
        if (!files.has(filePath)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return files.get(filePath);
      },
      unlink: async (filePath) => { files.delete(filePath); },
    },
    execFile: async (file, args) => file === "/bin/ps"
      ? { stdout: args.includes("pid=,ppid=,command=") ? `4300 1 ${command}\n` : (alive ? `4300 ${command}\n` : "") }
      : { stdout: "" },
    processApi: {
      kill(pid, signal) {
        killed.push([pid, signal]);
        if (signal === "SIGTERM") alive = false;
        if (signal === 0 && !alive) throw Object.assign(new Error("gone"), { code: "ESRCH" });
      },
    },
    sleep: async () => {},
  });

  assert.equal(await adapter.terminateOwnedCodex({
    codexPidPath: "/tmp/minecodex-owned.pid",
    profileDir: "/tmp/official-chatgpt-profile",
  }), true);
  assert.deepEqual(killed, [[4300, "SIGTERM"], [4300, 0]]);
  assert.equal(files.has("/tmp/minecodex-owned.pid"), false);
});

test("MacPlatformAdapter rejects a stale owner marker after PID reuse", async () => {
  const staleCommand = `${CODEX_EXECUTABLE} --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231`;
  const currentCommand = `${staleCommand} --new-session`;
  const adapter = new MacPlatformAdapter({
    platform: "darwin",
    codexInstallation: { appPath: "/Applications/ChatGPT.app", executable: CODEX_EXECUTABLE },
    fileSystem: {
      readFile: async () => `${JSON.stringify({ version: 1, pid: 4400, command: staleCommand })}\n`,
      unlink: async () => {},
    },
    execFile: async (file) => file === "/bin/ps" ? { stdout: `4400 ${currentCommand}\n` } : { stdout: "" },
    processApi: { kill() { throw new Error("stale ownership must not terminate the reused PID"); } },
  });

  assert.equal(await adapter.terminateOwnedCodex({
    codexPidPath: "/tmp/minecodex-owned.pid",
    profileDir: "/tmp/official-chatgpt-profile",
  }), false);
});

test("MacPlatformAdapter keeps the service bundle when macOS refuses to unregister it", async () => {
  const serviceDir = "/tmp/minecodex-unregister-failure/service";
  const serviceAppPath = `${serviceDir}/MineCodex.app`;
  const serviceManagerPath = `${serviceAppPath}/Contents/MacOS/MineCodexServiceManager`;
  let removed = false;
  const adapter = new MacPlatformAdapter({
    uid: 501,
    platform: "darwin",
    fileSystem: {
      stat: async () => ({ mode: 0o755 }),
      rm: async () => { removed = true; },
    },
    execFile: async (file, args) => {
      if (file === serviceManagerPath && args[0] === "unregister") {
        throw new Error("unregister denied");
      }
      if (file === "/bin/launchctl" && args[0] === "bootout") {
        throw Object.assign(new Error("service not found"), { stderr: "Could not find service" });
      }
      return { stdout: "" };
    },
  });

  await assert.rejects(adapter.removeService({
    serviceDir,
    serviceAppPath,
    serviceManagerPath,
    launchAgentPath: "/tmp/minecodex-unregister-failure/com.vontean.minecodex.plist",
    serviceRuntimeConfigPath: "/tmp/minecodex-unregister-failure/service-runtime.plist",
  }), /unregister denied/);
  assert.equal(removed, false);
});
