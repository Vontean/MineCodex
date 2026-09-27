import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = new Set([
  // 保留的旧版图片源注入脚本未在当前 manifest 中启用。
  path.join(root, "features/images/src/chatgpt-image-source-page.mjs"),
]);
for (const feature of await readdir(path.join(root, "features"), { withFileTypes:true })) {
  if (!feature.isDirectory()) continue;
  const directory = path.join(root, "features", feature.name);
  const manifest = JSON.parse(await readFile(path.join(directory, "codex-feature.json"), "utf8"));
  for (const source of [manifest.entry?.script, manifest.pageScript?.resource]) {
    if (source) scripts.add(path.resolve(directory, source));
  }
}
let count = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    if (["node_modules", "vendor", ".git"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
      // 注入脚本在函数内执行，允许返回清理函数；普通模块仍使用模块语法。
      try {
        const source = await readFile(file, "utf8");
        if (scripts.has(file)) new Function("signal", "config", source);
        else parse(source, {ecmaVersion:"latest", sourceType:"module"});
        count++;
      } catch (error) {
        throw new Error(`${path.relative(root, file)}: ${error.message}`);
      }
    }
  }
}
for (const directory of ["packages", "features", "apps", "scripts"]) await check(path.join(root, directory));
console.log(`Syntax checked ${count} JavaScript files.`);
