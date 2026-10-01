// 归约 MineCodex 会话事实；不依赖 Codex 日志字段或外部环境。
function addSections(target, sections) {
  if (!sections) return;
  for (const key of ["instructions", "messages", "tools"]) target[key] += sections[key];
}

export function createSessionState() {
  return {
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
  const reset = () => { state.firstOutputAt=null; state.pendingToolIntervals=[]; };
  switch (event.kind) {
    case "history-replaced":
      state.compactionRecords++; state.last=null; reset();
      if (Number.isSafeInteger(event.window) && event.window >= 0) state.compactionWindow=Math.max(state.compactionWindow,event.window);
      state.visibleSections=event.sections ?? {instructions:0,messages:0,tools:0};
      state.hasVisibleHistory=event.sections !== null;
      break;
    case "history-added": addSections(state.visibleSections,event.sections); state.hasVisibleHistory=true; break;
    case "turn-observed": state.turns.add(event.id); break;
    case "session-configured":
      if (Number.isFinite(event.contextWindow)) state.contextWindow=event.contextWindow;
      state.baseInstructionTokens=event.instructionTokens; break;
    case "context-reset": state.compactionEvents++; state.last=null; reset(); break;
    case "turn-started": reset(); state.turns.add(event.id); state.runningTurns.add(event.id); break;
    case "turn-ended": reset(); if (event.id) state.runningTurns.delete(event.id); else state.runningTurns.clear(); break;
    case "first-token-measured": state.ttftTotalMs+=event.elapsed; state.ttftSamples++; break;
    case "compaction-finished": state.compactionCompleted++; break;
    case "output-observed": state.firstOutputAt=Math.min(state.firstOutputAt ?? event.start,event.start); break;
    case "tool-measured":
      state.toolMs+=Math.max(0,event.end-event.start);
      state.pendingToolIntervals.push([event.start,event.end]);
      // 工具记录可能晚到，补扣与既有响应样本重叠的时间。
      for (const sample of state.speedMeasurements) if (event.start < sample.end && event.end > sample.start) sample.tools.push([event.start,event.end]);
      break;
    case "usage-observed":
      if (!state.hasResponseUsage && event.total) state.total=event.total;
      if (event.last) state.last=event.last;
      if (Number.isFinite(event.contextWindow)) state.contextWindow=event.contextWindow;
      break;
    case "response-measured":
      if (event.id && state.responses.has(event.id)) return;
      if (event.id) {
        state.responses.add(event.id);
        const output=event.last?.output;
        if (Number.isFinite(output) && output > 0 && state.firstOutputAt != null && Number.isFinite(event.end) && event.end > state.firstOutputAt)
          state.speedMeasurements.push({ start:state.firstOutputAt,end:event.end,output,tools:state.pendingToolIntervals.slice() });
      }
      reset();
      if (event.total) { state.total=event.total; state.hasResponseUsage=true; }
      if (event.last) state.last=event.last;
      break;
  }
  if (state.total || state.turns.size) state.updatedAt=event.at ?? state.updatedAt;
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
  const input = total?.input ?? 0;
  const cached = total?.cached ?? 0;
  const cacheWrite = total?.cacheWrite ?? 0;
  const contextUsed = state.last?.total ?? null;
  const contextWindow = state.contextWindow > 0 ? state.contextWindow : null;
  return {
    threadId,
    isRunning: state.runningTurns.size > 0,
    turns: state.turns.size,
    steps: state.responses.size,
    totalTokens: total?.total ?? null,
    inputTokens: total?.input ?? null,
    cachedInputTokens: total?.cached ?? null,
    cacheWriteInputTokens: total?.cacheWrite ?? null,
    uncachedInputTokens: total ? Math.max(0, input - cached - cacheWrite) : null,
    outputTokens: total?.output ?? null,
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
