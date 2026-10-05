import { readFile } from "node:fs/promises";
import { FEATURE_IDS } from "../../cli/src/config.mjs";

const READ_ROUTES = new Set(["/api/status", "/api/features", "/api/update", "/api/data", "/api/data/export"]);
export function assertControlRequest({ route, method = "GET", body }) {
  if (method === "GET" && READ_ROUTES.has(route) && body === undefined) return;
  if (method === "PATCH" && route.startsWith("/api/features/") && FEATURE_IDS.includes(route.slice(14))
    && body && Object.keys(body).length === 1 && typeof body.enabled === "boolean") return;
  if (method === "POST" && ["/api/restart", "/api/data/preview", "/api/data/import"].includes(route)
    && body && typeof body === "object" && !Array.isArray(body)) return;
  throw new Error("Unsupported MineCodex operation");
}

export function createControlClient({ paths, port = 47830, fetchImpl = fetch }) {
  const origin = `http://127.0.0.1:${port}`;
  const icons = new Map();
  async function request(route, method = "GET", body, locale = "en") {
    assertControlRequest({ route, method, body });
    const token = (await readFile(paths.tokenPath, "utf8")).trim();
    const headers = { Authorization: `Bearer ${token}`, Origin: origin, "Accept-Language": locale };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetchImpl(origin + route, {
      method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(route === "/api/restart" ? 60_000 : 20_000),
      redirect: "error",
    });
    const data = await response.json();
    if (Array.isArray(data.features)) {
      for (const feature of data.features) {
        if (!FEATURE_IDS.includes(feature.id) || !feature.iconUrl) continue;
        if (!icons.has(feature.id)) {
          const icon = await fetchImpl(`${origin}/api/icons/${feature.id}.svg`, { headers, signal: AbortSignal.timeout(5_000), redirect: "error" });
          if (icon.ok) icons.set(feature.id, `data:image/svg+xml;base64,${Buffer.from(await icon.text()).toString("base64")}`);
        }
        feature.iconUrl = icons.get(feature.id) ?? "";
      }
    }
    return { status: response.status, body: data };
  }
  return { request };
}
