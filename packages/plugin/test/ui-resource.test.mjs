import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parse } from "acorn";
import { createAppHtml } from "../src/ui-resource.mjs";
import { PACKAGE_ROOT } from "../../cli/src/paths.mjs";

test("control panel HTML preserves the actual bundle and compiles as an inline module", async () => {
  const bundle = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
  const html = await createAppHtml(PACKAGE_ROOT);
  const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.equal(inline, bundle.replaceAll("</script", "<\\/script"));
  assert.doesNotThrow(() => parse(inline, { ecmaVersion: "latest", sourceType: "module" }));
  assert.ok(html.includes('<main class="shell">'));
  assert.equal(html.includes('src="/app.js'), false);
});
