#!/usr/bin/env node

import os from "node:os";
import path from "node:path";

import { createCodexNotesServer } from "./http-server.mjs";
import { CodexNotesProduct } from "./product.mjs";

const host = process.env.CODEX_NOTES_HOST ?? "127.0.0.1";
const port = Number(process.env.CODEX_NOTES_PORT ?? "47832");
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error("CODEX_NOTES_PORT must be an integer between 0 and 65535");
}
const dataDirectory = process.env.CODEX_NOTES_DATA_DIR
  ? path.resolve(process.env.CODEX_NOTES_DATA_DIR)
  : path.join(os.homedir(), "Library", "Application Support", "CodexNotes");
const databasePath = process.env.CODEX_NOTES_DATABASE
  ? path.resolve(process.env.CODEX_NOTES_DATABASE)
  : path.join(dataDirectory, "codex-notes.sqlite");

const product = await new CodexNotesProduct({ databasePath }).open();
let app;

try {
  app = createCodexNotesServer({ product, host, port });
  await app.listen();
} catch (error) {
  product.close();
  throw error;
}

process.stdout.write(`${JSON.stringify({
  event: "codex-notes:ready",
  origin: app.origin,
  databasePath,
})}\n`);

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  await app.close();
  product.close();
  process.stdout.write(`${JSON.stringify({ event: "codex-notes:stopped", signal })}\n`);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop(signal).then(() => process.exit(0), (error) => {
      console.error(error);
      process.exit(1);
    });
  });
}
