import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_WINDOWS_PACKAGE_FAMILY,
  buildWindowsServiceCommand,
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

import path from "node:path";
