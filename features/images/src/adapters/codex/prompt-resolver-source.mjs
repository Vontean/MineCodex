import selectImagePrompt from "../../domain/library-prompt.mjs";
import { imagePromptFacts } from "./image-prompt.mjs";
export function promptFromConversation(file, conversation) {
  return selectImagePrompt(imagePromptFacts(file, conversation));
}
export function promptResolverSource() {
  return `(function() { const normalize=${imagePromptFacts.toString()}; const select=${selectImagePrompt.toString()}; return (file, conversation) => select(normalize(file, conversation)); })()`;
}
