import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_OUTPUT_ITEMS = new Set(["Reasoning", "AgentMessage"]);
const TOOL_ITEMS = new Set(["CommandExecution", "McpToolCall", "DynamicToolCall"]);
const IMAGE_TOKENS_ESTIMATE = 1844;

function estimatedTextTokens(value) {
  return typeof value === "string" ? Math.ceil(Buffer.byteLength(value, "utf8") / 4) : 0;
}

function estimatedContentTokens(content) {
  if (!Array.isArray(content)) return 0;
  return content.reduce((total, item) => {
    if (item?.type === "input_image" || item?.type === "output_image") return total + IMAGE_TOKENS_ESTIMATE;
    return total + estimatedTextTokens(item?.text);
  }, 0);
}

function estimatedEncryptedTokens(value) {
  if (typeof value !== "string") return 0;
  // 参考 Codex 的历史粗估：先去掉加密封装，再按约 4 字节/token 换算。
  return Math.ceil(Math.max(0, Math.floor(value.length * 3 / 4) - 650) / 4);
}

function estimatedSections(item) {
  const type = item?.type;
  if (type === "message") {
    const tokens = estimatedContentTokens(item.content);
    return item.role === "developer" || item.role === "system"
      ? { instructions: tokens, messages: 0, tools: 0 }
      : { instructions: 0, messages: tokens, tools: 0 };
  }
  if (type === "function_call" || type === "custom_tool_call") {
    return { instructions: 0, messages: 0, tools: estimatedTextTokens(item.arguments ?? item.input) };
  }
  if (type === "function_call_output" || type === "custom_tool_call_output") {
    return { instructions: 0, messages: 0, tools: estimatedContentTokens(item.output) };
  }
  if (type === "reasoning" || type === "compaction") {
    return { instructions: 0, messages: estimatedContentTokens(item.summary)
      + estimatedEncryptedTokens(item.encrypted_content), tools: 0 };
  }
  return null;
}

function addSections(target, sections) {
  if (!sections) return;
  for (const key of ["instructions", "messages", "tools"]) target[key] += sections[key];
}

export function threadIdFromLocation(value) {
  return String(value ?? "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

function emptyState(filePaths) {
  return {
    files: new Map(filePaths.map(filePath => [filePath, { offset: 0, pending: "" }])),
    nextDiscoveryAt: 0,
    turns: new Set(),
    runningTurns: new Set(),
    responses: new Set(),
    hasResponseUsage: false,
    total: null,
    last: null,
    contextWindow: null,
    firstOutputAt: null,
    pendingToolIntervals: [],
    speedMeasurements: [],
    ttftTotalMs: 0,
    ttftSamples: 0,
    toolMs: 0,
    compactionRecords: 0,
    compactionCompleted: 0,
    compactionEvents: 0,
    compactionWindow: 0,
    baseInstructionTokens: 0,
    visibleSections: { instructions: 0, messages: 0, tools: 0 },
    hasVisibleHistory: false,
    updatedAt: null,
  };
}

function validUsage(value) {
  return value && ["input_tokens", "cached_input_tokens", "output_tokens", "total_tokens"]
    .every((key) => Number.isFinite(value[key]) && value[key] >= 0);
}

function overlappingToolMs(intervals, start, end) {
  const clipped = intervals
    .map(([toolStart, toolEnd]) => [Math.max(start, toolStart), Math.min(end, toolEnd)])
    .filter(([left, right]) => right > left)
    .sort((left, right) => left[0] - right[0]);
  let elapsed = 0;
  let rightEdge = start;
  for (const [left, right] of clipped) {
    elapsed += Math.max(0, right - Math.max(left, rightEdge));
    rightEdge = Math.max(rightEdge, right);
  }
  return elapsed;
}

export function applySessionStatusEvent(state, event) {
  const payload = event?.payload ?? {};
  if (event?.type === "compacted") {
    state.compactionRecords += 1;
    state.last = null;
    state.firstOutputAt = null;
    state.pendingToolIntervals = [];
    if (Number.isSafeInteger(payload.window_number) && payload.window_number >= 0) {
      state.compactionWindow = Math.max(state.compactionWindow, payload.window_number);
    }
    // 压缩会替换活跃历史；不能继续累计压缩前的消息与工具记录。
    state.visibleSections = { instructions: 0, messages: 0, tools: 0 };
    state.hasVisibleHistory = false;
    if (Array.isArray(payload.replacement_history)) {
      for (const item of payload.replacement_history) addSections(state.visibleSections, estimatedSections(item));
      state.hasVisibleHistory = true;
    }
  }
  if (event?.type === "response_item") {
    const sections = estimatedSections(payload);
    if (sections) {
      addSections(state.visibleSections, sections);
      state.hasVisibleHistory = true;
    }
  }
  if (event?.type === "turn_context" && payload.turn_id) state.turns.add(payload.turn_id);
  if (event?.type === "session_meta") {
    if (Number.isFinite(payload.context_window)) state.contextWindow = payload.context_window;
    state.baseInstructionTokens = estimatedTextTokens(payload.base_instructions?.text);
  }
  if (event?.type === "event_msg") {
    if (payload.type === "context_compacted") {
      state.compactionEvents += 1;
      state.last = null;
      state.firstOutputAt = null;
      state.pendingToolIntervals = [];
    }
    if (payload.type === "task_started" && payload.turn_id) {
      state.firstOutputAt = null;
      state.pendingToolIntervals = [];
      state.turns.add(payload.turn_id);
      state.runningTurns.add(payload.turn_id);
    }
    if (["task_complete", "task_interrupted", "turn_aborted"].includes(payload.type)) {
      state.firstOutputAt = null;
      state.pendingToolIntervals = [];
      if (payload.turn_id) state.runningTurns.delete(payload.turn_id);
      else state.runningTurns.clear();
    }
    if (payload.type === "task_complete" && Number.isFinite(payload.time_to_first_token_ms)) {
      state.ttftTotalMs += payload.time_to_first_token_ms;
      state.ttftSamples += 1;
    }
    if (payload.type === "item_completed") {
      const itemType = payload.item?.type;
      if (itemType === "ContextCompaction") state.compactionCompleted += 1;
      const start = payload.started_at_ms;
      const end = payload.completed_at_ms;
      if (MODEL_OUTPUT_ITEMS.has(itemType) && Number.isFinite(start)) {
        state.firstOutputAt = Math.min(state.firstOutputAt ?? start, start);
      }
      if (TOOL_ITEMS.has(itemType) && Number.isFinite(start) && Number.isFinite(end)) {
        state.toolMs += Math.max(0, end - start);
        state.pendingToolIntervals.push([start, end]);
        // 工具完成事件可能晚于用量记录落盘，补扣已记录样本中的重叠区间。
        for (const sample of state.speedMeasurements) {
          if (start < sample.end && end > sample.start) sample.tools.push([start, end]);
        }
      }
    }
    if (payload.type === "token_count") {
      if (!state.hasResponseUsage && validUsage(payload.info?.total_token_usage)) {
        state.total = payload.info.total_token_usage;
      }
      if (validUsage(payload.info?.last_token_usage)) {
        state.last = payload.info.last_token_usage;
      }
      if (Number.isFinite(payload.info?.model_context_window)) {
        state.contextWindow = payload.info.model_context_window;
      }
    }
  }
  if (event?.type === "token_usage_record") {
    const responseId = payload.response_id;
    if (responseId && state.responses.has(responseId)) return;
    if (responseId) {
      state.responses.add(responseId);
      const responseEnd = Date.parse(event.timestamp);
      const output = payload.usage?.output_tokens;
      // 起止点来自会话事件，并非模型首末 token 时间；只能提供观测约值。
      if (Number.isFinite(output) && output > 0 && state.firstOutputAt != null
        && Number.isFinite(responseEnd) && responseEnd > state.firstOutputAt) {
        state.speedMeasurements.push({
          start: state.firstOutputAt, end: responseEnd, output,
          tools: state.pendingToolIntervals.slice(),
        });
      }
    }
    state.firstOutputAt = null;
    state.pendingToolIntervals = [];
    if (validUsage(payload.thread_token_usage)) {
      state.total = payload.thread_token_usage;
      state.hasResponseUsage = true;
    }
    if (validUsage(payload.usage)) state.last = payload.usage;
  }
  if (state.total || state.turns.size) state.updatedAt = event.timestamp ?? state.updatedAt;
}

export function sessionStatusSnapshot(state, threadId) {
  let decodeTokens = 0;
  let decodeMs = 0;
  let speedSamples = 0;
  for (const sample of state.speedMeasurements) {
    const elapsed = sample.end - sample.start - overlappingToolMs(sample.tools, sample.start, sample.end);
    if (elapsed <= 0 || elapsed >= 600_000) continue;
    decodeTokens += sample.output;
    decodeMs += elapsed;
    speedSamples += 1;
  }
  const total = state.total;
  const input = total?.input_tokens ?? 0;
  const cached = total?.cached_input_tokens ?? 0;
  const cacheWrite = total?.cache_write_input_tokens ?? 0;
  const contextUsed = state.last?.total_tokens ?? null;
  const contextWindow = state.contextWindow > 0 ? state.contextWindow : null;
  return {
    threadId,
    isRunning: state.runningTurns.size > 0,
    turns: state.turns.size,
    steps: state.responses.size,
    totalTokens: total?.total_tokens ?? null,
    inputTokens: total?.input_tokens ?? null,
    cachedInputTokens: total?.cached_input_tokens ?? null,
    cacheWriteInputTokens: total?.cache_write_input_tokens ?? null,
    uncachedInputTokens: total ? Math.max(0, input - cached - cacheWrite) : null,
    outputTokens: total?.output_tokens ?? null,
    cacheHitPercent: input > 0 ? Math.round(cached / input * 100) : null,
    observedTps: decodeMs > 0 ? Math.round(decodeTokens / (decodeMs / 1000)) : null,
    speedSamples,
    observedModelMs: decodeMs,
    toolMs: state.toolMs,
    averageFirstTokenMs: state.ttftSamples > 0 ? Math.round(state.ttftTotalMs / state.ttftSamples) : null,
    contextUsedTokens: contextUsed,
    contextWindow,
    contextPercent: contextUsed != null && contextWindow != null
      ? Math.min(100, Math.round(contextUsed / contextWindow * 100)) : null,
    compactions: Math.max(state.compactionWindow, state.compactionRecords,
      state.compactionCompleted, state.compactionEvents),
    contextSections: state.hasVisibleHistory ? {
      instructions: state.baseInstructionTokens + state.visibleSections.instructions,
      messages: state.visibleSections.messages,
      toolHistory: state.visibleSections.tools,
    } : null,
    updatedAt: state.updatedAt,
  };
}

async function findLogs(directory, threadId) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  const filename = new RegExp(`-${threadId}(?:_[0-9a-f-]{36})?\\.jsonl$`, "i");
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isFile() && filename.test(entry.name)) files.push(filePath);
    if (entry.isDirectory()) {
      files.push(...await findLogs(filePath, threadId));
    }
  }
  return files.sort();
}

export class SessionStatusReader {
  constructor({ sessionsDir = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "sessions"), now = Date.now } = {}) {
    this.sessionsDir = sessionsDir;
    this.now = now;
    this.states = new Map();
    this.missingChecks = new Map();
  }

  retryAfterMs(threadId) {
    return Math.max(0, (this.missingChecks.get(threadId)?.nextCheckAt ?? 0) - this.now());
  }

  async read(threadId) {
    if (!THREAD_ID.test(threadId ?? "")) return null;
    let state = this.states.get(threadId);
    if (!state || this.now() >= state.nextDiscoveryAt) {
      if (this.retryAfterMs(threadId) > 0) return null;
      const filePaths = await findLogs(this.sessionsDir, threadId);
      if (!filePaths.length) {
        this.states.delete(threadId);
        const attempts = this.missingChecks.get(threadId)?.attempts ?? 0;
        const delay = [500, 1000, 2000][attempts] ?? 10_000;
        this.missingChecks.set(threadId, { attempts: attempts + 1, nextCheckAt: this.now() + delay });
        return null;
      }
      // 新分段出现时重新按时间合并，避免只停留在最初的 rollout。
      if (!state || filePaths.join("\n") !== [...state.files.keys()].join("\n")) state = emptyState(filePaths);
      state.nextDiscoveryAt = this.now() + 2_000;
      this.states.set(threadId, state);
      this.missingChecks.delete(threadId);
    }
    let sizes;
    try { sizes = await Promise.all([...state.files.keys()].map(async filePath => [filePath, (await stat(filePath)).size])); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.states.delete(threadId);
      return null;
    }
    if (sizes.some(([filePath, size]) => size < state.files.get(filePath).offset)) {
      const nextDiscoveryAt = state.nextDiscoveryAt;
      state = emptyState([...state.files.keys()]);
      state.nextDiscoveryAt = nextDiscoveryAt;
    }
    const events = [];
    for (const [filePath, size] of sizes) {
      const file = state.files.get(filePath);
      if (size <= file.offset) continue;
      const stream = createReadStream(filePath, {
        start: file.offset,
        end: size - 1,
        encoding: "utf8",
      });
      for await (const chunk of stream) {
        const lines = `${file.pending}${chunk}`.split("\n");
        file.pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.includes('"token_usage_record"') && !line.includes('"event_msg"')
            && !line.includes('"turn_context"') && !line.includes('"session_meta"')
            && !line.includes('"response_item"') && !line.includes('"compacted"')) continue;
          try { events.push(JSON.parse(line)); } catch { /* 忽略损坏的单行 */ }
        }
      }
      file.offset = size;
    }
    events.sort((left, right) => (Date.parse(left.timestamp) || 0) - (Date.parse(right.timestamp) || 0));
    for (const event of events) applySessionStatusEvent(state, event);
    this.states.set(threadId, state);
    return sessionStatusSnapshot(state, threadId);
  }
}
