import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { readConfig, FEATURE_IDS } from "./config.mjs";

export const RUNTIME_PLUGIN_STATES = Object.freeze([
  "configured",
  "launching",
  "ready",
  "injected",
  "failed",
  "stopped",
]);

function enabledFeatureIds(config) {
  return FEATURE_IDS.filter((id) => config.features[id]);
}

function hasExited(child) {
  return Boolean(child && (child.exitCode != null || child.signalCode != null));
}

function hasExactCommandArgument(command, argument) {
  const value = String(command);
  let offset = value.indexOf(argument);
  while (offset >= 0) {
    const before = offset === 0 || /\s/.test(value[offset - 1]);
    const end = offset + argument.length;
    const after = end === value.length || /\s/.test(value[end]);
    if (before && after) return true;
    offset = value.indexOf(argument, offset + 1);
  }
  return false;
}

function normalizedFailure(failure) {
  if (!failure || typeof failure !== "object") return failure ?? null;
  return {
    code: failure.code ?? "RUNTIME_PLUGIN_FAILED",
    message: failure.message ?? "MineCodex plugin failed.",
    phase: failure.phase ?? "runtime",
  };
}

export function normalizeRuntimeReady(ready = {}) {
  const sourcePlugins = Array.isArray(ready.plugins) ? ready.plugins : [];
  const plugins = sourcePlugins.flatMap((plugin) => {
    if (!plugin || typeof plugin.featureId !== "string") return [];
    const state = RUNTIME_PLUGIN_STATES.includes(plugin.state) ? plugin.state : "failed";
    return [{
      ...plugin,
      featureId: plugin.featureId,
      state,
      owned: plugin.owned === true,
      health: plugin.health ?? null,
      failure: normalizedFailure(plugin.failure),
    }];
  });
  const legacyFeatures = Array.isArray(ready.features)
    ? ready.features.filter((id) => typeof id === "string")
    : [];
  const features = [...new Set([
    ...legacyFeatures,
    ...plugins.filter(({ state }) => ["configured", "launching", "ready", "injected"].includes(state)).map(({ featureId }) => featureId),
  ])];
  const renderer = ready.renderer && typeof ready.renderer === "object"
    ? {
      ...ready.renderer,
      discovered: ready.renderer.discovered === true,
      injectedTargets: Number.isInteger(ready.renderer.injectedTargets) ? ready.renderer.injectedTargets : 0,
      active: ready.renderer.active === true,
      runtimeSessionId: ready.renderer.runtimeSessionId ?? null,
    }
    : null;
  return {
    ...ready,
    runtimeSessionId: ready.runtimeSessionId ?? null,
    features,
    plugins,
    failures: Array.isArray(ready.failures) ? ready.failures : [],
    renderer,
  };
}

function isReadyPayload(ready, child) {
  return ready?.pid === child.pid
    && (Array.isArray(ready.features) || Array.isArray(ready.plugins));
}

function rendererUnavailableReady(ready) {
  const normalized = normalizeRuntimeReady(ready);
  return normalizeRuntimeReady({
    ...normalized,
    plugins: normalized.plugins.map((plugin) => plugin.state === "injected"
      ? { ...plugin, state: "ready", health: null }
      : plugin),
    renderer: {
      ...(normalized.renderer ?? {}),
      discovered: false,
      injectedTargets: 0,
      active: false,
      runtimeSessionId: normalized.runtimeSessionId,
    },
  });
}

async function waitForReady(readyPath, child, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ready = JSON.parse(await readFile(readyPath, "utf8"));
      if (isReadyPayload(ready, child)) {
        child.readyPayloadSeen = true;
        return normalizeRuntimeReady(ready);
      }
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    if (hasExited(child)) {
      throw new Error(`RuntimeHost exited before becoming ready (${child.signalCode ?? child.exitCode ?? "unknown"})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("RuntimeHost did not report ready in time");
}

export class RuntimeManager {
  constructor({
    paths,
    platform,
    logger = console,
    spawnProcess = spawn,
    waitForReady: readyWaiter = waitForReady,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    stopTimeoutMs = 5_000,
    manualLaunchPollMs = 1_000,
    cdpPort = Number(process.env.CODEX_RUNTIME_CDP_PORT ?? 9231),
  }) {
    this.paths = paths;
    this.platform = platform;
    this.logger = logger;
    this.spawnProcess = spawnProcess;
    this.waitForReady = readyWaiter;
    this.sleep = sleep;
    this.stopTimeoutMs = stopTimeoutMs;
    this.manualLaunchPollMs = manualLaunchPollMs;
    this.cdpPort = cdpPort;
    this.child = null;
    this.appliedFeatures = [];
    this.plugins = [];
    this.ready = null;
    this.stopping = false;
    this.lifecycleQueue = Promise.resolve();
    this.restartInFlight = null;
    this.manualLaunchMonitorPromise = null;
    this.manualLaunchMonitorStopped = true;
    this.manualLaunchTimer = null;
    this.manualLaunchWake = null;
    this.manualLaunchBaselinePids = new Set();
    this.manualLaunchArmed = false;
  }

  enqueue(operation) {
    const next = this.lifecycleQueue.catch(() => {}).then(operation);
    this.lifecycleQueue = next.catch(() => {});
    return next;
  }

  async startInternal({ launchCodex = false } = {}) {
    if (this.child && !hasExited(this.child)) return this.status();
    this.clearChildState();
    this.stopping = false;
    const config = await readConfig(this.paths.configPath);
    const features = enabledFeatureIds(config);
    const codexInstallation = typeof this.platform?.codex === "function"
      ? await this.platform.codex()
      : null;
    const codexExecutable = codexInstallation?.executable
      ?? process.env.MINECODEX_CODEX_EXECUTABLE;
    await mkdir(this.paths.supportDir, { recursive: true, mode: 0o700 });
    await unlink(this.paths.runtimeReadyPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    const child = this.spawnProcess(process.execPath, [this.paths.runtimeEntry], {
      cwd: this.paths.packageRoot,
      env: {
        ...process.env,
        CODEX_FEATURES_ROOT: this.paths.featuresRoot,
        CODEX_RUNTIME_PROFILE_DIR: this.paths.profileDir,
        CODEX_RUNTIME_CDP_PORT: String(this.cdpPort),
        CODEX_IMAGE_HOST_DATA_DIR: this.paths.imagesDataDir,
        CODEX_NOTES_DATA_DIR: this.paths.notesDataDir,
        MINECODEX_ENABLED_FEATURES: features.join(","),
        MINECODEX_CODEX_PID_FILE: this.paths.codexPidPath,
        MINECODEX_RUNTIME_READY_FILE: this.paths.runtimeReadyPath,
        MINECODEX_LAUNCH_CODEX: launchCodex ? "1" : "0",
        ...(codexExecutable ? { MINECODEX_CODEX_EXECUTABLE: codexExecutable } : {}),
      },
      stdio: "inherit",
    });
    this.child = child;
    if (hasExited(child)) {
      this.clearChildState();
      throw new Error(`RuntimeHost exited immediately (${child.signalCode ?? child.exitCode})`);
    }
    child.once("exit", (code, signal) => {
      if (this.child === child) this.clearChildState();
      if (!this.stopping && (code !== 0 || signal !== null)) {
        this.logger.error(`MineCodex RuntimeHost exited (${signal ?? code ?? "unknown"})`);
      }
    });
    try {
      const ready = await this.waitForReady(this.paths.runtimeReadyPath, child);
      this.ready = normalizeRuntimeReady(ready);
      this.appliedFeatures = [...this.ready.features];
      this.plugins = [...this.ready.plugins];
    } catch (startupError) {
      let cleanupError = null;
      this.stopping = true;
      try {
        if (hasExited(child)) {
          this.clearChildState();
        } else {
          const exited = await this.waitForExactExit(child, "SIGTERM", this.stopTimeoutMs);
          const confirmed = exited || await this.waitForExactExit(child, "SIGKILL", this.stopTimeoutMs);
          if (confirmed) {
            this.clearChildState();
          } else {
            cleanupError = new Error(
              `RuntimeHost pid ${child.pid} did not exit after SIGKILL within ${this.stopTimeoutMs}ms`,
            );
          }
        }
      } catch (failure) {
        cleanupError = failure;
      } finally {
        this.stopping = false;
      }
      if (cleanupError) {
        throw new Error(`${startupError.message}; cleanup also failed: ${cleanupError.message}`, { cause: startupError });
      }
      throw startupError;
    }
    return this.status();
  }

  clearChildState() {
    this.child = null;
    this.ready = null;
    this.appliedFeatures = [];
    this.plugins = [];
  }

  start() {
    return this.enqueue(async () => {
      const status = await this.startInternal();
      await this.startManualLaunchMonitor();
      return status;
    });
  }

  async nativeCodexSnapshot() {
    if (typeof this.platform?.snapshotNativeCodexState !== "function") return null;
    const snapshot = await this.platform.snapshotNativeCodexState();
    const cdpArgument = `--remote-debugging-port=${this.cdpPort}`;
    const processes = (Array.isArray(snapshot?.processes) ? snapshot.processes : [])
      .filter(({ command }) => !hasExactCommandArgument(command, cdpArgument));
    return {
      count: processes.length,
      processes,
      pids: new Set(processes.flatMap(({ pid }) => Number.isInteger(pid) ? [pid] : [])),
    };
  }

  async startManualLaunchMonitor() {
    if (this.manualLaunchMonitorPromise || typeof this.platform?.snapshotNativeCodexState !== "function") return;
    const snapshot = await this.nativeCodexSnapshot();
    this.manualLaunchBaselinePids = new Set(snapshot?.pids ?? []);
    this.manualLaunchArmed = this.manualLaunchBaselinePids.size === 0;
    this.manualLaunchMonitorStopped = false;
    const monitor = this.monitorManualCodexLaunches().catch((error) => {
      if (!this.manualLaunchMonitorStopped) {
        this.logger.warn?.("MineCodex manual Codex launch monitor failed", error.message);
      }
    }).finally(() => {
      if (this.manualLaunchMonitorPromise === monitor) this.manualLaunchMonitorPromise = null;
    });
    this.manualLaunchMonitorPromise = monitor;
  }

  waitForManualLaunchPoll() {
    if (this.manualLaunchMonitorStopped) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        if (this.manualLaunchTimer) clearTimeout(this.manualLaunchTimer);
        this.manualLaunchTimer = null;
        this.manualLaunchWake = null;
        resolve();
      };
      this.manualLaunchWake = finish;
      this.manualLaunchTimer = setTimeout(finish, this.manualLaunchPollMs);
    });
  }

  async monitorManualCodexLaunches() {
    while (!this.manualLaunchMonitorStopped) {
      await this.waitForManualLaunchPoll();
      if (this.manualLaunchMonitorStopped) break;
      try {
        await this.reconcileManualCodexLaunch();
      } catch (error) {
        this.logger.warn?.("MineCodex could not adopt the Codex launch", error.message);
      }
    }
  }

  async stopManualLaunchMonitor() {
    this.manualLaunchMonitorStopped = true;
    this.manualLaunchWake?.();
    await this.manualLaunchMonitorPromise;
    this.manualLaunchMonitorPromise = null;
    this.manualLaunchBaselinePids.clear();
    this.manualLaunchArmed = false;
  }

  async reconcileManualCodexLaunch() {
    if (this.manualLaunchMonitorStopped) return false;
    const snapshot = await this.nativeCodexSnapshot();
    if (!snapshot) return false;

    if (this.manualLaunchBaselinePids.size > 0) {
      const baselineStillRunning = [...this.manualLaunchBaselinePids]
        .some((pid) => snapshot.pids.has(pid));
      if (baselineStillRunning) return false;
      this.manualLaunchBaselinePids.clear();
      if (snapshot.count === 0) {
        this.manualLaunchArmed = true;
        return false;
      }
      this.manualLaunchArmed = true;
    }

    if (snapshot.count === 0) {
      this.manualLaunchArmed = true;
      return false;
    }
    if (!this.manualLaunchArmed) return false;

    const observedPids = new Set(snapshot.pids);
    this.manualLaunchArmed = false;
    this.manualLaunchBaselinePids = observedPids;
    return this.enqueue(async () => {
      if (this.manualLaunchMonitorStopped) return false;
      const latest = await this.nativeCodexSnapshot();
      const observedProcessStillRunning = latest
        && [...observedPids].some((pid) => latest.pids.has(pid));
      if (!observedProcessStillRunning) {
        if (!latest?.count) {
          this.manualLaunchBaselinePids.clear();
          this.manualLaunchArmed = true;
        }
        return false;
      }

      await this.stopInternal();
      let terminated;
      try {
        terminated = await this.platform.terminateNativeCodex();
      } catch (error) {
        await this.restoreIdleRuntimeAfterAdoptionFailure(error);
        throw error;
      }

      if (!(terminated > 0)) {
        await this.startInternal();
        this.manualLaunchBaselinePids.clear();
        this.manualLaunchArmed = true;
        return false;
      }

      try {
        const status = await this.startInternal({ launchCodex: true });
        this.manualLaunchBaselinePids.clear();
        this.manualLaunchArmed = true;
        return status;
      } catch (error) {
        this.manualLaunchBaselinePids.clear();
        this.manualLaunchArmed = true;
        await this.restoreIdleRuntimeAfterAdoptionFailure(error);
        throw error;
      }
    });
  }

  async restoreIdleRuntimeAfterAdoptionFailure(failure) {
    try {
      await this.startInternal();
    } catch (recoveryError) {
      throw new Error(
        `${failure.message}; idle RuntimeHost recovery failed: ${recoveryError.message}`,
        { cause: failure },
      );
    }
  }

  async stopInternal() {
    const child = this.child;
    if (!child || hasExited(child)) {
      this.clearChildState();
      return;
    }
    this.stopping = true;
    let confirmed = false;
    try {
      const exited = await this.waitForExactExit(child, "SIGTERM", this.stopTimeoutMs);
      confirmed = exited || await this.waitForExactExit(child, "SIGKILL", this.stopTimeoutMs);
    } finally {
      this.stopping = false;
    }
    if (!confirmed) {
      throw new Error(`RuntimeHost pid ${child.pid} did not exit after SIGKILL within ${this.stopTimeoutMs}ms`);
    }
    this.clearChildState();
  }

  async waitForExactExit(child, signal, timeoutMs) {
    if (hasExited(child)) return true;
    let exited = false;
    const onExit = () => { exited = true; };
    child.once("exit", onExit);
    try {
      try {
        child.kill(signal);
      } catch (error) {
        if (error?.code === "ESRCH") return true;
        throw error;
      }
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (exited || hasExited(child)) return true;
        await this.sleep(50);
      }
      return exited || hasExited(child);
    } finally {
      child.removeListener?.("exit", onExit);
    }
  }

  async stop() {
    await this.stopManualLaunchMonitor();
    return this.enqueue(() => this.stopInternal());
  }

  async refreshStatus() {
    const child = this.child;
    if (!child || hasExited(child)) return this.status();
    try {
      const ready = normalizeRuntimeReady(JSON.parse(await readFile(this.paths.runtimeReadyPath, "utf8")));
      const expectedSession = this.ready?.runtimeSessionId ?? null;
      const currentSession = ready.runtimeSessionId ?? null;
      if (!isReadyPayload(ready, child) || (expectedSession && currentSession !== expectedSession)) {
        this.ready = rendererUnavailableReady(this.ready ?? ready);
      } else {
        this.ready = ready;
        this.appliedFeatures = [...ready.features];
        this.plugins = [...ready.plugins];
      }
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      if (this.ready) this.ready = rendererUnavailableReady(this.ready);
    }
    if (this.ready) {
      this.appliedFeatures = [...this.ready.features];
      this.plugins = [...this.ready.plugins];
    }
    return this.status();
  }

  restart() {
    if (this.restartInFlight) return this.restartInFlight;
    const operation = this.enqueue(async () => {
      await this.stopInternal();
      await this.platform.terminateOwnedCodex(this.paths);
      await this.platform.terminateNativeCodex?.();
      return this.startInternal({ launchCodex: true });
    });
    this.restartInFlight = operation;
    const shared = this.restartInFlight.finally(() => {
      if (this.restartInFlight === operation) this.restartInFlight = null;
    });
    return shared;
  }

  status() {
    const running = Boolean(this.child && !hasExited(this.child));
    return {
      running,
      pid: this.child?.pid ?? null,
      appliedFeatures: running ? [...this.appliedFeatures] : [],
      plugins: running ? [...this.plugins] : [],
      pluginStates: running ? [...this.plugins] : [],
      ready: running ? this.ready : null,
      runtimeSessionId: running ? this.ready?.runtimeSessionId ?? null : null,
      renderer: running ? this.ready?.renderer ?? null : null,
      failures: running ? [...(this.ready?.failures ?? [])] : [],
    };
  }
}

export async function writeServicePid(pidPath) {
  await writeFile(pidPath, `${process.pid}\n`, { mode: 0o600 });
  return async () => unlink(pidPath).catch(() => {});
}
