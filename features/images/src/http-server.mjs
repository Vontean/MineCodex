import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer as createNodeServer } from "node:http";
import path from "node:path";
import { saveImageAs } from "./save-as.mjs";

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

function publicImage(image) {
  return {
    id: image.id,
    threadId: image.threadId,
    imageGenerationItemId: image.imageGenerationItemId,
    prompt: image.prompt,
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
    previews: group.previews.map(publicImage),
  };
}

export async function createHttpServer({ library, webDir, host = "127.0.0.1", port = 47831 }) {
  const server = createNodeServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);

      if (request.method === "GET" && url.pathname === "/health") {
        json(response, 200, { ok: true, images: library.count() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/images") {
        const limit = Math.min(72, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "36", 10)));
        const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10));
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
        const limit = Math.min(72, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "36", 10)));
        const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10));
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
        const imported = await library.rescan();
        json(response, 200, { imported, total: library.count() });
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
        json(response, 200, { image: publicImage(image) });
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
      json(response, 500, { error: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  return {
    host,
    port,
    url: `http://${host}:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
