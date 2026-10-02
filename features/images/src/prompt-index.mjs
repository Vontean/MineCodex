import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { tracePromptSource, recordedCommandOutput } from "./prompt-source.mjs";

const DEFAULT_NEGATIVE_CACHE_TTL_MS = 5_000;

async function findThreadLogs(directory, threadId, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return output;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await findThreadLogs(entryPath, threadId, output);
    else if (entry.isFile() && entry.name.endsWith(`${threadId}.jsonl`)) output.push(entryPath);
  }
  return output;
}

function legacyPromptFromPayload(payload) {
  if (payload?.type !== "image_generation_end") return null;
  if (typeof payload.call_id !== "string" || typeof payload.revised_prompt !== "string") return null;
  return { imageGenerationItemId: payload.call_id, prompt: payload.revised_prompt };
}

function generatedItemIdsFromOutputLine(line) {
  if (!/"type"\s*:\s*"(?:custom_tool_call_output|function_call_output)"/.test(line)) return null;
  const callId = line.match(/"call_id"\s*:\s*"([a-zA-Z0-9_-]+)"/)?.[1];
  if (!callId) return null;
  const itemIds = new Set();
  const pattern = /generated_images[\\/][^\\/\s]+[\\/]([a-zA-Z0-9_-]+)\.png\b/g;
  for (const match of line.matchAll(pattern)) itemIds.add(match[1]);
  const cellId = line.match(/Script running with cell ID ([a-zA-Z0-9_-]+)/)?.[1];
  return { callId, itemIds, cellId };
}

async function readPrompts(logPath, prompts) {
  const input = createReadStream(logPath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const wrappedPrompts = new Map();
  const cellPrompts = new Map();
  const stored = new Map();
  const pendingSources = new Map();
  for await (const line of lines) {
    if (line.includes('"image_generation_end"') || line.includes('"item_completed"') || /"type"\s*:\s*"custom_tool_call"/.test(line) || /"name"\s*:\s*"wait"/.test(line) || [...pendingSources.keys()].some(id => line.includes(id))) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const payload = event?.payload ?? event;
      // 以完成事件为准；旧版内部状态可能仍是 generating，不能据此丢弃提示词。
      const item = payload?.type === "item_completed" ? payload.item : null;
      if (item?.type === "Extension" && item.kind === "image_gen.generation"
        && typeof item.id === "string"
        && typeof item.revisedPrompt === "string" && item.revisedPrompt.trim()) {
        prompts.set(item.id, item.revisedPrompt);
      }
      const legacy = legacyPromptFromPayload(payload);
      if (legacy && !prompts.has(legacy.imageGenerationItemId)) {
        prompts.set(legacy.imageGenerationItemId, legacy.prompt);
      }
      if (payload?.type === "custom_tool_call" && payload.name === "exec" && typeof payload.input === "string") {
        const prompt = tracePromptSource(payload.input, new Map(stored));
        if (prompt) wrappedPrompts.set(payload.call_id, prompt);
        if (/\bstore\s*\(/.test(payload.input)) pendingSources.set(payload.call_id, payload.input);
      }
      if (payload?.type === "custom_tool_call_output" && pendingSources.has(payload.call_id)) {
        tracePromptSource(pendingSources.get(payload.call_id), stored, recordedCommandOutput(payload.output));
        pendingSources.delete(payload.call_id);
      }
      if (payload?.type === "function_call" && payload.name === "wait") {
        try {
          const args = JSON.parse(payload.arguments);
          const prompt = cellPrompts.get(String(args.cell_id));
          if (prompt) wrappedPrompts.set(payload.call_id, prompt);
        } catch { /* 不完整的调用记录无法关联。 */ }
      }
    }
    const generated = generatedItemIdsFromOutputLine(line);
    const prompt = generated ? wrappedPrompts.get(generated.callId) : null;
    if (!prompt) continue;
    if (generated.cellId) cellPrompts.set(generated.cellId, prompt);
    for (const itemId of generated.itemIds) {
      if (!prompts.has(itemId)) prompts.set(itemId, prompt);
    }
  }
}

function cacheKey(threadId, imageGenerationItemId) {
  return `${threadId}\u0000${imageGenerationItemId}`;
}

async function fileSignature(logPath) {
  try {
    const info = await stat(logPath);
    return { mtimeMs: info.mtimeMs, size: info.size };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

function sameSignature(left, right) {
  return left?.mtimeMs === right?.mtimeMs && left?.size === right?.size;
}

export class ThreadPromptIndex {
  constructor({ sessionRoots = [], negativeTtlMs = DEFAULT_NEGATIVE_CACHE_TTL_MS, now = Date.now } = {}) {
    if (!Number.isFinite(negativeTtlMs) || negativeTtlMs < 0) {
      throw new Error("negativeTtlMs must be a non-negative number");
    }
    if (typeof now !== "function") throw new Error("now must be a function");
    this.sessionRoots = sessionRoots.map((sessionRoot) => path.resolve(sessionRoot));
    this.negativeTtlMs = negativeTtlMs;
    this.now = now;
    this.threadPrompts = new Map();
    this.threadLogPaths = new Map();
    this.threadLogSignatures = new Map();
    this.scanPromises = new Map();
    this.negativeCache = new Map();
    this.scanCount = 0;
  }

  async scanThread(threadId, { refreshPaths = false } = {}) {
    this.scanCount += 1;
    if (refreshPaths || !this.threadLogPaths.has(threadId)) {
      const logPaths = [];
      for (const sessionRoot of this.sessionRoots) {
        await findThreadLogs(sessionRoot, threadId, logPaths);
      }
      this.threadLogPaths.set(threadId, logPaths);
    }
    const logPaths = this.threadLogPaths.get(threadId) ?? [];
    const prompts = new Map();
    const signatures = new Map();
    for (const logPath of logPaths) {
      await readPrompts(logPath, prompts);
      const signature = await fileSignature(logPath);
      if (signature) signatures.set(logPath, signature);
    }
    this.threadPrompts.set(threadId, prompts);
    this.threadLogSignatures.set(threadId, signatures);
    return prompts;
  }

  async threadLogsChanged(threadId) {
    const logPaths = this.threadLogPaths.get(threadId) ?? [];
    const signatures = this.threadLogSignatures.get(threadId) ?? new Map();
    for (const logPath of logPaths) {
      const current = await fileSignature(logPath);
      if (!current || !sameSignature(current, signatures.get(logPath))) return true;
    }
    return false;
  }

  clearNegative(threadId) {
    for (const key of this.negativeCache.keys()) {
      if (key.startsWith(`${threadId}\u0000`)) this.negativeCache.delete(key);
    }
  }

  async find(threadId, imageGenerationItemId) {
    const key = cacheKey(threadId, imageGenerationItemId);
    const cached = this.threadPrompts.get(threadId);
    if (cached?.has(imageGenerationItemId)) {
      // 工具请求先到、完成事件后到时，重新读取更准确的 revisedPrompt。
      if (!await this.threadLogsChanged(threadId)) return cached.get(imageGenerationItemId);
      this.threadPrompts.delete(threadId);
      this.clearNegative(threadId);
    }

    const negative = this.negativeCache.get(key);
    if (negative) {
      const expired = this.now() >= negative.expiresAt;
      const changed = expired || await this.threadLogsChanged(threadId);
      if (!changed) return null;
      this.negativeCache.delete(key);
      this.threadPrompts.delete(threadId);
      this.threadLogSignatures.delete(threadId);
      this.clearNegative(threadId);
      if (expired) this.threadLogPaths.delete(threadId);
    }

    let scan = this.scanPromises.get(threadId);
    if (!scan) {
      scan = this.scanThread(threadId, { refreshPaths: !this.threadLogPaths.has(threadId) });
      this.scanPromises.set(threadId, scan);
      const clearScan = () => {
        if (this.scanPromises.get(threadId) === scan) this.scanPromises.delete(threadId);
      };
      scan.then(clearScan, clearScan);
    }
    const prompts = await scan;
    const prompt = prompts.get(imageGenerationItemId) ?? null;
    if (!prompt) {
      this.negativeCache.set(key, { expiresAt: this.now() + this.negativeTtlMs });
    }
    return prompt;
  }

  invalidate(threadId = null) {
    if (threadId == null) {
      this.threadPrompts.clear();
      this.threadLogPaths.clear();
      this.threadLogSignatures.clear();
      this.negativeCache.clear();
      return;
    }
    this.threadPrompts.delete(threadId);
    this.threadLogPaths.delete(threadId);
    this.threadLogSignatures.delete(threadId);
    this.clearNegative(threadId);
  }

  close() {
    this.threadPrompts.clear();
    this.threadLogPaths.clear();
    this.threadLogSignatures.clear();
    this.scanPromises.clear();
    this.negativeCache.clear();
  }
}

export async function findImagePrompt({ sessionRoots, threadId, imageGenerationItemId }) {
  const index = new ThreadPromptIndex({ sessionRoots });
  return index.find(threadId, imageGenerationItemId);
}
