import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export function resolvePaths({ homeDir = os.homedir() } = {}) {
  const supportDir = path.join(homeDir, "Library", "Application Support", "MineCodex");
  const logsDir = path.join(homeDir, "Library", "Logs", "MineCodex");
  return Object.freeze({
    homeDir,
    packageRoot: PACKAGE_ROOT,
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
    runtimeEntry: path.join(PACKAGE_ROOT, "packages", "runtime-host", "src", "main.mjs"),
    supportDir,
    logsDir,
    configPath: path.join(supportDir, "config.json"),
    tokenPath: path.join(supportDir, "control-token"),
    pidPath: path.join(supportDir, "service.pid"),
    codexPidPath: path.join(supportDir, "codex.pid"),
    runtimeReadyPath: path.join(supportDir, "runtime-ready.json"),
    profileDir: path.join(supportDir, "codex-profile"),
    launchAgentPath: path.join(homeDir, "Library", "LaunchAgents", "com.vontean.minecodex.plist"),
    serviceLogPath: path.join(logsDir, "runtime.log"),
    serviceErrorLogPath: path.join(logsDir, "runtime-error.log"),
    notesDataDir: path.join(homeDir, "Library", "Application Support", "CodexNotes"),
    imagesDataDir: path.join(homeDir, ".codex-image-host"),
  });
}
