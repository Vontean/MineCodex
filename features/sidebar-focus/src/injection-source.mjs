import { readFile } from "node:fs/promises";
import { createFocusAdapter } from "./adapters/codex/renderer.mjs";
export async function createPageScriptSource() {
  const source=await readFile(new URL("./sidebar-focus.mjs",import.meta.url),"utf8");
  return `const createFocusAdapter=${createFocusAdapter.toString()};\n${source}`;
}
