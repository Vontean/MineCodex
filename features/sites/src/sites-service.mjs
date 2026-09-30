import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { findProjectSites, entryKey } from "./project-sites.mjs";
import { SiteLauncher } from "./site-launcher.mjs";
import { SitePreviews } from "./sites-preview.mjs";

const run = promisify(execFile);
const loops = new Set(["localhost", "127.0.0.1", "[::1]"]);
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

export function parseListeners(output) {
  let pid, command;
  const entries = new Map();
  for (const line of output.split("\n")) {
    if (line[0] === "p") pid = Number(line.slice(1));
    if (line[0] === "c") command = line.slice(1);
    if (line[0] !== "n" || !pid) continue;
    const port = Number(line.match(/:(\d+)$/)?.[1]);
    if (!port) continue;
    const address = line.slice(1, line.lastIndexOf(":"));
    // 只访问归属于项目的本机监听地址，不探测局域网。
    if (!["*", "0.0.0.0", "127.0.0.1", "[::]", "[::1]"].includes(address)) continue;
    const host = address === "[::1]" ? "[::1]" : "127.0.0.1";
    entries.set(`${pid}:${port}`, { pid, command, port, url: `http://${host}:${port}/` });
  }
  return [...entries.values()];
}

export async function probePage(url, { fetchImpl = fetch, timeoutMs = 1400 } = {}) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual", headers: { Accept: "text/html" } });
  // 自动发现不跟随跳转，以免一次本机检查变成任意网络访问。
  if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) { await response.body?.cancel(); return null; }
  const reader = response.body?.getReader();
  if (!reader) return null;
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (bytes < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value.slice(0, Math.max(0, 65536 - (bytes - value.byteLength))), { stream: true });
    }
  } finally { await reader.cancel(); }
  if (!/<(?:!doctype\s+html|html|head|body|title|div|main)\b/i.test(text)) return null;
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")?.trim().slice(0, 160);
  return { title: title || new URL(url).host };
}

export async function localListeners({ platform = process.platform, runImpl = run } = {}) {
  if (platform === "win32") {
    // Windows 不公开进程 cwd；仅采用命令行中可确认的项目绝对路径。
    const script = '$p=@{}; Get-CimInstance Win32_Process | ForEach-Object {$p[[int]$_.ProcessId]=$_.CommandLine}; @(Get-NetTCPConnection -State Listen | ForEach-Object { [pscustomobject]@{pid=$_.OwningProcess;address=$_.LocalAddress;port=$_.LocalPort;command=$p[[int]$_.OwningProcess]} }) | ConvertTo-Json -Compress';
    const { stdout } = await runImpl("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 });
    return [].concat(JSON.parse(stdout || "[]")).filter(e => ["::", "::1", "0.0.0.0", "127.0.0.1"].includes(e.address)).map(e => ({ ...e, url: `http://${e.address === "::1" ? "[::1]" : "127.0.0.1"}:${e.port}/` }));
  }
  let stdout;
  try { ({ stdout } = await runImpl("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 })); }
  catch (error) { if (error.code === 1 && !error.stdout) return []; throw error; }
  const entries = parseListeners(stdout);
  if (!entries.length) return [];
  const pids = [...new Set(entries.map(e => e.pid))].join(",");
  const [result, processInfo] = await Promise.all([
    runImpl("lsof", ["-a", "-p", pids, "-d", "cwd", "-Fn"], { timeout: 4000, maxBuffer: 2 * 1024 * 1024 }),
    runImpl("ps", ["-ww", "-p", pids, "-o", "pid=,args="], { timeout: 2000, maxBuffer: 2 * 1024 * 1024 }),
  ].map(task => task.catch(error => {
    // 服务可在两次枚举之间退出，保留仍存活进程的输出。
    if (error.code === 1) return { stdout: error.stdout || "" };
    throw error;
  })));
  const commands = new Map(processInfo.stdout.split("\n").flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match ? [[Number(match[1]), match[2]]] : [];
  }));
  let pid; const cwd = new Map();
  for (const line of result.stdout.split("\n")) { if (line[0] === "p") pid = Number(line.slice(1)); if (line[0] === "n") cwd.set(pid, line.slice(1)); }
  return entries.map(e => ({ ...e, command: commands.get(e.pid) || "", cwd: cwd.get(e.pid) }));
}

export class SitesService {
  constructor({ dataDir, codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), listeners = localListeners, probe = probePage } = {}) {
    const support = process.platform === "win32" ? path.join(process.env.APPDATA || os.homedir(), "MineCodex") : path.join(os.homedir(), "Library", "Application Support", "MineCodex");
    this.file = path.join(dataDir || process.env.MINECODEX_SITES_DATA_DIR || path.join(support, "sites"), "sites.json");
    this.previews = new SitePreviews(path.join(path.dirname(this.file), "previews")); this.discoveredUrls = new Set(); this.entries = new Map(); this.discoveryQueue = Promise.resolve();
    this.launcher = new SiteLauncher(probe); this.launchJobs = new Map();
    this.codexHome = codexHome; this.listeners = listeners; this.probe = probe; this.queue = Promise.resolve();
  }
  async catalog() {
    let state;
    try { state = JSON.parse(await readFile(path.join(this.codexHome, ".codex-global-state.json"), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return { projects: [], threads: [] }; throw error; }
    const projects = Object.entries(state["local-projects"] ?? {}).map(([id, p]) => ({ id, name: p.name || id, rootPaths: (p.rootPaths ?? []).filter(r => typeof r === "string") }));
    const ids = new Set(state["projectless-thread-ids"] ?? []);
    let threads = [];
    if (ids.size) {
      let db;
      try {
        db = new DatabaseSync(path.join(this.codexHome, "state_5.sqlite"), { readOnly: true });
        threads = db.prepare("SELECT id, title, name FROM threads WHERE archived = 0 ORDER BY updated_at DESC").all().filter(t => ids.has(t.id)).map(t => ({ id: t.id, title: t.name || t.title || t.id }));
      } catch (error) { if (!/unable to open database/i.test(error.message)) throw error; }
      finally { db?.close(); }
    }
    return { projects, threads };
  }
  async read() {
    try { const data = JSON.parse(await readFile(this.file, "utf8")); if (data.schemaVersion !== 1 || !Array.isArray(data.sites)) throw new Error("Unsupported sites data."); return data.sites.map(site => site.url ? { ...site, hosting: isLocalAddress(new URL(site.url).hostname) ? "local" : "self-hosted" } : site); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  async mutate(operation) {
    const task = this.queue.catch(() => {}).then(async () => {
      const sites = await this.read(); const result = operation(sites);
      await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ schemaVersion: 1, sites }, null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, this.file); return result;
    });
    this.queue = task; return task;
  }
  discover() {
    const task = this.discoveryQueue.catch(() => {}).then(() => this.scan()); this.discoveryQueue = task; return task;
  }
  async scan() {
    const { projects } = await this.catalog();
    const canonical = await Promise.all(projects.map(async p => ({ ...p, rootPaths: await Promise.all(p.rootPaths.map(r => realpath(r).catch(() => r))) })));
    const definitions = await findProjectSites(canonical);
    const listeners = await this.listeners(); const deadline = Date.now() + 7500; const candidates = []; const seen = new Set();
    const attributed = await Promise.all(listeners.map(async e => {
      const cwd = e.cwd ? await realpath(e.cwd).catch(() => e.cwd) : null;
      const project = projectForDirectory(canonical, cwd) || (process.platform === "win32" ? canonical.filter(p => p.rootPaths.some(r => String(e.command).toLowerCase().includes((r + path.sep).toLowerCase()))).sort((a,b) => b.rootPaths[0].length - a.rootPaths[0].length)[0] : null);
      return { ...e, project };
    }));
    // 模拟器桥接首页也会执行 simctl；须在 HTTP 探测前排除，避免安装授权弹窗。
    // 无法读取完整命令时不主动探测，仍允许用户手动添加网址。
    const pending = attributed.filter(e => e.project && e.command && !/(?:^|[\s/\\])(?:serve-sim|swiftui-preview-browser)(?:[.\s/\\]|$)/i.test(e.command));
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length && Date.now() < deadline) {
        const entry = pending.shift();
        if ([...this.launcher.running.values()].some(r => r.url === entry.url)) continue;
        if (seen.has(entry.url)) continue; seen.add(entry.url);
        try { const page = await this.probe(entry.url, { timeoutMs: Math.min(1400, Math.max(1, deadline - Date.now())) }); if (page) candidates.push({ title: page.title, url: entry.url, projectId: entry.project.id, projectName: entry.project.name, directory: entry.cwd, status: "running" }); } catch { /* 未就绪或非 HTTP 服务不列为网页。 */ }
      }
    }));
    const historyFile = path.join(path.dirname(this.file), "project-history.json");
    let history = {};
    try { history = JSON.parse(await readFile(historyFile, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
    for (const candidate of candidates) {
      const definition = definitions.filter(d => d.projectId === candidate.projectId && candidate.directory && projectForDirectory([{ rootPaths: [d.directory] }], candidate.directory)).sort((a,b) => b.directory.length - a.directory.length)[0];
      candidate.entryId = definition?.entryId || entryKey(candidate.projectId, candidate.directory || candidate.url);
      if (definition) { Object.assign(candidate, { framework: definition.framework, script: definition.script, command: definition.command }); definitions.splice(definitions.indexOf(definition), 1); }
      history[candidate.entryId] = { ...history[candidate.entryId], projectId:candidate.projectId,projectName:candidate.projectName,directory:candidate.directory, lastSeenAt: Date.now(), url: candidate.url, title: candidate.title };
    }
    for (const [id, previous] of Object.entries(history)) {
      if (previous.directory && projectForDirectory(canonical.filter(p => p.id === previous.projectId), previous.directory) && !candidates.some(c => c.entryId === id) && !definitions.some(c => c.entryId === id)) definitions.push({ ...previous,entryId:id,status:"stopped" });
    }
    for (const definition of definitions) {
      const running = this.launcher.running.get(definition.entryId);
      candidates.push({ ...definition, ...history[definition.entryId], url: running?.url || history[definition.entryId]?.url || null, status: running ? "running" : "stopped" });
    }
    for (const candidate of candidates) Object.assign(candidate, { lastSeenAt: history[candidate.entryId]?.lastSeenAt, lastStartedAt: history[candidate.entryId]?.lastStartedAt });
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(historyFile, JSON.stringify(history), { mode: 0o600 });
    this.entries = new Map(candidates.map(c => [c.entryId, c])); this.scannedAt = Date.now();
    this.discoveredUrls = new Set(candidates.filter(c => c.status === "running").map(c => c.url));
    return { candidates: candidates.sort((a,b) => a.projectName.localeCompare(b.projectName) || (a.url || a.directory).localeCompare(b.url || b.directory)), scope: "local-projects" };
  }
  async action(payload = {}) {
    if (payload.operation === "start") {
      const site = (await this.read()).find(s => s.id === payload.id);
      if (!site || site.origin.kind !== "project") throw new Error("Project site is unavailable.");
      const job = this.launchJobs.get(site.id);
      if (job) { if (job.pending) return job; this.launchJobs.delete(site.id); if (job.error) throw new Error(job.error); return job; }
      await this.discover(); const entry = site.entryId ? this.entries.get(site.entryId) : [...this.entries.values()].find(e => e.url === site.url && e.projectId === site.origin.projectId);
      if (!entry) throw new Error("Project website entry no longer exists.");
      if (entry.status === "running") return { url: entry.url };
      this.launchJobs.set(site.id, { pending: true });
      this.launcher.start(entry).then(async url => {
        const now = Date.now();
        await this.mutate(sites => { const saved = sites.find(s => s.id === site.id); if (saved) Object.assign(saved, {entryId:entry.entryId,url,status:"running",lastStartedAt:now,lastSeenAt:now}); });
        const historyFile = path.join(path.dirname(this.file), "project-history.json");
        // 和扫描共用串行队列，避免运行记录被并发覆盖。
        const update = this.discoveryQueue.catch(() => {}).then(async () => {
          const history = JSON.parse(await readFile(historyFile,"utf8")); history[entry.entryId] = { ...history[entry.entryId],url,lastStartedAt:now,lastSeenAt:now,title:entry.title }; await writeFile(historyFile,JSON.stringify(history),{mode:0o600});
        }); this.discoveryQueue = update; await update;
        this.entries.set(entry.entryId,{...entry,url,status:"running",lastStartedAt:now,lastSeenAt:now});
        this.launchJobs.set(site.id,{url});
      }).catch(error => this.launchJobs.set(site.id,{error:error.message}));
      return { pending:true };
    }
    if (payload.operation === "preview") {
      const url = new URL(String(payload.url)).href;
      if (!this.discoveredUrls.has(url) && !(payload.cachedOnly && [...this.entries.values()].some(e => e.url === url)) && !(await this.read()).some(s => s.url === url)) throw new Error("Site is not in the library or discovery results.");
      // 手动收录也不能让截图重新触发模拟器工具链安装。
      const parsed = new URL(url);
      if (loops.has(parsed.hostname)) {
        const listeners = await this.listeners();
        if (listeners.some(e => new URL(e.url).port === parsed.port && /(?:serve-sim|swiftui-preview-browser)/i.test(e.command))) return { image: null };
      }
      return payload.cachedOnly ? this.previews.cached(url) : this.previews.request(url);
    }
    if (payload.operation === "list") {
      if (!this.scannedAt || Date.now() - this.scannedAt > 10000) await this.discover();
      return { sites: (await this.read()).map(site => {
        const entry = site.entryId ? this.entries.get(site.entryId) : [...this.entries.values()].find(e => e.url && e.url === site.url && e.projectId === site.origin.projectId);
        return entry ? { ...site,...entry } : site;
      }), ...await this.catalog() };
    }
    if (payload.operation === "discover") return this.discover();
    if (payload.operation === "save") {
      let site;
      if (payload.site?.entryId) {
        const candidate = this.entries.get(payload.site.entryId);
        if (!candidate) throw new Error("Project site is no longer available. Reopen Add site.");
        site = { ...candidate, hosting: "local", origin: { kind: "project", projectId: candidate.projectId } };
      } else site = normalizeSite(payload.site);
      const catalog = await this.catalog();
      if (site.origin.kind === "project" && !catalog.projects.some(p => p.id === site.origin.projectId)) throw new Error("Project is no longer available. Choose another source.");
      if (site.origin.kind === "thread" && !catalog.threads.some(t => t.id === site.origin.threadId)) throw new Error("Projectless chat is no longer available. Choose another source.");
      return this.mutate(sites => {
        const index = payload.id ? sites.findIndex(s => s.id === payload.id) : -1;
        if (payload.id && index < 0) throw new Error("Site no longer exists. Refresh the list.");
        const duplicate = sites.find(s => s.id !== payload.id && (site.entryId ? s.entryId === site.entryId || (!!site.url && s.url === site.url) : s.url === site.url) && JSON.stringify(s.origin) === JSON.stringify(site.origin));
        if (duplicate) {
          if (payload.id) throw new Error("This URL and development source are already saved in another entry.");
          return duplicate;
        }
        const record = { ...site, id: payload.id || randomUUID(), createdAt: index < 0 ? Date.now() : sites[index].createdAt, updatedAt: Date.now() };
        if (index < 0) sites.unshift(record); else sites[index] = record;
        return record;
      });
    }
    if (payload.operation === "remove") return this.mutate(sites => { const i = sites.findIndex(s => s.id === payload.id); if (i >= 0) sites.splice(i, 1); return { removed: i >= 0 }; });
    if (payload.operation === "resolve") {
      let site = (await this.read()).find(s => s.id === payload.id);
      if (!site) throw new Error("Site no longer exists.");
      const catalog = await this.catalog();
      if (site.origin.kind === "project" && !catalog.projects.some(p => p.id === site.origin.projectId)) return { site, missing: "project" };
      if (site.origin.kind === "thread" && !catalog.threads.some(t => t.id === site.origin.threadId)) return { site, missing: "thread" };
      if (site.entryId) { await this.discover(); const entry = site.entryId ? this.entries.get(site.entryId) : [...this.entries.values()].find(e => e.url === site.url && e.projectId === site.origin.projectId); if (entry) site = { ...site, ...entry }; }
      const project = site.origin.kind === "project" ? catalog.projects.find(p => p.id === site.origin.projectId) : null;
      return { site, ...(project ? { cwd: site.directory || project.rootPaths[0] } : {}) };
    }
    throw new Error("Unknown Sites operation.");
  }
}
