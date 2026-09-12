import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { ProductError } from "./product.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");
const LUCIDE_ICON_ROOT = path.resolve(DEFAULT_WEB_ROOT, "../assets/icons");
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_PREVIEW_BYTES = 64 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const CODEX_EMBED_ORIGIN = "app://-";
const LUCIDE_ICON_NAMES = [
  "circle",
  "ellipsis",
  "external-link",
  "list-todo",
  "message-square-quote",
  "paperclip",
  "star",
  "star-off",
  "trash-2",
];
const THIN_LUCIDE_ICON_NAMES = new Set([
  "ellipsis",
  "external-link",
  "list-todo",
  "message-square-quote",
  "paperclip",
  "star",
  "star-off",
  "trash-2",
]);
const CODEX_FILE_ICON_KINDS = [
  "artifact-document",
  "build",
  "code",
  "cplusplus",
  "css",
  "document",
  "file",
  "folder",
  "hashes",
  "html",
  "image",
  "java",
  "javascript",
  "json",
  "notebook",
  "pdf",
  "php",
  "presentation",
  "python",
  "react",
  "rust",
  "shell",
  "skill",
  "spreadsheet",
  "terminal",
  "toml",
  "typescript",
];

function pickFilesJxa(locale) {
  const prompt = locale === "zh-CN" ? "将文件固定到 CodexNotes" : "Pin files to CodexNotes";
  return String.raw`
const app = Application.currentApplication();
app.includeStandardAdditions = true;
const selected = app.chooseFile({
  withPrompt: ${JSON.stringify(prompt)},
  multipleSelectionsAllowed: true,
  invisibles: false,
});
JSON.stringify(selected.map((item) => item.toString()));
`;
}

const STATIC_FILES = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/i18n.mjs", { file: "i18n.mjs", type: "text/javascript; charset=utf-8" }],
  ["/file-icons.mjs", { file: "file-icons.mjs", type: "text/javascript; charset=utf-8" }],
  ["/todo-drag.mjs", { file: "todo-drag.mjs", type: "text/javascript; charset=utf-8" }],
  ...LUCIDE_ICON_NAMES.map((name) => [
    `/icons/${name}.svg`,
    {
      absoluteFile: path.join(LUCIDE_ICON_ROOT, `${name}.svg`),
      type: "image/svg+xml",
      opticalStrokeWidth: THIN_LUCIDE_ICON_NAMES.has(name) ? "1.5" : null,
    },
  ]),
  ["/icons/circle-check.svg", { file: "codex-task.svg", type: "image/svg+xml" }],
  ["/icons/attachment.svg", { file: "codex-attachment.svg", type: "image/svg+xml" }],
  ["/icons/edit-pencil.svg", { file: "codex-pencil.svg", type: "image/svg+xml" }],
  // Extracted from the Codex Summary section action so the Add silhouette and
  // optical weight match the host instead of Lucide's heavier stroked plus.
  ["/icons/plus.svg", { file: "codex-plus.svg", type: "image/svg+xml" }],
  ...CODEX_FILE_ICON_KINDS.map((kind) => [
    `/icons/file-${kind}.svg`,
    { file: `codex-${kind}.svg`, type: "image/svg+xml" },
  ]),
]);

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendEmpty(response, status = 204) {
  response.writeHead(status, { "Cache-Control": "no-store" });
  response.end();
}

async function readJson(request) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ProductError("Content-Type must be application/json", {
      code: "INVALID_CONTENT_TYPE",
      status: 415,
    });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ProductError("Request body is too large", {
        code: "BODY_TOO_LARGE",
        status: 413,
      });
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProductError("Request body must be valid JSON", { code: "INVALID_JSON" });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProductError("Request body must be a JSON object", { code: "INVALID_BODY" });
  }
  return parsed;
}

function idFrom(pathname, prefix, suffix = "") {
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  const raw = pathname.slice(prefix.length, suffix ? -suffix.length : undefined);
  if (!raw || raw.includes("/")) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new ProductError("Route id must use valid URL encoding", { code: "INVALID_ID" });
  }
  if (!decoded || decoded.includes("/")) {
    throw new ProductError("Route id is invalid", { code: "INVALID_ID" });
  }
  return decoded;
}

function normalizedLocale(value) {
  return String(value ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function requestLocale(request) {
  return normalizedLocale(request.headers["accept-language"]?.split(",", 1)[0]);
}

async function chooseFiles({ locale = "en" } = {}) {
  if (process.platform === "win32") return chooseFilesWindows(locale);
  if (process.platform !== "darwin") {
    throw new ProductError("The system picker is currently available on macOS", {
      code: "PICKER_UNAVAILABLE",
      status: 501,
    });
  }
  try {
    const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", pickFilesJxa(locale)], {
      maxBuffer: 1024 * 1024,
    });
    const paths = JSON.parse(stdout.trim() || "[]");
    return { cancelled: false, paths };
  } catch (error) {
    if (String(error.stderr ?? error.message).includes("-128")) {
      return { cancelled: true, paths: [] };
    }
    throw new ProductError("The system file picker could not be opened", {
      code: "PICKER_FAILED",
      status: 503,
    });
  }
}

// Windows 系统文件选择器：WinForms OpenFileDialog（STA 必需）。
async function chooseFilesWindows(locale) {
  const psSingleQuoted = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
    "$dialog.Title = " + psSingleQuoted(locale === "zh-CN" ? "选择要添加的文件" : "Choose files to add"),
    "$dialog.Multiselect = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileNames | ForEach-Object { [Console]::Out.WriteLine($_) } } else { [Console]::Out.Write('CANCELED') }",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
      maxBuffer: 1024 * 1024,
    });
    const output = String(stdout).trim();
    if (output === "CANCELED") return { cancelled: true, paths: [] };
    const paths = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return { cancelled: false, paths };
  } catch (error) {
    throw new ProductError("The system file picker could not be opened", {
      code: "PICKER_FAILED",
      status: 503,
    });
  }
}

export async function revealFileInSystemManager(filePath, {
  platform = process.platform,
  executeFile = execFileAsync,
} = {}) {
  let command;
  let args;
  if (platform === "darwin") {
    command = "/usr/bin/open";
    args = ["-R", filePath];
  } else if (platform === "win32") {
    command = "explorer.exe";
    args = ["/select,", filePath];
  } else {
    throw new ProductError("Reveal in the system file manager is not available on this platform", {
      code: "REVEAL_UNAVAILABLE",
      status: 501,
    });
  }
  try {
    await executeFile(command, args);
    return { revealed: true };
  } catch (error) {
    throw new ProductError("The file could not be revealed in the system file manager", {
      code: error.code ?? "REVEAL_FAILED",
      status: 503,
    });
  }
}

function formatHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function applyCodexEmbedCors(request, response) {
  if (request.headers.origin !== CODEX_EMBED_ORIGIN) return false;
  response.setHeader("Access-Control-Allow-Origin", CODEX_EMBED_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
  response.setHeader("Vary", "Origin");
  return true;
}

function validateMutationOrigin(request, address, host) {
  const expectedHost = formatHost(host);
  const expectedOrigin = `http://${expectedHost}:${address.port}`;
  const expectedHostHeader = new URL(expectedOrigin).host;
  if (request.headers.host !== expectedHostHeader) {
    throw new ProductError("Mutation requests are restricted to the exact bound loopback Host", {
      code: "HOST_NOT_ALLOWED",
      status: 403,
    });
  }

  const origin = request.headers.origin;
  if (!origin) return;
  if (origin === CODEX_EMBED_ORIGIN) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ProductError("Request origin is invalid", { code: "INVALID_ORIGIN", status: 403 });
  }
  if (parsed.origin !== expectedOrigin) {
    throw new ProductError("Mutation requests are restricted to this local CodexNotes origin", {
      code: "ORIGIN_NOT_ALLOWED",
      status: 403,
    });
  }
}

export function createCodexNotesServer({
  product,
  host = "127.0.0.1",
  port = 47832,
  webRoot = DEFAULT_WEB_ROOT,
  filePicker = chooseFiles,
  fileRevealer = revealFileInSystemManager,
  instanceId = process.env.MINECODEX_FEATURE_INSTANCE_ID ?? "unconfigured",
} = {}) {
  if (!product) throw new Error("product is required");
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error("CodexNotes only supports loopback hosts (127.0.0.1, localhost, or ::1)");
  }
  const eventClients = new Set();
  let heartbeat = null;

  function broadcast(change) {
    const payload = `id: ${change.revision}\nevent: change\ndata: ${JSON.stringify(change)}\n\n`;
    for (const client of eventClients) client.write(payload);
  }

  product.on("change", broadcast);

  const server = createServer(async (request, response) => {
    try {
      applyCodexEmbedCors(request, response);
      const url = new URL(request.url ?? "/", `http://${formatHost(host)}:${port}`);
      const { pathname } = url;
      const method = request.method ?? "GET";
      if (!["GET", "HEAD"].includes(method)) {
        validateMutationOrigin(request, server.address(), host);
      }

      if (method === "OPTIONS") {
        response.writeHead(204, { "Access-Control-Max-Age": "600" });
        response.end();
        return;
      }

      if (method === "GET" && pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          service: "notes",
          protocolVersion: 1,
          instanceId,
          revision: product.revision,
        });
        return;
      }

      if (method === "GET" && pathname === "/api/state") {
        const surface = url.searchParams.get("surface") ?? "all";
        sendJson(response, 200, await product.getState({
          surface,
          kind: url.searchParams.get("kind"),
          id: url.searchParams.get("id"),
        }));
        return;
      }

      if (method === "GET" && pathname === "/api/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write(`event: ready\ndata: ${JSON.stringify({ revision: product.revision })}\n\n`);
        eventClients.add(response);
        request.on("close", () => eventClients.delete(response));
        return;
      }

      if (method === "POST" && pathname === "/api/todos") {
        sendJson(response, 201, product.createTodo(await readJson(request)));
        return;
      }
      if (method === "POST" && pathname === "/api/todos/reorder") {
        const body = await readJson(request);
        sendJson(response, 200, product.reorderTodos(body.ids));
        return;
      }
      if (method === "DELETE" && pathname === "/api/todos/completed") {
        sendJson(response, 200, product.clearCompletedTodos());
        return;
      }
      const todoId = idFrom(pathname, "/api/todos/");
      if (todoId && method === "PATCH") {
        sendJson(response, 200, product.updateTodo(todoId, await readJson(request)));
        return;
      }
      if (todoId && method === "DELETE") {
        product.deleteTodo(todoId);
        sendEmpty(response);
        return;
      }

      if (method === "POST" && pathname === "/api/prompts") {
        sendJson(response, 201, product.createPrompt(await readJson(request)));
        return;
      }
      const promptUseId = idFrom(pathname, "/api/prompts/", "/use");
      if (promptUseId && method === "POST") {
        sendJson(response, 200, product.markPromptUsed(promptUseId, await readJson(request)));
        return;
      }
      const promptId = idFrom(pathname, "/api/prompts/");
      if (promptId && method === "PATCH") {
        sendJson(response, 200, product.updatePrompt(promptId, await readJson(request)));
        return;
      }
      if (promptId && method === "DELETE") {
        product.deletePrompt(promptId);
        sendEmpty(response);
        return;
      }

      if (method === "POST" && pathname === "/api/files") {
        sendJson(response, 200, await product.addFiles(await readJson(request)));
        return;
      }
      if (method === "POST" && pathname === "/api/files/pick") {
        const picked = await filePicker({ locale: requestLocale(request) });
        if (picked.cancelled) {
          sendJson(response, 200, { cancelled: true, added: [], existing: [], rejected: [], revision: product.revision });
        } else {
          sendJson(response, 200, { cancelled: false, ...await product.addFiles({ paths: picked.paths }) });
        }
        return;
      }
      const fileUseId = idFrom(pathname, "/api/files/", "/use");
      if (fileUseId && method === "POST") {
        sendJson(response, 200, await product.markFileUsed(fileUseId, await readJson(request)));
        return;
      }
      const fileRevealId = idFrom(pathname, "/api/files/", "/reveal");
      if (fileRevealId && method === "POST") {
        const file = product.getFile(fileRevealId);
        await fileRevealer(file.path);
        sendJson(response, 200, { revealed: true });
        return;
      }
      const filePreviewId = idFrom(pathname, "/api/files/", "/preview");
      if (filePreviewId && (method === "GET" || method === "HEAD")) {
        const file = product.getFile(filePreviewId);
        if (!file.mimeType.startsWith("image/")) {
          throw new ProductError("Only pinned image files have previews", {
            code: "PREVIEW_UNAVAILABLE",
            status: 415,
          });
        }
        let info;
        try {
          info = await stat(file.path);
        } catch (error) {
          if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
            product.removeMissingFile(file.id);
            throw new ProductError("The source image no longer exists", {
              code: "FILE_MISSING",
              status: 410,
            });
          }
          throw error;
        }
        if (!info.isFile()) {
          product.removeMissingFile(file.id);
          throw new ProductError("The source image no longer exists", {
            code: "FILE_MISSING",
            status: 410,
          });
        }
        if (info.size > MAX_PREVIEW_BYTES) {
          throw new ProductError("The source image is too large to preview", {
            code: "PREVIEW_TOO_LARGE",
            status: 413,
            details: { maxBytes: MAX_PREVIEW_BYTES },
          });
        }
        const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
        if (request.headers["if-none-match"] === etag) {
          response.writeHead(304, {
            ETag: etag,
            "Cache-Control": "private, max-age=0, must-revalidate",
          });
          response.end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": file.mimeType,
          "Content-Length": info.size,
          "Cache-Control": "private, max-age=0, must-revalidate",
          ETag: etag,
          "Last-Modified": info.mtime.toUTCString(),
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        });
        if (method === "HEAD") response.end();
        else await pipeline(createReadStream(file.path), response);
        return;
      }
      const fileId = idFrom(pathname, "/api/files/");
      if (fileId && method === "DELETE") {
        product.deleteFile(fileId);
        sendEmpty(response);
        return;
      }

      const staticEntry = STATIC_FILES.get(pathname);
      if (staticEntry && (method === "GET" || method === "HEAD")) {
        const source = await readFile(staticEntry.absoluteFile ?? path.join(webRoot, staticEntry.file));
        const body = staticEntry.opticalStrokeWidth
          ? Buffer.from(source.toString("utf8").replace(
            /stroke-width="[^"]+"/,
            `stroke-width="${staticEntry.opticalStrokeWidth}"`,
          ))
          : source;
        response.writeHead(200, {
          "Content-Type": staticEntry.type,
          "Content-Length": body.length,
          "Cache-Control": "no-cache",
          "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        });
        if (method === "HEAD") response.end();
        else response.end(body);
        return;
      }

      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route was not found" } });
    } catch (error) {
      const status = error instanceof ProductError ? error.status : 500;
      const code = error instanceof ProductError ? error.code : "INTERNAL_ERROR";
      const message = error instanceof ProductError ? error.message : "CodexNotes could not complete the request";
      if (status >= 500) console.error(error);
      if (!response.headersSent) {
        sendJson(response, status, { error: { code, message, details: error.details ?? null } });
      } else {
        response.destroy();
      }
    }
  });

  return {
    server,
    get origin() {
      const address = server.address();
      if (!address || typeof address === "string") return null;
      return `http://${formatHost(host)}:${address.port}`;
    },
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      heartbeat = setInterval(() => {
        for (const client of eventClients) client.write(": heartbeat\n\n");
      }, 20_000);
      heartbeat.unref();
      return this;
    },
    async close() {
      if (heartbeat) clearInterval(heartbeat);
      for (const client of eventClients) client.end();
      eventClients.clear();
      product.off("change", broadcast);
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}
