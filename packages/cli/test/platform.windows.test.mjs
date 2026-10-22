import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_WINDOWS_PACKAGE_FAMILY,
  buildWindowsServiceCommand,
  buildWindowsServiceLauncher,
  buildWindowsServiceRuntimeConfig,
  createPlatformAdapter,
  isExactCodexProcessWindows,
  WINDOWS_SERVICE_TASK_NAME,
  WindowsPlatformAdapter,
} from "../src/platform.mjs";
import { resolvePaths } from "../src/paths.mjs";

const WINDOWS_HOME = "C:\\Users\\vonte";
const FAKE_EXE = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.903.9818.0_x64__2p2nqsd0c76g0\\app\\ChatGPT.exe";

function decodePowerShellArg(args) {
  const index = args.indexOf("-EncodedCommand");
  if (index === -1) return null;
  return Buffer.from(args[index + 1], "base64").toString("utf16le");
}

test("resolvePaths lays out Windows support, service, and feature data directories", () => {
  const paths = resolvePaths({ homeDir: WINDOWS_HOME, platform: "win32" });
  assert.equal(paths.supportDir, path.win32.join(process.env.APPDATA ?? path.win32.join(WINDOWS_HOME, "AppData", "Roaming"), "MineCodex"));
  assert.equal(paths.serviceAppPath, path.win32.join(paths.supportDir, "service", "MineCodexService.cmd"));
  assert.equal(paths.profileDir, path.win32.join(process.env.LOCALAPPDATA ?? path.win32.join(WINDOWS_HOME, "AppData", "Local"), "MineCodex", "codex-profile"));
  assert.equal(paths.notesDataDir, path.win32.join(process.env.APPDATA ?? path.win32.join(WINDOWS_HOME, "AppData", "Roaming"), "CodexNotes"));
  assert.equal(paths.imagesDataDir, path.win32.join(WINDOWS_HOME, ".codex-image-host"));
  assert.equal(paths.serviceBundleSource, null);
  assert.match(paths.serviceRuntimeConfigPath, /service-runtime\.json$/);
});

test("createPlatformAdapter selects the adapter by platform", () => {
  assert.ok(createPlatformAdapter({ platform: "win32" }) instanceof WindowsPlatformAdapter);
  assert.ok(!(createPlatformAdapter({ platform: "darwin" }) instanceof WindowsPlatformAdapter));
});

test("Windows Codex process matching requires the exact executable", () => {
  const installation = { executable: FAKE_EXE };
  assert.equal(isExactCodexProcessWindows(FAKE_EXE + " --remote-debugging-port=9231", installation), true);
  assert.equal(isExactCodexProcessWindows(FAKE_EXE.toLowerCase(), installation), true);
  assert.equal(isExactCodexProcessWindows('"' + FAKE_EXE + '" --type=renderer', installation), false);
  assert.equal(isExactCodexProcessWindows('"' + FAKE_EXE + '" --type=gpu-process', installation), false);
  assert.equal(isExactCodexProcessWindows('"' + FAKE_EXE + '"', installation), true);
  assert.equal(isExactCodexProcessWindows('"' + FAKE_EXE + '-helper"', installation), false);
  assert.equal(isExactCodexProcessWindows(FAKE_EXE + "-helper", installation), false);
  assert.equal(isExactCodexProcessWindows("C:\\other\\ChatGPT.exe", installation), false);
});

test("WindowsPlatformAdapter verifies the official MSIX package and signing identity", async () => {
  const adapter = new WindowsPlatformAdapter({
    platform: "win32",
    homeDir: WINDOWS_HOME,
    execFile: async (file, args) => {
      assert.equal(file, "powershell.exe");
      return { stdout: JSON.stringify({
        installLocation: "C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.903.9818.0_x64__2p2nqsd0c76g0",
        packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY,
        version: "26.903.9818.0",
        exePath: FAKE_EXE,
        signatureStatus: "Valid",
        signerSubject: "CN=OpenAI, Inc., OU=...",
      }) };
    },
    fileSystem: { stat: async () => ({ dev: 1, ino: 2, size: 3, mtimeMs: 4 }) },
  });
  const installation = await adapter.assertCodexInstalled();
  assert.equal(installation.executable, FAKE_EXE);
  assert.equal(installation.verified, true);
});

test("WindowsPlatformAdapter rediscovers the verified package after an update removes its cached path", async () => {
  let updated = false;
  let discoveries = 0;
  const newExe = FAKE_EXE.replace("26.903.9818.0", "26.1016.8120.0");
  const adapter = new WindowsPlatformAdapter({
    platform: "win32",
    execFile: async () => {
      discoveries += 1;
      return { stdout: JSON.stringify({
        installLocation: updated ? "C:\\updated" : "C:\\original",
        packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY,
        version: updated ? "26.1016.8120.0" : "26.903.9818.0",
        exePath: updated ? newExe : FAKE_EXE,
        signatureStatus: "Valid",
        signerSubject: "CN=OpenAI, Inc.",
      }) };
    },
    fileSystem: { stat: async filePath => {
      if (updated && (filePath === FAKE_EXE || filePath.startsWith("C:\\original"))) {
        throw Object.assign(new Error("old package removed"), { code: "ENOENT" });
      }
      return { dev: 1, ino: 2, size: 3, mtimeMs: 4 };
    } },
  });
  await adapter.codex();
  updated = true;
  assert.equal((await adapter.codex()).executable, newExe);
  assert.equal(await adapter.codexBuild(), "26.1016.8120.0");
  assert.equal(discoveries, 2);
});

test("WindowsPlatformAdapter refuses foreign package family or broken signatures", async () => {
  const response = (overrides) => JSON.stringify({
    installLocation: "C:\\x",
    packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY,
    version: "1",
    exePath: FAKE_EXE,
    signatureStatus: "Valid",
    signerSubject: "CN=OpenAI, Inc.",
    ...overrides,
  });
  const foreignFamily = new WindowsPlatformAdapter({
    platform: "win32",
    execFile: async () => ({ stdout: response({ packageFamilyName: "Evil.App_fake" }) }),
  });
  await assert.rejects(foreignFamily.assertCodexInstalled(), /Refusing non-official ChatGPT package/);

  const brokenSignature = new WindowsPlatformAdapter({
    platform: "win32",
    execFile: async () => ({ stdout: response({ signatureStatus: "HashMismatch", signerSubject: "CN=Attacker" }) }),
  });
  await assert.rejects(brokenSignature.assertCodexInstalled(), /unexpected signing identity/);
});

test("listCodexProcesses keeps only exact official executables and exposes stable fields", async () => {
  const installation = {
    appPath: "C:\\\\pkg",
    executable: FAKE_EXE,
    packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY,
    signerSubject: "CN=OpenAI, Inc.",
    verified: true,
  };
  const adapter = new WindowsPlatformAdapter({
    platform: "win32",
    codexInstallation: installation,
    execFile: async (file, args) => {
      const script = decodePowerShellArg(args) ?? "";
      assert.match(script, /Win32_Process/);
      return { stdout: JSON.stringify([
        { pid: 100, command: FAKE_EXE },
        { pid: 101, command: FAKE_EXE + " --type=renderer" },
        { pid: 102, command: "C:\\other\\ChatGPT.exe" },
        { pid: 103, command: FAKE_EXE + " --user-data-dir=C:\\prof" },
      ]) };
    },
  });
  const processes = await adapter.listCodexProcesses();
  assert.deepEqual(processes.map(({ pid }) => pid), [100, 103]);
  assert.equal(processes[0].bundleIdentifier, CODEX_WINDOWS_PACKAGE_FAMILY);
  assert.equal(processes[0].verified, true);
});

test("installService writes runtime config, service command, and registers a logon task", async () => {
  const written = new Map();
  const calls = [];
  const fileSystem = {
    mkdir: async (dir) => calls.push(["mkdir", dir]),
    writeFile: async (filePath, content) => {
      written.set(filePath, content);
      calls.push(["write", filePath]);
    },
    rename: async (from, to) => {
      if (written.has(from)) written.set(to, written.get(from));
      written.delete(from);
      calls.push(["rename", from, to]);
    },
    unlink: async () => {},
    rm: async () => {},
    stat: async () => ({ mode: 0o600 }),
    readFile: async (filePath) => {
      if (!written.has(filePath)) {
        const error = new Error("not found");
        error.code = "ENOENT";
        throw error;
      }
      return written.get(filePath);
    },
  };
  const paths = resolvePaths({ homeDir: WINDOWS_HOME, platform: "win32" });
  const adapter = new WindowsPlatformAdapter({
    platform: "win32",
    homeDir: WINDOWS_HOME,
    execFile: async (file, args) => {
      const script = decodePowerShellArg(args) ?? "";
      if (script.includes("Register-ScheduledTask")) {
        assert.match(script, new RegExp(WINDOWS_SERVICE_TASK_NAME));
        assert.match(script, /ExecutionTimeLimit \(\[TimeSpan\]::Zero\)/);
        assert.match(script, /System32\\wscript\.exe/);
        assert.match(script, /\/\/B \/\/Nologo/);
        assert.match(script, /-WorkingDirectory \$serviceDir/);
        assert.match(script, /New-ScheduledTaskTrigger -AtLogOn/);
        assert.doesNotMatch(script, /-AtStartup/);
      }
      return { stdout: "registered" };
    },
    fileSystem,
  });
  await adapter.installService({ cliPath: "C:\\\\mc\\mcx.mjs", paths, start: false });
  const command = written.get(paths.serviceAppPath);
  const config = JSON.parse(written.get(paths.serviceRuntimeConfigPath));
  assert.match(command, /mcx\.mjs" serve/);
  assert.equal(config.cliPath, "C:\\\\mc\\mcx.mjs");
  assert.equal(config.nodePath, process.execPath);
  const launcher = written.get(paths.serviceLauncherPath);
  assert.equal(launcher.readUInt16LE(0), 0xFEFF);
  assert.match(launcher.toString("utf16le"), /shell\.Run\(command, 0, True\)/);
});

test("assertNativeCodexCdp requires loopback CDP arguments and matching port owner", async () => {
  const adapter = new WindowsPlatformAdapter({
    platform: "win32",
    codexInstallation: { executable: FAKE_EXE, verified: true },
    execFile: async (file, args) => {
      const script = decodePowerShellArg(args) ?? "";
      assert.match(script, /Get-NetTCPConnection/);
      return { stdout: "OWNED\n" };
    },
  });
  const processInfo = {
    pid: 4321,
    command: FAKE_EXE + " --remote-debugging-address=127.0.0.1 --remote-debugging-port=9231 --remote-allow-origins=http://127.0.0.1:9231",
    verified: true,
  };
  assert.equal(await adapter.assertNativeCodexCdp(processInfo, 9231), true);
  await assert.rejects(
    adapter.assertNativeCodexCdp({ ...processInfo, command: FAKE_EXE }, 9231),
    /could not bind the loopback CDP endpoint/,
  );
});

test("Windows service restore regenerates its hidden launcher before registering the task", async () => {
  const paths = resolvePaths({ homeDir: WINDOWS_HOME, platform: "win32" });
  const written = new Map();
  const adapter = new WindowsPlatformAdapter({
    fileSystem: {
      mkdir: async () => {},
      writeFile: async (file, content) => written.set(file, content),
    },
  });
  adapter.removeService = async () => {};
  adapter.assertServiceStopped = async () => {};
  adapter.registerServiceTask = async () => {
    assert.ok(written.has(paths.serviceAppPath));
    assert.ok(written.has(paths.serviceLauncherPath));
  };
  await adapter.restoreServiceState({ app: { exists: true, status: "disabled" }, running: false }, { cliPath: "C:\\mc\\mcx.mjs", paths });
  assert.match(written.get(paths.serviceLauncherPath).toString("utf16le"), /WScript\.Quit exitCode/);
});

test("Windows service command and runtime config builders pin exact paths", () => {
  const paths = resolvePaths({ homeDir: WINDOWS_HOME, platform: "win32" });
  const command = buildWindowsServiceCommand({
    nodePath: "C:\\node\\node.exe",
    cliPath: "C:\\mc\\mcx.mjs",
    paths,
  });
  assert.match(command, /^@echo off/);
  assert.match(command, /"C:\\node\\node\.exe" "C:\\mc\\mcx\.mjs" serve/);
  const config = JSON.parse(buildWindowsServiceRuntimeConfig({
    nodePath: "C:\\node\\node.exe",
    cliPath: "C:\\mc\\mcx.mjs",
    paths,
  }));
  assert.equal(config.serviceLogPath, paths.serviceLogPath);
});

test("Windows registered activation preserves the package identity and loopback CDP arguments", async () => {
  let script, waited;
  const adapter = new WindowsPlatformAdapter();
  adapter.codex = async () => ({ executable: FAKE_EXE, packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY });
  adapter.listCodexProcesses = async () => [{ pid: 42 }];
  adapter.powershell = async value => { script = value; };
  adapter.waitForNativeCodex = async options => { waited = options; return { pid: 43 }; };
  assert.deepEqual(await adapter.openNativeCodex({ cdpPort: 9231 }), { pid: 43 });
  assert.match(script, /ActivateApplication/);
  assert.ok(script.includes(CODEX_WINDOWS_PACKAGE_FAMILY + "!App"));
  assert.match(script, /--remote-debugging-address=127\.0\.0\.1 --remote-debugging-port=9231 --remote-allow-origins=http:\/\/127\.0\.0\.1:9231/);
  assert.doesNotMatch(script, /Start-Process/);
  assert.equal(waited.cdpPort, 9231);
  assert.deepEqual([...waited.excludedPids], [42]);
});

test("Windows ordinary launch uses registered activation without CDP or process discovery", async () => {
  const adapter = new WindowsPlatformAdapter();
  adapter.codex = async () => ({ packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY });
  adapter.listCodexProcesses = async () => assert.fail("ordinary launch must not enumerate CDP processes");
  adapter.waitForNativeCodex = async () => assert.fail("ordinary launch must not wait for CDP");
  adapter.powershell = async script => {
    assert.ok(script.includes(`::Launch('${CODEX_WINDOWS_PACKAGE_FAMILY}!App', '')`));
    assert.doesNotMatch(script, /--remote-debugging/);
  };
  assert.equal(await adapter.openNativeCodex(), null);
});

test("Windows activation errors propagate without waiting for a nonexistent launch", async () => {
  const adapter = new WindowsPlatformAdapter();
  adapter.codex = async () => ({ packageFamilyName: CODEX_WINDOWS_PACKAGE_FAMILY });
  adapter.listCodexProcesses = async () => [];
  adapter.powershell = async () => { throw new Error("activation failed"); };
  adapter.waitForNativeCodex = async () => assert.fail("failed activation must not wait for CDP");
  await assert.rejects(adapter.openNativeCodex({ cdpPort: 9231 }), /activation failed/);
});

import path from "node:path";
import os from "node:os";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("Windows hidden launcher preserves exit code through a path with spaces and Chinese", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "minecodex 隐藏 "));
  try {
    const paths = { serviceAppPath: path.join(directory, "service.cmd") };
    const launcherPath = path.join(directory, "hidden.vbs");
    await writeFile(paths.serviceAppPath, "@exit /b 7\r\n", "ascii");
    await writeFile(launcherPath, Buffer.from("\uFEFF" + buildWindowsServiceLauncher(paths), "utf16le"));
    await assert.rejects(
      promisify(execFile)(path.join(process.env.SystemRoot, "System32", "cscript.exe"), ["//B", "//Nologo", launcherPath], { windowsHide: true }),
      error => error.code === 7,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
