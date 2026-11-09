import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ImageLibrary } from "../src/image-library.mjs";


const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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
