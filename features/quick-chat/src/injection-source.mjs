import {quickChatLifecycleActions, quickChatScope} from "./adapters/codex/lifecycle.mjs";
import {quickChatHistoryVisible} from "./adapters/codex/history.mjs";
import { readFile } from "node:fs/promises";
import { createQuickChatAdapter } from "./adapters/codex/renderer.mjs";
import { quickChatOpenExport, quickChatLifecycleExports, quickChatNativeCommand, installQuickChatShortcut } from "./adapters/codex/shortcut.mjs";
import { createSubmissionTracker } from "./domain/submission.mjs";
import { createQuickChatSidebarAdapter, loadQuickChatSidebarIcon } from "./adapters/codex/sidebar.mjs";
import { installQuickChatSidebar } from "./frontend/sidebar.mjs";
import { createHistoryTracker } from "./domain/history.mjs";
export async function createPageScriptSource() {
  const source = await readFile(new URL("./frontend/entry.mjs", import.meta.url), "utf8");
  const functions = [quickChatHistoryVisible, loadQuickChatSidebarIcon, createQuickChatSidebarAdapter, installQuickChatSidebar,
    quickChatLifecycleActions, quickChatScope, quickChatOpenExport, quickChatLifecycleExports, quickChatNativeCommand, installQuickChatShortcut, createQuickChatAdapter,
    createSubmissionTracker, createHistoryTracker];
  return functions.map(fn => `const ${fn.name}=${fn.toString()};`).join('\n') + '\n' + source;
}
