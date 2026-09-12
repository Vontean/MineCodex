import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { MAX_IMPORTED_IMAGE_BYTES } from "./image-library.mjs";
import { saveImageAs } from "./save-as.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const CODEX_EMBED_ORIGIN = "app://-";
const DEFAULT_PAGE_LIMIT = 36;
const MAX_PAGE_LIMIT = 72;
const MAX_PAGE_OFFSET = Number.MAX_SAFE_INTEGER;
const MAX_IMPORT_BODY_BYTES = Math.ceil(MAX_IMPORTED_IMAGE_BYTES * 4 / 3) + 64 * 1024;
const MAX_EDIT_AUXILIARY_BYTES = 8 * 1024 * 1024;

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/i18n.mjs", ["i18n.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function publicImage(image, { includePrompt = false } = {}) {
  const result = {
    id: image.id,
    threadId: image.threadId,
    imageGenerationItemId: image.imageGenerationItemId,
    width: image.width,
    height: image.height,
    byteLength: image.byteLength,
    createdAt: image.createdAt,
    importedAt: image.importedAt,
    sourceKind: image.sourceKind,
    projectId: image.projectId,
    projectName: image.projectName,
    threadTitle: image.threadTitle,
    archived: image.archived,
    fileUrl: `/api/images/${image.id}/file`,
    downloadUrl: `/api/images/${image.id}/download`,
    sourceUrl: image.threadId.startsWith("chatgpt:") ? null : `codex://threads/${image.threadId}`,
  };
  if (includePrompt) result.prompt = image.prompt;
  return result;
}

function publicGroup(group) {
  return {
    threadId: group.threadId,
    sourceKind: group.sourceKind,
    projectId: group.projectId,
    projectName: group.projectName,
    threadTitle: group.threadTitle,
    archived: group.archived,
    imageCount: group.imageCount,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    previews: group.previews.map((image) => publicImage(image)),
  };
}

function formatHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function mutationError(message, code) {
  return Object.assign(new Error(message), { status: 403, code });
}

async function readRequestBody(request, maxBytes) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw Object.assign(new Error("Request body exceeds the Images import limit"), {
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error("Request body exceeds the Images import limit"), {
        status: 413,
        code: "BODY_TOO_LARGE",
      });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function readImportPayload(request) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw Object.assign(new Error("Images import requires application/json"), {
      status: 415,
      code: "UNSUPPORTED_CONTENT_TYPE",
    });
  }
  let payload;
  try {
    payload = JSON.parse((await readRequestBody(request, MAX_IMPORT_BODY_BYTES)).toString("utf8"));
  } catch (error) {
    if (error.code === "BODY_TOO_LARGE") throw error;
    throw Object.assign(new Error("Images import body must be valid JSON"), {
      status: 400,
      code: "INVALID_JSON",
    });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw Object.assign(new Error("Images import body must be an object"), {
      status: 400,
      code: "INVALID_BODY",
    });
  }
  if (typeof payload.bytesBase64 !== "string" || payload.bytesBase64.length > MAX_IMPORT_BODY_BYTES) {
    throw Object.assign(new Error("Images import requires bounded base64 image bytes"), {
      status: 400,
      code: "INVALID_IMAGE_BYTES",
    });
  }
  const bytes = Buffer.from(payload.bytesBase64, "base64");
  if (!bytes.length || bytes.toString("base64") !== payload.bytesBase64.replace(/\s/g, "")) {
    throw Object.assign(new Error("Images import image bytes are not valid base64"), {
      status: 400,
      code: "INVALID_IMAGE_BYTES",
    });
  }
  return { ...payload, bytes };
}

async function readEditDraftPayload(request) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw Object.assign(new Error("Image edit draft requires application/json"), { status: 415, code: "UNSUPPORTED_CONTENT_TYPE" });
  }
  let payload;
  try {
    payload = JSON.parse((await readRequestBody(request, Math.ceil(MAX_EDIT_AUXILIARY_BYTES * 4 / 3) + 8 * 1024)).toString("utf8"));
  } catch (error) {
    if (error.code === "BODY_TOO_LARGE") throw error;
    throw Object.assign(new Error("Image edit draft must be valid JSON"), { status: 400, code: "INVALID_JSON" });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || !/^[a-f0-9]{24}$/.test(payload.imageId ?? "")) {
    throw Object.assign(new Error("Image edit draft requires an image id"), { status: 400, code: "INVALID_EDIT_DRAFT" });
  }
  if (payload.auxiliaryPngBase64 === undefined) return { imageId: payload.imageId, auxiliary: null };
  if (typeof payload.auxiliaryPngBase64 !== "string") {
    throw Object.assign(new Error("Image edit auxiliary image must be base64"), { status: 400, code: "INVALID_EDIT_AUXILIARY" });
  }
  const auxiliary = Buffer.from(payload.auxiliaryPngBase64, "base64");
  if (!auxiliary.length || auxiliary.length > MAX_EDIT_AUXILIARY_BYTES
    || auxiliary.toString("base64") !== payload.auxiliaryPngBase64.replace(/\s/g, "")
    || auxiliary.readUInt32BE(0) !== 0x89504e47) {
    throw Object.assign(new Error("Image edit auxiliary image must be a bounded PNG"), { status: 400, code: "INVALID_EDIT_AUXILIARY" });
  }
  return { imageId: payload.imageId, auxiliary };
}

function contentTypeForPath(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  return extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".webp" ? "image/webp" : "image/png";
}

function downloadFilename(image, sourcePath) {
  const stem = String(image.imageGenerationItemId ?? "generated-image")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 128) || "generated-image";
  return `${stem}${path.extname(sourcePath)}`;
}

function applyCodexEmbedCors(request, response) {
  if (request.headers.origin !== CODEX_EMBED_ORIGIN) return false;
  response.setHeader("Access-Control-Allow-Origin", CODEX_EMBED_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Vary", "Origin");
  return true;
}

function parseIntegerQuery(searchParams, name, { defaultValue, min, max }) {
  const values = searchParams.getAll(name);
  if (values.length === 0) return defaultValue;
  const [raw] = values;
  if (values.length !== 1 || !/^(0|[1-9]\d*)$/.test(raw)) {
    throw Object.assign(new Error(`${name} must be a single integer between ${min} and ${max}`), {
      status: 400,
      code: "INVALID_QUERY",
    });
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw Object.assign(new Error(`${name} must be between ${min} and ${max}`), {
      status: 400,
      code: "INVALID_QUERY",
    });
  }
  return value;
}

function paginationFor(url) {
  return {
    limit: parseIntegerQuery(url.searchParams, "limit", {
      defaultValue: DEFAULT_PAGE_LIMIT,
      min: 1,
      max: MAX_PAGE_LIMIT,
    }),
    offset: parseIntegerQuery(url.searchParams, "offset", {
      defaultValue: 0,
      min: 0,
      max: MAX_PAGE_OFFSET,
    }),
  };
}

function validateMutationOrigin(request, address, host) {
  const expectedOrigin = `http://${formatHost(host)}:${address.port}`;
  const expectedHost = new URL(expectedOrigin).host;
  if (request.headers.host !== expectedHost) {
    throw mutationError("Mutation requests are restricted to the exact bound loopback Host", "HOST_NOT_ALLOWED");
  }

  const origin = request.headers.origin;
  if (!origin) {
    throw mutationError("Mutation requests require the exact bound loopback Origin", "ORIGIN_NOT_ALLOWED");
  }
  if (origin === CODEX_EMBED_ORIGIN) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw mutationError("Request origin is invalid", "INVALID_ORIGIN");
  }
  if (parsed.origin !== expectedOrigin) {
    throw mutationError("Mutation requests are restricted to this exact local Images origin", "ORIGIN_NOT_ALLOWED");
  }
}

export async function createHttpServer({
  library,
  webDir,
  host = "127.0.0.1",
  port = 47831,
  instanceId = process.env.MINECODEX_FEATURE_INSTANCE_ID ?? "unconfigured",
}) {
  if (!library) throw new Error("library is required");
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("Images only supports loopback hosts");
  const editDrafts = new Map();
  const server = createNodeServer(async (request, response) => {
    try {
      applyCodexEmbedCors(request, response);
      const address = server.address();
      const boundOrigin = address && typeof address !== "string"
        ? `http://${formatHost(host)}:${address.port}`
        : `http://${formatHost(host)}:${port}`;
      const url = new URL(request.url ?? "/", boundOrigin);

      if (request.method === "OPTIONS") {
        response.writeHead(204, { "Cache-Control": "no-store" });
        response.end();
        return;
      }

      if (!["GET", "HEAD"].includes(request.method)) {
        validateMutationOrigin(request, address, host);
      }

      if (request.method === "GET" && (url.pathname === "/api/health" || url.pathname === "/health")) {
        json(response, 200, {
          ok: true,
          service: "images",
          protocolVersion: 1,
          instanceId,
          images: library.count(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/images") {
        const { limit, offset } = paginationFor(url);
        const source = url.searchParams.get("source") ?? "all";
        const threadId = url.searchParams.get("threadId") || null;
        const sort = url.searchParams.get("sort") === "asc" ? "asc" : "desc";
        const query = url.searchParams.get("q") ?? "";
        const images = library.list({
          query,
          source,
          threadId,
          sort,
          limit,
          offset,
        }).map(publicImage);
        json(response, 200, {
          images,
          count: library.count({ query, source, threadId }),
          limit,
          offset,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/image-facets") {
        json(response, 200, library.facets());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/image-groups") {
        const { limit, offset } = paginationFor(url);
        const source = url.searchParams.get("source") ?? "all";
        const groups = library.groups({ source, limit, offset }).map(publicGroup);
        json(response, 200, {
          groups,
          count: library.countGroups({ source }),
          imageCount: library.count({ source }),
          limit,
          offset,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/rescan") {
        if (library.rescanStatus().inProgress) {
          json(response, 202, { imported: 0, total: library.count(), inProgress: true });
          return;
        }
        const imported = await library.rescan();
        json(response, 200, { imported, total: library.count(), inProgress: false });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/import-generated-image") {
        const payload = await readImportPayload(request);
        const result = await library.importExternalImage({ ...payload, bytes: payload.bytes });
        if (!result.imported && result.reason !== "DUPLICATE") {
          json(response, 400, { ...result, imported: false });
          return;
        }
        json(response, result.reason === "DUPLICATE" ? 200 : 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/image-edit-draft") {
        const payload = await readEditDraftPayload(request);
        const image = library.get(payload.imageId);
        if (!image) {
          json(response, 404, { error: "Image not found" });
          return;
        }
        let auxiliaryPath = null;
        if (payload.auxiliary) {
          const editDir = path.join(library.dataDir, "edit-drafts");
          await mkdir(editDir, { recursive: true });
          auxiliaryPath = path.join(editDir, `${randomUUID()}.png`);
          await writeFile(auxiliaryPath, payload.auxiliary, { mode: 0o600 });
        }
        const draftId = randomUUID();
        editDrafts.set(draftId, { sourcePath: image.sourcePath, auxiliaryPath });
        json(response, 201, { draftId });
        return;
      }

      const editDraftMatch = url.pathname.match(/^\/api\/image-edit-draft\/([a-f0-9-]{36})$/);
      if (request.method === "GET" && editDraftMatch) {
        if (request.headers.origin !== CODEX_EMBED_ORIGIN) {
          throw mutationError("Image edit attachments are available only to RuntimeHost", "ORIGIN_NOT_ALLOWED");
        }
        const draft = editDrafts.get(editDraftMatch[1]);
        if (!draft) {
          json(response, 404, { error: "Image edit draft not found" });
          return;
        }
        editDrafts.delete(editDraftMatch[1]);
        json(response, 200, draft);
        return;
      }

      const saveAsMatch = url.pathname.match(/^\/api\/images\/([a-f0-9]{24})\/save-as$/);
      if (request.method === "POST" && saveAsMatch) {
        const image = library.get(saveAsMatch[1]);
        if (!image) {
          json(response, 404, { error: "Image not found" });
          return;
        }
        json(response, 200, await saveImageAs(image, { locale: url.searchParams.get("locale") ?? "en" }));
        return;
      }

      const detailMatch = url.pathname.match(/^\/api\/images\/([a-f0-9]{24})$/);
      if (request.method === "GET" && detailMatch) {
        const image = await library.hydratePrompt(detailMatch[1]);
        if (!image) {
          json(response, 404, { error: "Image not found" });
          return;
        }
        json(response, 200, { image: publicImage(image, { includePrompt: true }) });
        return;
      }

      const imageMatch = url.pathname.match(/^\/api\/images\/([a-f0-9]{24})\/(file|download)$/);
      if (request.method === "GET" && imageMatch) {
        const image = library.get(imageMatch[1]);
        if (!image) {
          json(response, 404, { error: "Image not found" });
          return;
        }
        const sourceStat = await stat(image.sourcePath);
        const headers = {
          "Content-Type": contentTypeForPath(image.sourcePath),
          "Content-Length": sourceStat.size,
          "Cache-Control": "public, max-age=31536000, immutable",
        };
        if (imageMatch[2] === "download") {
          headers["Content-Disposition"] = `attachment; filename="${downloadFilename(image, image.sourcePath)}"`;
        }
        response.writeHead(200, headers);
        createReadStream(image.sourcePath).pipe(response);
        return;
      }

      const staticFile = STATIC_FILES.get(url.pathname);
      if (request.method === "GET" && staticFile) {
        const [filename, contentType] = staticFile;
        const body = await readFile(path.join(webDir, filename));
        response.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
        });
        response.end(body);
        return;
      }

      json(response, 404, { error: "Not found" });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      json(response, status, {
        error: {
          code: error.code ?? "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const boundPort = address && typeof address !== "string" ? address.port : port;
  const origin = `http://${formatHost(host)}:${boundPort}`;
  return {
    host,
    port: boundPort,
    origin,
    url: origin,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
