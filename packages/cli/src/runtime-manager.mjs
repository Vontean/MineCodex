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
  }) {
    this.paths = paths;
    this.platform = platform;
    this.logger = logger;
    this.spawnProcess = spawnProcess;
    this.waitForReady = readyWaiter;
    this.sleep = sleep;
    this.stopTimeoutMs = stopTimeoutMs;
    this.child = null;
    this.appliedFeatures = [];
    this.plugins = [];
    this.ready = null;
    this.stopping = false;
    this.lifecycleQueue = Promise.resolve();
    this.restartInFlight = null;
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
        CODEX_RUNTIME_CDP_PORT: process.env.CODEX_RUNTIME_CDP_PORT ?? "9231",
        CODEX_IMAGE_HOST_DATA_DIR: this.paths.imagesDataDir,
        CODEX_NOTES_DATA_DIR: this.paths.notesDataDir,
        MINECODEX_ENABLED_FEATURES: features.join(","),
        MINECODEX_CODEX_PID_FILE: this.paths.codexPidPath,
        MINECODEX_RUNTIME_READY_FILE: this.paths.runtimeReadyPath,
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
    return this.enqueue(() => this.startInternal());
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

  stop() {
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
      return this.startInternal();
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
