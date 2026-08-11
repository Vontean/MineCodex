import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);
const defaultFileSystem = Object.freeze({ mkdir, readFile, stat, unlink, writeFile });

export const SERVICE_LABEL = "com.vontean.minecodex";
export const CODEX_APP_PATH = "/Applications/ChatGPT.app";
export const CODEX_EXECUTABLE = `${CODEX_APP_PATH}/Contents/MacOS/ChatGPT`;
export const MIN_NODE_VERSION = Object.freeze({ major: 22, minor: 5, patch: 0 });

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildLaunchAgent({ nodePath, cliPath, paths }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>${xml(cliPath)}</string>
    <string>serve</string>
    <string>--service</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>${xml(paths.serviceLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(paths.serviceErrorLogPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xml(path.dirname(nodePath))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
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

function serviceTarget(uid) {
  return `gui/${uid}/${SERVICE_LABEL}`;
}

export class MacPlatformAdapter {
  constructor({
    uid = process.getuid?.() ?? os.userInfo().uid,
    platform = process.platform,
    homeDir = os.homedir(),
    execFile = defaultExecFile,
    fileSystem = defaultFileSystem,
    processApi = process,
    sleep,
    codexInstallation,
  } = {}) {
    this.uid = uid;
    this.platform = platform;
    this.homeDir = homeDir;
    this.execFile = execFile;
    this.fileSystem = fileSystem;
    this.processApi = processApi;
    this.sleep = sleep;
    this.codexInstallation = codexInstallation;
  }

  assertInstallSupported() {
    if (this.platform !== "darwin") {
      throw new Error("MineCodex v1 installation currently supports macOS only.");
    }
  }

  async assertCodexInstalled() {
    this.codexInstallation = await resolveCodexInstallation({
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
    return this.codexInstallation;
  }

  async codex() {
    return this.codexInstallation ?? this.assertCodexInstalled();
  }

  async isServiceRunning() {
    try {
      await this.execFile("/bin/launchctl", ["print", serviceTarget(this.uid)]);
      return true;
    } catch (error) {
      if (serviceIsAbsent(error)) return false;
      throw error;
    }
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
    return { plist, running: await this.isServiceRunning() };
  }

  async installService({ cliPath, paths, start = true }) {
    await this.fileSystem.mkdir(path.dirname(paths.launchAgentPath), { recursive: true });
    await this.fileSystem.mkdir(paths.logsDir, { recursive: true, mode: 0o700 });
    const plist = buildLaunchAgent({ nodePath: process.execPath, cliPath, paths });
    await this.fileSystem.writeFile(paths.launchAgentPath, plist, { mode: 0o600 });
    await this.stopService({ ignoreErrors: true });
    await this.execFile("/bin/launchctl", ["bootstrap", `gui/${this.uid}`, paths.launchAgentPath]);
    if (start) {
      await this.execFile("/bin/launchctl", ["kickstart", "-k", serviceTarget(this.uid)]);
    } else {
      await this.stopService({ ignoreErrors: true });
    }
  }

  async stopService({ ignoreErrors = false } = {}) {
    try {
      await this.execFile("/bin/launchctl", ["bootout", serviceTarget(this.uid)]);
    } catch (error) {
      if (!ignoreErrors || !serviceIsAbsent(error)) throw error;
    }
  }

  async assertServiceStopped() {
    if (await this.isServiceRunning()) throw new Error("MineCodex launchd service is still running.");
  }

  async restoreServiceState(snapshot, { cliPath, paths } = {}) {
    await this.stopService({ ignoreErrors: true });
    await this.assertServiceStopped();
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
    if (snapshot?.running) {
      if (!snapshot?.plist?.exists) throw new Error("Cannot restore a running service without its plist.");
      await this.execFile("/bin/launchctl", ["bootstrap", `gui/${this.uid}`, paths.launchAgentPath]);
      await this.execFile("/bin/launchctl", ["kickstart", "-k", serviceTarget(this.uid)]);
    }
    return snapshot;
  }

  async removeService(paths) {
    await this.stopService({ ignoreErrors: true });
    await this.assertServiceStopped();
    await this.fileSystem.unlink(paths.launchAgentPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async listCodexProcesses() {
    const installation = await this.codex();
    const { stdout } = await this.execFile("/bin/ps", ["-axo", "pid=,command="]);
    return parseProcessList(stdout).filter(({ command }) => isExactCodexProcess(command, installation));
  }

  async ownedCodexProcesses(paths) {
    const processes = await this.listCodexProcesses();
    return processes.filter(({ command }) => hasManagedProfile(command, paths.profileDir));
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
    let pid;
    try {
      pid = Number((await this.fileSystem.readFile(paths.codexPidPath, "utf8")).trim());
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.assertOwnedCodexStopped(paths);
        return false;
      }
      throw error;
    }
    if (!Number.isInteger(pid) || pid <= 1) {
      await this.assertOwnedCodexStopped(paths);
      return false;
    }
    const processInfo = (await this.ownedCodexProcesses(paths)).find((candidate) => candidate.pid === pid);
    if (!processInfo) {
      await this.assertOwnedCodexStopped(paths);
      return false;
    }
    this.processApi.kill(pid, "SIGTERM");
    await waitForProcessExit(pid, { processApi: this.processApi, sleep: this.sleep });
    await this.fileSystem.unlink(paths.codexPidPath).catch(() => {});
    await this.assertOwnedCodexStopped(paths);
    return true;
  }

  async terminateNativeCodex() {
    const processes = (await this.listCodexProcesses()).filter(({ command }) => !command.includes("--user-data-dir="));
    for (const { pid } of processes) this.processApi.kill(pid, "SIGTERM");
    await Promise.all(processes.map(({ pid }) => waitForProcessExit(pid, { processApi: this.processApi, sleep: this.sleep })));
    return processes.length;
  }

  async openBrowser(url) {
    await this.execFile("/usr/bin/open", [url]);
  }

  async openNativeCodex() {
    const installation = await this.codex();
    await this.execFile("/usr/bin/open", ["-a", installation.appPath]);
  }
}
