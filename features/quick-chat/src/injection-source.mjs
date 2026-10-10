import { readFile } from "node:fs/promises";
import { createQuickChatAdapter } from "./adapters/codex/renderer.mjs";
import { quickChatOpenExport, installQuickChatShortcut } from "./adapters/codex/shortcut.mjs";
import { createSubmissionTracker } from "./domain/submission.mjs";
import { createHistoryTracker } from "./domain/history.mjs";
export async function createPageScriptSource() {
  const source = await readFile(new URL("./frontend/entry.mjs", import.meta.url), "utf8");
  return `const quickChatOpenExport=${quickChatOpenExport.toString()};\nconst installQuickChatShortcut=${installQuickChatShortcut.toString()};\nconst createQuickChatAdapter=${createQuickChatAdapter.toString()};\nconst createSubmissionTracker=${createSubmissionTracker.toString()};\nconst createHistoryTracker=${createHistoryTracker.toString()};\n${source}`;
}
