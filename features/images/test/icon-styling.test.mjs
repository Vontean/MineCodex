import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses Codex's 1px visual weight for all 24px outline icons", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /icon\.setAttribute\("stroke-width", "1\.5"\)/);
  assert.doesNotMatch(app, /icon\.setAttribute\("stroke-width", "2"\)/);
  assert.match(styles, /\.lucide\s*\{[^}]*stroke-width:\s*1\.5;/s);
  assert.doesNotMatch(styles, /\.lucide\s*\{[^}]*stroke-width:\s*2;/s);
});
