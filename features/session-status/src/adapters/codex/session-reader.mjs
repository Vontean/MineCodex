import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sessionFacts } from "./session-log.mjs";
import { createSessionState, applySessionStatusEvent, sessionStatusSnapshot } from "../../domain/session-stats.mjs";

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function threadIdFromLocation(value) {
  return String(value ?? "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

function emptyState(filePaths) {
  return { ...createSessionState(), files:new Map(filePaths.map(filePath => [filePath, { offset:0, pending:"" }])), nextDiscoveryAt:0 };
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
    for (const event of events) for (const fact of sessionFacts(event)) applySessionStatusEvent(state, fact);
    this.states.set(threadId, state);
    return sessionStatusSnapshot(state, threadId);
  }
}
