import path from "node:path";

export function isLocalAddress(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") return true;
  const parts = host.split(".");
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p) && Number(p) <= 255)) {
    const [a, b] = parts.map(Number);
    return a === 127 || a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 169 && b === 254;
  }
  // URL 已规范化 IPv6；识别私有、链路本地及 IPv4 映射地址。
  if (/^(fc|fd)[0-9a-f]{2}:|^fe[89ab][0-9a-f]:/.test(host)) return true;
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return isLocalAddress([high >> 8, high & 255, low >> 8, low & 255].join("."));
  }
  return false;
}
export function normalizeSite(input) {
  const url = new URL(String(input.url ?? "").trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP or HTTPS URL without embedded credentials.");
  const title = String(input.title ?? "").trim().slice(0, 160) || url.hostname;
  const origin = input.origin;
  if (!origin || !["project", "thread", "external"].includes(origin.kind)) throw new Error("Choose the site's development source.");
  const cleanOrigin = { kind: origin.kind };
  if (origin.kind !== "external") {
    const field = origin.kind === "project" ? "projectId" : "threadId";
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(origin[field] ?? "")) throw new Error("Choose a valid development source.");
    cleanOrigin[field] = origin[field];
  }
  return { title, url: url.href, hosting: isLocalAddress(url.hostname) ? "local" : "self-hosted", origin: cleanOrigin };
}

export function projectForDirectory(projects, cwd, pathApi = path) {
  if (!cwd) return null;
  return projects.flatMap(project => project.rootPaths.map(root => ({ project, root })))
    .filter(({ root }) => { const relative = pathApi.relative(root, cwd); return relative === "" || (!relative.startsWith(`..${pathApi.sep}`) && relative !== ".." && !pathApi.isAbsolute(relative)); })
    .sort((a, b) => b.root.length - a.root.length)[0]?.project ?? null;
}
