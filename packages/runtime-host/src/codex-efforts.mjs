import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Model Slider 思考强度来源说明（为什么需要这个模块）
//
// OpenCodex 把第三方模型路由给 Codex 时，会在 catalog 里给所有“有思考强度”的
// 模型额外广告 mock 的 max/ultra（即使上游并不支持）。GLM 之类被 OpenCodex 测得
// 准的模型没有这个问题；而像 Qwen/Grok/MiMo 这类 OpenCodex 没内置档位的模型，
// 只能通过用户的 OpenCodex 配置声明真实档位。
//
// 这个模块只做一件事：读取 OpenCodex 配置（~/.opencodex/config.json）中按
// provider 声明的 modelReasoningEfforts，作为 Model Slider 的“真实档位表”。
// 它不产生、不猜测、不修改任何档位；配置里没有的模型保持原样。
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
