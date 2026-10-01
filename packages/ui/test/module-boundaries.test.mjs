import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const featureRoot = new URL("../../../features/", import.meta.url);
const uiRoot = new URL("../src/", import.meta.url);
async function modules(directory) {
  const found = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) found.push(...await modules(file));
    else if (entry.name.endsWith(".mjs")) found.push(file);
  }
  return found;
}
function* nodes(node, parent = null) {
  if (!node?.type) return;
  yield {node, parent};
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) yield* nodes(child, node);
    } else if (value?.type) yield* nodes(value, node);
  }
}
function imports(ast) {
  return [...nodes(ast)].flatMap(({node}) => {
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)) return node.source ? [node.source.value] : [];
    if (node.type === "ImportExpression") return [node.source.type === "Literal" ? node.source.value : null];
    return [];
  });
}
function inside(directory, target) {
  const relative = path.relative(fileURLToPath(directory), fileURLToPath(target));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
const parseModule = source => parse(source, {ecmaVersion:"latest", sourceType:"module"});
async function features() {
  const result = [];
  for (const entry of await readdir(featureRoot, {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    const directory = new URL(`${entry.name}/`, featureRoot);
    const manifest = JSON.parse(await readFile(new URL("codex-feature.json", directory), "utf8"));
    result.push({directory, manifest});
  }
  return result;
}
const registered = await features();

test("shared UI has no dependency on host transport or plugin business, including re-exports and dynamic imports", async () => {
  for (const file of await modules(uiRoot)) {
    for (const specifier of imports(parseModule(await readFile(file, "utf8")))) {
      assert.ok(typeof specifier === "string" && specifier.startsWith("."), `${file.pathname} adds a runtime dependency`);
      assert.ok(inside(uiRoot, new URL(specifier, file)), `${file.pathname} imports outside UI`);
    }
  }
});

test("all discovered domain modules exclude IO, presentation and host dependencies", async () => {
  let count = 0;
  const externalGlobals = new Set(["window", "document", "fetch", "localStorage", "process", "MutationObserver", "navigator", "require"]);
  for (const {directory} of registered) {
    const domain = new URL("src/domain/", directory);
    let files;
    try { files = await modules(domain); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const file of files) {
      count++;
      const ast = parseModule(await readFile(file, "utf8"));
      for (const specifier of imports(ast)) {
        if (specifier === "node:path") continue;
        assert.ok(typeof specifier === "string" && specifier.startsWith("."), `${file.pathname} imports external IO or an adapter`);
        assert.ok(inside(domain, new URL(specifier, file)), `${file.pathname} imports outside its domain`);
      }
      for (const {node, parent} of nodes(ast)) {
        if (node.type !== "Identifier" || !externalGlobals.has(node.name)) continue;
        if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) continue;
        if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) continue;
        assert.fail(`${file.pathname} references external environment ${node.name}`);
      }
    }
  }
  assert.ok(count >= 4, "the current four domain modules must be discovered");
});

test("registered renderer entries and frontend modules do not import Node, host or backend modules", async () => {
  for (const {directory, manifest} of registered) {
    const frontend = new URL("src/frontend/", directory);
    const candidates = new Map();
    try { for (const file of await modules(frontend)) candidates.set(file.href, false); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (manifest.entry?.kind === "page-script") candidates.set(new URL(manifest.entry.script, directory).href, true);
    for (const [href, body] of candidates) {
      const file = new URL(href);
      const source = await readFile(file, "utf8");
      const ast = parseModule(body ? `function pageScript(signal, config) {${source}\n}` : source);
      for (const specifier of imports(ast)) {
        // 原生 Renderer 资源地址从当前 DOM/API 发现，不是 Node 或业务模块导入。
        if (specifier === null) continue;
        assert.ok(specifier.startsWith("."), `${file.pathname} imports a Node or external module`);
        const target = new URL(specifier, file);
        assert.ok(inside(frontend, target) || inside(new URL("src/domain/", directory), target), `${file.pathname} imports backend, host or another feature`);
      }
    }
  }
});

test("active plugins do not copy common Tooltip material", async () => {
  for (const {directory, manifest} of registered) {
    if (manifest.entry?.kind !== "page-script") continue;
    const sources = [manifest.entry.script, ...Object.values(manifest.entry.resources ?? {}).filter(file => file.endsWith(".css"))];
    for (const resource of sources) {
      const source = await readFile(new URL(resource, directory), "utf8");
      assert.doesNotMatch(source, /--(?:color-border-tooltip|color-background-tooltip|shadow-tooltip)/, `${manifest.id} owns duplicated Tooltip material in ${resource}`);
    }
  }
});

test("domain rules do not interpret native Codex event or conversation schemas",async()=>{
  for (const {directory} of registered) {
    let files;try {files=await modules(new URL('src/domain/',directory));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    for(const file of files) assert.doesNotMatch(await readFile(file,'utf8'),/\b(event_msg|response_item|token_usage_record|origination_message_id|image_asset_pointer|replacement_history)\b|\.mapping\b/,file.pathname);
  }
});
test("registered interaction entries do not discover React, query clients or native bundle APIs",async()=>{
  for (const {directory,manifest} of registered) {
    if(manifest.entry.kind!=='page-script')continue;
    const source=await readFile(new URL(manifest.entry.script,directory),'utf8');
    assert.doesNotMatch(source,/__reactFiber|__reactProps|\.safeGet\(|\.safePost\(|getQueryData\(|getQueryCache\(|state_5\.sqlite/,manifest.id);
  }
  const model=await readFile(new URL('../../../features/model-slider/src/frontend/install.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(model,/__reactFiber|__reactProps|fetch\(/);
});
