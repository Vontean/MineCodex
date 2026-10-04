import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SessionStatusReader, threadIdFromLocation } from "../src/adapters/codex/session-reader.mjs";

const THREAD_ID = "11111111-2222-4333-8444-555555555555";
const usage = (input, cached, output) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  total_tokens: input + output,
});
const line = (timestamp, type, payload) => JSON.stringify({ timestamp, type, payload }) + "\n";

test("reads unique turns and model steps, then incrementally updates token and speed totals", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "mcx-session-status-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const sessionsDir = path.join(base, "sessions");
  const dateDir = path.join(sessionsDir, "2026", "09", "26");
  await mkdir(dateDir, { recursive: true });
  const filePath = path.join(dateDir, `rollout-2026-09-26T00-00-00-${THREAD_ID}.jsonl`);
  await writeFile(filePath, [
    line("1970-01-01T00:00:00.000Z", "session_meta", { context_window: 1000 }),
    line("1970-01-01T00:00:00.100Z", "event_msg", { type: "task_started", turn_id: "turn-1" }),
    line("1970-01-01T00:00:01.200Z", "event_msg", {
      type: "item_completed", item: { type: "Reasoning" }, started_at_ms: 1000, completed_at_ms: 1200,
    }),
    line("1970-01-01T00:00:03.000Z", "token_usage_record", {
      response_id: "response-1", usage: usage(200, 100, 100), thread_token_usage: usage(500, 300, 100),
    }),
    line("1970-01-01T00:00:03.001Z", "event_msg", {
      type: "token_count", info: { total_token_usage: usage(400, 200, 90), model_context_window: 1000 },
    }),
    line("1970-01-01T00:00:03.200Z", "event_msg", {
      type: "task_complete", time_to_first_token_ms: 900,
    }),
  ].join(""));
  const reader = new SessionStatusReader({ sessionsDir });
  const first = await reader.read(THREAD_ID);
  assert.deepEqual({
    turns: first.turns, steps: first.steps, total: first.totalTokens,
    cacheHit: first.cacheHitPercent, uncached: first.uncachedInputTokens,
    tps: first.observedTps, context: first.contextPercent,
  }, { turns: 1, steps: 1, total: 600, cacheHit: 60, uncached: 200, tps: 50, context: 30 });
  assert.equal(first.averageFirstTokenMs, 900);

  await appendFile(filePath, [
    line("1970-01-01T00:00:04Z", "event_msg", { type:"task_started", turn_id:"turn-2" }),
    line("1970-01-01T00:00:04.200Z", "event_msg", {
      type: "item_completed", item: { type: "AgentMessage" }, started_at_ms: 4000, completed_at_ms: 4200,
    }),
    line("1970-01-01T00:00:06.000Z", "token_usage_record", {
      response_id: "response-2", usage: usage(100, 50, 100), thread_token_usage: usage(600, 350, 200),
    }),
  ].join(""));
  const second = await reader.read(THREAD_ID);
  assert.equal(second.steps, 2);
  assert.equal(second.totalTokens, 800);
  assert.equal(second.observedTps, 50);
  assert.equal(second.speedSamples, 2);
  assert.deepEqual(await reader.read(THREAD_ID), second);
});

test("excludes overlapping tool execution from model TPS without double subtraction", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "mcx-session-status-tool-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const sessionsDir = path.join(base, "sessions");
  await mkdir(sessionsDir);
  const filePath = path.join(sessionsDir, `rollout-test-${THREAD_ID}.jsonl`);
  await writeFile(filePath, [
    line("1970-01-01T00:00:00Z", "turn_context", { turn_id:"turn-1" }),
    line("1970-01-01T00:00:01.100Z", "event_msg", {
      type: "item_completed", item: { type: "Reasoning" }, started_at_ms: 1000, completed_at_ms: 1100,
    }),
    line("1970-01-01T00:00:02.200Z", "event_msg", {
      type: "item_completed", item: { type: "CommandExecution" }, started_at_ms: 1200, completed_at_ms: 2200,
    }),
    line("1970-01-01T00:00:02.800Z", "event_msg", {
      type: "item_completed", item: { type: "McpToolCall" }, started_at_ms: 1800, completed_at_ms: 2800,
    }),
    line("1970-01-01T00:00:04.000Z", "token_usage_record", {
      response_id: "response-1", usage: usage(200, 0, 140), thread_token_usage: usage(200, 0, 140),
    }),
  ].join(""));
  const snapshot = await new SessionStatusReader({ sessionsDir }).read(THREAD_ID);
  assert.equal(snapshot.observedTps, 100);
  assert.equal(snapshot.observedModelMs, 1400);
  assert.equal(snapshot.speedSamples, 1);
});

test("counts completed compactions once across rollout records and UI events", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "mcx-session-status-compact-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const sessionsDir = path.join(base, "sessions");
  await mkdir(sessionsDir);
  const filePath = path.join(sessionsDir, `rollout-test-${THREAD_ID}.jsonl`);
  await writeFile(filePath, [
    line("2026-09-26T03:23:28.208Z", "compacted", { message: "x".repeat(100_000), window_number: 1 }),
    line("2026-09-26T03:23:28.221Z", "event_msg", {
      type: "item_completed", item: { type: "ContextCompaction", id: "compact-1" },
    }),
    line("2026-09-26T03:50:44.376Z", "compacted", { window_number: 2 }),
    line("2026-09-26T03:50:44.392Z", "event_msg", {
      type: "item_completed", item: { type: "ContextCompaction", id: "compact-2" },
    }),
  ].join(""));
  const reader = new SessionStatusReader({ sessionsDir });
  assert.equal((await reader.read(THREAD_ID)).compactions, 2);
  await appendFile(filePath, line("2026-09-26T04:12:00.000Z", "compacted", { window_number: 3 }));
  assert.equal((await reader.read(THREAD_ID)).compactions, 3);
});

test("counts legacy context_compacted notifications when no compacted record exists", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "mcx-session-status-legacy-compact-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const sessionsDir = path.join(base, "sessions");
  await mkdir(sessionsDir);
  const filePath = path.join(sessionsDir, `rollout-test-${THREAD_ID}.jsonl`);
  await writeFile(filePath, [
    line("2026-09-26T01:00:00.000Z", "event_msg", { type: "context_compacted" }),
    line("2026-09-26T02:00:00.000Z", "event_msg", { type: "context_compacted" }),
  ].join(""));
  assert.equal((await new SessionStatusReader({ sessionsDir }).read(THREAD_ID)).compactions, 2);
});

test("estimates visible sections from active history and replaces superseded history on compaction", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "mcx-session-sections-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const sessionsDir = path.join(base, "sessions");
  await mkdir(sessionsDir);
  const filePath = path.join(sessionsDir, `rollout-test-${THREAD_ID}.jsonl`);
  await writeFile(filePath, [
    line("2026-09-26T00:00:00Z", "session_meta", {
      context_window: 1000, base_instructions: { text: "12345678" },
    }),
    line("2026-09-26T00:00:01Z", "response_item", {
      type: "message", role: "user", content: [{ type: "input_text", text: "obsolete history" }],
    }),
    line("2026-09-26T00:00:02Z", "compacted", { window_number: 1, replacement_history: [
      { type: "message", role: "developer", content: [{ type: "input_text", text: "abcd" }] },
      { type: "message", role: "user", content: [{ type: "input_text", text: "你好" }] },
    ] }),
    line("2026-09-26T00:00:03Z", "response_item", {
      type: "custom_tool_call", input: "12345678",
    }),
    line("2026-09-26T00:00:04Z", "response_item", {
      type: "custom_tool_call_output", output: [{ type: "input_text", text: "abcdefgh" }],
    }),
    line("2026-09-26T00:00:05Z", "token_usage_record", {
      response_id: "response-1", usage: usage(100, 0, 10), thread_token_usage: usage(100, 0, 10),
    }),
  ].join(""));
  const reader = new SessionStatusReader({ sessionsDir });
  assert.deepEqual((await reader.read(THREAD_ID)).contextSections, {
    instructions: 3, messages: 2, toolHistory: 4,
  });
  await appendFile(filePath, line("2026-09-26T00:00:06Z", "response_item", {
    type: "message", role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,AAAA" }],
  }));
  assert.equal((await reader.read(THREAD_ID)).contextSections.messages, 1846);
});

test("backs off missing logs from 500ms to 10s and reads a newly created first turn without tokens", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-session-retry-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  let now = 0;
  const reader = new SessionStatusReader({ sessionsDir, now: () => now });
  for (const delay of [500, 1000, 2000, 10_000]) {
    assert.equal(await reader.read(THREAD_ID), null);
    assert.equal(reader.retryAfterMs(THREAD_ID), delay);
    now += delay;
  }
  const file = path.join(sessionsDir, `rollout-${THREAD_ID}.jsonl`);
  await writeFile(file, line("2026-09-26T00:00:00Z", "event_msg", { type: "task_started", turn_id: "first" }));
  now--;
  assert.equal(await reader.read(THREAD_ID), null);
  now++;
  const first = await reader.read(THREAD_ID);
  assert.equal(first.turns, 1);
  assert.equal(first.totalTokens, null);
  assert.equal(first.isRunning, true);
  assert.equal(reader.retryAfterMs(THREAD_ID), 0);
  await appendFile(file, line("2026-09-26T00:00:01Z", "event_msg", { type: "task_complete", turn_id: "first" }));
  assert.equal((await reader.read(THREAD_ID)).isRunning, false);
  await appendFile(file, line("2026-09-26T00:00:02Z", "event_msg", { type: "task_started", turn_id: "second" }));
  assert.equal((await reader.read(THREAD_ID)).isRunning, true);
  await appendFile(file, line("2026-09-26T00:00:03Z", "event_msg", { type: "turn_aborted", turn_id: "second" }));
  assert.equal((await reader.read(THREAD_ID)).isRunning, false);
});

test("returns no snapshot for unavailable or malformed thread IDs", async () => {
  const reader = new SessionStatusReader({ sessionsDir: path.join(os.tmpdir(), "missing-mcx-sessions") });
  assert.equal(await reader.read("not-a-thread"), null);
  assert.equal(await reader.read(THREAD_ID), null);
  assert.equal(threadIdFromLocation(`/thread/${THREAD_ID}?view=chat`), THREAD_ID);
});

test("merges resumed rollout segments, discovers later sessions and keeps cumulative usage without double counting", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-session-segments-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  const original = path.join(sessionsDir, `rollout-2026-09-30T01-00-00-${THREAD_ID}.jsonl`);
  const resumed = path.join(sessionsDir, `rollout-2026-09-30T02-00-00-${THREAD_ID}_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jsonl`);
  await writeFile(original, [
    line("1970-01-01T00:00:00Z", "event_msg", { type: "task_started", turn_id: "failed" }),
    line("1970-01-01T00:00:01Z", "event_msg", { type: "task_complete", turn_id: "failed" }),
  ].join(""));
  // 无关后缀文件不能被当成当前会话分段。
  await writeFile(`${original.slice(0, -6)}_backup.jsonl`, line("1970-01-01T00:00:02Z", "event_msg", { type: "task_started", turn_id: "unrelated" }));
  let now = 0;
  const reader = new SessionStatusReader({ sessionsDir, now: () => now });
  assert.equal((await reader.read(THREAD_ID)).steps, 0);
  const response = line("1970-01-01T00:00:04Z", "token_usage_record", {
    response_id: "one", usage: usage(100, 80, 100), thread_token_usage: usage(100, 80, 100),
  });
  await writeFile(resumed, [
    line("1970-01-01T00:00:02Z", "event_msg", { type: "task_started", turn_id: "resumed" }),
    line("1970-01-01T00:00:03Z", "event_msg", { type: "item_completed", item: { type: "Reasoning" }, started_at_ms: 3000, completed_at_ms: 3100 }),
    response, response,
  ].join(""));
  now = 2_000;
  const resumedSnapshot = await reader.read(THREAD_ID);
  assert.equal(resumedSnapshot.turns, 2);
  assert.equal(resumedSnapshot.steps, 1);
  assert.equal(resumedSnapshot.totalTokens, 200);
  assert.equal(resumedSnapshot.cacheHitPercent, 80);
  assert.equal(resumedSnapshot.observedTps, 100);
  await appendFile(resumed, line("1970-01-01T00:00:05Z", "token_usage_record", {
    response_id: "two", usage: usage(100, 80, 50), thread_token_usage: usage(200, 160, 150),
  }));
  assert.equal((await reader.read(THREAD_ID)).totalTokens, 350);
  const nextDate = path.join(sessionsDir, "2026", "10", "01");
  await mkdir(nextDate, { recursive: true });
  await writeFile(path.join(nextDate, `rollout-2026-10-01T00-00-00-${THREAD_ID}_ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee.jsonl`), [
    line("1970-01-01T00:00:06Z", "event_msg", { type: "task_complete", turn_id: "resumed" }),
    line("1970-01-01T00:00:07Z", "event_msg", { type: "task_started", turn_id: "later" }),
    line("1970-01-01T00:00:08Z", "token_usage_record", {
      response_id: "three", usage: usage(100, 80, 50), thread_token_usage: usage(300, 240, 200),
    }),
  ].join(""));
  now = 4_000;
  const latest = await reader.read(THREAD_ID);
  assert.equal(latest.turns, 3);
  assert.equal(latest.steps, 3);
  assert.equal(latest.totalTokens, 500);
  assert.equal(latest.cacheHitPercent, 80);
  assert.deepEqual(await reader.read(THREAD_ID), latest);
});

test("orders initial segment events by timestamp rather than directory traversal", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-session-order-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  const original = path.join(sessionsDir, `rollout-z-${THREAD_ID}.jsonl`);
  const resumed = path.join(sessionsDir, `rollout-a-${THREAD_ID}_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jsonl`);
  await writeFile(original, [
    line("1970-01-01T00:00:01Z", "event_msg", { type: "task_started", turn_id: "one" }),
    line("1970-01-01T00:00:02Z", "token_usage_record", { response_id: "one", usage: usage(100, 50, 10), thread_token_usage: usage(100, 50, 10) }),
    line("1970-01-01T00:00:03Z", "event_msg", { type: "task_complete", turn_id: "one" }),
  ].join(""));
  await writeFile(resumed, [
    line("1970-01-01T00:00:04Z", "event_msg", { type: "task_started", turn_id: "two" }),
    line("1970-01-01T00:00:05Z", "token_usage_record", { response_id: "two", usage: usage(200, 150, 20), thread_token_usage: usage(300, 200, 30) }),
  ].join(""));
  const snapshot = await new SessionStatusReader({ sessionsDir }).read(THREAD_ID);
  assert.equal(snapshot.steps, 2);
  assert.equal(snapshot.turns, 2);
  assert.equal(snapshot.totalTokens, 330);
  assert.equal(snapshot.isRunning, true);
});

test("uses post-compaction native context counts without replacing cumulative billing totals", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-context-reset-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  const file = path.join(sessionsDir, `rollout-${THREAD_ID}.jsonl`);
  await writeFile(file, [
    line("2026-09-27T06:40:45.630Z", "token_usage_record", {
      response_id: "compact", usage: usage(221592, 210816, 3451),
      thread_token_usage: usage(18_000_000, 17_000_000, 45000),
    }),
    line("2026-09-27T06:40:45.643Z", "compacted", { window_number: 1 }),
  ].join(""));
  const reader = new SessionStatusReader({ sessionsDir });
  assert.equal((await reader.read(THREAD_ID)).contextPercent, null);
  await appendFile(file, [
    line("2026-09-27T06:40:45.651Z", "event_msg", {
      type: "token_count", info: {
        last_token_usage: { ...usage(0, 0, 0), total_tokens: 15971 },
        total_token_usage: usage(100, 0, 10), model_context_window: 258400,
      },
    }),
    line("2026-09-27T06:40:45.652Z", "event_msg", {
      type: "item_completed", item: { type: "ContextCompaction" },
    }),
  ].join(""));
  const snapshot = await reader.read(THREAD_ID);
  assert.equal(snapshot.contextUsedTokens, 15971);
  assert.equal(snapshot.contextPercent, 6);
  assert.equal(snapshot.totalTokens, 18_045_000);
  assert.equal(snapshot.compactions, 1);
});

test("late tool completion corrects TPS and duplicate usage does not consume the next sample", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-late-tool-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  const file = path.join(sessionsDir, `rollout-${THREAD_ID}.jsonl`);
  const response = line("1970-01-01T00:00:04Z", "token_usage_record", {
    response_id: "one", usage: usage(100, 0, 140),
  });
  await writeFile(file, [
    line("1970-01-01T00:00:00Z", "turn_context", { turn_id:"turn-1" }),
    line("1970-01-01T00:00:01.100Z", "event_msg", {
      type: "item_completed", item: { type: "Reasoning" }, started_at_ms: 1000, completed_at_ms: 1100,
    }), response,
  ].join(""));
  const reader = new SessionStatusReader({ sessionsDir });
  assert.equal((await reader.read(THREAD_ID)).observedModelMs, 3000);
  await appendFile(file, [
    line("1970-01-01T00:00:04.200Z", "event_msg", {
      type: "item_completed", item: { type: "CommandExecution" }, started_at_ms: 1200, completed_at_ms: 2200,
    }),
    line("1970-01-01T00:00:04.300Z", "event_msg", {
      type: "item_completed", item: { type: "McpToolCall" }, started_at_ms: 1800, completed_at_ms: 2800,
    }),
  ].join(""));
  const corrected = await reader.read(THREAD_ID);
  assert.equal(corrected.observedModelMs, 1400);
  assert.equal(corrected.observedTps, 100);
  await appendFile(file, [
    line("1970-01-01T00:00:05.100Z", "event_msg", {
      type: "item_completed", item: { type: "AgentMessage" }, started_at_ms: 5000, completed_at_ms: 5100,
    }), response,
    line("1970-01-01T00:00:06Z", "token_usage_record", {
      response_id: "two", usage: usage(100, 0, 100),
    }),
  ].join(""));
  const final = await reader.read(THREAD_ID);
  assert.equal(final.speedSamples, 2);
  assert.equal(final.observedTps, 100);
});

test("does not carry unfinished output timing into another turn", async (t) => {
  const sessionsDir = await mkdtemp(path.join(os.tmpdir(), "mcx-turn-timing-"));
  t.after(() => rm(sessionsDir, { recursive: true, force: true }));
  await writeFile(path.join(sessionsDir, `rollout-${THREAD_ID}.jsonl`), [
    line("1970-01-01T00:00:01Z", "event_msg", {
      type: "item_completed", item: { type: "Reasoning" }, started_at_ms: 1000, completed_at_ms: 1100,
    }),
    line("1970-01-01T00:00:02Z", "event_msg", { type: "turn_aborted" }),
    line("1970-01-01T00:00:03Z", "event_msg", { type: "task_started", turn_id: "next" }),
    line("1970-01-01T00:00:04Z", "token_usage_record", {
      response_id: "two", usage: usage(100, 0, 100),
    }),
  ].join(""));
  assert.equal((await new SessionStatusReader({ sessionsDir }).read(THREAD_ID)).observedTps, null);
});
