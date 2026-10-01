import { readFile } from "node:fs/promises";
import { createSitesAdapter } from "./adapters/codex/renderer.mjs";

export async function createPageScriptSource() {
  const source=await readFile(new URL("./frontend/entry.mjs",import.meta.url),"utf8");
  return `const createSitesAdapter = ${createSitesAdapter.toString()};\n${source}`;
}
