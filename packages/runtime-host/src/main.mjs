import { randomUUID } from "node:crypto";
import os from "node:os";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexRuntime, createRuntimeReadyContract } from "./codex-runtime.mjs";
import { createManagedPidFileWriter } from "./pid-file.mjs";
import {
  discoverFeatures,
  loadConfiguredModelCatalog,
  selectEnabledFeatures,
  startFeatureProcesses,
} from "./feature-registry.mjs";
import { loadOpenCodexRealEfforts } from "./codex-efforts.mjs";

const runtimeRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const featuresRoot = process.env.CODEX_FEATURES_ROOT ?? path.dirname(runtimeRoot);
const legacyDataDir = process.env.CODEX_IMAGE_HOST_DATA_DIR ?? path.join(os.homedir(), ".codex-image-host");
const profileDir = process.env.CODEX_RUNTIME_PROFILE_DIR ?? path.join(legacyDataDir, "codex-profile");
const cdpPort = Number(process.env.CODEX_RUNTIME_CDP_PORT ?? 9231);

const discoveredFeatures = await discoverFeatures(featuresRoot);
if (!discoveredFeatures.length) throw new Error(`No codex-feature.json files found under ${featuresRoot}`);
const features = selectEnabledFeatures(discoveredFeatures, process.env.MINECODEX_ENABLED_FEATURES);
const modelCatalog = await loadConfiguredModelCatalog();
const openCodexRealEfforts = await loadOpenCodexRealEfforts();
for (const feature of features) {
  if (feature.modelSelector) {
    feature.modelSelector.models = modelCatalog;
    feature.modelSelector.openCodexRealEfforts = openCodexRealEfforts;
  }
}

let readyWritePromise = Promise.resolve();
let runtime;
let featureProcesses;
let runtimeReady = false;
const updateCodexPidFile = createManagedPidFileWriter(process.env.MINECODEX_CODEX_PID_FILE);

function writeReadyFile() {
  if (!process.env.MINECODEX_RUNTIME_READY_FILE) return Promise.resolve();
  const filePath = process.env.MINECODEX_RUNTIME_READY_FILE;
  readyWritePromise = readyWritePromise.catch(() => {}).then(() => writeFile(filePath, `${JSON.stringify(
    createRuntimeReadyContract({
      pid: process.pid,
      features,
      plugins: featureProcesses.getStatuses({ rendererActive: runtime?.getRendererStatus().active }),
      failures: featureProcesses.getFailures(),
      renderer: runtime?.getRendererStatus(),
      runtimeSessionId: runtime?.runtimeSessionId,
    }),
  )}\n`, { mode: 0o600 }));
  return readyWritePromise;
}

function requestReadyFileRefresh() {
  if (!runtimeReady || !runtime || !featureProcesses) return;
  writeReadyFile().catch((error) => console.warn("Runtime ready-file update failed", error.message));
}

const featureInstanceId = randomUUID();
featureProcesses = await startFeatureProcesses(features, {
  instanceId: featureInstanceId,
  deferredStart: true,
  onStatusChange: requestReadyFileRefresh,
});

runtime = new CodexRuntime({
  features,
  featureInstanceId,
  profileDir,
  cdpPort,
  onManagedCodexPidChange: updateCodexPidFile,
  onStatusChange: requestReadyFileRefresh,
});

try {
  await runtime.start();
  runtimeReady = true;
  await writeReadyFile();
} catch (error) {
  await featureProcesses.stop();
  throw error;
}

console.log(`Codex Runtime: ${features.map((feature) => feature.label).join(", ") || "no plugins enabled"}`);

async function shutdown() {
  await runtime.stop();
  await featureProcesses.stop();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    try {
      await shutdown();
      process.exit(0);
    } catch (error) {
      console.error(`Runtime shutdown failed: ${error.message}`);
      process.exit(1);
    }
  });
}
