import { createLibraryApi } from "./adapters/codex/library-api.mjs";
import { createLibraryViewerAdapter } from "./adapters/codex/library-viewer.mjs";
import { readFile } from "node:fs/promises";
import { promptResolverSource } from "./adapters/codex/prompt-resolver-source.mjs";

// 两条 Renderer 路径共享纯规则，注入后不依赖 Node 模块闭包。
export async function createPageScriptSource() {
  const source = await readFile(new URL("./library-prompt-page.mjs", import.meta.url), "utf8");
  return `const createLibraryApi=${createLibraryApi.toString()};\nconst createLibraryViewerAdapter=${createLibraryViewerAdapter.toString()};\nconst promptFromConversation = ${promptResolverSource()};\n${source}`;
}
