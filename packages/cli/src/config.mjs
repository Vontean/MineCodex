import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const FEATURE_IDS = Object.freeze(["model-slider", "notes", "images", "hide-upsell-banner", "session-status", "usage-meter", "unread-inbox"]);
export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 1,
  features: Object.freeze({
    "model-slider": true,
    notes: true,
    images: true,
    "hide-upsell-banner": true,
    "session-status": true,
    "usage-meter": true,
    "unread-inbox": true,
  }),
});

const configQueues = new Map();

function normalizeFeatures(features) {
  return Object.fromEntries(FEATURE_IDS.map((id) => [
    id,
    typeof features?.[id] === "boolean" ? features[id] : true,
  ]));
}

export function normalizeConfig(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MineCodex config must be a JSON object");
  }
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) {
    throw new Error(`Unsupported MineCodex config schema: ${value.schemaVersion}`);
  }
  return {
    ...value,
    schemaVersion: 1,
    features: {
      ...(value.features && typeof value.features === "object" ? value.features : {}),
      ...normalizeFeatures(value.features),
    },
  };
}

export async function readConfig(configPath) {
  try {
    return normalizeConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return normalizeConfig(DEFAULT_CONFIG);
    if (error instanceof SyntaxError) throw new Error(`Invalid MineCodex config JSON: ${error.message}`);
    throw error;
  }
}

export async function writeConfig(configPath, value) {
  const config = normalizeConfig(value);
  await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, configPath);
  return config;
}

export async function ensureConfig(configPath) {
  const config = await readConfig(configPath);
  await writeConfig(configPath, config);
  return config;
}

function withConfigLock(configPath, operation) {
  const previous = configQueues.get(configPath) ?? Promise.resolve();
  const operationPromise = previous.catch(() => {}).then(operation);
  const settled = operationPromise.finally(() => {
    if (configQueues.get(configPath) === settled) configQueues.delete(configPath);
  });
  configQueues.set(configPath, settled);
  return settled;
}

export async function updateFeature(configPath, id, enabled, {
  read = readConfig,
  write = writeConfig,
} = {}) {
  if (!FEATURE_IDS.includes(id)) throw new Error(`Unknown MineCodex plugin: ${id}`);
  if (typeof enabled !== "boolean") throw new Error("enabled must be a boolean");
  return withConfigLock(configPath, async () => {
    const config = await read(configPath);
    config.features[id] = enabled;
    return write(configPath, config);
  });
}

export async function ensureControlToken(tokenPath) {
  try {
    return (await readFile(tokenPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString("base64url");
  await writeFile(tokenPath, `${token}\n`, { mode: 0o600, flag: "wx" }).catch(async (error) => {
    if (error.code !== "EEXIST") throw error;
  });
  return (await readFile(tokenPath, "utf8")).trim();
}
