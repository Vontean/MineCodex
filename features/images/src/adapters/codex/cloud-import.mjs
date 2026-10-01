import { createLibraryApi } from "./library-api.mjs";
import { promptFromConversation } from "./prompt-resolver-source.mjs";

// 在原生 Renderer 内使用现有登录态；凭据和临时下载地址不跨出 Renderer。
export async function cloudImagesInRenderer(operation, payload, resolvePrompt = promptFromConversation, createApi = createLibraryApi) {
  const key = Symbol.for("minecodex.cloud-images.v1");
  const state = window[key] ??= { files: new Map(), conversations: new Map() };
  const library = state.library ??= createApi();
  if (operation === "list") {
    if (!payload.cursor) { state.files.clear(); state.conversations.clear(); }
    const result = await library.list(payload.cursor, AbortSignal.timeout(25_000));
    const files = result.items.filter(file => ["image/png", "image/jpeg", "image/webp"].includes(file.mime_type)
      && file.origination_thread_id && file.origination_message_id && !file.trashed_at);
    for (const file of files) state.files.set(file.id, file);
    return { items: files.map(file => ({ libraryId: file.id, version: `${file.current_version_number}:${file.updated_at}`, name: file.file_name })), cursor: result.cursor ?? null };
  }
  const file = state.files.get(payload.libraryId);
  if (!file) throw new Error("Cloud image must come from the current Library listing");
  const threadId = file.origination_thread_id;
  if (!state.conversations.has(threadId)) {
    const request = library.conversation(threadId,AbortSignal.timeout(25_000)).catch(error=>{state.conversations.delete(threadId);throw error;});
    state.conversations.set(threadId, request);
  }
  const conversation = await state.conversations.get(threadId);
  const node = conversation.mapping?.[file.origination_message_id];
  const resolved = resolvePrompt(file, conversation);
  if (!resolved) return { skipped: true };
  const prompt = resolved.text, promptKind = resolved.kind;
  const max = 32 * 1024 * 1024;
  if (file.file_size_bytes > max) throw new Error("Cloud image exceeds 32 MB");
  const imageBlob = await library.download(file, AbortSignal.timeout(60_000));
  if (!(imageBlob instanceof Blob) || imageBlob.size > max) throw new Error("Cloud image download returned an invalid image");
  const reader = imageBlob.stream().getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > max) throw new Error("Cloud image exceeds 32 MB");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  let binary = "";
  for (const chunk of chunks) for (let i = 0; i < chunk.length; i += 0x8000) binary += String.fromCharCode(...chunk.subarray(i, i + 0x8000));
  return {
    bytesBase64: btoa(binary), mimeType: imageBlob.type.split(";")[0] || file.mime_type,
    itemId: file.file_id, conversationId: threadId, conversationTitle: conversation.title,
    sourceKind: "chat", prompt, promptKind,
    cloudLibraryId: file.id, cloudVersion: `${file.current_version_number}:${file.updated_at}`,
    createdAt: new Date((node.message.create_time || conversation.create_time) * 1000).toISOString(),
  };
}
