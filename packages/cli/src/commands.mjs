import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { assertNodeSupported, MacPlatformAdapter } from "./platform.mjs";
import { ensureConfig, ensureControlToken, readConfig } from "./config.mjs";
import { createControlServer } from "./control-server.mjs";
import { createNpmAdapter } from "./npm-adapter.mjs";
import { resolvePaths } from "./paths.mjs";
import { RuntimeManager, writeServicePid } from "./runtime-manager.mjs";

const packageMetadata = JSON.parse(await readFile(new URL("../../../package.json", import.meta.url), "utf8"));
const DEFAULT_CONTROL_PORT = 47830;

function controlOrigin(port = Number(process.env.MINECODEX_CONTROL_PORT ?? DEFAULT_CONTROL_PORT)) {
  return `http://127.0.0.1:${port}`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForService(port, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`${controlOrigin(port)}/healthz`, { signal: AbortSignal.timeout(750) });
      if (response.ok) {
        const identity = await response.json().catch(() => null);
        if (identity?.service === "minecodex" && identity?.ok === true) return true;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function waitForManagedReady(paths, { fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await authorizedFetch(paths, "/api/status", {}, { fetchImpl });
      if (response.ok) {
        const status = await response.json();
        if (status.runtime?.running && !status.pendingRestart) return status;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function authorizedFetch(paths, pathname, options = {}, { fetchImpl = fetch } = {}) {
  const token = await ensureControlToken(paths.tokenPath);
  const origin = controlOrigin();
  return fetchImpl(`${origin}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

function printHelp(output = console.log) {
  output(`MineCodex ${packageMetadata.version}

Usage: mcx <command>

Commands:
  mcx install              Install or repair MineCodex on macOS
  mcx uninstall [--purge]  Remove integration; preserve data unless --purge is used
  mcx update               Update to the latest stable npm release
  mcx open                 Open the MineCodex plugin control panel
  mcx status [--json]      Show installation and plugin status
  mcx restart              Restart Codex and apply saved plugin switches
  mcx --version             Print the installed version
  mcx --help                Show this help`);
}

function serviceSnapshot(platform, paths) {
  return platform.snapshotServiceState?.(paths) ?? null;
}

async function restoreService(platform, snapshot, { cliPath, paths }) {
  if (!snapshot || !platform.restoreServiceState) return null;
  return platform.restoreServiceState(snapshot, { cliPath, paths });
}

async function nativeSnapshot(platform) {
  if (platform.snapshotNativeCodexState) return platform.snapshotNativeCodexState();
  return { count: 0 };
}

async function restoreNative(platform, snapshot) {
  if (!snapshot?.count) return;
  if (platform.restoreNativeCodexState) {
    await platform.restoreNativeCodexState(snapshot);
    return;
  }
  await platform.openNativeCodex?.();
}

function appendRollbackError(error, rollbackError) {
  if (!rollbackError) return error;
  return new Error(`${error.message} Automatic rollback also failed: ${rollbackError.message}`, { cause: error });
}

async function installCommand({ paths, platform, cliPath, output, serviceProbe, fetchImpl, nodeVersion = process.versions.node }) {
  assertNodeSupported(nodeVersion);
  platform.assertInstallSupported();
  await platform.assertCodexInstalled();
  const previousService = await serviceSnapshot(platform, paths);
  const previousNative = await nativeSnapshot(platform);
  await ensureConfig(paths.configPath);
  await ensureControlToken(paths.tokenPath);
  let nativeCount = 0;
  try {
    nativeCount = await platform.terminateNativeCodex();
    if (nativeCount) output(`Restarting ${nativeCount} running Codex instance${nativeCount === 1 ? "" : "s"} with MineCodex enabled…`);
    await platform.installService({ cliPath, paths, start: true });
    const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
    const waitForManagedReadyImpl = serviceProbe?.waitForManagedReady ?? waitForManagedReady;
    if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))
      || !(await waitForManagedReadyImpl(paths, { fetchImpl }))) {
      throw new Error(`MineCodex service did not become ready. Check ${paths.serviceErrorLogPath}`);
    }
  } catch (error) {
    let rollbackError = null;
    try {
      await restoreService(platform, previousService, { cliPath, paths });
    } catch (failure) {
      rollbackError = failure;
    }
    try {
      await restoreNative(platform, previousNative?.count ? previousNative : { count: nativeCount });
    } catch (failure) {
      rollbackError = rollbackError ?? failure;
    }
    throw appendRollbackError(error, rollbackError);
  }
  output("MineCodex installed. Model Slider, Notes, and Images are enabled by default.");
  output("Run `mcx open` to manage plugins.");
}

async function openCommand({ paths, platform, serviceProbe, fetchImpl }) {
  const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
  if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl, timeoutMs: 750 }))) {
    if (!(await exists(paths.launchAgentPath))) throw new Error("MineCodex is not installed. Run `mcx install` first.");
    await platform.startService();
    if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))) throw new Error("MineCodex service could not be started.");
  }
  const exchangeResponse = await authorizedFetch(paths, "/api/auth/exchange", {
    method: "POST",
    body: "{}",
  }, { fetchImpl });
  if (!exchangeResponse.ok) throw new Error(`MineCodex browser exchange failed: HTTP ${exchangeResponse.status}`);
  const { exchange } = await exchangeResponse.json();
  if (!exchange) throw new Error("MineCodex browser exchange did not return a short-lived value.");
  await platform.openBrowser(`${controlOrigin()}/auth?exchange=${encodeURIComponent(exchange)}`);
}

function featureStatusText(feature) {
  const state = feature.state ?? (!feature.enabled ? "stopped" : feature.healthy ? "healthy" : feature.applied ? "launching" : "restart-required");
  const failure = feature.failure?.message ? `: ${feature.failure.message}` : "";
  const copy = {
    saved: "saved; restart required",
    configured: "configured; launching",
    launching: "launching",
    injected: "injected into Codex",
    healthy: "healthy in Codex",
    failed: "failed; run `mcx restart`",
    stopped: "stopped",
    "restart-required": "saved; run `mcx restart`",
  };
  return `${copy[state] ?? state}${failure}`;
}

async function statusCommand({ paths, jsonOutput, output, fetchImpl }) {
  let status;
  try {
    const response = await authorizedFetch(paths, "/api/status", {}, { fetchImpl });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    status = { installed: await exists(paths.launchAgentPath), service: { running: true }, ...await response.json() };
  } catch {
    const config = await readConfig(paths.configPath).catch(() => null);
    status = {
      installed: await exists(paths.launchAgentPath),
      version: packageMetadata.version,
      service: { running: false },
      runtime: { running: false },
      pendingRestart: false,
      features: Object.entries(config?.features ?? {}).map(([id, enabled]) => ({
        id,
        enabled,
        applied: false,
        injected: false,
        healthy: false,
        state: "stopped",
        failure: null,
      })),
    };
  }
  if (jsonOutput) {
    output(JSON.stringify(status, null, 2));
    return status;
  }
  output(`MineCodex ${status.version}`);
  output(`Installed: ${status.installed ? "yes" : "no"}`);
  output(`Service: ${status.service.running ? "running" : "stopped"}`);
  output(`RuntimeHost: ${status.runtime?.running ? "running" : "stopped"}`);
  for (const feature of status.features ?? []) output(`- ${feature.id}: ${featureStatusText(feature)}`);
  if (status.pendingRestart) output("Saved plugin changes require `mcx restart`; the current Codex session is unchanged.");
  return status;
}

async function restartCommand({ paths, output, fetchImpl }) {
  const response = await authorizedFetch(paths, "/api/restart", { method: "POST", body: "{}" }, { fetchImpl });
  if (!response.ok) throw new Error(`MineCodex restart failed: HTTP ${response.status}`);
  output("MineCodex restarted and saved plugin switches are now applied.");
}

async function uninstallCommand({ paths, platform, purge, output, cliPath }) {
  platform.assertInstallSupported();
  const previousService = await serviceSnapshot(platform, paths);
  let wasManaged = false;
  try {
    await platform.removeService(paths);
    wasManaged = await platform.terminateOwnedCodex(paths);
    await platform.assertServiceStopped?.();
    await platform.assertOwnedCodexStopped?.(paths);
    if (purge) {
      const targets = [paths.supportDir, paths.notesDataDir, paths.imagesDataDir];
      for (const target of targets) {
        if (!path.isAbsolute(target) || target === paths.homeDir || target.length <= paths.homeDir.length + 2) {
          throw new Error(`Refusing unsafe purge target: ${target}`);
        }
      }
      for (const target of targets) await rm(target, { recursive: true, force: true });
      output("MineCodex integration and MineCodex-owned data were removed.");
    } else {
      output("MineCodex integration was removed. Plugin data was preserved.");
    }
  } catch (error) {
    let rollbackError = null;
    try {
      await restoreService(platform, previousService, { cliPath, paths });
    } catch (failure) {
      rollbackError = failure;
    }
    throw appendRollbackError(error, rollbackError);
  }
  if (wasManaged) await platform.openNativeCodex();
  output("Codex generated images and files referenced by Notes were not modified.");
}

async function updateCommand({ paths, platform, cliPath, output, npm = createNpmAdapter(), serviceProbe, fetchImpl }) {
  platform.assertInstallSupported();
  const latest = await npm.viewLatestVersion();
  if (!latest) throw new Error("Could not resolve the latest MineCodex version.");
  if (latest === packageMetadata.version) {
    output(`MineCodex ${packageMetadata.version} is already up to date.`);
    return;
  }
  const wasInstalled = await exists(paths.launchAgentPath);
  const previousService = wasInstalled
    ? (await serviceSnapshot(platform, paths) ?? { running: true, plist: { exists: true } })
    : null;
  const rollback = await npm.createRollbackArchive(paths.packageRoot);
  const rollbackPath = typeof rollback === "string" ? rollback : rollback.archivePath;
  if (!rollbackPath) throw new Error("Could not create a rollback archive for the installed MineCodex version.");
  try {
    if (wasInstalled && previousService?.running) {
      await platform.stopService({ ignoreErrors: false });
      await platform.assertServiceStopped?.();
    }
    await npm.installGlobal("minecodex@latest");
    if (wasInstalled) {
      await platform.installService({ cliPath, paths, start: previousService.running });
      if (previousService.running) {
        const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
        const waitForManagedReadyImpl = serviceProbe?.waitForManagedReady ?? waitForManagedReady;
        if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))
          || !(await waitForManagedReadyImpl(paths, { fetchImpl }))) {
          throw new Error("MineCodex service did not become ready after update.");
        }
      } else {
        await platform.assertServiceStopped?.();
      }
    }
    output(`MineCodex updated from ${packageMetadata.version} to ${latest}.`);
  } catch (error) {
    let rollbackError = null;
    try {
      await npm.installGlobal(rollbackPath);
      await restoreService(platform, previousService, { cliPath, paths });
      if (wasInstalled && previousService?.running) {
        const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
        const waitForManagedReadyImpl = serviceProbe?.waitForManagedReady ?? waitForManagedReady;
        if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))
          || !(await waitForManagedReadyImpl(paths, { fetchImpl }))) {
          throw new Error("Rolled-back MineCodex service did not become ready.");
        }
      } else if (wasInstalled && !previousService?.running) {
        await platform.assertServiceStopped?.();
      }
    } catch (failure) {
      rollbackError = failure;
    }
    const restored = rollbackError ? "" : " The previous MineCodex version was restored.";
    throw appendRollbackError(new Error(
      `MineCodex update failed; settings and data were preserved. ${error.message}${restored}`,
      { cause: error },
    ), rollbackError);
  } finally {
    if (npm.cleanup) await npm.cleanup(rollback).catch(() => {});
  }
}

async function serveCommand({ paths, platform, logger }) {
  await ensureConfig(paths.configPath);
  const token = await ensureControlToken(paths.tokenPath);
  const runtimeManager = new RuntimeManager({ paths, platform, logger });
  let control;
  let removePid = async () => {};
  try {
    control = await createControlServer({
      paths,
      token,
      runtimeManager,
      port: Number(process.env.MINECODEX_CONTROL_PORT ?? DEFAULT_CONTROL_PORT),
      logger,
    });
    removePid = await writeServicePid(paths.pidPath);
    await runtimeManager.start();
  } catch (error) {
    await runtimeManager.stop().catch(() => {});
    await control?.close().catch(() => {});
    await removePid();
    throw error;
  }
  logger.log(`MineCodex control panel: ${control.url}`);
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await control.close().catch(() => {});
    await runtimeManager.stop();
    await removePid();
  };
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      await shutdown();
      process.exit(0);
    });
  }
  return new Promise(() => {});
}

export async function runCli(argv, {
  paths = resolvePaths(),
  platform = new MacPlatformAdapter(),
  cliPath = process.argv[1],
  output = console.log,
  logger = console,
  npm = createNpmAdapter(),
  serviceProbe,
  fetchImpl = fetch,
  nodeVersion = process.versions.node,
} = {}) {
  const [command = "--help", ...args] = argv;
  if (["--help", "-h", "help"].includes(command)) return printHelp(output);
  if (["--version", "-v"].includes(command)) return output(packageMetadata.version);
  if (command === "install") return installCommand({ paths, platform, cliPath, output, serviceProbe, fetchImpl, nodeVersion });
  if (command === "open" || command === "gui") return openCommand({ paths, platform, serviceProbe, fetchImpl });
  if (command === "status") return statusCommand({ paths, jsonOutput: args.includes("--json"), output, fetchImpl });
  if (command === "restart") return restartCommand({ paths, output, fetchImpl });
  if (command === "uninstall" || command === "remove") {
    return uninstallCommand({ paths, platform, purge: args.includes("--purge"), output, cliPath });
  }
  if (command === "update") return updateCommand({ paths, platform, cliPath, output, npm, serviceProbe, fetchImpl });
  if (command === "serve") return serveCommand({ paths, platform, logger });
  throw new Error(`Unknown MineCodex command: ${command}. Run \`mcx --help\`.`);
}
