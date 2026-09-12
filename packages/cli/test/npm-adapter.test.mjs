import assert from "node:assert/strict";
import test from "node:test";
import { createNpmAdapter } from "../src/npm-adapter.mjs";

test("Windows npm runs its cmd shim with literal arguments and propagates exit status", async () => {
  const scripts = [];
  const npm = createNpmAdapter({ platform: "win32", execFile: async (file, args) => {
    assert.equal(file, "powershell.exe");
    scripts.push(Buffer.from(args.at(-1), "base64").toString("utf16le"));
    return { stdout: "1.0.10\n" };
  } });
  assert.equal(await npm.viewLatestVersion(), "1.0.10");
  await npm.installGlobal("C:\\Users\\O'Brien & Co\\minecodex.tgz");
  assert.match(scripts[0], /& npm\.cmd 'view' 'minecodex' 'version'; exit \$LASTEXITCODE$/);
  assert.ok(scripts[1].includes("'C:\\Users\\O''Brien & Co\\minecodex.tgz'"));
});
