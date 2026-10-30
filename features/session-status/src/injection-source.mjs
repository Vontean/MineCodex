import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import { readFile } from "node:fs/promises";
import { contextUsageExport, createContextUsageAdapter } from "./adapters/codex/context-usage.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./session-status.mjs",import.meta.url),"utf8");
  return `const findCodexModule=${findCodexModule.toString()};\nconst contextUsageExport=${contextUsageExport.toString()};\nconst createContextUsageAdapter=${createContextUsageAdapter.toString()};\n${source}`;
}
