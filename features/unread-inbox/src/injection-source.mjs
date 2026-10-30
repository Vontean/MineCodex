import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import { readFile } from "node:fs/promises";
import { createThreadAdapter, createNotificationAdapter, notificationVisibilityStyles } from "./adapters/codex/renderer.mjs";
import { discoverThreadBindings, loadThreadBindings } from "./adapters/codex/modules.mjs";
import { createNotificationQueue } from "./domain/notifications.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./unread-inbox.mjs",import.meta.url),"utf8");
  return [findCodexModule,createThreadAdapter,createNotificationAdapter,notificationVisibilityStyles,discoverThreadBindings,loadThreadBindings,createNotificationQueue]
    .map(fn=>`const ${fn.name}=${fn.toString()};`).join("\n")+"\n"+source;
}
