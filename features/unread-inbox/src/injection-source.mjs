import { readFile } from "node:fs/promises";
import { createThreadAdapter } from "./adapters/codex/renderer.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./unread-inbox.mjs",import.meta.url),"utf8");
  return `const createThreadAdapter=${createThreadAdapter.toString()};\n${source}`;
}
