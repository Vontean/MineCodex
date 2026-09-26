import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SessionStatusReader, threadIdFromLocation } from "../src/session-status-reader.mjs";

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
  }, { turns: 1, steps: 1, total: 600, cacheHit: 60, uncached: 200, tps: 50, context: 20 });
  assert.equal(first.averageFirstTokenMs, 900);

  await appendFile(filePath, [
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

test("returns no snapshot for unavailable or malformed thread IDs", async () => {
  const reader = new SessionStatusReader({ sessionsDir: path.join(os.tmpdir(), "missing-mcx-sessions") });
  assert.equal(await reader.read("not-a-thread"), null);
  assert.equal(await reader.read(THREAD_ID), null);
  assert.equal(threadIdFromLocation(`/thread/${THREAD_ID}?view=chat`), THREAD_ID);
});
