// 在原生 Renderer 内使用现有登录态；凭据和临时下载地址不跨出 Renderer。
export async function cloudImagesInRenderer(operation, payload) {
  const key = Symbol.for("minecodex.cloud-images.v1");
  const state = window[key] ??= { files: new Map(), conversations: new Map() };
  if (!state.capability) {
    state.capability = (async () => {
      const initialUrl = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
        .map(element => element.href || element.src).find(url => /\/app-initial-[^/]+\.js/.test(url));
      if (!initialUrl) throw new Error("Cloud Library is unavailable in this Codex version");
      const initialSource = await (await fetch(initialUrl)).text();
      const asset = name => {
        const file = initialSource.match(new RegExp(`${name}-[\\w-]+\\.js`))?.[0];
        if (!file) throw new Error(`Cloud Library capability ${name} is unavailable`);
        return new URL(file, initialUrl).href;
      };
      const metadataUrl = asset("library-file-metadata");
      const metadataSource = await (await fetch(metadataUrl)).text();
      const apiLocal = metadataSource.match(/([\w$]+)\.safePost\(`\/files\/library`/)?.[1];
      const importBlock = [...metadataSource.matchAll(/import\{([^}]+)\}from["']([^"']*app-initial[^"']+)["']/g)][0];
      const apiExport = importBlock?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)).find(parts => parts.at(-1) === apiLocal)?.[0];
      if (!apiExport) throw new Error("Cloud Library API contract changed");
      const metadataInit = metadataSource.match(/function ([\w$]+)\(\)\{return\(\1=/)?.[1];
      const metadataExports = metadataSource.match(/export\{([^}]+)\}/)?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)) ?? [];
      const initExport = metadataExports.find(parts => parts[0] === metadataInit)?.at(-1);
      const metadata = await import(metadataUrl);
      if (typeof metadata[initExport] !== "function") throw new Error("Cloud Library initialization contract changed");
      metadata[initExport]();
      const module = await import(initialUrl);
      const api = module[apiExport];
      if (!api?.safeGet || !api?.safePost) throw new Error("Cloud Library API is not ready");
      const downloadUrl = asset("library-file-download");
      const downloadSource = await (await fetch(downloadUrl)).text();
      const exports = downloadSource.match(/export\{([^}]+)\}/)?.[1].split(",").map(s => s.trim().split(/\s+as\s+/)) ?? [];
      const responseLocal = downloadSource.match(/async function ([\w$]+)\([^)]*\)\{return [\w$]+\(await [\w$]+\([^;]+showInline:!0/)?.[1];
      const initLocal = downloadSource.match(/function ([\w$]+)\(\)\{return\(\1=/)?.[1];
      const exported = local => exports.find(parts => parts[0] === local)?.at(-1);
      const download = await import(downloadUrl);
      const initialize = download[exported(initLocal)], response = download[exported(responseLocal)];
      if (typeof initialize !== "function" || typeof response !== "function") throw new Error("Cloud image download contract changed");
      initialize();
      return { api, response };
    })().catch(error => { state.capability = null; throw error; });
  }
  const { api, response } = await state.capability;
  if (operation === "list") {
    if (!payload.cursor) { state.files.clear(); state.conversations.clear(); }
    const result = await api.safePost("/files/library", {
      requestBody: { limit: 50, cursor: payload.cursor ?? null, include_hidden_files: false, include_saved_entities: true },
      signal: AbortSignal.timeout(25_000),
    });
    const files = result.items.filter(file => ["image/png", "image/jpeg", "image/webp"].includes(file.mime_type)
      && file.origination_thread_id && file.origination_message_id && !file.trashed_at);
    for (const file of files) state.files.set(file.id, file);
    return { items: files.map(file => ({ libraryId: file.id, version: `${file.current_version_number}:${file.updated_at}`, name: file.file_name })), cursor: result.cursor ?? null };
  }
  const file = state.files.get(payload.libraryId);
  if (!file) throw new Error("Cloud image must come from the current Library listing");
  const threadId = file.origination_thread_id;
  if (!state.conversations.has(threadId)) {
    const request = api.safeGet("/conversation/{conversation_id}", {
      parameters: { path: { conversation_id: threadId } }, signal: AbortSignal.timeout(25_000),
    }).catch(error => { state.conversations.delete(threadId); throw error; });
    state.conversations.set(threadId, request);
  }
  const conversation = await state.conversations.get(threadId);
  const node = conversation.mapping?.[file.origination_message_id];
  const parts = node?.message?.content?.parts ?? [];
  const part = parts.find(part => typeof part === "object" && part.content_type === "image_asset_pointer"
    && (part.asset_pointer === `sediment://${file.file_id}` || part.asset_pointer === file.file_id));
  // 明确验证生成结果，避免把用户上传的参考图混入生成图库。
  if (!part || !["assistant", "tool"].includes(node.message.author?.role)
    || !(part.metadata?.generation?.gen_id || part.metadata?.dalle?.gen_id)) return { skipped: true };
  let prompt = part.metadata?.dalle?.prompt || null;
  let promptKind = prompt ? "generation" : null;
  if (!prompt) {
    let ancestor = conversation.mapping[node.parent];
    const visited = new Set();
    while (ancestor && !visited.has(ancestor.id)) {
      visited.add(ancestor.id);
      if (ancestor.message?.author?.role === "user") {
        prompt = ancestor.message.content?.parts?.filter(p => typeof p === "string").join("\n") || null;
        promptKind = prompt ? "request" : null;
        break;
      }
      ancestor = conversation.mapping[ancestor.parent];
    }
  }
  const max = 32 * 1024 * 1024;
  if (file.file_size_bytes > max) throw new Error("Cloud image exceeds 32 MB");
  const imageBlob = await response(file, AbortSignal.timeout(60_000));
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

export async function cloudImagesAction(evaluate, operation, payload = {}) {
  if (!["list", "import"].includes(operation)) throw new Error("Unknown cloud image operation");
  if (payload.cursor != null && (typeof payload.cursor !== "string" || payload.cursor.length > 4096)) throw new Error("Invalid Library cursor");
  if (operation === "import" && (typeof payload.libraryId !== "string" || !/^libfile_[\w-]+$/.test(payload.libraryId))) throw new Error("Invalid Library file ID");
  return evaluate(`(${cloudImagesInRenderer.toString()})(${JSON.stringify(operation)},${JSON.stringify(payload)})`, { timeoutMs: 110_000 });
}
