import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ImageLibrary } from "../src/image-library.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("Timed out waiting for the image watcher");
}

test("imports ImageGen files across Thread directories and remains idempotent", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-image-host-test-"));
  const sourceRoot = path.join(root, "generated_images");
  const dataDir = path.join(root, "library");
  const sessionRoot = path.join(root, "sessions");
  const threadId = "019fdc4a-49eb-7753-9e07-c8b0f63f4e26";
  const itemId = "exec-453305c9-8397-4adb-8280-c0cb5c16591f";
  const threadDir = path.join(sourceRoot, threadId);
  await mkdir(threadDir, { recursive: true });
  await writeFile(path.join(threadDir, `${itemId}.png`), ONE_PIXEL_PNG);
  const sessionDir = path.join(sessionRoot, "2026", "08", "07");
  await mkdir(sessionDir, { recursive: true });
  const expectedPrompt = "A quiet studio image with one cobalt cube.";
  await writeFile(
    path.join(sessionDir, `rollout-2026-08-07T20-54-43-${threadId}.jsonl`),
    `${JSON.stringify({
      timestamp: "2026-08-07T13:02:19.668Z",
      type: "event_msg",
      payload: {
        type: "image_generation_end",
        call_id: itemId,
        status: "completed",
        revised_prompt: expectedPrompt,
        result: "ignored-image-bytes",
      },
    })}\n`,
  );

  const metadataByThread = new Map([
    [threadId, {
      sourceKind: "project",
      projectId: "codex-image-host",
      projectName: "CodexImageHost",
      threadTitle: "Build an image library",
      archived: false,
    }],
  ]);
  let metadataRefreshes = 0;
  const threadMetadata = {
    async refresh() { metadataRefreshes += 1; },
    get(id) { return metadataByThread.get(id) ?? null; },
    close() {},
  };
  const watcher = new EventEmitter();
  watcher.close = () => {};
  let notifyFileChange;

  const library = new ImageLibrary({
    sourceRoot,
    dataDir,
    sessionRoots: [sessionRoot],
    threadMetadata,
    logger: { error() {}, warn() {} },
    watchFactory(_sourceRoot, _options, listener) {
      notifyFileChange = listener;
      return watcher;
    },
  });
  context.after(() => library.close());
  const startup = await library.start();

  assert.equal(startup.total, 1);
  assert.equal(startup.imported, 1);
  assert.equal(await library.rescan(), 0);

  const [image] = library.list();
  assert.equal(image.threadId, threadId);
  assert.equal(image.imageGenerationItemId, itemId);
  assert.equal(image.width, 1);
  assert.equal(image.height, 1);
  assert.equal(image.byteLength, ONE_PIXEL_PNG.byteLength);
  assert.equal(image.sourcePath, path.join(threadDir, `${itemId}.png`));
  assert.equal(image.prompt, null);
  assert.equal(image.sourceKind, "project");
  assert.equal(image.projectId, "codex-image-host");
  assert.equal(image.projectName, "CodexImageHost");
  assert.equal(image.threadTitle, "Build an image library");
  assert.equal(image.archived, false);
  assert.equal((await library.hydratePrompt(image.id)).prompt, expectedPrompt);
  assert.equal(library.get(image.id).prompt, expectedPrompt);

  const secondThreadId = "019fd6fa-4b91-7c11-a91a-f7947d9fe50a";
  metadataByThread.set(secondThreadId, {
    sourceKind: "chat",
    projectId: null,
    projectName: null,
    threadTitle: "Generate a network diagram",
    archived: true,
  });
  const secondThreadDir = path.join(sourceRoot, secondThreadId);
  await mkdir(secondThreadDir, { recursive: true });
  const secondImagePath = path.join(secondThreadDir, "exec-second.png");
  await writeFile(secondImagePath, ONE_PIXEL_PNG);
  notifyFileChange("rename", path.relative(sourceRoot, secondImagePath));
  await waitFor(() => library.count() === 2);

  assert.deepEqual(new Set(library.list().map((item) => item.threadId)), new Set([threadId, secondThreadId]));
  assert.equal(library.list().find((item) => item.threadId === secondThreadId).sourceKind, "chat");
  assert.equal(library.list().find((item) => item.threadId === secondThreadId).archived, true);

  metadataByThread.set(threadId, {
    sourceKind: "project",
    projectId: "codex-image-host",
    projectName: "Images",
    threadTitle: "Updated task name",
    archived: false,
  });
  await library.rescan();
  const refreshedImage = library.list().find((item) => item.threadId === threadId);
  assert.equal(refreshedImage.projectName, "Images");
  assert.equal(refreshedImage.threadTitle, "Updated task name");
  assert.ok(metadataRefreshes >= 2);
  const firstPage = library.list({ limit: 1, offset: 0 });
  const secondPage = library.list({ limit: 1, offset: 1 });
  assert.equal(firstPage.length, 1);
  assert.equal(secondPage.length, 1);
  assert.notEqual(firstPage[0].id, secondPage[0].id);

  assert.equal(library.count({ source: "project:codex-image-host" }), 1);
  assert.equal(library.count({ source: "chat" }), 1);
  assert.equal(library.list({ source: "chat" })[0].threadId, secondThreadId);
  assert.deepEqual(library.facets(), {
    total: 2,
    chats: 1,
    works: 0,
    projects: [{
      scope: "project-name:Images",
      name: "Images",
      count: 1,
      latestCreatedAt: refreshedImage.createdAt,
    }],
  });
  const groups = library.groups({ source: "all" });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].imageCount, 1);
  assert.equal(groups[0].previews.length, 1);
  assert.equal(library.countGroups({ source: "all" }), 2);
});
