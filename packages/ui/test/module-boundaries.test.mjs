import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { parse } from "acorn";

async function modules(directory) {
  const found=[];
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const file = new URL(entry.name+(entry.isDirectory()?"/":""),directory);
    if (entry.isDirectory()) found.push(...await modules(file));
    else if (entry.name.endsWith(".mjs")) found.push(file);
  }
  return found;
}
test("shared UI has no dependency on host transport or plugin business", async () => {
  for (const file of await modules(new URL("../src/",import.meta.url))) {
    const ast=parse(await readFile(file,"utf8"),{ecmaVersion:"latest",sourceType:"module"});
    for (const node of ast.body.filter(node=>node.type==="ImportDeclaration")) {
      const specifier=node.source.value;
      assert.ok(!specifier.startsWith("node:"),`${file.pathname} imports Node`);
      assert.ok(specifier.startsWith("."),`${file.pathname} adds a runtime dependency`);
      const target=new URL(specifier,file);
      assert.ok(target.pathname.includes("/packages/ui/src/"),`${file.pathname} imports outside UI`);
    }
  }
});

test("domain rules do not import IO, presentation or host transport", async () => {
  for (const feature of ["sites","session-status"]) {
    for (const file of await modules(new URL(`../../../features/${feature}/src/domain/`,import.meta.url))) {
      const ast=parse(await readFile(file,"utf8"),{ecmaVersion:"latest",sourceType:"module"});
      for (const node of ast.body.filter(node=>node.type==="ImportDeclaration")) {
        const specifier=node.source.value;
        if (specifier.startsWith("node:")) {
          assert.equal(specifier,"node:path",`${file.pathname} owns external IO`);
        } else {
          assert.ok(specifier.startsWith("."),`${file.pathname} imports an external adapter`);
          assert.ok(new URL(specifier,file).pathname.includes(`/features/${feature}/src/domain/`),`${file.pathname} imports outside its domain`);
        }
      }
    }
  }
});
