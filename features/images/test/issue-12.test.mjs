import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
