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

function emptyState(filePath) {
  return {
    filePath,
    offset: 0,
    pending: "",
    turns: new Set(),
    responses: new Set(),
    hasResponseUsage: false,
    total: null,
    last: null,
    contextWindow: null,
    firstOutputAt: null,
    pendingToolIntervals: [],
    decodeTokens: 0,
    decodeMs: 0,
    speedSamples: 0,
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
    if (payload.type === "context_compacted") state.compactionEvents += 1;
    if (payload.type === "task_started" && payload.turn_id) state.turns.add(payload.turn_id);
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
      }
    }
    if (payload.type === "token_count") {
      if (!state.hasResponseUsage && validUsage(payload.info?.total_token_usage)) {
        state.total = payload.info.total_token_usage;
      }
      if (!state.hasResponseUsage && validUsage(payload.info?.last_token_usage)) {
        state.last = payload.info.last_token_usage;
      }
      if (Number.isFinite(payload.info?.model_context_window)) {
        state.contextWindow = payload.info.model_context_window;
      }
    }
  }
  if (event?.type === "token_usage_record") {
    const responseId = payload.response_id;
    if (responseId && !state.responses.has(responseId)) {
      state.responses.add(responseId);
      const responseEnd = Date.parse(event.timestamp);
      const elapsed = state.firstOutputAt == null ? null : responseEnd - state.firstOutputAt
        - overlappingToolMs(state.pendingToolIntervals, state.firstOutputAt, responseEnd);
      const output = payload.usage?.output_tokens;
      // 会话事件只给出首个可见条目的时间，故 TPS 是观测估算。
      if (Number.isFinite(output) && output > 0 && state.firstOutputAt != null
        && Number.isFinite(elapsed) && elapsed > 0 && elapsed < 600_000) {
        state.decodeTokens += output;
        state.decodeMs += elapsed;
        state.speedSamples += 1;
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
  const total = state.total;
  const input = total?.input_tokens ?? 0;
  const cached = total?.cached_input_tokens ?? 0;
  const cacheWrite = total?.cache_write_input_tokens ?? 0;
  const contextUsed = state.last?.total_tokens ?? null;
  const contextWindow = state.contextWindow > 0 ? state.contextWindow : null;
  return {
    threadId,
    turns: state.turns.size,
    steps: state.responses.size,
    totalTokens: total?.total_tokens ?? null,
    inputTokens: total?.input_tokens ?? null,
    cachedInputTokens: total?.cached_input_tokens ?? null,
    cacheWriteInputTokens: total?.cache_write_input_tokens ?? null,
    uncachedInputTokens: total ? Math.max(0, input - cached - cacheWrite) : null,
    outputTokens: total?.output_tokens ?? null,
    cacheHitPercent: input > 0 ? Math.round(cached / input * 100) : null,
    observedTps: state.decodeMs > 0 ? Math.round(state.decodeTokens / (state.decodeMs / 1000)) : null,
    speedSamples: state.speedSamples,
    observedModelMs: state.decodeMs,
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

async function findLog(directory, threadId) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(`-${threadId}.jsonl`)) return filePath;
    if (entry.isDirectory()) {
      const found = await findLog(filePath, threadId);
      if (found) return found;
    }
  }
  return null;
}

export class SessionStatusReader {
  constructor({ sessionsDir = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "sessions") } = {}) {
    this.sessionsDir = sessionsDir;
    this.states = new Map();
    this.missingCheckedAt = new Map();
  }

  async read(threadId) {
    if (!THREAD_ID.test(threadId ?? "")) return null;
    let state = this.states.get(threadId);
    if (!state) {
      const lastCheck = this.missingCheckedAt.get(threadId) ?? 0;
      if (Date.now() - lastCheck < 10_000) return null;
      this.missingCheckedAt.set(threadId, Date.now());
      const filePath = await findLog(this.sessionsDir, threadId);
      if (!filePath) return null;
      state = emptyState(filePath);
      this.states.set(threadId, state);
      this.missingCheckedAt.delete(threadId);
    }
    let info;
    try { info = await stat(state.filePath); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.states.delete(threadId);
      return null;
    }
    if (info.size < state.offset) state = emptyState(state.filePath);
    if (info.size > state.offset) {
      const stream = createReadStream(state.filePath, {
        start: state.offset,
        end: info.size - 1,
        encoding: "utf8",
      });
      for await (const chunk of stream) {
        const lines = `${state.pending}${chunk}`.split("\n");
        state.pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.includes('"token_usage_record"') && !line.includes('"event_msg"')
            && !line.includes('"turn_context"') && !line.includes('"session_meta"')
            && !line.includes('"response_item"') && !line.includes('"compacted"')) continue;
          try { applySessionStatusEvent(state, JSON.parse(line)); } catch { /* 忽略损坏的单行 */ }
        }
      }
      state.offset = info.size;
      this.states.set(threadId, state);
    }
    return sessionStatusSnapshot(state, threadId);
  }
}
