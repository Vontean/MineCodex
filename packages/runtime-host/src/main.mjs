import os from "node:os";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexRuntime } from "./codex-runtime.mjs";
import {
  discoverFeatures,
  loadConfiguredModelCatalog,
  selectEnabledFeatures,
  startFeatureProcesses,
} from "./feature-registry.mjs";

const runtimeRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const featuresRoot = process.env.CODEX_FEATURES_ROOT ?? path.dirname(runtimeRoot);
const legacyDataDir = process.env.CODEX_IMAGE_HOST_DATA_DIR ?? path.join(os.homedir(), ".codex-image-host");
const profileDir = process.env.CODEX_RUNTIME_PROFILE_DIR ?? path.join(legacyDataDir, "codex-profile");
const cdpPort = Number(process.env.CODEX_RUNTIME_CDP_PORT ?? 9231);

const discoveredFeatures = await discoverFeatures(featuresRoot);
if (!discoveredFeatures.length) throw new Error(`No codex-feature.json files found under ${featuresRoot}`);
const features = selectEnabledFeatures(discoveredFeatures, process.env.MINECODEX_ENABLED_FEATURES);
const modelCatalog = await loadConfiguredModelCatalog();
for (const feature of features) {
  if (feature.modelSelector) feature.modelSelector.models = modelCatalog;
}

const featureProcesses = await startFeatureProcesses(features);
const runtime = new CodexRuntime({ features, profileDir, cdpPort });

try {
  await runtime.start();
  if (runtime.appPid && process.env.MINECODEX_CODEX_PID_FILE) {
    await writeFile(process.env.MINECODEX_CODEX_PID_FILE, `${runtime.appPid}\n`, { mode: 0o600 });
  }
  if (process.env.MINECODEX_RUNTIME_READY_FILE) {
    await writeFile(process.env.MINECODEX_RUNTIME_READY_FILE, `${JSON.stringify({
      pid: process.pid,
      features: features.map((feature) => feature.id),
      failures: featureProcesses.failures,
    })}\n`, { mode: 0o600 });
  }
} catch (error) {
  featureProcesses.stop();
  throw error;
}

console.log(`Codex Runtime: ${features.map((feature) => feature.label).join(", ") || "no plugins enabled"}`);

async function shutdown() {
  await runtime.stop();
  featureProcesses.stop();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await shutdown();
    process.exit(0);
  });
}
