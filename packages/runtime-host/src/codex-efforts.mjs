import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function canonicalEfforts(values) {
  if (!Array.isArray(values)) return null;
  const seen = new Set();
  const out = values
    .map((value) => String(value).trim().toLowerCase())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  return out.length ? out : null;
}

// 读取 OpenCodex 配置中按 provider 声明的真实思考强度档位。OpenCodex 同步 catalog
// 时会额外广告 mock 的 max/ultra；这里只透传 provider 自己声明的档位，供 Model
// Slider 精确显示，避免 UI 出现上游并不支持的档位。
export async function loadOpenCodexRealEfforts({
  opencodexConfigPath = process.env.OPENCODEX_CONFIG_PATH ?? path.join(os.homedir(), ".opencodex", "config.json"),
  read = readFile,
} = {}) {
  const configPayload = await read(opencodexConfigPath, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => null);
  const entries = {};
  for (const [provider, providerConfig] of Object.entries(configPayload?.providers ?? {})) {
    for (const [modelId, efforts] of Object.entries(providerConfig?.modelReasoningEfforts ?? {})) {
      const levels = canonicalEfforts(efforts);
      if (!levels) continue;
      entries[`${provider}/${modelId}`.toLowerCase()] = levels;
    }
  }
  return entries;
}
