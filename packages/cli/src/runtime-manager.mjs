import { spawn } from "node:child_process";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { ChatGPTLaunchCoordinator } from "./chatgpt-launch-coordinator.mjs";
import { readConfig, FEATURE_IDS } from "./config.mjs";

export const RUNTIME_PLUGIN_STATES = Object.freeze([
  "configured",
  "launching",
  "ready",
  "injected",
  "checking",
  "partial",
  "degraded",
  "unavailable",
  "not-applicable",
  "failed",
  "stopped",
]);

function enabledFeatureIds(config) {
  return FEATURE_IDS.filter((id) => config.features[id]);
}

function hasExited(child) {
  return Boolean(child && (child.exitCode != null || child.signalCode != null));
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
    ...plugins.filter(({ state }) => ["configured", "launching", "ready", "injected", "checking", "partial", "degraded", "unavailable", "not-applicable"].includes(state)).map(({ featureId }) => featureId),
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
    plugins: normalized.plugins.map((plugin) => ["injected","partial","degraded","not-applicable","unavailable","checking"].includes(plugin.state)
      ? { ...plugin, state: "checking", health: null, targets:[] }
      : plugin),
    renderer: {
      ...(normalized.renderer ?? {}),
      discovered: false,
      targets:[],
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
    manualLaunchPollMs = 150,
    cdpPort = Number(process.env.CODEX_RUNTIME_CDP_PORT ?? 9231),
    launchCoordinator = null,
    fileSystem = { open, rename, unlink },
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
    this.fileSystem = fileSystem;
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
    this.manualLaunchSuppressionDepth = 0;
    this.enhancedCodex = null;
    this.enhancementFailure = null;
    this.launchCoordinator = launchCoordinator ?? new ChatGPTLaunchCoordinator({
      platform,
      cdpPort,
    });
  }

  enqueue(operation) {
    const next = this.lifecycleQueue.catch(() => {}).then(operation);
    this.lifecycleQueue = next.catch(() => {});
    return next;
  }

  async startInternal() {
    if (this.child && !hasExited(this.child)) return this.status();
    this.clearChildState();
    this.stopping = false;
    const config = await readConfig(this.paths.configPath);
    const features = enabledFeatureIds(config);
    if (typeof this.platform?.codex === "function") await this.platform.codex();
    const codexBuild=await this.platform?.codexBuild?.();
    await mkdir(this.paths.supportDir, { recursive: true, mode: 0o700 });
    await unlink(this.paths.runtimeReadyPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    const runtimeEnvironment = {
      ...process.env,
      CODEX_FEATURES_ROOT: this.paths.featuresRoot,
      CODEX_RUNTIME_PROFILE_DIR: this.paths.profileDir,
      CODEX_RUNTIME_CDP_PORT: String(this.cdpPort),
      MINECODEX_CODEX_BUILD: codexBuild ?? "",
      CODEX_IMAGE_HOST_DATA_DIR: this.paths.imagesDataDir,
      CODEX_NOTES_DATA_DIR: this.paths.notesDataDir,
      MINECODEX_ENABLED_FEATURES: features.join(","),
      MINECODEX_CODEX_PID_FILE: this.paths.codexPidPath,
      MINECODEX_RUNTIME_READY_FILE: this.paths.runtimeReadyPath,
    };
    delete runtimeEnvironment.MINECODEX_LAUNCH_CODEX;
    delete runtimeEnvironment.MINECODEX_CODEX_EXECUTABLE;
    const child = this.spawnProcess(process.execPath, [this.paths.runtimeEntry], {
      cwd: this.paths.packageRoot,
      env: runtimeEnvironment,
      stdio: ["inherit", "inherit", "inherit", "ipc"],
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
    const processes = (Array.isArray(snapshot?.processes) ? snapshot.processes : [])
      .filter(({ command }) => !String(command).includes("--user-data-dir="));
    return {
      count: processes.length,
      processes,
      pids: new Set(processes.flatMap(({ pid }) => Number.isInteger(pid) ? [pid] : [])),
    };
  }

  async syncManualLaunchBaseline({ excludePids = [] } = {}) {
    const snapshot = await this.nativeCodexSnapshot();
    if (!snapshot) return;
    const excluded = new Set(excludePids);
    this.manualLaunchBaselinePids = new Set([...snapshot.pids].filter((pid) => !excluded.has(pid)));
    this.manualLaunchArmed = true;
  }

  async clearOwnedCodexMarker() {
    await unlink(this.paths.codexPidPath).catch((error) => {
      if (error.code !== "ENOENT") this.logger.warn?.("MineCodex could not clear its ChatGPT owner marker", error.message);
    });
  }

  async startManualLaunchMonitor() {
    if (this.manualLaunchMonitorPromise || typeof this.platform?.snapshotNativeCodexState !== "function") return;
    // 登录恢复时 ChatGPT 可能先于服务启动，首次扫描也必须纳入增强流程。
    this.manualLaunchBaselinePids.clear();
    this.manualLaunchArmed = true;
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
    if (this.manualLaunchMonitorStopped || this.manualLaunchSuppressionDepth > 0) return false;
    const snapshot = await this.nativeCodexSnapshot();
    if (!snapshot) return false;
    if (this.enhancedCodex && !snapshot.pids.has(this.enhancedCodex.pid)) {
      if (this.enhancedCodex.owned) await this.clearOwnedCodexMarker();
      this.enhancedCodex = null;
    }
    if (snapshot.count === 0) {
      if (this.enhancedCodex?.owned) await this.clearOwnedCodexMarker();
      this.enhancedCodex = null;
      this.manualLaunchBaselinePids.clear();
      this.manualLaunchArmed = true;
      return false;
    }
    if (!this.manualLaunchArmed) return false;
    const newProcesses = snapshot.processes.filter(({ pid }) => !this.manualLaunchBaselinePids.has(pid));
    this.manualLaunchBaselinePids = new Set(snapshot.pids);
    if (newProcesses.length === 0) return false;
    if (newProcesses.length > 1) {
      this.enhancementFailure = {
        code: "MULTIPLE_CHATGPT_LAUNCHES",
        message: "MineCodex found multiple new official ChatGPT processes and did not terminate any of them.",
        phase: "launch",
      };
      return false;
    }

    const observedProcess = newProcesses[0];
    this.manualLaunchArmed = false;
    this.enhancementFailure = null;
    this.manualLaunchSuppressionDepth += 1;
    return this.enqueue(async () => {
      const retryProcessPids = new Set();
      try {
        if (this.manualLaunchMonitorStopped) return false;
        const latest = await this.nativeCodexSnapshot();
        const currentProcess = latest?.processes.find((candidate) => (
          candidate.pid === observedProcess.pid
          && candidate.command === observedProcess.command
        ));
        if (!currentProcess) {
          this.manualLaunchArmed = true;
          return false;
        }
        try {
          const result = await this.launchCoordinator.ensureObservedLaunch(currentProcess, {
            stopRuntime: () => this.stopInternal(),
            startRuntime: () => this.startInternal(),
            waitForHealthy: () => this.waitForHealthyRuntime(),
          });
          this.enhancedCodex = result.codex;
          this.enhancementFailure = null;
          if (this.enhancedCodex.owned) await this.writeOwnedCodexPid(this.enhancedCodex);
          await this.syncManualLaunchBaseline();
          return result;
        } catch (error) {
          retryProcessPids.add(observedProcess.pid);
          for (const pid of error.retryProcessPids ?? []) retryProcessPids.add(pid);
          this.enhancementFailure = normalizedFailure({
            code: error.code ?? "CHATGPT_ENHANCEMENT_FAILED",
            message: error.message,
            phase: "launch",
          });
          try {
            await this.startInternal();
          } catch (recoveryError) {
            throw new Error(
              `${error.message}; idle RuntimeHost recovery failed: ${recoveryError.message}`,
              { cause: error },
            );
          }
          throw error;
        }
      } finally {
        this.manualLaunchArmed = true;
        await this.syncManualLaunchBaseline({ excludePids: retryProcessPids }).catch((error) => {
          this.logger.warn?.("MineCodex could not refresh the ChatGPT launch baseline", error.message);
        });
        this.manualLaunchSuppressionDepth -= 1;
      }
    });
  }

  async writeOwnedCodexPid(processInfo) {
    if (!this.paths.codexPidPath) return;
    const marker = {
      version: 1,
      pid: processInfo?.pid,
      command: processInfo?.command,
    };
    if (!Number.isInteger(marker.pid) || marker.pid <= 1 || typeof marker.command !== "string" || !marker.command) {
      throw new Error("MineCodex cannot persist incomplete ChatGPT ownership identity.");
    }
    const temporaryPath = `${this.paths.codexPidPath}.${process.pid}.${Date.now()}.tmp`;
    let committed = false;
    try {
      const handle = await this.fileSystem.open(temporaryPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(marker)}\n`);
        await handle.sync?.();
      } finally {
        await handle.close();
      }
      await this.fileSystem.rename(temporaryPath, this.paths.codexPidPath);
      committed = true;
    } finally {
      if (!committed) await this.fileSystem.unlink(temporaryPath).catch(() => {});
    }
  }

  async waitForHealthyRuntime(initialStatus = null, timeoutMs = 25_000) {
    const deadline = Date.now() + timeoutMs;
    let status = initialStatus ?? this.status();
    while (Date.now() < deadline) {
      if (!status.healthy) status = await this.refreshStatus();
      if (status.healthy) return status;
      await this.sleep(100);
    }
    throw new Error("MineCodex RuntimeHost did not prove renderer discovery and feature injection.");
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
        // Windows 的 SIGTERM 会强杀；先请求宿主清理插件子进程。
        if (signal === "SIGTERM" && child.connected && typeof child.send === "function") {
          child.send({ type: "minecodex:shutdown" }, (error) => {
            if (error && !hasExited(child)) this.logger.warn?.("Runtime shutdown request failed", error.message);
          });
        } else {
          child.kill(signal);
        }
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
    this.manualLaunchSuppressionDepth += 1;
    const operation = this.enqueue(async () => {
      try {
        const previousCodex = this.enhancedCodex;
        if (previousCodex?.owned && typeof this.platform?.terminateNativeCodex === "function") {
          const result = await this.launchCoordinator.relaunchOwned({
            stopRuntime: () => this.stopInternal(),
            terminateOwned: async () => {
              const terminated = await this.platform.terminateNativeCodex(previousCodex.pid, previousCodex.command);
              if (terminated !== 1) throw new Error(`MineCodex could not terminate owned ChatGPT pid ${previousCodex.pid}.`);
            },
            startRuntime: () => this.startInternal(),
            waitForHealthy: (status) => this.waitForHealthyRuntime(status),
          });
          this.enhancedCodex = result.codex;
          this.enhancementFailure = null;
          if (this.enhancedCodex.pid) await this.writeOwnedCodexPid(this.enhancedCodex);
          await this.syncManualLaunchBaseline();
          return result;
        }
        if (previousCodex && !previousCodex.owned) {
          await this.stopInternal();
          const healthy = await this.waitForHealthyRuntime(await this.startInternal());
          await this.syncManualLaunchBaseline();
          return { ...healthy, codex: previousCodex };
        }
        await this.stopInternal();
        if (!previousCodex) await this.platform.terminateOwnedCodex?.(this.paths);
        this.enhancedCodex = null;
        this.enhancementFailure = null;
        if (typeof this.platform?.openNativeCodex !== "function") return this.startInternal();
        const launched = await this.platform.openNativeCodex({ cdpPort: this.cdpPort });
        const status = await this.startInternal();
        const healthy = await this.waitForHealthyRuntime(status);
        this.enhancedCodex = {
          pid: launched?.pid ?? null,
          owned: true,
          command: launched?.command ?? null,
        };
        if (this.enhancedCodex.pid) await this.writeOwnedCodexPid(this.enhancedCodex);
        await this.syncManualLaunchBaseline();
        return { ...healthy, codex: this.enhancedCodex };
      } finally {
        await this.syncManualLaunchBaseline().catch((error) => {
          this.logger.warn?.("MineCodex could not refresh the ChatGPT launch baseline", error.message);
        });
        this.manualLaunchSuppressionDepth -= 1;
      }
    });
    this.restartInFlight = operation;
    const shared = this.restartInFlight.finally(() => {
      if (this.restartInFlight === operation) this.restartInFlight = null;
    });
    return shared;
  }

  status() {
    const running = Boolean(this.child && !hasExited(this.child));
    const healthy = running && this.ready?.renderer?.active === true;
    return {
      running,
      healthy,
      pid: this.child?.pid ?? null,
      appliedFeatures: running ? [...this.appliedFeatures] : [],
      plugins: running ? [...this.plugins] : [],
      pluginStates: running ? [...this.plugins] : [],
      ready: running ? this.ready : null,
      runtimeSessionId: running ? this.ready?.runtimeSessionId ?? null : null,
      renderer: running ? this.ready?.renderer ?? null : null,
      codex: this.enhancedCodex ? { ...this.enhancedCodex } : null,
      failures: running
        ? [...(this.ready?.failures ?? []), ...(this.enhancementFailure ? [this.enhancementFailure] : [])]
        : (this.enhancementFailure ? [this.enhancementFailure] : []),
    };
  }
}

export async function writeServicePid(pidPath) {
  await writeFile(pidPath, `${process.pid}\n`, { mode: 0o600 });
  return async () => unlink(pidPath).catch(() => {});
}
