import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const SERVICE_LABEL = "com.vontean.minecodex";
export const CODEX_APP_PATH = "/Applications/ChatGPT.app";
export const CODEX_EXECUTABLE = `${CODEX_APP_PATH}/Contents/MacOS/ChatGPT`;

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

function parseProcessList(output) {
  return output.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    return match ? [{ pid: Number(match[1]), command: match[2] }] : [];
  });
}

function serviceIsAbsent(error) {
  return /could not find service|service not found|no such process|domain does not support specified action/i.test(
    `${error.stderr ?? ""}\n${error.message ?? ""}`,
  );
}

async function waitForProcessExit(pid, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Process ${pid} did not exit in time`);
}

export class MacPlatformAdapter {
  constructor({ uid = process.getuid?.() ?? os.userInfo().uid, platform = process.platform } = {}) {
    this.uid = uid;
    this.platform = platform;
  }

  assertInstallSupported() {
    if (this.platform !== "darwin") {
      throw new Error("MineCodex v1 installation currently supports macOS only.");
    }
  }

  async assertCodexInstalled() {
    try {
      await readFile(`${CODEX_APP_PATH}/Contents/Info.plist`);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Codex Desktop was not found at ${CODEX_APP_PATH}`);
      }
      throw error;
    }
  }

  async installService({ cliPath, paths }) {
    await mkdir(path.dirname(paths.launchAgentPath), { recursive: true });
    await mkdir(paths.logsDir, { recursive: true, mode: 0o700 });
    const plist = buildLaunchAgent({ nodePath: process.execPath, cliPath, paths });
    await writeFile(paths.launchAgentPath, plist, { mode: 0o600 });
    await this.stopService({ ignoreErrors: true });
    await execFile("/bin/launchctl", [
      "bootstrap",
      `gui/${this.uid}`,
      paths.launchAgentPath,
    ]);
    await execFile("/bin/launchctl", ["kickstart", "-k", `gui/${this.uid}/${SERVICE_LABEL}`]);
  }

  async stopService({ ignoreErrors = false } = {}) {
    try {
      await execFile("/bin/launchctl", ["bootout", `gui/${this.uid}/${SERVICE_LABEL}`]);
    } catch (error) {
      if (!ignoreErrors || !serviceIsAbsent(error)) throw error;
    }
  }

  async startService() {
    await execFile("/bin/launchctl", ["kickstart", "-k", `gui/${this.uid}/${SERVICE_LABEL}`]);
  }

  async removeService(paths) {
    await this.stopService({ ignoreErrors: true });
    await unlink(paths.launchAgentPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async listCodexProcesses() {
    const { stdout } = await execFile("/bin/ps", ["-axo", "pid=,command="]);
    return parseProcessList(stdout).filter(({ command }) => (
      command === CODEX_EXECUTABLE || command.startsWith(`${CODEX_EXECUTABLE} `)
    ));
  }

  async terminateOwnedCodex(paths) {
    let pid;
    try {
      pid = Number((await readFile(paths.codexPidPath, "utf8")).trim());
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    if (!Number.isInteger(pid) || pid <= 1) return false;
    const processInfo = (await this.listCodexProcesses()).find((candidate) => candidate.pid === pid);
    if (!processInfo || !processInfo.command.includes(`--user-data-dir=${paths.profileDir}`)) return false;
    process.kill(pid, "SIGTERM");
    await waitForProcessExit(pid);
    await unlink(paths.codexPidPath).catch(() => {});
    return true;
  }

  async terminateNativeCodex() {
    const processes = await this.listCodexProcesses();
    const native = processes.filter(({ command }) => !command.includes("--user-data-dir="));
    for (const { pid } of native) process.kill(pid, "SIGTERM");
    await Promise.all(native.map(({ pid }) => waitForProcessExit(pid)));
    return native.length;
  }

  async openBrowser(url) {
    await execFile("/usr/bin/open", [url]);
  }

  async openNativeCodex() {
    await execFile("/usr/bin/open", ["-a", CODEX_APP_PATH]);
  }
}
