import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCodexNotesServer } from "../src/http-server.mjs";
import { CodexNotesProduct } from "../src/product.mjs";

async function rawRequest(origin, route, { method = "GET", headers = {}, body = "" } = {}) {
  const target = new URL(route, origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method,
      headers,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: response.statusCode, payload: text ? JSON.parse(text) : null });
      });
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function openProduct(productOptions = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "minecodex-notes-issue5-"));
  const product = await new CodexNotesProduct({
    databasePath: path.join(directory, "notes.sqlite"),
    fileCleanupIntervalMs: 60_000,
    ...productOptions,
  }).open();
  return {
    directory,
    product,
    async close() {
      product.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("Notes state completes before deferred missing-file cleanup work is released", async () => {
  const scheduledCleanups = [];
  let statCalls = 0;
  const fixture = await openProduct({
    fileCleanupIntervalMs: 0,
    cleanupScheduler(callback) {
      scheduledCleanups.push(callback);
    },
    async fileStat() {
      statCalls += 1;
      return { isFile: () => true };
    },
  });
  try {
    const filePath = path.join(fixture.directory, "deferred-cleanup.txt");
    await writeFile(filePath, "cleanup later");
    const added = await fixture.product.addFiles({ paths: [filePath] });

    const state = await fixture.product.getState({ surface: "files" });
    assert.equal(state.files.some((file) => file.id === added.added[0].id), true);
    assert.equal(scheduledCleanups.length, 1);
    assert.equal(statCalls, 0, "the cleanup SELECT/stat turn has not been released");
    const cleanup = fixture.product.fileCleanupPromise;
    assert.ok(cleanup, "the background cleanup remains single-flight while scheduled");

    scheduledCleanups.shift()();
    await cleanup;
    assert.equal(statCalls, 1);
  } finally {
    fixture.product.fileCleanupPromise?.catch(() => {});
    for (const release of scheduledCleanups) release();
    await fixture.close();
  }
});

test("Notes state responses are bounded and surface-appropriate for a large dataset", async () => {
  const fixture = await openProduct();
  try {
    const paths = [];
    for (let index = 0; index < 24; index += 1) {
      fixture.product.createTodo({ body: `Todo ${index}` });
      fixture.product.createPrompt({ title: `Prompt ${index}`, body: `Prompt body ${index}` });
      const filePath = path.join(fixture.directory, `file-${index}.txt`);
      await writeFile(filePath, `file ${index}`);
      paths.push(filePath);
    }
    await fixture.product.addFiles({ paths });

    const summary = await fixture.product.getState({ surface: "summary" });
    assert.equal(summary.todos.active.length, 5);
    assert.equal(summary.todos.completed.length, 0);
    assert.equal(summary.prompts.length, 5);
    assert.equal(summary.files.length, 5);
    assert.deepEqual(summary.counts, {
      todos: { active: 24, completed: 0 },
      prompts: 24,
      files: 24,
    });

    const [todos, prompts, files] = await Promise.all([
      fixture.product.getState({ surface: "todo" }),
      fixture.product.getState({ surface: "prompts" }),
      fixture.product.getState({ surface: "files" }),
    ]);
    assert.equal(todos.todos.active.length, 24);
    assert.equal(todos.prompts.length, 0);
    assert.equal(todos.files.length, 0);
    assert.equal(prompts.todos.active.length, 0);
    assert.equal(prompts.prompts.length, 24);
    assert.equal(prompts.files.length, 0);

    assert.equal(files.todos.active.length, 0);
    assert.equal(files.prompts.length, 0);
    assert.equal(files.files.length, 24);
  } finally {
    await fixture.close();
  }
});

test("Notes HTTP state contract accepts a surface and exposes the health identity", async () => {
  const fixture = await openProduct();
  const server = createCodexNotesServer({
    product: fixture.product,
    port: 0,
    instanceId: "notes-issue5-test-instance",
  });
  await server.listen();
  try {
    const health = await fetch(`${server.origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "notes",
      protocolVersion: 1,
      instanceId: "notes-issue5-test-instance",
      revision: fixture.product.revision,
    });

    const summary = await fetch(`${server.origin}/api/state?surface=summary`).then((response) => response.json());
    assert.equal(summary.surface, "summary");
    assert.equal(summary.todos.active.length, 0);
    assert.equal(summary.prompts.length, 0);
    assert.equal(summary.files.length, 0);

    const port = Number(new URL(server.origin).port);
    const unexpectedHost = await rawRequest(server.origin, "/api/todos", {
      method: "POST",
      headers: {
        host: `127.0.0.1:${port + 1}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "Blocked" }),
    });
    assert.equal(unexpectedHost.status, 403);
    assert.equal(unexpectedHost.payload.error.code, "HOST_NOT_ALLOWED");
  } finally {
    await server.close();
    await fixture.close();
  }
});

test("Notes loopback Host/Origin validation also works on IPv6 loopback", async (t) => {
  const fixture = await openProduct();
  const server = createCodexNotesServer({ product: fixture.product, host: "::1", port: 0 });
  try {
    try {
      await server.listen();
    } catch (error) {
      if (["EADDRNOTAVAIL", "EAFNOSUPPORT"].includes(error.code)) {
        t.skip(`IPv6 loopback is unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    const health = await fetch(`${server.origin}/api/health`);
    assert.equal(health.status, 200);
    const created = await fetch(`${server.origin}/api/todos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "IPv6 loopback" }),
    });
    assert.equal(created.status, 201);
  } finally {
    await server.close();
    await fixture.close();
  }
});

test("Notes surfaces request scoped state and ignore unrelated revision fan-out", async () => {
  const app = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
  assert.match(app, /function stateRequest\(/);
  assert.match(app, /surface=\$\{encodeURIComponent\(surface\)\}/);
  assert.match(app, /function changeAffectsSurface\(/);
  assert.match(app, /change\.reason/);
  assert.match(app, /\["todo", "prompt", "file", "files"\]/);
  assert.match(app, /if \(!changeAffectsSurface\(change\)\) \{/);
  assert.doesNotMatch(app, /const next = await api\("\/api\/state"\)/);
});

test("Notes missing-file cleanup fans out only to file-bearing surfaces", async () => {
  const fixture = await openProduct();
  const changes = [];
  const onChange = (change) => changes.push(change);
  fixture.product.on("change", onChange);
  try {
    const filePath = path.join(fixture.directory, "cleanup.txt");
    await writeFile(filePath, "cleanup");
    await fixture.product.addFiles({ paths: [filePath] });
    await new Promise((resolve) => queueMicrotask(resolve));

    fixture.product.fileStat = async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    assert.equal((await fixture.product.cleanupMissingFiles({ force: true })).length, 1);
    await new Promise((resolve) => queueMicrotask(resolve));

    const cleanupChange = changes.find((change) => change.reason === "files:missing-removed");
    assert.deepEqual(cleanupChange?.surfaces, ["summary", "files"]);
  } finally {
    fixture.product.off("change", onChange);
    await fixture.close();
  }
});
