import assert from "node:assert/strict";
import test from "node:test";
import { createProgressReporter } from "../src/progress.mjs";

test("non-interactive progress reporter prints each step once on success", async () => {
  const output = [];
  const reporter = createProgressReporter({ output: (line) => output.push(line) });
  reporter.heading("Installing MineCodex");
  const value = await reporter.step(1, 2, "Checking your system", async () => 42);
  await reporter.step(2, 2, "Preparing your settings", async () => {});
  assert.equal(value, 42);
  assert.equal(output[0], "Installing MineCodex");
  assert.match(output[1], /\[1\/2\] Checking your system/);
  assert.match(output[2], /✓ \[1\/2\] Checking your system/);
  assert.match(output[3], /\[2\/2\] Preparing your settings/);
  assert.match(output[4], /✓ \[2\/2\] Preparing your settings/);
});

test("non-interactive progress reporter reports a failing step and rethrows", async () => {
  const output = [];
  const reporter = createProgressReporter({ output: (line) => output.push(line) });
  await assert.rejects(
    reporter.step(1, 3, "Installing the background helper", async () => {
      throw new Error("helper failed");
    }),
    /helper failed/,
  );
  assert.match(output[0], /\[1\/3\] Installing the background helper/);
  assert.match(output[1], /✗ \[1\/3\] Installing the background helper/);
});

test("interactive progress reporter renders spinner and completion in a TTY", async () => {
  const output = [];
  const reporter = createProgressReporter({
    terminalOutput: {
      isTTY: true,
      write: (chunk) => output.push(chunk),
    },
  });

  await reporter.step(1, 1, "Waiting for the background helper", async () => {});

  assert.match(output.join(""), /⠋ \[1\/1\] Waiting for the background helper/);
  assert.match(output.join(""), /✓ \[1\/1\] Waiting for the background helper/);
});
