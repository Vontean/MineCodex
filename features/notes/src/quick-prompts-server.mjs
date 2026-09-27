import { createServer } from "node:http";
import nativeIcons from "../assets/native-prompt-icons.json" with { type: "json" };
import nativeEmojis from "../assets/native-emojis.json" with { type: "json" };
import { ProductError } from "./product.mjs";

// 沿用已有提示词存储；不再暴露 Todo、Files 或旧版网页。
export function createQuickPromptsServer({
  product,
  host = "127.0.0.1",
  port = 47832,
  instanceId = process.env.MINECODEX_FEATURE_INSTANCE_ID ?? "unconfigured",
} = {}) {
  if (!product) throw new Error("product is required");
  if (!["127.0.0.1", "localhost", "::1"].includes(host))
    throw new Error("Loopback host required");
  const hostname = host === "::1" ? "[::1]" : host;
  const json = (response, status, value) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(value));
  };
  async function body(request) {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      throw new ProductError("JSON required", { status: 415 });
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 1024 * 1024)
        throw new ProductError("Request too large", { status: 413 });
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      throw new ProductError("Invalid JSON");
    }
  }
  const server = createServer(async (request, response) => {
    try {
      const origin = `http://${hostname}:${server.address().port}`;
      if (
        request.headers.host !== new URL(origin).host ||
        (request.headers.origin &&
          ![origin, "app://-"].includes(request.headers.origin))
      ) {
        json(response, 403, { error: { message: "Origin not allowed" } });
        return;
      }
      if (request.headers.origin === "app://-") {
        response.setHeader("Access-Control-Allow-Origin", "app://-");
        response.setHeader("Vary", "Origin");
        response.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PATCH, DELETE, OPTIONS",
        );
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      const url = new URL(request.url, origin);
      if (request.method === "GET" && url.pathname === "/api/health") {
        json(response, 200, {
          ok: true,
          service: "notes",
          protocolVersion: 1,
          instanceId,
          revision: product.revision,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/state") {
        const state = await product.getState();
        json(response, 200, {
          revision: state.revision,
          prompts: state.prompts,
          categories: state.categories,
          icons: nativeIcons,
          emojis: nativeEmojis,
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/prompts") {
        json(response, 201, product.createPrompt(await body(request)));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/categories") {
        json(
          response,
          201,
          product.savePromptCategory(null, await body(request)),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/reorder") {
        json(response, 200, product.reorderPrompts(await body(request)));
        return;
      }
      const category = url.pathname.match(
        /^\/api\/categories\/([a-zA-Z0-9-]+)$/,
      );
      if (category && request.method === "PATCH") {
        json(
          response,
          200,
          product.savePromptCategory(category[1], await body(request)),
        );
        return;
      }
      if (category && request.method === "DELETE") {
        json(response, 200, product.deletePromptCategory(category[1]));
        return;
      }
      const match = url.pathname.match(/^\/api\/prompts\/([^/]+)(\/use)?$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (match[2] && request.method === "POST") {
          json(response, 200, product.markPromptUsed(id, await body(request)));
          return;
        }
        if (!match[2] && request.method === "PATCH") {
          json(response, 200, product.updatePrompt(id, await body(request)));
          return;
        }
        if (!match[2] && request.method === "DELETE") {
          product.deletePrompt(id);
          response.writeHead(204);
          response.end();
          return;
        }
      }
      json(response, 404, { error: { message: "Not found" } });
    } catch (error) {
      json(response, error instanceof ProductError ? error.status : 500, {
        error: {
          message:
            error instanceof ProductError ? error.message : "Request failed",
        },
      });
    }
  });
  return {
    get origin() {
      return `http://${hostname}:${server.address()?.port ?? port}`;
    },
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
