import assert from "node:assert/strict";
import { createServer } from "node:net";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/commands.mjs";

test("help exposes the stable MineCodex command surface", async () => {
  const output = [];
  await runCli(["--help"], { output: (line) => output.push(line) });
  assert.match(output.join("\n"), /mcx install/);
  assert.match(output.join("\n"), /uninstall \[--purge\]/);
  assert.match(output.join("\n"), /status \[--json\]/);
  assert.match(output.join("\n"), /restart/);
});

test("purge removes only explicit MineCodex-owned roots", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "minecodex-purge-"));
  const supportDir = path.join(homeDir, "Library", "Application Support", "MineCodex");
  const notesDataDir = path.join(homeDir, "Library", "Application Support", "CodexNotes");
  const imagesDataDir = path.join(homeDir, ".codex-image-host");
  const generatedRoot = path.join(homeDir, ".codex", "generated_images");
  for (const target of [supportDir, notesDataDir, imagesDataDir, generatedRoot]) {
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "keep-check"), "data");
  }
  const paths = { homeDir, supportDir, notesDataDir, imagesDataDir, codexPidPath: path.join(supportDir, "codex.pid") };
  const calls = [];
  const platform = {
    assertInstallSupported() {},
    terminateOwnedCodex: async () => false,
    removeService: async () => calls.push("remove-service"),
  };
  await runCli(["uninstall", "--purge"], { paths, platform, output() {} });
  assert.deepEqual(calls, ["remove-service"]);
  await assert.rejects(readFile(path.join(supportDir, "keep-check")), /ENOENT/);
  await assert.rejects(readFile(path.join(notesDataDir, "keep-check")), /ENOENT/);
  await assert.rejects(readFile(path.join(imagesDataDir, "keep-check")), /ENOENT/);
  assert.equal(await readFile(path.join(generatedRoot, "keep-check"), "utf8"), "data");
});

test("a control-port collision fails before a service PID or RuntimeHost child is created", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "minecodex-port-"));
  const supportDir = path.join(homeDir, "support");
  const blocker = createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const previousPort = process.env.MINECODEX_CONTROL_PORT;
  process.env.MINECODEX_CONTROL_PORT = String(blocker.address().port);
  const paths = {
    homeDir,
    supportDir,
    configPath: path.join(supportDir, "config.json"),
    tokenPath: path.join(supportDir, "control-token"),
    pidPath: path.join(supportDir, "service.pid"),
    dashboardDir: path.join(homeDir, "dashboard"),
    featuresRoot: path.join(homeDir, "features"),
  };
  try {
    await assert.rejects(runCli(["serve"], { paths, platform: {}, logger: { error() {}, log() {} } }), /EADDRINUSE/);
    await assert.rejects(access(paths.pidPath), /ENOENT/);
  } finally {
    if (previousPort === undefined) delete process.env.MINECODEX_CONTROL_PORT;
    else process.env.MINECODEX_CONTROL_PORT = previousPort;
    await new Promise((resolve) => blocker.close(resolve));
  }
});
