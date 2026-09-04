import { randomUUID } from "node:crypto";
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
  "open-sidebar",
  "resolve-file-paths",
  "import-generated-image",
  "create-image-edit-thread",
]);

const PAGE_SCRIPT_ENTRY_KINDS = new Set(["page-script"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export const FEATURE_PROTOCOL_VERSION = 1;
export const FEATURE_HEALTH_TIMEOUT_MS = 750;
export const FEATURE_STARTUP_TIMEOUT_MS = 1_000;
export const FEATURE_HEALTH_POLL_INTERVAL_MS = 50;
export const FEATURE_STOP_TIMEOUT_MS = 1_000;
export const FEATURE_KILL_TIMEOUT_MS = 500;

function normalizeUrl(value, field) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error(`${field} must use http or https`);
  }
  return url.href;
}

function normalizeRuntimeUrls(manifest, env) {
  let surfaceUrl = manifest.surfaceUrl ? normalizeUrl(manifest.surfaceUrl, "surfaceUrl") : null;
  let healthUrl = manifest.healthUrl || surfaceUrl
    ? normalizeUrl(manifest.healthUrl ?? surfaceUrl, "healthUrl")
    : null;
  const portEnvironment = manifest.runtimePortEnvironment;
  if (!portEnvironment) return { surfaceUrl, healthUrl };
  if (!/^[A-Z][A-Z0-9_]*$/.test(portEnvironment)) {
    throw new Error("runtimePortEnvironment must be an environment variable name");
  }
  if (!surfaceUrl || !healthUrl) {
    throw new Error("runtimePortEnvironment requires surfaceUrl and healthUrl");
  }
  const urls = [new URL(surfaceUrl), new URL(healthUrl)];
  if (urls.some((url) => url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname))) {
    throw new Error("runtimePortEnvironment may only override loopback http URLs");
  }
  if (urls[0].origin !== urls[1].origin) {
    throw new Error("runtimePortEnvironment requires surfaceUrl and healthUrl to share an origin");
  }
  const configuredPort = env?.[portEnvironment];
  if (configuredPort === undefined || configuredPort === "") return { surfaceUrl, healthUrl };
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${portEnvironment} must be an integer from 1 to 65535`);
  }
  for (const url of urls) url.port = String(port);
  [surfaceUrl, healthUrl] = urls.map((url) => url.href);
  return { surfaceUrl, healthUrl };
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

async function normalizePageScript(manifest, projectDir) {
  const resource = manifest.entry?.script ?? manifest.pageScript?.resource ?? manifest.script;
  if (!resource) {
    throw new Error("page-script entries require entry.script or script.resource");
  }
  const scriptPath = path.resolve(projectDir, resource);
  const relative = path.relative(projectDir, scriptPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("page-script resource must stay inside the feature project");
  }
  const source = await readFile(scriptPath, "utf8");
  if (!source.trim()) {
    throw new Error("page-script resource must be a non-empty script file");
  }
  return { resource, source };
}

async function normalizeFeature(manifest, projectDir, env) {
  if (manifest.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (!manifest.id || !manifest.label) {
    throw new Error("id and label are required");
  }

  const label = normalizeLocalizedText(manifest.label, "label");
  const entryKind = manifest.entry?.kind ?? "sidebar";
  if (!new Set(["sidebar", "conversation-toolbar", "composer-model-selector", ...PAGE_SCRIPT_ENTRY_KINDS]).has(entryKind)) {
    throw new Error("entry.kind must be sidebar, conversation-toolbar, composer-model-selector, or page-script");
  }
  const isModelSelector = entryKind === "composer-model-selector";
  const isPageScript = PAGE_SCRIPT_ENTRY_KINDS.has(entryKind);
  if (!isModelSelector && !isPageScript && !manifest.surfaceUrl) {
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

  const pageScript = manifest.pageScript
    ? await normalizePageScript({ ...manifest, entry: { ...(manifest.entry ?? {}), script: manifest.pageScript.resource } }, projectDir)
    : null;

  const { surfaceUrl, healthUrl } = normalizeRuntimeUrls(manifest, env);
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
    healthUrl,
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
    pageScript: isPageScript ? await normalizePageScript(manifest, projectDir) : pageScript,
    placement: {
      after: manifest.placement?.after ?? "sites",
      order: Number(manifest.placement?.order ?? 100),
    },
    command: Array.isArray(manifest.command) ? manifest.command.map(String) : null,
    projectDir,
  };
}

export async function discoverFeatures(featuresRoot, { env = process.env } = {}) {
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
      features.push(await normalizeFeature(manifest, projectDir, env));
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
      capabilityKey: [
        model.opencodex_capability_provenance?.provider,
        model.opencodex_capability_provenance?.model_id,
      ].every((value) => typeof value === "string" && value.trim())
        ? `${model.opencodex_capability_provenance.provider.trim()}/${model.opencodex_capability_provenance.model_id.trim()}`
        : null,
    })).filter((model) => model.slug);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Could not load Codex model catalog: ${error.message}`);
  }
}

function sleep(timeoutMs) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

function failure(code, message, phase = "health") {
  return { code, message, phase };
}

function childHasExited(child) {
  return child && (
    (child.exitCode !== null && child.exitCode !== undefined)
    || (child.signalCode !== null && child.signalCode !== undefined)
  );
}

function waitForChildExit(child, timeoutMs) {
  if (childHasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener?.("exit", onExit);
      resolve(exited || childHasExited(child));
    };
    const onExit = () => finish(true);
    child.once?.("exit", onExit);
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}

async function terminateOwnedChild(record, options, { preserveState = false } = {}) {
  const child = record.child;
  if (!record.owned || !child) return;
  if (!childHasExited(child)) {
    try {
      child.kill?.("SIGTERM");
    } catch (error) {
      error.code ??= "FEATURE_CHILD_TERMINATE_FAILED";
      throw error;
    }
    let exited = await waitForChildExit(child, options.stopTimeoutMs ?? FEATURE_STOP_TIMEOUT_MS);
    if (!exited && !childHasExited(child)) {
      try {
        child.kill?.("SIGKILL");
      } catch (error) {
        error.code ??= "FEATURE_CHILD_TERMINATE_FAILED";
        throw error;
      }
      exited = await waitForChildExit(child, options.killTimeoutMs ?? FEATURE_KILL_TIMEOUT_MS);
    }
    if (!exited && !childHasExited(child)) {
      const error = new Error(
        `${record.featureId} child did not confirm exit after bounded SIGTERM/SIGKILL shutdown`,
      );
      error.code = "FEATURE_CHILD_SHUTDOWN_TIMEOUT";
      error.phase = "shutdown";
      throw error;
    }
  }
  if (!preserveState) record.state = "stopped";
}

export function validateFeatureHealth(payload, featureId, instanceId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, failure: failure("HEALTH_INVALID_RESPONSE", "Health response must be a JSON object") };
  }
  if (payload.ok !== true) {
    return {
      ok: false,
      failure: failure("HEALTH_NOT_READY", "Health response must report ok: true"),
    };
  }
  if (payload.service !== featureId) {
    return {
      ok: false,
      failure: failure(
        "HEALTH_IDENTITY_MISMATCH",
        `Health service ${JSON.stringify(payload.service ?? null)} does not match ${JSON.stringify(featureId)}`,
      ),
    };
  }
  if (payload.protocolVersion !== FEATURE_PROTOCOL_VERSION) {
    return {
      ok: false,
      failure: failure(
        "HEALTH_PROTOCOL_MISMATCH",
        `Health protocolVersion must be ${FEATURE_PROTOCOL_VERSION}`,
      ),
    };
  }
  if (typeof instanceId !== "string" || !instanceId || payload.instanceId !== instanceId) {
    return {
      ok: false,
      failure: failure("HEALTH_INSTANCE_MISMATCH", "Health instanceId is not owned by this RuntimeHost"),
    };
  }
  return { ok: true, health: payload };
}

export async function checkFeatureHealth(
  feature,
  {
    instanceId,
    fetchImpl = globalThis.fetch,
    timeoutMs = FEATURE_HEALTH_TIMEOUT_MS,
    signal,
  } = {},
) {
  if (!feature.healthUrl) {
    return {
      ok: false,
      failure: failure("HEALTH_NOT_CONFIGURED", `${feature.label ?? feature.id} has no healthUrl`),
    };
  }

  const controller = new AbortController();
  const boundedTimeoutMs = Math.max(1, Number(timeoutMs) || FEATURE_HEALTH_TIMEOUT_MS);
  let timedOut = false;
  let timer;
  let cancelFromParent;
  const request = (async () => {
    const response = await fetchImpl(feature.healthUrl, { signal: controller.signal });
    if (!response?.ok) {
      return {
        ok: false,
        failure: failure("HEALTH_HTTP", `Health endpoint returned HTTP ${response?.status ?? "error"}`),
      };
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, failure: failure("HEALTH_INVALID_JSON", "Health endpoint returned invalid JSON") };
    }
    return validateFeatureHealth(payload, feature.id, instanceId);
  })();
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({
        ok: false,
        failure: failure("HEALTH_TIMEOUT", `Health check timed out after ${boundedTimeoutMs}ms`),
      });
    }, boundedTimeoutMs);
  });
  const cancellation = signal
    ? new Promise((resolve) => {
      cancelFromParent = () => {
        controller.abort();
        resolve({
          ok: false,
          failure: failure(
            "HEALTH_ABORTED",
            `Health check for ${feature.label ?? feature.id} was cancelled`,
            "startup",
          ),
        });
      };
      if (signal.aborted) cancelFromParent();
      else signal.addEventListener("abort", cancelFromParent, { once: true });
    })
    : new Promise(() => {});

  try {
    const result = await Promise.race([request, timeout, cancellation]);
    if (timedOut) return result;
    return result;
  } catch (error) {
    if (signal?.aborted) {
      return {
        ok: false,
        failure: failure(
          "HEALTH_ABORTED",
          `Health check for ${feature.label ?? feature.id} was cancelled`,
          "startup",
        ),
      };
    }
    if (timedOut || error?.name === "AbortError") {
      return {
        ok: false,
        failure: failure("HEALTH_TIMEOUT", `Health check timed out after ${boundedTimeoutMs}ms`),
      };
    }
    return {
      ok: false,
      failure: failure("HEALTH_UNREACHABLE", error?.message ?? "Health endpoint was unreachable"),
    };
  } finally {
    clearTimeout(timer);
    if (cancelFromParent) signal.removeEventListener("abort", cancelFromParent);
  }
}

async function waitForFeatureHealth(feature, child, options) {
  const deadline = Date.now() + Math.max(1, Number(options.startupTimeoutMs) || FEATURE_STARTUP_TIMEOUT_MS);
  let lastFailure = failure("HEALTH_TIMEOUT", `Timed out waiting for ${feature.label ?? feature.id}`);
  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      return {
        ok: false,
        failure: failure("HEALTH_ABORTED", `Startup for ${feature.label ?? feature.id} was cancelled`, "startup"),
      };
    }
    if (options.childState?.failure) {
      return { ok: false, failure: options.childState.failure };
    }
    if (childHasExited(child)) {
      return {
        ok: false,
        failure: failure("CHILD_EXITED", `${feature.label ?? feature.id} exited before health became valid`, "startup"),
      };
    }
    const remainingBeforeProbe = deadline - Date.now();
    const result = await checkFeatureHealth(feature, {
      ...options,
      timeoutMs: Math.min(options.timeoutMs, Math.max(1, remainingBeforeProbe)),
    });
    if (result.ok) return result;
    if (options.signal?.aborted || result.failure?.code === "HEALTH_ABORTED") return result;
    if (options.childState?.failure) {
      return { ok: false, failure: options.childState.failure };
    }
    lastFailure = result.failure;
    if (options.childState?.failure || childHasExited(child)) break;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await options.sleep(Math.min(
      Math.max(1, Number(options.pollIntervalMs) || FEATURE_HEALTH_POLL_INTERVAL_MS),
      remaining,
    ));
  }
  return { ok: false, failure: lastFailure };
}

function normalizeStartOptions(loggerOrOptions, maybeOptions) {
  const looksLikeLogger = loggerOrOptions
    && (typeof loggerOrOptions.log === "function" || typeof loggerOrOptions.warn === "function");
  if (looksLikeLogger) {
    return { ...maybeOptions, logger: loggerOrOptions };
  }
  const options = loggerOrOptions ?? {};
  return { ...options, logger: options.logger ?? console };
}

function featureFailure(record) {
  if (!record.failure) return null;
  return { featureId: record.featureId, ...record.failure };
}

export async function startFeatureProcesses(features, loggerOrOptions = console, maybeOptions = {}) {
  const options = normalizeStartOptions(loggerOrOptions, maybeOptions);
  const instanceId = String(options.instanceId ?? randomUUID());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const spawnProcess = options.spawnProcess ?? spawn;
  const sleepImpl = options.sleep ?? sleep;
  const startupController = new AbortController();
  const terminationPromises = new WeakMap();
  let stopping = false;
  const records = features.map((feature) => ({
    featureId: feature.id,
    state: feature.surfaceUrl ? "launching" : "configured",
    owned: false,
    child: null,
    health: null,
    failure: null,
  }));

  function notifyStatusChange() {
    try {
      const result = options.onStatusChange?.();
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch((error) => {
          options.logger.warn?.("Feature status update failed", error.message);
        });
      }
    } catch (error) {
      options.logger.warn?.("Feature status update failed", error.message);
    }
  }

  function markFailed(record, nextFailure) {
    record.state = "failed";
    record.health = null;
    record.failure = nextFailure;
    notifyStatusChange();
  }

  function childExitFailure(feature, code, signal, phase) {
    const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    return {
      ...failure("CHILD_EXITED", `${feature.label ?? feature.id} child exited with ${reason}`, phase),
      exitCode: code ?? null,
      signal: signal ?? null,
    };
  }

  function observeOwnedChild(feature, record, child, childState) {
    child.on?.("error", (error) => {
      if (record.child !== child || stopping) return;
      if (record.state === "ready") {
        markFailed(record, {
          ...failure("CHILD_ERROR", error.message, "runtime"),
          name: error.name ?? "Error",
        });
        return;
      }
      childState.failure ??= failure("CHILD_SPAWN_FAILED", error.message, "startup");
    });
    child.once?.("exit", (code, signal) => {
      if (record.child !== child || stopping) return;
      if (record.state === "ready") {
        markFailed(record, childExitFailure(feature, code, signal, "runtime"));
        return;
      }
      if (record.state === "launching") {
        childState.failure ??= childExitFailure(feature, code, signal, "startup");
      }
    });
  }

  function terminateRecord(record, { preserveState = false } = {}) {
    const pending = terminationPromises.get(record);
    if (pending) return pending;
    let operation;
    operation = terminateOwnedChild(record, options, { preserveState }).finally(() => {
      if (terminationPromises.get(record) === operation) terminationPromises.delete(record);
    });
    terminationPromises.set(record, operation);
    return operation;
  }

  async function failOwnedStartup(feature, record, nextFailure) {
    markFailed(record, nextFailure);
    if (record.owned && record.child) {
      try {
        await terminateRecord(record, { preserveState: true });
      } catch (error) {
        record.failure = {
          ...record.failure,
          cleanup: {
            code: error.code ?? "FEATURE_CHILD_TERMINATE_FAILED",
            message: error.message,
            phase: error.phase ?? "shutdown",
          },
        };
        notifyStatusChange();
        options.logger.warn?.(`${feature.label}: owned child cleanup failed (${error.message})`);
      }
    }
    options.logger.warn?.(`${feature.label}: unavailable (${record.failure.message})`);
  }

  async function startOne(feature, index) {
    const record = records[index];
    if (!feature.surfaceUrl) return;

    const healthOptions = {
      instanceId,
      fetchImpl,
      timeoutMs: options.healthTimeoutMs ?? FEATURE_HEALTH_TIMEOUT_MS,
      startupTimeoutMs: options.startupTimeoutMs ?? FEATURE_STARTUP_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? FEATURE_HEALTH_POLL_INTERVAL_MS,
      sleep: sleepImpl,
      signal: startupController.signal,
    };
    const existing = await checkFeatureHealth(feature, healthOptions);
    if (stopping) return;
    if (existing.ok) {
      record.state = "ready";
      record.health = existing.health;
      record.failure = null;
      notifyStatusChange();
      options.logger.log?.(`${feature.label}: using existing service at ${feature.healthUrl}`);
      return;
    }
    if (!feature.command?.length) {
      await failOwnedStartup(feature, record, failure(
        "FEATURE_COMMAND_MISSING",
        `${feature.label} is offline and has no command in ${MANIFEST_NAME}`,
        "startup",
      ));
      return;
    }

    record.state = "launching";
    let child;
    const childState = { failure: null };
    try {
      child = spawnProcess(feature.command[0], feature.command.slice(1), {
        cwd: feature.projectDir,
        env: {
          ...process.env,
          CODEX_RUNTIME_HOST: "1",
          MINECODEX_FEATURE_INSTANCE_ID: instanceId,
        },
        stdio: "inherit",
      });
      record.child = child;
      record.owned = true;
      observeOwnedChild(feature, record, child, childState);
      notifyStatusChange();
    } catch (error) {
      await failOwnedStartup(feature, record, failure("CHILD_SPAWN_FAILED", error.message, "startup"));
      return;
    }

    const result = await waitForFeatureHealth(feature, child, {
      ...healthOptions,
      childState,
    });
    if (stopping) return;
    if (result.ok && !childState.failure && !childHasExited(child)) {
      record.state = "ready";
      record.health = result.health;
      record.failure = null;
      notifyStatusChange();
      options.logger.log?.(`${feature.label}: started at ${feature.surfaceUrl}`);
      return;
    }
    await failOwnedStartup(
      feature,
      record,
      childState.failure
        ?? (childHasExited(child)
          ? childExitFailure(feature, child.exitCode, child.signalCode, "startup")
          : result.failure),
    );
  }

  let startupPromise = Promise.resolve();
  let stopPromise = null;
  const supervisor = {
    instanceId,
    plugins: records,
    getFailures() {
      return records.map(featureFailure).filter(Boolean);
    },
    getStatuses({ rendererActive = false } = {}) {
      return records.map((record) => {
        let state = record.state;
        if (rendererActive && (state === "configured" || state === "ready")) state = "injected";
        return {
          featureId: record.featureId,
          state,
          owned: record.owned,
          health: record.health,
          failure: record.failure,
        };
      });
    },
    waitForStartup() {
      return startupPromise;
    },
    async stop() {
      if (stopPromise) return stopPromise;
      stopping = true;
      startupController.abort();
      stopPromise = (async () => {
        await startupPromise;
        const shutdownErrors = [];
        for (const record of records) {
          if (record.owned && record.child) {
            try {
              await terminateRecord(record, { preserveState: record.state === "failed" });
            } catch (error) {
              record.state = "failed";
              record.health = null;
              record.failure ??= {
                code: error.code ?? "FEATURE_CHILD_TERMINATE_FAILED",
                message: error.message,
                phase: error.phase ?? "shutdown",
              };
              record.failure.cleanup = {
                code: error.code ?? "FEATURE_CHILD_TERMINATE_FAILED",
                message: error.message,
                phase: error.phase ?? "shutdown",
              };
              notifyStatusChange();
              shutdownErrors.push(error);
              continue;
            }
          }
          if (record.state !== "failed") {
            const changed = record.state !== "stopped" || record.health !== null;
            record.state = "stopped";
            record.health = null;
            record.failure = null;
            if (changed) notifyStatusChange();
          }
        }
        if (shutdownErrors.length) {
          const error = new Error(
            `Feature child shutdown failed: ${shutdownErrors.map((failure) => failure.code ?? "UNKNOWN").join(", ")}`,
          );
          error.code = "FEATURE_CHILD_SHUTDOWN_FAILED";
          error.failures = shutdownErrors;
          throw error;
        }
      })();
      return stopPromise;
    },
  };
  Object.defineProperty(supervisor, "failures", {
    enumerable: true,
    get() {
      return supervisor.getFailures();
    },
  });
  startupPromise = Promise.all(features.map(async (feature, index) => {
    try {
      await startOne(feature, index);
    } catch (error) {
      if (stopping) return;
      await failOwnedStartup(
        feature,
        records[index],
        failure("FEATURE_START_FAILED", error?.message ?? "Feature startup failed", "startup"),
      );
    }
  })).then(() => supervisor);
  if (!options.deferredStart) await startupPromise;
  return supervisor;
}
