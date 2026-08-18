import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { hasLoopbackCdpArguments } from "./chatgpt-launch-coordinator.mjs";

const defaultExecFile = promisify(execFileCallback);
const defaultFileSystem = Object.freeze({ mkdir, readFile, rename, rm, stat, unlink, writeFile });

export const SERVICE_LABEL = "com.vontean.minecodex.background";
export const LEGACY_SERVICE_LABEL = "com.vontean.minecodex";
export const CODEX_APP_PATH = "/Applications/ChatGPT.app";
export const CODEX_EXECUTABLE = `${CODEX_APP_PATH}/Contents/MacOS/ChatGPT`;
export const CODEX_BUNDLE_IDENTIFIER = "com.openai.codex";
export const CODEX_TEAM_IDENTIFIER = "2DC432GLL2";
export const MIN_NODE_VERSION = Object.freeze({ major: 22, minor: 5, patch: 0 });
export const MIN_MACOS_VERSION = Object.freeze({ major: 13, darwinMajor: 22 });

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildServiceRuntimeConfig({ nodePath, cliPath, paths }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NodePath</key>
  <string>${xml(nodePath)}</string>
  <key>CLIPath</key>
  <string>${xml(cliPath)}</string>
  <key>StandardOutputPath</key>
  <string>${xml(paths.serviceLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(paths.serviceErrorLogPath)}</string>
  <key>Path</key>
  <string>${xml(path.dirname(nodePath))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
</dict>
</plist>
`;
}

export function assertNodeSupported(nodeVersion = process.versions.node) {
  const [major, minor, patch = 0] = String(nodeVersion).split(".").map((part) => Number.parseInt(part, 10));
  const supported = Number.isInteger(major)
    && (major > MIN_NODE_VERSION.major
      || (major === MIN_NODE_VERSION.major && Number.isInteger(minor) && minor >= MIN_NODE_VERSION.minor));
  if (!supported) {
    throw new Error(
      `MineCodex requires Node.js ${MIN_NODE_VERSION.major}.${MIN_NODE_VERSION.minor}.0 or newer; `
      + `current version is ${nodeVersion}. Upgrade Node.js before running mcx install.`,
    );
  }
  return { major, minor, patch };
}

export function supportedCodexAppPaths(homeDir = os.homedir()) {
  return Object.freeze([
    CODEX_APP_PATH,
    path.join(homeDir, "Applications", "ChatGPT.app"),
  ]);
}

export async function resolveCodexInstallation({
  homeDir = os.homedir(),
  fileExists = async (filePath) => {
    try {
      await readFile(filePath);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  },
} = {}) {
  for (const appPath of supportedCodexAppPaths(homeDir)) {
    const infoPath = path.join(appPath, "Contents", "Info.plist");
    if (await fileExists(infoPath)) {
      return Object.freeze({
        appPath,
        executable: path.join(appPath, "Contents", "MacOS", "ChatGPT"),
      });
    }
  }
  throw new Error(
    `Codex Desktop was not found in a supported installation path: ${supportedCodexAppPaths(homeDir).join(", ")}`,
  );
}

export async function verifyCodexInstallation({ installation, execFile = defaultExecFile } = {}) {
  if (!installation?.appPath || !installation?.executable) {
    throw new Error("Codex Desktop installation is incomplete.");
  }
  const infoPath = path.join(installation.appPath, "Contents", "Info.plist");
  const { stdout: bundleIdentifier } = await execFile("/usr/bin/plutil", [
    "-extract", "CFBundleIdentifier", "raw", "-o", "-", infoPath,
  ]);
  if (String(bundleIdentifier).trim() !== CODEX_BUNDLE_IDENTIFIER) {
    throw new Error(`Refusing non-official ChatGPT bundle: ${String(bundleIdentifier).trim() || "unknown"}`);
  }
  await execFile("/usr/bin/codesign", ["--verify", "--deep", "--strict", installation.appPath]);
  const { stderr: details } = await execFile("/usr/bin/codesign", [
    "-dv", "--verbose=4", installation.appPath,
  ]);
  const authority = String(details).match(/^Authority=(.+)$/m)?.[1] ?? "";
  const identifier = String(details).match(/^Identifier=(.+)$/m)?.[1] ?? "";
  const teamIdentifier = String(details).match(/^TeamIdentifier=(.+)$/m)?.[1] ?? "";
  if (
    identifier !== CODEX_BUNDLE_IDENTIFIER
    || teamIdentifier !== CODEX_TEAM_IDENTIFIER
    || !/\bOpenAI\b/i.test(authority)
  ) {
    throw new Error("Refusing ChatGPT with an unexpected signing identity.");
  }
  return Object.freeze({
    ...installation,
    bundleIdentifier: CODEX_BUNDLE_IDENTIFIER,
    signingIdentity: authority,
    teamIdentifier,
    verified: true,
  });
}

export function parseProcessList(output) {
  return String(output).split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    return match ? [{ pid: Number(match[1]), command: match[2] }] : [];
  });
}

export function isExactCodexProcess(command, installation) {
  const value = String(command).trim();
  return value === installation?.executable || value.startsWith(`${installation?.executable} `);
}

function hasManagedProfile(command, profileDir) {
  const value = String(command);
  const marker = `--user-data-dir=${profileDir}`;
  let offset = value.indexOf(marker);
  while (offset >= 0) {
    const before = offset === 0 || /\s/.test(value[offset - 1]);
    const end = offset + marker.length;
    const after = end === value.length || /\s/.test(value[end]);
    if (before && after) return true;
    offset = value.indexOf(marker, offset + 1);
  }
  return false;
}

function extractCdpPort(command) {
  const match = String(command).match(/(?:^|\s)--remote-debugging-port=(\d+)(?:\s|$)/);
  return match ? Number(match[1]) : null;
}

function parseCodexOwnerMarker(content) {
  try {
    const marker = JSON.parse(String(content));
    if (marker?.version !== 1 || !Number.isInteger(marker.pid) || marker.pid <= 1) return null;
    if (typeof marker.command !== "string" || !marker.command.trim()) return null;
    return marker;
  } catch {
    return null;
  }
}

export function serviceIsAbsent(error) {
  return /could not find service|service not found|no such process|domain does not support specified action/i.test(
    `${error?.stderr ?? ""}\n${error?.message ?? ""}`,
  );
}

async function waitForProcessExit(pid, { processApi, timeoutMs = 8_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      processApi.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await sleep(100);
  }
  throw new Error(`Process ${pid} did not exit in time`);
}

async function waitForProcessesExit(
  pids,
  { processApi, timeoutMs = 8_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
) {
  const pending = new Set(pids);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const pid of pending) {
      try {
        processApi.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") pending.delete(pid);
        else throw error;
      }
    }
    if (pending.size === 0) return;
    await sleep(100);
  }
  throw new Error(`ChatGPT process tree did not exit in time: ${[...pending].join(", ")}`);
}

function descendantPids(output, rootPid) {
  const childrenByParent = new Map();
  for (const line of String(output).split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+/);
    if (!match) continue;
    const pid = Number(match[1]);
    const parentPid = Number(match[2]);
    const children = childrenByParent.get(parentPid) ?? [];
    children.push(pid);
    childrenByParent.set(parentPid, children);
  }
  const descendants = [];
  const pending = [...(childrenByParent.get(rootPid) ?? [])];
  while (pending.length) {
    const pid = pending.shift();
    descendants.push(pid);
    pending.push(...(childrenByParent.get(pid) ?? []));
  }
  return descendants;
}

function serviceTarget(uid) {
  return `gui/${uid}/${SERVICE_LABEL}`;
}

function legacyServiceTarget(uid) {
  return `gui/${uid}/${LEGACY_SERVICE_LABEL}`;
}

function appServiceStatus(output) {
  const match = String(output).match(/(?:^|\n)status=([a-z-]+)(?:\n|$)/);
  return match?.[1] ?? "unknown";
}

function assertOwnedServicePaths(paths) {
  const root = path.parse(paths.serviceDir ?? "").root;
  if (!path.isAbsolute(paths.serviceDir)
      || paths.serviceDir === root
      || path.dirname(paths.serviceDir) === root
      || path.basename(paths.serviceDir) !== "service"
      || paths.serviceAppPath !== path.join(paths.serviceDir, "MineCodex.app")) {
    throw new Error(`Refusing unsafe MineCodex service path: ${paths.serviceAppPath}`);
  }
}

export class MacPlatformAdapter {
  constructor({
    uid = process.getuid?.() ?? os.userInfo().uid,
    platform = process.platform,
    osRelease = os.release(),
    homeDir = os.homedir(),
    execFile = defaultExecFile,
    fileSystem = defaultFileSystem,
    processApi = process,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    codexInstallation,
  } = {}) {
    this.uid = uid;
    this.platform = platform;
    this.osRelease = osRelease;
    this.homeDir = homeDir;
    this.execFile = execFile;
    this.fileSystem = fileSystem;
    this.processApi = processApi;
    this.sleep = sleep;
    this.codexInstallation = codexInstallation;
    this.codexInstallationFingerprint = null;
    this.codexInstallationInjected = Boolean(codexInstallation);
  }

  assertInstallSupported() {
    if (this.platform !== "darwin") {
      throw new Error("MineCodex v1 installation currently supports macOS only.");
    }
    const darwinMajor = Number.parseInt(this.osRelease.split(".")[0], 10);
    if (!Number.isInteger(darwinMajor) || darwinMajor < MIN_MACOS_VERSION.darwinMajor) {
      throw new Error(`MineCodex requires macOS ${MIN_MACOS_VERSION.major} or newer.`);
    }
  }

  async assertCodexInstalled() {
    const installation = await resolveCodexInstallation({
      homeDir: this.homeDir,
      fileExists: async (filePath) => {
        try {
          await this.fileSystem.readFile(filePath);
          return true;
        } catch (error) {
          if (error.code === "ENOENT") return false;
          throw error;
        }
      },
    });
    this.codexInstallation = await verifyCodexInstallation({ installation, execFile: this.execFile });
    this.codexInstallationFingerprint = await this.readCodexInstallationFingerprint(this.codexInstallation);
    this.codexInstallationInjected = false;
    return this.codexInstallation;
  }

  async codex() {
    if (!this.codexInstallation) return this.assertCodexInstalled();
    if (this.codexInstallationInjected) return this.codexInstallation;
    const currentFingerprint = await this.readCodexInstallationFingerprint(this.codexInstallation);
    if (this.codexInstallationFingerprint == null) {
      this.codexInstallationFingerprint = currentFingerprint;
    } else if (currentFingerprint !== this.codexInstallationFingerprint) {
      return this.assertCodexInstalled();
    }
    return this.codexInstallation;
  }

  async readCodexInstallationFingerprint(installation) {
    if (typeof this.fileSystem.stat !== "function") return null;
    const paths = [
      installation.executable,
      path.join(installation.appPath, "Contents", "Info.plist"),
      path.join(installation.appPath, "Contents", "_CodeSignature", "CodeResources"),
    ];
    const records = await Promise.all(paths.map(async (filePath) => {
      const info = await this.fileSystem.stat(filePath);
      return [filePath, info.dev ?? null, info.ino ?? null, info.size ?? null, info.mtimeMs ?? null];
    }));
    return JSON.stringify(records);
  }

  async isLaunchdServiceRunning(target) {
    try {
      await this.execFile("/bin/launchctl", ["print", target]);
      return true;
    } catch (error) {
      if (serviceIsAbsent(error)) return false;
      throw error;
    }
  }

  async isServiceRunning() {
    return this.isLaunchdServiceRunning(serviceTarget(this.uid));
  }

  async pathExists(filePath) {
    try {
      if (this.fileSystem.stat) await this.fileSystem.stat(filePath);
      else await this.fileSystem.readFile(filePath);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async serviceManagerStatus(paths) {
    if (!(await this.pathExists(paths.serviceManagerPath))) return "not-found";
    const { stdout } = await this.execFile(paths.serviceManagerPath, ["status"]);
    return appServiceStatus(stdout);
  }

  async isServiceInstalled(paths) {
    return (await this.pathExists(paths.serviceManagerPath))
      || (await this.pathExists(paths.launchAgentPath));
  }

  async writeServiceRuntimeConfig(paths, content, mode = 0o600) {
    const temporaryPath = `${paths.serviceRuntimeConfigPath}.installing`;
    await this.fileSystem.unlink(temporaryPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await this.fileSystem.writeFile(temporaryPath, content, { mode });
    await this.fileSystem.rename(temporaryPath, paths.serviceRuntimeConfigPath);
  }

  async snapshotServiceState(paths) {
    let plist;
    try {
      const metadataPromise = this.fileSystem.stat
        ? this.fileSystem.stat(paths.launchAgentPath).catch(() => null)
        : Promise.resolve(null);
      const [content, metadata] = await Promise.all([
        this.fileSystem.readFile(paths.launchAgentPath, "utf8"),
        metadataPromise,
      ]);
      plist = { exists: true, content, mode: metadata?.mode };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      plist = { exists: false, content: null, mode: null };
    }
    const appExists = await this.pathExists(paths.serviceManagerPath);
    let runtimeConfig = { exists: false, content: null, mode: null };
    if (appExists && paths.serviceRuntimeConfigPath) {
      try {
        const metadataPromise = this.fileSystem.stat
          ? this.fileSystem.stat(paths.serviceRuntimeConfigPath).catch(() => null)
          : Promise.resolve(null);
        const [content, metadata] = await Promise.all([
          this.fileSystem.readFile(paths.serviceRuntimeConfigPath, "utf8"),
          metadataPromise,
        ]);
        runtimeConfig = { exists: true, content, mode: metadata?.mode };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const running = await this.isServiceRunning()
      || (plist.exists && await this.isLaunchdServiceRunning(legacyServiceTarget(this.uid)));
    return {
      app: {
        exists: appExists,
        status: appExists ? await this.serviceManagerStatus(paths) : "not-found",
        runtimeConfig,
      },
      plist,
      running,
    };
  }

  async installService({ cliPath, paths, start = true }) {
    const stagingAppPath = path.join(paths.serviceDir, ".MineCodex.app.installing");
    assertOwnedServicePaths(paths);
    await this.stopService(paths, { ignoreErrors: false });
    await this.fileSystem.mkdir(paths.serviceDir, { recursive: true, mode: 0o700 });
    await this.fileSystem.mkdir(paths.logsDir, { recursive: true, mode: 0o700 });
    await this.writeServiceRuntimeConfig(
      paths,
      buildServiceRuntimeConfig({ nodePath: process.execPath, cliPath, paths }),
    );
    await this.fileSystem.rm(stagingAppPath, { recursive: true, force: true });
    try {
      await this.execFile("/usr/bin/ditto", [paths.serviceBundleSource, stagingAppPath]);
      await this.execFile("/usr/bin/codesign", ["--verify", "--deep", "--strict", stagingAppPath]);
      await this.fileSystem.rm(paths.serviceAppPath, { recursive: true, force: true });
      await this.fileSystem.rename(stagingAppPath, paths.serviceAppPath);
    } catch (error) {
      await this.fileSystem.rm(stagingAppPath, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    await this.fileSystem.unlink(paths.launchAgentPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (start) await this.startService(paths);
  }

  async stopService(paths, { ignoreErrors = false } = {}) {
    let managerError = null;
    if (paths?.serviceManagerPath && await this.pathExists(paths.serviceManagerPath)) {
      try {
        await this.execFile(paths.serviceManagerPath, ["unregister"]);
      } catch (error) {
        managerError = error;
      }
    }
    try {
      await this.execFile("/bin/launchctl", ["bootout", serviceTarget(this.uid)]);
    } catch (error) {
      if (!serviceIsAbsent(error)) throw error;
    }
    try {
      await this.execFile("/bin/launchctl", ["bootout", legacyServiceTarget(this.uid)]);
    } catch (error) {
      if (!serviceIsAbsent(error)) throw error;
    }
    if (managerError && !ignoreErrors) throw managerError;
  }

  async startService(paths) {
    const status = await this.serviceManagerStatus(paths);
    if (status === "requires-approval") {
      throw new Error(
        "MineCodex background service is disabled. Enable MineCodex in System Settings > General > Login Items & Extensions, then run `mcx install` again.",
      );
    }
    if (status !== "enabled") {
      const { stdout } = await this.execFile(paths.serviceManagerPath, ["register"]);
      const registeredStatus = appServiceStatus(stdout);
      if (registeredStatus !== "enabled") {
        throw new Error(`MineCodex background service registration requires attention: ${registeredStatus}`);
      }
    }
    await this.execFile("/bin/launchctl", ["kickstart", "-k", serviceTarget(this.uid)]);
  }

  async assertServiceStopped() {
    const [current, legacy] = await Promise.all([
      this.isServiceRunning(),
      this.isLaunchdServiceRunning(legacyServiceTarget(this.uid)),
    ]);
    if (current || legacy) throw new Error("MineCodex launchd service is still running.");
  }

  async restoreServiceState(snapshot, { cliPath, paths } = {}) {
    await this.removeService(paths);
    await this.assertServiceStopped();
    if (snapshot?.app?.exists) {
      await this.installService({ cliPath, paths, start: false });
      if (snapshot.app.runtimeConfig?.exists) {
        await this.writeServiceRuntimeConfig(
          paths,
          snapshot.app.runtimeConfig.content,
          snapshot.app.runtimeConfig.mode ? snapshot.app.runtimeConfig.mode & 0o777 : 0o600,
        );
      }
      if (snapshot.app.status === "enabled") await this.startService(paths);
      return snapshot;
    }
    if (snapshot?.plist?.exists) {
      await this.fileSystem.mkdir(path.dirname(paths.launchAgentPath), { recursive: true });
      await this.fileSystem.writeFile(paths.launchAgentPath, snapshot.plist.content, {
        mode: snapshot.plist.mode ? snapshot.plist.mode & 0o777 : 0o600,
      });
    } else {
      await this.fileSystem.unlink(paths.launchAgentPath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    if (snapshot?.running && snapshot?.plist?.exists) {
      await this.execFile("/bin/launchctl", ["bootstrap", `gui/${this.uid}`, paths.launchAgentPath]);
      await this.execFile("/bin/launchctl", ["kickstart", "-k", legacyServiceTarget(this.uid)]);
    }
    return snapshot;
  }

  async removeService(paths) {
    assertOwnedServicePaths(paths);
    await this.stopService(paths, { ignoreErrors: false });
    await this.assertServiceStopped();
    await this.fileSystem.unlink(paths.launchAgentPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (paths.serviceRuntimeConfigPath) {
      await this.fileSystem.unlink(paths.serviceRuntimeConfigPath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      await this.fileSystem.unlink(`${paths.serviceRuntimeConfigPath}.installing`).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    await this.fileSystem.rm(paths.serviceDir, { recursive: true, force: true });
  }

  async listCodexProcesses() {
    const installation = await this.codex();
    const { stdout } = await this.execFile("/bin/ps", ["-axo", "pid=,command="]);
    return parseProcessList(stdout)
      .filter(({ command }) => isExactCodexProcess(command, installation))
      .map((processInfo) => ({
        ...processInfo,
        appPath: installation.appPath,
        executable: installation.executable,
        bundleIdentifier: installation.bundleIdentifier ?? CODEX_BUNDLE_IDENTIFIER,
        signingIdentity: installation.signingIdentity ?? null,
        verified: installation.verified !== false,
      }));
  }

  async ownedCodexProcesses(paths) {
    const processes = await this.listCodexProcesses();
    let marker = null;
    try {
      marker = parseCodexOwnerMarker(await this.fileSystem.readFile(paths.codexPidPath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return processes.filter(({ pid, command, verified }) => verified === true && (
      hasManagedProfile(command, paths.profileDir)
      || (
        pid === marker?.pid
        && command === marker.command
        && hasLoopbackCdpArguments(command, extractCdpPort(command))
      )
    ));
  }

  async assertOwnedCodexStopped(paths) {
    const processes = await this.ownedCodexProcesses(paths);
    if (processes.length) {
      throw new Error(`MineCodex-owned Codex processes are still running: ${processes.map(({ pid }) => pid).join(", ")}`);
    }
  }

  async snapshotNativeCodexState() {
    const processes = (await this.listCodexProcesses()).filter(({ command }) => !command.includes("--user-data-dir="));
    return { count: processes.length, processes };
  }

  async restoreNativeCodexState(snapshot) {
    if (!snapshot?.count) return 0;
    const current = (await this.listCodexProcesses()).filter(({ command }) => !command.includes("--user-data-dir="));
    if (current.length) return current.length;
    await this.openNativeCodex();
    return snapshot.count;
  }

  async terminateOwnedCodex(paths) {
    const processInfo = (await this.ownedCodexProcesses(paths))[0];
    if (!processInfo) {
      await this.assertOwnedCodexStopped(paths);
      return false;
    }
    this.processApi.kill(processInfo.pid, "SIGTERM");
    await waitForProcessExit(processInfo.pid, { processApi: this.processApi, sleep: this.sleep });
    await this.fileSystem.unlink(paths.codexPidPath).catch(() => {});
    await this.assertOwnedCodexStopped(paths);
    return true;
  }

  async terminateNativeCodex(pid, expectedCommand = null) {
    if (!Number.isInteger(pid) || pid <= 1) {
      throw new Error("MineCodex requires an exact ChatGPT PID to terminate.");
    }
    const processInfo = (await this.listCodexProcesses()).find((candidate) => (
      candidate.pid === pid
      && candidate.verified === true
      && !candidate.command.includes("--user-data-dir=")
      && (!expectedCommand || candidate.command === expectedCommand)
    ));
    if (!processInfo) return 0;
    const { stdout: processTree } = await this.execFile("/bin/ps", ["-axo", "pid=,ppid=,command="]);
    const ownedProcessTree = [pid, ...descendantPids(processTree, pid)];
    this.processApi.kill(pid, "SIGTERM");
    await waitForProcessesExit(ownedProcessTree, { processApi: this.processApi, sleep: this.sleep });
    return 1;
  }

  async assertNativeCodexCdp(processInfo, cdpPort) {
    if (!processInfo?.verified || !Number.isInteger(processInfo.pid) || !hasLoopbackCdpArguments(processInfo.command, cdpPort)) {
      throw new Error("MineCodex could not bind the loopback CDP endpoint to a verified ChatGPT process.");
    }
    const { stdout } = await this.execFile("/usr/sbin/lsof", [
      "-nP", "-a", "-p", String(processInfo.pid), `-iTCP:${cdpPort}`, "-sTCP:LISTEN", "-Fn",
    ]);
    const fields = String(stdout).split("\n");
    if (!fields.includes(`p${processInfo.pid}`) || !fields.includes(`n127.0.0.1:${cdpPort}`)) {
      throw new Error(`ChatGPT pid ${processInfo.pid} does not own loopback CDP port ${cdpPort}.`);
    }
    return true;
  }

  async openBrowser(url) {
    await this.execFile("/usr/bin/open", [url]);
  }

  async openNativeCodex({ cdpPort } = {}) {
    const installation = await this.codex();
    if (!Number.isInteger(cdpPort) || cdpPort <= 0 || cdpPort > 65_535) {
      await this.execFile("/usr/bin/open", ["-a", installation.appPath]);
      return null;
    }
    const existingPids = new Set((await this.listCodexProcesses()).map(({ pid }) => pid));
    await this.execFile("/usr/bin/open", [
      "-n",
      "-a",
      installation.appPath,
      "--args",
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${cdpPort}`,
      `--remote-allow-origins=http://127.0.0.1:${cdpPort}`,
    ]);
    return this.waitForNativeCodex({ cdpPort, excludedPids: existingPids });
  }

  async waitForNativeCodex({ cdpPort, excludedPids = new Set(), timeoutMs = 15_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const candidates = (await this.listCodexProcesses()).filter(({ pid, command, verified }) => (
        verified === true
        && !excludedPids.has(pid)
        && !command.includes("--user-data-dir=")
        && hasLoopbackCdpArguments(command, cdpPort)
      ));
      if (candidates.length > 1) {
        throw new Error(`LaunchServices exposed multiple new ChatGPT processes on CDP port ${cdpPort}.`);
      }
      const processInfo = candidates[0];
      if (processInfo) {
        await this.assertNativeCodexCdp(processInfo, cdpPort);
        return processInfo;
      }
      await this.sleep?.(50);
    }
    throw new Error(`LaunchServices did not expose a loopback CDP ChatGPT process on port ${cdpPort}.`);
  }
}
