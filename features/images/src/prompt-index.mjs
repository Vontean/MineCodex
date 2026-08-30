import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

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

function wrappedImagegenPrompt(payload) {
  if (payload?.type !== "custom_tool_call" || payload.name !== "exec") return null;
  if (typeof payload.call_id !== "string" || typeof payload.input !== "string") return null;
  const marker = "tools.image_gen__imagegen";
  const markerIndex = payload.input.indexOf(marker);
  if (markerIndex < 0) return null;
  const generatedImageIndex = payload.input.indexOf("generatedImage(", markerIndex + marker.length);
  const callSource = payload.input.slice(markerIndex, generatedImageIndex < 0 ? undefined : generatedImageIndex);
  const match = callSource.match(/\bprompt\s*:\s*("(?:\\.|[^"\\])*")/s);
  if (!match) return null;
  try {
    const prompt = JSON.parse(match[1]);
    return typeof prompt === "string" ? { callId: payload.call_id, prompt } : null;
  } catch {
    return null;
  }
}

function generatedItemIdsFromOutputLine(line) {
  if (!line.includes('"type":"custom_tool_call_output"') || !line.includes("generated_images")) return null;
  const callId = line.match(/"call_id":"([a-zA-Z0-9_-]+)"/)?.[1];
  if (!callId) return null;
  const itemIds = new Set();
  const pattern = /generated_images[\\/][^\\/\s]+[\\/]([a-zA-Z0-9_-]+)\.png\b/g;
  for (const match of line.matchAll(pattern)) itemIds.add(match[1]);
  return { callId, itemIds };
}

async function readPrompts(logPath, prompts) {
  const input = createReadStream(logPath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const wrappedPrompts = new Map();
  for await (const line of lines) {
    if (line.includes('"image_generation_end"') || line.includes("image_gen__imagegen")) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const payload = event?.payload ?? event;
      const legacy = legacyPromptFromPayload(payload);
      if (legacy && !prompts.has(legacy.imageGenerationItemId)) {
        prompts.set(legacy.imageGenerationItemId, legacy.prompt);
      }
      const wrapped = wrappedImagegenPrompt(payload);
      if (wrapped) wrappedPrompts.set(wrapped.callId, wrapped.prompt);
    }
    const generated = generatedItemIdsFromOutputLine(line);
    const prompt = generated ? wrappedPrompts.get(generated.callId) : null;
    if (!prompt) continue;
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
    if (cached?.has(imageGenerationItemId)) return cached.get(imageGenerationItemId);

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
