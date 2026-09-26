import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pageScriptServiceOrigin } from "../../../packages/runtime-host/src/codex-runtime.mjs";
import { discoverFeatures } from "../../../packages/runtime-host/src/feature-registry.mjs";
import { buildImportMetadata, classifyGeneratedImage, sourceKindForSurface } from "../src/chatgpt-image-source.mjs";
import { createHttpServer } from "../src/http-server.mjs";
import { ImageLibrary } from "../src/image-library.mjs";
import { runPageScriptFixture } from "./fixtures/page-script-runtime.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function postJson(origin, route, body, headers = {}) {
  const target = new URL(route, origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "app://-", ...headers },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        payload: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

test("Chat/Work adapter only accepts explicit assistant image-generation results", () => {
  assert.equal(sourceKindForSurface({ pathname: "/chat/abc", activeLabel: "" }), "chat");
  assert.equal(sourceKindForSurface({ pathname: "/work/abc", activeLabel: "" }), "work");
  assert.equal(sourceKindForSurface({ pathname: "/", activeLabel: "Chat" }), "chat");
  assert.equal(sourceKindForSurface({ pathname: "/", activeLabel: "Settings" }), null);
  assert.deepEqual(classifyGeneratedImage({
    hasGenerationMarker: true,
    isAssistantResult: true,
    itemId: "image-result-1",
    sourceProtocol: "blob",
  }), { accepted: true });
  assert.equal(classifyGeneratedImage({
    hasGenerationMarker: false,
    isAssistantResult: true,
    itemId: "attachment-1",
    sourceProtocol: "data",
  }).accepted, false);
  assert.equal(classifyGeneratedImage({
    hasGenerationMarker: true,
    isAssistantResult: true,
    itemId: "image-result-1",
    sourceProtocol: "app",
  }).reason, "UNSUPPORTED_SOURCE");
  assert.deepEqual(buildImportMetadata({ sourceKind: "chat", itemId: "item-1" }), {
    sourceKind: "chat",
    itemId: "item-1",
    conversationId: null,
    conversationTitle: null,
    prompt: null,
    createdAt: null,
  });
});

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

test("renderer import endpoint accepts only the exact embedded origin and never receives a source URL", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-issue12-http-"));
  const library = new ImageLibrary({
    sourceRoot: path.join(root, "generated_images"),
    dataDir: path.join(root, "library"),
    watchSource: false,
  });
  const server = await createHttpServer({ library, port: 0, instanceId: "issue-12" });
  context.after(async () => {
    await server.close();
    library.close();
    await rm(root, { recursive: true, force: true });
  });
  await library.start();
  const payload = {
    bytesBase64: ONE_PIXEL_PNG.toString("base64"),
    mimeType: "image/png",
    itemId: "work-image-1",
    conversationId: "work-1",
    conversationTitle: "Work result",
    sourceKind: "work",
  };
  const imported = await postJson(server.origin, "/api/import-generated-image", payload);
  assert.equal(imported.status, 201);
  assert.equal(imported.payload.imported, true);
  const duplicate = await postJson(server.origin, "/api/import-generated-image", payload, {
    Authorization: "must-not-be-used",
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.payload.reason, "DUPLICATE");
  assert.equal(library.list({ source: "work" }).length, 1);
  assert.equal(library.facets().works, 1);
  const listed = await (await fetch(`${server.origin}/api/images?source=work`)).json();
  assert.equal(listed.images[0].sourceUrl, null);
  const foreign = await postJson(server.origin, "/api/import-generated-image", payload, { Origin: "https://example.test" });
  assert.equal(foreign.status, 403);

  const pageScript = await readFile(new URL("../src/chatgpt-image-source-page.mjs", import.meta.url), "utf8");
  assert.match(pageScript, /referrerPolicy: "no-referrer"/);
  assert.match(pageScript, /delete payload\.source/);
  assert.doesNotMatch(pageScript, /localStorage|sessionStorage|document\.cookie|Authorization/);
});

test("image edit drafts only expose the selected source plus a bounded PNG auxiliary", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "minecodex-images-edit-draft-"));
  const library = new ImageLibrary({ sourceRoot: path.join(root, "generated_images"), dataDir: path.join(root, "library"), watchSource: false });
  const server = await createHttpServer({ library, port: 0 });
  context.after(async () => { await server.close(); library.close(); await rm(root, { recursive: true, force: true }); });
  await library.start();
  const imported = await library.importExternalImage({ bytes: ONE_PIXEL_PNG, mimeType: "image/png", itemId: "edit-image", sourceKind: "chat" });
  const draft = await postJson(server.origin, "/api/image-edit-draft", {
    imageId: imported.id,
    auxiliaryPngBase64: ONE_PIXEL_PNG.toString("base64"),
  });
  assert.equal(draft.status, 201);
  assert.match(draft.payload.draftId, /^[a-f0-9-]{36}$/);
  const consumed = await fetch(`${server.origin}/api/image-edit-draft/${draft.payload.draftId}`, {
    headers: { Origin: "app://-" },
  });
  const attachments = await consumed.json();
  assert.equal(attachments.sourcePath, library.get(imported.id).sourcePath);
  assert.equal((await stat(attachments.auxiliaryPath)).isFile(), true);
  assert.equal((await fetch(`${server.origin}/api/image-edit-draft/${draft.payload.draftId}`, {
    headers: { Origin: "app://-" },
  })).status, 404);
  const invalid = await postJson(server.origin, "/api/image-edit-draft", {
    imageId: imported.id,
    auxiliaryPngBase64: Buffer.from("not-png").toString("base64"),
  });
  assert.equal(invalid.status, 400);
  const foreign = await postJson(server.origin, "/api/image-edit-draft", { imageId: imported.id }, { Origin: "https://example.test" });
  assert.equal(foreign.status, 403);
});

test("page script derives its endpoint, forwards Content-Type, and requires an assistant/tool role", async () => {
  const features = await discoverFeatures(fileURLToPath(new URL("../..", import.meta.url)), {
    env: { CODEX_IMAGE_HOST_PORT: "49123" },
  });
  const images = features.find((feature) => feature.id === "images");
  assert.equal(images.surfaceUrl, "http://127.0.0.1:49123/");
  assert.equal(images.healthUrl, "http://127.0.0.1:49123/api/health");
  const serviceOrigin = pageScriptServiceOrigin(images);
  assert.equal(serviceOrigin, "http://127.0.0.1:49123");
  const fixture = await runPageScriptFixture({
    source: images.pageScript.source,
    serviceOrigin,
    bytes: ONE_PIXEL_PNG,
  });
  try {
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.calls[0].url, "https://chatgpt.com/backend-api/generated/image-1");
    assert.equal(fixture.calls[0].options.credentials, "same-origin");
    assert.equal(fixture.calls[0].options.referrerPolicy, "no-referrer");
    assert.equal(fixture.calls[1].url, "http://127.0.0.1:49123/api/import-generated-image");
    assert.equal(fixture.calls[1].options.credentials, "omit");
    const payload = JSON.parse(fixture.calls[1].options.body);
    assert.equal(payload.mimeType, "image/png");
    assert.equal(payload.bytesBase64, ONE_PIXEL_PNG.toString("base64"));
    assert.equal("source" in payload, false);
  } finally {
    fixture.cleanup();
  }

  const missingRole = await runPageScriptFixture({
    source: images.pageScript.source,
    serviceOrigin,
    role: null,
    bytes: ONE_PIXEL_PNG,
  });
  try {
    assert.equal(missingRole.calls.length, 0);
  } finally {
    missingRole.cleanup();
  }
});

test("page script imports the current Generated Image gallery contract without generated class names", async () => {
  const features = await discoverFeatures(fileURLToPath(new URL("../..", import.meta.url)), {
    env: { CODEX_IMAGE_HOST_PORT: "49123" },
  });
  const images = features.find((feature) => feature.id === "images");
  const fixture = await runPageScriptFixture({
    source: images.pageScript.source,
    serviceOrigin: pageScriptServiceOrigin(images),
    currentContract: true,
    blobFetchFails: true,
    hostBridge: true,
    bytes: ONE_PIXEL_PNG,
  });
  try {
    assert.equal(fixture.calls[0].url, "blob:app://-/fixture-generated-image");
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.hostCalls.length, 1);
    assert.equal(fixture.hostCalls[0].token, "fixture-token");
    assert.equal(fixture.hostCalls[0].featureId, "images");
    assert.equal(fixture.hostCalls[0].action, "import-generated-image");
    const payload = fixture.hostCalls[0].payload;
    assert.equal(payload.itemId, "file_fixture-generated-image");
    assert.equal(payload.conversationId, "conversation-current");
    assert.equal(payload.conversationTitle, "Fixture conversation");
    assert.equal(payload.sourceKind, "chat");
    assert.equal("source" in payload, false);
  } finally {
    fixture.cleanup();
  }
});

test("current gallery contract records Work as the source without changing the import path", async () => {
  const features = await discoverFeatures(fileURLToPath(new URL("../..", import.meta.url)));
  const images = features.find((feature) => feature.id === "images");
  const fixture = await runPageScriptFixture({
    source: images.pageScript.source,
    serviceOrigin: pageScriptServiceOrigin(images),
    currentContract: true,
    currentSurface: "Work",
    blobFetchFails: true,
    hostBridge: true,
    bytes: ONE_PIXEL_PNG,
  });
  try {
    assert.equal(fixture.hostCalls.length, 1);
    assert.equal(fixture.hostCalls[0].payload.sourceKind, "work");
    assert.equal(fixture.hostCalls[0].payload.conversationTitle, "Fixture conversation");
  } finally {
    fixture.cleanup();
  }
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
