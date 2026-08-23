import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CODEX_REASONING_ORDER = ["low", "medium", "high", "xhigh", "max", "ultra"];

function uniqueLevels(values) {
  return [...new Set(values.filter(Boolean))];
}


function normalizedEfforts(entry) {
  if (!Array.isArray(entry)) return null;
  const levels = entry.map(String).filter((value) => (
    CODEX_REASONING_ORDER.includes(value) || value === "none" || value === "minimal"
  ));
  return levels.length ? uniqueLevels(levels) : null;
}

export function resolveModelRecord(records, modelId) {
  if (!records || typeof records !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(records, modelId)) return records[modelId];
  const folded = modelId.toLowerCase();
  for (const [key, value] of Object.entries(records)) {
    if (key.toLowerCase() === folded) return value;
  }
  return undefined;
}

export function mergeCapability(providerConfig, modelId) {
  if (!providerConfig) return null;
  const configuredEfforts = normalizedEfforts(
    resolveModelRecord(providerConfig.modelReasoningEfforts, modelId),
  );
  if (configuredEfforts) {
    return {
      source: "opencodex",
      kind: "effort",
      levels: uniqueLevels(configuredEfforts),
      map: resolveModelRecord(providerConfig.modelReasoningEffortMap, modelId) ?? null,
      rawEfforts: configuredEfforts,
    };
  }
  if (Array.isArray(providerConfig.noReasoningModels) && providerConfig.noReasoningModels.includes(modelId)) {
    return { source: "opencodex", kind: "no-effort", levels: null, map: null, rawEfforts: [] };
  }
  return null;
}

export async function loadModelCapabilities({
  opencodexConfigPath = process.env.OPENCODEX_CONFIG_PATH ?? path.join(os.homedir(), ".opencodex", "config.json"),
  read = readFile,
} = {}) {
  const configPayload = await read(opencodexConfigPath, "utf8").then((value) => JSON.parse(value)).catch(() => null);
  const providers = configPayload?.providers ?? {};
  const result = new Map();
  for (const [providerId, providerConfig] of Object.entries(providers)) {
    const modelIds = new Set([
      ...Object.keys(providerConfig?.modelReasoningEfforts ?? {}),
      ...Object.keys(providerConfig?.modelReasoningEffortMap ?? {}),
      ...Object.keys(providerConfig?.thinkingToggleModels ?? {}),
      ...Object.keys(providerConfig?.thinkingBudgetModels ?? {}),
      ...(Array.isArray(providerConfig?.noReasoningModels) ? providerConfig.noReasoningModels : []),
    ]);
    for (const modelId of modelIds) {
      const capability = mergeCapability(providerConfig, modelId);
      if (capability) result.set(`${providerId}/${modelId}`.toLowerCase(), capability);
    }
  }
  return result;
}

export function applyVisibleReasoningLevels(catalogModel, capability, fallbackLevels) {
  if (!catalogModel) return catalogModel;
  const rawLevels = Array.isArray(fallbackLevels) ? fallbackLevels : (catalogModel.supportedReasoningLevels ?? []);
  if (!Array.isArray(rawLevels)) return catalogModel;
  if (capability && Array.isArray(capability.levels)) {
    const allowed = new Set(capability.levels);
    const visible = rawLevels.filter((level) => {
      const effort = String(level?.effort ?? level ?? "").toLowerCase();
      return allowed.has(effort);
    });
    return { ...catalogModel, supportedReasoningLevels: visible, modelSelectorCapability: capability };
  }
  return { ...catalogModel, modelSelectorCapability: capability ?? null };
}
