import { readFile } from "node:fs/promises";
import { createContextUsageAdapter } from "./adapters/codex/context-usage.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./session-status.mjs",import.meta.url),"utf8");
  return `const createContextUsageAdapter=${createContextUsageAdapter.toString()};\n${source}`;
}
