import { readFile } from "node:fs/promises";
import path from "node:path";
const mime = { ".svg": "image/svg+xml", ".ttf": "font/ttf" };
export async function createAppHtml(packageRoot) {
  const directory = path.join(packageRoot, "apps/dashboard");
  let html = await readFile(path.join(directory, "index.html"), "utf8");
  let css = await readFile(path.join(directory, "styles.css"), "utf8");
  for (const match of [...css.matchAll(/url\("(\/[^"?]+)(?:\?[^" ]*)?"\)/g)]) {
    const asset = await readFile(path.join(directory, match[1]));
    css = css.replaceAll(match[0], `url("data:${mime[path.extname(match[1])]};base64,${asset.toString("base64")}")`);
  }
  const script = await readFile(path.join(packageRoot, "packages/plugin/assets/app.js"), "utf8");
  html = html.replace(/\s*<link[^>]+>/g, "").replace(/\s*<script[\s\S]*?<\/script>/g, "");
  return html.replace("</head>", `<style>${css}</style></head>`)
    .replace("</body>", `<script type="module">${script.replaceAll("</script", "<\\/script")}</script></body>`);
}

export async function createPromptsHtml(packageRoot) {
  const script = await readFile(path.join(packageRoot,'packages/plugin/assets/prompts.js'),'utf8');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${await readFile(path.join(packageRoot,"packages/ui/src/native/mcp-theme.css"),"utf8")}  </style></head><body><script type="module">${script.replaceAll('</script','<\\/script')}</script></body></html>`;
}
