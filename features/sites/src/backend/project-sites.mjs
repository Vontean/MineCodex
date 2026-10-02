import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { isAuxiliarySite } from "../domain/discovery-candidates.mjs";

const ignored = new Set(["node_modules", "dist", "build", "out", "vendor", "target", "coverage"]);
export const entryKey = (projectId, directory) => createHash("sha256").update(`${projectId}\0${directory}`).digest("hex");
export async function isSkillExample(directory, root) {
  let current = directory;
  while (current && current !== root && current !== path.dirname(current)) {
    if (/^(?:demo|examples?|preview)$/i.test(path.basename(current))
      && await stat(path.join(path.dirname(current), "SKILL.md")).then(s => s.isFile(), () => false)) return true;
    current = path.dirname(current);
  }
  return false;
}
export async function findProjectSites(projects) {
  const found = [], visited = new Set();
  let remaining = 4000;
  async function walk(directory, project, root, depth) {
    if (--remaining < 0 || depth > 4 || isAuxiliarySite(path.relative(root, directory))) return;
    const canonical = await realpath(directory).catch(() => null);
    if (!canonical || visited.has(canonical)) return; visited.add(canonical);
    let entries; try { entries = await readdir(canonical, { withFileTypes: true }); } catch { return; }
    let pkg;
    if (entries.some(e => e.name === "package.json")) { try { pkg = JSON.parse(await readFile(path.join(canonical, "package.json"), "utf8")); } catch {} }
    const scripts = Object.entries(pkg?.scripts || {});
    const selected = ["dev", "start", "serve"].flatMap(name => scripts.filter(([key]) => key === name))
      .map(([script, command]) => ({ script, command, framework: String(command).match(/^(vite|next\s+dev|astro\s+dev)(?:\s|$)/)?.[1]?.split(" ")[0] }))
      .find(s => s.framework && !/[;&|`$<>\n]/.test(s.command));
    // 不把只有 dev/watch 名称的编译器、MCP 或模拟器当作网站。
    const staticEntry = !pkg && entries.some(e => e.isFile() && e.name === "index.html");
    if (selected || staticEntry) {
      let title = pkg?.name || path.basename(canonical);
      if (staticEntry) { const html = await readFile(path.join(canonical, "index.html"), "utf8").catch(() => ""); title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || title; }
      if (isAuxiliarySite(path.relative(root, canonical), title)) return;
      const modifiedAt = (await stat(path.join(canonical, staticEntry ? "index.html" : "package.json"))).mtimeMs;
      found.push({ modifiedAt, entryId: entryKey(project.id, canonical), directory: canonical, projectId: project.id, projectName: project.name, title, framework: selected?.framework || "static", script: selected?.script || null, command: selected?.command || null, url: null, status: "stopped" });
    }
    for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith(".") && !ignored.has(entry.name) && !(entries.some(e => e.name === "SKILL.md") && /^(?:demo|examples?|preview)$/i.test(entry.name))) await walk(path.join(canonical, entry.name), project, root, depth + 1);
  }
  // 深层项目先归属，避免被父项目重复收录。
  const roots = projects.flatMap(p => p.rootPaths.map(root => ({ root, project: p }))).sort((a,b) => b.root.length - a.root.length);
  for (const { root, project } of roots) await walk(root, project, root, 0);
  return found;
}
