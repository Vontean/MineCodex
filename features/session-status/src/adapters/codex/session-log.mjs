const MODEL_OUTPUT_ITEMS = new Set(["Reasoning", "AgentMessage"]);
const TOOL_ITEMS = new Set(["CommandExecution", "McpToolCall", "DynamicToolCall"]);
const IMAGE_TOKENS_ESTIMATE = 1844;

function estimatedTextTokens(value) {
  return typeof value === "string" ? Math.ceil(Buffer.byteLength(value, "utf8") / 4) : 0;
}

function estimatedContentTokens(content) {
  if (typeof content === "string") return estimatedTextTokens(content);
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

// 外部记录转换成可归约的内部事实；未知记录不参与统计。
export function sessionFacts(record) {
  const p = record?.payload ?? {}, at = record?.timestamp;
  const facts = [], emit = (kind, data = {}) => facts.push({ kind, at, ...data });
  const usage = value => value && ["input_tokens", "cached_input_tokens", "output_tokens", "total_tokens"]
    .every(key => Number.isFinite(value[key]) && value[key] >= 0)
    ? { input:value.input_tokens, cached:value.cached_input_tokens, output:value.output_tokens,
        total:value.total_tokens, cacheWrite:value.cache_write_input_tokens ?? null } : null;
  if (record?.type === "compacted") {
    const sections = Array.isArray(p.replacement_history) ? {instructions:0,messages:0,tools:0} : null;
    for (const item of Array.isArray(p.replacement_history) ? p.replacement_history : []) {
      const next = estimatedSections(item);
      if (next) for (const key of Object.keys(sections)) sections[key] += next[key];
    }
    emit("history-replaced", { window:p.window_number, sections });
  }
  if (record?.type === "response_item") {
    const sections = estimatedSections(p);
    if (sections) emit("history-added", { sections });
  }
  if (record?.type === "turn_context" && p.turn_id) emit("turn-observed", { id:p.turn_id });
  if (record?.type === "session_meta") emit("session-configured", { contextWindow:p.context_window,
    instructionTokens:estimatedTextTokens(p.base_instructions?.text) });
  if (record?.type === "event_msg") {
    if (p.type === "context_compacted") emit("context-reset");
    if (p.type === "task_started" && p.turn_id) emit("turn-started", { id:p.turn_id });
    if (["task_complete", "task_interrupted", "turn_aborted"].includes(p.type)) emit("turn-ended", { id:p.turn_id });
    if (p.type === "task_complete" && Number.isFinite(p.time_to_first_token_ms)) emit("first-token-measured", { elapsed:p.time_to_first_token_ms });
    if (p.type === "item_completed") {
      if (p.item?.type === "ContextCompaction") emit("compaction-finished");
      if (MODEL_OUTPUT_ITEMS.has(p.item?.type) && Number.isFinite(p.started_at_ms)) emit("output-observed", { start:p.started_at_ms, end:p.completed_at_ms });
      if (TOOL_ITEMS.has(p.item?.type) && Number.isFinite(p.started_at_ms) && Number.isFinite(p.completed_at_ms)) emit("tool-measured", { start:p.started_at_ms, end:p.completed_at_ms });
    }
    if (p.type === "token_count") emit("usage-observed", { total:usage(p.info?.total_token_usage), last:usage(p.info?.last_token_usage), contextWindow:p.info?.model_context_window });
  }
  if (record?.type === "token_usage_record") emit("response-measured", { id:p.response_id, total:usage(p.thread_token_usage), last:usage(p.usage), end:Date.parse(at) });
  return facts;
}
