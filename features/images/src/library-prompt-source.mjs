import { readFile } from "node:fs/promises";
import promptFromConversation from "./domain/library-prompt.mjs";

// 两条 Renderer 路径共享纯规则，注入后不依赖 Node 模块闭包。
export async function createPageScriptSource() {
  const source = await readFile(new URL("./library-prompt-page.mjs", import.meta.url), "utf8");
  return `const promptFromConversation = ${promptFromConversation.toString()};\n${source}`;
}
