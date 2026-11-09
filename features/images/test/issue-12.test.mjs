import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ImageLibrary } from "../src/image-library.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("external imports are validated, atomically owned by Images, and idempotent", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-issue12-"));
  const library = new ImageLibrary({
    sourceRoot: path.join(root, "generated_images"),
    dataDir: path.join(root, "library"),
    watchSource: false,
  });
  context.after(() => {
    library.close();
    return rm(root, { recursive: true, force: true });
  });
  await library.start();

  const imported = await library.importExternalImage({
    bytes: ONE_PIXEL_PNG,
    mimeType: "image/png",
    itemId: "chat-image-1",
    conversationId: "conversation-1",
    conversationTitle: "A generated image",
    sourceKind: "chat",
  });
  assert.equal(imported.imported, true);
  assert.equal(library.count(), 1);
  const image = library.get(imported.id);
  assert.equal(image.sourceKind, "chat");
  assert.equal(image.threadId, "chatgpt:chat:conversation-1");
  assert.equal(image.threadTitle, "A generated image");
  assert.equal(image.sourcePath.startsWith(path.join(root, "library", "external-images")), true);
  assert.equal(image.sourcePath.startsWith(path.join(root, "generated_images")), false);
  assert.deepEqual(await library.importExternalImage({
    bytes: ONE_PIXEL_PNG,
    mimeType: "image/png",
    itemId: "chat-image-1",
    conversationId: "conversation-1",
    sourceKind: "chat",
  }), { imported: false, id: imported.id, reason: "DUPLICATE" });
  assert.equal((await library.importExternalImage({
    bytes: Buffer.from("not-an-image"),
    mimeType: "image/png",
    itemId: "bad-image",
    sourceKind: "work",
  })).reason, "INVALID_DIMENSIONS");

  const namespaced = await library.importExternalImage({
    bytes: ONE_PIXEL_PNG,
    mimeType: "image/png",
    itemId: "chat-image-2",
    conversationId: "chatgpt:local-chatgpt:conversation-2",
    sourceKind: "chat",
  });
  assert.equal(library.get(namespaced.id).threadId, "chatgpt:local-chatgpt:conversation-2");
});

test("cloud cache keeps versions and prompt provenance, including duplicate metadata repair", async context => {
  const root=await mkdtemp(path.join(os.tmpdir(),"mcx-cloud-cache-"));
  const library=new ImageLibrary({sourceRoot:path.join(root,"source"),dataDir:path.join(root,"data")});
  context.after(async()=>{library.close();await rm(root,{recursive:true,force:true});});
  await library.start();
  const payload={bytes:ONE_PIXEL_PNG,mimeType:"image/png",itemId:"file_cloud",conversationId:"cloud-chat",sourceKind:"chat",prompt:"Original request",promptKind:"request",cloudLibraryId:"libfile_test",cloudVersion:"1"};
  const first=await library.importExternalImage(payload);
  assert.equal(first.imported,true);
  assert.equal(library.get(first.id).promptKind,"request");
  assert.deepEqual(library.cloudCache().map(x=>({...x})),[{libraryId:"libfile_test",version:"1"}]);
  await library.importExternalImage({...payload,prompt:"Actual prompt",promptKind:"generation",cloudVersion:"2"});
  assert.equal(library.count(),1);
  assert.equal(library.get(first.id).prompt,"Actual prompt");
  assert.equal(library.get(first.id).promptKind,"generation");
  assert.equal(library.cloudCache()[0].version,"2");
});

test("feed snapshots keep pagination and stack previews stable while new images arrive", async context => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mcx-feed-snapshot-"));
  const library = new ImageLibrary({sourceRoot: path.join(root, "source"), dataDir: path.join(root, "data")});
  context.after(async () => { library.close(); await rm(root, {recursive: true, force: true}); });
  await library.start();
  const add = (itemId, createdAt, conversationId = "one", sourceKind = "chat") => library.importExternalImage({
    bytes: ONE_PIXEL_PNG, mimeType: "image/png", itemId, conversationId, sourceKind, createdAt,
  });
  await add("first", "2026-01-01T00:00:00.000Z");
  await add("second", "2026-01-02T00:00:00.000Z");
  const snapshot = library.snapshot();
  const before = library.list({snapshot});
  await add("newest", "2026-01-03T00:00:00.000Z");
  await add("older", "2025-01-01T00:00:00.000Z");
  await add("another-thread", "2026-01-04T00:00:00.000Z", "two", "work");
  assert.equal(library.count({snapshot}), 2);
  assert.equal(library.count(), 5);
  assert.deepEqual(library.list({snapshot, offset: 1, limit: 1}), before.slice(1));
  assert.equal(library.countGroups({snapshot}), 1);
  assert.equal(library.countGroups(), 2);
  const group = library.groups({snapshot})[0];
  assert.equal(group.imageCount, 2);
  assert.deepEqual(group.previews.map(x => x.id), before.toReversed().map(x => x.id));
  assert.equal(library.count({source: "chat"}) - library.count({source: "chat", snapshot}), 2);
  assert.equal(library.list({snapshot: 0}).length, 0);
});
