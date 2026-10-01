import { readFile } from "node:fs/promises";
import { createUsageAdapter } from "./adapters/codex/renderer.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./usage-meter.mjs",import.meta.url),"utf8");
  return `const createUsageAdapter=${createUsageAdapter.toString()};\n${source}`;
}
