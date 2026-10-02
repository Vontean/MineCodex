import { readFile } from "node:fs/promises";
import { createThreadAdapter, createNotificationAdapter } from "./adapters/codex/renderer.mjs";
import { discoverThreadBindings, loadThreadBindings } from "./adapters/codex/modules.mjs";
import { createNotificationQueue } from "./domain/notifications.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./unread-inbox.mjs",import.meta.url),"utf8");
  return [createThreadAdapter,createNotificationAdapter,discoverThreadBindings,loadThreadBindings,createNotificationQueue]
    .map(fn=>`const ${fn.name}=${fn.toString()};`).join("\n")+"\n"+source;
}
