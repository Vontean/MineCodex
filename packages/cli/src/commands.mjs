import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { assertNodeSupported, createPlatformAdapter } from "./platform.mjs";
import { ensureConfig, ensureControlToken, readConfig } from "./config.mjs";
import { createControlServer } from "./control-server.mjs";
import { createProgressReporter } from "./progress.mjs";
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

async function serviceInstalled(platform, paths) {
  if (platform.isServiceInstalled) return platform.isServiceInstalled(paths);
  return (paths.serviceManagerPath ? exists(paths.serviceManagerPath) : false)
    || (paths.launchAgentPath ? exists(paths.launchAgentPath) : false);
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
  mcx install              Install or repair MineCodex on macOS or Windows
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

function appendRollbackError(error, rollbackError) {
  if (!rollbackError) return error;
  return new Error(`${error.message} Automatic rollback also failed: ${rollbackError.message}`, { cause: error });
}

export async function confirmRestartNow({ input = process.stdin, terminalOutput = process.stdout } = {}) {
  if (!input.isTTY || !terminalOutput.isTTY) return false;
  const prompt = createInterface({ input, output: terminalOutput });
  try {
    const answer = await prompt.question("Restart Codex now? [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } catch {
    return false;
  } finally {
    prompt.close();
  }
}

async function installCommand({ paths, platform, cliPath, output, serviceProbe, fetchImpl, confirmRestart, nodeVersion = process.versions.node }) {
  const reporter = createProgressReporter({ output });
  reporter.heading("Installing MineCodex");
  let previousService = null;
  try {
    await reporter.step(1, 6, "Checking your system", async () => {
      assertNodeSupported(nodeVersion);
      platform.assertInstallSupported();
      await platform.assertCodexInstalled();
    });
    await reporter.step(2, 6, "Preparing your settings", async () => {
      await ensureConfig(paths.configPath);
      await ensureControlToken(paths.tokenPath);
    });
    previousService = await reporter.step(3, 6, "Checking your current setup", async () => {
      return serviceSnapshot(platform, paths);
    });
    await reporter.step(4, 6, "Installing the background helper", async () => {
      await platform.installService({ cliPath, paths, start: true });
    });
    await reporter.step(5, 6, "Waiting for the background helper (up to 20 seconds)", async () => {
      const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
      if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))) {
        throw new Error("MineCodex service did not become ready. Check " + paths.serviceErrorLogPath);
      }
    });
    await reporter.step(6, 6, "Waiting for MineCodex to be ready (up to 30 seconds)", async () => {
      const waitForManagedReadyImpl = serviceProbe?.waitForManagedReady ?? waitForManagedReady;
      if (!(await waitForManagedReadyImpl(paths, { fetchImpl }))) {
        throw new Error("MineCodex service did not become ready. Check " + paths.serviceErrorLogPath);
      }
    });
  } catch (error) {
    let rollbackError = null;
    try {
      await restoreService(platform, previousService, { cliPath, paths });
    } catch (failure) {
      rollbackError = failure;
    }
    throw appendRollbackError(error, rollbackError);
  }
  reporter.heading("MineCodex installed. It will be enabled the next time Codex restarts.");
  if (await confirmRestart()) {
    await restartCommand({ paths, output, fetchImpl });
  } else {
    reporter.heading("Run `mcx restart` when you are ready.");
}
}

async function openCommand({ paths, platform, output, serviceProbe, fetchImpl }) {
  const waitForServiceImpl = serviceProbe?.waitForService ?? waitForService;
  let reporter = null;
  if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl, timeoutMs: 750 }))) {
    if (!(await serviceInstalled(platform, paths))) throw new Error("MineCodex is not installed. Run `mcx install` first.");
    reporter = createProgressReporter({ output });
    reporter.heading("Opening MineCodex");
    await reporter.step(1, 2, "Starting the background helper", async () => {
      await platform.startService(paths);
      if (!(await waitForServiceImpl(DEFAULT_CONTROL_PORT, { fetchImpl }))) throw new Error("MineCodex service could not be started.");
    });
  }
  const openControlPanel = async () => {
    const exchangeResponse = await authorizedFetch(paths, "/api/auth/exchange", {
      method: "POST",
      body: "{}",
    }, { fetchImpl });
    if (!exchangeResponse.ok) throw new Error(`MineCodex browser exchange failed: HTTP ${exchangeResponse.status}`);
    const { exchange } = await exchangeResponse.json();
    if (!exchange) throw new Error("MineCodex browser exchange did not return a short-lived value.");
    const url = `${controlOrigin()}/auth?exchange=${encodeURIComponent(exchange)}`;
    if (platform.openControlPanel) await platform.openControlPanel(url, controlOrigin());
    else await platform.openBrowser(url);
  };
  if (reporter) await reporter.step(2, 2, "Opening the control panel", openControlPanel);
  else await openControlPanel();
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

async function statusCommand({ paths, platform, jsonOutput, output, fetchImpl }) {
  let status;
  try {
    const response = await authorizedFetch(paths, "/api/status", {}, { fetchImpl });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    status = { installed: await serviceInstalled(platform, paths), service: { running: true }, ...await response.json() };
  } catch {
    const config = await readConfig(paths.configPath).catch(() => null);
    status = {
      installed: await serviceInstalled(platform, paths),
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
  const reporter = createProgressReporter({ output });
  reporter.heading("Restarting MineCodex");
  await reporter.step(1, 1, "Restarting Codex and applying plugin changes", async () => {
    const response = await authorizedFetch(paths, "/api/restart", { method: "POST", body: "{}" }, { fetchImpl });
    if (!response.ok) throw new Error(`MineCodex restart failed: HTTP ${response.status}`);
  });
  reporter.heading("MineCodex restarted and saved plugin switches are now applied.");
}

async function uninstallCommand({ paths, platform, purge, output, cliPath }) {
  const reporter = createProgressReporter({ output });
  reporter.heading("Uninstalling MineCodex");
  const previousService = await reporter.step(1, 2, "Checking the current installation", async () => {
    platform.assertInstallSupported();
    return serviceSnapshot(platform, paths);
  });
  let wasManaged = false;
  try {
    await reporter.step(2, 2, purge ? "Removing MineCodex and its data" : "Removing the MineCodex integration", async () => {
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
      }
    });
  } catch (error) {
    let rollbackError = null;
    reporter.heading("Uninstall failed. Restoring the background helper.");
    try {
      await reporter.step(1, 1, "Restoring the background helper", async () => {
        await restoreService(platform, previousService, { cliPath, paths });
      });
    } catch (failure) {
      rollbackError = failure;
    }
    throw appendRollbackError(error, rollbackError);
  }
  reporter.heading(purge
    ? "MineCodex integration and MineCodex-owned data were removed."
    : "MineCodex integration was removed. Plugin data was preserved.");
  if (wasManaged) {
    await reporter.step(1, 1, "Reopening Codex", async () => platform.openNativeCodex());
  }
  reporter.heading("Codex generated images and files referenced by Notes were not modified.");
}

async function updateCommand({ paths, platform, cliPath, output, npm = createNpmAdapter(), serviceProbe, fetchImpl }) {
  const reporter = createProgressReporter({ output });
  reporter.heading("Updating MineCodex");
  const latest = await reporter.step(1, 5, "Checking for updates", async () => {
    platform.assertInstallSupported();
    const version = await npm.viewLatestVersion();
    if (!version) throw new Error("Could not resolve the latest MineCodex version.");
    return version;
  });
  if (latest === packageMetadata.version) {
    reporter.heading(`MineCodex ${packageMetadata.version} is already up to date.`);
    return;
  }
  let wasInstalled;
  let previousService;
  const rollback = await reporter.step(2, 5, "Backing up the current version", async () => {
    wasInstalled = await serviceInstalled(platform, paths);
    previousService = wasInstalled
      ? (await serviceSnapshot(platform, paths) ?? { running: true, plist: { exists: true } })
      : null;
    return npm.createRollbackArchive(paths.packageRoot);
  });
  const rollbackPath = typeof rollback === "string" ? rollback : rollback.archivePath;
  if (!rollbackPath) throw new Error("Could not create a rollback archive for the installed MineCodex version.");
  try {
    await reporter.step(3, 5, "Pausing the background helper", async () => {
      if (wasInstalled && previousService?.running) {
        await platform.stopService(paths, { ignoreErrors: false });
        await platform.assertServiceStopped?.();
      }
    });
    await reporter.step(4, 5, `Installing MineCodex ${latest}`, async () => {
      await npm.installGlobal("minecodex@latest");
    });
    await reporter.step(5, 5, "Restoring the background helper", async () => {
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
    });
    reporter.heading(`MineCodex updated from ${packageMetadata.version} to ${latest}.`);
  } catch (error) {
    let rollbackError = null;
    reporter.heading("Update failed. Restoring the previous version.");
    try {
      await reporter.step(1, 2, "Restoring the previous version", async () => {
        await npm.installGlobal(rollbackPath);
      });
      await reporter.step(2, 2, "Restoring the background helper", async () => {
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
      });
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
  platform = createPlatformAdapter(),
  cliPath = process.argv[1],
  output = console.log,
  logger = console,
  npm = createNpmAdapter(),
  serviceProbe,
  fetchImpl = fetch,
  confirmRestart = confirmRestartNow,
  nodeVersion = process.versions.node,
} = {}) {
  const [command = "--help", ...args] = argv;
  if (["--help", "-h", "help"].includes(command)) return printHelp(output);
  if (["--version", "-v"].includes(command)) return output(packageMetadata.version);
  if (command === "install") return installCommand({ paths, platform, cliPath, output, serviceProbe, fetchImpl, confirmRestart, nodeVersion });
  if (command === "open" || command === "gui") return openCommand({ paths, platform, output, serviceProbe, fetchImpl });
  if (command === "status") return statusCommand({ paths, platform, jsonOutput: args.includes("--json"), output, fetchImpl });
  if (command === "restart") return restartCommand({ paths, output, fetchImpl });
  if (command === "uninstall" || command === "remove") {
    return uninstallCommand({ paths, platform, purge: args.includes("--purge"), output, cliPath });
  }
  if (command === "update") return updateCommand({ paths, platform, cliPath, output, npm, serviceProbe, fetchImpl });
  if (command === "serve") return serveCommand({ paths, platform, logger });
  throw new Error(`Unknown MineCodex command: ${command}. Run \`mcx --help\`.`);
}
