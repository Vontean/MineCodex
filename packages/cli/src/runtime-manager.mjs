import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { readConfig, FEATURE_IDS } from "./config.mjs";

function enabledFeatureIds(config) {
  return FEATURE_IDS.filter((id) => config.features[id]);
}

async function waitForReady(readyPath, child, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`RuntimeHost exited before becoming ready (${child.exitCode})`);
    try {
      const ready = JSON.parse(await readFile(readyPath, "utf8"));
      if (ready.pid === child.pid && Array.isArray(ready.features)) return ready;
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("RuntimeHost did not report ready in time");
}

export class RuntimeManager {
  constructor({ paths, platform, logger = console, spawnProcess = spawn }) {
    this.paths = paths;
    this.platform = platform;
    this.logger = logger;
    this.spawnProcess = spawnProcess;
    this.child = null;
    this.appliedFeatures = [];
    this.stopping = false;
  }

  async start() {
    if (this.child && this.child.exitCode === null) return this.status();
    const config = await readConfig(this.paths.configPath);
    const features = enabledFeatureIds(config);
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
      },
      stdio: "inherit",
    });
    this.child = child;
    child.once("exit", (code, signal) => {
      if (this.child === child) this.child = null;
      if (!this.stopping && code !== 0) {
        this.logger.error(`MineCodex RuntimeHost exited (${signal ?? code ?? "unknown"})`);
      }
    });
    try {
      const ready = await waitForReady(this.paths.runtimeReadyPath, child);
      this.appliedFeatures = ready.features;
    } catch (error) {
      if (child.exitCode === null) child.kill("SIGTERM");
      this.child = null;
      this.appliedFeatures = [];
      throw error;
    }
    return this.status();
  }

  async stop() {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      this.child = null;
      return;
    }
    this.stopping = true;
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
    this.child = null;
    this.stopping = false;
  }

  async restart() {
    await this.platform.terminateOwnedCodex(this.paths);
    await this.stop();
    return this.start();
  }

  status() {
    const running = Boolean(this.child && this.child.exitCode === null);
    return {
      running,
      pid: this.child?.pid ?? null,
      appliedFeatures: running ? [...this.appliedFeatures] : [],
    };
  }
}

export async function writeServicePid(pidPath) {
  await writeFile(pidPath, `${process.pid}\n`, { mode: 0o600 });
  return async () => unlink(pidPath).catch(() => {});
}
