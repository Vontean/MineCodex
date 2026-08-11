import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createCodexNotesServer, revealFileInSystemManager } from "../src/http-server.mjs";
import { CodexNotesProduct, ProductError } from "../src/product.mjs";

async function createFixture({ filePicker, fileRevealer, productOptions = {} } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codexnotes-product-"));
  let time = 1_000;
  const databasePath = path.join(directory, "codex-notes.sqlite");
  const product = await new CodexNotesProduct({
    databasePath,
    clock: () => ++time,
    fileCleanupIntervalMs: 0,
    ...productOptions,
  }).open();
  const server = createCodexNotesServer({ product, port: 0, filePicker, fileRevealer });
  await server.listen();

  async function request(route, { method = "GET", body } = {}) {
    const response = await fetch(`${server.origin}${route}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = response.status === 204 ? null : await response.json();
    return { response, payload };
  }

  return {
    directory,
    databasePath,
    product,
    server,
    request,
    async close({ keepDirectory = false } = {}) {
      await server.close();
      product.close();
      if (!keepDirectory) await rm(directory, { recursive: true, force: true });
    },
  };
}

class SseClient {
  constructor(response, controller) {
    this.reader = response.body.getReader();
    this.decoder = new TextDecoder();
    this.buffer = "";
    this.controller = controller;
  }

  static async connect(origin) {
    const controller = new AbortController();
    const response = await fetch(`${origin}/api/events`, { signal: controller.signal });
    assert.equal(response.status, 200);
    return new SseClient(response, controller);
  }

  async next(type) {
    while (true) {
      const boundary = this.buffer.indexOf("\n\n");
      if (boundary >= 0) {
        const block = this.buffer.slice(0, boundary);
        this.buffer = this.buffer.slice(boundary + 2);
        const event = block.match(/^event: (.+)$/m)?.[1] ?? "message";
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (event === type && data) return JSON.parse(data);
        continue;
      }
      const { done, value } = await this.reader.read();
      if (done) throw new Error(`SSE stream closed before ${type}`);
      this.buffer += this.decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
    }
  }

  close() {
    this.controller.abort();
  }
}

test("System file-manager reveal uses native macOS and Windows argument arrays", async () => {
  const calls = [];
  const executeFile = async (command, args) => calls.push({ command, args });

  await revealFileInSystemManager("/Users/example/File with spaces.md", {
    platform: "darwin",
    executeFile,
  });
  await revealFileInSystemManager("C:\\Users\\示例\\File with spaces.md", {
    platform: "win32",
    executeFile,
  });

  assert.deepEqual(calls, [
    { command: "/usr/bin/open", args: ["-R", "/Users/example/File with spaces.md"] },
    { command: "explorer.exe", args: ["/select,", "C:\\Users\\示例\\File with spaces.md"] },
  ]);
  await assert.rejects(
    revealFileInSystemManager("/tmp/example.md", { platform: "linux", executeFile }),
    (error) => error.code === "REVEAL_UNAVAILABLE" && error.status === 501,
  );
});

test("HTTP boundaries reject unsafe hosts, malformed ids, and non-object JSON", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codexnotes-http-boundaries-"));
  const databasePath = path.join(directory, "codex-notes.sqlite");
  const product = await new CodexNotesProduct({
    databasePath,
  }).open();
  try {
    if (process.platform !== "win32") {
      assert.equal((await stat(databasePath)).mode & 0o777, 0o600);
    }
    assert.throws(
      () => createCodexNotesServer({ product, host: "0.0.0.0", port: 0 }),
      /only supports loopback hosts/,
    );
    const server = createCodexNotesServer({ product, port: 0 });
    await server.listen();
    try {
      const localPort = new URL(server.origin).port;
      for (const origin of [`http://localhost:${localPort}`, `https://127.0.0.1:${localPort}`]) {
        const response = await fetch(`${server.origin}/api/todos`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ body: "Blocked" }),
        });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error.code, "ORIGIN_NOT_ALLOWED");
      }
      for (const [route, method, body, code] of [
        ["/api/todos", "POST", "null", "INVALID_BODY"],
        ["/api/todos/reorder", "POST", "null", "INVALID_BODY"],
        ["/api/todos/%", "DELETE", undefined, "INVALID_ID"],
      ]) {
        const response = await fetch(`${server.origin}${route}`, {
          method,
          headers: body === undefined ? undefined : { "content-type": "application/json" },
          body,
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, code);
      }

      const created = await fetch(`${server.origin}/api/todos`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: server.origin },
        body: JSON.stringify({ body: "Keep me" }),
      }).then((response) => response.json());
      const revision = product.revision;
      for (const body of [{}, { unsupported: true }]) {
        const response = await fetch(`${server.origin}/api/todos/${created.item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, "INVALID_CHANGES");
      }
      assert.equal(product.revision, revision, "Rejected PATCH requests do not emit revisions");
    } finally {
      await server.close();
    }
  } finally {
    product.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Todo order, Completed lifecycle, restoration, and direct cleanup persist", async () => {
  const fixture = await createFixture();
  try {
    const first = (await fixture.request("/api/todos", {
      method: "POST",
      body: { body: "First" },
    })).payload.item;
    const second = (await fixture.request("/api/todos", {
      method: "POST",
      body: { body: "Second" },
    })).payload.item;
    let state = (await fixture.request("/api/state")).payload;
    assert.deepEqual(state.todos.active.map((item) => item.body), ["Second", "First"]);

    await fixture.request("/api/todos/reorder", {
      method: "POST",
      body: { ids: [first.id, second.id] },
    });
    const third = (await fixture.request("/api/todos", {
      method: "POST",
      body: { body: "Third" },
    })).payload.item;
    state = (await fixture.request("/api/state")).payload;
    assert.deepEqual(state.todos.active.map((item) => item.id), [third.id, first.id, second.id]);

    await fixture.request(`/api/todos/${first.id}`, {
      method: "PATCH",
      body: { body: "First edited", completed: true },
    });
    state = (await fixture.request("/api/state")).payload;
    assert.deepEqual(state.todos.active.map((item) => item.id), [third.id, second.id]);
    assert.deepEqual(state.todos.completed.map((item) => item.body), ["First edited"]);
    const activePlan = fixture.product.db.prepare(`
      EXPLAIN QUERY PLAN SELECT * FROM todos WHERE completed_at IS NULL
      ORDER BY sort_order ASC, created_at DESC
    `).all().map((row) => row.detail).join("\n");
    const completedPlan = fixture.product.db.prepare(`
      EXPLAIN QUERY PLAN SELECT * FROM todos WHERE completed_at IS NOT NULL
      ORDER BY completed_at DESC, updated_at DESC
    `).all().map((row) => row.detail).join("\n");
    assert.match(activePlan, /todos_active_display_order/);
    assert.match(completedPlan, /todos_completed_order/);
    assert.doesNotMatch(`${activePlan}\n${completedPlan}`, /USE TEMP B-TREE/);

    await fixture.request(`/api/todos/${first.id}`, {
      method: "PATCH",
      body: { completed: false },
    });
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.todos.active[0].id, first.id);

    await fixture.request(`/api/todos/${first.id}`, {
      method: "PATCH",
      body: { completed: true },
    });
    const cleared = await fixture.request("/api/todos/completed", { method: "DELETE" });
    assert.equal(cleared.payload.removed, 1);
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.todos.completed.length, 0);

    const deleted = await fixture.request(`/api/todos/${second.id}`, { method: "DELETE" });
    assert.equal(deleted.response.status, 204);
    assert.equal((await fixture.request(`/api/todos/${second.id}`, { method: "DELETE" })).response.status, 404);
  } finally {
    await fixture.close();
  }
});

test("Prompts preserve multiline text, derive summaries, and sort by Star and successful use", async () => {
  const fixture = await createFixture();
  try {
    const first = (await fixture.request("/api/prompts", {
      method: "POST",
      body: { title: "", body: "\nFirst visible line\nSecond line" },
    })).payload.item;
    const second = (await fixture.request("/api/prompts", {
      method: "POST",
      body: { title: "Named", body: "Exact\nmultiline\nbody" },
    })).payload.item;
    assert.equal(first.summary, "First visible line");
    assert.equal(second.body, "Exact\nmultiline\nbody");

    await fixture.request(`/api/prompts/${first.id}`, {
      method: "PATCH",
      body: { starred: true },
    });
    let state = (await fixture.request("/api/state")).payload;
    assert.equal(state.prompts[0].id, first.id);
    assert.equal(state.prompts[0].starred, true);

    const failedUse = await fixture.request(`/api/prompts/${second.id}/use`, {
      method: "POST",
      body: { action: "copy", success: false },
    });
    assert.equal(failedUse.response.status, 400);
    await fixture.request(`/api/prompts/${second.id}/use`, {
      method: "POST",
      body: { action: "insert", success: true },
    });
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.prompts[0].id, first.id, "Starred stays before recent unstarred Prompts");

    await fixture.request(`/api/prompts/${first.id}`, {
      method: "PATCH",
      body: { starred: false },
    });
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.prompts[0].id, second.id, "Successful use controls unstarred recency");

    await fixture.request(`/api/prompts/${first.id}`, {
      method: "PATCH",
      body: { title: "Edited", body: first.body },
    });
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.prompts[0].id, first.id, "Successful edit updates recency");
    assert.equal(state.prompts[0].title, "Edited");

    assert.equal((await fixture.request(`/api/prompts/${second.id}`, { method: "DELETE" })).response.status, 204);
    assert.equal((await fixture.request("/api/state")).payload.prompts.length, 1);
  } finally {
    await fixture.close();
  }
});

test("Legacy Notes SQLite data migrates transactionally to Prompts and Starred", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codexnotes-legacy-prompts-"));
  const databasePath = path.join(directory, "codex-notes.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX notes_display_order
      ON notes (pinned DESC, last_used_at DESC, created_at DESC);
    INSERT INTO notes VALUES ('legacy-prompt', 'Saved', 'Existing body', 1, 10, 11, 12);
  `);
  legacy.close();

  const product = await new CodexNotesProduct({ databasePath }).open();
  try {
    const state = await product.getState();
    assert.deepEqual(state.prompts.map(({ id, title, body, starred }) => ({ id, title, body, starred })), [{
      id: "legacy-prompt",
      title: "Saved",
      body: "Existing body",
      starred: true,
    }]);
    assert.equal(product.db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'notes'").get(), undefined);
    assert.deepEqual(
      product.db.prepare("PRAGMA table_info(prompts)").all().map((column) => column.name),
      ["id", "title", "body", "starred", "created_at", "updated_at", "last_used_at"],
    );
  } finally {
    product.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Files canonicalize, deduplicate, reorder on successful call, reveal in the file manager, and never delete bytes", async () => {
  let pickedPaths = [];
  const revealedPaths = [];
  const fixture = await createFixture({
    filePicker: async () => ({ cancelled: false, paths: pickedPaths }),
    fileRevealer: async (filePath) => {
      revealedPaths.push(filePath);
      if (path.basename(filePath) === "beta.txt") {
        throw new ProductError("The file manager could not reveal this file", {
          code: "REVEAL_FAILED",
          status: 409,
        });
      }
      return { revealed: true };
    },
  });
  try {
    const sourceA = path.join(fixture.directory, "alpha.md");
    const sourceB = path.join(fixture.directory, "beta.txt");
    const sourceImage = path.join(fixture.directory, "preview.png");
    const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await writeFile(sourceA, "alpha bytes");
    await writeFile(sourceB, "beta bytes");
    await writeFile(sourceImage, imageBytes);
    pickedPaths = [sourceA];

    const directoryResult = await fixture.request("/api/files", {
      method: "POST",
      body: { paths: [fixture.directory] },
    });
    assert.equal(directoryResult.payload.rejected[0].code, "DIRECTORY_NOT_ALLOWED");

    const pickerResult = await fixture.request("/api/files/pick", {
      method: "POST",
      body: {},
    });
    assert.equal(pickerResult.payload.cancelled, false);
    const addedA = pickerResult.payload.added[0];
    const duplicate = await fixture.request("/api/files", {
      method: "POST",
      body: { paths: [sourceA] },
    });
    assert.equal(duplicate.payload.added.length, 0);
    assert.equal(duplicate.payload.existing[0].id, addedA.id);
    const addedB = (await fixture.request("/api/files", {
      method: "POST",
      body: { paths: [sourceB] },
    })).payload.added[0];
    let state = (await fixture.request("/api/state")).payload;
    assert.deepEqual(state.files.map((file) => file.id), [addedB.id, addedA.id]);

    const failedUse = await fixture.request(`/api/files/${addedA.id}/use`, {
      method: "POST",
      body: { action: "attach", success: false },
    });
    assert.equal(failedUse.response.status, 400);
    assert.deepEqual((await fixture.request("/api/state")).payload.files.map((file) => file.id), [addedB.id, addedA.id]);
    await fixture.request(`/api/files/${addedA.id}/use`, {
      method: "POST",
      body: { action: "attach", success: true },
    });
    assert.equal((await fixture.request("/api/state")).payload.files[0].id, addedA.id);

    state = (await fixture.request("/api/state")).payload;
    const revisionBeforeReveal = state.revision;
    const orderBeforeReveal = state.files.map((file) => file.id);
    const revealed = await fixture.request(`/api/files/${addedA.id}/reveal`, { method: "POST" });
    assert.equal(revealed.response.status, 200);
    assert.deepEqual(revealed.payload, { revealed: true });
    assert.deepEqual(revealedPaths, [addedA.path]);
    assert.equal(await readFile(sourceA, "utf8"), "alpha bytes");
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.revision, revisionBeforeReveal, "Revealing a file does not mutate product state");
    assert.deepEqual(state.files.map((file) => file.id), orderBeforeReveal, "File-manager reveal does not change recency");
    const missingReveal = await fixture.request("/api/files/not-found/reveal", { method: "POST" });
    assert.equal(missingReveal.response.status, 404);
    assert.deepEqual(revealedPaths, [addedA.path], "Unknown metadata never reaches the file-manager adapter");
    const failedReveal = await fixture.request(`/api/files/${addedB.id}/reveal`, { method: "POST" });
    assert.equal(failedReveal.response.status, 409);
    assert.equal(failedReveal.payload.error.code, "REVEAL_FAILED");
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.revision, revisionBeforeReveal, "A file-manager adapter failure does not mutate product state");
    assert.deepEqual(state.files.map((file) => file.id), orderBeforeReveal);
    assert.equal(await readFile(sourceB, "utf8"), "beta bytes");

    const addedImage = (await fixture.request("/api/files", {
      method: "POST",
      body: { paths: [sourceImage] },
    })).payload.added[0];
    const preview = await fetch(`${fixture.server.origin}/api/files/${addedImage.id}/preview`);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), imageBytes);
    const previewHead = await fetch(`${fixture.server.origin}/api/files/${addedImage.id}/preview`, { method: "HEAD" });
    assert.equal(previewHead.status, 200);
    assert.equal(Number(previewHead.headers.get("content-length")), imageBytes.length);
    const previewEtag = previewHead.headers.get("etag");
    assert.ok(previewEtag);
    const notModified = await fetch(`${fixture.server.origin}/api/files/${addedImage.id}/preview`, {
      headers: { "if-none-match": previewEtag },
    });
    assert.equal(notModified.status, 304);
    const unavailablePreview = await fetch(`${fixture.server.origin}/api/files/${addedB.id}/preview`);
    assert.equal(unavailablePreview.status, 415);
    assert.equal((await unavailablePreview.json()).error.code, "PREVIEW_UNAVAILABLE");

    assert.equal((await fixture.request(`/api/files/${addedB.id}`, { method: "DELETE" })).response.status, 204);
    assert.equal(await readFile(sourceB, "utf8"), "beta bytes", "Deleting metadata preserves source bytes");

    await fixture.product.cleanupMissingFiles({ force: true });
    await rm(sourceA);
    await fixture.product.cleanupMissingFiles({ force: true });
    state = (await fixture.request("/api/state")).payload;
    assert.equal(state.files.some((file) => file.id === addedA.id), false, "Missing sources are removed on refresh");
  } finally {
    await fixture.close();
  }
});

test("missing-file cleanup is single-flight across concurrent state reads", async () => {
  let releaseCheck;
  let markCheckStarted;
  const checkStarted = new Promise((resolve) => { markCheckStarted = resolve; });
  const checkReleased = new Promise((resolve) => { releaseCheck = resolve; });
  const fixture = await createFixture({
    productOptions: {
      fileStat: async () => {
        markCheckStarted();
        await checkReleased;
        return { isFile: () => false };
      },
    },
  });
  try {
    const source = path.join(fixture.directory, "removed.txt");
    await writeFile(source, "temporary");
    const added = await fixture.product.addFiles({ paths: [source] });
    await rm(source);
    const revision = fixture.product.revision;
    const [left, right] = await Promise.all([
      fixture.product.getState(),
      fixture.product.getState(),
    ]);
    await checkStarted;
    assert.equal(left.files.some((file) => file.id === added.added[0].id), true);
    assert.equal(right.files.some((file) => file.id === added.added[0].id), true);
    const cleanup = fixture.product.fileCleanupPromise;
    releaseCheck();
    await cleanup;
    assert.equal(fixture.product.revision, revision + 1);
    const cleaned = await fixture.product.getState();
    assert.equal(cleaned.files.some((file) => file.id === added.added[0].id), false);
  } finally {
    await fixture.close();
  }
});

test("timed-out file stats preserve bounded time and product-level underlying concurrency", async () => {
  const fileCount = 5;
  const concurrency = 2;
  const timeoutMs = 10;
  let activeCalls = 0;
  let maxActiveCalls = 0;
  let startedCalls = 0;
  let autoRelease = false;
  const pendingReleases = [];
  const operationPromises = [];
  const lateMissingResult = { isFile: () => false };
  const fixture = await createFixture({
    productOptions: {
      fileCleanupConcurrency: concurrency,
      fileStatTimeoutMs: timeoutMs,
      fileStat() {
        startedCalls += 1;
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        if (autoRelease) {
          activeCalls -= 1;
          return Promise.resolve(lateMissingResult);
        }
        const operation = new Promise((resolve) => {
          let released = false;
          pendingReleases.push(() => {
            if (released) return;
            released = true;
            activeCalls -= 1;
            resolve(lateMissingResult);
          });
        });
        operationPromises.push(operation);
        return operation;
      },
    },
  });
  let cleanup = null;
  let secondCleanup = null;

  async function waitFor(predicate, message) {
    const deadline = Date.now() + 1_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.fail(message);
  }

  function releaseCurrentWave() {
    const releases = pendingReleases.splice(0);
    for (const release of releases) release();
    return releases.length;
  }

  async function promiseWithin(promise, message, limitMs = 100) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), limitMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    const paths = [];
    for (let index = 0; index < fileCount; index += 1) {
      const source = path.join(fixture.directory, `slow-volume-${index}.txt`);
      await writeFile(source, `available ${index}`);
      paths.push(source);
    }
    const added = await fixture.product.addFiles({ paths });
    const addedIds = added.added.map((file) => file.id);
    const revision = fixture.product.revision;
    const state = await promiseWithin(
      fixture.product.getState({ surface: "files" }),
      "getState waited for file cleanup",
    );
    cleanup = fixture.product.fileCleanupPromise;
    assert.ok(cleanup);
    assert.deepEqual(new Set(state.files.map((file) => file.id)), new Set(addedIds));

    await waitFor(() => startedCalls === concurrency, "the first cleanup wave did not start");
    await promiseWithin(cleanup, "cleanup waited for timed-out underlying stats");
    assert.equal(startedCalls, concurrency, "cleanup must not exceed occupied underlying slots");
    assert.equal(activeCalls, concurrency);
    assert.equal(maxActiveCalls, concurrency);
    assert.equal(fixture.product.fileStatOperations.size, concurrency);

    secondCleanup = fixture.product.cleanupMissingFiles({ force: true });
    await promiseWithin(secondCleanup, "forced cleanup waited for occupied stat slots");
    assert.equal(startedCalls, concurrency, "forced cleanup must not start stats while capacity is occupied");
    assert.equal(activeCalls, concurrency);
    assert.equal(maxActiveCalls, concurrency);
    assert.equal(fixture.product.fileStatOperations.size, concurrency);

    assert.equal(releaseCurrentWave(), concurrency);
    await Promise.allSettled(operationPromises);
    await waitFor(() => fixture.product.fileStatOperations.size === 0, "settled stat slots were not released");
    assert.equal(activeCalls, 0);
    assert.equal(startedCalls, concurrency);
    assert.equal(fixture.product.revision, revision, "late timeout results must preserve file metadata");
    for (const id of addedIds) assert.ok(fixture.product.getFile(id));
  } finally {
    autoRelease = true;
    releaseCurrentWave();
    await cleanup?.catch(() => {});
    await secondCleanup?.catch(() => {});
    await Promise.allSettled(operationPromises);
    await fixture.close();
  }
});

test("preview rejects oversized images before reading and picker receives the request locale", async () => {
  let pickerLocale = null;
  const fixture = await createFixture({
    filePicker: async ({ locale }) => {
      pickerLocale = locale;
      return { cancelled: true, paths: [] };
    },
  });
  try {
    const largeImage = path.join(fixture.directory, "large.png");
    await writeFile(largeImage, "");
    await truncate(largeImage, 64 * 1024 * 1024 + 1);
    const added = await fixture.product.addFiles({ paths: [largeImage] });
    const preview = await fetch(`${fixture.server.origin}/api/files/${added.added[0].id}/preview`);
    assert.equal(preview.status, 413);
    assert.equal((await preview.json()).error.code, "PREVIEW_TOO_LARGE");

    const picker = await fetch(`${fixture.server.origin}/api/files/pick`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      body: "{}",
    });
    assert.equal(picker.status, 200);
    assert.equal(pickerLocale, "zh-CN");
  } finally {
    await fixture.close();
  }
});

test("two SSE clients observe one revision stream and data survives a service restart", async () => {
  const fixture = await createFixture();
  let directoryRemoved = false;
  try {
    const clientA = await SseClient.connect(fixture.server.origin);
    const clientB = await SseClient.connect(fixture.server.origin);
    await Promise.all([clientA.next("ready"), clientB.next("ready")]);
    const nextA = clientA.next("change");
    const nextB = clientB.next("change");
    const created = await fixture.request("/api/todos", {
      method: "POST",
      body: { body: "Shared across windows" },
    });
    const [changeA, changeB] = await Promise.all([nextA, nextB]);
    assert.equal(changeA.revision, created.payload.revision);
    assert.equal(changeB.revision, created.payload.revision);
    clientA.close();
    clientB.close();

    const databasePath = fixture.databasePath;
    const directory = fixture.directory;
    await fixture.close({ keepDirectory: true });
    const restartedProduct = await new CodexNotesProduct({ databasePath }).open();
    const restartedServer = createCodexNotesServer({ product: restartedProduct, port: 0 });
    await restartedServer.listen();
    try {
      const state = await fetch(`${restartedServer.origin}/api/state`).then((response) => response.json());
      assert.equal(state.todos.active[0].body, "Shared across windows");
    } finally {
      await restartedServer.close();
      restartedProduct.close();
      await rm(directory, { recursive: true, force: true });
      directoryRemoved = true;
    }
  } finally {
    if (!directoryRemoved && fixture.product.db) await fixture.close();
  }
});
