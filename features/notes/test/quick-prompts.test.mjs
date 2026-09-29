import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexNotesProduct } from "../src/product.mjs";
import { createQuickPromptsServer } from "../src/quick-prompts-server.mjs";

test("Quick Prompts reuses saved prompts and exposes no Todo, Files, or old pages", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcx-prompts-"));
  const databasePath = path.join(dir, "notes.sqlite");
  const old = await new CodexNotesProduct({ databasePath }).open();
  const saved = old.createPrompt({
    title: "Existing",
    body: "Keep this prompt",
  });
  old.db.exec(
    "CREATE TABLE todos (body TEXT); INSERT INTO todos VALUES ('Keep historical data');",
  );
  old.close();
  const product = await new CodexNotesProduct({ databasePath }).open();
  const server = createQuickPromptsServer({ product, port: 0 });
  await server.listen();
  t.after(async () => {
    await server.close();
    product.close();
    await rm(dir, { recursive: true, force: true });
  });
  const request = (route, method = "GET", value) =>
    fetch(server.origin + route, {
      method,
      headers: { "Content-Type": "application/json", Origin: "app://-" },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
  const response = await request("/api/state");
  assert.equal(response.headers.get("access-control-allow-origin"), "app://-");
  const state = await response.json();
  assert.deepEqual(Object.keys(state).sort(), [
    "categories",
    "emojis",
    "icons",
    "prompts",
    "revision",
  ]);
  assert.equal(state.prompts.find(p => p.id === saved.item.id).id, saved.item.id);
  for (const route of [
    "/",
    "/?surface=todo",
    "/app.js",
    "/api/todos",
    "/api/files",
    "/api/files/pick",
  ]) {
    assert.equal((await request(route)).status, 404);
  }
  assert.equal(
    (await request("/api/todos", "POST", { body: "obsolete" })).status,
    404,
  );
  const created = await (
    await request("/api/prompts", "POST", {
      title: "New",
      body: "Line 1\nLine 2",
    })
  ).json();
  const itemPath = `/api/prompts/${created.item.id}`;
  assert.equal(
    (await request(itemPath, "PATCH", { title: "Renamed" })).status,
    200,
  );
  assert.equal(
    (
      await request(itemPath + "/use", "POST", {
        action: "insert",
        success: true,
      })
    ).status,
    200,
  );
  assert.equal((await request(itemPath, "DELETE")).status, 204);
  assert.equal(
    (
      await fetch(server.origin + "/api/prompts", {
        method: "POST",
        headers: {
          Origin: "https://foreign.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: "blocked" }),
      })
    ).status,
    403,
  );
  assert.equal(
    product.db.prepare("SELECT COUNT(*) AS count FROM todos").get().count,
    1,
  );
});

test("Quick Prompts manifest retires toolbar surfaces and script compiles as an installer", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../codex-feature.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.entry.kind, "page-script");
  assert.equal(manifest.label.en, "Prompts");
  assert.equal(manifest.pinnedSummary, undefined);
  assert.equal(manifest.detailTabs, undefined);
  assert.deepEqual(manifest.hostActions, ["quick-prompts"]);
  const source = await readFile(
    new URL("../src/quick-prompts-page.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotThrow(() => new Function("signal", "config", source));
});

test("Prompt categories, ordering, emoji and successful insert counts persist independently of edits", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mcx-prompt-stats-"));
  const databasePath = path.join(dir, "notes.sqlite");
  let now = 1000;
  let product = await new CodexNotesProduct({
    databasePath,
    clock: () => ++now,
  }).open();
  t.after(async () => {
    product.close();
    await rm(dir, { recursive: true, force: true });
  });
  const category = product.savePromptCategory(null, {
    name: "Research",
    icon: "flask",
    color: "blue",
  }).item;
  const a = product.createPrompt({
    title: "A",
    body: "one",
    categoryId: category.id,
    emoji: "👨‍💻",
  }).item;
  const b = product.createPrompt({
    title: "B",
    body: "two",
    categoryId: category.id,
  }).item;
  assert.equal(a.useCount, 0);
  assert.equal(a.calledAt, null);
  product.updatePrompt(a.id, { body: "edited", emoji: "💡" });
  product.markPromptUsed(a.id, { action: "copy", success: true });
  assert.throws(() =>
    product.markPromptUsed(a.id, { action: "insert", success: false }),
  );
  let state = await product.getState();
  assert.equal(state.prompts.find((p) => p.id === a.id).useCount, 0);
  product.markPromptUsed(a.id, { action: "insert", success: true });
  product.markPromptUsed(a.id, { action: "insert", success: true });
  const calledAt = (await product.getState()).prompts.find(
    (p) => p.id === a.id,
  ).calledAt;
  product.updatePrompt(a.id, { title: "Renamed" });
  product.reorderPrompts({ categoryId: category.id, ids: [b.id, a.id] });
  assert.throws(() =>
    product.reorderPrompts({ categoryId: category.id, ids: [a.id, a.id] }),
  );
  assert.throws(() =>
    product.reorderPrompts({ categoryId: category.id, ids: [a.id] }),
  );
  assert.throws(() => product.updatePrompt(a.id, { categoryId: "missing" }));
  assert.throws(() => product.updatePrompt(a.id, { emoji: "hello" }));
  assert.throws(() =>
    product.savePromptCategory(null, {
      name: "bad",
      icon: "fake",
      color: "blue",
    }),
  );
  const categoryIds = product
    .listPromptCategories()
    .map((c) => c.id)
    .reverse();
  product.reorderPrompts({ ids: categoryIds, categories: true });
  product.close();
  product = await new CodexNotesProduct({
    databasePath,
    clock: () => ++now,
  }).open();
  state = await product.getState();
  const saved = state.prompts.find((p) => p.id === a.id);
  assert.equal(saved.useCount, 2);
  assert.equal(saved.calledAt, calledAt);
  assert.equal(saved.emoji, "💡");
  assert.equal(saved.categoryId, category.id);
  assert.equal(saved.sortOrder, 1);
  assert.deepEqual(
    product.listPromptCategories().map((c) => c.id),
    categoryIds,
  );
  product.deletePromptCategory(category.id);
  state = await product.getState();
  assert.equal(state.prompts.length, 26);
  assert.equal(state.prompts.find((p) => p.id === a.id).categoryId, null);
  assert.equal(state.prompts.find((p) => p.id === a.id).useCount, 2);
  // 删除所有分类后重启也不会再次填充默认分类。
  product
    .listPromptCategories()
    .forEach((c) => product.deletePromptCategory(c.id));
  product.close();
  product = await new CodexNotesProduct({ databasePath }).open();
  assert.deepEqual(product.listPromptCategories(), []);
});

test("Prompts localizes appearance labels and errors without modifying saved content", async () => {
  const source = await readFile(new URL("../src/quick-prompts-page.mjs", import.meta.url), "utf8");
  const helpers = source.slice(source.indexOf("const appearanceLabels ="), source.indexOf("// DOM 与图标工具"));
  const read = cn => new Function("text", `${helpers}; return {appearanceLabel, errorMessage};`)((en, zh) => cn ? zh : en);
  assert.equal(read(true).appearanceLabel("terminal"), "终端");
  assert.equal(read(true).appearanceLabel("blue"), "蓝色");
  assert.equal(read(false).appearanceLabel("terminal"), "terminal");
  assert.equal(read(true).errorMessage({message:"Prompt was not found"}), "未找到该提示词");
  assert.equal(read(false).errorMessage({message:"Prompt was not found"}), "Prompt was not found");
});
