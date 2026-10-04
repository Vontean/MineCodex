// 模型身份、品牌、目录匹配与档位口径；不读取 DOM、存储或宿主状态。
export function createModelRules() {
  function modelIdentity(rawValue) {
    const raw = String(rawValue ?? "").trim();
    const slash = raw.indexOf("/");
    return {
      raw,
      provider: slash > 0 ? raw.slice(0, slash).trim() : "",
      backend: slash > 0 ? raw.slice(slash + 1).trim() : raw,
    };
  }

  function formatIdentifier(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/\s/.test(raw) && !raw.includes("/") && !raw.includes("_") && !raw.includes("-")) return raw;
    const canonical = new Map([
      ["ai", "AI"], ["api", "API"], ["chatglm", "ChatGLM"], ["claude", "Claude"],
      ["codex", "Codex"], ["deepseek", "DeepSeek"], ["gemini", "Gemini"], ["gemma", "Gemma"],
      ["glm", "GLM"], ["gpt", "GPT"], ["grok", "Grok"], ["kimi", "Kimi"],
      ["minimax", "MiniMax"], ["mimo", "MiMo"], ["moonshot", "Moonshot"], ["qwen", "Qwen"],
      ["qwq", "QwQ"], ["xai", "xAI"], ["xiaomi", "Xiaomi"], ["zhipu", "Zhipu"],
    ]);
    return raw
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const lower = token.toLowerCase();
        if (canonical.has(lower)) return canonical.get(lower);
        if (/^v\d/i.test(token)) return `V${token.slice(1)}`;
        if (/^o\d/i.test(token)) return token.toUpperCase();
        return token.charAt(0).toUpperCase() + token.slice(1);
      })
      .join(" ");
  }

  function providerLabel(provider, selector) {
    if (!provider) return "";
    return selector.providerAliases?.[provider.toLowerCase()] ?? formatIdentifier(provider);
  }

  function compactModelLabel(rawValue) {
    const raw = String(rawValue ?? "").trim();
    return formatIdentifier(raw.slice(raw.lastIndexOf("/") + 1));
  }

  function brandForModel(identity, selector) {
    const haystack = `${identity.backend} ${identity.raw}`.toLowerCase();
    return selector.brands?.find((brand) => (
      brand.keywords.some((keyword) => haystack.includes(keyword))
    )) ?? null;
  }

  function comparableModelLabel(value) {
    return formatIdentifier(modelIdentity(value).backend)
      .toLowerCase()
      .replace(/^gpt\s+/, "")
      .trim();
  }

  function modelWithOpenCodexEfforts(identity, selector, model) {
    if (!model || !selector?.openCodexRealEfforts) return model;
    const provenance = model.opencodex_capability_provenance;
    const catalogModel = provenance?.provider && provenance?.model_id
      ? null
      : catalogModelFor(identity, selector);
    const source = catalogModel ?? model;
    const sourceProvenance = source.opencodex_capability_provenance;
    const key = sourceProvenance?.provider && sourceProvenance?.model_id
      ? `${sourceProvenance.provider}/${sourceProvenance.model_id}`.toLowerCase()
      : identity.raw.toLowerCase();
    const realEfforts = selector.openCodexRealEfforts[key];
    if (!realEfforts) return model;
    const allowed = new Set(realEfforts);
    const levels = (model.supportedReasoningLevels ?? []).filter((level) => {
      const effort = String(level?.effort ?? level ?? "").toLowerCase();
      return allowed.has(effort);
    });
    return { ...model, supportedReasoningLevels: levels };
  }

  function catalogModelFor(identity, selector) {
    const raw = identity.raw.toLowerCase();
    const backend = identity.backend.toLowerCase();
    const exact = selector.models?.find((model) => (
      model.slug.toLowerCase() === raw
      || model.slug.toLowerCase() === backend
      || model.displayName.toLowerCase() === raw
    )) ?? null;
    if (exact) return exact;
    const target = comparableModelLabel(identity.backend);
    if (!target) return null;
    const aliases = (selector.models ?? []).filter((model) => (
      comparableModelLabel(model.slug) === target || comparableModelLabel(model.displayName) === target
    ));
    return resolveModelAlias(aliases, identity);
  }

  function resolveModelAlias(aliases, identity) {
    if (aliases.length === 1) return aliases[0];
    if (aliases.length < 2 || identity.provider) return null;
    const native = aliases.find((model) => !model.slug.includes("/"));
    const thirdParty = aliases.find((model) => model.slug.includes("/"));
    if (!native || !thirdParty) return null;
    if (!modelIdentity(native.slug).backend.toLowerCase().startsWith("gpt")) return null;
    const nativeLabel = formatIdentifier(
      modelIdentity(String(native.displayName ?? native.slug)).backend,
    ).toLowerCase();
    return formatIdentifier(identity.backend).toLowerCase() === nativeLabel ? native : thirdParty;
  }

  function favoriteModelId(raw, { authoritative = false, nativeSlug, catalogSlug } = {}) {
    // 控制器 ID 和 provider/model 不经过显示名称别名匹配，跨机器只认同一完整标识。
    return authoritative || modelIdentity(raw).provider ? raw : nativeSlug ?? catalogSlug ?? raw;
  }

  function nativeGptSortRank(rawValue) {
    const known = new Map([
      ["gpt-6-astra", 1], ["gpt-5.6-sol", 2], ["gpt-5.6-terra", 3], ["gpt-5.6-luna", 4],
      ["gpt-5.5", 5], ["gpt-5.4", 6], ["gpt-5.4-mini", 7], ["gpt-5.3-codex-spark", 8],
    ]);
    const raw = String(rawValue ?? "").trim();
    const knownRank = known.get(raw);
    if (knownRank != null) return { official: true, rank: knownRank };
    const identity = modelIdentity(raw);
    return identity.provider ? null : { official: true, rank: 100 };
  }

  function visibleControllerModels(controller) {
    const models = controller.models.filter((model) => !model.hidden && String(model.model ?? "").trim());
    const nativeGptIds = new Set(models
      .filter((model) => !String(model.model).includes("/") && /^gpt-/i.test(model.model))
      .map((model) => String(model.model).toLowerCase()));
    // OCX 自动发现的同名路由若没有独立档位，会与原生 GPT 显示成两项。
    return models.filter((model) => {
      const slug = String(model.model);
      const backend = modelIdentity(slug).backend.toLowerCase();
      return slug === controller.model
        || !(
          slug.includes("/")
          && nativeGptIds.has(backend)
          && !(model.supportedReasoningEfforts ?? []).length
        );
    });
  }
  return { favoriteModelId, modelIdentity, formatIdentifier, providerLabel, compactModelLabel, brandForModel, comparableModelLabel, catalogModelFor, resolveModelAlias, modelWithOpenCodexEfforts, nativeGptSortRank, visibleControllerModels };
}
