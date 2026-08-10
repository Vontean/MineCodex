#!/usr/bin/env node
import { runCli } from "../src/commands.mjs";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`MineCodex: ${error.message}`);
  process.exitCode = 1;
});
