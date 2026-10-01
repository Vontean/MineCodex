import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EDITOR_TOKEN_NAMES } from "../../../packages/ui/src/native/tokens.mjs";

test("images editor token whitelist stays identical to the runtime-host design contract", async () => {
  const app = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  const start = app.indexOf("const editorTokens = [");
  const end = app.indexOf("];", start);
  const raw = app.slice(start + "const editorTokens = [".length, end);
  const appNames = raw.split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter((x) => x.startsWith("--"));
  assert.deepEqual(appNames, EDITOR_TOKEN_NAMES);
});
