import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MANIFEST_NAME = "codex-feature.json";
const HOST_ACTIONS = new Set([
  "insert-text",
  "attach-file",
  "open-detail-tab",
  "open-editor-modal",
  "resolve-file-paths",
]);

function normalizeUrl(value, field) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error(`${field} must use http or https`);
  }
  return url.href;
}

function normalizeLocaleKey(value) {
  const key = String(value).trim();
  if (key.toLowerCase().startsWith("zh")) return "zh-CN";
  if (key.toLowerCase().startsWith("en")) return "en";
  return key;
}

function normalizeLocalizedText(value, field) {
  if (typeof value === "string" && value.trim()) {
    return { value, locales: { en: value } };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const locales = {};
    for (const [locale, text] of Object.entries(value)) {
      if (typeof text !== "string" || !text.trim()) {
        throw new Error(`${field}.${locale} must be a non-empty string`);
      }
      locales[normalizeLocaleKey(locale)] = text;
    }
    const fallback = locales.en ?? Object.values(locales)[0];
    if (!fallback) throw new Error(`${field} must define at least one locale`);
    return { value: fallback, locales: { en: fallback, ...locales } };
  }
  throw new Error(`${field} must be a string or locale map`);
}

async function normalizeIcon(icon, projectDir) {
  if (!icon) return null;
  if (icon.markup) return icon;
  if (!icon.resource) throw new Error("icon must include markup or resource");
  const resourcePath = path.resolve(projectDir, icon.resource);
  const relative = path.relative(projectDir, resourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("icon.resource must stay inside the feature project");
  }
  const svg = await readFile(resourcePath, "utf8");
  const match = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!match) throw new Error("icon.resource must contain one SVG root");
  const viewBox = match[1].match(/viewBox=["']([^"']+)["']/i)?.[1] ?? "0 0 24 24";
  return { viewBox, markup: match[2].trim(), resource: icon.resource };
}

async function normalizeModelSelector(modelSelector, projectDir) {
  if (!modelSelector || typeof modelSelector !== "object" || Array.isArray(modelSelector)) {
    throw new Error("composer-model-selector entries require modelSelector");
  }
  const maxVisibleItems = Number(modelSelector.maxVisibleItems ?? 6);
  if (!Number.isInteger(maxVisibleItems) || maxVisibleItems < 1) {
    throw new Error("modelSelector.maxVisibleItems must be a positive integer");
  }
  const favoriteStorageKey = String(modelSelector.favoriteStorageKey ?? "").trim();
  if (!favoriteStorageKey) {
    throw new Error("modelSelector.favoriteStorageKey is required");
  }

  const providerAliases = {};
  for (const [provider, label] of Object.entries(modelSelector.providerAliases ?? {})) {
    if (!String(provider).trim() || !String(label).trim()) {
      throw new Error("modelSelector.providerAliases must contain non-empty strings");
    }
    providerAliases[String(provider).trim().toLowerCase()] = String(label).trim();
  }

  const brands = await Promise.all((modelSelector.brands ?? []).map(async (brand, index) => {
    const id = String(brand.id ?? "").trim();
    const keywords = (brand.keywords ?? []).map((keyword) => String(keyword).trim().toLowerCase()).filter(Boolean);
    if (!id || !keywords.length || !brand.icon) {
      throw new Error(`modelSelector.brands.${index} requires id, keywords, and icon`);
    }
    return { id, keywords, icon: await normalizeIcon(brand.icon, projectDir) };
  }));
  if (new Set(brands.map((brand) => brand.id)).size !== brands.length) {
    throw new Error("modelSelector brand ids must be unique");
  }

  const icons = modelSelector.icons ?? {};
  if (!icons.fallback || !icons.star || !icons.unstar) {
    throw new Error("modelSelector.icons requires fallback, star, and unstar");
  }
  const strings = {};
  for (const key of ["star", "unstar"]) {
    const localized = normalizeLocalizedText(modelSelector.strings?.[key], `modelSelector.strings.${key}`);
    strings[key] = { value: localized.value, locales: localized.locales };
  }

  return {
    maxVisibleItems,
    favoriteStorageKey,
    providerAliases,
    strings,
    icons: {
      fallback: await normalizeIcon(icons.fallback, projectDir),
      star: await normalizeIcon(icons.star, projectDir),
      unstar: await normalizeIcon(icons.unstar, projectDir),
    },
    brands,
  };
}

async function normalizeFeature(manifest, projectDir) {
  if (manifest.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (!manifest.id || !manifest.label) {
    throw new Error("id and label are required");
  }

  const label = normalizeLocalizedText(manifest.label, "label");
  const entryKind = manifest.entry?.kind ?? "sidebar";
  if (!new Set(["sidebar", "conversation-toolbar", "composer-model-selector"]).has(entryKind)) {
    throw new Error("entry.kind must be sidebar, conversation-toolbar, or composer-model-selector");
  }
  const isModelSelector = entryKind === "composer-model-selector";
  if (!isModelSelector && !manifest.surfaceUrl) {
    throw new Error("surfaceUrl is required for rendered features");
  }
  if (entryKind === "conversation-toolbar" && !manifest.entry?.ariaLabel) {
    throw new Error("conversation-toolbar entries require entry.ariaLabel");
  }
  if (entryKind === "conversation-toolbar" && !manifest.pinnedSummary?.surfaceUrl) {
    throw new Error("conversation-toolbar entries require pinnedSummary.surfaceUrl");
  }
  const summaryPresentation = manifest.pinnedSummary?.presentation ?? "responsive-summary";
  if (summaryPresentation !== "responsive-summary") {
    throw new Error("pinnedSummary.presentation must be responsive-summary");
  }

  const detailTabs = await Promise.all((manifest.detailTabs ?? []).map(async (detail) => {
    if (!detail.id || !detail.label || !detail.surfaceUrl) {
      throw new Error("each detailTabs entry requires id, label, and surfaceUrl");
    }
    const detailLabel = normalizeLocalizedText(detail.label, `detailTabs.${detail.id}.label`);
    return {
      id: String(detail.id),
      label: detailLabel.value,
      labels: detailLabel.locales,
      surfaceUrl: normalizeUrl(detail.surfaceUrl, `detailTabs.${detail.id}.surfaceUrl`),
      icon: await normalizeIcon(detail.icon, projectDir),
    };
  }));
  if (new Set(detailTabs.map((detail) => detail.id)).size !== detailTabs.length) {
    throw new Error("detailTabs ids must be unique");
  }
  const hostActions = (manifest.hostActions ?? []).map(String);
  if (hostActions.some((action) => !HOST_ACTIONS.has(action))) {
    throw new Error("hostActions contains an unsupported action");
  }

  const surfaceUrl = manifest.surfaceUrl ? normalizeUrl(manifest.surfaceUrl, "surfaceUrl") : null;
  const entryLabel = normalizeLocalizedText(manifest.entry?.ariaLabel ?? manifest.label, "entry.ariaLabel");
  const summaryLabel = manifest.pinnedSummary
    ? normalizeLocalizedText(manifest.pinnedSummary.label ?? manifest.label, "pinnedSummary.label")
    : null;
  const overlayLabel = manifest.pinnedSummary
    ? normalizeLocalizedText(manifest.pinnedSummary.overlayLabel ?? manifest.label, "pinnedSummary.overlayLabel")
    : null;
  const pinnedLabel = manifest.pinnedSummary
    ? normalizeLocalizedText(
      manifest.pinnedSummary.pinnedLabel
        ?? manifest.entry?.ariaLabel
        ?? (typeof manifest.label === "string"
          ? `Toggle pinned ${manifest.label.toLowerCase()}`
          : manifest.label),
      "pinnedSummary.pinnedLabel",
    )
    : null;

  return {
    id: String(manifest.id),
    label: label.value,
    labels: label.locales,
    surfaceUrl,
    healthUrl: manifest.healthUrl || surfaceUrl
      ? normalizeUrl(manifest.healthUrl ?? surfaceUrl, "healthUrl")
      : null,
    icon: await normalizeIcon(manifest.icon, projectDir),
    entry: {
      kind: entryKind,
      ariaLabel: entryLabel.value,
      ariaLabels: entryLabel.locales,
    },
    pinnedSummary: manifest.pinnedSummary ? {
      label: summaryLabel.value,
      labels: summaryLabel.locales,
      surfaceUrl: normalizeUrl(manifest.pinnedSummary.surfaceUrl, "pinnedSummary.surfaceUrl"),
      presentation: summaryPresentation,
      overlayLabel: overlayLabel.value,
      overlayLabels: overlayLabel.locales,
      pinnedLabel: pinnedLabel.value,
      pinnedLabels: pinnedLabel.locales,
    } : null,
    detailTabs,
    hostActions,
    modelSelector: isModelSelector
      ? await normalizeModelSelector(manifest.modelSelector, projectDir)
      : null,
    placement: {
      after: manifest.placement?.after ?? "sites",
      order: Number(manifest.placement?.order ?? 100),
    },
    command: Array.isArray(manifest.command) ? manifest.command.map(String) : null,
    projectDir,
  };
}

export async function discoverFeatures(featuresRoot) {
  const entries = await readdir(featuresRoot, { withFileTypes: true });
  const features = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(featuresRoot, entry.name);
    let source;
    try {
      source = await readFile(path.join(projectDir, MANIFEST_NAME), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    try {
      const manifest = JSON.parse(source);
      features.push(await normalizeFeature(manifest, projectDir));
    } catch (error) {
      throw new Error(`Invalid ${entry.name}/${MANIFEST_NAME}: ${error.message}`);
    }
  }

  return features.sort((left, right) => (
    left.placement.order - right.placement.order || left.label.localeCompare(right.label)
  ));
}

export function selectEnabledFeatures(features, configuredValue) {
  if (configuredValue === undefined) return features;
  const enabled = new Set(String(configuredValue).split(",").map((value) => value.trim()).filter(Boolean));
  return features.filter((feature) => enabled.has(feature.id));
}

export async function loadConfiguredModelCatalog(
  configPath = path.join(os.homedir(), ".codex", "config.toml"),
) {
  try {
    const config = await readFile(configPath, "utf8");
    const configuredPath = config.match(/^\s*model_catalog_json\s*=\s*["']([^"']+)["']/m)?.[1];
    if (!configuredPath) return [];
    const catalogPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(path.dirname(configPath), configuredPath);
    const payload = JSON.parse(await readFile(catalogPath, "utf8"));
    const models = Array.isArray(payload) ? payload : payload.models;
    if (!Array.isArray(models)) return [];
    return models.map((model) => ({
      slug: String(model.slug ?? "").trim(),
      displayName: String(model.display_name ?? model.slug ?? "").trim(),
      defaultReasoningLevel: String(model.default_reasoning_level ?? "").trim(),
      supportedReasoningLevels: (model.supported_reasoning_levels ?? []).map((level) => ({
        effort: String(level.effort ?? "").trim(),
        description: String(level.description ?? "").trim(),
      })).filter((level) => level.effort),
      additionalSpeedTiers: (model.additional_speed_tiers ?? []).map(String),
      serviceTiers: (model.service_tiers ?? []).map((tier) => ({
        id: String(tier.id ?? "").trim(),
        name: String(tier.name ?? "").trim(),
      })),
    })).filter((model) => model.slug);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Could not load Codex model catalog: ${error.message}`);
  }
}

async function isReachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitUntilReachable(feature, child, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReachable(feature.healthUrl)) return;
    if (child?.exitCode !== null) {
      throw new Error(`${feature.label} exited before ${feature.surfaceUrl} became available`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${feature.label} at ${feature.healthUrl}`);
}

export async function startFeatureProcesses(features, logger = console) {
  const children = [];
  const failures = [];

  for (const feature of features) {
    if (!feature.surfaceUrl) continue;
    try {
      if (await isReachable(feature.healthUrl)) {
        logger.log(`${feature.label}: using existing service at ${feature.healthUrl}`);
        continue;
      }
      if (!feature.command?.length) {
        throw new Error(`${feature.label} is offline and has no command in ${MANIFEST_NAME}`);
      }

      const child = spawn(feature.command[0], feature.command.slice(1), {
        cwd: feature.projectDir,
        env: { ...process.env, CODEX_RUNTIME_HOST: "1" },
        stdio: "inherit",
      });
      children.push(child);
      await waitUntilReachable(feature, child);
      logger.log(`${feature.label}: started at ${feature.surfaceUrl}`);
    } catch (error) {
      failures.push({ featureId: feature.id, message: error.message });
      logger.warn(`${feature.label}: unavailable (${error.message})`);
    }
  }

  return {
    failures,
    stop() {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGTERM");
      }
    },
  };
}
