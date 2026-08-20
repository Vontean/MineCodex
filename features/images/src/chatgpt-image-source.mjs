const SUPPORTED_SURFACES = new Set(["chat", "work"]);

export function sourceKindForSurface({ pathname = "", activeLabel = "" } = {}) {
  const value = `${pathname} ${activeLabel}`.toLowerCase();
  if (/\bwork\b/.test(value)) return "work";
  if (/\bchat\b/.test(value)) return "chat";
  return null;
}

export function classifyGeneratedImage({
  hasGenerationMarker = false,
  isAssistantResult = false,
  itemId = null,
  sourceProtocol = null,
} = {}) {
  if (!hasGenerationMarker || !isAssistantResult) return { accepted: false, reason: "NOT_GENERATED_RESULT" };
  if (!itemId || typeof itemId !== "string" || itemId.length > 256 || /[\\/\u0000]/.test(itemId)) {
    return { accepted: false, reason: "MISSING_STABLE_ITEM_ID" };
  }
  if (!new Set(["https", "blob", "data"]).has(sourceProtocol)) {
    return { accepted: false, reason: "UNSUPPORTED_SOURCE" };
  }
  return { accepted: true };
}

export function buildImportMetadata({
  sourceKind,
  itemId,
  conversationId = null,
  conversationTitle = null,
  prompt = null,
  createdAt = null,
} = {}) {
  return {
    sourceKind: SUPPORTED_SURFACES.has(sourceKind) ? sourceKind : null,
    itemId: typeof itemId === "string" ? itemId.slice(0, 256) : null,
    conversationId: typeof conversationId === "string" ? conversationId.slice(0, 256) : null,
    conversationTitle: typeof conversationTitle === "string" ? conversationTitle.slice(0, 512) : null,
    prompt: typeof prompt === "string" ? prompt.slice(0, 8_192) : null,
    createdAt: typeof createdAt === "string" ? createdAt.slice(0, 64) : null,
  };
}
