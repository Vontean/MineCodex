import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { saveImageAs } from "./save-as.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const DEFAULT_PAGE_LIMIT = 36;
const MAX_PAGE_LIMIT = 72;
const MAX_PAGE_OFFSET = Number.MAX_SAFE_INTEGER;

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
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
    sourceUrl: `codex://threads/${image.threadId}`,
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
  const server = createNodeServer(async (request, response) => {
    try {
      const address = server.address();
      const boundOrigin = address && typeof address !== "string"
        ? `http://${formatHost(host)}:${address.port}`
        : `http://${formatHost(host)}:${port}`;
      const url = new URL(request.url ?? "/", boundOrigin);

      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
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

      const saveAsMatch = url.pathname.match(/^\/api\/images\/([a-f0-9]{24})\/save-as$/);
      if (request.method === "POST" && saveAsMatch) {
        const image = library.get(saveAsMatch[1]);
        if (!image) {
          json(response, 404, { error: "Image not found" });
          return;
        }
        json(response, 200, await saveImageAs(image));
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
          "Content-Type": "image/png",
          "Content-Length": sourceStat.size,
          "Cache-Control": "public, max-age=31536000, immutable",
        };
        if (imageMatch[2] === "download") {
          headers["Content-Disposition"] = `attachment; filename="${image.imageGenerationItemId}.png"`;
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
