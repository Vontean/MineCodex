import { readFile } from "node:fs/promises";
import { createQuickChatAdapter } from "./adapters/codex/renderer.mjs";
import { createSubmissionTracker } from "./domain/submission.mjs";
export async function createPageScriptSource() {
  const source = await readFile(new URL("./frontend/entry.mjs", import.meta.url), "utf8");
  return `const createQuickChatAdapter=${createQuickChatAdapter.toString()};\nconst createSubmissionTracker=${createSubmissionTracker.toString()};\n${source}`;
}
