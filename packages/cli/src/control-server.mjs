import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { BrowserExchangeStore } from "./browser-exchange.mjs";
import { FEATURE_IDS, readConfig, updateFeature } from "./config.mjs";
import { normalizeRuntimeReady } from "./runtime-manager.mjs";

import { createDataTransfer, MAX_TRANSFER_BYTES } from "./data-transfer/service.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packageMetadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const MAX_BODY_BYTES = 64 * 1024;
const DASHBOARD_FEATURE_ORDER = ["model-slider", "notes", "usage-meter", "session-status", "markdown-reading", "file-navigation", "images", "sites", "quick-chat", "sidebar-focus", "hide-upsell-banner"];
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function tokenMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  const left = createHash("sha256").update(candidate).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").flatMap((part) => {
    const index = part.indexOf("=");
    if (index < 1) return [];
    return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
}

function requestToken(request) {
  const authorization = request.headers.authorization ?? "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return parseCookies(request.headers.cookie).mcx_session ?? "";
}

function json(response, statusCode, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readJson(request, maxBytes = MAX_BODY_BYTES) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { statusCode: 400 });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Request body must be a JSON object"), { statusCode: 400 });
  }
  return value;
}

function localized(value, locale) {
  if (typeof value === "string") return value;
  return value?.[locale] ?? value?.en ?? Object.values(value ?? {})[0] ?? "";
}

function acceptedHealth(featureId, health) {
  if (health === true || typeof health !== "object" || health === null || Array.isArray(health)) return false;
  const identity = health.identity ?? health;
  return Boolean(
    identity
      && identity.service === featureId
      && identity.protocolVersion === 1
      && typeof identity.instanceId === "string"
      && identity.instanceId.length > 0
      && health.ok === true
  );
}

async function loadFeatureDefinitions(paths, locale = "en") {
  return Promise.all([...FEATURE_IDS].sort((a, b) => DASHBOARD_FEATURE_ORDER.indexOf(a) - DASHBOARD_FEATURE_ORDER.indexOf(b)).map(async (id) => {
    const manifestPath = path.join(paths.featuresRoot, id, "codex-feature.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    return {
      id,
      version: manifest.version ?? packageMetadata.version,
      label: localized(manifest.label, locale),
      description: localized(manifest.description, locale),
      iconUrl: `/api/icons/${id}.svg`,
      healthUrl: manifest.healthUrl ?? manifest.surfaceUrl ?? null,
    };
  }));
}

async function featureStatuses(paths, runtimeManager, locale, runtimeState = null) {
  const config = await readConfig(paths.configPath);
  const runtime = runtimeState ?? await (runtimeManager.refreshStatus?.() ?? runtimeManager.status());
  const definitions = await loadFeatureDefinitions(paths, locale);
  const plugins = runtime.plugins ?? runtime.pluginStates ?? [];
  const appliedFeatures = Array.isArray(runtime.appliedFeatures) ? runtime.appliedFeatures : [];
  const ready = normalizeRuntimeReady(runtime.ready ?? {
    runtimeSessionId: runtime.runtimeSessionId,
    features: appliedFeatures,
    plugins,
    renderer: runtime.renderer,
    failures: runtime.failures,
  });
  const renderer = ready.renderer;
  const rendererCurrent = Boolean(
    renderer?.discovered
      && renderer.runtimeSessionId
      && renderer.runtimeSessionId === ready.runtimeSessionId
      && renderer.active
      && Number(renderer.injectedTargets) > 0,
  );
  return definitions.map((feature) => {
    const plugin = ready.plugins.find((candidate) => candidate.featureId === feature.id) ?? null;
    const pluginState = plugin?.state ?? null;
    const applied = appliedFeatures.includes(feature.id)
      || ["configured", "launching", "ready", "injected", "checking", "partial", "degraded", "unavailable", "not-applicable"].includes(pluginState);
    const injected = Boolean(
      pluginState === "injected" && rendererCurrent,
    );
    const healthy = Boolean(
      injected
        && acceptedHealth(feature.id, plugin?.health),
    );
    let state;
    const pluginFailed = Boolean(
      pluginState === "failed"
        || plugin?.failure,
    );
    if (!runtime.running) {
      state = "stopped";
    } else if (!config.features[feature.id] && applied) {
      state = "restart-required";
    } else if (!config.features[feature.id] || pluginState === "stopped") {
      state = "stopped";
    } else if (pluginFailed) {
      state = "failed";
    } else if (config.features[feature.id] !== applied) {
      state = "restart-required";
    } else if (["checking","partial","degraded","unavailable","not-applicable"].includes(pluginState)) {
      state = rendererCurrent ? pluginState : "checking";
    } else if (pluginState === "configured" || pluginState === "launching" || pluginState === "ready") {
      state = "launching";
    } else if (injected && healthy) {
      state = "healthy";
    } else if (injected) {
      state = "injected";
    } else if (pluginState === "injected") {
      state = feature.healthUrl ? "launching" : "failed";
    } else {
      state = "launching";
    }
    const failure = plugin?.failure
      ?? (state === "failed" && pluginState === "injected" && !rendererCurrent
        ? {
          code: "CODEX_RENDERER_UNAVAILABLE",
          message: "The matching Codex renderer is unavailable; restart Codex.",
          phase: "renderer",
        }
        : null);
    return {
      ...feature,
      enabled: config.features[feature.id],
      applied,
      injected,
      healthy,
      state,
      targets: plugin?.targets ?? [],
      health: plugin?.health ?? null,
      failure,
    };
  });
}

function requireMutationOrigin(request, host, port) {
  const expectedHost = `${host}:${port}`;
  const origin = request.headers.origin;
  if (request.headers.host !== expectedHost || origin !== `http://${expectedHost}`) {
    throw Object.assign(new Error("Mutation Origin is not allowed"), { statusCode: 403 });
  }
}

async function iconResponse(id, paths, response) {
  let iconPath;
  if (id === "model-slider") {
    iconPath = path.join(paths.featuresRoot, id, "assets", "ui", "sparkles.svg");
  } else if (id === "notes") {
    iconPath = path.join(paths.featuresRoot, id, "assets", "icons", "book-open.svg");
  } else if (FEATURE_IDS.includes(id)) {
    const manifest = JSON.parse(await readFile(path.join(paths.featuresRoot, id, "codex-feature.json"), "utf8"));
    if (manifest.icon?.resource) {
      iconPath = path.resolve(paths.featuresRoot, id, manifest.icon.resource);
    } else {
      const viewBox = manifest.icon?.viewBox ?? "0 0 24 24";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${manifest.icon.markup}</svg>`;
      response.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
      response.end(svg);
      return;
    }
  } else {
    json(response, 404, { error: "NOT_FOUND" });
    return;
  }
  response.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
  // 仅统一控制台图标，不改变插件在 Codex 内使用的原始资源。
  const svg = (await readFile(iconPath, "utf8")).replace(/stroke-width="[^"]+"/g, 'stroke-width="2.1"');
  response.end(svg);
}

async function staticResponse(url, paths, response) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const sharedTooltip = requested === "assets/ui-tooltip.js";
  const absolute = sharedTooltip ? path.join(packageRoot, "packages/ui/src/components/tooltip.mjs") : path.resolve(paths.dashboardDir, requested);
  if (!sharedTooltip && absolute !== paths.dashboardDir && !absolute.startsWith(`${paths.dashboardDir}${path.sep}`)) {
    json(response, 404, { error: "NOT_FOUND" });
    return;
  }
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES.get(path.extname(absolute)) ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(createReadStream(absolute), response);
  } catch (error) {
    if (error.code === "ENOENT") json(response, 404, { error: "NOT_FOUND" });
    else throw error;
  }
}

export async function createControlServer({
  paths,
  token,
  runtimeManager,
  host = "127.0.0.1",
  port = 47830,
  logger = console,
  exchangeStore = new BrowserExchangeStore(),
}) {
  let transfer;
  const dataTransfer = () => transfer ??= createDataTransfer({ paths, version: packageMetadata.version });
  let boundPort = port;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${host}:${boundPort}`);
      if (request.method === "GET" && url.pathname === "/healthz") {
        json(response, 200, { service: "minecodex", version: packageMetadata.version, ok: true });
        return;
      }
      if (request.method === "GET" && url.pathname === "/auth") {
        let sessionToken;
        try {
          sessionToken = exchangeStore.consume(url.searchParams.get("exchange"));
        } catch {
          json(response, 403, { error: "INVALID_EXCHANGE" });
          return;
        }
        response.writeHead(303, {
          Location: "/",
          "Set-Cookie": `mcx_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/`,
          "Referrer-Policy": "no-referrer",
          "Cache-Control": "no-store",
        });
        response.end();
        return;
      }
      if (url.pathname.startsWith("/api/") && !tokenMatches(requestToken(request), token)) {
        json(response, 401, { error: "UNAUTHORIZED" });
        return;
      }
      const locale = String(request.headers["accept-language"] ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
      if (request.method === "GET" && url.pathname === "/api/status") {
        const runtime = await (runtimeManager.refreshStatus?.() ?? runtimeManager.status());
        const features = await featureStatuses(paths, runtimeManager, locale, runtime);
        json(response, 200, {
          version: packageMetadata.version,
          service: { running: true },
          runtime: {
            running: runtime.running,
            healthy: runtime.healthy === true,
            pid: runtime.pid ?? null,
            runtimeSessionId: runtime.runtimeSessionId ?? null,
            ready: runtime.ready ?? null,
            plugins: runtime.plugins ?? runtime.pluginStates ?? [],
            renderer: runtime.renderer ?? null,
            codex: runtime.codex ?? null,
            failures: runtime.failures ?? [],
          },
          runtimeSessionId: runtime.runtimeSessionId ?? null,
          renderer: runtime.renderer ?? null,
          pendingRestart: features.some((feature) => feature.state === "restart-required"),
          features,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/features") {
        json(response, 200, { features: await featureStatuses(paths, runtimeManager, locale) });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/update") {
        const registryResponse = await fetch("https://registry.npmjs.org/minecodex/latest", {
          signal: AbortSignal.timeout(4_000),
        });
        if (!registryResponse.ok) throw Object.assign(new Error("Update check failed"), { statusCode: 502 });
        const latest = String((await registryResponse.json()).version ?? "");
        json(response, 200, {
          current: packageMetadata.version,
          latest,
          available: Boolean(latest && latest !== packageMetadata.version),
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/auth/exchange") {
        requireMutationOrigin(request, host, boundPort);
        await readJson(request);
        json(response, 200, { exchange: exchangeStore.issue(token), expiresInMs: exchangeStore.ttlMs });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/data") {
        json(response, 200, await dataTransfer().inventory()); return;
      }
      if (request.method === "GET" && url.pathname === "/api/data/export") {
        const bundle = await dataTransfer().export();
        response.setHeader("Content-Disposition", 'attachment; filename="minecodex-data.mcx.json"');
        json(response, 200, bundle); return;
      }
      if (request.method === "POST" && ["/api/data/preview", "/api/data/import"].includes(url.pathname)) {
        requireMutationOrigin(request, host, boundPort);
        const bundle = await readJson(request, MAX_TRANSFER_BYTES);
        json(response, 200, await dataTransfer()[url.pathname.endsWith("/import") ? "import" : "preview"](bundle)); return;
      }
      const featureMatch = url.pathname.match(/^\/api\/features\/([a-z-]+)$/);
      if (request.method === "PATCH" && featureMatch) {
        requireMutationOrigin(request, host, boundPort);
        if (!FEATURE_IDS.includes(featureMatch[1])) {
          json(response, 404, { error: "NOT_FOUND" });
          return;
        }
        const body = await readJson(request);
        await updateFeature(paths.configPath, featureMatch[1], body.enabled);
        const features = await featureStatuses(paths, runtimeManager, locale);
        json(response, 200, {
          saved: true,
          pendingRestart: features.some((feature) => feature.state === "restart-required"),
          features,
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/restart") {
        requireMutationOrigin(request, host, boundPort);
        await readJson(request);
        await runtimeManager.restart();
        json(response, 200, { restarted: true, features: await featureStatuses(paths, runtimeManager, locale) });
        return;
      }
      const iconMatch = url.pathname.match(/^\/api\/icons\/([a-z-]+)\.svg$/);
      if (request.method === "GET" && iconMatch) {
        await iconResponse(iconMatch[1], paths, response);
        return;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        await staticResponse(url, paths, response);
        return;
      }
      json(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      logger.error(error);
      if (!response.headersSent) json(response, error.statusCode ?? 500, { error: error.message });
      else response.destroy(error);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  boundPort = address.port;
  return {
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
