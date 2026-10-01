// null 表示非生成图片；有效图片无提示词时返回空字段，导入仍可保留图片。
export function imagePromptFacts(file, conversation) {
  const node = conversation.mapping?.[file.origination_message_id];
  const part = node?.message?.content?.parts?.find(part => part && typeof part === "object"
    && part.content_type === "image_asset_pointer"
    && [file.file_id, `sediment://${file.file_id}`].includes(part.asset_pointer));
  if (!part || !["assistant", "tool"].includes(node.message.author?.role)
    || !(part.metadata?.generation?.gen_id || part.metadata?.dalle?.gen_id)) return null;
  const prompt = part.metadata?.dalle?.prompt;
  if (typeof prompt === "string" && prompt.trim()) return { generated:true, generationPrompt:prompt, requestText:null };
  let ancestor = conversation.mapping[node.parent];
  const visited = new Set();
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    if (ancestor.message?.author?.role === "user") {
      const text = ancestor.message.content?.parts?.filter(part => typeof part === "string").join("\n");
      return { generated:true, generationPrompt:null, requestText:text?.trim() ? text : null };
    }
    ancestor = conversation.mapping[ancestor.parent];
  }
  return { generated:true, generationPrompt:null, requestText:null };
}
