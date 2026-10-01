import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { get } from "node:http";
import { CodexNotesProduct } from "../src/backend/product.mjs";
import { createQuickPromptsServer } from "../src/backend/quick-prompts-server.mjs";

test("Legacy prompts migrate without changing retired tables or historic usage", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcx-prompt-migration-"));
  const databasePath = path.join(dir, "notes.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`CREATE TABLE notes (id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,pinned INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL);
    INSERT INTO notes VALUES ('saved','Title','Line 1'||char(10)||'Line 2',1,10,20,30);
    CREATE TABLE todos (body TEXT); INSERT INTO todos VALUES ('Keep todo');
    CREATE TABLE files (canonical_path TEXT); INSERT INTO files VALUES ('/missing/keep-reference');`);
  const snapshots = ["todos", "files"].map((table) =>
    legacy.prepare(`SELECT * FROM ${table}`).all(),
  );
  legacy.close();
  const product = await new CodexNotesProduct({ databasePath }).open();
  t.after(async () => {
    product.close();
    await rm(dir, { recursive: true, force: true });
  });
  const item = product.getState().prompts[0];
  assert.equal(item.body, "Line 1\nLine 2");
  assert.equal(item.id, "saved");
  assert.equal(item.useCount, 0);
  assert.equal(item.calledAt, null);
  assert.equal(
    product.db.prepare("SELECT starred FROM prompts").get().starred,
    1,
  );
  product.updatePrompt(item.id, { title: "Renamed" });
  product.getState();
  assert.deepEqual(
    ["todos", "files"].map((table) =>
      product.db.prepare(`SELECT * FROM ${table}`).all(),
    ),
    snapshots,
  );
  if (process.platform !== "win32")
    assert.equal((await stat(databasePath)).mode & 0o777, 0o600);
});

test("Prompt service rejects unsafe origins and malformed input without mutations", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcx-prompt-boundaries-"));
  const product = await new CodexNotesProduct({
    databasePath: path.join(dir, "test.sqlite"),
  }).open();
  assert.throws(
    () => createQuickPromptsServer({ product, host: "0.0.0.0" }),
    /Loopback/,
  );
  const server = createQuickPromptsServer({ product, port: 0 });
  await server.listen();
  t.after(async () => {
    await server.close();
    product.close();
    await rm(dir, { recursive: true, force: true });
  });
  const initial = product.revision;
  for (const body of [
    null,
    [],
    {},
    { body: " " },
    { body: "valid", categoryId: "missing" },
    { body: "valid", emoji: "plain text" },
  ]) {
    const r = await fetch(server.origin + "/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(r.status, 400);
  }
  assert.equal(
    await new Promise((resolve, reject) => {
      get(
        server.origin + "/api/state",
        { headers: { Host: "foreign.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      ).on("error", reject);
    }),
    403,
  );
  assert.equal(
    (
      await fetch(server.origin + "/api/state", {
        headers: { Origin: "https://foreign.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(server.origin + "/api/prompts", {
        method: "POST",
        body: "{}",
      })
    ).status,
    415,
  );
  assert.equal(product.revision, initial);
  const saved = product.createPrompt({
    body: "\nFirst line\nSecond line",
  }).item;
  assert.equal(saved.summary, "First line");
  assert.throws(() => product.updatePrompt(saved.id, { starred: true }));
  assert.throws(() => product.updatePrompt(saved.id, { useCount: 99 }));
  assert.throws(() => product.updatePrompt(saved.id, {}));
});

test("Built-in prompts seed once; edits, deletions and personal prompts survive reopening", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcx-prompt-defaults-"));
  const databasePath = path.join(dir, "notes.sqlite");
  let product = await new CodexNotesProduct({ databasePath }).open();
  t.after(async () => { product.close(); await rm(dir, { recursive: true, force: true }); });
  const defaults = product.getState().prompts;
  assert.equal(defaults.length, 24);
  assert.equal(new Set(defaults.map(p => p.id)).size, 24);
  for (const p of defaults) {
    assert.ok(p.body.trim());
    assert.ok(p.emoji);
    assert.ok(product.listPromptCategories().some(c => c.id === p.categoryId));
    product.promptMetadata({ emoji: p.emoji });
    assert.equal(p.useCount, 0);
    assert.equal(p.calledAt, null);
  }
  product.updatePrompt("dsh-fp", { body: "My own adaptation" });
  product.deletePrompt("dsh-socratic");
  product.deletePromptCategory("thinking");
  const personal = product.createPrompt({ title: "Private", body: "Local only", emoji: "🔒" }).item;
  const revision = product.revision;
  product.close();
  product = await new CodexNotesProduct({ databasePath }).open();
  assert.equal(product.revision, revision);
  const state = product.getState();
  assert.equal(state.prompts.length, 24);
  assert.equal(state.prompts.find(p => p.id === "dsh-fp").body, "My own adaptation");
  assert.equal(state.prompts.find(p => p.id === "dsh-fp").categoryId, null);
  assert.ok(!state.prompts.some(p => p.id === "dsh-socratic"));
  assert.ok(!state.categories.some(c => c.id === "thinking"));
  assert.deepEqual(state.prompts.find(p => p.id === personal.id), personal);
});
