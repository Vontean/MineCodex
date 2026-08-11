import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createHttpServer } from "../src/http-server.mjs";
import { ImageLibrary } from "../src/image-library.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");

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

async function createImageFixture({ threadCount = 1, sessionRoots = [], promptIndexOptions = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-issue4-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  const threadIds = [];
  for (let index = 0; index < threadCount; index += 1) {
    const threadId = `thread-${index}`;
    threadIds.push(threadId);
    const threadDir = path.join(sourceRoot, threadId);
    await mkdir(threadDir, { recursive: true });
    await writeFile(path.join(threadDir, `image-${index}.png`), ONE_PIXEL_PNG);
  }
  const library = new ImageLibrary({ sourceRoot, dataDir, sessionRoots, watchSource: false, promptIndexOptions });
  await library.start();
  return {
    root,
    library,
    threadIds,
    async close() {
      library.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("deferred Images startup exposes health before scanning and watches only after the scan", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-startup-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  const threadDir = path.join(sourceRoot, "thread-startup");
  await mkdir(threadDir, { recursive: true });
  await writeFile(path.join(threadDir, "image-startup.png"), ONE_PIXEL_PNG);

  let markScanStarted;
  let releaseScan;
  const scanStarted = new Promise((resolve) => { markScanStarted = resolve; });
  const scanReleased = new Promise((resolve) => { releaseScan = resolve; });
  let refreshCalls = 0;
  const threadMetadata = {
    async refresh() {
      refreshCalls += 1;
      markScanStarted();
      await scanReleased;
    },
    get() { return null; },
    close() {},
  };
  const watcher = new EventEmitter();
  watcher.close = () => {};
  let watcherCreates = 0;
  const library = new ImageLibrary({
    sourceRoot,
    dataDir,
    threadMetadata,
    watchFactory(_root, _options, _listener) {
      watcherCreates += 1;
      return watcher;
    },
  });
  let server = null;
  try {
    const startAttempt = library.start({ deferInitialScan: true });
    const deferred = await Promise.race([
      startAttempt,
      new Promise((resolve) => setTimeout(() => resolve(null), 25)),
    ]);
    if (!deferred) {
      releaseScan();
      await startAttempt;
      assert.fail("deferred start waited for the initial recursive scan");
    }

    assert.equal(refreshCalls, 0, "deferred start initializes storage without beginning the scan");
    assert.equal(watcherCreates, 0);
    server = await createHttpServer({
      library,
      webDir: WEB_ROOT,
      port: 0,
      instanceId: "images-startup-test-instance",
    });

    const initialScan = deferred.initialScan();
    await scanStarted;
    const health = await fetch(`${server.origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "images",
      protocolVersion: 1,
      instanceId: "images-startup-test-instance",
      images: 0,
    });
    assert.equal(watcherCreates, 0, "watching begins only after the initial scan completes");

    releaseScan();
    assert.deepEqual(await initialScan, { imported: 1, total: 1 });
    assert.equal(watcherCreates, 1);

    const main = await readFile(new URL("../src/main.mjs", import.meta.url), "utf8");
    const initializeAt = main.indexOf("library.start({ deferInitialScan: true })");
    const httpAt = main.indexOf("createHttpServer(");
    const scanAt = main.indexOf("startup.initialScan()");
    assert.ok(initializeAt >= 0 && initializeAt < httpAt && httpAt < scanAt,
      "main initializes the database, starts HTTP, then launches the background scan");
  } finally {
    releaseScan?.();
    if (server) await server.close();
    library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Images reconciles a PNG created synchronously while the watcher is established", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-watch-gap-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  const threadDir = path.join(sourceRoot, "thread-watch-gap");
  const initialImagePath = path.join(threadDir, "image-before-watch.png");
  const imagePath = path.join(threadDir, "image-watch-gap.png");
  await mkdir(threadDir, { recursive: true });
  await writeFile(initialImagePath, ONE_PIXEL_PNG);

  const watcher = new EventEmitter();
  watcher.close = () => {};
  let watcherCreates = 0;
  const library = new ImageLibrary({
    sourceRoot,
    dataDir,
    watchFactory(_root, _options, _listener) {
      watcherCreates += 1;
      writeFileSync(imagePath, ONE_PIXEL_PNG);
      return watcher;
    },
  });
  try {
    assert.deepEqual(await library.start(), { imported: 2, total: 2 });
    assert.equal(watcherCreates, 1);
    assert.equal(library.count(), 2);
    assert.deepEqual(
      new Set(library.list().map((image) => image.sourcePath)),
      new Set([initialImagePath, imagePath]),
    );
  } finally {
    library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("closing Images during its initial scan cannot create a watcher afterward", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-startup-close-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  await mkdir(sourceRoot, { recursive: true });

  let markScanStarted;
  let releaseScan;
  const scanStarted = new Promise((resolve) => { markScanStarted = resolve; });
  const scanReleased = new Promise((resolve) => { releaseScan = resolve; });
  const threadMetadata = {
    async refresh() {
      markScanStarted();
      await scanReleased;
    },
    get() { return null; },
    close() {},
  };
  let watcherCreates = 0;
  const library = new ImageLibrary({
    sourceRoot,
    dataDir,
    threadMetadata,
    watchFactory() {
      watcherCreates += 1;
      const watcher = new EventEmitter();
      watcher.close = () => {};
      return watcher;
    },
  });
  try {
    const startup = await library.start({ deferInitialScan: true });
    const initialScan = startup.initialScan();
    await scanStarted;
    library.close();
    releaseScan();
    assert.deepEqual(await initialScan, { imported: 0, total: 0 });
    assert.equal(watcherCreates, 0);
  } finally {
    releaseScan?.();
    library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Images health and mutation routes require the exact bound loopback origin", async () => {
  const fixture = await createImageFixture();
  const server = await createHttpServer({
    library: fixture.library,
    webDir: WEB_ROOT,
    port: 0,
    instanceId: "images-issue4-test-instance",
  });
  try {
    const health = await fetch(`${server.origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "images",
      protocolVersion: 1,
      instanceId: "images-issue4-test-instance",
      images: 1,
    });

    const embeddedScript = await fetch(`${server.origin}/app.js`, {
      headers: { origin: "app://-" },
    });
    assert.equal(embeddedScript.status, 200);
    assert.equal(embeddedScript.headers.get("access-control-allow-origin"), "app://-");

    const embeddedPreflight = await fetch(`${server.origin}/api/rescan`, {
      method: "OPTIONS",
      headers: {
        origin: "app://-",
        "access-control-request-method": "POST",
        "access-control-request-private-network": "true",
      },
    });
    assert.equal(embeddedPreflight.status, 204);
    assert.equal(embeddedPreflight.headers.get("access-control-allow-origin"), "app://-");
    assert.equal(embeddedPreflight.headers.get("access-control-allow-private-network"), "true");

    const embeddedMutation = await fetch(`${server.origin}/api/rescan`, {
      method: "POST",
      headers: { origin: "app://-" },
    });
    assert.equal(embeddedMutation.status, 200);

    const port = Number(new URL(server.origin).port);
    const unexpectedHost = await rawRequest(server.origin, "/api/rescan", {
      method: "POST",
      headers: { host: `127.0.0.1:${port + 1}` },
    });
    assert.equal(unexpectedHost.status, 403);
    assert.equal(unexpectedHost.payload.error.code, "HOST_NOT_ALLOWED");

    const unexpectedOrigin = await fetch(`${server.origin}/api/rescan`, {
      method: "POST",
      headers: { origin: `http://localhost:${port}` },
    });
    assert.equal(unexpectedOrigin.status, 403);
    assert.equal((await unexpectedOrigin.json()).error.code, "ORIGIN_NOT_ALLOWED");

    const allowed = await fetch(`${server.origin}/api/rescan`, {
      method: "POST",
      headers: { origin: server.origin },
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { imported: 0, total: 1, inProgress: false });

    const missingOrigin = await rawRequest(server.origin, "/api/rescan", { method: "POST" });
    assert.equal(missingOrigin.status, 403);
    assert.equal(missingOrigin.payload.error.code, "ORIGIN_NOT_ALLOWED");

    const malformedOrigin = await rawRequest(server.origin, "/api/rescan", {
      method: "POST",
      headers: { origin: "not-an-origin" },
    });
    assert.equal(malformedOrigin.status, 403);
    assert.equal(malformedOrigin.payload.error.code, "INVALID_ORIGIN");
  } finally {
    await server.close();
    await fixture.close();
  }
});

test("Images pagination defaults stay bounded and invalid integer queries fail closed", async () => {
  const fixture = await createImageFixture({ threadCount: 2 });
  const server = await createHttpServer({ library: fixture.library, webDir: WEB_ROOT, port: 0 });
  const endpoints = [
    { path: "/api/images", collection: "images" },
    { path: "/api/image-groups", collection: "groups" },
  ];
  const invalidQueries = [
    "limit=invalid",
    "limit=-1",
    "limit=1.5",
    "limit=73",
    "offset=invalid",
    "offset=-1",
    "offset=1.5",
    "offset=9007199254740992",
  ];
  try {
    for (const endpoint of endpoints) {
      const defaults = await fetch(`${server.origin}${endpoint.path}`);
      assert.equal(defaults.status, 200);
      const defaultPayload = await defaults.json();
      assert.equal(defaultPayload.limit, 36);
      assert.equal(defaultPayload.offset, 0);
      assert.equal(defaultPayload[endpoint.collection].length, 2);

      const capped = await fetch(`${server.origin}${endpoint.path}?limit=72&offset=0`);
      assert.equal(capped.status, 200);
      assert.equal((await capped.json()).limit, 72);

      for (const query of invalidQueries) {
        const response = await fetch(`${server.origin}${endpoint.path}?${query}`);
        assert.equal(response.status, 400, `${endpoint.path}?${query}`);
        assert.equal((await response.json()).error.code, "INVALID_QUERY");
      }
    }
  } finally {
    await server.close();
    await fixture.close();
  }
});

test("full ImageLibrary rescans share one in-flight operation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-rescan-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  await mkdir(path.join(sourceRoot, "thread"), { recursive: true });
  await writeFile(path.join(sourceRoot, "thread", "image.png"), ONE_PIXEL_PNG);

  let refreshCalls = 0;
  let blockNextRefresh = false;
  let releaseRefresh;
  const threadMetadata = {
    async refresh() {
      refreshCalls += 1;
      if (blockNextRefresh) await new Promise((resolve) => { releaseRefresh = resolve; });
    },
    async get() { return null; },
    close() {},
  };
  const library = new ImageLibrary({ sourceRoot, dataDir, threadMetadata, watchSource: false });
  await library.start();
  blockNextRefresh = true;
  try {
    const first = library.rescan();
    while (refreshCalls < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    const second = library.rescan();
    assert.strictEqual(second, first);
    assert.deepEqual(library.rescanStatus(), { inProgress: true });
    releaseRefresh();
    assert.equal(await second, 0);
    assert.deepEqual(library.rescanStatus(), { inProgress: false });
    assert.equal(refreshCalls, 2, "startup and one shared rescan only when watching is disabled");
  } finally {
    library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Images HTTP rescan reports an existing in-flight scan without starting another", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-http-rescan-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  await mkdir(path.join(sourceRoot, "thread"), { recursive: true });
  await writeFile(path.join(sourceRoot, "thread", "image.png"), ONE_PIXEL_PNG);

  let refreshCalls = 0;
  let blockNextRefresh = false;
  let releaseRefresh;
  const threadMetadata = {
    async refresh() {
      refreshCalls += 1;
      if (blockNextRefresh) await new Promise((resolve) => { releaseRefresh = resolve; });
    },
    async get() { return null; },
    close() {},
  };
  const library = new ImageLibrary({ sourceRoot, dataDir, threadMetadata, watchSource: false });
  await library.start();
  const server = await createHttpServer({ library, webDir: WEB_ROOT, port: 0 });
  try {
    blockNextRefresh = true;
    const inFlight = library.rescan();
    while (refreshCalls < 2) await new Promise((resolve) => setTimeout(resolve, 0));

    const response = await rawRequest(server.origin, "/api/rescan", {
      method: "POST",
      headers: { origin: server.origin },
    });
    assert.equal(response.status, 202);
    assert.deepEqual(response.payload, { imported: 0, total: 1, inProgress: true });

    releaseRefresh();
    await inFlight;
  } finally {
    await server.close();
    library.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("group previews use one batch query and prompt bodies hydrate only in detail", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-sessions-"));
  const fixture = await createImageFixture({ threadCount: 6, sessionRoots: [sessionRoot] });
  try {
    const [storedPromptImage] = fixture.library.list({ threadId: fixture.threadIds[0] });
    const secretPrompt = "This body must not appear in list or group responses.";
    fixture.library.database.prepare("UPDATE images SET prompt = ? WHERE id = ?").run(secretPrompt, storedPromptImage.id);

    const originalPrepare = fixture.library.database.prepare.bind(fixture.library.database);
    const statements = [];
    fixture.library.database.prepare = (sql) => {
      statements.push(sql);
      return originalPrepare(sql);
    };
    const groups = fixture.library.groups({ previewLimit: 2 });
    assert.equal(groups.length, 6);
    assert.equal(statements.length, 2, "one group summary query and one batch preview query");

    const server = await createHttpServer({
      library: fixture.library,
      webDir: WEB_ROOT,
      port: 0,
      instanceId: "images-issue4-test-instance",
    });
    try {
      const listPayload = await fetch(`${server.origin}/api/images`).then((response) => response.json());
      assert.equal(Object.hasOwn(listPayload.images[0], "prompt"), false);

      const groupPayload = await fetch(`${server.origin}/api/image-groups`).then((response) => response.json());
      assert.equal(Object.hasOwn(groupPayload.groups[0].previews[0], "prompt"), false);

      const detailPayload = await fetch(`${server.origin}/api/images/${storedPromptImage.id}`)
        .then((response) => response.json());
      assert.equal(detailPayload.image.prompt, secretPrompt);
    } finally {
      await server.close();
    }

    const missingImage = fixture.library.list({ threadId: fixture.threadIds[1] })[0];
    const firstMissing = await fixture.library.hydratePrompt(missingImage.id);
    const secondMissing = await fixture.library.hydratePrompt(missingImage.id);
    assert.equal(firstMissing.prompt, null);
    assert.equal(secondMissing.prompt, null);
    assert.equal(fixture.library.promptIndex.scanCount, 1, "a missing prompt is negatively cached");
  } finally {
    await fixture.close();
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("late ImageGen prompt events become visible after a bounded negative-cache expiry", async () => {
  const sessionRoot = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-late-prompt-"));
  let now = 0;
  const fixture = await createImageFixture({
    sessionRoots: [sessionRoot],
    promptIndexOptions: { negativeTtlMs: 10, now: () => now },
  });
  try {
    const image = fixture.library.list()[0];
    assert.equal((await fixture.library.hydratePrompt(image.id)).prompt, null);

    const logDirectory = path.join(sessionRoot, "2026", "08");
    await mkdir(logDirectory, { recursive: true });
    const prompt = "A prompt appended after the first detail request.";
    await writeFile(
      path.join(logDirectory, `rollout-${fixture.threadIds[0]}.jsonl`),
      `${JSON.stringify({
        payload: {
          type: "image_generation_end",
          call_id: image.imageGenerationItemId,
          revised_prompt: prompt,
        },
      })}\n`,
    );

    now = 11;
    assert.equal((await fixture.library.hydratePrompt(image.id)).prompt, prompt);
  } finally {
    await fixture.close();
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

test("Images update checks follow the active surface instead of a permanent interval", async () => {
  const [app, librarySource] = await Promise.all([
    readFile(new URL("../web/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/image-library.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(app, /let hostSurfaceActive = true/);
  assert.match(app, /let documentVisible/);
  assert.match(app, /let windowFocused/);
  assert.match(app, /let shellIntersecting/);
  assert.match(app, /function setHostSurfaceActive\(/);
  assert.match(app, /function setDocumentVisible\(/);
  assert.match(app, /function setWindowFocused\(/);
  assert.match(app, /function setShellIntersecting\(/);
  const pollFunction = app.match(/function canPollForUpdates\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const gate of ["hostSurfaceActive", "documentVisible", "windowFocused", "shellIntersecting"]) {
    assert.match(pollFunction, new RegExp(gate));
  }
  assert.doesNotMatch(app, /let surfaceActive/);
  assert.match(app, /document\.visibilityState/);
  assert.match(app, /await checkForUpdates\(\)/);
  assert.doesNotMatch(app, /setInterval\(\(\) => checkForUpdates/);
  assert.match(librarySource, /FALLBACK_RESCAN_INITIAL_DELAY_MS = 30_000/);
  assert.match(librarySource, /fallbackRescanDelayMs/);
  assert.doesNotMatch(librarySource, /setTimeout\(tick, 1000\)/);
});
