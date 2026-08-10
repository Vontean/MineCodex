import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { FEATURE_IDS, readConfig, updateFeature } from "./config.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packageMetadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const MAX_BODY_BYTES = 64 * 1024;
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
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

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
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

async function loadFeatureDefinitions(paths, locale = "en") {
  return Promise.all(FEATURE_IDS.map(async (id) => {
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

async function featureStatuses(paths, runtimeManager, locale) {
  const config = await readConfig(paths.configPath);
  const runtime = runtimeManager.status();
  const definitions = await loadFeatureDefinitions(paths, locale);
  return Promise.all(definitions.map(async (feature) => {
    let healthy = runtime.running && runtime.appliedFeatures.includes(feature.id);
    if (healthy && feature.healthUrl) {
      try {
        healthy = (await fetch(feature.healthUrl, { signal: AbortSignal.timeout(700) })).ok;
      } catch {
        healthy = false;
      }
    }
    return {
      ...feature,
      enabled: config.features[feature.id],
      applied: runtime.appliedFeatures.includes(feature.id),
      healthy,
    };
  }));
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
    iconPath = path.join(paths.featuresRoot, id, "assets", "icons", "sticky-note.svg");
  } else if (id === "images") {
    const manifest = JSON.parse(await readFile(path.join(paths.featuresRoot, id, "codex-feature.json"), "utf8"));
    const viewBox = manifest.icon?.viewBox ?? "0 0 24 24";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${manifest.icon.markup}</svg>`;
    response.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
    response.end(svg);
    return;
  } else {
    json(response, 404, { error: "NOT_FOUND" });
    return;
  }
  response.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
  await pipeline(createReadStream(iconPath), response);
}

async function staticResponse(url, paths, response) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const absolute = path.resolve(paths.dashboardDir, requested);
  if (absolute !== paths.dashboardDir && !absolute.startsWith(`${paths.dashboardDir}${path.sep}`)) {
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
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'",
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
}) {
  let boundPort = port;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${host}:${boundPort}`);
      if (request.method === "GET" && url.pathname === "/healthz") {
        json(response, 200, { service: "minecodex", version: packageMetadata.version, ok: true });
        return;
      }
      if (request.method === "GET" && url.pathname === "/auth") {
        if (!tokenMatches(url.searchParams.get("token"), token)) {
          json(response, 403, { error: "INVALID_TOKEN" });
          return;
        }
        response.writeHead(303, {
          Location: "/",
          "Set-Cookie": `mcx_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`,
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
        const features = await featureStatuses(paths, runtimeManager, locale);
        const runtime = runtimeManager.status();
        json(response, 200, {
          version: packageMetadata.version,
          runtime: { running: runtime.running },
          pendingRestart: features.some((feature) => feature.enabled !== feature.applied),
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
      const featureMatch = url.pathname.match(/^\/api\/features\/([a-z-]+)$/);
      if (request.method === "PATCH" && featureMatch) {
        requireMutationOrigin(request, host, boundPort);
        const body = await readJson(request);
        await updateFeature(paths.configPath, featureMatch[1], body.enabled);
        const features = await featureStatuses(paths, runtimeManager, locale);
        json(response, 200, {
          saved: true,
          pendingRestart: features.some((feature) => feature.enabled !== feature.applied),
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
