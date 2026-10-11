import { readFile } from "node:fs/promises";
import path from "node:path";
const mime = { ".svg": "image/svg+xml" };
export async function createAppHtml(packageRoot) {
  const directory = path.join(packageRoot, "apps/dashboard");
  let html = await readFile(path.join(directory, "index.html"), "utf8");
  let css = await readFile(path.join(directory, "styles.css"), "utf8");
  for (const match of [...css.matchAll(/url\("(\/[^"?]+)(?:\?[^" ]*)?"\)/g)]) {
    const asset = await readFile(path.join(directory, match[1]));
    css = css.replaceAll(match[0], `url("data:${mime[path.extname(match[1])]};base64,${asset.toString("base64")}")`);
  }
  let previewMedia = {};
  try { previewMedia = JSON.parse(await readFile(path.join(directory, "assets/previews/manifest.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; }
  const script = await readFile(path.join(packageRoot, "packages/plugin/assets/app.js"), "utf8");
  html = html.replace(/\s*<link[^>]+>/g, "").replace(/\s*<script[\s\S]*?<\/script>/g, "");
  // 回调保留资源中的 $&、$` 等字面量，避免被 replace 当成替换指令。
  return html.replace("</head>", () => `<style>${css}</style></head>`)
    .replace("</body>", () => `<script>window.minecodexPreviewMedia=${JSON.stringify(previewMedia).replaceAll("<", "\\u003c")};</script><script type="module">${script.replaceAll("</script", "<\\/script")}</script></body>`);
}

export async function createPromptsHtml(packageRoot) {
  const script = await readFile(path.join(packageRoot,'packages/plugin/assets/prompts.js'),'utf8');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${await readFile(path.join(packageRoot,"packages/ui/src/native/mcp-theme.css"),"utf8")}  </style></head><body><script type="module">${script.replaceAll('</script','<\\/script')}</script></body></html>`;
}

// MCP 媒体通过 resources/read 按需读取，首次打开页面不传全量视频。
export async function readPreviewResource(directory, featureId, kind, uri) {
  const base = path.join(directory, "assets/previews");
  const manifest = JSON.parse(await readFile(path.join(base, "manifest.json"), "utf8"));
  if (!["video", "poster"].includes(kind) || !Object.hasOwn(manifest, featureId)) throw new Error("Preview resource unavailable");
  const filename = manifest[featureId][kind];
  const mediaTypes = {".mp4":"video/mp4", ".webm":"video/webm", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp"};
  const allowed = kind === "video" ? [".mp4", ".webm"] : [".png", ".jpg", ".webp"];
  if (typeof filename !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(filename) || !allowed.includes(path.extname(filename))) throw new Error("Invalid preview resource");
  const bytes = await readFile(path.join(base, filename));
  return {contents:[{uri:uri.href, mimeType:mediaTypes[path.extname(filename)], blob:bytes.toString("base64")}]};
}
