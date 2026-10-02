// null 表示非生成图片；有效图片无提示词时返回空字段，导入仍可保留图片。
export function imagePromptFacts(file, conversation) {
  const node = conversation.mapping?.[file.origination_message_id];
  const part = node?.message?.content?.parts?.find(part => part && typeof part === "object"
    && part.content_type === "image_asset_pointer"
    && [file.file_id, `sediment://${file.file_id}`].includes(part.asset_pointer));
  if (!part || !["assistant", "tool"].includes(node.message.author?.role)
    || !(part.metadata?.generation?.gen_id || part.metadata?.dalle?.gen_id)) return null;
  const recorded = [part.metadata?.dalle?.prompt, node.message.metadata?.async_task_prompt];
  const prompt = recorded.find(value => typeof value === "string" && value.trim());
  if (typeof prompt === "string" && prompt.trim()) return { generated:true, generationPrompt:prompt, requestText:null };
  // 只沿当前图片祖先链查找实际生图调用；同一结果含多图时不猜参数归属。
  const imageParts = node.message.content.parts.filter(value => value?.content_type === "image_asset_pointer");
  let ancestor = conversation.mapping[node.parent];
  const visited = new Set();
  let imageCallChecked = false;
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    const message = ancestor.message;
    const recipient = message?.recipient;
    const imageCall = message?.author?.role === "assistant" && typeof recipient === "string"
      && (recipient === node.message.author?.name || ["image_gen", "image_gen.text2im", "dalle", "dalle.text2im"].includes(recipient) || recipient.startsWith("t2uay3k."));
    if (imageCall && !imageCallChecked) {
      imageCallChecked = true;
      const content = message.content;
      const text = content?.content_type === "code" ? content.text
        : ["text", "multimodal_text"].includes(content?.content_type) ? content.parts?.filter(value => typeof value === "string").join("\n") : null;
      try {
        const args = JSON.parse(text);
        const value = typeof args?.prompt === "string" ? args.prompt
          : Array.isArray(args?.prompts) && args.prompts.length === 1 ? args.prompts[0] : null;
        if (imageParts.length === 1 && typeof value === "string" && value.trim()) return { generated:true, generationPrompt:value, requestText:null };
      } catch { /* 不执行工具文本，也不从非结构化描述猜测参数。 */ }
      // 最近一次生图调用缺参数时停止，不串到更早的生成任务。
      // 继续读取独立的原始请求事实，但不再接受更早的工具参数。
    }
    if (message?.author?.role === "user") {
      const text = ancestor.message.content?.parts?.filter(part => typeof part === "string").join("\n");
      return { generated:true, generationPrompt:null, requestText:text?.trim() ? text : null };
    }
    ancestor = conversation.mapping[ancestor.parent];
  }
  return { generated:true, generationPrompt:null, requestText:null };
}
