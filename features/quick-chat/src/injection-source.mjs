import {quickChatHistoryVisible} from "./adapters/codex/history.mjs";
import {createQuickChatExitAdapter} from "./adapters/codex/presence.mjs";
import {installQuickChatExitRepair} from "./frontend/exit.mjs";
import { readFile } from "node:fs/promises";
import { createQuickChatAdapter } from "./adapters/codex/renderer.mjs";
import { quickChatOpenExport, quickChatLifecycleExports, installQuickChatShortcut } from "./adapters/codex/shortcut.mjs";
import { createSubmissionTracker } from "./domain/submission.mjs";
import { createQuickChatPinAdapter } from "./adapters/codex/pin.mjs";
import { installQuickChatPin } from "./frontend/pin.mjs";
import { createHistoryTracker } from "./domain/history.mjs";
export async function createPageScriptSource() {
  const source = await readFile(new URL("./frontend/entry.mjs", import.meta.url), "utf8");
  return `const quickChatHistoryVisible=${quickChatHistoryVisible.toString()};\nconst createQuickChatExitAdapter=${createQuickChatExitAdapter.toString()};\nconst installQuickChatExitRepair=${installQuickChatExitRepair.toString()};\nconst createQuickChatPinAdapter=${createQuickChatPinAdapter.toString()};\nconst installQuickChatPin=${installQuickChatPin.toString()};\nconst quickChatOpenExport=${quickChatOpenExport.toString()};\nconst quickChatLifecycleExports=${quickChatLifecycleExports.toString()};\nconst installQuickChatShortcut=${installQuickChatShortcut.toString()};\nconst createQuickChatAdapter=${createQuickChatAdapter.toString()};\nconst createSubmissionTracker=${createSubmissionTracker.toString()};\nconst createHistoryTracker=${createHistoryTracker.toString()};\n${source}`;
}
