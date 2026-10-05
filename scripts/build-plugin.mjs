import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_VERSION } from "../packages/plugin/src/version.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await build({
  entryPoints: [path.join(root, "packages/plugin/src/app.mjs")],
  outfile: path.join(root, "packages/plugin/assets/app.js"),
  bundle: true, minify: true, format: "esm", target: "chrome130",
  define: { __MCX_RELEASE_VERSION__: JSON.stringify(RELEASE_VERSION) },
  plugins: [{ name: "shared-tooltip", setup(builder) {
    builder.onResolve({ filter: /^\.\/ui-tooltip\.js$/ }, () => ({ path: path.join(root, "packages/ui/src/components/tooltip.mjs") }));
  } }],
});

await build({
  entryPoints:[path.join(root,"packages/plugin/src/prompts-app.mjs")],
  outfile:path.join(root,"packages/plugin/assets/prompts.js"),bundle:true,minify:true,format:"esm",target:"chrome130",
  loader:{".css":"text"},
  define: { __MCX_RELEASE_VERSION__: JSON.stringify(RELEASE_VERSION) },
  plugins:[{name:"shared-prompts",setup(builder){
    builder.onResolve({filter:/^minecodex:prompts$/},()=>({path:"prompts",namespace:"minecodex"}));
    builder.onLoad({filter:/.*/,namespace:"minecodex"},async()=>({contents:`export function installPrompts(signal,config) {${await readFile(path.join(root,"features/notes/src/frontend/entry.mjs"),"utf8")}}`,loader:"js"}));
  }}],
});
