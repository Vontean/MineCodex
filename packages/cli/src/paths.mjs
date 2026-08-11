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
  const serviceDir = path.join(supportDir, "service");
  const serviceAppPath = path.join(serviceDir, "MineCodex.app");
  return Object.freeze({
    homeDir,
    packageRoot: PACKAGE_ROOT,
    featuresRoot: path.join(PACKAGE_ROOT, "features"),
    dashboardDir: path.join(PACKAGE_ROOT, "apps", "dashboard"),
    runtimeEntry: path.join(PACKAGE_ROOT, "packages", "runtime-host", "src", "main.mjs"),
    supportDir,
    logsDir,
    serviceDir,
    serviceBundleSource: path.join(PACKAGE_ROOT, "packages", "cli", "native", "MineCodex.app"),
    serviceAppPath,
    serviceManagerPath: path.join(serviceAppPath, "Contents", "MacOS", "MineCodexServiceManager"),
    serviceRuntimeConfigPath: path.join(supportDir, "service-runtime.plist"),
    configPath: path.join(supportDir, "config.json"),
    tokenPath: path.join(supportDir, "control-token"),
    pidPath: path.join(supportDir, "service.pid"),
    codexPidPath: path.join(supportDir, "codex.pid"),
    runtimeReadyPath: path.join(supportDir, "runtime-ready.json"),
    profileDir: path.join(supportDir, "codex-profile"),
    // v0.1.0 used a directly installed plist. Keep the path only for migration and cleanup.
    launchAgentPath: path.join(homeDir, "Library", "LaunchAgents", "com.vontean.minecodex.plist"),
    serviceLogPath: path.join(logsDir, "runtime.log"),
    serviceErrorLogPath: path.join(logsDir, "runtime-error.log"),
    notesDataDir: path.join(homeDir, "Library", "Application Support", "CodexNotes"),
    imagesDataDir: path.join(homeDir, ".codex-image-host"),
  });
}
