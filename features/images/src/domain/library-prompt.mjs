// 图片生成事实的提示词优先级，与原生消息树结构无关。
export default function selectImagePrompt(facts) {
  if (!facts?.generated) return null;
  if (facts.generationPrompt?.trim()) return { text:facts.generationPrompt, kind:"generation" };
  if (facts.requestText?.trim()) return { text:facts.requestText, kind:"request" };
  return { text:null, kind:null };
}
