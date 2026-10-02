import { normalizeSite, projectForDirectory, isLocalAddress } from "../domain/site.mjs";
import { localListeners, probePage } from "./discovery.mjs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CodexCatalog } from "../adapters/codex/catalog.mjs";

import { isAuxiliarySite, selectDiscoveryCandidates } from "../domain/discovery-candidates.mjs";
import { findProjectSites, entryKey, isSkillExample } from "./project-sites.mjs";
import { SiteLauncher } from "./site-launcher.mjs";
import { SitePreviews } from "./sites-preview.mjs";

const loops = new Set(["localhost", "127.0.0.1", "[::1]"]);
export class SitesService {
  constructor({ dataDir, codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), listeners = localListeners, probe = probePage, catalog = new CodexCatalog(codexHome) } = {}) {
    const support = process.platform === "win32" ? path.join(process.env.APPDATA || os.homedir(), "MineCodex") : path.join(os.homedir(), "Library", "Application Support", "MineCodex");
    this.file = path.join(dataDir || process.env.MINECODEX_SITES_DATA_DIR || path.join(support, "sites"), "sites.json");
    this.previews = new SitePreviews(path.join(path.dirname(this.file), "previews")); this.discoveredUrls = new Set(); this.entries = new Map(); this.discoveryQueue = Promise.resolve();
    this.launcher = new SiteLauncher(probe); this.launchJobs = new Map();
    this.catalogReader = catalog; this.listeners = listeners; this.probe = probe; this.queue = Promise.resolve();
  }
  catalog() { return this.catalogReader.snapshot(); }
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
      const root = project?.rootPaths.find(r => projectForDirectory([{ rootPaths: [r] }], cwd)) || project?.rootPaths[0];
      const auxiliary = root && (isAuxiliarySite(path.relative(root, cwd || root)) || cwd && await isSkillExample(cwd, root));
      return { ...e, cwd, project, auxiliary };
    }));
    // 模拟器桥接首页也会执行 simctl；须在 HTTP 探测前排除，避免安装授权弹窗。
    // 无法读取完整命令时不主动探测，仍允许用户手动添加网址。
    const pending = attributed.filter(e => e.project && e.command && !e.auxiliary && !/(?:^|[\s/\\])(?:serve-sim|swiftui-preview-browser)(?:[.\s/\\]|$)/i.test(e.command));
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length && Date.now() < deadline) {
        const entry = pending.shift();
        if ([...this.launcher.running.values()].some(r => r.url === entry.url)) continue;
        if (seen.has(entry.url)) continue; seen.add(entry.url);
        try { const page = await this.probe(entry.url, { timeoutMs: Math.min(1400, Math.max(1, deadline - Date.now())) }); if (page && !isAuxiliarySite("", page.title)) candidates.push({ title: page.title, url: entry.url, projectId: entry.project.id, projectName: entry.project.name, directory: entry.cwd, status: "running" }); } catch { /* 未就绪或非 HTTP 服务不列为网页。 */ }
      }
    }));
    const historyFile = path.join(path.dirname(this.file), "project-history.json");
    let history = {};
    try { history = JSON.parse(await readFile(historyFile, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
    for (const candidate of candidates) {
      const definition = definitions.filter(d => d.projectId === candidate.projectId && candidate.directory && projectForDirectory([{ rootPaths: [d.directory] }], candidate.directory)).sort((a,b) => b.directory.length - a.directory.length)[0];
      candidate.entryId = definition?.entryId || entryKey(candidate.projectId, candidate.directory || candidate.url);
      if (definition) { Object.assign(candidate, { directory: definition.directory, modifiedAt: definition.modifiedAt, framework: definition.framework, script: definition.script, command: definition.command }); definitions.splice(definitions.indexOf(definition), 1); }
      history[candidate.entryId] = { ...history[candidate.entryId], projectId:candidate.projectId,projectName:candidate.projectName,directory:candidate.directory, lastSeenAt: Date.now(), url: candidate.url, title: candidate.title };
    }
    // 历史只补充当前入口的运行信息，不再独立生成离线候选。
    const validIds = new Set([...candidates, ...definitions].map(c => c.entryId));
    for (const id of Object.keys(history)) if (!validIds.has(id)) delete history[id];
    for (const definition of definitions) {
      const running = this.launcher.running.get(definition.entryId);
      candidates.push({ ...history[definition.entryId], ...definition, url: running?.url || history[definition.entryId]?.url || null, status: running ? "running" : "stopped" });
    }
    for (const candidate of candidates) Object.assign(candidate, { lastSeenAt: history[candidate.entryId]?.lastSeenAt, lastStartedAt: history[candidate.entryId]?.lastStartedAt });
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(historyFile, JSON.stringify(history), { mode: 0o600 });
    this.entries = new Map(candidates.map(c => [c.entryId, c])); this.scannedAt = Date.now();
    this.discoveredUrls = new Set(candidates.filter(c => c.status === "running").map(c => c.url));
    return { candidates: selectDiscoveryCandidates(candidates, await this.read()), scope: "local-projects" };
  }
  async action(payload = {}) {
    if (payload.operation === "prepare-browser-site") {
      const site = normalizeSite({ url: payload.url, title: payload.title, origin: { kind: "external" } });
      const { projects } = await this.catalog();
      const cwd = payload.cwd ? await realpath(payload.cwd).catch(() => null) : null;
      const canonical = await Promise.all(projects.map(async p => ({ ...p, rootPaths: await Promise.all(p.rootPaths.map(r => realpath(r).catch(() => r))) })));
      const project = cwd ? projectForDirectory(canonical, cwd) : null;
      return { site, project: project ? { id: project.id, name: project.name } : null,
        preferProject: !!project && isLocalAddress(new URL(site.url).hostname) };
    }
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
