import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPageScriptSource } from "../src/library-prompt-source.mjs";
const source = await createPageScriptSource();
const { libraryImage, promptFromConversation } = new Function(`${source.slice(0, source.indexOf("const localeObserver ="))}\nreturn {libraryImage, promptFromConversation};`)();
const file = { id: "libfile_a", file_id: "file_a", mime_type: "image/png", origination_message_id: "image", origination_thread_id: "thread" };
function conversation({ prompt = "exact prompt", role = "tool", asset = "sediment://file_a", generation = true } = {}) {
  return { mapping: {
    unrelated: { id: "unrelated", message: { author: { role: "user" }, content: { parts: ["wrong branch"] } } },
    user: { id: "user", message: { author: { role: "user" }, content: { parts: ["original", { content_type: "image_asset_pointer" }, "request"] } } },
    image: { id: "image", parent: "user", message: { author: { role }, content: { parts: [{ content_type: "image_asset_pointer", asset_pointer: asset, metadata: generation ? { dalle: { gen_id: "gen", prompt } } : {} }] } } },
  } };
}

test("only the exact generated asset supplies the prompt", () => {
  assert.deepEqual(promptFromConversation(file, conversation()), { text: "exact prompt", kind: "generation" });
  assert.equal(promptFromConversation(file, conversation({ asset: "sediment://file_b" })), null);
  assert.equal(promptFromConversation(file, conversation({ role: "user" })), null);
  assert.equal(promptFromConversation(file, conversation({ generation: false })), null);
  assert.equal(promptFromConversation({ ...file, origination_message_id: "missing" }, conversation()), null);
});

test("fallback is labelled as the original request and follows actual ancestry", () => {
  assert.deepEqual(promptFromConversation(file, conversation({ prompt: null })), { text: "original\nrequest", kind: "request" });
  const data = conversation({ prompt: " " });
  data.mapping.image.parent = "loop";
  data.mapping.loop = { id: "loop", parent: "loop" };
  assert.deepEqual(promptFromConversation(file, data), { text: null, kind: null });
  data.mapping.image.parent = "user";
  data.mapping.user.message.content.parts = [" "];
  assert.deepEqual(promptFromConversation(file, data), { text: null, kind: null });
});

test("viewer identity uses the full native Library record without leaking download URLs", () => {
  const header = { __reactFiber$test: { memoizedProps: { file: { id: file.id, mime_type: file.mime_type } }, return: { memoizedProps: { file: { ...file, thumbnail_url: "private", current_version_number: 2 } } } } };
  assert.deepEqual(libraryImage(header), { id: file.id, file_id: file.file_id, current_version_number: 2, origination_thread_id: "thread", origination_message_id: "image" });
  header.__reactFiber$test.memoizedProps.file = { ...file, mime_type: "application/pdf" };
  header.__reactFiber$test.return = null;
  assert.equal(libraryImage(header), null);
  assert.equal(libraryImage({}), null);
});

test("Images registers only a page script, with no Sites or standalone gallery entry", async () => {
  const manifest = JSON.parse(await readFile(new URL("../codex-feature.json", import.meta.url), "utf8"));
  assert.equal(manifest.entry.kind, "page-script");
  assert.equal(manifest.entry.script, "src/library-prompt-page.mjs");
  assert.equal(manifest.placement?.after, undefined);
  assert.equal(manifest.surfaceUrl, undefined);
  assert.equal(manifest.command, undefined);
});
