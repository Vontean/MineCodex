import assert from "node:assert/strict";
import test from "node:test";
import { buildLaunchAgent, SERVICE_LABEL } from "../src/platform.mjs";

test("launch agent uses the exact installed Node and CLI paths without touching the app bundle", () => {
  const plist = buildLaunchAgent({
    nodePath: "/Users/example/a&b/node",
    cliPath: "/Users/example/minecodex/packages/cli/bin/mcx.mjs",
    paths: {
      serviceLogPath: "/Users/example/Library/Logs/MineCodex/runtime.log",
      serviceErrorLogPath: "/Users/example/Library/Logs/MineCodex/runtime-error.log",
    },
  });
  assert.match(plist, new RegExp(`<string>${SERVICE_LABEL}</string>`));
  assert.match(plist, /a&amp;b\/node/);
  assert.match(plist, /<string>serve<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.doesNotMatch(plist, /ChatGPT\.app|Dock|Info\.plist/);
});
